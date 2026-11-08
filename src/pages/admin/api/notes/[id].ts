// 单条随想 API：GET、PUT、DELETE。
import type { APIRoute } from "astro";
import { deleteNote, getNoteById, updateNote } from "../../../../lib/db";
import { bad, json, parseNoteBody, requireDb, toErrorResponse } from "../../../../lib/api-helpers";

export const GET: APIRoute = async ({ locals, params }) => {
	try {
		const note = await getNoteById(requireDb(locals), Number(params.id));
		return note ? json({ note }) : bad("随想不存在", 404);
	} catch (err) {
		return toErrorResponse(err);
	}
};

export const PUT: APIRoute = async ({ request, locals, params }) => {
	try {
		const db = requireDb(locals);
		const id = Number(params.id);
		const existing = await getNoteById(db, id);
		if (!existing) return bad("随想不存在", 404);

		const body = (await request.json()) as Record<string, unknown>;
		const input = parseNoteBody(body);
		if (!input.markdown.trim()) return bad("正文不能为空");
		input.date = input.date || existing.date.toISOString();

		const note = await updateNote(db, id, input);
		return json({ id: note.id });
	} catch (err) {
		return toErrorResponse(err);
	}
};

export const DELETE: APIRoute = async ({ locals, params }) => {
	try {
		await deleteNote(requireDb(locals), Number(params.id));
		return json({ ok: true });
	} catch (err) {
		return toErrorResponse(err);
	}
};
