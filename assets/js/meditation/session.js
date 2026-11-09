// 冥想模块（ADR-0013）：静坐计时 + 可选呼吸引导（4 秒吸 / 4 秒呼）。
// 结束钟声由 Web Audio 合成（audio.js，无音频文件）。

import { addSession } from '../store.js';
import { bell } from '../audio.js';

const TITLE_REST = '冥想 · 心智训练站';

// ---------- 分段选择器 ----------

function setupSeg(el, onChange) {
	for (const btn of el.querySelectorAll('button')) {
		btn.addEventListener('click', () => {
			for (const b of el.querySelectorAll('button')) {
				b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
			}
			onChange(btn.dataset.value);
		});
	}
}

let plannedMin = 5;
let breathing = true;

setupSeg(document.getElementById('seg-min'), (v) => (plannedMin = Number(v)));
setupSeg(document.getElementById('seg-breath'), (v) => (breathing = v === 'on'));

// ---------- 会话状态 ----------

const $ = (id) => document.getElementById(id);
const setupEl = $('setup');
const gameEl = $('game');
const resultEl = $('result');

let phase = 'idle'; // idle | countdown | sit
let startTs = 0;
let sitTs = 0;
let totalMs = 0;
let tickId = 0;
let breathId = 0;
let countdownTimeouts = [];

const mmss = (ms) => {
	const s = Math.max(0, Math.ceil(ms / 1000));
	return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

// ---------- 流程 ----------

function start() {
	setupEl.hidden = true;
	resultEl.hidden = true;
	gameEl.hidden = false;
	startTs = Date.now();
	phase = 'countdown';

	// 倒计时阶段：计时文案先行，球与引导词都藏起来
	$('remain').textContent = mmss(plannedMin * 60000);
	$('progress').style.width = '0%';
	$('ball').hidden = true;
	$('breath-word').hidden = true;
	const countIn = $('count-in');
	countIn.hidden = false;
	countIn.textContent = '3';
	countdownTimeouts = [
		setTimeout(() => (countIn.textContent = '2'), 1000),
		setTimeout(() => (countIn.textContent = '1'), 2000),
		setTimeout(sitPhase, 3000),
	];
}

function sitPhase() {
	phase = 'sit';
	sitTs = Date.now();
	totalMs = plannedMin * 60000;
	$('count-in').hidden = true;

	if (breathing) {
		// 球的 CSS 动画（8s 周期）与吸/呼文案同一个 tick 启动，相位对齐
		$('ball').hidden = false;
		$('breath-word').hidden = false;
		$('breath-word').textContent = '吸';
		breathId = setInterval(() => {
			$('breath-word').textContent =
				$('breath-word').textContent === '吸' ? '呼' : '吸';
		}, 4000);
	}

	document.title = `${mmss(totalMs)} · 冥想`;
	tickId = setInterval(tick, 250);
}

function tick() {
	const elapsed = Date.now() - sitTs;
	const remainMs = totalMs - elapsed;
	$('remain').textContent = mmss(remainMs);
	$('progress').style.width = `${Math.min(100, (elapsed / totalMs) * 100)}%`;
	if (remainMs <= 0) finish(true);
}

// completed=false = 中途放弃：时长照记（ADR-0013）
function finish(completed) {
	clearInterval(tickId);
	clearInterval(breathId);
	for (const t of countdownTimeouts) clearTimeout(t);
	countdownTimeouts = [];
	document.title = TITLE_REST;

	const actualSec = phase === 'sit' ? Math.round((Date.now() - sitTs) / 1000) : 0;
	phase = 'idle';
	gameEl.hidden = true;

	if (actualSec > 0) {
		addSession({
			module: 'meditation',
			ts: startTs,
			params: { plannedMin, breathing },
			result: { actualSec, completed },
		});
	}
	bell(392, 0.5); // 结束钟声，比开场低沉

	$('r-min').textContent = `${Math.max(1, Math.round(actualSec / 60))} 分钟`;
	$('r-detail').textContent = completed
		? `完成 ✓ · 计划 ${plannedMin} 分钟 · 呼吸引导${breathing ? '开' : '关'}`
		: `中途结束 · 静坐 ${actualSec} 秒 · 已记录为未完成`;
	resultEl.hidden = false;
}

// ---------- 事件绑定 ----------

$('btn-start').addEventListener('click', start);
$('btn-again').addEventListener('click', start);

$('btn-abort').addEventListener('click', () => {
	if (phase === 'countdown') {
		// 倒计时里反悔 = 没开始过，不留记录
		clearTimeoutAll();
		phase = 'idle';
		gameEl.hidden = true;
		setupEl.hidden = false;
		return;
	}
	if (phase === 'sit' && confirm('确定结束本次冥想？将记录为未完成。')) {
		finish(false);
	}
});

function clearTimeoutAll() {
	clearInterval(tickId);
	clearInterval(breathId);
	for (const t of countdownTimeouts) clearTimeout(t);
	countdownTimeouts = [];
}
