// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";

import { SITE } from "./src/consts";

// 运行时渲染（ADR-0009）：output 翻转为 server，全部页面按请求从 D1 取数拼装。
// 重计算（Mermaid/KaTeX/Shiki/字数/摘要）已在编辑器保存时完成并存进 D1（保存时处理），
// Worker 请求路径只剩取数 + 拼 HTML，读者端零 JS 的原则保留。
// https://astro.build/config
export default defineConfig({
	site: SITE.url,
	output: "server",
	adapter: cloudflare({
		platformProxy: {
			enabled: true,
		},
	}),
});
