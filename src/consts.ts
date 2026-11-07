/* ══════════════════════════════════════════════════════════════════════
   站点身份配置 —— 全站唯一改动点
   页头、页脚、SEO canonical / OpenGraph、标题字体子集脚本都读这里。
   改完站名后请重新构建（npm run build），标题字体子集需要重新生成。
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
	// 填入真实域名前，这些标签指向 example.com，不要提前对外发布。
	url: "https://example.com",

	// 社交链接：保持 null 的条目不会渲染，填上 URL 即自动出现在页头与页脚。
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
