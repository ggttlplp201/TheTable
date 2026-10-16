import type { AudioContextLike, AudioCueId, AudioNodeLike, BufferLike, GainNodeLike } from './types.js';

export type RecordedSampleId = keyof typeof RECORDED_SAMPLES;

export const RECORDED_SAMPLES = {
  hit: { url: new URL('./audio/hit.wav', import.meta.url).href, peak: .78 },
  ui_card: { url: new URL('./audio/ui_card.wav', import.meta.url).href, peak: .4 },
  crowbar: { url: new URL('./audio/crowbar.wav', import.meta.url).href, peak: .68 },
  inject: { url: new URL('./audio/inject.wav', import.meta.url).href, peak: .45, trim: 2.2 },
  knife_snap: { url: new URL('./audio/knife_snap.wav', import.meta.url).href, peak: .7 },
  med_pop: { url: new URL('./audio/med_pop.wav', import.meta.url).href, peak: .42 },
  pistol_cock: { url: new URL('./audio/pistol_cock.wav', import.meta.url).href, peak: .55 },
  knife: { url: new URL('./audio/knife.wav', import.meta.url).href, peak: .72 },
  med_unscrew: { url: new URL('./audio/med_unscrew.wav', import.meta.url).href, peak: .42 },
  bullet_load: { url: new URL('./audio/bullet_load.wav', import.meta.url).href, peak: .5 },
  pistol_spin: { url: new URL('./audio/pistol_spin.mp3', import.meta.url).href, peak: .5, trim: 1.4 },
  pistol_fire: { url: new URL('./audio/pistol_fire.ogg', import.meta.url).href, peak: .93 },
  poison: { url: new URL('./audio/poison.wav', import.meta.url).href, peak: .45 },
} as const;

type DecodedBuffer = BufferLike & {
  length: number;
  numberOfChannels: number;
  sampleRate: number;
  getChannelData(channel: number): Float32Array;
};

type LoadedSample = { buffer: BufferLike; gain: number };
type SampleBeat = { id: RecordedSampleId; at: number };

/** Recorded replacements are timed to the production scene clips, not to DOM events. */
const RECORDED_CUE_PLAN: Readonly<Partial<Record<AudioCueId, readonly SampleBeat[]>>> = {
  'task.reveal': [{ id: 'ui_card', at: 0 }],
  'item.knife': [{ id: 'knife', at: .28 }, { id: 'knife', at: .47 }],
  'item.pistol': [{ id: 'pistol_spin', at: .02 }, { id: 'pistol_cock', at: .28 }, { id: 'pistol_fire', at: .43 }],
  'item.bullet': [{ id: 'bullet_load', at: 0 }],
  'item.poison': [{ id: 'poison', at: .12 }],
  'item.antidote': [{ id: 'inject', at: .24 }],
  'event.poison-cured': [{ id: 'inject', at: .24 }],
  'item.crowbar': [{ id: 'crowbar', at: .3 }],
  'event.damage': [{ id: 'hit', at: 0 }],
  // Medicine keeps its procedural drink/healing tail; these samples replace the cap performance.
  'item.medicine': [{ id: 'med_unscrew', at: .11 }, { id: 'med_pop', at: .44 }],
  'event.healed': [{ id: 'med_unscrew', at: .11 }, { id: 'med_pop', at: .44 }],
  'event.revived': [{ id: 'med_unscrew', at: .11 }, { id: 'med_pop', at: .44 }],
};

const decoded = new WeakMap<object, Map<RecordedSampleId, LoadedSample>>();
const pending = new WeakMap<object, Map<RecordedSampleId, Promise<LoadedSample | undefined>>>();

function sampleSupport(context: AudioContextLike): context is AudioContextLike & { decodeAudioData(data: ArrayBuffer): Promise<DecodedBuffer> } {
  return typeof context.decodeAudioData === 'function' && typeof globalThis.fetch === 'function';
}

function normalize(context: AudioContextLike, source: DecodedBuffer, id: RecordedSampleId): LoadedSample {
  const meta = RECORDED_SAMPLES[id];
  const length = 'trim' in meta ? Math.min(source.length, Math.round(meta.trim * source.sampleRate)) : source.length;
  const target = context.createBuffer(source.numberOfChannels, length, source.sampleRate) as DecodedBuffer;
  let peak = 0;
  for (let channel = 0; channel < source.numberOfChannels; channel += 1) {
    const input = source.getChannelData(channel), output = target.getChannelData(channel);
    for (let index = 0; index < length; index += 1) {
      output[index] = input[index] ?? 0;
      peak = Math.max(peak, Math.abs(output[index] ?? 0));
    }
  }
  const gain = peak > 0 ? meta.peak / peak : 1;
  const fade = 'trim' in meta && length < source.length ? Math.round(.06 * source.sampleRate) : 0;
  if (fade) for (let channel = 0; channel < source.numberOfChannels; channel += 1) {
    const output = target.getChannelData(channel);
    for (let index = Math.max(0, length - fade); index < length; index += 1) output[index] = (output[index] ?? 0) * (length - index) / fade;
  }
  return { buffer: target, gain };
}

async function load(context: AudioContextLike, id: RecordedSampleId): Promise<LoadedSample | undefined> {
  if (!sampleSupport(context)) return undefined;
  const ready = decoded.get(context)?.get(id);
  if (ready) return ready;
  let jobs = pending.get(context);
  if (!jobs) { jobs = new Map(); pending.set(context, jobs); }
  const existing = jobs.get(id);
  if (existing) return existing;
  const job = globalThis.fetch(RECORDED_SAMPLES[id].url)
    .then(response => {
      if (!response.ok) throw new Error(`sample ${id}: ${response.status}`);
      return response.arrayBuffer();
    })
    .then(bytes => context.decodeAudioData!(bytes.slice(0)))
    .then(source => {
      const value = normalize(context, source as DecodedBuffer, id);
      let cache = decoded.get(context);
      if (!cache) { cache = new Map(); decoded.set(context, cache); }
      cache.set(id, value);
      return value;
    })
    .catch(error => {
      console.warn(`The Table audio sample failed; using procedural fallback for ${id}.`, error);
      return undefined;
    });
  jobs.set(id, job);
  return job;
}

function schedule(context: AudioContextLike, output: AudioNodeLike, sample: LoadedSample, at: number): void {
  const source = context.createBufferSource(), gain = context.createGain();
  source.buffer = sample.buffer;
  gain.gain.value = sample.gain;
  source.connect(gain);
  gain.connect(output);
  source.start(Math.max(context.currentTime, at));
}

/** Decode in the background after the user unlocks Web Audio. */
export function primeRecordedSamples(context: AudioContextLike): void {
  if (!sampleSupport(context)) return;
  for (const id of Object.keys(RECORDED_SAMPLES) as RecordedSampleId[]) void load(context, id);
}

/** Returns true only when every required sample is already decoded and was scheduled. */
export function playRecordedCue(context: AudioContextLike, cue: AudioCueId, output: GainNodeLike, delay = 0): boolean {
  const plan = RECORDED_CUE_PLAN[cue];
  if (!plan?.length || !sampleSupport(context)) return false;
  const cache = decoded.get(context);
  if (!cache || plan.some(beat => !cache.has(beat.id))) {
    for (const beat of plan) void load(context, beat.id);
    return false;
  }
  for (const beat of plan) schedule(context, output, cache.get(beat.id)!, context.currentTime + delay + beat.at);
  return true;
}

/** Plays a contextual recording in addition to the normal semantic cue. */
export function playRecordedAccent(context: AudioContextLike, id: RecordedSampleId, output: GainNodeLike, delay = 0): boolean {
  if (!sampleSupport(context)) return false;
  const sample = decoded.get(context)?.get(id);
  if (!sample) { void load(context, id); return false; }
  schedule(context, output, sample, context.currentTime + delay);
  return true;
}
