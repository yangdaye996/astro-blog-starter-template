// 构建期生成标题层中文字体子集（ADR-0003）。
//
// 标题层字体覆盖：站名、导航、页面栏目标题、文章标题。
// 正文层走系统字体栈，不参与子集。
//
// 字符来源共三处：
//   1. src/consts.ts —— 站名/副标题/作者/导航标签（剥离注释后取全部汉字）
//   2. src/**/*.astro —— 仅 <h1>~<h6> 标签内的汉字（栏目标题、页面标题）
//   3. src/content/{blog,notes}/** —— frontmatter 的 title 字段；
//      blog 无 title 时以文件名为标题（ADR-0008），同样纳入扫描
//
// 若新增了上述三处之外的标题文案，把它补进 EXTRA_HEADING_CHARS，
// 否则那些字会在标题字体里缺失并回退到系统字体。

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { readdir } from "node:fs/promises";
import { join, dirname, relative, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";
import subsetFont from "subset-font";

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const SOURCE_TTF_PACKAGE = "@expo-google-fonts/noto-sans-sc";
const SOURCE_TTF_SUBPATH = "700Bold/NotoSansSC_700Bold.ttf";
const OUTPUT = join(ROOT, "public", "fonts", "heading-subset.woff2");

// 标题层用到、但不在上述三处出现的固定字符：日期单位、序号、标点。
const EXTRA_HEADING_CHARS = "年月日时分秒第篇条个全部文章归档随想关于首页新旧共约字";

const CJK_AND_PUNCT =
	/[\u3000-\u303f\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/g;

async function* walk(dir, exts) {
	let entries;
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch (err) {
		if (err.code === "ENOENT") return;
		throw err;
	}
	for (const entry of entries) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) yield* walk(full, exts);
		else if (exts.some((ext) => entry.name.endsWith(ext))) yield full;
	}
}

// 剥离行注释与块注释，避免把注释里的汉字算进子集。
function stripComments(source) {
	return source
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

/** 取出 <h1>~<h6> 内的文本，忽略其中的 Astro 表达式与嵌套标签。 */
function extractHeadings(source) {
	const out = [];
	const re = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
	for (const [, , inner] of source.matchAll(re)) {
		out.push(inner.replace(/<[^>]*>/g, " ").replace(/\{[^}]*\}/g, " "));
	}
	return out.join(" ");
}

/** 从 frontmatter 中取 title 字段，支持单双引号与不带引号三种写法。 */
function extractFrontmatterTitle(source) {
	const fm = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!fm) return null;
	const m = fm[1].match(/^title:\s*(?:["'](.+?)["']|(.+?))\s*$/m);
	if (!m) return null;
	return m[1] ?? m[2] ?? null;
}

async function resolveSourceTtf() {
	let pkgDir;
	try {
		pkgDir = dirname(require.resolve(join(SOURCE_TTF_PACKAGE, "package.json")));
	} catch {
		throw new Error(
			`找不到字体源包 ${SOURCE_TTF_PACKAGE}。\n` +
				`它是 devDependency，请先执行：npm install`,
		);
	}
	return join(pkgDir, SOURCE_TTF_SUBPATH);
}

async function collectChars() {
	const chars = new Set(EXTRA_HEADING_CHARS);
	const sources = { consts: 0, headings: 0, titles: 0 };

	const constsPath = join(ROOT, "src", "consts.ts");
	const consts = stripComments(await readFile(constsPath, "utf8"));
	for (const c of consts.match(CJK_AND_PUNCT) ?? []) chars.add(c);
	sources.consts = (consts.match(CJK_AND_PUNCT) ?? []).length;

	const astroFiles = [];
	for await (const f of walk(join(ROOT, "src"), [".astro"])) astroFiles.push(f);
	let headingHits = 0;
	for (const f of astroFiles) {
		const text = extractHeadings(await readFile(f, "utf8"));
		const found = text.match(CJK_AND_PUNCT) ?? [];
		headingHits += found.length;
		for (const c of found) chars.add(c);
	}
	sources.headings = headingHits;

	let titleHits = 0;
	const titles = [];
	for (const dir of ["blog", "notes"]) {
		for await (const f of walk(join(ROOT, "src", "content", dir), [".md", ".mdx"])) {
			const title =
				extractFrontmatterTitle(await readFile(f, "utf8")) ??
				(dir === "blog" ? basename(f, extname(f)) : null);
			if (!title) continue;
			titles.push(title);
			const found = title.match(CJK_AND_PUNCT) ?? [];
			titleHits += found.length;
			for (const c of found) chars.add(c);
		}
	}
	sources.titles = titleHits;

	return { text: [...chars].join(""), count: chars.size, sources, titles, astroCount: astroFiles.length };
}

async function main() {
	const ttfPath = await resolveSourceTtf();
	const ttf = await readFile(ttfPath);
	const { text, count, sources, titles, astroCount } = await collectChars();

	const t0 = Date.now();
	const woff2 = await subsetFont(ttf, text, { targetFormat: "woff2" });
	const ms = Date.now() - t0;

	await mkdir(dirname(OUTPUT), { recursive: true });
	await writeFile(OUTPUT, woff2);

	const kb = (woff2.length / 1024).toFixed(1);
	console.log(
		`[fonts] 标题子集已生成 → ${relative(ROOT, OUTPUT)}\n` +
			`        去重字符 ${count} 个 · ${kb} KB · ${ms}ms\n` +
			`        来源：consts.ts ${sources.consts} 字 / ${astroCount} 个 .astro 的 h1-h6 ${sources.headings} 字 / ${titles.length} 篇标题 ${sources.titles} 字`,
	);

	// 预算护栏：子集超过 200KB 说明扫描范围跑偏了（例如误把正文算进来）。
	if (woff2.length > 200 * 1024) {
		console.warn(
			`[fonts] 警告：子集体积 ${kb}KB 超过 200KB 预算。` +
				`请检查是否把正文文案误纳入了标题层。`,
		);
	}
}

main().catch((err) => {
	console.error(`[fonts] 子集生成失败：${err.message}`);
	process.exit(1);
});
