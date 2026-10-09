import { BasicShadowMap, Group, MeshBasicMaterial, PlaneGeometry, Raycaster, Vector2, WebGLRenderer } from 'three';
import { createBlackMarketScene, createPostPipeline, createPublicShopScene, ITEM_PRESENTATION, projectAnchors, VisualKit, type ItemModelId, type OfferVisual, type ProjectedAnchor } from '@the-table/visual';
import type { MarketView } from './market-presentation';

export interface MarketStock extends OfferVisual { price: number }
export function createMarketScene(target: HTMLElement, options: {
  view: MarketView; stock: MarketStock[]; selectedItem?: ItemModelId | undefined;
  onAnchors: (anchors: Record<string, ProjectedAnchor>) => void;
  onOffer: (offerId: string) => void;
}) {
  const renderer = new WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); renderer.shadowMap.enabled = true; renderer.shadowMap.type = BasicShadowMap;
  const kit = new VisualKit({ seed: 'tallyman' });
  const bundle = options.view === 'BLACK' ? createBlackMarketScene(kit, { offers: options.stock }) : createPublicShopScene(kit, { offers: options.stock });
  const { camera, scene } = bundle;
  for (const keeper of bundle.characters) {
    const rig = keeper.userData.rig as { arms: Group[] };
    for (const arm of rig.arms) {
      arm.userData.restX = options.view === 'BLACK' ? -.8 : -.6;
      arm.getObjectByName('elbow')!.userData.restX = options.view === 'BLACK' ? -.5 : -.55;
    }
  }
  // Paper price tags are actual counter props, with current server prices.
  for (const [index, offer] of options.stock.entries()) {
    const black = options.view === 'BLACK', x = black ? -.46 + index * .307 : -1.05 + index * .55;
    const texture = kit.texture(`price:${offer.id}`, 48, 18, context => {
      context.fillStyle = offer.sold ? '#3a0e0a' : black && index === 3 ? '#8fb0a0' : '#bfb294'; context.fillRect(0, 0, 48, 18);
      context.fillStyle = offer.sold ? '#e05040' : '#1a1410'; context.font = 'bold 13px monospace'; context.fillText(offer.sold ? 'SOLD' : `${offer.price}¢`, 4, 14);
    });
    const tag = kit.mesh(new PlaneGeometry(black ? .12 : .2, black ? .05 : .09), new MeshBasicMaterial({ map: texture }), x, black ? .827 : 1, black ? .17 : .33);
    tag.rotation.x = black ? -Math.PI / 2 : -.5; scene.add(tag);
  }
  if (options.view !== 'BLACK' && options.selectedItem) {
    const item = kit.createItem(options.selectedItem), pivot = new Group(), pose = ITEM_PRESENTATION[options.selectedItem as keyof typeof ITEM_PRESENTATION];
    if (pose) { item.rotation.set(pose.rotation[0], pose.rotation[1], pose.rotation[2]); item.position.y = pose.y; }
    pivot.add(item); pivot.scale.setScalar(1.8); pivot.position.set(1.12, .99, .1); pivot.rotation.y = .6; scene.add(pivot);
  }
  const post = createPostPipeline(renderer, 448, 252);
  target.append(renderer.domElement);
  let disposed = false, frame = 0;
  const resize = () => {
    const width = Math.max(1, target.clientWidth), height = Math.max(1, target.clientHeight);
    renderer.setSize(width, height, false); post.resize(448, Math.max(1, Math.round(448 * height / width))); camera.aspect = width / height;
    if (options.view === 'SELL') { camera.fov = 45; camera.position.set(.85, 1.5, 1.45); camera.lookAt(1.1, .95, .05); }
    camera.updateProjectionMatrix(); options.onAnchors(projectAnchors(camera, bundle.anchors));
  };
  const observer = new ResizeObserver(resize); observer.observe(target); resize();
  const raycaster = new Raycaster(), pointer = new Vector2();
  const click = (event: MouseEvent) => {
    const bounds = target.getBoundingClientRect(); pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, 1 - (event.clientY - bounds.top) / bounds.height * 2);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects([...bundle.interactive], true).find(hit => hit.object.visible);
    let object = hit?.object;
    while (object && !object.userData.offerId) object = object.parent ?? undefined;
    if (object?.visible && object.userData.offerId) options.onOffer(String(object.userData.offerId));
  };
  renderer.domElement.addEventListener('click', click);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const draw = (time: number) => {
    if (disposed) return;
    const seconds = reduced ? 0 : time / 1000;
    for (const character of bundle.characters) {
      kit.animateCharacter(character, seconds);
      const rig = character.userData.rig as { upper: Group; head: Group; arms: Group[] };
      if (options.view === 'BLACK') {
        rig.head.rotation.y = Math.sin(seconds * .3) * .2; rig.head.rotation.z = Math.sin(seconds * .5) * .06;
        rig.upper.rotation.x = .28 + Math.sin(seconds * .8) * .02;
      } else {
        rig.head.rotation.x = .08; rig.head.rotation.y = Math.sin(seconds * .4) * .3;
        rig.arms[1]!.getObjectByName('hand')!.rotation.x = Math.max(0, Math.sin(seconds * 9)) * .4 * (Math.sin(seconds * .5) > .2 ? 1 : 0);
      }
    }
    post.render(scene, camera, reduced ? 0 : time / 1000); frame = requestAnimationFrame(draw);
  };
  frame = requestAnimationFrame(draw);
  return { dispose() {
    disposed = true; cancelAnimationFrame(frame); observer.disconnect(); renderer.domElement.removeEventListener('click', click);
    scene.traverse(object => { if ('isLight' in object && 'dispose' in object && typeof object.dispose === 'function') object.dispose(); });
    post.dispose(); kit.dispose(); renderer.dispose(); renderer.domElement.remove();
  } };
}
