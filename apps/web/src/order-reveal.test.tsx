import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ownerRoom } from './test-fixtures';
import { ORDER_REVEAL_DURATION, ROUND_INCOME_PRESENTATION_DURATION, orderPropPose, orderRevealFrame } from './order-reveal';
import { OrderReveal } from './OrderReveal';

function intermission() {
  const room = ownerRoom().public;
  room.round!.phase = 'INTERMISSION';
  room.shop = { id: 'intermission-1', phase: 'PREP', prepDeadlineAt: 16000, privateUnlockedBy: {}, finishedBy: {}, order: ['p2', 'p1'], publicOffers: [], publicPurchasedBy: {}, activeShopperIndex: 0,
    orderReveal: { startedAt: 1000, firstPlayerId: 'p2', direction: 'DESCENDING', eligiblePlayerIds: ['p1', 'p2'], selectedIndex: 1 } };
  return room;
}

describe('authoritative shopping order presentation', () => {
  it('presents paid Round Income before die/coin using the existing shared timestamp', () => {
    const room = intermission();
    room.events = [{ id: 'income', at: 1000, sequence: 1, kind: 'ROUND_INCOME_GRANTED', targetIds: ['p1', 'p2'], publicText: 'Round Income: all active players received 2 Coins.', presentation: { roundIncomeAmount: 2 } }];
    const income = orderRevealFrame(room, 1100)!;
    expect(income.phase).toBe('income');
    const html = renderToStaticMarkup(<OrderReveal frame={income} viewerId="p1" />);
    expect(html).toContain('ROUND 2 COMPLETE');
    expect(html).toContain('+2 GOLD TO EVERY ACTIVE PLAYER');
    expect(html).not.toContain('Rolling the die');
    expect(orderRevealFrame(room, 1000 + ROUND_INCOME_PRESENTATION_DURATION)?.phase).toBe('announce');
    expect(orderRevealFrame(room, 1000 + ROUND_INCOME_PRESENTATION_DURATION + 600)?.phase).toBe('die');
    expect(orderRevealFrame(room, 1000 + ROUND_INCOME_PRESENTATION_DURATION + ORDER_REVEAL_DURATION)).toBeUndefined();
    expect(orderRevealFrame({ ...room, revision: 99 }, 1100)).toEqual(income);
    room.events[0]!.at = 0;
    expect(orderRevealFrame(room, 1100)?.phase).toBe('announce');
  });
  it('shares the same phase and outcome across viewers, reconnects and revisions', () => {
    const room = intermission();
    for (const [elapsed, phase] of [[0, 'announce'], [600, 'die'], [2500, 'first'], [3300, 'coin-cue'], [3900, 'coin'], [5800, 'result']] as const) {
      const frame = orderRevealFrame(room, 1000 + elapsed)!;
      expect(frame.phase).toBe(phase);
      expect(frame.firstPlayerId).toBe(room.shop!.order[0]);
      expect(orderRevealFrame({ ...room, revision: room.revision + 8 }, 1000 + elapsed)).toEqual(frame);
    }
    expect(orderRevealFrame(room, 1000 + ORDER_REVEAL_DURATION)).toBeUndefined();
  });
  it('shows each owner their real ordinal and keeps private information out', () => {
    const frame = orderRevealFrame(intermission(), 7000)!;
    const first = renderToStaticMarkup(<OrderReveal frame={frame} viewerId="p2" />);
    const second = renderToStaticMarkup(<OrderReveal frame={frame} viewerId="p1" />);
    expect(first).toContain('Bruno gets to go first.');
    expect(first).toContain('YOUR TURN = 1'); expect(second).toContain('YOUR TURN = 2');
    expect(second).toContain('TAILS · DESCENDING SEATS');
    expect(second).not.toContain('arsenal'); expect(second).not.toContain('owner-secret');
    expect(renderToStaticMarkup(<OrderReveal frame={frame} />)).not.toContain('YOUR TURN');
    expect(renderToStaticMarkup(<OrderReveal frame={frame} viewerId="downed" />)).toContain('YOU ARE NOT SHOPPING');
  });
  it('never reconstructs a direction from two-player order or invents metadata', () => {
    const room = intermission();
    const descending = orderRevealFrame(room, 7000)!;
    room.shop!.orderReveal!.direction = 'ASCENDING';
    const ascending = orderRevealFrame(room, 7000)!;
    expect(ascending.order).toEqual(descending.order);
    expect(ascending.direction).not.toBe(descending.direction);
    delete room.shop!.orderReveal;
    expect(orderRevealFrame(room, 1000)).toBeUndefined();
  });
  it('has deterministic motion, landed outcomes and reduced-motion static poses', () => {
    const room = intermission();
    const die = orderRevealFrame(room, 2200)!;
    expect(orderPropPose(die)).toEqual(orderPropPose(die));
    expect(orderPropPose(die).dieY).toBeGreaterThan(1.07);
    expect(orderPropPose(die, true).dieRotation).toBe(0);
    const coin = orderRevealFrame(room, 5600)!;
    expect(orderPropPose(coin).coinY).toBeGreaterThan(1.012);
    expect(orderPropPose(coin, true).coinRotation).toBe(Math.PI);
    const settled = orderRevealFrame(room, 7000)!;
    expect(orderPropPose(settled).coinY).toBe(1.012);
    expect(orderPropPose(settled).dieRotation).toBe(0);
    room.round!.phase = 'TURN'; expect(orderRevealFrame(room, 11000)).toBeUndefined();
  });
});
