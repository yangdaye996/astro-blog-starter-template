// 模块注册表（ADR-0015）：六模块的展示元数据与成绩口径唯一源。
// 首页入口卡、统计页趋势/明细、个人最佳比较都从这里取，避免多处漂移。
// 玩法与字段规格的真源仍是 docs/adr/ADR-0013 与 ADR-0015。

export const MODULES = [
	{
		id: 'math',
		name: '心算',
		nav: '心算',
		href: '/math/',
		ability: '计算速度',
		hueVar: '--m-math',
		softVar: '--m-math-soft',
		desc: '限时乘法冲刺，档位内答对尽可能多。',
		metricLabel: '答对题数',
		unit: '题',
		better: 'high',
		metric: (s) => s.result.correct,
		fmtParams: (s) => `L${s.params.level} · ${s.params.seconds} 秒`,
		fmtResult: (s) => `答对 ${s.result.correct}/${s.result.answered} · ${s.result.rate}%`,
	},
	{
		id: 'nback',
		name: 'N-back',
		nav: 'N-back',
		href: '/nback/',
		ability: '工作记忆',
		hueVar: '--m-nback',
		softVar: '--m-nback-soft',
		desc: '网格位置回溯，与 n 步前相同就按。',
		metricLabel: '准确率',
		unit: '%',
		better: 'high',
		metric: (s) => Math.round(s.result.accuracy * 100),
		fmtParams: (s) => `n=${s.params.n} · ${s.params.trials} 刺激`,
		fmtResult: (s) =>
			`准确率 ${Math.round(s.result.accuracy * 100)}% · 命${s.result.hits} 漏${s.result.misses} 误${s.result.falseAlarms}`,
	},
	{
		id: 'schulte',
		name: '舒尔特方格',
		nav: '舒尔特',
		href: '/schulte/',
		ability: '注意广度',
		hueVar: '--m-schulte',
		softVar: '--m-schulte-soft',
		desc: '按顺序点完乱序数字，越快越好。',
		metricLabel: '完成用时',
		unit: '秒',
		better: 'low',
		metric: (s) => s.result.timeSec,
		fmtParams: (s) => `${s.params.size}×${s.params.size} 格`,
		fmtResult: (s) => `${s.result.timeSec} 秒 · 错 ${s.result.errors} 次`,
	},
	{
		id: 'stroop',
		name: '斯特鲁普',
		nav: '色词',
		href: '/stroop/',
		ability: '抗干扰',
		hueVar: '--m-stroop',
		softVar: '--m-stroop-soft',
		desc: '选字的墨色，忍住别读字义。',
		metricLabel: '准确率',
		unit: '%',
		better: 'high',
		metric: (s) => s.result.rate,
		fmtParams: (s) => `${s.params.colors} 色 · ${s.params.trials} 题`,
		fmtResult: (s) => `${s.result.rate}% · 干扰 ${s.result.interferenceMs}ms`,
	},
	{
		id: 'span',
		name: '序列记忆',
		nav: '序列',
		href: '/span/',
		ability: '记忆广度',
		hueVar: '--m-span',
		softVar: '--m-span-soft',
		desc: '复现闪光顺序，一轮比一轮长。',
		metricLabel: '记忆广度',
		unit: '格',
		better: 'high',
		metric: (s) => s.result.maxSpan,
		fmtParams: (s) => `起始 ${s.params.startLen} 格`,
		fmtResult: (s) => `广度 ${s.result.maxSpan} 格 · 过 ${s.result.rounds} 轮`,
	},
	{
		id: 'meditation',
		name: '冥想',
		nav: '冥想',
		href: '/meditation/',
		ability: '平静专注',
		hueVar: '--m-meditation',
		softVar: '--m-meditation-soft',
		desc: '静坐计时，跟着圆球呼吸。',
		metricLabel: '实际时长',
		unit: '分',
		better: 'high',
		metric: (s) => Math.round((s.result.actualSec / 60) * 10) / 10,
		fmtParams: (s) => `${s.params.plannedMin} 分钟 · 引导${s.params.breathing ? '开' : '关'}`,
		fmtResult: (s) =>
			`${s.result.completed ? '完成 ✓' : '未完成'} · ${Math.round((s.result.actualSec / 60) * 10) / 10} 分钟`,
	},
];

export const MODULE_BY_ID = Object.fromEntries(MODULES.map((m) => [m.id, m]));

// 明细/卡片给未知模块兜底（旧日志或未来模块不至于渲染成空白）
export function moduleOf(id) {
	return (
		MODULE_BY_ID[id] || {
			id,
			name: id,
			hueVar: '--accent',
			softVar: '--accent-soft',
			fmtParams: () => '—',
			fmtResult: () => '—',
		}
	);
}