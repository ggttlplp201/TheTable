import type { AudioContextLike, AudioCueId, AudioParamLike, BufferLike, BufferSourceLike, GainNodeLike, AudioNodeLike } from './types.js';

/*
 * The Table — sound design. Every cue is synthesized from a few primitives (filtered noise,
 * tones, inharmonic metal partials, a thump, a creak) and routed through a master chain that
 * matches the visual post-FX: tape saturation → amplitude crush → lowpass → small dark room.
 *
 * Use cues (item.*, and the events that the scene animates) are TIMELINES: their internal
 * offsets match the scene action durations in apps/web/src/table-action-presentation.ts and
 * the clip beats in packages/visual/src/clips.ts. They are triggered at the same moment the
 * scene starts the action, so the sound lands on the frame where contact happens.
 */

type Ctx = AudioContextLike;
type Out = AudioNodeLike;
type Voice = (c: Ctx, o: Out, t: number) => void;

// ---------- legacy descriptor (kept for the completeness tests and any external callers)
const TONES: Readonly<Partial<Record<AudioCueId, readonly [number, number, number]>>> = {
  'ui.select': [420, 0.035, 0.08], 'ui.set-down': [110, 0.07, 0.12], 'ui.confirm': [560, 0.09, 0.14], 'ui.reject': [90, 0.12, 0.16],
  'item.knife': [170, 0.11, 0.2], 'item.pistol': [72, 0.16, 0.35], 'item.poison': [180, 0.2, 0.16], 'item.medicine': [520, 0.18, 0.16], 'item.stimulant': [5200, .16, .9],
  'item.antidote': [680, 0.16, 0.14], 'item.armor': [95, 0.12, 0.17], 'item.bag': [130, 0.15, 0.15], 'item.chest': [240, 0.28, 0.22],
  'event.downed': [62, 0.3, 0.3], 'event.death': [45, 0.55, 0.32], 'event.exit': [740, 0.3, 0.2], 'event.results': [392, 0.5, 0.2],
  'turn.start': [260, 0.12, 0.15], 'turn.warning': [980, 0.08, 0.17], 'turn.response-warning': [760, 0.1, 0.2],
  'world.door': [115, 0.22, 0.15], 'world.footstep': [80, 0.06, 0.08], 'world.chair-scrape': [70, .62, .3], 'world.chair-settle': [80, .8, .26], 'world.room': [58, 1.2, 0.025], 'intro.sting': [196, 0.8, 0.16],
};
export function toneForCue(cue: AudioCueId): readonly [number, number, number] {
  const explicit = TONES[cue];
  if (explicit) return explicit;
  let hash = 17;
  for (let index = 0; index < cue.length; index += 1) hash = (hash * 31 + cue.charCodeAt(index)) >>> 0;
  return [120 + hash % 600, 0.07 + (hash % 14) / 100, cue.startsWith('world.') ? 0.06 : 0.11];
}

// ---------- param helpers (every automation method is optional on the injected context)
const setAt = (p: AudioParamLike, v: number, t: number) => { if (p.setValueAtTime) p.setValueAtTime(v, t); else p.value = v; };
const linTo = (p: AudioParamLike, v: number, t: number) => { if (p.linearRampToValueAtTime) p.linearRampToValueAtTime(v, t); else if (p.exponentialRampToValueAtTime) p.exponentialRampToValueAtTime(Math.max(v, 0.0001), t); };
const expTo = (p: AudioParamLike, v: number, t: number) => { if (p.exponentialRampToValueAtTime) p.exponentialRampToValueAtTime(Math.max(v, 0.0001), t); else linTo(p, v, t); };
export const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
export function seeded(seed: number): () => number {
  let s = seed | 0;
  return () => { s = (s + 0x6D2B79F5) | 0; let x = Math.imul(s ^ (s >>> 15), 1 | s); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}
let rnd: () => number = Math.random;
/** Deterministic mode for tests and offline renders. */
export function setSynthRandom(next: () => number): void { rnd = next; }

const noiseCache = new WeakMap<object, BufferLike>();
function noiseBuffer(c: Ctx): BufferLike {
  const cached = noiseCache.get(c); if (cached) return cached;
  const b = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * 2)), c.sampleRate), d = b.getChannelData?.(0);
  if (d) for (let i = 0; i < d.length; i += 1) d[i] = rnd() * 2 - 1;
  noiseCache.set(c, b); return b;
}
function env(c: Ctx, o: Out, t: number, a: number, peak: number, d: number, hold = 0): GainNodeLike {
  const g = c.createGain(); g.gain.value = 0.0001;
  setAt(g.gain, 0.0001, t); linTo(g.gain, peak, t + a); setAt(g.gain, peak, t + a + hold); expTo(g.gain, 0.0001, t + a + hold + d);
  g.connect(o); return g;
}

const cueTiming = new WeakMap<Ctx, { origin: number; scale: number }>();
function cueTime(c: Ctx, t: number) { const timing = cueTiming.get(c); return timing ? timing.origin + (t - timing.origin) * timing.scale : t; }
interface NoiseOpts { f?: number; fEnd?: number; q?: number; type?: string; gain?: number; a?: number; d?: number; hold?: number }
function noise(c: Ctx, o: Out, t: number, x: NoiseOpts): void {
  t = cueTime(c, t); const rate = cueTiming.get(c)?.scale ?? 1;
  const a = (x.a ?? 0.005) * rate, h = (x.hold ?? 0) * rate, d = (x.d ?? 0.1) * rate, s = c.createBufferSource(), f = c.createBiquadFilter();
  s.buffer = noiseBuffer(c); s.loop = true; f.type = x.type ?? 'bandpass'; setAt(f.frequency, x.f ?? 1000, t);
  if (x.fEnd) expTo(f.frequency, x.fEnd, t + a + h + d); f.Q.value = x.q ?? 1;
  s.connect(f); f.connect(env(c, o, t, a, x.gain ?? 0.4, d, h)); s.start(t, rnd() * 1.5); s.stop?.(t + a + h + d + 0.05);
}
interface ToneOpts { f: number; fEnd?: number; type?: string; gain?: number; a?: number; d?: number; hold?: number; det?: number; lp?: number }
function tone(c: Ctx, o: Out, t: number, x: ToneOpts): void {
  t = cueTime(c, t); const rate = cueTiming.get(c)?.scale ?? 1;
  const a = (x.a ?? 0.005) * rate, h = (x.hold ?? 0) * rate, d = (x.d ?? 0.2) * rate, s = c.createOscillator();
  s.type = x.type ?? 'sine'; setAt(s.frequency, x.f, t); if (x.fEnd) expTo(s.frequency, x.fEnd, t + a + h + d); if (x.det && s.detune) s.detune.value = x.det;
  let n: AudioNodeLike = s;
  if (x.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = x.lp; s.connect(f); n = f; }
  n.connect(env(c, o, t, a, x.gain ?? 0.3, d, h)); s.start(t); s.stop(t + a + h + d + 0.05);
}
const metal = (c: Ctx, o: Out, t: number, f: number, gain = 0.2, d = 0.6, p: readonly number[] = [1, 2.76, 5.4, 8.93]) =>
  p.forEach((r, i) => tone(c, o, t, { f: f * r, gain: gain / (1 + i * 1.3), d: d / (1 + i * 0.6), a: 0.001 }));
const click = (c: Ctx, o: Out, t: number, f = 3000, gain = 0.35, d = 0.012) => noise(c, o, t, { type: 'highpass', f, q: 0.7, gain, a: 0.0005, d });
const thump = (c: Ctx, o: Out, t: number, f = 90, gain = 0.6, d = 0.25) => tone(c, o, t, { f, fEnd: f * 0.45, gain, a: 0.002, d });
function creak(c: Ctx, o: Out, t: number, dur: number, f0 = 80, bp = 900, gain = 0.3): void {
  t = cueTime(c, t); dur *= cueTiming.get(c)?.scale ?? 1;
  const s = c.createOscillator(), filter = c.createBiquadFilter(), g = c.createGain(); s.type = 'sawtooth';
  setAt(s.frequency, f0, t); for (let k = t; k < t + dur;) { k += 0.02 + rnd() * 0.05; linTo(s.frequency, f0 * (0.7 + rnd() * 0.9), k); }
  filter.type = 'bandpass'; filter.frequency.value = bp; filter.Q.value = 5; g.gain.value = 0; setAt(g.gain, 0, t);
  for (let k = t; k < t + dur;) { k += 0.015 + rnd() * 0.04; linTo(g.gain, gain * (rnd() < 0.3 ? 0.1 : 1) * Math.sin(Math.PI * Math.min(1, (k - t) / dur)), k); }
  linTo(g.gain, 0, t + dur + 0.02); s.connect(filter); filter.connect(g); g.connect(o); s.start(t); s.stop(t + dur + 0.05);
}
const heart = (c: Ctx, o: Out, t: number, g = 0.45) => { thump(c, o, t, 52, g, 0.2); thump(c, o, t + 0.21, 49, g * 0.6, 0.18); };
const piano = (c: Ctx, o: Out, t: number, m: number, gain = 0.16, d = 2.2, lp = 2600) => {
  const f = midi(m) * (1 + (rnd() - 0.5) * 0.007);
  tone(c, o, t, { type: 'triangle', f, gain, a: 0.003, d, lp }); tone(c, o, t, { type: 'triangle', f: f * 1.0045, gain: gain * 0.6, a: 0.003, d: d * 0.8, lp });
  tone(c, o, t, { f: f * 2, gain: gain * 0.22, a: 0.002, d: d * 0.3 }); click(c, o, t, 1800, gain * 0.4, 0.007);
};
const musicBox = (c: Ctx, o: Out, t: number, m: number, gain = 0.1, d = 1.6) => { tone(c, o, t, { f: midi(m), gain, a: 0.001, d }); tone(c, o, t, { f: midi(m) * 4.02, gain: gain * 0.35, a: 0.001, d: 0.25 }); };
const pizz = (c: Ctx, o: Out, t: number, m: number, gain = 0.28, d = 0.4) => { tone(c, o, t, { type: 'triangle', f: midi(m), gain, a: 0.003, d, lp: 650 }); click(c, o, t, 900, 0.04); };

// ---------- shared phrases
const coinRing = (c: Ctx, o: Out, t: number, k = 1) => [0, 0.14, 0.24].forEach((dt, i) => metal(c, o, t + dt, 3900, 0.11 * k / (1 + i), 0.45 / (1 + i), [1, 1.5, 2.7, 4.1]));
const turnBell = (c: Ctx, o: Out, t: number) => { metal(c, o, t, 220, 0.2, 3, [1, 2.4, 3.9, 5.6]); thump(c, o, t, 70, 0.3, 0.4); };
const lidCreak = (c: Ctx, o: Out, t: number) => { creak(c, o, t, 1.0, 60, 600, 0.34); creak(c, o, t + 0.2, 0.7, 95, 1100, 0.12); thump(c, o, t + 1.05, 110, 0.42, 0.25); noise(c, o, t + 1.05, { type: 'lowpass', f: 400, gain: 0.16, d: 0.15 }); };
const bodyHit = (c: Ctx, o: Out, t: number) => { thump(c, o, t, 60, 0.8, 0.3); noise(c, o, t, { type: 'lowpass', f: 400, gain: 0.34, d: 0.15 }); noise(c, o, t, { f: 2000, q: 0.8, gain: 0.12, d: 0.04 }); };
const lowSwell = (c: Ctx, o: Out, t: number, notes: readonly number[], gain = 0.07, d = 1.6) => notes.forEach(m => [-7, 7].forEach(det => tone(c, o, t, { type: 'sawtooth', f: midi(m), det, gain, a: 0.25, hold: 0.2, d, lp: 700 })));
const sting = (c: Ctx, o: Out, t: number, notes: readonly number[], gap = 0.12) => notes.forEach((m, i) => musicBox(c, o, t + i * gap, m, 0.12, 1.8));
const fabric = (c: Ctx, o: Out, t: number, gain = 0.16) => { noise(c, o, t, { f: 500, fEnd: 1600, q: 0.7, gain, a: 0.2, d: 0.2 }); noise(c, o, t + 0.35, { f: 1600, fEnd: 350, q: 0.7, gain: gain * 0.8, a: 0.05, d: 0.35 }); };
const paper = (c: Ctx, o: Out, t: number) => { noise(c, o, t, { f: 2400, fEnd: 900, q: 0.8, gain: 0.14, a: 0.04, hold: 0.12, d: 0.18 }); click(c, o, t + 0.32, 2500, 0.07); };

/* Timelines below mirror ACTION_DURATION and the clip beats:
   knife 2.7s (jab peaks .93/1.47, snap 1.7) · pistol 2.8s (cock 1.0, fire 1.5) · medicine 4.2s (unscrew .6–1.8, pop 2.3, drink 3.1)
   antidote 3.3s (flicks 1.0, needle 1.9) · poison 3.2s (uncork .5, drips 1.45+) · handcuffs 2.6s (snap 1.25) · armor break 1.1
   chest tools: key insert 1.0 turn 1.5 open 2.0 · lockpick pick 1.1–2.2 · crowbar pry 1.3 burst 1.7 · black key turn 1.5 open 2.1 */
const KNIFE: Voice = (c, o, t) => {
  noise(c, o, t + 0.1, { f: 700, fEnd: 2600, q: 1.2, gain: 0.14, a: 0.25, d: 0.15 });
  [0.93, 1.47].forEach(hit => { thump(c, o, t + hit, 120, 0.6, 0.14); noise(c, o, t + hit, { type: 'lowpass', f: 700, q: 0.5, gain: 0.28, d: 0.12 }); noise(c, o, t + hit, { f: 300, q: 2, gain: 0.16, d: 0.22 }); });
  metal(c, o, t + 1.7, 2300, 0.2, 0.35, [1, 2.1, 3.3]); click(c, o, t + 1.7, 2500, 0.35); [2.05, 2.13, 2.19].forEach((dt, i) => metal(c, o, t + dt, 1600 + i * 600, 0.07, 0.12));
};
const PISTOL: Voice = (c, o, t) => {
  [1.0, 1.14].forEach((dt, i) => { click(c, o, t + dt, 2000, 0.42, 0.01); metal(c, o, t + dt, i ? 1300 : 1700, 0.1, 0.08, [1, 2.7]); });
  noise(c, o, t + 1.5, { type: 'lowpass', f: 4000, fEnd: 600, gain: 0.95, a: 0.001, d: 0.5 }); thump(c, o, t + 1.5, 60, 0.95, 0.45);
  noise(c, o, t + 1.5, { type: 'highpass', f: 2500, gain: 0.5, d: 0.03 }); noise(c, o, t + 1.55, { type: 'lowpass', f: 300, gain: 0.2, a: 0.05, d: 1.4 });
  metal(c, o, t + 2.0, 3400, 0.05, 0.2, [1, 2.3]);
};
const MEDICINE: Voice = (c, o, t) => {
  for (let i = 0; i < 12; i += 1) noise(c, o, t + 0.6 + i * 0.1 + rnd() * 0.03, { f: 2600, q: 9, gain: 0.12 + rnd() * 0.05, d: 0.02 });
  tone(c, o, t + 2.3, { f: 700, fEnd: 160, gain: 0.3, d: 0.07 }); noise(c, o, t + 2.3, { f: 1800, gain: 0.16, d: 0.03 }); thump(c, o, t + 2.65, 300, 0.16, 0.05);
  [3.25, 3.55, 3.85].forEach(dt => { tone(c, o, t + dt, { f: 160, fEnd: 80, gain: 0.34, a: 0.02, d: 0.14, lp: 500 }); noise(c, o, t + dt, { type: 'lowpass', f: 500, gain: 0.12, a: 0.02, d: 0.12 }); });
  sting(c, o, t + 3.6, [74, 78, 81], 0.09);
};
const ANTIDOTE: Voice = (c, o, t) => {
  [1.0, 1.18].forEach(dt => metal(c, o, t + dt, 4300, 0.07, 0.08, [1, 2.2]));
  thump(c, o, t + 1.9, 200, 0.14, 0.05); noise(c, o, t + 2.0, { type: 'highpass', f: 3500, gain: 0.045, a: 0.1, hold: 0.35, d: 0.15 }); tone(c, o, t + 2.0, { f: 300, fEnd: 250, gain: 0.04, a: 0.05, hold: 0.3, d: 0.1 });
  sting(c, o, t + 2.5, [69, 74, 76], 0.08);
};
const POISON: Voice = (c, o, t) => {
  tone(c, o, t + 0.5, { f: 500, fEnd: 220, gain: 0.26, d: 0.08 }); noise(c, o, t + 0.5, { f: 1200, gain: 0.12, d: 0.05 });
  [1.45, 1.54, 1.63, 1.72, 1.81, 1.9, 1.99, 2.08].forEach(dt => { tone(c, o, t + dt + 0.25, { f: 900, fEnd: 1900, gain: 0.12, a: 0.002, d: 0.05 }); noise(c, o, t + dt + 0.25, { f: 500, q: 4, gain: 0.035, d: 0.05 }); });
  lowSwell(c, o, t + 1.5, [38, 39], 0.035, 1.2);
};
const HANDCUFFS: Voice = (c, o, t) => {
  metal(c, o, t + 0.4, 1700, 0.06, 0.15); for (let i = 0; i < 7; i += 1) { click(c, o, t + 1.22 + i * 0.035, 2800, 0.26); metal(c, o, t + 1.22 + i * 0.035, 2600, 0.03, 0.03); }
  metal(c, o, t + 1.5, 1700, 0.17, 0.3, [1, 2.7, 4.4]); thump(c, o, t + 1.5, 200, 0.18, 0.06);
};
const ARMOR_BREAK: Voice = (c, o, t) => {
  noise(c, o, t + 1.1, { f: 1500, q: 0.9, gain: 0.5, d: 0.18 }); metal(c, o, t + 1.1, 520, 0.26, 0.9, [1, 2.4, 3.7, 5.2]); thump(c, o, t + 1.1, 80, 0.5, 0.3);
  [1.55, 1.65, 1.72].forEach((dt, i) => { metal(c, o, t + dt, 900 + i * 250, 0.08, 0.2); thump(c, o, t + dt, 200, 0.12, 0.06); });
};
const KEY: Voice = (c, o, t) => { noise(c, o, t + 1.0, { f: 3000, q: 3, gain: 0.1, a: 0.03, d: 0.25 }); click(c, o, t + 1.5, 1500, 0.28); thump(c, o, t + 1.6, 150, 0.42, 0.12); metal(c, o, t + 1.6, 820, 0.13, 0.3, [1, 2.3, 3.9]); };
const LOCKPICK: Voice = (c, o, t) => { for (let i = 0; i < 14; i += 1) { const k = t + 1.1 + i * 0.075 + rnd() * 0.04; metal(c, o, k, 2400 + rnd() * 1600, 0.03 + rnd() * 0.03, 0.04, [1, 2.2]); click(c, o, k, 4000, 0.08); } thump(c, o, t + 2.15, 160, 0.36, 0.12); metal(c, o, t + 2.15, 700, 0.13, 0.25, [1, 2.5]); };
const CROWBAR: Voice = (c, o, t) => { creak(c, o, t + 1.0, 0.7, 50, 500, 0.4); noise(c, o, t + 1.7, { f: 1200, q: 0.8, gain: 0.6, d: 0.12 }); [1.7, 1.74, 1.79, 1.85, 1.92].forEach(dt => { click(c, o, t + dt, 1500, 0.26); noise(c, o, t + dt, { f: 2200, q: 4, gain: 0.13, d: 0.03 }); }); thump(c, o, t + 1.73, 90, 0.42, 0.2); };
const BLACK_KEY: Voice = (c, o, t) => { tone(c, o, t + 0.4, { f: 110, gain: 0.05, a: 0.4, hold: 0.8, d: 0.6 }); KEY(c, o, t); metal(c, o, t + 2.5, 523, 0.08, 2.4, [1, 2.01, 3.02, 4.2]); };

const handle = (kind: 'metal' | 'glass' | 'cloth' | 'wood' | 'paper' | 'coin'): Voice => (c, o, t) => {
  if (kind === 'metal') { metal(c, o, t, 1900, 0.06, 0.12, [1, 2.6]); thump(c, o, t, 260, 0.18, 0.06); }
  else if (kind === 'glass') { metal(c, o, t, 3600, 0.06, 0.18, [1, 2.2, 3.1]); thump(c, o, t, 320, 0.1, 0.04); }
  else if (kind === 'cloth') noise(c, o, t, { f: 900, fEnd: 400, q: 0.7, gain: 0.12, a: 0.05, d: 0.18 });
  else if (kind === 'wood') { thump(c, o, t, 140, 0.35, 0.1); noise(c, o, t, { f: 800, q: 2, gain: 0.12, d: 0.05 }); }
  else if (kind === 'paper') paper(c, o, t);
  else coinRing(c, o, t, 0.8);
};

export const VOICES: Readonly<Record<AudioCueId, Voice>> = {
  'ui.select': (c, o, t) => { noise(c, o, t, { f: 1800, q: 4, gain: 0.26, d: 0.05 }); thump(c, o, t, 240, 0.2, 0.07); noise(c, o, t + 0.03, { f: 600, fEnd: 1400, gain: 0.05, a: 0.08, d: 0.2 }); },
  'ui.set-down': (c, o, t) => { thump(c, o, t, 160, 0.36, 0.1); noise(c, o, t, { f: 1200, q: 3, gain: 0.16, d: 0.05 }); },
  'ui.confirm': (c, o, t) => { thump(c, o, t, 90, 0.5, 0.18); noise(c, o, t, { f: 600, q: 1.5, gain: 0.2, d: 0.08 }); tone(c, o, t, { type: 'triangle', f: 147, gain: 0.09, d: 0.5, lp: 900 }); },
  'ui.reject': (c, o, t) => [0, 0.16].forEach(dt => [98, 104].forEach(f => tone(c, o, t + dt, { type: 'sawtooth', f, gain: 0.1, hold: 0.09, d: 0.04, lp: 800 }))),
  'ui.coins': (c, o, t) => coinRing(c, o, t),
  'ui.pocket': (c, o, t) => { creak(c, o, t, 0.18, 140, 2200, 0.08); thump(c, o, t + 0.2, 300, 0.2, 0.05); click(c, o, t + 0.22, 2600, 0.12); },
  'ui.inventory': (c, o, t) => { thump(c, o, t, 180, 0.3, 0.08); noise(c, o, t, { f: 1400, q: 2, gain: 0.1, d: 0.06 }); },
  'lobby.join': (c, o, t) => { creak(c, o, t, 0.5, 70, 700, 0.2); thump(c, o, t + 0.5, 100, 0.35, 0.2); },
  'lobby.ready': (c, o, t) => { thump(c, o, t, 110, 0.4, 0.15); metal(c, o, t, 880, 0.05, 0.4, [1, 2.4]); },
  'lobby.match': (c, o, t) => { turnBell(c, o, t); lowSwell(c, o, t + 0.1, [38, 45], 0.04, 2.4); },

  'item.knife': KNIFE, 'item.pistol': PISTOL, 'item.poison': POISON, 'item.medicine': MEDICINE,
  'item.stimulant': (c,o,t) => { click(c,o,t,5200,.16); noise(c,o,t,{type:'highpass',f:5000,gain:.08,d:.05}); noise(c,o,t+.3,{type:'lowpass',f:600,gain:.08,a:.04,d:.25}); },
  'item.antidote': ANTIDOTE, 'item.handcuffs': HANDCUFFS,
  'item.bullet': (c, o, t) => { metal(c, o, t, 3400, 0.08, 0.12, [1, 2.3]); click(c, o, t, 3000, 0.26); [0.25, 0.3, 0.35].forEach(dt => click(c, o, t + dt, 2200, 0.2)); click(c, o, t + 0.55, 1800, 0.4); thump(c, o, t + 0.55, 400, 0.13, 0.05); },
  'item.armor': (c, o, t) => { creak(c, o, t, 0.45, 70, 700, 0.26); metal(c, o, t + 0.45, 1900, 0.08, 0.15, [1, 2.6]); thump(c, o, t + 0.5, 110, 0.42, 0.2); },
  'item.cloth': (c, o, t) => fabric(c, o, t),
  'item.bag': (c, o, t) => { creak(c, o, t, 0.3, 120, 1800, 0.08); metal(c, o, t + 0.3, 2900, 0.04, 0.1); thump(c, o, t + 0.7, 180, 0.25, 0.08); },
  'item.safe': (c, o, t) => { [0, 0.07, 0.14, 0.21, 0.35, 0.42, 0.49, 0.62, 0.69].forEach(dt => click(c, o, t + dt, 3200, 0.2)); thump(c, o, t + 0.85, 90, 0.6, 0.3); metal(c, o, t + 0.85, 300, 0.17, 0.6, [1, 2.1, 3.3]); },
  'item.spyglass': (c, o, t) => { noise(c, o, t, { f: 1800, fEnd: 3600, q: 6, gain: 0.1, a: 0.05, hold: 0.2, d: 0.1 }); click(c, o, t + 0.4, 3000, 0.3); },
  'item.pickpocket': (c, o, t) => { metal(c, o, t, 3200, 0.05, 0.08, [1, 2.4]); creak(c, o, t + 0.2, 0.25, 140, 2200, 0.09); noise(c, o, t + 0.55, { f: 2500, fEnd: 900, q: 2, gain: 0.08, d: 0.2 }); },
  'item.key': KEY, 'item.lockpick': LOCKPICK, 'item.crowbar': CROWBAR, 'item.black-key': BLACK_KEY,
  'item.brass-idol': (c, o, t) => { metal(c, o, t, 330, 0.12, 2.2, [1, 2.76, 5.4]); thump(c, o, t, 150, 0.25, 0.1); },
  'item.glass-eye': (c, o, t) => { metal(c, o, t, 2800, 0.06, 0.4, [1, 2.2, 3.1]); [0.18, 0.3, 0.38].forEach((dt, i) => metal(c, o, t + dt, 2800, 0.03 / (1 + i), 0.12, [1, 2.2])); },
  'item.red-ledger': (c, o, t) => paper(c, o, t),
  'item.passage-token': (c, o, t) => { metal(c, o, t, 523, 0.1, 3.5, [1, 2.01, 3.02, 4.2]); tone(c, o, t, { f: 131, gain: 0.09, a: 0.8, hold: 0.5, d: 1.5 }); tone(c, o, t, { f: 196, gain: 0.05, a: 1, d: 1.5 }); },
  'item.chest': (c, o, t) => lidCreak(c, o, t),

  'event.match-started': (c, o, t) => { turnBell(c, o, t); lowSwell(c, o, t, [38, 45, 50], 0.035, 3); },
  'event.match-ended': (c, o, t) => { lowSwell(c, o, t, [38, 45], 0.04, 3); metal(c, o, t, 196, 0.12, 3.5, [1, 2.4, 3.9]); },
  'event.turn-started': (c, o, t) => { thump(c, o, t, 70, 0.22, 0.3); metal(c, o, t, 440, 0.03, 0.8, [1, 2.4]); },
  'event.turn-ended': (c, o, t) => { thump(c, o, t, 120, 0.2, 0.1); noise(c, o, t, { f: 900, q: 2, gain: 0.06, d: 0.08 }); },
  'event.intermission': (c, o, t) => { [0, 0.11].forEach(dt => metal(c, o, t + dt, 1450, 0.12, 1.4, [1, 2.76, 5.4])); },
  'event.shopper-skipped': (c, o, t) => { noise(c, o, t, { f: 900, fEnd: 400, gain: 0.12, d: 0.15 }); tone(c, o, t, { type: 'triangle', f: 110, gain: 0.08, d: 0.25, lp: 700 }); },
  'event.trade-offered': (c, o, t) => { paper(c, o, t); thump(c, o, t + 0.35, 200, 0.12, 0.05); },
  'event.trade-accepted': (c, o, t) => { thump(c, o, t, 110, 0.36, 0.15); coinRing(c, o, t + 0.1, 0.7); },
  'event.trade-declined': (c, o, t) => { paper(c, o, t); tone(c, o, t + 0.1, { type: 'triangle', f: 98, gain: 0.08, d: 0.3, lp: 700 }); },
  'event.trade-cancelled': (c, o, t) => noise(c, o, t, { f: 1600, fEnd: 500, gain: 0.08, d: 0.2 }),
  'event.threat-offered': (c, o, t) => { lowSwell(c, o, t, [38, 39, 45], 0.06, 1.6); thump(c, o, t, 45, 0.42, 0.5); },
  'event.threat-complied': (c, o, t) => { thump(c, o, t, 80, 0.3, 0.2); tone(c, o, t, { type: 'triangle', f: midi(50), gain: 0.06, d: 1.2, lp: 900 }); },
  'event.threat-refused': (c, o, t) => { thump(c, o, t, 55, 0.5, 0.3); lowSwell(c, o, t, [38, 44], 0.05, 1.0); },
  'event.threat-cancelled': (c, o, t) => tone(c, o, t, { type: 'sawtooth', f: midi(45), fEnd: midi(38), gain: 0.05, a: 0.05, d: 0.8, lp: 600 }),
  'event.weapon-used': (c, o, t) => noise(c, o, t, { type: 'lowpass', f: 200, gain: 0.08, a: 0.1, d: 0.4 }),
  'event.damage': (c, o, t) => bodyHit(c, o, t),
  'event.poison-tick': (c, o, t) => { heart(c, o, t, 0.3); tone(c, o, t, { type: 'sawtooth', f: midi(39), gain: 0.03, a: 0.2, d: 0.8, lp: 500 }); },
  'event.healed': (c, o, t) => MEDICINE(c, o, t),
  'event.poison-cured': (c, o, t) => ANTIDOTE(c, o, t),
  'event.armor-blocked': (c, o, t) => ARMOR_BREAK(c, o, t),
  'event.handcuffed': (c, o, t) => HANDCUFFS(c, o, t),
  'event.downed': (c, o, t) => { thump(c,o,t+.25,70,.3,.14); noise(c,o,t+.25,{type:'lowpass',f:500,gain:.18,d:.2}); creak(c,o,t+.35,.3,80,700,.1); },
  'event.revived': (c, o, t) => { MEDICINE(c, o, t); heart(c, o, t + 3.9, 0.35); },
  'event.looted': (c, o, t) => { fabric(c, o, t, 0.1); coinRing(c, o, t + 0.3, 0.6); },
  'event.death': (c, o, t) => { [38, 39, 44].forEach(m => piano(c, o, t, m, 0.2, 3, 1200)); heart(c, o, t, 0.42); thump(c, o, t + 1.2, 46, 0.2, 0.25); tone(c, o, t, { f: 70, fEnd: 30, gain: 0.26, d: 2.5 }); },
  'event.exit': (c, o, t) => { thump(c, o, t, 80, 0.55, 0.3); metal(c, o, t, 380, 0.17, 1.2, [1, 2.2, 3.5]); creak(c, o, t + 0.35, 1.2, 45, 400, 0.26); },
  'event.results': (c, o, t) => { [62, 66, 69, 74].forEach((m, i) => piano(c, o, t + i * 0.07, m, 0.12, 3.5)); metal(c, o, t, 294, 0.08, 3, [1, 2.4, 3.9]); },
  'event.chest-refreshed': (c, o, t) => { thump(c, o, t, 120, 0.3, 0.15); metal(c, o, t, 820, 0.06, 0.4, [1, 2.3]); },
  'event.chest-opened': (c, o, t) => lidCreak(c, o, t),
  'event.chest-inspected': (c, o, t) => creak(c, o, t, 0.3, 75, 800, 0.11),
  'event.purchased': (c, o, t) => { coinRing(c, o, t, 0.8); thump(c, o, t + 0.2, 150, 0.2, 0.08); },
  'event.sold': (c, o, t) => { thump(c, o, t, 150, 0.2, 0.08); coinRing(c, o, t + 0.15, 0.8); },
  'event.pocket-filled': (c, o, t) => { creak(c, o, t, 0.18, 140, 2200, 0.07); click(c, o, t + 0.2, 2600, 0.14); },
  'event.market-rerolled': (c, o, t) => { noise(c, o, t, { f: 280, q: 1.5, gain: 0.12, a: 0.3, d: 0.6 }); metal(c, o, t + 0.3, 3100, 0.03, 0.3); },
  'event.pocket-inspected': (c, o, t) => creak(c, o, t, 0.25, 140, 2200, 0.07),
  'event.pickpocketed': (c, o, t) => { metal(c, o, t, 3200, 0.05, 0.08, [1, 2.4]); noise(c, o, t + 0.3, { f: 2500, fEnd: 900, q: 2, gain: 0.08, d: 0.2 }); },
  'event.objective-ready': (c, o, t) => { sting(c, o, t, [74, 77, 81, 86], 0.14); metal(c, o, t, midi(50), 0.13, 3, [1, 2.4, 3.9]); },
  'event.objective-locked': (c, o, t) => tone(c, o, t, { type: 'sawtooth', f: midi(50), fEnd: midi(45), gain: 0.05, a: 0.05, d: 0.9, lp: 600 }),
  'event.objective-banked': (c, o, t) => { thump(c, o, t, 70, 0.7, 0.25); noise(c, o, t, { f: 500, gain: 0.3, d: 0.07 }); },
  'event.overflow': (c, o, t) => { [0, 0.16].forEach(dt => tone(c, o, t + dt, { type: 'sawtooth', f: 98, gain: 0.08, hold: 0.09, d: 0.04, lp: 800 })); },
  'event.overflow-resolved': (c, o, t) => { thump(c, o, t, 160, 0.3, 0.1); },
  'private.inspection': (c, o, t) => { noise(c, o, t, { f: 1800, fEnd: 3600, q: 6, gain: 0.08, a: 0.05, hold: 0.2, d: 0.1 }); click(c, o, t + 0.4, 3000, 0.22); },
  'private.chest-inspection': (c, o, t) => creak(c, o, t, 0.3, 75, 800, 0.12),
  'turn.start': (c, o, t) => turnBell(c, o, t),
  'turn.end': (c, o, t) => thump(c, o, t, 120, 0.2, 0.1),
  'turn.warning': (c, o, t) => { click(c, o, t, 5000, 0.26, 0.006); metal(c, o, t, 2600, 0.05, 0.04); },
  'turn.response-warning': (c, o, t) => { click(c, o, t, 5000, 0.28, 0.006); metal(c, o, t, 2600, 0.06, 0.04); thump(c, o, t, 55, 0.3, 0.2); },
  'world.door': (c, o, t) => { creak(c, o, t, 0.9, 50, 450, 0.24); thump(c, o, t + 0.95, 80, 0.45, 0.3); },
  'world.door-open': (c, o, t) => { click(c, o, t, 1600, .2, .01); thump(c, o, t + .02, 140, .2, .06); creak(c, o, t + .12, .9, 60, 520, .28); noise(c, o, t + .3, { type: 'lowpass', f: 900, gain: .14, a: .4, d: .9 }); },
  'world.exit-through': (c, o, t) => { noise(c, o, t, { type: 'bandpass', f: 500, q: .6, gain: .16, a: .3, d: 1.1 }); tone(c, o, t + .1, { f: 55, gain: .08, a: .4, d: 1, type: 'sine' }); },
  'world.footstep': (c, o, t) => { thump(c, o, t, 85, 0.3, 0.08); noise(c, o, t, { f: 600, q: 1, gain: 0.08, d: 0.06 }); },
  'world.chair': (c, o, t) => { creak(c, o, t, 0.35, 90, 800, 0.2); thump(c, o, t + 0.38, 120, 0.3, 0.12); },
  'world.chair-scrape': (c,o,t) => { creak(c,o,t,.62,70,700,.3); noise(c,o,t,{type:'bandpass',f:1300,q:2.2,gain:.1,a:.05,d:.6}); thump(c,o,t+.62,120,.1,.05); },
  'world.chair-settle': (c,o,t) => { thump(c,o,t,80,.26,.1); creak(c,o,t+.05,.35,85,900,.16); noise(c,o,t+.32,{type:'bandpass',f:1100,q:2,gain:.05,d:.2}); },
  'world.table-settle': (c, o, t) => { thump(c, o, t, 70, 0.4, 0.2); noise(c, o, t, { type: 'lowpass', f: 350, gain: 0.12, d: 0.2 }); },
  'world.coin-scatter': (c, o, t) => { for (let i = 0; i < 6; i += 1) metal(c, o, t + i * 0.06 + rnd() * 0.04, 3600 + rnd() * 600, 0.07, 0.3, [1, 1.5, 2.7]); },
  'world.room': (c, o, t) => tone(c, o, t, { f: 50, gain: 0.02, a: 0.2, hold: 0.8, d: 0.2 }),
  'world.shop': (c, o, t) => { [0, 0.11].forEach(dt => metal(c, o, t + dt, 1450, 0.1, 1.2, [1, 2.76, 5.4])); },
  'intro.sting': (c, o, t) => { lowSwell(c, o, t, [38, 45], 0.04, 2.4); piano(c, o, t + 0.2, 50, 0.14, 4); },
  'task.reveal': (c,o,t) => { noise(c,o,t,{type:'bandpass',f:2600,q:.8,gain:.16,a:.02,d:.22}); thump(c,o,t+.2,180,.08,.05); },
  'task.stamp': (c,o,t) => { thump(c,o,t,120,.45,.09); noise(c,o,t,{type:'lowpass',f:900,gain:.3,d:.06}); click(c,o,t+.004,1800,.12); },
  'task.coin': (c,o,t) => { [0,.11].forEach((d,i) => { tone(c,o,t+.1+d,{f:2350+i*180,gain:.07,d:.35}); tone(c,o,t+.1+d,{f:5200+i*300,gain:.03,d:.12}); }); },
  'task.cancel': (c,o,t) => noise(c,o,t,{type:'bandpass',f:1400,q:1.6,gain:.12,a:.01,d:.16}),
  'turn.switch': (c,o,t) => { click(c,o,t,2200,.16); thump(c,o,t+.01,300,.1,.04); click(c,o,t+.16,1500,.08); },
  'tutorial.page': (c,o,t) => { noise(c,o,t,{type:'bandpass',f:1900,q:.7,gain:.1,a:.04,d:.3}); tone(c,o,t+.05,{type:'triangle',f:330,gain:.03,a:.05,d:.4}); },
  'handle.metal': handle('metal'), 'handle.glass': handle('glass'), 'handle.cloth': handle('cloth'), 'handle.wood': handle('wood'), 'handle.paper': handle('paper'), 'handle.coin': handle('coin'),
};

/** Play a cue `delay` seconds from now. Cues are fire-and-forget; their nodes stop themselves. */
export function playProcedural(context: AudioContextLike, cue: AudioCueId, master: GainNodeLike, delay = 0): void {
  const origin = context.currentTime + .01 + Math.max(0, delay);
  const scale: Partial<Record<AudioCueId, number>> = { 'item.knife': .8/2.7, 'item.pistol': .8/2.8, 'item.medicine': .8/4.2, 'event.healed': .8/4.2, 'event.revived': .8/4.2, 'item.stimulant': .8/2, 'item.antidote': .8/3.3, 'event.poison-cured': .8/3.3, 'item.poison': .8/3.2, 'item.handcuffs': .8/2.6, 'event.handcuffed': .8/2.6, 'item.armor': .8/2.6, 'event.armor-blocked': .8/2.6, 'item.key': .3, 'item.lockpick': .3, 'item.crowbar': .3, 'item.black-key': .3 };
  // Recipes schedule synchronously; only their envelopes and offsets are retimed.
  // Frequencies and the continuously running music clock retain their original pitch.
  const previous = cueTiming.get(context);
  if (scale[cue]) cueTiming.set(context, { origin, scale: scale[cue]! });
  try { VOICES[cue](context, master, origin); }
  finally { if (previous) cueTiming.set(context, previous); else cueTiming.delete(context); }
}

// ---------- master chain
function satCurve(k: number): Float32Array { const n = 2048, c = new Float32Array(n); for (let i = 0; i < n; i += 1) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); } return c; }
function crushCurve(grit: number): Float32Array { const steps = Math.round(512 - grit * 464), n = 8192, c = new Float32Array(n); for (let i = 0; i < n; i += 1) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.round(x * steps) / steps; } return c; }
function roomImpulse(c: Ctx, seconds: number): BufferLike {
  const n = Math.max(1, Math.floor(c.sampleRate * seconds)), b = c.createBuffer(2, n, c.sampleRate), pre = c.sampleRate * 0.012;
  for (let ch = 0; ch < 2; ch += 1) { const d = b.getChannelData?.(ch); if (!d) continue; let y = 0; for (let i = 0; i < d.length; i += 1) { y = y * 0.55 + (rnd() * 2 - 1) * 0.45; d[i] = y * Math.pow(1 - i / d.length, 2.8) * (i < pre ? i / pre : 1); } }
  return b;
}
export interface MasterChain { input: GainNodeLike; nodes: AudioNodeLike[] }
/** The input feeds tape saturation → crush (grit .45) → lowpass 7.5 kHz → dry + 2.6 s dark room (.3) → compressor → destination. */
export function createMasterChain(c: Ctx, destination: AudioNodeLike): MasterChain {
  const input = c.createGain(); input.gain.value = 1;
  if (!c.createWaveShaper || !c.createConvolver || !c.createDynamicsCompressor) { input.connect(destination); return { input, nodes: [input] }; }
  const sat = c.createWaveShaper(), crush = c.createWaveShaper(), lp = c.createBiquadFilter(), hp = c.createBiquadFilter(), verb = c.createConvolver(), wet = c.createGain(), dry = c.createGain(), comp = c.createDynamicsCompressor();
  sat.curve = satCurve(1.8); crush.curve = crushCurve(0.45);
  lp.type = 'lowpass'; lp.frequency.value = 7500; lp.Q.value = 0.5; hp.type = 'highpass'; hp.frequency.value = 32;
  verb.buffer = roomImpulse(c, 2.6); wet.gain.value = 0.3; dry.gain.value = 1; comp.threshold.value = -14; comp.ratio.value = 3;
  input.connect(sat); sat.connect(crush); crush.connect(lp); lp.connect(hp); hp.connect(dry); hp.connect(verb); verb.connect(wet); dry.connect(comp); wet.connect(comp); comp.connect(destination);
  return { input, nodes: [input, sat, crush, lp, hp, verb, wet, dry, comp] };
}

// ---------- music
interface Track { bpm: number; beats: number; bars: number; bar(c: Ctx, o: Out, t: number, bar: number, spb: number): void }
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];
const pad = (c: Ctx, o: Out, t: number, notes: readonly number[], dur: number, x: { type?: string; lp?: number; gain?: number; rel?: number } = {}) => {
  notes.forEach(m => [-9, 0, 8].forEach(det => {
    const s = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain(), at = dur * 0.35, gv = x.gain ?? 0.04, rel = x.rel ?? 1;
    s.type = x.type ?? 'sawtooth'; s.frequency.value = midi(m); if (s.detune) s.detune.value = det + (rnd() - 0.5) * 5;
    f.type = 'lowpass'; f.frequency.value = x.lp ?? 600; g.gain.value = 0.0001;
    setAt(g.gain, 0.0001, t); linTo(g.gain, gv, t + at); setAt(g.gain, gv, t + dur * 0.7); linTo(g.gain, 0.0001, t + dur + rel);
    s.connect(f); f.connect(g); g.connect(o); s.start(t); s.stop(t + dur + rel + 0.1);
  }));
};
const hum = (c: Ctx, o: Out, t: number, dur: number, f = 50, g = 0.012) => { tone(c, o, t, { f, gain: g, a: 0.05, hold: dur - 0.1, d: 0.05 }); tone(c, o, t, { f: f * 2, gain: g * 0.5, a: 0.05, hold: dur - 0.1, d: 0.05 }); };
const crackle = (c: Ctx, o: Out, t: number, dur: number) => { for (let i = 0; i < 6; i += 1) click(c, o, t + rnd() * dur, 2500 + rnd() * 3000, 0.015 + rnd() * 0.04, 0.004); };
const tremolo = (c: Ctx, o: Out, t: number, notes: readonly number[], dur: number, g0: number, g1: number, rate: number) => notes.forEach(m => [-6, 6].forEach(det => {
  const s = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain(); s.type = 'sawtooth'; s.frequency.value = midi(m); if (s.detune) s.detune.value = det; f.type = 'lowpass'; f.frequency.value = 2200; g.gain.value = 0;
  const n = Math.floor(dur * rate); for (let k = 0; k < n; k += 1) { const v = g0 + (g1 - g0) * k / n; setAt(g.gain, k % 2 ? v * 0.25 : v, t + k / rate); } setAt(g.gain, 0, t + dur);
  s.connect(f); f.connect(g); g.connect(o); s.start(t); s.stop(t + dur + 0.05);
}));

/** Bar generators are seeded per bar so a loop sounds the same every pass. */
export const MUSIC: Readonly<Record<'table' | 'threat' | 'shop' | 'market' | 'after', Track>> = {
  // "The Table" — D Phrygian 54 BPM: drone, heartbeat kick, the lamp's 50 Hz hum, a piano that never finishes a phrase.
  table: { bpm: 54, beats: 4, bars: 8, bar(c, o, t, b, spb) { const r = seeded(b * 131 + 7), root = [50, 51, 50, 48][(b >> 1) % 4] ?? 50;
    if (b % 2 === 0) pad(c, o, t, [root - 12, root - 5], spb * 8, { lp: 380, gain: 0.038, rel: 2.5 });
    heart(c, o, t, 0.42); hum(c, o, t, spb * 4);
    if (b % 4 === 0) piano(c, o, t, root - 12, 0.15, 4);
    for (let i = 0; i < 8; i += 1) if (r() < 0.18) piano(c, o, t + i * spb / 2, 62 + (PHRYGIAN[Math.floor(r() * 7)] ?? 0) + (r() < 0.3 ? 12 : 0), 0.1, 3); } },
  // "Leverage" — layered over the bed while a threat is open; the tremolo tightens over four bars.
  threat: { bpm: 104, beats: 4, bars: 4, bar(c, o, t, b, spb) {
    [38, 38, 50, 38, 38, 51, 38, 50].forEach((m, i) => pizz(c, o, t + i * spb / 2, m, i % 4 === 0 ? 0.32 : 0.19));
    thump(c, o, t, 55, 0.45, 0.3); thump(c, o, t + 2 * spb, 55, 0.36, 0.3);
    tremolo(c, o, t, [74, 75], spb * 4, 0.008 + (b % 4) * 0.007, 0.012 + (b % 4) * 0.008, 12 / spb);
    if (b % 4 === 3) for (let i = 0; i < 8; i += 1) thump(c, o, t + 3 * spb + i * spb / 8, 70, 0.08 + i * 0.03, 0.1); } },
  // "The Tallyman's Shelf" — out-of-tune parlour waltz in D Dorian, a ticking shop clock.
  shop: { bpm: 84, beats: 3, bars: 8, bar(c, o, t, b, spb) { const r = seeded(b * 57 + 3);
    const ch = ([[50, 53, 57], [43, 47, 50], [45, 48, 52], [50, 53, 57], [46, 50, 53], [43, 47, 50], [45, 49, 52], [50, 53, 57]] as const)[b % 8]!;
    piano(c, o, t, ch[0] < 45 ? ch[0] : ch[0] - 12, 0.17, 1.8);
    [1, 2].forEach(k => ch.forEach(m => piano(c, o, t + k * spb, m + 12, 0.05, 1)));
    if (r() < 0.7) piano(c, o, t, (ch[Math.floor(r() * 3)] ?? 50) + 24, 0.08, 2);
    if (r() < 0.45) piano(c, o, t + 1.5 * spb, 74 + ([0, 2, 3, 5, 7, 9, 10][Math.floor(r() * 7)] ?? 0), 0.06, 1.2);
    for (let k = 0; k < 3; k += 1) click(c, o, t + k * spb, k % 2 ? 2400 : 3600, 0.09, 0.008); } },
  // "Under the Table" — Black Market: chromatic pizz walk down, velvet whispers, a coin glints somewhere.
  market: { bpm: 60, beats: 4, bars: 8, bar(c, o, t, b, spb) { const r = seeded(b * 89 + 11), m = [50, 49, 48, 47, 46, 47, 48, 49][b % 8] ?? 50;
    if (b % 4 === 0) pad(c, o, t, [34, 46, 47], spb * 16, { lp: 320, gain: 0.042, rel: 3 });
    hum(c, o, t, spb * 4, 41, 0.016); pizz(c, o, t, m - 12, 0.3); pizz(c, o, t + 2 * spb, m - 12, 0.2);
    if (b % 2 === 1) noise(c, o, t + spb, { f: 1400, q: 4, gain: 0.03, a: 1.2, hold: 0.3, d: 1.8 });
    if (r() < 0.35) metal(c, o, t + spb * (1 + r() * 2), 3100, 0.018, 0.3); } },
  // "After" — spectator: cold glass pad, wind under the door, a music box in another room.
  after: { bpm: 48, beats: 4, bars: 8, bar(c, o, t, b, spb) { const r = seeded(b * 23 + 5);
    if (b % 4 === 0) pad(c, o, t, [57, 64, 71, 74], spb * 16, { type: 'triangle', lp: 2800, gain: 0.02, rel: 3 });
    if (b % 2 === 0) noise(c, o, t, { type: 'lowpass', f: 500, q: 0.5, gain: 0.045, a: 2, hold: 1, d: 2 });
    if (r() < 0.55) musicBox(c, o, t + spb * Math.floor(r() * 4), [69, 72, 74, 76, 79, 81, 84][Math.floor(r() * 7)] ?? 69, 0.065, 2.5); } },
};

export interface MusicLayer { stop(fade?: number): void }
/** Schedules a looping track ~1.2 s ahead of the audio clock. Fades in over `fade` seconds. */
export function startMusic(c: Ctx, out: AudioNodeLike, id: keyof typeof MUSIC, fade = 1.5, withCrackle = true): MusicLayer {
  const track = MUSIC[id], g = c.createGain(), spb = 60 / track.bpm, barLength = spb * track.beats;
  g.gain.value = 0.0001; setAt(g.gain, 0.0001, c.currentTime); linTo(g.gain, 1, c.currentTime + Math.max(0.05, fade)); g.connect(out);
  let next = c.currentTime + 0.08, bar = 0, stopped = false;
  const tick = () => { if (stopped) return; while (next < c.currentTime + 1.2) { track.bar(c, g, next, bar % track.bars, spb); if (withCrackle) crackle(c, g, next, barLength); next += barLength; bar += 1; } };
  tick();
  const timer = globalThis.setInterval(tick, 150);
  return {
    stop(out = 1.5) {
      if (stopped) return; stopped = true; globalThis.clearInterval(timer);
      const now = c.currentTime; g.gain.cancelScheduledValues?.(now); setAt(g.gain, Math.max(0.0001, g.gain.value), now); linTo(g.gain, 0.0001, now + Math.max(0.05, out));
      globalThis.setTimeout(() => g.disconnect?.(), (out + 3) * 1000);
    },
  };
}

/** Kept for API compatibility: ambience is now the music bed (the lamp hum lives inside "The Table"). */
export function playAmbience(context: AudioContextLike, master: GainNodeLike, kind: 'room' | 'shop'): BufferSourceLike {
  const layer = startMusic(context, master, kind === 'room' ? 'table' : 'shop');
  let done = false;
  const stop = () => { if (!done) { done = true; layer.stop(); } };
  return { buffer: null, loop: true, connect: (destination) => destination, start: () => undefined, stop, disconnect: stop };
}
