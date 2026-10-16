import { GAME_CONSTANTS, ROLES as ROLE_KITS } from '@the-table/content';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { RoleId } from '@the-table/game';
import { AUDIO_CUE_IDS, createAudioEngine } from '@the-table/audio';
import { isSpectatorView, ROLE_COPY, ROLES, type AnyRoomView, type ClientError, type RoomView, type SessionPayload, type SessionSnapshot, type VoiceCapability } from './protocol';
import { TableClient } from './socket';
import { MatchView } from './MatchView';
import { ConnectionRestoreGate, shouldForgetRestoreSession } from './reconnect';
import { ReferenceItemArt, ReferencePortrait } from './ReferenceItemArt';
import { EntryTableBackdrop } from './EntryTableBackdrop';
import { ReferenceHandbook, ReferenceSettings } from './ReferenceInterfaces';
import { HowToPlay } from './HowToPlay';
import { useOwnedAudioEngineLifecycle } from './audio-lifecycle';

import { readTutorialPreferences, saveTutorialPreferences, recordTutorialMetric } from './tutorial-storage';
import './tutorial.css';
const Tutorial = lazy(() => import('./Tutorial'));

const STORAGE_KEY = 'the-table/session-v1';

export type Screen = 'connecting' | 'entry' | 'lobby' | 'playing';
type EntryMode = 'create' | 'join';

function idempotencyKey(): string {
  return crypto.randomUUID();
}

/** The title and room lobby share the supplied "The Long Room" music bed. */
export function preMatchMusic(screen: Screen): 'title' | undefined {
  return screen === 'entry' || screen === 'lobby' ? 'title' : undefined;
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
  const [tutorial, setTutorial] = useState<{ chapter: number; key: number }>();
  const [tutorialPrefs, setTutorialPrefs] = useState(readTutorialPreferences);
  const startTutorial = (chapter = 1) => { setTutorialPrefs(saveTutorialPreferences({ skippedForNow: true })); setTutorial({ chapter, key: Date.now() }); };
  const [client] = useState(() => new TableClient());
  const [audio] = useState(() => createAudioEngine());
  const [audioStarted, setAudioStarted] = useState(false);
  const [audioUnavailable, setAudioUnavailable] = useState(false);
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
  const audioStarting = useRef(false);

  useOwnedAudioEngineLifecycle(audio);

  const enableAudio = useCallback(() => {
    if (audioStarted || audioUnavailable || audioStarting.current) return;
    audioStarting.current = true;
    void audio.start()
      .then(() => { setAudioStarted(true); audio.play(AUDIO_CUE_IDS.uiConfirm); })
      .catch(() => setAudioUnavailable(true))
      .finally(() => { audioStarting.current = false; });
  }, [audio, audioStarted, audioUnavailable]);

  useEffect(() => {
    if (audioStarted || audioUnavailable) return undefined;
    const unlock = () => enableAudio();
    window.addEventListener('pointerdown', unlock, { capture: true, once: true });
    window.addEventListener('keydown', unlock, { capture: true, once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock, { capture: true });
      window.removeEventListener('keydown', unlock, { capture: true });
    };
  }, [audioStarted, audioUnavailable, enableAudio]);

  useEffect(() => {
    if (!audioStarted) return;
    const track = tutorial ? 'tutorial' : preMatchMusic(screen);
    if (track) {
      audio.setThreat(false);
      audio.setMusic(track);
    } else if (screen === 'connecting') {
      audio.setMusic(undefined);
    }
  }, [audio, audioStarted, screen, tutorial]);

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
        let response = await client.reconnect(session.code, session.reconnectToken);
        for (let attempt = 1; !response.ok && !shouldForgetRestoreSession(response.error.code) && attempt < 3 && restoreGate.current.isCurrent(generation) && !cancelled; attempt += 1) {
          await new Promise(resolve => window.setTimeout(resolve, attempt * 600));
          if (!restoreGate.current.isCurrent(generation) || cancelled) return;
          response = await client.reconnect(session.code, session.reconnectToken);
        }
        // Persist rotation even if an effect replay superseded this render. The
        // transport coalesces same-token reconnects, so no accepted credential is
        // lost between StrictMode cleanup and its replacement effect.
        if (response.ok) {
          const next = response.data.view;
          const id = response.data.playerId ?? next.viewerPlayerId ?? (!isSpectatorView(next) ? next.private.playerId : undefined);
          if (id) saveSession({ code: next.public.code, reconnectToken: response.data.reconnectToken, playerId: id });
        }
        if (cancelled || !restoreGate.current.isCurrent(generation)) return;
        if (!response.ok) {
          if (shouldForgetRestoreSession(response.error.code)) window.localStorage.removeItem(STORAGE_KEY);
          setError(response.error);
          if (shouldForgetRestoreSession(response.error.code)) setScreen('entry');
          else {
            setScreen('connecting');
            window.setTimeout(() => { if (!cancelled && restoreGate.current.isLatest(generation)) client.restart(); }, 1_200);
          }
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
  const canStart = Boolean(isHost && room && room.public.players.length >= GAME_CONSTANTS.minimumPlayers && room.public.players.every(player => player.roleId && player.ready && player.connection === 'CONNECTED'));

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
    if (response.ok) { applySession(response.data); if (audioStarted) audio.play(AUDIO_CUE_IDS.lobbyJoin); }
    else setError(response.error);
  }

  async function claimRole(roleId: RoleId) {
    if (working || currentPlayer?.roleId === roleId) return;
    setWorking(true);
    setError(undefined);
    const response = await client.claimRole(roleId, idempotencyKey(), room?.public.revision);
    setWorking(false);
    if (!response.ok) setError(response.error); else if (audioStarted) audio.play(AUDIO_CUE_IDS.uiSelect);
  }

  async function toggleReady() {
    if (!room || !currentPlayer || working) return;
    setWorking(true);
    setError(undefined);
    const response = await client.ready(!currentPlayer.ready, idempotencyKey(), room.public.revision);
    setWorking(false);
    if (!response.ok) setError(response.error); else if (audioStarted) audio.play(AUDIO_CUE_IDS.lobbyReady);
  }

  async function startMatch() {
    if (!room || !canStart || working) return;
    setWorking(true);
    setError(undefined);
    const response = await client.start(idempotencyKey(), room.public.revision);
    setWorking(false);
    if (!response.ok) setError(response.error); else if (audioStarted) audio.play(AUDIO_CUE_IDS.lobbyMatch);
  }

  function returnHome() {
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* Navigation still works when storage is unavailable. */ }
    setView(undefined);
    setPlayerId(undefined);
    setSessionReady(false);
    setError(undefined);
    setEntryMode('create');
    setScreen('entry');
    skipRestore.current = true;
    client.disconnect();
    client.connect();
  }

  async function leaveLobby() {
    if (!room || room.public.status !== 'LOBBY' || working || !connected || !sessionReady) return;
    setWorking(true);
    setError(undefined);
    const response = await client.leaveLobby();
    setWorking(false);
    if (response.ok) returnHome();
    else setError(response.error);
  }

  let content: React.ReactNode;
  if (tutorial) content = <Suspense fallback={<p className="loading-stage">Setting the table…</p>}><Tutorial key={tutorial.key} chapter={tutorial.chapter} audio={audio} audioStarted={audioStarted} onEnableAudio={enableAudio} onExit={join => { setTutorial(undefined); setTutorialPrefs(readTutorialPreferences()); setEntryMode(join ? 'join' : 'create'); setScreen('entry'); }} /></Suspense>;
  else if (screen === 'connecting' && !view) content = <LoadingView connected={connected} error={error} onContinue={() => setScreen('entry')} />;
  else if (screen === 'entry') content = <EntryView onTutorial={() => startTutorial(tutorialPrefs.tutorialCompleted ? 1 : tutorialPrefs.tutorialLastChapter)} tutorialResume={!tutorialPrefs.tutorialCompleted && tutorialPrefs.tutorialLastChapter > 1} mode={entryMode} setMode={setEntryMode} name={name} setName={setName} joinCode={joinCode} setJoinCode={setJoinCode} error={error} working={working} connected={connected} onSubmit={submitEntry} audio={audio} audioStarted={audioStarted} onEnableAudio={enableAudio} />;
  else if (view && view.public.status !== 'LOBBY' && playerId) content = <Shell connected={connected}><MatchView room={view} client={client} connected={connected && sessionReady} viewerId={playerId} voice={voice} audioEngine={audio} audioStarted={audioStarted} onEnableAudio={enableAudio} onView={applyView} onReturnHome={returnHome} /></Shell>;
  else if (!room || !currentPlayer) content = <LoadingView connected={connected} error={error} onContinue={() => setScreen('entry')} />;
  else content = <LobbyView room={room} currentPlayerId={currentPlayer.id} isHost={isHost} canStart={canStart} connected={connected && sessionReady} working={working} error={error} onClaim={claimRole} onReady={toggleReady} onStart={startMatch} onReturnHome={leaveLobby} />;
  return <>{!audioStarted && <button className="button quiet global-audio" type="button" disabled={audioUnavailable} onClick={enableAudio}>{audioUnavailable ? 'Sound unavailable' : 'Enable sound'}</button>}{content}{!tutorial && !view && !loadSession() && !tutorialPrefs.tutorialCompleted && !tutorialPrefs.skippedForNow && <div className="tutorial-welcome-backdrop"><section className="tutorial-welcome" role="dialog" aria-modal="true" aria-label="New to The Table?"><h2>New to The Table?</h2><p>Learn the game against The Dealer.<br />About 6–8 minutes.</p><button className="tutorial-continue" type="button" onClick={() => startTutorial()}>PLAY TUTORIAL</button><button type="button" onClick={() => { setTutorialPrefs(saveTutorialPreferences({ skippedForNow: true })); recordTutorialMetric({ kind: 'skipped' }); }}>SKIP FOR NOW</button></section></div>}</>;
}

function Shell({ children, connected }: { children: React.ReactNode; connected: boolean }) {
  return <main className="app-shell">
    <header className="masthead">
      <a className="wordmark" href="/" aria-label="The Table home">THE TABLE</a>
      <span className={connected ? 'connection connected' : 'connection'}>{connected ? '● LINKED' : '◌ RECONNECTING'}</span>
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
  onTutorial: () => void; tutorialResume: boolean;
  mode: EntryMode; setMode: (mode: EntryMode) => void; name: string; setName: (value: string) => void; joinCode: string; setJoinCode: (value: string) => void;
  error?: ClientError | undefined; working: boolean; connected: boolean; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  audio: ReturnType<typeof createAudioEngine>; audioStarted: boolean; onEnableAudio: () => void;
}) {
  const { mode, setMode, name, setName, joinCode, setJoinCode, error, working, connected, onSubmit, audio, audioStarted, onEnableAudio } = props;
  const [creating, setCreating] = useState(false);
  const [utility, setUtility] = useState<'rules' | 'items' | 'settings' | null>(null);
  const utilityOpener = useRef<HTMLElement | null>(null);
  const utilityDialog = useRef<HTMLDivElement>(null);
  const openUtility = (value: 'rules' | 'items' | 'settings', opener: HTMLElement) => { utilityOpener.current = opener; setUtility(value); };
  useEffect(() => {
    if (!utility) return;
    const dialog = utilityDialog.current;
    dialog?.querySelector<HTMLElement>('button:not([tabindex="-1"])')?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setUtility(null); }
      if (event.key !== 'Tab' || !dialog) return;
      const controls = [...dialog.querySelectorAll<HTMLElement>('button, input, select, textarea, [tabindex="0"]')].filter(control => !control.hasAttribute('disabled') && control.tabIndex >= 0);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => { window.removeEventListener('keydown', handleKey); const opener = utilityOpener.current; requestAnimationFrame(() => opener?.focus()); };
  }, [utility]);
  const playButtonPress = (event: React.MouseEvent<HTMLElement>) => {
    if (audioStarted && (event.target as HTMLElement).closest('button:not(:disabled)')) audio.play(AUDIO_CUE_IDS.uiSelect);
  };
  if (mode === 'join') return <Shell connected={connected}>
    <section className="join-stage" onClickCapture={playButtonPress}>
      <form className="join-card" onSubmit={onSubmit} noValidate>
        <label className="join-code-label">ROOM CODE
          <span className={`room-code-boxes ${error ? 'error' : ''}`} aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <b key={index}>{joinCode[index] ?? ''}</b>)}</span>
          <input className="room-code-hidden" aria-label="Room Code" autoComplete="off" maxLength={6} value={joinCode} onChange={event => setJoinCode(event.target.value.toUpperCase())} required />
        </label>
        {error && <p className="join-error" role="alert">✕ {error.message.toUpperCase()}</p>}
        <label>NAME AT THE TABLE<input autoComplete="nickname" maxLength={24} value={name} onChange={event => setName(event.target.value)} placeholder="VESNA_" required /></label>
        <button className="join-submit" type="submit" disabled={working || !connected}>{working ? '⧗ KNOCKING…' : 'TAKE A SEAT'}</button>
      </form>
      <button className="join-back" type="button" onClick={() => setMode('create')}>← TITLE</button>
    </section>
  </Shell>;
  return <Shell connected={connected}>
    <section className="entry-layout" onClickCapture={playButtonPress}>
      <EntryTableBackdrop />
      <span className="entry-version">RECOMMENDED: 3–4 PLAYERS</span>
      <div className="entry-copy">
        <h1>The Table</h1>
        {!creating ? <div className="entry-menu" role="group" aria-label="Room choice"><button className="selected" type="button" onClick={() => setCreating(true)}>▶ CREATE ROOM</button><button type="button" onClick={() => setMode('join')}>JOIN ROOM</button><button type="button" onClick={props.onTutorial}>{props.tutorialResume ? 'RESUME TUTORIAL' : 'TUTORIAL'}</button></div> : <form className="entry-form entry-create-form" onSubmit={onSubmit} noValidate><label>NAME AT THE TABLE<input autoFocus autoComplete="nickname" maxLength={24} value={name} onChange={event => setName(event.target.value)} placeholder="VESNA_" required /></label>{error && <p className="form-error" role="alert">✕ {error.message.toUpperCase()}</p>}<button className="button primary" type="submit" disabled={working || !connected}>{working ? '⧗ KNOCKING…' : 'CREATE ROOM'}</button><button className="button quiet" type="button" onClick={() => setCreating(false)}>← BACK</button></form>}
        <div className="entry-links"><button type="button" onClick={event => openUtility('rules', event.currentTarget)}>HOW TO PLAY</button><button type="button" onClick={event => openUtility('items', event.currentTarget)}>HANDBOOK</button><button type="button" onClick={event => openUtility('settings', event.currentTarget)}>SETTINGS · AUDIO</button></div>
      </div>
      {utility && <div ref={utilityDialog} className={`entry-utility-overlay entry-utility-${utility}`} role="dialog" aria-modal="true" aria-label={utility === 'rules' ? 'How to play' : utility === 'items' ? 'Handbook' : 'Settings'}>
        {utility !== 'items' && <button className="entry-utility-close" type="button" onClick={() => setUtility(null)}>× CLOSE</button>}
        {utility === 'rules' ? <HowToPlay onTutorial={props.onTutorial} /> : utility === 'items' ? <ReferenceHandbook onClose={() => setUtility(null)} /> : <ReferenceSettings engine={audio} started={audioStarted} onStart={onEnableAudio} />}
      </div>}
    </section>
  </Shell>;
}

function LobbyView(props: {
  room: RoomView; currentPlayerId: string; isHost: boolean; canStart: boolean; connected: boolean; working: boolean; error?: ClientError | undefined;
  onClaim: (roleId: RoleId) => void; onReady: () => void; onStart: () => void; onReturnHome: () => void;
}) {
  const { room, currentPlayerId, isHost, canStart, connected, working, error, onClaim, onReady, onStart, onReturnHome } = props;
  const currentPlayer = room.public.players.find(player => player.id === currentPlayerId)!;
  const startCopy = canStart ? 'Start match' : room.public.players.length < GAME_CONSTANTS.minimumPlayers ? 'Need at least 3 players' : isHost ? 'Waiting for ready players' : 'Host starts when everyone is ready';
  const [choosingRole, setChoosingRole] = useState(!currentPlayer.roleId);
  useEffect(() => { if (!currentPlayer.roleId) setChoosingRole(true); }, [currentPlayer.roleId]);

  if (choosingRole) return <Shell connected={connected}>
    <section className="role-select-stage">
      <header><div><p className="kicker">ROOM {room.public.code}</p><h1>Choose your starting kit</h1></div><button className="button quiet lobby-home" type="button" disabled={working || !connected} onClick={onReturnHome}>← RETURN HOME</button></header>
      <div className="role-select-grid">
        {ROLES.map(roleId => {
          const owner = room.public.players.find(player => player.roleId === roleId);
          const selected = currentPlayer.roleId === roleId;
          const unavailable = Boolean(owner && owner.id !== currentPlayerId);
          const detail = ROLE_COPY[roleId];
          return <button className={`role-select-card role-${roleId} ${selected ? 'selected' : ''}`} type="button" key={roleId}
            onClick={() => { onClaim(roleId); setChoosingRole(false); }} disabled={working || !connected || unavailable} aria-pressed={selected}>
            <span className="role-portrait" aria-hidden="true"><ReferencePortrait roleId={roleId} /></span>
            <span className="role-name">{detail.name}</span>
            <span className="role-kit" aria-label={detail.kit}>{ROLE_KITS[roleId].startingItems.map((itemId, itemIndex) => <ReferenceItemArt itemId={itemId} size={30} label="" key={`${itemId}-${itemIndex}`} />)}</span>
            <span className="role-ability">{detail.ability}</span>
            <span className="role-state">{unavailable ? `TAKEN · ${owner?.name.toUpperCase()}` : selected ? '▶ SELECTED' : 'AVAILABLE'}</span>
          </button>;
        })}
      </div>
      {error && <p className="form-error" role="alert">✕ {error.message.toUpperCase()}</p>}
    </section>
  </Shell>;

  return <Shell connected={connected}>
    <section className="lobby-board">
      <div className="lobby-main">
        <header className="lobby-code"><div><p>ROOM CODE</p><h1>{room.public.code}</h1></div><div><button type="button" onClick={() => void navigator.clipboard?.writeText(room.public.code)}>⧉ COPY</button></div></header>
        <div className="lobby-seat-list">
          {Array.from({ length: 4 }, (_, seat) => {
            const player = room.public.players.find(candidate => candidate.seat === seat);
            if (!player) return <div className="lobby-seat empty" key={seat}><span className="seat-index">{['I', 'II', 'III', 'IV'][seat]}</span><i /><strong>EMPTY SEAT</strong><span>—</span><b>…</b></div>;
            return <div className={`lobby-seat ${player.id === currentPlayerId ? 'self' : ''}`} key={seat}>
              <span className="seat-index">{['I', 'II', 'III', 'IV'][player.seat] ?? player.seat + 1}</span><i />
              <strong>{player.name.toUpperCase()} {player.id === room.public.hostPlayerId ? <small>· HOST</small> : null}{player.id === currentPlayerId ? <small> · YOU</small> : null}</strong>
              <span>{player.roleId ? ROLE_COPY[player.roleId].name.toUpperCase() : 'CHOOSING ROLE'}</span>
              <b>{player.ready ? '✓ READY' : '… NOT READY'}</b>
            </div>;
          })}
        </div>
        <button className="button quiet lobby-home" type="button" disabled={working || !connected} onClick={onReturnHome}>← RETURN HOME</button>
      </div>
      <aside className="lobby-side">
        <div className={`lobby-role-plaque role-${currentPlayer.roleId ?? 'none'}`}>{currentPlayer.roleId && <ReferencePortrait roleId={currentPlayer.roleId} />}<span>{currentPlayer.roleId ? ROLE_COPY[currentPlayer.roleId].name : 'No role'}</span></div>
        <button className="button quiet" type="button" onClick={() => setChoosingRole(true)}>CHANGE ROLE</button>
        <button className="button secondary" type="button" disabled={working || !connected || !currentPlayer.roleId} onClick={onReady}>{currentPlayer.ready ? 'NOT READY' : 'READY UP'}</button>
        <button className="button primary" type="button" disabled={working || !connected || !canStart} onClick={onStart}>{startCopy.toUpperCase()}</button>
        <p className="host-note">{room.public.players.filter(player => player.ready).length} OF {room.public.players.length} SEATED READY</p>
        {error && <p className="form-error" role="alert">✕ {error.message.toUpperCase()}</p>}
      </aside>
    </section>
  </Shell>;
}
