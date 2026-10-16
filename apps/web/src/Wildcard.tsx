import { useEffect, useRef, useState } from 'react';
import type { PublicRoomView } from '@the-table/game';
import { hasCapability, presentItems, stackName } from './gameplay';
import { Countdown, type ActionProps } from './MatchPanels';
import { ReferenceItemArt } from './ReferenceItemArt';
import { WILDCARD_PUBLIC_BANNER_DELAY, wildcardDefinition, wildcardPublicResult, wildcardResolutionCommand, wildcardResolutionFeedback, wildcardTargets } from './wildcard-presentation';
import './wildcard.css';

export function WildcardDraw({ room, send, busy }: ActionProps) {
  const allowed = hasCapability(room, 'DRAW_WILDCARD');
  return <section className="wildcard-draw" aria-label="Draw Wildcard">
    <span>PRIMARY ACTION</span>
    <button type="button" className="button primary" disabled={busy || !allowed} onClick={() => void send({ type: 'DRAW_WILDCARD' })}>{allowed ? 'DRAW WILDCARD' : 'DRAW UNAVAILABLE'}</button>
  </section>;
}

/** This decision is driven entirely by the private projection, including after reconnect. */
type WildcardTargetBinding = { targetPlayerId?: string; onTargetPlayerChange?: (id: string) => void };

export function WildcardDecision({ room, send, busy, connected, targetPlayerId, onTargetPlayerChange }: ActionProps & WildcardTargetBinding & { connected: boolean }) {
  const pending = room.private.pendingWildcard;
  const heading = useRef<HTMLHeadingElement>(null);
  const card = pending && wildcardDefinition(pending.cardId);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [pending?.cardId, pending?.phase]);
  if (!pending || !card) return null;
  const targeting = pending.phase === 'TARGETING';
  return <section className="wildcard-decision" data-phase={pending.phase} role="dialog" aria-label={targeting ? 'Resolve your Wildcard' : 'Private Wildcard decision'} aria-describedby="wildcard-action-help">
    <div className="wildcard-ability-banner"><header><h2 tabIndex={-1} ref={heading}>{card.name.toUpperCase()}</h2><span>{targeting ? '◈ REVEALED TO THE TABLE' : '◈ WILDCARD · ONLY YOU'}</span></header><p className="wildcard-ability">{card.description}</p></div>
    <span className="sr-only">{!targeting && 'PRIVATE · ONLY YOU SEE THIS'}{room.public.turn && <Countdown deadline={room.public.turn.deadlineAt} label="Normal turn remaining" format="seconds" />}</span>
    {!connected && <p className="wildcard-connection" role="status">Reconnecting… Your decision is waiting for the table.</p>}
    {targeting ? <WildcardTargetPicker key={card.id} room={room} send={send} busy={busy || !connected} {...(targetPlayerId !== undefined ? { targetPlayerId } : {})} {...(onTargetPlayerChange ? { onTargetPlayerChange } : {})} /> : <>
      <p className="sr-only" id="wildcard-action-help">Use reveals the card publicly{card.targeting !== 'NONE' ? ', then you choose its target' : ' and resolves it'}. Burn keeps its identity secret. Choose before your normal turn ends. An undecided card is burned.</p>
      <div className="wildcard-buttons"><button type="button" className="wildcard-use" disabled={busy || !connected || !hasCapability(room, 'USE_WILDCARD')} onClick={() => void send({ type: 'USE_WILDCARD' })}>USE</button><button type="button" className="wildcard-burn" disabled={busy || !connected || !hasCapability(room, 'BURN_WILDCARD')} onClick={() => void send({ type: 'BURN_WILDCARD' })}>BURN</button></div>
    </>}
    <div className="wildcard-commitment"><strong>PRIMARY ACTION SPENT</strong></div>
  </section>;
}

export function WildcardTargetPicker({ room, send, busy, targetPlayerId, onTargetPlayerChange }: ActionProps & WildcardTargetBinding) {
  const [localTargetId, setLocalTargetId] = useState('');
  const targetId = targetPlayerId ?? localTargetId;
  const [instanceId, setInstanceId] = useState('');
  const [ownInstanceId, setOwnInstanceId] = useState('');
  const [pocketIndex, setPocketIndex] = useState('');
  useEffect(() => { setInstanceId(''); setPocketIndex(''); }, [targetId]);
  const chooseTarget = (id: string) => { setLocalTargetId(id); onTargetPlayerChange?.(id); };
  const pending = room.private.pendingWildcard;
  if (!pending || pending.phase !== 'TARGETING') return null;
  const card = wildcardDefinition(pending.cardId)!;
  const options = wildcardTargets(room.public, room.private.playerId, pending.cardId);
  const target = options.players.find(player => player.id === targetId);
  const visible = presentItems(target?.visibleInventory ?? []);
  const command = wildcardResolutionCommand(room, { targetId, instanceId, ownInstanceId, pocketIndex });
  const allowed = hasCapability(room, 'RESOLVE_WILDCARD');
  return <form className="wildcard-targets" onSubmit={event => {
    event.preventDefault();
    if (busy || !command) return;
    void send(command);
  }}><fieldset disabled={busy || !allowed}><legend className="sr-only">Choose Wildcard targets</legend>
    {options.hasTargets ? <>
      <section className="wildcard-choice-block wildcard-player-block" aria-labelledby="wildcard-player-heading">
        <div className="wildcard-choice-heading"><span>1</span><strong id="wildcard-player-heading">CHOOSE A PLAYER</strong></div>
        <div className="wildcard-player-choices" role="group" aria-label="Choose a Wildcard target player">{options.players.map(player => <button type="button" key={player.id} aria-label={player.name} aria-pressed={targetId === player.id} onClick={() => chooseTarget(player.id)}><span className="wildcard-choice-mark" aria-hidden="true">{targetId === player.id ? '◆' : '◇'}</span><strong>{player.name.toUpperCase()}</strong><small>SEAT {player.seat + 1}{player.connection === 'DISCONNECTED' ? ' · OFFLINE' : ''}</small></button>)}</div>
        <label className="sr-only">Wildcard target player<select aria-label="Wildcard target player" value={targetId} onChange={event => chooseTarget(event.target.value)}><option value="">Choose a player</option>{options.players.map(player => <option key={player.id} value={player.id}>{player.name}</option>)}</select></label>
      </section>
      {target && (card.targeting === 'POCKET' ? <section className="wildcard-choice-block" aria-labelledby="wildcard-pocket-heading">
        <div className="wildcard-choice-heading"><span>2</span><strong id="wildcard-pocket-heading">CHOOSE AN OCCUPIED POCKET</strong><small>CONTENTS STAY HIDDEN</small></div>
        <div className="wildcard-pocket-choices" role="group" aria-label="Choose an occupied Pocket">{target.pocketOccupancy.flatMap((occupied, index) => occupied ? [<button type="button" key={index} aria-label={`Pocket ${index + 1}`} aria-pressed={pocketIndex === String(index)} onClick={() => setPocketIndex(String(index))}><span aria-hidden="true">▰</span><strong>POCKET {index + 1}</strong></button>] : [])}</div>
        <label className="sr-only">Wildcard target Pocket<select aria-label="Wildcard target Pocket" value={pocketIndex} onChange={event => setPocketIndex(event.target.value)}><option value="">Choose a Pocket</option>{target.pocketOccupancy.flatMap((occupied, index) => occupied ? [<option key={index} value={index}>Pocket {index + 1} · Occupied</option>] : [])}</select></label>
      </section> : <section className="wildcard-choice-block" aria-labelledby="wildcard-item-heading">
        <div className="wildcard-choice-heading"><span>2</span><strong id="wildcard-item-heading">CHOOSE THEIR VISIBLE ITEM</strong></div>
        <div className="wildcard-item-choices" role="group" aria-label="Choose their visible item">{visible.map(item => <button type="button" key={item.instanceId} aria-label={stackName(item)} aria-pressed={instanceId === item.instanceId} onClick={() => setInstanceId(item.instanceId)}><ReferenceItemArt itemId={item.itemId} size={52} label="" /><strong>{stackName(item).toUpperCase()}</strong>{item.quantity > 1 && <small>×{item.quantity}</small>}<span className="wildcard-item-check" aria-hidden="true">{instanceId === item.instanceId ? '◆' : ''}</span></button>)}</div>
        <label className="sr-only">Wildcard target item<select aria-label="Wildcard target item" value={instanceId} onChange={event => setInstanceId(event.target.value)}><option value="">Choose an item</option>{visible.map(item => <option key={item.instanceId} value={item.instanceId}>{stackName(item)}</option>)}</select></label>
      </section>)}
      {card.targeting === 'EXCHANGE' && <section className="wildcard-choice-block" aria-labelledby="wildcard-own-item-heading">
        <div className="wildcard-choice-heading"><span>3</span><strong id="wildcard-own-item-heading">CHOOSE YOUR ITEM TO GIVE</strong></div>
        <div className="wildcard-item-choices wildcard-own-item-choices" role="group" aria-label="Choose your exchange item">{options.ownItems.map(item => <button type="button" key={item.instanceId} aria-label={`Give ${stackName(item)}`} aria-pressed={ownInstanceId === item.instanceId} onClick={() => setOwnInstanceId(item.instanceId)}><ReferenceItemArt itemId={item.itemId} size={52} label="" /><strong>{stackName(item).toUpperCase()}</strong>{item.quantity > 1 && <small>×{item.quantity}</small>}<span className="wildcard-item-check" aria-hidden="true">{ownInstanceId === item.instanceId ? '◆' : ''}</span></button>)}</div>
        <label className="sr-only">Your exchange item<select aria-label="Your exchange item" value={ownInstanceId} onChange={event => setOwnInstanceId(event.target.value)}><option value="">Choose an item to give</option>{options.ownItems.map(item => <option key={item.instanceId} value={item.instanceId}>{stackName(item)}</option>)}</select></label>
      </section>}
      {card.targeting === 'POCKET' && <p>Safe blocks the reveal.</p>}
    </> : <p role="status">No legal targets remain. Resolve without an effect; your Wildcard remains spent.</p>}
    {targetId && !target && options.hasTargets && <p role="status">That target is no longer available. Choose another player.</p>}
    <button className="button primary" disabled={busy || !command}>{options.hasTargets ? 'RESOLVE WILDCARD' : 'RESOLVE · NO EFFECT'}</button>
  </fieldset><p className="wildcard-deadline-note" id="wildcard-action-help">Resolve before your turn ends.</p></form>;
}

export function WildcardPublicFeedback({ room, ownerDecision = false }: { room: PublicRoomView; ownerDecision?: boolean }) {
  const [now, setNow] = useState(Date.now);
  const lastEvent = room.events?.at(-1)?.id;
  useEffect(() => {
    setNow(Date.now());
    if (!wildcardPublicResult(room, Date.now()) && !wildcardResolutionFeedback(room, Date.now())) return;
    const timer = window.setInterval(() => { const next = Date.now(); setNow(next); if (!wildcardPublicResult(room, next) && !wildcardResolutionFeedback(room, next)) window.clearInterval(timer); }, 100);
    return () => window.clearInterval(timer);
  }, [room.id, lastEvent]);
  const result = wildcardPublicResult(room, now);
  const resolution = wildcardResolutionFeedback(room, now);
  const pending = room.wildcard?.pending;
  let banner = null;
  if (pending && !result && !ownerDecision) {
    const card = wildcardDefinition(pending.cardId);
    banner = <aside className="wildcard-public-pending" role="status">{room.players.find(player => player.id === pending.playerId)?.name} played {card?.name.toUpperCase() ?? 'a Wildcard'} · choosing a target</aside>;
  }
  if (result && (!ownerDecision || pending) && (result.burned || now - result.at >= WILDCARD_PUBLIC_BANNER_DELAY)) banner = <aside key={result.id} className={`wildcard-public-result ${result.burned ? 'is-burned' : 'is-used'}`} role="status" aria-live="polite">
    {result.burned ? <p>{result.text.toUpperCase()}</p> : <><div className="wildcard-public-who"><span>{result.actorName.toUpperCase()} PLAYED</span>{result.targetName && <span>→ {result.targetName.toUpperCase()}</span>}</div><h3 className="wildcard-result-name">{result.card?.name.toUpperCase() ?? 'WILDCARD'}</h3><p>{result.card?.description ?? result.text}</p></>}
  </aside>;
  return <>{banner}{resolution && <aside key={resolution.id} className="wildcard-resolution-text" role="status" aria-label="Wildcard outcome" aria-live="polite"><p>{resolution.text}</p>{resolution.details.length > 0 && <p className="wildcard-resolution-details">{resolution.details.join(' · ')}</p>}</aside>}</>;
}
