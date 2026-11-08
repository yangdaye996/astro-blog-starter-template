// 时间轴工具：倒序排列与按年分组。
// 自 src/utils/posts.ts 移植的纯函数（ADR-0009）：去掉了 astro:content 与
// 文件系统依赖，入参改为任意带日期的对象，页面与脚本共用。

/** 按日期倒序排列。日期字段由调用方给出——文章用 pubDate，随想用 date。 */
export function sortDescBy<T>(entries: T[], getDate: (entry: T) => Date): T[] {
	return [...entries].sort((a, b) => getDate(b).valueOf() - getDate(a).valueOf());
}

/**
 * 按年份分组，供归档页与随想页的时间轴使用。
 * 要求入参已按日期倒序排列（db 层的 SQL 已保证）：分组是按「连续同年份」切的，
 * 未排序的输入会让同一年份出现多次。
 */
export function groupByYear<T>(
	sortedDesc: T[],
	getDate: (entry: T) => Date,
): { year: number; entries: T[] }[] {
	const groups: { year: number; entries: T[] }[] = [];
	for (const entry of sortedDesc) {
		const year = getDate(entry).getFullYear();
		const last = groups[groups.length - 1];
		if (last && last.year === year) last.entries.push(entry);
		else groups.push({ year, entries: [entry] });
	}
	return groups;
}
