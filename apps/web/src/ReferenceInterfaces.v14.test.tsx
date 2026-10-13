import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { AudioEngine } from '@the-table/audio';
import { ReferenceSettings, ReferenceStateOverlays } from './ReferenceInterfaces';
import { ownerRoom } from './test-fixtures';

describe('v14 settings help', () => {
  it('keeps the first-person camera controls discoverable', () => {
    const engine = {
      state: () => ({ volume: 1, roomVolume: 1, effectsVolume: 1, muted: false }),
      setVolume: vi.fn(), setRoomVolume: vi.fn(), setEffectsVolume: vi.fn(), setMuted: vi.fn(),
    } as unknown as AudioEngine;
    const html = renderToStaticMarkup(<ReferenceSettings engine={engine} started onStart={vi.fn()} />);
    expect(html).toContain('DRAG TO LOOK AROUND');
    expect(html).toContain('Click/tap highlighted objects to interact.');
  });

  it('uses the authoritative aggressor boundary and never offers an off-turn revive without Medicine', () => {
    const room = ownerRoom();
    room.public.players[0]!.life = 'DOWNED';
    room.public.players[0]!.hp = 0;
    room.public.players[0]!.downed = { aggressorId: 'p2', downedAt: 1, eventId: 'down', expiresRound: 3, expiresSeat: 1 };
    room.public.round = { number: 2, phase: 'TURN', seatsOwedTurn: [0] };
    room.public.turn!.activeSeat = 1;
    room.private.pockets[0]!.item = null;
    room.public.players[0]!.visibleInventory = room.public.players[0]!.visibleInventory.map(item => item?.itemId === 'medicine' ? null : item);
    const html = renderToStaticMarkup(<ReferenceStateOverlays room={room} viewerId="p1" send={vi.fn(async () => true)} busy={false} openContract={vi.fn()} />);
    expect(html).toContain('immediately before<br/>BRUNO’S NEXT TURN.');
    expect(html).toContain('SELF-REVIVE UNAVAILABLE');
    expect(html).toContain('No Medicine');
    expect(html).not.toContain('REVIVE WITH MEDICINE');
  });

  it('offers the exact Medicine and pass choices on the owner’s Downed turn', () => {
    const room = ownerRoom();
    room.public.players[0]!.life = 'DOWNED';
    room.public.players[0]!.hp = 0;
    room.public.players[0]!.downed = { aggressorId: 'p2', downedAt: 1, eventId: 'down', expiresRound: 3, expiresSeat: 1 };
    const html = renderToStaticMarkup(<ReferenceStateOverlays room={room} viewerId="p1" send={vi.fn(async () => true)} busy={false} openContract={vi.fn()} />);
    expect(html).toContain('REVIVE WITH MEDICINE');
    expect(html).toContain('Return at 2 HP');
    expect(html).toContain('PASS DOWNED TURN');
  });
});
