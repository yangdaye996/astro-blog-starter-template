# 心智训练站

心算、N-back、冥想三大训练模块 + 统计页。纯静态无构建（ADR-0010/0011）：源码即产物，零运行时第三方依赖，部署为 Cloudflare assets-only Worker，训练记录存浏览器 localStorage（ADR-0012）。

> 前身是中文博客（Astro + D1 + 站内编辑），2026-11-09 换血转型（ADR-0010）；博客时代的决策存档于 `docs/adr/` 的 0001–0009。

## 页面

| 路由 | 内容 |
| --- | --- |
| `/` | 首页：三模块入口 + 今日状态与连续天数 |
| `/math/` | 心算：三档难度限时冲刺（30/60/120 秒），键入作答 |
| `/nback/` | 单位置 N-back：n 1–5，一轮 20+n 个刺激，空格匹配 |
| `/meditation/` | 冥想：静坐计时 + 可选呼吸引导（4 秒吸/4 秒呼）+ 合成钟声 |
| `/stats/` | 统计：总览、每模块近 30 次趋势、明细、导出备份 |

## 本地开发

```bash
npm install
npm run dev        # http://localhost:4321
```

ES modules 不能用 `file://` 直开（CORS 拦截），必须走 HTTP——任何静态服务器都行（`npx serve .`、`python -m http.server`）。

## 验证与部署

```bash
npm run check      # wrangler deploy --dry-run
npm run deploy     # 部署到 Cloudflare（assets-only Worker，免费额度）
```

首次部署：Cloudflare 登录后 `npx wrangler deploy`，Worker 名 `mind-gym`。没有 D1、没有 KV、没有 Access——没有什么要配的。站点排除清单见根目录 `.assetsignore`。

## 数据与备份（重要）

- 训练记录唯一真源 = 浏览器 localStorage（key `mindgym:v1:sessions`），**清除站点数据 = 全丢**。
- `/stats/` 页「导出 JSON 备份」是唯一备份手段，定期导。
- 导入（恢复）未立项（ADR-0012）；多设备不同步是设计如此。
- 钟声与提示音由 Web Audio 实时合成，无音频文件。

## 旧博客遗留清理（一次性）

代码库已不引用 D1 与旧 Worker。Cloudflare 控制台里的旧 `astro-blog-starter-template` Worker、`blog` D1 数据库，确认不再需要后手动删除。博客内容的历史备份（如 `content-export/`）不随本仓库。
