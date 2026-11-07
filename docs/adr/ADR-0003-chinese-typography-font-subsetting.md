# ADR-0003：中文排版与字体子集化

- 状态：已采纳（2026-11-08）
- 相关：ADR-0001（构建期算完一切）、ADR-0005（视觉基调）

## 背景

中文字体是中文博客最大的性能坑。一套完整的中文字体包含两万余字，即使压成 woff2 也常在 1–3MB 量级，直接毁掉首屏。模板自带的 Atkinson Hyperlegible 是拉丁字体，对中文完全无效，中文字符会直接回退到系统字体。

需求方选定方向为"标题子集化 + 正文系统字体"，但该答案留下一个关键歧义：**站名与导航是固定 UI 文案，文章标题却是动态内容**。若子集要覆盖文章标题，就必须有一个扫描全站标题、按需生成子集的构建步骤。需求方已明确选择覆盖所有标题。

字体源要求可商用授权且能实际下载到原始文件。

## 决策

### 字体分工

| 用途 | 字体 | 加载方式 |
| --- | --- | --- |
| 站名、导航、栏目标题、文章标题、随想日期等**标题层** | 思源黑体 Bold（Noto Sans SC 700）子集 | 单个 woff2，`@font-face` + `font-display: swap` |
| 正文、卡片描述、元信息 | 中文系统字体栈 | 零下载 |

正文系统字体栈（按平台优先级）：

```css
font-family:
  -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB",
  "Source Han Sans SC", "Noto Sans CJK SC", "Microsoft YaHei", "微软雅黑",
  system-ui, sans-serif;
```

### 字体源

使用 npm 包 `@expo-google-fonts/noto-sans-sc`（已核实 v0.4.4，含 9 个字重的完整 TTF，路径规整为 `<weight>/NotoSansSC_<weight><Style>.ttf`）。

选它而非其他源的理由：

- Noto Sans SC 就是思源黑体（Source Han Sans SC）的 Google 发行版，同一套字形，同为 **SIL Open Font License**，可商用可修改。
- 走 npm registry 安装，比从 GitHub Release 下载 zip 更稳定可重现。已核实猜测式的 GitHub Release 直链会 404。
- fontsource 系（`@fontsource/noto-sans-sc`、`@fontsource-variable/noto-sans-sc`）把字体切成了上百个 `unicode-range` 分片，**无法作为子集化的输入**——动态子集需要一个完整的单文件。

只取 `700Bold` 一个字重（10.5MB TTF）作为子集输入。源 TTF 不入库，写入 `.gitignore`，由脚本按需获取。

### 子集化工具

使用 `subset-font`（基于 `harfbuzzjs` 的 wasm 构建），**不使用 `cn-font-split`**。

已核实的关键差异：`cn-font-split` 依赖 `koffi`（原生 FFI 绑定），在本项目的 Windows 环境下有原生编译/二进制匹配失败的风险；`subset-font` 依赖 `harfbuzzjs` + `fontverter`，纯 wasm，无原生编译步骤。

### 构建脚本

新增 `scripts/subset-heading-font.mjs`：

1. 扫描字符来源：`consts.ts` 中的站名/副标题/导航文案、`src/content/blog/**` 全部 `title`、`src/content/notes/**` 的日期与标签文案。
2. 去重后交给 `subset-font`，以 `targetFormat: 'woff2'` 生成 `public/fonts/heading-subset.woff2`。
3. 挂到 `package.json` 的 `prebuild` / `predev`，确保字体在 Astro 构建拷贝 `public/` 之前已生成。

### 实测数据

在本机对 10.5MB 的 `NotoSansSC_700Bold.ttf` 做了验证，输入 198 个去重汉字（模拟站名 + 导航 + 20 篇文章标题的字符集）：

| 指标 | 结果 |
| --- | --- |
| 输出 woff2 体积 | **33,608 字节（32.8KB）** |
| 子集化耗时 | **237ms** |

结论：即使文章数量增长到数百篇，标题字符去重后的规模也在千余字量级，子集体积预计维持在几十 KB，构建耗时增加不足一秒。方案成立。

## 理由

- 32.8KB 的代价换来标题层的统一字形与"少数派式"的现代观感，性价比极高。
- 正文走系统字体栈，既避免 MB 级下载，又让正文在 iOS/macOS（苹方）、Windows（微软雅黑）、Android（思源）上都是该平台最自然的阅读字形。
- 动态子集而非静态子集，是因为文章标题是内容的一部分；只做 UI 文案子集会让"文章标题用自定义字体"这个视觉意图落空。

## 代价

- 构建链路多一个前置步骤，且多一个 npm 依赖与一个需 gitignore 的 10.5MB 源字体。
- **新增文章若引入了子集外的汉字，在重新构建之前该字会回退到系统字体**。因为是 `prebuild` 步骤，正常部署流程不会暴露这个问题，但直接手改 `dist/` 或跳过 prebuild 会。
- 标题字重被锁定为 700，无法用可变字重做细腻的层级区分。

## 备选方案

| 方案 | 否决理由 |
| --- | --- |
| 纯系统字体栈（标题也不自定义） | 零成本，但放弃标题层的品牌感；需求方明确选了子集化。 |
| 全站自定义可变字体 | 中文可变字体即便压缩也常达 1–3MB，首屏不可接受。 |
| 静态子集（只覆盖固定 UI 文案） | 体积可降到几 KB，但文章标题会回退系统字体，视觉意图落空。 |
| `cn-font-split` | 功能更强（多线程、细颗粒分包），但 `koffi` 原生依赖在 Windows 上是风险源，本项目规模用不到它的性能优势。 |
| 霞鹜文楷 / 阿里巴巴普惠体 | 授权同样可用，但霞鹜文楷的手写感与"少数派式清爽"基调冲突；需求方已选定思源黑体。 |
