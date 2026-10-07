import { io, type Socket } from 'socket.io-client';
import type { RoleId } from '@the-table/game';
import type { AnyRoomView, CommandPayload, Result, RevisionAck, RoomView, SessionPayload, SpectatorRoomView, VoiceCapability, VoiceSignal } from './protocol';

type Acknowledgement<T> = (result: Result<T>) => void;

const ACK_TIMEOUT_MS = 10_000;

export class TableClient {
  private readonly socket: Socket;

  constructor(serverUrl = import.meta.env.VITE_SERVER_URL ?? window.location.origin.replace(/:5173$/, ':3001')) {
    this.socket = io(serverUrl, { autoConnect: false, transports: ['websocket', 'polling'] });
  }

  connect() {
    this.socket.connect();
  }

  disconnect() {
    this.socket.disconnect();
  }

  onConnection(listener: (connected: boolean) => void) {
    const onConnect = () => listener(true);
    const onDisconnect = () => listener(false);
    this.socket.on('connect', onConnect);
    this.socket.on('disconnect', onDisconnect);
    return () => {
      this.socket.off('connect', onConnect);
      this.socket.off('disconnect', onDisconnect);
    };
  }

  onConnectionError(listener: (message: string) => void): () => void {
    const handleError = (error: Error) => listener(error.message || 'Unable to reach the table.');
    this.socket.on('connect_error', handleError);
    return () => this.socket.off('connect_error', handleError);
  }

  onView(listener: (view: AnyRoomView) => void): () => void {
    this.socket.on('room:view', listener);
    return () => this.socket.off('room:view', listener);
  }

  onPublic(listener: (view: RoomView['public']) => void): () => void {
    this.socket.on('room:public', listener);
    return () => this.socket.off('room:public', listener);
  }

  onCapabilities(listener: (value: { voice: VoiceCapability }) => void): () => void {
    this.socket.on('server:capabilities', listener);
    return () => { this.socket.off('server:capabilities', listener); };
  }

  onVoicePeers(listener: (value: { playerIds: string[] }) => void): () => void {
    this.socket.on('voice:peers', listener);
    return () => { this.socket.off('voice:peers', listener); };
  }

  onVoiceSignal(listener: (value: { fromPlayerId: string; signal: VoiceSignal }) => void): () => void {
    this.socket.on('voice:signal', listener);
    return () => { this.socket.off('voice:signal', listener); };
  }

  onClosed(listener: (value: { code: string; reason: string }) => void): () => void {
    this.socket.on('room:closed', listener);
    return () => { this.socket.off('room:closed', listener); };
  }

  onReplaced(listener: () => void): () => void {
    this.socket.on('session:replaced', listener);
    return () => { this.socket.off('session:replaced', listener); };
  }

  create(name: string) {
    return this.emit<SessionPayload>('room:create', { name });
  }

  join(code: string, name: string) {
    return this.emit<SessionPayload>('room:join', { code, name });
  }

  reconnect(code: string, reconnectToken: string) {
    return this.emit<SessionPayload>('room:reconnect', { code, reconnectToken });
  }

  claimRole(roleId: RoleId, idempotencyKey: string, expectedRevision?: number) {
    return this.emit<RevisionAck>('lobby:claim-role', { roleId, idempotencyKey, expectedRevision });
  }

  ready(ready: boolean, idempotencyKey: string, expectedRevision?: number) {
    return this.emit<RevisionAck>('lobby:ready', { ready, idempotencyKey, expectedRevision });
  }

  start(idempotencyKey: string, expectedRevision?: number) {
    return this.emit<RevisionAck>('match:start', { idempotencyKey, expectedRevision });
  }

  sync() {
    return this.emit<{ view: AnyRoomView; voice?: VoiceCapability }>('room:sync', {});
  }

  spectate() {
    return this.emit<{ view: SpectatorRoomView; voice?: VoiceCapability }>('room:spectate', {});
  }

  rematch(idempotencyKey: string, expectedRevision?: number) {
    return this.emit<RevisionAck>('room:rematch', { idempotencyKey, expectedRevision });
  }

  command(command: CommandPayload) {
    return this.emit<RevisionAck>('room:command', command);
  }

  sendChat(payload: { text: string; idempotencyKey: string; expectedRevision?: number; roomId?: string; toPlayerId?: string }) {
    return this.emit<RevisionAck>('chat:send', payload);
  }

  signalVoice(payload: { toPlayerId: string; signal: unknown }) {
    return this.emit('voice:signal', payload);
  }

  joinVoice() {
    return this.emit<{ playerIds: string[] }>('voice:join', {});
  }

  leaveVoice() {
    return this.emit<{ left: true }>('voice:leave', {});
  }

  private emit<T>(event: string, payload: object): Promise<Result<T>> {
    return new Promise(resolve => {
      let settled = false;
      const finish = (result: Result<T>) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(result);
      };
      const timeout = setTimeout(() => finish({ ok: false, error: { code: 'TIMEOUT', message: 'The table did not answer. Check your connection and try again.' } }), ACK_TIMEOUT_MS);
      this.socket.emit(event, payload, finish as Acknowledgement<T>);
    });
  }
}
