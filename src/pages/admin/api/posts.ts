// 文章 API：GET 列表（含草稿，仅编辑器使用）、POST 新建。
import type { APIRoute } from "astro";
import { createPost, listPosts } from "../../../lib/db";
import { bad, json, parsePostBody, requireDb, toErrorResponse } from "../../../lib/api-helpers";

export const GET: APIRoute = async ({ locals }) => {
	try {
		const posts = await listPosts(requireDb(locals));
		return json({ posts });
	} catch (err) {
		return toErrorResponse(err);
	}
};

export const POST: APIRoute = async ({ request, locals }) => {
	try {
		const body = (await request.json()) as Record<string, unknown>;
		const input = parsePostBody(body);
		if (!input.slug) return bad("slug 不能为空");
		if (!input.markdown.trim()) return bad("正文不能为空");
		if (!input.pubDate) input.pubDate = new Date().toISOString();
		const post = await createPost(requireDb(locals), input);
		return json({ id: post.id, slug: post.slug });
	} catch (err) {
		return toErrorResponse(err);
	}
};
