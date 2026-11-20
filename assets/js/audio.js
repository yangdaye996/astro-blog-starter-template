// Web Audio 合成音效（ADR-0011 零音频文件，ADR-0015 声音设计）。
// 全部声音都由可见事件触发：按键判定、序列闪光、会话结束。
// 全局静音偏好存 mindgym:v1:sound（独立于会话日志，不是训练数据），
// 顶栏开关一键静音，默认开。

const SOUND_KEY = 'mindgym:v1:sound';

let enabled = true;
try {
	enabled = localStorage.getItem(SOUND_KEY) !== 'off';
} catch (err) {
	// 隐私模式等 localStorage 不可用时退回默认开
}

let ctx;

export function soundOn() {
	return enabled;
}

export function setSoundOn(on) {
	enabled = on;
	try {
		localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
	} catch (err) {
		// 存不上就只改内存态，本次会话内仍生效
	}
}

function ensureCtx() {
	if (!ctx) {
		ctx = new (window.AudioContext || window.webkitAudioContext)();
	}
	if (ctx.state === 'suspended') {
		ctx.resume();
	}
	return ctx;
}

// 单音 helper：指数衰减包络，type 决定音色
function tone(freq, { type = 'sine', gain = 0.2, dur = 0.3, delay = 0, glideTo } = {}) {
	const ac = ensureCtx();
	const t0 = ac.currentTime + delay;
	const osc = ac.createOscillator();
	const env = ac.createGain();
	osc.type = type;
	osc.frequency.setValueAtTime(freq, t0);
	if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
	env.gain.setValueAtTime(0.0001, t0);
	env.gain.linearRampToValueAtTime(gain, t0 + 0.008);
	env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
	osc.connect(env).connect(ac.destination);
	osc.start(t0);
	osc.stop(t0 + dur + 0.02);
}

// 轻点音：答对 / 点中 / 序列闪光。freq 随格子变化可当音阶用。
export function blip(freq = 660, gain = 0.16) {
	if (!enabled) return;
	tone(freq, { gain, dur: 0.12 });
}

// 错误音：低频下滑短嗡，与红色反馈同步
export function buzz() {
	if (!enabled) return;
	tone(150, { type: 'square', gain: 0.07, dur: 0.22, glideTo: 90 });
}

// 完成琶音：一轮训练收尾 / 序列升阶
export function chime() {
	if (!enabled) return;
	tone(523.25, { gain: 0.2, dur: 0.5 });
	tone(659.25, { gain: 0.2, dur: 0.5, delay: 0.09 });
	tone(783.99, { gain: 0.22, dur: 0.7, delay: 0.18 });
}

// 钟声。baseHz 越低越沉稳；gain 总响度；首次调用即解锁 AudioContext。
export function bell(baseHz = 528, gain = 0.5, delaySec = 0) {
	if (!enabled) return;
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