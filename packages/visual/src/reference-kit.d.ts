import type * as THREE from 'three';
import type { Group, Material, Object3D } from 'three';
import type { CanvasFactory } from './types.js';

export type WildcardCardId = 'seize' | 'destroy' | 'supply-drop' | 'shatter' | 'forced-exchange' | 'search-warrant' | 'windfall' | 'redistribution' | 'scramble' | 'second-chance';
export type WildcardArtId = 'seize' | 'destroy' | 'supply' | 'shatter' | 'exchange' | 'warrant' | 'windfall' | 'redistribution' | 'scramble' | 'second';
export type WildcardTextureId = WildcardCardId | WildcardArtId | 'back';
export const WILDCARDS: ReadonlyArray<{ id: WildcardArtId; name: string }>;
export function drawWildcard(context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, id: WildcardTextureId, canvasFactory?: CanvasFactory): void;
export function drawWildcardHi(context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, id: WildcardTextureId): void;
export function pixelateCard(context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, canvasFactory?: CanvasFactory): void;

export interface ReferenceArm { sh: THREE.Bone; el: THREE.Bone; hand: Group; bx: number; be: number }
export interface ReferenceRig { up: Group; head: Group; aL: ReferenceArm; aR: ReferenceArm; role: string; ux?: number; threat?: string | null }
export interface ReferenceKit {
  coinMesh(): Group;
  playerChair(): Group;
  fpLegs(): Group;
  fpHands(): Group;
  outline(object: Object3D, on?: boolean, color?: number, scale?: number): void;
  downPose(character: Object3D, blend: number, timeSeconds?: number): void;
  downedAt(character: Object3D, elapsedSeconds: number, timeSeconds?: number): number;
  wildcardTex(id?: WildcardTextureId): THREE.CanvasTexture;
  wildcardCard(id?: WildcardTextureId): Group;
  wildcardDeck(count?: number): Group;
  setWildcardGlow(card: Group, value: number): void;
  setWildcardFace(card: Group, id: WildcardTextureId): void;
  releaseWildcardCache(): void;
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

export function jobIconURL(id: string, color?: string, out?: number): string;
export function coinIconURL(out?: number, grid?: number): string;
export function tableSealURL(status?: string, ink?: string, size?: number): string;
export function outlineIconURL(url: string, color?: string): Promise<string>;

export function coinIconCanvas(out?: number, grid?: number): HTMLCanvasElement;
export function stimIconURL(src: string, size?: number): Promise<string>;
