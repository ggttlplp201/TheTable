import { CoinAmount } from './ReferenceItemArt';
import { MultiplayerHints } from './MultiplayerHints';
import { MatchSetup } from './MatchSetup';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { AUDIO_CUE_IDS, createAudioEngine, type AudioEngine } from '@the-table/audio';
import { BALANCE } from '@the-table/content';
import type { ArrivalBeat } from '@the-table/visual';
import type { AnyRoomView, ClientError, PlayerCommand, RoomView, VoiceCapability } from './protocol';
import { isSpectatorView, ROLE_COPY } from './protocol';
import type { MatchClient } from './socket';
import { dispatchRequest, type ActionRequest } from './action-request';
import { canRematch, commandEnvelope, hasCapability, needsOpponent, ownItems, playerName, presentItems, remainingSeconds, stackName, useItemOptions, useItemTargets, usesChest, words } from './gameplay';
import { GameTableScene, type SceneIntent } from './GameTableScene';
import type { ExitBeat } from './table-exit-presentation';
import { SceneAimPrompt, SceneChestPrompt, SceneExitPrompt, SceneItemCard } from './SceneContext';
import { ChestPanel, Countdown, EventLog, OverflowDecision, PendingInteraction, PlayerRoster, PrivateDetail, Results, RoleAbilityDetail, SpectatorDetails } from './MatchPanels';
import { DownedForm, InventoryForm, Markets, ThreatForm, TradeForm, TurnActions, UseItemForm } from './ActionForms';
import { VoicePanel } from './VoicePanel';
import { MarketFocus } from './MarketFocus';
import { ReferenceHandbook, ReferenceSettings, ReferenceStateOverlays } from './ReferenceInterfaces';
import { MatchResolutionOverlays, PrivateInspectionHistory } from './MatchResolutionOverlays';
import { latestOwnSpyglassTarget } from './owner-scene-inspection';
import { useOwnedAudioEngineLifecycle } from './audio-lifecycle';
import { ObjectiveIntroduction, objectiveRevealKey } from './ObjectiveIntroduction';
import { OrderReveal, useOrderReveal } from './OrderReveal';
import { usePresentedHealth } from './use-presented-health';
import { WildcardDecision, WildcardPublicFeedback } from './Wildcard';
import { wildcardTargets } from './wildcard-presentation';
import './v14-player.css';
import { TurnFeedback } from './TurnFeedback';
import { TasksHud } from './Tasks';

/** Keep an uncertain submission intact until it can be retried with the same receipt key. */
/** Uses that have no animated public event: only the user hears them, at the moment they act. */
const LOCAL_USE_SOUND = new Set(['spyglass', 'cloth', 'bullet', 'bag', 'safe', 'brass-idol', 'glass-eye', 'red-ledger', 'passage-token']);

export function playAcceptedActionAudio(engine: Pick<AudioEngine, 'play' | 'playItem' | 'playUse'>, room: AnyRoomView, request: ActionRequest): void {
  if (request.kind === 'chat') { engine.play(AUDIO_CUE_IDS.uiConfirm); return; }
  if (request.kind === 'rematch') { engine.play(AUDIO_CUE_IDS.lobbyMatch); return; }
  const command = { type: request.payload.type, ...request.payload.payload } as PlayerCommand;
  if (isSpectatorView(room)) return;
  const own = ownItems(room);
  const publicItems = room.public.players.flatMap(player => presentItems(player.visibleInventory));
  const itemId = (instanceId: string) => own.find(item => item.instanceId === instanceId)?.itemId ?? publicItems.find(item => item.instanceId === instanceId)?.itemId;
  const playInstance = (instanceId: string) => { const id = itemId(instanceId); if (id) engine.playItem(id); };
  switch (command.type) {
    case 'USE_ITEM': {
      // Public uses (weapons, healing, poison, cuffs, chest tools) are heard from their authoritative event,
      // timed to the scene animation. Playing them here too doubled the gunshot and fired a "reload" on every shot.
      const used = itemId(command.instanceId);
      if (used && LOCAL_USE_SOUND.has(used)) engine.playUse(used); else playInstance(command.instanceId);
      return;
    }
    case 'POCKET': engine.play(AUDIO_CUE_IDS.uiPocket); playInstance(command.instanceId); return;
    case 'ASSIGN_SAFE': engine.playUse('safe'); return;
    case 'BUY': {
      const offers = command.market === 'PUBLIC' ? room.public.shop?.publicOffers : room.private.blackMarket;
      const offer = offers?.find(candidate => candidate.id === command.offerId);
      engine.play(AUDIO_CUE_IDS.uiCoins); if (offer) engine.playItem(offer.itemId); return;
    }
    case 'SELL': playInstance(command.instanceId); engine.play(AUDIO_CUE_IDS.uiCoins); return;
    case 'THREAT': if (command.mode === 'COVERED') engine.playUse('cloth'); return;
    case 'DOWNED_INTERACTION': case 'LOOT_DOWNED': playInstance(command.instanceId); return;
    case 'OVERFLOW_CHOICE': {
      const incoming = room.private.overflows?.find(choice => choice.id === command.overflowId)?.incoming;
      if (incoming) engine.playItem(incoming.itemId); else engine.play(AUDIO_CUE_IDS.uiInventory);
      return;
    }
    case 'REROLL_MARKET': engine.playUse('brass-idol'); return;
    case 'FINISH_SHOPPING': engine.play(AUDIO_CUE_IDS.shop); return;
    case 'PASS_TURN': case 'SKIP_LOOT': case 'END_TURN': engine.play(AUDIO_CUE_IDS.uiSetDown); return;
    default: return;
  }
}

export function useMatchActions({ client, room, connected, viewerId, onView, onAccepted }: { client: MatchClient; room: AnyRoomView; connected: boolean; viewerId: string; onView: (view: AnyRoomView) => void; onAccepted?: (request: ActionRequest) => void }) {
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState<ActionRequest>();
  const [error, setError] = useState<ClientError>();
  const [notice, setNotice] = useState('');
  const inFlight = useRef(false);
  const outstanding = useRef<ActionRequest | undefined>(undefined);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); }, []);
  const showNotice = (message: string) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice(message);
    noticeTimer.current = setTimeout(() => setNotice(current => current === message ? '' : current), 2200);
  };
  async function run(request: ActionRequest): Promise<boolean> {
    if (!connected) { setError({ code: 'DISCONNECTED', message: 'Reconnect to the table before taking an action.' }); return false; }
    if (inFlight.current) { setError({ code: 'PENDING', message: 'Your previous action is still being processed. Wait for its result.' }); return false; }
    inFlight.current = true;
    setPending(true);
    setError(undefined);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
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
        try {
          const snapshot = await client.sync();
          if (snapshot.ok) onView(snapshot.data.view);
        } catch { /* The rejected action is definite even if refreshing the view fails. */ }
        return false;
      }
      outstanding.current = undefined;
      setUncertain(undefined);
      onAccepted?.(request);
      const pocket = request.kind === 'command' && request.payload.type === 'POCKET' ? request.payload.payload : undefined;
      const pocketItem = pocket && !isSpectatorView(room) ? ownItems(room).find(item => item.instanceId === pocket.instanceId) : undefined;
      showNotice(request.kind === 'chat' ? 'Message sent.' : request.kind === 'rematch' ? 'Returning to the lobby.' : pocket && pocketItem ? `${stackName(pocketItem)} moved to Pocket ${pocket.pocketIndex + 1}.` : 'Action confirmed.');
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
    if (outstanding.current) { setError({ code: 'TIMEOUT', message: 'The previous action has no confirmed result. Retry it before taking another action.' }); return Promise.resolve(false); }
    if (isSpectatorView(room)) { setError({ code: 'SPECTATOR', message: 'Spectators cannot take gameplay actions.' }); return Promise.resolve(false); }
    if (!hasCapability(room, command.type)) { setError({ code: 'NOT_ELIGIBLE', message: 'This action is no longer available. Your draft has been kept.' }); return Promise.resolve(false); }
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

function romanSeat(seat: number) { return ['I', 'II', 'III', 'IV'][seat] ?? String(seat + 1); }

function publicStatus(player: AnyRoomView['public']['players'][number]) {
  if (player.conceded) return '⤴ CONCEDED';
  if (player.objectiveCompleted) return '◉ OBJ';
  if (player.life === 'DOWNED') return '⊘ DOWNED';
  if (player.life === 'DEAD') return '† DEAD';
  if (player.life === 'EXITED') return '⤴ EXITED';
  const status = player.statuses?.[0];
  return status ? `${status.kind === 'POISON' ? '✕' : '◎'} ${words(status.kind)}${status.remainingTurns ? ` ·${status.remainingTurns}` : ''}` : '';
}

function selfStatus(player: AnyRoomView['public']['players'][number]) {
  if (player.conceded) return 'CONCEDED';
  const status = player.statuses?.[0];
  if (status) return `${status.kind === 'POISON' ? '✕' : '◎'} ${words(status.kind)}${status.remainingTurns ? ` ·${status.remainingTurns}` : ''}`;
  return player.life !== 'ACTIVE' ? words(player.life).toUpperCase() : '—';
}

/** Presentation only: the authoritative deadline and shared balance own the timer. */
export function HudClock({ deadline, mine = false, pausedRemainingMs }: { deadline: number; mine?: boolean; pausedRemainingMs?: number }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    setNow(Date.now());
    if (pausedRemainingMs !== undefined) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [deadline, pausedRemainingMs]);
  const remaining = pausedRemainingMs ?? deadline - now;
  const seconds = remainingSeconds(remaining, 0);
  // calm → warn (≤10 s, grows, brass-orange) → critical (≤5 s, red pulse). Only your own clock escalates.
  const phase = !mine ? 'other' : seconds <= 5 ? 'critical' : seconds <= 10 ? 'warn' : 'calm';
  const left = Math.max(0, Math.min(1, remaining / BALANCE.normalTurnMs));
  return <span data-clock={phase} data-paused={pausedRemainingMs !== undefined ? 'true' : undefined} role="timer" aria-label={`Turn remaining: ${seconds} seconds${pausedRemainingMs !== undefined ? ' (paused)' : ''}`}>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}{mine && <i className="core-clock-bar" aria-hidden="true" style={{ ['--left' as string]: left }} />}</span>;
}

function CoreHudHeader({ room, viewerId, spectator }: { room: AnyRoomView; viewerId: string; spectator: boolean }) {
  const state = room.public;
  const active = state.players.find(player => player.seat === state.turn?.activeSeat);
  const intermission = state.round?.phase === 'INTERMISSION';
  const shopper = state.shop?.order[state.shop.activeShopperIndex];
  const title = spectator ? '◎ SPECTATING · GOD VIEW' : intermission ? state.shop?.phase === 'PREP' ? 'INTERMISSION · PREP' : state.shop?.phase === 'GRACE' ? 'INTERMISSION · FINAL CHOICES' : `PUBLIC SHOP · ${playerName(state, shopper).toUpperCase()}` : active?.id === viewerId ? 'YOUR TURN' : `${(active?.name ?? 'TABLE').toUpperCase()}’S TURN`;
  const shopDeadline = state.shop?.phase === 'PREP' ? state.shop.prepDeadlineAt : state.shop?.phase === 'PUBLIC' ? state.shop.publicDeadlineAt : state.shop?.privateDeadlineAt;
  return <header className={`core-hud-heading ${spectator ? 'spectator' : ''}`} data-mine={!spectator && !intermission && active?.id === viewerId ? 'true' : undefined}>
    <span className="core-round">ROUND {String(state.round?.number ?? 1).padStart(2, '0')}</span>
    <strong>{title}</strong>
    {!spectator && state.round?.phase === 'TURN' && state.turn && <span className="core-clock"><HudClock deadline={state.turn.deadlineAt} mine={active?.id === viewerId} {...(state.turn.pausedRemainingMs !== undefined ? { pausedRemainingMs: state.turn.pausedRemainingMs } : {})} /></span>}
    {intermission && shopDeadline !== undefined && <Countdown deadline={shopDeadline} label="Intermission deadline" format="seconds" />}
    {spectator && <small>ALL INPUT DISABLED · CHAT READ-ONLY</small>}
  </header>;
}

export function ChatPanel({ room, sendChat, busy, draft, onDraftChange, selectedRecipient, onRecipientChange }: { room: AnyRoomView; sendChat: (text: string, toPlayerId?: string) => Promise<boolean>; busy: boolean; draft?: string; onDraftChange?: (value: string) => void; selectedRecipient?: string; onRecipientChange?: (value: string) => void }) {
  const [localText, setLocalText] = useState('');
  const [localRecipient, setLocalRecipient] = useState('GLOBAL');
  const text = draft ?? localText;
  const recipient = selectedRecipient ?? localRecipient;
  const setText = onDraftChange ?? setLocalText;
  const setRecipient = onRecipientChange ?? setLocalRecipient;
  const viewerId = room.viewerPlayerId ?? (!isSpectatorView(room) ? room.private.playerId : undefined);
  const recipients = room.public.players.filter(player => player.id !== viewerId);
  const recipientPlayer = recipients.find(player => player.id === recipient);
  const recipientUnavailable = recipient !== 'GLOBAL' && (!recipientPlayer || recipientPlayer.connection !== 'CONNECTED' || !['ACTIVE', 'DOWNED'].includes(recipientPlayer.life));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const sentText = text.trim();
    if (!sentText || busy || recipientUnavailable || !hasCapability(room, 'CHAT')) return;
    const sent = await sendChat(sentText, recipient === 'GLOBAL' ? undefined : recipient);
    if (sent) setText('');
  }
  return <section className="panel chat-panel" aria-label="Table chat"><h2 className="sr-only">Table chat</h2><div className="reference-chat-tabs"><button type="button" className={recipient === 'GLOBAL' ? 'selected' : ''} onClick={() => setRecipient('GLOBAL')}>◎ GLOBAL</button><label><span className="sr-only">Send to</span><select aria-label="Private recipient" value={recipient} onChange={event => setRecipient(event.target.value)}><option value="GLOBAL">◐ PRIVATE</option>{recipients.map(player => <option value={player.id} key={player.id}>Private: {player.name}{player.connection !== 'CONNECTED' || !['ACTIVE', 'DOWNED'].includes(player.life) ? ' · unavailable' : ''}</option>)}{recipient !== 'GLOBAL' && !recipientPlayer && <option value={recipient}>Private recipient · unavailable</option>}</select></label></div>
    <p className="chat-destination">TO: {recipient === 'GLOBAL' ? 'GLOBAL · everyone at the table' : `PRIVATE · ${recipientPlayer?.name ?? 'unavailable recipient'}`}</p>
    {recipientUnavailable && <p className="form-error" role="status">Recipient unavailable. Your private draft is saved; choose a recipient to send.</p>}
    <ol className="chat-messages" role="log" aria-label="Messages" aria-relevant="additions text">{(room.messages ?? []).map(message => <li key={message.id} className={message.channel === 'PRIVATE' ? 'private-message' : ''}>
      <p className="message-meta"><strong>{playerName(room.public, message.fromPlayerId)}</strong><span>{message.channel === 'PRIVATE' ? `Private → ${playerName(room.public, message.toPlayerId)}` : 'Table'} · {new Date(message.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></p><p>{message.text}</p>
    </li>)}</ol>
    {!room.messages?.length && <p className="muted">No messages yet.</p>}
    {hasCapability(room, 'CHAT') && <form onSubmit={event => void submit(event)} className="chat-form"><fieldset disabled={busy}><legend className="sr-only">Send a message</legend>
      <label>Message<textarea rows={1} maxLength={500} required value={text} onChange={event => setText(event.target.value)} placeholder={recipient === 'GLOBAL' ? 'speak to the table…' : `whisper to ${playerName(room.public, recipient).toUpperCase()}…`} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} /></label>
      <button className="button secondary" aria-label="Send message" disabled={!text.trim() || recipientUnavailable}>↵</button>
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
  'chair-scrape': AUDIO_CUE_IDS.chairScrape,
  'chair-settle': AUDIO_CUE_IDS.chairSettle,
};
const EXIT_AUDIO: Record<ExitBeat, (typeof AUDIO_CUE_IDS)[keyof typeof AUDIO_CUE_IDS]> = {
  'chair-scrape': AUDIO_CUE_IDS.chairScrape,
  footstep: AUDIO_CUE_IDS.footstep,
  'door-open': AUDIO_CUE_IDS.doorOpen,
  'exit-through': AUDIO_CUE_IDS.exitThrough,
};

/** Public choreography only: identical cue mapping for owner, other players and spectators. */
export function playExitBeatAudio(engine: Pick<AudioEngine, 'play'>, beat: ExitBeat): void {
  engine.play(EXIT_AUDIO[beat]);
}

export function feedNewAudioEvents(
  engine: Pick<AudioEngine, 'handleEvent'>,
  room: AnyRoomView,
  viewerId: string,
  observed: Set<string>,
  active: boolean,
  sceneExitAudio = false,
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
    // Match the scene observer's fresh/public-actor eligibility. Reduced motion,
    // an unavailable renderer or a hidden page keeps the single generic fallback.
    if (sceneExitAudio && event.kind === 'EXIT' && Math.abs(Date.now() - event.at) <= 5000
      && room.public.players.some(player => player.id === event.actorId && player.roleId)) continue;
    const payload = privateByEvent.get(event.id);
    engine.handleEvent(payload === undefined ? event : { ...event, privatePayloads: { [viewerId]: payload } }, isSpectatorView(room) ? undefined : viewerId);
  }
}

/** The deadline the viewer personally has to beat, if any. Responses and overflow outrank the turn clock. */
export function audioDeadline(room: AnyRoomView, viewerId: string): { kind: 'turn' | 'response'; at: number } | undefined {
  if (isSpectatorView(room) || room.public.status === 'RESULTS') return undefined;
  const state = room.public;
  const overflow = state.overflows?.find(entry => entry.playerId === viewerId);
  if (overflow) return { kind: 'response', at: overflow.deadlineAt };
  if (state.pendingThreat?.targetId === viewerId && state.pendingThreat.status === 'PENDING') {
    return { kind: 'response', at: state.pendingThreat.deadlineAt };
  }
  if (state.pendingTrade?.targetId === viewerId && state.pendingTrade.status === 'PENDING') {
    return { kind: 'response', at: state.pendingTrade.deadlineAt };
  }
  const active = state.players.find(player => player.seat === state.turn?.activeSeat);
  if (state.round?.phase === 'TURN' && state.turn && state.turn.pausedRemainingMs === undefined && active?.id === viewerId) {
    return { kind: 'turn', at: state.turn.deadlineAt };
  }
  return undefined;
}

export type MusicScene = 'table' | 'shop' | 'market';
/** Which bed plays: results → silence, dead/left/spectating → "After", Black Market → "Under the Table", Intermission → shop, else the table. */
export function musicFor(room: AnyRoomView, viewerId: string, scene: MusicScene): 'table' | 'shop' | 'market' | 'after' | undefined {
  if (room.public.status === 'RESULTS') return undefined;
  const life = room.public.players.find(player => player.id === viewerId)?.life;
  if (isSpectatorView(room) || (life !== undefined && life !== 'ACTIVE' && life !== 'DOWNED')) return 'after';
  if (room.public.round?.phase === 'INTERMISSION') return scene === 'market' ? 'market' : 'shop';
  return 'table';
}

function useMatchAudio(room: AnyRoomView, viewerId: string, supplied?: { engine: AudioEngine; started: boolean; start: () => void }, scene: MusicScene = 'table', sceneReady = false) {
  const engineRef = useRef<AudioEngine | undefined>(undefined);
  if (!supplied && !engineRef.current) engineRef.current = createAudioEngine();
  const engine = supplied?.engine ?? engineRef.current!;
  const ownsEngine = supplied === undefined;
  const [localStarted, setLocalStarted] = useState(false);
  const started = supplied?.started ?? localStarted;
  const observedEventsRef = useRef(new Set<string>());
  const projectionPrimedRef = useRef(false);

  useOwnedAudioEngineLifecycle(engine, ownsEngine);

  useEffect(() => {
    const sceneExitAudio = sceneReady && !window.matchMedia('(prefers-reduced-motion: reduce)').matches && document.visibilityState !== 'hidden';
    feedNewAudioEvents(engine, room, viewerId, observedEventsRef.current, started && projectionPrimedRef.current, sceneExitAudio);
    projectionPrimedRef.current = true;
  }, [engine, room, viewerId, started, sceneReady]);

  const track = musicFor(room, viewerId, scene);
  const threatOpen = Boolean(room.public.pendingThreat) && track === 'table';
  useEffect(() => { if (started) engine.setMusic(track); }, [engine, track, started]);
  useEffect(() => { if (started) engine.setThreat(threatOpen); }, [engine, threatOpen, started]);
  useEffect(() => () => { engine.setThreat(false); engine.setMusic(undefined); }, [engine]);

  const results = room.public.status === 'RESULTS';
  const resultsPlayedRef = useRef(false);
  useEffect(() => {
    if (!results) {
      resultsPlayedRef.current = false;
      return;
    }
    if (started && !resultsPlayedRef.current) {
      resultsPlayedRef.current = true;
      engine.play(AUDIO_CUE_IDS.results);
    }
  }, [engine, results, started]);

  const deadline = audioDeadline(room, viewerId);
  useEffect(() => {
    if (!started || !deadline) return undefined;
    const marks = deadline.kind === 'turn' ? [10, 5, 4, 3, 2, 1] : [10, 5];
    const cue = deadline.kind === 'turn' ? AUDIO_CUE_IDS.warning : AUDIO_CUE_IDS.responseWarning;
    const timers = marks
      .map(mark => deadline.at - mark * 1000 - Date.now())
      .filter(ms => ms > 0)
      .map(ms => window.setTimeout(() => engine.play(cue), ms));
    return () => timers.forEach(timer => window.clearTimeout(timer));
  }, [engine, started, deadline?.kind, deadline?.at]);

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

export type SceneIntentTarget = {
  panel: Exclude<MatchPanel, null>;
  itemInstanceId?: string | undefined;
  pocketIndex?: number | undefined;
  requestedItemInstanceId?: string | undefined;
  targetPlayerId?: string | undefined;
  chestKind?: 'STANDARD' | 'BLACK' | undefined;
  immediateLoot?: boolean | undefined;
  marketView?: 'PUBLIC' | 'BLACK' | 'SELL' | undefined;
  threatMode?: 'OPEN' | 'COVERED' | undefined;
};

/** Resolve the other participant whose seat the first-person camera should face. */
export function interactionCameraTarget(room: AnyRoomView, viewerId: string, panel: MatchPanel, selection: Omit<SceneIntentTarget, 'panel'>): string | undefined {
  const pending = room.public.pendingTrade ?? room.public.pendingThreat;
  if (pending && (pending.actorId === viewerId || pending.targetId === viewerId)) {
    return pending.actorId === viewerId ? pending.targetId : pending.actorId;
  }
  if (panel !== 'TRADE' && panel !== 'THREAT') return undefined;
  const eligible = room.public.players.filter(player => player.id !== viewerId && player.life === 'ACTIVE' && player.connection === 'CONNECTED');
  return eligible.some(player => player.id === selection.targetPlayerId) ? selection.targetPlayerId : eligible[0]?.id;
}

/** Convert a public scene hit into a capability-gated UI destination without losing the hit object. */
export function sceneIntentTarget(room: AnyRoomView, viewerId: string, intent: SceneIntent): SceneIntentTarget | null {
  if (isSpectatorView(room) || intent.kind === 'EMPTY') return null;
  if (intent.kind === 'WILDCARD') return hasCapability(room, 'DRAW_WILDCARD') ? { panel: 'WILDCARD' } : null;
  if (intent.kind === 'POCKET') return intent.ownerId === viewerId ? { panel: 'POCKETS', pocketIndex: intent.pocketIndex } : { panel: 'PLAYERS', targetPlayerId: intent.ownerId };
  if (intent.kind === 'MARKET_PUBLIC' || intent.kind === 'MARKET_BLACK' || intent.kind === 'SELL') {
    if (room.public.round?.phase !== 'INTERMISSION') return null;
    return { panel: 'MARKETS', marketView: intent.kind === 'MARKET_PUBLIC' ? 'PUBLIC' : intent.kind === 'MARKET_BLACK' ? 'BLACK' : 'SELL' };
  }
  if (intent.kind === 'ITEM') {
    if (intent.ownerId === viewerId && hasCapability(room, 'USE_ITEM')) return { panel: 'USE_ITEM', itemInstanceId: intent.instanceId };
    const owner = room.public.players.find(player => player.id === intent.ownerId);
    if (owner?.id !== viewerId && owner?.life === 'ACTIVE' && owner.connection === 'CONNECTED' && hasCapability(room, 'TRADE')) {
      return { panel: 'TRADE', targetPlayerId: owner.id, requestedItemInstanceId: intent.instanceId };
    }
    return { panel: 'PLAYERS', targetPlayerId: intent.ownerId };
  }
  if (intent.kind === 'PLAYER') {
    const target = room.public.players.find(player => player.id === intent.playerId);
    const immediate = room.public.turn?.immediateLoot;
    if (target?.life === 'DOWNED' && hasCapability(room, 'LOOT_DOWNED') && immediate?.targetId === target.id) {
      return { panel: 'DOWNED', targetPlayerId: target.id, immediateLoot: true };
    }
    if (target?.life === 'DOWNED' && hasCapability(room, 'DOWNED_INTERACTION')) return { panel: 'DOWNED', targetPlayerId: target.id };
    if (target?.id !== viewerId && target?.life === 'ACTIVE' && target.connection === 'CONNECTED' && hasCapability(room, 'TRADE')) return { panel: 'TRADE', targetPlayerId: target.id };
    return { panel: 'PLAYERS', targetPlayerId: intent.playerId };
  }
  if (intent.kind === 'CHEST') {
    const available = room.public.chests?.some(chest => chest.kind === intent.chestKind && chest.availability === 'AVAILABLE');
    const acceptedItems = intent.chestKind === 'BLACK' ? new Set(['black-key']) : new Set(['key', 'lockpick', 'crowbar']);
    const accessItem = available && hasCapability(room, 'USE_ITEM')
      ? useItemOptions(room).find(item => acceptedItems.has(item.itemId))
      : undefined;
    return accessItem
      ? { panel: 'USE_ITEM', itemInstanceId: accessItem.instanceId, chestKind: intent.chestKind }
      : { panel: 'CHESTS', chestKind: intent.chestKind };
  }
  return { panel: 'OBJECTIVE' };
}

export function MatchView(props: Parameters<typeof ActiveMatchView>[0]) {
  return !isSpectatorView(props.room) && props.room.public.round?.phase === 'SETUP'
    ? <SetupMatchView {...props} room={props.room} />
    : <ActiveMatchView {...props} />;
}
function SetupMatchView(props: Parameters<typeof ActiveMatchView>[0] & { room: RoomView }) {
  const action = useMatchActions(props);
  return <MatchSetup room={props.room} send={action.send} busy={action.busy} connected={props.connected} error={action.error?.message} retry={action.uncertain ? action.retry : undefined} />;
}

function ActiveMatchView({ room, client, connected, viewerId, voice, audioEngine, audioStarted, onEnableAudio, onView, onReturnHome, onCameraTravel, guideFocus }: { room: AnyRoomView; client: MatchClient; connected: boolean; viewerId: string; voice: VoiceCapability; audioEngine?: AudioEngine; audioStarted?: boolean; onEnableAudio?: () => void; onView: (view: AnyRoomView) => void; onReturnHome?: () => void; onCameraTravel?: (degrees: number) => void; guideFocus?: string }) {
  const suppliedAudio = audioEngine && audioStarted !== undefined && onEnableAudio ? { engine: audioEngine, started: audioStarted, start: onEnableAudio } : undefined;
  const [musicScene, setMusicScene] = useState<MusicScene>('table');
  const [sceneReady, setSceneReady] = useState(false);
  const audio = useMatchAudio(room, viewerId, suppliedAudio, musicScene, sceneReady);
  const action = useMatchActions({ client, room, connected, viewerId, onView, onAccepted: request => { if (audio.started) playAcceptedActionAudio(audio.engine, room, request); } });
  const spectator = isSpectatorView(room);
  const presentedPublic = usePresentedHealth(room.public, sceneReady);
  const results = room.public.status === 'RESULTS';
  const intermission = room.public.round?.phase === 'INTERMISSION';
  const [panel, setPanel] = useState<MatchPanel>(intermission ? 'MARKETS' : spectator ? 'SPECTATOR' : null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatDraft, setChatDraft] = useState('');
  const [chatRecipient, setChatRecipient] = useState('GLOBAL');
  const [cameraHint, setCameraHint] = useState(true);
  const [concedeConfirm, setConcedeConfirm] = useState(false);
  const [threatMenuOpen, setThreatMenuOpen] = useState(false);
  const [marketView, setMarketView] = useState<'PUBLIC' | 'BLACK' | 'SELL'>('PUBLIC');
  const onMarketView = useCallback((view: 'PUBLIC' | 'BLACK' | 'SELL') => { setMarketView(view); setMusicScene(view === 'BLACK' ? 'market' : 'shop'); }, []);
  const marketOpen = !spectator && intermission && panel === 'MARKETS';
  useEffect(() => { if (!marketOpen) setMusicScene('table'); }, [marketOpen]);
  const [sceneSelection, setSceneSelection] = useState<Omit<SceneIntentTarget, 'panel'>>({});
  const [sceneChest, setSceneChest] = useState<'STANDARD' | 'BLACK' | null>(null);
  const [sceneItemId, setSceneItemId] = useState<string>();
  const [aiming, setAiming] = useState(false);
  const [wildcardTargetId, setWildcardTargetId] = useState('');
  const revealKey = !spectator ? objectiveRevealKey(room, viewerId) : undefined;
  const [objectiveReveal, setObjectiveReveal] = useState<{ key: string | undefined; phase: 'WAITING' | 'VISIBLE' | 'DONE'; sawArrival: boolean }>(() => ({ key: revealKey, phase: revealKey ? 'WAITING' : 'DONE', sawArrival: false }));
  useEffect(() => { setObjectiveReveal(current => current.key === revealKey ? current : { key: revealKey, phase: revealKey ? 'WAITING' : 'DONE', sawArrival: false }); }, [revealKey]);
  const objectiveBlocking = objectiveReveal.phase !== 'DONE';
  const actualOrderReveal = useOrderReveal(room.public, cue => { if (audio.started) audio.engine.play(cue); });
  const orderReveal = actualOrderReveal;
  const presentationBlocking = objectiveBlocking || Boolean(orderReveal);
  useEffect(() => {
    if (presentationBlocking || !cameraHint) return;
    const timer = window.setTimeout(() => setCameraHint(false), 10_000);
    return () => window.clearTimeout(timer);
  }, [presentationBlocking, cameraHint]);
  const scope = latestOwnSpyglassTarget(room, viewerId);
  const scopeIdentity = `${room.public.id}:${viewerId}:${spectator}`;
  const observedScope = useRef({ identity: scopeIdentity, eventId: scope?.eventId });
  const [activeScope, setActiveScope] = useState<{ identity: string; targetId: string }>();
  useEffect(() => {
    if (observedScope.current.identity !== scopeIdentity) { observedScope.current = { identity: scopeIdentity, eventId: scope?.eventId }; setActiveScope(undefined); return; }
    if (!scope || observedScope.current.eventId === scope.eventId) return;
    observedScope.current.eventId = scope.eventId;
    const event = room.public.events?.find(entry => entry.id === scope.eventId);
    if (!event || Math.abs(Date.now() - event.at) > 5000) return;
    setActiveScope({ identity: scopeIdentity, targetId: scope.targetId });
    const timer = window.setTimeout(() => setActiveScope(undefined), 3500);
    return () => window.clearTimeout(timer);
  }, [scopeIdentity, scope?.eventId]);
  useEffect(() => {
    if (results || orderReveal) setPanel(null);
    else if (spectator) setPanel('SPECTATOR');
    else if (intermission && !spectator) setPanel(current => current ?? 'MARKETS');
    else if (!intermission) setPanel(current => current === 'MARKETS' ? null : current);
  }, [intermission, orderReveal?.key, results, spectator]);
  const me = room.public.players.find(player => player.id === viewerId);
  const ownerAmmo = !spectator ? ownItems(room).filter(item => item.itemId === 'bullet').reduce((total, item) => total + item.quantity, 0) : 0;
  const sceneItem = !spectator ? ownItems(room).find(item => item.instanceId === sceneItemId) : undefined;
  const ownerWildcard = !spectator && room.private.playerId === viewerId ? room.private.pendingWildcard : undefined;
  const wildcardTargeting = ownerWildcard?.phase === 'TARGETING' && hasCapability(room, 'RESOLVE_WILDCARD') && !action.busy;
  const aimTargets = wildcardTargeting ? wildcardTargets(room.public, viewerId, ownerWildcard.cardId).players.map(player => player.id)
    : !spectator && aiming && sceneItem && hasCapability(room, 'USE_ITEM') ? useItemTargets(room, sceneItem.itemId).map(player => player.id) : guideFocus === 'dealer' ? ['dealer'] : [];
  useEffect(() => { setWildcardTargetId(''); }, [ownerWildcard?.cardId]);
  const pendingInteraction = room.public.pendingTrade ?? room.public.pendingThreat;
  const wildcardPending = !spectator && Boolean(room.private.pendingWildcard);
  const interactionParticipant = !spectator && pendingInteraction && (pendingInteraction.actorId === viewerId || pendingInteraction.targetId === viewerId);
  const forcedDecision = Boolean(wildcardPending || interactionParticipant || (!spectator && hasCapability(room, 'OVERFLOW_CHOICE')));
  const debug = import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1';
  const showPanel = (next: Exclude<MatchPanel, null>, selection: Omit<SceneIntentTarget, 'panel'> = {}) => {
    if (next === 'CHAT') { setChatOpen(current => !current); return; }
    if (forcedDecision) setChatOpen(false);
    setSceneChest(null); setSceneItemId(undefined); setAiming(false);
    setSceneSelection(selection);
    setPanel(next);
  };
  useEffect(() => {
    const shortcuts = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.defaultPrevented || event.repeat || event.metaKey || event.ctrlKey || event.altKey || event.isComposing || target?.closest('input, select, textarea, button, [contenteditable]:not([contenteditable="false"])') || presentationBlocking || sceneItem || sceneChest || panel || forcedDecision || results || spectator || intermission || action.busy) return;
      if (event.key === ' ' && hasCapability(room, 'PASS_TURN')) { event.preventDefault(); void action.send({ type: 'PASS_TURN' }); return; }
      const next = event.key === '1' && hasCapability(room, 'TRADE') ? 'TRADE'
        : event.key === '2' && hasCapability(room, 'THREAT') ? 'THREAT' : null;
      if (!next) return;
      event.preventDefault();
      showPanel(next);
    };
    window.addEventListener('keydown', shortcuts);
    return () => window.removeEventListener('keydown', shortcuts);
  }, [action.busy, action.send, forcedDecision, intermission, panel, presentationBlocking, results, room, sceneChest, sceneItem, spectator]);
  const openIntent = (intent: SceneIntent) => {
    if (intent.kind === 'WILDCARD' && hasCapability(room, 'DRAW_WILDCARD') && !action.busy) {
      void action.send({ type: 'DRAW_WILDCARD' });
      return;
    }
    if (wildcardTargeting) {
      const targetId = intent.kind === 'PLAYER' ? intent.playerId : intent.kind === 'ITEM' ? intent.ownerId : undefined;
      if (targetId && aimTargets.includes(targetId)) setWildcardTargetId(targetId);
      return;
    }
    if (intent.kind === 'EMPTY') { if (aiming) setAiming(false); else setSceneItemId(undefined); return; }
    if (aiming && sceneItem) {
      if (intent.kind === 'POCKET') {
        const pocketTargetItem = ['spyglass', 'pickpocket', 'glass-eye'].includes(sceneItem.itemId);
        if (pocketTargetItem && intent.ownerId !== viewerId && aimTargets.includes(intent.ownerId)) showPanel('USE_ITEM', { itemInstanceId: sceneItem.instanceId, targetPlayerId: intent.ownerId, pocketIndex: intent.pocketIndex });
        return;
      }
      const targetId = intent.kind === 'PLAYER' ? intent.playerId : intent.kind === 'ITEM' ? intent.ownerId : undefined;
      if (targetId && aimTargets.includes(targetId) && !['spyglass', 'pickpocket', 'glass-eye'].includes(sceneItem.itemId)) showPanel('USE_ITEM', { itemInstanceId: sceneItem.instanceId, targetPlayerId: targetId });
      return;
    }
    if (!spectator && intent.kind === 'ITEM' && intent.ownerId === viewerId && window.matchMedia('(min-width: 801px)').matches) {
      setPanel(null); setSceneChest(null); setSceneItemId(intent.instanceId); return;
    }
    if (!spectator && intent.kind === 'CHEST' && window.matchMedia('(min-width: 801px)').matches) {
      setPanel(null); setSceneItemId(undefined); setSceneChest(intent.chestKind); return;
    }
    const target = sceneIntentTarget(room, viewerId, intent);
    if (!target) return;
    const { panel: next, ...selection } = target;
    if (target.marketView) setMarketView(target.marketView);
    showPanel(next, selection);
  };
  const closePanel = () => { setPanel(null); setSceneSelection({}); setSceneChest(null); setSceneItemId(undefined); setAiming(false); };
  const overlaySend = async (command: PlayerCommand) => {
    const accepted = await action.send(command);
    if (accepted) closePanel();
    return accepted;
  };
  const actionProps = !spectator ? { room, send: overlaySend, busy: action.busy } : undefined;
  const useSelectedItem = () => {
    if (!sceneItem || !hasCapability(room, 'USE_ITEM')) return;
    if (usesChest(sceneItem.itemId)) { setSceneItemId(undefined); setSceneChest(sceneItem.itemId === 'black-key' ? 'BLACK' : 'STANDARD'); }
    else if (needsOpponent(sceneItem.itemId)) setAiming(true);
    else showPanel('USE_ITEM', { itemInstanceId: sceneItem.instanceId });
  };
  const focusPlayerId = spectator ? undefined : interactionCameraTarget(room, viewerId, panel, sceneSelection);
  const sceneFocus = !spectator && hasCapability(room, 'LEAVE_TABLE') && (!panel || panel === 'OBJECTIVE') ? 'door'
    : focusPlayerId ? 'seat'
    : panel === 'USE_ITEM' || panel === 'OBJECTIVE' || panel === 'POCKETS' || panel === 'DOWNED' || (!spectator && hasCapability(room, 'OVERFLOW_CHOICE')) ? 'down' : 'seat';

  const modalOpen = !presentationBlocking && !results && ((panel !== null && panel !== 'MARKETS' && panel !== 'SPECTATOR') || forcedDecision);
  return <div className="match-layout match-viewport" data-viewer={spectator ? 'spectator' : 'player'} data-market={panel === 'MARKETS' || undefined} data-response={forcedDecision || undefined} data-chat={chatOpen || undefined} data-downed={me?.life === 'DOWNED' || undefined} data-modal={modalOpen ? 'true' : undefined} data-objective-reveal={objectiveBlocking ? objectiveReveal.phase.toLowerCase() : undefined}>
    <MultiplayerHints room={room} blackMarketOpen={panel === 'MARKETS' && marketView === 'BLACK'} />
    <div className="match-scene-shell" aria-label={spectator ? 'Spectator table view' : 'First person table view'}>
      <GameTableScene onExitBeat={beat => { if (audio.started) playExitBeatAudio(audio.engine, beat); }} tutorialFocus={guideFocus} onCameraTravel={onCameraTravel} room={presentedPublic} {...(ownerWildcard ? { ownerWildcard } : {})} wildcardDrawEnabled={hasCapability(room, 'DRAW_WILDCARD') && !action.busy} onReadyChange={setSceneReady} viewerId={spectator ? undefined : viewerId} onIntent={openIntent} interactionsEnabled={!presentationBlocking && !panel && !sceneChest && (!forcedDecision || wildcardTargeting) && !results} exitReady={!spectator && hasCapability(room, 'LEAVE_TABLE')} showOwnerMarket={!spectator && intermission} focus={sceneFocus} focusPlayerId={focusPlayerId} selectedItemId={!panel && !forcedDecision ? sceneItem?.instanceId : undefined} aimTargets={aimTargets} aimPockets={Boolean(aiming && sceneItem && ['spyglass', 'pickpocket', 'glass-eye'].includes(sceneItem.itemId))} spyglassTargetId={activeScope?.identity === scopeIdentity ? activeScope.targetId : undefined} spyglassActive={!spectator && !results && activeScope?.identity === scopeIdentity} onArrivalBeat={beat => { if (audio.started) audio.engine.play(ARRIVAL_AUDIO[beat]); }} onArrivalStateChange={active => setObjectiveReveal(current => {
        if (current.phase !== 'WAITING') return current;
        if (active) return { ...current, sawArrival: true };
        return { ...current, phase: 'VISIBLE' };
      })}>
        {objectiveReveal.phase === 'VISIBLE' && <ObjectiveIntroduction room={room as RoomView} onComplete={() => setObjectiveReveal(current => ({ ...current, phase: 'DONE' }))} />}
        {orderReveal && <OrderReveal frame={orderReveal} viewerId={spectator ? undefined : viewerId} />}
        {!presentationBlocking && !spectator && !results && !forcedDecision && !panel && sceneItem && <SceneItemCard key={sceneItem.instanceId} item={sceneItem} room={room} aiming={aiming} busy={action.busy} onUse={useSelectedItem} onPutDown={() => { if (aiming) setAiming(false); else setSceneItemId(undefined); }} send={overlaySend} />}
        {!presentationBlocking && !spectator && !results && !forcedDecision && !panel && sceneItem && aiming && <SceneAimPrompt itemId={sceneItem.itemId} />}
        {!presentationBlocking && !spectator && !results && !forcedDecision && !panel && sceneChest && <SceneChestPrompt key={sceneChest} room={room} kind={sceneChest} busy={action.busy} send={overlaySend} onClose={() => setSceneChest(null)} />}
        {!presentationBlocking && !spectator && !results && !forcedDecision && !panel && !sceneChest && hasCapability(room, 'LEAVE_TABLE') && <SceneExitPrompt busy={action.busy} canStay={hasCapability(room, 'STAY')} send={overlaySend} />}
      </GameTableScene>
    </div>

    {!presentationBlocking && <div className="match-hud-top"><CoreHudHeader room={room} viewerId={viewerId} spectator={spectator} /></div>}
    {(!presentationBlocking || orderReveal?.phase === 'income') && <ol className="seat-ribbon" aria-label="At the table">
      {room.public.players.map(player => <li key={player.id} data-life={player.life} data-seat={player.seat} className={`${player.seat === room.public.turn?.activeSeat ? 'current' : ''} ${player.id === viewerId ? 'self' : ''}`}>
        <button type="button" onClick={() => showPanel('PLAYERS', { targetPlayerId: player.id })} disabled={results}>
          <span>{romanSeat(player.seat)}</span>
          <strong>{player.id === viewerId ? 'YOU' : player.name.toUpperCase()}</strong>
          <small>♥{player.hp}{(player.temporaryHp ?? 0) > 0 ? ` +${player.temporaryHp}` : ''} <CoinAmount amount={player.coins} /></small>
          <em>{publicStatus(player)}</em>
          {room.public.wildcard?.unlocked && <small className="wildcard-seat-status">WILDCARD: {room.public.wildcard.drawUsedByPlayer[player.id] ? 'SPENT' : 'AVAILABLE'}</small>}
        </button>
      </li>)}
    </ol>}

    {(!presentationBlocking || orderReveal?.phase === 'income') && !spectator && me && <aside className="self-hand" aria-label="Your status">
      <div className="self-vitals">
        <div className="self-vital-row"><span>HP</span><i className="hp-pips" aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <b className={index < me.hp ? 'filled' : ''} key={index} />)}</i><strong>{me.hp}/5{(me.temporaryHp ?? 0) > 0 ? ` +${me.temporaryHp}` : ''}</strong></div>
        <div className="self-vital-row"><span>GOLD</span><strong><CoinAmount amount={me.coins} /></strong></div>
        <div className="self-vital-row"><span>AMMO</span><i className="ammo-pips" aria-hidden="true">{Array.from({ length: Math.min(6, ownerAmmo) }, (_, index) => <b className="filled" key={index} />)}</i><strong aria-label={`${ownerAmmo} usable Bullets including Pockets`}>{ownerAmmo}</strong></div>
        <div className="self-vital-row"><span>POCKET</span><strong aria-label={me.pocketOccupancy.map((occupied, index) => `Pocket ${index + 1} ${occupied ? 'occupied' : 'empty'}`).join(', ')}>{me.pocketOccupancy.map(occupied => occupied ? '◆' : '◇').join(' ')}</strong></div>
        <div className="self-vital-row"><span>ROLE</span><strong>{me.roleId ? ROLE_COPY[me.roleId].name.toUpperCase() : '—'}</strong></div>
        <div className="self-vital-row"><span>STATUS</span><strong className="self-status">{selfStatus(me)}</strong></div>
        {room.public.wildcard?.unlocked && <div className="self-vital-row self-wildcard-row"><span>WILDCARD</span><strong>{room.public.wildcard.drawUsedByPlayer[viewerId] ? 'SPENT' : 'AVAILABLE'}</strong></div>}
      </div>
      <RoleAbilityDetail detail={room.private} room={room.public} compact />
      <details className="hand-items scene-inventory-access" aria-label="Visible inventory"><summary>Visible items ▾</summary>
        {presentItems(me.visibleInventory).map(item => <button type="button" key={item.instanceId} onClick={() => openIntent({ kind: 'ITEM', instanceId: item.instanceId, ownerId: viewerId, itemId: item.itemId })}><span>{stackName(item)}</span><small>Inspect</small></button>)}
      </details>
    </aside>}

    {!presentationBlocking && <nav className="match-utility" aria-label="Table tools">
      {!spectator && <button type="button" onClick={() => showPanel('OBJECTIVE')}>Contract</button>}
      {!spectator && <button type="button" onClick={() => showPanel('POCKETS')}>Pockets</button>}
      {!spectator && <button type="button" onClick={() => showPanel('CHAT')}>Chat</button>}
      {!spectator && <details className="match-role-card"><summary>Role</summary><div className="role-ability-detail"><RoleAbilityDetail detail={room.private} room={room.public} />{me?.roleId === 'locksmith' && <button type="button" disabled={action.busy || !hasCapability(room, 'INSPECT_CHEST')} onClick={() => void action.send({ type: 'INSPECT_CHEST' })}>{room.private.abilities?.locksmithRound === room.public.round?.number ? 'Tumbler Sense · USED THIS ROUND' : 'Tumbler Sense · inspect chest (free)'}</button>}</div></details>}
      {!spectator && <button type="button" onClick={() => showPanel('HISTORY')}>Log</button>}
      {!spectator && <button type="button" aria-label="Settings" onClick={() => showPanel('SETTINGS')}>⚙</button>}
      <button type="button" aria-label={spectator ? 'God view' : 'Handbook'} onClick={() => showPanel(spectator ? 'SPECTATOR' : 'HANDBOOK')}>?</button>
    </nav>}
    {!presentationBlocking && !spectator && !results && !panel && !forcedDecision && cameraHint && <button type="button" className="camera-onboarding" onClick={() => setCameraHint(false)}>Drag to look around · click an item or player · dismiss ×</button>}
    {!presentationBlocking && intermission && panel !== 'MARKETS' && !results && room.public.shop && <p className="persistent-shop-order">PUBLIC ORDER: {room.public.shop.order.map((id, index) => `${index + 1}. ${playerName(room.public, id)}`).join(' → ')}{!spectator && <> · YOUR TURN = {room.public.shop.order.indexOf(viewerId) + 1 || '—'}</>}</p>}
    {!presentationBlocking && !spectator && <button type="button" className="scene-event-feed" onClick={() => showPanel('HISTORY')} aria-label="Open event log">
      {[...(room.public.events ?? [])].filter(event => event.publicText).slice(-3).map(event => <span key={event.id}>{event.publicText}</span>)}
    </button>}

    {!presentationBlocking && !spectator && !results && !intermission && !wildcardPending && <nav className="action-dock" aria-label="Your actions" data-threat-menu={threatMenuOpen || undefined} onPointerLeave={() => setThreatMenuOpen(false)}>
      <div className="action-buttons">
        {hasCapability(room, 'TRADE') && <button type="button" aria-label="[1] ⇄ Trade" aria-keyshortcuts="1" onPointerEnter={() => setThreatMenuOpen(false)} onClick={() => showPanel('TRADE')}><kbd aria-hidden="true">1</kbd>⇄ Trade</button>}
        {hasCapability(room, 'THREAT') && <button type="button" className="threat" aria-label="[2] ⚠ Threaten" aria-keyshortcuts="2" onPointerEnter={() => setThreatMenuOpen(true)} onClick={() => showPanel('THREAT')}><kbd aria-hidden="true">2</kbd>⚠ Threaten</button>}
        {hasCapability(room, 'DRAW_WILDCARD') && <button type="button" className="wildcard-draw-action" disabled={action.busy} onPointerEnter={() => setThreatMenuOpen(false)} onClick={() => void action.send({ type: 'DRAW_WILDCARD' })}>✦ Draw Wildcard · Primary Action</button>}
        {hasCapability(room, 'LOOT_DOWNED') && <button type="button" className="immediate-loot" onPointerEnter={() => setThreatMenuOpen(false)} onClick={() => showPanel('DOWNED', { targetPlayerId: room.public.turn?.immediateLoot?.targetId, immediateLoot: true })}>Take immediate loot</button>}
        {hasCapability(room, 'SKIP_LOOT') && <button type="button" className="end-turn" disabled={action.busy} onPointerEnter={() => setThreatMenuOpen(false)} onClick={() => void action.send({ type: 'SKIP_LOOT' })}>Skip loot</button>}
        {hasCapability(room, 'PASS_TURN') && !room.public.turn?.primaryUsed && <button type="button" aria-keyshortcuts="Space" className="end-turn pass-turn" disabled={action.busy} onPointerEnter={() => setThreatMenuOpen(false)} onClick={() => void action.send({ type: 'PASS_TURN' })}><kbd aria-hidden="true">␣</kbd>PASS TURN</button>}
      </div>
      <div className="action-extras">
        {hasCapability(room, 'THREAT') && <div className="action-mode-strip" aria-label="Threat modes" onPointerEnter={() => setThreatMenuOpen(true)}><span>⚠ THREATEN ▸</span><button type="button" onClick={() => showPanel('THREAT', { threatMode: 'OPEN' })}>OPEN DEMAND</button><button type="button" onClick={() => showPanel('THREAT', { threatMode: 'COVERED' })}>UNDER CLOTH</button></div>}
        <div className="contextual-actions">
        {hasCapability(room, 'DOWNED_INTERACTION') && room.public.players.some(player => player.id !== viewerId && player.life === 'DOWNED') && <button type="button" className="contextual-action" onClick={() => showPanel('DOWNED')}>Help / loot</button>}
        {hasCapability(room, 'INSPECT_CHEST') && <button type="button" className="contextual-action" onClick={() => showPanel('CHESTS')}>Inspect chest</button>}
        {hasCapability(room, 'LEAVE_TABLE') && <button type="button" className="contextual-action exit" onClick={() => showPanel('OBJECTIVE')}>Exit ready</button>}
        {hasCapability(room, 'CONCEDE') && <button type="button" className="contextual-action" disabled={action.busy} onClick={() => setConcedeConfirm(true)}>Concede · 0 points</button>}
        </div>
      </div>
    </nav>}
    {!presentationBlocking && !spectator && !results && intermission && <nav className="action-dock market-dock" aria-label="Your actions"><div className="action-buttons"><button type="button" onClick={() => { setMarketView('PUBLIC'); setPanel('MARKETS'); }}>Public Shop</button><button type="button" className="threat" onClick={() => { setMarketView('BLACK'); setPanel('MARKETS'); }}>Black Market</button></div></nav>}

    {!connected && <p className="connection-banner match-toast" role="status">Reconnecting…</p>}
    <div className={`action-feedback ${action.error || action.uncertain ? 'action-feedback-error' : ''}`} aria-live="polite">{action.error ? <p className="form-error" role="alert">{action.error.message}</p> : <p>{action.pending ? 'Waiting for the table…' : action.notice}</p>}
      {action.uncertain && <button className="button secondary" disabled={action.pending || !connected} onClick={() => void action.retry()}>Retry last action safely</button>}
    </div>

    {!presentationBlocking && !(wildcardPending && panel === 'WILDCARD') && panel && panel !== 'MARKETS' && !results && <MatchOverlay panel={panel} tone={panel === 'THREAT' ? 'danger' : panel === 'OBJECTIVE' ? 'paper' : 'neutral'} title={panelTitle(panel)} onClose={closePanel}>
      {!spectator && actionProps && panel === 'USE_ITEM' && <UseItemForm key={`${sceneSelection.itemInstanceId ?? 'default-item'}:${sceneSelection.targetPlayerId ?? 'default-target'}:${sceneSelection.pocketIndex ?? 'default-pocket'}`} {...actionProps} preferredItemId={sceneSelection.itemInstanceId} preferredTargetId={sceneSelection.targetPlayerId} preferredPocketIndex={sceneSelection.pocketIndex} />}
      {!spectator && actionProps && panel === 'TRADE' && <TradeForm key={`${sceneSelection.requestedItemInstanceId ?? 'no-item'}`} {...actionProps} preferredTargetId={sceneSelection.targetPlayerId} preferredRequestedItemId={sceneSelection.requestedItemInstanceId} onTargetChange={targetPlayerId => setSceneSelection(current => ({ ...current, targetPlayerId }))} onCancel={closePanel} />}
      {!spectator && actionProps && panel === 'THREAT' && <ThreatForm key={`${sceneSelection.threatMode ?? 'OPEN'}`} {...actionProps} preferredTargetId={sceneSelection.targetPlayerId} preferredMode={sceneSelection.threatMode} onTargetChange={targetPlayerId => setSceneSelection(current => ({ ...current, targetPlayerId }))} onCancel={closePanel} />}
      {!spectator && actionProps && panel === 'DOWNED' && <DownedForm key={`${sceneSelection.targetPlayerId ?? 'default-downed'}:${sceneSelection.immediateLoot ? 'immediate' : 'normal'}`} {...actionProps} preferredTargetId={sceneSelection.targetPlayerId} immediate={sceneSelection.immediateLoot} />}
      {!spectator && panel === 'OBJECTIVE' && <PrivateDetail detail={room.private} room={room.public} />}
      {!spectator && actionProps && panel === 'POCKETS' && <InventoryForm {...actionProps} onSelectPocketItem={instanceId => { setSceneItemId(instanceId); setPanel(null); }} />}
      {panel === 'PLAYERS' && <PlayerRoster room={room.public} viewerId={viewerId} {...(sceneSelection.targetPlayerId ? { selectedPlayerId: sceneSelection.targetPlayerId } : {})} />}
      {panel === 'CHESTS' && <><ChestPanel room={room} />{!spectator && hasCapability(room, 'INSPECT_CHEST') && <button className="button primary full-width" disabled={action.busy} onClick={() => void action.send({ type: 'INSPECT_CHEST' })}>Inspect Standard Chest</button>}</>}
      {panel === 'HISTORY' && <div className="reference-social"><EventLog room={room.public} /><PrivateInspectionHistory room={room} viewerId={viewerId} /></div>}
      {!spectator && panel === 'SETTINGS' && <ReferenceSettings engine={audio.engine} started={audio.started} onStart={audio.start}><VoicePanel room={room} client={client} connected={connected} viewerId={viewerId} capability={voice} /></ReferenceSettings>}
      {panel === 'HANDBOOK' && <ReferenceHandbook />}
      {spectator && panel === 'SPECTATOR' && <><SpectatorDetails room={room} /><div className="sr-only"><ChestPanel room={room} /></div></>}
    </MatchOverlay>}

    {!presentationBlocking && !spectator && intermission && panel === 'MARKETS' && !results && actionProps && <MarketFocus {...actionProps} send={action.send} initialView={marketView} onViewChange={onMarketView} onClose={closePanel} />}

    {!presentationBlocking && !results && <TurnFeedback room={room.public} />}
    {!presentationBlocking && !spectator && !results && room.private.tasks && <TasksHud tasks={room.private.tasks} audio={audio.started ? audio.engine : undefined} />}
    {!presentationBlocking && !panel && !forcedDecision && <ReferenceStateOverlays room={room} viewerId={viewerId} send={action.send} busy={action.busy} openContract={() => showPanel('OBJECTIVE')} />}

    {!presentationBlocking && chatOpen && !results && <aside className="match-chat-drawer" aria-label="Chat drawer"><button type="button" className="chat-close" onClick={() => setChatOpen(false)}>Close chat ×</button><ChatPanel room={room} sendChat={action.chat} busy={action.busy} draft={chatDraft} onDraftChange={setChatDraft} selectedRecipient={chatRecipient} onRecipientChange={setChatRecipient} /></aside>}
    {concedeConfirm && hasCapability(room, 'CONCEDE') && <div className="concede-confirm" role="dialog" aria-label="Confirm Concede"><h2>Concede this match?</h2><p>Your objective can no longer be completed. Concede for 0 points and enter Spectator mode. Your hidden objective stays private.</p><button type="button" disabled={action.busy} onClick={() => void action.send({ type: 'CONCEDE' }).then(accepted => { if (accepted) setConcedeConfirm(false); })}>Concede · 0 points</button><button type="button" onClick={() => setConcedeConfirm(false)}>Keep playing</button></div>}

    {interactionParticipant && <div className="forced-decision"><PendingInteraction room={room} send={action.send} busy={action.busy} /></div>}
    {!spectator && hasCapability(room, 'OVERFLOW_CHOICE') && <div className="forced-decision"><OverflowDecision room={room} send={action.send} busy={action.busy} /></div>}
    {!spectator && wildcardPending && !results && <div hidden={Boolean(panel && panel !== 'WILDCARD')}><WildcardDecision key={room.private.pendingWildcard!.cardId} room={room} send={action.send} busy={action.busy} connected={connected} targetPlayerId={wildcardTargetId} onTargetPlayerChange={setWildcardTargetId} /></div>}
    {wildcardPending && panel && panel !== 'WILDCARD' && <button type="button" className="wildcard-resume" onClick={closePanel}>Resume Wildcard · normal turn clock is running</button>}
    {!results && <WildcardPublicFeedback room={room.public} ownerDecision={wildcardPending} />}
    {results && <div className="results-stage"><Results room={room} /><section className="panel rematch-card"><h2>Match complete</h2>{!canRematch(room, viewerId) && <p>Waiting for the host to start a rematch.</p>}<div className="results-actions">{canRematch(room, viewerId) && <button className="button primary" disabled={action.busy} onClick={() => void action.rematch()}>Rematch</button>}{onReturnHome && <button className="button secondary return-home" type="button" onClick={onReturnHome}>Return to Home</button>}</div></section></div>}
    <MatchResolutionOverlays room={room} viewerId={viewerId} />

    {debug && <details className="debug-dashboard"><summary>Development dashboard</summary><div className="match-columns"><div className="table-column"><PlayerRoster room={room.public} viewerId={viewerId} /><ChestPanel room={room} /><EventLog room={room.public} /></div><div className="controls-column">{!spectator && !results && (intermission ? <Markets room={room} send={action.send} busy={action.busy} /> : <TurnActions room={room} send={action.send} busy={action.busy} />)}</div></div></details>}
  </div>;
}

type MatchPanel = null | 'WILDCARD' | 'USE_ITEM' | 'TRADE' | 'THREAT' | 'DOWNED' | 'MARKETS' | 'OBJECTIVE' | 'POCKETS' | 'PLAYERS' | 'CHESTS' | 'HISTORY' | 'CHAT' | 'SETTINGS' | 'HANDBOOK' | 'SPECTATOR';

const PANEL_TITLES: Record<Exclude<MatchPanel, null>, string> = {
  WILDCARD: 'Draw Wildcard',
  USE_ITEM: 'Use item', TRADE: 'Trade', THREAT: 'Threat', DOWNED: 'Downed player', MARKETS: 'Intermission markets', OBJECTIVE: 'Private contract', POCKETS: 'Your Pockets', PLAYERS: 'At the table', CHESTS: 'Table chests', HISTORY: 'Table history', CHAT: 'Table chat', SETTINGS: 'Settings', HANDBOOK: 'Handbook', SPECTATOR: 'Spectator god view',
};
function panelTitle(panel: Exclude<MatchPanel, null>) { return PANEL_TITLES[panel]; }

function MatchOverlay({ title, tone, panel, onClose, children }: { title: string; tone: 'neutral' | 'danger' | 'paper'; panel: Exclude<MatchPanel, null>; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, [onClose]);
  return <div className="match-overlay-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className={`match-overlay reference-interface ${tone}`} data-panel={panel} role="dialog" aria-modal="true" aria-label={title}>
    <header><h2>{title}</h2><button type="button" aria-label={`Close ${title}`} onClick={onClose}>Close</button></header>
    <div className="match-overlay-body">{children}</div>
  </section></div>;
}
