import { Euler, Group, Object3D, Vector3 } from 'three';
import { ITEM_PRESENTATION } from './kit.js';
import type {
  ClipEnvironment,
  ItemModelId,
  PresentationClip,
} from './types.js';

type Animator = (
  pivot: Group,
  model: Object3D,
  time: number,
  environment: Required<Pick<ClipEnvironment, 'lift' | 'floor'>> & ClipEnvironment,
) => void;

const PI = Math.PI;
const clamp = (value: number) => Math.min(1, Math.max(0, value));
const easeInOut = (value: number) => value < 0.5
  ? 2 * value * value
  : 1 - Math.pow(-2 * value + 2, 2) / 2;
const easeOut = (value: number) => 1 - Math.pow(1 - value, 3);
const segment = (time: number, start: number, end: number, easing = easeInOut) =>
  easing(clamp((time - start) / (end - start)));
const bump = (time: number, start: number, end: number) =>
  time > start && time < end ? Math.sin(((time - start) / (end - start)) * PI) : 0;
const lerp = (start: number, end: number, amount: number) => start + (end - start) * amount;

function resetModel(model: Object3D): void {
  const id = model.userData.itemId as ItemModelId | undefined;
  const presentation = id && id in ITEM_PRESENTATION
    ? ITEM_PRESENTATION[id as keyof typeof ITEM_PRESENTATION]
    : undefined;
  model.position.set(0, presentation?.y ?? 0, 0);
  const rotation = presentation?.rotation ?? [0, 0, 0] as const;
  model.rotation.set(rotation[0], rotation[1], rotation[2]);
  model.scale.set(1, 1, 1);
  model.visible = true;
}

function lift(time: number, duration: number): number {
  return segment(time, 0, 0.4) * (1 - segment(time, duration - 0.5, duration));
}

function clip(
  duration: number,
  beats: PresentationClip['beats'],
  animate: Animator,
): PresentationClip {
  return {
    duration,
    beats,
    apply(pivot, model, rawTime, environment = {}) {
      const time = Math.max(0, Math.min(rawTime, duration));
      pivot.position.set(0, 0, 0);
      pivot.rotation.set(0, 0, 0);
      pivot.scale.set(1, 1, 1);
      resetModel(model);
      animate(pivot, model, time, {
        ...environment,
        lift: environment.lift ?? 0.32,
        floor: environment.floor ?? 0,
      });
    },
  };
}

function rotateNamed(model: Object3D, name: string, rotation: Partial<Euler>): void {
  const part = model.getObjectByName(name);
  if (!part) return;
  if (rotation.x !== undefined) part.rotation.x = rotation.x;
  if (rotation.y !== undefined) part.rotation.y = rotation.y;
  if (rotation.z !== undefined) part.rotation.z = rotation.z;
}

function positionNamed(model: Object3D, name: string, position: Partial<Vector3>): void {
  const part = model.getObjectByName(name);
  if (!part) return;
  if (position.x !== undefined) part.position.x = position.x;
  if (position.y !== undefined) part.position.y = position.y;
  if (position.z !== undefined) part.position.z = position.z;
}

export const PRESENTATION_CLIPS = Object.freeze({
  knife: clip(2.6, [['LIFT', 0], ['AIM', 0.4], ['THRUST', 1], ['SNAP', 1.5], ['SET DOWN', 2.1]], (pivot, model, time, env) => {
    const aim = segment(time, 0.4, 0.9) * (1 - segment(time, 2.1, 2.6));
    pivot.position.y = lift(time, 2.6) * env.lift + aim * 0.04;
    pivot.position.z = -segment(time, 1, 1.12, easeOut) * 0.14 + segment(time, 1.12, 1.45) * 0.14;
    pivot.rotation.y = aim * PI / 2;
    pivot.rotation.z = aim * 0.12 + Math.sin(time * 70) * 0.05 * bump(time, 1.5, 1.7);
    const blade = model.getObjectByName('blade');
    if (blade) {
      const fall = clamp((time - 1.5) / 0.55);
      blade.position.set(fall * 0.05, lerp(0, env.floor - pivot.position.y - 0.01, fall * fall), 0);
      blade.rotation.set(0, fall * 0.8, -fall * 1.5);
    }
  }),
  pistol: clip(2.8, [['LIFT', 0], ['RAISE', 0.4], ['COCK', 1], ['FIRE', 1.5], ['LOWER', 2.2]], (pivot, model, time, env) => {
    const aim = segment(time, 0.4, 0.9) * (1 - segment(time, 2.2, 2.8));
    const kick = segment(time, 1.5, 1.56, easeOut) * (1 - segment(time, 1.56, 2));
    model.rotation.x = (-PI / 2) * (1 - aim);
    model.position.y = 0.03 * (1 - aim);
    pivot.position.y = lift(time, 2.8) * env.lift + aim * 0.06;
    pivot.position.z = kick * 0.05;
    pivot.rotation.y = aim * PI / 2;
    pivot.rotation.z = kick * 0.5;
    rotateNamed(model, 'hammer', { z: segment(time, 1, 1.2) * 0.6 * (1 - segment(time, 1.5, 1.52)) });
    rotateNamed(model, 'cylinder', { x: segment(time, 1, 1.3) * PI / 3 });
  }),
  bullet: clip(2.6, [['LIFT', 0], ['ROLL', 0.4], ['ALIGN', 1.1], ['LOAD', 1.75], ['CLICK', 2]], (pivot, model, time, env) => {
    const move = segment(time, 1.1, 1.75);
    const insert = segment(time, 1.75, 2);
    pivot.position.set(lerp(0, -0.2, move) + insert * 0.1, lerp(lift(time, 9) * env.lift, env.floor + 0.2, move), lerp(0, -0.1, move));
    pivot.rotation.y = segment(time, 0.4, 1.1) * PI * 2;
    model.rotation.z = -segment(time, 1, 1.3) * PI / 2;
    model.visible = time < 2;
  }),
  poison: clip(3.2, [['LIFT', 0], ['UNCORK', 0.5], ['POUR', 1.1], ['DRIP', 1.4], ['SET DOWN', 2.6]], (pivot, model, time, env) => {
    const tilt = segment(time, 1.1, 1.5) * (1 - segment(time, 2.2, 2.6));
    positionNamed(model, 'cork', {
      x: 0.05 * (segment(time, 0.8, 1) - segment(time, 2.4, 2.6)),
      y: 0.27 + 0.06 * (segment(time, 0.5, 0.8, easeOut) - segment(time, 2.5, 2.8)),
    });
    pivot.position.y = lift(time, 3.2) * env.lift + tilt * 0.14;
    pivot.rotation.z = -tilt * 1.9;
  }),
  medicine: clip(3.5, [['LIFT', 0], ['UNSCREW', 0.5], ['POP CAP', 1.7], ['PEEL SEAL', 2], ['SET DOWN', 3]], (pivot, model, time, env) => {
    const up = lift(time, 3.5);
    pivot.position.y = up * env.lift;
    pivot.rotation.x = up * 0.16;
    pivot.rotation.z = -up * 0.05 + (time > 0.5 && time < 1.7 ? Math.sin(time * 22) * 0.012 : 0);
    const twist = segment(time, 0.5, 1.7);
    const pop = clamp((time - 1.7) / 0.55);
    rotateNamed(model, 'cap', { x: 0, y: -twist * PI * 3, z: -pop * PI * 2.5 });
    positionNamed(model, 'cap', { x: pop * 0.12, y: pop > 0 ? .157 + (env.floor - pivot.position.y + .038 - .157) * pop * pop + Math.sin(pop * PI) * .05 : .145 + twist * .012, z: pop * .03 });
    rotateNamed(model, 'seal', { x: -easeOut(clamp((time - 2) / 0.6)) * 2.3 });
  }),
  antidote: clip(3, [['LIFT', 0], ['FLIP', 0.4], ['FLICK', 1], ['INJECT', 1.4], ['SET DOWN', 2.4]], (pivot, model, time, env) => {
    const active = segment(time, 0.4, 0.9) * (1 - segment(time, 2.4, 2.9));
    const inject = segment(time, 1.6, 2.1);
    model.rotation.z = (PI / 2) * (1 - active);
    model.rotation.x = Math.sin(time * 40) * .07 * bump(time, 1, 1.3);
    pivot.position.y = lift(time, 3) * env.lift + active * 0.1 - segment(time, 1.4, 1.6, easeOut) * 0.05 * (1 - segment(time, 2.1, 2.4));
    positionNamed(model, 'plunger', { y: 0.25 - inject * 0.06 });
    const dose = model.getObjectByName('dose');
    if (dose) {
      dose.scale.y = 1 - 0.85 * inject;
      dose.position.y = 0.05 + 0.08 * dose.scale.y;
    }
  }),
  armor: clip(2.6, [['LIFT', 0], ['BRACE', 0.4], ['IMPACT', 1], ['BREAK', 1.1], ['FALL', 1.3]], (pivot, _model, time, env) => {
    pivot.position.y = lift(time, 9) * env.lift + segment(time, 0.4, 0.8) * 0.04 - segment(time, 1.25, 1.7) * env.lift;
    pivot.position.x = Math.sin(time * 70) * 0.015 * bump(time, 1, 1.35);
    pivot.rotation.x = -segment(time, 1.25, 1.8) * 0.5;
  }),
  cloth: clip(2.6, [['LIFT', 0], ['UNFURL', 0.4], ['CARRY', 0.9], ['DRAPE', 1.5], ['SETTLE', 2]], (pivot, model, time, env) => {
    const unfurl = segment(time, 0.4, 0.9);
    const cover = segment(time, 1.5, 2.1);
    model.scale.set(lerp(1, 1.7, unfurl), lerp(lerp(1, 0.4, unfurl), 1.45, cover), lerp(1, 1.7, unfurl));
    pivot.position.y = lift(time, 9) * env.lift + bump(time, 0.9, 1.6) * 0.1 - cover * env.lift;
    pivot.rotation.y = unfurl * 0.6;
  }),
  bag: clip(2.8, [['LIFT', 0], ['OPEN', 0.5], ['PLACE POCKET', 1.2], ['BUCKLE', 2]], (pivot, model, time, env) => {
    pivot.position.y = lift(time, 2.8) * env.lift;
    rotateNamed(model, 'flap', { x: -0.18 - segment(time, 0.5, 1) * 1.5 * (1 - segment(time, 1.8, 2.2)) });
    pivot.rotation.y = segment(time, 0.3, 0.9) * 0.35;
    pivot.position.x = bump(time, 1.2, 2) * 0.08;
  }),
  safe: clip(3.2, [['OPEN DOOR', 0], ['STOW', 0.9], ['SHUT', 1.8], ['SPIN DIAL', 2.2], ['LOCKED', 2.75]], (pivot, model, time) => {
    const open = segment(time, 0.2, 0.7) * (1 - segment(time, 1.8, 2.2));
    rotateNamed(model, 'door', { y: -open * 1.75 });
    rotateNamed(model, 'dial', { z: -segment(time, 2.2, 2.45) * 2.4 + segment(time, 2.45, 2.6) * 1.4 - segment(time, 2.6, 2.75) * 0.8 });
    rotateNamed(model, 'handle', { z: -segment(time, 2.75, 2.9) * PI / 2 });
    pivot.position.y = -Math.abs(Math.sin(time * 30)) * 0.004 * bump(time, 2.15, 2.3);
  }),
  spyglass: clip(3, [['LIFT', 0], ['EXTEND', 0.4], ['AIM', 0.9], ['REVEAL', 1.4], ['COLLAPSE', 2.3]], (pivot, model, time, env) => {
    const extend = segment(time, 0.4, 0.9) * (1 - segment(time, 2.3, 2.7));
    const aim = segment(time, 0.9, 1.3) * (1 - segment(time, 2.2, 2.6));
    positionNamed(model, 'tube2', { x: 0.04 + extend * 0.04 });
    positionNamed(model, 'tube3', { x: 0.11 + extend * 0.06 });
    pivot.position.y = lift(time, 3) * env.lift + aim * 0.1;
    pivot.rotation.y = -aim * PI / 2;
    pivot.rotation.z = aim * 0.25;
  }),
  pickpocket: clip(2.9, [['LIFT', 0], ['REACH', 0.4], ['HOOK', 1], ['PULL', 1.6], ['TO YOU', 2.1]], (pivot, model, time, env) => {
    const rotate = segment(time, 0.4, 0.8);
    const reach = segment(time, 0.5, 1) * (1 - segment(time, 1.6, 2));
    const gone = segment(time, 2, 2.2);
    pivot.rotation.y = rotate * PI / 2;
    pivot.position.set(0, lerp(lift(time, 9) * env.lift + rotate * 0.08, env.floor + 0.08, reach), lerp(0, -0.09, reach));
    pivot.scale.setScalar(1 - gone * 0.99);
    model.visible = time < 2.2;
  }),
  key: clip(3, [['LIFT', 0], ['ALIGN', 0.4], ['INSERT', 1], ['TURN', 1.5], ['OPEN', 2]], (pivot, model, time, env) => {
    const align = segment(time, 0.4, 1);
    const insert = segment(time, 1, 1.4);
    pivot.rotation.y = align * PI / 2;
    model.rotation.x = align * PI / 2 + segment(time, 1.5, 1.9) * PI / 2;
    pivot.position.set(0, lerp(lift(time, 9) * env.lift, env.floor + 0.24, align), lerp(0, -0.045, align) - insert * 0.07);
    const lid = env.props?.getObjectByName('lid');
    if (lid) lid.rotation.x = -segment(time, 2, 2.6, easeOut) * 1.95;
  }),
  lockpick: clip(3.2, [['LIFT', 0], ['PRESENT', 0.4], ['PICK', 1.1], ['RAKE', 1.4], ['OPEN', 2.2]], (pivot, model, time, env) => {
    const active = segment(time, 0.4, 1) * (1 - segment(time, 2.6, 3.1));
    const insert = segment(time, 1.1, 1.4) * (1 - segment(time, 2.3, 2.6));
    pivot.position.set(0.04 * active, lerp(lift(time, 3.2) * env.lift, env.floor + 0.18, active), -0.065 * active);
    positionNamed(model, 'pick0', { z: 0.04 - insert * 0.06 });
    rotateNamed(model, 'pick0', { y: Math.sin(time * 28) * 0.1 * bump(time, 1.4, 2.2) });
    const lid = env.props?.getObjectByName('lid');
    if (lid) lid.rotation.x = -segment(time, 2.2, 2.7, easeOut) * 1.95;
  }),
  crowbar: clip(2.8, [['LIFT', 0], ['WEDGE', 0.4], ['PRY', 1.3], ['BURST', 1.7], ['SET DOWN', 2.3]], (pivot, _model, time, env) => {
    const active = segment(time, 0.4, 1) * (1 - segment(time, 2.3, 2.8));
    const pry = segment(time, 1.3, 1.75) * (1 - segment(time, 2.1, 2.5));
    pivot.rotation.y = active * PI / 2;
    pivot.rotation.x = pry * 0.45;
    pivot.position.y = lerp(lift(time, 2.8) * env.lift, env.floor + 0.25, active);
    const lid = env.props?.getObjectByName('lid');
    if (lid) lid.rotation.x = -segment(time, 1.7, 1.95, easeOut) * 1.95;
  }),
  blackKey: clip(3.4, [['LIFT', 0], ['ALIGN', 0.4], ['INSERT', 1], ['TURN', 1.5], ['OPEN', 2.1], ['REVEAL', 2.5]], (pivot, model, time, env) => {
    const align = segment(time, 0.4, 1);
    pivot.rotation.y = align * PI / 2;
    model.rotation.x = segment(time, 1.5, 2) * PI / 2;
    pivot.position.set(0, lerp(lift(time, 9) * env.lift, env.floor + 0.2, align), -segment(time, 1, 1.4) * 0.07);
    const gem = model.getObjectByName('gem');
    if (gem) gem.scale.setScalar(1 + Math.max(0, Math.sin(time * 9)) * 0.6 * align);
    const lid = env.props?.getObjectByName('lid');
    if (lid) lid.rotation.x = -segment(time, 2.1, 2.7, easeOut) * 1.9;
  }),
  handcuffs: clip(2.6, [['LIFT', 0], ['OPEN', 0.4], ['SNAP ON', 1.2], ['LOCKED', 1.5]], (pivot, model, time, env) => {
    const move = segment(time, 0.6, 1.2);
    const down = segment(time, 1, 1.25, (value) => value * value);
    const open = segment(time, 0.4, 0.7) * (1 - segment(time, 1.25, 1.32));
    rotateNamed(model, 'cuffLeft', { z: open * 0.9 });
    rotateNamed(model, 'cuffRight', { x: time > 1.3 ? 0.5 + Math.sin(time * 7) * 0.25 * Math.exp(-(time - 1.3) * 2) : open * 0.3 });
    pivot.position.set(lerp(0, -0.02, move), lerp(lift(time, 9) * env.lift, 0.45, move) - down * (0.33 - env.floor), lerp(0, -0.26, move));
  }),
  passageToken: clip(2.8, [['LIFT', 0], ['PRESENT', 0.4], ['GLOW', 1], ['DEPART', 1.7]], (pivot, model, time, env) => {
    const present = segment(time, 0.4, 0.9);
    const depart = segment(time, 1.7, 2.7, (value) => value * value);
    model.rotation.x = present * PI / 2;
    pivot.position.set(0, lift(time, 9) * env.lift + present * 0.12 + depart * 0.35, -depart * 0.9);
    pivot.rotation.z = Math.sin(time * 2) * 0.05;
    pivot.scale.setScalar(1 - depart * 0.6);
    model.visible = time < 2.7;
  }),
} satisfies Partial<Record<ItemModelId, PresentationClip>>);

export type PresentationClipId = keyof typeof PRESENTATION_CLIPS;
export const ITEMS_WITHOUT_CLIPS = ['brassIdol', 'glassEye', 'redLedger'] as const satisfies readonly ItemModelId[];

export function runPresentationClip(
  id: PresentationClipId,
  pivot: Group,
  model: Object3D,
  time: number,
  environment?: ClipEnvironment,
): void {
  PRESENTATION_CLIPS[id].apply(pivot, model, time, environment);
}
