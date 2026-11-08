// 单篇文章 API：GET 读取、PUT 更新、DELETE 删除。
import type { APIRoute } from "astro";
import { deletePost, getPostById, updatePost } from "../../../../lib/db";
import { bad, json, parsePostBody, requireDb, toErrorResponse } from "../../../../lib/api-helpers";

export const GET: APIRoute = async ({ locals, params }) => {
	try {
		const post = await getPostById(requireDb(locals), Number(params.id));
		return post ? json({ post }) : bad("文章不存在", 404);
	} catch (err) {
		return toErrorResponse(err);
	}
};

export const PUT: APIRoute = async ({ request, locals, params }) => {
	try {
		const db = requireDb(locals);
		const id = Number(params.id);
		const existing = await getPostById(db, id);
		if (!existing) return bad("文章不存在", 404);

		const body = (await request.json()) as Record<string, unknown>;
		const input = parsePostBody(body);
		if (!input.slug) return bad("slug 不能为空");
		if (!input.markdown.trim()) return bad("正文不能为空");
		// 日期留空 = 保留原值；发布状态下的每次修改都视为一次内容更新
		input.pubDate = input.pubDate || existing.pubDate.toISOString();
		input.updatedDate = new Date().toISOString();

		const post = await updatePost(db, id, input);
		return json({ id: post.id, slug: post.slug });
	} catch (err) {
		return toErrorResponse(err);
	}
};

export const DELETE: APIRoute = async ({ locals, params }) => {
	try {
		await deletePost(requireDb(locals), Number(params.id));
		return json({ ok: true });
	} catch (err) {
		return toErrorResponse(err);
	}
};
