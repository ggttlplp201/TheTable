import {
  Euler,
  Group,
  MeshBasicMaterial,
  PlaneGeometry,
  PointLight,
  Quaternion,
  Vector3,
  type Material,
  type Object3D,
  type PerspectiveCamera,
} from 'three';
import type { WildcardId } from '@the-table/content';
import type { ActionEvent, PendingWildcard, PublicRoomView } from '@the-table/game';
import { TABLE_TOP_Y, type VisualKit } from '@the-table/visual';

export interface PublicWildcardDeckSnapshot {
  visible: boolean;
  remaining: number;
  discards: Array<{ playerId: string; burned: true } | { playerId: string; burned: false; cardId: WildcardId }>;
  pending?: { playerId: string; cardId: WildcardId };
}

export type PublicWildcardSceneCue =
  | { type: 'wildcard-drawn'; playerId: string }
  | { type: 'wildcard-used'; playerId: string; cardId: WildcardId }
  | { type: 'wildcard-burned'; playerId: string }
  | {
      type: 'wildcard-resolved';
      playerId: string;
      cardId?: WildcardId;
      itemsTransferred: NonNullable<ActionEvent['presentation']>['itemsTransferred'];
      itemsGranted: NonNullable<ActionEvent['presentation']>['itemsGranted'];
      itemsDestroyed: NonNullable<ActionEvent['presentation']>['itemsDestroyed'];
    };

/** Public presentation gate. Round is checked defensively so an inconsistent early projection stays invisible. */
export function publicWildcardDeckSnapshot(room: PublicRoomView): PublicWildcardDeckSnapshot {
  const wildcard = room.wildcard;
  const visible = Boolean(wildcard?.unlocked && (room.round?.number ?? 0) >= 3);
  const discards = visible ? (wildcard?.discard ?? []).map(entry => entry.burned
    ? { playerId: entry.playerId, burned: true as const }
    : { playerId: entry.playerId, burned: false as const, cardId: entry.cardId! }) : [];
  return {
    visible,
    remaining: visible ? Math.max(0, wildcard?.remaining ?? 0) : 0,
    discards,
    ...(visible && wildcard?.pending ? { pending: { ...wildcard.pending } } : {}),
  };
}

/** Capability is authoritative; public facts only narrow it for a physical table affordance. */
export function canInteractWithWildcardDeck(room: PublicRoomView, viewerId: string | undefined, hasDrawCapability: boolean): boolean {
  if (!hasDrawCapability || !viewerId || !publicWildcardDeckSnapshot(room).visible || room.status !== 'PLAYING') return false;
  const viewer = room.players.find(player => player.id === viewerId);
  return Boolean(viewer?.life === 'ACTIVE'
    && room.round?.phase === 'TURN'
    && room.turn
    && room.turn.activeSeat === viewer.seat
    && !room.turn.primaryUsed
    && !room.wildcard?.drawUsedByPlayer[viewerId]
    && (room.wildcard?.remaining ?? 0) > 0);
}

export function wildcardDeckTooltip(room: PublicRoomView, viewerId: string | undefined, hasDrawCapability: boolean): string {
  if (viewerId && room.wildcard?.drawUsedByPlayer[viewerId]) return 'WILDCARD SPENT';
  if (!canInteractWithWildcardDeck(room, viewerId, hasDrawCapability)) return 'WILDCARD DECK';
  return 'DRAW WILDCARD\nOnce per match\nCosts your Primary Action';
}

/** Never parse public prose or private payloads. Draws and burns expose only their public actor. */
export function publicWildcardSceneCue(event: Pick<ActionEvent, 'kind' | 'actorId' | 'presentation'>): PublicWildcardSceneCue | undefined {
  if (!event.actorId) return undefined;
  if (event.kind === 'WILDCARD_DRAWN_PRIVATE') return { type: 'wildcard-drawn', playerId: event.actorId };
  if (event.kind === 'WILDCARD_BURNED') return { type: 'wildcard-burned', playerId: event.actorId };
  if (event.kind === 'WILDCARD_USED' && event.presentation?.wildcardId) return { type: 'wildcard-used', playerId: event.actorId, cardId: event.presentation.wildcardId };
  if (event.kind === 'WILDCARD_RESOLVED') {
    return {
      type: 'wildcard-resolved', playerId: event.actorId,
      ...(event.presentation?.wildcardId ? { cardId: event.presentation.wildcardId } : {}),
      itemsTransferred: event.presentation?.itemsTransferred,
      itemsGranted: event.presentation?.itemsGranted,
      itemsDestroyed: event.presentation?.itemsDestroyed,
    };
  }
  return undefined;
}

export type WildcardPresentationPhase = 'idle' | 'draw' | 'held' | 'target' | 'reveal' | 'discard';
export interface WildcardPresentationState { phase: WildcardPresentationPhase; face: WildcardId | 'back' }

export interface WildcardDeckPresentation {
  root: Group;
  hitTarget: Group;
  sync(snapshot: PublicWildcardDeckSnapshot, now: number, reducedMotion: boolean, reconcileLifecycle?: boolean): void;
  setOwnerWildcard(wildcard: PendingWildcard | undefined, now: number, reducedMotion: boolean): void;
  setHovered(hovered: boolean): void;
  play(cue: PublicWildcardSceneCue, now: number, reducedMotion: boolean): void;
  apply(now: number, reducedMotion: boolean): void;
  state(): WildcardPresentationState;
  dispose(): void;
}

export interface WildcardDeckPresentationOptions {
  camera: PerspectiveCamera;
  viewerId?: string;
  characterFor(playerId: string): Object3D | undefined;
  ownerWildcard?: PendingWildcard;
}

interface Pose { position: Vector3; quaternion: Quaternion; scale: number }
type ActivePhase = 'draw' | 'held' | 'target' | 'opponent-draw' | 'opponent-held' | 'reveal' | 'burn-flip' | 'discard';
interface ActiveCard {
  card: Group;
  actorId: string;
  face: WildcardId | 'back';
  owner: boolean;
  phase: ActivePhase;
  startedAt: number;
  from: Pose;
  discardFaceUp?: boolean;
}

const DECK_POSITION = new Vector3(0, TABLE_TOP_Y, 0);
const DISCARD_POSITION = new Vector3(.52, TABLE_TOP_Y + .002, -.10);
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const easeInOut = (value: number) => { const t = clamp01(value); return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
const easeOut = (value: number) => 1 - Math.pow(1 - clamp01(value), 3);
const easeIn = (value: number) => clamp01(value) ** 2;
const copyPose = (object: Object3D): Pose => ({ position: object.position.clone(), quaternion: object.quaternion.clone(), scale: object.scale.x });

/** Physical Wildcard deck and cards. Card art is exclusively the approved VisualKit source. */
export function createWildcardDeckPresentation(kit: VisualKit, options: WildcardDeckPresentationOptions): WildcardDeckPresentation {
  const root = new Group(); root.name = 'wildcardDeckPresentation';
  const hitTarget = new Group(); hitTarget.name = 'wildcardDeck'; hitTarget.userData.semantic = { kind: 'WILDCARD' };
  const deck = kit.wildcardDeck(10); deck.name = 'wildcardDeckArt'; hitTarget.add(deck);
  hitTarget.position.copy(DECK_POSITION); hitTarget.rotation.y = .18;
  const discard = new Group(); discard.name = 'wildcardDiscard'; discard.position.copy(DISCARD_POSITION);
  root.add(hitTarget, discard);

  const warmLight = new PointLight(0xffd890, 0, 1.1, 2); warmLight.position.set(0, 1.25, .1); root.add(warmLight);
  const dustMaterial = new MeshBasicMaterial({ color: 0x8a7a60, transparent: true, opacity: 0, depthWrite: false });
  const dust = Array.from({ length: 12 }, (_, index) => {
    const mote = kit.mesh(new PlaneGeometry(.025, .025), dustMaterial);
    mote.rotation.x = -Math.PI / 2; mote.visible = false; mote.userData.angle = index / 12 * Math.PI * 2 + ((index * 17) % 5) * .07;
    root.add(mote); return mote;
  });
  const deckMaterials = new Set<Material>();
  deck.traverse(object => {
    const material = (object as { material?: Material | Material[] }).material;
    for (const entry of Array.isArray(material) ? material : material ? [material] : []) deckMaterials.add(entry);
  });

  let visible = false;
  let primed = false;
  let appearanceStartedAt = 0;
  let hovered = false;
  let deckLift = 0;
  let active: ActiveCard | undefined;
  let ownerWildcard = options.viewerId ? options.ownerWildcard : undefined;
  let snapshot: PublicWildcardDeckSnapshot = { visible: false, remaining: 0, discards: [] };
  const discardCards: Group[] = [];

  const cameraPose = (local: Vector3, back = false): Pose => {
    options.camera.updateMatrixWorld();
    return {
      position: options.camera.localToWorld(local.clone()),
      quaternion: options.camera.quaternion.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), back ? Math.PI / 2 : -Math.PI / 2)),
      scale: 1,
    };
  };
  const deckPose = (): Pose => ({
    position: new Vector3(DECK_POSITION.x, DECK_POSITION.y + Number(deck.userData.topY ?? .018) + .002, DECK_POSITION.z),
    quaternion: new Quaternion().setFromEuler(new Euler(0, .18, 0)), scale: 1,
  });
  const actorPose = (playerId: string): Pose => {
    const figure = options.characterFor(playerId);
    const position = figure ? figure.localToWorld(new Vector3(0, 1.25, .55)) : new Vector3(0, 1.35, -.6);
    const facing = cameraPose(new Vector3(0, 0, -1), true);
    return { position, quaternion: facing.quaternion, scale: 1.4 };
  };
  const revealPose = (): Pose => ({ position: new Vector3(0, 1.24, 0), quaternion: cameraPose(new Vector3(0, 0, -1)).quaternion, scale: 2.6 });
  const discardPose = (faceUp: boolean, actorId: string): Pose => {
    const jitter = [...actorId].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 7;
    return {
      position: new Vector3(DISCARD_POSITION.x + (jitter - 3) * .0015, DISCARD_POSITION.y + snapshot.discards.length * .0018, DISCARD_POSITION.z + (3 - jitter) * .0012),
      quaternion: new Quaternion().setFromEuler(new Euler(faceUp ? Math.PI : 0, .5 + jitter * .035, 0)), scale: 1,
    };
  };
  const pose = (to: Pose, progress: number, arc = 0, from = active?.from) => {
    if (!active || !from) return;
    active.card.position.lerpVectors(from.position, to.position, progress);
    active.card.position.y += Math.sin(progress * Math.PI) * arc;
    active.card.quaternion.slerpQuaternions(from.quaternion, to.quaternion, progress);
    active.card.scale.setScalar(from.scale + (to.scale - from.scale) * progress);
  };
  const setPhase = (phase: ActivePhase, now: number) => {
    if (!active) return;
    active.phase = phase; active.startedAt = now; active.from = copyPose(active.card);
  };
  const removeActive = () => { active?.card.removeFromParent(); active = undefined; syncDiscardVisibility(); };
  const newActive = (face: WildcardId | 'back', actorId: string, owner: boolean, start: Pose) => {
    removeActive();
    const card = kit.wildcardCard(face); card.name = 'activeWildcardCard'; root.add(card);
    card.position.copy(start.position); card.quaternion.copy(start.quaternion); card.scale.setScalar(start.scale);
    active = { card, actorId, owner, face, phase: 'held', startedAt: 0, from: copyPose(card) };
    return active;
  };
  function syncDiscardVisibility() {
    const newest = snapshot.discards.at(-1);
    const concealNewest = Boolean(active && newest?.playerId === active.actorId && ['reveal', 'burn-flip', 'discard', 'target'].includes(active.phase));
    discardCards.forEach((card, index) => { card.visible = index < snapshot.discards.length && !(concealNewest && index === snapshot.discards.length - 1); });
  }
  const syncDiscards = () => {
    while (discardCards.length < snapshot.discards.length) {
      const card = kit.wildcardCard('back'); card.name = 'wildcardDiscardCard'; discard.add(card); discardCards.push(card);
    }
    snapshot.discards.forEach((entry, index) => {
      const card = discardCards[index]!;
      kit.setWildcardFace(card, entry.burned ? 'back' : entry.cardId);
      kit.setWildcardGlow(card, 0);
      card.position.set((index % 3 - 1) * .0015, index * .0018, ((index * 2) % 3 - 1) * .0012);
      card.rotation.set(entry.burned ? 0 : Math.PI, .5 + (index % 5) * .035, 0);
      card.scale.setScalar(1);
    });
    syncDiscardVisibility();
  };
  const syncDeckCount = () => {
    const top = deck.getObjectByName('top');
    const layers = deck.children.filter(child => child !== top);
    layers.forEach((layer, index) => { layer.visible = index < snapshot.remaining; });
    if (top) { top.visible = snapshot.remaining > 0; top.position.y = snapshot.remaining * .0018 + .0003; }
    hitTarget.visible = snapshot.visible && snapshot.remaining > 0;
  };

  const setOwnerWildcard = (next: PendingWildcard | undefined, now: number, reducedMotion: boolean) => {
    if (!options.viewerId) next = undefined;
    const previous = ownerWildcard; ownerWildcard = next;
    if (!next) {
      if (active?.owner && !['reveal', 'burn-flip', 'discard'].includes(active.phase)) removeActive();
      return;
    }
    const changedCard = !previous || previous.cardId !== next.cardId;
    if (changedCard || !active?.owner) {
      const current = newActive(next.cardId, options.viewerId ?? '', true, deckPose());
      current.phase = next.phase === 'TARGETING' ? 'target' : reducedMotion || !primed ? 'held' : 'draw';
      current.startedAt = now; current.from = copyPose(current.card);
      if (reducedMotion || !primed) {
        const target = next.phase === 'TARGETING' ? cameraPose(new Vector3(-.2, -.1, -.45)) : cameraPose(new Vector3(0, .02, -.42));
        target.scale = next.phase === 'TARGETING' ? .75 : 1.05; pose(target, 1);
      }
    } else if (next.phase === 'TARGETING' && active.phase !== 'target') setPhase('target', now);
    else if (next.phase === 'DRAWN' && active.phase === 'target') setPhase('held', now);
  };

  const sync = (next: PublicWildcardDeckSnapshot, now: number, reducedMotion: boolean, reconcileLifecycle = false) => {
    const entering = next.visible && !visible;
    snapshot = next; visible = next.visible; root.visible = visible;
    if (entering) appearanceStartedAt = reducedMotion ? 0 : now;
    // A hidden tab still consumes public event sequence numbers. Reconcile the held
    // opponent card from authoritative public state so a skipped Use/Burn cannot
    // leave its anonymous back floating after the tab becomes visible again.
    if (reconcileLifecycle && active && !active.owner) {
      if (next.pending?.playerId === active.actorId) {
        kit.setWildcardFace(active.card, next.pending.cardId); active.face = next.pending.cardId;
        active.phase = 'reveal'; active.startedAt = now - 250; active.from = copyPose(active.card);
        pose(revealPose(), 1);
      } else if (next.discards.at(-1)?.playerId === active.actorId) removeActive();
    }
    syncDeckCount(); syncDiscards();
    if (!visible) { removeActive(); ownerWildcard = undefined; }
    else if (!primed && next.pending && next.pending.playerId !== options.viewerId && !active) {
      const current = newActive(next.pending.cardId, next.pending.playerId, false, revealPose());
      current.phase = 'reveal'; current.startedAt = now - 250; current.from = copyPose(current.card);
    }
    primed = true;
    apply(now, reducedMotion);
  };

  const play = (cue: PublicWildcardSceneCue, now: number, reducedMotion: boolean) => {
    if (!snapshot.visible) return;
    if (cue.type === 'wildcard-drawn') {
      if (cue.playerId === options.viewerId) return;
      const current = newActive('back', cue.playerId, false, deckPose()); current.phase = reducedMotion ? 'opponent-held' : 'opponent-draw'; current.startedAt = now; current.from = copyPose(current.card);
      if (reducedMotion) pose(actorPose(cue.playerId), 1);
    } else if (cue.type === 'wildcard-used') {
      if (!active || active.actorId !== cue.playerId) newActive('back', cue.playerId, cue.playerId === options.viewerId, cue.playerId === options.viewerId ? cameraPose(new Vector3(0, .02, -.42)) : actorPose(cue.playerId));
      if (!active) return;
      kit.setWildcardFace(active.card, cue.cardId); active.face = cue.cardId;
      setPhase(cue.playerId === options.viewerId && ownerWildcard?.phase === 'TARGETING' ? 'target' : 'reveal', now);
      if (reducedMotion) {
        const destination = active.phase === 'target' ? cameraPose(new Vector3(-.2, -.1, -.45)) : revealPose();
        destination.scale = active.phase === 'target' ? .75 : destination.scale; pose(destination, 1);
      }
      syncDiscardVisibility();
    } else if (cue.type === 'wildcard-burned') {
      if (!active || active.actorId !== cue.playerId) newActive('back', cue.playerId, cue.playerId === options.viewerId, actorPose(cue.playerId));
      if (!active) return;
      active.discardFaceUp = false;
      setPhase(active.owner && active.face !== 'back' ? 'burn-flip' : 'discard', now);
      if (reducedMotion) removeActive(); else syncDiscardVisibility();
    } else if (cue.type === 'wildcard-resolved' && active?.actorId === cue.playerId && active.phase === 'target') {
      if (cue.cardId && active.face === 'back') { kit.setWildcardFace(active.card, cue.cardId); active.face = cue.cardId; }
      setPhase('reveal', now); syncDiscardVisibility();
    }
  };

  const apply = (now: number, reducedMotion: boolean) => {
    if (!visible) return;
    const appearanceElapsed = appearanceStartedAt ? now - appearanceStartedAt : 1300;
    const appearance = reducedMotion ? 1 : easeIn(appearanceElapsed / 500);
    const opacity = reducedMotion ? 1 : clamp01(appearanceElapsed / 350);
    const liftTarget = hovered && appearance >= 1 ? .008 : 0;
    deckLift += (liftTarget - deckLift) * (reducedMotion ? 1 : .2);
    hitTarget.position.y = DECK_POSITION.y + (1 - appearance) * .22 + deckLift;
    for (const material of deckMaterials) { material.transparent = opacity < 1; material.opacity = opacity; }
    const dustProgress = reducedMotion ? 1 : clamp01((appearanceElapsed - 500) / 700);
    for (const mote of dust) {
      const angle = Number(mote.userData.angle);
      mote.visible = dustProgress > 0 && dustProgress < 1;
      const radius = .07 + easeOut(dustProgress) * .16;
      mote.position.set(Math.cos(angle) * radius, TABLE_TOP_Y + .006 + Math.sin(dustProgress * Math.PI) * .02, Math.sin(angle) * radius);
      (mote.material as MeshBasicMaterial).opacity = (1 - dustProgress) * .55;
      mote.scale.setScalar(1 + dustProgress * 1.5);
    }
    const lightTarget = hovered && appearance >= 1 ? 1.6 : 0;
    warmLight.intensity += (lightTarget - warmLight.intensity) * (reducedMotion ? 1 : .15);
    if (!active) return;
    const elapsed = now - active.startedAt;
    if (active.phase === 'draw') {
      if (reducedMotion) { setPhase('held', now); }
      else if (elapsed < 200) { const lifted = deckPose(); lifted.position.y += easeOut(elapsed / 200) * .06; pose(lifted, 1); }
      else {
        const held = cameraPose(new Vector3(0, .02, -.42)); held.scale = 1.05;
        pose(held, easeInOut((elapsed - 200) / 700), .08);
        if (elapsed >= 900) setPhase('held', now);
      }
    }
    if (active?.phase === 'held') {
      const held = cameraPose(new Vector3(0, .02 + (reducedMotion ? 0 : Math.sin(now / 1000 * 1.6) * .003), -.42)); held.scale = 1.05;
      pose(held, reducedMotion ? 1 : easeOut(elapsed / 350));
    } else if (active?.phase === 'target') {
      const target = cameraPose(new Vector3(-.2, -.1, -.45)); target.scale = .75; pose(target, reducedMotion ? 1 : easeOut(elapsed / 350));
    } else if (active?.phase === 'opponent-draw') {
      pose(actorPose(active.actorId), reducedMotion ? 1 : easeInOut(elapsed / 800), reducedMotion ? 0 : .15);
      if (reducedMotion || elapsed >= 800) setPhase('opponent-held', now);
    } else if (active?.phase === 'opponent-held') {
      pose(actorPose(active.actorId), 1);
    } else if (active?.phase === 'reveal') {
      pose(revealPose(), reducedMotion ? 1 : easeInOut(elapsed / 250), reducedMotion ? 0 : .05);
      if (elapsed >= (reducedMotion ? 700 : 1000)) { active.discardFaceUp = true; setPhase('discard', now); syncDiscardVisibility(); }
    } else if (active?.phase === 'burn-flip') {
      const back = cameraPose(new Vector3(0, .02, -.42), true); back.scale = 1.05; pose(back, reducedMotion ? 1 : easeInOut(elapsed / 350));
      if (reducedMotion || elapsed >= 400) { kit.setWildcardFace(active.card, 'back'); active.face = 'back'; setPhase('discard', now); }
    } else if (active?.phase === 'discard') {
      const destination = discardPose(Boolean(active.discardFaceUp), active.actorId);
      const discardDuration = reducedMotion ? 300 : 550;
      pose(destination, reducedMotion ? 1 : easeInOut(elapsed / discardDuration), reducedMotion ? 0 : .1);
      kit.setWildcardGlow(active.card, .55 * (1 - clamp01(elapsed / discardDuration)));
      if (elapsed >= (reducedMotion ? 300 : 600)) {
        const represented = snapshot.discards.some(entry => entry.playerId === active?.actorId && (entry.burned || entry.cardId === active?.face));
        if (represented) removeActive(); else { active.card.position.copy(destination.position); active.card.quaternion.copy(destination.quaternion); active.card.scale.setScalar(1); }
      }
    }
    if (active) {
      const lift = clamp01((active.card.position.y - 1) / .25);
      if (active.phase !== 'discard') kit.setWildcardGlow(active.card, .55 * lift);
    }
  };

  if (ownerWildcard) setOwnerWildcard(ownerWildcard, 0, true);
  return {
    root, hitTarget, sync, setOwnerWildcard,
    setHovered(value) { hovered = value; },
    play, apply,
    state() {
      if (active) return {
        phase: active.phase === 'draw' || active.phase === 'opponent-draw' ? 'draw'
          : active.phase === 'held' || active.phase === 'opponent-held' ? 'held'
            : active.phase === 'target' ? 'target'
              : active.phase === 'reveal' ? 'reveal' : 'discard',
        face: active.face,
      };
      const top = snapshot.discards.at(-1);
      return { phase: 'idle', face: top && !top.burned ? top.cardId : 'back' };
    },
    dispose() { root.removeFromParent(); },
  };
}
