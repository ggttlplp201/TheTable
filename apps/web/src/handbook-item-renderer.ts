import * as Three from 'three';
import { install, makeStill, type ReferenceKit, type StillRenderer } from './reference-game-kit.js';

export type HandbookModelOptions = {
  kind: 'items' | 'chars' | 'contracts' | 'wildcards';
  modelId: string; name: string; description?: string; tint?: number; thumbnail?: boolean;
};

type ViewerEntry = {
  canvas: HTMLCanvasElement; options: HandbookModelOptions; object: Three.Object3D;
  yaw: number; pitch: number; yawVelocity: number; pitchVelocity: number;
  drag?: { x: number; y: number; pointerId: number } | undefined; dirty: boolean;
};
let viewerStage: ReturnType<typeof createViewerStage> | undefined;

function contractTexture(name: string, description: string) {
  const canvas = document.createElement('canvas'); canvas.width = 192; canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Contract canvas unavailable');
  context.fillStyle = '#d6c9ab'; context.fillRect(0, 0, 192, 256);
  context.strokeStyle = 'rgba(26,20,16,.45)'; context.strokeRect(6.5, 6.5, 179, 243);
  context.fillStyle = '#3a2e22'; context.font = '13px VT323,monospace'; context.fillText('CONTRACT', 16, 24);
  context.textAlign = 'right'; context.fillText('◆ SEALED', 176, 24);
  context.fillStyle = '#1a1410'; context.textAlign = 'center'; context.font = '26px "IM Fell English SC",serif'; context.fillText(name, 96, 56, 164);
  context.fillRect(16, 66, 160, 2); context.textAlign = 'left'; context.font = '16px VT323,monospace';
  let line = '', y = 88;
  for (const word of description.split(' ')) {
    const next = line ? line + ' ' + word : word;
    if (context.measureText(next).width > 160 && line) { context.fillText(line, 16, y); y += 16; line = word; } else line = next;
  }
  if (line) context.fillText(line, 16, y);
  context.fillRect(0, 230, 192, 26); context.fillStyle = '#e6dcc4'; context.font = '13px VT323,monospace'; context.textAlign = 'center'; context.fillText('PRIVATE — DO NOT REVEAL', 96, 247);
  const texture = new Three.CanvasTexture(canvas); texture.magFilter = texture.minFilter = Three.NearestFilter; texture.generateMipmaps = false; texture.colorSpace = Three.SRGBColorSpace;
  return texture;
}

/** The selected object and roster share one post-FX renderer and the production kit. */
function createViewerStage() {
  const kit: ReferenceKit = install({}, Three);
  const still: StillRenderer = makeStill(Three, 235, 330);
  const scene = new Three.Scene(); scene.background = new Three.Color(0x050404); scene.fog = new Three.Fog(0x050404, 4, 9);
  scene.add(new Three.HemisphereLight(0x8a7a64, 0x0a0806, .7));
  const spot = new Three.SpotLight(0xffd8a0, 30, 9, .55, .5, 1.6); spot.position.set(.4, 3.8, 2.2); spot.castShadow = true; spot.target.position.set(0, 1, 0); scene.add(spot, spot.target);
  const rim = new Three.PointLight(0x8aa0b0, 3, 4, 2); rim.position.set(-1.2, 2.2, -1.4); scene.add(rim);
  const face = new Three.PointLight(0xffc890, 2.4, 3, 2); face.position.set(0, 1.7, 1.4); scene.add(face);
  const floor = new Three.Mesh(new Three.CircleGeometry(4, 24), new Three.MeshLambertMaterial({ color: 0x1a140e })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const disc = new Three.Mesh(new Three.CylinderGeometry(.62, .66, .05, 20), kit.m.wood); disc.position.y = .025; disc.receiveShadow = true; scene.add(disc);
  const chartCanvas = document.createElement('canvas'); chartCanvas.width = 64; chartCanvas.height = 96;
  const chartContext = chartCanvas.getContext('2d');
  if (chartContext) {
    chartContext.fillStyle = '#2a2620'; chartContext.fillRect(0, 0, 64, 96); chartContext.fillStyle = '#8a8070'; chartContext.font = '8px monospace';
    for (let index = 0; index <= 8; index++) { const y = 92 - index * 11; chartContext.fillRect(0, y, index % 2 ? 10 : 64, 1); if (index % 2 === 0) chartContext.fillText(String(index / 2), 56, y - 2); }
  }
  const chartTexture = new Three.CanvasTexture(chartCanvas); chartTexture.magFilter = chartTexture.minFilter = Three.NearestFilter;
  const chart = new Three.Mesh(new Three.PlaneGeometry(2.4, 3.6), new Three.MeshLambertMaterial({ map: chartTexture })); chart.position.set(0, 1.62, -.9); chart.receiveShadow = true; scene.add(chart);
  const camera = new Three.PerspectiveCamera(34, 235 / 330, .05, 30);
  const entries = new Set<ViewerEntry>(), objects = new Map<string, Three.Object3D>();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let animation = 0, previous = 0, elapsed = 0;
  function objectFor(options: HandbookModelOptions) {
    const key = options.kind + options.modelId;
    const cached = objects.get(key); if (cached) return cached;
    let object: Three.Object3D;
    if (options.kind === 'chars') object = kit.character(options.modelId, options.tint ?? 0x8a6a3a, options.name.toUpperCase(), 'standing');
    else {
      const pivot = new Three.Group();
      if (options.kind === 'items') {
        const definition = kit.defs[MODEL_IDS[options.modelId] ?? options.modelId];
        if (!definition) throw new Error('Unknown item model: ' + options.modelId);
        const inner = new Three.Group(); inner.add(definition.b()); inner.rotation.x = -(definition.tilt ?? 0) * .35;
        const size = new Three.Box3().setFromObject(inner).getSize(new Three.Vector3()); inner.scale.setScalar(.62 / Math.max(size.x, size.y, size.z, .01));
        inner.position.sub(new Three.Box3().setFromObject(inner).getCenter(new Three.Vector3())); pivot.add(inner);
      } else if (options.kind === 'wildcards') {
        const card = kit.wildcardCard(options.modelId as Parameters<ReferenceKit['wildcardCard']>[0]); kit.setWildcardGlow(card, .25); card.rotation.x = -Math.PI / 2; card.scale.setScalar(4.2); pivot.add(card);
      } else {
        const texture = contractTexture(options.name, options.description ?? '');
        const edge = new Three.MeshLambertMaterial({ color: 0x9a8a68 }), back = new Three.MeshLambertMaterial({ color: 0xb8a882 });
        const front = new Three.MeshLambertMaterial({ map: texture, emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: .12 });
        pivot.add(new Three.Mesh(new Three.BoxGeometry(.6, .8, .006), [edge, edge, edge, edge, front, back]));
      }
      object = pivot;
    }
    object.traverse(child => { if (child instanceof Three.Mesh) child.castShadow = true; }); object.visible = false; scene.add(object); objects.set(key, object); return object;
  }
  function draw(entry: ViewerEntry, step: number) {
    const { canvas, options, object } = entry;
    if (options.thumbnail && !entry.dirty) return;
    if (!entry.drag && !reduced.matches && !options.thumbnail) {
      entry.yawVelocity *= Math.pow(.94, step); entry.pitchVelocity *= Math.pow(.94, step);
      entry.yaw += (entry.yawVelocity + .0009) * step; entry.pitch += entry.pitchVelocity * step;
    }
    if (options.kind === 'chars') { entry.pitch = 0; entry.pitchVelocity = 0; }
    object.visible = true; disc.visible = chart.visible = options.kind === 'chars';
    object.rotation.set(entry.pitch, entry.yaw, 0, 'XYZ');
    if (options.kind === 'chars') {
      object.position.y = 0; kit.idle(object, reduced.matches || options.thumbnail ? 0 : elapsed, 0, true);
      const scale = ['tallyman', 'fence', 'dealer'].includes(options.modelId) ? 1.06 : 1;
      if (options.thumbnail) { camera.fov = 24; camera.position.set(.15, 1.72, 1.9); camera.lookAt(0, 1.66, 0); }
      else { camera.fov = 34; camera.position.set(0, 1.15 * scale, 6 * scale); camera.lookAt(0, .98 * scale, 0); }
    } else { object.position.y = 1 + (reduced.matches || options.thumbnail ? 0 : Math.sin(elapsed * 1.1) * .02); camera.fov = 34; camera.position.set(0, options.thumbnail ? 1 : 1.2, options.thumbnail ? 1.7 : 3.3); camera.lookAt(0, options.thumbnail ? 1 : 1.2, 0); }
    const rect = canvas.getBoundingClientRect();
    const width = options.thumbnail ? 44 : Math.max(120, Math.round(rect.width / 2));
    const height = options.thumbnail ? 44 : Math.max(160, Math.round(rect.height / 2));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    still.resize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    still.render(scene, camera, { t: reduced.matches || options.thumbnail ? 0 : elapsed });
    const context = canvas.getContext('2d'); context?.clearRect(0, 0, width, height); context?.drawImage(still.r.domElement, 0, 0, width, height);
    object.visible = false; entry.dirty = false;
    canvas.dataset.yaw = entry.yaw.toFixed(4); canvas.dataset.pitch = entry.pitch.toFixed(4); canvas.dataset.motion = reduced.matches ? 'reduced' : 'idle';
  }
  function tick(now: number) {
    animation = 0; if (document.hidden) return;
    const delta = previous ? Math.min((now - previous) / 1000, .1) : 0; previous = now; if (!reduced.matches) elapsed += delta;
    for (const entry of entries) draw(entry, delta * 60);
    if (!reduced.matches && [...entries].some(entry => !entry.options.thumbnail)) animation = requestAnimationFrame(tick);
  }
  function resume() { cancelAnimationFrame(animation); animation = 0; previous = 0; for (const entry of entries) entry.dirty = true; tick(performance.now()); }
  reduced.addEventListener('change', resume); document.addEventListener('visibilitychange', resume);
  function dispose() {
    cancelAnimationFrame(animation); reduced.removeEventListener('change', resume); document.removeEventListener('visibilitychange', resume);
    const materials = new Set<Three.Material>(Object.values(kit.m)), geometries = new Set<Three.BufferGeometry>(), textures = new Set<Three.Texture>();
    scene.traverse(child => { if (child instanceof Three.Mesh) { geometries.add(child.geometry); for (const material of Array.isArray(child.material) ? child.material : [child.material]) materials.add(material); } });
    for (const material of materials) { for (const value of Object.values(material)) if (value instanceof Three.Texture) textures.add(value); material.dispose(); }
    for (const geometry of geometries) geometry.dispose(); for (const texture of textures) texture.dispose();
    kit.releaseWildcardCache(); spot.shadow.dispose(); still.dispose(); viewerStage = undefined;
  }
  return { attach(canvas: HTMLCanvasElement, options: HandbookModelOptions) {
    let object: Three.Object3D;
    try { object = objectFor(options); } catch (error) { if (!entries.size) dispose(); throw error; }
    const entry: ViewerEntry = { canvas, options, object, yaw: .3, pitch: 0, yawVelocity: 0, pitchVelocity: 0, dirty: true }; entries.add(entry);
    const down = (event: PointerEvent) => { if (options.thumbnail || event.button !== 0) return; canvas.focus(); entry.drag = { x: event.clientX, y: event.clientY, pointerId: event.pointerId }; entry.yawVelocity = entry.pitchVelocity = 0; canvas.setPointerCapture(event.pointerId); };
    const move = (event: PointerEvent) => { if (!entry.drag || entry.drag.pointerId !== event.pointerId) return; const dx = event.clientX - entry.drag.x, dy = event.clientY - entry.drag.y; entry.drag.x = event.clientX; entry.drag.y = event.clientY; entry.yaw += dx * .012; entry.yawVelocity = Math.max(-.15, Math.min(.15, dx * .012)); if (options.kind !== 'chars') { entry.pitch += dy * .012; entry.pitchVelocity = Math.max(-.15, Math.min(.15, dy * .012)); } entry.dirty = true; draw(entry, 0); };
    const up = (event: PointerEvent) => { if (entry.drag?.pointerId !== event.pointerId) return; entry.drag = undefined; if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); };
    const key = (event: KeyboardEvent) => { if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return; event.preventDefault(); if (event.key === 'Home') { entry.yaw = .3; entry.pitch = 0; } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') entry.yaw += event.key === 'ArrowLeft' ? -.12 : .12; else if (options.kind !== 'chars') entry.pitch += event.key === 'ArrowUp' ? -.12 : .12; entry.yawVelocity = entry.pitchVelocity = 0; entry.dirty = true; draw(entry, 0); };
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up); canvas.addEventListener('lostpointercapture', up); canvas.addEventListener('keydown', key);
    const observer = new ResizeObserver(() => { entry.dirty = true; draw(entry, 0); }); observer.observe(canvas); resume();
    return () => { observer.disconnect(); canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up); canvas.removeEventListener('lostpointercapture', up); canvas.removeEventListener('keydown', key); entries.delete(entry); if (!entries.size) dispose(); };
  } };
}

export function attachHandbookModel(canvas: HTMLCanvasElement, options: HandbookModelOptions): () => void {
  viewerStage ??= createViewerStage();
  return viewerStage.attach(canvas, options);
}

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
