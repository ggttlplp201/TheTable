import { useEffect, useRef, useState } from 'react';
import type { AnyRoomView } from './protocol';
import { isSpectatorView } from './protocol';
import { itemName, playerName } from './gameplay';
import { ReferenceItemArt } from './ReferenceItemArt';
import './resolution-overlays.css';

export type InspectionPocket =
  | { kind: 'item'; label: string; itemId: string; quantity: number }
  | { kind: 'empty'; label: string }
  | { kind: 'protected'; label: string }
  | { kind: 'unknown'; label: string };

export interface InspectionReveal {
  eventId: string;
  title: string;
  text: string;
  aperture: boolean;
  pocket?: InspectionPocket;
}

export interface ThreatResolutionReveal {
  eventId: string;
  heading: string;
  detail: string;
  itemId?: string;
}

export interface SpawnAnnouncement { eventId: string; heading: string; detail: string }

const record = (value: unknown): Record<string, unknown> | undefined => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;

export function latestThreatResolution(room: AnyRoomView, viewerId: string): ThreatResolutionReveal | undefined {
  const event = [...(room.public.events ?? [])].reverse().find(entry => ['THREAT_COMPLIED', 'THREAT_REFUSED', 'THREAT_CANCELLED'].includes(entry.kind) && (entry.actorId === viewerId || entry.targetIds.includes(viewerId)));
  if (!event || !event.actorId) return;
  const actor = playerName(room.public, event.actorId).toUpperCase();
  const target = playerName(room.public, event.targetIds[0]).toUpperCase();
  const owner = event.actorId === viewerId;
  const outcome = event.presentation?.threatOutcome ?? (event.kind === 'THREAT_COMPLIED' ? 'COMPLIED' : event.kind === 'THREAT_CANCELLED' ? 'CANCELLED' : undefined);
  const heading = outcome === 'COMPLIED' ? 'THREAT SUCCEEDED'
    : outcome === 'REFUSED_VALID' ? owner ? 'THREAT VALID · TARGET REFUSED' : 'YOU REFUSED · THREAT WAS REAL'
    : outcome === 'BLUFF_CALLED' ? owner ? 'THREAT FAILED · BLUFF CALLED' : 'BLUFF CALLED · THREAT FAILED'
    : outcome === 'CANCELLED' ? 'THREAT CANCELLED' : 'THREAT RESOLVED';
  const detail = outcome === 'COMPLIED' ? `${target} COMPLIED WITH ${actor}`
    : outcome === 'REFUSED_VALID' ? `${target} REFUSED ${actor} · THE WEAPON TRIGGERED`
    : outcome === 'BLUFF_CALLED' ? `${target} CALLED ${actor}’S BLUFF · NO ATTACK`
    : event.publicText.toUpperCase();
  return { eventId: event.id, heading, detail, ...(event.presentation?.itemId ? { itemId: event.presentation.itemId } : {}) };
}

export function latestSpawnAnnouncement(room: AnyRoomView): SpawnAnnouncement | undefined {
  const candidates = (room.public.events ?? []).filter(entry => entry.kind === 'WILDCARD_DECK_UNLOCKED' || (entry.kind === 'CHEST_REFRESHED' && entry.presentation?.chestKind === 'BLACK'));
  const event = candidates.at(-1);
  if (!event) return;
  const paired = candidates.find(candidate => candidate.id !== event.id && candidate.at === event.at);
  if (paired) return { eventId: `${paired.id}:${event.id}`, heading: 'BLACK CHEST + WILDCARDS HAVE ENTERED PLAY', detail: 'The Black Chest needs a Black Key. Draw Wildcard is now available on eligible turns and spends a Primary Action.' };
  return event.kind === 'WILDCARD_DECK_UNLOCKED'
    ? { eventId: event.id, heading: 'WILDCARDS HAVE ENTERED PLAY', detail: 'A DRAW WILDCARD action is now available on eligible turns.' }
    : { eventId: event.id, heading: 'THE BLACK CHEST HAS APPEARED', detail: 'A Black Key opens it as a Primary Action.' };
}

/** Never derive an inspection from another player's inventory or spectator god view. */
export function latestOwnInspection(room: AnyRoomView, viewerId: string): InspectionReveal | undefined {
  if (isSpectatorView(room) || room.private.playerId !== viewerId) return;
  const events = new Map((room.public.events ?? []).map(event => [event.id, event]));
  for (const inspection of [...(room.private.inspections ?? [])].reverse()) {
    const event = events.get(inspection.eventId), payload = record(inspection.payload);
    if (!event || event.actorId !== viewerId || !payload) continue;
    if (event.kind === 'CHEST_INSPECTED' && typeof payload.artifact === 'boolean' && typeof payload.rare === 'boolean') {
      return { eventId: event.id, title: '◐ TUMBLER SENSE · ONLY YOU SEE THIS', text: `ARTIFACT INSIDE? ${payload.artifact ? 'YES' : 'NO'} · RARE REGULAR ITEM INSIDE? ${payload.rare ? 'YES' : 'NO'}`, aperture: false };
    }
    if (event.kind !== 'POCKET_INSPECTED' || typeof payload.targetId !== 'string' || !event.targetIds.includes(payload.targetId) || !Number.isInteger(payload.pocketIndex) || (payload.pocketIndex as number) < 0) continue;
    const pocket = `${playerName(room.public, payload.targetId).toUpperCase()}’S POCKET ${(payload.pocketIndex as number) + 1}`;
    if (payload.blocked === true) return { eventId: event.id, title: '◐ POCKET INSPECTION · ONLY YOU SEE THIS', text: `${pocket} · SAFE-PROTECTED`, aperture: false, pocket: { kind: 'protected', label: pocket } };
    if (typeof payload.weapon === 'boolean') return { eventId: event.id, title: '◐ GLASS EYE · ONLY YOU SEE THIS', text: `${pocket} · WEAPON ${payload.weapon ? 'YES' : 'NO'}`, aperture: false };
    if (payload.item === null) return { eventId: event.id, title: '◐ SPYGLASS · ONLY YOU SEE THIS', text: `${pocket} · EMPTY`, aperture: true, pocket: { kind: 'empty', label: pocket } };
    const item = record(payload.item);
    if (typeof item?.itemId === 'string') {
      const quantity = Number.isInteger(item.quantity) && (item.quantity as number) > 0 ? item.quantity as number : 1;
      return { eventId: event.id, title: '◐ SPYGLASS · ONLY YOU SEE THIS', text: `${pocket} · ${itemName(item.itemId).toUpperCase()}${quantity > 1 ? ` ×${quantity}` : ''}`, aperture: true, pocket: { kind: 'item', label: pocket, itemId: item.itemId, quantity } };
    }
    return { eventId: event.id, title: '◐ POCKET INSPECTION · ONLY YOU SEE THIS', text: `${pocket} · RESULT UNAVAILABLE`, aperture: false, pocket: { kind: 'unknown', label: pocket } };
  }
}

export function successfulExit(room: AnyRoomView, viewerId: string) {
  const player = room.public.players.find(player => player.id === viewerId);
  const event = [...(room.public.events ?? [])].reverse().find(event => event.kind === 'EXIT' && event.actorId === viewerId);
  if (player?.life !== 'EXITED' || !event || player.exitOrder === undefined) return;
  const suffix = player.exitOrder === 1 ? 'ST' : player.exitOrder === 2 ? 'ND' : player.exitOrder === 3 ? 'RD' : 'TH';
  return { eventId: event.id, place: `${player.exitOrder}${suffix}`, score: player.score };
}

function canvasHasImage(canvas: HTMLCanvasElement) {
  const pixels = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height).data;
  if (!pixels) return false;
  for (let index = 3; index < pixels.length; index += 4) if (pixels[index]) return true;
  return false;
}

function PrivateRotatingItem({ itemId }: { itemId: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let disposed = false;
    let detach: (() => void) | undefined;
    void import('./handbook-item-renderer')
      .then(({ attachHandbookItem }) => {
        const target = canvas.current;
        if (disposed || !target) return;
        detach = attachHandbookItem(target, itemId);
        if (canvasHasImage(target)) target.dataset.modelReady = 'true';
      })
      .catch(() => { /* Static art and the item label remain when WebGL is unavailable. */ });
    return () => { disposed = true; detach?.(); };
  }, [itemId]);
  return <canvas ref={canvas} width="148" height="148" data-item-model={itemId} aria-hidden="true" />;
}

function PocketContents({ pocket }: { pocket: InspectionPocket }) {
  if (pocket.kind === 'item') {
    const name = itemName(pocket.itemId).toUpperCase();
    return <div className="scene-pocket-item" aria-label={`${name}${pocket.quantity > 1 ? `, quantity ${pocket.quantity}` : ''}`}>
      <span className="scene-pocket-item-fallback" aria-hidden="true">{name}</span>
      <ReferenceItemArt itemId={pocket.itemId} size={148} className="scene-pocket-item-art" label="" />
      <span className="scene-pocket-item-model" aria-hidden="true"><PrivateRotatingItem itemId={pocket.itemId} /></span>
      {pocket.quantity > 1 && <b className="scene-pocket-quantity" aria-hidden="true">×{pocket.quantity}</b>}
    </div>;
  }
  const state = pocket.kind === 'empty' ? 'EMPTY' : pocket.kind === 'protected' ? 'SAFE-PROTECTED' : 'RESULT UNAVAILABLE';
  const symbol = pocket.kind === 'empty' ? '◇' : pocket.kind === 'protected' ? '▣' : '?';
  return <div className={`scene-pocket-state ${pocket.kind}`} aria-label={state}><span aria-hidden="true">{symbol}</span><strong>{state}</strong></div>;
}

/** A visual echo of the inspected Pocket. Its contents come only from the private event snapshot above. */
export function PrivatePocketReveal({ pocket }: { pocket: InspectionPocket }) {
  return <figure className={`scene-inspected-pocket ${pocket.kind}`}>
    <figcaption>{pocket.label}</figcaption>
    <div className="scene-pocket-shell"><span className="scene-pocket-clasp" aria-hidden="true" /><PocketContents pocket={pocket} /></div>
  </figure>;
}

export function InspectionRevealView({ inspection }: { inspection: InspectionReveal }) {
  return <div className={`scene-private-inspection${inspection.aperture ? ' spyglass' : ''}`}>
    {inspection.aperture && <div className="scene-spyglass-aperture" aria-hidden="true" />}
    <div className="scene-inspection-focus">
      {inspection.pocket && <PrivatePocketReveal pocket={inspection.pocket} />}
      <div className="scene-inspection-reveal" role="status"><span>{inspection.title}</span><strong>{inspection.text}</strong></div>
    </div>
  </div>;
}

export function ThreatResolutionView({ result }: { result: ThreatResolutionReveal }) {
  return <section className="threat-result-reveal" role="status" aria-live="assertive" aria-label="Threat result">
    {result.itemId && <div className="threat-cloth-reveal" aria-label={`The covered item was ${itemName(result.itemId)}`}><ReferenceItemArt itemId={result.itemId} size={132} label="" /><span aria-hidden="true" /></div>}
    <strong>{result.heading}</strong><p>{result.detail}</p>
    {result.itemId && <small>UNDER THE CLOTH · {itemName(result.itemId).toUpperCase()}</small>}
  </section>;
}

export function PrivateInspectionHistory({ room, viewerId }: { room: AnyRoomView; viewerId: string }) {
  if (isSpectatorView(room) || room.private.playerId !== viewerId) return null;
  const inspections = (room.private.inspections ?? []).flatMap(inspection => {
    const result = latestOwnInspection({ ...room, private: { ...room.private, inspections: [inspection] } }, viewerId);
    return result ? [result] : [];
  });
  if (!inspections.length) return null;
  return <details className="scene-inspection-history"><summary>◐ PRIVATE INSPECTIONS · {inspections.length}</summary>{[...inspections].reverse().map(inspection => <p key={inspection.eventId}><span>{inspection.title}</span><strong>{inspection.text}</strong></p>)}</details>;
}

/** Transient presentation only. Dismissal never sends a gameplay command. */
export function MatchResolutionOverlays({ room, viewerId }: { room: AnyRoomView; viewerId: string }) {
  const latest = latestOwnInspection(room, viewerId);
  const observed = useRef(latest?.eventId);
  const identity = `${room.public.id}:${viewerId}`;
  const previousIdentity = useRef(identity);
  const [inspection, setInspection] = useState<{ identity: string; reveal: InspectionReveal }>();
  const exit = successfulExit(room, viewerId);
  const [dismissedExit, setDismissedExit] = useState<string>();
  const exitButton = useRef<HTMLButtonElement>(null);
  const latestThreat = latestThreatResolution(room, viewerId);
  const observedThreat = useRef(latestThreat?.eventId);
  const [threat, setThreat] = useState<ThreatResolutionReveal>();
  const latestSpawn = latestSpawnAnnouncement(room);
  const observedSpawn = useRef(latestSpawn?.eventId);
  const [spawn, setSpawn] = useState<SpawnAnnouncement>();

  useEffect(() => {
    observedThreat.current = latestThreat?.eventId;
    observedSpawn.current = latestSpawn?.eventId;
    setThreat(undefined);
    setSpawn(undefined);
  }, [identity]);

  useEffect(() => {
    if (previousIdentity.current !== identity) {
      previousIdentity.current = identity; observed.current = latest?.eventId; setInspection(undefined); return;
    }
    if (!latest || latest.eventId === observed.current) return;
    observed.current = latest.eventId;
    setInspection({ identity, reveal: latest });
    const timer = window.setTimeout(() => setInspection(undefined), latest.aperture ? 3500 : 5000);
    return () => window.clearTimeout(timer);
  }, [identity, latest?.eventId]);

  useEffect(() => { if (exit && exit.eventId !== dismissedExit) exitButton.current?.focus({ preventScroll: true }); }, [exit?.eventId, dismissedExit]);
  useEffect(() => {
    if (!latestThreat || latestThreat.eventId === observedThreat.current) return;
    observedThreat.current = latestThreat.eventId; setThreat(latestThreat);
    const timer = window.setTimeout(() => setThreat(undefined), 4800);
    return () => window.clearTimeout(timer);
  }, [latestThreat?.eventId]);
  useEffect(() => {
    if (!latestSpawn || latestSpawn.eventId === observedSpawn.current) return;
    observedSpawn.current = latestSpawn.eventId; setSpawn(latestSpawn);
    const timer = window.setTimeout(() => setSpawn(undefined), 5000);
    return () => window.clearTimeout(timer);
  }, [latestSpawn?.eventId]);
  return <>
    {!isSpectatorView(room) && room.public.status !== 'RESULTS' && inspection?.identity === identity && <InspectionRevealView key={inspection.reveal.eventId} inspection={inspection.reveal} />}
    {room.public.status !== 'RESULTS' && threat && <ThreatResolutionView key={threat.eventId} result={threat} />}
    {room.public.status !== 'RESULTS' && spawn && <aside className="table-spawn-announcement" role="status" aria-live="polite"><strong>{spawn.heading}</strong><span>{spawn.detail}</span></aside>}
    {exit && exit.eventId !== dismissedExit && <section className="scene-exit-confirmation" role="dialog" aria-modal="true" aria-label="You left the table">
      <button ref={exitButton} type="button" aria-label="Return to the table as a spectator" onClick={() => setDismissedExit(exit.eventId)} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); setDismissedExit(exit.eventId); } }}>
        <span>{exit.place} OUT</span><strong>You left the table</strong><small>Score locked · contract revealed · click to watch</small>
      </button>
    </section>}
  </>;
}
