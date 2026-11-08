# 中文个人博客

运行在 Cloudflare Workers 上的中文个人博客。Astro **纯静态预渲染**，Workers 只负责伺服 `dist/` 里的静态文件，不执行服务端代码，因此不消耗 Worker 的 CPU / 内存配额。

视觉基调为少数派式清爽卡片：蓝灰主色、单栅卡片流、高信息密度元信息、纯浅色（不做暗色模式）。

所有设计决策与取舍记录在 [`docs/adr/`](docs/adr/README.md)，领域术语定义在 [`docs/glossary.md`](docs/glossary.md)。改架构前请先读 ADR。

## 命令

| 命令 | 作用 |
| --- | --- |
| `npm install` | 安装依赖。首次安装较重：含 Playwright（构建期渲染 Mermaid 需要 Chromium）与思源黑体源字体 |
| `npx playwright install chromium` | 仅首次需要：下载构建期渲染 Mermaid 用的浏览器二进制 |
| `npm run dev` | 本地开发服务器。会先自动生成标题字体子集 |
| `npm run build` | 构建到 `dist/`。会先自动生成标题字体子集 |
| `npm run check` | 构建 + `tsc` 类型检查 + `wrangler deploy --dry-run` |
| `npm run deploy` | 部署到 Cloudflare Workers |
| `npm run fonts` | 单独重新生成标题字体子集 |

## 写作

**发布即 push**：提交推送到 GitHub 会自动触发 Cloudflare 构建部署；本机 `npm run deploy` 是手动备选。

**零格式要求**：把 Markdown 放进对应目录即可，frontmatter 完全可选（ADR-0008）。缺省字段自动推导：

| 字段 | 缺省取值 | frontmatter 覆盖键 |
| --- | --- | --- |
| 标题 | 文件名（去掉后缀） | `title` |
| 日期 | 文件创建时间 | `pubDate`（随想为 `date`） |
| 摘要 | 正文第一个非空段落，截 120 字 | `description` |

注意：日期取自文件系统，而 git 不保留时间戳——重新 clone 仓库后，未写日期的条目会变成 clone 时间。在意精确日期的条目请写上对应字段。

### 文章（`src/content/blog/`）

Markdown 或 MDX，文件名即 URL slug 与缺省标题。可选 frontmatter：

```yaml
---
title: 文章标题            # 可选。默认取文件名；参与标题字体子集扫描
description: 一句话摘要     # 可选。默认取正文首段；卡片副文案与 SEO description
pubDate: 2026-11-08        # 可选。默认取文件创建时间；排序与归档分组依据
updatedDate: 2026-11-09    # 可选。显示为「最后更新」
heroImage: /images/x.png   # 可选。卡片与文章页封面图
category: 工程             # 可选。仅用于列表页筛选，不生成聚合页
tags:                      # 可选。仅用于列表页筛选，不生成聚合页
  - Cloudflare
  - 构建
---
```

### 随想（`src/content/notes/`）

无标题的短记录，渲染到 `/notes` 的时间轴上，不生成独立页面：

```yaml
---
date: 2026-11-06           # 可选。默认取文件创建时间
tags:                      # 可选
  - 随想
---

正文即内容。
```

### 正文能力

- **代码块**：Shiki 浅色高亮，鼠标悬停出现复制按钮。
- **Mermaid**：```` ```mermaid ```` 代码块在**构建期**渲染成内联 SVG，读者端零 JS。语法错误不会中断构建，该图会退化为代码块并在构建日志报错。
- **数学公式**：`$...$` 与 `$$...$$`，构建期由 KaTeX 渲染。
- **目录**：自动收录 h2 / h3，宽屏为右侧粘性栏并随滚动高亮。

## 页面

| 路由 | 内容 |
| --- | --- |
| `/` | 首页，单栅卡片流 |
| `/blog` | 文章列表，顶部带分类 / 标签筛选芯片，筛选状态写入 URL 查询参数 |
| `/blog/<slug>` | 文章详情，含封面、目录、字数与阅读时长、上一篇 / 下一篇 |
| `/notes` | 随想时间轴 |
| `/archive` | 按年份分组的归档时间轴 |
| `/about` | 关于页 |

没有分类页、标签页、友链页、项目页，没有 RSS 与 sitemap，没有暗色模式。这些是明确的设计取舍，理由见对应 ADR。

## 站点配置

**全部身份信息集中在 [`src/consts.ts`](src/consts.ts) 顶部的 `SITE` 常量块**：站名、副标题、作者昵称、正式域名、社交链接。改这一处即可全站生效。

注意两点：

1. 改**站名或导航文案**后必须重新构建——标题字体子集在 `prebuild` 阶段扫描这些文字。
2. 填入正式域名前，canonical 与 OpenGraph 指向 `https://example.com`，不要提前对外发布。

社交链接保持 `null` 的条目不会渲染；填上 URL 即自动出现在页头、页脚与关于页。

## 标题字体子集

标题层（站名、导航、栏目标题、文章标题）使用思源黑体 Bold 的**动态子集**，正文层使用中文系统字体栈，零下载。

`scripts/subset-heading-font.mjs` 在 `prebuild` / `predev` 阶段：

1. 扫描 `src/consts.ts`（剥离注释）、全部 `.astro` 的 `<h1>`–`<h6>` 文本、全部文章的标题（frontmatter `title`，缺省为文件名）；
2. 去重后用 `subset-font`（wasm harfbuzz）从 `@expo-google-fonts/noto-sans-sc` 的 700Bold TTF 裁出子集；
3. 写入 `public/fonts/heading-subset.woff2`（实测 198 个汉字约 33KB、耗时约 0.2s）。

产物已 gitignore。若新增了上述三处之外的标题文案，把字符补进脚本顶部的 `EXTRA_HEADING_CHARS`，否则那些字会回退到系统字体。

## 项目结构

```
docs/adr/            架构决策记录
docs/glossary.md     领域术语表
markdown.config.mjs  Markdown / MDX 共用的插件与高亮配置
remark-mermaid.mjs   构建期 Mermaid 渲染插件（必须在 remark 阶段，原因见 ADR-0004）
scripts/             构建期工具（字体子集）
src/consts.ts        站点身份与导航的唯一配置点
src/content/         blog 与 notes 两个内容集合
src/utils/posts.ts   字数、阅读时长、排序、分组等构建期计算
src/styles/          global.css（设计令牌）与 prose.css（正文排版）
```

## 构建期依赖说明

`playwright`、`mermaid-isomorphic`、`subset-font`、`@expo-google-fonts/noto-sans-sc` 都只服务于构建期，**不进入 `dist/`、不上传到 Worker**。`wrangler deploy --dry-run` 可确认产物绑定仅 `env.ASSETS`。

## 已知构建提示（均为预期，可忽略）

| 提示 | 原因 |
| --- | --- |
| `Enabling sessions with Cloudflare KV with the "SESSION" KV binding.` | `@astrojs/cloudflare` 的固定提示。纯静态输出下不会真的接线：`wrangler deploy --dry-run` 显示绑定只有 `env.ASSETS`。不需要创建 KV 命名空间 |
| `Cloudflare does not support sharp at runtime...` | 本站不使用 `astro:assets` 的图片优化，封面图是普通静态路径，与 image service 无关 |
| `The collection "blog" does not exist or is empty.` | 内容集合为空时的正常 warning。放入第一篇文章后消失 |
| `[glob-loader] No files found matching ...` | 同上，内容目录还没有 Markdown |
| `Automatically externalized node built-in module "node:fs" / "node:path"` | `src/utils/posts.ts` 的元信息推导（ADR-0008）在构建期读文件时间戳；纯静态输出下这些代码不会上传到 Worker |

## 故障排查

**删了文章但站点还显示它**：Astro 内容层的持久化数据存储在 `node_modules/.astro/data-store.json`，不在 `.astro/` 里，个别情况下删除源文件不会让它失效。执行：

```bash
rm -rf node_modules/.astro dist && npm run build
```

**标题里某个汉字显示成了别的字体**：该字不在子集里。重新构建；若它是写在 `.astro` 的 h1–h6 之外或 `consts.ts` 之外的标题文案，把字符补进 `scripts/subset-heading-font.mjs` 顶部的 `EXTRA_HEADING_CHARS`。

