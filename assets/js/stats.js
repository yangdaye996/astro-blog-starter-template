// 统计派生（ADR-0012）：连续天数、周次数、趋势序列全部从会话日志现算，
// 不做任何落盘缓存 —— 日志是唯一事实，统计是它的纯函数。

import { ONE_DAY } from './store.js';

// 本地时区的 YYYY-MM-DD
export function dayKey(ms) {
	const d = new Date(ms);
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${d.getFullYear()}-${m}-${day}`;
}

function startOfDay(ms) {
	const d = new Date(ms);
	d.setHours(0, 0, 0, 0);
	return d.getTime();
}

// 连续训练天数：连续自然日每天至少一条会话。
// 当日没练不抹掉历史：从昨天起往前数。
export function streak(sessions) {
	const days = new Set(sessions.map((s) => dayKey(s.ts)));
	let cursor = startOfDay(Date.now());
	if (!days.has(dayKey(cursor))) cursor -= ONE_DAY;
	let n = 0;
	while (days.has(dayKey(cursor))) {
		n += 1;
		cursor -= ONE_DAY;
	}
	return n;
}

// 含今天在内最近 7 天的会话数
export function weekCount(sessions) {
	const since = startOfDay(Date.now()) - 6 * ONE_DAY;
	return sessions.filter((s) => s.ts >= since).length;
}

// 某模块今天是否已有会话（首页徽标用）
export function trainedToday(sessions, module) {
	const today = dayKey(Date.now());
	return sessions.some((s) => s.module === module && dayKey(s.ts) === today);
}

// 某模块最近 n 次会话，时间升序
export function lastN(sessions, module, n = 30) {
	return sessions
		.filter((s) => s.module === module)
		.slice(-n);
}

// 趋势序列：[{ ts, value }]，metric 由调用方按模块给出
export function trendSeries(sessions, module, metric, n = 30) {
	return lastN(sessions, module, n).map((s) => ({
		ts: s.ts,
		value: metric(s),
	}));
}
