import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { PendingWildcard, PublicRoomView } from '@the-table/game';
import type { ArrivalBeat, ArrivalPhase } from '@the-table/visual';
import type { TablePresentation } from './table-scene-runtime';
import type { ExitBeat } from './table-exit-presentation';
import { matchPresentationKey, publicSeats } from './table-presentation';
import { canInteractWithWildcardDeck } from './wildcard-scene';
import './table-presentation.css';

export type SceneIntent =
  | { kind: 'PLAYER'; playerId: string }
  | { kind: 'ITEM'; instanceId: string; ownerId: string; itemId: string }
  | { kind: 'CHEST'; chestKind: 'STANDARD' | 'BLACK' }
  | { kind: 'WILDCARD' }
  | { kind: 'POCKET'; ownerId: string; pocketIndex: number }
  | { kind: 'EXIT' | 'MARKET_PUBLIC' | 'MARKET_BLACK' | 'SELL' | 'EMPTY' };

export type SceneFocus = 'seat' | 'left' | 'down' | 'door';

export function GameTableScene({ tutorialFocus, onCameraTravel, room, viewerId, onArrivalBeat, onExitBeat, onArrivalStateChange, onReadyChange, onIntent, interactionsEnabled = true, exitReady = false, showOwnerMarket = false, wildcardDrawEnabled = false, ownerWildcard, focus = 'seat', focusPlayerId, selectedItemId, aimTargets = [], aimPockets = false, spyglassTargetId, spyglassActive = false, children }: {
  tutorialFocus?: string | undefined;
  room: PublicRoomView;
  onCameraTravel?: ((degrees: number) => void) | undefined;
  /** Omit for spectators; identity must come from the authorized caller. */
  viewerId?: string | undefined;
  onArrivalBeat?: ((beat: ArrivalBeat) => void) | undefined;
  onExitBeat?: ((beat: ExitBeat) => void) | undefined;
  onArrivalStateChange?: ((active: boolean) => void) | undefined;
  onIntent?: ((intent: SceneIntent) => void) | undefined;
  onReadyChange?: ((ready: boolean) => void) | undefined;
  interactionsEnabled?: boolean | undefined;
  exitReady?: boolean;
  /** Generic owner affordance only: no private offers or item identities enter the renderer. */
  showOwnerMarket?: boolean;
  /** Authoritative owner-private capability; the renderer only narrows it using public turn state. */
  wildcardDrawEnabled?: boolean;
  /** Explicit authorized owner-only card state. Spectators and other players must omit it. */
  ownerWildcard?: PendingWildcard;
  focus?: SceneFocus;
  /** Public participant to face from the viewer's seated camera position. */
  focusPlayerId?: string | undefined;
  selectedItemId?: string | undefined;
  aimTargets?: readonly string[];
  /** Public target affordance only; never carries private pocket contents. */
  aimPockets?: boolean;
  /** Authorized owner-only camera signal; never carries inspection contents. */
  spyglassTargetId?: string | undefined;
  spyglassActive?: boolean;
  children?: ReactNode;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const runtime = useRef<TablePresentation | undefined>(undefined);
  const latestRoom = useRef(room);
  const latestBeat = useRef(onArrivalBeat);
  const latestExitBeat = useRef(onExitBeat);
  const latestArrivalState = useRef(onArrivalStateChange);
  const latestIntent = useRef(onIntent);
  const latestCameraTravel = useRef(onCameraTravel); latestCameraTravel.current = onCameraTravel;
  const latestReady = useRef(onReadyChange);
  const latestPresentation = useRef({ tutorialFocus, interactionsEnabled, exitReady, wildcardDrawEnabled, ownerWildcard, focus, focusPlayerId, selectedItemId, aimTargets, aimPockets, spyglassTargetId, spyglassActive });
  const [renderFailed, setRenderFailed] = useState(false);
  const [intro, setIntro] = useState<ArrivalPhase | null>(null);
  const [canSkip, setCanSkip] = useState(false);
  latestRoom.current = room;
  latestBeat.current = onArrivalBeat;
  latestExitBeat.current = onExitBeat;
  latestArrivalState.current = onArrivalStateChange;
  latestIntent.current = onIntent;
  latestReady.current = onReadyChange;
  latestPresentation.current = { tutorialFocus, interactionsEnabled, exitReady, wildcardDrawEnabled, ownerWildcard, focus, focusPlayerId, selectedItemId, aimTargets, aimPockets, spyglassTargetId, spyglassActive };
  const rosterSignature = publicSeats(room).map(seat => `${seat.id}:${seat.role}:${seat.label}:${seat.position.join(',')}`).join('|');
  const matchKey = matchPresentationKey(room);

  useEffect(() => {
    const target = mount.current; if (!target) return;
    let cancelled = false;
    setRenderFailed(false); setIntro(null);
    void import('./table-scene-runtime').then(({ createTablePresentation }) => {
      if (cancelled) return;
      let reportedIntro = false, failed = false;
      runtime.current = createTablePresentation(target, latestRoom.current, {
        ...(viewerId === undefined ? {} : { viewerId }),
        onIntroChange: (phase, skip) => { reportedIntro = true; if (!cancelled) { setIntro(phase); setCanSkip(skip); latestArrivalState.current?.(phase !== null); } },
        onBeat: beat => latestBeat.current?.(beat),
        onExitBeat: beat => latestExitBeat.current?.(beat),
        onCameraTravel: degrees => latestCameraTravel.current?.(degrees),
        onIntent: intent => latestIntent.current?.(intent),
        ...latestPresentation.current,
        showOwnerMarket,
        onError: () => { failed = true; if (!cancelled) { setRenderFailed(true); setIntro(null); latestReady.current?.(false); } },
      });
      latestReady.current?.(!failed);
      if (!reportedIntro) latestArrivalState.current?.(false);
    }).catch(() => { if (!cancelled) { setRenderFailed(true); latestReady.current?.(false); } });
    return () => { cancelled = true; runtime.current?.dispose(); runtime.current = undefined; latestReady.current?.(false); };
  }, [room.id, matchKey, rosterSignature, viewerId, showOwnerMarket]);

  useEffect(() => { runtime.current?.update(room); }, [room]);
  useEffect(() => { runtime.current?.setInteractionsEnabled(interactionsEnabled); }, [interactionsEnabled]);
  useEffect(() => { runtime.current?.setExitReady(exitReady); }, [exitReady]);
  useEffect(() => { runtime.current?.setWildcardDrawEnabled(wildcardDrawEnabled); }, [wildcardDrawEnabled]);
  useEffect(() => { runtime.current?.setOwnerWildcard(ownerWildcard); }, [ownerWildcard]);
  useEffect(() => { runtime.current?.setTutorialFocus(tutorialFocus); }, [tutorialFocus]);
  useEffect(() => { runtime.current?.setFocus(focus, focusPlayerId); }, [focus, focusPlayerId]);
  useEffect(() => { runtime.current?.setItemSelection(selectedItemId, aimTargets, aimPockets); }, [selectedItemId, aimTargets, aimPockets]);
  useEffect(() => { runtime.current?.setSpyglass(spyglassTargetId, spyglassActive); }, [spyglassTargetId, spyglassActive]);

  const wildcardAccessible = interactionsEnabled && canInteractWithWildcardDeck(room, viewerId, wildcardDrawEnabled);
  return <div className="scene-frame table-presentation" aria-label="The Table game room">
    <div className="table-presentation-canvas" ref={mount} aria-hidden="true" />
    {children}
    {intro && canSkip && <div className="table-arrival"><button className="button table-arrival-skip" type="button" onClick={() => runtime.current?.skipIntro()}>Skip Intro</button></div>}
    {renderFailed && <div className="scene-fallback" role="status"><p>The table view is unavailable. Match state is still connected.</p>
      {wildcardAccessible && <button className="button" type="button" onClick={() => onIntent?.({ kind: 'WILDCARD' })}>Draw Wildcard</button>}
    </div>}
  </div>;
}
