import { TutorialController } from '@the-table/game/tutorial';
import type { GameCommand } from '@the-table/game';
import type { MatchClient } from './socket';
import type { ChatMessage, CommandPayload, Result, RevisionAck, VoiceSignal } from './protocol';

/** Local transport, sharing commands and authorized projections with the network client. */
export class TutorialClient implements MatchClient {
  private readonly receipts = new Map<string, Result<RevisionAck>>();
  private readonly messages: ChatMessage[] = [];
  constructor(readonly controller: TutorialController, private readonly changed: () => void) {}
  view() { return { ...this.controller.view(), messages: [...this.messages] }; }
  async command(envelope: CommandPayload): Promise<Result<RevisionAck>> {
    const existing = this.receipts.get(envelope.idempotencyKey);
    if (existing) return existing;
    let result: Result<RevisionAck>;
    try {
      this.controller.submit({ type: envelope.type, ...envelope.payload } as GameCommand);
      result = { ok: true, data: { revision: this.controller.room.revision } };
    } catch (error) {
      result = { ok: false, error: { code: 'TUTORIAL_RETRY', message: error instanceof Error ? error.message : 'Try this lesson again.' } };
    }
    this.receipts.set(envelope.idempotencyKey, result);
    this.changed();
    return result;
  }
  async sync() { return { ok: true as const, data: { view: this.view() } }; }
  async sendChat(payload: { text: string; idempotencyKey: string; toPlayerId?: string }): Promise<Result<RevisionAck>> {
    const existing = this.receipts.get(payload.idempotencyKey);
    if (existing) return existing;
    this.messages.push({ id: payload.idempotencyKey, at: Date.now(), fromPlayerId: 'student', channel: payload.toPlayerId ? 'PRIVATE' : 'GLOBAL', ...(payload.toPlayerId ? { toPlayerId: payload.toPlayerId } : {}), text: payload.text.slice(0, 500) });
    const result = { ok: true as const, data: { revision: this.controller.room.revision } };
    this.receipts.set(payload.idempotencyKey, result); this.changed(); return result;
  }
  async rematch(): Promise<Result<RevisionAck>> { return { ok: false, error: { code: 'TUTORIAL', message: 'Use Play Tutorial Again on the completion screen.' } }; }
  async signalVoice() { return { ok: true as const, data: undefined }; }
  async joinVoice() { return { ok: true as const, data: { playerIds: [] as string[] } }; }
  async leaveVoice() { return { ok: true as const, data: { left: true as const } }; }
  onVoicePeers(_listener: (value: { playerIds: string[] }) => void) { return () => {}; }
  onVoiceSignal(_listener: (value: { fromPlayerId: string; signal: VoiceSignal }) => void) { return () => {}; }
}
