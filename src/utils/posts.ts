// 构建期工具：字数统计、阅读时长、数学内容探测、上一篇/下一篇。
// 全部在构建时算完并写进 HTML，读者端零 JS（ADR-0001）。
import { READING_SPEED } from "../consts";

const CJK_RANGE = /[\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g;
const CODE_FENCE = /```[\s\S]*?```|~~~[\s\S]*?~~~/g;

/**
 * 统计正文字数：中日韩字符逐字计，拉丁文按空白分词计。
 * 先剥离围栏代码块，避免把依赖与生成物算进阅读时长。
 */
export function countWords(body: string): { cjk: number; latin: number; total: number } {
	const prose = body.replace(CODE_FENCE, " ");
	const cjk = (prose.match(CJK_RANGE) ?? []).length;
	const latin = prose
		.replace(CJK_RANGE, " ")
		.split(/\s+/)
		.filter((w) => /[a-zA-Z0-9]/.test(w)).length;
	return { cjk, latin, total: cjk + latin };
}

/** 估算阅读分钟数，向上取整，最低 1 分钟。 */
export function readingMinutes(body: string): number {
	const { cjk, latin } = countWords(body);
	const minutes =
		cjk / READING_SPEED.cjkCharsPerMinute + latin / READING_SPEED.latinWordsPerMinute;
	return Math.max(1, Math.ceil(minutes));
}

/**
 * 探测正文是否含数学内容，用于按需加载 KaTeX 样式。
 * 剥离围栏代码块后查找 $ 分隔符。
 * 偏向误报（多加载一次 CSS）而非漏报（公式渲染成裸文本）。
 */
export function hasMath(body: string): boolean {
	return body.replace(CODE_FENCE, " ").includes("$");
}

/** 按日期倒序排列。日期字段由调用方给出——文章用 pubDate，随想用 date。 */
export function sortDescBy<T>(entries: T[], getDate: (entry: T) => Date): T[] {
	return [...entries].sort((a, b) => getDate(b).valueOf() - getDate(a).valueOf());
}

/**
 * 在倒序列表中取当前文章的上一篇（更新）与下一篇（更早）。
 * 按 id 匹配而非对象引用——同一批条目在不同页面里可能来自不同的
 * getCollection 调用，引用相等并不可靠。
 */
export function neighbours<T extends { id: string }>(
	sortedDesc: T[],
	id: string,
): { prev: T | null; next: T | null } {
	const i = sortedDesc.findIndex((entry) => entry.id === id);
	return {
		prev: i > 0 ? sortedDesc[i - 1] : null,
		next: i >= 0 && i < sortedDesc.length - 1 ? sortedDesc[i + 1] : null,
	};
}

/**
 * 按年份分组，供归档页与随想页的时间轴使用。
 * 要求入参已按日期倒序排列（先调用 sortDescBy）：分组是按「连续同年份」切的，
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
