import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { AUDIO_CUE_IDS, createAudioEngine, type AudioEngine } from '@the-table/audio';
import type { ArrivalBeat } from '@the-table/visual';
import type { AnyRoomView, ClientError, PlayerCommand, VoiceCapability } from './protocol';
import { isSpectatorView, ROLE_COPY } from './protocol';
import type { TableClient } from './socket';
import { dispatchRequest, type ActionRequest } from './action-request';
import { canRematch, commandEnvelope, hasCapability, ownItems, playerName, presentItems, stackName, words } from './gameplay';
import { GameTableScene, type SceneIntent } from './GameTableScene';
import { ChestPanel, EventLog, MatchHeader, OverflowDecision, PendingInteraction, PlayerRoster, PrivateDetail, Results, SpectatorDetails } from './MatchPanels';
import { DownedForm, Markets, ReadOnlyPublicShop, ThreatForm, TradeForm, TurnActions, UseItemForm } from './ActionForms';
import { VoicePanel } from './VoicePanel';

/** Keep an uncertain submission intact until it can be retried with the same receipt key. */
export function playAcceptedActionAudio(engine: Pick<AudioEngine, 'play' | 'playItem'>, room: AnyRoomView, request: ActionRequest): void {
  if (request.kind === 'chat') { engine.play(AUDIO_CUE_IDS.uiConfirm); return; }
  if (request.kind === 'rematch') { engine.play(AUDIO_CUE_IDS.lobbyMatch); return; }
  const command = { type: request.payload.type, ...request.payload.payload } as PlayerCommand;
  if (isSpectatorView(room)) return;
  const own = ownItems(room);
  const publicItems = room.public.players.flatMap(player => presentItems(player.visibleInventory));
  const itemId = (instanceId: string) => own.find(item => item.instanceId === instanceId)?.itemId ?? publicItems.find(item => item.instanceId === instanceId)?.itemId;
  const playInstance = (instanceId: string) => { const id = itemId(instanceId); if (id) engine.playItem(id); };
  switch (command.type) {
    case 'USE_ITEM':
      playInstance(command.instanceId);
      if (itemId(command.instanceId) === 'pistol' && own.some(item => item.itemId === 'bullet')) engine.playItem('bullet');
      return;
    case 'POCKET': engine.play(AUDIO_CUE_IDS.uiPocket); playInstance(command.instanceId); return;
    case 'ASSIGN_SAFE': engine.playItem('safe'); return;
    case 'BUY': {
      const offers = command.market === 'PUBLIC' ? room.public.shop?.publicOffers : room.private.blackMarket;
      const offer = offers?.find(candidate => candidate.id === command.offerId);
      engine.play(AUDIO_CUE_IDS.uiCoins); if (offer) engine.playItem(offer.itemId); return;
    }
    case 'SELL': playInstance(command.instanceId); engine.play(AUDIO_CUE_IDS.uiCoins); return;
    case 'THREAT': if (command.mode === 'COVERED') engine.playItem('cloth'); return;
    case 'DOWNED_INTERACTION': case 'LOOT_DOWNED': playInstance(command.instanceId); return;
    case 'OVERFLOW_CHOICE': {
      const incoming = room.private.overflows?.find(choice => choice.id === command.overflowId)?.incoming;
      if (incoming) engine.playItem(incoming.itemId); else engine.play(AUDIO_CUE_IDS.uiInventory);
      return;
    }
    case 'REROLL_MARKET': engine.playItem('brass-idol'); return;
    case 'FINISH_SHOPPING': engine.play(AUDIO_CUE_IDS.shop); return;
    case 'END_TURN': engine.play(AUDIO_CUE_IDS.uiSetDown); return;
    default: return;
  }
}

export function useMatchActions({ client, room, connected, viewerId, onView, onAccepted }: { client: TableClient; room: AnyRoomView; connected: boolean; viewerId: string; onView: (view: AnyRoomView) => void; onAccepted?: (request: ActionRequest) => void }) {
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState<ActionRequest>();
  const [error, setError] = useState<ClientError>();
  const [notice, setNotice] = useState('');
  const inFlight = useRef(false);
  const outstanding = useRef<ActionRequest | undefined>(undefined);
  async function run(request: ActionRequest): Promise<boolean> {
    if (!connected || inFlight.current) return false;
    inFlight.current = true;
    setPending(true);
    setError(undefined);
    setNotice('');
    try {
      const response = await dispatchRequest(client, request);
      if (!response.ok) {
        setError(response.error);
        if (response.error.code === 'TIMEOUT') {
          outstanding.current = request;
          setUncertain(request);
        } else {
          outstanding.current = undefined;
          setUncertain(undefined);
        }
        const snapshot = await client.sync();
        if (snapshot.ok) onView(snapshot.data.view);
        return false;
      }
      outstanding.current = undefined;
      setUncertain(undefined);
      onAccepted?.(request);
      setNotice(request.kind === 'chat' ? 'Message sent.' : request.kind === 'rematch' ? 'Returning to the lobby.' : 'Action confirmed.');
      return true;
    } catch {
      // An interrupted transport is uncertain, not proof that the server did not apply the action.
      outstanding.current = request;
      setUncertain(request);
      setError({ code: 'TIMEOUT', message: 'The response was interrupted. Retry to recover the same action receipt.' });
      return false;
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }
  function send(command: PlayerCommand): Promise<boolean> {
    if (outstanding.current || !hasCapability(room, command.type)) return Promise.resolve(false);
    return run({ kind: 'command', payload: commandEnvelope(command, room.public, crypto.randomUUID()) });
  }
  function chat(text: string, toPlayerId?: string): Promise<boolean> {
    if (outstanding.current || !hasCapability(room, 'CHAT')) return Promise.resolve(false);
    return run({ kind: 'chat', payload: { text, idempotencyKey: crypto.randomUUID(), expectedRevision: room.public.revision, roomId: room.public.id, ...(toPlayerId ? { toPlayerId } : {}) } });
  }
  function rematch(): Promise<boolean> {
    if (outstanding.current || !canRematch(room, viewerId)) return Promise.resolve(false);
    return run({ kind: 'rematch', idempotencyKey: crypto.randomUUID(), expectedRevision: room.public.revision });
  }
  return { send, chat, rematch, retry: () => outstanding.current ? run(outstanding.current) : Promise.resolve(false), busy: pending || !!uncertain || !connected, pending, uncertain: !!uncertain, error, notice };
}

export function ChatPanel({ room, sendChat, busy }: { room: AnyRoomView; sendChat: (text: string, toPlayerId?: string) => Promise<boolean>; busy: boolean }) {
  const [text, setText] = useState('');
  const [recipient, setRecipient] = useState('GLOBAL');
  const viewerId = room.viewerPlayerId ?? (!isSpectatorView(room) ? room.private.playerId : undefined);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const sentText = text.trim();
    if (!sentText) return;
    const sent = await sendChat(sentText, recipient === 'GLOBAL' ? undefined : recipient);
    if (sent) setText('');
  }
  return <section className="panel chat-panel" aria-label="Table chat"><h2>Table chat</h2>
    <ol className="chat-messages" role="log" aria-label="Messages" aria-relevant="additions text">{(room.messages ?? []).map(message => <li key={message.id} className={message.channel === 'PRIVATE' ? 'private-message' : ''}>
      <p className="message-meta"><strong>{playerName(room.public, message.fromPlayerId)}</strong><span>{message.channel === 'PRIVATE' ? `Private → ${playerName(room.public, message.toPlayerId)}` : 'Table'} · {new Date(message.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></p><p>{message.text}</p>
    </li>)}</ol>
    {!room.messages?.length && <p className="muted">No messages yet.</p>}
    {hasCapability(room, 'CHAT') && <form onSubmit={event => void submit(event)} className="chat-form"><fieldset disabled={busy}><legend className="sr-only">Send a message</legend>
      <label>Send to<select value={recipient} onChange={event => setRecipient(event.target.value)}><option value="GLOBAL">Everyone at the table</option>{room.public.players.filter(player => player.id !== viewerId).map(player => <option value={player.id} key={player.id}>Private: {player.name}</option>)}</select></label>
      <label>Message<textarea rows={3} maxLength={500} required value={text} onChange={event => setText(event.target.value)} placeholder={recipient === 'GLOBAL' ? 'Speak to the table…' : 'Write a private message…'} /></label>
      <button className="button secondary" disabled={!text.trim()}>Send message</button>
    </fieldset></form>}
  </section>;
}

function AudioControls({ engine, started, onStart }: { engine: AudioEngine; started: boolean; onStart: () => void }) {
  const [audioState, setAudioState] = useState(engine.state());
  const refresh = () => setAudioState(engine.state());
  return <section className="panel audio-panel" aria-label="Audio">
    <div className="section-heading"><h2>Sound</h2><span className="muted">{started ? (audioState.muted ? 'Muted' : 'On') : 'Off'}</span></div>
    {!started && <button className="button secondary full-width" type="button" onClick={() => { onStart(); refresh(); }}>Enable sound</button>}
    <div className="audio-controls" aria-hidden={!started}>
      <label className="check-row"><input type="checkbox" checked={audioState.muted} disabled={!started} onChange={event => { engine.setMuted(event.target.checked); refresh(); }} /><span>Mute</span></label>
      <label>Volume<input type="range" min="0" max="1" step="0.01" value={audioState.volume} disabled={!started} onChange={event => { engine.setVolume(Number(event.target.value)); refresh(); }} /></label>
    </div>
  </section>;
}

const ARRIVAL_AUDIO: Record<ArrivalBeat, (typeof AUDIO_CUE_IDS)[keyof typeof AUDIO_CUE_IDS]> = {
  footstep: AUDIO_CUE_IDS.footstep,
  'chair-pull': AUDIO_CUE_IDS.chair,
  sit: AUDIO_CUE_IDS.chair,
  'chair-settle': AUDIO_CUE_IDS.chair,
  'table-creak': AUDIO_CUE_IDS.tableSettle,
};

export function feedNewAudioEvents(
  engine: Pick<AudioEngine, 'handleEvent'>,
  room: AnyRoomView,
  viewerId: string,
  observed: Set<string>,
  active: boolean,
): void {
  const events = room.public.events ?? [];
  const inspections = !isSpectatorView(room) ? (room.private.inspections ?? []) : [];
  const privateByEvent = new Map(inspections.map(inspection => [inspection.eventId, inspection.payload]));
  for (const event of events) {
    const key = event.id || `sequence:${event.sequence}`;
    if (observed.has(key)) continue;
    observed.add(key);
    if (observed.size > 512) observed.delete(observed.values().next().value!);
    if (!active || event.kind === 'MATCH_STARTED') continue;
    const payload = privateByEvent.get(event.id);
    engine.handleEvent(payload === undefined ? event : { ...event, privatePayloads: { [viewerId]: payload } }, isSpectatorView(room) ? undefined : viewerId);
  }
}

function useMatchAudio(room: AnyRoomView, viewerId: string, supplied?: { engine: AudioEngine; started: boolean; start: () => void }) {
  const engineRef = useRef<AudioEngine | undefined>(undefined);
  if (!supplied && !engineRef.current) engineRef.current = createAudioEngine();
  const engine = supplied?.engine ?? engineRef.current!;
  const ownsEngine = supplied === undefined;
  const [localStarted, setLocalStarted] = useState(false);
  const started = supplied?.started ?? localStarted;
  const ambienceRef = useRef<'room' | 'shop' | undefined>(undefined);
  const observedEventsRef = useRef(new Set<string>());
  const projectionPrimedRef = useRef(false);

  useEffect(() => () => { if (ownsEngine) void engine.dispose(); }, [engine, ownsEngine]);

  useEffect(() => {
    feedNewAudioEvents(engine, room, viewerId, observedEventsRef.current, started && projectionPrimedRef.current);
    projectionPrimedRef.current = true;
  }, [engine, room, viewerId, started]);

  useEffect(() => {
    if (!started) return;
    const phase = room.public.status === 'RESULTS' ? undefined : room.public.round?.phase === 'INTERMISSION' ? 'shop' : 'room';
    if (phase === ambienceRef.current) return;
    engine.stopAmbience();
    ambienceRef.current = phase;
    if (phase) engine.startAmbience(phase);
  }, [engine, room.public.round?.phase, room.public.status, started]);

  const start = () => {
    if (supplied) { supplied.start(); return; }
    if (started) return;
    void engine.start().then(() => {
      setLocalStarted(true);
      engine.play(AUDIO_CUE_IDS.uiConfirm);
    });
  };
  return { engine, started, start };
}

export function MatchView({ room, client, connected, viewerId, voice, audioEngine, audioStarted, onEnableAudio, onView }: { room: AnyRoomView; client: TableClient; connected: boolean; viewerId: string; voice: VoiceCapability; audioEngine?: AudioEngine; audioStarted?: boolean; onEnableAudio?: () => void; onView: (view: AnyRoomView) => void }) {
  const suppliedAudio = audioEngine && audioStarted !== undefined && onEnableAudio ? { engine: audioEngine, started: audioStarted, start: onEnableAudio } : undefined;
  const audio = useMatchAudio(room, viewerId, suppliedAudio);
  const action = useMatchActions({ client, room, connected, viewerId, onView, onAccepted: request => { if (audio.started) playAcceptedActionAudio(audio.engine, room, request); } });
  const spectator = isSpectatorView(room);
  const results = room.public.status === 'RESULTS';
  const intermission = room.public.round?.phase === 'INTERMISSION';
  const [panel, setPanel] = useState<MatchPanel>(intermission ? 'MARKETS' : spectator ? 'SPECTATOR' : null);
  useEffect(() => {
    if (results) setPanel(null);
    else if (spectator) setPanel('SPECTATOR');
    else if (intermission && !spectator) setPanel(current => current ?? 'MARKETS');
    else if (!intermission) setPanel(current => current === 'MARKETS' ? null : current);
  }, [intermission, results, spectator]);
  const me = room.public.players.find(player => player.id === viewerId);
  const forcedDecision = Boolean(room.public.pendingTrade || room.public.pendingThreat || (!spectator && hasCapability(room, 'OVERFLOW_CHOICE')));
  const debug = import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1';
  const openIntent = (intent: SceneIntent) => {
    if (intent.kind === 'ITEM') setPanel(intent.ownerId === viewerId && hasCapability(room, 'USE_ITEM') ? 'USE_ITEM' : hasCapability(room, 'TRADE') ? 'TRADE' : 'PLAYERS');
    if (intent.kind === 'PLAYER') {
      const target = room.public.players.find(player => player.id === intent.playerId);
      setPanel(target?.life === 'DOWNED' && hasCapability(room, 'DOWNED_INTERACTION') ? 'DOWNED' : hasCapability(room, 'TRADE') ? 'TRADE' : 'PLAYERS');
    }
    if (intent.kind === 'CHEST') setPanel(intent.chestKind === 'BLACK' && intermission ? 'MARKETS' : 'CHESTS');
    if (intent.kind === 'EXIT') setPanel('OBJECTIVE');
  };
  const closePanel = () => setPanel(null);
  const overlaySend = async (command: PlayerCommand) => {
    const accepted = await action.send(command);
    if (accepted) closePanel();
    return accepted;
  };
  const actionProps = !spectator ? { room, send: overlaySend, busy: action.busy } : undefined;

  return <div className="match-layout match-viewport" data-viewer={spectator ? 'spectator' : 'player'}>
    <div className="match-scene-shell" aria-label={spectator ? 'Spectator table view' : 'First person table view'}>
      <GameTableScene room={room.public} viewerId={spectator ? undefined : viewerId} onIntent={openIntent} interactionsEnabled={!panel && !forcedDecision && !results} onArrivalBeat={beat => { if (audio.started) audio.engine.play(ARRIVAL_AUDIO[beat]); }} />
    </div>

    <div className="match-hud-top"><MatchHeader room={room} viewerId={viewerId} /></div>
    <ol className="seat-ribbon" aria-label="At the table">
      {room.public.players.map(player => <li key={player.id} className={`${player.seat === room.public.turn?.activeSeat ? 'current' : ''} ${player.id === viewerId ? 'self' : ''}`}>
        <button type="button" onClick={() => openIntent({ kind: 'PLAYER', playerId: player.id })} disabled={results}>
          <span>{player.name}{player.id === viewerId ? ' · You' : ''}</span><strong>{player.roleId ? ROLE_COPY[player.roleId].name : 'Unknown'} · {words(player.life)}</strong>
          <small>{player.hp}/5 HP · {player.coins}¢ · {presentItems(player.visibleInventory).length} shown</small>
        </button>
      </li>)}
    </ol>

    {!spectator && me && <aside className="self-hand" aria-label="Your hand">
      <div className="self-vitals"><strong>{me.hp}/5</strong><span>HP</span><strong>{me.coins}</strong><span>Coins</span></div>
      <div className="hand-items" aria-label="Visible inventory">
        {presentItems(me.visibleInventory).map(item => <button type="button" key={item.instanceId} onClick={() => openIntent({ kind: 'ITEM', instanceId: item.instanceId, ownerId: viewerId, itemId: item.itemId })}><span>{stackName(item)}</span><small>Use</small></button>)}
        {Array.from({ length: Math.max(0, 6 - presentItems(me.visibleInventory).length) }, (_, index) => <span className="empty-slot" key={index} aria-hidden="true">Empty</span>)}
      </div>
      <div className="pocket-indicators" aria-label="Pockets">{me.pocketOccupancy.map((occupied, index) => <span key={index} className={occupied ? 'occupied' : ''}>Pocket {index + 1}</span>)}</div>
    </aside>}

    <nav className="match-tools" aria-label="Table tools">
      {!spectator && <button type="button" onClick={() => setPanel('OBJECTIVE')}>Contract</button>}
      <button type="button" onClick={() => setPanel('PLAYERS')}>Seats</button>
      <button type="button" onClick={() => setPanel('CHESTS')}>Chests</button>
      <button type="button" onClick={() => setPanel('HISTORY')}>History</button>
      <button type="button" onClick={() => setPanel('CHAT')}>Chat</button>
      {!spectator && <button type="button" onClick={() => setPanel('SETTINGS')}>Settings</button>}
      <button type="button" onClick={() => setPanel(spectator ? 'SPECTATOR' : 'HANDBOOK')}>{spectator ? 'God view' : 'Handbook'}</button>
    </nav>

    {!spectator && !results && !intermission && <nav className="action-dock" aria-label="Your actions">
      {hasCapability(room, 'USE_ITEM') && <button type="button" onClick={() => setPanel('USE_ITEM')}>Use item</button>}
      {hasCapability(room, 'TRADE') && <button type="button" onClick={() => setPanel('TRADE')}>Trade</button>}
      {hasCapability(room, 'THREAT') && <button type="button" className="threat" onClick={() => setPanel('THREAT')}>Threat</button>}
      {hasCapability(room, 'DOWNED_INTERACTION') && <button type="button" onClick={() => setPanel('DOWNED')}>Help / loot</button>}
      {hasCapability(room, 'INSPECT_CHEST') && <button type="button" onClick={() => setPanel('CHESTS')}>Inspect chest</button>}
      {hasCapability(room, 'LEAVE_TABLE') && <button type="button" className="exit" onClick={() => setPanel('OBJECTIVE')}>Exit ready</button>}
      {hasCapability(room, 'END_TURN') && <button type="button" className="end-turn" disabled={action.busy} onClick={() => void action.send({ type: 'END_TURN' })}>{room.public.turn?.primaryUsed ? 'End turn' : 'Pass turn'}</button>}
      {!['USE_ITEM', 'TRADE', 'THREAT', 'DOWNED_INTERACTION', 'INSPECT_CHEST', 'LEAVE_TABLE', 'END_TURN'].some(capability => hasCapability(room, capability as PlayerCommand['type'])) && <span className="watch-table">Watch the table</span>}
    </nav>}
    {!spectator && !results && intermission && <nav className="action-dock market-dock" aria-label="Your actions"><button type="button" onClick={() => setPanel('MARKETS')}>Public Shop</button><button type="button" className="threat" onClick={() => setPanel('MARKETS')}>Black Market</button></nav>}

    {!connected && <p className="connection-banner match-toast" role="status">Reconnecting to your seat. The table continues while you are away; controls return with your authorized state.</p>}
    <div className="action-feedback match-toast" aria-live="polite">{action.error ? <p className="form-error" role="alert">{action.error.message}</p> : <p>{action.pending ? 'Waiting for the table…' : action.notice}</p>}
      {action.uncertain && <button className="button secondary" disabled={action.pending || !connected} onClick={() => void action.retry()}>Retry last action safely</button>}
    </div>

    {panel && !results && <MatchOverlay tone={panel === 'THREAT' || panel === 'MARKETS' ? 'danger' : panel === 'OBJECTIVE' ? 'paper' : 'neutral'} title={panelTitle(panel)} onClose={closePanel}>
      {!spectator && actionProps && panel === 'USE_ITEM' && <UseItemForm {...actionProps} />}
      {!spectator && actionProps && panel === 'TRADE' && <TradeForm {...actionProps} />}
      {!spectator && actionProps && panel === 'THREAT' && <ThreatForm {...actionProps} />}
      {!spectator && actionProps && panel === 'DOWNED' && <DownedForm {...actionProps} />}
      {!spectator && panel === 'MARKETS' && <Markets room={room} send={action.send} busy={action.busy} />}
      {!spectator && panel === 'OBJECTIVE' && <>{hasCapability(room, 'LEAVE_TABLE') && <section className="exit-contract"><h3>Your exit is ready</h3><p>Leave now to bank your objective. Staying defers this chance to your next normal turn.</p><div className="button-row"><button className="button primary" disabled={action.busy} onClick={() => void overlaySend({ type: 'LEAVE_TABLE' })}>Leave Table</button>{hasCapability(room, 'STAY') && <button className="button secondary" disabled={action.busy} onClick={() => void overlaySend({ type: 'STAY' })}>Stay at Table</button>}</div></section>}<PrivateDetail detail={room.private} room={room.public} /></>}
      {panel === 'PLAYERS' && <PlayerRoster room={room.public} viewerId={viewerId} />}
      {panel === 'CHESTS' && <><ChestPanel room={room} />{!spectator && hasCapability(room, 'INSPECT_CHEST') && <button className="button primary full-width" disabled={action.busy} onClick={() => void action.send({ type: 'INSPECT_CHEST' })}>Inspect Standard Chest</button>}</>}
      {panel === 'HISTORY' && <EventLog room={room.public} />}
      {panel === 'CHAT' && <ChatPanel room={room} sendChat={action.chat} busy={action.busy} />}
      {!spectator && panel === 'SETTINGS' && <><AudioControls engine={audio.engine} started={audio.started} onStart={audio.start} /><VoicePanel room={room} client={client} connected={connected} viewerId={viewerId} capability={voice} /></>}
      {panel === 'HANDBOOK' && <Handbook />}
      {spectator && panel === 'SPECTATOR' && <><SpectatorDetails room={room} /><ChestPanel room={room} /></>}
      {spectator && panel === 'MARKETS' && <ReadOnlyPublicShop room={room} />}
    </MatchOverlay>}

    {(room.public.pendingTrade || room.public.pendingThreat) && <div className="forced-decision"><PendingInteraction room={room} send={action.send} busy={action.busy} /></div>}
    {!spectator && hasCapability(room, 'OVERFLOW_CHOICE') && <div className="forced-decision"><OverflowDecision room={room} send={action.send} busy={action.busy} /></div>}
    {results && <div className="results-stage"><Results room={room} /><section className="panel rematch-card"><h2>Another round?</h2>{canRematch(room, viewerId) ? <><p>Return everyone to the lobby with the same seats.</p><button className="button primary full-width" disabled={action.busy} onClick={() => void action.rematch()}>Rematch</button></> : <p>Waiting for the host to open a rematch.</p>}</section></div>}

    {debug && <details className="debug-dashboard"><summary>Development dashboard</summary><div className="match-columns"><div className="table-column"><PlayerRoster room={room.public} viewerId={viewerId} /><ChestPanel room={room} /><EventLog room={room.public} /></div><div className="controls-column">{!spectator && !results && (intermission ? <Markets room={room} send={action.send} busy={action.busy} /> : <TurnActions room={room} send={action.send} busy={action.busy} />)}</div></div></details>}
  </div>;
}

type MatchPanel = null | 'USE_ITEM' | 'TRADE' | 'THREAT' | 'DOWNED' | 'MARKETS' | 'OBJECTIVE' | 'PLAYERS' | 'CHESTS' | 'HISTORY' | 'CHAT' | 'SETTINGS' | 'HANDBOOK' | 'SPECTATOR';

const PANEL_TITLES: Record<Exclude<MatchPanel, null>, string> = {
  USE_ITEM: 'Use item', TRADE: 'Trade', THREAT: 'Threat', DOWNED: 'Downed player', MARKETS: 'Intermission markets', OBJECTIVE: 'Private contract', PLAYERS: 'At the table', CHESTS: 'Table chests', HISTORY: 'Table history', CHAT: 'Table chat', SETTINGS: 'Settings', HANDBOOK: 'Handbook', SPECTATOR: 'Spectator god view',
};
function panelTitle(panel: Exclude<MatchPanel, null>) { return PANEL_TITLES[panel]; }

function MatchOverlay({ title, tone, onClose, children }: { title: string; tone: 'neutral' | 'danger' | 'paper'; onClose: () => void; children: React.ReactNode }) {
  return <div className="match-overlay-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className={`match-overlay ${tone}`} role="dialog" aria-modal="true" aria-label={title}>
    <header><p>{tone === 'paper' ? 'Eyes only' : tone === 'danger' ? 'Business under the table' : 'The table'}</p><h2>{title}</h2><button type="button" aria-label={`Close ${title}`} onClick={onClose}>Close</button></header>
    <div className="match-overlay-body">{children}</div>
  </section></div>;
}

function Handbook() {
  return <section className="handbook"><p className="kicker">Field notes</p><h3>One primary action per turn</h3><p>Use an item, trade, threaten, or interact with a Downed player when the table permits it. Communication and review remain free.</p><h3>Keep private things private</h3><p>Your contract, Pocket contents, Black Market offers, and private inspections appear only in authorized overlays.</p><h3>Leave on your terms</h3><p>Complete your objective, wait for an eligible normal turn, then choose whether to leave or stay.</p></section>;
}
