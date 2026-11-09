// 统计页（ADR-0012/0013）：总览、每模块趋势曲线（手绘 SVG）、明细表、导出。
// 一切数据从会话日志现算，无缓存副本。

import { loadSessions, exportSessions } from '../store.js';
import { streak, weekCount, trendSeries } from '../stats.js';

const $ = (id) => document.getElementById(id);

// ---------- 总览 ----------

const sessions = loadSessions();
$('s-total').textContent = sessions.length;
$('s-streak').textContent = streak(sessions);
$('s-week').textContent = weekCount(sessions);

// ---------- 趋势曲线 ----------

const CHART = { w: 600, h: 170, padL: 10, padR: 46, padT: 16, padB: 24 };

const TRENDS = [
	{
		el: $('trend-math'),
		module: 'math',
		metric: (s) => s.result.correct,
		unit: '题',
	},
	{
		el: $('trend-nback'),
		module: 'nback',
		metric: (s) => Math.round(s.result.accuracy * 100),
		unit: '%',
	},
	{
		el: $('trend-meditation'),
		module: 'meditation',
		metric: (s) => Math.round((s.result.actualSec / 60) * 10) / 10,
		unit: '分',
	},
];

function renderTrend(el, series, unit) {
	if (series.length < 2) {
		el.innerHTML =
			'<div class="empty">次数不足，练满两轮这里就会长出曲线。</div>';
		return;
	}
	const { w, h, padL, padR, padT, padB } = CHART;
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
	// 主折线 + 数据点
	svg.insertAdjacentHTML(
		'beforeend',
		`<polyline points="${pts.join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />`
	);
	for (let i = 0; i < series.length; i++) {
		svg.insertAdjacentHTML(
			'beforeend',
			`<circle cx="${x(i).toFixed(1)}" cy="${y(series[i].value).toFixed(1)}" r="3" fill="var(--accent)" />`
		);
	}
	// 最大 / 最小 / 末值标注
	svg.insertAdjacentHTML(
		'beforeend',
		`<text x="${w - padR + 6}" y="${y(max) + 4}" font-size="11" fill="var(--ink-3)">最高 ${max}${unit}</text>
		 <text x="${w - padR + 6}" y="${y(min) + 4}" font-size="11" fill="var(--ink-3)">最低 ${min}${unit}</text>
		 <text x="${w - padR + 6}" y="${y(values[values.length - 1]) + 4}" font-size="11" font-weight="700" fill="var(--accent)">最新 ${
			values[values.length - 1]
		}${unit}</text>`
	);
	el.replaceChildren(svg);
}

for (const t of TRENDS) {
	renderTrend(t.el, trendSeries(sessions, t.module, t.metric), t.unit);
}

// ---------- 会话明细 ----------

const MODULE_NAME = { math: '心算', nback: 'N-back', meditation: '冥想' };

function fmtParams(s) {
	switch (s.module) {
		case 'math':
			return `L${s.params.level} · ${s.params.seconds} 秒`;
		case 'nback':
			return `n=${s.params.n} · ${s.params.trials} 刺激`;
		case 'meditation':
			return `${s.params.plannedMin} 分钟 · 引导${s.params.breathing ? '开' : '关'}`;
	}
}

function fmtResult(s) {
	switch (s.module) {
		case 'math': {
			const r = s.result;
			return `答对 ${r.correct}/${r.answered} · ${r.rate}%`;
		}
		case 'nback': {
			const r = s.result;
			return `准确率 ${Math.round(r.accuracy * 100)}% · 命${r.hits} 漏${r.misses} 误${r.falseAlarms}`;
		}
		case 'meditation': {
			const r = s.result;
			return `${r.completed ? '完成 ✓' : '未完成'} · ${Math.round((r.actualSec / 60) * 10) / 10} 分钟`;
		}
	}
}

function fmtWhen(ts) {
	const d = new Date(ts);
	const p = (n) => String(n).padStart(2, '0');
	return `${d.getMonth() + 1}月${d.getDate()}日 ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const body = $('log-body');
const logEmpty = $('log-empty');
if (sessions.length === 0) {
	logEmpty.hidden = false;
} else {
	// 明细最多展示最近 50 条，全量以导出 JSON 为准
	const rows = sessions.slice(-50).reverse();
	for (const s of rows) {
		body.insertAdjacentHTML(
			'beforeend',
			`<tr><td>${fmtWhen(s.ts)}</td><td><span class="module-tag">${MODULE_NAME[s.module]}</span></td><td>${fmtParams(s)}</td><td class="num">${fmtResult(s)}</td></tr>`
		);
	}
}

// ---------- 导出备份 ----------

$('btn-export').addEventListener('click', exportSessions);
