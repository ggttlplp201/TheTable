import * as Three from 'three';
import { install } from './reference-game-kit.js';

type ItemDefinition = { b: () => Three.Object3D; tilt?: number };
type ItemModel = {
  canvases: Set<HTMLCanvasElement>;
  pivot: Three.Group;
  tilt: number;
  distance: number;
  index: number;
};

const MODEL_IDS: Readonly<Record<string, string>> = {
  'black-key': 'blackkey',
  'brass-idol': 'brassidol',
  'glass-eye': 'glasseye',
  'red-ledger': 'redledger',
  'passage-token': 'passage',
  bag: 'pocket',
};

const models = new Map<string, ItemModel>();
let renderer: Three.WebGLRenderer | undefined;
let scene: Three.Scene | undefined;
let camera: Three.PerspectiveCamera | undefined;
let frame = 0;
let nextIndex = 0;
let motion: MediaQueryList | undefined;

function render(time: number) {
  if (!renderer || !scene || !camera) return;
  const reduced = motion?.matches ?? false;
  const size = Math.max(40, ...[...models.values()].flatMap(model => [...model.canvases].map(canvas => canvas.width)));
  renderer.setSize(size, size, false);
  for (const model of models.values()) {
    model.pivot.visible = true;
    model.pivot.rotation.set(model.tilt, reduced ? .6 + model.index : time / 1000 * .6 + model.index, 0);
    camera.position.set(0, 0, model.distance);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    model.pivot.visible = false;
    for (const canvas of model.canvases) {
      const context = canvas.getContext('2d');
      context?.clearRect(0, 0, canvas.width, canvas.height);
      context?.drawImage(renderer.domElement, 0, 0, canvas.width, canvas.height);
    }
  }
}

function animate(time: number) {
  render(time);
  frame = motion?.matches || document.visibilityState === 'hidden' ? 0 : requestAnimationFrame(animate);
}

function redraw() {
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  render(performance.now());
  if (!motion?.matches && document.visibilityState !== 'hidden' && models.size) frame = requestAnimationFrame(animate);
}

function ensureRuntime() {
  if (renderer && scene && camera) return;
  renderer = new Three.WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000, 0);
  scene = new Three.Scene();
  const key = new Three.DirectionalLight(0xffd9a0, 2.6); key.position.set(-1, 2, 1.5); scene.add(key);
  const rim = new Three.DirectionalLight(0x6a8aa0, 1.4); rim.position.set(1.5, .5, -1.5); scene.add(rim);
  scene.add(new Three.AmbientLight(0x3a3028, .9));
  camera = new Three.PerspectiveCamera(30, 1, .01, 10);
  motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  motion.addEventListener('change', redraw);
  document.addEventListener('visibilitychange', redraw);
}

function disposeRuntime() {
  if (models.size || !renderer) return;
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  motion?.removeEventListener('change', redraw);
  document.removeEventListener('visibilitychange', redraw);
  renderer.dispose();
  renderer = undefined; scene = undefined; camera = undefined; motion = undefined; nextIndex = 0;
}

export function attachHandbookItem(canvas: HTMLCanvasElement, itemId: string): () => void {
  ensureRuntime();
  let model = models.get(itemId);
  if (!model) {
    const kit = install({}, Three) as { defs: Record<string, ItemDefinition | undefined> };
    const definition = kit.defs[MODEL_IDS[itemId] ?? itemId];
    if (!definition || !scene) return () => disposeRuntime();
    const object = definition.b();
    const sphere = new Three.Box3().setFromObject(object).getBoundingSphere(new Three.Sphere());
    object.position.sub(sphere.center);
    const pivot = new Three.Group(); pivot.add(object); pivot.visible = false; scene.add(pivot);
    model = { canvases: new Set(), pivot, tilt: definition.tilt ?? .3, distance: sphere.radius / Math.sin(15 * Math.PI / 180) * 1.02, index: nextIndex++ };
    models.set(itemId, model);
  }
  model.canvases.add(canvas);
  redraw();
  return () => {
    const current = models.get(itemId);
    current?.canvases.delete(canvas);
    if (current && current.canvases.size === 0) { current.pivot.removeFromParent(); models.delete(itemId); }
    if (models.size) redraw(); else disposeRuntime();
  };
}
