// 舒尔特方格模块（ADR-0015）：N×N 乱序数字按序点完，首点起计时。
// 成绩 = 完成用时（秒，一位小数）+ 错点数；同阶内可比，个人最佳现算。

import { addSession, loadSessions } from '../store.js';
import { bestSession } from '../stats.js';
import { bindSeg, initSoundToggle } from '../ui.js';
import { blip, buzz, chime } from '../audio.js';

initSoundToggle();

let size = 5;
bindSeg(document.getElementById('seg-size'), (v) => (size = Number(v)));

const $ = (id) => document.getElementById(id);
const setupEl = $('setup');
const gameEl = $('game');
const resultEl = $('result');
const gridEl = $('grid');

let phase = 'idle'; // idle | ready（等首点）| running
let startTs = 0;
let timerId = 0;
let next = 1;
let errors = 0;
let total = 25;

function shuffle(arr) {
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
}

function renderTimer() {
	$('timer').textContent = ((Date.now() - startTs) / 1000).toFixed(1);
}

function renderProgress() {
	$('progress').textContent = `错 ${errors} 次 · 已点 ${next - 1}/${total}`;
	$('target').textContent = next <= total ? next : '✓';
}

function start() {
	clearInterval(timerId);
	phase = 'ready';
	startTs = 0;
	next = 1;
	errors = 0;
	total = size * size;

	gridEl.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
	gridEl.style.maxWidth = `${Math.min(420, size * 88)}px`;
	gridEl.replaceChildren();
	for (const v of shuffle(Array.from({ length: total }, (_, i) => i + 1))) {
		const b = document.createElement('button');
		b.type = 'button';
		b.textContent = v;
		b.dataset.v = v;
		gridEl.append(b);
	}

	$('timer').textContent = '0.0';
	renderProgress();
	setupEl.hidden = true;
	resultEl.hidden = true;
	gameEl.hidden = false;
}

function finish() {
	phase = 'idle';
	clearInterval(timerId);
	const timeSec = Math.round(((Date.now() - startTs) / 1000) * 10) / 10;

	// 先取旧最佳再写入，才能判断本轮是否破纪录
	const prior = bestSession(loadSessions(), 'schulte', (s) => s.params.size === size);
	const isRecord = !prior || timeSec < prior.result.timeSec;
	addSession({
		module: 'schulte',
		ts: startTs,
		params: { size },
		result: { timeSec, errors },
	});

	chime();
	gameEl.hidden = true;
	$('r-time').textContent = `${timeSec.toFixed(1)} 秒`;
	$('r-detail').textContent = `${size}×${size} 格 · 错 ${errors} 次`;
	$('r-best').textContent = prior
		? `同阶个人最佳 ${prior.result.timeSec.toFixed(1)} 秒`
		: `这是你的第一个 ${size}×${size} 成绩`;
	if (isRecord) {
		$('r-best').insertAdjacentHTML('beforeend', '<span class="record-tag">新纪录</span>');
	}
	resultEl.hidden = false;
}

gridEl.addEventListener('click', (e) => {
	const btn = e.target.closest('button[data-v]');
	if (!btn || phase === 'idle' || btn.classList.contains('done')) return;

	if (phase === 'ready') {
		phase = 'running';
		startTs = Date.now();
		timerId = setInterval(renderTimer, 100);
	}

	if (Number(btn.dataset.v) === next) {
		btn.classList.add('done');
		btn.disabled = true;
		// 音高随进度爬升，点起来像爬音阶
		blip(420 + next * 22, 0.14);
		next += 1;
		renderProgress();
		if (next > total) finish();
	} else {
		errors += 1;
		buzz();
		btn.classList.remove('wrong');
		void btn.offsetWidth; // 重置动画，连点错也能每次都抖
		btn.classList.add('wrong');
		setTimeout(() => btn.classList.remove('wrong'), 320);
		renderProgress();
	}
});

$('btn-start').addEventListener('click', start);
$('btn-again').addEventListener('click', start);