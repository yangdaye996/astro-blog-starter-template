# AGENTS.md

中文个人博客：Astro server 输出运行时渲染，内容存 Cloudflare D1，站内 `/admin` 在线编辑（ADR-0009）。Worker 请求路径只做取数拼装，重计算全部在编辑器保存时完成。代码注释与文档一律用中文，与现有风格一致。

## 命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 开发服务器（本地 D1，数据在 `.wrangler/state/`） |
| `npm run build` | 构建（SSR + 静态资产） |
| `npm run check` | **验证命令**：build + `tsc` + `wrangler deploy --dry-run`，改完代码跑这个 |
| `npm run import` / `export` | 内容迁移 / 备份导出（仅本地库；`--replace` 有空源拒绝护栏） |
| `npx wrangler d1 migrations apply blog --local` | 应用 D1 迁移 |

本地库重置：`rm -rf .wrangler/state && npx wrangler d1 migrations apply blog --local`（再用 `npm run import -- --replace` 灌内容）。

## 架构硬规则（依据 docs/adr/，改架构前先读）

- **运行时渲染（ADR-0009）**：全部读者页面按请求从 D1 取数。**Worker 请求路径禁止重计算**——Mermaid/KaTeX/Shiki/字数/摘要一律不得出现在请求处理链路。
- **保存时处理唯一入口**：`src/lib/render-markdown.ts` 是编辑器（浏览器）与导入脚本（Node，mermaid-isomorphic）共用的渲染管线。改 Markdown 渲染行为只改这一份，两条路径共用是刻意设计，防漂移。
- **D1 唯一真源**：代码仓库不放内容文件。任何「把内容写回 git」的新需求必须另开 ADR。
- **Access 保护 /admin（ADR-0009）**：由 Cloudflare Zero Trust 控制台配置，代码库无法表达。换账号/换域名/重建 Worker 时遗漏这步 = 编辑器裸奔。本地 dev 不经 Access 属预期。
- **读者端零 JS**：唯一例外是 TOC 滚动高亮与代码复制按钮（纯增强，无脚本仍可读）。
- **浅色单主题（ADR-0005）**：不做暗色模式。设计令牌在 `src/styles/global.css` 的 `:root`，每个令牌只有一组值。
- **明确不存在的功能**：RSS、sitemap、分类页/标签页聚合路由、评论、站内搜索、i18n。不要"顺手补上"（ADR-0006/0007/0009）。草稿机制**已开启**（D1 status 字段，ADR-0009 废除了原禁令）。
- **站点身份**：真源是 D1 settings 表（编辑器可改）；`src/consts.ts` 的 `SITE` 块只是缺省值。`NAV`/`READING_SPEED` 留在代码。
- **大内容写入必须走参数绑定**：D1 单条 SQL 语句上限 100KB（成品 HTML 动辄几百 KB，实测 SQLITE_TOOBIG）。一律用 `src/lib/db.ts` 的绑定参数写入，不要拼 SQL 文本。
- **hast 属性陷阱**：rehype 树里 class 在 `properties.className`，不在顶层 `className`（踩过：shiki 分支因此静默不命中）。`rehype-slug` 的 id 在 `properties.id`。
- **shiki v4 的 `codeToHtml` 是 async**，返回 Promise；transformer 里先收集节点再 for-await。
- **workerd 类型冲突**：`worker-configuration.d.ts` 的全局 `Element`（HTMLRewriter）会与 lib.dom 合并，`el<HTMLSelectElement>` 这类泛型约束会误报 TS2344——用 `as unknown as` 中转断言绕开。
- **字体**：标题层 = fontsource unicode-range 分片（`@fontsource/noto-sans-sc/700.css`），正文 = 系统字体栈。没有扫描式子集，新增文案不需要任何字体操作。

## 内容与约定

- 内容在 D1（posts/notes/settings 三张表，schema 见 `migrations/`）。`src/content/` 已退役；`npm run import` 仅用于一次性迁移或从 Markdown 灌回。
- 日期固化在 `pub_date` 列 / frontmatter `pubDate`，clone 不再丢时间戳。
- 术语以 `docs/glossary.md` 为准：文章（posts）/ 随想（notes）/ 卡片 / 筛选芯片 / 徽标 / 编辑器 / 保存时处理 / 真源。
- 每个列表页必须有空状态设计。
- 样式：设置了 `display` 的类（如 `.post-card`、`.chip`）会盖掉 UA 的 `[hidden]{display:none}`，用 `hidden` 控显隐时需补一条该规则。
- 编辑器表单逻辑在 `src/lib/editor-client.ts`，新字段先改 `EditorForm.astro` + `editor-client.ts` + `api-helpers.ts` 校验 + db 层四处，保持一致。

## 已知构建提示（预期行为，不要尝试修复）

SESSION KV 提示、sharp 不支持提示、vite chunk >500kB 警告（编辑器管线分包，仅 /admin 加载）均为预期，详见 README。

## 故障排查

- 页面数据没变：SSR 直读 D1 无缓存，刷新即变；先确认连的库（`--local`/`--remote`）。
- 保存报 slug 冲突：slug 全局唯一，换一个。
- `npm run check` 里 tsc 报 DOM 类型怪错：先怀疑 workerd 类型合并（见上），不是业务代码问题。

## 改动前必读

- 改架构：`docs/adr/README.md`（9 条 ADR 索引 + 已识别风险与待办）。
- 改渲染管线：`src/lib/render-markdown.ts` 顶部注释与 ADR-0004/0009。
- 改视觉：`src/styles/global.css` 设计令牌与 ADR-0005。
- 部署：根目录 `README.md` 的「首次部署」一节（D1 建库、Access 配置）。
