import type { CommandPayload, Result, RevisionAck } from './protocol';
import type { TableClient } from './socket';

export type ChatPayload = Parameters<TableClient['sendChat']>[0];
export type ActionRequest =
  | { kind: 'command'; payload: CommandPayload }
  | { kind: 'chat'; payload: ChatPayload }
  | { kind: 'rematch'; idempotencyKey: string; expectedRevision: number };

export function dispatchRequest(client: Pick<TableClient, 'command' | 'sendChat' | 'rematch'>, request: ActionRequest): Promise<Result<RevisionAck>> {
  switch (request.kind) {
    case 'command': return client.command(request.payload);
    case 'chat': return client.sendChat(request.payload);
    case 'rematch': return client.rematch(request.idempotencyKey, request.expectedRevision);
  }
}
