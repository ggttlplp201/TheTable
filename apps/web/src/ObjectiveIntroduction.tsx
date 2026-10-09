import { useEffect, useMemo, useState } from 'react';
import type { AnyRoomView, RoomView } from './protocol';
import { isSpectatorView } from './protocol';
import { PrivateDetail } from './MatchPanels';

export const OBJECTIVE_REVEAL_MS = 6000;

export function objectiveRevealKey(room: AnyRoomView, viewerId: string): string | undefined {
  if (isSpectatorView(room) || room.public.status !== 'PLAYING' || !room.private.objective || room.private.playerId !== viewerId) return undefined;
  const started = [...(room.public.events ?? [])].reverse().find(event => event.kind === 'MATCH_STARTED');
  return started && Date.now() - started.at < 30_000 ? `${room.public.id}:${started.id}:${viewerId}` : undefined;
}

export function ObjectiveIntroduction({ room, onComplete }: { room: RoomView; onComplete: () => void }) {
  const [remaining, setRemaining] = useState(OBJECTIVE_REVEAL_MS);
  const deadline = useMemo(() => Date.now() + OBJECTIVE_REVEAL_MS, []);
  useEffect(() => {
    const update = () => {
      const next = Math.max(0, deadline - Date.now());
      setRemaining(next);
      if (next === 0) onComplete();
    };
    update();
    const timer = window.setInterval(update, 100);
    return () => window.clearInterval(timer);
  }, [deadline, onComplete]);
  return <section className="objective-introduction" aria-label="Your private objective" aria-live="polite">
    <div className="objective-introduction-stage">
      <h2>Your objective</h2>
      <PrivateDetail detail={room.private} room={room.public} title="Your private objective" />
      <footer><strong>ROUND I · {Math.max(1, Math.ceil(remaining / 1000))}</strong></footer>
      <div className="objective-introduction-progress" aria-hidden="true"><i style={{ transform: `scaleX(${remaining / OBJECTIVE_REVEAL_MS})` }} /></div>
    </div>
  </section>;
}
