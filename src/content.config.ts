import { glob } from "astro/loaders";
import { defineCollection } from "astro:content";
import { z } from "astro/zod";

// 技术长文：必有标题，有独立详情页路由 /blog/<id>
const blog = defineCollection({
	loader: glob({ base: "./src/content/blog", pattern: "**/*.{md,mdx}" }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		pubDate: z.coerce.date(),
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
		date: z.coerce.date(),
		tags: z.array(z.string()).default([]),
	}),
});

export const collections = { blog, notes };
