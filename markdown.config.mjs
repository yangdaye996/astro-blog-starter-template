// Markdown / MDX 管线共用的插件与高亮配置。
// 单独成模块是为了让 .md 与 .mdx 两条路径共用同一份配置，
// 否则二者会随时间漂移，出现「md 里公式正常、mdx 里失效」这类难查的问题（ADR-0004）。
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkMermaid from "./remark-mermaid.mjs";

// remark 阶段（早于 Astro 的 Shiki 高亮，原因见 remark-mermaid.mjs 顶部说明）：
// 1. remarkMath    解析 $...$ 与 $$...$$，产出 language-math 节点交给 rehypeKatex
// 2. remarkMermaid 把 ```mermaid 代码块渲染成内联 SVG（需 Playwright + Chromium）
//    这条依赖链只存在于 devDependencies，不进入 dist，不消耗 Worker 配额（ADR-0001 / ADR-0004）。
export const remarkPlugins = [remarkMath, remarkMermaid];

// rehype 阶段：把 language-math 节点渲染成 KaTeX 的 HTML + MathML，构建期完成，读者端零 JS。
export const rehypePlugins = [rehypeKatex];

// Shiki 配置：浅色主题，与 ADR-0005 的浅色基调一致。
// 中英混排的代码注释在 github-light 下标点与字形回退表现稳定。
// JSDoc 类型标注是必需的：没有它，themes.light 会被推宽成 string，
// 赋给 astro.config.mjs 时无法匹配 ShikiConfig 要求的 ThemePresets 字面量联合。
/** @type {import('astro').ShikiConfig} */
export const shikiConfig = {
	themes: { light: "github-light" },
	wrap: true,
};
