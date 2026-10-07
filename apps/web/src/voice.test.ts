import { describe, expect, it, vi } from 'vitest';
import { reconcileVoiceAvailability, VoiceMesh, type VoiceBrowserAdapter, type VoiceCandidate, type VoiceDescription, type VoicePeerConnection, type VoiceStream, type VoiceTrack } from './voice';

class FakeTrack implements VoiceTrack {
  enabled = true;
  stop = vi.fn();
}

class FakeStream implements VoiceStream {
  readonly track = new FakeTrack();
  getTracks(): VoiceTrack[] { return [this.track]; }
}

class FakePeer implements VoicePeerConnection {
  signalingState = 'stable';
  connectionState = 'new';
  localDescription: VoiceDescription | null = null;
  remoteDescription: VoiceDescription | null = null;
  onicecandidate: ((event: { candidate: VoiceCandidate | null }) => void) | null = null;
  ontrack: ((event: { streams: VoiceStream[] }) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  readonly descriptions: VoiceDescription[] = [];
  readonly candidates: VoiceCandidate[] = [];
  readonly tracks: VoiceTrack[] = [];
  close = vi.fn(() => { this.connectionState = 'closed'; this.signalingState = 'closed'; });
  addTrack(track: VoiceTrack): void { this.tracks.push(track); }
  async createOffer(): Promise<VoiceDescription> { return { type: 'offer', sdp: 'offer-sdp' }; }
  async createAnswer(): Promise<VoiceDescription> { return { type: 'answer', sdp: 'answer-sdp' }; }
  async setLocalDescription(description: VoiceDescription): Promise<void> {
    this.descriptions.push(description);
    if (description.type === 'rollback') { this.localDescription = null; this.signalingState = 'stable'; return; }
    this.localDescription = description;
    this.signalingState = description.type === 'offer' ? 'have-local-offer' : 'stable';
  }
  async setRemoteDescription(description: VoiceDescription): Promise<void> {
    this.descriptions.push(description);
    this.remoteDescription = description;
    this.signalingState = description.type === 'offer' ? 'have-remote-offer' : 'stable';
  }
  async addIceCandidate(candidate: VoiceCandidate): Promise<void> { this.candidates.push(candidate); }
}

function fixture(selfId = 'p1') {
  const stream = new FakeStream();
  const peers: FakePeer[] = [];
  const detach = vi.fn();
  const adapter: VoiceBrowserAdapter = {
    getMicrophone: vi.fn(async () => stream),
    createPeerConnection: vi.fn(() => { const peer = new FakePeer(); peers.push(peer); return peer; }),
    attachRemoteAudio: vi.fn(() => detach),
  };
  const sent: Array<{ to: string; signal: unknown }> = [];
  const mesh = new VoiceMesh(selfId, [{ urls: 'stun:stun.example.test' }], adapter, async (to, signal) => { sent.push({ to, signal }); });
  return { stream, peers, detach, adapter, sent, mesh };
}

describe('VoiceMesh', () => {
  it('requests the microphone only on opt-in and gives a useful permission error', async () => {
    const f = fixture();
    const denied = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    vi.mocked(f.adapter.getMicrophone).mockRejectedValueOnce(denied);

    expect(f.mesh.snapshot().phase).toBe('OFF');
    expect(await f.mesh.start()).toBe(false);
    expect(f.mesh.snapshot()).toMatchObject({ phase: 'OFF', error: expect.stringContaining('permission was denied') });
    expect(f.peers).toHaveLength(0);
  });

  it('uses the stable player-id ordering to make exactly one initial offer', async () => {
    const f = fixture('p1');
    await f.mesh.start();
    f.mesh.setPeers(['p2']);

    await vi.waitFor(() => expect(f.sent).toEqual([{ to: 'p2', signal: { type: 'offer', sdp: 'offer-sdp' } }]));
    expect(f.peers[0]?.tracks).toEqual([f.stream.track]);

    const higher = fixture('p2');
    await higher.mesh.start();
    higher.mesh.setPeers(['p1']);
    await Promise.resolve();
    expect(higher.sent).toEqual([]);
  });

  it('buffers ICE, answers offers, and rolls back on polite glare', async () => {
    const f = fixture('p2');
    await f.mesh.start();
    f.mesh.setPeers(['p1']);
    const peer = f.peers[0]!;
    peer.signalingState = 'have-local-offer';
    peer.localDescription = { type: 'offer', sdp: 'colliding-local' };

    await f.mesh.handleSignal('p1', { type: 'candidate', candidate: 'candidate-one' });
    await f.mesh.handleSignal('p1', { type: 'offer', sdp: 'remote-offer' });

    expect(peer.descriptions.map(description => description.type)).toEqual(['rollback', 'offer', 'answer']);
    expect(peer.candidates).toEqual([{ candidate: 'candidate-one' }]);
    expect(f.sent).toEqual([{ to: 'p1', signal: { type: 'answer', sdp: 'answer-sdp' } }]);
  });

  it('ignores colliding offers on the deterministic impolite side', async () => {
    const f = fixture('p1');
    await f.mesh.start();
    f.mesh.setPeers(['p2']);
    await vi.waitFor(() => expect(f.sent).toHaveLength(1));

    await f.mesh.handleSignal('p2', { type: 'offer', sdp: 'colliding-offer' });

    expect(f.sent).toHaveLength(1);
    expect(f.peers[0]?.remoteDescription).toBeNull();
  });

  it('mutes tracks and completely tears down tracks, peers, and remote audio', async () => {
    const f = fixture();
    await f.mesh.start();
    f.mesh.setPeers(['p2']);
    const peer = f.peers[0]!;
    peer.ontrack?.({ streams: [new FakeStream()] });

    f.mesh.setMuted(true);
    expect(f.stream.track.enabled).toBe(false);
    f.mesh.leave();

    expect(f.stream.track.stop).toHaveBeenCalledOnce();
    expect(peer.close).toHaveBeenCalledOnce();
    expect(f.detach).toHaveBeenCalledOnce();
    expect(f.mesh.snapshot()).toEqual({ phase: 'OFF', muted: false, peers: {} });
  });

  it('stops capture and peers on transport loss while allowing the caller to retain reconnect intent', async () => {
    const f = fixture();
    await f.mesh.start();
    f.mesh.setPeers(['p2']);
    const peer = f.peers[0]!;
    peer.ontrack?.({ streams: [new FakeStream()] });

    const transition = reconcileVoiceAvailability(f.mesh, { connected: false, eligible: true, enabled: true });

    expect(transition).toBe('PAUSED');
    expect(f.stream.track.stop).toHaveBeenCalledOnce();
    expect(peer.close).toHaveBeenCalledOnce();
    expect(f.detach).toHaveBeenCalledOnce();
    expect(f.mesh.snapshot().phase).toBe('OFF');
  });
});
