# 架构决策记录（ADR）索引

本项目的设计决策通过四轮结构化访谈（grilling）确定，每条决策记录为一个 ADR。
术语定义见 [../glossary.md](../glossary.md)。

| 编号 | 标题 | 状态 | 一句话结论 |
| --- | --- | --- | --- |
| [ADR-0001](ADR-0001-static-prerender.md) | 保持纯静态预渲染，不引入 SSR | 已采纳 | Worker 只发静态文件，不消耗 CPU/内存配额；一切重计算放到构建期。 |
| [ADR-0002](ADR-0002-content-model.md) | 内容模型——仓库内 Markdown 双 collection | 已采纳（必填部分被 0008 修订） | `blog`（有标题长文）+ `notes`（无标题随想），不接 CMS 与数据库。 |
| [ADR-0003](ADR-0003-chinese-typography-font-subsetting.md) | 中文排版与字体子集化 | 已采纳 | 标题用思源黑体动态子集（实测 198 字→32.8KB），正文用系统字体栈。 |
| [ADR-0004](ADR-0004-build-time-rich-media.md) | 正文富媒体一律构建时预渲染 | 已采纳 | Mermaid→SVG、KaTeX→HTML 均在构建期完成；代价是构建机需装 Playwright。 |
| [ADR-0005](ADR-0005-visual-direction.md) | 视觉基调——少数派式清爽卡片，不做暗色 | 已采纳 | 蓝灰主色、单栅卡片流、高信息密度；只做浅色，设计令牌单值。 |
| [ADR-0006](ADR-0006-tags-category-client-filter.md) | tags 与 category 仅用于列表页前端筛选 | 已采纳 | 不建聚合路由；筛选状态写入 URL 参数以便分享。 |
| [ADR-0007](ADR-0007-template-cleanup-site-config.md) | 清空模板内容，删除 RSS 与 sitemap | 已采纳 | 示例文/占位图/Atkinson 全删；站点身份集中在 `src/consts.ts` 顶部占位。 |
| [ADR-0008](ADR-0008-optional-frontmatter.md) | frontmatter 全可选，元信息构建期推导 | 已采纳 | 标题=文件名、日期=文件创建时间、摘要=正文首段；必填类型由 resolve 层保证。 |

## 已识别的风险与待办

- **ADR-0006 的分页边界**：前端筛选只能作用于已加载的文章。若文章数增长到需要分页，该决策必须重新评估。
- **ADR-0007 的域名占位**：`SITE.url` 为 `https://example.com`，canonical 与 OpenGraph 在填入正式域名前不生效。
- **ADR-0003 的子集新鲜度**：新增文章若引入子集外汉字，必须重新构建才能正确显示；`prebuild` 钩子已覆盖正常流程。
- **Astro 管线的顺序陷阱**：Shiki 高亮跑在用户 `rehypePlugins` 之前。任何依赖 `code.language-xxx` 选择器的 rehype 插件在本项目都会静默失效。新增 Markdown 插件时，若它要识别代码块，必须放在 remark 阶段（见 ADR-0004 的实测记录）。
- **`[hidden]` 与 display 覆盖**：`.post-card`、`.chip` 等设置了 `display` 的类会盖掉 UA 的 `[hidden]{display:none}`。新增用 `hidden` 控制显隐的元素时，必须补一条 `[hidden]{display:none}`。
