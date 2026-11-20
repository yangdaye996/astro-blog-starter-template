// 统计页（ADR-0012/0013/0015）：总览、今日光谱、能力光谱、六模块趋势（手绘 SVG）、
// 明细表（可按模块筛选）、导出。一切从会话日志现算，无缓存副本。

import { loadSessions, exportSessions } from '../store.js';
import { streak, weekCount, trendSeries, bestSession } from '../stats.js';
import { MODULES, moduleOf } from '../modules.js';
import { paintTodayDots, initSoundToggle, fmtWhen } from '../ui.js';

initSoundToggle();

const $ = (id) => document.getElementById(id);
const sessions = loadSessions();

// ---------- 总览 + 今日光谱 ----------

$('s-total').textContent = sessions.length;
$('s-streak').textContent = streak(sessions);
$('s-week').textContent = weekCount(sessions);
paintTodayDots($('today-dots'), sessions);

// ---------- 能力光谱：每模块次数条 + 最佳成绩 ----------

const specEl = $('spectrum');
if (sessions.length === 0) {
	$('spectrum-empty').hidden = false;
} else {
	$('spectrum-empty').hidden = true;
	const counts = MODULES.map((m) => sessions.filter((s) => s.module === m.id).length);
	const maxCount = Math.max(1, ...counts);
	MODULES.forEach((m, i) => {
		const best = bestSession(sessions, m.id);
		const gap = m.unit === '%' ? '' : ' ';
		const row = document.createElement('div');
		row.className = 'spec-row';
		row.style.setProperty('--td-hue', `var(${m.hueVar})`);
		row.innerHTML = `
			<span class="spec-dot"></span>
			<span class="spec-name">${m.name}</span>
			<span class="spec-bar"><i style="width: ${(counts[i] / maxCount) * 100}%"></i></span>
			<span class="spec-count num">${counts[i]} 次</span>
			<span class="spec-best num">${best ? `最佳 ${m.metric(best)}${gap}${m.unit}` : '—'}</span>`;
		specEl.append(row);
	});
}

// ---------- 趋势曲线：每模块一条，用自己的色 ----------

const CHART = { h: 170, padL: 10, padR: 68, padT: 16, padB: 24 };

function renderTrend(el, series, unit, hueVar) {
	if (series.length < 2) {
		el.innerHTML = '<div class="empty">次数不足，练满两轮这里就会长出曲线。</div>';
		return;
	}
	const hue = `var(${hueVar})`;
	// viewBox 宽度跟随容器实际宽度，标注字号才不会在窄屏被缩到不可读
	const w = Math.max(280, el.clientWidth - 16);
	const { h, padL, padR, padT, padB } = CHART;
	const innerW = w - padL - padR;
	const innerH = h - padT - padB;
	const values = series.map((p) => p.value);
	let min = Math.min(...values);
	let max = Math.max(...values);
	if (min === max) {
		min -= 1;
		max += 1;
	}
	const x = (i) => padL + (innerW * i) / (series.length - 1);
	const y = (v) => padT + innerH * (1 - (v - min) / (max - min));
	const pts = series.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`);
	const baseline = padT + innerH;

	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
	svg.setAttribute('class', 'trend-svg');
	svg.setAttribute('role', 'img');
	// 三条水平参考线
	for (const t of [0, 0.5, 1]) {
		const gy = padT + innerH * t;
		svg.insertAdjacentHTML(
			'beforeend',
			`<line x1="${padL}" y1="${gy}" x2="${w - padR}" y2="${gy}" stroke="var(--line)" stroke-width="1" />`
		);
	}
	// 面积 + 主折线
	svg.insertAdjacentHTML(
		'beforeend',
		`<polygon points="${pts.join(' ')} ${x(series.length - 1).toFixed(1)},${baseline} ${padL},${baseline}" fill="${hue}" fill-opacity="0.12" />`
	);
	svg.insertAdjacentHTML(
		'beforeend',
		`<polyline points="${pts.join(' ')}" fill="none" stroke="${hue}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />`
	);
	// 数据点，末点加一圈光环
	for (let i = 0; i < series.length; i++) {
		const cx = x(i).toFixed(1);
		const cy = y(series[i].value).toFixed(1);
		svg.insertAdjacentHTML('beforeend', `<circle cx="${cx}" cy="${cy}" r="3" fill="${hue}" />`);
	}
	const lastX = x(series.length - 1).toFixed(1);
	const lastY = y(values[values.length - 1]).toFixed(1);
	svg.insertAdjacentHTML(
		'beforeend',
		`<circle cx="${lastX}" cy="${lastY}" r="7" fill="none" stroke="${hue}" stroke-opacity="0.4" stroke-width="2" />`
	);
	// 最大 / 最小 / 末值标注，右对齐收在右侧留白里。末值与最值重合时省略重复标签防叠字。
	const lastVal = values[values.length - 1];
	const lx = w - 2;
	const labels = [];
	if (max !== lastVal) {
		labels.push(`<text x="${lx}" y="${y(max) + 4}" text-anchor="end" font-size="11" fill="var(--ink-3)">最高 ${max}${unit}</text>`);
	}
	if (min !== lastVal) {
		labels.push(`<text x="${lx}" y="${y(min) + 4}" text-anchor="end" font-size="11" fill="var(--ink-3)">最低 ${min}${unit}</text>`);
	}
	labels.push(`<text x="${lx}" y="${y(lastVal) + 4}" text-anchor="end" font-size="11" font-weight="700" fill="${hue}">最新 ${lastVal}${unit}</text>`);
	svg.insertAdjacentHTML('beforeend', labels.join(''));
	el.replaceChildren(svg);
}

const trendGrid = $('trend-grid');
trendGrid.replaceChildren(); // 清掉无 JS 兜底文案
const trendJobs = [];
for (const m of MODULES) {
	const block = document.createElement('div');
	block.className = 'trend-block';
	const h3 = document.createElement('h3');
	h3.innerHTML = `${m.name} <span class="metric">· ${m.metricLabel}（${m.unit}）</span>`;
	const chart = document.createElement('div');
	chart.className = 'trend-chart';
	block.append(h3, chart);
	trendGrid.append(block);
	trendJobs.push({ el: chart, series: trendSeries(sessions, m.id, m.metric), unit: m.unit, hueVar: m.hueVar });
}

function renderAllTrends() {
	for (const j of trendJobs) renderTrend(j.el, j.series, j.unit, j.hueVar);
}
renderAllTrends();

// 视口变化后按新容器宽度重画，保持标注可读
let resizeTimer = 0;
window.addEventListener('resize', () => {
	clearTimeout(resizeTimer);
	resizeTimer = setTimeout(renderAllTrends, 150);
});

// ---------- 会话明细 + 模块筛选 ----------

const filtersEl = $('log-filters');
const body = $('log-body');
const logEmpty = $('log-empty');
let currentFilter = 'all';

function makeChip(id, label, hueVar) {
	const b = document.createElement('button');
	b.type = 'button';
	b.dataset.filter = id;
	b.setAttribute('aria-pressed', String(id === currentFilter));
	if (hueVar) {
		b.innerHTML = `<span class="fd" style="--fd-hue: var(${hueVar})"></span>${label}`;
	} else {
		b.textContent = label;
	}
	b.addEventListener('click', () => {
		currentFilter = id;
		for (const c of filtersEl.querySelectorAll('button')) {
			c.setAttribute('aria-pressed', String(c.dataset.filter === id));
		}
		renderLog();
	});
	return b;
}

filtersEl.append(makeChip('all', '全部'));
for (const m of MODULES) filtersEl.append(makeChip(m.id, m.name, m.hueVar));

function renderLog() {
	body.replaceChildren();
	const filtered =
		currentFilter === 'all' ? sessions : sessions.filter((s) => s.module === currentFilter);
	if (sessions.length === 0) {
		logEmpty.hidden = false;
		logEmpty.innerHTML =
			'还没有任何训练记录。先去<a href="/math/">心算</a>、<a href="/schulte/">舒尔特</a>或<a href="/meditation/">冥想</a>练一轮，这里就会有东西了。';
		return;
	}
	if (filtered.length === 0) {
		logEmpty.hidden = false;
		logEmpty.textContent = '这个模块还没有记录，去练一轮吧。';
		return;
	}
	logEmpty.hidden = true;
	// 明细最多展示最近 50 条，全量以导出 JSON 为准
	const rows = filtered.slice(-50).reverse();
	for (const s of rows) {
		const m = moduleOf(s.module);
		body.insertAdjacentHTML(
			'beforeend',
			`<tr><td>${fmtWhen(s.ts)}</td><td><span class="module-tag" style="--tag: var(${m.hueVar}); --tag-soft: var(${m.softVar})">${m.name}</span></td><td class="col-params">${m.fmtParams(s)}</td><td class="num">${m.fmtResult(s)}</td></tr>`
		);
	}
}

renderLog();

// ---------- 导出备份 ----------

$('btn-export').addEventListener('click', exportSessions);