# ADR-0009：引入在线编辑——内容迁入 D1，运行时渲染

- 状态：已采纳（2026-11-08），**已实施（2026-11-09，见文末实施记录）**。**取代 ADR-0001 的「纯静态预渲染」核心决策**；修订 ADR-0002（内容源）、ADR-0003（标题子集方案）、ADR-0004（预渲染时机）、ADR-0008（推导层位置）
- 相关：ADR-0001（被取代）、ADR-0005（视觉基调，不变）、ADR-0006（tags/category 仅筛选，不变）、ADR-0007（无 RSS/sitemap，不重开）

## 背景

需求方要求站点支持在线编辑，明确了三个使用场景：

1. **随想快记**：手机、碎片时间把想法记进 notes，追求即写即发；
2. **跨设备写作**：不依赖本地环境，任何电脑/设备上都能写和续写 blog 长文；
3. **改站点本身**：站名、社交链接、关于页这类身份信息，不碰代码就能改。

现有链路（本地写 Markdown → push → Cloudflare 构建）三个场景一个都覆盖不了。

候选方案三选一：**Git 回写**（编辑 UI 经 GitHub API 提交，保留纯静态，发布有 1–3 分钟构建延迟）、**运行时存储**（内容进 Cloudflare D1，页面动态渲染，发布即时）、**混合**（草稿在 D1，发布落回 Git）。需求方选定**运行时存储**——把发布即时性置于架构纯度之上，明确接受推翻 ADR-0001。

写死决策前的两条平台事实核实：

- Workers 的静态资产在部署时固定，**运行时无法写文件**。「发布后重新生成静态 HTML」这条路不存在，选了运行时存储就没有中间态。
- Mermaid 渲染需要无头浏览器，Workers 运行时跑不了；标题字体子集扫的是「构建时已知的全部标题」，内容进 D1 后标题变成运行时数据。原构建期管线对新架构大面积失效，必须整体重新安置。

## 决策

### 1. 内容真源 = D1，git 退为纯代码仓库

D1（Cloudflare SQLite）是文章与随想的唯一真源。git 仓库只存博客引擎代码，`src/content/` 移除，Astro Content Collections 随之退役（ADR-0002 中「不引入数据库」的否决正式作废）。

- 已有 8 篇 Java 笔记由一次性导入脚本迁入 D1。**导入必须从文件系统 mtime 读取发布日期**（ADR-0008 以来未写日期的条目全靠它，git clone 会丢时间戳），导入完成前不得在 clone 出的副本上操作。
- 逃生舱：提供导出命令（`wrangler d1 export`），随时把内容倒回 Markdown 文件。数据安全 = D1 Time Travel（30 天时点恢复）+ 定期主动导出。
- 多设备并发编辑同一篇按「后写覆盖先写」处理，单人场景接受。

### 2. 渲染 = 运行时，Astro 保留

Astro 从 `static` 翻转为 `server` 输出（`@astrojs/cloudflare` 适配器 SSR 模式）。现有组件、样式、页面结构全部保留，改的是取数来源：页面请求时从 D1 读取并拼装 HTML，不再读构建期产物。部署方式不变：改代码仍是 push 触发构建，内容变更与部署彻底解耦。

### 3. 富媒体管线 = 保存时处理（ADR-0001 精神的存活形式）

编辑器（浏览器环境）在**保存时**完成原构建机的全部工作：

| 原构建期步骤 | 去向 |
| --- | --- |
| Mermaid → 内联 SVG | 编辑器端渲染（浏览器里有完整 mermaid.js），SVG 存入 D1 |
| KaTeX → HTML + MathML | 编辑器端渲染，HTML 存入 D1（读者仍只需 katex.css） |
| 代码块 Shiki 高亮 | 编辑器端渲染，高亮 HTML 存入 D1 |
| 字数 / 阅读时长 / 摘要推导 | 保存时算好存入 D1 |

D1 存**成品 HTML + 元数据**，Worker 请求时只做取数拼装。读者端依旧零 JS 零下载——ADR-0001「重计算不落在读者头上」的精神以「构建期 → 保存期」的形式存活。编辑器内部的渲染顺序仍要遵守 ADR-0004 实测的教训（高亮与 Mermaid 节点替换的先后次序）。

### 4. 元信息推导搬到保存时（ADR-0008 修订）

推导规则不变（标题缺省、日期缺省、摘要=首段截 120 字），执行位置从 `src/utils/posts.ts`（构建期）搬到编辑器保存逻辑。`pubDate` 缺省值由「文件创建时间」改为「首次保存时刻」。

### 5. 鉴权 = Cloudflare Access

Cloudflare Zero Trust 的 Access 在边缘拦截 `/admin/*`，邮箱 OTP 验证。零行鉴权代码，密码学由 Cloudflare 承担，未通过验证的请求不进 Worker。

### 6. 草稿机制开启

D1 内容表加 `status: draft | published`。草稿仅编辑器可见，发布一击上线。原 glossary「不支持 draft」的禁令基于「无写入型存储」前提，前提已变，禁令废除。

### 7. 站点身份迁入 D1 settings 表

站名、副标题、作者、正式域名、社交链接、关于页正文迁入 D1 settings 表，编辑器可改、即时生效。`consts.ts` 的 `SITE` 常量块退役；`NAV`（导航结构）与 `READING_SPEED` 属结构常量，留在代码。

### 8. 标题字体从「扫描式子集」改为「unicode-range 预切片」

标题来自 D1 后，`scripts/subset-heading-font.mjs` 的扫描式子集（ADR-0003）失效。改为按 `unicode-range` 分片加载：**直接采用 `@fontsource/noto-sans-sc` 的现成分片**——fontsource 对 CJK 字体本就按 unicode-range 切成上百个小 woff2 并生成对应 `@font-face` 索引，浏览器只为页面实际命中的字形下载分片（典型十几 KB）。

这一步恰好反转了 ADR-0003 当初否决 fontsource 的理由（「切成上百个分片，无法作为子集化的输入」）——新方案不再需要子集化输入，分片本身就是目标产物；同时也绕开了 ADR-0003 否决 `cn-font-split` 的理由（`koffi` 原生依赖在 Windows 的编译风险），因为无需自建切片工具链。`subset-font` 与 `@expo-google-fonts/noto-sans-sc` 两个构建期依赖随之退役。正文系统字体栈、标题/正文双层分工（ADR-0003）不变。

## 理由

- 三个场景的核心诉求都是「即时」与「跨设备」，Git 回写方案的分钟级构建延迟对随想快记是硬伤；混合方案复杂度最高且发布仍不即时。
- 运行时存储把草稿、跨设备、站点配置三个能力变成「白送」，代价是重写渲染层——而重写的量级被「保存时处理」策略压到最低：Worker 请求路径只剩取数拼装，最重的活由编辑器浏览器承担。
- 个人博客量级（免费档 10 万请求/天、D1 500 万行读/天）远未触及配额，需求方原「配额顾虑」在 SSR 下依然不成立。

## 推出的硬约束

1. 读者端零 JS 原则继续有效（TOC 高亮的 IntersectionObserver 仍是唯一例外）。
2. Worker 请求路径禁止重计算：Mermaid / KaTeX / Shiki / 字数等一律不得出现在请求时处理链路里，违者按 ADR-0004 的教训处理。
3. D1 是唯一真源，代码仓库里不得再出现内容文件；任何「把内容写回 git」的新需求需另开 ADR。
4. 编辑器渲染产出的 HTML 是受信内容（仅自己写入），但保存管线仍须保证 SVG/HTML 注入面最小化。

## 实施要点（迁移顺序）

D1 schema 与迁移脚本 → 8 篇笔记导入（读 mtime）→ Astro 翻转 server 输出 → 页面取数改造 → 编辑器（含保存时管线）→ Access 配置 → settings 表与 consts 迁移 → 字体切片改造 → 导出命令。

## 后果（诚实清单）

- Worker 从零消耗变为按请求消耗 CPU/内存；读者路径多一跳（Worker → D1）。
- 数据备份责任从「git 即备份」转移到「Time Travel + 导出纪律」。
- 本地 Obsidian 直写链路退役；导出的 Markdown 可作 Obsidian 归档输入。

## 实施记录（2026-11-09）

按迁移顺序完成：D1 schema（`migrations/0001_init.sql`，posts/notes/settings 三表）→ 8 篇 Java 笔记导入 → Astro 翻转 `output: "server"` → 六个读者页面取数改造 + 新增 404 页 → 编辑器（`/admin`：列表、文章/随想编辑、站点设置、五个 API 端点、`editor-client.ts` 保存管线）→ 字体切换（`@fontsource/noto-sans-sc` 分片）→ 导出命令。`npm run check` 全绿；dev 冒烟测试覆盖全部路由、API 增删改、设置读写。

与计划的偏差与实测教训：

1. **大内容写入**：单条 INSERT 超过 D1 的 100KB 单语句上限（成品 HTML 含 Shiki 内联样式 + SVG，单篇几百 KB，实测 `SQLITE_TOOBIG`）。改用 wrangler `getPlatformProxy` 拿本地 D1 绑定，走 `db.ts` 参数化绑定写入。
2. **hast 属性陷阱**：rehype 树的 class 在 `properties.className` 而非顶层字段，第一版 Shiki 分支因此静默不命中（`shikiFailed: 0` 却无高亮）。以最小样本探针定位后修复——探针先行应成为管线调试的默认动作。
3. **shiki v4 适配**：`codeToHtml` 返回 Promise；transformer 改为先收集节点再 for-await。长行换行由 prose.css 的 `pre-wrap` 实现（v4 移除了 wrap 选项）。
4. **日期迁移事故（诚实记录）**：导入成功后因先 `git rm` 了源文件、又误跑 `--replace`，本地库被清空且无源可导。恢复：从 git HEAD 检出 8 篇原文，从冒烟测试渲染快照取回第 1 篇的真实时间戳（2026-10-25，与文中「核查日期」互证），为 8 篇补写 `pubDate: 2026-10-25` frontmatter 后重新导入。教训已固化为脚本护栏：**源目录为空时拒绝执行 `--replace`**，且渲染收集先行、清库在后。frontmatter 化同时顺带根治了「clone 丢日期」的老问题。
5. **workerd 类型合并冲突**：`wrangler types` 生成的全局 `Element`（HTMLRewriter）与 lib.dom 合并后，`HTMLSelectElement` 的泛型约束误报 TS2344，编辑器代码用 `as unknown as` 中转断言绕开。
6. **已知限制**：`import` 脚本只支持 `--local`；远端首次灌数据走编辑器或 D1 控制台，远端批量导入是待办。
7. `import`/`export` 脚本复用 `src/lib` 的 TS 模块（Node 24 原生类型剥离），共享层零重复。
