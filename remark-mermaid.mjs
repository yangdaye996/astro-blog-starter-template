// remark 阶段把 ```mermaid 代码块渲染成内联 SVG。
//
// 为什么放在 remark 而不是 rehype（实测结论，见 ADR-0004）：
// Astro 的 Shiki 高亮跑在用户 rehypePlugins **之前**。到达 rehype 阶段时，代码块已被改写成
// <pre class="astro-code" data-language="mermaid">，内层 <code> 不带任何 className，
// 因此 rehype-mermaid 依赖的 code.language-mermaid 选择器永远匹配不到，图表会被静默跳过。
// remark 阶段节点仍是 mdast 的 { type: "code", lang: "mermaid" }，可以稳定命中。

import { createMermaidRenderer } from "mermaid-isomorphic";

// 模块级单例：mermaid-isomorphic 自行管理浏览器实例——多图并发时复用，
// 空闲后自动关闭，因此整个构建过程只会启动一次 Chromium。
const renderMermaid = createMermaidRenderer();

// 内联 SVG 里的文字最终由读者的浏览器渲染，所以字体栈要用站点的中文字体栈，
// 而不是 mermaid 默认的 arial,sans-serif，否则图表里的中文会掉到难看的回退字形。
const FONT_FAMILY =
	'-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Source Han Sans SC", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif';

// 手写遍历而不是引入 unist-util-visit：后者在本项目里只是间接依赖，
// 依赖间接包会在上游调整依赖树时无声断裂。
function collectMermaidNodes(tree) {
	const found = [];
	const walk = (node) => {
		if (node.type === "code" && node.lang === "mermaid") found.push(node);
		if (Array.isArray(node.children)) {
			for (const child of node.children) walk(child);
		}
	};
	walk(tree);
	return found;
}

export default function remarkMermaid() {
	return async (tree, file) => {
		const nodes = collectMermaidNodes(tree);
		if (nodes.length === 0) return;

		const results = await renderMermaid(
			nodes.map((node) => node.value),
			{
				mermaidConfig: {
					fontFamily: FONT_FAMILY,
					theme: "neutral",
					// strict 会对节点标签做转义，防止图表源码里的 HTML 注入到页面
					securityLevel: "strict",
				},
			},
		);

		results.forEach((result, i) => {
			const node = nodes[i];
			if (result.status === "fulfilled") {
				node.type = "html";
				node.value = `<figure class="mermaid-diagram">${result.value.svg}</figure>`;
				delete node.lang;
				delete node.meta;
				return;
			}
			// 语法错误不中断构建：图表保留为普通代码块，作者在页面上直接看到源码，
			// 同时构建日志打出可定位的错误。宁可显眼地退化，也不要静默丢图。
			const source = file?.history?.[0] ?? "未知文件";
			console.error(
				`\n[mermaid] ${source} 的第 ${i + 1} 个图表渲染失败，已退化为代码块：\n${result.reason}\n`,
			);
		});
	};
}
