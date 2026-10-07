import type { PublicPlayerView } from '@the-table/game';
import type { RoomView, SpectatorRoomView } from './protocol';

function player(id: string, seat: number, name: string): PublicPlayerView {
  return { id, seat, name, connection: 'CONNECTED', roleId: seat === 0 ? 'enforcer' : 'medic', ready: true, hp: 5,
    visibleInventory: [{ instanceId: `${id}-pistol`, itemId: 'pistol', quantity: 1 }, { instanceId: `${id}-cloth`, itemId: 'cloth', quantity: 1 }, null, null, null, null],
    pocketOccupancy: [true], coins: 8, life: 'ACTIVE', objectiveCompleted: false, score: 0, statuses: [],
  };
}
export function ownerRoom(): RoomView {
  return { viewerPlayerId: 'p1', public: { id: 'room-id', code: 'ABCDEF', revision: 7, hostPlayerId: 'p1', status: 'PLAYING',
    players: [player('p1', 0, 'Ada'), player('p2', 1, 'Bruno')], round: { number: 2, phase: 'TURN', seatsOwedTurn: [0, 1] },
    turn: { activeSeat: 0, serial: 3, startedAt: 1000, deadlineAt: Date.now() + 60_000, primaryUsed: false, downedInteractionUsed: false, exitDeclined: false, startedDowned: false },
    chests: [{ kind: 'STANDARD', availability: 'AVAILABLE' }], events: [],
  }, private: { playerId: 'p1', pockets: [{ item: { instanceId: 'owner-secret-item', itemId: 'medicine', quantity: 1 }, protectedBySafe: false, source: 'DEFAULT' }],
    objective: { objectiveId: 'arsenal', status: 'ACTIVE', progress: { pistol: true, bullet: false, knife: false, armor: false }, rewardGranted: false },
    capabilities: ['CHAT', 'USE_ITEM', 'TRADE', 'THREAT', 'DOWNED_INTERACTION', 'END_TURN'],
    inspections: [{ eventId: 'owner-inspection', payload: { ownerInspectionSentinel: true } }],
  }, messages: [{ id: 'chat-1', at: 1000, fromPlayerId: 'p2', toPlayerId: 'p1', channel: 'PRIVATE', text: 'Owner private message sentinel' }] };
}
export function spectatorRoom(): SpectatorRoomView {
  const room = ownerRoom();
  return { spectator: true, viewerPlayerId: 'p1', public: room.public, capabilities: [], events: [],
    chests: [{ kind: 'STANDARD', availability: 'AVAILABLE', loot: [{ kind: 'ITEM', stack: { itemId: 'brass-idol', instanceId: 'secret-chest-item', quantity: 1 } }] }],
    players: [{ public: room.public.players[0]!, private: { ...room.private, capabilities: [] } },
      { public: room.public.players[1]!, private: { playerId: 'p2', pockets: [{ item: { instanceId: 'other-secret-item', itemId: 'poison', quantity: 1 }, protectedBySafe: true, source: 'DEFAULT' }], objective: { objectiveId: 'martyr', status: 'ACTIVE', progress: {}, rewardGranted: false }, blackMarket: [{ id: 'other-private-offer', itemId: 'black-key', price: 8 }], capabilities: [] } }],
    messages: room.messages ?? [],
  };
}
