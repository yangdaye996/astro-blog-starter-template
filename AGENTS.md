# AGENTS.md

中文认知训练站：心算、N-back、舒尔特方格、斯特鲁普、序列记忆、冥想六模块 + 统计页。**纯静态、无构建**（ADR-0010/0011）：浏览器加载的就是仓库文件，无 SSR、无数据库、无账号，训练记录存浏览器 localStorage（ADR-0012）。代码注释与文档一律用中文，与现有风格一致。

## 命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 本地静态服务器（serve，端口 4321）。ES modules 不能 `file://` 直开，必须走 HTTP |
| `npm run check` | **验证命令**：全部站点 JS 语法检查（`scripts/check.mjs`，node --check），改完代码跑这个 |
| `npm run build` | **空壳**：复用 check。纯静态站没有真实构建步骤，它存在只为满足工具契约（Cloudflare 部署管线的构建命令），本地不产生任何产物 |
| `npm run deploy` | **空壳**：`npx --yes wrangler deploy`（`--yes` 让 CI 环境非交互装包）。本地无 wrangler，此命令仅在 Cloudflare 构建机可用 |
| `git push` | **部署**：push 到 main 同时触发两条管线——Cloudflare Workers Builds（构建机执行 `npx wrangler deploy`，本地无 wrangler）+ Vercel 镜像部署（构建机执行 `vercel.json#buildCommand`） |

## Vercel 镜像部署（第二平台）

同一份 push 到 main 也会在 Vercel 构建机上跑 `vercel.json#buildCommand`：先 `npm run build`（语法检查），再 `scripts/vercel-build.mjs` 把站点文件**原样复制**进 `public/`（Vercel 对无框架静态站要求产物集中在单一输出目录；只复制不转换，不违背 ADR-0011）。排除清单唯一源仍是 `.assetsignore`。`public/` 是部署期产物，已进 `.gitignore`。Vercel 静态部署会自动把产物根下的 `404.html` 用作 404 页，与 Cloudflare 的 `not_found_handling` 等效。

没有构建、没有 tsc、没有测试框架。验证 = `npm run check` + 本地人工过一遍相关页面全流程。

## 架构硬规则（依据 docs/adr/，改架构前先读）

- **纯静态无构建（ADR-0011）**：零构建步骤、零运行时第三方依赖。不引入框架、打包器、图表库、字体包。新需求先想「原生能不能做」，做不了先开 ADR。
- **localStorage 唯一真源（ADR-0012）**：训练记录只存 localStorage 的 `mindgym:v1:sessions`。key 里的 `v1` 是数据版本——改字段结构必须新开 `v2` 并写迁移函数，禁止原地改语义。写入时机唯一：会话结束/明确放弃时一次性写入。
- **统计现算不落盘**：streak、趋势、汇总都是日志的纯函数（`assets/js/stats.js`），禁止缓存派生数据。
- **会话 schema**：六模块的 params/result 字段以 ADR-0013（原三模块）+ ADR-0015（新三模块）为准。加字段 = 升 schema 版本，不是随手加；只追加 module 枚举值（字段结构不变）沿用 v1，不写迁移。
- **模块注册表**：六模块展示元数据与成绩口径唯一源 = `assets/js/modules.js`，首页/统计页/个人最佳都从这里取，新增模块先登记。共享界面件在 `assets/js/ui.js`（分段选择器/静音开关/今日光谱点/时间格式化）。
- **N-back 目标必须构造**：一轮 ≥ 6 个目标是生成器保证的，不许改成纯随机（`assets/js/nback/game.js` 注释写明策略）。斯特鲁普一轮 15 一致 + 15 冲突同理须构造（`assets/js/stroop/game.js`）。
- **浅色单主题（ADR-0016，继承 0014）**：设计令牌唯一源 = `assets/css/base.css` 的 `:root`，每个令牌一组值。六模块各占一支饱和色（`--m-*`），`.mod-*` 类换色。模块专属样式写在各页 `<style>`，跨页复用的组件进 base.css。
- **JS 可用性分层（ADR-0014）**：首页/统计页 JS 失效仍须有骨架（链接可点、空状态可见）；训练六页无 JS 显示 `.js-warn` 提示，属预期。
- **明确不做**：暗色模式、账号/登录、服务端存储、导入功能、双 n-back、自适应难度、多呼吸节奏。均未立项，别顺手加；要加先改对应 ADR。

## 已知陷阱（踩过的坑）

- **`file://` 打不开**：ES modules 被 CORS 拦截。控制台报 module 加载错误先查访问方式，不是代码问题。
- **`[hidden]` 与 display 覆盖**：凡设置了 `display` 的类，用 `hidden` 控显隐时必须有 `[hidden]{display:none}` 兜底（base.css 文末有全局 `!important` 兜底条）。
- **空格键**：N-back 页空格 = 匹配，`keydown` 必须先 `preventDefault()`，否则页面跟着滚。
- **无类型检查**：JS 裸奔无编译器兜底。纪律：每 JS 文件职责单一（store/stats/audio/modules/ui/各页逻辑）；改共享文件（store.js/stats.js/modules.js/ui.js）时，六个模块页 + 首页 + 统计页都要人工过一遍。
- **声音偏好 key**：`mindgym:v1:sound` 是界面偏好（on/off），独立于会话日志，不是训练数据，不受 v1 数据版本约束。静音开关在顶栏，全站共用（`ui.js#initSoundToggle`）。

## 内容与约定

- 术语以 `docs/glossary.md` 为准：训练站 / 模块 / 会话 / 会话日志 / 打卡 / 难度档 / n 值 / 命中·漏报·误报 / 准确率 / 阶数 / 干扰效应 / 记忆广度 / 呼吸引导 / 钟声 / 模块色 / 静音开关。
- **每个列表类区块必须有空状态设计**（无数据给引导文案，不给空白）。
- 记录备份：stats 页导出 JSON 是唯一备份手段，README 明示；导入（恢复）未立项。
- 页面结构：`/math/`、`/nback/`、`/schulte/`、`/stroop/`、`/span/`、`/meditation/`、`/stats/` 各自 index.html。导航**八链接**（首页 + 六模块 + 统计）写死在各页 HTML，移动端横向滚动——无构建无组件复用，靠约定保持一致，新增页面记得同步全部页面。
- 部署排除清单在根目录 `.assetsignore`（docs、node_modules、package、scripts 等不进站点）；**Cloudflare 与 Vercel 两条管线共用它**——新增站点文件两平台自动带上，新增非站点文件记得同步进去。

## 故障排查

- **部署日志「Read N files」虚高是正常现象**：构建日志里那是 `.assetsignore` 过滤**前**的原始目录遍历计数（node_modules 一起计入），真实上传约 39 个站点文件。部署失败先看构建日志 deploy 阶段的真实报错。
- **Vercel 部署报 `STATIC_BUILD_NO_OUT_DIR`**：说明 `public/` 没生成——`vercel.json` 丢了，或 buildCommand 没跑到 `scripts/vercel-build.mjs`。Vercel 不认 `.assetsignore` 这个文件名，是靠复制脚本读它来实现同一份排除逻辑的。
- **本地没有 wrangler，也不需要**：部署由 Cloudflare 构建机执行 `npx wrangler deploy`；预览一律 `npm run dev`（serve）。别在本地装回 wrangler 跑 dev——assets 目录 = 仓库根会连自身状态一起监视，陷入 reload 死循环。
- 数据没变：先确认看的是同一台浏览器的同一个 profile（localStorage 不跨浏览器、不跨设备）。
- 记录消失：大概率清过站点数据，无备份即无解（ADR-0012 风险条目）；有 JSON 备份可手动写回。
- 404 页不生效：`wrangler.json` 的 `not_found_handling: "404-page"` 依赖根目录 `404.html`。
- 钟声不响：浏览器要求用户手势后才能出声（AudioContext 解锁），训练流程都是点击触发的，属正常；别在页面加载时就调用。

## 改动前必读

- 改玩法/难度/成绩口径：`docs/adr/ADR-0013-module-specs.md`（原三模块）+ `docs/adr/ADR-0015-new-modules.md`（新三模块），规格唯一真源。
- 改存储/统计：`docs/adr/ADR-0012-localstorage-storage.md`。
- 改视觉：`assets/css/base.css` 令牌与 `docs/adr/ADR-0016-spectrum-redesign.md`。
- 加模块：先在 `assets/js/modules.js` 登记，再建页面目录，同步八链接导航，规格写进 ADR-0015。
- 部署：根目录 `README.md`。
