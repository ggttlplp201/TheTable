import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { PendingInteraction, PlayerRoster, PrivateDetail } from './MatchPanels';
import { ownerRoom } from './test-fixtures';

describe('v14 player-facing panels', () => {
  it('opens and marks the requested opponent instead of substituting the viewer', () => {
    const room = ownerRoom();
    const html = renderToStaticMarkup(<PlayerRoster room={room.public} viewerId="p1" selectedPlayerId="p2" />);
    expect(html).toContain('aria-current="true"');
    expect(html).toMatch(/<details[^>]*open=""[^>]*data-selected="true"|<details[^>]*data-selected="true"[^>]*open=""/);
    expect(html).toContain('<strong>Bruno</strong>');
  });

  it('shows private failure reason and exact Concede timing without exposing progress keys', () => {
    const room = ownerRoom();
    room.private.objective = {
      objectiveId: 'executioner', status: 'FAILED', progress: { targetLife: 'EXITED' }, rewardGranted: false,
      targetPlayerId: 'p2', failureReason: 'Your assigned target escaped.',
    };
    const html = renderToStaticMarkup(<PrivateDetail detail={room.private} room={room.public} />);
    expect(html).toContain('CONTRACT FAILED');
    expect(html).toContain('Your assigned target escaped.');
    expect(html).toContain('This objective can no longer be completed.');
    expect(html).toContain('Concede for 0 points on your next normal turn.');
    expect(html).not.toContain('targetLife');
  });

  it('distinguishes next-turn objective completion from an exit that is ready now', () => {
    const room = ownerRoom();
    room.private.objective!.status = 'EXIT_READY';
    room.private.capabilities = (room.private.capabilities ?? []).filter(capability => capability !== 'LEAVE_TABLE');
    expect(renderToStaticMarkup(<PrivateDetail detail={room.private} room={room.public} />)).toContain('Leave Table unlocks at the start of your next normal turn.');
    room.private.capabilities?.push('LEAVE_TABLE');
    expect(renderToStaticMarkup(<PrivateDetail detail={room.private} room={room.public} />)).toContain('You may leave now or stay.');
  });

  it('shows Tumbler Sense as a ready Free Action with its exact report', () => {
    const room = ownerRoom();
    room.public.players[0]!.roleId = 'locksmith';
    room.private.capabilities?.push('INSPECT_CHEST');
    const html = renderToStaticMarkup(<PrivateDetail detail={room.private} room={room.public} />);
    expect(html).toContain('TUMBLER SENSE');
    expect(html).toContain('Free Action · once per complete Round');
    expect(html).toContain('whether the Standard Chest holds an Artifact');
    expect(html).toContain('<b>READY</b>');
  });

  it('states opposite timeout defaults while retaining exact zero-coin assets', () => {
    const room = ownerRoom();
    room.public.pendingTrade = { id: 'trade', actorId: 'p2', targetId: 'p1', offeredItems: [], offeredCoins: 0, requestedItems: [], requestedCoins: 2, status: 'PENDING', deadlineAt: Date.now() + 30_000 };
    room.private.capabilities = ['RESPOND_TRADE'];
    const trade = renderToStaticMarkup(<PendingInteraction room={room} send={vi.fn(async () => true)} busy={false} />);
    expect(trade).toContain('0 Gold');
    expect(trade).toContain('2 Gold');
    expect(trade).toContain('No response → Decline');

    delete room.public.pendingTrade;
    room.public.pendingThreat = { id: 'threat', actorId: 'p2', targetId: 'p1', mode: 'OPEN', demandedItems: [], demandedCoins: 2, status: 'PENDING', deadlineAt: Date.now() + 30_000, committedItemType: 'pistol' };
    room.private.capabilities = ['RESPOND_THREAT'];
    expect(renderToStaticMarkup(<PendingInteraction room={room} send={vi.fn(async () => true)} busy={false} />)).toContain('No response → Comply');
  });
});
