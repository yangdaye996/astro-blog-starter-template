// 编辑器客户端逻辑（ADR-0009）：预览、保存时渲染、提交 API。
// 页面通过 <script> 导入 initEditor，表单数据经 #editor-initial 的 JSON 块传入。
// 渲染管线（render-markdown.ts）与导入脚本共用同一份实现——预览即所得，保存的
// HTML 就是预览的 HTML。

import { excerpt, countWords, readingMinutes } from "./text";
import { MERMAID_FONT_FAMILY } from "./render-markdown";

export interface EditorInitial {
	mode: "post" | "note";
	id?: number;
	slug?: string;
	title?: string;
	description?: string;
	category?: string;
	tags?: string[];
	heroImage?: string;
	status?: string;
	pubDate?: string; // yyyy-MM-dd，编辑现有文章时预填
	date?: string; // 随想日期，同上
	markdown?: string;
}

// ═══ 浏览器端 Mermaid 渲染器 ═══
// mermaid 包按需动态加载（约 1MB，只在编辑器出现 mermaid 块或首次渲染时拉取）；
// 配置与 remark-mermaid.mjs / 导入脚本保持一致。

type MermaidModule = typeof import("mermaid");
let mermaidPromise: Promise<MermaidModule> | null = null;
let seq = 0;

async function loadMermaid(): Promise<MermaidModule> {
	if (!mermaidPromise) {
		mermaidPromise = import("mermaid").then((m) => {
			m.default.initialize({
				startOnLoad: false,
				theme: "neutral",
				securityLevel: "strict",
				fontFamily: MERMAID_FONT_FAMILY,
			});
			return m;
		});
	}
	return mermaidPromise;
}

async function renderMermaidBrowser(code: string): Promise<string | null> {
	try {
		const mermaid = (await loadMermaid()).default;
		const { svg } = await mermaid.render(`mmd-${++seq}`, code);
		return svg;
	} catch (err) {
		console.error("[mermaid] 渲染失败，该图退化为代码块：", err);
		return null;
	}
}

// ═══ 表单工具 ═══

function el<T extends HTMLElement>(root: HTMLElement, id: string): T {
	const node = root.querySelector(`#${id}`);
	if (!node) throw new Error(`编辑器缺少 #${id} 元素`);
	return node as T;
}

/** 解析标签输入：逗号（中英文）、空白分隔，去空去重。 */
function parseTags(raw: string): string[] {
	return [...new Set(raw.split(/[,，\s]+/).map((t) => t.trim()).filter(Boolean))];
}

const DEBOUNCE_MS = 500;

export function initEditor(root: HTMLElement, initial: EditorInitial): void {
	const isPost = initial.mode === "post";

	const markdown = el<HTMLTextAreaElement>(root, "f-markdown");
	const preview = el<HTMLDivElement>(root, "preview");
	const statusLine = el<HTMLParagraphElement>(root, "status-line");
	const saveBtn = el<HTMLButtonElement>(root, "btn-save");
	// 不走 el<T> 泛型：HTMLSelectElement 自带 remove(index?) 重载，与 workerd 运行时
	// 类型（worker-configuration.d.ts）里的全局 Element（HTMLRewriter）合并后，
	// 泛型约束会误报 TS2344。直接断言绕开。
	const statusSelNode = root.querySelector("#f-status");
	if (!statusSelNode) throw new Error("编辑器缺少 #f-status 元素");
	// workerd 的全局 Element 与 DOM Element 合并后，querySelector 返回的是前者，
	// 直接断言会报 TS2352，经 unknown 中转
	const statusSel = statusSelNode as unknown as HTMLSelectElement;
	const tagsInput = el<HTMLInputElement>(root, "f-tags");

	const title = isPost ? el<HTMLInputElement>(root, "f-title") : null;
	const slug = isPost ? el<HTMLInputElement>(root, "f-slug") : null;
	const category = isPost ? el<HTMLInputElement>(root, "f-category") : null;
	const heroImage = isPost ? el<HTMLInputElement>(root, "f-hero") : null;
	const description = isPost ? el<HTMLTextAreaElement>(root, "f-description") : null;
	const dateInput = el<HTMLInputElement>(root, isPost ? "f-pubdate" : "f-date");

	const deleteBtn = root.querySelector<HTMLButtonElement>("#btn-delete");
	const descHint = root.querySelector<HTMLParagraphElement>("#desc-hint");

	// slug 在用户没手动改过之前跟随标题
	let slugTouched = false;
	slug?.addEventListener("input", () => {
		slugTouched = slug.value.trim().length > 0;
	});
	title?.addEventListener("input", () => {
		if (slug && !slugTouched) slug.value = title.value.trim();
	});

	// 摘要留空时提示将自动生成
	const refreshDescHint = () => {
		if (!descHint || !description) return;
		const manual = description.value.trim();
		descHint.textContent = manual
			? ""
			: `留空将自动取正文首段：${excerpt(markdown.value) || "（正文为空）"}`;
	};
	description?.addEventListener("input", refreshDescHint);

	// ═══ 预览与统计 ═══

	let previewTimer: ReturnType<typeof setTimeout> | null = null;
	let rendering = false;
	let pending = false;

	async function refreshPreview(): Promise<void> {
		if (rendering) {
			pending = true;
			return;
		}
		rendering = true;
		try {
			const { renderMarkdown } = await import("./render-markdown");
			const md = markdown.value;
			const result = await renderMarkdown(md, renderMermaidBrowser);

			preview.innerHTML = result.html;
			const { total } = countWords(md);
			const minutes = readingMinutes(md);
			const warns: string[] = [];
			if (result.mermaidFailed > 0)
				warns.push(`⚠ ${result.mermaidFailed} 张 Mermaid 图渲染失败，已保留为代码块`);
			if (result.shikiFailed > 0)
				warns.push(`⚠ ${result.shikiFailed} 个代码块语言未知，未高亮`);
			statusLine.textContent =
				[`${total} 字 · 约 ${minutes} 分钟`, ...warns].join("\n");
			statusLine.className = `status-line${warns.length > 0 ? " warn" : ""}`;
			refreshDescHint();
		} catch (err) {
			statusLine.textContent = `预览失败：${err instanceof Error ? err.message : String(err)}`;
			statusLine.className = "status-line error";
		} finally {
			rendering = false;
			if (pending) {
				pending = false;
				void refreshPreview();
			}
		}
	}

	const schedulePreview = () => {
		if (previewTimer) clearTimeout(previewTimer);
		previewTimer = setTimeout(() => void refreshPreview(), DEBOUNCE_MS);
	};
	markdown.addEventListener("input", schedulePreview);
	description?.addEventListener("input", schedulePreview);

	// ═══ 保存 ═══

	function setStatus(cls: "ok" | "error", msg: string): void {
		statusLine.textContent = msg;
		statusLine.className = `status-line ${cls}`;
	}

	async function save(): Promise<void> {
		const md = markdown.value;
		if (!md.trim()) {
			setStatus("error", "正文不能为空。");
			return;
		}
		if (isPost && title && !title.value.trim()) {
			setStatus("error", "标题不能为空。");
			return;
		}
		if (isPost && slug && !slug.value.trim()) {
			setStatus("error", "slug 不能为空。");
			return;
		}

		saveBtn.disabled = true;
		setStatus("ok", "正在渲染并保存…");
		try {
			// 保存前重新渲染一遍，确保落库的 HTML 与此刻的 markdown 完全一致
			const { renderMarkdown } = await import("./render-markdown");
			const { html, headings } = await renderMarkdown(md, renderMermaidBrowser);
			const { total } = countWords(md);
			const minutes = readingMinutes(md);
			const status = statusSel.value as "draft" | "published";
			const dateValue = dateInput.value
				? new Date(`${dateInput.value}T12:00:00`).toISOString()
				: null;

			const payload = isPost
				? {
						slug: slug!.value.trim(),
						title: title!.value.trim(),
						description: description!.value.trim() || excerpt(md),
						category: category!.value.trim() || null,
						tags: parseTags(tagsInput.value),
						heroImage: heroImage!.value.trim() || null,
						markdown: md,
						html,
						headings,
						wordCount: total,
						readingMinutes: minutes,
						status,
						pubDate: dateValue,
					}
				: {
						markdown: md,
						html,
						tags: parseTags(tagsInput.value),
						status,
						date: dateValue,
					};

			const base = isPost ? "/admin/api/posts" : "/admin/api/notes";
			const url = initial.id ? `${base}/${initial.id}` : base;
			const res = await fetch(url, {
				method: initial.id ? "PUT" : "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(payload),
			});

			if (res.ok) {
				const data = (await res.json()) as { id: number; slug?: string };
				// 新建后跳到编辑地址，避免保存后再次保存变成重复创建
				if (!initial.id && data.id) {
					const editUrl = isPost ? `/admin/posts/${data.id}` : `/admin/notes/${data.id}`;
					history.replaceState(null, "", editUrl);
					initial.id = data.id;
					if (deleteBtn) deleteBtn.hidden = false;
				}
				setStatus("ok", status === "published" ? "已发布 ✓" : "草稿已保存 ✓");
				return;
			}

			const body = (await res.json().catch(() => ({}))) as { error?: string };
			if (res.status === 409) setStatus("error", body.error ?? "slug 已被占用。");
			else setStatus("error", `保存失败（${res.status}）：${body.error ?? res.statusText}`);
		} catch (err) {
			setStatus("error", `保存失败：${err instanceof Error ? err.message : String(err)}`);
		} finally {
			saveBtn.disabled = false;
		}
	}

	saveBtn.addEventListener("click", () => void save());

	// ═══ 删除 ═══

	deleteBtn?.addEventListener("click", async () => {
		if (!initial.id) return;
		if (!confirm("确定删除这篇内容？此操作不可恢复（建议先在站点设置旁导出备份）。")) return;
		const base = isPost ? "/admin/api/posts" : "/admin/api/notes";
		const res = await fetch(`${base}/${initial.id}`, { method: "DELETE" });
		if (res.ok) location.href = "/admin";
		else setStatus("error", `删除失败（${res.status}）。`);
	});

	// 初始预览一次
	void refreshPreview();
}
