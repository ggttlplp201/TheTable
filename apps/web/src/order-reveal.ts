import type { PublicRoomView } from '@the-table/game';

export const ORDER_REVEAL_DURATION = 2_800;
export type OrderRevealPhase = 'announce' | 'die' | 'first' | 'coin-cue' | 'coin' | 'result';
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
}

/** The one server timestamp keeps viewers and reconnects on the same reveal. */
export function orderRevealFrame(room: PublicRoomView, now: number): OrderRevealFrame | undefined {
  const reveal = room.shop?.orderReveal;
  if (room.status !== 'PLAYING' || room.round?.phase !== 'INTERMISSION' || !reveal || !room.shop?.order.length) return;
  const elapsed = Math.max(0, now - reveal.startedAt);
  if (elapsed >= ORDER_REVEAL_DURATION) return;
  const first = room.players.find(player => player.id === reveal.firstPlayerId);
  if (!first) return;
  const phase: OrderRevealPhase = elapsed < 150 ? 'announce' : elapsed < 900 ? 'die' : elapsed < 1050 ? 'first' : elapsed < 1200 ? 'coin-cue' : elapsed < 1950 ? 'coin' : 'result';
  return { key: `${room.id}:${room.round.number}:${reveal.startedAt}`, phase, elapsed, firstName: first.name, firstPlayerId: first.id, direction: reveal.direction, seatNumber: first.seat + 1,
    order: room.shop.order.map(id => ({ id, name: room.players.find(player => player.id === id)?.name ?? 'Player' })) };
}

/** Deterministic physical poses sampled from server elapsed time; no client RNG. */
export function orderPropPose(frame: OrderRevealFrame, reducedMotion = false) {
  const dieT = Math.max(0, Math.min(1, (frame.elapsed - 150) / 750));
  const coinT = Math.max(0, Math.min(1, (frame.elapsed - 1200) / 750));
  const dieMoving = !reducedMotion && frame.phase === 'die';
  const coinMoving = !reducedMotion && frame.phase === 'coin';
  return {
    dieY: 1.07 + (dieMoving ? Math.abs(Math.sin(dieT * Math.PI * 3)) * .48 * (1 - dieT) : 0),
    dieX: dieMoving ? .26 * (1 - dieT) : 0,
    dieRotation: dieMoving ? (1 - dieT) ** 2 * Math.PI * 10 : 0,
    coinY: 1.012 + (coinMoving ? Math.sin(coinT * Math.PI) * .7 : 0),
    coinRotation: (frame.elapsed >= 1200 && frame.direction === 'DESCENDING' ? Math.PI : 0) + (coinMoving ? (1 - coinT) * Math.PI * 12 : 0),
  };
}
