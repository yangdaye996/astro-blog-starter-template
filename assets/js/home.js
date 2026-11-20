// 首页：今日光谱 + 连续/总量摘要 + 六模块今日徽标与上次成绩 + 最近训练。
// 全部从会话日志现算（ADR-0012），模块元数据取自注册表（modules.js）。

import { loadSessions } from './store.js';
import { streak, weekCount, trainedToday, lastN } from './stats.js';
import { MODULES, moduleOf } from './modules.js';
import { paintTodayDots, initSoundToggle, fmtWhen } from './ui.js';

initSoundToggle();

const sessions = loadSessions();

// 今日光谱点 + 连续天数 + 总量
paintTodayDots(document.getElementById('today-dots'), sessions);
document.getElementById('tp-streak').textContent = streak(sessions);
document.getElementById('tp-meta').textContent =
	`本周 ${weekCount(sessions)} 次 · 共 ${sessions.length} 次`;

// 每模块：今日徽标 + 上次成绩
for (const m of MODULES) {
	const badge = document.querySelector(`[data-badge="${m.id}"]`);
	if (badge && trainedToday(sessions, m.id)) {
		badge.textContent = '今日已练';
		badge.classList.add('done');
	}
	const lastEl = document.querySelector(`[data-last="${m.id}"]`);
	if (lastEl) {
		const last = lastN(sessions, m.id, 1)[0];
		const gap = m.unit === '%' ? '' : ' ';
		lastEl.textContent = last ? `上次 ${m.metric(last)}${gap}${m.unit}` : '还没练过';
	}
}

// 最近训练：倒序最近 6 条
const list = document.getElementById('recent-list');
const empty = document.getElementById('recent-empty');
const recent = sessions.slice(-6).reverse();
if (recent.length === 0) {
	empty.hidden = false;
} else {
	empty.hidden = true;
	for (const s of recent) {
		const m = moduleOf(s.module);
		const li = document.createElement('li');
		const when = document.createElement('span');
		when.className = 'when';
		when.textContent = fmtWhen(s.ts);
		const what = document.createElement('span');
		what.className = 'what';
		const tag = document.createElement('span');
		tag.className = 'module-tag';
		tag.style.setProperty('--tag', `var(${m.hueVar})`);
		tag.style.setProperty('--tag-soft', `var(${m.softVar})`);
		tag.textContent = m.name;
		what.append(tag);
		const result = document.createElement('span');
		result.className = 'result num';
		result.textContent = m.fmtResult(s);
		li.append(when, what, result);
		list.append(li);
	}
}