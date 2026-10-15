import { CatmullRomCurve3, Vector3 } from 'three';
import type { SeatVisual } from '@the-table/visual';

export const EXIT_DURATION = 14.8;
export const EXIT_STRIDE = .7;
const WALK_START = 3;
const WALK_END = 13.6;
const SAMPLES = 800;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };
const phase = (t: number, start: number, end: number) => smooth((t - start) / (end - start));

/** Reference speed integral: one walk, including the slowdown through the door. */
const speed = (t: number) => phase(t, WALK_START, WALK_START + 1.6)
  * (1 - .5 * Math.sin(Math.PI * clamp((t - 9.8) / 2.4)))
  * (1 - .35 * phase(t, 12.6, WALK_END));
const cumulative = [0];
for (let i = 1; i <= SAMPLES; i++) cumulative.push(cumulative[i - 1]! + speed(WALK_START + (WALK_END - WALK_START) * i / SAMPLES));
export function exitWalkProgress(seconds: number): number {
  if (seconds <= WALK_START) return 0;
  if (seconds >= WALK_END) return 1;
  const sample = (seconds - WALK_START) / (WALK_END - WALK_START) * SAMPLES;
  const index = Math.floor(sample), fraction = sample - index;
  return (cumulative[index]! + (cumulative[index + 1]! - cumulative[index]!) * fraction) / cumulative[SAMPLES]!;
}

export type ExitBeat = 'chair-scrape' | 'footstep' | 'door-open' | 'exit-through';
export interface TimedExitBeat { beat: ExitBeat; at: number }

/** Footfalls use the same distance integral and half-stride troughs as the camera bob. */
export function exitBeatSchedule(path: CatmullRomCurve3): TimedExitBeat[] {
  const beats: TimedExitBeat[] = [
    { beat: 'chair-scrape', at: .9 }, { beat: 'door-open', at: 10 }, { beat: 'exit-through', at: 12.4 },
  ];
  const length = path.getLength();
  for (let distance = EXIT_STRIDE / 2; distance < length; distance += EXIT_STRIDE) {
    const progress = distance / length;
    let low = WALK_START, high = WALK_END;
    for (let i = 0; i < 32; i++) {
      const middle = (low + high) / 2;
      if (exitWalkProgress(middle) < progress) low = middle; else high = middle;
    }
    beats.push({ beat: 'footstep', at: (low + high) / 2 });
  }
  return beats.sort((a, b) => a.at - b.at);
}

/** A scene-owned cursor, not a timer: hidden/skipped frames can consume beats silently. */
export class ExitBeatTimeline {
  private readonly beats: readonly TimedExitBeat[];
  private next = 0;
  constructor(path: CatmullRomCurve3) { this.beats = exitBeatSchedule(path); }
  advance(seconds: number, audible = true): ExitBeat[] {
    const due: ExitBeat[] = [];
    while (this.next < this.beats.length && this.beats[this.next]!.at <= seconds) {
      const event = this.beats[this.next++]!;
      if (audible) due.push(event.beat);
    }
    return due;
  }
  finish(): void { this.next = this.beats.length; }
}

/** Near-seat points are the supplied path; other seats join the aisle behind their chairs. */
export function createExitPath(seat: SeatVisual): CatmullRomCurve3 {
  const outward = new Vector3(seat.position[0], 0, seat.position[2]).normalize();
  const start: [number, number] = [outward.x * 2.85, outward.z * 2.85];
  const aisle: Array<[number, number]> = outward.z > .5 ? [[1.55, 2.75], [3.3, 1], [3.35, -2.3], [2.6, -4.4]]
    : outward.x > .5 ? [[3.35, .1], [3.35, -2.3], [2.6, -4.4]]
      : outward.x < -.5 ? [[-3.35, .1], [-3.35, -2.3], [-2.6, -4.4], [0, -5.05]]
        : [[1.55, -3.15], [2.6, -4.4]];
  return new CatmullRomCurve3([start, ...aisle, [2.42, -5.5], [2.4, -6.9]].map(([x, z]) => new Vector3(x, 1.8, z)), false, 'centripetal');
}

export interface ExitOrigin { position: Vector3; lookAt: Vector3 }
/** Scrubbable camera, chair and lighting port of Leave Table and Handbook's exitAt. */
export function sampleExit(path: CatmullRomCurve3, seconds: number, origin: ExitOrigin) {
  const t = Math.max(0, seconds), progress = exitWalkProgress(t), walking = path.getPointAt(progress);
  const ahead = path.getPointAt(Math.min(1, progress + .06)).setY(1.62);
  const standLook = origin.lookAt.clone().lerp(new Vector3(0, 1.2, 0), .3);
  const walkLook = ahead.lerp(new Vector3(2.4, 1.55, -10), phase(progress, .7, .92));
  let position: Vector3, lookAt: Vector3;
  if (t < .7) { position = origin.position.clone(); lookAt = origin.lookAt.clone(); }
  else if (t < 1.7) {
    const stand = phase(t, .7, 1.7);
    position = origin.position.clone().lerp(path.getPointAt(0), stand);
    position.y += Math.sin(stand * Math.PI) * .03;
    lookAt = origin.lookAt.clone().lerp(standLook, stand);
  } else {
    position = walking.clone();
    const step = progress * path.getLength() / EXIT_STRIDE, amplitude = Math.min(1, speed(Math.min(Math.max(t, WALK_START), WALK_END)));
    position.y -= Math.abs(Math.sin(step * Math.PI)) * .016 * amplitude;
    position.x += Math.sin(step * Math.PI) * .004 * amplitude;
    lookAt = standLook.clone().lerp(walkLook, phase(t, 1.7, 3.6));
  }
  const lighting = phase(t, 10, 12.6);
  return {
    position, lookAt, walking, progress,
    chairZ: 2.66 + .4 * phase(t, .9, 1.6),
    chairYaw: .05 * phase(t, .9, 1.6),
    hingeYaw: .35 + 1.4 * phase(t, 10, 11.9),
    lighting, doorIntensity: 2.2 + 4.8 * lighting,
    flash: Math.pow(phase(t, 12, 13.8), 1.6) * (1 - phase(t, 13.9, 14.6)),
    black: phase(t, 13.9, 14.6),
    hudOpacity: 1 - phase(t, .5, .9),
    resultOpacity: phase(t, 14, EXIT_DURATION),
    phase: t < .7 ? 'confirm' : t < 1.7 ? 'stand' : t < 3.6 ? 'turn' : t < 10.2 ? 'walk' : t < 12.4 ? 'door' : t < 14.4 ? 'through' : 'result',
  };
}
