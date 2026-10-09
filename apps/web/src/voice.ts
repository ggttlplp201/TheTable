import type { VoiceIceServer, VoiceSignal } from './protocol';

export interface VoiceTrack {
  enabled: boolean;
  stop(): void;
}

export interface VoiceStream {
  getTracks(): VoiceTrack[];
}

export interface VoiceDescription {
  type: 'offer' | 'answer' | 'rollback';
  sdp?: string;
}

export interface VoiceCandidate {
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
}

export interface VoicePeerConnection {
  signalingState: string;
  connectionState: string;
  localDescription: VoiceDescription | null;
  remoteDescription: VoiceDescription | null;
  onicecandidate: ((event: { candidate: VoiceCandidate | null }) => void) | null;
  ontrack: ((event: { streams: VoiceStream[] }) => void) | null;
  onconnectionstatechange: (() => void) | null;
  addTrack(track: VoiceTrack, stream: VoiceStream): void;
  createOffer(): Promise<VoiceDescription>;
  createAnswer(): Promise<VoiceDescription>;
  setLocalDescription(description: VoiceDescription): Promise<void>;
  setRemoteDescription(description: VoiceDescription): Promise<void>;
  addIceCandidate(candidate: VoiceCandidate): Promise<void>;
  close(): void;
}

export interface VoiceBrowserAdapter {
  getMicrophone(): Promise<VoiceStream>;
  createPeerConnection(iceServers: readonly VoiceIceServer[]): VoicePeerConnection;
  attachRemoteAudio(playerId: string, stream: VoiceStream): () => void;
}

export type VoicePeerStatus = 'CONNECTING' | 'CONNECTED' | 'INTERRUPTED' | 'FAILED';
export type VoicePhase = 'OFF' | 'REQUESTING_MICROPHONE' | 'JOINED';

export interface VoiceMeshSnapshot {
  phase: VoicePhase;
  muted: boolean;
  error?: string;
  peers: Record<string, VoicePeerStatus>;
}

export type VoiceAvailabilityTransition = 'AVAILABLE' | 'PAUSED' | 'CLEARED';

/** Applies capture teardown independently from React so reconnect privacy is regression-testable. */
export function reconcileVoiceAvailability(
  mesh: Pick<VoiceMesh, 'snapshot' | 'leave'>,
  availability: { connected: boolean; eligible: boolean; enabled: boolean },
): VoiceAvailabilityTransition {
  if (!availability.eligible || !availability.enabled) {
    if (mesh.snapshot().phase !== 'OFF') mesh.leave();
    return 'CLEARED';
  }
  if (!availability.connected) {
    if (mesh.snapshot().phase !== 'OFF') mesh.leave();
    return 'PAUSED';
  }
  return 'AVAILABLE';
}

interface PeerState {
  connection: VoicePeerConnection;
  makingOffer: boolean;
  ignoreOffer: boolean;
  pendingCandidates: VoiceCandidate[];
  detachAudio?: () => void;
  queue: Promise<void>;
  closed: boolean;
}

function signalDescription(description: VoiceDescription): VoiceSignal {
  if ((description.type !== 'offer' && description.type !== 'answer') || typeof description.sdp !== 'string') {
    throw new Error('The browser produced an invalid voice description.');
  }
  return { type: description.type, sdp: description.sdp };
}

function microphoneMessage(error: unknown): string {
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Microphone permission was denied. Allow microphone access in your browser, then try again.';
  if (name === 'NotFoundError') return 'No microphone was found on this device.';
  if (name === 'NotReadableError' || name === 'AbortError') return 'The microphone is busy or unavailable. Close other callers and try again.';
  return error instanceof Error && error.message ? error.message : 'The microphone could not be started.';
}

/** Owns microphone and RTCPeerConnection lifetime; server presence is orchestrated by the React boundary. */
export class VoiceMesh {
  private stream: VoiceStream | undefined;
  private phase: VoicePhase = 'OFF';
  private muted = false;
  private error: string | undefined;
  private readonly peers = new Map<string, PeerState>();
  private readonly desiredPeers = new Set<string>();
  private readonly listeners = new Set<(snapshot: VoiceMeshSnapshot) => void>();
  private generation = 0;

  constructor(
    private readonly selfId: string,
    private readonly iceServers: readonly VoiceIceServer[],
    private readonly browser: VoiceBrowserAdapter,
    private readonly sendSignal: (toPlayerId: string, signal: VoiceSignal) => Promise<void>,
  ) {}

  snapshot(): VoiceMeshSnapshot {
    return {
      phase: this.phase,
      muted: this.muted,
      ...(this.error ? { error: this.error } : {}),
      peers: Object.fromEntries([...this.peers].map(([id, peer]) => [id, this.peerStatus(peer.connection.connectionState)])),
    };
  }

  subscribe(listener: (snapshot: VoiceMeshSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  get joined(): boolean { return this.phase === 'JOINED'; }

  async start(): Promise<boolean> {
    if (this.phase === 'JOINED') return true;
    if (this.phase === 'REQUESTING_MICROPHONE') return false;
    const generation = ++this.generation;
    this.phase = 'REQUESTING_MICROPHONE';
    this.error = undefined;
    this.emit();
    try {
      const stream = await this.browser.getMicrophone();
      if (generation !== this.generation) {
        for (const track of stream.getTracks()) track.stop();
        return false;
      }
      this.stream = stream;
      this.phase = 'JOINED';
      this.muted = false;
      this.emit();
      this.reconcilePeers();
      return true;
    } catch (error) {
      if (generation !== this.generation) return false;
      this.phase = 'OFF';
      this.error = microphoneMessage(error);
      this.emit();
      return false;
    }
  }

  setPeers(playerIds: readonly string[]): void {
    this.desiredPeers.clear();
    for (const playerId of [...new Set(playerIds)].sort()) if (playerId !== this.selfId) this.desiredPeers.add(playerId);
    this.reconcilePeers();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    for (const track of this.stream?.getTracks() ?? []) track.enabled = !muted;
    this.emit();
  }

  clearError(): void {
    this.error = undefined;
    this.emit();
  }

  leave(): void {
    this.generation += 1;
    this.desiredPeers.clear();
    for (const playerId of [...this.peers.keys()]) this.closePeer(playerId);
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    this.stream = undefined;
    this.phase = 'OFF';
    this.muted = false;
    this.error = undefined;
    this.emit();
  }

  dispose(): void {
    this.leave();
    this.listeners.clear();
  }

  async handleSignal(fromPlayerId: string, signal: VoiceSignal): Promise<void> {
    if (!this.stream || this.phase !== 'JOINED' || fromPlayerId === this.selfId) return;
    // The server only delivers signals between opted-in eligible room members.
    // Accept a signal that wins the race with the corresponding presence event.
    this.desiredPeers.add(fromPlayerId);
    const peer = this.ensurePeer(fromPlayerId);
    return this.enqueue(peer, async () => {
      if (signal.type === 'candidate') {
        if (peer.ignoreOffer) return;
        const candidate: VoiceCandidate = {
          candidate: signal.candidate,
          ...(signal.sdpMid !== undefined ? { sdpMid: signal.sdpMid } : {}),
          ...(signal.sdpMLineIndex !== undefined ? { sdpMLineIndex: signal.sdpMLineIndex } : {}),
        };
        if (peer.connection.remoteDescription) await peer.connection.addIceCandidate(candidate);
        else peer.pendingCandidates.push(candidate);
        return;
      }

      const offerCollision = signal.type === 'offer' && (peer.makingOffer || peer.connection.signalingState !== 'stable');
      const polite = this.selfId.localeCompare(fromPlayerId) > 0;
      peer.ignoreOffer = !polite && offerCollision;
      if (peer.ignoreOffer) return;
      if (offerCollision) await peer.connection.setLocalDescription({ type: 'rollback' });
      await peer.connection.setRemoteDescription(signal);
      for (const candidate of peer.pendingCandidates.splice(0)) await peer.connection.addIceCandidate(candidate);
      if (signal.type === 'offer') {
        const answer = await peer.connection.createAnswer();
        await peer.connection.setLocalDescription(answer);
        await this.send(fromPlayerId, signalDescription(peer.connection.localDescription ?? answer), peer);
      }
    });
  }

  private reconcilePeers(): void {
    for (const playerId of [...this.peers.keys()]) if (!this.desiredPeers.has(playerId) || !this.stream) this.closePeer(playerId);
    if (!this.stream || this.phase !== 'JOINED') return;
    for (const playerId of this.desiredPeers) {
      if (this.peers.has(playerId)) continue;
      const peer = this.ensurePeer(playerId);
      if (this.selfId.localeCompare(playerId) < 0) void this.enqueue(peer, () => this.offer(playerId, peer));
    }
    this.emit();
  }

  private ensurePeer(playerId: string): PeerState {
    const existing = this.peers.get(playerId);
    if (existing) return existing;
    if (!this.stream) throw new Error('Voice is not active.');
    const connection = this.browser.createPeerConnection(this.iceServers);
    const peer: PeerState = { connection, makingOffer: false, ignoreOffer: false, pendingCandidates: [], queue: Promise.resolve(), closed: false };
    this.peers.set(playerId, peer);
    for (const track of this.stream.getTracks()) connection.addTrack(track, this.stream);
    connection.onicecandidate = event => {
      if (!event.candidate || peer.closed) return;
      const candidate = event.candidate;
      void this.send(playerId, {
        type: 'candidate',
        candidate: candidate.candidate,
        ...(candidate.sdpMid !== undefined ? { sdpMid: candidate.sdpMid } : {}),
        ...(candidate.sdpMLineIndex !== undefined ? { sdpMLineIndex: candidate.sdpMLineIndex } : {}),
      }, peer);
    };
    connection.ontrack = event => {
      const stream = event.streams[0];
      if (!stream || peer.closed) return;
      peer.detachAudio?.();
      peer.detachAudio = this.browser.attachRemoteAudio(playerId, stream);
    };
    connection.onconnectionstatechange = () => {
      if (connection.connectionState === 'failed') this.fail(`Voice could not connect to ${playerId}. Text chat remains available.`, peer);
      else this.emit();
    };
    this.emit();
    return peer;
  }

  private async offer(playerId: string, peer: PeerState): Promise<void> {
    if (peer.closed || peer.connection.signalingState !== 'stable') return;
    peer.makingOffer = true;
    try {
      const offer = await peer.connection.createOffer();
      if (peer.closed || peer.connection.signalingState !== 'stable') return;
      await peer.connection.setLocalDescription(offer);
      await this.send(playerId, signalDescription(peer.connection.localDescription ?? offer), peer);
    } finally {
      peer.makingOffer = false;
    }
  }

  private enqueue(peer: PeerState, operation: () => Promise<void>): Promise<void> {
    const pending = peer.queue.then(async () => {
      if (!peer.closed) await operation();
    });
    peer.queue = pending.catch(error => this.fail(error instanceof Error ? error.message : 'Voice negotiation failed.', peer));
    return pending.catch(() => undefined);
  }

  private async send(playerId: string, signal: VoiceSignal, peer: PeerState): Promise<void> {
    try {
      await this.sendSignal(playerId, signal);
    } catch (error) {
      this.fail(error instanceof Error ? error.message : 'Voice signaling failed.', peer);
    }
  }

  private fail(message: string, peer?: PeerState): void {
    if (peer?.closed) return;
    this.error = message;
    this.emit();
  }

  private closePeer(playerId: string): void {
    const peer = this.peers.get(playerId);
    if (!peer) return;
    peer.closed = true;
    peer.connection.onicecandidate = null;
    peer.connection.ontrack = null;
    peer.connection.onconnectionstatechange = null;
    peer.detachAudio?.();
    peer.connection.close();
    this.peers.delete(playerId);
    this.emit();
  }

  private peerStatus(state: string): VoicePeerStatus {
    if (state === 'connected') return 'CONNECTED';
    if (state === 'disconnected') return 'INTERRUPTED';
    if (state === 'failed' || state === 'closed') return 'FAILED';
    return 'CONNECTING';
  }

  private emit(): void {
    const snapshot = this.snapshot();
    for (const listener of this.listeners) listener(snapshot);
  }
}

export function createBrowserVoiceAdapter(): VoiceBrowserAdapter {
  return {
    async getMicrophone(): Promise<VoiceStream> {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser does not support microphone calling.');
      return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
    },
    createPeerConnection(iceServers): VoicePeerConnection {
      return new RTCPeerConnection({ iceServers: iceServers.map(server => ({ ...server })) }) as unknown as VoicePeerConnection;
    },
    attachRemoteAudio(playerId, stream): () => void {
      const audio = document.createElement('audio');
      audio.autoplay = true;
      audio.setAttribute('playsinline', '');
      audio.dataset.voicePeer = playerId;
      audio.className = 'voice-remote-audio';
      audio.srcObject = stream as MediaStream;
      document.body.append(audio);
      void audio.play().catch(() => undefined);
      return () => {
        audio.pause();
        audio.srcObject = null;
        audio.remove();
      };
    },
  };
}
