import { useState } from 'react';
import type { FormEvent } from 'react';
import type { ItemStack, PublicPlayerView, ShopOffer } from '@the-table/game';
import type { RoomView } from './protocol';
import { hasCapability, ITEM_HELP, itemName, ownItems, playerName, presentItems, stackName, words, needsOpponent, usesChest, useItemOptions, useItemTargets, useItemCommand } from './gameplay';
import { OfferList, type ActionProps } from './MatchPanels';

const value = (data: FormData, key: string) => String(data.get(key) ?? '');
const coins = (data: FormData, key: string) => Number(data.get(key) ?? 0);
const checked = (data: FormData, key: string) => data.get(key) === 'on';
const selected = (data: FormData, key: string) => data.getAll(key).map(String);
const me = (room: RoomView) => room.public.players.find(player => player.id === room.private.playerId)!;

export function ItemSelect({ items, label, name, value: selection, onChange }: { items: ItemStack[]; label: string; name: string; value?: string; onChange?: (id: string) => void }) {
  return <label>{label}<select name={name} required {...(selection !== undefined ? { value: selection } : {})} onChange={event => onChange?.(event.target.value)}>
    {!items.length && <option value="">No items available</option>}{items.map(item => <option key={item.instanceId} value={item.instanceId}>{stackName(item)}</option>)}
  </select></label>;
}
function TargetSelect({ players, value: selection, onChange, label = 'Player', includeSelf }: { players: PublicPlayerView[]; value: string; onChange: (id: string) => void; label?: string; includeSelf?: boolean }) {
  return <label>{label}<select name="targetId" required value={selection} onChange={event => onChange(event.target.value)}>
    {includeSelf && <option value="self">Self / table</option>}
    {!players.length && !includeSelf && <option value="">No players available</option>}
    {players.map(player => <option key={player.id} value={player.id}>{player.name} · {words(player.life)}{player.connection === 'DISCONNECTED' ? ' · Offline' : ''}</option>)}
  </select></label>;
}
function Check({ name, children }: { name: string; children: React.ReactNode }) {
  return <label className="check-row"><input type="checkbox" name={name} /><span>{children}</span></label>;
}
function Assets({ player, prefix, legend }: { player: PublicPlayerView; prefix: string; legend: string }) {
  return <fieldset className="asset-picker"><legend>{legend}</legend><div className="asset-options">{presentItems(player.visibleInventory).map(item => <label className="check-row" key={item.instanceId}><input type="checkbox" name={`${prefix}Items`} value={item.instanceId} /><span>{stackName(item)}</span></label>)}</div>
    {!presentItems(player.visibleInventory).length && <p className="muted">No visible items</p>}
    <label>{legend} Coins <span className="muted">{player.coins} available</span><input name={`${prefix}Coins`} type="number" inputMode="numeric" min="0" max={player.coins} step="1" defaultValue="0" required /></label>
  </fieldset>;
}

export function UseItemForm({ room, send, busy }: ActionProps) {
  const items = useItemOptions(room);
  const [itemId, setItem] = useState(items[0]?.instanceId ?? '');
  const item = items.find(entry => entry.instanceId === itemId) ?? items[0];
  const [targetDraft, setTarget] = useState('self');
  const targets = useItemTargets(room, item?.itemId ?? '');
  const opponentRequired = needsOpponent(item?.itemId ?? '');
  const targetId = targets.some(player => player.id === targetDraft) ? targetDraft : opponentRequired ? targets[0]?.id ?? '' : 'self';
  const target = room.public.players.find(player => player.id === targetId) ?? me(room);
  const pocketUse = item && ['spyglass', 'pickpocket', 'glass-eye'].includes(item.itemId);
  const chestUse = item && usesChest(item.itemId);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!item) return;
    const data = new FormData(event.currentTarget);
    void send(useItemCommand(item, targetId, pocketUse ? coins(data, 'pocketIndex') : undefined, checked(data, 'quickDraw')));
  };
  return <form className="action-form" onSubmit={submit} aria-label="Use item"><fieldset disabled={busy}><legend>Use an item</legend>
    <ItemSelect items={items} label="Your item (visible or Pocket)" name="instanceId" value={item?.instanceId ?? ''} onChange={setItem} />
    {item && <p className="item-help">{ITEM_HELP[item.itemId]}</p>}
    {!chestUse && <TargetSelect players={targets} includeSelf={!opponentRequired} value={targetId} onChange={setTarget} label="Item target" />}
    {pocketUse && <label>Target Pocket<select name="pocketIndex">{target.pocketOccupancy.map((occupied, index) => <option value={index} key={index}>Pocket {index + 1} · {occupied ? 'Occupied' : 'Empty'}</option>)}</select></label>}
    {item?.itemId === 'pistol' && me(room).roleId === 'enforcer' && <Check name="quickDraw">Use Quick Draw (once per match)</Check>}
    <button className="button primary" disabled={!item || (opponentRequired && !targetId)}>{chestUse ? `Open ${item.itemId === 'black-key' ? 'Black' : 'Standard'} Chest` : item ? `Use ${itemName(item.itemId)}` : 'Use item'}</button>
  </fieldset></form>;
}

export function TradeForm({ room, send, busy }: ActionProps) {
  const others = room.public.players.filter(player => player.id !== room.private.playerId);
  const [targetId, setTarget] = useState(others[0]?.id ?? '');
  const target = others.find(player => player.id === targetId);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void send({ type: 'TRADE', targetId, offeredItems: selected(data, 'offeredItems'), offeredCoins: coins(data, 'offeredCoins'), requestedItems: selected(data, 'requestedItems'), requestedCoins: coins(data, 'requestedCoins') });
  };
  return <form className="action-form" onSubmit={submit} aria-label="Compose Trade"><fieldset disabled={busy}><legend>Propose a Trade</legend>
    <TargetSelect players={others} value={targetId} onChange={setTarget} label="Trade with" />
    <p className="muted">Only visible items and Coins can be traded. Zero-item and zero-Coin offers are allowed. Selected assets lock until a response.</p>
    <Assets player={me(room)} prefix="offered" legend="You offer" />
    {target && <Assets key={targetId} player={target} prefix="requested" legend="You request" />}
    <button className="button primary" disabled={!target}>Propose Trade</button>
  </fieldset></form>;
}

export function ThreatForm({ room, send, busy }: ActionProps) {
  const others = room.public.players.filter(player => player.id !== room.private.playerId);
  const [targetId, setTarget] = useState(others[0]?.id ?? '');
  const [mode, setMode] = useState<'OPEN' | 'COVERED'>('OPEN');
  const target = others.find(player => player.id === targetId);
  const visible = presentItems(me(room).visibleInventory);
  const cloth = ownItems(room).filter(item => item.itemId === 'cloth');
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void send({ type: 'THREAT', targetId, mode, committedItemId: value(data, 'committedItemId'),
      ...(mode === 'COVERED' ? { clothItemId: value(data, 'clothItemId') } : {}),
      demandedItems: selected(data, 'demandedItems'), demandedCoins: coins(data, 'demandedCoins'),
      ...(checked(data, 'quickDraw') ? { useQuickDraw: true } : {}),
    });
  };
  return <form className="action-form" onSubmit={submit} aria-label="Compose Threat"><fieldset disabled={busy}><legend>Make a Threat</legend>
    <TargetSelect players={others} value={targetId} onChange={setTarget} label="Threaten" />
    <label>Threat mode<select name="mode" value={mode} onChange={event => setMode(event.target.value as 'OPEN' | 'COVERED')}><option value="OPEN">Open · present a valid weapon</option><option value="COVERED">Covered · commit one item and consume Cloth</option></select></label>
    <ItemSelect items={visible} label={mode === 'OPEN' ? 'Visible weapon' : 'Visible item to cover'} name="committedItemId" />
    {mode === 'COVERED' && <ItemSelect items={cloth} label="Cloth to consume" name="clothItemId" />}
    {me(room).roleId === 'enforcer' && <Check name="quickDraw">Commit Quick Draw if a Pistol is refused</Check>}
    {target && <Assets key={targetId} player={target} prefix="demanded" legend="You demand" />}
    <p className="muted">Comply transfers the demand. Refuse triggers an attack only when the committed weapon is valid. Covered items are revealed after resolution.</p>
    <button className="button primary" disabled={!target || !visible.length || (mode === 'COVERED' && !cloth.length)}>Make Threat</button>
  </fieldset></form>;
}

export function DownedForm({ room, send, busy, immediate = false }: ActionProps & { immediate?: boolean }) {
  const targets = room.public.players.filter(player => immediate ? player.id === room.public.turn?.immediateLoot?.targetId : player.life === 'DOWNED' && player.id !== room.private.playerId);
  const [targetId, setTarget] = useState(targets[0]?.id ?? '');
  const target = targets.find(player => player.id === targetId) ?? targets[0];
  const [kind, setKind] = useState<'LOOT' | 'REVIVE' | 'HELP'>('LOOT');
  const actionKind = immediate ? 'LOOT' : kind;
  const items = actionKind === 'LOOT' ? presentItems(target?.visibleInventory ?? []) : ownItems(room).filter(item => item.itemId === 'medicine' || (actionKind === 'HELP' && item.itemId === 'antidote'));
  if (!targets.length) return <p className="muted">No Downed players at the table.</p>;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!target) return;
    const data = new FormData(event.currentTarget);
    void send(immediate ? { type: 'LOOT_DOWNED', targetId: target.id, instanceId: value(data, 'instanceId') } : { type: 'DOWNED_INTERACTION', targetId: target.id, instanceId: value(data, 'instanceId'), kind: actionKind });
  };
  return <form className="action-form" onSubmit={submit} aria-label={immediate ? 'Immediate loot' : 'Downed interaction'}><fieldset disabled={busy}><legend>{immediate ? 'Immediate attacker loot' : 'Help or loot a Downed player'}</legend>
    <TargetSelect players={targets} value={target?.id ?? ''} onChange={setTarget} label="Downed player" />
    {!immediate && <label>Interaction<select value={kind} onChange={event => setKind(event.target.value as typeof kind)}><option value="LOOT">Loot one visible item</option><option value="REVIVE">Revive with Medicine</option><option value="HELP">Help with Medicine or Antidote</option></select></label>}
    <ItemSelect key={`${target?.id}-${actionKind}`} items={items} label={actionKind === 'LOOT' ? 'Their visible item' : 'Your help item'} name="instanceId" />
    <p className="muted">{immediate ? 'You may loot one visible item immediately after Downing this player.' : 'One extra Downed interaction during the rescue window. This does not consume your normal Primary Action.'}</p>
    <button className="button primary" disabled={!items.length}>{actionKind === 'LOOT' ? 'Loot item' : actionKind === 'REVIVE' ? 'Revive player' : 'Help player'}</button>
  </fieldset></form>;
}

export function InventoryForm({ room, send, busy }: ActionProps) {
  const visible = presentItems(me(room).visibleInventory);
  const [action, setAction] = useState<'POCKET' | 'ASSIGN_SAFE'>('POCKET');
  const options = (['POCKET', 'ASSIGN_SAFE'] as const).filter(type => hasCapability(room, type));
  const type = options.includes(action) ? action : options[0];
  if (!type) return null;
  const items = type === 'ASSIGN_SAFE' ? visible.filter(item => item.itemId === 'safe') : visible;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void send({ type, instanceId: value(data, 'instanceId'), pocketIndex: coins(data, 'pocketIndex') });
  };
  return <form className="action-form" onSubmit={submit} aria-label="Manage Pockets"><fieldset disabled={busy}><legend>Manage Pockets</legend>
    <label>Inventory action<select value={type} onChange={event => setAction(event.target.value as typeof action)}>{options.map(option => <option value={option} key={option}>{option === 'POCKET' ? 'Place an item in an empty Pocket' : 'Assign a Safe to a Pocket'}</option>)}</select></label>
    <ItemSelect key={type} items={items} label={type === 'ASSIGN_SAFE' ? 'Visible Safe' : 'Visible item to Pocket'} name="instanceId" />
    <label>Pocket<select name="pocketIndex">{room.private.pockets.map((pocket, index) => <option key={index} value={index}>Pocket {index + 1} · {pocket.item ? 'Occupied' : 'Empty'}{pocket.protectedBySafe ? ' · Protected' : ''}</option>)}</select></label>
    <button className="button primary" disabled={!items.length}>{type === 'POCKET' ? 'Place in Pocket' : 'Assign Safe'}</button>
  </fieldset></form>;
}

function MarketOffers({ offers, market, room, send, busy }: ActionProps & { offers: ShopOffer[]; market: 'PUBLIC' | 'BLACK' }) {
  const [discount, setDiscount] = useState(false);
  const bought = market === 'PUBLIC' ? room.public.shop?.publicPurchasedBy[room.private.playerId] : offers.some(offer => offer.purchasedBy === room.private.playerId);
  const canBuy = hasCapability(room, 'BUY');
  const owned = ownItems(room);
  return <div className="market-offers">
    {bought && <p className="status-tag">Your purchase from this market is complete.</p>}
    {market === 'PUBLIC' && canBuy && owned.some(item => item.itemId === 'red-ledger') && <label className="check-row"><input type="checkbox" checked={discount} onChange={event => setDiscount(event.target.checked)} /><span>Use Red Ledger for 1 Coin off</span></label>}
    {offers.map(offer => <div className="market-offer" key={offer.id}><div><h4>{itemName(offer.itemId)}</h4><p className="offer-price">{offer.price} Coins{offer.purchasedBy ? ' · Purchased' : ''}</p><p className="muted">{ITEM_HELP[offer.itemId]}</p></div>
      <div className="offer-actions">{canBuy && <button className="button secondary" disabled={busy || Boolean(bought || offer.purchasedBy)} onClick={() => void send({ type: 'BUY', market, offerId: offer.id, ...(market === 'PUBLIC' && discount ? { useRedLedger: true } : {}) })}>Buy {itemName(offer.itemId)}</button>}
        {market === 'BLACK' && hasCapability(room, 'REROLL_MARKET') && owned.some(item => item.itemId === 'brass-idol') && <button className="button quiet" disabled={busy || Boolean(bought || offer.purchasedBy)} onClick={() => void send({ type: 'REROLL_MARKET', offerId: offer.id })}>Reroll {itemName(offer.itemId)}</button>}
      </div>
    </div>)}
    {!offers.length && <p className="muted">No offers remain in this market.</p>}
  </div>;
}
export function Markets({ room, send, busy }: ActionProps) {
  const visible = presentItems(me(room).visibleInventory);
  const sell = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void send({ type: 'SELL', instanceId: value(new FormData(event.currentTarget), 'instanceId') });
  };
  return <section className="panel" aria-label="Intermission markets"><h2>Markets</h2>{hasCapability(room, 'INSPECT_CHEST') && <button className="button secondary full-width" disabled={busy} onClick={() => void send({ type: 'INSPECT_CHEST' })}>Inspect Standard Chest</button>}<p className="muted">Shopping: {playerName(room.public, room.public.shop?.order[room.public.shop.activeShopperIndex])}. Sell before buying. One purchase from each market per Intermission.</p>
    {hasCapability(room, 'SELL') && <form className="action-form" aria-label="Sell item" onSubmit={sell}><fieldset disabled={busy}><legend>Sell visible items</legend><ItemSelect items={visible} name="instanceId" label="Item to sell" /><p className="muted">Artifacts and Passage Token cannot be sold. Resale is half the base price, rounded down (minimum 1 Coin); Broker adds 1, capped below base price.</p><button className="button secondary" disabled={!visible.length}>Sell item</button></fieldset></form>}
    <h3>Public Shop</h3><MarketOffers room={room} send={send} busy={busy} offers={room.public.shop?.publicOffers ?? []} market="PUBLIC" />
    <h3>Your private Black Market</h3><p className="muted">Only you and verified spectators can see these offers.</p><MarketOffers room={room} send={send} busy={busy} offers={room.private.blackMarket ?? []} market="BLACK" />
    {(hasCapability(room, 'POCKET') || hasCapability(room, 'ASSIGN_SAFE')) && <InventoryForm room={room} send={send} busy={busy} />}
    {hasCapability(room, 'FINISH_SHOPPING') && <button className="button primary full-width" disabled={busy} onClick={() => void send({ type: 'FINISH_SHOPPING' })}>Finish shopping</button>}
  </section>;
}
export function ReadOnlyPublicShop({ room }: { room: { public: RoomView['public'] } }) {
  return <section className="panel"><h2>Public Shop</h2><OfferList offers={room.public.shop?.publicOffers ?? []} /></section>;
}

const ACTIONS = [
  { capability: 'USE_ITEM', label: 'Use item', component: UseItemForm },
  { capability: 'TRADE', label: 'Trade', component: TradeForm },
  { capability: 'THREAT', label: 'Threat', component: ThreatForm },
  { capability: 'DOWNED_INTERACTION', label: 'Help / loot', component: DownedForm },
] as const;
export function TurnActions({ room, send, busy }: ActionProps) {
  const [selectedAction, setSelected] = useState<string>('USE_ITEM');
  const actions = ACTIONS.filter(action => hasCapability(room, action.capability));
  const current = actions.find(action => action.capability === selectedAction) ?? actions[0];
  const Component = current?.component;
  const immediate = hasCapability(room, 'LOOT_DOWNED');
  const turn = hasCapability(room, 'END_TURN');
  const inspect = hasCapability(room, 'INSPECT_CHEST');
  if (!actions.length && !immediate && !turn && !inspect) return <section className="panel"><h2>Watch the table</h2><p className="muted">Your available actions will appear here. You can review the table and use chat while waiting.</p></section>;
  return <section className="panel" aria-label="Your actions"><h2>Your actions</h2>
    {hasCapability(room, 'LEAVE_TABLE') && <div className="exit-choice"><h3>Your exit is ready</h3><p>Leave now to bank your objective. Choosing to stay defers this chance to your next normal turn.</p><div className="button-row"><button className="button primary" disabled={busy} onClick={() => void send({ type: 'LEAVE_TABLE' })}>Leave Table</button>{hasCapability(room, 'STAY') && <button className="button secondary" disabled={busy} onClick={() => void send({ type: 'STAY' })}>Stay at Table</button>}</div></div>}
    {immediate && <DownedForm key={room.public.turn?.immediateLoot?.downEventId} room={room} send={send} busy={busy} immediate />}
    {actions.length > 0 && <div className="action-tabs" aria-label="Choose action">{actions.map(action => <button type="button" className={current === action ? 'selected' : ''} key={action.capability} aria-pressed={current === action} onClick={() => setSelected(action.capability)}>{action.label}</button>)}</div>}
    {Component && <Component key={`${current.capability}-${room.public.turn?.serial}`} room={room} send={send} busy={busy} />}
    {inspect && <button className="button secondary full-width" disabled={busy} onClick={() => void send({ type: 'INSPECT_CHEST' })}>Inspect Standard Chest</button>}
    {turn && <button className="button quiet full-width end-turn" disabled={busy} onClick={() => void send({ type: 'END_TURN' })}>{room.public.turn?.primaryUsed ? 'End turn' : 'Skip Primary Action & end turn'}</button>}
  </section>;
}
