import { CoinAmount } from './ReferenceItemArt';
import { useEffect, useState } from 'react';
import { ReferenceItemArt, ReferencePortrait } from './ReferenceItemArt';
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
  const role = player.roleId ? ROLE_COPY[player.roleId] : undefined;
  const seatLabel = ['I', 'II', 'III', 'IV'][player.seat] ?? String(player.seat + 1);
  const readyCount = lockedIds.length;
  return <section className="match-setup" aria-label="Private match setup">
    <header><div><span>SEAT {seatLabel} · PRIVATE SETUP</span><h1>You are the {role?.name ?? 'Player'}</h1></div><div className="setup-status"><span>{readyCount} / {room.public.players.length} READY</span><div className="setup-clock" role="timer" aria-label={`Setup remaining: ${seconds} seconds`}>{seconds}s</div></div></header>
    {!connected && <p role="status">Reconnecting… Your choice stays private.</p>}
    {error && <div className="form-error" role="alert">{error}{retry && <button type="button" disabled={busy || !connected} onClick={() => void retry()}>Retry last action safely</button>}</div>}
    <div className="setup-columns">
      <section className="setup-role" aria-label="Your role"><div className="setup-portrait">{player.roleId && <ReferencePortrait roleId={player.roleId} />}</div><span>ABILITY</span><p>{role?.ability ?? '—'}</p></section>
      <aside className="setup-contract"><PrivateDetail detail={room.private} room={room.public} setup /></aside>
      <section className="setup-kit" aria-label="Your starting items">
        <div className="setup-starting-kit"><div className="setup-section-heading"><span>STARTING KIT · ON YOUR TABLE</span><CoinAmount amount={player.coins} /></div><div className="setup-kit-items">{items.map(item => <div key={item.instanceId}><ReferenceItemArt itemId={item.itemId} size={44} /><strong>{itemName(item.itemId)}</strong>{item.instanceId === setup?.bonusItemInstanceId && <b>SECRET</b>}</div>)}</div>{bonus && <p className="setup-bonus">SECRET BONUS · {itemName(bonus.itemId)}</p>}</div>
        <div className="setup-pocket"><div className="setup-section-heading"><span>POCKET · HIDDEN FROM ALL</span>{!setup?.locked && <span>CLICK TO SWAP</span>}</div>
          <div className="setup-pocket-selected">{(lockedItem ?? selected) ? <ReferenceItemArt itemId={(lockedItem ?? selected)!.itemId} size={42} /> : <span className="setup-empty-pocket">◇</span>}<div><strong>{(lockedItem ?? selected) ? itemName((lockedItem ?? selected)!.itemId) : 'EMPTY'}</strong><small>Others see: POCKET {(lockedItem ?? selected) ? 'OCCUPIED' : 'EMPTY'}</small></div></div>
          {!setup?.locked && <div className="setup-items" role="group" aria-label="Choose a starting Pocket item">{items.map(item => {
            const allowed = ITEM_BY_ID[item.itemId]?.pocketEligible;
            return <button type="button" key={item.instanceId} disabled={busy || !allowed} aria-pressed={selected?.instanceId === item.instanceId} aria-label={`Pocket ${itemName(item.itemId)}`} title={allowed ? ITEM_HELP[item.itemId] : 'Must remain visible'} onClick={() => setDraft(item.instanceId)}><ReferenceItemArt itemId={item.itemId} size={38} /><strong>{itemName(item.itemId)}</strong></button>;
          })}</div>}
        </div>
        <div className="setup-ready-block"><ul className="setup-progress" aria-label="Setup progress">{room.public.players.map(candidate => <li key={candidate.id} data-ready={lockedIds.includes(candidate.id) ? 'true' : undefined}><span>{lockedIds.includes(candidate.id) ? '●' : '○'}</span>{candidate.id === room.private.playerId ? 'YOU' : candidate.name.toUpperCase()}</li>)}</ul>
          {setup?.locked ? <div className="setup-locked" role="status"><strong>✓ READY</strong><span>WAITING FOR {Math.max(0, room.public.players.length - lockedIds.length)}</span></div> : <button className="button primary setup-confirm" type="button" aria-label="Lock Pocket choice" disabled={busy || !connected || !selected || seconds === 0} onClick={() => { if (selected) void send({ type: 'LOCK_SETUP', instanceId: selected.instanceId }); }}>{busy ? 'LOCKING…' : 'READY · TAKE YOUR SEAT'}</button>}
        </div>
      </section>
    </div>
  </section>;
}
