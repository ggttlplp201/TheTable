import { Group, TorusGeometry, Vector3, WebGLRenderer, type Object3D } from 'three';
import {
  ARRIVAL_DURATION, ITEM_MODEL_IDS, ITEM_PRESENTATION, PRESENTATION_CLIPS, TABLE_TOP_Y,
  TableArrival, VisualKit, createCamera, createPostPipeline, createTableScene,
  type ArrivalBeat, type ArrivalPhase, type ItemModelId,
} from '@the-table/visual';
import type { PublicRoomView } from '@the-table/game';
import { PublicPresentationObserver, arrivalEligible, hasSeenArrival, hasStartedArrival, publicImpactTilt, publicSeats, rememberArrival, rememberArrivalStart, type TableCue } from './table-presentation';

export interface TablePresentationOptions {
  viewerId?: string;
  onIntroChange: (phase: ArrivalPhase | null, canSkip: boolean) => void;
  onBeat?: (beat: ArrivalBeat) => void;
  onError?: () => void;
}
export interface TablePresentation { update(room: PublicRoomView): void; skipIntro(): void; dispose(): void }
interface Effect { start: number; duration: number; apply(time: number): void; finish(): void }
const ease = (n: number) => { const t = Math.max(0, Math.min(1, n)); return t * t * (3 - 2 * t); };
const modelId = (id: string): ItemModelId | undefined => {
  const camel = id.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
  return ITEM_MODEL_IDS.find(candidate => candidate === camel);
};

/** No command/transport access: snapshots never wait behind cosmetic motion. */
export function createTablePresentation(target: HTMLDivElement, initialRoom: PublicRoomView, options: TablePresentationOptions): TablePresentation {
  const cleanups: Array<() => void> = [];
  let disposed = false;
  let frame = 0;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    for (const cleanup of cleanups.reverse()) cleanup();
  };
  const fail = () => { dispose(); options.onError?.(); };
  try {
    const width = Math.max(1, target.clientWidth), height = Math.max(1, target.clientHeight);
    const renderer = new WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    cleanups.push(() => { renderer.dispose(); renderer.domElement.remove(); });
    const contextLost = (event: Event) => { event.preventDefault(); fail(); };
    renderer.domElement.addEventListener('webglcontextlost', contextLost);
    cleanups.push(() => renderer.domElement.removeEventListener('webglcontextlost', contextLost));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    renderer.shadowMap.enabled = true;
    renderer.setSize(width, height, false);
    target.append(renderer.domElement);
    const kit = new VisualKit({ seed: initialRoom.code });
    cleanups.push(() => kit.dispose());
    const seats = publicSeats(initialRoom);
    const bundle = createTableScene(kit, { aspect: width / height, seats, includeChests: false });
    const camera = createCamera('spectator', width / height);
    const post = createPostPipeline(renderer, Math.ceil(width / 2), Math.ceil(height / 2), { grain: 0.09, saturation: 0.7 });
    cleanups.push(() => post.dispose());
    cleanups.push(() => bundle.scene.traverse(object => { if ('shadow' in object) (object.shadow as { dispose?: () => void }).dispose?.(); }));
    const characters = new Map(seats.map((seat, index) => [seat.id, bundle.characters[index]!]));
    const chests = new Map((['STANDARD', 'BLACK'] as const).map(kind => {
      const chest = kit.createChest(kind === 'STANDARD' ? 'standard' : 'black');
      chest.position.set(kind === 'STANDARD' ? -1.15 : 1.2, TABLE_TOP_Y, -0.6);
      chest.rotation.y = kind === 'STANDARD' ? 0.3 : -0.3;
      chest.scale.setScalar(1.1); chest.visible = false; bundle.scene.add(chest);
      return [kind, chest] as const;
    }));
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let room = initialRoom;
    const observer = new PublicPresentationObserver();
    const effects = new Map<string, Effect>();
    const itemModels = new Map<string, { anchor: Group; pivot: Group; model: Group }>();
    const departing = new Map<string, Group>();
    const markers = new Map<string, Object3D>();
    let shopKit: VisualKit | undefined;
    let shop = new Group(), shopSignature = '';
    let arrival: TableArrival | undefined;
    let arrivalStart = 0;
    let introPhase: ArrivalPhase | null = null;
    const storage = () => { try { return window.localStorage; } catch { return undefined; } };
    const sessionStorage = () => { try { return window.sessionStorage; } catch { return undefined; } };
    const canSkipIntro = hasSeenArrival(storage());
    const setPhase = (value: ArrivalPhase | null) => { if (value !== introPhase) { introPhase = value; options.onIntroChange(value, canSkipIntro); } };
    const clearEffects = () => { for (const effect of effects.values()) effect.finish(); effects.clear(); };
    const syncPlayers = () => {
      for (const player of room.players) {
        const upper = characters.get(player.id)?.getObjectByName('upper'); if (!upper) continue;
        upper.visible = player.life !== 'DEAD' && player.life !== 'EXITED' && !(arrival && !arrival.finished && player.id === options.viewerId);
        upper.rotation.z = player.life === 'DOWNED' ? 0.3 : 0;
        upper.rotation.x = player.life === 'DOWNED' ? 0.25 : 0;
      }
    };
    const finishArrival = (completed = false) => {
      if (!arrival) return;
      arrival.finish();
      if (completed) rememberArrival(storage());
      setPhase(null); syncPlayers();
    };
    const draw = (now: number) => {
      if (disposed) return;
      // The media query value can change before its change callback is delivered.
      if (motion.matches) { finishArrival(); clearEffects(); }
      if (arrival && !arrival.finished) {
        const phase = arrival.update((now - arrivalStart) / 1000);
        if (arrival.finished) finishArrival(true); else setPhase(phase);
      }
      syncPlayers();
      for (const [key, effect] of effects) {
        const seconds = (now - effect.start) / 1000;
        if (seconds >= effect.duration) { effect.finish(); effects.delete(key); } else effect.apply(seconds);
      }
      target.dataset.presentationEffects = String(effects.size);
      target.dataset.presentationIntro = introPhase ?? 'none';
      post.render(bundle.scene, camera, motion.matches ? 0 : now / 1000);
    };
    const render = (now: number) => { try { draw(now); } catch { fail(); } };
    const tick = (now: number) => {
      render(now);
      if (!disposed && !motion.matches && document.visibilityState !== 'hidden') frame = requestAnimationFrame(tick);
    };
    const redraw = () => { cancelAnimationFrame(frame); render(performance.now()); if (!disposed && !motion.matches && document.visibilityState !== 'hidden') frame = requestAnimationFrame(tick); };
    const addEffect = (key: string, duration: number, apply: Effect['apply'], finish: Effect['finish']) => {
      effects.get(key)?.finish(); effects.delete(key);
      if (effects.size >= 6) { const oldest = effects.keys().next().value!; effects.get(oldest)?.finish(); effects.delete(oldest); }
      effects.set(key, { start: performance.now(), duration, apply, finish }); apply(0);
    };
    const cue = (event: TableCue) => {
      if (event.type === 'item') {
        const seat = seats.find(value => value.id === event.playerId); if (!seat) return;
        let cached = itemModels.get(event.itemId);
        if (!cached) {
          const anchor = new Group(), pivot = new Group(), model = kit.createItem(event.itemId);
          anchor.add(pivot); pivot.add(model); bundle.scene.add(anchor);
          cached = { anchor, pivot, model }; itemModels.set(event.itemId, cached);
        }
        const { anchor, pivot, model } = cached;
        anchor.position.set(seat.position[0] * 0.53, TABLE_TOP_Y + 0.02, seat.position[2] * 0.53);
        anchor.rotation.y = seat.rotationY; anchor.scale.setScalar(1.6);
        const clip = PRESENTATION_CLIPS[event.itemId];
        addEffect(`item:${event.itemId}`, clip.duration, time => { anchor.visible = true; clip.apply(pivot, model, time); }, () => { anchor.visible = false; });
      } else if (event.type === 'impact') {
        const upper = characters.get(event.playerId)?.getObjectByName('upper'); if (!upper) return;
        addEffect(`impact:${event.playerId}`, 0.6, t => { upper.rotation.x = publicImpactTilt(room.players.find(player => player.id === event.playerId)!.life, t); }, syncPlayers);
      } else if (event.type === 'death' || event.type === 'exit') {
        const original = characters.get(event.playerId), seat = seats.find(value => value.id === event.playerId);
        if (!original || !seat) return;
        let ghost = departing.get(event.playerId);
        if (!ghost) {
          ghost = original.clone(true);
          const chair = ghost.getObjectByName('chair'); if (chair) chair.visible = false;
          // Clones share kit resources. Never dispose one separately.
          bundle.scene.add(ghost); departing.set(event.playerId, ghost);
        }
        const model = ghost, upper = model.getObjectByName('upper')!;
        upper.visible = true;
        const exit = event.type === 'exit', start = new Vector3(...seat.position);
        const aisle = start.clone().addScaledVector(start.clone().normalize(), 1.2);
        const side = new Vector3(seat.position[0] < 0 ? -3.9 : 3.9, 0, -3.5), door = new Vector3(2.4, 0, -5.5);
        addEffect(`depart:${event.playerId}`, exit ? 2.8 : 1.2, t => {
          model.visible = true; model.position.copy(start); upper.rotation.set(0, 0, 0);
          if (exit) {
            if (t < 0.6) model.position.lerp(aisle, ease(t / 0.6));
            else if (t < 1.65) model.position.copy(aisle).lerp(side, ease((t - 0.6) / 1.05));
            else model.position.copy(side).lerp(door, ease((t - 1.65) / 1.15));
            model.position.y = Math.sin(t * 15) * 0.025; upper.position.y = 0.76 + 0.2 * ease(t / 0.35);
          } else { upper.rotation.x = ease(t / 0.8) * 0.6; upper.rotation.z = ease(t / 1.1) * 0.2; }
        }, () => { model.visible = false; });
      } else if (event.type === 'chest') {
        const model = chests.get(event.kind)!, lid = model.getObjectByName('lid')!;
        addEffect(`chest:${event.kind}`, 1.2, t => { lid.rotation.x = -1.9 * ease(t / 0.9); }, () => { lid.rotation.x = room.chests?.find(value => value.kind === event.kind)?.availability === 'OPENED' ? -1.9 : 0; });
      } else if (event.type === 'shop') {
        addEffect('shop', 0.65, t => { shop.position.y = -0.12 * (1 - ease(t / 0.65)); }, () => { shop.position.y = 0; });
      } else {
        const seat = seats.find(value => value.id === event.playerId); if (!seat) return;
        let ring = markers.get(event.playerId);
        if (!ring) {
          ring = kit.mesh(new TorusGeometry(0.22, 0.009, 4, 24), kit.materials.brass);
          ring.rotation.x = Math.PI / 2; bundle.scene.add(ring); markers.set(event.playerId, ring);
        }
        const marker = ring;
        marker.position.set(seat.position[0] * 0.58, TABLE_TOP_Y + 0.015, seat.position[2] * 0.58);
        addEffect(`exchange:${event.playerId}`, 0.75, t => { marker.visible = true; marker.scale.setScalar(1 + Math.sin(t / 0.75 * Math.PI) * 0.2); }, () => { marker.visible = false; });
      }
    };
    const syncShop = () => {
      const offers = room.round?.phase === 'INTERMISSION' ? room.shop?.publicOffers ?? [] : [];
      const signature = JSON.stringify(offers.map(offer => [offer.id, offer.itemId, offer.purchasedBy]));
      if (signature === shopSignature) return;
      shopSignature = signature; effects.get('shop')?.finish(); effects.delete('shop');
      shop.removeFromParent(); shopKit?.dispose(); shopKit = undefined; shop = new Group();
      if (!offers.length) return;
      shopKit = new VisualKit({ seed: room.code });
      for (const [index, offer] of offers.entries()) {
        const id = modelId(offer.itemId); if (!id || offer.purchasedBy) continue;
        const model = shopKit.createItem(id), pose = ITEM_PRESENTATION[id as keyof typeof ITEM_PRESENTATION];
        if (pose) model.rotation.set(pose.rotation[0], pose.rotation[1], pose.rotation[2]);
        model.position.set((index - (offers.length - 1) / 2) * 0.48, TABLE_TOP_Y + (pose?.y ?? 0) + 0.02, 0.42);
        model.scale.setScalar(0.85); shop.add(model);
      }
      bundle.scene.add(shop);
    };
    const update = (next: PublicRoomView) => {
      if (disposed || next.revision < room.revision) return;
      room = next;
      for (const [kind, model] of chests) {
        const state = room.chests?.find(chest => chest.kind === kind)?.availability;
        model.visible = state === 'AVAILABLE' || state === 'OPENED';
        if (!effects.has(`chest:${kind}`)) model.getObjectByName('lid')!.rotation.x = state === 'OPENED' ? -1.9 : 0;
      }
      syncShop();
      const cues = observer.observe(room);
      if (!motion.matches && document.visibilityState !== 'hidden') for (const value of cues) cue(value);
      if (arrival && !arrival.finished && (room.status !== 'PLAYING' || room.players.find(player => player.id === options.viewerId)?.life !== 'ACTIVE')) finishArrival();
      render(performance.now());
    };
    const changeMotion = () => { if (motion.matches) { finishArrival(); clearEffects(); } redraw(); };
    const visibility = () => { if (document.visibilityState === 'hidden') { finishArrival(); clearEffects(); cancelAnimationFrame(frame); } else redraw(); };
    motion.addEventListener('change', changeMotion); document.addEventListener('visibilitychange', visibility);
    cleanups.push(() => { motion.removeEventListener('change', changeMotion); document.removeEventListener('visibilitychange', visibility); });
    const resize = new ResizeObserver(entries => {
      if (disposed) return;
      const box = entries[0]?.contentRect; if (!box || box.width < 1 || box.height < 1) return;
      try {
        renderer.setSize(box.width, box.height, false); camera.aspect = box.width / box.height; camera.updateProjectionMatrix();
        post.resize(Math.ceil(box.width / 2), Math.ceil(box.height / 2)); render(performance.now());
      } catch { fail(); }
    });
    resize.observe(target); cleanups.push(() => resize.disconnect());
    cleanups.push(() => { arrival?.dispose(); clearEffects(); shop.removeFromParent(); shopKit?.dispose(); });
    update(initialRoom);
    const seat = seats.find(value => value.id === options.viewerId);
    const alreadyStarted = hasStartedArrival(room, sessionStorage());
    // Even reduced-motion/late-entry observers should not start an intro after a remount.
    if (seat) rememberArrivalStart(room, sessionStorage());
    if (!disposed && seat && arrivalEligible(room, options.viewerId, motion.matches, alreadyStarted)) {
      arrivalStart = performance.now(); arrival = new TableArrival(camera, seat, characters.get(seat.id), options.onBeat);
      setPhase('approach');
    }
    target.dataset.arrivalDuration = String(ARRIVAL_DURATION);
    redraw();
    return { update(next) { try { update(next); } catch { fail(); } }, skipIntro() { if (canSkipIntro) { finishArrival(); redraw(); } }, dispose };
  } catch (error) { dispose(); throw error; }
}
