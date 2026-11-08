/* ══════════════════════════════════════════════════════════════════════
   站点身份缺省值（ADR-0009）
   身份信息的真源在 D1 settings 表（编辑器「站点设置」可改，即时生效）；
   这里的 SITE 常量块只是表里缺键时的回退值，也供 astro.config 的 site 字段使用。
   ══════════════════════════════════════════════════════════════════════ */

interface SocialLinks {
	github: string | null;
	zhihu: string | null;
	bilibili: string | null;
	email: string | null;
}

interface SiteConfig {
	title: string;
	description: string;
	author: string;
	url: string;
	social: SocialLinks;
}

export const SITE: SiteConfig = {
	// 站名：显示在页头、浏览器标题、卡片流顶部
	title: "占位站名",

	// 副标题：显示在首页简介区，同时作为全站默认 SEO description
	description: "这里是副标题占位——写一句你想让访客第一眼看到的话。",

	// 作者昵称：显示在页脚版权行与关于页
	author: "占位作者昵称",

	// 正式域名：必须带协议、不带结尾斜杠。canonical 与 OpenGraph 依赖它。
	// 编辑器「站点设置」里改过即以 D1 为准；这里只是缺省占位。
	url: "https://example.com",

	// 社交链接：保持 null 的条目不会渲染，填上 URL 即自动出现在页头与页脚。
	// 编辑器「站点设置」是运行时真源，这里只是缺省值。
	social: {
		github: null,
		zhihu: null,
		bilibili: null,
		email: null,
	},
};

/* ══════════════════════════════════════════════════════════════════════
   导航 —— 页头链接顺序与中文标签
   ══════════════════════════════════════════════════════════════════════ */

export const NAV = [
	{ href: "/", label: "首页" },
	{ href: "/blog", label: "文章" },
	{ href: "/notes", label: "随想" },
	{ href: "/archive", label: "归档" },
	{ href: "/about", label: "关于" },
] as const;

/* ══════════════════════════════════════════════════════════════════════
   阅读时长估算 —— 中文按字符计，英文按词计
   ══════════════════════════════════════════════════════════════════════ */

export const READING_SPEED = {
	/** 中文每分钟可读字符数 */
	cjkCharsPerMinute: 400,
	/** 拉丁文每分钟可读词数 */
	latinWordsPerMinute: 200,
} as const;
