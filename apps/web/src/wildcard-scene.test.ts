import { describe, expect, it } from 'vitest';
import { Group, PerspectiveCamera } from 'three';
import type { PublicRoomView } from '@the-table/game';
import { VisualKit, type CanvasFactory, type CanvasLike } from '@the-table/visual';
import { ownerRoom } from './test-fixtures';
import { PublicPresentationObserver } from './table-presentation';
import {
  canInteractWithWildcardDeck,
  createWildcardDeckPresentation,
  publicWildcardDeckSnapshot,
  publicWildcardSceneCue,
  wildcardDeckTooltip,
} from './wildcard-scene';

class ArtCanvas {
  readonly context: CanvasRenderingContext2D;
  pixels?: Uint8ClampedArray;
  constructor(public width: number, public height: number) {
    const canvas = this;
    this.context = new Proxy({ canvas }, {
      get(target, key: string) {
        if (key in target) return Reflect.get(target, key);
        if (key === 'measureText') return (text: string) => ({ width: text.length * 9 });
        if (key === 'createRadialGradient' || key === 'createLinearGradient') return () => ({ addColorStop() {} });
        if (key === 'getImageData') return (_x: number, _y: number, width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4), width, height });
        if (key === 'putImageData') return (image: ImageData) => { canvas.pixels = image.data; };
        return () => {};
      },
      set(target, key, value) { Reflect.set(target, key, value); return true; },
    }) as unknown as CanvasRenderingContext2D;
  }
  getContext() { return this.context; }
}
const canvasFactory: CanvasFactory = (width, height) => new ArtCanvas(width, height) as unknown as CanvasLike;

function room(round = 3): PublicRoomView {
  const view = ownerRoom().public;
  view.round = { number: round, phase: 'TURN', seatsOwedTurn: [0, 1] };
  view.wildcard = { unlocked: round >= 3, remaining: 10, discard: [], drawUsedByPlayer: {} };
  return view;
}

function fixture(viewerId?: string) {
  const kit = new VisualKit({ seed: 'wildcard-scene', canvasFactory });
  const camera = new PerspectiveCamera(58, 1, .1, 100);
  camera.position.set(0, 1.65, 2.65); camera.lookAt(0, 1, 0); camera.updateMatrixWorld();
  const figures = new Map<string, Group>([['p1', new Group()], ['p2', new Group()]]);
  figures.get('p2')!.position.set(-2.5, 0, 0);
  const presentation = createWildcardDeckPresentation(kit, {
    camera,
    ...(viewerId ? { viewerId } : {}),
    characterFor: id => figures.get(id),
  });
  return { kit, presentation };
}

describe('approved physical Wildcard presentation', () => {
  it('is absent in Rounds 1-2 and appears only with the authoritative Round 3 unlock', () => {
    const first = room(1); first.wildcard!.unlocked = true;
    expect(publicWildcardDeckSnapshot(first)).toEqual({ visible: false, remaining: 0, discards: [] });
    const second = room(2); second.wildcard!.unlocked = true;
    expect(publicWildcardDeckSnapshot(second).visible).toBe(false);
    const third = room(3); third.wildcard!.unlocked = false;
    expect(publicWildcardDeckSnapshot(third).visible).toBe(false);
    third.wildcard!.unlocked = true;
    expect(publicWildcardDeckSnapshot(third)).toEqual({ visible: true, remaining: 10, discards: [] });
  });

  it('requires capability plus own normal active turn, while keeping spent/not-turn tooltip states', () => {
    const view = room();
    expect(canInteractWithWildcardDeck(view, 'p1', true)).toBe(true);
    expect(wildcardDeckTooltip(view, 'p1', true)).toContain('Costs your Primary Action');
    view.turn!.activeSeat = 1;
    expect(canInteractWithWildcardDeck(view, 'p1', true)).toBe(false);
    expect(wildcardDeckTooltip(view, 'p1', true)).toBe('WILDCARD DECK');
    view.turn!.activeSeat = 0; view.wildcard!.drawUsedByPlayer.p1 = true;
    expect(wildcardDeckTooltip(view, 'p1', false)).toBe('WILDCARD SPENT');
    view.wildcard!.drawUsedByPlayer.p1 = false; view.players[0]!.life = 'DOWNED';
    expect(canInteractWithWildcardDeck(view, 'p1', true)).toBe(false);
  });

  it('sanitizes burned discards but retains public used cards and targeting state for reconnects', () => {
    const view = room();
    view.wildcard!.discard = [
      { playerId: 'p2', burned: false, cardId: 'seize' },
      { playerId: 'p1', burned: true, cardId: 'destroy' },
    ];
    view.wildcard!.pending = { playerId: 'p2', cardId: 'windfall' };
    const snapshot = publicWildcardDeckSnapshot(view);
    expect(snapshot).toEqual({
      visible: true, remaining: 10,
      discards: [{ playerId: 'p2', burned: false, cardId: 'seize' }, { playerId: 'p1', burned: true }],
      pending: { playerId: 'p2', cardId: 'windfall' },
    });
    expect(JSON.stringify(snapshot)).not.toContain('destroy');
  });

  it('keeps the private face owner-only through draw/hold/target and ignores it for spectators', () => {
    const owner = fixture('p1');
    const spectator = fixture(undefined);
    try {
      const visible = { visible: true, remaining: 9, discards: [] };
      owner.presentation.sync(visible, 100, false);
      owner.presentation.setOwnerWildcard({ cardId: 'windfall', phase: 'DRAWN' }, 200, false);
      expect(owner.presentation.state()).toEqual({ phase: 'draw', face: 'windfall' });
      owner.presentation.apply(1101, false);
      expect(owner.presentation.state()).toEqual({ phase: 'held', face: 'windfall' });
      owner.presentation.setOwnerWildcard({ cardId: 'windfall', phase: 'TARGETING' }, 1200, false);
      expect(owner.presentation.state()).toEqual({ phase: 'target', face: 'windfall' });

      spectator.presentation.sync(visible, 100, false);
      spectator.presentation.setOwnerWildcard({ cardId: 'destroy', phase: 'DRAWN' }, 200, false);
      expect(spectator.presentation.state()).toEqual({ phase: 'idle', face: 'back' });
    } finally { owner.presentation.dispose(); owner.kit.dispose(); spectator.presentation.dispose(); spectator.kit.dispose(); }
  });

  it('shows opponent draws back-only, then starts the public approved face at Use and holds it for one second', () => {
    const { kit, presentation } = fixture('p1');
    try {
      presentation.sync({ visible: true, remaining: 9, discards: [] }, 0, false);
      presentation.play({ type: 'wildcard-drawn', playerId: 'p2' }, 100, false);
      presentation.apply(950, false);
      expect(presentation.state()).toEqual({ phase: 'held', face: 'back' });
      presentation.play({ type: 'wildcard-used', playerId: 'p2', cardId: 'seize' }, 1000, false);
      expect(presentation.state()).toEqual({ phase: 'reveal', face: 'seize' });
      expect(presentation.root.getObjectByName('activeWildcardCard')!.userData.wcId).toBe('seize');
      presentation.sync({ visible: true, remaining: 9, discards: [{ playerId: 'p2', burned: false, cardId: 'seize' }] }, 1100, false);
      presentation.apply(1999, false);
      expect(presentation.state()).toEqual({ phase: 'reveal', face: 'seize' });
      presentation.apply(2001, false);
      expect(presentation.state().phase).toBe('discard');
      presentation.apply(2602, false);
      expect(presentation.state()).toEqual({ phase: 'idle', face: 'seize' });
      expect(presentation.root.getObjectByName('wildcardDiscard')!.children[0]!.userData.wcId).toBe('seize');
    } finally { presentation.dispose(); kit.dispose(); }
  });

  it('reconciles Draw followed by hidden-tab Use or Burn without leaving an opponent back floating', () => {
    const used = fixture('p1'), burned = fixture('p1');
    try {
      for (const presentation of [used.presentation, burned.presentation]) {
        presentation.sync({ visible: true, remaining: 9, discards: [] }, 0, false);
        presentation.play({ type: 'wildcard-drawn', playerId: 'p2' }, 100, false);
        presentation.apply(901, false);
        expect(presentation.state()).toEqual({ phase: 'held', face: 'back' });
      }

      // While hidden, no event animation is played; the public TARGETING snapshot
      // is sufficient to reveal the committed identity at its readable final pose.
      used.presentation.sync({ visible: true, remaining: 9, discards: [], pending: { playerId: 'p2', cardId: 'seize' } }, 1000, false, true);
      expect(used.presentation.state()).toEqual({ phase: 'reveal', face: 'seize' });
      used.presentation.sync({ visible: true, remaining: 9, discards: [{ playerId: 'p2', burned: false, cardId: 'seize' }] }, 1100, false, true);
      expect(used.presentation.state()).toEqual({ phase: 'idle', face: 'seize' });

      // Burn identity remains secret and the persistent public pile replaces the
      // formerly held back before visibility returns.
      burned.presentation.sync({ visible: true, remaining: 9, discards: [{ playerId: 'p2', burned: true }] }, 1000, false, true);
      expect(burned.presentation.state()).toEqual({ phase: 'idle', face: 'back' });
      expect(burned.presentation.root.getObjectByName('activeWildcardCard')).toBeUndefined();
    } finally { used.presentation.dispose(); used.kit.dispose(); burned.presentation.dispose(); burned.kit.dispose(); }
  });

  it('burn-flips an owner card, clears its identity before discard, and settles immediately without arcs in reduced motion', () => {
    const { kit, presentation } = fixture('p1');
    try {
      presentation.sync({ visible: true, remaining: 9, discards: [] }, 0, false);
      presentation.setOwnerWildcard({ cardId: 'destroy', phase: 'DRAWN' }, 100, false);
      presentation.apply(1001, false);
      presentation.sync({ visible: true, remaining: 9, discards: [{ playerId: 'p1', burned: true }] }, 1100, false);
      presentation.play({ type: 'wildcard-burned', playerId: 'p1' }, 1100, false);
      presentation.apply(1501, false);
      expect(presentation.state()).toEqual({ phase: 'discard', face: 'back' });
      presentation.apply(2102, false);
      expect(presentation.state()).toEqual({ phase: 'idle', face: 'back' });

      presentation.play({ type: 'wildcard-drawn', playerId: 'p2' }, 2150, true);
      expect(presentation.state()).toEqual({ phase: 'held', face: 'back' });
      presentation.play({ type: 'wildcard-used', playerId: 'p2', cardId: 'windfall' }, 2200, true);
      presentation.apply(2200, true);
      expect(presentation.state()).toEqual({ phase: 'reveal', face: 'windfall' });
      expect(presentation.root.getObjectByName('activeWildcardCard')!.position.y).toBeCloseTo(1.24);
    } finally { presentation.dispose(); kit.dispose(); }
  });

  it('routes structured actor-only draw/burn cues and never leaks a malicious private identity', () => {
    expect(publicWildcardSceneCue({ kind: 'WILDCARD_DRAWN_PRIVATE', actorId: 'p2', presentation: { wildcardId: 'destroy' } })).toEqual({ type: 'wildcard-drawn', playerId: 'p2' });
    expect(publicWildcardSceneCue({ kind: 'WILDCARD_BURNED', actorId: 'p2', presentation: { wildcardId: 'destroy' } })).toEqual({ type: 'wildcard-burned', playerId: 'p2' });
    expect(JSON.stringify(publicWildcardSceneCue({ kind: 'WILDCARD_BURNED', actorId: 'p2', presentation: { wildcardId: 'destroy' } }))).not.toContain('destroy');
    expect(publicWildcardSceneCue({ kind: 'WILDCARD_USED', actorId: 'p1', presentation: { wildcardId: 'windfall' } })).toEqual({ type: 'wildcard-used', playerId: 'p1', cardId: 'windfall' });
  });

  it('reconstructs a public pending reveal on observer remount and emits only fresh public lifecycle cues', () => {
    const reconnect = fixture('p1');
    try {
      reconnect.presentation.sync({ visible: true, remaining: 8, discards: [], pending: { playerId: 'p2', cardId: 'seize' } }, 5000, true);
      expect(reconnect.presentation.state()).toEqual({ phase: 'reveal', face: 'seize' });
    } finally { reconnect.presentation.dispose(); reconnect.kit.dispose(); }

    const view = room(), observer = new PublicPresentationObserver(), now = 50_000;
    view.events = []; observer.observe(view, now);
    view.revision += 1;
    view.events.push({ id: 'draw', sequence: 1, at: now, kind: 'WILDCARD_DRAWN_PRIVATE', actorId: 'p2', targetIds: [], publicText: 'Draws.' });
    expect(observer.observe(view, now)).toEqual([{ type: 'wildcard-drawn', playerId: 'p2' }]);
    view.revision += 1;
    view.events.push({ id: 'use', sequence: 2, at: now, kind: 'WILDCARD_USED', actorId: 'p2', targetIds: [], publicText: 'Uses.', presentation: { wildcardId: 'seize' } });
    expect(observer.observe(view, now)).toEqual([{ type: 'wildcard-used', playerId: 'p2', cardId: 'seize' }]);
  });
});
