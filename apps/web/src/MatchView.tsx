import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { AUDIO_CUE_IDS, createAudioEngine, type AudioEngine } from '@the-table/audio';
import type { AnyRoomView, ClientError, PlayerCommand, VoiceCapability } from './protocol';
import { isSpectatorView } from './protocol';
import type { TableClient } from './socket';
import { dispatchRequest, type ActionRequest } from './action-request';
import { canRematch, commandEnvelope, hasCapability, playerName } from './gameplay';
import { GameTableScene } from './GameTableScene';
import { ChestPanel, EventLog, MatchHeader, OverflowDecision, PendingInteraction, PlayerRoster, PrivateDetail, Results, SpectatorDetails } from './MatchPanels';
import { Markets, ReadOnlyPublicShop, TurnActions } from './ActionForms';
import { VoicePanel } from './VoicePanel';

/** Keep an uncertain submission intact until it can be retried with the same receipt key. */
export function useMatchActions({ client, room, connected, viewerId, onView }: { client: TableClient; room: AnyRoomView; connected: boolean; viewerId: string; onView: (view: AnyRoomView) => void }) {
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

function AudioControls({ engine, started, onStart, introState, onSkip }: { engine: AudioEngine; started: boolean; onStart: () => void; introState: ReturnType<AudioEngine['intro']['state']>; onSkip: () => void }) {
  const [audioState, setAudioState] = useState(engine.state());
  const refresh = () => setAudioState(engine.state());
  return <section className="panel audio-panel" aria-label="Audio">
    <div className="section-heading"><h2>Sound</h2><span className="muted">{started ? (audioState.muted ? 'Muted' : 'On') : 'Off'}</span></div>
    {!started && <button className="button secondary full-width" type="button" onClick={() => { onStart(); refresh(); }}>Enable sound</button>}
    <div className="audio-controls" aria-hidden={!started}>
      <label className="check-row"><input type="checkbox" checked={audioState.muted} disabled={!started} onChange={event => { engine.setMuted(event.target.checked); refresh(); }} /><span>Mute</span></label>
      <label>Volume<input type="range" min="0" max="1" step="0.01" value={audioState.volume} disabled={!started} onChange={event => { engine.setVolume(Number(event.target.value)); refresh(); }} /></label>
    </div>
    {started && (introState.phase === 'PLAYING' || introState.phase === 'ARMED') && <div className="intro-notice" role="status"><span>{introState.phase === 'PLAYING' ? 'The table is taking shape…' : 'Intro ready.'}</span><button className="button quiet" type="button" onClick={onSkip}>Skip intro</button></div>}
  </section>;
}

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
    if (!active || event.kind === 'MATCH_STARTED') continue;
    const payload = privateByEvent.get(event.id);
    engine.handleEvent(payload === undefined ? event : { ...event, privatePayloads: { [viewerId]: payload } }, isSpectatorView(room) ? undefined : viewerId);
  }
}

function useMatchAudio(room: AnyRoomView, viewerId: string) {
  const engineRef = useRef<AudioEngine | undefined>(undefined);
  if (!engineRef.current) engineRef.current = createAudioEngine();
  const engine = engineRef.current;
  const [started, setStarted] = useState(false);
  const [introState, setIntroState] = useState(() => engine.intro.arm());
  const ambienceRef = useRef<'room' | 'shop' | undefined>(undefined);
  const observedEventsRef = useRef(new Set<string>());

  useEffect(() => () => { void engine.dispose(); }, [engine]);

  useEffect(() => {
    feedNewAudioEvents(engine, room, viewerId, observedEventsRef.current, started);
  }, [engine, room, viewerId, started]);

  useEffect(() => {
    if (!started) return;
    const phase = room.public.status === 'RESULTS' ? undefined : room.public.round?.phase === 'INTERMISSION' ? 'shop' : 'room';
    if (phase === ambienceRef.current) return;
    engine.stopAmbience();
    ambienceRef.current = phase;
    if (phase) engine.startAmbience(phase);
  }, [engine, room.public.round?.phase, room.public.status, started]);

  useEffect(() => {
    if (!started || introState.phase !== 'PLAYING') return;
    const timer = window.setInterval(() => setIntroState(engine.intro.tick()), 100);
    return () => window.clearInterval(timer);
  }, [engine, introState.phase, started]);

  const start = () => {
    if (started) return;
    void engine.start().then(() => {
      setStarted(true);
      setIntroState(engine.intro.start());
      engine.play(AUDIO_CUE_IDS.intro);
    });
  };
  const skip = () => setIntroState(engine.intro.skip());
  return { engine, started, introState, start, skip };
}

export function MatchView({ room, client, connected, viewerId, voice, onView }: { room: AnyRoomView; client: TableClient; connected: boolean; viewerId: string; voice: VoiceCapability; onView: (view: AnyRoomView) => void }) {
  const audio = useMatchAudio(room, viewerId);
  const action = useMatchActions({ client, room, connected, viewerId, onView });
  const spectator = isSpectatorView(room);
  const results = room.public.status === 'RESULTS';
  const intermission = room.public.round?.phase === 'INTERMISSION';
  return <div className="match-layout" data-viewer={spectator ? 'spectator' : 'player'}>
    <MatchHeader room={room} viewerId={viewerId} />
    {!connected && <p className="connection-banner" role="status">Reconnecting to your seat. The table continues while you are away; controls return with your authorized state.</p>}
    <div className="action-feedback" aria-live="polite">{action.error ? <p className="form-error" role="alert">{action.error.message}</p> : <p>{action.pending ? 'Waiting for the table…' : action.notice}</p>}
      {action.uncertain && <button className="button secondary" disabled={action.pending || !connected} onClick={() => void action.retry()}>Retry last action safely</button>}
    </div>
    <PendingInteraction room={room} send={action.send} busy={action.busy} />
    {!spectator && <OverflowDecision room={room} send={action.send} busy={action.busy} />}
    <div className="match-columns">
      <div className="table-column"><GameTableScene room={room.public} />
        {results ? <Results room={room} /> : <PlayerRoster room={room.public} viewerId={viewerId} />}
        <ChestPanel room={room} />
        {spectator && intermission && <ReadOnlyPublicShop room={room} />}
        <EventLog room={room.public} />
      </div>
      <div className="controls-column">
        {!spectator && <AudioControls engine={audio.engine} started={audio.started} onStart={audio.start} introState={audio.introState} onSkip={audio.skip} />}
        {!spectator && <VoicePanel room={room} client={client} connected={connected} viewerId={viewerId} capability={voice} />}
        {results && <section className="panel"><h2>Another round?</h2>{canRematch(room, viewerId) ? <><p className="muted">Return everyone to the lobby with the same names and seats. Each player readies up again.</p><button className="button primary full-width" disabled={action.busy} onClick={() => void action.rematch()}>Rematch</button></> : <p className="muted">Waiting for the host to open a rematch.</p>}</section>}
        {spectator ? <SpectatorDetails room={room} /> : <>
          {!results && (intermission ? <Markets room={room} send={action.send} busy={action.busy} /> : <TurnActions room={room} send={action.send} busy={action.busy} />)}
          <PrivateDetail detail={room.private} room={room.public} />
        </>}
        <ChatPanel room={room} sendChat={action.chat} busy={action.busy} />
      </div>
    </div>
  </div>;
}
