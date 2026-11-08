# 中文个人博客

运行在 Cloudflare Workers 上的中文个人博客。Astro **server 输出**按请求从 Cloudflare D1 取数渲染，写作、修改全部在站内编辑器 `/admin` 完成，**保存即时生效**，不经过构建。

重计算（Mermaid→SVG、KaTeX 公式、Shiki 代码高亮、字数/摘要推导）在**编辑器保存时**完成，D1 里存的是成品 HTML + 元数据——Worker 请求路径只做取数拼装，读者端依旧零 JS。这是 ADR-0009 对原「纯静态预渲染」（ADR-0001）的演进：构建期管线的原则不变，执行位置从构建机搬到编辑器。

视觉基调为少数派式清爽卡片：蓝灰主色、单栅卡片流、高信息密度元信息、纯浅色（不做暗色模式）。

所有设计决策与取舍记录在 [`docs/adr/`](docs/adr/README.md)，领域术语定义在 [`docs/glossary.md`](docs/glossary.md)。改架构前请先读 ADR。

## 命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 本地开发服务器（本地 D1，数据在 `.wrangler/state/`，与远端无关） |
| `npm run build` | 构建（SSR 产物 + 静态资产到 `dist/`） |
| `npm run check` | **验证命令**：build + `tsc` + `wrangler deploy --dry-run`，改完代码跑这个 |
| `npm run import` | 把 `src/content/{blog,notes}` 的 Markdown 导入本地 D1（迁移工具；`--replace` 先清空，源为空时会拒绝执行） |
| `npm run export` | 把 D1 内容导出为 Markdown 到 `content-export/`（备份逃生舱） |
| `npm run deploy` | 手动部署；正常部署是 push 到 GitHub 自动触发 Cloudflare 构建 |
| `npx wrangler d1 migrations apply blog --local` | 应用 D1 迁移到本地库（`--remote` 为远端） |

首次环境：`npm install`（较重：含 Playwright，导入脚本渲染 Mermaid 需要）。Node >= 22。

## 写作

**在编辑器里写**：`/admin` 即可新建/编辑文章与随想、发布、存草稿、改站点设置。正文支持代码块（保存时 Shiki 高亮）、Mermaid（保存时渲染成内联 SVG）、数学公式（KaTeX）、自动目录（h2/h3）。

- **草稿**：`status` 字段区分草稿/已发布，草稿仅编辑器可见（ADR-0009 开启）。
- **即时生效**：保存写 D1，读者端下一次请求即是新内容，无构建延迟。
- **术语**以 [`docs/glossary.md`](docs/glossary.md) 为准：文章（posts 表）/ 随想（notes 表）/ 卡片 / 筛选芯片 / 徽标。

## 页面

| 路由 | 内容 |
| --- | --- |
| `/` | 首页，单栅卡片流 |
| `/blog` | 文章列表，分类/标签筛选芯片，筛选状态写入 URL 查询参数 |
| `/blog/<slug>` | 文章详情（封面、目录、字数与阅读时长、上一篇/下一篇） |
| `/notes` | 随想时间轴 |
| `/archive` | 按年份分组的归档时间轴 |
| `/about` | 关于页（正文在编辑器「站点设置」里写） |
| `/admin` | 编辑器（生产环境由 Cloudflare Access 保护） |

没有分类页/标签页聚合路由、RSS、sitemap、评论、站内搜索、暗色模式——仍是明确的设计取舍（ADR-0005/0006/0007）。

## 首次部署

1. `npx wrangler login`
2. `npx wrangler d1 create blog`，把输出的 `database_id` 填进 `wrangler.json`（当前是占位 UUID）
3. `npx wrangler d1 migrations apply blog --remote`（建表）
4. 内容：本地已导入的数据不会自动上远端。两种选择：
   - 部署后在 `/admin` 里逐篇发布（适合起步）；
   - 或用 `npm run export` 导出 Markdown，再经 Cloudflare 控制台的 D1 控制台导入。
   （`import` 脚本目前只支持 `--local`，远端批量导入是已知待办。）
5. **配置 Cloudflare Access**（必须，否则编辑器裸奔）：Zero Trust 控制台 → Access → Applications → Self-hosted，域名 `<你的域名>`，路径 `/admin*`，策略允许自己的邮箱（Email OTP）。
6. push 到 GitHub 触发 Cloudflare 构建，或 `npm run deploy`。

## 站点配置

身份信息（站名、副标题、作者、域名、社交链接、关于页正文）的**真源在 D1 settings 表**，编辑器「站点设置」页可改，即时生效。[`src/consts.ts`](src/consts.ts) 的 `SITE` 常量块退化为缺省值（表里缺键时回退），`NAV` 导航结构与阅读速度常量留在代码。

## 字体

标题层用思源黑体 Bold 的 **unicode-range 分片**（fontsource 现成分片，`@fontsource/noto-sans-sc`），浏览器只为命中的字形下载分片，运行时标题无需扫描子集（ADR-0003 方案随 ADR-0009 演进）。正文层用中文系统字体栈，零下载。

## 备份与逃生舱

- `npm run export`：全部内容倒回 Markdown（含 frontmatter），可进任何 Markdown 工作流（含 Obsidian）。
- 远端 D1 自带 Time Travel（30 天时点恢复）。
- 内容与代码彻底解耦：改文章不触发构建，push 只在改代码时发生。

## 项目结构

```
docs/adr/             架构决策记录（9 条）
docs/glossary.md      领域术语表
migrations/           D1 迁移（建表）
src/lib/              text（纯文本计算）/ render-markdown（保存时渲染管线）/ db（D1 数据层）
                      settings（站点身份读取）/ editor-client（编辑器逻辑）/ api-helpers
src/pages/admin/      编辑器页面与 API 路由
src/utils/timeline.ts 时间轴工具（倒序/按年分组）
scripts/              import-content.ts（迁移导入）/ export-content.ts（导出）
src/consts.ts         站点身份缺省值 + 导航 + 阅读速度
src/styles/           global.css（设计令牌）/ prose.css（正文排版）/ admin.css（编辑器）
```

## 已知构建提示（均为预期，可忽略）

| 提示 | 原因 |
| --- | --- |
| `Enabling sessions with Cloudflare KV with the "SESSION" KV binding.` | `@astrojs/cloudflare` 固定提示，未使用 sessions |
| `Cloudflare does not support sharp at runtime...` | 不使用 astro:assets 图片优化 |
| `Some chunks are larger than 500 kB...` | 编辑器保存管线的 shiki/mermaid 分包，仅 /admin 加载，读者端不受影响 |

## 故障排查

**本地库想重来**：`rm -rf .wrangler/state && npx wrangler d1 migrations apply blog --local && npm run import -- --replace`。

**编辑器保存报 slug 冲突**：slug 全局唯一，换一个即可（409 由 API 明确返回）。

**页面数据没更新**：SSR 每请求直读 D1，无缓存层——刷新即变。若远端没变，检查是否连错了库（`--local` vs `--remote`）。
