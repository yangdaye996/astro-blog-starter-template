// 纯文本计算：字数、阅读时长、摘要推导、数学内容探测。
// 原构建期逻辑（ADR-0008 时代位于 src/utils/posts.ts）的移植，规则一字不改——
// 保证迁移前后的文章字数/摘要完全一致（ADR-0009）。
// 无任何 Node / DOM 依赖，浏览器（编辑器保存时）与 Node（导入脚本）共用。

import { READING_SPEED } from "../consts.ts";

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

const EXCERPT_LENGTH = 120;

/** 取正文第一个非空段落做摘要：剥离代码、公式、图片、标题行与标记符号。 */
export function excerpt(body: string): string {
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
