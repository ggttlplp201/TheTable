import type { AnyRoomView } from './protocol';
import { isSpectatorView } from './protocol';
import { latestOwnInspection } from './MatchResolutionOverlays';

/** Only the authorized owner's Spyglass target crosses into the public scene; never its contents. */
export function latestOwnSpyglassTarget(room: AnyRoomView, viewerId: string): { eventId: string; targetId: string } | undefined {
  if (isSpectatorView(room) || room.private.playerId !== viewerId) return;
  const reveal = latestOwnInspection(room, viewerId);
  if (!reveal?.aperture) return;
  const inspection = room.private.inspections?.find(entry => entry.eventId === reveal.eventId);
  const payload = inspection?.payload;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return;
  const targetId = (payload as Record<string, unknown>).targetId;
  if (typeof targetId === 'string' && room.public.players.some(player => player.id === targetId)) return { eventId: reveal.eventId, targetId };
}
