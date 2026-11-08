// 内容导出脚本（ADR-0009 的逃生舱）：把 D1 里的全部内容倒回 Markdown 文件。
// 产物结构：
//   content-export/posts/<yyyy-mm-dd>-<slug>.md   frontmatter + 原始 Markdown
//   content-export/notes/<yyyy-mm-dd>-<id>.md     frontmatter(date/tags) + 原文
// 导出的文件可直接放进任何 Markdown 工作流（含 Obsidian）作归档。
//
// 用法：npm run export [-- --replace]
//   --replace  清空 content-export/ 再导出（默认在原目录追加，重名文件覆盖）

import { mkdir, writeFile, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getPlatformProxy } from "wrangler";
import type { Post, Note } from "../src/lib/db.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const replace = process.argv.slice(2).includes("--replace");
const OUT = join(ROOT, "content-export");

function frontmatter(fields: [string, string | number | string[] | null][]): string {
	const lines = ["---"];
	for (const [key, value] of fields) {
		if (value === null || value === "" ) continue;
		if (Array.isArray(value)) {
			if (value.length === 0) continue;
			lines.push(`${key}:`);
			for (const item of value) lines.push(`  - ${item}`);
		} else {
			lines.push(`${key}: ${value}`);
		}
	}
	lines.push("---", "");
	return lines.join("\n");
}

function slugDate(iso: string): string {
	return iso.slice(0, 10);
}

async function exportPosts(db: D1Database): Promise<number> {
	const { results } = await db
		.prepare("SELECT * FROM posts ORDER BY pub_date ASC")
		.all<Record<string, string>>();
	const dir = join(OUT, "posts");
	await mkdir(dir, { recursive: true });

	for (const row of results ?? []) {
		const post = row as unknown as Post;
		const md =
			frontmatter([
				["title", post.title],
				["description", post.description],
				["pubDate", post.pubDate?.toISOString?.() ?? row.pub_date],
				["updatedDate", row.updated_date],
				["category", row.category],
				["heroImage", row.hero_image],
				["tags", (() => { try { return JSON.parse(row.tags) as string[]; } catch { return []; } })()],
				["status", row.status],
			]) + row.markdown;
		const name = `${slugDate(row.pub_date)}-${row.slug}.md`;
		await writeFile(join(dir, name), md, "utf8");
		console.log(`  posts/${name}`);
	}
	return results?.length ?? 0;
}

async function exportNotes(db: D1Database): Promise<number> {
	const { results } = await db
		.prepare("SELECT * FROM notes ORDER BY date ASC")
		.all<Record<string, string>>();
	const dir = join(OUT, "notes");
	await mkdir(dir, { recursive: true });

	for (const row of results ?? []) {
		const md =
			frontmatter([
				["date", row.date],
				["tags", (() => { try { return JSON.parse(row.tags) as string[]; } catch { return []; } })()],
				["status", row.status],
			]) + row.markdown;
		const name = `${slugDate(row.date)}-note-${row.id}.md`;
		await writeFile(join(dir, name), md, "utf8");
		console.log(`  notes/${name}`);
	}
	return results?.length ?? 0;
}

async function main(): Promise<void> {
	if (replace) await rm(OUT, { recursive: true, force: true });
	console.log("[export] 读取本地 D1…");

	const { getPlatformProxy } = await import("wrangler");
	const proxy = await getPlatformProxy({ configPath: join(ROOT, "wrangler.json") });
	const db = proxy.env.DB as unknown as D1Database;

	const posts = await exportPosts(db);
	const notes = await exportNotes(db);
	await proxy.dispose();

	console.log(`[export] 完成：${posts} 篇文章、${notes} 条随想 → ${OUT}`);
	console.log("[export] 注意：远端 D1 请在部署后用 --remote 环境下执行（见 README「备份与逃生舱」）。");
}

main().catch((err) => {
	console.error(`[export] 失败：${err instanceof Error ? err.message : String(err)}`);
	process.exit(1);
});
