import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { InspectionRevealView, latestOwnInspection, MatchResolutionOverlays, PrivateInspectionHistory, successfulExit } from './MatchResolutionOverlays';
import { PrivateDetail, Results } from './MatchPanels';
import { matchResultSummary } from './match-results';
import { ownerRoom, spectatorRoom } from './test-fixtures';

describe('private scene inspection presentation', () => {
  function inspected(payload: unknown, kind = 'POCKET_INSPECTED') {
    const room = ownerRoom();
    room.public.events = [{ id: 'inspect', sequence: 1, at: 1000, kind, actorId: 'p1', targetIds: ['p2'], publicText: 'Ada inspected a Pocket.' }];
    room.private.inspections = [{ eventId: 'inspect', payload }];
    return room;
  }
  it('renders the inspected item inside a Pocket using only the correlated owner-authorized disclosure', () => {
    const room = inspected({ targetId: 'p2', pocketIndex: 0, item: { itemId: 'knife', quantity: 1 } });
    const reveal = latestOwnInspection(room, 'p1')!;
    expect(reveal).toMatchObject({ aperture: true, title: '◐ SPYGLASS · ONLY YOU SEE THIS', text: 'BRUNO’S POCKET 1 · KNIFE', pocket: { kind: 'item', itemId: 'knife', quantity: 1 } });
    const html = renderToStaticMarkup(<InspectionRevealView inspection={reveal} />);
    expect(html).toContain('scene-spyglass-aperture');
    expect(html).toContain('scene-inspected-pocket item');
    expect(html).toContain('scene-pocket-item-art');
    expect(html).toContain('aria-label="KNIFE"');
    expect(html).toContain('data-item-model="knife"');
    expect(html).toContain('<canvas');
    expect(html).toContain('scene-inspection-reveal');
    expect(html).not.toContain('owner-secret-item');
    expect(renderToStaticMarkup(<MatchResolutionOverlays room={room} viewerId="p1" />)).toBe('');
  });
  it('keeps Safe, Glass Eye, empty Pocket and Locksmith disclosures within their authorized limits', () => {
    expect(latestOwnInspection(inspected({ targetId: 'p2', pocketIndex: 0, blocked: true, item: { itemId: 'knife' } }), 'p1')).toMatchObject({ aperture: false, text: 'BRUNO’S POCKET 1 · SAFE-PROTECTED', pocket: { kind: 'protected' } });
    expect(latestOwnInspection(inspected({ targetId: 'p2', pocketIndex: 0, weapon: true }), 'p1')).toMatchObject({ aperture: false, text: 'BRUNO’S POCKET 1 · WEAPON YES' });
    expect(latestOwnInspection(inspected({ targetId: 'p2', pocketIndex: 0, item: null }), 'p1')).toMatchObject({ aperture: true, text: 'BRUNO’S POCKET 1 · EMPTY', pocket: { kind: 'empty' } });
    expect(latestOwnInspection(inspected({ targetId: 'p2', pocketIndex: 0 }), 'p1')).toMatchObject({ aperture: false, text: 'BRUNO’S POCKET 1 · RESULT UNAVAILABLE', pocket: { kind: 'unknown' } });
    expect(latestOwnInspection(inspected({ artifact: false, rare: true }, 'CHEST_INSPECTED'), 'p1')).toMatchObject({ aperture: false, text: 'ARTIFACT INSIDE? NO · RARE REGULAR ITEM INSIDE? YES' });
  });
  it('rejects mismatched viewer, event, actor, target and malformed payload without reading spectator inventories', () => {
    const room = inspected({ targetId: 'p2', pocketIndex: 0, item: { itemId: 'knife' } });
    expect(latestOwnInspection(room, 'p2')).toBeUndefined();
    expect(renderToStaticMarkup(<InspectionRevealView inspection={latestOwnInspection(room, 'p1')!} />)).toContain('data-item-model="knife"');
    room.public.events![0]!.actorId = 'p2'; expect(latestOwnInspection(room, 'p1')).toBeUndefined();
    room.public.events![0]!.actorId = 'p1'; room.public.events![0]!.targetIds = ['p3']; expect(latestOwnInspection(room, 'p1')).toBeUndefined();
    room.public.events = []; expect(latestOwnInspection(room, 'p1')).toBeUndefined();
    expect(latestOwnInspection(inspected({ targetId: 'p2', pocketIndex: -1, item: { itemId: 'knife' } }), 'p1')).toBeUndefined();
    expect(latestOwnInspection(inspected(null), 'p1')).toBeUndefined();
    expect(latestOwnInspection(spectatorRoom(), 'p1')).toBeUndefined();
    expect(renderToStaticMarkup(<PrivateInspectionHistory room={spectatorRoom()} viewerId="p1" />)).toBe('');
  });
  it('never creates item art for an opponent or spectator from Pocket state', () => {
    const room = inspected({ targetId: 'p2', pocketIndex: 0, item: { itemId: 'knife', quantity: 1 } });
    const opponent = latestOwnInspection(room, 'p2');
    const spectator = latestOwnInspection(spectatorRoom(), 'p1');
    expect(opponent).toBeUndefined();
    expect(spectator).toBeUndefined();
    expect(opponent && renderToStaticMarkup(<InspectionRevealView inspection={opponent} />)).toBeUndefined();
    expect(spectator && renderToStaticMarkup(<InspectionRevealView inspection={spectator} />)).toBeUndefined();
  });
  it('keeps inspection history in a separate owner-only surface, not the contract paper', () => {
    const room = inspected({ targetId: 'p2', pocketIndex: 0, item: { itemId: 'knife' } });
    expect(renderToStaticMarkup(<PrivateInspectionHistory room={room} viewerId="p1" />)).toContain('BRUNO’S POCKET 1 · KNIFE');
    expect(renderToStaticMarkup(<PrivateDetail detail={room.private} room={room.public} />)).not.toContain('BRUNO’S POCKET');
  });
});

describe('personal successful exit', () => {
  it('requires authoritative exited life, exit order, and the viewer’s EXIT event', () => {
    const room = spectatorRoom();
    room.public.players[0]!.life = 'EXITED'; room.public.players[0]!.exitOrder = 2;
    expect(successfulExit(room, 'p1')).toBeUndefined();
    room.public.events = [{ id: 'exit', sequence: 1, at: 1000, kind: 'EXIT', actorId: 'p2', targetIds: [], publicText: 'Exited' }];
    expect(successfulExit(room, 'p1')).toBeUndefined();
    room.public.events[0]!.actorId = 'p1';
    expect(successfulExit(room, 'p1')?.place).toBe('2ND');
    const html = renderToStaticMarkup(<MatchResolutionOverlays room={room} viewerId="p1" />);
    expect(html).toContain('ESCAPED · 2ND OUT'); expect(html).toContain('You left the table'); expect(html).toContain('Return to the table as a spectator');
    room.public.events[0]!.kind = 'DEATH_OBJECTIVE_BANKED'; expect(successfulExit(room, 'p1')).toBeUndefined();
  });
});

describe('source results statistics', () => {
  it('uses trusted timestamps and structured events, with no private-spending estimate', () => {
    const room = ownerRoom();
    room.public.events = [
      { id: 'start', sequence: 1, at: 1000, kind: 'MATCH_STARTED', targetIds: [], publicText: 'start' },
      { id: 'threat', sequence: 2, at: 2000, kind: 'THREAT_OFFERED', actorId: 'p1', targetIds: ['p2'], publicText: '' },
      { id: 'refuse-1', sequence: 3, at: 3000, kind: 'THREAT_REFUSED', actorId: 'p1', targetIds: ['p2'], publicText: '' },
      { id: 'down', sequence: 4, at: 4000, kind: 'DOWNED', actorId: 'p1', targetIds: ['p2'], publicText: '' },
      { id: 'refuse-2', sequence: 5, at: 4000, kind: 'THREAT_REFUSED', actorId: 'p1', targetIds: ['p2'], publicText: '' },
      { id: 'revive', sequence: 6, at: 5000, kind: 'REVIVED', actorId: 'p1', targetIds: ['p2'], publicText: '' },
      { id: 'refuse-3', sequence: 7, at: 6000, kind: 'THREAT_REFUSED', actorId: 'p1', targetIds: ['p2'], publicText: '' },
      { id: 'chest', sequence: 8, at: 7000, kind: 'CHEST_OPENED', actorId: 'p2', targetIds: [], publicText: '' },
      { id: 'buy', sequence: 9, at: 8000, kind: 'PURCHASE', actorId: 'p1', targetIds: [], publicText: 'Ada purchased an item for 999 Coins.' },
      { id: 'end', sequence: 10, at: 126999, kind: 'MATCH_ENDED', targetIds: [], publicText: 'end' },
    ].reverse();
    expect(matchResultSummary(room.public)).toEqual({ duration: '2:05', mostThreats: 'ADA · 1', coinsSpent: '—', chestsOpened: 'BRUNO · 1', refusedAndLived: 'BRUNO · 2' });
    const html = renderToStaticMarkup(<Results room={room} />);
    expect(html).toContain('2:05'); expect(html).toContain('GOLD SPENT'); expect(html).toContain('REFUSED &amp; LIVED'); expect(html).not.toContain('999');
  });
  it('does not fabricate duration or source leaders when event history is absent', () => {
    expect(matchResultSummary(ownerRoom().public)).toEqual({ duration: undefined, mostThreats: '—', coinsSpent: '—', chestsOpened: '—', refusedAndLived: '—' });
  });
});
