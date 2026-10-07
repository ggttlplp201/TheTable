import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CapsuleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  FrontSide,
  Group,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshPhongMaterial,
  NearestFilter,
  Object3D,
  OctahedronGeometry,
  PlaneGeometry,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  type ColorRepresentation,
} from 'three';
import { ResourceTracker } from './dispose.js';
import { createSeededRandom, deriveSeed, type RandomSource } from './random.js';
import type {
  CanvasFactory,
  CanvasLike,
  CharacterId,
  CharacterPose,
  ChestKind,
  ChestState,
  ItemModelId,
  ModelOptions,
} from './types.js';

type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export interface VisualKitOptions {
  seed?: number | string;
  canvasFactory?: CanvasFactory;
}

export interface SurfaceMaterials {
  metal: MeshPhongMaterial;
  metalDouble: MeshPhongMaterial;
  dark: MeshPhongMaterial;
  black: MeshPhongMaterial;
  brass: MeshPhongMaterial;
  brassDouble: MeshPhongMaterial;
  brassPale: MeshPhongMaterial;
  wood: MeshLambertMaterial;
  bone: MeshLambertMaterial;
  white: MeshLambertMaterial;
  cloth: MeshLambertMaterial;
  leather: MeshLambertMaterial;
  red: MeshLambertMaterial;
  copper: MeshPhongMaterial;
  rust: MeshLambertMaterial;
  rustDouble: MeshLambertMaterial;
  skin: MeshLambertMaterial;
  silver: MeshPhongMaterial;
  glassGreen: MeshPhongMaterial;
  glassPale: MeshPhongMaterial;
  glassAmber: MeshPhongMaterial;
  tin: MeshPhongMaterial;
  velvet: MeshLambertMaterial;
  glowRed: MeshBasicMaterial;
  glowGreen: MeshBasicMaterial;
  bulb: MeshBasicMaterial;
  void: MeshBasicMaterial;
}

const PI = Math.PI;

function defaultCanvasFactory(width: number, height: number): CanvasLike {
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  throw new Error('VisualKit needs a canvasFactory when no DOM or OffscreenCanvas is available.');
}

function context2d(canvas: CanvasLike): Context2D {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('The supplied canvasFactory did not provide a 2D context.');
  return context as Context2D;
}

function named<T extends Object3D>(object: T, name: string): T {
  object.name = name;
  return object;
}

export const ITEM_PRESENTATION = Object.freeze({
  pistol: { rotation: [-PI / 2, 0, 0] as const, y: 0.03 },
  antidote: { rotation: [0, 0, PI / 2] as const, y: 0.03 },
  blackKey: { rotation: [0, 0, 0] as const, y: 0.025 },
} satisfies Partial<Record<ItemModelId, { rotation: readonly [number, number, number]; y: number }>>);

/**
 * Low-poly model factory ported from the art prototype.
 *
 * One kit owns all materials, textures and geometries it creates. Call `dispose()`
 * once after every object made by the kit has left the scene.
 */
export class VisualKit {
  readonly seed: number | string;
  readonly materials: SurfaceMaterials;
  readonly #canvasFactory: CanvasFactory;
  readonly #resources = new ResourceTracker();
  readonly #flatMaterials = new Map<string, MeshPhongMaterial>();

  constructor(options: VisualKitOptions = {}) {
    this.seed = options.seed ?? 0x7461626c;
    this.#canvasFactory = options.canvasFactory ?? defaultCanvasFactory;
    this.materials = this.#createMaterials();
  }

  dispose(): void {
    this.#resources.dispose();
  }

  get resourceCount(): number {
    return this.#resources.size;
  }

  texture(
    namespace: string,
    width: number,
    height: number,
    draw: (context: Context2D, width: number, height: number, random: RandomSource) => void,
    repeat?: readonly [number, number],
  ): CanvasTexture {
    const canvas = this.#canvasFactory(width, height);
    draw(context2d(canvas), width, height, createSeededRandom(deriveSeed(this.seed, namespace)));
    const texture = this.#resources.track(new CanvasTexture(canvas as HTMLCanvasElement));
    texture.colorSpace = SRGBColorSpace;
    texture.magFilter = NearestFilter;
    texture.minFilter = NearestFilter;
    texture.generateMipmaps = false;
    if (repeat) {
      texture.wrapS = RepeatWrapping;
      texture.wrapT = RepeatWrapping;
      texture.repeat.set(repeat[0], repeat[1]);
    }
    return texture;
  }

  noise(
    context: Context2D,
    width: number,
    height: number,
    count: number,
    colors: readonly string[],
    random: RandomSource,
  ): void {
    for (let index = 0; index < count; index += 1) {
      context.fillStyle = colors[index % colors.length] ?? '#000';
      context.fillRect(
        Math.floor(random() * width),
        Math.floor(random() * height),
        1 + Math.floor(random() * 2),
        1,
      );
    }
  }

  mesh(
    geometry: BufferGeometry,
    material: Material,
    x = 0,
    y = 0,
    z = 0,
    rotationX = 0,
    rotationY = 0,
    rotationZ = 0,
  ): Mesh {
    this.#resources.track(geometry);
    this.#resources.track(material);
    const mesh = new Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rotationX, rotationY, rotationZ);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  group(...objects: Object3D[]): Group {
    const group = new Group();
    group.add(...objects);
    return group;
  }

  flatMaterial(color: ColorRepresentation, doubleSided = false): MeshPhongMaterial {
    const key = `${new Color(color).getHexString()}:${doubleSided ? 'double' : 'front'}`;
    const cached = this.#flatMaterials.get(key);
    if (cached) return cached;
    const material = this.#resources.track(new MeshPhongMaterial({
      color,
      flatShading: true,
      shininess: 10,
      specular: 0x222222,
      side: doubleSided ? DoubleSide : FrontSide,
    }));
    this.#flatMaterials.set(key, material);
    return material;
  }

  createItem(id: ItemModelId, options: ModelOptions = {}): Group {
    const model = this.#buildItem(id);
    model.userData.itemId = id;
    if (options.label !== undefined) model.userData.label = options.label;
    return model;
  }

  createPocket(open = false): Group {
    const m = this.materials;
    const lid = named(new Group(), 'lid');
    lid.position.set(0, 0.04, -0.05);
    lid.add(
      this.mesh(new BoxGeometry(0.144, 0.014, 0.104), m.tin, 0, 0.007, 0.052),
      this.mesh(new BoxGeometry(0.03, 0.022, 0.004), m.brass, 0, -0.002, 0.105),
      this.mesh(new BoxGeometry(0.1, 0.002, 0.07), m.brass, 0, 0.0145, 0.052),
    );
    if (open) lid.rotation.x = -1.9;
    return this.group(
      this.mesh(new BoxGeometry(0.14, 0.04, 0.1), m.tin, 0, 0.02, 0),
      this.mesh(new BoxGeometry(0.126, 0.004, 0.086), m.velvet, 0, 0.037, 0),
      this.mesh(new BoxGeometry(0.146, 0.006, 0.106), m.brass, 0, 0.003, 0),
      this.mesh(new CylinderGeometry(0.006, 0.006, 0.12, 6), m.brass, 0, 0.04, -0.05, 0, 0, PI / 2),
      lid,
    );
  }

  createChest(kind: ChestKind, state: ChestState = 'closed'): Group {
    const m = this.materials;
    const lid = named(new Group(), 'lid');
    let chest: Group;
    if (kind === 'standard') {
      chest = this.group(
        this.mesh(new BoxGeometry(0.5, 0.26, 0.32), m.wood, 0, 0.13, 0),
        this.mesh(new BoxGeometry(0.04, 0.27, 0.33), m.brass, -0.17, 0.135, 0),
        this.mesh(new BoxGeometry(0.04, 0.27, 0.33), m.brass, 0.17, 0.135, 0),
        this.mesh(new BoxGeometry(0.07, 0.08, 0.02), m.brass, 0, 0.2, 0.165),
        this.mesh(new BoxGeometry(0.012, 0.03, 0.006), m.black, 0, 0.195, 0.177),
      );
      lid.position.set(0, 0.26, -0.16);
      lid.add(
        this.mesh(new CylinderGeometry(0.16, 0.16, 0.5, 8, 1, false, 0, PI), m.wood, 0, 0, 0.16, 0, 0, PI / 2),
        this.mesh(new CylinderGeometry(0.165, 0.165, 0.04, 8, 1, false, 0, PI), m.brass, -0.17, 0, 0.16, 0, 0, PI / 2),
        this.mesh(new CylinderGeometry(0.165, 0.165, 0.04, 8, 1, false, 0, PI), m.brass, 0.17, 0, 0.16, 0, 0, PI / 2),
      );
      if (state === 'cooldown') {
        chest.add(
          this.mesh(new BoxGeometry(0.54, 0.02, 0.02), m.metal, 0, 0.2, 0.178),
          this.mesh(new CylinderGeometry(0.035, 0.035, 0.012, 10), m.red, 0, 0.2, 0.19, PI / 2),
        );
      }
    } else {
      chest = this.group(
        this.mesh(new BoxGeometry(0.56, 0.3, 0.36), m.black, 0, 0.15, 0),
        this.mesh(new BoxGeometry(0.035, 0.31, 0.37), m.dark, -0.2, 0.155, 0),
        this.mesh(new BoxGeometry(0.035, 0.31, 0.37), m.dark, 0.2, 0.155, 0),
        this.mesh(new BoxGeometry(0.11, 0.13, 0.03), m.brass, 0, 0.2, 0.19),
        this.mesh(new OctahedronGeometry(0.028), m.glowRed, 0, 0.2, 0.21),
      );
      lid.position.set(0, 0.3, -0.18);
      lid.add(
        this.mesh(new BoxGeometry(0.6, 0.08, 0.4), m.dark, 0, 0.04, 0.18),
        this.mesh(new CylinderGeometry(0.08, 0.34, 0.1, 4), m.black, 0, 0.13, 0.18, 0, PI / 4),
      );
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
        lid.add(this.mesh(new ConeGeometry(0.025, 0.08, 4), m.brass, x * 0.28, 0.12, 0.18 + z * 0.18));
      }
    }
    if (state === 'open') lid.rotation.x = kind === 'black' ? -1.9 : -1.95;
    chest.add(lid);
    chest.userData.chestKind = kind;
    chest.userData.chestState = state;
    return chest;
  }

  createCharacter(role: CharacterId, seatColor: number, label = '', pose: CharacterPose = 'seated'): Group {
    const m = this.materials;
    const standing = pose === 'standing';
    const palettes: Record<CharacterId, readonly [number, number, number]> = {
      enforcer: [0x24282c, 0x6a5444, 0x1c1e20],
      medic: [0x5e5c56, 0x7a6450, 0x34322e],
      smuggler: [0x2c241e, 0x6e5a48, 0x221c18],
      locksmith: [0x3a3026, 0x7a6450, 0x2a221c],
      broker: [0x26282e, 0x6e5a48, 0x1e2024],
      scavenger: [0x3c3c2a, 0x6a5444, 0x2e2a20],
      tallyman: [0x4a3c2c, 0x7a6450, 0x2a221c],
      fence: [0x1c1614, 0x3a2c22, 0x141010],
    };
    const palette = palettes[role];
    const coat = this.flatMaterial(palette[0]);
    const skin = this.flatMaterial(palette[1]);
    const trousers = this.flatMaterial(palette[2]);
    const boots = this.flatMaterial(0x151210);
    const band = this.#resources.track(new MeshLambertMaterial({
      color: seatColor,
      emissive: seatColor,
      emissiveIntensity: 0.2,
    }));
    const capsule = (radius: number, length: number, material: Material) =>
      this.mesh(new CapsuleGeometry(radius, length, 3, 8), material);
    const ellipsoid = (x: number, y: number, z: number, material: Material) => {
      const shape = this.mesh(new SphereGeometry(1, 10, 8), material);
      shape.scale.set(x, y, z);
      return shape;
    };

    const root = new Group();
    const upper = named(new Group(), 'upper');
    upper.position.y = standing ? 0.98 : 0.76;
    root.add(upper);
    const head = named(new Group(), 'head');
    head.position.y = 0.8;
    upper.add(head);

    const torso = this.mesh(new CylinderGeometry(0.3, 0.24, 0.72, 12), coat, 0, 0.36, 0);
    torso.scale.z = 0.62;
    const sash = this.mesh(new CylinderGeometry(0.25, 0.255, 0.07, 12), band, 0, 0.14, 0);
    sash.scale.z = 0.66;
    upper.add(torso, sash);
    const shoulders = capsule(0.12, 0.52, coat);
    shoulders.position.set(0, 0.68, 0);
    shoulders.rotation.z = PI / 2;
    upper.add(shoulders);

    const face = ellipsoid(0.155, 0.18, 0.16, skin);
    face.position.set(0, 0.17, 0);
    head.add(face);
    for (const x of [-0.062, 0.062]) {
      const eye = ellipsoid(0.028, 0.016, 0.01, m.black);
      eye.position.set(x, 0.19, 0.147);
      head.add(eye);
    }

    const arms: Group[] = [];
    for (const side of [-1, 1]) {
      const shoulder = named(new Group(), side < 0 ? 'armLeft' : 'armRight');
      shoulder.position.set(side * 0.38, 0.68, 0);
      const upperArm = capsule(0.065, 0.3, coat);
      upperArm.position.y = -0.2;
      shoulder.add(upperArm);
      const elbow = new Group();
      elbow.position.y = -0.42;
      const lowerArm = capsule(0.058, 0.28, coat);
      lowerArm.position.y = -0.19;
      elbow.add(lowerArm);
      const hand = named(new Group(), 'hand');
      hand.position.y = -0.4;
      const palm = ellipsoid(0.055, 0.065, 0.045, skin);
      hand.add(palm);
      elbow.add(hand);
      shoulder.add(elbow);
      shoulder.rotation.z = standing ? side * 0.1 : -side * 0.12;
      shoulder.userData.restX = standing ? 0 : -0.4;
      elbow.userData.restX = standing ? -0.15 : -1.1;
      upper.add(shoulder);
      arms.push(shoulder);
    }

    if (standing) {
      for (const side of [-1, 1]) {
        const thigh = capsule(0.09, 0.36, trousers);
        thigh.position.set(side * 0.13, 0.7, 0);
        const shin = capsule(0.075, 0.32, trousers);
        shin.position.set(side * 0.13, 0.3, 0);
        const boot = ellipsoid(0.08, 0.06, 0.14, boots);
        boot.position.set(side * 0.13, 0.05, 0.04);
        root.add(thigh, shin, boot);
      }
    } else {
      const chair = named(this.group(
        this.mesh(new BoxGeometry(0.62, 0.06, 0.6), m.wood, 0, 0.5, 0),
        this.mesh(new BoxGeometry(0.62, 1.1, 0.06), m.wood, 0, 1.05, -0.32),
      ), 'chair');
      for (const x of [-0.25, 0.25]) for (const z of [-0.24, 0.24]) {
        chair.add(this.mesh(new BoxGeometry(0.055, 0.48, 0.055), m.wood, x, 0.24, z));
      }
      root.add(chair);
    }

    this.#decorateCharacter(root, role, upper, head, arms);
    root.userData.characterId = role;
    root.userData.pose = pose;
    root.userData.label = label;
    root.userData.rig = { upper, head, arms };
    return root;
  }

  animateCharacter(character: Group, timeSeconds: number, phase = 0): void {
    const rig = character.userData.rig as { upper: Group; head: Group; arms: Group[] } | undefined;
    if (!rig) return;
    const standing = character.userData.pose === 'standing';
    const wave = Math.sin;
    rig.upper.scale.y = 1 + wave(timeSeconds * 1.6 + phase) * 0.012;
    rig.upper.rotation.z = wave(timeSeconds * 0.7 + phase) * 0.02;
    rig.head.rotation.set(
      wave(timeSeconds * 0.9 + phase) * 0.04,
      wave(timeSeconds * 0.5 + phase) * (standing ? 0.25 : 0.18),
      0,
    );
    rig.arms.forEach((arm, index) => {
      arm.rotation.x = Number(arm.userData.restX ?? 0) + (standing ? wave(timeSeconds * 1.6 + phase) * (index ? -0.04 : 0.04) : 0);
    });
  }

  #createMaterials(): SurfaceMaterials {
    const woodTexture = this.texture('material:wood', 64, 64, (context, width, height, random) => {
      context.fillStyle = '#4a2e1c';
      context.fillRect(0, 0, width, height);
      for (let y = 0; y < height; y += 1) {
        context.fillStyle = `rgba(${20 + random() * 40},${10 + random() * 20},5,${random() * 0.5})`;
        context.fillRect(0, y, width, 1);
      }
      this.noise(context, width, height, 500, ['rgba(0,0,0,.3)', 'rgba(120,80,50,.2)'], random);
    }, [1, 1]);
    const clothTexture = this.texture('material:cloth', 32, 32, (context, width, height, random) => {
      context.fillStyle = '#2a201b';
      context.fillRect(0, 0, width, height);
      this.noise(context, width, height, 400, ['rgba(0,0,0,.4)', 'rgba(80,60,50,.3)'], random);
    });
    const lambert = (color: number, options: ConstructorParameters<typeof MeshLambertMaterial>[0] = {}) =>
      this.#resources.track(new MeshLambertMaterial({ color, ...options }));
    const phong = (color: number, shininess = 40, options: ConstructorParameters<typeof MeshPhongMaterial>[0] = {}) =>
      this.#resources.track(new MeshPhongMaterial({ color, shininess, specular: 0x77756e, ...options }));
    return {
      metal: phong(0x7a776f, 70),
      metalDouble: phong(0x7a776f, 70, { side: DoubleSide }),
      dark: phong(0x2b2826, 30, { specular: 0x333333 }),
      black: phong(0x161210, 50, { specular: 0x555555 }),
      brass: phong(0xa47a38, 45, { specular: 0xd0a868 }),
      brassDouble: phong(0xa47a38, 45, { specular: 0xd0a868, side: DoubleSide }),
      brassPale: phong(0xc4a85a, 60, { specular: 0xe0d090 }),
      wood: lambert(0xffffff, { map: woodTexture }),
      bone: lambert(0xd6c9ab),
      white: lambert(0xe6e1d6),
      cloth: lambert(0xffffff, { map: clothTexture }),
      leather: lambert(0x3b2416),
      red: lambert(0x7c1f19),
      copper: phong(0x9a5a34, 50),
      rust: lambert(0x5e3424),
      rustDouble: lambert(0x5e3424, { side: DoubleSide }),
      skin: lambert(0x6e5a48),
      silver: phong(0xd8dce0, 120, { specular: 0xffffff, emissive: 0x2a2e32 }),
      glassGreen: phong(0x4c7a24, 90, { transparent: true, opacity: 0.88, emissive: 0x2c5a0a }),
      glassPale: phong(0xd6ddd2, 90, { transparent: true, opacity: 0.9 }),
      glassAmber: phong(0xc08a30, 90, { transparent: true, opacity: 0.85, emissive: 0x2a1804 }),
      tin: phong(0x50555a, 55),
      velvet: lambert(0x4a1210),
      glowRed: this.#resources.track(new MeshBasicMaterial({ color: 0xd8301e })),
      glowGreen: this.#resources.track(new MeshBasicMaterial({ color: 0x4f7a48 })),
      bulb: this.#resources.track(new MeshBasicMaterial({ color: 0xffe6b0 })),
      void: this.#resources.track(new MeshBasicMaterial({ color: 0x050404 })),
    };
  }

  #buildItem(id: ItemModelId): Group {
    const m = this.materials;
    const box = (x: number, y: number, z: number, material: Material, px = 0, py = 0, pz = 0) =>
      this.mesh(new BoxGeometry(x, y, z), material, px, py, pz);
    const cylinder = (top: number, bottom: number, height: number, material: Material, segments = 8) =>
      this.mesh(new CylinderGeometry(top, bottom, height, segments), material);
    switch (id) {
      case 'knife': {
        const blade = named(this.group(
          box(0.22, 0.012, 0.05, m.metal, 0.1, 0.02),
          this.mesh(new ConeGeometry(0.025, 0.07, 3), m.metal, 0.245, 0.02, 0, 0, 0, -PI / 2),
        ), 'blade');
        return this.group(blade, box(0.13, 0.035, 0.04, m.wood, -0.08, 0.02), box(0.015, 0.045, 0.085, m.brass, -0.01, 0.02));
      }
      case 'pistol': {
        const chamber = named(this.mesh(new CylinderGeometry(0.04, 0.04, 0.075, 6), m.metal, 0.04, 0.09, 0, 0, 0, PI / 2), 'cylinder');
        const hammer = named(box(0.025, 0.03, 0.02, m.dark, -0.055, 0.14), 'hammer');
        return this.group(
          this.mesh(new CylinderGeometry(0.022, 0.022, 0.2, 6), m.metal, 0.14, 0.1, 0, 0, 0, PI / 2),
          box(0.14, 0.075, 0.05, m.dark, 0.02, 0.09), chamber,
          this.mesh(new BoxGeometry(0.055, 0.13, 0.045), m.wood, -0.075, 0.025, 0, 0, 0, -0.35),
          hammer,
        );
      }
      case 'bullet':
        return this.group(cylinder(0.011, 0.011, 0.04, m.brass, 10), cylinder(0.013, 0.013, 0.005, m.brass, 10), this.mesh(new ConeGeometry(0.011, 0.022, 10), m.copper, 0, 0.036));
      case 'poison': {
        const cork = named(this.mesh(new CylinderGeometry(0.021, 0.017, 0.045, 6), m.leather, 0, 0.27), 'cork');
        return this.group(
          this.mesh(new SphereGeometry(0.078, 9, 7), m.glassGreen, 0, 0.078),
          this.mesh(new CylinderGeometry(0.022, 0.024, 0.11, 7), m.glassGreen, 0, 0.19),
          cork,
          this.mesh(new CylinderGeometry(0.034, 0.034, 0.014, 7), m.red, 0, 0.25),
        );
      }
      case 'medicine': {
        const cap = named(this.group(
          cylinder(0.038, 0.038, 0.035, m.white, 12),
          box(0.03, 0.004, 0.009, m.red, 0, 0.018),
          box(0.009, 0.004, 0.03, m.red, 0, 0.018),
        ), 'cap');
        cap.position.y = 0.145;
        const seal = named(cylinder(0.031, 0.031, 0.004, m.silver, 12), 'seal');
        seal.position.set(0, 0.132, -0.031);
        return this.group(
          this.mesh(new CylinderGeometry(0.055, 0.055, 0.11, 12), m.glassPale, 0, 0.055),
          this.mesh(new CylinderGeometry(0.057, 0.057, 0.05, 12), m.bone, 0, 0.055),
          seal, cap,
        );
      }
      case 'antidote': {
        const dose = named(this.mesh(new CylinderGeometry(0.02, 0.02, 0.16, 8), m.glassAmber, 0, 0.13), 'dose');
        const plunger = named(this.group(cylinder(0.007, 0.007, 0.07, m.metal, 6), cylinder(0.03, 0.03, 0.01, m.metal, 8)), 'plunger');
        plunger.position.y = 0.25;
        return this.group(
          dose,
          this.mesh(new CylinderGeometry(0.024, 0.024, 0.16, 8), m.glassPale, 0, 0.13),
          box(0.08, 0.01, 0.025, m.metal, 0, 0.215),
          plunger,
          this.mesh(new CylinderGeometry(0.006, 0.006, 0.075, 4), m.silver, 0, -0.02),
        );
      }
      case 'armor':
      case 'armorBroken': {
        const broken = id === 'armorBroken';
        const shell = this.mesh(new CylinderGeometry(0.11, 0.1, 0.17, broken ? 6 : 10, 1, true, -1.1, broken ? 1 : 2.2), broken ? m.rustDouble : m.metalDouble, 0, 0.085);
        return this.group(
          shell,
          this.mesh(new CylinderGeometry(0.113, 0.113, 0.02, 10, 1, true, -1.1, 2.2), m.brassDouble, 0, 0.165),
          box(0.03, 0.2, 0.012, m.leather, -0.105, 0.085, -0.02),
          box(0.03, 0.2, 0.012, m.leather, 0.105, 0.085, -0.02),
        );
      }
      case 'cloth': {
        const drape = this.mesh(new SphereGeometry(0.12, 8, 5, 0, PI * 2, 0, PI / 2), m.cloth);
        drape.scale.set(1.05, 0.55, 0.9);
        return this.group(drape, box(0.12, 0.004, 0.006, m.bone, 0, 0.066, 0.02));
      }
      case 'bag': {
        const body = box(0.2, 0.15, 0.09, m.leather, 0, 0.085, 0);
        const flap = named(box(0.21, 0.07, 0.018, m.cloth, 0, 0.145, 0.052), 'flap');
        flap.rotation.x = -0.18;
        const strap = this.mesh(new TorusGeometry(0.12, 0.012, 5, 14, PI), m.leather, 0, 0.16, -0.01, 0, 0, PI);
        return this.group(body, flap, strap, box(0.035, 0.035, 0.012, m.brass, 0, 0.13, 0.065));
      }
      case 'safe': {
        const door = named(this.group(box(0.196, 0.156, 0.014, m.metal, 0.1), cylinder(0.025, 0.025, 0.012, m.brass, 12)), 'door');
        door.position.set(-0.1, 0.08, 0.087);
        const dial = door.children[1];
        if (!dial) throw new Error('Safe dial construction failed.');
        dial.name = 'dial';
        dial.position.set(0.08, 0.012, 0.01);
        const handle = named(box(0.01, 0.04, 0.012, m.brass, 0.15, -0.01, 0.013), 'handle');
        door.add(handle);
        return this.group(
          box(0.2, 0.015, 0.16, m.dark, 0, 0.0075),
          box(0.2, 0.015, 0.16, m.dark, 0, 0.1525),
          box(0.015, 0.16, 0.16, m.dark, -0.0925, 0.08),
          box(0.015, 0.16, 0.16, m.dark, 0.0925, 0.08),
          box(0.2, 0.16, 0.015, m.dark, 0, 0.08, -0.0725),
          door,
        );
      }
      case 'spyglass': {
        const tube2 = named(this.mesh(new CylinderGeometry(0.025, 0.025, 0.1, 8), m.brass, 0.04, 0.036, 0, 0, 0, PI / 2), 'tube2');
        const tube3 = named(this.mesh(new CylinderGeometry(0.02, 0.02, 0.06, 8), m.brass, 0.11, 0.036, 0, 0, 0, PI / 2), 'tube3');
        return this.group(this.mesh(new CylinderGeometry(0.03, 0.03, 0.12, 8), m.leather, -0.06, 0.036, 0, 0, 0, PI / 2), tube2, tube3);
      }
      case 'pickpocket':
        return this.group(
          this.mesh(new CylinderGeometry(0.006, 0.006, 0.22, 5), m.metal, 0.03, 0.012, 0, 0, 0, PI / 2),
          this.mesh(new TorusGeometry(0.025, 0.005, 4, 8, PI * 1.2), m.metal, 0.14, 0.012, -0.025, PI / 2),
          this.mesh(new CylinderGeometry(0.016, 0.014, 0.09, 7), m.leather, -0.09, 0.014, 0, 0, 0, PI / 2),
        );
      case 'key':
      case 'blackKey': {
        const black = id === 'blackKey';
        const material = black ? m.black : m.brass;
        const key = this.group(
          this.mesh(new TorusGeometry(black ? 0.04 : 0.035, 0.01, 4, 10), material, -0.08, 0.02, 0, PI / 2),
          box(black ? 0.16 : 0.13, 0.014, 0.014, material, 0.02, 0.02),
          box(0.014, 0.014, 0.03, material, 0.06, 0.02, 0.02),
          box(0.014, 0.014, 0.022, material, 0.09, 0.02, 0.016),
        );
        if (black) key.add(named(this.mesh(new OctahedronGeometry(0.016), m.glowRed, -0.08, 0.03, 0.036), 'gem'));
        return key;
      }
      case 'lockpick': {
        const roll = this.group(box(0.2, 0.012, 0.11, m.leather, 0, 0.006));
        [-0.04, -0.01, 0.02, 0.05].forEach((x, index) => {
          const pick = named(box(0.007, 0.006, 0.13, index % 2 ? m.silver : m.metal, 0, 0, -0.07), `pick${index}`);
          pick.position.set(x, 0.017, 0.04);
          roll.add(pick);
        });
        return roll;
      }
      case 'crowbar':
        return this.group(
          box(0.36, 0.022, 0.022, m.rust, 0, 0.015),
          this.mesh(new TorusGeometry(0.04, 0.012, 4, 8, PI), m.rust, -0.18, 0.015, 0.04, PI / 2, 0, PI / 2),
        );
      case 'handcuffs': {
        const cuff = (side: number) => named(this.group(
          this.mesh(new TorusGeometry(0.045, 0.01, 5, 12), m.metal),
          box(0.022, 0.026, 0.032, m.metal, side * 0.045),
        ), side < 0 ? 'cuffLeft' : 'cuffRight');
        const left = cuff(-1); left.position.set(-0.07, 0.012, 0);
        const right = cuff(1); right.position.set(0.07, 0.012, 0);
        return this.group(left, right, this.mesh(new TorusGeometry(0.009, 0.003, 3, 6), m.metal, -0.01, 0.012));
      }
      case 'brassIdol': {
        const body = this.mesh(new SphereGeometry(0.05, 8, 6), m.brassPale, 0, 0.08);
        body.scale.set(1, 1.15, 0.85);
        return this.group(
          cylinder(0.05, 0.056, 0.025, m.brassPale, 8),
          body,
          this.mesh(new SphereGeometry(0.032, 8, 6), m.brassPale, 0, 0.155),
          box(0.012, 0.006, 0.004, m.black, -0.011, 0.158, 0.03),
          box(0.012, 0.006, 0.004, m.black, 0.011, 0.158, 0.03),
        );
      }
      case 'glassEye':
        return this.group(
          this.mesh(new SphereGeometry(0.055, 10, 8), m.white, 0, 0.055),
          this.mesh(new CylinderGeometry(0.026, 0.026, 0.01, 12), m.glassGreen, 0, 0.055, 0.05, PI / 2),
          this.mesh(new CylinderGeometry(0.012, 0.012, 0.012, 10), m.black, 0, 0.055, 0.056, PI / 2),
        );
      case 'redLedger':
        return this.group(
          box(0.16, 0.012, 0.2, m.red, 0, 0.006),
          box(0.15, 0.03, 0.19, m.bone, 0.004, 0.027),
          box(0.16, 0.012, 0.2, m.red, 0, 0.048),
          box(0.014, 0.054, 0.2, m.leather, -0.08, 0.027),
        );
      case 'passageToken':
        return this.group(
          this.mesh(new CylinderGeometry(0.075, 0.075, 0.014, 14), m.brass, 0, 0.007),
          this.mesh(new CylinderGeometry(0.06, 0.06, 0.004, 14), m.dark, 0, 0.016),
          box(0.04, 0.004, 0.05, m.brass, 0, 0.02, 0.01),
        );
    }
  }

  #decorateCharacter(root: Group, role: CharacterId, upper: Group, head: Group, arms: Group[]): void {
    const m = this.materials;
    const box = (x: number, y: number, z: number, material: Material) => this.mesh(new BoxGeometry(x, y, z), material);
    if (role === 'enforcer') {
      const jaw = box(0.22, 0.1, 0.05, m.metal); jaw.position.set(0, -0.08, 0.15); head.add(jaw);
      const plate = this.mesh(new CylinderGeometry(0.31, 0.27, 0.42, 10, 1, true, -0.95, 1.9), m.metalDouble); plate.position.set(0, 0.42, 0); upper.add(plate);
    } else if (role === 'medic') {
      const wrap = this.mesh(new CylinderGeometry(0.165, 0.17, 0.04, 12), m.bone); wrap.position.set(0, 0.29, 0); head.add(wrap);
      for (const x of [-0.11, 0, 0.11]) {
        const vial = this.mesh(new CylinderGeometry(0.022, 0.022, 0.07, 6), x === 0 ? m.glassAmber : m.glassPale);
        vial.position.set(x, 0.35 - x, 0.215); upper.add(vial);
      }
    } else if (role === 'smuggler' || role === 'fence') {
      const hood = this.mesh(new SphereGeometry(0.205, 10, 8, PI / 2 + 0.85, PI * 2 - 1.7), this.flatMaterial(role === 'fence' ? 0x1e1816 : 0x2f2620, true));
      hood.position.set(0, 0.19, -0.02); head.add(hood);
      if (role === 'smuggler') {
        const satchel = this.createItem('bag'); satchel.scale.setScalar(1.4); satchel.position.set(0.3, 0.18, 0.16); upper.add(satchel);
      }
    } else if (role === 'locksmith') {
      const loupe = this.mesh(new TorusGeometry(0.045, 0.006, 4, 10), m.brass); loupe.position.set(0.062, 0.19, 0.17); head.add(loupe);
      const ring = named(this.mesh(new TorusGeometry(0.055, 0.008, 4, 10), m.brass), 'keyRing'); ring.position.set(-0.24, 0.12, 0.2); upper.add(ring);
    } else if (role === 'broker') {
      const mask = this.mesh(new CylinderGeometry(0.164, 0.15, 0.11, 12, 1, true, -1.3, 2.6), this.flatMaterial(0xd6c9ab, true));
      mask.position.set(0, 0.19, 0); head.add(mask);
      const ledger = this.createItem('redLedger'); ledger.scale.setScalar(1.2); ledger.position.set(0, 0.1, 0.22); upper.add(ledger);
    } else if (role === 'scavenger') {
      const respirator = box(0.22, 0.1, 0.07, m.dark); respirator.position.set(0, -0.06, 0.13); head.add(respirator);
      const frame = box(0.5, 0.5, 0.04, m.rust); frame.position.set(0, 0.45, -0.22); upper.add(frame);
    } else if (role === 'tallyman') {
      const visor = this.#resources.track(new MeshPhongMaterial({ color: 0x3a8a4a, transparent: true, opacity: 0.7, side: DoubleSide, emissive: 0x0a2010 }));
      const pane = box(0.42, 0.1, 0.01, visor); pane.position.set(0, 0.28, 0.12); head.add(pane);
    }
    root.userData.role = role;
    root.userData.hands = arms.map((arm) => arm.getObjectByName('hand'));
  }
}
