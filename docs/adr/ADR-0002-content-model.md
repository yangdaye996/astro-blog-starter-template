# ADR-0002：内容模型——仓库内 Markdown 双 collection

- 状态：已采纳（2026-11-08）；frontmatter 必填部分被 ADR-0008 修订（2026-11-08）
- 相关：ADR-0001（纯静态）、ADR-0006（tags/category 仅作筛选）

## 背景

模板使用 Astro Content Collections，`src/content.config.ts` 里只有一个 `blog` collection，用 `glob` loader 读取 `src/content/blog/**/*.{md,mdx}`，schema 为 `title` / `description` / `pubDate` / `updatedDate?` / `heroImage?`。

需求方日常在 Obsidian 中写作。候选内容源有四种：仓库内 Markdown、Obsidian 库直连、Notion API、D1 + 自建后台。

## 决策

内容源为**仓库内的 Markdown 文件**，不接任何外部 CMS，不引入数据库。

collection 拆成两个：

### `blog`（技术长文）

在模板 schema 基础上新增两个字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `title` | `string` | 必填。参与标题字体子集扫描（ADR-0003）。 |
| `description` | `string` | 必填。卡片副文案与 SEO description。 |
| `pubDate` | `coerce.date` | 必填。排序与归档分组依据。 |
| `updatedDate` | `coerce.date` | 可选。显示为"最后更新"。 |
| `heroImage` | `string` | 可选。卡片与文章页封面图。 |
| `tags` | `string[]` | **新增**。默认 `[]`。仅用于列表页前端筛选。 |
| `category` | `string` | **新增**。可选。仅用于列表页前端筛选。 |

### `notes`（随想碎碎念）

**无标题**的时间轴条目，字段刻意最小化：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `date` | `coerce.date` | 必填。时间轴排序依据。 |
| `tags` | `string[]` | 可选，默认 `[]`。 |

正文即内容，不要求 `title` 与 `description`。渲染为 `/notes` 页上的竖向时间轴，不生成独立详情页路由。

## 理由

- 仓库内 Markdown 无需密钥、无限流、无构建期网络请求，与 ADR-0001 的"构建期算完一切"最契合。
- Obsidian 产出的就是 Markdown + frontmatter，拷进 `src/content/blog/` 即可，链路最短。
- 拆两个 collection 而非给 `blog` 加 `type` 字段，是因为随想**没有标题**，强行共用 schema 会让 `title` 变成可选，从而污染长文侧的类型安全（列表卡片、字体子集扫描、上一篇/下一篇都依赖 `title` 必填）。

## 代价

- 发文需要 git commit + push 触发部署，无法在手机或网页上直接写。
- 随想没有独立 URL，无法被单独分享或评论；这是"无标题时间轴"形态的固有结果。
- 两个 collection 意味着两套查询与两套卡片样式，比单 collection 多一层维护成本。

## 备选方案

| 方案 | 否决理由 |
| --- | --- |
| Obsidian 库直连 | 需要额外同步脚本与 frontmatter 映射规则，把"写作工具"和"发布系统"耦死；手工拷贝已足够。 |
| Notion 作为内容源 | 引入 API 密钥、限流与构建期网络请求，构建变得不可重现，违背 ADR-0001 的确定性要求。 |
| D1 + 自建后台 | 需要鉴权与 schema 迁移，且推翻 ADR-0001。 |
| 单 collection + `type` 判别 | 迫使 `title` 变为可选，削弱长文侧类型安全。 |
