// 会话日志存储（ADR-0012）：localStorage 唯一真源，追加式 JSON 数组。
// key 中的 v1 是数据版本；字段变更必须新开 v2 并写迁移函数，禁止原地改语义。

export const STORE_KEY = 'mindgym:v1:sessions';

const ONE_DAY = 24 * 60 * 60 * 1000;
export { ONE_DAY };

function read() {
	try {
		const raw = localStorage.getItem(STORE_KEY);
		const list = raw ? JSON.parse(raw) : [];
		return Array.isArray(list) ? list : [];
	} catch (err) {
		// 数据损坏时不静默清库：返回空并报错，提示用户检查备份。
		console.error('[store] 会话日志解析失败，请检查导出备份', err);
		return [];
	}
}

function write(list) {
	localStorage.setItem(STORE_KEY, JSON.stringify(list));
}

export function loadSessions() {
	return read();
}

// 追加一条会话。entry: { module, ts(会话开始时刻 ms), params, result }
// 写入时机唯一：会话正常结束或明确放弃时一次性写入（ADR-0012）。
export function addSession(entry) {
	const list = read();
	list.push({
		id: crypto.randomUUID(),
		ts: entry.ts,
		module: entry.module,
		params: entry.params,
		result: entry.result,
	});
	list.sort((a, b) => a.ts - b.ts);
	write(list);
	return list.length;
}

// 导出全部日志为 JSON 下载 —— localStorage 的唯一备份手段（ADR-0012）。
export function exportSessions() {
	const payload = {
		version: 1,
		exportedAt: new Date().toISOString(),
		sessions: read(),
	};
	const blob = new Blob([JSON.stringify(payload, null, 2)], {
		type: 'application/json',
	});
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	const d = new Date();
	const stamp = [
		d.getFullYear(),
		String(d.getMonth() + 1).padStart(2, '0'),
		String(d.getDate()).padStart(2, '0'),
	].join('');
	a.href = url;
	a.download = `mindgym-sessions-${stamp}.json`;
	a.click();
	URL.revokeObjectURL(url);
}
