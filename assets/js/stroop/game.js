// 斯特鲁普模块（ADR-0015）：色词冲突范式，选墨色不选字义。
// 一轮 30 题 = 15 一致 + 15 冲突（构造保证两组都有，干扰效应才算得出来），乱序。
// 成绩 = 准确率 + 平均反应时 + 干扰效应（冲突均反 − 一致均反）。

import { addSession, loadSessions } from '../store.js';
import { bestSession } from '../stats.js';
import { bindSeg, initSoundToggle } from '../ui.js';
import { blip, buzz, chime } from '../audio.js';

initSoundToggle();

// 六色全部在白底上可读；前四色是默认色集
const COLORS = [
	{ name: '红', ink: '#e03131' },
	{ name: '蓝', ink: '#1971c2' },
	{ name: '绿', ink: '#2b8a3e' },
	{ name: '紫', ink: '#7048e8' },
	{ name: '橙', ink: '#e8590c' },
	{ name: '青', ink: '#0c8599' },
];

const TRIALS = 30;
const CONGRUENT = 15;

let colors = 4;
bindSeg(document.getElementById('seg-colors'), (v) => {
	colors = Number(v);
	renderTrialInfo();
});

function renderTrialInfo() {
	document.getElementById('trial-info').textContent =
		`一轮 = ${TRIALS} 题 · ${CONGRUENT} 题字色一致 + ${TRIALS - CONGRUENT} 题冲突`;
}
renderTrialInfo();

const $ = (id) => document.getElementById(id);
const setupEl = $('setup');
const gameEl = $('game');
const resultEl = $('result');
const respEl = $('resp');

let running = false;
let startTs = 0;
let trials = [];
let idx = 0;
let correct = 0;
let pending = false;
let onset = 0;
let nextTimer = 0;
const rtCongruent = [];
const rtIncongruent = [];

const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

function shuffle(arr) {
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
}

// 生成题目：{ word, ink, congruent }，word/ink 都是色集下标
function genTrials() {
	const list = [];
	for (let i = 0; i < TRIALS; i++) {
		const congruent = i < CONGRUENT;
		const word = randInt(0, colors - 1);
		let ink = word;
		if (!congruent) {
			do {
				ink = randInt(0, colors - 1);
			} while (ink === word);
		}
		list.push({ word, ink, congruent });
	}
	return shuffle(list);
}

function buildButtons() {
	respEl.replaceChildren();
	for (let i = 0; i < colors; i++) {
		const b = document.createElement('button');
		b.type = 'button';
		b.dataset.i = i;
		b.style.background = COLORS[i].ink;
		b.innerHTML = `${COLORS[i].name}<kbd>${i + 1}</kbd>`;
		respEl.append(b);
	}
	$('kbd-hint').innerHTML = `按 <kbd>1</kbd>–<kbd>${colors}</kbd> 也能作答`;
}

function renderProgress() {
	$('progress').textContent = `第 ${Math.min(idx + 1, TRIALS)} / ${TRIALS} 题`;
	$('score-live').textContent = `对 ${correct}`;
}

function showTrial() {
	const t = trials[idx];
	const el = $('stimulus');
	el.textContent = COLORS[t.word].name;
	el.style.color = COLORS[t.ink].ink;
	if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
		el.animate(
			[{ transform: 'scale(0.9)', opacity: 0.3 }, { transform: 'scale(1)', opacity: 1 }],
			{ duration: 180, easing: 'ease-out' }
		);
	}
	$('feedback').textContent = '';
	$('feedback').className = 'feedback';
	for (const b of respEl.querySelectorAll('button')) {
		b.disabled = false;
		b.classList.remove('ok', 'bad', 'reveal');
	}
	pending = false;
	onset = performance.now();
	renderProgress();
}

function start() {
	clearTimeout(nextTimer);
	running = true;
	startTs = Date.now();
	idx = 0;
	correct = 0;
	rtCongruent.length = 0;
	rtIncongruent.length = 0;
	trials = genTrials();
	buildButtons();
	setupEl.hidden = true;
	resultEl.hidden = true;
	gameEl.hidden = false;
	showTrial();
}

function respond(i) {
	if (!running || pending || i >= colors) return;
	pending = true;
	const t = trials[idx];
	const rt = performance.now() - onset;
	const ok = i === t.ink;
	const btns = respEl.querySelectorAll('button');
	for (const b of btns) b.disabled = true;

	if (ok) {
		correct += 1;
		(t.congruent ? rtCongruent : rtIncongruent).push(rt);
		btns[i].classList.add('ok');
		blip(700, 0.14);
		$('feedback').textContent = '✓ 对了';
		$('feedback').className = 'feedback ok';
	} else {
		btns[i].classList.add('bad');
		btns[t.ink].classList.add('reveal');
		buzz();
		$('feedback').textContent = `✗ 墨色是「${COLORS[t.ink].name}」`;
		$('feedback').className = 'feedback err';
	}
	renderProgress();
	nextTimer = setTimeout(() => {
		idx += 1;
		if (idx >= TRIALS) end();
		else showTrial();
	}, ok ? 340 : 800);
}

const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;

function end() {
	running = false;
	clearTimeout(nextTimer);
	const rate = Math.round((correct / TRIALS) * 100);
	const allRt = [...rtCongruent, ...rtIncongruent];
	const avgMs = allRt.length ? Math.round(mean(allRt)) : 0;
	const computable = rtCongruent.length > 0 && rtIncongruent.length > 0;
	const interferenceMs = computable
		? Math.round(mean(rtIncongruent) - mean(rtCongruent))
		: 0;

	const prior = bestSession(loadSessions(), 'stroop', (s) => s.params.colors === colors);
	const isRecord = !prior || rate > prior.result.rate;
	addSession({
		module: 'stroop',
		ts: startTs,
		params: { colors, trials: TRIALS },
		result: { trials: TRIALS, correct, rate, avgMs, interferenceMs },
	});

	chime();
	gameEl.hidden = true;
	$('r-rate').textContent = `${rate}%`;
	$('r-avg').textContent = avgMs;
	$('r-inter').textContent = computable ? interferenceMs : '—';
	$('r-correct').textContent = `${correct}/${TRIALS}`;
	$('r-detail').textContent = `${colors} 色 · ${TRIALS} 题`;
	$('r-best').textContent = prior
		? `同色数最佳准确率 ${prior.result.rate}%`
		: `这是你的第一个 ${colors} 色成绩`;
	if (isRecord) {
		$('r-best').insertAdjacentHTML('beforeend', '<span class="record-tag">新纪录</span>');
	}
	resultEl.hidden = false;
}

respEl.addEventListener('click', (e) => {
	const btn = e.target.closest('button[data-i]');
	if (btn) {
		btn.blur();
		respond(Number(btn.dataset.i));
	}
});

document.addEventListener('keydown', (e) => {
	if (!running || gameEl.hidden || e.isComposing) return;
	if (e.key >= '1' && e.key <= '6') respond(Number(e.key) - 1);
});

$('btn-start').addEventListener('click', start);
$('btn-again').addEventListener('click', start);