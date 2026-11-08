# ADR-0010：项目换血——博客退役，转型认知训练站

- 状态：已采纳（2026-11-09，战略四项经用户逐条确认；实施未启动）
- 相关：ADR-0011（无构建纯静态）、ADR-0012（localStorage 存储）、ADR-0013（模块规格）、ADR-0014（视觉重设计）

## 背景

ADR-0009 完成了「D1 内容 + 站内编辑」的博客形态。用户决定项目不再做博客：清空全部原始内容，博客模板整体出局，项目改造成**心算、N-back、冥想**三大训练模块的纯前端应用。

本轮访谈确认了四个战略分叉（grilling 第一、二轮，用户逐条回答）：

1. **训练记录存哪里** → 纯前端静态站，记录存浏览器 localStorage，Worker/D1/SSR 全拆（ADR-0012）。
2. **给谁用** → 只自己用，零登录，不部署在公开分享场景做账号体系。
3. **博客遗产怎么处置** → 全部处死，一个不留：D1 内容表、`/admin` 编辑器、`render-markdown` 渲染管线、全部文章页面与组件、导入/导出脚本、所有 Markdown/unified 系依赖。
4. **实施节奏** → 一步到位做三模块 MVP（每模块一个核心玩法），再迭代打磨。

## 决策

### 项目新身份

认知训练站（工作名，正式名待定）：三个训练模块 + 一个统计页，部署为 Cloudflare 上的纯静态站点。无服务器端逻辑，无数据库，无账号。

### 旧 ADR 处置映射

| 旧 ADR | 处置 | 说明 |
| --- | --- | --- |
| 0001 纯静态预渲染、不引入 SSR | **精神继承，载体作废** | 「Worker 请求路径零计算」的精神被 ADR-0011 继承并推到极致：根本没有请求路径。Astro SSG 载体随 0011 拆除。 |
| 0002 内容模型（双 collection） | 废除 | 无内容模型。 |
| 0003 中文排版与字体子集 | 废除 | 字体依赖（fontsource）全删，回到系统字体栈（ADR-0014）。 |
| 0004 构建时富媒体渲染 | 废除 | 无 Markdown 渲染需求，Mermaid/KaTeX/Shiki 依赖全删。 |
| 0005 视觉基调 | **被 ADR-0014 取代** | 「浅色单主题」的约束保留，设计令牌整体重做。 |
| 0006 标签/分类前端筛选 | 废除 | 无内容即无筛选。 |
| 0007 清空模板内容 | 废除（使命已完成） | 本 ADR 是它的继任动作：这次清空的是整个博客。 |
| 0008 可选 frontmatter | 废除 | 无 frontmatter 概念。 |
| 0009 运行时内容编辑 | 废除 | D1、`/admin`、Access 保护、保存时处理管线全部退役。 |

### 拆除清单（实施时执行）

- `src/` 整目录（页面、组件、lib、layouts、styles、utils）。
- `astro.config.mjs`、`src/content.config.ts`、`markdown.config.mjs`、`remark-mermaid.mjs`。
- `migrations/`（D1 schema）、`scripts/import-content.ts`、`scripts/export-content.ts`。
- `worker-configuration.d.ts`、`wrangler.json` 中 D1 绑定与 `main` 入口。
- `package.json` 中 astro/unified/shiki/katex/mermaid/fontsource/playwright 全部依赖；仅保留 wrangler（部署工具，非构建链）。
- README、AGENTS.md 随新架构整体重写。

### 保留动作

- git 仓库历史即博客遗产的存档：拆除前先提交当前工作区（ADR-0009 的未提交改动），一切删除在历史中可回溯。
- Cloudflare 账号下的 D1 数据库是否删除由用户在控制台手动决定，代码库不再引用它。

## 后果

- `AGENTS.md` 中几乎所有架构硬规则失效，随实施重写为训练站的新规则（ADR-0011/0012/0014）。
- 仓库目录名 `cf_blog` 与新身份脱钩，是否改名（本地目录/远端仓库名）由用户另行决定，不阻塞实施。
- 读者端零 JS 规则随博客退役（训练页本质是交互应用）；其精神改写为「JS 失效时页面仍应有基本可读的骨架」（ADR-0014）。
