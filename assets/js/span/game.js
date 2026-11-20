// 序列记忆模块（ADR-0015）：Corsi 式空间序列复现。
// 每轮闪一段顺序，用户照点；对一轮加一格，点错即止，上限 12 格。
// 成绩 = 记忆广度（稳定复现的最长长度）+ 过的轮数。
// 所有延时回调挂 runId 守卫：重开/结束后旧回调一律作废，不会串场。

import { addSession, loadSessions } from '../store.js';
import { bestSession } from '../stats.js';
import { bindSeg, initSoundToggle } from '../ui.js';
import { blip, buzz, chime } from '../audio.js';

initSoundToggle();

const FLASH_MS = 600;
const GAP_MS = 280;
const MAX_LEN = 12;

let startLen = 2;
bindSeg(document.getElementById('seg-start'), (v) => (startLen = Number(v)));

const $ = (id) => document.getElementById(id);
const setupEl = $('setup');
const gameEl = $('game');
const resultEl = $('result');
const gridEl = $('grid');
const tiles = [...gridEl.querySelectorAll('button')];

let runId = 0;
let timers = [];
let phase = 'idle'; // idle | show | input | between
let seq = [];
let len = 2;
let inputPos = 0;
let rounds = 0;
let maxSpan = 0;
let sessionStart = 0;

function later(fn, ms) {
	const guard = runId;
	const id = setTimeout(() => {
		if (guard === runId) fn();
	}, ms);
	timers.push(id);
	return id;
}

function clearTimers() {
	for (const t of timers) clearTimeout(t);
	timers = [];
}

const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const pitch = (i) => 300 + i * 55; // 每格一个音高，闪光像弹琴

// 生成不连续重复的随机序列（相邻两格不同，闪光才分得清）
function genSeq(n) {
	const arr = [];
	for (let i = 0; i < n; i++) {
		let p;
		do {
			p = randInt(0, 8);
		} while (i > 0 && p === arr[i - 1]);
		arr.push(p);
	}
	return arr;
}

function setTilesEnabled(on) {
	for (const t of tiles) t.disabled = !on;
}

function renderDots() {
	const el = $('dots');
	el.replaceChildren();
	for (let i = 0; i < len; i++) {
		const s = document.createElement('span');
		if (i < inputPos) s.className = 'filled';
		el.append(s);
	}
}

function renderInfo() {
	$('round-info').textContent = `第 ${rounds + 1} 轮`;
	$('len-info').textContent = `长度 ${len}`;
}

function flash(i, cls, ms) {
	tiles[i].classList.add(cls);
	later(() => tiles[i].classList.remove(cls), ms);
}

function newRound() {
	phase = 'show';
	inputPos = 0;
	seq = genSeq(len);
	renderInfo();
	renderDots();
	$('phase').textContent = '看好顺序';
	setTilesEnabled(false);

	seq.forEach((cell, i) => {
		later(() => {
			flash(cell, 'lit', FLASH_MS);
			blip(pitch(cell), 0.16);
		}, i * (FLASH_MS + GAP_MS));
	});

	later(() => {
		phase = 'input';
		$('phase').textContent = `该你了 · 点第 1 格`;
		setTilesEnabled(true);
	}, seq.length * (FLASH_MS + GAP_MS) + 120);
}

function start() {
	runId += 1;
	clearTimers();
	rounds = 0;
	maxSpan = 0;
	len = startLen;
	sessionStart = Date.now();
	setupEl.hidden = true;
	resultEl.hidden = true;
	gameEl.hidden = false;
	newRound();
}

function roundWin() {
	rounds += 1;
	maxSpan = len;
	phase = 'between';
	setTilesEnabled(false);
	chime();
	$('phase').textContent = '✓ 对了，下一轮加长';
	if (len >= MAX_LEN) {
		later(() => finish(true), 800);
	} else {
		len += 1;
		later(newRound, 1000);
	}
}

function finish(capped) {
	runId += 1;
	clearTimers();
	phase = 'idle';
	setTilesEnabled(false);

	const prior = bestSession(loadSessions(), 'span');
	const isRecord = !prior || maxSpan > prior.result.maxSpan;
	addSession({
		module: 'span',
		ts: sessionStart,
		params: { startLen, flashMs: FLASH_MS },
		result: { maxSpan, rounds },
	});

	gameEl.hidden = true;
	$('r-span').textContent = `${maxSpan} 格`;
	$('r-detail').textContent =
		maxSpan === 0
			? '第一轮就没复现出来，再来一次'
			: `过了 ${rounds} 轮 · 起始 ${startLen} 格${capped ? ` · 触顶 ${MAX_LEN} 格` : ''}`;
	$('r-best').textContent = prior
		? `个人最佳 ${prior.result.maxSpan} 格`
		: '这是你的第一个序列记忆成绩';
	if (isRecord && maxSpan > 0) {
		$('r-best').insertAdjacentHTML('beforeend', '<span class="record-tag">新纪录</span>');
	}
	resultEl.hidden = false;
}

gridEl.addEventListener('click', (e) => {
	const btn = e.target.closest('button[data-i]');
	if (!btn || phase !== 'input') return;
	const i = Number(btn.dataset.i);

	if (i === seq[inputPos]) {
		flash(i, 'ok', 220);
		blip(pitch(i), 0.16);
		inputPos += 1;
		renderDots();
		if (inputPos >= seq.length) {
			roundWin();
		} else {
			$('phase').textContent = `该你了 · 点第 ${inputPos + 1} 格`;
		}
	} else {
		phase = 'idle';
		setTilesEnabled(false);
		flash(i, 'bad', 500);
		buzz();
		$('phase').textContent = '点错了，本轮结束';
		later(() => finish(false), 650);
	}
});

$('btn-start').addEventListener('click', start);
$('btn-again').addEventListener('click', start);