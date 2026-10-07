import {
  AmbientLight,
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Fog,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshPhongMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Scene,
  SphereGeometry,
  SpotLight,
  TorusGeometry,
  Vector3,
  type Camera,
  type Material,
  type Object3D,
} from 'three';
import { ITEM_PRESENTATION, VisualKit } from './kit.js';
import type {
  OfferVisual,
  ProjectedAnchor,
  SceneBundle,
  ShopSceneOptions,
  TableSceneOptions,
} from './types.js';

const PI = Math.PI;
export const TABLE_TOP_Y = 0.962;

export const TABLE_ANCHORS = Object.freeze({
  center: new Vector3(0, 1.02, 0),
  standardChest: new Vector3(-1.15, 1.32, -0.6),
  blackChest: new Vector3(1.2, 1.42, -0.6),
  door: new Vector3(2.4, 2.8, -5.9),
});

export const CAMERA_VIEWS = Object.freeze({
  seat: { position: [0, 1.58, 2.4], lookAt: [0, 0.74, -0.6] },
  left: { position: [-0.1, 1.58, 2.4], lookAt: [-1.9, 1, -0.3] },
  door: { position: [0.12, 1.6, 2.4], lookAt: [1.7, 2.15, -3.6] },
  down: { position: [0, 1.5, 2.25], lookAt: [0, 0.7, 0.5] },
  spectator: { position: [0, 4.1, 3.1], lookAt: [0, 0.85, -0.15] },
  downed: { position: [0.35, 1.05, 2.3], lookAt: [-0.1, 0.95, -1], roll: 0.28 },
} as const);

export type CameraView = keyof typeof CAMERA_VIEWS;

function plane(
  kit: VisualKit,
  scene: Scene,
  width: number,
  height: number,
  material: Material,
  position: readonly [number, number, number],
  rotation: readonly [number, number, number],
): Mesh {
  const mesh = kit.mesh(new PlaneGeometry(width, height), material, ...position, ...rotation);
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function signTexture(kit: VisualKit, namespace: string, text: string, background = '#2c1a10') {
  return kit.texture(namespace, 128, 24, (context, width, height, random) => {
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
    kit.noise(context, width, height, 220, ['rgba(0,0,0,.4)'], random);
    context.fillStyle = '#d6c9ab';
    context.font = 'bold 15px monospace';
    context.textAlign = 'center';
    context.fillText(text, width / 2, 17);
  });
}

function createRoom(kit: VisualKit, scene: Scene): void {
  const wallTexture = kit.texture('room:wall', 64, 64, (context, width, height, random) => {
    context.fillStyle = '#2a2420';
    context.fillRect(0, 0, width, height);
    kit.noise(context, width, height, 900, ['rgba(0,0,0,.35)', 'rgba(90,80,70,.2)', 'rgba(40,30,20,.3)'], random);
    context.fillStyle = 'rgba(0,0,0,.5)';
    context.fillRect(0, 31, width, 2);
    context.fillRect(31, 0, 2, 31);
  }, [8, 3]);
  const floorTexture = kit.texture('room:floor', 64, 64, (context, width, height, random) => {
    context.fillStyle = '#1e1813';
    context.fillRect(0, 0, width, height);
    for (let x = 0; x < width; x += 8) {
      context.fillStyle = 'rgba(0,0,0,.5)';
      context.fillRect(x, 0, 1, height);
    }
    kit.noise(context, width, height, 700, ['rgba(0,0,0,.4)', 'rgba(70,55,40,.25)'], random);
  }, [10, 10]);
  const walls = new MeshLambertMaterial({ map: wallTexture });
  const floor = new MeshLambertMaterial({ map: floorTexture });
  plane(kit, scene, 30, 30, floor, [0, 0, 0], [-PI / 2, 0, 0]);
  plane(kit, scene, 14, 5, walls, [0, 2.5, -6], [0, 0, 0]);
  plane(kit, scene, 14, 5, walls, [-6, 2.5, 0], [0, PI / 2, 0]);
  plane(kit, scene, 14, 5, walls, [6, 2.5, 0], [0, -PI / 2, 0]);
  plane(kit, scene, 14, 14, new MeshLambertMaterial({ color: 0x0c0a09 }), [0, 4.8, 0], [PI / 2, 0, 0]);
}

function createTable(kit: VisualKit, scene: Scene): void {
  const m = kit.materials;
  scene.add(kit.mesh(new BoxGeometry(4.3, 0.12, 3.3), m.wood, 0, 0.9, 0));
  for (const [x, z] of [[-1.9, -1.4], [1.9, -1.4], [-1.9, 1.4], [1.9, 1.4]] as const) {
    scene.add(kit.mesh(new BoxGeometry(0.14, 0.84, 0.14), m.wood, x, 0.42, z));
  }
  scene.add(
    kit.mesh(new BoxGeometry(4.3, 0.07, 0.1), m.wood, 0, 0.995, -1.6),
    kit.mesh(new BoxGeometry(4.3, 0.07, 0.1), m.wood, 0, 0.995, 1.6),
    kit.mesh(new BoxGeometry(0.1, 0.07, 3.3), m.wood, -2.1, 0.995, 0),
    kit.mesh(new BoxGeometry(0.1, 0.07, 3.3), m.wood, 2.1, 0.995, 0),
  );
  const felt = kit.texture('table:felt', 256, 192, (context, width, height, random) => {
    context.fillStyle = '#2a3024';
    context.fillRect(0, 0, width, height);
    for (let index = 0; index < 16; index += 1) {
      const x = random() * width;
      const y = random() * height;
      const radius = 10 + random() * 40;
      const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, index % 2 ? 'rgba(60,40,24,.35)' : 'rgba(70,82,52,.3)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      context.fillStyle = gradient;
      context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    kit.noise(context, width, height, 9000, ['rgba(0,0,0,.25)', 'rgba(90,100,70,.18)', 'rgba(20,16,12,.3)'], random);
    context.strokeStyle = 'rgba(214,200,168,.72)';
    context.lineWidth = 1;
    context.strokeRect(6.5, 6.5, width - 13, height - 13);
    const slot = (x: number, z: number) => {
      const px = Math.round((x / 4.1 + 0.5) * width - 8);
      const py = Math.round((z / 3.1 + 0.5) * height - 8);
      context.fillStyle = 'rgba(10,12,8,.45)';
      context.fillRect(px, py, 16, 16);
      context.strokeRect(px + 0.5, py + 0.5, 15, 15);
    };
    for (let index = 0; index < 6; index += 1) {
      const offset = -0.75 + index * 0.3;
      slot(offset, 1.12);
      slot(offset, -1.15);
      slot(-1.72, offset);
      slot(1.72, offset);
    }
    context.beginPath();
    context.arc(width / 2, height / 2, 34, 0, PI * 2);
    context.stroke();
  });
  plane(kit, scene, 4.1, 3.1, new MeshLambertMaterial({ map: felt }), [0, 0.961, 0], [-PI / 2, 0, 0]);
  scene.add(kit.mesh(new TorusGeometry(0.53, 0.012, 4, 32), m.brass, 0, 0.963, 0, PI / 2));
}

function createLamp(kit: VisualKit, scene: Scene): Group {
  const m = kit.materials;
  const lamp = new Group();
  lamp.name = 'tableLamp';
  lamp.position.set(0, 4.8, 0);
  lamp.add(
    kit.mesh(new CylinderGeometry(0.01, 0.01, 1.85, 4), m.dark, 0, -0.92),
    kit.mesh(new CylinderGeometry(0.08, 0.12, 0.1, 8), m.dark, 0, -1.88),
  );
  const shade = kit.mesh(new ConeGeometry(0.5, 0.38, 10, 1, true), new MeshPhongMaterial({ color: 0x2c2a26, side: 2, shininess: 30 }), 0, -2.05);
  shade.castShadow = false;
  lamp.add(shade, kit.mesh(new SphereGeometry(0.09, 8, 6), m.bulb, 0, -2.15));
  const target = new Group();
  target.position.set(0, 0.9, 0);
  scene.add(target);
  const spot = new SpotLight(0xffd9a0, 20, 0, 0.82, 0.5, 2);
  spot.position.set(0, -2.12, 0);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.002;
  spot.target = target;
  lamp.add(spot);
  scene.add(lamp, new AmbientLight(0x2a221c, 0.95));
  const fill = new PointLight(0x4a5a6a, 0.8, 6, 2);
  fill.position.set(0, 2, 3.5);
  scene.add(fill);
  return lamp;
}

function createDoor(kit: VisualKit): Group {
  const m = kit.materials;
  const door = kit.group(
    kit.mesh(new BoxGeometry(0.12, 2.4, 0.2), m.dark, -0.56, 1.2),
    kit.mesh(new BoxGeometry(0.12, 2.4, 0.2), m.dark, 0.56, 1.2),
    kit.mesh(new BoxGeometry(1.24, 0.14, 0.2), m.dark, 0, 2.43),
    kit.mesh(new BoxGeometry(0.32, 0.1, 0.08), m.glowGreen, 0, 2.62, 0.05),
  );
  const glow = kit.mesh(new PlaneGeometry(1, 2.3), new MeshBasicMaterial({ color: 0x2c4229 }), 0, 1.15, -0.05);
  door.add(glow);
  const panel = kit.mesh(new BoxGeometry(1, 2.3, 0.06), m.dark, 0, 1.15, 0);
  panel.position.x = 0.5;
  const hinge = new Group();
  hinge.position.set(-0.5, 0, 0.02);
  hinge.rotation.y = 0.35;
  hinge.add(panel);
  door.add(hinge);
  door.position.set(2.4, 0, -5.9);
  door.name = 'exitDoor';
  door.userData.label = 'EXIT';
  return door;
}

function createCenterPresentation(kit: VisualKit, scene: Scene, interactive: Object3D[]): void {
  const m = kit.materials;
  const dieTexture = kit.texture('table:order-die', 9, 9, (context) => {
    context.fillStyle = '#d6c9ab';
    context.fillRect(0, 0, 9, 9);
    context.fillStyle = '#1a1410';
    for (const [x, y] of [[2, 2], [6, 6], [4, 4]] as const) context.fillRect(x, y, 1, 1);
  });
  const die = kit.mesh(new BoxGeometry(0.09, 0.09, 0.09), new MeshLambertMaterial({ map: dieTexture }), -0.32, 1.007, 0.3, 0, 0.5);
  die.userData.label = 'ORDER DIE';
  const coin = kit.mesh(new CylinderGeometry(0.07, 0.07, 0.012, 12), m.brass, 0.36, 0.968, 0.32);
  coin.userData.label = 'DIRECTION COIN';
  scene.add(die, coin);
  interactive.push(die, coin);
}

export function createTableScene(kit: VisualKit, options: TableSceneOptions = {}): SceneBundle {
  const scene = new Scene();
  scene.background = new Color(0x020202);
  scene.fog = new Fog(0x030303, 4.5, 11);
  const camera = createCamera('seat', options.aspect ?? 16 / 9);
  const interactive: Object3D[] = [];
  const characters: Group[] = [];
  const anchors: Record<string, Vector3> = {
    ...TABLE_ANCHORS,
  };

  createRoom(kit, scene);
  createTable(kit, scene);
  createLamp(kit, scene);
  const door = createDoor(kit);
  scene.add(door);
  interactive.push(door);
  createCenterPresentation(kit, scene, interactive);

  if (options.includeChests !== false) {
    const standard = kit.createChest('standard');
    standard.position.set(-1.15, TABLE_TOP_Y, -0.6);
    standard.rotation.y = 0.3;
    standard.scale.setScalar(1.1);
    standard.userData.label = 'STANDARD CHEST';
    const black = kit.createChest('black');
    black.position.set(1.2, TABLE_TOP_Y, -0.6);
    black.rotation.y = -0.3;
    black.scale.setScalar(1.1);
    black.userData.label = 'BLACK CHEST';
    scene.add(standard, black);
    interactive.push(standard, black);
  }

  for (const seat of options.seats ?? []) {
    const character = kit.createCharacter(seat.role, seat.color, seat.label ?? '', 'seated');
    character.position.set(...seat.position);
    character.rotation.y = seat.rotationY;
    scene.add(character);
    characters.push(character);
    interactive.push(character);
    anchors[`seat:${seat.id}`] = new Vector3(seat.position[0], 2.12, seat.position[2]);
    const rim = new PointLight(seat.color, 2.2, 1.8, 2);
    rim.position.set(0, 2, -0.7);
    character.add(rim);
  }

  const seatFill = new PointLight(0xffd0a0, 2.6, 2.4, 2);
  seatFill.position.set(0, 1.55, 1.55);
  scene.add(seatFill);
  return { scene, camera, anchors, interactive, characters };
}

function addOfferRow(
  kit: VisualKit,
  scene: Scene,
  offers: readonly OfferVisual[],
  anchors: Record<string, Vector3>,
  y: number,
  z: number,
  spacing: number,
  startX: number,
  scale: number,
): Group[] {
  const objects: Group[] = [];
  offers.forEach((offer, index) => {
    const x = startX + index * spacing;
    const item = kit.createItem(offer.itemId, offer.label === undefined ? {} : { label: offer.label });
    const presentation = ITEM_PRESENTATION[offer.itemId as keyof typeof ITEM_PRESENTATION];
    if (presentation) {
      item.rotation.set(presentation.rotation[0], presentation.rotation[1], presentation.rotation[2]);
      item.position.y = presentation.y;
    }
    item.scale.setScalar(scale);
    item.position.set(x, y, z);
    item.visible = !offer.sold;
    item.userData.offerId = offer.id;
    scene.add(item);
    objects.push(item);
    anchors[`offer:${offer.id}`] = new Vector3(x, y + 0.08, z + 0.16);
  });
  return objects;
}

function createShopShell(kit: VisualKit, title: string): { scene: Scene; keeper: Group } {
  const scene = new Scene();
  scene.background = new Color(0x030303);
  scene.fog = new Fog(0x030303, 3.5, 8);
  const m = kit.materials;
  plane(kit, scene, 8, 4, new MeshLambertMaterial({ color: 0x2e2620 }), [0, 2, -1.7], [0, 0, 0]);
  plane(kit, scene, 8, 6, new MeshLambertMaterial({ color: 0x1a1410 }), [0, 0, 0], [-PI / 2, 0, 0]);
  for (const y of [1.25, 1.75, 2.25]) scene.add(kit.mesh(new BoxGeometry(2.8, 0.04, 0.3), m.wood, 0, y, -1.5));
  scene.add(
    kit.mesh(new BoxGeometry(3, 0.9, 0.7), m.wood, 0, 0.45, 0),
    kit.mesh(new BoxGeometry(3.1, 0.05, 0.8), m.wood, 0, 0.925, 0),
  );
  const sign = kit.mesh(new PlaneGeometry(1.2, 0.22), new MeshLambertMaterial({ map: signTexture(kit, `shop:sign:${title}`, title) }), -0.2, 0.62, 0.352);
  scene.add(sign);
  const keeper = kit.createCharacter('tallyman', 0xa47a38, title, 'standing');
  keeper.position.set(0, 0, -0.75);
  scene.add(keeper);
  const spotlight = new SpotLight(0xffd9a0, 34, 0, 1, 0.45, 2);
  spotlight.position.set(0, 2.28, -0.1);
  spotlight.castShadow = true;
  const target = new Group();
  target.position.set(0, 0.9, 0);
  spotlight.target = target;
  scene.add(target, spotlight, new AmbientLight(0x3a3028, 1.5));
  return { scene, keeper };
}

export function createPublicShopScene(kit: VisualKit, options: ShopSceneOptions = {}): SceneBundle {
  const { scene, keeper } = createShopShell(kit, options.title ?? 'THE TALLYMAN');
  const anchors: Record<string, Vector3> = { tray: new Vector3(1.18, 1, 0.25) };
  const offers = addOfferRow(kit, scene, options.offers ?? [], anchors, 1.005, 0.1, 0.55, -1.05, 1.25);
  const camera = new PerspectiveCamera(48, options.aspect ?? 16 / 9, 0.05, 30);
  camera.position.set(0, 1.55, 2);
  camera.lookAt(0, 1.15, -0.3);
  return { scene, camera, anchors, interactive: offers, characters: [keeper] };
}

export function createBlackMarketScene(kit: VisualKit, options: ShopSceneOptions = {}): SceneBundle {
  const scene = new Scene();
  scene.background = new Color(0x020101);
  scene.fog = new Fog(0x020101, 2.5, 6);
  const m = kit.materials;
  plane(kit, scene, 6, 4, new MeshLambertMaterial({ color: 0x38100e }), [0, 2, -1.4], [0, 0, 0]);
  plane(kit, scene, 6, 6, new MeshLambertMaterial({ color: 0x120c0a }), [0, 0, 0], [-PI / 2, 0, 0]);
  scene.add(
    kit.mesh(new CylinderGeometry(0.78, 0.78, 0.05, 18), m.wood, 0, 0.78),
    kit.mesh(new CylinderGeometry(0.08, 0.14, 0.76, 8), m.wood, 0, 0.38),
    kit.mesh(new BoxGeometry(1.32, 0.012, 0.6), m.leather, 0, 0.811, 0.08),
    kit.mesh(new BoxGeometry(1.26, 0.004, 0.54), m.velvet, 0, 0.819, 0.08),
  );
  const keeper = kit.createCharacter('fence', 0x8a2a20, options.title ?? 'FENCE', 'standing');
  keeper.position.set(0, 0, -0.72);
  scene.add(keeper);
  const anchors: Record<string, Vector3> = {};
  const offers = addOfferRow(kit, scene, options.offers ?? [], anchors, 0.826, 0.01, 0.307, -0.46, 0.95);
  const lamp = new PointLight(0xffa040, 3.2, 2.8, 2);
  lamp.position.set(0.55, 1, -0.15);
  lamp.castShadow = true;
  const top = new SpotLight(0xffd9a0, 6, 0, 0.5, 0.6, 2);
  top.position.set(0, 2.6, 0.4);
  const target = new Group(); target.position.set(0, 0.8, 0.05); top.target = target;
  scene.add(lamp, top, target, new AmbientLight(0x1a1010, 0.7));
  const camera = new PerspectiveCamera(50, options.aspect ?? 16 / 9, 0.05, 20);
  camera.position.set(0, 1.5, 1.6);
  camera.lookAt(0, 1.25, -0.3);
  return { scene, camera, anchors, interactive: offers, characters: [keeper] };
}

export function createCamera(view: CameraView = 'seat', aspect = 16 / 9): PerspectiveCamera {
  const config = CAMERA_VIEWS[view];
  const camera = new PerspectiveCamera(58, aspect, 0.05, 40);
  camera.position.set(config.position[0], config.position[1], config.position[2]);
  camera.lookAt(config.lookAt[0], config.lookAt[1], config.lookAt[2]);
  if ('roll' in config) camera.rotateZ(config.roll);
  camera.updateMatrixWorld();
  return camera;
}

export function projectAnchors(
  camera: Camera,
  anchors: Readonly<Record<string, Vector3>>,
): Record<string, ProjectedAnchor> {
  camera.updateMatrixWorld();
  const projected: Record<string, ProjectedAnchor> = {};
  for (const [key, position] of Object.entries(anchors)) {
    const value = position.clone().project(camera);
    projected[key] = {
      x: (value.x + 1) / 2,
      y: (1 - value.y) / 2,
      visible: value.z < 1 && Math.abs(value.x) <= 1 && Math.abs(value.y) <= 1,
    };
  }
  return projected;
}
