import type {
  Camera,
  Group,
  Object3D,
  PerspectiveCamera,
  Scene,
  Texture,
  Vector3,
} from 'three';

export const ITEM_MODEL_IDS = [
  'knife',
  'pistol',
  'bullet',
  'poison',
  'medicine',
  'stimulant',
  'antidote',
  'armor',
  'armorBroken',
  'cloth',
  'bag',
  'safe',
  'spyglass',
  'pickpocket',
  'key',
  'lockpick',
  'crowbar',
  'blackKey',
  'handcuffs',
  'brassIdol',
  'glassEye',
  'redLedger',
  'passageToken',
] as const;

export type ItemModelId = (typeof ITEM_MODEL_IDS)[number];

export const CHARACTER_IDS = [
  'enforcer',
  'medic',
  'smuggler',
  'locksmith',
  'broker',
  'scavenger',
  'dealer',
  'tallyman',
  'fence',
] as const;

export type CharacterId = (typeof CHARACTER_IDS)[number];
export type CharacterPose = 'seated' | 'standing';
export type ChestKind = 'standard' | 'black';
export type ChestState = 'closed' | 'open' | 'cooldown';
export type CanvasLike = HTMLCanvasElement | OffscreenCanvas;
export type CanvasFactory = (width: number, height: number) => CanvasLike;

export interface ModelOptions {
  label?: string;
}

export interface SeatVisual {
  id: string;
  role: CharacterId;
  color: number;
  position: readonly [number, number, number];
  rotationY: number;
  label?: string;
}

export interface TableSceneOptions {
  aspect?: number;
  seats?: readonly SeatVisual[];
  includeChests?: boolean;
}

export interface OfferVisual {
  id: string;
  itemId: ItemModelId;
  label?: string;
  sold?: boolean;
}

export interface ShopSceneOptions {
  aspect?: number;
  offers?: readonly OfferVisual[];
  title?: string;
}

export interface SceneBundle {
  scene: Scene;
  camera: PerspectiveCamera;
  anchors: Readonly<Record<string, Vector3>>;
  interactive: readonly Object3D[];
  characters: readonly Group[];
}

export interface ProjectedAnchor {
  x: number;
  y: number;
  visible: boolean;
}

export interface PostOptions {
  exposure?: number;
  saturation?: number;
  grain?: number;
  levels?: number;
  grade?: readonly [number, number, number];
}

export interface PostPipeline {
  readonly scene: Scene;
  readonly camera: Camera;
  readonly texture: Texture;
  resize(width: number, height: number): void;
  setGrain(amount: number): void;
  render(scene: Scene, camera: Camera, timeSeconds?: number): void;
  dispose(): void;
}

export interface ClipEnvironment {
  lift?: number;
  floor?: number;
  props?: Object3D;
  space?: Object3D;
}

export interface PresentationClip {
  readonly duration: number;
  readonly beats: readonly (readonly [label: string, time: number])[];
  apply(pivot: Group, model: Object3D, time: number, environment?: ClipEnvironment): void;
}
