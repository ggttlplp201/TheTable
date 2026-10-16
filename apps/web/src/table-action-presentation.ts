import { BoxGeometry, Group, MeshBasicMaterial, OctahedronGeometry, Vector3 } from 'three';
import { PRESENTATION_CLIPS, TABLE_TOP_Y, VisualKit, type SeatVisual } from '@the-table/visual';
import type { ChestToolClip } from './table-presentation';
import { COMPACT_ACTION_SECONDS, SOURCE_WEAPON_CONTACT as WEAPON_CONTACT } from './downed-presentation';

export type PublicActionKind = 'knife' | 'pistol' | 'medicine' | 'stimulant' | 'antidote' | 'poison' | 'handcuffs' | 'armor';
export const ACTION_DURATION: Record<PublicActionKind, number> = { knife: 2.7, medicine: 4.2, stimulant: 2, antidote: 3.3, pistol: 2.8, poison: 3.2, handcuffs: 2.6, armor: 2.6 };
export function actionPlaybackDuration(kind: PublicActionKind): number {
  if (kind === 'medicine' || kind === 'stimulant') return ACTION_DURATION[kind];
  return COMPACT_ACTION_SECONDS;
}
const clamp = (n: number) => Math.min(1, Math.max(0, n));
const inOut = (n: number) => n < .5 ? 2 * n * n : 1 - (-2 * n + 2) ** 2 / 2;
const out = (n: number) => 1 - (1 - n) ** 3;

/** Source flash decay (.93/frame), sampled absolutely so frame rate cannot change the effect. */
export function actionFlash(kind: PublicActionKind, seconds: number): { color: string; opacity: number } {
  const [at, strength, color] = kind === 'medicine' ? [3.6, .55, '#ffd890'] as const
    : kind === 'stimulant' ? [1.1, .42, '#e0a040'] as const
    : kind === 'antidote' ? [2.5, .45, '#a8e070'] as const : [Infinity, 0, '#000000'] as const;
  return { color, opacity: seconds >= at ? strength * Math.pow(.93, (seconds - at) * 60) : 0 };
}

/** The Scene knife has two positive jabs; .88/frame hit decay is time-normalized. */
export function knifeHitStrength(seconds: number): number {
  const phase = (seconds - .8) / .8 * Math.PI * 3;
  if (seconds > .8 && seconds < 1.6 && Math.sin(phase) > .9) return 1;
  const tail = [Math.PI - Math.asin(.9), 3 * Math.PI - Math.asin(.9)]
    .map(angle => .8 + angle / (Math.PI * 3) * .8).filter(at => at <= seconds).at(-1);
  return tail === undefined ? 0 : Math.pow(.88, (seconds - tail) * 60);
}

/** Source owner-eye/healing points rotated to a public seat, never an inventory/private lookup. */
export function actionSeatPoint(seat: SeatVisual, x: number, y: number, z: number): Vector3 {
  return new Vector3(x, y, z - 2.18).applyAxisAngle(new Vector3(0, 1, 0), seat.rotationY - Math.PI).add(new Vector3(...seat.position));
}

export function spyglassZoom(seconds: number): number {
  return inOut(clamp((seconds - .55) / .5)) * (1 - inOut(clamp((seconds - 2.9) / .5)));
}

export interface PublicActionGeometry {
  start: Vector3; target: Vector3; held: Vector3; mouth: Vector3; arm: Vector3; actorYaw: number;
  /** In front of the recipient's chest (worn armor, poison pour point). */
  recipientFront?: Vector3; recipientYaw?: number;
  /** The recipient's resting hand on the felt (handcuffs). */
  wrist?: Vector3;
}

/** Pistol: the target flinches on the fire beat; same .88/frame decay as the knife. */
export function pistolHitStrength(seconds: number): number {
  return seconds < WEAPON_CONTACT.pistol ? 0 : Math.pow(.88, (seconds - WEAPON_CONTACT.pistol) * 60);
}

/** Source Scene runAction trajectories + the source kit's omitted small FX. No game-state writes. */
export function createPublicActionPresentation(kit: VisualKit, kind: PublicActionKind) {
  const anchor = new Group(), pivot = new Group(), model = kit.createItem(kind);
  anchor.add(pivot); pivot.add(model); anchor.scale.setScalar(1.15); anchor.visible = false;
  const flash = kind === 'pistol' ? kit.mesh(new OctahedronGeometry(1, 0), new MeshBasicMaterial({ color: 0xffd070 }), .27, .1) : undefined;
  if (flash) model.add(flash);
  const drops = kind === 'poison' ? Array.from({ length: 8 }, () => kit.mesh(new BoxGeometry(.012, .018, .012), new MeshBasicMaterial({ color: 0x8fe040 }))) : [];
  if (drops.length) anchor.add(...drops);
  const broken = kind === 'armor' ? kit.createItem('armorBroken') : undefined;
  if (broken) pivot.add(broken);
  const spark = kind === 'armor' ? kit.mesh(new OctahedronGeometry(1, 0), new MeshBasicMaterial({ color: 0xfff0c0 }), 0, .09, .14) : undefined;
  if (spark) pivot.add(spark);
  const blade = model.getObjectByName('blade'), cap = model.getObjectByName('cap');
  const brokenPart = broken?.children[1], brokenStart = brokenPart?.position.clone(), brokenRotation = brokenPart?.rotation.clone();
  const direction = new Vector3(), hold = new Vector3(), above = new Vector3();
  const apply = (seconds: number, geometry: PublicActionGeometry): number => {
    const t = Math.max(0, seconds), { start, target, held, mouth, arm, actorYaw } = geometry;
    anchor.visible = t < ACTION_DURATION[kind]; anchor.position.copy(start); anchor.rotation.set(0, actorYaw, 0);
    const clip = PRESENTATION_CLIPS[kind];
    clip.apply(pivot, model, t, { lift: .32 });
    if (kind === 'knife') {
      // Unlike the gallery clip, the scene knife travels to the disclosed target before jabbing.
      pivot.position.set(0, 0, 0); pivot.rotation.set(0, 0, 0);
      direction.copy(target).sub(start).setY(0).normalize(); hold.copy(target).addScaledVector(direction, -.5);
      const travel = inOut(clamp(t / .8));
      anchor.position.lerpVectors(start, hold, travel); anchor.position.y += Math.sin(travel * Math.PI) * .25;
      anchor.rotation.set(0, Math.atan2(-direction.z, direction.x), -.12 * travel);
      const jab = t > .8 && t < 1.6 ? Math.max(0, Math.sin((t - .8) / .8 * Math.PI * 3)) : 0;
      anchor.position.addScaledVector(direction, jab * .32);
      const fall = clamp((t - 1.7) / .45);
      blade?.position.set(fall * .04, -fall * fall * Math.max(0, (anchor.position.y - .97) / 1.15), 0);
      blade?.rotation.set(0, 0, -fall * 1.4);
      if (t > 1.7) anchor.position.y -= out(clamp((t - 1.75) / .5)) * Math.max(0, hold.y - .98);
      return knifeHitStrength(t);
    }
    if (kind === 'medicine') {
      const lift = inOut(clamp(t / .6)), drink = inOut(clamp((t - 3.1) / .6));
      anchor.position.lerpVectors(start, held, lift).lerp(mouth, drink); anchor.rotation.set(drink * 1.9, actorYaw, 0);
      clip.apply(pivot, model, Math.min(Math.max(t - .6, 0), 2.7), { lift: 0, floor: -(anchor.position.y - .962) / 1.15 });
      if (cap) cap.visible = t < 3.1;
    } else if (kind === 'stimulant') {
      const lift = inOut(clamp(t / .4)), drink = inOut(clamp((t - .95) / .35));
      anchor.position.lerpVectors(start, held, lift).lerp(mouth, drink);
      anchor.rotation.set(drink * 1.4, actorYaw, 0);
    } else if (kind === 'antidote') {
      const local = t - .6, injection = inOut(clamp((local - 1.3) / .35)) * (1 - inOut(clamp((local - 2.3) / .4)));
      anchor.position.lerpVectors(start, held, inOut(clamp(t / .6))).lerp(arm, injection);
      clip.apply(pivot, model, Math.min(Math.max(local, 0), 2.35), { lift: 0 });
    } else if (kind === 'pistol' && flash) {
      flash.visible = t > WEAPON_CONTACT.pistol && t < WEAPON_CONTACT.pistol + .12; flash.scale.set(.05, .025, .025).multiplyScalar(1 + (t - WEAPON_CONTACT.pistol) * 8);
      return pistolHitStrength(t);
    } else if (kind === 'poison') {
      // The flask crosses the table and is poured over the poisoned player's place, then returns.
      const pour = geometry.recipientFront ?? target, go = inOut(clamp(t / 1.0)), back = inOut(clamp((t - 2.5) / .6));
      above.copy(pour).setY(pour.y + .12);
      anchor.position.lerpVectors(start, above, go).lerp(start, back); anchor.position.y += Math.sin(go * Math.PI) * .2 * (1 - back);
      direction.copy(pour).sub(start).setY(0);
      anchor.rotation.set(0, Math.atan2(-direction.x, -direction.z) + Math.PI / 2, 0);
      pivot.position.set(0, 0, 0);
      const tilt = inOut(clamp((t - 1.1) / .4)) * (1 - inOut(clamp((t - 2.2) / .4)));
      pivot.rotation.set(0, 0, -tilt * 1.9);
      const floorLocal = (TABLE_TOP_Y - anchor.position.y) / anchor.scale.y;
      drops.forEach((drop, index) => { const startAt = 1.45 + index * .09, q = clamp((t - startAt) / .28); drop.visible = q > 0 && q < 1 && startAt < 2.2; drop.position.set(.06, -.04 + (floorLocal + .04) * q * q, 0); });
    } else if (kind === 'handcuffs') {
      // Cuffs travel to the target's resting hand and snap shut on it (never in the air at the owner's seat).
      const wrist = geometry.wrist ?? target, go = inOut(clamp((t - .2) / .8)), down = inOut(clamp((t - 1.0) / .25));
      above.copy(wrist).setY(wrist.y + .3);
      anchor.position.lerpVectors(start, above, go); anchor.position.y += Math.sin(go * Math.PI) * .18 - down * .3;
      anchor.rotation.set(0, geometry.recipientYaw ?? actorYaw, 0);
      pivot.position.set(0, 0, 0);
      anchor.visible = t < ACTION_DURATION[kind] - .05;
    } else if (kind === 'armor' && broken && spark) {
      // Armor is automatic protection: it is worn, so it appears on the defender's chest, takes the hit and falls apart.
      anchor.position.copy(geometry.recipientFront ?? held); anchor.rotation.set(0, geometry.recipientYaw ?? actorYaw, 0);
      model.visible = t < 1.1; broken.visible = t >= 1.1;
      pivot.position.y = 0;
      pivot.rotation.set(0, 0, Math.sin(t * 70) * .04 * (t > 1 && t < 1.3 ? 1 : 0));
      const q = clamp((t - 1.1) / .6);
      broken.position.y = ((TABLE_TOP_Y - anchor.position.y) / anchor.scale.y) * clamp((t - 1.25) / .45) ** 2;
      broken.rotation.x = inOut(clamp((t - 1.25) / .55)) * -.5;
      if (brokenPart && brokenStart && brokenRotation) { brokenPart.position.copy(brokenStart).add(new Vector3(q * .04, 0, q * .03)); brokenPart.rotation.copy(brokenRotation); brokenPart.rotation.z -= q * .8; }
      spark.visible = t > 1 && t < 1.12; spark.scale.setScalar(.03 + Math.max(0, t - 1) * .3);
    }
    return 0;
  };
  return { anchor, pivot, model, apply, finish() { anchor.visible = false; } };
}

/** Chest tools act on the real chest: travel from the owner's slot, align in front of the keyhole, insert, work the lock, withdraw. */
export function createChestToolPresentation(kit: VisualKit, kind: ChestToolClip) {
  const anchor = new Group(), pivot = new Group(), model = kit.createItem(kind);
  anchor.add(pivot); pivot.add(model); anchor.scale.setScalar(1.1); anchor.visible = false;
  const clip = PRESENTATION_CLIPS[kind];
  // Beats per tool: reach the front of the lock, push in, pull out once the lid has started to lift.
  const beats = ({ key: [1.0, 1.4, 2.3], lockpick: [1.1, 1.4, 2.5], crowbar: [1.0, 1.3, 2.1], blackKey: [1.0, 1.4, 2.4] } as const)[kind];
  const front = new Vector3(), seat = new Vector3(), wedge = new Vector3(0, .065, 0);
  return {
    anchor, duration: clip.duration,
    apply(seconds: number, geometry: { start: Vector3; keyhole: Vector3; forward: Vector3; chestYaw: number }) {
      const t = Math.max(0, seconds), [reach, insert, withdraw] = beats;
      anchor.visible = t < clip.duration - .05;
      clip.apply(pivot, model, t, { lift: 0, floor: 0 });
      pivot.position.set(0, 0, 0);
      seat.copy(geometry.keyhole); if (kind === 'crowbar') seat.add(wedge);
      front.copy(seat).addScaledVector(geometry.forward, .22);
      const go = inOut(clamp(t / reach)), push = inOut(clamp((t - (reach - .05)) / (insert - reach + .05))), pull = inOut(clamp((t - withdraw) / .45));
      anchor.position.lerpVectors(geometry.start, front, go); anchor.position.y += Math.sin(go * Math.PI) * .2;
      anchor.position.lerp(seat.clone().addScaledVector(geometry.forward, .015), push * (1 - pull));
      anchor.rotation.set(0, geometry.chestYaw, 0);
    },
    finish() { anchor.visible = false; },
  };
}
