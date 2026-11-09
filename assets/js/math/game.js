// 心算模块（ADR-0013）：三档难度、限时冲刺、键入作答。
// 题库生成器按档位写成纯函数；成绩口径 = 档位内答对题数。

import { addSession } from '../store.js';

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

function segValue(el) {
	return el.querySelector('[aria-pressed="true"]').dataset.value;
}

let level = 1;
let seconds = 60;

setupSeg(document.getElementById('seg-level'), (v) => (level = Number(v)));
setupSeg(document.getElementById('seg-seconds'), (v) => (seconds = Number(v)));

// ---------- 题库生成器 ----------

const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

// 乘法专项（聚焦纯乘法，去掉加减除）：
// L1 两位×一位（积 2–3 位）；L2 两位×两位、积三位；L3 两位×两位、积四位。
// 生成器保证乘数均为两位数、积的位数符合档位。
export function genQuestion(lv) {
	if (lv === 1) {
		const a = randInt(11, 99);
		const b = randInt(2, 9);
		return { text: `${a} × ${b}`, answer: a * b };
	}
	if (lv === 2) {
		// a∈[12,49] 两位；b∈[10,⌊999/a⌋]，b 上限与 a 一起把积托在三位以内
		const a = randInt(12, 49);
		const b = randInt(10, Math.min(99, Math.floor(999 / a)));
		return { text: `${a} × ${b}`, answer: a * b };
	}
	// L3：b 下限 ⌈1000/a⌉ 保证积进四位
	const a = randInt(11, 99);
	const b = randInt(Math.max(10, Math.ceil(1000 / a)), 99);
	return { text: `${a} × ${b}`, answer: a * b };
}

// ---------- 会话状态 ----------

const $ = (id) => document.getElementById(id);
const setupEl = $('setup');
const gameEl = $('game');
const resultEl = $('result');

let running = false;
let startTs = 0;
let remain = 0;
let timerId = 0;
let nextTimer = 0; // 答错展示正确答案的延迟
let pending = false; // 延迟期内锁键盘
let answered = 0;
let correct = 0;
let cur = null;
let typed = '';

// ---------- 渲染 ----------

function renderTimer() {
	const el = $('timer');
	el.textContent = remain;
	el.classList.toggle('low', remain <= 10);
}

function renderEntry() {
	$('entry').textContent = typed;
}

function renderProgress() {
	$('progress').textContent = `第 ${answered + 1} 题`;
}

function showFeedback(cls, text) {
	const el = $('feedback');
	el.textContent = text;
	el.className = `feedback ${cls}`;
}

// ---------- 流程 ----------

function start() {
	running = true;
	startTs = Date.now();
	answered = 0;
	correct = 0;
	remain = seconds;
	setupEl.hidden = true;
	resultEl.hidden = true;
	gameEl.hidden = false;
	renderTimer();
	renderProgress();
	nextQuestion();
	timerId = setInterval(tick, 1000);
}

function tick() {
	remain -= 1;
	renderTimer();
	if (remain <= 0) end();
}

function nextQuestion() {
	cur = genQuestion(level);
	typed = '';
	pending = false;
	$('question').textContent = `${cur.text} = ?`;
	renderEntry();
	renderProgress();
	showFeedback('', '');
	setKeypadEnabled(true);
}

function setKeypadEnabled(on) {
	for (const b of $('keypad').querySelectorAll('button')) b.disabled = !on;
}

function judge() {
	if (pending) return;
	const val = Number.parseInt(typed, 10);
	answered += 1;
	if (val === cur.answer) {
		correct += 1;
		showFeedback('ok', '✓ 对了');
		nextTimer = setTimeout(nextQuestion, 350);
	} else {
		pending = true;
		setKeypadEnabled(false);
		showFeedback('err', `✗ 正确答案 ${cur.answer}`);
		nextTimer = setTimeout(nextQuestion, 900);
	}
}

function onKey(key) {
	if (!running || pending) return;
	if (key >= '0' && key <= '9') {
		// 最大答案 9801（99×99，L3），四位封顶
		typed = (typed + key).slice(0, 4);
		renderEntry();
	} else if (key === 'back') {
		typed = typed.slice(0, -1);
		renderEntry();
	} else if (key === 'submit') {
		if (typed !== '') judge();
	} else if (key === 'skip') {
		nextQuestion();
	}
}

function end() {
	running = false;
	clearInterval(timerId);
	clearTimeout(nextTimer);
	gameEl.hidden = true;
	const rate = answered > 0 ? Math.round((correct / answered) * 100) : 0;
	addSession({
		module: 'math',
		ts: startTs,
		params: { level, seconds },
		result: { answered, correct, rate },
	});
	$('r-correct').textContent = `${correct} 题`;
	$('r-detail').textContent = `答 ${answered} 题 · 正确率 ${rate}% · L${level} · ${seconds} 秒`;
	resultEl.hidden = false;
}

// ---------- 事件绑定 ----------

$('btn-start').addEventListener('click', start);
$('btn-again').addEventListener('click', start);
$('keypad').addEventListener('click', (e) => {
	const btn = e.target.closest('button[data-key]');
	if (btn) onKey(btn.dataset.key);
});

// 物理键盘：数字键入、退格改正、回车提交
document.addEventListener('keydown', (e) => {
	if (!running || gameEl.hidden) return;
	if (e.key >= '0' && e.key <= '9') onKey(e.key);
	else if (e.key === 'Backspace') onKey('back');
	else if (e.key === 'Enter') onKey('submit');
});
