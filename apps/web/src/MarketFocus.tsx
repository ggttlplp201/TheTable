import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { ProjectedAnchor } from '@the-table/visual';
import type { ShopOffer } from '@the-table/game';
import type { ActionProps } from './MatchPanels';
import { InventoryForm } from './ActionForms';
import { ReferenceItemArt } from './ReferenceItemArt';
import { hasCapability, ITEM_HELP, itemName, ownItems, playerName, presentItems, stackName } from './gameplay';
import { blackMarketUnlocked, BLACK_MARKET_LOCK_REASON, finishIntermissionState, ledgerAvailable, marketModelId, marketPhaseState, offerState, resaleState, type MarketView } from './market-presentation';
import './market-focus.css';
import './market-v14.css';

export function MarketFocus({ room, send, busy, initialView = 'PUBLIC', onClose, onViewChange }: ActionProps & { initialView?: MarketView; onClose: () => void; onViewChange?: (view: MarketView) => void }) {
  const [requestedView, setView] = useState<MarketView>(initialView), [ledger, setLedger] = useState(false), [inventory, setInventory] = useState(false);
  const [now, setNow] = useState(Date.now);
  const unlocked = blackMarketUnlocked(room);
  const view = requestedView === 'BLACK' && !unlocked ? 'PUBLIC' : requestedView;
  const [feedback, setFeedback] = useState(initialView === 'BLACK' && !unlocked ? BLACK_MARKET_LOCK_REASON : '');
  const [selected, setSelected] = useState(''), [hovered, setHovered] = useState<string | null>(null);
  const [anchors, setAnchors] = useState<Record<string, ProjectedAnchor>>({}), [failed, setFailed] = useState(false);
  const mount = useRef<HTMLDivElement>(null), dialog = useRef<HTMLElement>(null), close = useRef<HTMLButtonElement>(null), purchase = useRef<(id: string) => void>(() => {}), closeLatest = useRef(onClose);
  closeLatest.current = onClose;
  const player = room.public.players.find(player => player.id === room.private.playerId)!;
  const phase = marketPhaseState(room, now), finish = finishIntermissionState(room, now);
  const shop = room.public.shop;
  const visible = presentItems(player.visibleInventory), offers = view === 'BLACK' ? room.private.blackMarket ?? [] : room.public.shop?.publicOffers ?? [];
  const chosen = visible.find(item => item.instanceId === selected) ?? visible.find(item => resaleState(room, item, now).canSell) ?? visible[0];
  const sale = chosen ? resaleState(room, chosen, now) : undefined;
  const value = sale?.price ?? 0;
  const owned = ownItems(room), hasLedger = owned.some(item => item.itemId === 'red-ledger'), hasIdol = owned.some(item => item.itemId === 'brass-idol');
  const idolUsed = room.private.abilities?.brassIdolRound === room.public.round?.number;
  const ledgerUsed = room.private.abilities?.redLedgerRound === room.public.round?.number;
  const canReroll = view === 'BLACK' && hasIdol && !idolUsed && unlocked && !phase.unavailable && hasCapability(room, 'REROLL_MARKET');
  const discount = ledgerAvailable(room) && ledger;
  const canPass = phase.publicTurn && !phase.unavailable && hasCapability(room, 'SKIP_PUBLIC_SHOP');
  const buy = (offer: ShopOffer) => {
    if (busy || view === 'SELL') return;
    const state = offerState(room, view, offer, discount);
    if (!state.canBuy) { setFeedback(state.reason ?? ''); return; }
    setFeedback('');
    void send({ type: 'BUY', market: view, offerId: offer.id, ...(view === 'PUBLIC' && discount ? { useRedLedger: true } : {}) });
  };
  purchase.current = id => { const offer = offers.find(offer => offer.id === id); if (offer) buy(offer); };
  const signature = offers.map(offer => `${offer.id}:${offer.itemId}:${offer.price}:${offer.purchasedBy ?? ''}`).join('|');
  useEffect(() => { setView(initialView); }, [initialView]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => { setLedger(false); setSelected(''); }, [shop?.id]);
  useEffect(() => { setFeedback(''); }, [shop?.id, shop?.phase, shop?.activeShopperIndex, unlocked]);
  useEffect(() => { onViewChange?.(view); }, [view, onViewChange]);
  useEffect(() => {
    dialog.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (!(event.target instanceof Node) || !dialog.current?.contains(event.target)) return;
      if (dialog.current?.parentElement?.querySelector('.forced-decision')) return;
      if (event.key === 'Escape') { event.stopPropagation(); closeLatest.current(); }
      if (event.key !== 'Tab') return;
      const controls = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]') ?? [])].filter(element => element.getClientRects().length > 0);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, []);
  useEffect(() => {
    const target = mount.current; if (!target) return;
    let cancelled = false, runtime: { dispose(): void } | undefined; setFailed(false); setAnchors({});
    void import('./market-scene-runtime').then(({ createMarketScene }) => {
      if (cancelled) return;
      runtime = createMarketScene(target, { view, stock: offers.map(offer => ({ id: offer.id, itemId: marketModelId(offer.itemId), price: offer.price, sold: Boolean(offer.purchasedBy) })), selectedItem: chosen ? marketModelId(chosen.itemId) : undefined,
        onAnchors: value => { if (!cancelled) setAnchors(value); }, onOffer: id => purchase.current(id) });
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; runtime?.dispose(); };
  }, [view, signature, view === 'SELL' ? chosen?.instanceId : undefined]);
  const position = (key: string, fallbackX: number, fallbackY: number): CSSProperties => {
    const top = `${(anchors[key]?.y ?? fallbackY) * 100}%`;
    return { left: `${(anchors[key]?.x ?? fallbackX) * 100}%`, top: key.startsWith('offer:') ? `min(${top}, calc(100% - var(--market-stock-bottom)))` : top };
  };
  const title = view === 'PUBLIC' ? 'The Tallyman' : view === 'BLACK' ? 'Under the Table' : 'Sell-back';
  const inspected = offers.find(offer => offer.id === hovered);
  return <section ref={dialog} tabIndex={-1} className={`market-focus market-focus-${view.toLowerCase()}${failed ? ' market-no-scene' : ''}`} role="dialog" aria-modal="true" aria-label={view === 'BLACK' ? 'Your private Black Market' : view === 'SELL' ? 'Sell-back' : 'Public Shop'}>
    <div className="market-canvas" ref={mount} aria-hidden="true" />
    <div className="market-scanlines" aria-hidden="true" />
    <header className="market-heading"><h2>{title}</h2>{view !== 'SELL' && <p>{view === 'PUBLIC' ? 'PUBLIC SHOP' : 'PRIVATE BLACK MARKET · +1¢'}</p>}</header>
    <aside className="market-status"><span>¢ {player.coins}</span><p>{phase.finished ? 'FINISHED' : 'INTERMISSION'}</p></aside>
    <div className="market-phase-strip">
      <div className="market-phase-heading"><strong>{phase.title}</strong>{phase.seconds !== undefined && phase.open && <span role="timer" aria-label={`${phase.title}: ${phase.seconds} seconds remaining`}>{phase.seconds}s</span>}</div>
      <p>{phase.detail}</p>
      {shop && <p className="market-public-order">Public order: {shop.order.map((id, index) => <span key={id}>{index > 0 && ' → '}<span className={phase.currentShopper === id ? 'is-shopping' : shop.privateUnlockedBy[id] ? 'is-resolved' : ''}>{playerName(room.public, id)}{id === player.id ? ' (YOU)' : ''}{shop.privateUnlockedBy[id] ? ' ✓' : ''}</span></span>)}</p>}
      {unlocked && !phase.finished && <small>PUBLIC SHOP RESOLVED · PRIVATE MARKET UNLOCKED</small>}
    </div>
    {failed && <p className="market-render-error" role="status">The counter view is unavailable. The offers below remain connected.</p>}
    {view !== 'SELL' && <div className="market-stock" aria-label={view === 'BLACK' ? 'Private offers' : 'Public stock'}>{offers.map((offer, index) => {
      const state = offerState(room, view, offer, discount, now);
      return <div className={`market-stock-tag${offer.purchasedBy ? ' sold' : ''}`} key={offer.id} style={position(`offer:${offer.id}`, .18 + index * .19, .76)} onMouseEnter={() => setHovered(offer.id)} onMouseLeave={() => setHovered(null)}>
        <span className="market-stock-name">{itemName(offer.itemId)}</span>
        <button type="button" disabled={busy || !state.canBuy} aria-describedby={state.reason ? `offer-reason-${offer.id}` : undefined} aria-label={`Buy ${itemName(offer.itemId)}`} onFocus={() => setHovered(offer.id)} onBlur={() => setHovered(null)} onClick={() => buy(offer)} title={state.reason ?? `${state.price} Coins · ${ITEM_HELP[offer.itemId]}`}>{state.label}</button>
        {state.reason && <span id={`offer-reason-${offer.id}`} className="sr-only">{state.reason}</span>}
        {view === 'BLACK' && index === 3 && <small>SMUGGLER</small>}
        {view === 'BLACK' && hasIdol && <button className="market-reroll" type="button" disabled={busy || !canReroll || Boolean(offer.purchasedBy)} onClick={() => { if (canReroll && !busy && !marketPhaseState(room).unavailable) void send({ type: 'REROLL_MARKET', offerId: offer.id }); }} aria-label={`Reroll ${itemName(offer.itemId)} with Brass Idol`} title={idolUsed ? 'Brass Idol — used this Intermission' : 'Replace this private offer with Brass Idol'}>↻ REROLL</button>}
      </div>;
    })}</div>}
    {view === 'PUBLIC' && <button type="button" className="market-tray-link" style={position('tray', .9, .72)} onClick={() => setView('SELL')}>SELL-BACK ▸</button>}
    {inspected && view !== 'SELL' && <aside className="market-inspection" role="status"><strong>{itemName(inspected.itemId)} · {inspected.price}¢</strong><p>{ITEM_HELP[inspected.itemId]}</p>{offerState(room, view, inspected, discount).reason && <p className="market-unavailable">{offerState(room, view, inspected, discount).reason}</p>}</aside>}
    {view === 'SELL' && <><div className="market-sale" style={position('tray', .62, .6)}><small>ON THE TRAY</small><h3>{chosen ? stackName(chosen) : 'EMPTY TRAY'}</h3><p><span>RESALE</span><strong>{value}¢{player.roleId === 'broker' ? ' · BROKER' : ''}</strong></p><button type="button" disabled={busy || !sale?.canSell} onClick={() => { if (chosen && !busy && resaleState(room, chosen).canSell) void send({ type: 'SELL', instanceId: chosen.instanceId }); }}>SELL FOR {value}¢</button>{sale?.reason && <p className="market-sale-reason" role="status">{sale.reason}</p>}</div>
      <div className="market-sell-inventory" aria-label="Visible items for resale">{visible.map(item => { const state = resaleState(room, item, now); return <button type="button" className={chosen?.instanceId === item.instanceId ? 'selected' : ''} key={item.instanceId} aria-pressed={chosen?.instanceId === item.instanceId} onClick={() => setSelected(item.instanceId)}><ReferenceItemArt itemId={item.itemId} size={40} label="" /><span>{stackName(item)}<small>{state.acquiredNow ? 'SELL NEXT INTERMISSION' : state.price ? `${state.price}¢ RESALE` : 'CANNOT SELL'}</small></span></button>; })}{!visible.length && <p>Your visible inventory is empty.</p>}</div></>}
    <div className="market-options">{view === 'PUBLIC' && hasLedger && <label><input type="checkbox" checked={discount} disabled={busy || ledgerUsed || !phase.publicTurn || Boolean(phase.unavailable) || !hasCapability(room, 'BUY')} onChange={event => setLedger(event.target.checked)} /> {ledgerUsed ? 'RED LEDGER — USED THIS INTERMISSION' : 'RED LEDGER · −1¢ ON THIS PURCHASE'}</label>}{view === 'BLACK' && <><span>{room.private.intermission?.privatePurchased ? 'PRIVATE PURCHASE USED' : 'One private purchase per Intermission'}</span>{hasIdol && <span>{idolUsed ? 'BRASS IDOL — USED THIS INTERMISSION' : 'BRASS IDOL · Reroll one offer below'}</span>}</>}{view === 'SELL' && <span>Sell old items before or after buying. New acquisitions can be sold next Intermission.</span>}</div>
    {(feedback || (requestedView === 'BLACK' && !unlocked)) && <p className="market-feedback" role="alert">{feedback || BLACK_MARKET_LOCK_REASON}</p>}
    <footer className="market-footer"><nav aria-label="Market navigation">
      <button ref={close} type="button" onClick={onClose}>← Step back</button>
      {view !== 'PUBLIC' && <button type="button" onClick={() => { setFeedback(''); setView('PUBLIC'); }}>Public Shop</button>}
      <button type="button" disabled={!unlocked} title={!unlocked ? BLACK_MARKET_LOCK_REASON : undefined} aria-current={view === 'BLACK' ? 'page' : undefined} onClick={() => { if (unlocked) { setFeedback(''); setView('BLACK'); } }}>Black Market</button>
      {view !== 'SELL' && <button type="button" onClick={() => setView('SELL')}>Sell items</button>}
      {phase.publicTurn && <button type="button" disabled={busy || !canPass} onClick={async () => { if (canPass && !busy && !marketPhaseState(room).unavailable && await send({ type: 'SKIP_PUBLIC_SHOP' })) { setFeedback(''); setView('BLACK'); } }}>Pass Public Shop</button>}
      <button type="button" aria-expanded={inventory} onClick={() => setInventory(current => !current)}>Pockets</button>
      <button type="button" className="market-finish" disabled={busy || !finish.canFinish} title={finish.reason} onClick={() => { if (!busy && finishIntermissionState(room).canFinish) void send({ type: 'FINISH_SHOPPING' }); }}>{phase.finished ? 'Intermission finished' : 'Finish Intermission'}</button>
    </nav></footer>
    {inventory && <div className="market-pocket-panel"><button type="button" onClick={() => setInventory(false)}>Close Pockets ×</button><InventoryForm room={room} send={send} busy={busy} /></div>}
  </section>;
}
