import type * as THREE from 'three';
import type { Group, Material, Object3D } from 'three';

export interface ReferenceArm { sh: Group; el: Group; hand: Group; bx: number; be: number }
export interface ReferenceRig { up: Group; head: Group; aL: ReferenceArm; aR: ReferenceArm; role: string; ux?: number; threat?: string | null }
export interface ReferenceKit {
  character(role: string, seatColor: number, label: string, pose: 'seated' | 'standing'): Group;
  idle(character: Object3D, timeSeconds: number, phase: number, standing: boolean): void;
  m: Record<string, Material>;
  defs: Record<string, { b(): Group; tilt?: number } | undefined>;
}
export function install(target: object, three: typeof THREE): ReferenceKit;

export interface TitleScene {
  scene: THREE.Scene;
  lamp?: THREE.Object3D;
  dispose(): void;
}
export interface VHSRenderer {
  r: THREE.WebGLRenderer;
  resize(width: number, height: number): void;
  render(scene: THREE.Scene, camera: THREE.Camera, time: number): void;
  dispose(): void;
}
export interface StillRenderer {
  r: THREE.WebGLRenderer;
  post: THREE.ShaderMaterial;
  resize(width: number, height: number): void;
  render(scene: THREE.Scene, camera: THREE.Camera, options?: { t?: number; grade?: [number, number, number]; sat?: number }): void;
  dispose(): void;
}
export function makeStill(three: typeof THREE, width: number, height: number): StillRenderer;
export function buildTitleScene(three: typeof THREE): TitleScene;
export function makeVHS(three: typeof THREE, width: number, height: number, lowWidth: number, lowHeight: number): VHSRenderer;
export function makePost(three: typeof THREE, texture: THREE.Texture, options?: object): THREE.ShaderMaterial;
export function renderIconURLs(three: typeof THREE, ids: string[], size?: number, yaw?: number): Record<string, string>;
export function renderPortraitURLs(three: typeof THREE, roles: { key: string; hex: number }[], width?: number, height?: number): Record<string, string>;
export const VHS_FS: string;
export const ITEMS: { id: string; name: string; rarity: string; price: number | null }[];
export const STATES: { id: string; name: string }[];
