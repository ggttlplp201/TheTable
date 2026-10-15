import { blackMarketUnlocked, BLACK_MARKET_LOCK_REASON, ledgerAvailable, resaleState } from './market-presentation';
import { useState } from 'react';
import type { FormEvent } from 'react';
import type { ItemStack, PublicPlayerView, ShopOffer } from '@the-table/game';
import type { RoomView } from './protocol';
import { hasCapability, ITEM_BY_ID, ITEM_HELP, itemName, ownItems, presentItems, stackName, words, needsOpponent, usesChest, useItemOptions, useItemTargets, useItemCommand } from './gameplay';
import { OfferList, type ActionProps } from './MatchPanels';
import { ReferenceItemArt } from './ReferenceItemArt';
import './action-v14.css';

const value = (data: FormData, key: string) => String(data.get(key) ?? '');
const coins = (data: FormData, key: string) => Number(data.get(key) ?? 0);
const checked = (data: FormData, key: string) => data.get(key) === 'on';
const selected = (data: FormData, key: string) => data.getAll(key).map(String);
const me = (room: RoomView) => room.public.players.find(player => player.id === room.private.playerId)!;

export function pocketDestinationMode(emptyPocketIndexes: number[]): { kind: 'UNAVAILABLE' | 'IMMEDIATE' | 'CHOOSE'; pocketIndex?: number } {
  if (!emptyPocketIndexes.length) return { kind: 'UNAVAILABLE' };
  if (emptyPocketIndexes.length === 1) return { kind: 'IMMEDIATE', pocketIndex: emptyPocketIndexes[0]! };
  return { kind: 'CHOOSE' };
}

function DraftSaved({ visible, phase = 'TURN' }: { visible: boolean; phase?: 'TURN' | 'INTERMISSION' }) {
  return visible ? <p className="action-draft-saved" role="status">{phase === 'TURN' ? 'Turn ended. Draft saved.' : 'Intermission action unavailable. Selection saved.'}</p> : null;
}

export function ItemSelect({ items, label, name, value: selection, onChange }: { items: ItemStack[]; label: string; name: string; value?: string; onChange?: (id: string) => void }) {
  const [draft, setDraft] = useState(items[0]?.instanceId ?? '');
  const current = selection ?? (items.some(item => item.instanceId === draft) ? draft : items[0]?.instanceId ?? '');
  const choose = (id: string) => { setDraft(id); onChange?.(id); };
  return <fieldset className="visual-choice"><legend>{label}</legend><div className="choice-grid item-choice-grid">
    {items.map(item => <button type="button" className={item.instanceId === current ? 'selected' : ''} aria-label={stackName(item)} title={`${stackName(item)} · ${ITEM_HELP[item.itemId]}`} aria-pressed={item.instanceId === current} key={item.instanceId} onClick={() => choose(item.instanceId)}><ReferenceItemArt itemId={item.itemId} /><strong>{stackName(item)}</strong><small>{ITEM_HELP[item.itemId]}</small></button>)}
    {!items.length && <p className="muted">No items available</p>}
  </div><label className="sr-only">{label}<select name={name} required value={current} onChange={event => choose(event.target.value)}>{!items.length && <option value="">No items available</option>}{items.map(item => <option key={item.instanceId} value={item.instanceId}>{stackName(item)}</option>)}</select></label></fieldset>;
}
function TargetSelect({ players, value: selection, onChange, label = 'Player', includeSelf }: { players: PublicPlayerView[]; value: string; onChange: (id: string) => void; label?: string; includeSelf?: boolean }) {
  return <fieldset className="visual-choice target-choice"><legend>{label}</legend><div className="choice-grid">
    {includeSelf && <button type="button" className={selection === 'self' ? 'selected' : ''} aria-pressed={selection === 'self'} onClick={() => onChange('self')}>Self / table</button>}
    {players.map(player => <button type="button" className={selection === player.id ? 'selected' : ''} aria-pressed={selection === player.id} key={player.id} onClick={() => onChange(player.id)}><strong>{player.name}</strong><small>{words(player.life)}{player.connection === 'DISCONNECTED' ? ' · Offline' : ''}</small></button>)}
    {!players.length && !includeSelf && <p className="muted">No players available</p>}
  </div><label className="sr-only">{label}<select name="targetId" required value={selection} onChange={event => onChange(event.target.value)}>{includeSelf && <option value="self">Self / table</option>}{!players.length && !includeSelf && <option value="">No players available</option>}{players.map(player => <option key={player.id} value={player.id}>{player.name} · {words(player.life)}</option>)}</select></label></fieldset>;
}
function Check({ name, children }: { name: string; children: React.ReactNode }) {
  return <label className="check-row"><input type="checkbox" name={name} /><span>{children}</span></label>;
}
function Assets({ player, prefix, legend, preferredItemId }: { player: PublicPlayerView; prefix: string; legend: string; preferredItemId?: string | undefined }) {
  const [amount, setAmount] = useState(0);
  const slots = Array.from({ length: 6 }, (_, index) => player.visibleInventory[index] ?? null);
  return <fieldset className="asset-picker"><legend>{legend}</legend><div className="asset-options">{slots.map((item, index) => item ? <label className="asset-tile" key={item.instanceId} title={stackName(item)}><input type="checkbox" name={`${prefix}Items`} value={item.instanceId} defaultChecked={item.instanceId === preferredItemId} /><ReferenceItemArt itemId={item.itemId} /><span className="sr-only">{stackName(item)}</span><span className="asset-mark" aria-hidden="true">✓</span>{item.quantity > 1 && <small className="asset-quantity">{item.quantity}</small>}</label> : <span key={`empty-${index}`} className="asset-tile empty" aria-hidden="true" />)}</div>
    <div className="reference-coin-stepper"><ReferenceItemArt itemId="coin" size={32} /><button type="button" aria-label={`Decrease ${legend} Gold`} disabled={amount === 0} onClick={() => setAmount(current => Math.max(0, current - 1))}>−</button><label><span className="sr-only">{legend} Gold</span><input name={`${prefix}Coins`} type="number" inputMode="numeric" min="0" max={player.coins} step="1" value={amount} onChange={event => setAmount(Math.max(0, Math.min(player.coins, Number(event.target.value))))} required /></label><button type="button" aria-label={`Increase ${legend} Gold`} disabled={amount >= player.coins} onClick={() => setAmount(current => Math.min(player.coins, current + 1))}>+</button><span>OF {player.coins}</span></div>
  </fieldset>;
}

export function UseItemForm({ room, send, busy, preferredItemId, preferredTargetId, preferredPocketIndex }: ActionProps & { preferredItemId?: string | undefined; preferredTargetId?: string | undefined; preferredPocketIndex?: number | undefined }) {
  const allowed = hasCapability(room, 'USE_ITEM');
  const glassEyeSpent = room.private.abilities?.glassEyeRound === room.public.round?.number;
  const items = useItemOptions(room).filter(entry => entry.itemId !== 'glass-eye' || !glassEyeSpent);
  const preferredItem = items.find(entry => entry.instanceId === preferredItemId);
  const [itemId, setItem] = useState(preferredItem?.instanceId ?? items[0]?.instanceId ?? '');
  const item = items.find(entry => entry.instanceId === itemId) ?? items[0];
  const [targetDraft, setTarget] = useState(preferredTargetId ?? 'self');
  const targets = useItemTargets(room, item?.itemId ?? '');
  const opponentRequired = needsOpponent(item?.itemId ?? '');
  const targetId = targets.some(player => player.id === targetDraft) ? targetDraft : opponentRequired ? targets[0]?.id ?? '' : 'self';
  const target = room.public.players.find(player => player.id === targetId) ?? me(room);
  const stimulantNoBenefit = item?.itemId === 'stimulant' && target.hp >= 5 && (target.temporaryHp ?? 0) >= 2;
  const pocketUse = item && ['spyglass', 'pickpocket', 'glass-eye'].includes(item.itemId);
  const chestUse = item && usesChest(item.itemId);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!item || !allowed || stimulantNoBenefit) return;
    const data = new FormData(event.currentTarget);
    void send(useItemCommand(item, targetId, pocketUse ? coins(data, 'pocketIndex') : undefined, checked(data, 'quickDraw')));
  };
  return <form className="action-form" onSubmit={submit} aria-label="Use item"><fieldset disabled={busy}><legend>Use an item</legend>
    {preferredItem ? <div className="selected-scene-item" aria-label={`Selected item: ${stackName(preferredItem)}`}><ReferenceItemArt itemId={preferredItem.itemId} size={64} /><span><small>SELECTED FROM THE TABLE</small><strong>{stackName(preferredItem)}</strong></span></div> : <ItemSelect items={items} label="Your item (visible or Pocket)" name="instanceId" value={item?.instanceId ?? ''} onChange={setItem} />}
    {item && <p className="item-help">{ITEM_HELP[item.itemId]}</p>}
    {!chestUse && opponentRequired && !preferredTargetId && <TargetSelect players={targets} value={targetId} onChange={setTarget} label="Item target" />}
    {pocketUse && (preferredPocketIndex !== undefined ? <div className="selected-target-pocket"><span>TARGET POCKET</span><strong>{target.name.toUpperCase()} · POCKET {preferredPocketIndex + 1} · {target.pocketOccupancy[preferredPocketIndex] ? 'OCCUPIED' : 'EMPTY'}</strong><input type="hidden" name="pocketIndex" value={preferredPocketIndex} /></div> : <label>Target Pocket<select name="pocketIndex">{target.pocketOccupancy.map((occupied, index) => <option value={index} key={index}>Pocket {index + 1} · {occupied ? 'Occupied' : 'Empty'}</option>)}</select></label>)}
    {item?.itemId === 'pistol' && me(room).roleId === 'enforcer' && (room.private.abilities?.quickDrawUsed ? <p className="ability-spent">QUICK DRAW — USED</p> : <Check name="quickDraw">Use Quick Draw (Pistol modifier · once per match)</Check>)}
    {glassEyeSpent && ownItems(room).some(entry => entry.itemId === 'glass-eye') && <p className="ability-spent">GLASS EYE — USED THIS ROUND</p>}
    {stimulantNoBenefit && <p className="form-error" role="status">Stimulant would provide no HP or Temporary HP to this target.</p>}
    {(!item || (opponentRequired && !targetId)) && <p className="form-error" role="status">{!item ? 'You have no items that can be used as a Primary Action.' : item.itemId === 'knife' ? 'No active player is seated within Knife reach.' : 'No connected, active target is available for this item.'}</p>}
    <DraftSaved visible={!allowed} />
    <button className="button primary" disabled={!allowed || !item || stimulantNoBenefit || (opponentRequired && !targetId)}>{allowed ? chestUse ? `Open ${item.itemId === 'black-key' ? 'Black' : 'Standard'} Chest` : item ? `Use ${itemName(item.itemId)}` : 'Use item' : 'TURN ENDED'}</button>
  </fieldset></form>;
}

export function TradeForm({ room, send, busy, preferredTargetId, preferredRequestedItemId, onCancel }: ActionProps & { preferredTargetId?: string | undefined; preferredRequestedItemId?: string | undefined; onCancel?: () => void }) {
  const allowed = hasCapability(room, 'TRADE');
  const others = room.public.players.filter(player => player.id !== room.private.playerId && player.life === 'ACTIVE' && player.connection === 'CONNECTED');
  const preferredTarget = others.find(player => player.id === preferredTargetId);
  const [targetId, setTarget] = useState(preferredTarget?.id ?? others[0]?.id ?? '');
  const target = others.find(player => player.id === targetId);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!allowed) return;
    const data = new FormData(event.currentTarget);
    void send({ type: 'TRADE', targetId, offeredItems: selected(data, 'offeredItems'), offeredCoins: coins(data, 'offeredCoins'), requestedItems: selected(data, 'requestedItems'), requestedCoins: coins(data, 'requestedCoins') });
  };
  return <form className="action-form reference-trade" onSubmit={submit} aria-label="Compose Trade"><fieldset disabled={busy}><legend className="sr-only">Propose a Trade</legend>
    <div className="reference-screen-heading"><h2>Propose a trade</h2><label className="reference-trade-target">WITH <select aria-label="Trade with" name="targetId" value={targetId} onChange={event => setTarget(event.target.value)}>{others.map(player => <option key={player.id} value={player.id}>{player.name.toUpperCase()}</option>)}</select></label></div>
    <div className="reference-trade-columns"><Assets player={me(room)} prefix="offered" legend="You offer" /><div className="exchange-arrow" aria-hidden="true">⇄</div>{target && <Assets key={targetId} player={target} prefix="requested" legend="You request" preferredItemId={preferredRequestedItemId} />}</div>
    {!target && <p className="form-error" role="status">No connected, active player is available to trade.</p>}
    <DraftSaved visible={!allowed} />
    <footer><p>VISIBLE ITEMS + GOLD ONLY · POCKETS CAN’T BE TRADED</p><div><button type="button" className="reference-cancel" onClick={onCancel}>CANCEL</button><button className="button primary" aria-label="Propose Trade" disabled={!allowed || !target}>{allowed ? 'SEND OFFER' : 'TURN ENDED'}</button></div></footer>
  </fieldset></form>;
}

export function ThreatForm({ room, send, busy, preferredTargetId, preferredMode = 'OPEN', onCancel }: ActionProps & { preferredTargetId?: string | undefined; preferredMode?: 'OPEN' | 'COVERED' | undefined; onCancel?: () => void }) {
  const allowed = hasCapability(room, 'THREAT');
  const others = room.public.players.filter(player => player.id !== room.private.playerId && player.life === 'ACTIVE' && player.connection === 'CONNECTED');
  const preferredTarget = others.find(player => player.id === preferredTargetId);
  const [targetId, setTarget] = useState(preferredTarget?.id ?? others[0]?.id ?? '');
  const [mode, setMode] = useState<'OPEN' | 'COVERED'>(preferredMode);
  const target = others.find(player => player.id === targetId);
  const visible = presentItems(me(room).visibleInventory);
  const committedItems = mode === 'COVERED' ? visible : visible.filter(item => item.itemId === 'pistol' || (item.itemId === 'knife' && useItemTargets(room, 'knife').some(player => player.id === targetId)));
  const cloth = ownItems(room).filter(item => item.itemId === 'cloth');
  const blocked = !target ? 'No connected, active player is available to threaten.' : !committedItems.length ? mode === 'OPEN' ? 'An Open Threat needs a visible Pistol or a Knife within reach of the target.' : 'You need a visible item to place under the Cloth.' : mode === 'COVERED' && !cloth.length ? 'A covered Threat consumes Cloth. You have none.' : undefined;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!allowed) return;
    const data = new FormData(event.currentTarget);
    void send({ type: 'THREAT', targetId, mode, committedItemId: value(data, 'committedItemId'),
      ...(mode === 'COVERED' ? { clothItemId: value(data, 'clothItemId') } : {}),
      demandedItems: selected(data, 'demandedItems'), demandedCoins: coins(data, 'demandedCoins'),
      ...(checked(data, 'quickDraw') ? { useQuickDraw: true } : {}),
    });
  };
  return <form className="action-form reference-threat" onSubmit={submit} aria-label="Compose Threat"><fieldset disabled={busy}><legend className="sr-only">Make a Threat</legend>
    <div className="reference-screen-heading"><h2>Make a demand</h2><span>⚠ THREAT</span></div>
    <TargetSelect players={others} value={targetId} onChange={setTarget} label="Threaten" />
    {target && <Assets key={targetId} player={target} prefix="demanded" legend="You demand" />}
    <ItemSelect key={`${mode}-${targetId}`} items={committedItems} label={mode === 'OPEN' ? 'Visible weapon' : 'Visible item to cover'} name="committedItemId" />
    <fieldset className="visual-choice threat-mode"><legend>Threat mode</legend><div className="choice-grid"><button type="button" className={mode === 'COVERED' ? 'selected' : ''} aria-pressed={mode === 'COVERED'} onClick={() => setMode('COVERED')}><ReferenceItemArt itemId="cloth" size={28} label="" /><strong>Under cloth</strong><small>Commit an unknown item and consume Cloth</small></button><button type="button" className={mode === 'OPEN' ? 'selected' : ''} aria-pressed={mode === 'OPEN'} onClick={() => setMode('OPEN')}><strong>Open</strong><small>Present a valid weapon</small></button></div><label className="sr-only">Threat mode<select name="mode" value={mode} onChange={event => setMode(event.target.value as 'OPEN' | 'COVERED')}><option value="OPEN">Open</option><option value="COVERED">Covered</option></select></label></fieldset>
    {mode === 'COVERED' && <label className="sr-only">Cloth to consume<select name="clothItemId" defaultValue={cloth[0]?.instanceId ?? ''}>{cloth.map(item => <option key={item.instanceId} value={item.instanceId}>{stackName(item)}</option>)}</select></label>}
    {me(room).roleId === 'enforcer' && (room.private.abilities?.quickDrawUsed ? <p className="ability-spent">QUICK DRAW — USED</p> : <Check name="quickDraw">Commit Quick Draw if a Pistol is refused</Check>)}
    {blocked && <p className="form-error" role="status">{blocked}</p>}
    <DraftSaved visible={!allowed} />
    <footer><button type="button" className="reference-cancel" onClick={onCancel}>CANCEL</button><button className="button primary" aria-label="Make Threat" disabled={!allowed || !target || !committedItems.length || (mode === 'COVERED' && !cloth.length)}>{allowed ? 'SEND THREAT' : 'TURN ENDED'}</button></footer>
  </fieldset></form>;
}

export function DownedForm({ room, send, busy, immediate = false, preferredTargetId }: ActionProps & { immediate?: boolean | undefined; preferredTargetId?: string | undefined }) {
  const allowed = hasCapability(room, immediate ? 'LOOT_DOWNED' : 'DOWNED_INTERACTION');
  const targets = room.public.players.filter(player => immediate ? player.id === room.public.turn?.immediateLoot?.targetId : player.life === 'DOWNED' && player.id !== room.private.playerId);
  const preferredTarget = targets.find(player => player.id === preferredTargetId);
  const [targetId, setTarget] = useState(preferredTarget?.id ?? targets[0]?.id ?? '');
  const target = targets.find(player => player.id === targetId) ?? targets[0];
  const [kind, setKind] = useState<'LOOT' | 'REVIVE' | 'HELP'>('LOOT');
  const actionKind = immediate ? 'LOOT' : kind;
  const items = actionKind === 'LOOT' ? presentItems(target?.visibleInventory ?? []) : ownItems(room).filter(item => item.itemId === 'medicine' || (actionKind === 'HELP' && item.itemId === 'antidote'));
  if (!targets.length) return <p className="muted">No Downed players at the table.</p>;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!target || !allowed) return;
    const data = new FormData(event.currentTarget);
    void send(immediate ? { type: 'LOOT_DOWNED', targetId: target.id, instanceId: value(data, 'instanceId') } : { type: 'DOWNED_INTERACTION', targetId: target.id, instanceId: value(data, 'instanceId'), kind: actionKind });
  };
  return <form className="action-form" onSubmit={submit} aria-label={immediate ? 'Immediate loot' : 'Downed interaction'}><fieldset disabled={busy}><legend>{immediate ? 'Immediate attacker loot' : 'Help or loot a Downed player'}</legend>
    <TargetSelect players={targets} value={target?.id ?? ''} onChange={setTarget} label="Downed player" />
    {!immediate && <fieldset className="visual-choice"><legend>Interaction</legend><div className="choice-grid"><button type="button" className={kind === 'LOOT' ? 'selected' : ''} aria-pressed={kind === 'LOOT'} onClick={() => setKind('LOOT')}>Loot</button><button type="button" className={kind === 'REVIVE' ? 'selected' : ''} aria-pressed={kind === 'REVIVE'} onClick={() => setKind('REVIVE')}>Revive</button><button type="button" className={kind === 'HELP' ? 'selected' : ''} aria-pressed={kind === 'HELP'} onClick={() => setKind('HELP')}>Help</button></div><label className="sr-only">Interaction<select value={kind} onChange={event => setKind(event.target.value as typeof kind)}><option value="LOOT">Loot one visible item</option><option value="REVIVE">Revive with Medicine</option><option value="HELP">Help with Medicine or Antidote</option></select></label></fieldset>}
    <ItemSelect key={`${target?.id}-${actionKind}`} items={items} label={actionKind === 'LOOT' ? 'Their visible item' : 'Your help item'} name="instanceId" />
    {!items.length && <p className="form-error" role="status">{actionKind === 'LOOT' ? 'This player has no visible items to loot.' : actionKind === 'REVIVE' ? 'You need Medicine to revive this player.' : 'You need Medicine or Antidote to help this player.'}</p>}
    <DraftSaved visible={!allowed} />
    <button className="button primary" disabled={!allowed || !items.length}>{allowed ? actionKind === 'LOOT' ? 'Loot item' : actionKind === 'REVIVE' ? 'Revive player' : 'Help player' : 'TURN ENDED'}</button>
  </fieldset></form>;
}

export function InventoryForm({ room, send, busy, onSelectPocketItem }: ActionProps & { onSelectPocketItem?: (instanceId: string) => void }) {
  const visible = presentItems(me(room).visibleInventory);
  const [action, setAction] = useState<'POCKET' | 'ASSIGN_SAFE'>('POCKET');
  const [selectedItem, setSelectedItem] = useState('');
  const [choosingDestination, setChoosingDestination] = useState(false);
  const [feedback, setFeedback] = useState('');
  const options = (['POCKET', 'ASSIGN_SAFE'] as const).filter(type => hasCapability(room, type));
  const type = options.includes(action) ? action : options[0];
  const items = type === 'ASSIGN_SAFE' ? visible.filter(item => item.itemId === 'safe') : visible.filter(item => ITEM_BY_ID[item.itemId]?.pocketEligible);
  const currentItem = items.find(item => item.instanceId === selectedItem) ?? items[0];
  const emptyPocketIndexes = room.private.pockets.flatMap((pocket, index) => pocket.item ? [] : [index]);
  const placement = pocketDestinationMode(emptyPocketIndexes);
  const place = async (item: ItemStack, pocketIndex: number) => {
    const sent = await send({ type: 'POCKET', instanceId: item.instanceId, pocketIndex });
    if (sent) { setChoosingDestination(false); setFeedback(`${itemName(item.itemId)} locked in Pocket ${pocketIndex + 1}.`); }
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!type) return;
    const data = new FormData(event.currentTarget);
    void send({ type, instanceId: value(data, 'instanceId'), pocketIndex: coins(data, 'pocketIndex') });
  };
  return <form className="action-form reference-pockets" onSubmit={submit} aria-label="Manage Pockets"><fieldset disabled={busy}><legend className="sr-only">Manage Pockets</legend>
    <div className="reference-screen-heading"><h2>Your Pockets</h2><span>{type ? 'INTERMISSION' : 'PRIVATE'}</span></div>
    {(!type || !currentItem) && <p role="status">{!type ? room.private.overflows?.length ? 'Resolve your inventory overflow before arranging Pockets.' : 'Arrange Pockets during Intermission before you finish.' : type === 'ASSIGN_SAFE' ? 'You need a visible Safe to protect a Pocket.' : 'You have no visible items that can go into a Pocket.'}</p>}
    {choosingDestination && currentItem && <div className="pocket-destination-prompt" role="status"><strong>CHOOSE A POCKET</strong><span>Selected: {itemName(currentItem.itemId).toUpperCase()}</span><button type="button" onClick={() => setChoosingDestination(false)}>Cancel</button></div>}
    <div className="reference-pocket-row">{room.private.pockets.map((pocket, index) => <button className={`reference-pocket ${pocket.item ? 'occupied' : 'empty'}`} type="button" key={index} disabled={pocket.item ? !onSelectPocketItem : !type || !currentItem || (type === 'POCKET' && !choosingDestination) || (type === 'ASSIGN_SAFE' && pocket.protectedBySafe)} onClick={() => { if (pocket.item) { onSelectPocketItem?.(pocket.item.instanceId); return; } if (!currentItem || !type) return; if (type === 'POCKET') void place(currentItem, index); else void send({ type, instanceId: currentItem.instanceId, pocketIndex: index }); }}><span className="pocket-art">{pocket.item ? <ReferenceItemArt itemId={pocket.item.itemId} size={72} /> : '+'}{pocket.protectedBySafe && <i>⊡</i>}</span><span><small>POCKET {index + 1}{pocket.source === 'BAG' ? ' · BAG' : ''}</small><strong>{pocket.item ? `${itemName(pocket.item.itemId).toUpperCase()} · INSPECT` : `EMPTY${type === 'POCKET' && choosingDestination ? ' · CHOOSE' : ''}`}</strong></span></button>)}</div>
    <div className="reference-pocket-inventory"><p>VISIBLE INVENTORY</p><div>{Array.from({ length: 6 }, (_, index) => me(room).visibleInventory[index] ?? null).map((item, index) => <button type="button" key={item?.instanceId ?? index} aria-label={item ? stackName(item) : `Empty slot ${index + 1}`} className={item?.instanceId === currentItem?.instanceId ? 'selected' : ''} disabled={!item || !items.some(eligible => eligible.instanceId === item.instanceId)} onClick={() => { if (item) { setSelectedItem(item.instanceId); setChoosingDestination(false); setFeedback(''); } }}>{item && <ReferenceItemArt itemId={item.itemId} size={64} />}</button>)}</div></div>
    <div className="reference-pocket-options">{options.map(option => <button type="button" className={type === option ? 'selected' : ''} key={option} disabled={!currentItem || (option === 'POCKET' && placement.kind === 'UNAVAILABLE')} onClick={() => { setAction(option); setFeedback(''); if (option === 'POCKET' && currentItem) { if (placement.kind === 'IMMEDIATE') void place(currentItem, placement.pocketIndex!); else if (placement.kind === 'CHOOSE') setChoosingDestination(true); } else setChoosingDestination(false); }}>{option === 'POCKET' ? placement.kind === 'CHOOSE' && choosingDestination ? 'CHOOSE DESTINATION' : 'PLACE IN POCKET' : 'ASSIGN SAFE'}</button>)}</div>
    {feedback && <p className="pocket-placement-feedback" role="status">{feedback}</p>}
    <p className="reference-pocket-public">PUBLIC VIEW OF YOUR SEAT: POCKET {room.private.pockets.map(pocket => pocket.item ? '◆' : '◇').join(' ')} — CONTENTS NEVER SHOWN</p>
  </fieldset></form>;
}

function MarketOffers({ offers, market, room, send, busy }: ActionProps & { offers: ShopOffer[]; market: 'PUBLIC' | 'BLACK' }) {
  const [discount, setDiscount] = useState(false);
  const bought = market === 'PUBLIC' ? room.public.shop?.publicPurchasedBy[room.private.playerId] : offers.some(offer => offer.purchasedBy === room.private.playerId);
  const canBuy = hasCapability(room, market === 'PUBLIC' ? 'BUY_PUBLIC' : 'BUY_BLACK');
  const owned = ownItems(room);
  const ownsLedger = owned.some(item => item.itemId === 'red-ledger');
  const ownsIdol = owned.some(item => item.itemId === 'brass-idol');
  const ledgerReady = ledgerAvailable(room);
  const idolSpent = room.private.abilities?.brassIdolRound === room.public.round?.number;
  return <div className="market-offers">
    {bought && <p className="status-tag">Your purchase from this market is complete.</p>}
    {market === 'PUBLIC' && ownsLedger && (ledgerReady ? <label className="check-row"><input type="checkbox" checked={discount} onChange={event => setDiscount(event.target.checked)} /><span>Use Red Ledger for 1 Gold off</span></label> : <p className="ability-spent">RED LEDGER — USED THIS INTERMISSION</p>)}
    {market === 'BLACK' && ownsIdol && idolSpent && <p className="ability-spent">BRASS IDOL — USED THIS INTERMISSION</p>}
    {offers.map(offer => <div className="market-offer" key={offer.id}><div><h4>{itemName(offer.itemId)}</h4><p className="offer-price">{offer.price} Gold{offer.purchasedBy ? ' · Purchased' : ''}</p><p className="muted">{ITEM_HELP[offer.itemId]}</p></div>
      <div className="offer-actions"><button className="button secondary" disabled={busy || !canBuy || Boolean(bought || offer.purchasedBy)} onClick={() => void send({ type: 'BUY', market, offerId: offer.id, ...(market === 'PUBLIC' && discount ? { useRedLedger: true } : {}) })}>{canBuy ? `Buy ${itemName(offer.itemId)}` : 'Purchase unavailable'}</button>
        {market === 'BLACK' && hasCapability(room, 'REROLL_MARKET') && ownsIdol && <button className="button quiet" disabled={busy || Boolean(bought || offer.purchasedBy)} onClick={() => void send({ type: 'REROLL_MARKET', offerId: offer.id })}>Reroll {itemName(offer.itemId)}</button>}
      </div>
    </div>)}
    {!offers.length && <p className="muted">No offers remain in this market.</p>}
  </div>;
}
export function Markets({ room, send, busy }: ActionProps) {
  const visible = presentItems(me(room).visibleInventory);
  const sellable = visible.filter(item => { const state = resaleState(room, item); return state.price > 0 && !state.acquiredNow; });
  const sell = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hasCapability(room, 'SELL')) return;
    void send({ type: 'SELL', instanceId: value(new FormData(event.currentTarget), 'instanceId') });
  };
  return <section className="panel" aria-label="Intermission markets"><h2>Markets</h2>{hasCapability(room, 'INSPECT_CHEST') && <button className="button secondary full-width" disabled={busy} onClick={() => void send({ type: 'INSPECT_CHEST' })}>Inspect Standard Chest</button>}
    <form className="action-form" aria-label="Sell item" onSubmit={sell}><fieldset disabled={busy}><legend>Sell old visible items</legend><ItemSelect items={sellable} name="instanceId" label="Item to sell" />{visible.filter(item => { const state = resaleState(room, item); return state.price === 0 || state.acquiredNow; }).map(item => <p className="market-item-lock" key={item.instanceId}><strong>{stackName(item)}</strong> · {resaleState(room, item).reason}</p>)}<DraftSaved visible={!hasCapability(room, 'SELL')} phase="INTERMISSION" /><button className="button secondary" disabled={!hasCapability(room, 'SELL') || !sellable.length}>Sell item</button></fieldset></form>
    <h3>Public Shop</h3><MarketOffers room={room} send={send} busy={busy} offers={room.public.shop?.publicOffers ?? []} market="PUBLIC" />
    <h3>Your private Black Market</h3>{blackMarketUnlocked(room) ? <MarketOffers room={room} send={send} busy={busy} offers={room.private.blackMarket ?? []} market="BLACK" /> : <><p>{BLACK_MARKET_LOCK_REASON}</p>{hasCapability(room, 'SKIP_PUBLIC_SHOP') && <button type="button" disabled={busy} onClick={() => void send({ type: 'SKIP_PUBLIC_SHOP' })}>Skip Public Shop</button>}</>}
    {room.public.round?.phase === 'INTERMISSION' && <InventoryForm room={room} send={send} busy={busy} />}
    {hasCapability(room, 'FINISH_SHOPPING') && <button className="button primary full-width" disabled={busy} onClick={() => void send({ type: 'FINISH_SHOPPING' })}>Finish Intermission</button>}
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
  const selectedDefinition = ACTIONS.find(action => action.capability === selectedAction);
  const current = actions.find(action => action.capability === selectedAction) ?? actions[0] ?? selectedDefinition;
  const Component = current?.component;
  const immediate = hasCapability(room, 'LOOT_DOWNED');
  const turn = hasCapability(room, 'END_TURN');
  const inspect = hasCapability(room, 'INSPECT_CHEST');
  const canConcede = hasCapability(room, 'CONCEDE');
  const failed = room.private.objective?.status === 'FAILED';
  if (!actions.length && !immediate && !turn && !inspect && !failed) return <section className="panel"><h2>No actions available</h2></section>;
  return <section className="panel" aria-label="Your actions"><h2>Your actions</h2>
    {hasCapability(room, 'LEAVE_TABLE') && <div className="exit-choice"><h3>Your exit is ready</h3><p>Leave now to bank your objective. Choosing to stay defers this chance to your next normal turn.</p><div className="button-row"><button className="button primary" disabled={busy} onClick={() => void send({ type: 'LEAVE_TABLE' })}>Leave Table</button>{hasCapability(room, 'STAY') && <button className="button secondary" disabled={busy} onClick={() => void send({ type: 'STAY' })}>Stay at Table</button>}</div></div>}
    {failed && <div className="concede-choice"><h3>Contract failed</h3><p>You may keep playing, or Concede for 0 points on your normal turn.</p><button className="button secondary" disabled={busy || !canConcede} onClick={() => void send({ type: 'CONCEDE' })}>{canConcede ? 'Concede for 0 points' : 'Concede available on your normal turn'}</button></div>}
    {immediate && <DownedForm key={room.public.turn?.immediateLoot?.downEventId} room={room} send={send} busy={busy} immediate />}
    {actions.length > 0 && <div className="action-tabs" aria-label="Choose action">{actions.map(action => <button type="button" className={current === action ? 'selected' : ''} key={action.capability} aria-pressed={current === action} onClick={() => setSelected(action.capability)}>{action.label}</button>)}</div>}
    {Component && <Component key={current.capability} room={room} send={send} busy={busy} />}
    {inspect && <button className="button secondary full-width" disabled={busy} onClick={() => void send({ type: 'INSPECT_CHEST' })}>Inspect Standard Chest</button>}
    {me(room).roleId === 'locksmith' && room.private.abilities?.locksmithRound === room.public.round?.number && <p className="ability-spent">TUMBLER SENSE — USED THIS ROUND</p>}
    {turn && <button className="button quiet full-width end-turn" disabled={busy} onClick={() => void send({ type: 'END_TURN' })}>{room.public.turn?.primaryUsed ? 'End turn' : 'Skip Primary Action & end turn'}</button>}
  </section>;
}
