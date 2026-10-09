import { useEffect, useRef, useState } from 'react';
import type { ChestState, ItemStack, ObjectiveState, PlayerPrivateView, PublicPlayerView, PublicRoomView, RoleId, ShopOffer } from '@the-table/game';
import type { AnyRoomView, PlayerCommand, RoomView, SpectatorRoomView } from './protocol';
import { isSpectatorView, ROLE_COPY } from './protocol';
import { assetNames, hasCapability, ITEM_HELP, itemName, OBJECTIVE_BY_ID, OBJECTIVE_HELP, playerName, presentItems, remainingSeconds, stackName, words } from './gameplay';
import { ReferenceItemArt } from './ReferenceItemArt';
import { matchResultSummary } from './match-results';
import { objectiveProgressItems } from './objective-progress';

export type SendCommand = (command: PlayerCommand) => Promise<boolean>;
export interface ActionProps { room: RoomView; send: SendCommand; busy: boolean }

type ResponseShortcutEvent = Pick<KeyboardEvent, 'altKey' | 'ctrlKey' | 'defaultPrevented' | 'isComposing' | 'key' | 'metaKey' | 'repeat' | 'shiftKey' | 'target'>;

export function responseShortcutIntent(event: ResponseShortcutEvent): boolean | undefined {
  const target = event.target as (EventTarget & { closest?: (selector: string) => Element | null }) | null;
  if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing || event.key === 'Process' || target?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return undefined;
  const key = event.key.toLowerCase();
  return key === 'y' ? true : key === 'n' ? false : undefined;
}

function useDecisionFocus(decisionId: string | undefined) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!decisionId) return;
    const heading = ref.current?.querySelector<HTMLElement>('h2');
    heading?.focus({ preventScroll: true });
    ref.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [decisionId]);
  return ref;
}

export function Countdown({ deadline, label, format = 'default' }: { deadline: number; label: string; format?: 'default' | 'seconds' | 'clock' }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [deadline]);
  const seconds = remainingSeconds(deadline, now);
  return <span className={`countdown ${seconds <= 10 ? 'urgent' : ''}`} role="timer" aria-label={`${label}: ${seconds} seconds`}>
    {format === 'seconds' ? seconds : format === 'clock' ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : seconds > 0 ? `${seconds}s` : 'Awaiting table'}
  </span>;
}

export function MatchHeader({ room, viewerId }: { room: AnyRoomView; viewerId: string }) {
  const state = room.public;
  const active = state.players.find(player => player.seat === state.turn?.activeSeat);
  const shopper = state.shop?.order[state.shop.activeShopperIndex];
  const intermission = state.round?.phase === 'INTERMISSION';
  return <header className="match-heading">
    <div><p className="match-room">Room {state.code} · Round {state.round?.number ?? 1}</p>
      <h1>{state.status === 'RESULTS' ? 'The final reckoning.' : intermission ? 'Intermission' : active?.id === viewerId ? 'Your turn.' : `${active?.name ?? 'The table'}’s turn`}</h1>
    </div>
    {state.round?.phase === 'TURN' && state.turn && <div className="turn-clock">
      {state.turn.pausedRemainingMs !== undefined ? <><strong>{Math.ceil(state.turn.pausedRemainingMs / 1000)}s</strong><span>Turn paused</span></> : <><Countdown deadline={state.turn.deadlineAt} label="Turn remaining" /><span>Turn remaining</span></>}
    </div>}
    <ol className="turn-order" aria-label={intermission ? 'Shopping order' : 'Seat order'}>
      {(intermission && state.shop ? state.shop.order.map(id => state.players.find(player => player.id === id)!).filter(Boolean) : state.players).map(player =>
        <li key={player.id} data-life={player.life} className={(intermission ? player.id === shopper : player.seat === state.turn?.activeSeat) ? 'current' : ''}>
          <span className="seat-number">{player.seat + 1}</span> {player.name}<small>{words(player.life)}{player.connection === 'DISCONNECTED' ? ' · Offline' : ''}</small>
        </li>)}
    </ol>
  </header>;
}

export function ItemList({ items, empty = 'No visible items' }: { items: Array<ItemStack | null>; empty?: string }) {
  const present = presentItems(items);
  return present.length ? <ul className="item-list">{present.map(item => <li key={item.instanceId}><strong>{stackName(item)}</strong><span>{ITEM_HELP[item.itemId]}</span></li>)}</ul> : <p className="muted">{empty}</p>;
}

export function PlayerRoster({ room, viewerId, selectedPlayerId }: { room: PublicRoomView; viewerId: string; selectedPlayerId?: string }) {
  const selectedDetail = useRef<HTMLDetailsElement>(null);
  const [openPlayerIds, setOpenPlayerIds] = useState(() => new Set([selectedPlayerId ?? viewerId]));
  useEffect(() => {
    if (!selectedPlayerId || !selectedDetail.current) return;
    setOpenPlayerIds(current => current.has(selectedPlayerId) ? current : new Set([...current, selectedPlayerId]));
    selectedDetail.current.open = true;
    selectedDetail.current.querySelector<HTMLElement>('summary')?.focus({ preventScroll: true });
    selectedDetail.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedPlayerId]);
  return <section className="panel" aria-labelledby="players-title"><h2 id="players-title">At the table</h2><div className="player-roster">
    {room.players.map(player => <details className="player-detail" key={player.id} ref={player.id === selectedPlayerId ? selectedDetail : undefined} open={openPlayerIds.has(player.id)} onToggle={event => { const open = event.currentTarget.open; setOpenPlayerIds(current => { const next = new Set(current); if (open) next.add(player.id); else next.delete(player.id); return next; }); }} data-selected={player.id === selectedPlayerId ? 'true' : undefined}>
      <summary aria-current={player.id === selectedPlayerId ? 'true' : undefined}><span><strong>{player.name}{player.id === viewerId ? ' (you)' : ''}</strong><small>{player.roleId ? ROLE_COPY[player.roleId].name : 'No role'} · {player.conceded ? 'Conceded' : words(player.life)}</small></span><span className="player-numbers">{player.hp}/5 HP<small>{player.coins} Coins</small></span></summary>
      <div className="player-body"><p className="muted">Seat {player.seat + 1} · {words(player.connection)}{player.objectiveCompleted ? ' · Objective ready' : ''}</p>
        {player.statuses?.map(status => <p className="status-tag" key={status.id}>{words(status.kind)} · {status.remainingTurns} turn{status.remainingTurns === 1 ? '' : 's'}</p>)}
        <h3>Visible inventory <span className="muted">{presentItems(player.visibleInventory).length}/{player.visibleInventory.length}</span></h3><ItemList items={player.visibleInventory} />
        <p className="muted">{player.pocketOccupancy.map((occupied, index) => `Pocket ${index + 1}: ${occupied ? 'occupied' : 'empty'}`).join(' · ')}</p>
        {player.revealedObjective && <p>Revealed objective: <strong>{OBJECTIVE_BY_ID[player.revealedObjective.objectiveId]?.name ?? words(player.revealedObjective.objectiveId)}</strong> · {words(player.revealedObjective.status)}</p>}
      </div>
    </details>)}
  </div></section>;
}

/** Unknown inspection/progress values are rendered as text, never HTML or client state. */
export function Facts({ value, room }: { value: unknown; room: PublicRoomView }) {
  if (value === null || value === undefined) return <span>Empty</span>;
  if (typeof value === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>;
  if (typeof value === 'string') return <span>{room.players.find(player => player.id === value)?.name ?? words(value)}</span>;
  if (typeof value !== 'object') return <span>{String(value)}</span>;
  if (Array.isArray(value)) return value.length ? <ul className="fact-array">{value.map((entry, index) => <li key={index}><Facts value={entry} room={room} /></li>)}</ul> : <span>None yet</span>;
  return <dl className="facts">{Object.entries(value).filter(([key]) => key !== 'instanceId').map(([key, entry]) => <div key={key}><dt>{words(key)}</dt><dd><Facts value={entry} room={room} /></dd></div>)}</dl>;
}

export function ObjectiveDetail({ objective, room }: { objective: ObjectiveState | undefined; room: PublicRoomView }) {
  if (!objective) return <p className="muted">Your objective is being assigned.</p>;
  const definition = OBJECTIVE_BY_ID[objective.objectiveId];
  return <div className="objective-detail"><h3 className="objective-name">{definition?.name ?? words(objective.objectiveId)}</h3><p>{OBJECTIVE_HELP[objective.objectiveId]}</p>
    {objective.targetPlayerId && <p>Assigned target: <strong>{playerName(room, objective.targetPlayerId)}</strong></p>}
    {objective.contingencyTargetId && <p>Contingency: personally kill <strong>{playerName(room, objective.contingencyTargetId)}</strong>, then leave when offered.</p>}
    <ul className="objective-progress" aria-label="Objective progress">{objectiveProgressItems(objective, room).map((item, index) => <li key={`${item.label}:${index}`} data-complete={item.complete ? 'true' : 'false'}><span aria-hidden="true">{item.complete ? '✓' : '○'}</span><span><strong>{item.label}</strong><small>{item.value}</small></span></li>)}</ul>
    {definition && <p className="contract-rule">UNLOCKS ROUND {definition.unlockRound} · {definition.mode === 'SUSTAINED' ? 'KEEP THE REQUIREMENTS UNTIL YOU LEAVE.' : 'COMPLETION STAYS EARNED.'}</p>}
    {objective.contingency && <p className="contract-rule">CONTINGENCY · BANKS 80% OF THE EXIT SCORE.</p>}
  </div>;
}

const ROLE_ABILITY_DETAILS: Record<RoleId, { name: string; cost: string; description: string }> = {
  enforcer: { name: 'Quick Draw', cost: 'Pistol action modifier · once per match', description: 'Fire a legal Pistol shot without spending a Bullet. This is not a second action.' },
  medic: { name: 'Field Dressing', cost: 'Passive', description: 'Your Medicine revives another player to 3 HP. Self-revive remains 2 HP.' },
  smuggler: { name: 'Private Stock', cost: 'Passive', description: 'See four private Black Market offers instead of three.' },
  locksmith: { name: 'Tumbler Sense', cost: 'Free Action · once per complete Round', description: 'Privately learn whether the Standard Chest holds an Artifact and whether it holds a Rare regular item.' },
  broker: { name: 'Margin', cost: 'Passive', description: 'Gain 1 extra Coin on resale, capped at base price minus one.' },
  scavenger: { name: 'Salvage', cost: 'Passive trigger · once per Intermission', description: 'Gain 1 Coin after a forced capacity discard or replacement during Intermission.' },
};

export function RoleAbilityDetail({ detail, room, compact = false }: { detail: PlayerPrivateView; room: PublicRoomView; compact?: boolean }) {
  const player = room.players.find(candidate => candidate.id === detail.playerId);
  if (!player?.roleId) return null;
  const ability = ROLE_ABILITY_DETAILS[player.roleId];
  const round = room.round?.number;
  const availability = player.roleId === 'enforcer' ? detail.abilities?.quickDrawUsed ? 'USED' : 'READY'
    : player.roleId === 'locksmith' ? detail.abilities?.locksmithRound === round ? 'USED THIS ROUND' : detail.capabilities?.includes('INSPECT_CHEST') ? 'READY' : 'AVAILABLE WHEN THE STANDARD CHEST IS PRESENT'
    : player.roleId === 'scavenger' && detail.abilities?.salvageRound === round ? 'USED THIS INTERMISSION'
    : 'PASSIVE';
  return <aside className="role-ability-detail" data-compact={compact || undefined} aria-label="Role ability"><span>ROLE · {ROLE_COPY[player.roleId].name.toUpperCase()}</span><strong>{ability.name.toUpperCase()}</strong><p>{ability.cost}</p>{!compact && <p>{ability.description}</p>}<b>{availability}</b></aside>;
}

export function PrivateDetail({ detail, room, title = 'Your objective' }: { detail: PlayerPrivateView; room: PublicRoomView; title?: string }) {
  const objective = detail.objective;
  const state = objective?.status;
  const fulfilled = state === 'EXIT_READY' || state === 'BANKED';
  const canLeave = detail.capabilities?.includes('LEAVE_TABLE') ?? false;
  const canConcede = detail.capabilities?.includes('CONCEDE') ?? false;
  const waitingForNextTurn = state === 'EXIT_READY' && !canLeave;
  const lostRequirements = objective ? objectiveProgressItems(objective, room).filter(item => !item.complete).map(item => `${item.label}: ${item.value}`).join(' · ') : '';
  return <section className={`panel private-info reference-contract ${fulfilled ? 'fulfilled' : ''} ${state === 'FAILED' ? 'failed' : ''}`} aria-label={title}><header><span>CONTRACT · PRIVATE</span><span>OBJECTIVE STATE · {state ? words(state) : 'ASSIGNING'}</span></header><ObjectiveDetail objective={objective} room={room} /><RoleAbilityDetail detail={detail} room={room} />
    {state === 'FAILED' ? <div className="contract-failure" role="status"><strong>CONTRACT FAILED</strong>{objective?.failureReason && <p>{objective.failureReason}</p>}<p>This objective can no longer be completed.</p><p>{canConcede ? 'You may continue playing or Concede for 0 points now.' : 'You may continue playing or Concede for 0 points on your next normal turn.'}</p></div>
      : state === 'EXIT_READY' ? <><div className="contract-leave">{waitingForNextTurn ? 'OBJECTIVE COMPLETE' : 'EXIT READY'}</div><p className="contract-unlock-copy">{waitingForNextTurn ? 'Leave Table unlocks at the start of your next normal turn.' : 'You may leave now or stay.'}</p><div className="contract-stamp">FULFILLED</div></>
      : state === 'BANKED' ? <><div className="contract-leave">OBJECTIVE BANKED</div><div className="contract-stamp">BANKED</div></>
      : objective?.rewardGranted ? <><div className="contract-leave">EXIT LOCKED</div><p className="contract-unlock-copy">Requirement lost: {lostRequirements || 'required possessions'}. Restore it to become Exit Ready again.</p></>
      : <footer><span>LEAVE TABLE</span><span className="contract-locked">LOCKED</span></footer>}
  </section>;
}

export function PendingInteraction({ room, send, busy }: { room: AnyRoomView; send: SendCommand; busy: boolean }) {
  const trade = room.public.pendingTrade;
  const threat = room.public.pendingThreat;
  const proposal = trade ?? threat;
  const responseAllowed = hasCapability(room, trade ? 'RESPOND_TRADE' : 'RESPOND_THREAT');
  const viewerId = room.viewerPlayerId ?? (!isSpectatorView(room) ? room.private.playerId : undefined);
  const authorizedRecipient = Boolean(proposal && responseAllowed && viewerId === proposal.targetId);
  const focus = useDecisionFocus(responseAllowed ? proposal?.id : undefined);
  useEffect(() => {
    if (!proposal || !authorizedRecipient || busy) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      const response = responseShortcutIntent(event);
      if (response === undefined) return;
      event.preventDefault();
      void send(trade ? { type: 'RESPOND_TRADE', accept: response } : { type: 'RESPOND_THREAT', comply: response });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [authorizedRecipient, busy, proposal, send, trade]);
  if (!proposal) return null;
  if (isSpectatorView(room) || (viewerId !== proposal.actorId && viewerId !== proposal.targetId)) return null;
  const actorView = viewerId === proposal.actorId;
  const assets = (ids: string[], coins: number) => [...assetNames(room.public, ids), `${coins} Coins`].join(', ');
  const visualAssets = (ids: string[], amount: number) => <><div className="response-asset-art">{ids.map(id => { const item = room.public.players.flatMap(player => presentItems(player.visibleInventory)).find(item => item.instanceId === id); return item ? <ReferenceItemArt key={id} itemId={item.itemId} size={72} /> : null; })}{amount > 0 && <span className="response-coins"><ReferenceItemArt itemId="coin" size={28} />{amount}</span>}</div><span>{assets(ids, amount)}</span></>;
  return <section ref={focus} className={`decision-panel reference-response ${trade ? 'trade-response' : 'threat-response'}`} aria-label={trade ? 'Pending Trade' : 'Pending Threat'}>
    <header><div><p>{trade ? '⇄ OFFER' : '⚠ THREAT'} {actorView ? `TO ${playerName(room.public, proposal.targetId).toUpperCase()}` : `FROM ${playerName(room.public, proposal.actorId).toUpperCase()}`}</p><h2 tabIndex={-1}>{trade ? 'Trade offer' : 'Threat'}</h2></div><div className="response-clock"><Countdown deadline={proposal.deadlineAt} label="Response remaining" format="seconds" /><span>SEC · {responseAllowed ? 'YOU' : playerName(room.public, proposal.targetId).toUpperCase()}</span></div></header>
    <ResponseProgress deadline={proposal.deadlineAt} />
    {trade ? <div className="response-trade-assets"><div><h3>{actorView ? 'YOU GIVE' : 'YOU GET'}</h3>{visualAssets(trade.offeredItems, trade.offeredCoins)}</div><span className="exchange-arrow">⇄</span><div><h3>{actorView ? 'YOU GET' : 'YOU GIVE'}</h3>{visualAssets(trade.requestedItems, trade.requestedCoins)}</div></div> : <><div className="response-demand">{threat!.demandedItems.map(id => { const item = room.public.players.flatMap(player => presentItems(player.visibleInventory)).find(item => item.instanceId === id); return item ? <div key={id}><ReferenceItemArt itemId={item.itemId} size={56} /><span>{stackName(item).toUpperCase()}</span></div> : null; })}{threat!.demandedCoins > 0 && <div><ReferenceItemArt itemId="coin" size={48} /><span>{threat!.demandedCoins} COINS</span></div>}{!threat!.demandedItems.length && !threat!.demandedCoins && <div>NO ASSETS DEMANDED</div>}</div><div className="response-backing"><ReferenceItemArt itemId={threat!.committedItemType ?? 'cloth'} size={64} /><div><strong>{threat!.committedItemType ? `BACKED BY ${itemName(threat!.committedItemType).toUpperCase()}` : 'BACKED BY A COVERED ITEM'}</strong></div></div></>}
    {responseAllowed && <div className="button-row">
      <button className="button primary" aria-keyshortcuts="Y" disabled={busy} onClick={() => void send(trade ? { type: 'RESPOND_TRADE', accept: true } : { type: 'RESPOND_THREAT', comply: true })}><kbd aria-hidden="true">Y</kbd>{trade ? 'Accept Trade' : 'Comply'}</button>
      <button className="button secondary" aria-keyshortcuts="N" disabled={busy} onClick={() => void send(trade ? { type: 'RESPOND_TRADE', accept: false } : { type: 'RESPOND_THREAT', comply: false })}><kbd aria-hidden="true">N</kbd>{trade ? 'Decline Trade' : 'Refuse'}</button>
    </div>}
    <p className="response-timeout-default">No response → {trade ? 'Decline' : 'Comply'}</p>
  </section>;
}

function ResponseProgress({ deadline }: { deadline: number }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 250); return () => window.clearInterval(id); }, []);
  return <div className="response-progress"><div style={{ width: `${Math.max(0, Math.min(100, (deadline - now) / 300))}%` }} /></div>;
}

export function OverflowDecision({ room, send, busy }: ActionProps) {
  const allowed = hasCapability(room, 'OVERFLOW_CHOICE');
  const focus = useDecisionFocus(allowed ? room.private.overflows?.[0]?.id : undefined);
  const [replacementId, setReplacementId] = useState('');
  if (!allowed) return null;
  const player = room.public.players.find(candidate => candidate.id === room.private.playerId);
  const replacement = presentItems(player?.visibleInventory ?? []).find(item => item.instanceId === replacementId);
  return <>{room.private.overflows?.slice(0, 1).map((choice, index) => <section ref={index === 0 ? focus : undefined} className="decision-panel reference-overflow" key={choice.id} aria-label="Inventory overflow">
    <div className="reference-screen-heading"><h2 tabIndex={-1}>No room on your side</h2><span>{presentItems(player?.visibleInventory ?? []).length} / 6 · <Countdown deadline={choice.deadlineAt} label="Overflow remaining" format="clock" /></span></div>
    <div className="overflow-composition"><div className="overflow-incoming"><span>INCOMING</span><ReferenceItemArt itemId={choice.incoming.itemId} size={120} /><strong>{itemName(choice.incoming.itemId).toUpperCase()}</strong></div><div className="overflow-replacements"><p>PICK ONE TO REPLACE</p><div className="replacement-list">{presentItems(player?.visibleInventory ?? []).map(item => <button className={`button quiet ${replacementId === item.instanceId ? 'selected' : ''}`} disabled={busy} key={item.instanceId} aria-label={`Replace ${stackName(item)}`} aria-pressed={replacementId === item.instanceId} title={`Replace ${stackName(item)}`} onClick={() => setReplacementId(item.instanceId)}><ReferenceItemArt itemId={item.itemId} size={58} /><span className="sr-only">Replace {stackName(item)}</span>{replacementId === item.instanceId && <i>✕</i>}</button>)}</div><strong>{replacement ? `${itemName(replacement.itemId).toUpperCase()} WILL BE DISCARDED` : 'SELECT AN ITEM TO REPLACE'}</strong></div></div>
    <footer><p>TIMER RUNS OUT = INCOMING ITEM DISCARDED</p><div><button className="button secondary" aria-label={`Discard incoming ${itemName(choice.incoming.itemId)}`} disabled={busy} onClick={() => void send({ type: 'OVERFLOW_CHOICE', overflowId: choice.id })}>DISCARD INCOMING</button><button className="button primary" disabled={busy || !replacement} onClick={() => { if (replacement) void send({ type: 'OVERFLOW_CHOICE', overflowId: choice.id, replaceInstanceId: replacement.instanceId }); }}>REPLACE {replacement ? itemName(replacement.itemId).toUpperCase() : 'ITEM'}</button></div></footer>
  </section>)}</>;
}

export function ChestPanel({ room }: { room: AnyRoomView }) {
  return <section className="panel"><h2>Chests</h2><div className="chest-list">{room.public.chests?.map(chest => <div key={chest.kind}><h3>{words(chest.kind)} Chest</h3><p>{words(chest.availability)}{chest.refreshRound ? ` · Refresh Round ${chest.refreshRound}` : ''}</p>{isSpectatorView(room) && <ChestContents chest={room.chests.find(entry => entry.kind === chest.kind)} />}</div>)}</div></section>;
}
function ChestContents({ chest }: { chest: ChestState | undefined }) {
  return <ul className="compact-list">{chest?.loot.map((loot, index) => <li key={index}>{loot.kind === 'COINS' ? `${loot.amount} Coins` : stackName(loot.stack)}</li>)}</ul>;
}

export function OfferList({ offers }: { offers: ShopOffer[] }) {
  return <ul className="compact-list">{offers.map(offer => <li key={offer.id}>{itemName(offer.itemId)} · {offer.price} Coins{offer.purchasedBy ? ' · Purchased' : ''}</li>)}</ul>;
}
export function SpectatorDetails({ room }: { room: SpectatorRoomView }) {
  return <section className="panel reference-spectator" aria-label="Spectator god view"><header><h2>◎ SPECTATING · GOD VIEW</h2><p>ALL INPUT DISABLED · CHAT READ-ONLY</p></header>
    {room.public.turn && <div className="spectator-clock">R{room.public.round?.number ?? 1} · <Countdown deadline={room.public.turn.deadlineAt} label="Turn remaining" format="clock" /></div>}
    <div className="spectator-cards" style={{ '--spectator-count': room.players.length } as React.CSSProperties}>{room.players.map(player => <article key={player.public.id} aria-label={`${player.public.name}’s private information`}>
      <header><h3>{player.public.name.toUpperCase()}</h3><span>{player.public.roleId ? ROLE_COPY[player.public.roleId].name.toUpperCase() : '—'}</span></header>
      <h4>OBJECTIVE</h4><p>{player.private.objective ? OBJECTIVE_BY_ID[player.private.objective.objectiveId]?.name ?? words(player.private.objective.objectiveId) : '—'}{player.public.objectiveCompleted ? ' · ✓' : ''}</p>{player.private.objective && <div className="spectator-objective-progress"><Facts value={player.private.objective.progress} room={room.public} /></div>}
      <h4>POCKET</h4>{player.private.pockets.map((pocket, index) => <div key={index} className="spectator-pocket">{pocket.item && <ReferenceItemArt itemId={pocket.item.itemId} size={40} />}<span>{pocket.item ? stackName(pocket.item) : '◇ empty'}{pocket.protectedBySafe ? ' ⊡ SAFE' : ''}</span></div>)}
      <h4>BLACK MARKET</h4><div className="spectator-market">{(player.private.blackMarket ?? room.shop?.privateOffers[player.public.id] ?? []).map(offer => <ReferenceItemArt key={offer.id} itemId={offer.itemId} size={36} />)}</div>
      <footer>{player.public.objectiveCompleted ? '◉ OBJECTIVE DONE · ' : ''}♥{player.public.hp} ¢{player.public.coins} · {words(player.public.life)}</footer>
    </article>)}</div><details className="spectator-chest-inspection"><summary>▢ CHESTS · {room.chests.map(chest => `${words(chest.kind)}: ${chest.loot.map(loot => loot.kind === 'COINS' ? `${loot.amount}¢` : itemName(loot.stack.itemId)).join(' + ') || 'Empty'}`).join(' · ')}</summary><ChestPanel room={room} /></details>
  </section>;
}

export function Results({ room }: { room: AnyRoomView }) {
  const players = [...room.public.players].sort((a, b) => b.score - a.score || (a.exitOrder ?? Infinity) - (b.exitOrder ?? Infinity) || a.seat - b.seat);
  const summary = matchResultSummary(room.public);
  return <section className="panel results reference-results" aria-labelledby="results-title"><header><h2 id="results-title">The table empties</h2><span>MATCH · {room.public.round?.number ?? 1} ROUNDS{summary.duration && <> · {summary.duration}</>}</span></header><table aria-label="Final scores"><thead><tr><th>EXIT</th><th>PLAYER</th><th>ROLE</th><th>OBJECTIVE</th><th>RESULT</th><th>PTS</th></tr></thead><tbody>{players.map(player => {
    const objective = isSpectatorView(room) ? room.players.find(entry => entry.public.id === player.id)?.private.objective : player.id === room.private.playerId ? room.private.objective : player.revealedObjective;
    return <tr key={player.id}><td>{player.exitOrder ?? '—'}</td><td>{player.name.toUpperCase()}</td><td>{player.roleId ? ROLE_COPY[player.roleId].name.toUpperCase() : '—'}</td><td>{objective ? `${OBJECTIVE_BY_ID[objective.objectiveId]?.name ?? words(objective.objectiveId)} ${objective.status === 'BANKED' ? '✓' : '✕'}${objective.contingency ? ' · Contingency' : ''}` : 'Objective unrevealed'}</td><td className={`result-${player.life}`}>{player.conceded ? '⤴ CONCEDED' : player.life === 'EXITED' ? '⤴ ESCAPED' : player.life === 'DEAD' ? '⊘ DIED' : 'STAYED'}</td><td>{player.score}</td></tr>;
  })}</tbody></table><div className="result-statistics"><div><span>MOST THREATS</span><strong>{summary.mostThreats}</strong></div><div><span title="Exact spending is not included in the authorized event history">COINS SPENT</span><strong>{summary.coinsSpent}</strong></div><div><span>CHESTS OPENED</span><strong>{summary.chestsOpened}</strong></div><div><span>REFUSED &amp; LIVED</span><strong>{summary.refusedAndLived}</strong></div></div></section>;
}

export function EventLog({ room }: { room: PublicRoomView }) {
  return <section className="panel"><h2>EVENT LOG · PUBLIC</h2><ol className="event-log">{[...(room.events ?? [])].slice(-80).map(event => <li key={event.id}><span className="event-sequence">{event.sequence}</span><span>{event.publicText}</span></li>)}</ol></section>;
}
