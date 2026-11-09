// N-back 模块（ADR-0013）：单位置 n-back，3×3 网格。
// 一轮 = 20+n 个刺激；呈现 500ms，间隔 3000ms；目标 ≥ 6 个（构造而非纯随机）。

import { addSession } from '../store.js';

const SHOW_MS = 500;
const INTERVAL_MS = 3000;

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

let n = 2;

setupSeg(document.getElementById('seg-n'), (v) => {
	n = Number(v);
	renderTrialInfo();
});

function renderTrialInfo() {
	document.getElementById('trial-info').textContent = `一轮 = ${20 + n} 个刺激 · 每刺激 3 秒 · 目标至少 6 个`;
}

renderTrialInfo();

// ---------- 序列生成 ----------

const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

function shuffle(arr) {
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
}

// 生成 { pos, targetMask }。
// 目标构造策略：先在可选槽位 [n, trials-1] 里抽 6~8 个位置标记为目标，
// 目标位直接复制 n 步前的位置；非目标位随机取「与 n 步前不同」的格子。
let pos = [];
let targetMask = [];

function genSequence(trials) {
	const candidates = [];
	for (let i = n; i < trials; i++) candidates.push(i);
	shuffle(candidates);
	const targetCount = Math.min(6 + randInt(0, 2), candidates.length);
	targetMask = new Array(trials).fill(false);
	for (const i of candidates.slice(0, targetCount)) targetMask[i] = true;

	pos = new Array(trials);
	for (let i = 0; i < trials; i++) {
		if (targetMask[i]) {
			pos[i] = pos[i - n]; // 目标：与 n 步前相同
		} else if (i >= n) {
			let p;
			do {
				p = randInt(0, 8);
			} while (p === pos[i - n]); // 非目标：确保不同
			pos[i] = p;
		} else {
			pos[i] = randInt(0, 8); // 前 n 步不可能成目标
		}
	}
}

// ---------- 会话状态 ----------

const $ = (id) => document.getElementById(id);
const setupEl = $('setup');
const gameEl = $('game');
const resultEl = $('result');
const gridEl = $('grid');
const cells = gridEl.querySelectorAll('.cell');

let running = false;
let startTs = 0;
let idx = 0;
let trials = 22;
let slotTimeout = 0;
let flashTimeout = 0;
let pressed = false;
let hits = 0;
let misses = 0;
let falseAlarms = 0;
let targetCount = 0;

function renderProgress() {
	$('nflag').textContent = `n = ${n}`;
	$('progress').textContent = `${Math.min(idx + 1, trials)} / ${trials}`;
	$('match-note').textContent = `当前亮起的位置，与 ${n} 步前相同吗？相同按空格，不同不要按。`;
}

// ---------- 流程 ----------

function start() {
	running = true;
	startTs = Date.now();
	idx = 0;
	hits = 0;
	misses = 0;
	falseAlarms = 0;
	trials = 20 + n;
	genSequence(trials);
	targetCount = targetMask.filter(Boolean).length;
	setupEl.hidden = true;
	resultEl.hidden = true;
	gameEl.hidden = false;
	renderProgress();
	$('btn-match').disabled = false;
	setTimeout(slot, 800); // 给半秒余裕看清九宫格再开始
}

function slot() {
	if (idx >= trials) {
		end();
		return;
	}
	pressed = false;
	const cellEl = cells[pos[idx]];
	cellEl.classList.add('lit');
	setTimeout(() => cellEl.classList.remove('lit'), SHOW_MS);
	slotTimeout = setTimeout(() => {
		// 槽位结束才判定：按键窗口 = 整个 3 秒槽
		if (targetMask[idx]) {
			pressed ? (hits += 1) : (misses += 1);
		} else if (pressed) {
			falseAlarms += 1;
		}
		idx += 1;
		renderProgress();
		slot();
	}, INTERVAL_MS);
}

function press() {
	if (!running || pressed) return;
	pressed = true;
	const ok = targetMask[idx]; // 当下即可判定（pos[idx] 与 pos[idx-n] 已知）
	gridEl.classList.add(ok ? 'judge-ok' : 'judge-bad');
	clearTimeout(flashTimeout);
	flashTimeout = setTimeout(() => gridEl.classList.remove('judge-ok', 'judge-bad'), 350);
}

function end() {
	running = false;
	clearTimeout(slotTimeout);
	$('btn-match').disabled = true;
	// 命中 + 正确拒绝 / 总刺激数
	const correctRejections = trials - targetCount - falseAlarms;
	const accuracy = (hits + correctRejections) / trials;
	addSession({
		module: 'nback',
		ts: startTs,
		params: { n, trials, intervalMs: INTERVAL_MS },
		result: { hits, misses, falseAlarms, accuracy: Number(accuracy.toFixed(4)) },
	});
	gameEl.hidden = true;
	$('r-acc').textContent = `${Math.round(accuracy * 100)}%`;
	$('r-hit').textContent = hits;
	$('r-miss').textContent = misses;
	$('r-fa').textContent = falseAlarms;
	resultEl.hidden = false;
}

// ---------- 事件绑定 ----------

$('btn-start').addEventListener('click', start);
$('btn-again').addEventListener('click', start);
$('btn-match').addEventListener('click', press);

document.addEventListener('keydown', (e) => {
	if (e.code === 'Space') {
		e.preventDefault(); // 空格默认滚屏
		if (running && !gameEl.hidden) press();
	}
});
