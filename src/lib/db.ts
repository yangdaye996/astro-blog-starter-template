// D1 数据层（ADR-0009）：页面与 API 的唯一取数入口。
// 行 → 领域对象的映射（tags/headings JSON 解析、日期字符串转 Date）只在这里发生，
// 消费方拿到的一律是解析完毕的对象，不直接触 SQL。

export interface Heading {
	depth: 2 | 3;
	slug: string;
	text: string;
}

export type ContentStatus = "draft" | "published";

export interface Post {
	id: number;
	slug: string;
	title: string;
	description: string;
	html: string;
	headings: Heading[];
	markdown: string;
	heroImage: string | null;
	category: string | null;
	tags: string[];
	wordCount: number;
	readingMinutes: number;
	status: ContentStatus;
	pubDate: Date;
	updatedDate: Date | null;
}

export interface Note {
	id: number;
	html: string;
	markdown: string;
	tags: string[];
	status: ContentStatus;
	date: Date;
}

/** 编辑器/导入脚本提交的文章写入载荷（html/headings/统计已是保存时算好的成品）。 */
export interface PostInput {
	slug: string;
	title: string;
	description: string;
	markdown: string;
	html: string;
	headings: Heading[];
	heroImage: string | null;
	category: string | null;
	tags: string[];
	wordCount: number;
	readingMinutes: number;
	status: ContentStatus;
	pubDate: string;
	updatedDate: string | null;
}

export interface NoteInput {
	markdown: string;
	html: string;
	tags: string[];
	status: ContentStatus;
	date: string;
}

export class SlugConflictError extends Error {
	constructor(slug: string) {
		super(`slug 已被占用：${slug}`);
		this.name = "SlugConflictError";
	}
}

type PostRow = {
	id: number;
	slug: string;
	title: string;
	description: string;
	html: string;
	headings: string;
	markdown: string;
	hero_image: string | null;
	category: string | null;
	tags: string;
	word_count: number;
	reading_minutes: number;
	status: string;
	pub_date: string;
	updated_date: string | null;
};

type NoteRow = {
	id: number;
	html: string;
	markdown: string;
	tags: string;
	status: string;
	date: string;
};

function parseTags(raw: string): string[] {
	try {
		const arr = JSON.parse(raw);
		return Array.isArray(arr) ? arr.map(String) : [];
	} catch {
		return [];
	}
}

function parseHeadings(raw: string): Heading[] {
	try {
		const arr = JSON.parse(raw);
		return Array.isArray(arr) ? arr : [];
	} catch {
		return [];
	}
}

function mapPost(row: PostRow): Post {
	return {
		id: row.id,
		slug: row.slug,
		title: row.title,
		description: row.description,
		html: row.html,
		headings: parseHeadings(row.headings),
		markdown: row.markdown,
		heroImage: row.hero_image,
		category: row.category,
		tags: parseTags(row.tags),
		wordCount: row.word_count,
		readingMinutes: row.reading_minutes,
		status: row.status === "published" ? "published" : "draft",
		pubDate: new Date(row.pub_date),
		updatedDate: row.updated_date ? new Date(row.updated_date) : null,
	};
}

function mapNote(row: NoteRow): Note {
	return {
		id: row.id,
		html: row.html,
		markdown: row.markdown,
		tags: parseTags(row.tags),
		status: row.status === "published" ? "published" : "draft",
		date: new Date(row.date),
	};
}

// ═══ posts ═══

export async function listPosts(db: D1Database, status?: ContentStatus): Promise<Post[]> {
	const sql = status
		? "SELECT * FROM posts WHERE status = ? ORDER BY pub_date DESC, id DESC"
		: "SELECT * FROM posts ORDER BY pub_date DESC, id DESC";
	const { results } = status
		? await db.prepare(sql).bind(status).all<PostRow>()
		: await db.prepare(sql).all<PostRow>();
	return (results ?? []).map(mapPost);
}

export async function getPostBySlug(db: D1Database, slug: string): Promise<Post | null> {
	const row = await db
		.prepare("SELECT * FROM posts WHERE slug = ?")
		.bind(slug)
		.first<PostRow>();
	return row ? mapPost(row) : null;
}

export async function getPostById(db: D1Database, id: number): Promise<Post | null> {
	const row = await db.prepare("SELECT * FROM posts WHERE id = ?").bind(id).first<PostRow>();
	return row ? mapPost(row) : null;
}

export async function createPost(db: D1Database, input: PostInput): Promise<Post> {
	const dup = await db
		.prepare("SELECT id FROM posts WHERE slug = ?")
		.bind(input.slug)
		.first<{ id: number }>();
	if (dup) throw new SlugConflictError(input.slug);

	const result = await db
		.prepare(
			`INSERT INTO posts
				(slug, title, description, html, headings, markdown, hero_image, category, tags,
				 word_count, reading_minutes, status, pub_date, updated_date)
			 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`,
		)
		.bind(
			input.slug,
			input.title,
			input.description,
			input.html,
			JSON.stringify(input.headings),
			input.markdown,
			input.heroImage,
			input.category,
			JSON.stringify(input.tags),
			input.wordCount,
			input.readingMinutes,
			input.status,
			input.pubDate,
			input.updatedDate,
		)
		.run();
	return (await getPostById(db, result.meta.last_row_id))!;
}

export async function updatePost(db: D1Database, id: number, input: PostInput): Promise<Post> {
	const dup = await db
		.prepare("SELECT id FROM posts WHERE slug = ? AND id != ?")
		.bind(input.slug, id)
		.first<{ id: number }>();
	if (dup) throw new SlugConflictError(input.slug);

	await db
		.prepare(
			`UPDATE posts SET
				slug = ?1, title = ?2, description = ?3, html = ?4, headings = ?5, markdown = ?6,
				hero_image = ?7, category = ?8, tags = ?9, word_count = ?10, reading_minutes = ?11,
				status = ?12, pub_date = ?13, updated_date = ?14, updated_at = ?15
			 WHERE id = ?16`,
		)
		.bind(
			input.slug,
			input.title,
			input.description,
			input.html,
			JSON.stringify(input.headings),
			input.markdown,
			input.heroImage,
			input.category,
			JSON.stringify(input.tags),
			input.wordCount,
			input.readingMinutes,
			input.status,
			input.pubDate,
			input.updatedDate,
			new Date().toISOString(),
			id,
		)
		.run();
	return (await getPostById(db, id))!;
}

export async function deletePost(db: D1Database, id: number): Promise<void> {
	await db.prepare("DELETE FROM posts WHERE id = ?").bind(id).run();
}

/** 已发布文章中与给定日期相邻的两篇（prev=更新的，next=更早的）。 */
export async function postNeighbours(
	db: D1Database,
	post: Post,
): Promise<{ prev: Post | null; next: Post | null }> {
	const newer = await db
		.prepare(
			"SELECT * FROM posts WHERE status = 'published' AND pub_date > ? ORDER BY pub_date ASC, id ASC LIMIT 1",
		)
		.bind(post.pubDate.toISOString())
		.first<PostRow>();
	const older = await db
		.prepare(
			"SELECT * FROM posts WHERE status = 'published' AND pub_date < ? ORDER BY pub_date DESC, id DESC LIMIT 1",
		)
		.bind(post.pubDate.toISOString())
		.first<PostRow>();
	return { prev: newer ? mapPost(newer) : null, next: older ? mapPost(older) : null };
}

// ═══ notes ═══

export async function listNotes(db: D1Database, status?: ContentStatus): Promise<Note[]> {
	const sql = status
		? "SELECT * FROM notes WHERE status = ? ORDER BY date DESC, id DESC"
		: "SELECT * FROM notes ORDER BY date DESC, id DESC";
	const { results } = status
		? await db.prepare(sql).bind(status).all<NoteRow>()
		: await db.prepare(sql).all<NoteRow>();
	return (results ?? []).map(mapNote);
}

export async function getNoteById(db: D1Database, id: number): Promise<Note | null> {
	const row = await db.prepare("SELECT * FROM notes WHERE id = ?").bind(id).first<NoteRow>();
	return row ? mapNote(row) : null;
}

export async function createNote(db: D1Database, input: NoteInput): Promise<Note> {
	const result = await db
		.prepare(
			`INSERT INTO notes (html, markdown, tags, status, date) VALUES (?1, ?2, ?3, ?4, ?5)`,
		)
		.bind(input.html, input.markdown, JSON.stringify(input.tags), input.status, input.date)
		.run();
	return (await getNoteById(db, result.meta.last_row_id))!;
}

export async function updateNote(db: D1Database, id: number, input: NoteInput): Promise<Note> {
	await db
		.prepare(
			`UPDATE notes SET html = ?1, markdown = ?2, tags = ?3, status = ?4, date = ?5, updated_at = ?6
			 WHERE id = ?7`,
		)
		.bind(input.html, input.markdown, JSON.stringify(input.tags), input.status, input.date, new Date().toISOString(), id)
		.run();
	return (await getNoteById(db, id))!;
}

export async function deleteNote(db: D1Database, id: number): Promise<void> {
	await db.prepare("DELETE FROM notes WHERE id = ?").bind(id).run();
}

// ═══ settings ═══

export async function getSettingRows(db: D1Database): Promise<Record<string, string>> {
	const { results } = await db.prepare("SELECT key, value FROM settings").all<{ key: string; value: string }>();
	return Object.fromEntries((results ?? []).map((r) => [r.key, r.value]));
}

/** 全量覆盖写入 settings；未提供的键保留原值由调用方保证（编辑器提交全量）。 */
export async function saveSettingRows(db: D1Database, rows: Record<string, string>): Promise<void> {
	const keys = Object.keys(rows);
	if (keys.length === 0) return;
	const stmt = db.prepare(
		"INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
	);
	await db.batch(keys.map((key) => stmt.bind(key, rows[key])));
}
