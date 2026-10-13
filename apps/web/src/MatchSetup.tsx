import { CoinAmount } from './ReferenceItemArt';
import { useEffect, useState } from 'react';
import { ReferenceItemArt } from './ReferenceItemArt';
import { PrivateDetail, type SendCommand } from './MatchPanels';
import { ITEM_BY_ID, ITEM_HELP, itemName, remainingSeconds } from './gameplay';
import { ROLE_COPY, type RoomView } from './protocol';
import './match-setup.css';

export function MatchSetup({ room, send, busy, connected, error, retry }: {
  room: RoomView; send: SendCommand; busy: boolean; connected: boolean; error?: string | undefined; retry?: (() => Promise<boolean>) | undefined;
}) {
  const setup = room.private.setup;
  const items = setup?.items ?? [];
  const eligible = items.filter(item => ITEM_BY_ID[item.itemId]?.pocketEligible);
  const [draft, setDraft] = useState('');
  const selected = eligible.find(item => item.instanceId === draft) ?? eligible[0];
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 250); return () => clearInterval(timer); }, []);
  const player = room.public.players.find(player => player.id === room.private.playerId)!;
  const lockedIds = room.public.setup?.lockedPlayerIds ?? [];
  const lockedItem = room.private.pockets.find(pocket => pocket.source === 'DEFAULT')?.item;
  const bonus = [...items, ...(lockedItem ? [lockedItem] : [])].find(item => item.instanceId === setup?.bonusItemInstanceId);
  const seconds = remainingSeconds(room.public.setup?.deadlineAt ?? now, now);
  return <section className="match-setup" aria-label="Private match setup">
    <header><div><span>PRIVATE SETUP</span><h1>Choose your starting Pocket</h1></div><div className="setup-clock" role="timer" aria-label={`Setup remaining: ${seconds} seconds`}>{seconds}s</div></header>
    {!connected && <p role="status">Reconnecting… Your choice stays private.</p>}
    {error && <div className="form-error" role="alert">{error}{retry && <button type="button" disabled={busy || !connected} onClick={() => void retry()}>Retry last action safely</button>}</div>}
    <div className="setup-columns"><section className="setup-kit" aria-label="Your starting items">
      <h2>{player.roleId ? ROLE_COPY[player.roleId].name : 'Your kit'} <span><CoinAmount amount={player.coins} /></span></h2>
      {bonus && <p className="setup-bonus">Your secret bonus: <strong>{itemName(bonus.itemId)}</strong></p>}
      {setup?.locked ? <div className="setup-locked" role="status"><ReferenceItemArt itemId={lockedItem!.itemId} size={88} /><h3>{itemName(lockedItem!.itemId)} is locked in your Pocket.</h3><p>Waiting for {room.public.players.length - lockedIds.length} {room.public.players.length - lockedIds.length === 1 ? 'player' : 'players'}.</p></div> : <>
        <p>Hide one item in your default Pocket. Everyone’s remaining items are revealed together after all choices lock.</p>
        <div className="setup-items" role="group" aria-label="Choose a starting item">{items.map(item => {
          const allowed = ITEM_BY_ID[item.itemId]?.pocketEligible;
          return <button type="button" key={item.instanceId} disabled={busy || !allowed} aria-pressed={selected?.instanceId === item.instanceId} aria-label={`Pocket ${itemName(item.itemId)}`} onClick={() => setDraft(item.instanceId)}>
            <ReferenceItemArt itemId={item.itemId} size={76} /><strong>{itemName(item.itemId)}</strong>{item.instanceId === setup?.bonusItemInstanceId && <b>SECRET BONUS</b>}<small>{allowed ? ITEM_HELP[item.itemId] : 'Must remain visible; cannot be Pocketed.'}</small>
          </button>;
        })}</div>
        <button className="button primary setup-confirm" type="button" disabled={busy || !connected || !selected || seconds === 0} onClick={() => { if (selected) void send({ type: 'LOCK_SETUP', instanceId: selected.instanceId }); }}>{busy ? 'Locking…' : 'Lock Pocket choice'}</button>
        {eligible[0] && <p className="setup-default">If time runs out, {itemName(eligible[0].itemId)} goes into your Pocket automatically.</p>}
      </>}
    </section><aside className="setup-contract"><PrivateDetail detail={room.private} room={room.public} /></aside></div>
    <ul className="setup-progress" aria-label="Setup progress">{room.public.players.map(player => <li key={player.id}><strong>{player.id === room.private.playerId ? 'You' : player.name}</strong><span>{lockedIds.includes(player.id) ? '✓ Locked' : player.connection === 'DISCONNECTED' ? 'Reconnecting' : 'Choosing'}</span></li>)}</ul>
  </section>;
}
