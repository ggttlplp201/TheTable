import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ChatPanel, MatchView, feedNewAudioEvents } from './MatchView';
import { DownedForm, Markets, ThreatForm, TradeForm, TurnActions, UseItemForm } from './ActionForms';
import { ChestPanel, OverflowDecision, PendingInteraction, Results, SpectatorDetails } from './MatchPanels';
import { ownerRoom, spectatorRoom } from './test-fixtures';
import type { TableClient } from './socket';
const send = vi.fn(async () => true);

function fullView(room = ownerRoom()) {
  return renderToStaticMarkup(<MatchView room={room} client={{} as TableClient} connected viewerId="p1" voice={{ enabled: false, iceServers: [], relayConfigured: false }} onView={() => {}} />);
}

describe('authorized match components', () => {
  it('primes existing audio history silently and routes each newly projected event once', () => {
    const room = ownerRoom();
    room.public.events = [{ id: 'match-start', sequence: 1, at: 1, kind: 'MATCH_STARTED', targetIds: [], publicText: 'started' }];
    const handleEvent = vi.fn();
    const engine = { handleEvent };
    const observed = new Set<string>();
    feedNewAudioEvents(engine, room, 'p1', observed, false);
    feedNewAudioEvents(engine, room, 'p1', observed, true);
    expect(handleEvent).not.toHaveBeenCalled();
    room.public.events.push({ id: 'turn-start', sequence: 2, at: 2, kind: 'TURN_STARTED', actorId: 'p1', targetIds: [], publicText: 'turn' });
    feedNewAudioEvents(engine, room, 'p1', observed, true);
    feedNewAudioEvents(engine, room, 'p1', observed, true);
    expect(handleEvent).toHaveBeenCalledTimes(1);
    expect(handleEvent).toHaveBeenCalledWith(expect.objectContaining({ id: 'turn-start' }), 'p1');
  });

  it('renders own Pockets, objective, public inventory and authorized chat without inventing secrets', () => {
    const html = fullView();
    expect(html).toContain('Enable sound');
    expect(html).toContain('Arsenal');
    expect(html).toContain('Medicine');
    expect(html).toContain('Pistol');
    expect(html).toContain('Owner private message sentinel');
    expect(html).not.toContain('Martyr');
    expect(html).not.toContain('Brass Idol');
    expect(html).not.toContain('other-private-offer');
  });
  it('shows opt-in voice controls, peer state, and an explicit no-relay warning', () => {
    const html = renderToStaticMarkup(<MatchView room={ownerRoom()} client={{} as TableClient} connected viewerId="p1" voice={{ enabled: true, iceServers: [], relayConfigured: false }} onView={() => {}} />);
    expect(html).toContain('Join table voice');
    expect(html).toContain('Direct connections only');
    expect(html).toContain('Bruno');
    expect(html).toContain('Not in voice');
  });
  it('renders no match action controls when capabilities are absent despite it being our turn', () => {
    const room = ownerRoom(); room.private.capabilities = [];
    const html = fullView(room);
    expect(html).not.toContain('<form');
    expect(html).not.toContain('Use an item');
    expect(html).not.toContain('Trade');
    expect(html).toContain('Watch the table');
  });
  it('shows private god-view detail with zero gameplay or chat action controls', () => {
    const room = spectatorRoom();
    const html = renderToStaticMarkup(<MatchView room={room} client={{} as TableClient} connected viewerId="p1" voice={{ enabled: false, iceServers: [], relayConfigured: false }} onView={() => {}} />);
    expect(html).toContain('Martyr'); expect(html).toContain('Poison'); expect(html).toContain('Black Key'); expect(html).toContain('Brass Idol');
    expect(html).not.toContain('<button'); expect(html).not.toContain('<form');
  });
  it('renders public chest availability without contents and spectator contents only when present', () => {
    expect(renderToStaticMarkup(<ChestPanel room={ownerRoom()} />)).not.toContain('Brass Idol');
    expect(renderToStaticMarkup(<ChestPanel room={spectatorRoom()} />)).toContain('Brass Idol');
  });
  it('does not expose covered Threat commitments and restricts responses to projected capability', () => {
    const room = ownerRoom();
    room.public.pendingThreat = { id: 'threat', actorId: 'p2', targetId: 'p1', mode: 'COVERED', demandedItems: [], demandedCoins: 2, status: 'PENDING', deadlineAt: Date.now() + 30000 };
    let html = renderToStaticMarkup(<PendingInteraction room={room} send={send} busy={false} />);
    expect(html).toContain('identity is hidden'); expect(html).not.toContain('<button');
    room.private.capabilities = ['RESPOND_THREAT'];
    html = renderToStaticMarkup(<PendingInteraction room={room} send={send} busy={false} />);
    expect(html).toContain('>Comply</button>'); expect(html).toContain('>Refuse</button>');
    expect(html).not.toContain('Presented item:');
  });
  it('displays Trade terms, automatic acceptance and the two response controls', () => {
    const room = ownerRoom(); room.private.capabilities = ['RESPOND_TRADE'];
    room.public.pendingTrade = { id: 'trade', actorId: 'p2', targetId: 'p1', offeredItems: ['p2-pistol'], offeredCoins: 0, requestedItems: [], requestedCoins: 3, status: 'PENDING', deadlineAt: Date.now() + 30000 };
    const html = renderToStaticMarkup(<PendingInteraction room={room} send={send} busy={false} />);
    expect(html).toContain('Pistol, 0 Coins'); expect(html).toContain('3 Coins'); expect(html).toContain('Accept is automatic');
    expect(html).toContain('Accept Trade'); expect(html).toContain('Decline Trade');
  });
  it('shows the private incoming overflow and only visible replacement options', () => {
    const room = ownerRoom(); room.private.capabilities = ['OVERFLOW_CHOICE'];
    room.private.overflows = [{ id: 'overflow', playerId: 'p1', incoming: { itemId: 'bag', instanceId: 'new-bag', quantity: 1 }, deadlineAt: Date.now() + 15000 }];
    const html = renderToStaticMarkup(<OverflowDecision room={room} send={send} busy={false} />);
    expect(html).toContain('Discard incoming Bag'); expect(html).toContain('Replace Pistol'); expect(html).not.toContain('Replace Medicine');
  });
  it('keeps Pocket assets out of Trade/Threat asset selectors but offers them for item use', () => {
    const room = ownerRoom();
    const trade = renderToStaticMarkup(<TradeForm room={room} send={send} busy={false} />);
    const threat = renderToStaticMarkup(<ThreatForm room={room} send={send} busy={false} />);
    const use = renderToStaticMarkup(<UseItemForm room={room} send={send} busy={false} />);
    expect(trade).not.toContain('owner-secret-item'); expect(threat).not.toContain('owner-secret-item'); expect(use).toContain('owner-secret-item');
    expect(trade).toContain('name="offeredCoins"'); expect(threat).toContain('name="committedItemId"');
  });
  it('exposes Downed loot from public inventory and identifies the extra interaction', () => {
    const room = ownerRoom(); room.public.players[1]!.life = 'DOWNED';
    const html = renderToStaticMarkup(<DownedForm room={room} send={send} busy={false} />);
    expect(html).toContain('p2-pistol'); expect(html).toContain('REVIVE'); expect(html).toContain('HELP'); expect(html).toContain('does not consume');
  });
  it('keeps markets inspectable while waiting and gates purchases/selling by capability', () => {
    const room = ownerRoom(); room.private.capabilities = ['CHAT'];
    room.public.shop = { publicOffers: [{ id: 'public-offer', itemId: 'knife', price: 4 }], order: ['p2', 'p1'], activeShopperIndex: 0, publicPurchasedBy: {} };
    room.private.blackMarket = [{ id: 'private-offer', itemId: 'safe', price: 5 }];
    let html = renderToStaticMarkup(<Markets room={room} send={send} busy={false} />);
    expect(html).toContain('Your private Black Market'); expect(html).toContain('Safe'); expect(html).not.toContain('<button');
    room.private.capabilities = ['BUY', 'SELL', 'POCKET', 'ASSIGN_SAFE', 'FINISH_SHOPPING'];
    html = renderToStaticMarkup(<Markets room={room} send={send} busy={false} />);
    expect(html).toContain('Buy Knife'); expect(html).toContain('Sell item'); expect(html).toContain('Finish shopping'); expect(html).toContain('Manage Pockets');
  });
  it('shows Stay/Leave only when the server offers the exit choice', () => {
    const room = ownerRoom(); room.private.capabilities = ['LEAVE_TABLE', 'STAY', 'END_TURN'];
    const html = renderToStaticMarkup(<TurnActions room={room} send={send} busy={false} />);
    expect(html).toContain('Leave Table'); expect(html).toContain('Stay at Table');
  });
  it('does not reveal failed-death objectives in living-player Results', () => {
    const room = ownerRoom(); room.public.status = 'RESULTS'; room.public.players[1]!.life = 'DEAD';
    const html = renderToStaticMarkup(<Results room={room} />);
    expect(html).toContain('Objective unrevealed'); expect(html).not.toContain('Martyr');
  });
  it('escapes chat content and omits the composer for a spectator', () => {
    const room = ownerRoom(); room.messages![0]!.text = '<img src=x onerror=alert(1)>';
    const html = renderToStaticMarkup(<ChatPanel room={room} sendChat={send} busy={false} />);
    expect(html).toContain('&lt;img'); expect(html).not.toContain('<img');
    expect(renderToStaticMarkup(<ChatPanel room={spectatorRoom()} sendChat={send} busy={false} />)).not.toContain('<form');
  });
  it('renders all private spectator panels without nested action forms', () => {
    const html = renderToStaticMarkup(<SpectatorDetails room={spectatorRoom()} />);
    expect(html).toContain('Bruno’s private information'); expect(html).not.toContain('<form');
  });
});


describe('item form defaults', () => {
  it('selects an active opponent for attacks, omits self and passive items', () => {
    const room = ownerRoom();
    room.public.players[0]!.visibleInventory.push({ instanceId: 'bullet-passive', itemId: 'bullet', quantity: 1 });
    const html = renderToStaticMarkup(<UseItemForm room={room} send={send} busy={false} />);
    expect(html).toContain('value="p2" selected=""');
    expect(html).not.toContain('value="self"');
    expect(html).not.toContain('bullet-passive');
    expect(html).not.toContain('p1-cloth');
  });
  it('defaults medicine to self and gives chest access no player selector', () => {
    const room = ownerRoom(); room.public.players[0]!.visibleInventory = [];
    let html = renderToStaticMarkup(<UseItemForm room={room} send={send} busy={false} />);
    expect(html).toContain('value="self" selected=""');
    room.private.pockets = [];
    room.public.players[0]!.visibleInventory = [{ instanceId: 'key', itemId: 'key', quantity: 1 }];
    html = renderToStaticMarkup(<UseItemForm room={room} send={send} busy={false} />);
    expect(html).not.toContain('Item target'); expect(html).toContain('Open Standard Chest');
  });
});
