import { useEffect, useRef, useState } from 'react';
import type { ItemStack } from '@the-table/game';
import type { RoomView } from './protocol';
import type { SendCommand } from './MatchPanels';
import { hasCapability, ITEM_BY_ID, ITEM_HELP, itemName, needsOpponent, useItemCommand, useItemOptions, words } from './gameplay';
import { ReferenceItemArt } from './ReferenceItemArt';

export function SceneItemCard({ item, room, aiming, busy, onUse, onPutDown, send }: {
  item: ItemStack; room: RoomView; aiming: boolean; busy: boolean; onUse: () => void; onPutDown: () => void; send: SendCommand;
}) {
  const [pocketsOpen, setPocketsOpen] = useState(false);
  const definition = ITEM_BY_ID[item.itemId];
  const rarity = definition?.rarity ?? 'COMMON';
  const glyph = rarity === 'COMMON' ? '◆◇◇' : rarity === 'UNCOMMON' ? '◆◆◇' : rarity === 'RARE' ? '◆◆◆' : rarity === 'QUEST' ? '⬡' : rarity === 'ARTIFACT' ? '✧' : '✦';
  const use = definition?.consumption === 'ONE_USE' ? 'One-use' : definition?.consumption === 'REUSABLE' ? 'Reusable' : 'Passive';
  const usableItem = useItemOptions(room).some(option => option.instanceId === item.instanceId);
  const canUse = hasCapability(room, 'USE_ITEM') && usableItem;
  const emptyPockets = room.private.pockets.flatMap((pocket, index) => pocket.item ? [] : [index]);
  const canPocket = hasCapability(room, 'POCKET') && definition?.pocketEligible && emptyPockets.length > 0;
  const choosePocket = () => {
    if (busy || !canPocket) return;
    if (emptyPockets.length === 1) void send({ type: 'POCKET', instanceId: item.instanceId, pocketIndex: emptyPockets[0]! });
    else setPocketsOpen(current => !current);
  };
  // E use · Q pocket · Esc put down, while the card is open and the player is not typing.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.defaultPrevented || event.repeat || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.isComposing || event.key === 'Process' || target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
      const key = event.key.toLowerCase();
      if (key === 'e' && canUse && !busy && !aiming) { event.preventDefault(); onUse(); }
      else if (key === 'q' && canPocket && !busy) { event.preventDefault(); choosePocket(); }
      else if (key === 'escape' && !busy) { event.preventDefault(); onPutDown(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [aiming, busy, canPocket, canUse, onPutDown, onUse, item.instanceId, emptyPockets.join(','), send]);
  const tags = [needsOpponent(item.itemId) || item.itemId === 'cloth' ? 'TARGETED' : null, use.toUpperCase()].filter(Boolean) as string[];
  return <section className="scene-item-card" aria-label={`Selected ${itemName(item.itemId)}`}>
    <header><div className="scene-item-icon"><ReferenceItemArt itemId={item.itemId} size={60} label="" /></div><div><h2>{itemName(item.itemId)}</h2><span className="scene-item-tags"><b>{glyph} {words(rarity).toUpperCase()}</b>{tags.map(tag => <b key={tag} className={tag === 'TARGETED' ? 'targeted' : undefined}>{tag}</b>)}</span></div></header>
    <p>{ITEM_HELP[item.itemId]}</p>
    <div className="scene-item-actions"><button type="button" className="use" aria-keyshortcuts="E" disabled={busy || !canUse || aiming} onClick={onUse}><kbd aria-hidden="true">E</kbd>{aiming ? 'CHOOSE…' : usableItem ? 'USE' : 'PASSIVE'}</button><button type="button" aria-keyshortcuts="Q" disabled={busy || !canPocket} onClick={choosePocket}><kbd aria-hidden="true">Q</kbd>POCKET</button><button type="button" className="put-down" aria-keyshortcuts="Escape" disabled={busy} onClick={onPutDown}><kbd aria-hidden="true">ESC</kbd>PUT DOWN</button></div>
    {pocketsOpen && canPocket && <div className="scene-item-actions" aria-label="Choose empty Pocket">{emptyPockets.map(index => <button type="button" key={index} disabled={busy} onClick={() => void send({ type: 'POCKET', instanceId: item.instanceId, pocketIndex: index })}>POCKET {index + 1} ◇</button>)}</div>}
  </section>;
}

export function SceneAimPrompt({ itemId }: { itemId: string }) {
  const prompts: Record<string, string> = { knife: 'CHOOSE AN ADJACENT PLAYER TO STAB', pistol: 'CHOOSE A PLAYER TO SHOOT', poison: 'CHOOSE A PLAYER TO POISON', handcuffs: 'CHOOSE A PLAYER TO CUFF', spyglass: 'CHOOSE A POCKET TO INSPECT', pickpocket: 'CHOOSE A PLAYER TO PICKPOCKET', 'glass-eye': 'CHOOSE A PLAYER TO INSPECT' };
  return <div className="scene-aim-prompt" role="status"><span>◎ {prompts[itemId] ?? 'CHOOSE A PLAYER'}</span></div>;
}

/** A physical chest interaction; legality and tool choice still come from the authorized projection. */
export function SceneChestPrompt({ room, kind, busy, send, onClose }: {
  room: RoomView; kind: 'STANDARD' | 'BLACK'; busy: boolean; send: SendCommand; onClose: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [draft, setDraft] = useState('');
  const chest = room.public.chests?.find(entry => entry.kind === kind);
  const items = useItemOptions(room).filter(item => (kind === 'BLACK' ? ['black-key'] : ['key', 'lockpick', 'crowbar']).includes(item.itemId));
  const tool = items.find(item => item.instanceId === draft) ?? items[0];
  const canOpen = chest?.availability === 'AVAILABLE' && Boolean(tool) && hasCapability(room, 'USE_ITEM');
  const title = chest?.availability === 'OPENED' ? 'Already opened' : canOpen ? 'Open the chest?' : kind === 'BLACK' ? 'The Black Chest' : "It's locked";
  const body = chest?.availability === 'OPENED' ? 'Opened this round.' : canOpen ? `Uses your ${itemName(tool!.itemId).toUpperCase()}.` : tool ? 'Wait for an eligible action on your turn.' : kind === 'BLACK' ? 'Only the BLACK KEY opens it. You have none.' : 'You need a Key, Lockpick or Crowbar.';
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [kind]);
  return <section className={`scene-chest-prompt ${kind.toLowerCase()}`} role="dialog" aria-label={kind === 'BLACK' ? 'Black Chest' : 'Standard Chest'} onKeyDown={event => { if (event.key === 'Escape') onClose(); }}>
    <h2 ref={heading} tabIndex={-1}>{title}</h2><p>{body}</p>
    {canOpen && items.length > 1 && <label className="scene-chest-tool">Use<select aria-label="Chest tool" value={tool!.instanceId} onChange={event => setDraft(event.target.value)}>{items.map(item => <option key={item.instanceId} value={item.instanceId}>{itemName(item.itemId)}</option>)}</select></label>}
    <div>{canOpen && <button type="button" className="confirm" disabled={busy} onClick={() => void send(useItemCommand(tool!, 'self'))}>YES, OPEN</button>}<button type="button" disabled={busy} onClick={onClose}>{canOpen ? 'NO' : 'OK'}</button></div>
  </section>;
}

export function SceneExitPrompt({ busy, canStay, send }: { busy: boolean; canStay: boolean; send: SendCommand }) {
  return <div className="scene-exit-prompt" aria-label="Exit ready">
    <button type="button" className="scene-leave" disabled={busy} onClick={() => void send({ type: 'LEAVE_TABLE' })}>⤴ LEAVE TABLE</button>
    {canStay && <button type="button" disabled={busy} onClick={() => void send({ type: 'STAY' })}>STAY</button>}
    <i aria-hidden="true" />
  </div>;
}
