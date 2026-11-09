// 语法检查（npm run check）：对全部站点 JS 跑 node --check。
// 替代退役的 `wrangler deploy --dry-run`（本地已无 wrangler，部署由 Cloudflare 构建机执行）。
import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const files = [];
(function walk(dir) {
	for (const name of readdirSync(dir)) {
		const p = join(dir, name);
		if (statSync(p).isDirectory()) walk(p);
		else if (name.endsWith('.js')) files.push(p);
	}
})('assets/js');

let failed = false;
for (const f of files) {
	const r = spawnSync(process.execPath, ['--check', f], { stdio: 'pipe' });
	if (r.status !== 0) {
		failed = true;
		console.error(`FAIL ${f}`);
		console.error(r.stderr.toString());
	} else {
		console.log(`OK   ${f}`);
	}
}
process.exit(failed ? 1 : 0);
