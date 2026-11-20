// Áudio 100% sintetizado (WebAudio), sem arquivos externos.
// Mixer: efeitos + música -> compressor -> saída, com envio para um reverb gerado na hora.
// Música: groove lo-fi procedural (Fmaj7 – Em7 – Dm7 – Cmaj9) com camadas por modo (menu / planejamento / combate).

type Bus = 'sfx' | 'music';

function lsGet(k: string) { try { return localStorage.getItem(k); } catch { return null; } }
function lsSet(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* */ } }
const num = (k: string, d: number) => { const v = Number(lsGet(k)); return lsGet(k) === null || Number.isNaN(v) ? d : v; };

let muted = lsGet('chapatron_mute') === '1';
const vol = { master: num('chapatron_vol_master', 0.8), music: num('chapatron_vol_music', 0.55), sfx: num('chapatron_vol_sfx', 0.85) };

let ctx: AudioContext | null = null;
let master!: GainNode;
let sfxBus!: GainNode;
let musicBus!: GainNode;
let revIn!: GainNode;
let noiseBuf!: AudioBuffer;
const lastPlay: Record<string, number> = {};

function makeImpulse(a: AudioContext, seconds: number, decay: number) {
  const len = Math.floor(a.sampleRate * seconds);
  const buf = a.createBuffer(2, len, a.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

function ac() {
  if (!ctx) {
    ctx = new AudioContext();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    master = ctx.createGain();
    master.gain.value = muted ? 0 : vol.master;
    master.connect(comp).connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = vol.sfx * 0.9; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = vol.music * 0.7; musicBus.connect(master);
    const conv = ctx.createConvolver();
    conv.buffer = makeImpulse(ctx, 2.4, 3.2);
    revIn = ctx.createGain();
    const revOut = ctx.createGain(); revOut.gain.value = 0.42;
    revIn.connect(conv).connect(revOut).connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => { /* */ });
  return ctx;
}

const rnd = (a: number) => 1 + (Math.random() * 2 - 1) * a;
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

interface VoiceOpts {
  f: number; dur: number; type?: OscillatorType; vol?: number; to?: number; delay?: number; attack?: number;
  lp?: number; lpTo?: number; hp?: number; bp?: number; q?: number; rev?: number; pan?: number; detune?: number;
  bus?: Bus; out?: AudioNode; at?: number; vib?: number;
}
/** Oscilador com envelope, filtro opcional, pan e envio de reverb. */
function osc(o: VoiceOpts) {
  const a = ac();
  const t0 = o.at ?? a.currentTime + (o.delay ?? 0);
  const v = a.createOscillator();
  v.type = o.type ?? 'sine';
  v.frequency.setValueAtTime(o.f, t0);
  if (o.to) v.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + o.dur);
  if (o.detune) v.detune.value = o.detune;
  if (o.vib) {
    const l = a.createOscillator(); const lg = a.createGain();
    l.frequency.value = 5.5; lg.gain.value = o.vib; l.connect(lg).connect(v.frequency); l.start(t0); l.stop(t0 + o.dur + 0.05);
  }
  let node: AudioNode = v;
  if (o.lp || o.hp || o.bp) {
    const f = a.createBiquadFilter();
    f.type = o.bp ? 'bandpass' : o.hp ? 'highpass' : 'lowpass';
    f.frequency.setValueAtTime(o.bp ?? o.hp ?? o.lp!, t0);
    if (o.lpTo) f.frequency.exponentialRampToValueAtTime(o.lpTo, t0 + o.dur);
    f.Q.value = o.q ?? 0.8;
    node.connect(f); node = f;
  }
  const g = a.createGain();
  const peak = o.vol ?? 0.3, att = o.attack ?? 0.005;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + att);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  node.connect(g);
  let outNode: AudioNode = g;
  if (o.pan) { const p = a.createStereoPanner(); p.pan.value = o.pan; g.connect(p); outNode = p; }
  outNode.connect(o.out ?? (o.bus === 'music' ? musicBus : sfxBus));
  if (o.rev) { const s = a.createGain(); s.gain.value = o.rev; outNode.connect(s).connect(revIn); }
  v.start(t0); v.stop(t0 + o.dur + 0.05);
}

interface NoiseOpts {
  dur: number; vol?: number; lp?: number; hp?: number; bp?: number; q?: number; to?: number; delay?: number; attack?: number;
  rev?: number; pan?: number; bus?: Bus; out?: AudioNode; at?: number; curve?: 'exp' | 'lin';
}
function nz(o: NoiseOpts) {
  const a = ac();
  const t0 = o.at ?? a.currentTime + (o.delay ?? 0);
  const src = a.createBufferSource();
  src.buffer = noiseBuf;
  const f = a.createBiquadFilter();
  f.type = o.bp ? 'bandpass' : o.hp ? 'highpass' : 'lowpass';
  const f0 = o.bp ?? o.hp ?? o.lp ?? 2000;
  f.frequency.setValueAtTime(f0, t0);
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t0 + o.dur);
  f.Q.value = o.q ?? (o.bp ? 2 : 0.7);
  const g = a.createGain();
  const peak = o.vol ?? 0.2, att = o.attack ?? 0.003;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + att);
  if (o.curve === 'lin') g.gain.linearRampToValueAtTime(0.0001, t0 + o.dur);
  else g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  src.connect(f).connect(g);
  let outNode: AudioNode = g;
  if (o.pan) { const p = a.createStereoPanner(); p.pan.value = o.pan; g.connect(p); outNode = p; }
  outNode.connect(o.out ?? (o.bus === 'music' ? musicBus : sfxBus));
  if (o.rev) { const s = a.createGain(); s.gain.value = o.rev; outNode.connect(s).connect(revIn); }
  src.start(t0, Math.random() * 1.5, o.dur + 0.05);
}
/** Sino (parcial inarmônico) — bom para brilhos e moedas. */
function bell(f: number, dur: number, vol: number, delay = 0, rev = 0.35) {
  osc({ f, dur, vol, delay, rev });
  osc({ f: f * 2.76, dur: dur * 0.5, vol: vol * 0.35, delay, rev });
  osc({ f: f * 5.4, dur: dur * 0.25, vol: vol * 0.12, delay, rev });
}

// ---------------- efeitos ----------------
const SOUNDS = {
  click: () => { osc({ f: 1700 * rnd(0.05), dur: 0.04, vol: 0.12, type: 'triangle' }); nz({ dur: 0.02, vol: 0.05, hp: 5000 }); },
  hover: () => osc({ f: 2400 * rnd(0.03), dur: 0.03, vol: 0.035 }),
  buy: () => {
    nz({ dur: 0.05, vol: 0.12, bp: 3500 });
    bell(1318, 0.35, 0.16, 0.02); bell(1760, 0.5, 0.14, 0.09);
    osc({ f: 330, dur: 0.12, vol: 0.12, type: 'triangle', to: 660 });
  },
  sell: () => {
    [1568, 1175, 880].forEach((f, i) => bell(f * rnd(0.02), 0.25, 0.1, i * 0.06, 0.25));
    nz({ dur: 0.25, vol: 0.1, bp: 4000, to: 1500, delay: 0.02 });
  },
  reroll: () => {
    for (let i = 0; i < 5; i++) nz({ dur: 0.05, vol: 0.13, bp: 2600 + i * 400, q: 1.5, delay: i * 0.035, pan: (i % 2 ? 0.3 : -0.3) });
    osc({ f: 500, to: 1400, dur: 0.22, vol: 0.08, type: 'triangle', delay: 0.05 });
  },
  xp: () => {
    osc({ f: 300, to: 1000, dur: 0.3, vol: 0.14, type: 'triangle', lp: 3000 });
    bell(1568, 0.3, 0.08, 0.2);
  },
  levelup: () => {
    [523, 659, 784, 1046].forEach((f, i) => {
      osc({ f, dur: 0.4, vol: 0.13, type: 'triangle', delay: i * 0.085, rev: 0.35 });
      osc({ f: f * 2, dur: 0.3, vol: 0.05, delay: i * 0.085, rev: 0.35 });
    });
    osc({ f: 131, dur: 0.6, vol: 0.18, type: 'triangle', delay: 0.26 });
    for (let i = 0; i < 6; i++) bell(2093 + i * 260, 0.25, 0.04, 0.3 + i * 0.04, 0.5);
  },
  star: () => {
    [784, 988, 1175, 1568, 1976].forEach((f, i) => bell(f, 0.6, 0.11, i * 0.06, 0.55));
    nz({ dur: 0.7, vol: 0.06, hp: 6000, delay: 0.1, rev: 0.5, attack: 0.2 });
    osc({ f: 196, dur: 0.8, vol: 0.14, type: 'triangle', delay: 0.15, rev: 0.3 });
  },
  equip: () => { bell(2200 * rnd(0.03), 0.18, 0.09); bell(3300 * rnd(0.03), 0.22, 0.06, 0.05); nz({ dur: 0.04, vol: 0.08, bp: 5000 }); },
  augment: () => {
    nz({ dur: 1.0, vol: 0.08, hp: 3000, to: 9000, attack: 0.5, rev: 0.6 });
    [392, 494, 587, 740, 880].forEach((f, i) => osc({ f, dur: 1.4, vol: 0.06, attack: 0.3, delay: 0.1 + i * 0.07, rev: 0.6, type: 'triangle' }));
  },
  // combate
  hit: () => {
    osc({ f: 150 * rnd(0.12), to: 55, dur: 0.09, vol: 0.22 });
    nz({ dur: 0.06, vol: 0.14, lp: 1800 * rnd(0.2), pan: (Math.random() - 0.5) * 0.6 });
  },
  hitCrit: () => {
    osc({ f: 170, to: 50, dur: 0.14, vol: 0.3 });
    nz({ dur: 0.1, vol: 0.2, lp: 3000 });
    osc({ f: 950 * rnd(0.05), dur: 0.25, vol: 0.08, type: 'square', bp: 1900, q: 6, rev: 0.25 });
  },
  hitMagic: () => {
    osc({ f: 700 * rnd(0.1), to: 180, dur: 0.14, vol: 0.12, type: 'sine' });
    nz({ dur: 0.1, vol: 0.09, bp: 2800, q: 3, pan: (Math.random() - 0.5) * 0.6 });
  },
  slash: () => nz({ dur: 0.11, vol: 0.12 * rnd(0.2), bp: 900, to: 3800, q: 1.2, pan: (Math.random() - 0.5) * 0.5 }),
  shoot: () => {
    osc({ f: 1500 * rnd(0.1), to: 380, dur: 0.09, vol: 0.06, type: 'square', lp: 2800 });
    nz({ dur: 0.03, vol: 0.04, hp: 3000 });
  },
  shootMagic: () => osc({ f: 500 * rnd(0.08), to: 1300, dur: 0.12, vol: 0.06, type: 'triangle', vib: 30, rev: 0.15 }),
  cast: () => {
    osc({ f: 220, to: 880, dur: 0.45, vol: 0.12, type: 'triangle', rev: 0.4 });
    osc({ f: 330, to: 1320, dur: 0.45, vol: 0.06, rev: 0.4 });
    nz({ dur: 0.45, vol: 0.06, hp: 4000, to: 9000, attack: 0.2, rev: 0.4 });
  },
  boom: () => {
    nz({ dur: 0.9, vol: 0.45, lp: 1400, to: 120, rev: 0.35 });
    osc({ f: 100, to: 32, dur: 0.6, vol: 0.45 });
    nz({ dur: 0.15, vol: 0.2, hp: 2500 });
  },
  slam: () => {
    osc({ f: 80, to: 30, dur: 0.45, vol: 0.45 });
    nz({ dur: 0.5, vol: 0.3, lp: 600, to: 100, rev: 0.25 });
    for (let i = 0; i < 4; i++) nz({ dur: 0.05, vol: 0.06, bp: 1500 + Math.random() * 2000, delay: 0.08 + i * 0.05 });
  },
  whoosh: () => nz({ dur: 0.5, vol: 0.18, bp: 400, to: 2400, q: 1, attack: 0.3, curve: 'lin' }),
  zap: () => {
    for (let i = 0; i < 4; i++) osc({ f: 1800 * rnd(0.4), to: 200, dur: 0.06, vol: 0.07, type: 'sawtooth', delay: i * 0.03, hp: 600 });
    nz({ dur: 0.18, vol: 0.14, hp: 3500, rev: 0.3 });
  },
  heal: () => { [880, 1175, 1568].forEach((f, i) => bell(f, 0.5, 0.06, i * 0.07, 0.6)); },
  shield: () => {
    osc({ f: 320, to: 900, dur: 0.3, vol: 0.12, lp: 1800, rev: 0.3 });
    osc({ f: 1200, dur: 0.4, vol: 0.05, type: 'triangle', delay: 0.12, rev: 0.4, vib: 15 });
  },
  drain: () => { osc({ f: 700, to: 140, dur: 0.45, vol: 0.12, vib: 40, lp: 2000, rev: 0.2 }); nz({ dur: 0.4, vol: 0.05, bp: 900, to: 300 }); },
  buff: () => { osc({ f: 260, to: 1040, dur: 0.3, vol: 0.08, type: 'square', lp: 1600, rev: 0.25 }); bell(1568, 0.3, 0.05, 0.2); },
  puff: () => nz({ dur: 0.45, vol: 0.14, lp: 700, to: 300, attack: 0.04, rev: 0.2 }),
  death: () => {
    osc({ f: 420, to: 55, dur: 0.55, vol: 0.12, type: 'sawtooth', lp: 1400, lpTo: 200 });
    nz({ dur: 0.35, vol: 0.12, lp: 900, delay: 0.05 });
    osc({ f: 2000, dur: 0.05, vol: 0.04, type: 'square', delay: 0.5 });
  },
  win: () => {
    const t = [523, 659, 784, 1046];
    t.forEach((f, i) => { osc({ f, dur: 0.5, vol: 0.13, type: 'triangle', delay: i * 0.1, rev: 0.4 }); osc({ f: f / 2, dur: 0.5, vol: 0.05, delay: i * 0.1 }); });
    [523, 659, 784].forEach((f) => osc({ f, dur: 1.2, vol: 0.07, type: 'triangle', delay: 0.45, rev: 0.5, attack: 0.05 }));
    osc({ f: 131, dur: 1.2, vol: 0.18, type: 'triangle', delay: 0.45 });
    for (let i = 0; i < 5; i++) bell(2093 + i * 220, 0.3, 0.04, 0.5 + i * 0.05, 0.5);
  },
  lose: () => {
    [392, 370, 349, 294].forEach((f, i) => osc({ f, to: i === 3 ? 260 : undefined, dur: i === 3 ? 0.9 : 0.3, vol: 0.12, type: 'sawtooth', lp: 1100, vib: i === 3 ? 6 : 0, delay: i * 0.22, rev: 0.25 }));
  },
  error: () => { osc({ f: 180, dur: 0.14, vol: 0.12, type: 'square', lp: 1200 }); osc({ f: 170, dur: 0.14, vol: 0.12, type: 'square', lp: 1200, delay: 0.09 }); },
  phase: () => { bell(784, 0.6, 0.11, 0, 0.5); bell(1175, 0.8, 0.1, 0.12, 0.5); },
  combat: () => {
    osc({ f: 98, dur: 1.6, vol: 0.22, type: 'triangle', attack: 0.04, rev: 0.5 });
    osc({ f: 147, dur: 1.4, vol: 0.12, type: 'sawtooth', lp: 900, attack: 0.08, rev: 0.5 });
    osc({ f: 196, dur: 1.2, vol: 0.08, type: 'sawtooth', lp: 1200, attack: 0.1, rev: 0.5, delay: 0.05 });
    nz({ dur: 1.2, vol: 0.12, lp: 500, attack: 0.02, rev: 0.4 });
  },
  tick: () => osc({ f: 1250, dur: 0.05, vol: 0.12, type: 'triangle' }),
  tickLast: () => { osc({ f: 1650, dur: 0.08, vol: 0.14, type: 'triangle' }); osc({ f: 825, dur: 0.1, vol: 0.08 }); },
};
export type SoundName = keyof typeof SOUNDS;

export function sfx(name: SoundName, minGap = 40, delayMs = 0) {
  if (muted || vol.master <= 0 || vol.sfx <= 0) return;
  const now = performance.now() + delayMs;
  if (now - (lastPlay[name] ?? -1e9) < minGap) return;
  lastPlay[name] = now;
  try {
    if (delayMs > 0) setTimeout(() => { try { SOUNDS[name](); } catch { /* */ } }, delayMs);
    else SOUNDS[name]();
  } catch { /* áudio indisponível */ }
}

// =====================================================================
// MÚSICA
// =====================================================================
export type MusicMode = 'off' | 'menu' | 'planning' | 'combat';
let mode: MusicMode = 'off';
let timer: number | null = null;
let nextT = 0;
let step = 0;
let layers: Record<string, GainNode> | null = null;
let drumLP: BiquadFilterNode | null = null;
let keysLP: BiquadFilterNode | null = null;
let crackle: AudioBufferSourceNode | null = null;

const BPM = 78;
const S16 = 60 / BPM / 4;
const SWING = S16 * 0.22;
// Fmaj7 – Em7 – Dm7 – Cmaj9 (voicings médios) + baixo
const PROG = [
  { keys: [53, 57, 60, 64], bass: 41 },
  { keys: [52, 55, 59, 62], bass: 40 },
  { keys: [50, 53, 57, 60], bass: 38 },
  { keys: [48, 52, 55, 59, 62], bass: 36 },
];
const PENTA = [72, 74, 76, 79, 81, 84, 86];

const MIX: Record<MusicMode, Record<string, number>> = {
  off: { keys: 0, bass: 0, kick: 0, snare: 0, hat: 0, hat2: 0, arp: 0, mel: 0, crackle: 0 },
  menu: { keys: 0.9, bass: 0.55, kick: 0.35, snare: 0.25, hat: 0.3, hat2: 0, arp: 0, mel: 0.5, crackle: 1 },
  planning: { keys: 0.8, bass: 0.8, kick: 0.8, snare: 0.6, hat: 0.55, hat2: 0, arp: 0, mel: 0.6, crackle: 0.8 },
  combat: { keys: 0.6, bass: 1, kick: 1, snare: 0.8, hat: 0.6, hat2: 0.55, arp: 0.6, mel: 0.25, crackle: 0.5 },
};

function ensureLayers() {
  if (layers) return layers;
  const a = ac();
  layers = {};
  drumLP = a.createBiquadFilter(); drumLP.type = 'lowpass'; drumLP.frequency.value = 3200; drumLP.connect(musicBus);
  keysLP = a.createBiquadFilter(); keysLP.type = 'lowpass'; keysLP.frequency.value = 1700; keysLP.Q.value = 0.5;
  // trêmolo suave nos teclados (vibe Rhodes)
  const trem = a.createGain(); trem.gain.value = 0.85;
  const lfo = a.createOscillator(); const lfoG = a.createGain(); lfo.frequency.value = 4.2; lfoG.gain.value = 0.15;
  lfo.connect(lfoG).connect(trem.gain); lfo.start();
  keysLP.connect(trem).connect(musicBus);
  const kSend = a.createGain(); kSend.gain.value = 0.25; trem.connect(kSend).connect(revIn);
  for (const k of Object.keys(MIX.off)) {
    const g = a.createGain(); g.gain.value = 0;
    g.connect(k === 'keys' || k === 'mel' || k === 'arp' ? keysLP : k === 'bass' || k === 'crackle' ? musicBus : drumLP);
    layers[k] = g;
  }
  // melodia e arpejo com mais reverb
  for (const k of ['mel', 'arp']) { const s = a.createGain(); s.gain.value = 0.5; layers[k].connect(s).connect(revIn); }
  // chiado de vinil (loop)
  const cb = a.createBuffer(1, a.sampleRate * 3, a.sampleRate);
  const d = cb.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    d[i] = (Math.random() * 2 - 1) * 0.012;
    if (Math.random() < 0.0006) d[i] += (Math.random() * 2 - 1) * 0.5;
  }
  crackle = a.createBufferSource(); crackle.buffer = cb; crackle.loop = true;
  const cf = a.createBiquadFilter(); cf.type = 'bandpass'; cf.frequency.value = 2500; cf.Q.value = 0.4;
  crackle.connect(cf).connect(layers.crackle); crackle.start();
  return layers;
}

function applyMix(m: MusicMode, fade = 1.5) {
  if (!layers) return;
  const a = ac(), t = a.currentTime;
  for (const [k, g] of Object.entries(layers)) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(MIX[m][k] ?? 0, t + fade);
  }
  drumLP?.frequency.setTargetAtTime(m === 'combat' ? 6500 : m === 'menu' ? 2200 : 3200, t, 0.6);
  keysLP?.frequency.setTargetAtTime(m === 'combat' ? 2600 : m === 'menu' ? 1300 : 1700, t, 0.6);
}

function schedStep(s: number, t: number) {
  const L = layers!;
  const bar = Math.floor(s / 16) % PROG.length;
  const i = s % 16;
  const ch = PROG[bar];
  const sw = i % 2 === 1 ? SWING : 0;
  const tt = t + sw;
  // teclados: acorde no 1 e "empurrada" no 11
  if (i === 0 || (i === 10 && Math.random() < 0.6)) {
    const len = i === 0 ? S16 * 10 : S16 * 6;
    ch.keys.forEach((m, k) => {
      const f = mtof(m);
      osc({ f, dur: len, vol: 0.055, type: 'sine', at: tt + k * 0.012, attack: 0.02, out: L.keys });
      osc({ f, dur: len * 0.7, vol: 0.02, type: 'triangle', at: tt + k * 0.012, detune: 7, attack: 0.02, out: L.keys });
    });
  }
  // baixo
  if (i === 0 || i === 7 || i === 10) {
    const m = i === 7 ? ch.bass + 7 : ch.bass;
    osc({ f: mtof(m), dur: S16 * (i === 0 ? 6 : 3), vol: 0.22, type: 'triangle', lp: 380, at: tt, attack: 0.01, out: L.bass });
    osc({ f: mtof(m), dur: S16 * (i === 0 ? 6 : 3), vol: 0.18, at: tt, attack: 0.01, out: L.bass });
  }
  // bateria boom-bap
  if (i === 0 || i === 10 || (i === 7 && Math.random() < 0.35)) {
    osc({ f: 130, to: 42, dur: 0.32, vol: 0.55, at: tt, out: L.kick });
    nz({ dur: 0.02, vol: 0.12, lp: 1500, at: tt, out: L.kick });
  }
  if (i === 4 || i === 12) {
    nz({ dur: 0.18, vol: 0.28, bp: 1700, q: 0.9, at: tt, out: L.snare });
    osc({ f: 210, to: 150, dur: 0.1, vol: 0.12, type: 'triangle', at: tt, out: L.snare });
  }
  if (i % 2 === 0) nz({ dur: i % 4 === 2 ? 0.07 : 0.035, vol: i % 4 === 2 ? 0.07 : 0.05, hp: 7500, at: tt, out: L.hat });
  else nz({ dur: 0.025, vol: 0.05, hp: 9000, at: tt, out: L.hat2 });
  // arpejo (combate)
  if (i % 2 === 0) {
    const m = ch.keys[(i / 2) % ch.keys.length] + 12;
    osc({ f: mtof(m), dur: S16 * 1.6, vol: 0.05, type: 'triangle', at: tt, lp: 3000, out: L.arp });
  }
  // melodia esparsa em pentatônica
  if ((i === 2 || i === 6 || i === 9 || i === 14) && Math.random() < 0.28) {
    const m = PENTA[Math.floor(Math.random() * PENTA.length)];
    osc({ f: mtof(m), dur: S16 * 5, vol: 0.05, at: tt, attack: 0.01, out: L.mel });
    osc({ f: mtof(m) * 2.76, dur: S16 * 2, vol: 0.012, at: tt, out: L.mel });
  }
}

function scheduler() {
  if (!ctx) return;
  while (nextT < ctx.currentTime + 0.15) {
    schedStep(step, nextT);
    step++;
    nextT += S16;
  }
}

function startLoop() {
  if (timer !== null) return;
  const a = ac();
  ensureLayers();
  nextT = a.currentTime + 0.1;
  timer = window.setInterval(scheduler, 30);
}
function stopLoop() {
  if (timer !== null) { clearInterval(timer); timer = null; }
}

let unlocked = false;
function musicWanted() { return !muted && vol.master > 0 && vol.music > 0 && mode !== 'off'; }
function refreshMusic() {
  if (!unlocked) return;
  if (musicWanted()) { startLoop(); applyMix(mode); }
  else if (layers) { applyMix('off', 0.6); setTimeout(() => { if (!musicWanted()) stopLoop(); }, 700); }
}

/** Muda o clima da trilha (com crossfade). */
export function setMusic(m: MusicMode) {
  if (m === mode) return;
  mode = m;
  refreshMusic();
}

// o navegador só libera áudio depois de um gesto do usuário
function unlock() {
  if (unlocked) return;
  unlocked = true;
  ac();
  refreshMusic();
}
window.addEventListener('pointerdown', unlock, { once: false, capture: true });
window.addEventListener('keydown', unlock, { once: false, capture: true });

/** Diagnóstico (dev): estado do áudio e roda um efeito sem engolir erros. */
export function audioDebug(name?: SoundName) {
  if (name) SOUNDS[name]();
  return { state: ctx?.state ?? 'none', running: timer !== null, mode, step, layers: layers ? Object.fromEntries(Object.entries(layers).map(([k, g]) => [k, +g.gain.value.toFixed(2)])) : null };
}

// ---------------- volume ----------------
export function isMuted() { return muted; }
export function toggleMute() {
  muted = !muted;
  lsSet('chapatron_mute', muted ? '1' : '0');
  if (ctx) master.gain.setTargetAtTime(muted ? 0 : vol.master, ctx.currentTime, 0.05);
  refreshMusic();
  return muted;
}
export function getVolume(k: keyof typeof vol) { return vol[k]; }
export function setVolume(k: keyof typeof vol, v: number) {
  vol[k] = Math.max(0, Math.min(1, v));
  lsSet(`chapatron_vol_${k}`, String(vol[k]));
  if (ctx) {
    const t = ctx.currentTime;
    if (k === 'master') master.gain.setTargetAtTime(muted ? 0 : vol.master, t, 0.05);
    if (k === 'music') musicBus.gain.setTargetAtTime(vol.music * 0.7, t, 0.05);
    if (k === 'sfx') sfxBus.gain.setTargetAtTime(vol.sfx * 0.9, t, 0.05);
  }
  refreshMusic();
}
