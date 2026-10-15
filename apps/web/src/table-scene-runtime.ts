import { coinIconCanvas } from './reference-game-kit.js';
import { COMPACT_ACTION_SECONDS } from './downed-presentation';
import { BasicShadowMap, BoxGeometry, BoxHelper, CylinderGeometry, Group, MeshBasicMaterial, PlaneGeometry, PointLight, Raycaster, TorusGeometry, Vector2, Vector3, WebGLRenderer, type CanvasTexture, type Object3D, type Quaternion } from 'three';
import {
  ARRIVAL_DURATION, CAMERA_VIEWS, COLOR_GRADES, ITEM_MODEL_IDS, ITEM_PRESENTATION, TABLE_TOP_Y,
  TableArrival, VisualKit, createCamera, createPostPipeline, createTableScene,
  type ArrivalBeat, type ArrivalPhase, type ItemModelId,
} from '@the-table/visual';
import type { PendingWildcard, PublicRoomView } from '@the-table/game';
import type { SceneFocus, SceneIntent } from './GameTableScene';
import { PublicPresentationObserver, arrivalEligible, hasSeenArrival, hasStartedArrival, publicImpactTilt, publicSeats, publicThreatPose, rememberArrival, rememberArrivalStart, type TableCue } from './table-presentation';
import { ACTION_DURATION, actionFlash, actionSeatPoint, createChestToolPresentation, createPublicActionPresentation, spyglassZoom } from './table-action-presentation';
import { orderRevealFrame } from './order-reveal';
import { createOrderProps } from './order-props';
import { downedFallProgress } from './downed-presentation';
import { createSeatRestraint } from './table-restraints';
import { itemName } from './gameplay';
import { canInteractWithWildcardDeck, createWildcardDeckPresentation, publicWildcardDeckSnapshot, wildcardDeckTooltip } from './wildcard-scene';
import { createExitPath, EXIT_DURATION, EXIT_STRIDE, ExitBeatTimeline, sampleExit, type ExitBeat, type ExitOrigin } from './table-exit-presentation';

export interface TablePresentationOptions {
  viewerId?: string;
  onIntroChange: (phase: ArrivalPhase | null, canSkip: boolean) => void;
  onBeat?: (beat: ArrivalBeat) => void;
  /** Public movement sounds only; emitted for each fresh visible exit, including spectators. */
  onExitBeat?: (beat: ExitBeat) => void;
  onError?: () => void;
  onCameraTravel?: ((degrees: number) => void) | undefined;
  onIntent?: ((intent: SceneIntent) => void) | undefined;
  interactionsEnabled?: boolean;
  exitReady?: boolean;
  showOwnerMarket?: boolean;
  wildcardDrawEnabled?: boolean;
  ownerWildcard?: PendingWildcard | undefined;
  tutorialFocus?: string | undefined;
  focus?: SceneFocus;
  selectedItemId?: string | undefined;
  aimTargets?: readonly string[];
  aimPockets?: boolean;
  spyglassTargetId?: string | undefined;
  spyglassActive?: boolean;
}
export interface TablePresentation { setTutorialFocus(value: string | undefined): void; update(room: PublicRoomView): void; setInteractionsEnabled(value: boolean): void; setExitReady(value: boolean): void; setWildcardDrawEnabled(value: boolean): void; setOwnerWildcard(value: PendingWildcard | undefined): void; setFocus(value: SceneFocus): void; setItemSelection(value: string | undefined, targets: readonly string[], pockets?: boolean): void; setSpyglass(targetId: string | undefined, active: boolean): void; skipIntro(): void; dispose(): void }
interface Effect { start: number; duration: number; sourceInstanceId?: string; apply(time: number): void; finish(): void }
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
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = BasicShadowMap;
    renderer.setSize(width, height, false);
    target.append(renderer.domElement);
    const matchLayout = target.closest<HTMLElement>('.match-layout');
    target.dataset.presentationRoom = initialRoom.id;
    const kit = new VisualKit({ seed: initialRoom.code });
    cleanups.push(() => kit.dispose());
    const seats = publicSeats(initialRoom, options.viewerId);
    const bundle = createTableScene(kit, { aspect: width / height, seats, includeChests: false });
    const orderProps = createOrderProps(bundle.scene);
    cleanups.push(() => orderProps.dispose());
    const interactiveTargets: Object3D[] = [...bundle.interactive];
    const exitDoor = bundle.scene.getObjectByName('exitDoor');
    if (exitDoor) exitDoor.userData.semantic = { kind: 'EXIT' };
    if (options.showOwnerMarket && options.viewerId !== undefined) {
      for (const [name, kind] of [['publicShopCabinet', 'MARKET_PUBLIC'], ['sellBackTray', 'SELL']] as const) {
        const model = bundle.scene.getObjectByName(name);
        if (model) { model.userData.semantic = { kind }; interactiveTargets.push(model); }
      }
      // Source leather/velvet folio. Offer slips deliberately remain blank here.
      const folio = kit.group(kit.mesh(new BoxGeometry(.58, .012, .4), kit.materials.leather, 0, .006), kit.mesh(new BoxGeometry(.55, .004, .37), kit.materials.velvet, 0, .014), kit.mesh(new BoxGeometry(.014, .02, .4), kit.materials.spine, 0, .012));
      folio.name = 'ownerMarketFolio'; folio.position.set(-1.2, TABLE_TOP_Y, .66); folio.rotation.y = .22;
      folio.userData.semantic = { kind: 'MARKET_BLACK' }; bundle.scene.add(folio); interactiveTargets.push(folio);
    }
    const camera = createCamera(options.viewerId === undefined ? 'spectator' : 'seat', width / height);
    const lamp = bundle.scene.getObjectByName('tableLamp');
    const spectator = options.viewerId === undefined;
    const post = createPostPipeline(renderer, Math.max(1, Math.floor(width / 3)), Math.max(1, Math.floor(height / 3)),
      spectator ? { grade: COLOR_GRADES.spectator, saturation: .3 } : {});
    post.setGrain(document.documentElement.dataset.tableGrain === 'low' ? .06 : .16);
    cleanups.push(() => post.dispose());
    cleanups.push(() => bundle.scene.traverse(object => { if ('shadow' in object) (object.shadow as { dispose?: () => void }).dispose?.(); }));
    const characters = new Map(seats.map((seat, index) => {
      const character = bundle.characters[index]!;
      character.userData.semantic = { kind: 'PLAYER', playerId: seat.id };
      return [seat.id, character] as const;
    }));
    const ownSeat = seats.find(seat => seat.id === options.viewerId);
    const ownCharacter = ownSeat ? characters.get(ownSeat.id) : undefined;
    // The source intro has its own spindle chair and seated legs. The seated
    // character's old back plank must not sit in front of the first-person lens.
    if (ownCharacter) ownCharacter.visible = false;
    const arrivalBody = ownSeat ? (() => {
      const root = new Group(), chair = kit.createPlayerChair(), legs = kit.createFirstPersonLegs(), hands = kit.createFirstPersonHands();
      const outward = new Vector3(ownSeat.position[0], 0, ownSeat.position[2]).normalize();
      root.rotation.y = Math.atan2(outward.x, outward.z);
      chair.position.z = 2.66; legs.position.z = 2.64; hands.visible = false;
      root.add(chair, legs, hands); bundle.scene.add(root);
      return { chair, legs, hands };
    })() : undefined;
    const restraints = new Map(seats.map(seat => {
      const restraint = createSeatRestraint(kit, characters.get(seat.id)!, seat.id, seat.id === options.viewerId);
      bundle.scene.add(restraint.root);
      cleanups.push(() => restraint.dispose());
      return [seat.id, restraint] as const;
    }));
    const platePoint = new Vector3();
    const plates = new Map(seats.filter(seat => seat.id !== options.viewerId).map(seat => {
      const plate = document.createElement('div'); plate.className = `scene-nameplate${seat.role === 'dealer' ? ' dealer-nameplate' : ''}`;
      const name = document.createElement('span'), role = document.createElement('small');
      name.textContent = seat.role === 'dealer' ? 'THE DEALER' : seat.label ?? '';
      if (seat.role !== 'dealer') { role.textContent = seat.role.toUpperCase(); plate.append(name, role); } else plate.append(name);
      target.append(plate);
      cleanups.push(() => plate.remove()); return [seat.id, plate] as const;
    }));
    let shortHeader: { left: number; right: number; bottom: number } | undefined;
    const measureShortHeader = () => {
      const header = target.closest('.match-viewport')?.querySelector('.match-hud-top');
      if (target.clientWidth < 801 || target.clientHeight > 640 || !header) { shortHeader = undefined; return; }
      const box = header.getBoundingClientRect(), frame = target.getBoundingClientRect();
      shortHeader = { left: box.left - frame.left, right: box.right - frame.left, bottom: box.bottom - frame.top };
    };
    const selectionLight = new PointLight(0xffe0b0, 0, 1.2, 2); bundle.scene.add(selectionLight);
    const doorLight = new PointLight(0xd8ccb4, 2.2, 5, 2); doorLight.position.set(2.4, 1.4, -5.3); bundle.scene.add(doorLight);
    const doorHinge = exitDoor?.getObjectByName('exitHinge');
    const doorGlow = exitDoor?.getObjectByName('exitGlow');
    let exitReady = options.exitReady ?? false;
    let tutorialFocus = options.tutorialFocus;
    let focus = options.focus ?? 'seat';
    const cameraAim = new Vector3(...CAMERA_VIEWS.seat.lookAt), focusPosition = new Vector3(), focusAim = new Vector3();
    let selectedItem = options.selectedItemId;
    let aimTargets = options.aimTargets ?? [];
    let aimPockets = options.aimPockets ?? false;
    let spyglassTargetId = options.spyglassTargetId, spyglassActive = options.spyglassActive ?? false, spyglassStart = performance.now();
    const scopeAim = new Vector3(), scopeTarget = new Vector3();
    const aimLight = new PointLight(0xe05030, 0, 1.4, 2); bundle.scene.add(aimLight);
    const hitLight = new PointLight(0xff3020, 0, 1.6, 2); bundle.scene.add(hitLight);
    const screenFlash = document.createElement('div'); screenFlash.className = 'scene-action-flash'; target.append(screenFlash); cleanups.push(() => screenFlash.remove());
    const exitFade = document.createElement('div');
    exitFade.style.cssText = 'position:absolute;inset:0;pointer-events:none;background:#000;opacity:0';
    target.append(exitFade); cleanups.push(() => exitFade.remove());
    let flashOpacity = 0;
    const tooltip = document.createElement('div'); tooltip.className = 'scene-tooltip'; target.append(tooltip); cleanups.push(() => tooltip.remove());
    const chestBanner = document.createElement('div'); chestBanner.className = 'scene-chest-banner'; chestBanner.hidden = true; target.append(chestBanner); cleanups.push(() => chestBanner.remove());
    const chests = new Map((['STANDARD', 'BLACK'] as const).map(kind => {
      const chest = kit.createChest(kind === 'STANDARD' ? 'standard' : 'black');
      chest.position.set(kind === 'STANDARD' ? -1.15 : 1.2, TABLE_TOP_Y, -0.6);
      chest.rotation.y = kind === 'STANDARD' ? 0.3 : -0.3;
      chest.scale.setScalar(1.1); chest.visible = false; chest.userData.semantic = { kind: 'CHEST', chestKind: kind };
      bundle.scene.add(chest); interactiveTargets.push(chest);
      return [kind, chest] as const;
    }));
    const wildcardDeck = createWildcardDeckPresentation(kit, {
      camera,
      ...(options.viewerId === undefined ? {} : { viewerId: options.viewerId }),
      characterFor: playerId => characters.get(playerId),
      ...(options.viewerId !== undefined && options.ownerWildcard ? { ownerWildcard: options.ownerWildcard } : {}),
    });
    bundle.scene.add(wildcardDeck.root); interactiveTargets.push(wildcardDeck.hitTarget);
    cleanups.push(() => wildcardDeck.dispose());
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let room = initialRoom;
    const observer = new PublicPresentationObserver();
    const effects = new Map<string, Effect>();
    const toolModels = new Map<string, ReturnType<typeof createChestToolPresentation>>();
    /** Keyhole in each chest's local space (kit.createChest geometry); the lid seam sits just above it. */
    const KEYHOLE = { STANDARD: new Vector3(0, .195, .177), BLACK: new Vector3(0, .2, .21) } as const;
    const actionModels = new Map<string, ReturnType<typeof createPublicActionPresentation>>();
    const inventoryModels = new Map<string, { anchor: Group; model: Group; ownerId: string; itemId: string }>();
    const pocketModels = new Map<string, Group>();
    const statusDisplays = new Map<string, { model: Group; texture: CanvasTexture; signature: string }>();
    const objectiveSeals = new Map<string, Group>();
    const coinIcon = coinIconCanvas(16);
    const coins = new Group(); coins.name = 'yourCoinStack'; bundle.scene.add(coins);
    for (let index = 0; index < 5; index++) { const coin = kit.createCoin(); coin.position.set(-1.15, .972 + index * .019, 1.15); coin.rotation.y = index; coins.add(coin); }
    const departing = new Map<string, Group>();
    const exitWalks = new Map<string, { start: number; path: ReturnType<typeof createExitPath>; origin: ExitOrigin; beats: ExitBeatTimeline }>();
    const clearOwnerExit = () => {
      matchLayout?.style.removeProperty('--scene-exit-hud-opacity');
      matchLayout?.style.removeProperty('--scene-exit-result-opacity');
      if (matchLayout) { delete matchLayout.dataset.exitPlaying; delete matchLayout.dataset.exitResultVisible; }
      const confirmation = matchLayout?.querySelector<HTMLElement>('.scene-exit-confirmation');
      if (confirmation) confirmation.inert = false;
      exitFade.style.opacity = '0';
      delete target.dataset.presentationExitPhase; delete target.dataset.presentationExitProgress;
    };
    const clearExitWalks = () => {
      for (const departure of exitWalks.values()) departure.beats.finish();
      exitWalks.clear(); departing.forEach(model => { model.visible = false; }); clearOwnerExit();
    };
    cleanups.push(clearExitWalks);
    let chestFocus: { start: number; position: Vector3 } | undefined;
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
    const raycaster = new Raycaster();
    const pointer = new Vector2();
    const hoverOutline = new BoxHelper(new Group(), 0xd8bc78);
    hoverOutline.material.transparent = true; hoverOutline.material.opacity = .38;
    hoverOutline.visible = false;
    bundle.scene.add(hoverOutline);
    cleanups.push(() => { hoverOutline.geometry.dispose(); hoverOutline.material.dispose(); });
    let interactionsEnabled = options.interactionsEnabled ?? true;
    let wildcardDrawEnabled = options.wildcardDrawEnabled ?? false;
    let ownerWildcard = options.viewerId === undefined ? undefined : options.ownerWildcard;
    let lookX = 0, lookY = 0, currentLookX = 0, currentLookY = 0, dragX = 0, dragY = 0, dragOriginX = 0, dragOriginY = 0, dragging = false, moved = false;
    let lastFrame = performance.now();
    let falling: { startedAt: number; position: Vector3; rotation: Quaternion; destination: Quaternion } | undefined;
    const syncCamera = (delta: number, now: number) => {
      // Reference .06/frame interpolation, normalized so high-refresh displays feel the same.
      const blend = motion.matches ? 1 : 1 - Math.pow(.94, delta * 60);
      currentLookX += (lookX - currentLookX) * blend;
      currentLookY += (lookY - currentLookY) * blend;
      const revealingOrder = target.clientWidth >= 801 && Boolean(orderRevealFrame(room, Date.now()));
      if (revealingOrder) {
        // Keep both center props in frame from every seat and spectator view.
        focusPosition.set(0, 2.5, 1.9); focusAim.set(0, 1.02, .3);
        camera.position.lerp(focusPosition, blend); cameraAim.lerp(focusAim, blend); camera.lookAt(cameraAim);
      } else if (options.viewerId === undefined) {
        camera.position.set(currentLookX * 1.2, 4.1 - currentLookY * .3, 3.1);
        camera.lookAt(0, .85, -.15);
      } else if (room.players.find(player => player.id === options.viewerId)?.life === 'DOWNED') {
        const progress = falling ? downedFallProgress((now - falling.startedAt) / 1000) : 1;
        focusPosition.set(...CAMERA_VIEWS.downed.position);
        cameraAim.set(...CAMERA_VIEWS.downed.lookAt);
        if (falling && progress < 1) {
          camera.position.lerpVectors(falling.position, focusPosition, progress);
          camera.quaternion.slerpQuaternions(falling.rotation, falling.destination, progress);
        } else {
          falling = undefined;
          camera.position.copy(focusPosition); camera.lookAt(cameraAim); camera.rotateZ(CAMERA_VIEWS.downed.roll);
        }
      } else {
        const desktopFocus = target.clientWidth >= 801 ? focus : 'seat';
        const view = CAMERA_VIEWS[desktopFocus];
        focusPosition.set(view.position[0], view.position[1], view.position[2]); focusAim.set(view.lookAt[0], view.lookAt[1], view.lookAt[2]);
        if (desktopFocus === 'seat') { focusPosition.x += currentLookX * .14; focusPosition.y -= currentLookY * .05; focusAim.x += currentLookX * .9; focusAim.y -= currentLookY * .45; }
        camera.position.lerp(focusPosition, blend); cameraAim.lerp(focusAim, blend); camera.lookAt(cameraAim);
      }
      const scopeFigure = !revealingOrder && options.viewerId !== undefined && room.players.find(player => player.id === options.viewerId)?.life === 'ACTIVE' && spyglassActive && !motion.matches ? characters.get(spyglassTargetId ?? '') : undefined;
      const zoom = scopeFigure ? spyglassZoom((now - spyglassStart) / 1000) : 0;
      if (scopeFigure && zoom > 0) { scopeTarget.set(0, 1, .6); scopeFigure.localToWorld(scopeTarget); scopeAim.copy(cameraAim).lerp(scopeTarget, zoom); camera.lookAt(scopeAim); }
      const fov = revealingOrder ? camera.fov + (42 - camera.fov) * blend : 58 - 38 * zoom;
      if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
      target.dataset.presentationFov = String(fov);
      target.dataset.presentationFocus = revealingOrder ? 'order' : options.viewerId === undefined ? 'spectator' : room.players.find(player => player.id === options.viewerId)?.life === 'DOWNED' ? falling ? 'falling' : 'downed' : target.clientWidth >= 801 ? focus : 'seat';
    };
    const semanticHit = (event: PointerEvent): SceneIntent | undefined => {
      const wildcardTargeting = ownerWildcard?.phase === 'TARGETING';
      if ((!interactionsEnabled && !wildcardTargeting) || options.viewerId === undefined || exitWalks.has(options.viewerId) || (arrival && !arrival.finished)) return undefined;
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(interactiveTargets, true).find(value => {
        for (let node: Object3D | null = value.object; node; node = node.parent) {
          if (!node.visible) return false;
          const semantic = node.userData.semantic as SceneIntent | undefined;
          if (semantic?.kind === 'POCKET' && semantic.ownerId !== options.viewerId && (!aimPockets || !aimTargets.includes(semantic.ownerId))) return false;
        }
        return true;
      });
      let node: Object3D | null = hit?.object ?? null;
      while (node && !node.userData.semantic) node = node.parent;
      const semantic = node?.userData.semantic as SceneIntent | undefined;
      if (!interactionsEnabled && !(semantic?.kind === 'PLAYER' && wildcardTargeting && aimTargets.includes(semantic.playerId))) return undefined;
      const wildcardEligible = semantic?.kind === 'WILDCARD' && canInteractWithWildcardDeck(room, options.viewerId, wildcardDrawEnabled);
      hoverOutline.visible = Boolean(node && (semantic?.kind === 'ITEM' || semantic?.kind === 'CHEST' || semantic?.kind === 'POCKET' || wildcardEligible));
      if (node && hoverOutline.visible) hoverOutline.setFromObject(node);
      return node?.userData.semantic as SceneIntent | undefined;
    };
    const pointerMove = (event: PointerEvent) => {
      if (options.viewerId === undefined || (!interactionsEnabled && ownerWildcard?.phase !== 'TARGETING') || (arrival && !arrival.finished)) return;
      const bounds = renderer.domElement.getBoundingClientRect();
      if (dragging) {
        lookX = Math.max(-1, Math.min(1, lookX - (event.clientX - dragX) / Math.max(1, bounds.width) * 1.7));
        lookY = Math.max(-1, Math.min(1, lookY + (event.clientY - dragY) / Math.max(1, bounds.height) * 1.3));
        dragX = event.clientX; dragY = event.clientY; moved ||= Math.hypot(event.clientX - dragOriginX, event.clientY - dragOriginY) > 5;
      } else if (event.pointerType === 'mouse') {
        lookX = Math.max(-1, Math.min(1, ((event.clientX - bounds.left) / bounds.width) * 2 - 1));
        lookY = Math.max(-1, Math.min(1, ((event.clientY - bounds.top) / bounds.height) * 2 - 1));
      }
      if (focus === 'seat' && event.pointerType === 'mouse') options.onCameraTravel?.(lookX * 45);
      const intent = dragging ? undefined : semanticHit(event);
      const wildcardEligible = intent?.kind === 'WILDCARD' && canInteractWithWildcardDeck(room, options.viewerId, wildcardDrawEnabled);
      renderer.domElement.style.cursor = dragging ? 'grabbing' : intent && (intent.kind !== 'WILDCARD' || wildcardEligible) ? 'pointer' : 'grab';
      wildcardDeck.setHovered(Boolean(!dragging && wildcardEligible));
      if (dragging) hoverOutline.visible = false;
      const aimCharacter = !aimPockets && intent?.kind === 'PLAYER' && aimTargets.includes(intent.playerId) ? characters.get(intent.playerId) : undefined;
      aimLight.intensity = aimCharacter ? 1.4 : 0;
      if (aimCharacter) { platePoint.set(0, 1.3, .25); aimCharacter.localToWorld(platePoint); aimLight.position.copy(platePoint); }
      const itemName = (value: string) => value.replace(/-/g, ' ').toUpperCase();
      tooltip.textContent = intent?.kind === 'ITEM' ? `${intent.ownerId === options.viewerId ? 'YOUR' : room.players.find(player => player.id === intent.ownerId)?.name.toUpperCase() ?? ''} ${itemName(intent.itemId)} · CLICK TO INSPECT`
        : intent?.kind === 'CHEST' ? `${intent.chestKind === 'BLACK' ? 'BLACK ' : ''}CHEST · ${room.chests?.find(chest => chest.kind === intent.chestKind)?.availability === 'OPENED' ? 'OPENED' : 'LOCKED'}`
        : intent?.kind === 'PLAYER' ? room.players.find(player => player.id === intent.playerId)?.name.toUpperCase() ?? ''
        : intent?.kind === 'EXIT' ? 'LEAVE TABLE'
        : intent?.kind === 'MARKET_PUBLIC' ? 'PUBLIC SHOP'
        : intent?.kind === 'MARKET_BLACK' ? 'PRIVATE BLACK MARKET'
        : intent?.kind === 'WILDCARD' ? wildcardDeckTooltip(room, options.viewerId, wildcardDrawEnabled)
        : intent?.kind === 'POCKET' ? intent.ownerId === options.viewerId ? 'YOUR POCKET' : `${room.players.find(player => player.id === intent.ownerId)?.name.toUpperCase() ?? ''} · POCKET ${intent.pocketIndex + 1}`
        : intent?.kind === 'SELL' ? 'SELL-BACK' : '';
      tooltip.style.whiteSpace = intent?.kind === 'WILDCARD' ? 'pre-line' : 'nowrap';
      tooltip.style.display = tooltip.textContent ? 'block' : 'none';
      tooltip.style.left = `${Math.max(6, Math.min(event.clientX - bounds.left + 18, bounds.width - tooltip.offsetWidth - 6))}px`;
      tooltip.style.top = `${Math.max(6, Math.min(event.clientY - bounds.top + 14, bounds.height - tooltip.offsetHeight - 6))}px`;
      if (motion.matches) render(performance.now());
    };
    const pointerDown = (event: PointerEvent) => {
      if (options.viewerId === undefined || (!interactionsEnabled && ownerWildcard?.phase !== 'TARGETING') || (arrival && !arrival.finished)) return;
      dragging = true; moved = false; dragX = dragOriginX = event.clientX; dragY = dragOriginY = event.clientY;
      renderer.domElement.setPointerCapture?.(event.pointerId);
    };
    const pointerUp = (event: PointerEvent) => {
      if (options.viewerId === undefined || (!interactionsEnabled && ownerWildcard?.phase !== 'TARGETING') || (arrival && !arrival.finished)) return;
      dragging = false; renderer.domElement.releasePointerCapture?.(event.pointerId);
      if (!moved) {
        let intent = semanticHit(event);
        if (intent?.kind === 'WILDCARD' && !canInteractWithWildcardDeck(room, options.viewerId, wildcardDrawEnabled)) intent = undefined;
        target.dataset.presentationIntent = intent?.kind ?? 'EMPTY';
        if (motion.matches) render(performance.now());
        options.onIntent?.(intent ?? { kind: 'EMPTY' });
      }
    };
    const pointerLeave = (event: PointerEvent) => {
      tooltip.style.display = 'none';
      hoverOutline.visible = false;
      wildcardDeck.setHovered(false);
      aimLight.intensity = 0;
      if (event.pointerType === 'mouse' && !dragging) { lookX = 0; lookY = 0; if (motion.matches) render(performance.now()); }
    };
    const pointerCancel = () => { dragging = false; };
    renderer.domElement.addEventListener('pointermove', pointerMove);
    renderer.domElement.addEventListener('pointerdown', pointerDown);
    renderer.domElement.addEventListener('pointerup', pointerUp);
    renderer.domElement.addEventListener('pointercancel', pointerCancel);
    renderer.domElement.addEventListener('pointerleave', pointerLeave);
    cleanups.push(() => {
      renderer.domElement.removeEventListener('pointermove', pointerMove);
      renderer.domElement.removeEventListener('pointerdown', pointerDown);
      renderer.domElement.removeEventListener('pointerup', pointerUp);
      renderer.domElement.removeEventListener('pointercancel', pointerCancel);
      renderer.domElement.removeEventListener('pointerleave', pointerLeave);
    });
    const clearEffects = () => { for (const effect of effects.values()) effect.finish(); effects.clear(); };
    const seatPlacement = (seatId: string, slot: number) => {
      const seat = seats.find(value => value.id === seatId);
      if (!seat) return new Vector3(0, TABLE_TOP_Y + .02, 0);
      const offset = -.75 + slot * .3;
      if (seat.position[2] > 0) return new Vector3(offset, TABLE_TOP_Y, 1.12);
      if (seat.position[2] < 0) return new Vector3(-offset, TABLE_TOP_Y, -1.15);
      return new Vector3(Math.sign(seat.position[0]) * 1.72, TABLE_TOP_Y, Math.sign(seat.position[0]) * offset);
    };
    const syncInventory = () => {
      const live = new Set<string>();
      const livePockets = new Set<string>();
      const removeInteractive = (object: Object3D) => {
        const index = interactiveTargets.indexOf(object);
        if (index >= 0) interactiveTargets.splice(index, 1);
        object.removeFromParent();
      };
      for (const player of room.players) {
        let seal = objectiveSeals.get(player.id);
        if (!seal) {
          seal = kit.group(kit.mesh(new CylinderGeometry(.045, .05, .014, 10), kit.materials.red, 0, .007), kit.mesh(new BoxGeometry(.03, .004, .012), kit.materials.bone, 0, .016, 0, 0, .6));
          seal.name = `objectiveSeal:${player.id}`; seal.userData.label = `${player.name.toUpperCase()} · OBJECTIVE COMPLETE · DETAILS HIDDEN`;
          const seat = seats.find(value => value.id === player.id)!;
          const outward = new Vector3(seat.position[0], 0, seat.position[2]).normalize(), right = new Vector3(outward.z, 0, -outward.x);
          seal.position.set(0, TABLE_TOP_Y, 0).addScaledVector(outward, 1.3).addScaledVector(right, -.8);
          bundle.scene.add(seal); objectiveSeals.set(player.id, seal);
        }
        seal.visible = player.objectiveCompleted;
        let display = statusDisplays.get(player.id);
        if (!display) {
          const texture = kit.texture(`seat-display:${player.id}`, 64, 20, () => {});
          const screen = kit.mesh(new PlaneGeometry(.3, .094), new MeshBasicMaterial({ map: texture }), 0, .068, .01, -Math.PI / 2 + .45);
          const model = kit.group(kit.mesh(new BoxGeometry(.36, .12, .16), kit.materials.dark, 0, .06), screen);
          const seat = seats.find(value => value.id === player.id)!;
          const near = seat.position[2] > 0, far = seat.position[2] < 0;
          model.position.set(near ? 1.25 : far ? 1.15 : Math.sign(seat.position[0]) * 1.75, TABLE_TOP_Y, near ? .98 : far ? -1.3 : -1.2);
          model.rotation.y = near ? 0 : far ? Math.PI : Math.sign(seat.position[0]) * Math.PI / 2;
          bundle.scene.add(model); display = { model, texture, signature: '' }; statusDisplays.set(player.id, display);
        }
        const signature = `${player.hp}:${player.coins}`;
        if (display.signature !== signature) {
          display.signature = signature;
          const context = (display.texture.image as HTMLCanvasElement).getContext('2d')!;
          context.fillStyle = '#050505'; context.fillRect(0, 0, 64, 20);
          context.fillStyle = `#${seats.find(value => value.id === player.id)!.color.toString(16).padStart(6, '0')}`;
          for (let index = 0; index < 5; index++) { context.globalAlpha = index < player.hp ? 1 : .18; context.fillRect(3 + index * 7, 4, 5, 12); }
          context.globalAlpha = 1; context.font = 'bold 14px monospace'; context.drawImage(coinIcon, 36, 2, 16, 16); context.fillText(String(player.coins), 53, 15); display.texture.needsUpdate = true;
        }
        player.visibleInventory.forEach((item, slot) => {
          if (!item) return;
          const id = modelId(item.itemId);
          if (!id) return;
          live.add(item.instanceId);
          let entry = inventoryModels.get(item.instanceId);
          if (!entry || entry.itemId !== item.itemId || entry.ownerId !== player.id) {
            if (entry) removeInteractive(entry.anchor);
            const anchor = new Group();
            const model = id === 'bullet' ? kit.createAmmoSlot(item.quantity) : kit.createItem(id, { label: item.itemId });
            const pose = ITEM_PRESENTATION[id as keyof typeof ITEM_PRESENTATION];
            if (pose) { model.rotation.set(pose.rotation[0], pose.rotation[1], pose.rotation[2]); model.position.y = pose.y; }
            anchor.add(model); anchor.scale.setScalar(id === 'bullet' ? 1 : 1.15); anchor.userData.semantic = { kind: 'ITEM', instanceId: item.instanceId, ownerId: player.id, itemId: item.itemId };
            bundle.scene.add(anchor); interactiveTargets.push(anchor);
            entry = { anchor, model, ownerId: player.id, itemId: item.itemId }; inventoryModels.set(item.instanceId, entry);
          }
          if (id === 'bullet') kit.setAmmoQuantity(entry.model, item.quantity);
          entry.anchor.position.copy(seatPlacement(player.id, slot));
          entry.anchor.rotation.y = (seats.find(value => value.id === player.id)?.rotationY ?? Math.PI) - Math.PI + (id === 'bullet' ? 0 : slot * .4 - .3);
        });
        player.pocketOccupancy.forEach((occupied, index) => {
          const key = `${player.id}:${index}`;
          livePockets.add(key);
          let model = pocketModels.get(key);
          if (!model) {
            model = kit.createPocket(!occupied); model.scale.setScalar(1); bundle.scene.add(model); pocketModels.set(key, model);
            model.userData.semantic = { kind: 'POCKET', ownerId: player.id, pocketIndex: index }; interactiveTargets.push(model);
          }
          model.getObjectByName('lid')!.rotation.x = occupied ? 0 : -1.9;
          const seat = seats.find(value => value.id === player.id)!;
          const own = seat.position[2] > 0;
          const outward = new Vector3(seat.position[0], 0, seat.position[2]).normalize();
          const right = new Vector3(outward.z, 0, -outward.x);
          model.position.copy(seatPlacement(player.id, 2.5)).addScaledVector(right, 1.15 + index * .27).addScaledVector(outward, own ? .22 : .16);
          model.userData.restY = model.position.y;
          model.rotation.y = seat.rotationY - Math.PI - .1;
        });
      }
      for (const [id, entry] of inventoryModels) if (!live.has(id)) { removeInteractive(entry.anchor); inventoryModels.delete(id); }
      for (const [id, model] of pocketModels) if (!livePockets.has(id)) { removeInteractive(model); pocketModels.delete(id); }
      const myCoins = room.players.find(player => player.id === options.viewerId)?.coins ?? 0;
      coins.children.forEach((coin, index) => { coin.visible = index < Math.min(5, myCoins); });
    };
    const syncPlayers = () => {
      for (const player of room.players) {
        const upper = characters.get(player.id)?.getObjectByName('upper'); if (!upper) continue;
        upper.visible = player.life !== 'DEAD' && player.life !== 'EXITED' && player.id !== options.viewerId;
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
      const delta = Math.max(0, Math.min(.05, (now - lastFrame) / 1000)); lastFrame = now;
      // The media query value can change before its change callback is delivered.
      if (motion.matches) { finishArrival(); clearEffects(); falling = undefined; if (exitWalks.size) clearExitWalks(); }
      if (arrival && !arrival.finished) {
        const phase = arrival.update((now - arrivalStart) / 1000);
        if (arrival.finished) finishArrival(true); else setPhase(phase);
      }
      restraints.forEach(restraint => restraint.restorePose());
      characters.forEach((character, id) => {
        const player = room.players.find(value => value.id === id);
        const time = motion.matches ? 0 : now / 1000, offset = seats.findIndex(seat => seat.id === id) * 1.7;
        if (player?.life === 'ACTIVE') kit.animateCharacter(character, time, offset);
        if (player?.life === 'DOWNED') {
          const event = [...(room.events ?? [])].reverse().find(entry => entry.kind === 'DOWNED' && entry.targetIds.includes(id));
          kit.animateDownedCharacter(character, event ? Math.max(0, (Date.now() - event.at) / 1000) : 1.5, time, offset);
        }
      });
      syncPlayers();
      hitLight.intensity = 0; flashOpacity = 0;
      for (const [key, effect] of effects) {
        const seconds = (now - effect.start) / 1000;
        if (seconds >= effect.duration) { effect.finish(); effects.delete(key); } else effect.apply(seconds);
      }
      // Pin the restrained wrist after idle/impact motion. The post stays fixed to the table.
      restraints.forEach((restraint, id) => restraint.apply(now / 1000, motion.matches, room.players.find(player => player.id === id)?.life === 'ACTIVE'));
      target.dataset.presentationRestraints = String([...restraints.values()].filter(restraint => restraint.tether.visible).length);
      target.dataset.presentationEffects = String(effects.size);
      screenFlash.style.opacity = String(flashOpacity);
      target.dataset.presentationFlash = String(flashOpacity);
      target.dataset.presentationHit = String(hitLight.intensity);
      target.dataset.presentationActions = String([...effects.keys()].filter(key => key.startsWith('action:')).length);
      target.dataset.presentationLoot = String([...effects.keys()].filter(key => key.startsWith('loot:')).length);
      target.dataset.presentationSelection = String(Boolean(selectedItem && inventoryModels.has(selectedItem)));
      target.dataset.presentationIntro = introPhase ?? 'none';
      if (!arrival || arrival.finished) syncCamera(delta, now);
      if (chestFocus) {
        const seconds = (now - chestFocus.start) / 1000;
        if (seconds >= 3.2) chestFocus = undefined;
        else camera.lookAt(cameraAim.clone().lerp(chestFocus.position, .35 * ease(seconds / .5) * (1 - ease((seconds - 2.5) / .7))));
      }
      // Exit playback is independent of the short item-effect pool and all game clocks.
      let activeDoor = false;
      for (const [id, departure] of exitWalks) {
        const seconds = (now - departure.start) / 1000, pose = sampleExit(departure.path, seconds, departure.origin);
        for (const beat of departure.beats.advance(seconds, document.visibilityState !== 'hidden')) options.onExitBeat?.(beat);
        const model = departing.get(id)!;
        const ownExit = id === options.viewerId;
        if (ownExit && seconds >= EXIT_DURATION && !matchLayout?.querySelector('.scene-exit-confirmation')) {
          exitWalks.delete(id); clearOwnerExit(); continue;
        }
        model.visible = !ownExit && seconds >= .7 && seconds < 13.9;
        if (model.visible) {
          kit.animateCharacter(model, now / 1000);
          model.position.copy(pose.position).setY(Math.sin(pose.progress * departure.path.getLength() / EXIT_STRIDE * Math.PI) * .012);
          model.getObjectByName('upper')!.position.y = .76 + .22 * ease((seconds - .7) / 1);
          const direction = departure.path.getTangentAt(pose.progress);
          model.rotation.y = Math.atan2(direction.x, direction.z);
        }
        if (ownExit) {
          camera.position.copy(pose.position); camera.lookAt(pose.lookAt);
          if (arrivalBody) { arrivalBody.chair.position.z = pose.chairZ; arrivalBody.chair.rotation.y = pose.chairYaw; arrivalBody.legs.visible = seconds < .7; arrivalBody.hands.visible = false; }
          screenFlash.style.background = '#e6dfd0'; screenFlash.style.opacity = String(pose.flash);
          exitFade.style.opacity = String(pose.black);
          target.dataset.presentationExitPhase = pose.phase;
          target.dataset.presentationExitProgress = String(Math.min(1, seconds / EXIT_DURATION));
          if (matchLayout) {
            matchLayout.dataset.exitPlaying = 'true'; matchLayout.dataset.exitResultVisible = String(seconds >= 14);
            matchLayout.style.setProperty('--scene-exit-hud-opacity', String(pose.hudOpacity));
            matchLayout.style.setProperty('--scene-exit-result-opacity', String(pose.resultOpacity));
            const confirmation = matchLayout.querySelector<HTMLElement>('.scene-exit-confirmation');
            if (confirmation) {
              const wasInert = confirmation.inert; confirmation.inert = seconds < 14;
              if (wasInert && !confirmation.inert) confirmation.querySelector('button')?.focus({ preventScroll: true });
            }
          }
        }
        if (seconds < EXIT_DURATION) {
          activeDoor = true;
          if (doorHinge) doorHinge.rotation.y = pose.hingeYaw;
          doorLight.intensity = pose.doorIntensity;
          if (doorGlow && 'material' in doorGlow) (doorGlow.material as MeshBasicMaterial).color.setRGB(.16 + .62 * pose.lighting, .15 + .59 * pose.lighting, .13 + .53 * pose.lighting);
          for (const [watcherId, character] of characters) {
            if (watcherId === id || room.players.find(player => player.id === watcherId)?.life !== 'ACTIVE') continue;
            const local = character.worldToLocal(pose.position.clone());
            const head = character.getObjectByName('head')!;
            head.rotation.y += (Math.max(-1.25, Math.min(1.25, Math.atan2(local.x, local.z))) - head.rotation.y) * ease((seconds - .9) / .9);
          }
        } else if (!ownExit) exitWalks.delete(id);
      }
      const orderFrame = target.clientWidth >= 801 ? orderRevealFrame(room, Date.now()) : undefined;
      orderProps.apply(orderFrame, motion.matches);
      target.dataset.presentationOrder = orderFrame?.phase ?? 'none';
      wildcardDeck.apply(now, motion.matches);
      const wildcardState = publicWildcardDeckSnapshot(room);
      const wildcardInteractive = interactionsEnabled && canInteractWithWildcardDeck(room, options.viewerId, wildcardDrawEnabled);
      const wildcardPresentation = wildcardDeck.state();
      target.dataset.presentationWildcard = wildcardState.visible ? wildcardInteractive ? 'available' : 'visible' : 'hidden';
      target.dataset.presentationWildcardRemaining = String(wildcardState.remaining);
      target.dataset.presentationWildcardPhase = wildcardPresentation.phase;
      target.dataset.presentationWildcardFace = wildcardPresentation.face;
      // A reusable item stays in the inventory snapshot while its action model moves.
      // Derive visibility from active effects so completion/cancellation restores only live instances.
      const animatedInventory = new Set([...effects.values()].flatMap(effect => effect.sourceInstanceId ? [effect.sourceInstanceId] : []));
      for (const [id, entry] of inventoryModels) {
        if (animatedInventory.has(id)) { entry.anchor.visible = false; continue; }
        if (effects.has(`loot:${id}`)) continue;
        entry.anchor.visible = true;
        const owner = room.players.find(player => player.id === entry.ownerId);
        const slot = owner?.visibleInventory.findIndex(item => item?.instanceId === id) ?? -1;
        if (slot < 0) continue;
        const base = seatPlacement(entry.ownerId, slot), selected = id === selectedItem;
        const blend = motion.matches ? 1 : 1 - Math.pow(.86, delta * 60);
        const y = base.y + (selected ? .07 : 0);
        entry.anchor.position.y += (y - entry.anchor.position.y) * blend;
        entry.anchor.position.z += (base.z - entry.anchor.position.z) * blend;
        kit.setInteractionOutline(entry.anchor, selected);
        if (selected) { entry.anchor.rotation.x += (.25 - entry.anchor.rotation.x) * blend; selectionLight.position.copy(entry.anchor.position).add(new Vector3(0, .2, .3)); }
        else {
          entry.anchor.rotation.x += -entry.anchor.rotation.x * blend;
          const baseYaw = (seats.find(seat => seat.id === entry.ownerId)?.rotationY ?? Math.PI) - Math.PI + (entry.itemId === 'bullet' ? 0 : slot * .4 - .3);
          entry.anchor.rotation.y += (baseYaw - entry.anchor.rotation.y) * blend;
        }
      }
      selectionLight.intensity = selectedItem && inventoryModels.get(selectedItem)?.anchor.visible ? 1.8 : 0;
      for (const [id, character] of characters) kit.setInteractionOutline(character, !aimPockets && aimTargets.includes(id));
      for (const model of pocketModels.values()) {
        const semantic = model.userData.semantic as Extract<SceneIntent, { kind: 'POCKET' }>;
        const aimed = aimPockets && aimTargets.includes(semantic.ownerId);
        kit.setInteractionOutline(model, aimed);
        const blend = motion.matches ? 1 : 1 - Math.pow(.86, delta * 60);
        model.position.y += (Number(model.userData.restY) + (aimed ? .07 : 0) - model.position.y) * blend;
      }
      if (room.mode === 'tutorial') {
        const pulse = motion.matches ? 1 : (Math.sin(now / 380) + 1) / 2;
        for (const [id, character] of characters) kit.setTutorialOutline(character, tutorialFocus === 'dealer' && id === 'dealer', pulse, 1.025, .38);
        for (const [kind, chest] of chests) kit.setTutorialOutline(chest, tutorialFocus === 'chest' && kind === 'STANDARD', pulse);
        kit.setTutorialOutline(coins, tutorialFocus === 'coins', pulse);
        kit.setTutorialOutline(wildcardDeck.root, tutorialFocus === 'wildcard' && !ownerWildcard, pulse);
      }
      camera.updateMatrixWorld();
      // Inherit projected coordinates into React overlays without a per-frame React render.
      const sceneFrame = target.parentElement!;
      const selected = selectedItem ? inventoryModels.get(selectedItem) : undefined;
      if (selected?.anchor.visible) {
        selected.anchor.getWorldPosition(platePoint); platePoint.y += .1; platePoint.project(camera);
        const inFrame = platePoint.z < 1 && Math.abs(platePoint.x) <= 1 && Math.abs(platePoint.y) <= 1;
        const card = sceneFrame.querySelector<HTMLElement>('.scene-item-card');
        const cardWidth = card?.offsetWidth || 230, cardHeight = card?.offsetHeight || 250;
        const width = target.clientWidth, height = target.clientHeight;
        const x = inFrame ? (platePoint.x + 1) / 2 * width : width * .5;
        const y = inFrame ? (1 - platePoint.y) / 2 * height : height * .7;
        // Account for the source's 30% horizontal offset and the full card height.
        sceneFrame.style.setProperty('--scene-item-x', `${Math.max(Math.max(width * .1, cardWidth * .3 + 16), Math.min(Math.min(width * .9, width - cardWidth * .7 - 16), x))}px`);
        sceneFrame.style.setProperty('--scene-item-y', `${Math.min(height * .9, Math.max(cardHeight + 24, height * .1, y - 16))}px`);
      } else {
        sceneFrame.style.removeProperty('--scene-item-x'); sceneFrame.style.removeProperty('--scene-item-y');
      }
      for (const [name, x, y, z] of [['standard', -1.15, 1.412, -.6], ['black', 1.2, 1.412, -.6], ['door', 2.4, 2.85, -5.9]] as const) {
        platePoint.set(x, y, z).project(camera);
        const px = (platePoint.x + 1) / 2 * target.clientWidth, py = (1 - platePoint.y) / 2 * target.clientHeight;
        sceneFrame.style.setProperty(`--scene-${name}-x`, `${name === 'door' ? px : Math.min(target.clientWidth - 170, Math.max(170, px))}px`);
        sceneFrame.style.setProperty(`--scene-${name}-y`, `${name === 'door' ? py : Math.max(200, py - 24)}px`);
        sceneFrame.style.setProperty(`--scene-${name}-visibility`, platePoint.z < 1 && px > 0 && px < target.clientWidth && py > 0 && py < target.clientHeight ? 'visible' : 'hidden');
      }
      // Exit prompt (board 08): above the lintel when there is room under the timer; otherwise it floats
      // inside the lit doorway instead of being pushed down onto the lamp. Never clamped off its anchor.
      {
        platePoint.set(2.4, 2.85, -5.9).project(camera);
        const lintelY = (1 - platePoint.y) / 2 * target.clientHeight;
        const inside = lintelY < 170;
        if (inside) platePoint.set(2.4, 1.45, -5.9).project(camera);
        sceneFrame.style.setProperty('--scene-door-y', `${(1 - platePoint.y) / 2 * target.clientHeight}px`);
        sceneFrame.style.setProperty('--scene-door-x', `${(platePoint.x + 1) / 2 * target.clientWidth}px`);
        sceneFrame.dataset.doorPrompt = inside ? 'inside' : 'above';
      }
      if (!activeDoor) doorLight.intensity = exitReady ? 4.5 + (motion.matches ? 0 : Math.sin(now / 1000 * 3) * .7) : 2.2;
      for (const [id, plate] of plates) {
        const character = characters.get(id)!;
        platePoint.set(0, 2.08, 0); character.localToWorld(platePoint); platePoint.project(camera);
        const x = (platePoint.x + 1) / 2 * target.clientWidth;
        let y = (1 - platePoint.y) / 2 * target.clientHeight;
        if (shortHeader && x > shortHeader.left - 50 && x < shortHeader.right + 50) y = Math.max(y, shortHeader.bottom + 42);
        const visible = room.players.find(player => player.id === id)?.life !== 'EXITED' && room.players.find(player => player.id === id)?.life !== 'DEAD' && platePoint.z < 1 && x > 30 && x < target.clientWidth - 30 && y > 30 && y < target.clientHeight;
        plate.style.visibility = visible ? 'visible' : 'hidden';
        if (visible) plate.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      }
      if (lamp && !motion.matches) { lamp.rotation.z = Math.sin(now / 1000 * .7) * .035; lamp.rotation.x = Math.cos(now / 1000 * .5) * .02; }
      post.render(bundle.scene, camera, motion.matches ? 0 : now / 1000);
    };
    const render = (now: number) => { try { draw(now); } catch { fail(); } };
    const tick = (now: number) => {
      render(now);
      if (!disposed && !motion.matches && document.visibilityState !== 'hidden') frame = requestAnimationFrame(tick);
    };
    const redraw = () => { cancelAnimationFrame(frame); render(performance.now()); if (!disposed && !motion.matches && document.visibilityState !== 'hidden') frame = requestAnimationFrame(tick); };
    // Reduced motion renders static results at the same server timeline boundaries.
    const orderTimer = window.setInterval(() => {
      if (motion.matches && document.visibilityState !== 'hidden' && (orderRevealFrame(room, Date.now()) || target.dataset.presentationOrder !== 'none' || wildcardDeck.state().phase !== 'idle')) render(performance.now());
    }, 100);
    cleanups.push(() => window.clearInterval(orderTimer));
    const visualSettings = (event: Event) => {
      const grain: unknown = (event as CustomEvent<{ grain?: unknown }>).detail?.grain;
      if (grain !== .06 && grain !== .16) return;
      post.setGrain(grain); target.dataset.presentationGrain = String(grain); redraw();
    };
    window.addEventListener('table-visual-settings', visualSettings);
    cleanups.push(() => window.removeEventListener('table-visual-settings', visualSettings));
    const addEffect = (key: string, duration: number, apply: Effect['apply'], finish: Effect['finish'], sourceInstanceId?: string) => {
      effects.get(key)?.finish(); effects.delete(key);
      if (effects.size >= 6) { const oldest = effects.keys().next().value!; effects.get(oldest)?.finish(); effects.delete(oldest); }
      effects.set(key, { start: performance.now(), duration, apply, finish, ...(sourceInstanceId ? { sourceInstanceId } : {}) }); apply(0);
    };
    const cue = (event: TableCue) => {
      if (event.type === 'action') {
        const actor = seats.find(value => value.id === event.playerId), recipient = seats.find(value => value.id === event.targetId);
        if (!actor || !recipient) return;
        // Handcuffs now live on the target's wrist and seat post for the full public status.
        // The restraint rig owns its attach beat; do not draw a second floating pair here.
        if (event.itemId === 'handcuffs') return;
        const key = `action:${event.playerId}:${event.itemId}`;
        let action = actionModels.get(key);
        if (!action) { action = createPublicActionPresentation(kit, event.itemId); actionModels.set(key, action); bundle.scene.add(action.anchor); }
        const targetPoint = new Vector3(0, 1.3, .25); characters.get(event.targetId)!.localToWorld(targetPoint);
        const recipientFront = actionSeatPoint(recipient, 0, 1.22, 1.9);
        const geometry = {
          start: seatPlacement(actor.id, event.sourceSlot ?? 0), target: targetPoint, recipientFront,
          wrist: actionSeatPoint(recipient, .2, TABLE_TOP_Y + .03, 1.62), recipientYaw: recipient.rotationY - Math.PI,
          held: event.itemId === 'antidote' ? actionSeatPoint(actor, -.22, 1.3, 1.85) : actionSeatPoint(actor, .18, 1.32, 1.82),
          /* 0.18 from the eye filled the whole screen with bottle; tip it in the lower third instead. */ mouth: actionSeatPoint(recipient, .08, 1.36, 1.98), arm: actionSeatPoint(recipient, -.3, 1.08, 2.05), actorYaw: actor.rotationY - Math.PI,
        };
        if (event.itemId === 'pistol') { const direction = targetPoint.clone().sub(geometry.start); geometry.actorYaw = Math.atan2(-direction.x, -direction.z); }
        const presentation = action;
        const duration = event.itemId === 'stimulant' ? ACTION_DURATION.stimulant : COMPACT_ACTION_SECONDS;
        addEffect(key, duration, elapsed => {
          const seconds = elapsed / duration * ACTION_DURATION[event.itemId];
          const hit = presentation.apply(seconds, geometry);
          if (hit > 0) {
            const character = characters.get(event.targetId)!;
            const upper = character.getObjectByName('upper'), head = character.getObjectByName('head');
            if (upper) upper.rotation.x -= hit * .28;
            if (head) head.rotation.x -= hit * .35;
            if (hit * 5 > hitLight.intensity) { hitLight.position.copy(targetPoint); hitLight.intensity = hit * 5; }
          }
          if (event.targetId === options.viewerId) {
            const flash = actionFlash(event.itemId, seconds);
            if (flash.opacity > flashOpacity) { flashOpacity = flash.opacity; screenFlash.style.background = flash.color; }
          }
        }, () => { presentation.finish(); syncPlayers(); }, event.sourceInstanceId);
      } else if (event.type === 'chest-tool') {
        const actor = seats.find(value => value.id === event.playerId), chest = chests.get(event.kind);
        if (!actor || !chest) return;
        if (event.itemId === 'key' || event.itemId === 'blackKey') {
          const key = kit.createItem(event.itemId); chest.add(key);
          key.rotation.y = Math.PI / 2;
          addEffect(`tool:${event.kind}`, 1.2, seconds => {
            key.position.set(0, .2, .48 - .21 * ease(seconds / .3));
            key.rotation.z = Math.PI / 2 * ease((seconds - .3) / .15);
          }, () => { key.removeFromParent(); });
          return;
        }
        let tool = toolModels.get(event.itemId);
        if (!tool) { tool = createChestToolPresentation(kit, event.itemId); toolModels.set(event.itemId, tool); bundle.scene.add(tool.anchor); }
        chest.updateMatrixWorld(true);
        const keyhole = chest.localToWorld(KEYHOLE[event.kind].clone());
        const forward = new Vector3(0, 0, 1).applyAxisAngle(new Vector3(0, 1, 0), chest.rotation.y);
        const presentation = tool, geometry = { start: seatPlacement(actor.id, event.sourceSlot ?? 0), keyhole, forward, chestYaw: chest.rotation.y };
        addEffect(`tool:${event.kind}`, 1.2, seconds => presentation.apply(seconds / 1.2 * presentation.duration, geometry), () => presentation.finish());
      } else if (event.type === 'impact') {
        const upper = characters.get(event.playerId)?.getObjectByName('upper'); if (!upper) return;
        addEffect(`impact:${event.playerId}`, 0.6, t => { upper.rotation.x = publicImpactTilt(room.players.find(player => player.id === event.playerId)!.life, t); }, syncPlayers);
      } else if (event.type === 'death' || event.type === 'exit') {
        const original = characters.get(event.playerId), seat = seats.find(value => value.id === event.playerId);
        if (!original || !seat) return;
        let ghost = departing.get(event.playerId);
        if (!ghost) {
          // Build an independent rig: Object3D.clone would leave skinned arm
          // skeletons pointing at the seated figure's bones.
          ghost = kit.createCharacter(seat.role, seat.color, seat.label, event.type === 'exit' ? 'standing' : 'seated');
          bundle.scene.add(ghost); departing.set(event.playerId, ghost);
        }
        const model = ghost, upper = model.getObjectByName('upper')!;
        upper.visible = true;
        const start = new Vector3(...seat.position);
        if (event.type === 'exit') {
          finishArrival();
          const ownExit = event.playerId === options.viewerId;
          const origin = ownExit ? { position: camera.position.clone(), lookAt: cameraAim.clone() }
            : { position: start.clone().setY(1.6), lookAt: new Vector3(1.7, 2.15, -3.6) };
          const path = createExitPath(seat);
          exitWalks.set(event.playerId, { start: performance.now(), path, origin, beats: new ExitBeatTimeline(path) });
          model.visible = !ownExit;
          return;
        }
        addEffect(`depart:${event.playerId}`, 1.2, t => {
          model.visible = true; model.position.copy(start); upper.rotation.set(0, 0, 0);
          upper.rotation.x = ease(t / .8) * .6; upper.rotation.z = ease(t / 1.1) * .05;
        }, () => { model.visible = false; });
      } else if (event.type === 'chest-loot') {
        const chest = chests.get(event.kind)!;
        const received = event.instanceIds.map(id => inventoryModels.get(id)?.itemId).filter((id): id is string => Boolean(id));
        chestBanner.textContent = `${event.kind === 'BLACK' ? 'BLACK' : 'STANDARD'} CHEST · ${event.playerId === options.viewerId ? 'YOU TOOK' : 'TAKEN'} ${received.map(itemName).join(' + ').toUpperCase()}`;
        for (const id of event.instanceIds) {
          const entry = inventoryModels.get(id); if (!entry) continue;
          const owner = room.players.find(player => player.id === event.playerId)!;
          const slot = owner.visibleInventory.findIndex(item => item?.instanceId === id);
          const destination = seatPlacement(event.playerId, slot), above = new Vector3(chest.position.x, 1.45, chest.position.z);
          const out = (value: number) => 1 - Math.pow(1 - value, 3);
          const inOut = (value: number) => value < .5 ? 2 * value * value : 1 - Math.pow(-2 * value + 2, 2) / 2;
          addEffect(`loot:${id}`, 2.95, elapsed => {
            entry.anchor.visible = elapsed >= 1.2;
            if (elapsed < 1.7) entry.anchor.position.set(chest.position.x, 1 + .45 * out(Math.max(0, (elapsed - 1.2) / .5)), chest.position.z);
            else if (elapsed < 2.45) entry.anchor.position.copy(above);
            else { const q = inOut(Math.min(1, (elapsed - 2.45) / .5)); entry.anchor.position.lerpVectors(above, destination, q); entry.anchor.position.y += Math.sin(q * Math.PI) * .25; }
            entry.anchor.rotation.y = elapsed * 2;
          }, () => { entry.anchor.visible = true; entry.anchor.position.copy(destination); entry.anchor.rotation.y = (seats.find(seat => seat.id === event.playerId)?.rotationY ?? Math.PI) - Math.PI; });
        }
      } else if (event.type === 'chest') {
        const model = chests.get(event.kind)!, lid = model.getObjectByName('lid')!;
        chestFocus = { start: performance.now(), position: model.position.clone().add(new Vector3(0, .2, 0)) };
        const glow = new PointLight(0xffc070, 0, 1.4, 2); glow.position.set(0, .48, 0); model.add(glow);
        if (!chestBanner.textContent?.includes('CHEST')) chestBanner.textContent = `${event.kind === 'BLACK' ? 'BLACK' : 'STANDARD'} CHEST · OPENED`;
        addEffect(`chest:${event.kind}`, 2.95, elapsed => {
          // Key and tool arrive first; latch, lid, loot hold, then transfer.
          const u = Math.max(0, Math.min(1, (elapsed - .7) / .75));
          const latch = elapsed > .45 && elapsed < .7 ? -.06 * Math.sin((elapsed - .45) / .25 * Math.PI) : 0;
          lid.rotation.x = (event.kind === 'BLACK' ? -1.9 : -1.95) * ease(u) + latch + (elapsed > 1.3 && elapsed < 1.6 ? Math.sin((elapsed - 1.3) / .3 * Math.PI) * .05 : 0);
          glow.intensity = elapsed < 1.2 ? 0 : elapsed < 1.7 ? 2.2 * ease((elapsed - 1.2) / .5) : elapsed < 2.45 ? 2.2 : 2.2 * (1 - ease((elapsed - 2.45) / .5));
          chestBanner.hidden = elapsed < 1.45 || elapsed >= 2.45;
        }, () => { lid.rotation.x = room.chests?.find(value => value.kind === event.kind)?.availability === 'OPENED' ? -1.9 : 0; glow.removeFromParent(); chestBanner.hidden = true; chestBanner.textContent = ''; });
      } else if (event.type === 'shop') {
        addEffect('shop', 0.65, t => { shop.position.y = -0.12 * (1 - ease(t / 0.65)); }, () => { shop.position.y = 0; });
      } else if (event.type === 'wildcard-resolved') {
        wildcardDeck.play(event, performance.now(), motion.matches);
        const changes = [
          ...(event.itemsTransferred ?? []).map(change => ({ kind: 'transfer' as const, ...change })),
          ...(event.itemsGranted ?? []).map(change => ({ kind: 'grant' as const, ...change })),
          ...(event.itemsDestroyed ?? []).map(change => ({ kind: 'destroy' as const, ...change })),
        ].slice(0, 4);
        for (const [index, change] of changes.entries()) {
          const id = modelId(change.itemId); if (!id) continue;
          const model = kit.createItem(id, { label: change.itemId });
          const pose = ITEM_PRESENTATION[id as keyof typeof ITEM_PRESENTATION];
          if (pose) { model.rotation.set(pose.rotation[0], pose.rotation[1], pose.rotation[2]); model.position.y = pose.y; }
          const anchor = new Group(); anchor.add(model); anchor.scale.setScalar(.95); bundle.scene.add(anchor);
          const destinationPlayer = change.kind === 'transfer' ? change.toPlayerId : change.kind === 'grant' ? change.playerId : undefined;
          const destinationSlot = destinationPlayer === undefined ? -1 : room.players.find(player => player.id === destinationPlayer)?.visibleInventory.findIndex(item => item?.instanceId === change.instanceId) ?? -1;
          const start = change.kind === 'transfer' ? seatPlacement(change.fromPlayerId, index + 1)
            : change.kind === 'grant' ? new Vector3(-.08, TABLE_TOP_Y + .08, .02)
              : seatPlacement(change.playerId, index + 1);
          const destination = destinationPlayer === undefined ? start.clone().add(new Vector3(0, -.16, 0)) : seatPlacement(destinationPlayer, destinationSlot >= 0 ? destinationSlot : index + 1);
          const key = `wildcard-item:${change.instanceId}`;
          addEffect(key, .58, seconds => {
            const progress = Math.max(0, Math.min(1, seconds / .58));
            const travel = 1 - Math.pow(1 - progress, 3);
            anchor.visible = true; anchor.position.lerpVectors(start, destination, travel);
            if (change.kind === 'destroy') {
              anchor.scale.setScalar(.95 - travel * .62); anchor.rotation.y = progress * 2.2;
            } else {
              anchor.position.y += Math.sin(progress * Math.PI) * .12; anchor.rotation.y = progress * 1.4;
            }
          }, () => { anchor.removeFromParent(); }, change.kind === 'destroy' ? undefined : change.instanceId);
        }
      } else if (event.type === 'wildcard-drawn' || event.type === 'wildcard-used' || event.type === 'wildcard-burned') {
        wildcardDeck.play(event, performance.now(), motion.matches);
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
      const offers = room.shop?.publicOffers ?? [];
      const signature = JSON.stringify(offers.map(offer => [offer.id, offer.itemId, offer.price, offer.purchasedBy]));
      if (signature === shopSignature) return;
      shopSignature = signature; effects.get('shop')?.finish(); effects.delete('shop');
      shop.removeFromParent(); shopKit?.dispose(); shopKit = undefined; shop = new Group();
      if (!offers.length) return;
      shopKit = new VisualKit({ seed: room.code });
      shop.position.set(-3.5, 0, -2.6); shop.rotation.y = .75;
      for (const [index, offer] of offers.entries()) {
        const id = modelId(offer.itemId); if (!id) continue;
        const model = shopKit.createItem(id), pose = ITEM_PRESENTATION[id as keyof typeof ITEM_PRESENTATION];
        if (pose) model.rotation.set(pose.rotation[0], pose.rotation[1], pose.rotation[2]);
        model.position.y = pose?.y ?? 0;
        const anchor = new Group(); anchor.add(model); anchor.position.set(-.54 + index * .36, 1.32, 0); anchor.rotation.y = .3; anchor.scale.setScalar(1.6); anchor.visible = !offer.purchasedBy; shop.add(anchor);
        const price = shopKit.texture(`offer:${offer.id}`, 32, 14, context => {
          context.fillStyle = offer.purchasedBy ? '#3a0e0a' : '#bfb294'; context.fillRect(0, 0, 32, 14);
          context.fillStyle = offer.purchasedBy ? '#e05040' : '#1a1410'; context.font = 'bold 11px monospace'; context.fillText(offer.purchasedBy ? 'SOLD' : String(offer.price), 3, 11); if (!offer.purchasedBy) context.drawImage(coinIcon, 16, 0, 14, 14);
        });
        shop.add(shopKit.mesh(new PlaneGeometry(.2, .09), new MeshBasicMaterial({ map: price }), -.54 + index * .36, 1.26, .255));
      }
      bundle.scene.add(shop);
    };
    const update = (next: PublicRoomView) => {
      if (disposed || next.revision < room.revision) return;
      const wasDowned = room.players.find(player => player.id === options.viewerId)?.life === 'DOWNED';
      room = next;
      const isDowned = room.players.find(player => player.id === options.viewerId)?.life === 'DOWNED';
      if (isDowned && !wasDowned && !motion.matches && document.visibilityState !== 'hidden') {
        const destination = camera.clone();
        destination.position.set(...CAMERA_VIEWS.downed.position);
        destination.lookAt(...CAMERA_VIEWS.downed.lookAt); destination.rotateZ(CAMERA_VIEWS.downed.roll);
        falling = { startedAt: performance.now(), position: camera.position.clone(), rotation: camera.quaternion.clone(), destination: destination.quaternion.clone() };
      } else if (!isDowned || motion.matches || document.visibilityState === 'hidden') falling = undefined;
      for (const [kind, model] of chests) {
        const state = room.chests?.find(chest => chest.kind === kind)?.availability;
        model.visible = state === 'AVAILABLE' || state === 'OPENED';
        if (!effects.has(`chest:${kind}`)) model.getObjectByName('lid')!.rotation.x = state === 'OPENED' ? -1.9 : 0;
      }
      wildcardDeck.sync(publicWildcardDeckSnapshot(room), performance.now(), motion.matches, document.visibilityState === 'hidden');
      syncShop();
      syncInventory();
      characters.forEach((character, id) => kit.setCharacterThreat(character, publicThreatPose(room, id)));
      const cues = observer.observe(room);
      const restrainedNow = performance.now() / 1000;
      for (const [id, restraint] of restraints) {
        const player = room.players.find(value => value.id === id);
        const attached = player?.life === 'ACTIVE' && player.statuses?.some(status => status.kind === 'HANDCUFFED');
        const freshAttach = cues.some(value => value.type === 'action' && value.itemId === 'handcuffs' && value.targetId === id);
        restraint.setCuffed(Boolean(attached), restrainedNow, !motion.matches && document.visibilityState !== 'hidden' && (!attached || freshAttach));
      }
      if (document.visibilityState !== 'hidden') for (const value of cues) {
        if (!motion.matches) cue(value);
        else if (value.type === 'wildcard-drawn' || value.type === 'wildcard-used' || value.type === 'wildcard-burned' || value.type === 'wildcard-resolved') wildcardDeck.play(value, performance.now(), true);
      }
      if (arrival && !arrival.finished && (room.status !== 'PLAYING' || room.players.find(player => player.id === options.viewerId)?.life !== 'ACTIVE')) finishArrival();
      render(performance.now());
    };
    const changeMotion = () => { if (motion.matches) { finishArrival(); clearEffects(); falling = undefined; wildcardDeck.apply(performance.now(), true); } redraw(); };
    const visibility = () => {
      // Consume unheard beats on both sides of a hidden interval; never burst them on return.
      const now = performance.now();
      for (const departure of exitWalks.values()) departure.beats.advance((now - departure.start) / 1000, false);
      if (document.visibilityState === 'hidden') { finishArrival(); clearEffects(); falling = undefined; cancelAnimationFrame(frame); } else redraw();
    };
    motion.addEventListener('change', changeMotion); document.addEventListener('visibilitychange', visibility);
    cleanups.push(() => { motion.removeEventListener('change', changeMotion); document.removeEventListener('visibilitychange', visibility); });
    const resize = new ResizeObserver(entries => {
      if (disposed) return;
      const box = entries[0]?.contentRect; if (!box || box.width < 1 || box.height < 1) return;
      try {
        renderer.setSize(box.width, box.height, false); camera.aspect = box.width / box.height; camera.updateProjectionMatrix();
        measureShortHeader();
        post.resize(Math.max(1, Math.floor(box.width / 3)), Math.max(1, Math.floor(box.height / 3))); render(performance.now());
      } catch { fail(); }
    });
    resize.observe(target); cleanups.push(() => resize.disconnect());
    cleanups.push(() => { arrival?.dispose(); clearEffects(); shop.removeFromParent(); shopKit?.dispose(); });
    measureShortHeader(); update(initialRoom);
    const seat = seats.find(value => value.id === options.viewerId);
    const alreadyStarted = hasStartedArrival(room, sessionStorage());
    // Even reduced-motion/late-entry observers should not start an intro after a remount.
    if (seat) rememberArrivalStart(room, sessionStorage());
    if (!disposed && seat && arrivalEligible(room, options.viewerId, motion.matches, alreadyStarted)) {
      arrivalStart = performance.now(); arrival = new TableArrival(camera, seat, characters.get(seat.id), options.onBeat, arrivalBody);
      setPhase('approach');
    }
    target.dataset.arrivalDuration = String(ARRIVAL_DURATION);
    redraw();
    return { setTutorialFocus(value) { tutorialFocus = value; redraw(); }, update(next) { try { update(next); } catch { fail(); } }, setInteractionsEnabled(value) { interactionsEnabled = value; if (!value && ownerWildcard?.phase !== 'TARGETING') tooltip.style.display = 'none'; if (motion.matches) render(performance.now()); }, setExitReady(value) { exitReady = value; if (motion.matches) render(performance.now()); }, setWildcardDrawEnabled(value) { wildcardDrawEnabled = value; hoverOutline.visible = false; wildcardDeck.setHovered(false); if (motion.matches) render(performance.now()); }, setOwnerWildcard(value) { ownerWildcard = options.viewerId === undefined ? undefined : value; wildcardDeck.setOwnerWildcard(ownerWildcard, performance.now(), motion.matches); redraw(); }, setFocus(value) { focus = value; if (motion.matches) render(performance.now()); }, setItemSelection(value, targets, pockets = false) { selectedItem = value; aimTargets = targets; aimPockets = pockets; aimLight.intensity = 0; if (motion.matches) render(performance.now()); }, setSpyglass(id, active) { if (active && (!spyglassActive || spyglassTargetId !== id)) spyglassStart = performance.now(); spyglassTargetId = id; spyglassActive = active; redraw(); }, skipIntro() { if (canSkipIntro) { finishArrival(); redraw(); } }, dispose };
  } catch (error) { dispose(); throw error; }
}
