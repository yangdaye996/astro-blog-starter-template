// 站点设置 API：GET 读全量、PUT 全量覆盖（客户端提交所有键）。
import type { APIRoute } from "astro";
import { getSettingRows, saveSettingRows } from "../../../lib/db";
import { bad, json, requireDb, toErrorResponse } from "../../../lib/api-helpers";

export const GET: APIRoute = async ({ locals }) => {
	try {
		return json({ settings: await getSettingRows(requireDb(locals)) });
	} catch (err) {
		return toErrorResponse(err);
	}
};

export const PUT: APIRoute = async ({ request, locals }) => {
	try {
		const body = (await request.json()) as { settings?: Record<string, unknown> };
		const rows = body.settings;
		if (!rows || typeof rows !== "object") return bad("缺少 settings 对象");
		const cleaned = Object.fromEntries(
			Object.entries(rows)
				.filter(([, v]) => typeof v === "string")
				.map(([k, v]) => [String(k).slice(0, 64), String(v)]),
		);
		await saveSettingRows(requireDb(locals), cleaned);
		return json({ ok: true });
	} catch (err) {
		return toErrorResponse(err);
	}
};
