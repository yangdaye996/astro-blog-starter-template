// Web Audio 合成音效（ADR-0011 零音频文件）：冥想开始/结束钟声。
// 钟声 = 基频 + 非谐泛音列，指数衰减，听感接近磬。

let ctx;

function ensureCtx() {
	if (!ctx) {
		ctx = new (window.AudioContext || window.webkitAudioContext)();
	}
	if (ctx.state === 'suspended') {
		ctx.resume();
	}
	return ctx;
}

// 钟声。baseHz 越低越沉稳；gain 总响度；首次调用即解锁 AudioContext。
export function bell(baseHz = 528, gain = 0.5, delaySec = 0) {
	const ac = ensureCtx();
	const t0 = ac.currentTime + delaySec;
	// 非谐泛音：基频 + 2.76 倍 + 5.4 倍，各自带独立衰减
	const partials = [
		{ f: baseHz, g: 1.0, decay: 3.2 },
		{ f: baseHz * 2.76, g: 0.4, decay: 2.0 },
		{ f: baseHz * 5.4, g: 0.18, decay: 1.0 },
	];
	const master = ac.createGain();
	master.gain.value = gain;
	master.connect(ac.destination);
	for (const p of partials) {
		const osc = ac.createOscillator();
		const env = ac.createGain();
		osc.frequency.value = p.f;
		osc.type = 'sine';
		env.gain.setValueAtTime(p.g, t0);
		env.gain.exponentialRampToValueAtTime(0.0001, t0 + p.decay);
		osc.connect(env).connect(master);
		osc.start(t0);
		osc.stop(t0 + p.decay);
	}
}
