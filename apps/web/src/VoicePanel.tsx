import { useEffect, useRef, useState } from 'react';
import type { AnyRoomView, VoiceCapability } from './protocol';
import { isSpectatorView } from './protocol';
import type { MatchClient } from './socket';
import { createBrowserVoiceAdapter, reconcileVoiceAvailability, VoiceMesh, type VoiceBrowserAdapter, type VoiceMeshSnapshot } from './voice';
import { playerName } from './gameplay';

const OFF_STATE: VoiceMeshSnapshot = { phase: 'OFF', muted: false, peers: {} };

function eligiblePlayerIds(room: AnyRoomView, viewerId: string): string[] {
  if (isSpectatorView(room)) return [];
  return room.public.players
    .filter(player => player.id !== viewerId && player.connection === 'CONNECTED' && player.life !== 'DEAD' && player.life !== 'EXITED')
    .map(player => player.id);
}

function statusLabel(status: string | undefined, participating: boolean): string {
  if (!participating) return 'Not in voice';
  if (status === 'CONNECTED') return 'Connected';
  if (status === 'INTERRUPTED') return 'Reconnecting';
  if (status === 'FAILED') return 'Connection failed';
  return 'Connecting';
}

export function VoicePanel({
  room,
  client,
  connected,
  viewerId,
  capability,
  browser = createBrowserVoiceAdapter(),
}: {
  room: AnyRoomView;
  client: MatchClient;
  connected: boolean;
  viewerId: string;
  capability: VoiceCapability;
  browser?: VoiceBrowserAdapter;
}) {
  const [mesh] = useState(() => new VoiceMesh(viewerId, capability.iceServers, browser, async (toPlayerId, signal) => {
    const result = await client.signalVoice({ toPlayerId, signal });
    if (!result.ok) throw new Error(result.error.message);
  }));
  const [state, setState] = useState(OFF_STATE);
  const [participants, setParticipants] = useState<Set<string>>(new Set());
  const [joinError, setJoinError] = useState<string>();
  const currentEligible = eligiblePlayerIds(room, viewerId);
  const localPlayer = room.public.players.find(player => player.id === viewerId);
  const eligible = !isSpectatorView(room) && localPlayer?.connection === 'CONNECTED' && localPlayer.life !== 'DEAD' && localPlayer.life !== 'EXITED';
  const eligibleRef = useRef(new Set(currentEligible));
  const connectedRef = useRef(connected);
  const wasConnected = useRef(connected);
  const wantsVoice = useRef(false);
  eligibleRef.current = new Set(currentEligible);
  connectedRef.current = connected;

  useEffect(() => mesh.subscribe(setState), [mesh]);

  useEffect(() => {
    const removePeers = client.onVoicePeers(({ playerIds }) => {
      const next = new Set(playerIds);
      setParticipants(next);
      mesh.setPeers(connectedRef.current ? playerIds.filter(playerId => eligibleRef.current.has(playerId)) : []);
    });
    const removeSignal = client.onVoiceSignal(({ fromPlayerId, signal }) => {
      if (connectedRef.current && eligibleRef.current.has(fromPlayerId)) void mesh.handleSignal(fromPlayerId, signal);
    });
    return () => { removePeers(); removeSignal(); };
  }, [client, mesh]);

  useEffect(() => {
    const allowed = new Set(currentEligible);
    setParticipants(previous => {
      const next = new Set([...previous].filter(playerId => allowed.has(playerId)));
      mesh.setPeers(connected ? [...next] : []);
      if (next.size === previous.size && [...next].every(playerId => previous.has(playerId))) return previous;
      return next;
    });
  }, [connected, currentEligible.join('|'), mesh]);

  useEffect(() => {
    const wasJoined = mesh.joined;
    const transition = reconcileVoiceAvailability(mesh, { connected, eligible, enabled: capability.enabled });
    if (transition === 'CLEARED') {
      wantsVoice.current = false;
      if (wasJoined) void client.leaveVoice();
      setParticipants(new Set());
    } else if (transition === 'PAUSED') {
      // A transport loss tears down capture and peers; the prior explicit opt-in
      // is remembered so the restored authenticated session can reacquire them.
      setParticipants(new Set());
    } else if (!wasConnected.current && wantsVoice.current) {
      void connectVoice();
    }
    wasConnected.current = connected;
  }, [capability.enabled, client, connected, eligible, mesh]);

  useEffect(() => () => {
    wantsVoice.current = false;
    if (mesh.joined) void client.leaveVoice();
    mesh.dispose();
  }, [client, mesh]);

  async function connectVoice(): Promise<void> {
    setJoinError(undefined);
    const started = await mesh.start();
    if (!started) {
      wantsVoice.current = false;
      return;
    }
    const result = await client.joinVoice();
    if (!result.ok) {
      setJoinError(result.error.message);
      wantsVoice.current = false;
      mesh.leave();
      return;
    }
    const next = new Set(result.data.playerIds);
    setParticipants(next);
    mesh.setPeers(result.data.playerIds.filter(playerId => eligibleRef.current.has(playerId)));
  }

  async function join(): Promise<void> {
    wantsVoice.current = true;
    await connectVoice();
  }

  function leave(): void {
    wantsVoice.current = false;
    void client.leaveVoice();
    mesh.leave();
    setParticipants(new Set());
    setJoinError(undefined);
  }

  if (!eligible) return null;
  const peerRows = room.public.players.filter(player => player.id !== viewerId && player.life !== 'DEAD' && player.life !== 'EXITED');
  const error = joinError ?? state.error;
  return <section className="panel voice-panel" aria-label="Table voice">
    <div className="section-heading"><h2>Table voice</h2><span className="muted">{state.phase === 'JOINED' ? (state.muted ? 'Muted' : 'Live') : state.phase === 'REQUESTING_MICROPHONE' ? 'Requesting mic' : 'Off'}</span></div>
    {!capability.enabled ? <p className="muted">Voice is disabled for this table. Global text remains available.</p> : <>
      {!capability.relayConfigured && <p className="voice-warning">Direct connections only: no TURN relay is configured, so voice may not connect on restrictive networks. Text chat remains available.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {state.phase === 'OFF' && <button className="button secondary full-width" type="button" disabled={!connected} onClick={() => void join()}>Join table voice</button>}
      {state.phase === 'REQUESTING_MICROPHONE' && <button className="button secondary full-width" type="button" disabled>Waiting for microphone permission…</button>}
      {state.phase === 'JOINED' && <div className="button-row voice-actions">
        <button className="button secondary" type="button" onClick={() => mesh.setMuted(!state.muted)}>{state.muted ? 'Unmute microphone' : 'Mute microphone'}</button>
        <button className="button quiet" type="button" onClick={leave}>Leave voice</button>
      </div>}
      <ul className="voice-peers" aria-label="Voice peer status">{peerRows.map(player => {
        const participating = participants.has(player.id);
        return <li key={player.id}><span>{playerName(room.public, player.id)}</span><span className="muted">{player.connection !== 'CONNECTED' ? 'Disconnected' : statusLabel(state.peers[player.id], participating)}</span></li>;
      })}</ul>
    </>}
  </section>;
}
