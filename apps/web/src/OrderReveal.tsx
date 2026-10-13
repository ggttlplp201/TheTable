import { useEffect, useRef, useState } from 'react';
import type { PublicRoomView } from '@the-table/game';
import { AUDIO_CUE_IDS, type AudioCueId } from '@the-table/audio';
import { orderRevealFrame, type OrderRevealFrame } from './order-reveal';
import './order-reveal.css';

/** Low-frequency text updates; the renderer samples prop motion independently. */
export function useOrderReveal(room: PublicRoomView, play?: (cue: AudioCueId) => void) {
  const [now, setNow] = useState(Date.now);
  const [desktop, setDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 801px)').matches);
  const latestPlay = useRef(play); latestPlay.current = play;
  const frame = desktop ? orderRevealFrame(room, now) : undefined;
  const soundKey = useRef('');
  useEffect(() => {
    const query = window.matchMedia('(min-width: 801px)');
    const update = () => setDesktop(query.matches);
    query.addEventListener('change', update); return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    setNow(Date.now());
    if (!desktop || !orderRevealFrame(room, Date.now())) return;
    const timer = window.setInterval(() => {
      const next = Date.now(); setNow(next);
      if (!orderRevealFrame(room, next)) window.clearInterval(timer);
    }, 100);
    return () => window.clearInterval(timer);
  }, [desktop, room.id, room.shop?.orderReveal?.startedAt, room.round?.phase]);
  useEffect(() => {
    if (!frame) return;
    const key = `${frame.key}:${frame.phase}`;
    if (soundKey.current === key) return;
    soundKey.current = key;
    if (document.visibilityState === 'hidden') return;
    if (frame.phase === 'income') latestPlay.current?.(AUDIO_CUE_IDS.uiCoins);
    if (frame.phase === 'die') latestPlay.current?.(AUDIO_CUE_IDS.tableSettle);
    if (frame.phase === 'coin') latestPlay.current?.(AUDIO_CUE_IDS.coinScatter);
    if (frame.phase === 'result') latestPlay.current?.(AUDIO_CUE_IDS.uiConfirm);
  }, [frame?.key, frame?.phase]);
  return frame;
}

export function OrderReveal({ frame, viewerId }: { frame: OrderRevealFrame; viewerId?: string | undefined }) {
  if (frame.phase === 'income' && frame.income) return <section className="order-reveal round-income-reveal" aria-label="Round Income" data-order-phase="income" data-order-key={frame.key}>
    <div className="order-reveal-heading" role="status"><span>ROUND {frame.income.round} COMPLETE</span><h2>ROUND INCOME</h2><strong>+{frame.income.amount} GOLD TO EVERY ACTIVE PLAYER</strong></div>
  </section>;
  const position = frame.order.findIndex(player => player.id === viewerId);
  const result = frame.phase === 'result';
  const title = frame.phase === 'announce' || frame.phase === 'die' ? 'Turns over. Rolling the die to decide who shops first.'
    : frame.phase === 'first' ? `${frame.firstName} gets to shop first.`
    : frame.phase === 'coin-cue' || frame.phase === 'coin' ? 'Flipping the coin to decide shopping direction.'
    : `${frame.firstName} gets to go first.`;
  return <section className="order-reveal" aria-label="Shopping order reveal" data-order-phase={frame.phase} data-order-key={frame.key}>
    <div className="order-reveal-heading" role="status" aria-live="polite"><span>ROUND OVER · SHOPPING ORDER</span><h2>{title}</h2></div>
    {(frame.phase === 'first' || result) && <div className="order-reveal-first">SEAT {frame.seatNumber} · {frame.firstName}</div>}
    {result && <div className="order-reveal-result"><p>{frame.direction === 'ASCENDING' ? 'HEADS · ASCENDING SEATS' : 'TAILS · DESCENDING SEATS'}</p><ol>{frame.order.map(player => <li key={player.id} className={player.id === viewerId ? 'is-you' : ''}>{player.name}</li>)}</ol><strong>{position >= 0 ? `YOUR TURN = ${position + 1}` : viewerId ? 'YOU ARE NOT SHOPPING THIS ROUND' : 'SHOPPING ORDER SET'}</strong></div>}
  </section>;
}
