import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AUDIO_CUE_IDS } from '@the-table/audio';
import { ChatPanel, MatchView, audioDeadline, feedNewAudioEvents, musicFor, playAcceptedActionAudio, sceneIntentTarget } from './MatchView';
import { commandEnvelope } from './gameplay';
import { DownedForm, Markets, ThreatForm, TradeForm, TurnActions, UseItemForm } from './ActionForms';
import { ChestPanel, OverflowDecision, PendingInteraction, Results, SpectatorDetails } from './MatchPanels';
import { VoicePanel } from './VoicePanel';
import { ownerRoom, spectatorRoom } from './test-fixtures';
import type { TableClient } from './socket';
const send = vi.fn(async () => true);

function fullView(room = ownerRoom()) {
  return renderToStaticMarkup(<MatchView room={room} client={{} as TableClient} connected viewerId="p1" voice={{ enabled: false, iceServers: [], relayConfigured: false }} onView={() => {}} />);
}

describe('authorized match components', () => {
  it('retains physical scene item, player, chest, and immediate-loot intent', () => {
    const room = ownerRoom();
    expect(sceneIntentTarget(room, 'p1', { kind: 'ITEM', instanceId: 'p1-pistol', ownerId: 'p1', itemId: 'pistol' }))
      .toEqual({ panel: 'USE_ITEM', itemInstanceId: 'p1-pistol' });
    expect(sceneIntentTarget(room, 'p1', { kind: 'ITEM', instanceId: 'p2-cloth', ownerId: 'p2', itemId: 'cloth' }))
      .toEqual({ panel: 'TRADE', targetPlayerId: 'p2', requestedItemInstanceId: 'p2-cloth' });
    room.public.players[1]!.connection = 'DISCONNECTED';
    expect(sceneIntentTarget(room, 'p1', { kind: 'ITEM', instanceId: 'p2-cloth', ownerId: 'p2', itemId: 'cloth' }))
      .toEqual({ panel: 'PLAYERS', targetPlayerId: 'p2' });
    room.public.players[1]!.connection = 'CONNECTED';

    room.public.players[0]!.visibleInventory[2] = { instanceId: 'standard-key', itemId: 'key', quantity: 1 };
    expect(sceneIntentTarget(room, 'p1', { kind: 'CHEST', chestKind: 'STANDARD' }))
      .toEqual({ panel: 'USE_ITEM', itemInstanceId: 'standard-key', chestKind: 'STANDARD' });

    room.public.players[1]!.life = 'DOWNED';
    room.public.turn!.immediateLoot = { playerId: 'p1', targetId: 'p2', downEventId: 'down-1' };
    room.private.capabilities = ['LOOT_DOWNED', 'END_TURN'];
    expect(sceneIntentTarget(room, 'p1', { kind: 'PLAYER', playerId: 'p2' }))
      .toEqual({ panel: 'DOWNED', targetPlayerId: 'p2', immediateLoot: true });
    expect(sceneIntentTarget(room, 'p1', { kind: 'MARKET_PUBLIC' })).toBeNull();
    expect(sceneIntentTarget(room, 'p1', { kind: 'MARKET_BLACK' })).toBeNull();
    expect(sceneIntentTarget(room, 'p1', { kind: 'SELL' })).toBeNull();
    room.public.round!.phase = 'INTERMISSION';
    expect(sceneIntentTarget(room, 'p1', { kind: 'MARKET_PUBLIC' })).toEqual({ panel: 'MARKETS', marketView: 'PUBLIC' });
    expect(sceneIntentTarget(room, 'p1', { kind: 'MARKET_BLACK' })).toEqual({ panel: 'MARKETS', marketView: 'BLACK' });
    expect(sceneIntentTarget(room, 'p1', { kind: 'SELL' })).toEqual({ panel: 'MARKETS', marketView: 'SELL' });
    expect(sceneIntentTarget(spectatorRoom(), 'p1', { kind: 'MARKET_BLACK' })).toBeNull();
  });

  it('offers a visible route home after results', () => {
    const room = ownerRoom();
    room.public.status = 'RESULTS';
    const html = renderToStaticMarkup(<MatchView room={room} client={{} as TableClient} connected viewerId="p1" voice={{ enabled: false, iceServers: [], relayConfigured: false }} onView={() => {}} onReturnHome={() => {}} />);
    expect(html).toContain('Return to Home');
    expect(html).toContain('results-actions');
  });

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

  it('routes accepted owner-authorized item, ammunition, Pocket, and market feedback', () => {
    const room = ownerRoom();
    room.public.players[0]!.visibleInventory[2] = { instanceId: 'p1-bullet', itemId: 'bullet', quantity: 1 };
    room.private.blackMarket = [{ id: 'private-offer', itemId: 'safe', price: 5 }];
    const engine = { play: vi.fn(), playItem: vi.fn(), playUse: vi.fn() };
    playAcceptedActionAudio(engine, room, { kind: 'command', payload: commandEnvelope({ type: 'USE_ITEM', instanceId: 'p1-pistol', targetId: 'p2' }, room.public, 'use') });
    playAcceptedActionAudio(engine, room, { kind: 'command', payload: commandEnvelope({ type: 'POCKET', instanceId: 'p1-cloth', pocketIndex: 0 }, room.public, 'pocket') });
    playAcceptedActionAudio(engine, room, { kind: 'command', payload: commandEnvelope({ type: 'BUY', market: 'BLACK', offerId: 'private-offer' }, room.public, 'buy') });
    // Firing a pistol is heard from WEAPON_USED on the fire beat; locally only the grip is handled (no reload sound).
    expect(engine.playItem.mock.calls.map(([cue]) => cue)).toEqual(['pistol', 'cloth', 'safe']);
    expect(engine.playUse).not.toHaveBeenCalled();
    expect(engine.play).toHaveBeenCalledWith(AUDIO_CUE_IDS.uiPocket);
    expect(engine.play).toHaveBeenCalledWith(AUDIO_CUE_IDS.uiCoins);
  });

  it('ticks only the deadline the viewer has to beat', () => {
    const room = ownerRoom();
    room.public.round = { ...room.public.round!, phase: 'TURN' };
    room.public.turn = {
      ...room.public.turn!,
      activeSeat: room.public.players.find(player => player.id === 'p1')!.seat as 0 | 1 | 2 | 3,
      deadlineAt: 60_000,
    };
    expect(audioDeadline(room, 'p1')).toEqual({ kind: 'turn', at: 60_000 });
    expect(audioDeadline(room, 'p2')).toBeUndefined();
    room.public.overflows = [{ id: 'o', playerId: 'p2', deadlineAt: 15_000 }];
    expect(audioDeadline(room, 'p2')).toEqual({ kind: 'response', at: 15_000 });
    room.public.status = 'RESULTS';
    expect(audioDeadline(room, 'p1')).toBeUndefined();
  });

  it('picks the music bed from the public state and the open market view', () => {
    const room = ownerRoom();
    expect(musicFor(room, 'p1', 'table')).toBe('table');
    room.public.round = { ...room.public.round!, phase: 'INTERMISSION' };
    expect(musicFor(room, 'p1', 'table')).toBe('shop');
    expect(musicFor(room, 'p1', 'market')).toBe('market');
    room.public.status = 'RESULTS';
    expect(musicFor(room, 'p1', 'table')).toBeUndefined();
  });

  it('renders the physical hand and keeps private panels closed until requested', () => {
    const html = fullView();
    expect(html).toContain('First person table view');
    expect(html).toContain('Contract');
    expect(html).toContain('Settings');
    expect(html).toContain('Pocket 1');
    expect(html).toContain('Pistol');
    expect(html).not.toContain('Arsenal');
    expect(html).not.toContain('Medicine');
    expect(html).not.toContain('Owner private message sentinel');
    expect(html).not.toContain('Martyr');
    expect(html).not.toContain('Brass Idol');
    expect(html).not.toContain('other-private-offer');
  });
  it('shows public Temporary HP in both the seat ribbon and the owner HUD', () => {
    const room = ownerRoom();
    room.public.players[0]!.temporaryHp = 2;
    const html = fullView(room);
    expect(html).toContain('♥5 +2');
    expect(html).toContain('5/5 +2');
  });
  it('keeps Pass Turn in the primary row and presents exactly one turn-ending control', () => {
    const room = ownerRoom();
    room.private.capabilities = ['TRADE', 'THREAT', 'USE_ITEM', 'INSPECT_CHEST', 'END_TURN', 'PASS_TURN'];
    const html = fullView(room);
    const primary = html.match(/<div class="action-buttons">(.*?)<\/div>/)?.[1];
    const context = html.match(/<div class="contextual-actions">(.*?)<\/div>/)?.[1];
    expect(primary).toContain('Use item');
    expect(primary).not.toContain('Inspect chest');
    expect(primary).toContain('PASS TURN');
    expect(context).toContain('Inspect chest');
    expect(context).not.toContain('PASS TURN');
    expect(html.match(/aria-keyshortcuts="Space"/g)).toHaveLength(1);

    room.public.turn!.primaryUsed = true;
    room.private.capabilities = ['SKIP_LOOT'];
    const spent = fullView(room);
    expect(spent.match(/<div class="action-buttons">(.*?)<\/div>/)?.[1]).toContain('Skip loot');
    expect(spent).not.toContain('PASS TURN');
    expect(spent).not.toContain('aria-keyshortcuts="Space"');
  });
  it('keeps opt-in voice controls available to the temporary settings surface', () => {
    const room = ownerRoom();
    const html = renderToStaticMarkup(<VoicePanel room={room} client={{} as TableClient} connected viewerId="p1" capability={{ enabled: true, iceServers: [], relayConfigured: false }} />);
    expect(html).toContain('Join table voice');
    expect(html).toContain('Direct connections only');
    expect(html).toContain('Bruno');
    expect(html).toContain('Not in voice');
  });
  it('counts private Pocket ammunition exactly for the owner and keeps the role card available', () => {
    const room = ownerRoom();
    room.private.pockets[0]!.item = { instanceId: 'private-ammo', itemId: 'bullet', quantity: 2 };
    const html = fullView(room);
    expect(html).toContain('2 usable Bullets including Pockets');
    expect(html).toContain('data-compact="true"');
    expect(html).toContain('QUICK DRAW');
    expect(html).not.toContain('private-ammo');
  });
  it('keeps free Tumbler Sense available during Intermission and marks the spent ability', () => {
    const room = ownerRoom();
    room.public.players[0]!.roleId = 'locksmith';
    room.public.round!.phase = 'INTERMISSION';
    room.public.shop = { id: 'v14-inspect', phase: 'PREP', prepDeadlineAt: Date.now() + 15000, privateUnlockedBy: {}, finishedBy: {}, order: ['p1', 'p2'], activeShopperIndex: 0, publicOffers: [], publicPurchasedBy: {} };
    room.private.capabilities = ['CHAT', 'INSPECT_CHEST'];
    expect(fullView(room)).toContain('Tumbler Sense · inspect chest (free)');
    room.private.abilities = { quickDrawUsed: false, locksmithRound: room.public.round!.number };
    room.private.capabilities = ['CHAT'];
    expect(fullView(room)).toContain('disabled="">Tumbler Sense · USED THIS ROUND');
  });
  it('labels a conceded player without fabricating a death or revealing their objective', () => {
    const room = ownerRoom();
    room.public.players[1]!.life = 'DEAD';
    room.public.players[1]!.conceded = true;
    const html = renderToStaticMarkup(<Results room={room} />);
    expect(html).toContain('CONCEDED');
    expect(html).not.toContain('DIED');
    expect(html).toContain('Objective unrevealed');
  });
  it('renders no match action controls when capabilities are absent despite it being our turn', () => {
    const room = ownerRoom(); room.private.capabilities = [];
    const html = fullView(room);
    expect(html).not.toContain('<form');
    expect(html).not.toContain('Use an item');
    expect(html).not.toContain('Trade');
  });
  it('renders the attacker-only immediate loot action in the production shell', () => {
    const room = ownerRoom();
    room.public.players[1]!.life = 'DOWNED';
    room.public.turn!.immediateLoot = { playerId: 'p1', targetId: 'p2', downEventId: 'down-1' };
    room.private.capabilities = ['LOOT_DOWNED', 'END_TURN'];
    const html = fullView(room);
    expect(html).toContain('Take immediate loot');
    expect(html).not.toContain('Development dashboard');
  });
  it('shows private god-view detail with zero gameplay or chat action controls', () => {
    const room = spectatorRoom();
    const html = renderToStaticMarkup(<MatchView room={room} client={{} as TableClient} connected viewerId="p1" voice={{ enabled: false, iceServers: [], relayConfigured: false }} onView={() => {}} />);
    expect(html).toContain('Martyr'); expect(html).toContain('Poison'); expect(html).toContain('Black Key'); expect(html).toContain('Brass Idol');
    expect(html).not.toContain('aria-label="Your actions"'); expect(html).not.toContain('<form');
  });
  it('renders public chest availability without contents and spectator contents only when present', () => {
    expect(renderToStaticMarkup(<ChestPanel room={ownerRoom()} />)).not.toContain('Brass Idol');
    expect(renderToStaticMarkup(<ChestPanel room={spectatorRoom()} />)).toContain('Brass Idol');
  });
  it('does not expose covered Threat commitments and restricts responses to projected capability', () => {
    const room = ownerRoom();
    room.public.pendingThreat = { id: 'threat', actorId: 'p2', targetId: 'p1', mode: 'COVERED', demandedItems: [], demandedCoins: 2, status: 'PENDING', deadlineAt: Date.now() + 30000 };
    let html = renderToStaticMarkup(<PendingInteraction room={room} send={send} busy={false} />);
    expect(html).toContain('BACKED BY A COVERED ITEM'); expect(html).not.toContain('<button');
    room.private.capabilities = ['RESPOND_THREAT'];
    html = renderToStaticMarkup(<PendingInteraction room={room} send={send} busy={false} />);
    expect(html).toContain('>Y</kbd>Comply</button>'); expect(html).toContain('>N</kbd>Refuse</button>');
    expect(html).not.toContain('Presented item:');
  });
  it('displays Trade terms and the two response controls without timeout hint copy', () => {
    const room = ownerRoom(); room.private.capabilities = ['RESPOND_TRADE'];
    room.public.pendingTrade = { id: 'trade', actorId: 'p2', targetId: 'p1', offeredItems: ['p2-pistol'], offeredCoins: 0, requestedItems: [], requestedCoins: 3, status: 'PENDING', deadlineAt: Date.now() + 30000 };
    const html = renderToStaticMarkup(<PendingInteraction room={room} send={send} busy={false} />);
    expect(html).toContain('Pistol, 0 Gold'); expect(html).toContain('3 Gold'); expect(html).not.toContain('automatic');
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
    expect(threat).not.toContain('value="p1-cloth"');
  });
  it('does not offer ineligible social targets before the server rejects them', () => {
    const room = ownerRoom();
    room.public.players.push(
      { ...room.public.players[1]!, id: 'p3', seat: 2, name: 'Downed Cora', life: 'DOWNED' },
      { ...room.public.players[1]!, id: 'p4', seat: 3, name: 'Offline Dax', connection: 'DISCONNECTED' },
    );
    const trade = renderToStaticMarkup(<TradeForm room={room} send={send} busy={false} />);
    const threat = renderToStaticMarkup(<ThreatForm room={room} send={send} busy={false} />);
    expect(trade).not.toContain('Downed Cora'); expect(threat).not.toContain('Downed Cora');
    expect(trade).not.toContain('Offline Dax'); expect(threat).not.toContain('Offline Dax');

    room.public.players[1]!.life = 'DEAD';
    const chat = renderToStaticMarkup(<ChatPanel room={room} sendChat={send} busy={false} />);
    expect(chat).toContain('Private: Bruno · unavailable');
    expect(chat).toContain('Private: Offline Dax · unavailable');
  });
  it('exposes Downed loot from public inventory without an interaction hint', () => {
    const room = ownerRoom(); room.public.players[1]!.life = 'DOWNED';
    const html = renderToStaticMarkup(<DownedForm room={room} send={send} busy={false} />);
    expect(html).toContain('p2-pistol'); expect(html).toContain('REVIVE'); expect(html).toContain('HELP'); expect(html).not.toContain('does not consume');
  });
  it('keeps markets inspectable while waiting and gates purchases/selling by capability', () => {
    const room = ownerRoom(); room.private.capabilities = ['CHAT'];
    room.public.round!.phase = 'INTERMISSION';
    room.public.shop = { id: 'intermission-1', phase: 'PUBLIC', prepDeadlineAt: 15000, publicDeadlineAt: 30000, privateUnlockedBy: {}, finishedBy: {}, publicOffers: [{ id: 'public-offer', itemId: 'knife', price: 4 }], order: ['p2', 'p1'], activeShopperIndex: 0, publicPurchasedBy: {} };
    room.private.blackMarket = [{ id: 'private-offer', itemId: 'safe', price: 5 }];
    let html = renderToStaticMarkup(<Markets room={room} send={send} busy={false} />);
    expect(html).toContain('Your private Black Market'); expect(html).not.toContain('private-offer'); expect(html).toContain('buy or pass on your Public Shop turn'); expect(html).toContain('disabled="">Purchase unavailable');
    room.private.capabilities = ['BUY', 'BUY_PUBLIC', 'SELL', 'POCKET', 'ASSIGN_SAFE', 'FINISH_SHOPPING'];
    html = renderToStaticMarkup(<Markets room={room} send={send} busy={false} />);
    expect(html).toContain('Buy Knife'); expect(html).toContain('Sell item'); expect(html).toContain('Finish Intermission'); expect(html).toContain('Manage Pockets');
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
  it('honors scene-selected items and targets', () => {
    const room = ownerRoom();
    room.public.players[0]!.visibleInventory.unshift({ instanceId: 'p1-knife', itemId: 'knife', quantity: 1 });
    room.public.players.push({ ...room.public.players[1]!, id: 'p3', seat: 2, name: 'Cora', visibleInventory: [{ instanceId: 'p3-knife', itemId: 'knife', quantity: 1 }, null, null, null, null, null] });
    let html = renderToStaticMarkup(<UseItemForm room={room} send={send} busy={false} preferredItemId="p1-pistol" preferredTargetId="p2" />);
    expect(html).toContain('value="p1-pistol" selected=""');
    html = renderToStaticMarkup(<TradeForm room={room} send={send} busy={false} preferredTargetId="p3" preferredRequestedItemId="p3-knife" />);
    expect(html).toContain('value="p3" selected=""');
    expect(html).toContain('name="requestedItems" checked="" value="p3-knife"');
  });

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
