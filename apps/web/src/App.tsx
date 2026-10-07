import { useEffect, useRef, useState } from 'react';
import type { RoleId } from '@the-table/game';
import { isSpectatorView, ROLE_COPY, ROLES, type AnyRoomView, type ClientError, type RoomView, type SessionPayload, type SessionSnapshot, type VoiceCapability } from './protocol';
import { TableClient } from './socket';
import { MatchView } from './MatchView';
import { ConnectionRestoreGate } from './reconnect';

const STORAGE_KEY = 'the-table/session-v1';

type Screen = 'connecting' | 'entry' | 'lobby' | 'playing';
type EntryMode = 'create' | 'join';

function idempotencyKey(): string {
  return crypto.randomUUID();
}

function loadSession(): SessionSnapshot | undefined {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return undefined;
    const candidate = value as Partial<SessionSnapshot>;
    if (typeof candidate.code !== 'string' || typeof candidate.reconnectToken !== 'string' || typeof candidate.playerId !== 'string') return undefined;
    return { code: candidate.code, reconnectToken: candidate.reconnectToken, playerId: candidate.playerId };
  } catch {
    return undefined;
  }
}

function saveSession(snapshot: SessionSnapshot) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot)); } catch { /* Storage restrictions must not hide an admitted seat. */ }
}

export function App() {
  const [client] = useState(() => new TableClient());
  const restoreGate = useRef(new ConnectionRestoreGate());
  const skipRestore = useRef(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [screen, setScreen] = useState<Screen>('connecting');
  const [entryMode, setEntryMode] = useState<EntryMode>('create');
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [view, setView] = useState<AnyRoomView>();
  const room = view && !isSpectatorView(view) ? view : undefined;
  const [voice, setVoice] = useState<VoiceCapability>({ enabled: false, iceServers: [], relayConfigured: false });
  const [playerId, setPlayerId] = useState<string>();
  const [connected, setConnected] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<ClientError>();

  useEffect(() => {
    let cancelled = false;
    const restore = async (generation: number) => {
      if (cancelled || !restoreGate.current.begin(generation)) return;
      const session = loadSession();
      try {
        if (!session) {
          setScreen('entry');
          return;
        }
        setScreen('connecting');
        const response = await client.reconnect(session.code, session.reconnectToken);
        if (cancelled || !restoreGate.current.isCurrent(generation)) return;
        if (!response.ok) {
          window.localStorage.removeItem(STORAGE_KEY);
          setError(response.error);
          setScreen('entry');
          return;
        }
        applySession(response.data);
      } finally {
        restoreGate.current.complete(generation);
      }
    };
    const removeConnection = client.onConnection(isConnected => {
      setConnected(isConnected);
      if (!isConnected) setSessionReady(false);
      if (isConnected && skipRestore.current) { skipRestore.current = false; setScreen('entry'); }
      else if (isConnected) void restore(restoreGate.current.nextConnection());
    });
    const removeConnectionError = client.onConnectionError(message => {
      if (cancelled) return;
      setError({ code: 'CONNECTION_FAILED', message });
      setScreen(current => current === 'connecting' ? 'entry' : current);
    });
    const removeView = client.onView(applyView);
    const removeCapabilities = client.onCapabilities(value => setVoice(value.voice));
    const clearRoom = (reason: string) => {
      window.localStorage.removeItem(STORAGE_KEY);
      setView(undefined);
      setPlayerId(undefined);
      setError({ code: 'SESSION_ENDED', message: reason });
      setScreen('entry');
    };
    const removeClosed = client.onClosed(value => clearRoom(`This room has closed: ${value.reason.toLowerCase().replaceAll('_', ' ')}.`));
    const removeReplaced = client.onReplaced(() => {
      // Another tab may already have persisted its rotated credential. Do not erase it.
      setView(undefined);
      setPlayerId(undefined);
      setError({ code: 'SESSION_REPLACED', message: 'Your seat was reconnected in another browser. This session has ended.' });
      setScreen('entry');
      skipRestore.current = true;
      client.disconnect();
      client.connect();
    });
    client.connect();
    return () => {
      cancelled = true;
      removeConnection();
      removeConnectionError();
      removeView();
      removeCapabilities();
      removeClosed();
      removeReplaced();
      client.disconnect();
    };
  }, [client]);

  const currentPlayer = room?.public.players.find(player => player.id === playerId);
  const isHost = Boolean(room && playerId === room.public.hostPlayerId);
  const canStart = Boolean(isHost && room && room.public.players.length >= 2 && room.public.players.every(player => player.roleId && player.ready));

  function applyView(next: AnyRoomView) {
    setView(previous => previous?.public.id === next.public.id && previous.public.revision > next.public.revision ? previous : next);
    setScreen(next.public.status === 'LOBBY' ? 'lobby' : 'playing');
  }

  function applySession(data: SessionPayload) {
    const { view: next } = data;
    const id = data.playerId ?? next.viewerPlayerId ?? (!isSpectatorView(next) ? next.private.playerId : undefined);
    if (id) {
      saveSession({ code: next.public.code, reconnectToken: data.reconnectToken, playerId: id });
      setPlayerId(id);
    }
    setSessionReady(true);
    setVoice(data.voice ?? { enabled: false, iceServers: [], relayConfigured: false });
    setError(undefined);
    applyView(next);
  }

  async function submitEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (working) return;
    setWorking(true);
    setError(undefined);
    const response = entryMode === 'create' ? await client.create(name) : await client.join(joinCode, name);
    setWorking(false);
    if (response.ok) applySession(response.data);
    else setError(response.error);
  }

  async function claimRole(roleId: RoleId) {
    if (working || currentPlayer?.roleId === roleId) return;
    setWorking(true);
    setError(undefined);
    const response = await client.claimRole(roleId, idempotencyKey(), room?.public.revision);
    setWorking(false);
    if (!response.ok) setError(response.error);
  }

  async function toggleReady() {
    if (!room || !currentPlayer || working) return;
    setWorking(true);
    setError(undefined);
    const response = await client.ready(!currentPlayer.ready, idempotencyKey(), room.public.revision);
    setWorking(false);
    if (!response.ok) setError(response.error);
  }

  async function startMatch() {
    if (!room || !canStart || working) return;
    setWorking(true);
    setError(undefined);
    const response = await client.start(idempotencyKey(), room.public.revision);
    setWorking(false);
    if (!response.ok) setError(response.error);
  }

  if (screen === 'connecting' && !view) return <LoadingView connected={connected} error={error} onContinue={() => setScreen('entry')} />;
  if (screen === 'entry') return <EntryView mode={entryMode} setMode={setEntryMode} name={name} setName={setName} joinCode={joinCode} setJoinCode={setJoinCode} error={error} working={working} connected={connected} onSubmit={submitEntry} />;
  if (view && view.public.status !== 'LOBBY' && playerId) return <Shell connected={connected}><MatchView room={view} client={client} connected={connected && sessionReady} viewerId={playerId} voice={voice} onView={applyView} /></Shell>;
  if (!room || !currentPlayer) return <LoadingView connected={connected} error={error} onContinue={() => setScreen('entry')} />;
  return <LobbyView room={room} currentPlayerId={currentPlayer.id} isHost={isHost} canStart={canStart} connected={connected} working={working} error={error} onClaim={claimRole} onReady={toggleReady} onStart={startMatch} />;
}

function Shell({ children, connected }: { children: React.ReactNode; connected: boolean }) {
  return <main className="app-shell">
    <header className="masthead">
      <a className="wordmark" href="/" aria-label="The Table home">THE TABLE</a>
      <span className={connected ? 'connection connected' : 'connection'}>{connected ? 'Connected' : 'Reconnecting'}</span>
    </header>
    {children}
  </main>;
}

function LoadingView({ connected, error, onContinue }: { connected: boolean; error?: ClientError | undefined; onContinue: () => void }) {
  return <Shell connected={connected}>
    <section className="loading-stage" aria-live="polite">
      <div className="table-mark" aria-hidden="true"><span /><span /><span /><span /></div>
      <p>{error ? error.message : 'Restoring your seat at the table'}</p>
      {error && <button className="button quiet" type="button" onClick={onContinue}>Enter a room</button>}
    </section>
  </Shell>;
}

function EntryView(props: {
  mode: EntryMode; setMode: (mode: EntryMode) => void; name: string; setName: (value: string) => void; joinCode: string; setJoinCode: (value: string) => void;
  error?: ClientError | undefined; working: boolean; connected: boolean; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const { mode, setMode, name, setName, joinCode, setJoinCode, error, working, connected, onSubmit } = props;
  return <Shell connected={connected}>
    <section className="entry-layout">
      <div className="entry-copy">
        <p className="kicker">A game of private motives</p>
        <h1>Take your seat.</h1>
        <p className="lede">Choose a role, guard your objective, and decide what the table gets to know.</p>
      </div>
      <form className="entry-form" onSubmit={onSubmit} noValidate>
        <div className="segmented" role="tablist" aria-label="Room choice">
          <button className={mode === 'create' ? 'selected' : ''} type="button" role="tab" aria-selected={mode === 'create'} onClick={() => setMode('create')}>Create room</button>
          <button className={mode === 'join' ? 'selected' : ''} type="button" role="tab" aria-selected={mode === 'join'} onClick={() => setMode('join')}>Join room</button>
        </div>
        <label>Your name<input autoComplete="nickname" maxLength={24} value={name} onChange={event => setName(event.target.value)} placeholder="Name at the table" required /></label>
        {mode === 'join' && <label>Room code<input className="code-input" autoComplete="off" maxLength={6} value={joinCode} onChange={event => setJoinCode(event.target.value.toUpperCase())} placeholder="ABC123" required /></label>}
        {error && <p className="form-error" role="alert">{error.message}</p>}
        <button className="button primary" type="submit" disabled={working || !connected}>{working ? 'Connecting' : mode === 'create' ? 'Create room' : 'Join room'}</button>
      </form>
    </section>
  </Shell>;
}

function LobbyView(props: {
  room: RoomView; currentPlayerId: string; isHost: boolean; canStart: boolean; connected: boolean; working: boolean; error?: ClientError | undefined;
  onClaim: (roleId: RoleId) => void; onReady: () => void; onStart: () => void;
}) {
  const { room, currentPlayerId, isHost, canStart, connected, working, error, onClaim, onReady, onStart } = props;
  const currentPlayer = room.public.players.find(player => player.id === currentPlayerId)!;
  const availableSeats = 4 - room.public.players.length;
  const selectedRoles = new Set(room.public.players.flatMap(player => player.roleId ? [player.roleId] : []));
  const startCopy = canStart ? 'Start match' : isHost ? 'Waiting for ready players' : 'Host starts when everyone is ready';

  return <Shell connected={connected}>
    <section className="lobby-heading">
      <div>
        <p className="kicker">Room code</p>
        <h1>{room.public.code}</h1>
      </div>
      <p>{room.public.players.length} of 4 seated. {availableSeats > 0 ? `${availableSeats} seat${availableSeats === 1 ? '' : 's'} open.` : 'The table is full.'}</p>
    </section>
    <section className="lobby-grid">
      <div className="role-area">
        <div className="section-intro"><h2>Choose a role</h2><p>Roles are unique. Your starting kit becomes public once the game begins.</p></div>
        <div className="role-grid">
          {ROLES.map(roleId => {
            const owner = room.public.players.find(player => player.roleId === roleId);
            const selected = currentPlayer.roleId === roleId;
            const unavailable = Boolean(owner && owner.id !== currentPlayerId);
            const detail = ROLE_COPY[roleId];
            return <button className={`role-card ${selected ? 'selected' : ''}`} type="button" key={roleId} onClick={() => onClaim(roleId)} disabled={working || !connected || unavailable} aria-pressed={selected}>
              <span className="role-name">{detail.name}</span>
              <span className="role-kit">{detail.kit}</span>
              <span className="role-ability">{unavailable ? `Chosen by ${owner?.name}` : detail.ability}</span>
            </button>;
          })}
        </div>
      </div>
      <aside className="lobby-side">
        <div className="seats">
          <h2>At the table</h2>
          {room.public.players.map(player => <div className="seat" key={player.id}>
            <span>{player.name}{player.id === currentPlayerId ? ' (you)' : ''}</span>
            <span>{player.roleId ? ROLE_COPY[player.roleId].name : 'Choosing role'}{player.ready ? ' - ready' : ''}</span>
          </div>)}
        </div>
        <div className="lobby-actions">
          {error && <p className="form-error" role="alert">{error.message}</p>}
          <button className="button primary" type="button" disabled={working || !connected || !currentPlayer.roleId} onClick={onReady}>{currentPlayer.ready ? 'Not ready' : 'Ready up'}</button>
          <button className="button secondary" type="button" disabled={working || !connected || !canStart} onClick={onStart}>{startCopy}</button>
          <p className="host-note">{isHost ? 'You can start once at least two players have selected a unique role and are ready.' : 'The host starts the match after all seated players are ready.'}</p>
        </div>
      </aside>
    </section>
  </Shell>;
}
