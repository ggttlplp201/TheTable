import { useEffect, useRef, useState } from 'react';
import type { ChestState, ItemStack, ObjectiveState, PlayerPrivateView, PublicPlayerView, PublicRoomView, ShopOffer } from '@the-table/game';
import type { AnyRoomView, PlayerCommand, RoomView, SpectatorRoomView } from './protocol';
import { isSpectatorView, ROLE_COPY } from './protocol';
import { assetNames, hasCapability, ITEM_HELP, itemName, OBJECTIVE_BY_ID, OBJECTIVE_HELP, playerName, presentItems, remainingSeconds, stackName, words } from './gameplay';

export type SendCommand = (command: PlayerCommand) => Promise<boolean>;
export interface ActionProps { room: RoomView; send: SendCommand; busy: boolean }

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

export function Countdown({ deadline, label }: { deadline: number; label: string }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [deadline]);
  const seconds = remainingSeconds(deadline, now);
  return <span className={`countdown ${seconds <= 10 ? 'urgent' : ''}`} role="timer" aria-label={`${label}: ${seconds} seconds`}>
    {seconds > 0 ? `${seconds}s` : 'Awaiting table'}
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
      <p className="muted">{isSpectatorView(room) ? 'Spectator · Full table view' : intermission ? `${playerName(state, shopper)} is shopping` : active?.life === 'DOWNED' ? 'Downed turn · Self-revive with Medicine or end the turn' : state.turn?.primaryUsed ? 'Primary Action used · Review the table or end your turn' : 'One Primary Action · Free communication and review'}</p>
    </div>
    {state.round?.phase === 'TURN' && state.turn && <div className="turn-clock">
      {state.turn.pausedRemainingMs !== undefined ? <><strong>{Math.ceil(state.turn.pausedRemainingMs / 1000)}s</strong><span>Turn paused</span></> : <><Countdown deadline={state.turn.deadlineAt} label="Turn remaining" /><span>Turn remaining</span></>}
    </div>}
    <ol className="turn-order" aria-label={intermission ? 'Shopping order' : 'Seat order'}>
      {(intermission && state.shop ? state.shop.order.map(id => state.players.find(player => player.id === id)!).filter(Boolean) : state.players).map(player =>
        <li key={player.id} className={(intermission ? player.id === shopper : player.seat === state.turn?.activeSeat) ? 'current' : ''}>
          <span className="seat-number">{player.seat + 1}</span> {player.name}<small>{words(player.life)}{player.connection === 'DISCONNECTED' ? ' · Offline' : ''}</small>
        </li>)}
    </ol>
  </header>;
}

export function ItemList({ items, empty = 'No visible items' }: { items: Array<ItemStack | null>; empty?: string }) {
  const present = presentItems(items);
  return present.length ? <ul className="item-list">{present.map(item => <li key={item.instanceId}><strong>{stackName(item)}</strong><span>{ITEM_HELP[item.itemId]}</span></li>)}</ul> : <p className="muted">{empty}</p>;
}

export function PlayerRoster({ room, viewerId }: { room: PublicRoomView; viewerId: string }) {
  return <section className="panel" aria-labelledby="players-title"><h2 id="players-title">At the table</h2><div className="player-roster">
    {room.players.map(player => <details className="player-detail" key={player.id} open={player.id === viewerId}>
      <summary><span><strong>{player.name}{player.id === viewerId ? ' (you)' : ''}</strong><small>{player.roleId ? ROLE_COPY[player.roleId].name : 'No role'} · {words(player.life)}</small></span><span className="player-numbers">{player.hp}/5 HP<small>{player.coins} Coins</small></span></summary>
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
    <p className="status-tag">{words(objective.status)}{objective.contingency ? ' · Contingency' : ''}</p>
    {definition && <p className="muted">Unlocks Round {definition.unlockRound} · {definition.mode === 'SUSTAINED' ? 'Requirements must hold when you leave' : 'Completion stays earned'}</p>}
    {objective.targetPlayerId && <p>Assigned target: <strong>{playerName(room, objective.targetPlayerId)}</strong></p>}
    {objective.contingencyTargetId && <p>Contingency: personally kill <strong>{playerName(room, objective.contingencyTargetId)}</strong>, then leave when offered.</p>}
    <Facts value={objective.progress} room={room} />
    {objective.status === 'EXIT_READY' && <p className="muted">Leave Table appears on an eligible normal turn. Staying defers your exit opportunity to your next normal turn.</p>}
  </div>;
}

export function PrivateDetail({ detail, room, title = 'Your objective' }: { detail: PlayerPrivateView; room: PublicRoomView; title?: string }) {
  return <section className="panel private-info" aria-label={title}><h2>{title}</h2><p className="muted">{title === 'Your objective' ? 'Private to you' : 'Spectator access'}</p><ObjectiveDetail objective={detail.objective} room={room} />
    <h3>Pockets</h3><ul className="pocket-list">{detail.pockets.map((pocket, index) => <li key={index}><span>Pocket {index + 1} · {pocket.source === 'BAG' ? 'Bag' : 'Default'}{pocket.protectedBySafe ? ' · Safe protected' : ''}</span><strong>{pocket.item ? stackName(pocket.item) : 'Empty'}</strong></li>)}</ul>
    <p className="muted">Occupied Pockets stay locked until their item is used, stolen, destroyed, or removed. Refill empty Pockets during your shopping opportunity.</p>
    {!!detail.inspections?.length && <details className="inspection-history"><summary>Private inspections ({detail.inspections.length})</summary>{detail.inspections.map(inspection => <div className="inspection" key={inspection.eventId}><Facts value={inspection.payload} room={room} /></div>)}</details>}
  </section>;
}

export function PendingInteraction({ room, send, busy }: { room: AnyRoomView; send: SendCommand; busy: boolean }) {
  const trade = room.public.pendingTrade;
  const threat = room.public.pendingThreat;
  const responseAllowed = hasCapability(room, trade ? 'RESPOND_TRADE' : 'RESPOND_THREAT');
  const focus = useDecisionFocus(responseAllowed ? (trade ?? threat)?.id : undefined);
  if (!trade && !threat) return null;
  const proposal = trade ?? threat!;
  const assets = (ids: string[], coins: number) => [...assetNames(room.public, ids), `${coins} Coins`].join(', ');
  return <section ref={focus} className="decision-panel" aria-label={trade ? 'Pending Trade' : 'Pending Threat'}>
    <div className="section-heading"><h2 tabIndex={-1}>{trade ? 'Trade on the table' : `${words(threat!.mode)} Threat`}</h2><Countdown deadline={proposal.deadlineAt} label="Response remaining" /></div>
    <p><strong>{playerName(room.public, proposal.actorId)}</strong> → <strong>{playerName(room.public, proposal.targetId)}</strong></p>
    {trade ? <dl className="terms"><div><dt>Offering</dt><dd>{assets(trade.offeredItems, trade.offeredCoins)}</dd></div><div><dt>Requesting</dt><dd>{assets(trade.requestedItems, trade.requestedCoins)}</dd></div></dl> : <><p>Demand: <strong>{assets(threat!.demandedItems, threat!.demandedCoins)}</strong></p><p>{threat!.committedItemType ? `Presented item: ${itemName(threat!.committedItemType)}` : 'One covered item. Its identity is hidden until resolution.'}</p></>}
    <p className="muted">When the response timer expires, {trade ? 'Accept' : 'Comply'} is automatic. The acting turn is paused.</p>
    {responseAllowed && <div className="button-row">
      <button className="button primary" disabled={busy} onClick={() => void send(trade ? { type: 'RESPOND_TRADE', accept: true } : { type: 'RESPOND_THREAT', comply: true })}>{trade ? 'Accept Trade' : 'Comply'}</button>
      <button className="button secondary" disabled={busy} onClick={() => void send(trade ? { type: 'RESPOND_TRADE', accept: false } : { type: 'RESPOND_THREAT', comply: false })}>{trade ? 'Decline Trade' : 'Refuse'}</button>
    </div>}
  </section>;
}

export function OverflowDecision({ room, send, busy }: ActionProps) {
  const allowed = hasCapability(room, 'OVERFLOW_CHOICE');
  const focus = useDecisionFocus(allowed ? room.private.overflows?.[0]?.id : undefined);
  if (!allowed) return null;
  const player = room.public.players.find(candidate => candidate.id === room.private.playerId);
  return <>{room.private.overflows?.map((choice, index) => <section ref={index === 0 ? focus : undefined} className="decision-panel" key={choice.id} aria-label="Inventory overflow">
    <div className="section-heading"><h2 tabIndex={-1}>Make room for {stackName(choice.incoming)}</h2><Countdown deadline={choice.deadlineAt} label="Overflow remaining" /></div>
    <p>Discard the incoming item, or replace one visible item. The incoming item is discarded when time expires.</p>
    <button className="button secondary" disabled={busy} onClick={() => void send({ type: 'OVERFLOW_CHOICE', overflowId: choice.id })}>Discard incoming {itemName(choice.incoming.itemId)}</button>
    <div className="replacement-list">{presentItems(player?.visibleInventory ?? []).map(item => <button className="button quiet" disabled={busy} key={item.instanceId} onClick={() => void send({ type: 'OVERFLOW_CHOICE', overflowId: choice.id, replaceInstanceId: item.instanceId })}>Replace {stackName(item)}</button>)}</div>
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
  return <section className="panel" aria-label="Spectator god view"><h2>Behind every hand</h2><p className="muted">Verified spectator access. Gameplay and communication are read only.</p>
    {room.players.map(player => <details key={player.public.id} className="spectator-player"><summary>{player.public.name} · {words(player.public.life)} · {player.public.score} points</summary>
      <PrivateDetail detail={player.private} room={room.public} title={`${player.public.name}’s private information`} />
      <h3>{player.public.name}’s Black Market</h3><OfferList offers={player.private.blackMarket ?? room.shop?.privateOffers[player.public.id] ?? []} />
      {player.private.overflows?.map(choice => <p key={choice.id}>Incoming: {stackName(choice.incoming)} · <Countdown deadline={choice.deadlineAt} label="Overflow remaining" /></p>)}
    </details>)}
  </section>;
}

export function Results({ room }: { room: AnyRoomView }) {
  const players = [...room.public.players].sort((a, b) => b.score - a.score || (a.exitOrder ?? Infinity) - (b.exitOrder ?? Infinity) || a.seat - b.seat);
  return <section className="panel results" aria-labelledby="results-title"><h2 id="results-title">Results</h2><p className="muted">Scores are final. A contingency banks 80% of the exit score; unresolved objectives score zero.</p><ol className="score-list">{players.map(player => {
    const objective = isSpectatorView(room) ? room.players.find(entry => entry.public.id === player.id)?.private.objective : player.id === room.private.playerId ? room.private.objective : player.revealedObjective;
    return <li key={player.id}><div><h3>{player.name}</h3><p>{words(player.life)}{player.exitOrder ? ` · Exit #${player.exitOrder}` : ''}</p><p className="muted">{objective ? `${OBJECTIVE_BY_ID[objective.objectiveId]?.name ?? words(objective.objectiveId)} · ${words(objective.status)}${objective.contingency ? ' · Contingency' : ''}` : 'Objective unrevealed'}</p></div><strong className="score">{player.score}<small>points</small></strong></li>;
  })}</ol></section>;
}

export function EventLog({ room }: { room: PublicRoomView }) {
  return <section className="panel"><h2>Table history</h2><ol className="event-log">{[...(room.events ?? [])].reverse().slice(0, 80).map(event => <li key={event.id}><span className="event-sequence">{event.sequence}</span><span>{event.publicText}</span></li>)}</ol>{!room.events?.length && <p className="muted">Table events will appear here.</p>}</section>;
}
