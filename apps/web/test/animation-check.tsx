// Local Vite-only visual fixture. Not imported by the production entry or served by the game server.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GameTableScene, type SceneFocus } from '../src/GameTableScene';
import { InspectionRevealView, latestOwnInspection } from '../src/MatchResolutionOverlays';
import { MatchView } from '../src/MatchView';
import { ownerRoom } from '../src/test-fixtures';
import type { RoomView } from '../src/protocol';
import type { TableClient } from '../src/socket';
import '../src/styles.css';
import '../src/desktop-fidelity.css';
import '../src/audit-fixes.css';
import '../src/ui-polish.css';

function fixture(): RoomView {
  const room = ownerRoom(); room.public.id = 'animation-review'; room.public.code = 'ART4'; room.public.events = []; room.private.inspections = [];
  room.public.players = ['Ada', 'Bruno', 'Cora', 'Dima'].map((name, index) => ({ ...structuredClone(room.public.players[0]!), id: `p${index + 1}`, seat: index as 0 | 1 | 2 | 3, name, roleId: (['broker', 'medic', 'enforcer', 'locksmith'] as const)[index]!, visibleInventory: [{ itemId: 'knife', instanceId: `knife-${index}`, quantity: 1 }, null, null, null, null, null] }));
  room.public.round!.seatsOwedTurn = [0, 1, 2, 3];
  room.public.turn!.deadlineAt = Date.now() + 600_000;
  return room;
}
const client = { onVoicePeers: () => () => {}, onVoiceSignal: () => () => {}, command: async () => ({ ok: true, data: { revision: 9 } }), leaveVoice: async () => ({ ok: true, data: {} }) } as unknown as TableClient;
function AnimationCheck() {
  const [room, setRoom] = useState(fixture), [focus, setFocus] = useState<SceneFocus>('seat');
  const [viewer, setViewer] = useState('p1'), [full, setFull] = useState(true), [hold, setHold] = useState(false);
  const changeCuff = (id: string) => setRoom(current => {
    const next = structuredClone(current), player = next.public.players.find(value => value.id === id)!;
    const cuffed = player.statuses?.some(status => status.kind === 'HANDCUFFED');
    player.statuses = cuffed ? [] : [{ id: `cuff-${next.public.revision}`, kind: 'HANDCUFFED', sourcePlayerId: 'p1', remainingTurns: 1, appliedTurn: 3 }];
    next.public.events!.push({ id: `event-${next.public.revision}`, sequence: next.public.revision, kind: cuffed ? 'STATUS_EXPIRED' : 'HANDCUFFED', actorId: 'p1', targetIds: [id], at: Date.now(), publicText: 'Visual test only' });
    next.public.revision++; return next;
  });
  const peek = (itemId: string) => setRoom(current => {
    const next = structuredClone(current), eventId = `peek-${next.public.revision}`;
    next.public.events!.push({ id: eventId, sequence: next.public.revision, at: Date.now(), kind: 'POCKET_INSPECTED', actorId: 'p1', targetIds: ['p2'], publicText: 'Ada inspected a Pocket.' });
    next.private.inspections = [{ eventId, payload: { targetId: 'p2', pocketIndex: 0, ...(itemId === 'protected' ? { blocked: true } : { item: itemId === 'empty' ? null : { itemId, quantity: itemId === 'bullet' ? 3 : 1 } }) } }];
    next.public.revision++; return next;
  });
  const reveal = latestOwnInspection(room, viewer);
  return <>
    {full ? <main className="app-shell"><MatchView room={room} viewerId="p1" client={client} connected voice={{ enabled: false, iceServers: [], relayConfigured: false }} onView={() => {}} /></main>
      : <main className={`match-layout match-viewport${hold ? ' inspection-still' : ''}`}><div className="match-scene-shell"><GameTableScene room={room.public} viewerId={viewer === 'spectator' ? undefined : viewer} focus={focus} /></div>{hold && reveal && <InspectionRevealView inspection={reveal} />}</main>}
    <aside style={{ position: 'fixed', top: 70, right: 8, zIndex: 150, background: '#14100eee', padding: 8, display: 'grid', gap: 4, font: '15px monospace', maxWidth: 190 }}>
      <strong>LOCAL VISUAL FIXTURE</strong>
      <button onClick={() => setFull(value => !value)}>{full ? 'Scene only' : 'Full match HUD'}</button>
      <button onClick={() => changeCuff('p1')}>Toggle own cuff</button>
      <button onClick={() => changeCuff('p2')}>Toggle left cuff</button>
      <button onClick={() => changeCuff('p3')}>Toggle far cuff</button>
      <button onClick={() => changeCuff('p4')}>Toggle right cuff</button>
      <select aria-label="Viewer" value={viewer} onChange={event => setViewer(event.target.value)}>{['p1', 'p2', 'p3', 'p4', 'spectator'].map(value => <option key={value}>{value}</option>)}</select>
      <select aria-label="Camera" value={focus} onChange={event => setFocus(event.target.value as SceneFocus)}>{['seat', 'left', 'down', 'door'].map(value => <option key={value}>{value}</option>)}</select>
      <button onClick={() => { setFull(false); setHold(value => !value); }}>Hold private reveal</button>
      {['knife', 'poison', 'bullet', 'empty', 'protected'].map(id => <button key={id} onClick={() => peek(id)}>Peek {id}</button>)}
      <button onClick={() => { setRoom(fixture()); setHold(false); }}>Reset fixture</button>
    </aside>
    <style>{`.inspection-still .scene-inspection-focus, .inspection-still .scene-spyglass-aperture { animation:none!important; opacity:1!important; transform:none!important }`}</style>
  </>;
}
createRoot(document.getElementById('root')!).render(<AnimationCheck />);
