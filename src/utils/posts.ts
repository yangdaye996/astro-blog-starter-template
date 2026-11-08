// 构建期工具：字数统计、阅读时长、数学内容探测、上一篇/下一篇、元信息推导。
// 全部在构建时算完并写进 HTML，读者端零 JS（ADR-0001）。
import { statSync } from "node:fs";
import { basename, extname } from "node:path";
import type { CollectionEntry } from "astro:content";
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

// ═══ 元信息推导（ADR-0008）═══
// frontmatter 全可选；缺省时标题取文件名、日期取文件创建时间、摘要取正文首段。
// schema 层字段虽可选，消费方一律使用下面两个 Resolved 类型，必填约束由推导层保证。

export type ResolvedPost = CollectionEntry<"blog"> & {
	data: { title: string; description: string; pubDate: Date };
};
export type ResolvedNote = CollectionEntry<"notes"> & {
	data: { date: Date };
};

// glob loader 保证 filePath 存在（相对项目根目录）
function fileTitle(entry: CollectionEntry<"blog">): string {
	const file = entry.filePath!;
	return basename(file, extname(file));
}

function fileDate(entry: CollectionEntry<"blog"> | CollectionEntry<"notes">): Date {
	const stat = statSync(entry.filePath!);
	// 个别文件系统不支持 birthtime（返回 epoch），退回 mtime
	return stat.birthtime.getTime() > 0 ? stat.birthtime : stat.mtime;
}

const EXCERPT_LENGTH = 120;

/** 取正文第一个非空段落做摘要：剥离代码、公式、图片、标题行与标记符号。 */
function excerpt(body: string): string {
	const text = body
		.replace(CODE_FENCE, " ")
		.replace(/\$\$[\s\S]*?\$\$/g, " ")
		.replace(/\$[^$\n]*\$/g, " ")
		.replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
		.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
		.replace(/<[^>]*>/g, " ")
		.replace(/^#{1,6}\s+.*$/gm, "")
		.replace(/^\s*[-+*]\s+/gm, "")
		.replace(/[*_`~>|]/g, "");
	const para =
		text
			.split(/\n\s*\n/)
			.map((p) => p.replace(/\s+/g, " ").trim())
			.find((p) => p.length > 0) ?? "";
	return para.length > EXCERPT_LENGTH ? `${para.slice(0, EXCERPT_LENGTH)}…` : para;
}

/** 补齐文章缺省的元信息；frontmatter 写了的字段永远优先。 */
export function resolvePost(post: CollectionEntry<"blog">): ResolvedPost {
	return {
		...post,
		data: {
			...post.data,
			title: post.data.title ?? fileTitle(post),
			pubDate: post.data.pubDate ?? fileDate(post),
			description: post.data.description ?? excerpt(post.body ?? ""),
		},
	};
}

/** 补齐随想缺省的日期；frontmatter 的 date 优先。 */
export function resolveNote(note: CollectionEntry<"notes">): ResolvedNote {
	return {
		...note,
		data: { ...note.data, date: note.data.date ?? fileDate(note) },
	};
}
