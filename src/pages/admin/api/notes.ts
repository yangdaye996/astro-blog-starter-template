// 随想 API：GET 列表（含草稿）、POST 新建。
import type { APIRoute } from "astro";
import { createNote, listNotes } from "../../../lib/db";
import { bad, json, parseNoteBody, requireDb, toErrorResponse } from "../../../lib/api-helpers";

export const GET: APIRoute = async ({ locals }) => {
	try {
		const notes = await listNotes(requireDb(locals));
		return json({ notes });
	} catch (err) {
		return toErrorResponse(err);
	}
};

export const POST: APIRoute = async ({ request, locals }) => {
	try {
		const body = (await request.json()) as Record<string, unknown>;
		const input = parseNoteBody(body);
		if (!input.markdown.trim()) return bad("正文不能为空");
		if (!input.date) input.date = new Date().toISOString();
		const note = await createNote(requireDb(locals), input);
		return json({ id: note.id });
	} catch (err) {
		return toErrorResponse(err);
	}
};
