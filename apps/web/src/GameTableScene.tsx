import { useEffect, useRef, useState } from 'react';
import type { PublicRoomView } from '@the-table/game';
import type { ArrivalBeat, ArrivalPhase } from '@the-table/visual';
import type { TablePresentation } from './table-scene-runtime';
import { matchPresentationKey, publicSeats } from './table-presentation';
import './table-presentation.css';

export type SceneIntent =
  | { kind: 'PLAYER'; playerId: string }
  | { kind: 'ITEM'; instanceId: string; ownerId: string; itemId: string }
  | { kind: 'CHEST'; chestKind: 'STANDARD' | 'BLACK' }
  | { kind: 'EXIT' };

const PHASE_LABELS: Record<ArrivalPhase, string> = {
  approach: 'Take your place.', chair: 'Pull up a chair.', sit: 'Take a seat.',
  settle: 'Settle in.', look: 'Read the room.', overview: 'The table is yours.',
};

export function GameTableScene({ room, viewerId, onArrivalBeat, onIntent, interactionsEnabled = true }: {
  room: PublicRoomView;
  /** Omit for spectators; identity must come from the authorized caller. */
  viewerId?: string | undefined;
  onArrivalBeat?: ((beat: ArrivalBeat) => void) | undefined;
  onIntent?: ((intent: SceneIntent) => void) | undefined;
  interactionsEnabled?: boolean | undefined;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const runtime = useRef<TablePresentation | undefined>(undefined);
  const latestRoom = useRef(room);
  const latestBeat = useRef(onArrivalBeat);
  const latestIntent = useRef(onIntent);
  const [renderFailed, setRenderFailed] = useState(false);
  const [intro, setIntro] = useState<ArrivalPhase | null>(null);
  const [canSkip, setCanSkip] = useState(false);
  latestRoom.current = room;
  latestBeat.current = onArrivalBeat;
  latestIntent.current = onIntent;
  const rosterSignature = publicSeats(room).map(seat => `${seat.id}:${seat.role}:${seat.label}:${seat.position.join(',')}`).join('|');
  const matchKey = matchPresentationKey(room);

  useEffect(() => {
    const target = mount.current; if (!target) return;
    let cancelled = false;
    setRenderFailed(false); setIntro(null);
    void import('./table-scene-runtime').then(({ createTablePresentation }) => {
      if (cancelled) return;
      runtime.current = createTablePresentation(target, latestRoom.current, {
        ...(viewerId === undefined ? {} : { viewerId }),
        onIntroChange: (phase, skip) => { if (!cancelled) { setIntro(phase); setCanSkip(skip); } },
        onBeat: beat => latestBeat.current?.(beat),
        onIntent: intent => latestIntent.current?.(intent),
        interactionsEnabled,
        onError: () => { if (!cancelled) { setRenderFailed(true); setIntro(null); } },
      });
    }).catch(() => { if (!cancelled) setRenderFailed(true); });
    return () => { cancelled = true; runtime.current?.dispose(); runtime.current = undefined; };
  }, [room.id, matchKey, rosterSignature, viewerId]);

  useEffect(() => { runtime.current?.update(room); }, [room]);
  useEffect(() => { runtime.current?.setInteractionsEnabled(interactionsEnabled); }, [interactionsEnabled]);

  return <div className="scene-frame table-presentation" aria-label="The Table game room">
    <div className="table-presentation-canvas" ref={mount} aria-hidden="true" />
    {intro && <div className="table-arrival">
      <div className="table-arrival-copy"><span className="eyebrow">Your seat awaits</span><p>{PHASE_LABELS[intro]}</p></div>
      {canSkip && <button className="button table-arrival-skip" type="button" onClick={() => runtime.current?.skipIntro()}>Skip Intro</button>}
      <span className="table-arrival-live">The match is live. Your controls are ready.</span>
    </div>}
    {renderFailed && <p className="scene-fallback" role="status">The table view is unavailable. Match state is still connected.</p>}
  </div>;
}
