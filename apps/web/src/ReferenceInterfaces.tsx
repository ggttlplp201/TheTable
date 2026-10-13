import { CoinAmount } from './ReferenceItemArt';
import { useEffect, useState } from 'react';
import type { AudioEngine } from '@the-table/audio';
import type { AnyRoomView, PlayerCommand } from './protocol';
import { isSpectatorView } from './protocol';
import { hasCapability, ITEM_BY_ID, ITEM_HELP, itemName, OBJECTIVE_BY_ID, ownItems, playerName } from './gameplay';
import { ReferenceItemArt } from './ReferenceItemArt';
import { ReferenceAnimatedItem } from './ReferenceAnimatedItem';

import { readTutorialPreferences, saveTutorialPreferences } from './tutorial-storage';

const DISPLAY_KEY = 'the-table:display:v1';
const DEFAULT_DISPLAY = { textSize: 'M', log: true, grain: false };
function readDisplaySettings() {
  if (typeof window === 'undefined') return DEFAULT_DISPLAY;
  try { return { ...DEFAULT_DISPLAY, ...JSON.parse(localStorage.getItem(DISPLAY_KEY) ?? '{}') } as typeof DEFAULT_DISPLAY; } catch { return DEFAULT_DISPLAY; }
}

export function ReferenceHandbook() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('ALL');
  const [selection, setSelection] = useState('antidote');
  const current = ITEM_BY_ID[selection]!;
  const items = Object.values(ITEM_BY_ID).filter(item => item.name.toLowerCase().includes(query.toLowerCase()) && (category === 'ALL' || category === 'MEDICAL' && ['poison', 'medicine', 'antidote'].includes(item.id) || category === 'ARTIFACT' && item.type === 'ARTIFACT'));
  const rarity = current.rarity === 'COMMON' ? '◆◇◇' : current.rarity === 'UNCOMMON' ? '◆◆◇' : current.rarity === 'RARE' ? '◆◆◆' : '✧';
  const counters: Record<string, string> = { knife: 'ARMOR', pistol: 'ARMOR', poison: 'ANTIDOTE', antidote: 'POISON', pickpocket: 'SAFE', spyglass: 'SAFE', 'glass-eye': 'SAFE' };
  return <section className="reference-handbook" aria-label="Item handbook"><div className="handbook-catalog"><div className="handbook-filters"><input aria-label="Search items" placeholder="⌕ search items…" value={query} onChange={event => setQuery(event.target.value)} />{['ALL', 'MEDICAL', 'ARTIFACT'].map(value => <button key={value} type="button" className={category === value ? 'selected' : ''} aria-pressed={category === value} onClick={() => setCategory(value)}>{value}</button>)}</div><div className="handbook-items">{items.map(item => <button type="button" key={item.id} aria-pressed={selection === item.id} className={selection === item.id ? 'selected' : ''} onClick={() => setSelection(item.id)}><ReferenceAnimatedItem itemId={item.id} /><span>{item.name}</span></button>)}</div></div><article className="handbook-description"><ReferenceAnimatedItem itemId={current.id} size={120} /><h3>{current.name}</h3><p className="item-rarity">{rarity} {current.rarity} · {current.basePrice === null ? 'UNSELLABLE' : <CoinAmount amount={current.basePrice} />} · {current.consumption === 'ONE_USE' ? 'ONE-USE' : current.consumption === 'REUSABLE' ? 'REUSABLE' : 'EQUIPMENT'}</p><p>{ITEM_HELP[current.id]}</p><dl><div><dt>COUNTERS</dt><dd>{counters[current.id] ?? '—'}</dd></div><div><dt>COMBINES</dt><dd>{current.id === 'pistol' ? 'BULLET' : current.id === 'bullet' ? 'PISTOL' : '—'}</dd></div><div><dt>SOURCES</dt><dd>{current.rarity === 'QUEST' ? 'BLACK CHEST' : current.rarity === 'ARTIFACT' ? 'CHEST' : current.rarity === 'SPECIAL' ? 'MARKET · CHEST' : 'SHOP · CHEST'}</dd></div></dl></article></section>;
}

export function ReferenceSettings({ engine, started, onStart, children }: { engine: AudioEngine; started: boolean; onStart: () => void; children?: React.ReactNode }) {
  const [hintsDisabled, setHintsDisabled] = useState(() => readTutorialPreferences().tutorialHintsDisabled);
  const [state, setState] = useState(engine.state());
  const [saved] = useState(readDisplaySettings);
  const [textSize, setTextSize] = useState(saved.textSize);
  const [log, setLog] = useState(saved.log);
  const [grain, setGrain] = useState(saved.grain);
  const change = (kind: 'MASTER' | 'MUSIC' | 'EFFECTS', value: number) => {
    if (kind === 'MASTER') engine.setVolume(value);
    else if (kind === 'MUSIC') engine.setRoomVolume(value);
    else engine.setEffectsVolume(value);
    setState(engine.state());
  };
  useEffect(() => {
    try { localStorage.setItem(DISPLAY_KEY, JSON.stringify({ textSize, log, grain })); } catch { /* Display settings still apply in this tab. */ }
    document.documentElement.dataset.tableTextSize = textSize;
    document.documentElement.dataset.tableLog = String(log);
    document.documentElement.dataset.tableGrain = grain ? 'normal' : 'low';
    window.dispatchEvent(new CustomEvent('table-visual-settings', { detail: { grain: grain ? .16 : .06, textSize, log } }));
  }, [textSize, log, grain]);
  return <section className="reference-settings" aria-label="Settings and accessibility"><div><h3>AUDIO</h3>{!started && <button type="button" className="reference-enable-audio" onClick={onStart}>ENABLE SOUND</button>}{([['MASTER', state.volume], ['MUSIC', state.roomVolume], ['EFFECTS', state.effectsVolume]] as const).map(([kind, amount]) => <label className="reference-volume" key={kind}><span>{kind}</span><input type="range" min="0" max="1" step=".01" value={amount} onChange={event => change(kind, Number(event.target.value))} style={{ '--volume-level': `${amount * 100}%` } as React.CSSProperties} /><output>{Math.round(amount * 100)}</output></label>)}<h3 className="text-size-title">TEXT SIZE</h3><div className="reference-text-size">{['S', 'M', 'L'].map(size => <button type="button" key={size} className={textSize === size ? 'selected' : ''} aria-pressed={textSize === size} onClick={() => setTextSize(size)}>{size}</button>)}</div><button className="reference-mute" type="button" onClick={() => { engine.setMuted(!state.muted); setState(engine.state()); }}>{state.muted ? '[■] MUTED' : '[□] MUTE'}</button></div><div><h3>READABILITY</h3><button className="reference-setting-toggle" type="button" aria-pressed={!hintsDisabled} onClick={() => { const disabled = !hintsDisabled; setHintsDisabled(disabled); saveTutorialPreferences({ tutorialHintsDisabled: disabled }); }}><span>First-time gameplay hints</span><span>{hintsDisabled ? '[□] OFF' : '[■] ON'}</span></button><button className="reference-setting-toggle" type="button" onClick={() => setLog(value => !value)}><span>Event log visible</span><span>{log ? '[■] ON' : '[□] OFF'}</span></button><button className="reference-setting-toggle grain-toggle" type="button" onClick={() => setGrain(value => !value)}><span>Film grain</span><span>{grain ? '[■] NORMAL' : '[□] LOW'}</span></button><div className="reference-setting-toggle future-setting"><span>Reduced motion</span><span>[□] SYSTEM</span></div><div className="reference-camera-hint"><strong>CAMERA</strong><p>DRAG TO LOOK AROUND</p><small>Click/tap highlighted objects to interact.</small></div>{children && <details className="reference-voice"><summary>TABLE VOICE</summary>{children}</details>}</div></section>;
}

export function ReferenceStateOverlays({ room, viewerId, send, busy, openContract }: { room: AnyRoomView; viewerId: string; send: (command: PlayerCommand) => Promise<boolean>; busy: boolean; openContract: () => void }) {
  const player = room.public.players.find(player => player.id === viewerId);
  if (isSpectatorView(room) || !player || room.public.status === 'RESULTS') return null;
  const ready = room.private.objective?.status === 'EXIT_READY';
  if (player.life === 'DOWNED') {
    const medicine = ownItems(room).find(item => item.itemId === 'medicine');
    const active = room.public.players.find(candidate => candidate.seat === room.public.turn?.activeSeat);
    const ownDownedTurn = room.public.round?.phase === 'TURN' && active?.id === viewerId;
    const aggressorId = player.downed?.aggressorId;
    const aggressor = playerName(room.public, aggressorId).toUpperCase();
    const futureSeats = room.public.round?.seatsOwedTurn ?? [];
    const currentRound = room.public.round?.number ?? 0;
    const expiryIndex = player.downed?.expiresRound === currentRound ? futureSeats.indexOf(player.downed.expiresSeat) : -1;
    const seatsBeforeDeadline = expiryIndex >= 0 ? futureSeats.slice(0, expiryIndex) : futureSeats;
    const opportunities = [
      ...(active && active.id !== aggressorId && (active.life === 'ACTIVE' || active.life === 'DOWNED') ? [active] : []),
      ...seatsBeforeDeadline.flatMap(seat => {
        const candidate = room.public.players.find(entry => entry.seat === seat);
        return candidate && candidate.id !== aggressorId && (candidate.life === 'ACTIVE' || candidate.life === 'DOWNED') ? [candidate] : [];
      }),
      ...(player.downed && player.downed.expiresRound > currentRound ? [...room.public.players].sort((a, b) => a.seat - b.seat).filter(candidate => candidate.seat < player.downed!.expiresSeat && candidate.id !== aggressorId && (candidate.life === 'ACTIVE' || candidate.life === 'DOWNED')) : []),
    ].filter((candidate, index, all) => all.findIndex(entry => entry.id === candidate.id) === index)
      .filter(candidate => candidate.life === 'ACTIVE' || (candidate.id === viewerId && Boolean(medicine)));
    return <div className="reference-downed-hud"><div className="downed-title"><span>⊘ 0 HP</span><h2>Downed</h2><div className="downed-health">{Array.from({ length: 5 }, (_, index) => <i key={index} />)}</div><p>{aggressorId ? `Downed by ${aggressor}` : 'Waiting for rescue'}</p><strong>{aggressorId ? <>You will permanently die immediately before<br />{aggressor}’S NEXT TURN.</> : 'THE RESCUE WINDOW IS CLOSING'}</strong>{active && <p>Current turn: <b>{active.name.toUpperCase()}</b></p>}<p>Rescue opportunities remaining:<br /><b>{opportunities.length ? opportunities.map(candidate => candidate.id === viewerId ? 'YOU' : candidate.name.toUpperCase()).join(' → ') : 'NONE'}</b></p></div><div className="downed-actions">
      {ownDownedTurn && medicine ? <button type="button" disabled={busy || !hasCapability(room, 'USE_ITEM')} onClick={() => void send({ type: 'USE_ITEM', instanceId: medicine.instanceId })}><ReferenceItemArt itemId="medicine" size={32} />REVIVE WITH MEDICINE<small>Return at 2 HP</small></button>
        : ownDownedTurn ? <div><strong>NO MEDICINE</strong><small>Pass your Downed turn</small></div>
        : medicine ? <div><strong>SELF-REVIVE</strong><small>Wait for your Downed turn · Medicine ready</small></div>
        : <div><strong>SELF-REVIVE UNAVAILABLE</strong><small>No Medicine</small></div>}
      {ownDownedTurn && hasCapability(room, 'END_TURN') && <button type="button" disabled={busy} onClick={() => void send({ type: 'END_TURN' })}>PASS DOWNED TURN</button>}<span>PRIMARY ACTIONS LOCKED · FREE ACTIONS REMAIN AVAILABLE</span></div></div>;
  }
  if (!ready) return null;
  const objective = room.private.objective!;
  const matchStarted = room.public.events?.find(event => event.kind === 'MATCH_STARTED')?.id ?? 'current';
  const bannerKey = `the-table:fulfilled-banner:v2:${room.public.id}:${viewerId}:${objective.objectiveId}:${objective.firstReadyAt ?? matchStarted}`;
  return <FulfilledBanner key={bannerKey} storageKey={bannerKey} title={OBJECTIVE_BY_ID[objective.objectiveId]?.name ?? itemName(objective.objectiveId)} openContract={openContract} />;
}

/** Board 07: a transient 5 s banner on the Active → Fulfilled transition, once per contract. Afterwards the
 * contract card (C) and the door prompt carry the state; a permanent banner covered the timer and the door prompt. */
function FulfilledBanner({ storageKey, title, openContract }: { storageKey: string; title: string; openContract: () => void }) {
  const [visible, setVisible] = useState(() => { try { return sessionStorage.getItem(storageKey) !== '1'; } catch { return true; } });
  useEffect(() => {
    if (!visible) return undefined;
    try { sessionStorage.setItem(storageKey, '1'); } catch { /* storage denied: still auto-hides */ }
    const timer = window.setTimeout(() => setVisible(false), 5000);
    return () => window.clearTimeout(timer);
  }, [storageKey, visible]);
  if (!visible) return null;
  return <button type="button" className="reference-fulfilled-banner" onClick={openContract}><span><i>✓</i>CONTRACT FULFILLED</span><strong>{title}</strong></button>;
}
