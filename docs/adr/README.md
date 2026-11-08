# 架构决策记录（ADR）索引

本项目的设计决策通过结构化访谈（grilling）确定，每条决策记录为一个 ADR。
术语定义见 [../glossary.md](../glossary.md)。

**2026-11-09 项目换血（ADR-0010）**：博客退役，转型认知训练站（心算 / N-back / 冥想）。0001–0009 为博客时代的决策，除 0005 的「浅色单主题」精神外全部废除或被取代，保留仅为历史存档。

| 编号 | 标题 | 状态 | 一句话结论 |
| --- | --- | --- | --- |
| [ADR-0010](ADR-0010-pivot-to-cognitive-training.md) | 项目换血——博客退役，转型认知训练站 | 已采纳 | 纯前端静态站、零登录、博客遗产全拆、三模块 MVP 一步到位；含旧 ADR 逐条处置映射与拆除清单。 |
| [ADR-0011](ADR-0011-no-build-vanilla-static.md) | 纯手写无构建——源码即产物 | 已采纳 | 删 Astro/npm 构建链，原生 ES modules 手写；目录即路由；assets-only Worker 部署；零运行时第三方依赖。 |
| [ADR-0012](ADR-0012-localstorage-storage.md) | 训练记录存 localStorage | 已采纳 | 追加式会话日志为唯一真源，统计现算不落盘，导出 JSON 是唯一备份，多设备不同步。 |
| [ADR-0013](ADR-0013-module-specs.md) | 三模块 MVP 规格 | 已采纳（玩法细节为默认值，可推翻） | 心算三档限时冲刺键入作答；N-back 单位置 n=2 默认；冥想计时器+可选呼吸引导+合成钟声；统计页含打卡与趋势。 |
| [ADR-0014](ADR-0014-visual-redesign.md) | 视觉重设计——训练台 | 已采纳（浅色保留为默认值） | 令牌重做、大数字优先、零字体/图形库依赖；保留浅色单主题；「读者端零 JS」改写为「首页/统计页 JS 失效仍有骨架」。 |

---

## 博客时代存档（0001–0009，已随 ADR-0010 退役）

| 编号 | 标题 | 状态 | 一句话结论 |
| --- | --- | --- | --- |
| [ADR-0001](ADR-0001-static-prerender.md) | 保持纯静态预渲染，不引入 SSR | 已被 0011 取代 | Worker 只发静态文件，不消耗 CPU/内存配额；一切重计算放到构建期。 |
| [ADR-0002](ADR-0002-content-model.md) | 内容模型——仓库内 Markdown 双 collection | 已被 0010 废除 | `blog`（有标题长文）+ `notes`（无标题随想），不接 CMS 与数据库。 |
| [ADR-0003](ADR-0003-chinese-typography-font-subsetting.md) | 中文排版与字体子集化 | 已被 0010 废除 | 标题用思源黑体动态子集，正文用系统字体栈。 |
| [ADR-0004](ADR-0004-build-time-rich-media.md) | 正文富媒体一律构建时预渲染 | 已被 0010 废除 | Mermaid→SVG、KaTeX→HTML 均在构建期完成。 |
| [ADR-0005](ADR-0005-visual-direction.md) | 视觉基调——少数派式清爽卡片，不做暗色 | 精神被 0014 继承 | 蓝灰主色、单栅卡片流；只做浅色，设计令牌单值。 |
| [ADR-0006](ADR-0006-tags-category-client-filter.md) | tags 与 category 仅用于列表页前端筛选 | 已被 0010 废除 | 不建聚合路由；筛选状态写入 URL 参数以便分享。 |
| [ADR-0007](ADR-0007-template-cleanup-site-config.md) | 清空模板内容，删除 RSS 与 sitemap | 使命完成（继任动作 = 0010） | 示例文/占位图/Atkinson 全删。 |
| [ADR-0008](ADR-0008-optional-frontmatter.md) | frontmatter 全可选，元信息构建期推导 | 已被 0010 废除 | 标题=文件名、日期=文件创建时间、摘要=正文首段。 |
| [ADR-0009](ADR-0009-runtime-content-editing.md) | 引入在线编辑——内容迁入 D1，运行时渲染 | 已被 0010 废除 | D1 是内容唯一真源；重计算迁至编辑器保存时。 |

## 已识别的风险与待办

- **localStorage 备份纪律（ADR-0012）**：记录唯一真源在浏览器，清站点数据 = 全丢。stats 页导出按钮是唯一备份手段，README 必须明示；导入（恢复）功能未做，出现真实需求另开 ADR。
- **无类型检查（ADR-0011）**：JS 裸奔无编译器兜底。纪律：每 JS 文件职责单一（store / stats / audio / 各页逻辑），复杂逻辑集中处写清注释；上线前人工过一遍三模块全流程。
- **`file://` 陷阱（ADR-0011）**：ES modules 经 `file://` 被浏览器 CORS 拦截，本地必须起静态服务器。页面控制台报 module MIME 错误时先查访问方式。
- **N-back 目标构造（ADR-0013）**：一轮 ≥ 6 个目标需构造而非纯随机，实现时注释写清策略；这是三模块唯一的非平凡算法点。
- **[hidden] 与 display 覆盖（ADR-0014，继承旧教训）**：新组件体系凡设置了 `display` 的类，用 `hidden` 控显隐时必须补 `[hidden]{display:none}`。
- **「玩法细节为默认值」（ADR-0013）**：访谈第三轮起用户未逐项确认模块规格，均按推荐项落定。用户推翻任何一项 = 直接改 ADR-0013 + 对应页面，无需新 ADR（未实施前的推翻不构成架构变更）。
- **旧 Cloudflare 资产清理（ADR-0010）**：账号下现存 D1 数据库与旧 Worker 不被代码引用后，是否删除由用户在控制台手动处理；代码库不依赖其存在。
