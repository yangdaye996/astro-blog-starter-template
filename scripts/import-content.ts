// 一次性内容导入脚本（ADR-0009）：把 src/content/{blog,notes} 的 Markdown 迁入 D1。
//
// 关键点：
//   - 日期读文件系统时间戳（birthtime，不支持时退 mtime）——ADR-0008 以来未写日期的
//     条目全靠它，git clone 会丢时间戳，必须在原仓库目录执行本脚本。
//   - 渲染复用 src/lib/render-markdown.ts（与编辑器保存管线同一份实现），
//     Mermaid 用 mermaid-isomorphic（无头 Chromium）在本地完成，与旧构建结果一致。
//   - 写入走 wrangler 的 getPlatformProxy：拿到与本地开发同一个 D1 绑定，
//     复用 src/lib/db.ts 的 createPost / createNote（参数化绑定）。
//     不用 `wrangler d1 execute --file`——单条 INSERT 里几百 KB 的成品 HTML
//     会撞上 D1 的 100KB 单语句上限（实测 SQLITE_TOOBIG）。
//   - 默认写本地（.wrangler/state，与 npm run dev 同一份）；--replace 先清空再导入。
//
// 用法：npm run import [-- --replace]

import { readdir, readFile, stat } from "node:fs/promises";
import { basename, extname, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createMermaidRenderer } from "mermaid-isomorphic";
import { renderMarkdown, MERMAID_CONFIG } from "../src/lib/render-markdown.ts";
import { countWords, readingMinutes, excerpt } from "../src/lib/text.ts";
import { createPost, createNote } from "../src/lib/db.ts";
import type { PostInput, NoteInput } from "../src/lib/db.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const replace = process.argv.slice(2).includes("--replace");

// ═══ 工具 ═══

/** 朴素 frontmatter 解析：支持标量与两级字符串数组，覆盖本项目 schema 的全部字段。 */
function parseFrontmatter(source: string): { data: Record<string, string | string[]>; body: string } {
	const fm = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
	if (!fm) return { data: {}, body: source };
	const data: Record<string, string | string[]> = {};
	let currentKey: string | null = null;
	for (const line of fm[1].split(/\r?\n/)) {
		const listMatch = line.match(/^\s+-\s+(.+)$/);
		if (currentKey && listMatch) {
			(data[currentKey] as string[]).push(listMatch[1].trim().replace(/^["']|["']$/g, ""));
			continue;
		}
		const kv = line.match(/^([\w][\w-]*):\s*(.*)$/);
		if (kv) {
			currentKey = kv[1];
			const value = kv[2].trim();
			data[currentKey] = value ? value.replace(/^["']|["']$/g, "") : [];
		} else {
			currentKey = null;
		}
	}
	return { data, body: source.slice(fm[0].length) };
}

/** 文件创建时间（birthtime，个别文件系统返回 epoch 时退 mtime）——与旧推导层一致。 */
async function fileDate(path: string): Promise<Date> {
	const info = await stat(path);
	return info.birthtime.getTime() > 0 ? info.birthtime : info.mtime;
}

// ═══ Mermaid（Node 侧，无头浏览器） ═══

const renderMermaidBatch = createMermaidRenderer();

async function nodeMermaid(code: string): Promise<string | null> {
	const [result] = await renderMermaidBatch([code], { mermaidConfig: { ...MERMAID_CONFIG } });
	if (result.status === "fulfilled") return result.value.svg;
	console.error(`[mermaid] 渲染失败，该图退化为代码块：\n${result.reason}`);
	return null;
}

// ═══ 导入 ═══

async function* walk(dir: string, exts: string[]): AsyncGenerator<string> {
	let entries;
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch {
		return; // 目录不存在（如 notes 还没有任何内容）
	}
	for (const entry of entries) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) yield* walk(full, exts);
		else if (exts.some((ext) => entry.name.endsWith(ext)) && entry.name !== ".gitkeep") yield full;
	}
}

async function collectPosts(): Promise<PostInput[]> {
	const inputs: PostInput[] = [];
	for await (const file of walk(join(ROOT, "src", "content", "blog"), [".md", ".mdx"])) {
		const { data, body } = parseFrontmatter(await readFile(file, "utf8"));
		const slug = basename(file, extname(file));
		const pubDate =
			typeof data.pubDate === "string" ? new Date(data.pubDate) : await fileDate(file);
		const updatedDate =
			typeof data.updatedDate === "string" ? new Date(data.updatedDate) : null;

		const { html, headings } = await renderMarkdown(body, nodeMermaid);
		const { total } = countWords(body);

		inputs.push({
			slug,
			title: typeof data.title === "string" ? data.title : slug,
			description: typeof data.description === "string" ? data.description : excerpt(body),
			markdown: body,
			html,
			headings,
			heroImage: typeof data.heroImage === "string" ? data.heroImage : null,
			category: typeof data.category === "string" ? data.category : null,
			tags: Array.isArray(data.tags) ? data.tags : [],
			wordCount: total,
			readingMinutes: readingMinutes(body),
			status: "published",
			pubDate: pubDate.toISOString(),
			updatedDate: updatedDate ? updatedDate.toISOString() : null,
		});
	}
	return inputs;
}

async function collectNotes(): Promise<NoteInput[]> {
	const inputs: NoteInput[] = [];
	for await (const file of walk(join(ROOT, "src", "content", "notes"), [".md", ".mdx"])) {
		const { data, body } = parseFrontmatter(await readFile(file, "utf8"));
		const date = typeof data.date === "string" ? new Date(data.date) : await fileDate(file);

		const { html } = await renderMarkdown(body, nodeMermaid);
		inputs.push({
			markdown: body,
			html,
			tags: Array.isArray(data.tags) ? data.tags : [],
			status: "published",
			date: date.toISOString(),
		});
	}
	return inputs;
}

async function main(): Promise<void> {
	// 先渲染收集，再动数据库——防止「源文件缺失 + --replace」把库清空却什么都没写进去
	const { getPlatformProxy } = await import("wrangler");
	const proxy = await getPlatformProxy({ configPath: join(ROOT, "wrangler.json") });
	const db = proxy.env.DB as unknown as D1Database;

	const postRows = await collectPosts();
	const noteRows = await collectNotes();
	if (replace && postRows.length + noteRows.length === 0) {
		await proxy.dispose();
		throw new Error("src/content 下没有任何源文件——拒绝执行 --replace（否则会清空库里现有内容）。");
	}

	console.log(`[import] 开始导入（本地 D1）${replace ? "，先清空现有内容" : ""}…`);
	if (replace) {
		await db.prepare("DELETE FROM notes").run();
		await db.prepare("DELETE FROM posts").run();
	}

	for (const input of postRows) {
		await createPost(db, input);
		console.log(`  已导入 ${input.slug}（${input.headings.length} 个标题，${input.wordCount} 字）`);
	}
	for (const input of noteRows) {
		await createNote(db, input);
	}
	await proxy.dispose();
	console.log(`[import] 完成：${postRows.length} 篇文章、${noteRows.length} 条随想已写入本地 D1。`);
}

main().catch((err) => {
	console.error(`[import] 失败：${err instanceof Error ? err.stack ?? err.message : String(err)}`);
	process.exit(1);
});
