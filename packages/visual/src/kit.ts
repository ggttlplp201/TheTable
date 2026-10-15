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
import * as THREE from 'three';
import { ResourceTracker } from './dispose.js';
import { install as installReferenceKit, type ReferenceKit, type ReferenceRig, type WildcardCardId } from './reference-kit.js';
export type { WildcardCardId } from './reference-kit.js';
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
const TUTORIAL_OUTLINE_DARK = new Color(0x211408);
const TUTORIAL_OUTLINE_LIGHT = new Color(0xe0a040);

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
  brassWorn: MeshPhongMaterial;
  spine: MeshLambertMaterial;
  iris: MeshLambertMaterial;
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
    this.#reference?.releaseWildcardCache();
    this.#reference = undefined;
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

  /** The source's chalk three-round outline and physical cartridges occupy one slot. */
  createAmmoSlot(quantity: number): Group {
    const texture = this.texture('ammo-slot:chalk', 32, 32, context => {
      context.clearRect(0, 0, 32, 32); context.strokeStyle = 'rgba(255,255,255,.88)'; context.lineWidth = 1;
      for (const x of [7, 16, 25]) {
        context.beginPath(); context.moveTo(x - 2.5, 27.5); context.lineTo(x - 2.5, 12);
        context.quadraticCurveTo(x, 4, x + 2.5, 12); context.lineTo(x + 2.5, 27.5); context.closePath(); context.stroke();
      }
    });
    const chalk = this.mesh(new PlaneGeometry(.2, .2), new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }), 0, .0008, 0, -PI / 2);
    chalk.name = 'ammoChalk';
    const group = this.group(chalk); group.name = 'ammoSlot';
    for (let index = 0; index < 3; index++) {
      const round = this.createItem('bullet'); round.name = `ammoRound${index}`;
      round.rotation.x = -PI / 2; round.position.set(-.056 + index * .056, .013, .035); round.scale.setScalar(1.15); group.add(round);
    }
    this.setAmmoQuantity(group, quantity);
    return group;
  }

  setAmmoQuantity(group: Group, quantity: number): void {
    const count = Math.max(0, Math.min(3, Math.floor(quantity)));
    group.userData.quantity = count;
    group.getObjectByName('ammoChalk')!.visible = count > 0;
    for (let index = 0; index < 3; index++) group.getObjectByName(`ammoRound${index}`)!.visible = index < count;
  }

  /** Covered props never instantiate the concealed item: public viewers get cloth only. */
  setCharacterThreat(character: Group, kind: 'cloth' | 'pistol' | 'knife' | null): void {
    if (character.userData.threat === kind) return;
    const hand = character.getObjectByName('armRight')?.getObjectByName('hand');
    if (!hand) return;
    character.userData.threat = kind;
    const cache = (character.userData.threatProps ??= {}) as Partial<Record<'cloth' | 'pistol' | 'knife', Group>>;
    for (const prop of Object.values(cache)) prop.visible = false;
    if (!kind) return;
    let prop = cache[kind];
    if (!prop) {
      prop = this.createItem(kind); prop.name = `threat:${kind}`;
      if (kind === 'cloth') { prop.scale.set(2.2, 1.9, 2.2); prop.position.y = -.12; }
      else prop.rotation.z = -PI / 2;
      const held = this.group(prop); held.scale.setScalar(1.3); held.position.set(0, -.05, .04); held.name = `held:${kind}`;
      hand.add(held); cache[kind] = held; prop = held;
    }
    prop.visible = true;
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

  /** Character models come from the design kit (reference-kit.js) so the table, shops and portraits are identical. */
  #reference: ReferenceKit | undefined;
  #referenceKit(): ReferenceKit {
    if (!this.#reference) {
      this.#reference = installReferenceKit({ canvasFactory: this.#canvasFactory, trackResource: (resource: { dispose(): void }) => this.#resources.track(resource) }, THREE);
      // The design kit creates shared materials eagerly, including ones unused by this role.
      for (const material of Object.values(this.#reference.m)) {
        this.#resources.track(material);
        const map = (material as Material & { map?: THREE.Texture | null }).map;
        if (map) this.#resources.track(map);
      }
    }
    return this.#reference;
  }

  /** Artwork is keyed through the handoff's original IDs so paper wear stays exact. */
  wildcardTex(id: WildcardCardId | 'back' = 'back'): CanvasTexture {
    return this.#resources.track(this.#referenceKit().wildcardTex(id));
  }

  /** Private/opponent placeholders use the shared back on both faces. */
  wildcardCard(id: WildcardCardId | 'back' = 'back'): Group {
    return this.#trackWildcard(this.#referenceKit().wildcardCard(id));
  }

  wildcardDeck(count = 14): Group {
    return this.#trackWildcard(this.#referenceKit().wildcardDeck(count));
  }

  setWildcardGlow(card: Group, value: number): void {
    this.#referenceKit().setWildcardGlow(card, value);
  }

  setWildcardFace(card: Group, id: WildcardCardId | 'back'): void {
    this.#referenceKit().setWildcardFace(card, id);
    this.wildcardTex(id);
  }

  createCoin(): Group { return this.#trackWildcard(this.#referenceKit().coinMesh()); }

  createPlayerChair(): Group { return this.#trackWildcard(this.#referenceKit().playerChair()); }
  createFirstPersonLegs(): Group { return this.#trackWildcard(this.#referenceKit().fpLegs()); }
  createFirstPersonHands(): Group { return this.#trackWildcard(this.#referenceKit().fpHands()); }

  /** The source's brass 6% back-face hull for in-scene item and target selection. */
  setInteractionOutline(object: Object3D, visible: boolean): void {
    if (!visible && !object.userData.hull) return;
    const hadHull = Boolean(object.userData.hull);
    this.#referenceKit().outline(object, visible);
    const hull = object.userData.hull as Group | undefined;
    if (hull && !hadHull) this.#trackWildcard(hull);
  }

  #trackWildcard(root: Group): Group {
    root.traverse(object => {
      const mesh = object as Mesh;
      if (mesh.geometry) this.#resources.track(mesh.geometry);
      for (const material of Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []) {
        this.#resources.track(material);
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) this.#resources.track(value);
      }
    });
    return root;
  }

  /** Supplied brass back-face hull, isolated to tutorial highlights. */
  setTutorialOutline(object: Object3D, visible: boolean, pulse = 1, scale = 1.09, maxOpacity = 1): void {
    let hull = object.userData.tutorialHull as Group | undefined;
    if (!hull && visible) {
      hull = new Group();
      const material = this.#resources.track(new MeshBasicMaterial({ color: 0xe0a040, side: THREE.BackSide, transparent: true }));
      object.userData.tutorialHullMaterial = material;
      object.updateMatrixWorld(true);
      const inverse = new THREE.Matrix4().copy(object.matrixWorld).invert();
      object.traverse(child => {
        if (!(child instanceof Mesh)) return;
        const outline = new Mesh(child.geometry, material); outline.matrixAutoUpdate = false;
        outline.matrix.copy(inverse).multiply(child.matrixWorld).multiply(new THREE.Matrix4().makeScale(scale, scale, scale));
        hull!.add(outline);
      });
      object.add(hull); object.userData.tutorialHull = hull;
    }
    if (hull) {
      hull.visible = visible;
      const material = object.userData.tutorialHullMaterial as MeshBasicMaterial | undefined;
      if (visible && material) {
        const amount = Math.max(0, Math.min(1, pulse));
        material.color.copy(TUTORIAL_OUTLINE_DARK).lerp(TUTORIAL_OUTLINE_LIGHT, amount);
        material.opacity = maxOpacity * (.55 + amount * .45);
      }
    }
  }

  createCharacter(role: CharacterId, seatColor: number, label = '', pose: CharacterPose = 'seated'): Group {
    const root = this.#referenceKit().character(role, seatColor, label, pose);
    const rig = root.userData.P as ReferenceRig;
    // Names and rest poses the runtimes and setCharacterThreat rely on.
    rig.up.name = 'upper'; rig.head.name = 'head';
    for (const [arm, name] of [[rig.aL, 'armLeft'], [rig.aR, 'armRight']] as const) {
      arm.sh.name = name; arm.el.name = 'elbow'; arm.hand.name = 'hand';
      arm.sh.userData.restX = arm.bx; arm.el.userData.restX = arm.be; arm.sh.userData.restZ = arm.sh.rotation.z;
    }
    root.traverse(object => {
      const mesh = object as Object3D & { geometry?: { dispose(): void }; material?: Material | Material[]; skeleton?: THREE.Skeleton };
      if (mesh.geometry) this.#resources.track(mesh.geometry);
      // The final cast uses skinned arms. Bone textures are allocated lazily by
      // Three, so track the skeleton itself and release those textures on teardown.
      if (mesh.skeleton) this.#resources.track(mesh.skeleton);
      for (const material of Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []) {
        this.#resources.track(material);
        const map = (material as Material & { map?: { dispose(): void } | null }).map; if (map) this.#resources.track(map);
      }
    });
    root.userData.characterId = role;
    root.userData.role = role;
    root.userData.pose = pose;
    root.userData.label = label;
    root.userData.rig = { upper: rig.up, head: rig.head, arms: [rig.aL.sh, rig.aR.sh] };
    root.userData.hands = [rig.aL.hand, rig.aR.hand];
    return root;
  }

  animateCharacter(character: Group, timeSeconds: number, phase = 0): void {
    const rig = character.userData.P as ReferenceRig | undefined;
    if (!rig) return;
    const standing = character.userData.pose === 'standing';
    // Runtimes may override rest poses (market keepers lean on the counter) through userData.restX.
    for (const arm of [rig.aL, rig.aR]) { arm.bx = Number(arm.sh.userData.restX ?? arm.bx); arm.be = Number(arm.el.userData.restX ?? arm.be); }
    rig.threat = (character.userData.threat as string | null | undefined) ?? null;
    this.#referenceKit().idle(character, timeSeconds, phase, standing);
    if (!rig.threat) for (const arm of [rig.aL, rig.aR]) arm.sh.rotation.z = Number(arm.sh.userData.restZ);
  }

  animateDownedCharacter(character: Group, elapsedSeconds: number, timeSeconds: number, phase = 0): void {
    this.animateCharacter(character, timeSeconds, phase);
    this.#referenceKit().downedAt(character, elapsedSeconds, timeSeconds);
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
      brassWorn: phong(0x8a6c36, 25, { specular: 0x8a7a50 }),
      spine: lambert(0x4a120e),
      iris: lambert(0x3e7a70),
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
          this.mesh(new CylinderGeometry(0.022, 0.022, 0.2, 8), m.metal, 0.14, 0.1, 0, 0, 0, PI / 2),
          box(0.14, 0.075, 0.05, m.dark, 0.02, 0.09), chamber,
          this.mesh(new BoxGeometry(0.055, 0.13, 0.045), m.wood, -0.075, 0.025, 0, 0, 0, -0.35),
          this.mesh(new TorusGeometry(.024, .006, 4, 8, PI), m.dark, 0, .05, 0, 0, 0, PI),
          hammer, box(.012, .02, .012, m.metal, .23, .125),
        );
      }
      case 'bullet':
        return this.group(this.mesh(new CylinderGeometry(.011, .011, .04, 10), m.brass, 0, .025), this.mesh(new CylinderGeometry(.013, .013, .005, 10), m.brass, 0, .0025), this.mesh(new CylinderGeometry(.003, .011, .022, 10), m.copper, 0, .056));
      case 'poison': {
        const cork = named(this.mesh(new CylinderGeometry(0.021, 0.017, 0.045, 6), m.leather, 0, 0.27), 'cork');
        return this.group(
          this.mesh(new SphereGeometry(0.078, 9, 7), m.glassGreen, 0, 0.078),
          this.mesh(new CylinderGeometry(0.022, 0.024, 0.11, 7), m.glassGreen, 0, 0.19),
          this.mesh(new CylinderGeometry(.031, .031, .012, 7), m.glassGreen, 0, .246),
          cork,
          this.mesh(new CylinderGeometry(0.034, 0.034, 0.014, 7), m.red, 0, 0.25),
          this.mesh(new BoxGeometry(.05, .065, .004), m.bone, .035, .15, .055, 0, .3, .25),
          this.mesh(new BoxGeometry(.022, .022, .006), m.red, .036, .15, .058, 0, .3, .25),
        );
      }
      case 'medicine': {
        const cap = named(this.group(
          cylinder(0.038, 0.038, 0.035, m.white, 12),
          box(0.03, 0.004, 0.009, m.red, 0, 0.018),
          box(0.009, 0.004, 0.03, m.red, 0, 0.018),
        ), 'cap');
        cap.position.y = 0.145;
        const seal = named(this.group(this.mesh(new CylinderGeometry(.031, .031, .004, 12), m.silver, 0, 0, .031)), 'seal');
        seal.position.set(0, 0.132, -0.031);
        return this.group(
          this.mesh(new CylinderGeometry(0.055, 0.055, 0.11, 12), m.glassPale, 0, 0.055),
          this.mesh(new CylinderGeometry(0.057, 0.057, 0.05, 12), m.bone, 0, 0.055),
          box(.04, .012, .01, m.red, 0, .055, .058),
          box(.012, .04, .01, m.red, 0, .055, .058),
          this.mesh(new CylinderGeometry(.03, .034, .02, 12), m.dark, 0, .12),
          seal, cap,
        );
      }
      case 'stimulant':
        return this.group(
          this.mesh(new CylinderGeometry(.026, .026, .075, 10), m.glassAmber, 0, .0395),
          this.mesh(new CylinderGeometry(.0275, .0275, .034, 10), m.bone, 0, .042),
          box(.013, .004, .003, m.red, 0, .044, .028),
          box(.004, .013, .003, m.red, 0, .044, .028),
          this.mesh(new CylinderGeometry(.026, .012, .02, 10), m.glassAmber, 0, .087),
          this.mesh(new CylinderGeometry(.008, .008, .018, 8), m.glassAmber, 0, .105),
          this.mesh(new CylinderGeometry(.011, .011, .013, 8), m.dark, 0, .12),
          this.mesh(new CylinderGeometry(.027, .027, .004, 10), m.dark, 0, .002),
        );
      case 'antidote': {
        const dose = named(this.mesh(new CylinderGeometry(0.02, 0.02, 0.16, 8), m.glassAmber, 0, 0.13), 'dose');
        const plunger = named(this.group(cylinder(0.007, 0.007, 0.07, m.metal, 6), this.mesh(new CylinderGeometry(.03, .03, .01, 8), m.metal, 0, .04)), 'plunger');
        plunger.position.y = 0.25;
        return this.group(
          dose,
          this.mesh(new CylinderGeometry(0.024, 0.024, 0.16, 8), m.glassPale, 0, 0.13),
          this.mesh(new CylinderGeometry(.025, .025, .015, 8), m.metal, 0, .05),
          this.mesh(new CylinderGeometry(.025, .025, .015, 8), m.metal, 0, .21),
          box(0.08, 0.01, 0.025, m.metal, 0, 0.215),
          plunger,
          this.mesh(new CylinderGeometry(.015, .009, .03, 6), m.silver, 0, .03),
          this.mesh(new CylinderGeometry(0.006, 0.006, 0.075, 4), m.silver, 0, -0.02),
          this.mesh(new ConeGeometry(.006, .028, 4), m.silver, 0, -.071, 0, PI),
        );
      }
      case 'armor':
      case 'armorBroken': {
        const broken = id === 'armorBroken';
        if (broken) return this.group(
          this.mesh(new CylinderGeometry(.11, .1, .17, 6, 1, true, -1.1, 1), m.rustDouble, -.01, .085, 0, 0, 0, .06),
          this.mesh(new CylinderGeometry(.11, .1, .12, 5, 1, true, .12, .98), m.rustDouble, .035, .05, .012, .1, 0, -.4),
          this.mesh(new CylinderGeometry(.113, .113, .02, 6, 1, true, -1.1, 1), m.brassDouble, -.01, .165, 0, 0, 0, .06),
          this.mesh(new BoxGeometry(.03, .2, .012), m.leather, -.105, .085, -.02, 0, -1),
          box(.014, .012, .012, m.metal, .05, .006, .1), box(.018, .01, .012, m.metal, .1, .006, .07),
        );
        const shell = this.mesh(new CylinderGeometry(0.11, 0.1, 0.17, broken ? 6 : 10, 1, true, -1.1, broken ? 1 : 2.2), broken ? m.rustDouble : m.metalDouble, 0, 0.085);
        return this.group(
          shell,
          this.mesh(new CylinderGeometry(0.113, 0.113, 0.02, 10, 1, true, -1.1, 2.2), m.brassDouble, 0, 0.165),
          this.mesh(new CylinderGeometry(.103, .103, .02, 10, 1, true, -1.1, 2.2), m.brassDouble, 0, .008),
          ...[[-.7, .13], [.7, .13], [-.7, .04], [.7, .04]].map(([angle, y]) => this.mesh(new SphereGeometry(.009, 4, 3), m.brass, Math.sin(angle!) * .112, y, Math.cos(angle!) * .112)),
          this.mesh(new BoxGeometry(.03, .2, .012), m.leather, -.105, .085, -.02, 0, -1),
          this.mesh(new BoxGeometry(.03, .2, .012), m.leather, .105, .085, -.02, 0, 1),
        );
      }
      case 'cloth': {
        const drape = this.mesh(new SphereGeometry(0.12, 8, 5, 0, PI * 2, 0, PI / 2), m.cloth);
        drape.scale.set(1.05, 0.55, 0.9);
        return this.group(drape, ...[.3, 1.9, 3.5, 5].map(angle => this.mesh(new BoxGeometry(.07, .008, .07), m.cloth, Math.cos(angle) * .12, .004, Math.sin(angle) * .11, 0, angle + PI / 4)), this.mesh(new BoxGeometry(.12, .004, .006), m.bone, 0, .066, .02, 0, .3));
      }
      case 'bag': {
        const body = box(0.2, 0.15, 0.09, m.leather, 0, 0.085, 0);
        const flap = named(box(0.21, 0.07, 0.018, m.cloth, 0, 0.145, 0.052), 'flap');
        flap.rotation.x = -0.18;
        const strap = this.mesh(new TorusGeometry(0.12, 0.012, 5, 14, PI), m.leather, 0, 0.16, -0.01, 0, 0, PI);
        return this.group(body, flap, strap, box(0.035, 0.035, 0.012, m.brass, 0, 0.13, 0.065));
      }
      case 'safe': {
        const dialModel = this.group(this.mesh(new CylinderGeometry(.025, .025, .012, 12), m.brass, 0, 0, 0, PI / 2), box(.004, .01, .004, m.black, 0, .019, .007));
        const door = named(this.group(box(0.196, 0.156, 0.014, m.metal, 0.1), dialModel), 'door');
        door.position.set(-0.1, 0.08, 0.087);
        const dial = door.children[1];
        if (!dial) throw new Error('Safe dial construction failed.');
        dial.name = 'dial';
        dial.position.set(0.08, 0.012, 0.01);
        const handle = named(box(0.01, 0.04, 0.012, m.brass, 0.15, -0.01, 0.013), 'handle');
        door.add(handle, box(.01, .03, .012, m.brass, .004, .045), box(.01, .03, .012, m.brass, .004, -.045));
        return this.group(
          box(0.2, 0.015, 0.16, m.dark, 0, 0.0075),
          box(0.2, 0.015, 0.16, m.dark, 0, 0.1525),
          box(0.015, 0.16, 0.16, m.dark, -0.0925, 0.08),
          box(0.015, 0.16, 0.16, m.dark, 0.0925, 0.08),
          box(0.2, 0.16, 0.015, m.dark, 0, 0.08, -0.0725),
          box(.17, .13, .004, m.velvet, 0, .08, -.063), door,
          ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => box(.02, .008, .02, m.brass, a! * .085, -.004, b! * .065)),
        );
      }
      case 'spyglass': {
        const tube2 = named(this.mesh(new CylinderGeometry(0.025, 0.025, 0.1, 8), m.brass, 0.04, 0.036, 0, 0, 0, PI / 2), 'tube2');
        const tube3 = named(this.mesh(new CylinderGeometry(0.02, 0.02, 0.06, 8), m.brass, 0.11, 0.036, 0, 0, 0, PI / 2), 'tube3');
        return this.group(this.mesh(new CylinderGeometry(0.03, 0.03, 0.12, 8), m.leather, -0.06, 0.036, 0, 0, 0, PI / 2), tube2, tube3, this.mesh(new CylinderGeometry(.036, .03, .02, 8), m.brass, -.12, .036, 0, 0, 0, PI / 2), this.mesh(new CylinderGeometry(.03, .03, .005, 8), m.glassPale, -.131, .036, 0, 0, 0, PI / 2));
      }
      case 'pickpocket':
        return this.group(
          this.mesh(new CylinderGeometry(0.006, 0.006, 0.22, 5), m.metal, 0.03, 0.012, 0, 0, 0, PI / 2),
          this.mesh(new TorusGeometry(0.025, 0.005, 4, 8, PI * 1.2), m.metal, 0.14, 0.012, -0.025, PI / 2),
          this.mesh(new CylinderGeometry(0.016, 0.014, 0.09, 7), m.leather, -0.09, 0.014, 0, 0, 0, PI / 2),
          ...[-.12, -.09, -.06].map(x => this.mesh(new CylinderGeometry(.017, .017, .006, 7), m.brass, x, .014, 0, 0, 0, PI / 2)),
        );
      case 'key':
      case 'blackKey': {
        const black = id === 'blackKey';
        if (black) return this.group(
          this.mesh(new OctahedronGeometry(.05, 0), m.black, -.09, .03),
          named(this.mesh(new OctahedronGeometry(.016, 0), m.glowRed, -.09, .03, .036), 'gem'),
          this.mesh(new TorusGeometry(.03, .006, 4, 10), m.brass, -.035, .02, 0, 0, PI / 2),
          box(.15, .016, .016, m.black, .04, .02), box(.016, .016, .04, m.black, .08, .02, .025),
          box(.016, .016, .02, m.black, .1, .02, .015), box(.016, .016, .05, m.black, .12, .02, .03),
        );
        const material = black ? m.black : m.brass;
        const key = this.group(
          this.mesh(new TorusGeometry(.035, 0.01, 4, 10), material, -0.08, 0.01, 0, PI / 2),
          box(.13, 0.014, 0.014, material, 0.02, 0.01),
          box(0.014, 0.014, 0.03, material, 0.06, 0.01, 0.02),
          box(0.014, 0.014, 0.022, material, 0.08, 0.01, 0.016),
        );
        if (black) key.add(named(this.mesh(new OctahedronGeometry(0.016), m.glowRed, -0.08, 0.03, 0.036), 'gem'));
        return key;
      }
      case 'lockpick': {
        const roll = this.group(box(0.2, 0.012, 0.11, m.leather, 0, 0.006), this.mesh(new CylinderGeometry(.022, .022, .11, 8), m.leather, .1, .022, 0, PI / 2), box(.012, .014, .115, m.bone, -.07, .013));
        [-0.04, -0.01, 0.02, 0.05].forEach((x, index) => {
          const pick = named(this.group(box(0.007, 0.006, 0.13, index % 2 ? m.silver : m.metal, 0, 0, -0.07), this.mesh(new TorusGeometry(.009, .003, 3, 6), m.brass, 0, 0, 0, PI / 2)), `pick${index}`);
          pick.position.set(x, 0.017, 0.04);
          pick.rotation.y = [0, .12, -.1, .06][index]!;
          roll.add(pick);
        });
        return roll;
      }
      case 'crowbar':
        return this.group(
          box(0.36, 0.022, 0.022, m.rust, 0, 0.015),
          this.mesh(new TorusGeometry(0.04, 0.012, 4, 8, PI), m.rust, -0.18, 0.015, 0.04, PI / 2, 0, PI / 2),
          this.mesh(new BoxGeometry(.05, .008, .03), m.rust, .2, .012, 0, 0, .3),
        );
      case 'handcuffs': {
        const cuff = (side: number) => named(this.group(
          this.mesh(new TorusGeometry(0.045, 0.01, 5, 12), m.metal, 0, 0, 0, PI / 2),
          box(0.022, 0.026, 0.032, m.metal, side * 0.045),
          box(.012, .02, .014, m.dark, -side * .042),
        ), side < 0 ? 'cuffLeft' : 'cuffRight');
        const left = cuff(-1); left.position.set(-0.07, 0.012, 0);
        const right = cuff(1); right.position.set(0.07, 0.012, 0);
        return this.group(left, right, this.mesh(new TorusGeometry(0.009, 0.003, 3, 6), m.metal, -0.01, 0.012), this.mesh(new TorusGeometry(.009, .003, 3, 6), m.metal, .01, .012, 0, 0, PI / 2));
      }
      case 'brassIdol': {
        const body = this.mesh(new SphereGeometry(0.05, 8, 6), m.brassWorn, 0, 0.08);
        body.scale.set(1, 1.15, 0.85);
        return this.group(
          this.mesh(new CylinderGeometry(.05, .056, .025, 8), m.brassWorn, 0, .0125),
          this.mesh(new CylinderGeometry(.04, .05, .015, 8), m.dark, 0, .032),
          body,
          this.mesh(new SphereGeometry(0.032, 8, 6), m.brassWorn, 0, 0.155),
          this.mesh(new ConeGeometry(.012, .03, 4), m.brassWorn, -.022, .185, 0, 0, 0, .4),
          this.mesh(new ConeGeometry(.012, .03, 4), m.brassWorn, .022, .185, 0, 0, 0, -.4),
          box(0.012, 0.006, 0.004, m.black, -0.011, 0.158, 0.03),
          box(0.012, 0.006, 0.004, m.black, 0.011, 0.158, 0.03),
          this.mesh(new TorusGeometry(.03, .007, 4, 10), m.brassWorn, 0, .08, .03),
          this.mesh(new OctahedronGeometry(.011, 0), m.red, 0, .1, .045),
        );
      }
      case 'glassEye':
        return this.group(
          this.mesh(new SphereGeometry(0.055, 10, 8), m.white, 0, 0.055),
          this.mesh(new CylinderGeometry(0.026, 0.026, 0.01, 12), m.iris, 0, 0.055, 0.05, PI / 2),
          this.mesh(new CylinderGeometry(0.012, 0.012, 0.012, 10), m.black, 0, 0.055, 0.056, PI / 2),
        );
      case 'redLedger':
        return this.group(
          box(0.16, 0.012, 0.2, m.red, 0, 0.006),
          box(0.15, 0.03, 0.19, m.bone, 0.004, 0.027),
          box(0.16, 0.012, 0.2, m.red, 0, 0.048),
          box(0.014, 0.054, 0.2, m.spine, -0.08, 0.027),
          box(.166, .058, .025, m.leather, 0, .027, -.04),
          this.mesh(new CylinderGeometry(.024, .024, .008, 10), m.brass, .045, .056, .05),
          box(.03, .004, .006, m.black, .045, .061, .05),
        );
      case 'passageToken':
        return this.group(
          this.mesh(new CylinderGeometry(0.075, 0.075, 0.014, 14), m.brass, 0, 0.007),
          this.mesh(new CylinderGeometry(0.06, 0.06, 0.004, 14), m.dark, 0, 0.016),
          box(0.04, 0.004, 0.05, m.brass, 0, 0.02, 0.01),
          this.mesh(new CylinderGeometry(.02, .02, .0045, 8), m.brass, 0, .02, -.015),
        );
    }
  }

}
