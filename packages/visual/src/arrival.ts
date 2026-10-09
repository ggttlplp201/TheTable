import { Vector3, type Group, type PerspectiveCamera } from 'three';
import type { SeatVisual } from './types.js';

export const ARRIVAL_DURATION = 10.4;
export const ARRIVAL_BEATS = [
  ['footstep', 0.3], ['footstep', 0.8], ['footstep', 1.3], ['footstep', 1.8],
  ['chair-pull', 2.35], ['sit', 3.3], ['chair-settle', 4.15], ['table-creak', 4.6],
] as const;
export type ArrivalBeat = (typeof ARRIVAL_BEATS)[number][0];
export type ArrivalPhase = 'approach' | 'chair' | 'sit' | 'settle' | 'look' | 'overview';
const smooth = (t: number) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };
const phase = (t: number, start: number, end: number) => smooth((t - start) / (end - start));

export function seatedArrivalPose(seat: SeatVisual) {
  const outward = new Vector3(seat.position[0], 0, seat.position[2]).normalize();
  return { position: outward.clone().multiplyScalar(2.4).setY(1.58), lookAt: outward.clone().multiplyScalar(-.6).setY(.74) };
}

/** Deterministic, scrubbable camera/chair motion. Contains no gameplay clock or state. */
export function sampleArrival(seat: SeatVisual, seconds: number) {
  const t = Math.max(0, Math.min(ARRIVAL_DURATION, seconds));
  const outward = new Vector3(seat.position[0], 0, seat.position[2]).normalize();
  const right = new Vector3(outward.z, 0, -outward.x);
  const approach = phase(t, 0, 2.3);
  const sit = phase(t, 3.1, 4.05);
  const settle = phase(t, 4.05, 4.65);
  const overview = phase(t, 8.8, ARRIVAL_DURATION);
  const chairOffset = 0.42 * phase(t, 2.3, 3.05) * (1 - settle);
  const bob = Math.sin(t * Math.PI * 4) * 0.024 * Math.sin(Math.PI * approach);
  // Remain behind the pulled chair until sitting, then move inside its backrest.
  const position = new Vector3(...seat.position).addScaledVector(outward, 2.25 * (1 - approach) + 0.95 - 0.51 * sit - 0.3 * settle);
  position.y = 1.9 - 0.32 * sit + bob + Math.sin((t - 4.05) * 16) * 0.013 * (t > 4.05 ? 1 - settle : 0);
  // A deliberate scan of the table, with time to register each neighbour.
  // This timeline is cosmetic; pointer-look responsiveness is independent.
  const glance = -0.65 * phase(t, 4.65, 5.95) + 1.05 * phase(t, 6.15, 7.65) - 0.4 * phase(t, 7.85, 8.8);
  const lookAt = new Vector3(0, 1.12 - 0.38 * phase(t, 2.25, 2.85) * (1 - sit), 0).addScaledVector(right, glance);
  const chairLook = new Vector3(...seat.position).addScaledVector(outward, 0.2);
  chairLook.y = 0.8;
  lookAt.lerp(chairLook, 0.82 * phase(t, 1.8, 2.65) * (1 - phase(t, 3.05, 3.8)));
  const seated = seatedArrivalPose(seat);
  position.lerp(seated.position, overview);
  lookAt.lerp(seated.lookAt, overview);
  const label: ArrivalPhase = t < 2.3 ? 'approach' : t < 3.1 ? 'chair' : t < 4.05 ? 'sit' : t < 4.65 ? 'settle' : t < 8.8 ? 'look' : 'overview';
  return { position, lookAt, chairOffset, roll: Math.sin(t * Math.PI * 2) * 0.003 * Math.sin(Math.PI * approach) * (1 - overview), phase: label };
}

/** Owns only the camera and the viewer's cosmetic chair/body pose. */
export class TableArrival {
  private elapsed = 0;
  private done = false;
  private readonly chair: Group | undefined;
  private readonly body: Group | undefined;
  private readonly originalChairPosition: Vector3 | undefined;
  private readonly bodyVisible: boolean | undefined;
  constructor(private readonly camera: PerspectiveCamera, private readonly seat: SeatVisual, character?: Group,
    private readonly onBeat?: (beat: ArrivalBeat) => void) {
    this.chair = character?.getObjectByName('chair') as Group | undefined;
    this.body = character?.getObjectByName('upper') as Group | undefined;
    this.originalChairPosition = this.chair?.position.clone();
    this.bodyVisible = this.body?.visible;
    if (this.body) this.body.visible = false;
    this.update(0);
  }
  update(seconds: number): ArrivalPhase {
    if (this.done) return 'overview';
    const t = Math.max(this.elapsed, seconds);
    const pose = sampleArrival(this.seat, t);
    this.camera.position.copy(pose.position);
    this.camera.lookAt(pose.lookAt);
    this.camera.rotateZ(pose.roll);
    // Local -Z is behind the seated character, for all four seat orientations.
    if (this.chair && this.originalChairPosition) this.chair.position.copy(this.originalChairPosition).add(new Vector3(0, 0, -pose.chairOffset));
    for (const [beat, at] of ARRIVAL_BEATS) if (at > this.elapsed && at <= t) this.onBeat?.(beat);
    this.elapsed = t;
    if (t >= ARRIVAL_DURATION) this.finish();
    return pose.phase;
  }
  finish(): void {
    if (this.done) return;
    this.done = true;
    const seated = seatedArrivalPose(this.seat);
    this.camera.position.copy(seated.position);
    this.camera.lookAt(seated.lookAt);
    if (this.chair && this.originalChairPosition) this.chair.position.copy(this.originalChairPosition);
    if (this.body && this.bodyVisible !== undefined) this.body.visible = this.bodyVisible;
  }
  get finished(): boolean { return this.done; }
  dispose(): void { this.finish(); }
}
