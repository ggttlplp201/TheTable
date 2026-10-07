import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Server, Socket } from 'socket.io';
import type { RoomState } from '@the-table/game';
import type { Deadline, GameAdapter } from './game-adapter.js';
import { Sessions } from './sessions.js';
import {
  chatInput, commandInput, createInput, emptyInput, fingerprint, joinInput,
  metadataInput, ProtocolError, readyInput, reconnectInput, rejection, roleInput,
  signalInput, type CommandInput, type Reply,
} from './protocol.js';
import { voiceCapability, type VoiceCapability, type VoiceIceServer } from './voice-config.js';

type Timer = ReturnType<typeof setTimeout>;
export interface Clock {
  now(): number;
  setTimeout(callback: () => void, delay: number): Timer;
  clearTimeout(timer: Timer): void;
}
const systemClock: Clock = { now: Date.now, setTimeout, clearTimeout };
interface Binding { code: string; playerId: string; generation: string }
interface Receipt { fingerprint: string; reply: Reply }
interface ChatMessage { id: string; at: number; fromPlayerId: string; channel: 'GLOBAL' | 'PRIVATE'; toPlayerId?: string; text: string }
const chatPayload = z.object({ text: z.string().trim().min(1).max(1000), toPlayerId: z.string().min(1).max(100).optional() }).strict();
interface RoomRuntime {
  code: string;
  queue: Promise<void>;
  queued: number;
  members: Map<string, { socket: Socket; generation: string }>;
  voiceMembers: Set<string>;
  receipts: Map<string, Receipt>;
  messages: ChatMessage[];
  expiresAt: number;
  timer: Timer | undefined;
  closed: boolean;
}
export interface RuntimeOptions {
  clock?: Clock;
  lobbyTtlMs?: number;
  activeTtlMs?: number;
  resultsTtlMs?: number;
  maxRooms?: number;
  maxCommandsPerRoom?: number;
  rateLimit?: { windowMs: number; requests: number };
  voiceEnabled?: boolean;
  voiceIceServers?: VoiceIceServer[];
  onError?: (error: unknown) => void;
}

/** All room work, including reconnect, disconnect and timers, shares one queue. */
export class RoomRuntimeService {
  private readonly rooms = new Map<string, RoomRuntime>();
  private readonly bindings = new Map<string, Binding>();
  private readonly sessions = new Sessions();
  private readonly clock: Clock;
  private readonly options: Required<Omit<RuntimeOptions, 'clock' | 'voiceIceServers'>> & { voiceIceServers: VoiceIceServer[] };
  private readonly voice: VoiceCapability;
  private stopping = false;

  constructor(private readonly io: Server, readonly game: GameAdapter, options: RuntimeOptions = {}) {
    this.clock = options.clock ?? systemClock;
    this.options = {
      lobbyTtlMs: options.lobbyTtlMs ?? 30 * 60_000,
      activeTtlMs: options.activeTtlMs ?? 24 * 60 * 60_000,
      resultsTtlMs: options.resultsTtlMs ?? 60 * 60_000,
      maxRooms: options.maxRooms ?? 1000,
      maxCommandsPerRoom: options.maxCommandsPerRoom ?? 20_000,
      rateLimit: options.rateLimit ?? { windowMs: 10_000, requests: 80 },
      voiceEnabled: options.voiceEnabled ?? false,
      voiceIceServers: options.voiceIceServers ?? [],
      onError: options.onError ?? (error => console.error(error)),
    };
    this.voice = voiceCapability(this.options.voiceEnabled, this.options.voiceIceServers);
    io.on('connection', socket => this.connect(socket));
  }

  get roomCount(): number { return this.rooms.size; }
  get ready(): boolean { return !this.stopping; }

  async close(): Promise<void> {
    this.stopping = true;
    await Promise.all([...this.rooms.values()].map(async context => {
      try { await this.enqueue(context, async () => this.destroy(context, 'SERVER_SHUTDOWN'), true); }
      catch (error) { if (!context.closed) throw error; }
    }));
  }

  private connect(socket: Socket): void {
    let socketQueue = Promise.resolve();
    let queued = 0;
    let windowStart = this.clock.now();
    let requests = 0;
    const register = (event: string, operation: (raw: unknown) => Promise<unknown> | unknown) => {
      socket.on(event, (raw: unknown, ack?: unknown) => {
        const respond = (reply: Reply) => { if (typeof ack === 'function') ack(reply); };
        if (this.clock.now() - windowStart >= this.options.rateLimit.windowMs) { windowStart = this.clock.now(); requests = 0; }
        if (++requests > this.options.rateLimit.requests || queued >= 64) {
          respond(rejection(new ProtocolError('RATE_LIMITED', 'Please slow down and retry.')));
          return;
        }
        queued += 1;
        socketQueue = socketQueue.then(async () => {
          try {
            if (this.stopping) throw new ProtocolError('SERVER_CLOSING', 'The server is shutting down.');
            if (!socket.connected) throw new ProtocolError('INVALID_SESSION', 'Socket is disconnected.');
            const data = await operation(raw);
            respond({ ok: true, data });
          } catch (error) {
            const reply = rejection(error);
            if (!reply.ok && reply.error.code === 'INTERNAL_ERROR') this.options.onError(error);
            respond(reply);
          }
        }).finally(() => { queued -= 1; });
      });
    };

    register('room:create', raw => {
      const input = createInput.parse(raw);
      this.requireUnbound(socket);
      if (this.rooms.size >= this.options.maxRooms) throw new ProtocolError('SERVER_FULL', 'All tables are occupied. Try again later.');
      const admitted = this.game.create(input.name, this.clock.now());
      const context = this.newRoom(admitted.room);
      this.bind(context, socket, admitted.playerId);
      const reconnectToken = this.sessions.issue(context.code, admitted.playerId);
      this.refreshExpiry(context);
      this.publish(context);
      socket.emit('server:capabilities', { voice: this.voice });
      return { playerId: admitted.playerId, reconnectToken, view: this.view(context, admitted.playerId), voice: this.voice };
    });
    register('room:join', raw => {
      const input = joinInput.parse(raw);
      this.requireUnbound(socket);
      const context = this.context(input.code);
      return this.enqueue(context, async () => {
        this.requireUnbound(socket);
        await this.synchronize(context);
        const admitted = this.game.join(input.code, input.name, this.clock.now());
        this.bind(context, socket, admitted.playerId);
        const reconnectToken = this.sessions.issue(context.code, admitted.playerId);
        this.refreshExpiry(context);
        this.publish(context);
        socket.emit('server:capabilities', { voice: this.voice });
        return { playerId: admitted.playerId, reconnectToken, view: this.view(context, admitted.playerId), voice: this.voice };
      });
    });
    register('room:reconnect', raw => {
      const input = reconnectInput.parse(raw);
      this.requireUnbound(socket);
      const context = this.context(input.code);
      return this.enqueue(context, async () => {
        this.requireUnbound(socket);
        await this.synchronize(context);
        const playerId = this.sessions.verify(context.code, input.reconnectToken);
        // Verify authority within the same queue as rotation and commands.
        await this.game.setConnected(context.code, playerId, true, this.clock.now());
        const reconnectToken = this.sessions.issue(context.code, playerId);
        this.bind(context, socket, playerId);
        this.refreshExpiry(context);
        this.publish(context);
        socket.emit('server:capabilities', { voice: this.voice });
        return { playerId, reconnectToken, view: this.view(context, playerId), voice: this.voice };
      });
    });
    register('room:command', raw => this.command(socket, commandInput.parse(raw)));
    register('lobby:claim-role', raw => {
      const { roleId, ...metadata } = roleInput.parse(raw);
      return this.command(socket, { ...metadata, type: 'CLAIM_ROLE', payload: { roleId } });
    });
    register('lobby:ready', raw => {
      const { ready, ...metadata } = readyInput.parse(raw);
      return this.command(socket, { ...metadata, type: 'READY', payload: { ready } });
    });
    register('match:start', raw => this.command(socket, { ...metadataInput.parse(raw), type: 'START_MATCH', payload: {} }));
    register('room:rematch', raw => this.command(socket, { ...metadataInput.parse(raw), type: 'REMATCH', payload: {} }));
    register('room:close', raw => this.command(socket, { ...metadataInput.parse(raw), type: 'CLOSE_ROOM', payload: {} }));
    register('chat:send', raw => {
      const { text, toPlayerId, ...metadata } = chatInput.parse(raw);
      return this.command(socket, { ...metadata, type: 'CHAT', payload: { text, ...(toPlayerId ? { toPlayerId } : {}) } });
    });
    register('room:sync', raw => this.snapshot(socket, emptyInput.parse(raw ?? {}), false));
    register('room:spectate', raw => this.snapshot(socket, emptyInput.parse(raw ?? {}), true));
    register('voice:join', raw => this.joinVoice(socket, emptyInput.parse(raw ?? {})));
    register('voice:leave', raw => this.leaveVoice(socket, emptyInput.parse(raw ?? {})));
    register('voice:signal', raw => this.signal(socket, signalInput.parse(raw)));
    socket.on('disconnect', () => {
      // Queue disconnect after any already-admitted socket operation, then join the room queue.
      socketQueue = socketQueue.then(async () => {
        const identity = this.bindings.get(socket.id);
        if (!identity) return;
        this.bindings.delete(socket.id);
        const context = this.rooms.get(identity.code);
        if (!context) return;
        await this.enqueue(context, async () => {
          if (this.clock.now() >= context.expiresAt) { this.destroy(context, 'ROOM_EXPIRED'); return; }
          const member = context.members.get(identity.playerId);
          if (member?.generation !== identity.generation) return;
          context.voiceMembers.delete(identity.playerId);
          context.members.delete(identity.playerId);
          // Connection changes cancel target interactions before any later timeout can accept.
          await this.game.setConnected(context.code, identity.playerId, false, this.clock.now());
          this.refreshExpiry(context);
          this.publish(context);
        }, true);
      }).catch(error => { if (!(error instanceof ProtocolError && error.code === 'ROOM_NOT_FOUND')) this.options.onError(error); });
    });
  }

  private async command(socket: Socket, input: CommandInput): Promise<unknown> {
    const binding = this.authorize(socket);
    const context = this.context(binding.code);
    const reply = await this.enqueue(context, async (): Promise<Reply> => {
      const identity = this.authorize(socket, binding);
      const roomBefore = this.read(context);
      if (input.roomId !== undefined && input.roomId !== roomBefore.id) throw new ProtocolError('INVALID_ROOM', 'Command does not belong to this room.');
      const key = JSON.stringify([identity.playerId, input.idempotencyKey]);
      const signature = fingerprint({ type: input.type, payload: input.payload, expectedRevision: input.expectedRevision, roomId: input.roomId });
      const prior = context.receipts.get(key);
      if (prior) {
        if (prior.fingerprint !== signature) throw new ProtocolError('IDEMPOTENCY_CONFLICT', 'This command key was already used for another action.');
        return prior.reply;
      }
      if (context.receipts.size >= this.options.maxCommandsPerRoom) throw new ProtocolError('COMMAND_LIMIT', 'This room has reached its command limit.');
      let result: Reply;
      try {
        await this.synchronize(context);
        const room = this.read(context);
        const actor = room.players.find(player => player.id === identity.playerId)!;
        if (input.type !== 'REMATCH' && input.type !== 'CLOSE_ROOM' && (actor.life === 'DEAD' || actor.life === 'EXITED')) throw new ProtocolError('SPECTATOR_READ_ONLY', 'Spectators cannot send gameplay or communications.');
        if (input.expectedRevision !== undefined && input.expectedRevision !== room.revision) throw new ProtocolError('STALE_REVISION', 'The table changed. Review the latest state and try again.');
        if (input.type === 'CLOSE_ROOM') {
          emptyInput.parse(input.payload);
          if (room.hostPlayerId !== identity.playerId) throw new ProtocolError('HOST_REQUIRED', 'Only the host can close the room.');
          result = { ok: true, data: { revision: room.revision, closed: true } };
          this.destroy(context, 'HOST_CLOSED');
        } else {
          if (input.type === 'CHAT') this.chat(context, identity.playerId, input.payload);
          else await this.game.command(context.code, identity.playerId, { type: input.type, payload: input.payload }, this.clock.now());
          if (input.type === 'REMATCH') context.messages = [];
          this.refreshExpiry(context);
          result = { ok: true, data: { revision: this.read(context).revision } };
          this.publish(context);
        }
      } catch (error) {
        result = rejection(error, this.game.read(context.code)?.revision);
        if (!result.ok && result.error.code === 'INTERNAL_ERROR') this.options.onError(error);
      }
      if (!context.closed) context.receipts.set(key, { fingerprint: signature, reply: result });
      return result;
    });
    // Throw a typed rejection through the common ack boundary, preserving revision.
    if (!reply.ok) throw Object.assign(new ProtocolError(reply.error.code, reply.error.message), { revision: reply.error.revision });
    return reply.data;
  }

  private snapshot(socket: Socket, _input: unknown, requireSpectator: boolean): Promise<unknown> {
    const binding = this.authorize(socket);
    const context = this.context(binding.code);
    return this.enqueue(context, async () => {
      const identity = this.authorize(socket, binding);
      await this.synchronize(context);
      if (requireSpectator && !this.isSpectator(context, identity.playerId)) throw new ProtocolError('SPECTATOR_FORBIDDEN', 'Only permanently dead or exited players may spectate.');
      return { view: this.view(context, identity.playerId), voice: this.voice };
    });
  }

  private joinVoice(socket: Socket, _input: unknown): Promise<unknown> {
    const binding = this.authorize(socket);
    const context = this.context(binding.code);
    return this.enqueue(context, async () => {
      const identity = this.authorize(socket, binding);
      await this.synchronize(context);
      if (!this.voice.enabled) throw new ProtocolError('VOICE_DISABLED', 'Voice is disabled on this server. Global text remains available.');
      if (!this.isVoiceEligible(context, identity.playerId)) throw new ProtocolError('VOICE_FORBIDDEN', 'Voice requires a connected living player in this room.');
      context.voiceMembers.add(identity.playerId);
      this.publishVoice(context);
      return { playerIds: [...context.voiceMembers].sort() };
    });
  }

  private leaveVoice(socket: Socket, _input: unknown): Promise<unknown> {
    const binding = this.authorize(socket);
    const context = this.context(binding.code);
    return this.enqueue(context, async () => {
      const identity = this.authorize(socket, binding);
      context.voiceMembers.delete(identity.playerId);
      this.publishVoice(context);
      return { left: true };
    });
  }

  private signal(socket: Socket, input: ReturnType<typeof signalInput.parse>): Promise<unknown> {
    const binding = this.authorize(socket);
    const context = this.context(binding.code);
    return this.enqueue(context, async () => {
      const identity = this.authorize(socket, binding);
      await this.synchronize(context);
      if (!this.voice.enabled) throw new ProtocolError('VOICE_DISABLED', 'Voice is disabled on this server. Global text remains available.');
      const room = this.read(context);
      const actor = room.players.find(player => player.id === identity.playerId);
      const target = room.players.find(player => player.id === input.toPlayerId);
      if (!actor || !target || target.id === actor.id || !context.voiceMembers.has(actor.id) || !context.voiceMembers.has(target.id) || !this.isVoiceEligible(context, actor.id) || !this.isVoiceEligible(context, target.id)) throw new ProtocolError('VOICE_FORBIDDEN', 'Voice requires two opted-in connected living players in this room.');
      const peer = context.members.get(target.id);
      if (!peer?.socket.connected) throw new ProtocolError('TARGET_DISCONNECTED', 'That player is disconnected.');
      peer.socket.emit('voice:signal', { fromPlayerId: identity.playerId, signal: input.signal });
      return { delivered: true };
    });
  }

  private chat(context: RoomRuntime, actorId: string, payload: Record<string, unknown>): void {
    const input = chatPayload.parse(payload);
    const room = this.read(context);
    if (input.toPlayerId) {
      const target = room.players.find(player => player.id === input.toPlayerId);
      if (!target || target.id === actorId || target.life === 'DEAD' || target.life === 'EXITED') throw new ProtocolError('INVALID_TARGET', 'Choose another living player in this room.');
    }
    context.messages.push({ id: randomUUID(), at: this.clock.now(), fromPlayerId: actorId, channel: input.toPlayerId ? 'PRIVATE' : 'GLOBAL', text: input.text, ...(input.toPlayerId ? { toPlayerId: input.toPlayerId } : {}) });
    if (context.messages.length > 200) context.messages.splice(0, context.messages.length - 200);
    room.revision += 1;
    room.updatedAt = this.clock.now();
  }

  private newRoom(room: RoomState): RoomRuntime {
    const context: RoomRuntime = { code: room.code, queue: Promise.resolve(), queued: 0, members: new Map(), voiceMembers: new Set(), receipts: new Map(), messages: [], expiresAt: 0, timer: undefined, closed: false };
    this.rooms.set(room.code, context);
    return context;
  }

  private bind(context: RoomRuntime, socket: Socket, playerId: string): void {
    const previous = context.members.get(playerId);
    // Voice opt-in belongs to this browser session, never to a reconnect token.
    context.voiceMembers.delete(playerId);
    const generation = randomUUID();
    context.members.set(playerId, { socket, generation });
    this.bindings.set(socket.id, { code: context.code, playerId, generation });
    if (previous && previous.socket.id !== socket.id) {
      this.bindings.delete(previous.socket.id);
      previous.socket.emit('session:replaced', { code: 'SESSION_REPLACED' });
      previous.socket.disconnect(true);
    }
  }

  private requireUnbound(socket: Socket): void {
    if (!socket.connected) throw new ProtocolError('INVALID_SESSION', 'Socket is disconnected.');
    if (this.bindings.has(socket.id)) throw new ProtocolError('ALREADY_JOINED', 'This socket already belongs to a room.');
  }

  private authorize(socket: Socket, expected?: Binding): Binding {
    const identity = this.bindings.get(socket.id);
    const member = identity ? this.rooms.get(identity.code)?.members.get(identity.playerId) : undefined;
    if (!socket.connected || !identity || member?.socket.id !== socket.id || member.generation !== identity.generation || (expected && expected.generation !== identity.generation)) throw new ProtocolError('INVALID_SESSION', 'Join or reconnect before sending commands.');
    return identity;
  }

  private context(code: string): RoomRuntime {
    const context = this.rooms.get(code);
    if (!context || context.closed) throw new ProtocolError('ROOM_NOT_FOUND', 'Room not found or expired.');
    return context;
  }

  private read(context: RoomRuntime): RoomState {
    const room = this.game.read(context.code);
    if (!room || context.closed) throw new ProtocolError('ROOM_NOT_FOUND', 'Room not found or expired.');
    return room;
  }

  private isSpectator(context: RoomRuntime, playerId: string): boolean {
    const player = this.read(context).players.find(candidate => candidate.id === playerId);
    if (!player) throw new ProtocolError('INVALID_SESSION', 'Player is not in this room.');
    return player.life === 'DEAD' || player.life === 'EXITED';
  }

  private isVoiceEligible(context: RoomRuntime, playerId: string): boolean {
    const player = this.read(context).players.find(candidate => candidate.id === playerId);
    const member = context.members.get(playerId);
    return Boolean(player && member?.socket.connected && player.connection === 'CONNECTED' && player.life !== 'DEAD' && player.life !== 'EXITED');
  }

  private view(context: RoomRuntime, playerId: string): unknown {
    const spectator = this.isSpectator(context, playerId);
    const projected = this.game.project(context.code, playerId, spectator);
    if (!projected || typeof projected !== 'object') throw new Error('The engine returned an invalid projection.');
    const messages = context.messages.filter(message => message.channel === 'GLOBAL' || message.fromPlayerId === playerId || message.toPlayerId === playerId);
    return { ...projected, viewerPlayerId: playerId, ...(spectator ? { spectator: true } : {}), messages: structuredClone(messages) };
  }

  private publish(context: RoomRuntime): void {
    if (context.closed) return;
    for (const [playerId, member] of context.members) {
      if (!member.socket.connected) continue;
      const binding = this.bindings.get(member.socket.id);
      if (binding?.generation !== member.generation) continue;
      // Never broadcast an owner or spectator projection via io.to(room).
      const view = this.view(context, playerId);
      member.socket.emit('room:view', view);
      if (view && typeof view === 'object' && 'public' in view) member.socket.emit('room:public', view.public);
    }
    this.publishVoice(context);
    this.schedule(context);
  }

  private publishVoice(context: RoomRuntime): void {
    if (context.closed) return;
    for (const playerId of [...context.voiceMembers]) if (!this.isVoiceEligible(context, playerId)) context.voiceMembers.delete(playerId);
    const playerIds = [...context.voiceMembers].sort();
    for (const [playerId, member] of context.members) {
      if (!member.socket.connected) continue;
      const binding = this.bindings.get(member.socket.id);
      if (binding?.generation !== member.generation) continue;
      member.socket.emit('voice:peers', { playerIds: this.isVoiceEligible(context, playerId) ? playerIds : [] });
    }
  }

  private enqueue<T>(context: RoomRuntime, operation: () => Promise<T>, internal = false): Promise<T> {
    if (!internal && context.queued >= 128) return Promise.reject(new ProtocolError('ROOM_BUSY', 'The table is busy. Try again shortly.'));
    context.queued += 1;
    const pending = context.queue.then(() => {
      if (context.closed) throw new ProtocolError('ROOM_NOT_FOUND', 'Room not found or expired.');
      return operation();
    });
    context.queue = pending.then(() => undefined, () => undefined).finally(() => { context.queued -= 1; });
    return pending;
  }

  private refreshExpiry(context: RoomRuntime): void {
    const room = this.read(context);
    const ttl = room.status === 'LOBBY' ? this.options.lobbyTtlMs : room.status === 'RESULTS' ? this.options.resultsTtlMs : this.options.activeTtlMs;
    context.expiresAt = this.clock.now() + ttl;
  }

  private schedule(context: RoomRuntime): void {
    if (context.timer) this.clock.clearTimeout(context.timer);
    if (context.closed || this.stopping) return;
    const next = Math.min(context.expiresAt, ...this.game.deadlines(context.code).map(deadline => deadline.at));
    context.timer = this.clock.setTimeout(() => {
      context.timer = undefined;
      void this.enqueue(context, async () => {
        await this.synchronize(context);
        this.schedule(context);
      }, true).catch(error => {
        if (!context.closed) this.options.onError(error);
      });
    }, Math.max(1, Math.min(next - this.clock.now(), 2_147_483_647)));
    context.timer.unref?.();
  }

  private async synchronize(context: RoomRuntime): Promise<void> {
    if (this.clock.now() >= context.expiresAt) {
      this.destroy(context, 'ROOM_EXPIRED');
      throw new ProtocolError('ROOM_NOT_FOUND', 'This room expired.');
    }
    // The network can close before its event callback reaches the queue. Observe
    // socket liveness here so a due timeout cannot auto-accept for a lost target.
    for (const [playerId, member] of context.members) {
      if (member.socket.connected) continue;
      context.members.delete(playerId);
      this.bindings.delete(member.socket.id);
      await this.game.setConnected(context.code, playerId, false, this.clock.now());
      this.refreshExpiry(context);
      this.publish(context);
    }
    for (let iteration = 0; iteration < 100; iteration += 1) {
      const due = this.game.deadlines(context.code).filter(deadline => deadline.at <= this.clock.now()).sort((a, b) => a.at - b.at)[0];
      if (!due) return;
      await this.game.timeout(context.code, due, this.clock.now());
      const stillDue = this.game.deadlines(context.code).some(deadline => deadline.id === due.id && deadline.at === due.at);
      if (stillDue) throw new Error('The game engine did not consume an expired deadline.');
      // Automatic turns must not indefinitely extend an abandoned active room.
      if (this.read(context).status === 'RESULTS') context.expiresAt = Math.min(context.expiresAt, this.clock.now() + this.options.resultsTtlMs);
      this.publish(context);
    }
    throw new Error('Too many overdue game deadlines.');
  }

  private destroy(context: RoomRuntime, reason: string): void {
    if (context.closed) return;
    context.closed = true;
    context.voiceMembers.clear();
    if (context.timer) this.clock.clearTimeout(context.timer);
    for (const member of context.members.values()) {
      this.bindings.delete(member.socket.id);
      member.socket.emit('room:closed', { code: context.code, reason });
    }
    context.members.clear();
    context.receipts.clear();
    context.messages = [];
    this.sessions.destroyRoom(context.code);
    this.game.destroy(context.code);
    this.rooms.delete(context.code);
  }
}
