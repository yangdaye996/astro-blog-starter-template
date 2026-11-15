// Vercel 部署辅助：由根目录 vercel.json#buildCommand 在 Vercel 构建机上调用（本地可手动跑来验证产物）。
// 纯静态站（ADR-0011）站点根 = 仓库根，而 Vercel 要求产物集中在单一输出目录 public/，
// 因此部署期只做「原样复制」，零转换、零依赖；排除清单与 Cloudflare 共用根目录 .assetsignore。
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('..', import.meta.url));
const outDir = join(rootDir, 'public');

// 排除清单唯一源 = .assetsignore（Cloudflare 同款）。该清单按 gitignore 风格书写，
// 但本脚本只按顶层名字排除，遇到含路径分隔符的条目就告警跳过，避免静默漏排。
const exclude = new Set();
for (let line of readFileSync(join(rootDir, '.assetsignore'), 'utf8').split(/\r?\n/)) {
	line = line.trim();
	if (!line || line.startsWith('#')) continue;
	if (line.includes('/')) {
		console.warn(`vercel-build: 排除项「${line}」含路径分隔符，本脚本只按顶层名字排除，已跳过`);
		continue;
	}
	exclude.add(line);
}
exclude.add('public'); // 输出目录本身绝不进产物（本地重复运行兜底）

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir);

let count = 0;
for (const name of readdirSync(rootDir)) {
	if (exclude.has(name)) continue;
	cpSync(join(rootDir, name), join(outDir, name), { recursive: true });
	count++;
}
console.log(`vercel-build: 已复制 ${count} 个顶层条目到 public/（排除清单 = .assetsignore）`);
