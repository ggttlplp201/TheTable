import * as T from 'three';
import { install, makePost } from './reference-game-kit.js';

const COLORS = { enforcer: 0xe0a040, medic: 0xb84030, smuggler: 0x7aa08a, locksmith: 0x6a8ab8, broker: 0x6a8ab8, scavenger: 0xe0a040 };
let shared;

/** One renderer serves all portrait canvases, using the reference's actual rig and idle. */
function createPortraitStage() {
  const k = install({}, T);
  const r = new T.WebGLRenderer({ antialias: false });
  const w = 120, h = 170;
  r.setPixelRatio(1); r.setSize(w, h, false);
  r.shadowMap.enabled = true; r.shadowMap.type = T.BasicShadowMap;
  const rt = new T.WebGLRenderTarget(w, h, { minFilter: T.NearestFilter, magFilter: T.NearestFilter });
  const post = makePost(T, rt.texture, {}); post.uniforms.uRes.value.set(w, h);
  const ps = new T.Scene(), quad = new T.Mesh(new T.PlaneGeometry(2, 2), post);
  quad.frustumCulled = false; ps.add(quad);
  const pc = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const scene = new T.Scene(); scene.background = new T.Color(0x030303);
  const wall = new T.Mesh(new T.PlaneGeometry(7, 5), new T.MeshLambertMaterial({ color: 0x2a2420 }));
  wall.position.set(0, 2, -1.2); wall.receiveShadow = true; scene.add(wall);
  const light = new T.SpotLight(0xffd9a0, 18, 0, .5, .6, 2);
  light.position.set(-.4, 3.8, 1.6); light.castShadow = true;
  light.target.position.set(0, 1.4, 0); scene.add(light.target, light);
  const rim = new T.PointLight(0xffffff, 3.5, 3.5, 2);
  rim.position.set(.7, 2.3, -.7); scene.add(rim, new T.AmbientLight(0x2a221c, .75));
  const camera = new T.PerspectiveCamera(30, w / h, .05, 10);
  camera.position.set(0, 1.8, 2.2); camera.lookAt(0, 1.68, 0);
  const subscribers = new Map(), characters = new Map();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0, last = -Infinity, elapsed = 0;
  function draw(canvas, entry, time) {
    const { character, color, context } = entry;
    k.idle(character, time, 0, true);
    scene.add(character); rim.color.setHex(color);
    // Keep reference grain stationary so portrait changes come from the rig.
    r.setRenderTarget(rt); r.render(scene, camera);
    r.setRenderTarget(null); r.render(ps, pc);
    context.drawImage(r.domElement, 0, 0);
    scene.remove(character);
    canvas.dataset.idleTime = time.toFixed(3);
    canvas.dataset.motion = reduced.matches ? 'reduced' : 'idle';
  }
  function tick(now) {
    frame = 0;
    if (document.hidden || reduced.matches || !subscribers.size) return;
    if (now - last >= 1000 / 24) {
      if (Number.isFinite(last)) elapsed += Math.min((now - last) / 1000, .1);
      last = now;
      for (const [canvas, entry] of subscribers) draw(canvas, entry, elapsed);
    }
    frame = requestAnimationFrame(tick);
  }
  function resume() {
    cancelAnimationFrame(frame); frame = 0; last = -Infinity;
    for (const [canvas, entry] of subscribers) draw(canvas, entry, reduced.matches ? 0 : elapsed);
    if (!reduced.matches && !document.hidden) frame = requestAnimationFrame(tick);
  }
  reduced.addEventListener('change', resume);
  document.addEventListener('visibilitychange', resume);
  function dispose() {
    cancelAnimationFrame(frame);
    reduced.removeEventListener('change', resume);
    document.removeEventListener('visibilitychange', resume);
    const geometries = new Set(), materials = new Set(Object.values(k.m)), textures = new Set();
    for (const root of [scene, ps, ...characters.values()]) root.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
    });
    for (const material of materials) {
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      material.dispose();
    }
    for (const texture of textures) texture.dispose();
    for (const geometry of geometries) geometry.dispose();
    light.shadow.dispose(); rt.dispose(); r.dispose(); r.forceContextLoss();
  }
  return {
    attach(canvas, roleId) {
      const color = COLORS[roleId];
      if (color === undefined) throw new Error('Unknown portrait role');
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Portrait canvas unavailable');
      let character = characters.get(roleId);
      if (!character) {
        character = k.character(roleId, color, '', 'standing');
        character.rotation.y = -.25; characters.set(roleId, character);
      }
      const entry = { character, color, context };
      subscribers.set(canvas, entry);
      draw(canvas, entry, reduced.matches ? 0 : elapsed);
      if (!frame && !reduced.matches && !document.hidden) frame = requestAnimationFrame(tick);
      return () => {
        subscribers.delete(canvas);
        if (!subscribers.size) { dispose(); shared = undefined; }
      };
    },
  };
}

export function animateReferencePortrait(canvas, roleId) {
  shared ??= createPortraitStage();
  return shared.attach(canvas, roleId);
}
