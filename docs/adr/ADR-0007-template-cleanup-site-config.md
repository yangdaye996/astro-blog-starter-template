# ADR-0007：清空模板内容，删除 RSS 与 sitemap，站点身份集中为占位符

- 状态：已采纳（2026-11-08）
- 相关：ADR-0002（内容模型）、ADR-0003（字体，Atkinson 被移除）

## 背景

模板带着一整套与需求方无关的默认内容：5 篇英文示例文章（`first-post.md`、`second-post.md`、`third-post.md`、`markdown-style-guide.md`、`using-mdx.mdx`）、5 张 `blog-placeholder-*.jpg`、Atkinson Hyperlegible 字体、以及 `SITE_TITLE = "Astro Blog"` / `SITE_DESCRIPTION = "Welcome to my website!"`。

同时，站点身份信息（站名、副标题、作者昵称、域名、社交链接）在四轮问答中始终未提供。这些信息是 `src/consts.ts`、`BaseHead.astro` 的 canonical / OpenGraph、以及 `astro.config.mjs` 的 `site` 字段的必需输入。

## 决策

### 清空内容

- 删除 `src/content/blog/` 下全部 5 篇示例文章，**不补任何示例文章**，collection 留空。
- 删除 `public/blog-placeholder-*.jpg`（5 张）。
- 删除 `public/fonts/atkinson-bold.woff` 与 `atkinson-regular.woff`（ADR-0003 已改用思源黑体子集 + 系统字体栈，Atkinson 不再被任何样式引用）。
- 保留 `public/favicon.svg`，但需替换为与新视觉基调一致的图标。

### 删除 RSS 与 sitemap

- 删除 `src/pages/rss.xml.js`。
- 移除 `@astrojs/rss` 与 `@astrojs/sitemap` 依赖。
- 移除 `astro.config.mjs` 中 `integrations` 里的 `sitemap()`。

`@astrojs/sitemap` 依赖 `site` 字段生成绝对 URL，`rss.xml.js` 同样依赖它。在域名为占位符的状态下，这两者会产出 `https://example.com/...` 的错误数据——**对外发布错误的 sitemap 与 RSS 比不提供它们更糟**，因此直接移除。

### 站点身份集中为占位符

`src/consts.ts` 顶部设一个单一的 `SITE` 常量块，集中全部身份信息，每处占位值旁标注中文说明，使需求方日后只需改一个文件、一个块：

```ts
export const SITE = {
  title: "占位站名",        // ← 改这里
  description: "占位副标题", // ← 改这里
  author: "占位作者昵称",    // ← 改这里
  url: "https://example.com", // ← 改这里（正式域名）
  social: { /* GitHub / 知乎 / B站 / 邮箱 占位 */ },
} as const;
```

`astro.config.mjs` 的 `site` 与 `BaseHead.astro` 的 canonical / OpenGraph 一律从该块读取，不出现第二处硬编码。

### README

重写 `README.md`，移除 Cloudflare 模板市场相关内容（Deploy 按钮、模板预览图、C3 脚手架说明、Bear Blog 致谢），改为描述本项目自身的结构、写作流程、字体子集构建步骤与部署命令。

## 理由

- 示例文章留着会在列表页、归档页、筛选芯片里制造假数据，干扰对新设计的判断；且其英文内容与中文排版样式（标点挤压、行高、字体回退）无法互相验证。
- "不留文章"是需求方明确选择。代价是无法直接看到渲染效果，因此**验证阶段需要临时造一篇覆盖全部富媒体能力的样例文章，验证完再删**（见验收清单）。
- 占位符集中化遵循"手改配置放文件顶部"的原则：需求方不该为了改站名去翻多个组件文件。

## 代价

- 空站首次部署后，首页、`/blog`、`/archive`、`/notes` 全是空状态，必须为每个列表页设计**空状态文案**，否则看起来像坏了。这是本决策直接派生的一项设计要求。
- 删除 RSS 意味着无法被订阅器抓取，删除 sitemap 意味着搜索引擎收录变慢。若日后需要恢复，必须先确定正式域名。
- 站名占位符会被标题字体子集脚本扫描（ADR-0003），因此改站名后必须重新构建才能让新字符进入子集。

## 备选方案

| 方案 | 否决理由 |
| --- | --- |
| 全删后补 2–3 篇中文示例文 | 能直接看到渲染效果，但示例内容与需求方无关，最终仍要删；改为验证期临时造样例文章，用完即删。 |
| 保留示例并改写为中文 | 改动最小，但内容与需求方无关，且改写成本高于删除。 |
| 保留 RSS 与 sitemap，域名先占位 | 会对外产出 `https://example.com` 的错误 URL，污染搜索引擎与订阅器。 |
| 站点身份散落在各组件 | 需求方要改多处，易漏，违背"集中可改"的要求。 |
