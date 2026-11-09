// 首页：今日各模块状态 + 连续/总量摘要（现算，ADR-0012）
import { loadSessions } from './store.js';
import { streak, weekCount, trainedToday } from './stats.js';

const sessions = loadSessions();

for (const mod of ['math', 'nback', 'meditation']) {
	const el = document.querySelector(`[data-badge="${mod}"]`);
	if (el && trainedToday(sessions, mod)) {
		el.textContent = '今日已练 ✓';
		el.classList.add('done');
	}
}

const total = sessions.length;
const summary = document.getElementById('summary');
if (total > 0 && summary) {
	summary.hidden = false;
	summary.textContent = `连续 ${streak(sessions)} 天 · 共 ${total} 次 · 本周 ${weekCount(sessions)} 次`;
}
