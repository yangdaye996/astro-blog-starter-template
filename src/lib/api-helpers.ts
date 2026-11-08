// /admin/api/* 共用的校验与应答工具（ADR-0009）。
// API 只接收客户端保存管线产出的成品载荷（html/headings/统计），服务端不再重算——
// 这是「保存时处理」原则的服务端一半：Worker 请求路径不做重计算。

import { SlugConflictError, type Heading, type PostInput, type NoteInput } from "./db";

export function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "content-type": "application/json; charset=utf-8" },
	});
}

export function bad(error: string, status = 400): Response {
	return json({ error }, status);
}

export function requireDb(locals: App.Locals): D1Database {
	const db = locals.runtime?.env.DB;
	if (!db) throw new Error("D1 绑定不可用（locals.runtime.env.DB 为空）");
	return db;
}

function asString(value: unknown, fallback = ""): string {
	return typeof value === "string" ? value : fallback;
}

function asTags(value: unknown): string[] {
	return Array.isArray(value) ? value.map((v) => String(v)).filter(Boolean) : [];
}

function asHeadings(value: unknown): Heading[] {
	return Array.isArray(value) ? (value as Heading[]) : [];
}

/** 日期字段：null 表示交给服务端取缺省值（新建=现在，更新=保留原值）。 */
function asIsoDate(value: unknown): string | null {
	if (typeof value !== "string" || !value) return null;
	const date = new Date(value);
	return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

export function parsePostBody(body: Record<string, unknown>): PostInput {
	const status = body.status === "published" ? "published" : "draft";
	return {
		slug: asString(body.slug).trim(),
		title: asString(body.title).trim(),
		description: asString(body.description),
		markdown: asString(body.markdown),
		html: asString(body.html),
		headings: asHeadings(body.headings),
		heroImage: asString(body.heroImage).trim() || null,
		category: asString(body.category).trim() || null,
		tags: asTags(body.tags),
		wordCount: Number(body.wordCount) || 0,
		readingMinutes: Math.max(1, Number(body.readingMinutes) || 1),
		status,
		pubDate: asIsoDate(body.pubDate) ?? "",
		updatedDate: null,
	};
}

export function parseNoteBody(body: Record<string, unknown>): NoteInput {
	const status = body.status === "published" ? "published" : "draft";
	return {
		markdown: asString(body.markdown),
		html: asString(body.html),
		tags: asTags(body.tags),
		status,
		date: asIsoDate(body.date) ?? "",
	};
}

/** 把数据层异常翻译成恰当的 HTTP 状态码。 */
export function toErrorResponse(err: unknown): Response {
	if (err instanceof SlugConflictError) return bad(err.message, 409);
	if (err instanceof Error && err.message.includes("D1 绑定")) return bad(err.message, 500);
	return bad(err instanceof Error ? err.message : String(err), 400);
}
