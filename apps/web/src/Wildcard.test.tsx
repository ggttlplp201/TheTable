import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { WILDCARDS, type WildcardId } from '@the-table/content';
import { WildcardDecision, WildcardDraw, WildcardPublicFeedback, WildcardTargetPicker } from './Wildcard';
import { wildcardPublicResult, wildcardResolutionCommand, wildcardResolutionFeedback, wildcardTargets, WILDCARD_RESULT_DURATION, WILDCARD_RESOLUTION_DURATION } from './wildcard-presentation';
import { ownerRoom, spectatorRoom } from './test-fixtures';
import { sceneIntentTarget } from './MatchView';
import { PlayerRoster } from './MatchPanels';

const send = vi.fn(async () => true);
const draft = { targetId: 'p2', instanceId: 'p2-pistol', ownInstanceId: 'p1-cloth', pocketIndex: '0' };
function wildcardRoom(cardId: WildcardId = 'seize', phase: 'DRAWN' | 'TARGETING' = 'DRAWN') {
  const room = ownerRoom();
  room.public.round!.number = 3;
  room.public.turn!.primaryUsed = true;
  room.public.wildcard = { unlocked: true, remaining: 9, discard: [], drawUsedByPlayer: { p1: true, p2: false } };
  room.private.pendingWildcard = { cardId, phase };
  room.private.capabilities = phase === 'DRAWN' ? ['USE_WILDCARD', 'BURN_WILDCARD', 'CHAT'] : ['RESOLVE_WILDCARD', 'CHAT'];
  if (phase === 'TARGETING') room.public.wildcard.pending = { playerId: 'p1', cardId };
  return room;
}

describe('committed Wildcard UI', () => {
  it('requires authoritative draw capability and never routes spectators to a draw', () => {
    const room = ownerRoom();
    expect(sceneIntentTarget(room, 'p1', { kind: 'WILDCARD' })).toBeNull();
    room.private.capabilities!.push('DRAW_WILDCARD');
    expect(sceneIntentTarget(room, 'p1', { kind: 'WILDCARD' })).toEqual({ panel: 'WILDCARD' });
    expect(sceneIntentTarget(spectatorRoom(), 'p1', { kind: 'WILDCARD' })).toBeNull();
    const html = renderToStaticMarkup(<WildcardDraw room={room} send={send} busy={false} />);
    expect(html).toContain('Costs your Primary Action');
    expect(html).toContain('Drawing cannot be cancelled');
    expect(renderToStaticMarkup(<WildcardDraw room={room} send={send} busy />)).toContain('disabled=""');
  });

  it.each(WILDCARDS.map(card => card.id))('renders %s privately with Use/Burn and no pre-Use target picker', cardId => {
    const room = wildcardRoom(cardId);
    const html = renderToStaticMarkup(<WildcardDecision room={room} send={send} busy={false} connected />);
    expect(html).toContain('ONLY YOU SEE THIS');
    expect(html).toContain('Primary Action committed');
    expect(html).toContain('>USE</button>');
    expect(html).toContain('>BURN</button>');
    expect(html).toContain('class="wildcard-use"');
    expect(html).toContain('class="wildcard-burn"');
    expect(html).toContain('YOUR PRIMARY ACTION IS COMMITTED');
    expect(html).toContain('Choose what happens to this Wildcard.');
    expect(html).toContain('class="wildcard-ability-banner"');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<canvas');
    expect(html).toContain('Normal turn remaining');
    expect(html).not.toContain('<select');
    expect(html).not.toMatch(/>CANCEL<|>Close<|>Put down</);
    expect(wildcardResolutionCommand(room, draft)).toBeUndefined();
  });

  it('restores the authoritative target stage without a Burn or cancellation route', () => {
    const room = wildcardRoom('forced-exchange', 'TARGETING');
    const html = renderToStaticMarkup(<WildcardDecision room={room} send={send} busy={false} connected />);
    expect(html).toContain('REVEALED TO THE TABLE');
    expect(html).toContain('Wildcard target player');
    expect(html).toContain('Your exchange item');
    expect(html).not.toContain('>BURN</button>');
    expect(html).not.toContain('owner-secret-item');
    expect(html).not.toContain('Medicine');
    expect(html).toContain('Use is committed');
    const unavailable = renderToStaticMarkup(<WildcardDecision room={room} send={send} busy connected={false} />);
    expect(unavailable).toContain('Reconnecting');
    expect(unavailable).toContain('<fieldset disabled=""');
  });

  it('shows public Available/Spent independently for every player', () => {
    const room = wildcardRoom();
    const html = renderToStaticMarkup(<PlayerRoster room={room.public} viewerId="p1" />);
    expect(html).toContain('WILDCARD: SPENT');
    expect(html).toContain('WILDCARD: AVAILABLE');
    expect(html).not.toContain('Seize');
  });
});

describe('public Wildcard targets and submission', () => {
  it('targets visible inventory only, accepts visible equipment/artifacts/token and rejects stale/private instances', () => {
    const room = wildcardRoom('seize', 'TARGETING');
    expect(wildcardResolutionCommand(room, draft)).toEqual({ type: 'RESOLVE_WILDCARD', targetId: 'p2', instanceId: 'p2-pistol' });
    expect(wildcardResolutionCommand(room, { ...draft, instanceId: 'owner-secret-item' })).toBeUndefined();
    for (const itemId of ['safe', 'bag', 'armor', 'brass-idol', 'passage-token']) {
      room.public.players[1]!.visibleInventory[0] = { instanceId: 'visible', itemId, quantity: 1 };
      expect(wildcardResolutionCommand(room, { ...draft, instanceId: 'visible' })?.instanceId).toBe('visible');
    }
    expect(wildcardResolutionCommand(room, draft)).toBeUndefined();
    room.private.capabilities = [];
    expect(wildcardResolutionCommand(room, { ...draft, instanceId: 'visible' })).toBeUndefined();
  });

  it('requires both exchange items to be visible and current', () => {
    const room = wildcardRoom('forced-exchange', 'TARGETING');
    expect(wildcardResolutionCommand(room, draft)).toEqual({ type: 'RESOLVE_WILDCARD', targetId: 'p2', instanceId: 'p2-pistol', ownInstanceId: 'p1-cloth' });
    expect(wildcardResolutionCommand(room, { ...draft, ownInstanceId: 'owner-secret-item' })).toBeUndefined();
    room.public.players[0]!.visibleInventory.fill(null);
    expect(wildcardTargets(room.public, 'p1', 'forced-exchange').hasTargets).toBe(false);
    expect(wildcardResolutionCommand(room, draft)).toEqual({ type: 'RESOLVE_WILDCARD' });
  });

  it('selects occupied pockets without inferring contents or Safe protection', () => {
    const room = wildcardRoom('search-warrant', 'TARGETING');
    room.public.players[1]!.pocketOccupancy = [true, false];
    room.public.players[1]!.visibleInventory[0] = { instanceId: 'visible-safe', itemId: 'safe', quantity: 1 };
    expect(wildcardResolutionCommand(room, draft)).toEqual({ type: 'RESOLVE_WILDCARD', targetId: 'p2', pocketIndex: 0 });
    for (const pocketIndex of ['', '1', '-1', '0.5', 'NaN']) expect(wildcardResolutionCommand(room, { ...draft, pocketIndex })).toBeUndefined();
    const html = renderToStaticMarkup(<WildcardTargetPicker room={room} send={send} busy={false} />);
    expect(html).toContain('Safe blocks the reveal');
    expect(html).not.toContain('other-secret-item');
    expect(html).not.toContain('Safe-protected');
  });

  it('excludes self, Downed, dead, exited and conceded targets while allowing disconnected active seats', () => {
    const room = wildcardRoom('destroy', 'TARGETING');
    const other = room.public.players[1]!;
    for (const life of ['DOWNED', 'DEAD', 'EXITED'] as const) { other.life = life; expect(wildcardTargets(room.public, 'p1', 'destroy').hasTargets).toBe(false); }
    other.life = 'ACTIVE'; other.conceded = true;
    expect(wildcardTargets(room.public, 'p1', 'destroy').hasTargets).toBe(false);
    other.conceded = false; other.connection = 'DISCONNECTED';
    expect(wildcardTargets(room.public, 'p1', 'destroy').hasTargets).toBe(true);
    other.visibleInventory.fill(null);
    expect(wildcardTargets(room.public, 'p1', 'destroy').hasTargets).toBe(false);
    const html = renderToStaticMarkup(<WildcardTargetPicker room={room} send={send} busy={false} />);
    expect(html).toContain('No legal targets remain');
    expect(html).toContain('RESOLVE · NO EFFECT');
    expect(wildcardResolutionCommand(room, draft)).toEqual({ type: 'RESOLVE_WILDCARD' });
  });
});

describe('public Wildcard feedback secrecy and timing', () => {
  it('shows late resolution for its own bounded window after the art reveal has ended', () => {
    const room = wildcardRoom('seize');
    delete room.private.pendingWildcard;
    const at = Date.now() - 100;
    room.public.events = [
      { id: 'use', sequence: 1, at: at - 10000, kind: 'WILDCARD_USED', actorId: 'p1', targetIds: [], publicText: 'Ada played — Seize.', presentation: { wildcardId: 'seize' } },
      { id: 'resolved', sequence: 2, at, kind: 'WILDCARD_RESOLVED', actorId: 'p1', targetIds: ['p2'], publicText: 'Seize: Ada took Bruno’s Pistol.', presentation: { wildcardId: 'seize', wildcardOutcome: 'APPLIED', itemsTransferred: [{ instanceId: 'p2-pistol', itemId: 'pistol', quantity: 1, fromPlayerId: 'p2', toPlayerId: 'p1' }] } },
    ];
    expect(wildcardPublicResult(room.public, at + 100)).toBeUndefined();
    expect(wildcardResolutionFeedback(room.public, at + 100)?.details).toEqual(['Bruno → Ada · Pistol']);
    const html = renderToStaticMarkup(<WildcardPublicFeedback room={room.public} />);
    expect(html).toContain('Wildcard outcome');
    expect(html).toContain('Ada took Bruno’s Pistol');
    expect(html).not.toContain('wildcard-public-result');
    expect(wildcardResolutionFeedback(room.public, at + WILDCARD_RESOLUTION_DURATION)).toBeUndefined();
    expect(wildcardResolutionFeedback(room.public, at - 1)).toBeUndefined();
  });

  it.each(['BLOCKED', 'NO_LEGAL_TARGET', 'EXPIRED'] as const)('reports %s without extracting Pocket contents', wildcardOutcome => {
    const room = wildcardRoom('search-warrant');
    room.public.events = [{ id: 'result', sequence: 2, at: 1000, kind: 'WILDCARD_RESOLVED', actorId: 'p1', targetIds: ['p2'], publicText: 'Resolved.', presentation: { wildcardId: 'search-warrant', wildcardOutcome, revealedPocket: { playerId: 'p2', pocketIndex: 0, item: { itemId: 'poison', instanceId: 'private-sentinel', quantity: 1 } } } }];
    const feedback = wildcardResolutionFeedback(room.public, 1100)!;
    expect(feedback.text).toMatch(wildcardOutcome === 'BLOCKED' ? /Safe blocked the reveal/ : wildcardOutcome === 'EXPIRED' ? /expired/ : /no legal targets/);
    expect(JSON.stringify(feedback)).not.toMatch(/Poison|poison|private-sentinel/);
    expect(feedback.details).toEqual([]);
  });

  it('shows exact Pocket contents only from a successful public Search Warrant resolution', () => {
    const room = wildcardRoom('search-warrant');
    room.public.events = [{ id: 'result', sequence: 2, at: 1000, kind: 'WILDCARD_RESOLVED', actorId: 'p1', targetIds: ['p2'], publicText: 'Resolved.', presentation: { wildcardId: 'search-warrant', wildcardOutcome: 'APPLIED', revealedPocket: { playerId: 'p2', pocketIndex: 1, item: { itemId: 'bullet', instanceId: 'public-bullet', quantity: 3 } } } }];
    expect(wildcardResolutionFeedback(room.public, 1100)?.text).toBe('Bruno’s Pocket 2: Bullet ×3.');
    expect(wildcardResolutionFeedback(room.public, 1100)?.details).toEqual(['Revealed to everyone · the item stays in the Pocket.']);
    room.public.events[0]!.kind = 'WILDCARD_BURNED';
    expect(wildcardResolutionFeedback(room.public, 1100)).toBeUndefined();
    const burn = wildcardPublicResult(room.public, 1100)!;
    expect(JSON.stringify(burn)).not.toMatch(/Bullet|bullet|Search Warrant|search-warrant/);
  });

  it('never renders burn identity, even when private or accidental presentation metadata contains it', () => {
    const room = wildcardRoom('search-warrant');
    room.public.events = [{ id: 'burn', sequence: 1, at: 1000, kind: 'WILDCARD_BURNED', actorId: 'p1', targetIds: [], publicText: 'Search Warrant secret should never render', presentation: { wildcardId: 'search-warrant' } }];
    const result = wildcardPublicResult(room.public, 1100)!;
    expect(result.card).toBeUndefined();
    expect(result.text).toBe('Ada burned a Wildcard.');
    expect(JSON.stringify(result)).not.toMatch(/search-warrant|Search Warrant/);
    expect(wildcardPublicResult(room.public, 1000 + WILDCARD_RESULT_DURATION)).toBeUndefined();
    expect(wildcardPublicResult(room.public, 999)).toBeUndefined();
  });

  it('shows authoritative reveal and resolution equally across viewer projections', () => {
    const room = wildcardRoom('seize', 'TARGETING');
    room.public.events = [{ id: 'use', sequence: 1, at: 1000, kind: 'WILDCARD_USED', actorId: 'p1', targetIds: [], publicText: 'Ada played — Seize.', presentation: { wildcardId: 'seize' } }];
    expect(wildcardPublicResult(room.public, 1100)?.card?.name).toBe('Seize');
    const html = renderToStaticMarkup(<WildcardPublicFeedback room={room.public} />);
    expect(html).toContain('SEIZE');
    expect(html).toContain('choosing a target');
    expect(renderToStaticMarkup(<WildcardPublicFeedback room={room.public} ownerDecision />)).toBe('');
  });

  it('uses the approved public banner for the full one-second reveal without restarting when targets resolve', () => {
    const room = wildcardRoom('seize', 'TARGETING');
    const at = Date.now() - 600;
    room.public.events = [{ id: 'use', sequence: 1, at, kind: 'WILDCARD_USED', actorId: 'p1', targetIds: [], publicText: 'Ada played — Seize.', presentation: { wildcardId: 'seize' } }];
    const html = renderToStaticMarkup(<WildcardPublicFeedback room={room.public} ownerDecision />);
    expect(html).toContain('ADA PLAYED');
    expect(html).toContain('SEIZE');
    expect(html).toContain(WILDCARDS.find(card => card.id === 'seize')!.description);
    expect(html).not.toContain('<img');
    room.public.events.push({ id: 'resolve', sequence: 2, at: at + 700, kind: 'WILDCARD_RESOLVED', actorId: 'p1', targetIds: ['p2'], publicText: 'Ada took Bruno’s Pistol.', presentation: { wildcardId: 'seize' } });
    expect(wildcardPublicResult(room.public, at + 900)).toMatchObject({ id: 'use', at, targetName: 'Bruno' });
    expect(wildcardPublicResult(room.public, at + 1000)).toBeUndefined();
  });

  it('binds a scene-selected player to the same post-Use target controls', () => {
    const room = wildcardRoom('forced-exchange', 'TARGETING');
    const html = renderToStaticMarkup(<WildcardTargetPicker room={room} send={send} busy={false} targetPlayerId="p2" onTargetPlayerChange={() => {}} />);
    expect(html).toContain('<option value="p2" selected="">Bruno</option>');
    expect(html).toContain('Wildcard target item');
    expect(html).toContain('p2-pistol');
    expect(html).toContain('Your exchange item');
    room.private.pendingWildcard!.phase = 'DRAWN';
    expect(renderToStaticMarkup(<WildcardTargetPicker room={room} send={send} busy={false} targetPlayerId="p2" />)).toBe('');
  });
});
