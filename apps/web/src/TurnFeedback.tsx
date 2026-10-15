import { useEffect, useState } from 'react';
import type { PublicRoomView } from '@the-table/game';
/** Cosmetic only: the next player's controls are usable throughout this notice. */
export function TurnFeedback({ room }: { room: PublicRoomView }) {
  const ended = [...(room.events ?? [])].reverse().find(event => event.kind === 'TURN_ENDED');
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const age = ended ? Math.max(0, Date.now() - ended.at) : 500;
    if (!ended || age >= 500) { setVisible(false); return; }
    setVisible(true); const timer = window.setTimeout(() => setVisible(false), 500 - age);
    return () => window.clearTimeout(timer);
  }, [ended?.id]);
  const next = room.players.find(player => player.seat === room.turn?.activeSeat);
  return visible ? <div key={ended?.id} className="turn-complete-beat" role="status"><span>TURN COMPLETE</span><b>{next ? `${next.name}’S TURN` : 'ROUND COMPLETE'}</b></div> : null;
}
