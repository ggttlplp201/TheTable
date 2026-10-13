import { useEffect, useState } from 'react';
import type { PublicRoomView } from '@the-table/game';
/** Cosmetic only: the next player's controls are usable throughout this notice. */
export function TurnFeedback({ room }: { room: PublicRoomView }) {
  const ended = [...(room.events ?? [])].reverse().find(event => event.kind === 'TURN_ENDED');
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ended || Date.now() - ended.at > 1000) return;
    setVisible(true); const timer = window.setTimeout(() => setVisible(false), 500);
    return () => window.clearTimeout(timer);
  }, [ended?.id]);
  return visible ? <div className="turn-complete-beat" role="status"><span>TURN COMPLETE</span><b>{room.players.find(player => player.seat === room.turn?.activeSeat)?.name ?? 'ROUND COMPLETE'}</b></div> : null;
}
