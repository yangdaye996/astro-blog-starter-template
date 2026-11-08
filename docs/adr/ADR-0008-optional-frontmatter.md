# ADR-0008：frontmatter 全可选，元信息构建期推导

- 状态：已采纳（2026-11-08）；**2026-11-08 被 ADR-0009 修订**：推导层从构建期（`src/utils/posts.ts`）迁至编辑器保存时，推导规则本身不变；`pubDate` 缺省值由「文件创建时间」改为「首次保存时刻」
- 相关：ADR-0002（内容模型，本条修订其 frontmatter 必填部分）、ADR-0003（字体子集）

## 背景

ADR-0002 将 `title` / `description` / `pubDate`（随想 `date`）定为必填，并以「title 必填保证长文侧类型安全」作为双 collection 的理由之一。需求方日常在 Obsidian 写作，文件名即标题，逐篇补 frontmatter 是纯摩擦，明确要求去掉格式限制：纯 Markdown 文件丢进目录即可发布。

## 决策

schema 层全部字段改为可选；查询后统一经过推导层（`src/utils/posts.ts` 的 `resolvePost` / `resolveNote`）补齐缺省值：

| 字段 | 缺省取值 | 优先 |
| --- | --- | --- |
| `title` | 文件名（去后缀，非 slug 化后的 id） | frontmatter `title` |
| `pubDate` / `date` | 文件创建时间（birthtime，文件系统不支持时退 mtime） | frontmatter 对应字段 |
| `description` | 正文第一个非空段落，剥离代码/公式/标记后截 120 字 | frontmatter `description` |

类型安全不下沉到 schema，而由推导层的返回类型 `ResolvedPost` / `ResolvedNote` 保证（data 交集类型中三字段必填）；所有页面与组件只接受 Resolved 类型。字体子集脚本同步把 blog 文件名纳入标题扫描（ADR-0003 的覆盖范围不变）。

## 理由

- 写作零格式，与 Obsidian「文件名即标题」的习惯一致，链路最短。
- ADR-0002 担心的「title 可选污染类型」由推导层化解：消费方拿到的类型里 title 依然必填，只是保证点从 schema 移到 resolve。
- 推导只发生在构建期，与 ADR-0001 一致，读者端零 JS。

## 代价

- 日期依赖文件系统时间戳，git 不保留它：重新 clone 后未写日期的条目会变成 clone 时间。在意精确日期的条目需写 frontmatter。
- 文件名即标题兼 slug：改名同时改标题与 URL，旧链接失效。
- 自动摘要是首段截断，不如手写精准；封面、分类、标签仍只能写 frontmatter。

## 备选方案

| 方案 | 否决理由 |
| --- | --- |
| 文件名日期前缀（`2026-11-08-标题.md`） | 仍是一种格式纪律，违背「零格式要求」。 |
| 正文首个 h1 当标题 | Obsidian 笔记通常不写 h1（文件名即标题）；且与页面自动渲染的 h1 重复。 |
| 保持必填 + 脚本自动生成 frontmatter | 把格式负担转嫁给脚本与模板，写作端仍要理解字段；不如直接推导。 |