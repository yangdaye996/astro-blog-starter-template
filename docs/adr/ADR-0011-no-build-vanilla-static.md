# ADR-0011：纯手写无构建——源码即产物

- 状态：已采纳（2026-11-09，用户确认）
- 相关：ADR-0010（换血总纲）、ADR-0012（存储）、ADR-0014（视觉）

## 背景

三模块都是重客户端交互（游戏循环、刺激序列、呼吸动画），SSR 在请求路径上帮不上忙；项目也只剩三个页面 + 一个统计页，没有内容模型。在「Astro 降级为静态输出」「Astro + 轻量框架」「纯手写无构建」三个选项中，用户选择**纯手写，无构建**：告别 npm 构建链，全部手写 HTML/CSS/JS。

## 决策

### 工具链

- **零构建步骤**：没有编译、打包、转换。浏览器加载的就是仓库里的文件。
- **零运行时第三方依赖**：不引入任何前端框架、图表库、音频库。趋势曲线用原生 SVG 手绘，钟声用 Web Audio API 合成，动画用 CSS。
- TypeScript 出局（无编译器即无 TS）。脚本全部为原生 JavaScript，ES modules（`<script type="module">`）。
- `package.json` 保留壳：仅 wrangler 一个 devDependency（部署工具，不是构建链），加 `deploy` 脚本。

### 目录即路由

```
/                 index.html        首页：三模块入口 + 今日状态
/math/            index.html        心算
/nback/           index.html        N-back
/meditation/      index.html        冥想
/stats/           index.html        统计：日志、趋势、打卡、导出
/assets/css/      共享样式与各页样式
/assets/js/       共享模块（store、stats、audio）与各页逻辑
```

静态托管自动把 `/math/` 解析到 `/math/index.html`，无需路由器。

### 本地开发

原生 ES modules 在 `file://` 下被 CORS 拦截，必须经 HTTP 访问：

- `npx serve .` 或 `python -m http.server`（任选其一，写进 README）。
- 不再存在 `npm run check`。验证手段 = 打开页面人工过一遍 + 部署前 `wrangler deploy --dry-run`。

### 部署

Cloudflare **assets-only Worker**：`wrangler.json` 删除 `main` 与 D1 绑定，只留 `assets.directory` 指向仓库根，用 `.assetsignore` 排除 `node_modules`、`.wrangler`、`docs`、`scripts`、Markdown 文件等非站点产物。免费额度内运行，无 CPU 消耗。

## 后果

- **无类型检查**：JS 裸奔，靠小模块、命名约定和浏览器控制台兜底。重构蓝图要求每个 JS 文件职责单一（store / stats / audio / 各页 game），控制单文件复杂度。
- **无组件复用机制**：跨页面共享的只有 CSS 令牌与 `assets/js/` 下的共享 JS；HTML 结构靠约定保持一致（导航、卡片结构写死在各页）。
- **新增功能成本反转**：过去加功能先想依赖，现在先想「原生能不能做」。原生做不了的（如复杂图表交互），要么降级需求要么重新开 ADR 引入依赖。

## 修订（2026-11-09，同日）

本地卸除 wrangler：部署改为 **push 触发的 Cloudflare Workers Builds**，`npx wrangler deploy` 由 Cloudflare 构建机执行；`wrangler.json` 与 `.assetsignore` 作为部署配置保留在仓库。`npm run check` 相应降级为纯 JS 语法检查（`node --check`，`scripts/check.mjs`），不再包含 deploy --dry-run；本地预览仅 `npx serve`。
