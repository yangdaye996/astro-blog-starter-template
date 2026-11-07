// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import cloudflare from "@astrojs/cloudflare";

import { remarkPlugins, rehypePlugins, shikiConfig } from "./markdown.config.mjs";
import { SITE } from "./src/consts";

// 纯静态预渲染：不设置 output，Astro 默认 static 模式，
// 全部页面在构建期生成 HTML，Worker 只负责伺服 dist/（ADR-0001）。
// https://astro.build/config
export default defineConfig({
	site: SITE.url,
	integrations: [
		mdx({
			// 与 .md 共用同一份插件配置，避免两条管线行为漂移（ADR-0004）
			remarkPlugins,
			rehypePlugins,
		}),
	],
	markdown: {
		remarkPlugins,
		rehypePlugins,
		shikiConfig,
	},
	adapter: cloudflare({
		platformProxy: {
			enabled: true,
		},
	}),
});
