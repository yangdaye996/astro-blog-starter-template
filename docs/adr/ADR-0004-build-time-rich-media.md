# ADR-0004：正文富媒体一律构建时预渲染

- 状态：已采纳（2026-11-08），2026-11-08 修订：Mermaid 实现由 rehype 插件改为 remark 插件
- 相关：ADR-0001（纯静态，构建期算完一切）、ADR-0003（中文字体）

## 背景

需求方要求文章正文支持四项能力：代码高亮 + 复制按钮、Mermaid 图表、KaTeX 数学公式、文章目录 TOC。

Mermaid 与 KaTeX 都有两条实现路径，代价相差一个数量级：

- **构建时预渲染**：图表变成内联 SVG，公式变成 HTML + CSS，读者端零 JS。
- **客户端按需加载**：构建零负担，但读者首次看到图表要下载 1MB+ 的运行时。

需求方选定"全部构建时预渲染"。在写死这个决策前，对其真实工具链代价做了核实。

## 决策

### Mermaid：自写 remark 插件，直接调用 mermaid-isomorphic

`remark-mermaid.mjs` 在 **remark 阶段**（mdast）把 `lang === "mermaid"` 的 code 节点渲染成内联 SVG，替换为 `html` 节点。

**为什么必须在 remark 阶段（实测结论，非推测）**：
向 Astro 的 `rehypePlugins` 注入探针插件后观察到，用户 rehype 插件运行时，围栏代码块的 `pre` 节点**已经带有** `class` / `style` / `tabindex` / `dataLanguage` 属性，内层 `code` 节点**没有任何 className**。即 Astro 的 Shiki 高亮跑在用户 rehypePlugins **之前**。

这直接判死了 `rehype-mermaid`：它依赖 `code.language-mermaid` 选择器，在 Astro 管线里永远匹配不到，图表会被**静默跳过**——构建不报错、不耗时，产物里留下一个高亮过的 mermaid 源码代码块。首次构建即复现：文章页 prerender 仅 4ms（Chromium 根本未启动），产物中 `data-language="mermaid"` 的 `<pre>` 原样保留。

改用 remark 阶段后验证通过：产物体积 20,208 → 39,642 字节，`language-mermaid` 的 `<pre>` 消失，内联 SVG 含中文节点标签。

实现细节：

- 直接依赖 `mermaid-isomorphic`（`createMermaidRenderer`），不经过任何上层封装包。它自行管理浏览器实例：多图并发复用、空闲自动关闭，因此整个构建只启动一次 Chromium。
- 不引入 `unist-util-visit`：它在本项目里只是间接依赖，手写 12 行 mdast 遍历消除上游依赖树变动导致的无声断裂。
- `mermaidConfig.fontFamily` 设为站点的中文字体栈。内联 SVG 的文字最终由**读者的浏览器**渲染，用 mermaid 默认的 `arial,sans-serif` 会让图中中文掉到难看的回退字形。
- `securityLevel: "strict"`，对节点标签转义，防止图表源码里的 HTML 注入页面。
- **图表语法错误不中断构建**：该图退化为普通代码块（作者在页面上直接看到源码），构建日志打印可定位的错误。宁可显眼地退化，也不要静默丢图。

### KaTeX

`remark-math` + `rehype-katex`。KaTeX 本身在构建期渲染（输出 HTML + MathML），读者端零 JS。

**样式加载范围的修订**：本 ADR 初稿声称"仅在确实含公式的页面引入样式"。实现时确认这在该架构下做不到：`[...slug].astro` 是单一静态路由，所有文章共用同一个页面模块，Vite 在构建期把该模块图里的 CSS 全部打进这一个路由的产物，无法按单篇文章裁剪。因此 `katex.min.css` 在 `BlogPost.astro` 布局中**无条件引入**，作用于全部文章页（约 23KB 原始 / 7KB gzip），但不影响首页、列表页、归档页、随想页与关于页。KaTeX 的字体文件会随产物上传，但浏览器只在页面确实含公式字形时才请求它们。

### 代码高亮

Astro 内置 Shiki，不引入额外依赖，构建期生成带内联样式的 HTML。主题 `github-light`，与 ADR-0005 的浅色基调一致。

复制按钮由客户端注入：Shiki 产物是 `<pre><code>`，无法用 Astro 组件包裹，按钮只做"把已在 DOM 里的文本写入剪贴板"，不参与渲染，不违背构建时预渲染原则。无脚本环境下代码照常可读，只是没有按钮。

### TOC

构建期从 `render(post).headings` 提取 h2/h3 生成目录数据，渲染为静态 HTML。滚动高亮由客户端基于滚动位置实现（而非 IntersectionObserver——后者在长小节与快速滚动下容易出现没有任何标题处于相交态、高亮整体消失）。宽屏为右侧粘性栏，窄屏退化为正文上方的静态框。

## 理由

- 与 ADR-0001 一致：读者端拿到的就是最终 HTML，没有"等 JS 加载完才出现图表"的闪烁与布局抖动。
- 内联 SVG 可被站点 CSS 直接着色与缩放，能跟随浅色设计系统；客户端渲染的 Mermaid 常带自己的样式，难以融入。
- 无脚本环境下（阅读器、爬虫、禁用脚本）图表与公式依然完整可读。

## 代价

- 构建机需安装 Playwright + Chromium（约 150MB），`npm install` 明显变重。
- **该代价只落在开发机**：Playwright 与 mermaid-isomorphic 均为构建期依赖，不进入 `dist/`，不上传到 Worker，对 ADR-0001 关心的 Worker CPU / 内存 / 存储配额零影响。`wrangler deploy --dry-run` 已确认产物绑定仅 `env.ASSETS`。
- Mermaid 渲染在构建期启动浏览器实例，文章数量多时构建时间线性增长（浏览器实例复用，但每张图仍需一次页面求值）。
- 图表语法错误在构建期暴露。本项目选择"退化为代码块 + 日志报错"而非构建失败。
- 内联 SVG 增大 HTML 体积；验证文章含一张 7 节点流程图，单页产物约 39KB。
- KaTeX CSS 无条件进入全部文章页（见上文修订）。

## 备选方案

| 方案 | 否决理由 |
| --- | --- |
| `rehype-mermaid` | 在 Astro 管线里永远匹配不到节点，图表被静默跳过。有实测证据，见上。 |
| `remark-mermaidjs` | 功能等价且能工作，但 npm 已标记 deprecated（"Use rehype-mermaid instead"），而该建议在本项目里恰好是错的。与其依赖一个被上游放弃的包，不如直接调用它底层的 `mermaid-isomorphic`。 |
| 客户端按需加载 Mermaid | 构建零负担，但读者要下载 1MB+ 运行时，且无脚本环境不可读、样式难融入设计系统。需求方在知悉 Playwright 代价后仍选择构建时预渲染。 |
| 复用本机已装 Chrome（Playwright `channel: 'chrome'`） | 可省掉 Chromium 下载，但依赖开发机恰好装了特定版本 Chrome，破坏"clone 即可构建"的可重现性。仅作本地加速手段，不写进项目默认配置。 |
| 暂不做 Mermaid | 需求方的教程内容大量依赖图表，砍掉会直接影响写作能力。 |
| 按文章条件加载 KaTeX CSS | 单一静态路由下 Vite 无法按篇裁剪 CSS，架构上不可行。 |
