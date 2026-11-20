// 共享界面小件（ADR-0015/0016）：分段选择器、全局静音开关、
// 今日光谱点、时间格式化。各页逻辑只管玩法，界面约定从这里取。

import { soundOn, setSoundOn } from './audio.js';
import { MODULES } from './modules.js';
import { trainedToday } from './stats.js';

// 分段选择器：单选涂色，aria-pressed 即状态
export function bindSeg(el, onChange) {
	for (const btn of el.querySelectorAll('button')) {
		btn.addEventListener('click', () => {
			for (const b of el.querySelectorAll('button')) {
				b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
			}
			onChange(btn.dataset.value);
		});
	}
}

export function segValue(el) {
	return el.querySelector('[aria-pressed="true"]').dataset.value;
}

// 顶栏静音开关：一个按钮管全站声音，状态持久化（audio.js）
export function initSoundToggle() {
	const btn = document.getElementById('sound-toggle');
	if (!btn) return;
	const paint = () => {
		const on = soundOn();
		btn.setAttribute('aria-pressed', String(on));
		btn.title = on ? '声音：开（点击静音）' : '声音：关（点击开启）';
		btn.setAttribute('aria-label', btn.title);
	};
	paint();
	btn.addEventListener('click', () => {
		setSoundOn(!soundOn());
		paint();
	});
}

// 今日光谱点：六模块各一颗，今日练过 = 填实
export function paintTodayDots(el, sessions) {
	el.replaceChildren();
	for (const m of MODULES) {
		const done = trainedToday(sessions, m.id);
		const dot = document.createElement('span');
		dot.className = `td${done ? ' done' : ''}`;
		dot.style.setProperty('--td-hue', `var(${m.hueVar})`);
		dot.title = `${m.name}：今日${done ? '已练' : '未练'}`;
		el.append(dot);
	}
}

// 明细与最近训练共用：11月20日 14:05
export function fmtWhen(ts) {
	const d = new Date(ts);
	const p = (n) => String(n).padStart(2, '0');
	return `${d.getMonth() + 1}月${d.getDate()}日 ${p(d.getHours())}:${p(d.getMinutes())}`;
}