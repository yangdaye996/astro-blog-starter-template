// 站点身份的运行时读取层（ADR-0009）。
// D1 settings 表是身份信息的真源；consts.ts 的 SITE 常量块退化为缺省值——
// 表里没有对应键时（例如首次部署、还没进编辑器改过）逐字段回退。
// 每次请求现读现用，不做进程内缓存：Workers isolate 可存活很久，缓存会让
// 「编辑器改完即生效」变成「换个实例才生效」。

import { SITE } from "../consts";
import { getSettingRows } from "./db";

export interface SiteSettings {
	title: string;
	description: string;
	author: string;
	url: string;
	social: {
		github: string | null;
		zhihu: string | null;
		bilibili: string | null;
		email: string | null;
	};
	aboutHtml: string;
}

// settings 表的键名约定。about 存双份：markdown 原文（再编辑用）+ 保存时渲染的 html。
export const SETTING_KEYS = {
	title: "site_title",
	description: "site_description",
	author: "site_author",
	url: "site_url",
	social: "social_links",
	aboutMarkdown: "about_markdown",
	aboutHtml: "about_html",
} as const;

// 关于页缺省正文：与迁移前 about.astro 的占位内容一致。
// 以 markdown 形式维护，由渲染管线在导入/编辑器保存时转成 html。
export const DEFAULT_ABOUT_MARKDOWN = `这里是关于页的占位内容。你可以写清楚自己是谁、在做什么、这个站点用来记录什么，
以及别人可以通过什么方式找到你。

## 关于本站

本站由 Astro 生成页面，托管在 Cloudflare Workers 上。文章与随想通过站点内的
编辑器（/admin）直接在线写作、即时发布，内容存放在 Cloudflare D1。

## 联系方式

社交链接在编辑器的「站点设置」里配置，填上地址就会自动出现在页头、页脚与这里；
留空则整块不渲染。
`;

function socialFrom(raw: string | undefined): SiteSettings["social"] {
	const fallback = SITE.social;
	if (!raw) return { ...fallback };
	try {
		const parsed = JSON.parse(raw) as Partial<SiteSettings["social"]>;
		return {
			github: typeof parsed.github === "string" && parsed.github ? parsed.github : null,
			zhihu: typeof parsed.zhihu === "string" && parsed.zhihu ? parsed.zhihu : null,
			bilibili: typeof parsed.bilibili === "string" && parsed.bilibili ? parsed.bilibili : null,
			email: typeof parsed.email === "string" && parsed.email ? parsed.email : null,
		};
	} catch {
		return { ...fallback };
	}
}

export async function getSiteSettings(locals: App.Locals): Promise<SiteSettings> {
	const db = locals.runtime?.env.DB;
	if (!db) {
		// 本地纯构建（npm run check）等无 D1 场景：直接用缺省值，页面仍可渲染
		return {
			title: SITE.title,
			description: SITE.description,
			author: SITE.author,
			url: SITE.url,
			social: { ...SITE.social },
			aboutHtml: "",
		};
	}
	const rows = await getSettingRows(db);
	return {
		title: rows[SETTING_KEYS.title] || SITE.title,
		description: rows[SETTING_KEYS.description] || SITE.description,
		author: rows[SETTING_KEYS.author] || SITE.author,
		url: rows[SETTING_KEYS.url] || SITE.url,
		social: socialFrom(rows[SETTING_KEYS.social]),
		aboutHtml: rows[SETTING_KEYS.aboutHtml] ?? "",
	};
}
