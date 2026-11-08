-- 内容库初始 schema（ADR-0009）。
-- posts / notes 存保存时处理过的成品 HTML + 元数据，markdown 保留原文便于再编辑与导出。
-- settings 为键值表，存站点身份信息与关于页内容。
-- 日期一律存 ISO 8601 文本（toISOString），读出后由 db 层转 Date。

CREATE TABLE posts (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	slug TEXT NOT NULL UNIQUE,
	title TEXT NOT NULL DEFAULT '',
	description TEXT NOT NULL DEFAULT '',
	html TEXT NOT NULL,
	headings TEXT NOT NULL DEFAULT '[]',
	markdown TEXT NOT NULL,
	hero_image TEXT,
	category TEXT,
	tags TEXT NOT NULL DEFAULT '[]',
	word_count INTEGER NOT NULL DEFAULT 0,
	reading_minutes INTEGER NOT NULL DEFAULT 1,
	status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
	pub_date TEXT NOT NULL,
	updated_date TEXT,
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_posts_status_pub ON posts (status, pub_date DESC);

CREATE TABLE notes (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	html TEXT NOT NULL,
	markdown TEXT NOT NULL,
	tags TEXT NOT NULL DEFAULT '[]',
	status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
	date TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_notes_status_date ON notes (status, date DESC);

CREATE TABLE settings (
	key TEXT PRIMARY KEY,
	value TEXT NOT NULL
);
