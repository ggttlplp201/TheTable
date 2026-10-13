import type { PublicRoomView } from '@the-table/game';

export const ORDER_REVEAL_DURATION = 7_200;
export const ROUND_INCOME_PRESENTATION_DURATION = 800;
export const ORDER_REVEAL_TIMING = {
  announceEnd: 600,
  dieEnd: 2_500,
  firstEnd: 3_300,
  coinCueEnd: 3_900,
  coinEnd: 5_800,
} as const;
export type OrderRevealPhase = 'income' | 'announce' | 'die' | 'first' | 'coin-cue' | 'coin' | 'result';
export interface OrderRevealFrame {
  key: string;
  phase: OrderRevealPhase;
  elapsed: number;
  firstName: string;
  firstPlayerId: string;
  direction: 'ASCENDING' | 'DESCENDING';
  /** Seat marker on the die, not a new random roll. */
  seatNumber: number;
  order: Array<{ id: string; name: string }>;
  income?: { amount: number; round: number };
}

/** The one server timestamp keeps viewers and reconnects on the same reveal. */
export function orderRevealFrame(room: PublicRoomView, now: number): OrderRevealFrame | undefined {
  const reveal = room.shop?.orderReveal;
  if (room.status !== 'PLAYING' || room.round?.phase !== 'INTERMISSION' || !reveal || !room.shop?.order.length) return;
  const incomeEvent = [...(room.events ?? [])].reverse().find(event => event.kind === 'ROUND_INCOME_GRANTED' && event.at === reveal.startedAt);
  const incomeAmount = incomeEvent?.presentation?.roundIncomeAmount;
  const income = incomeAmount !== undefined ? { amount: incomeAmount, round: incomeEvent?.round ?? room.round.number } : undefined;
  const elapsed = Math.max(0, now - reveal.startedAt) - (income ? ROUND_INCOME_PRESENTATION_DURATION : 0);
  if (elapsed >= ORDER_REVEAL_DURATION) return;
  const first = room.players.find(player => player.id === reveal.firstPlayerId);
  if (!first) return;
  const phase: OrderRevealPhase = elapsed < 0 ? 'income'
    : elapsed < ORDER_REVEAL_TIMING.announceEnd ? 'announce'
    : elapsed < ORDER_REVEAL_TIMING.dieEnd ? 'die'
    : elapsed < ORDER_REVEAL_TIMING.firstEnd ? 'first'
    : elapsed < ORDER_REVEAL_TIMING.coinCueEnd ? 'coin-cue'
    : elapsed < ORDER_REVEAL_TIMING.coinEnd ? 'coin'
    : 'result';
  return { key: `${room.id}:${room.round.number}:${reveal.startedAt}`, phase, elapsed, firstName: first.name, firstPlayerId: first.id, direction: reveal.direction, seatNumber: first.seat + 1,
    order: room.shop.order.map(id => ({ id, name: room.players.find(player => player.id === id)?.name ?? 'Player' })), ...(income ? { income } : {}) };
}

/** Deterministic physical poses sampled from server elapsed time; no client RNG. */
export function orderPropPose(frame: OrderRevealFrame, reducedMotion = false) {
  const dieT = Math.max(0, Math.min(1, (frame.elapsed - ORDER_REVEAL_TIMING.announceEnd) / (ORDER_REVEAL_TIMING.dieEnd - ORDER_REVEAL_TIMING.announceEnd)));
  const coinT = Math.max(0, Math.min(1, (frame.elapsed - ORDER_REVEAL_TIMING.coinCueEnd) / (ORDER_REVEAL_TIMING.coinEnd - ORDER_REVEAL_TIMING.coinCueEnd)));
  const dieMoving = !reducedMotion && frame.phase === 'die';
  const coinMoving = !reducedMotion && frame.phase === 'coin';
  return {
    dieY: 1.07 + (dieMoving ? Math.abs(Math.sin(dieT * Math.PI * 4)) * .48 * (1 - dieT) : 0),
    dieX: dieMoving ? .28 * (1 - dieT) * Math.cos(dieT * Math.PI * 2) : 0,
    dieRotation: dieMoving ? (1 - dieT) ** 2 * Math.PI * 14 : 0,
    coinY: 1.012 + (coinMoving ? Math.sin(coinT * Math.PI) * .7 : 0),
    coinRotation: (frame.elapsed >= ORDER_REVEAL_TIMING.coinCueEnd && frame.direction === 'DESCENDING' ? Math.PI : 0) + (coinMoving ? (1 - coinT) * Math.PI * 18 : 0),
  };
}
