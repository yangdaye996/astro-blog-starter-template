import { glob } from "astro/loaders";
import { defineCollection } from "astro:content";
import { z } from "astro/zod";

// 技术长文：有独立详情页路由 /blog/<id>。
// frontmatter 全可选，缺省项由 utils/posts.ts 的 resolvePost 推导（ADR-0008）。
const blog = defineCollection({
	loader: glob({ base: "./src/content/blog", pattern: "**/*.{md,mdx}" }),
	schema: z.object({
		title: z.string().optional(),
		description: z.string().optional(),
		pubDate: z.coerce.date().optional(),
		updatedDate: z.coerce.date().optional(),
		heroImage: z.string().optional(),
		// tags 与 category 只被列表页前端筛选消费，不生成聚合路由（ADR-0006）
		tags: z.array(z.string()).default([]),
		category: z.string().optional(),
	}),
});

// 随想：无标题时间轴条目，不生成独立详情页（ADR-0002）
const notes = defineCollection({
	loader: glob({ base: "./src/content/notes", pattern: "**/*.{md,mdx}" }),
	schema: z.object({
		date: z.coerce.date().optional(),
		tags: z.array(z.string()).default([]),
	}),
});

export const collections = { blog, notes };
