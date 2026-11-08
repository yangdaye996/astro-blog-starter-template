// 保存时渲染管线（ADR-0009）：Markdown → 成品 HTML + 目录数据。
// 编辑器（浏览器）与导入脚本（Node）共用同一份实现——渲染结果与旧构建期管线
// （Astro markdown + remark-mermaid + Shiki + KaTeX）保持一致。
//
// 与旧管线的对应关系（ADR-0004）：
//   旧 remark 阶段的 Mermaid 替换 → 这里在 toHast 之前对 mdast 做同样替换；
//   旧 Shiki（跑在用户 rehype 插件之前）→ 这里在 rehypeKatex 之前处理代码块。
// Mermaid 渲染器由调用方注入：浏览器用 mermaid 包，Node 用 mermaid-isomorphic
// （无头浏览器），两者输出同为 <figure class="mermaid-diagram"> 包裹的内联 SVG。

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeSlug from "rehype-slug";
import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";
import { codeToHtml } from "shiki";

export interface Heading {
	depth: 2 | 3;
	slug: string;
	text: string;
}

export interface RenderResult {
	html: string;
	headings: Heading[];
	/** 渲染失败、退化为代码块的 Mermaid 图数量 */
	mermaidFailed: number;
	/** 语法未知而未高亮的代码块数量 */
	shikiFailed: number;
}

/** Mermaid 渲染器：输入图表源码，输出 SVG 字符串；失败返回 null（退化为代码块）。 */
export type MermaidRenderer = (code: string) => Promise<string | null>;

// 内联 SVG 里的文字最终由读者的浏览器渲染，所以字体栈用站点的中文字体栈，
// 而不是 mermaid 默认的 arial,sans-serif，否则图表里的中文会掉到难看的回退字形。
// 与 remark-mermaid.mjs（旧构建管线）保持一致。
export const MERMAID_FONT_FAMILY =
	'-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Source Han Sans SC", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif';

// strict 会对节点标签做转义，防止图表源码里的 HTML 注入到页面。
export const MERMAID_CONFIG = {
	fontFamily: MERMAID_FONT_FAMILY,
	theme: "neutral",
	securityLevel: "strict",
} as const;

// mdast/hast 节点的最小结构声明。手写遍历而不引入 unist-util-visit：
// 避免为 20 行遍历新增依赖（与 remark-mermaid.mjs 的做法一致）。
interface MdNode {
	type: string;
	tagName?: string;
	value?: string;
	lang?: string | null;
	meta?: string | null;
	children?: MdNode[];
	properties?: Record<string, unknown>;
	className?: string[];
}

/** 手写遍历所有子孙节点（含根）。 */
function walk(node: MdNode, fn: (n: MdNode) => void | "stop"): void {
	if (fn(node) === "stop") return;
	for (const child of node.children ?? []) walk(child, fn);
}

/** 递归取纯文本（hast 标题文本收集用）。 */
function textOf(node: MdNode): string {
	let out = node.value ?? "";
	for (const child of node.children ?? []) out += textOf(child);
	return out;
}

/** 取 hast 元素的 class 列表（hast 把 class 放在 properties.className）。 */
function classesOf(node: MdNode): string[] {
	const raw = node.properties?.className;
	return Array.isArray(raw) ? raw.map(String) : [];
}

/** 判断 hast 的 code 元素是否为数学块（remark-math 产物，交给 rehype-katex 处理）。 */
function isMathCode(node: MdNode): boolean {
	return classesOf(node).some((c) => c.startsWith("language-math") || c === "math-inline" || c === "math-display");
}

export async function renderMarkdown(
	markdown: string,
	renderMermaid: MermaidRenderer,
): Promise<RenderResult> {
	let mermaidFailed = 0;
	let shikiFailed = 0;
	const headings: Heading[] = [];

	const file = await unified()
		.use(remarkParse)
		.use(remarkGfm)
		.use(remarkMath)
		.use(function mermaidReplace() {
			// 等价于旧构建 remark-mermaid 的阶段动作：先替换，再进 rehype，
			// 这样 Shiki 不会把 mermaid 源码当代码块高亮（ADR-0004 的顺序教训）。
			return async (tree: MdNode) => {
				const targets: MdNode[] = [];
				walk(tree, (n) => {
					if (n.type === "code" && n.lang === "mermaid") targets.push(n);
				});
				for (const node of targets) {
					const svg = await renderMermaid(node.value ?? "");
					if (svg === null) {
						mermaidFailed++;
						continue; // 退化为普通代码块，作者在预览里直接看到源码
					}
					node.type = "html";
					node.value = `<figure class="mermaid-diagram">${svg}</figure>`;
					delete node.lang;
					delete node.meta;
				}
			};
		})
		.use(remarkRehype, { allowDangerousHtml: true })
		.use(rehypeSlug)
		.use(function shikiReplace() {
			return async (tree: MdNode) => {
				// 先收集、后异步高亮：shiki v4 的 codeToHtml 返回 Promise
				const targets: MdNode[] = [];
				walk(tree, (n) => {
					if (n.tagName !== "pre") return;
					const code = (n.children ?? []).find((c) => c.tagName === "code");
					if (!code) return;
					const langClass = classesOf(code).find((c) => c.startsWith("language-"));
					// 数学块（remark-math 产物）交给 rehype-katex，不做代码高亮
					if (!langClass || isMathCode(code)) return;
					targets.push(n);
				});
				for (const pre of targets) {
					const code = pre.children!.find((c) => c.tagName === "code")!;
					const langClass = classesOf(code).find((c) => c.startsWith("language-"))!;
					try {
						pre.type = "raw";
						pre.value = await codeToHtml(textOf(code), {
							lang: langClass.slice("language-".length),
							themes: { light: "github-light" },
						});
						pre.children = undefined;
					} catch {
						shikiFailed++; // 未知语言：保留原样，不高亮
					}
				}
			};
		})
		.use(rehypeKatex)
		.use(function collectHeadings() {
			return (tree: MdNode) => {
				walk(tree, (n) => {
					if (n.tagName !== "h2" && n.tagName !== "h3") return;
					const slug = n.properties?.id;
					if (typeof slug !== "string") return;
					headings.push({
						depth: n.tagName === "h2" ? 2 : 3,
						slug,
						text: textOf(n).trim(),
					});
				});
			};
		})
		.use(rehypeStringify, { allowDangerousHtml: true })
		.process(markdown);

	return { html: String(file), headings, mermaidFailed, shikiFailed };
}
