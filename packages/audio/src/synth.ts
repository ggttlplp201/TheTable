import type { AudioContextLike, AudioCueId, GainNodeLike, BufferSourceLike } from './types.js';

/** Deliberately small authored palette. Other semantic IDs receive a stable
 * deterministic variant below, so adding a replaceable cue never becomes silence. */
const TONES: Readonly<Partial<Record<AudioCueId, readonly [number, number, number]>>> = {
  'ui.select': [420, 0.035, 0.08],
  'ui.set-down': [110, 0.07, 0.12],
  'ui.confirm': [560, 0.09, 0.14],
  'ui.reject': [90, 0.12, 0.16],
  'item.knife': [170, 0.11, 0.2],
  'item.pistol': [72, 0.16, 0.35],
  'item.poison': [180, 0.2, 0.16],
  'item.medicine': [520, 0.18, 0.16],
  'item.antidote': [680, 0.16, 0.14],
  'item.armor': [95, 0.12, 0.17],
  'item.bag': [130, 0.15, 0.15],
  'item.chest': [240, 0.28, 0.22],
  'event.downed': [62, 0.3, 0.3],
  'event.death': [45, 0.55, 0.32],
  'event.exit': [740, 0.3, 0.2],
  'event.results': [392, 0.5, 0.2],
  'turn.start': [260, 0.12, 0.15],
  'turn.warning': [980, 0.08, 0.17],
  'turn.response-warning': [760, 0.1, 0.2],
  'world.door': [115, 0.22, 0.15],
  'world.footstep': [80, 0.06, 0.08],
  'world.room': [58, 1.2, 0.025],
  'intro.sting': [196, 0.8, 0.16],
};

export function toneForCue(cue: AudioCueId): readonly [number, number, number] {
  const explicit = TONES[cue];
  if (explicit) return explicit;
  let hash = 17;
  for (let index = 0; index < cue.length; index += 1) hash = (hash * 31 + cue.charCodeAt(index)) >>> 0;
  const frequency = cue.startsWith('event.threat') || cue.includes('damage') ? 70 + hash % 110
    : cue.startsWith('private.') ? 620 + hash % 280
      : cue.startsWith('item.') ? 160 + hash % 520
        : cue.startsWith('world.') ? 55 + hash % 100
          : 240 + hash % 560;
  const duration = cue.includes('death') || cue.includes('match') ? 0.34 : 0.07 + (hash % 14) / 100;
  return [frequency, duration, cue.startsWith('world.') ? 0.06 : 0.11];
}

export function playProcedural(context: AudioContextLike, cue: AudioCueId, master: GainNodeLike): void {
  const [frequency, duration, amplitude] = toneForCue(cue);
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = cue.includes('pistol') || cue.includes('death') ? 'sawtooth' : 'triangle';
  oscillator.frequency.value = frequency;
  gain.gain.value = 0.0001;
  oscillator.connect(gain).connect(master);
  const now = context.currentTime;
  gain.gain.setValueAtTime?.(amplitude, now);
  gain.gain.exponentialRampToValueAtTime?.(0.0001, now + duration);
  oscillator.start(now);
  oscillator.stop(now + duration);
}

export function playAmbience(context: AudioContextLike, master: GainNodeLike, kind: 'room' | 'shop'): BufferSourceLike {
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  const length = Math.max(1, Math.floor(context.sampleRate * 2));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const samples = buffer.getChannelData?.(0);
  const filterFrequency = kind === 'room' ? 180 : 520;
  const amplitude = kind === 'room' ? 0.018 : 0.028;
  let cleaned = false;

  if (samples) {
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] = ((index * 1103515245 + 12345) % 65536) / 32768 - 1;
    }
  }
  filter.type = kind === 'room' ? 'lowpass' : 'bandpass';
  filter.frequency.value = filterFrequency;
  filter.Q.value = kind === 'room' ? 0.35 : 0.8;
  gain.gain.value = amplitude;
  source.buffer = buffer;
  source.loop = true;
  source.connect(filter).connect(gain).connect(master);
  source.start(context.currentTime);

  const cleanup = (): void => {
    if (cleaned) return;
    cleaned = true;
    source.stop?.();
    source.disconnect?.();
    filter.disconnect?.();
    gain.disconnect?.();
  };
  return {
    buffer,
    loop: true,
    connect: (destination) => source.connect(destination),
    start: (when) => source.start(when),
    stop: cleanup,
    disconnect: cleanup,
  };
}
