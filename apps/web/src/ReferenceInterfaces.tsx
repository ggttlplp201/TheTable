import { CoinAmount } from './ReferenceItemArt';
import { useEffect, useMemo, useState } from 'react';
import type { AudioEngine } from '@the-table/audio';
import type { AnyRoomView, PlayerCommand } from './protocol';
import { isSpectatorView, ROLE_COPY } from './protocol';
import { OBJECTIVES, ROLES as ROLE_KITS, WILDCARDS } from '@the-table/content';
import { hasCapability, ITEM_BY_ID, ITEM_HELP, itemName, OBJECTIVE_BY_ID, OBJECTIVE_HELP, ownItems, playerName } from './gameplay';
import { ReferenceItemArt } from './ReferenceItemArt';
import { HandbookModel } from './ReferenceAnimatedItem';
import { HandbookCharacterThumbnail } from './ReferencePortrait';
import { tableSealURL } from './reference-game-kit.js';

import { readTutorialPreferences, saveTutorialPreferences } from './tutorial-storage';

const DISPLAY_KEY = 'the-table:display:v1';
const DEFAULT_DISPLAY = { textSize: 'M', log: true, grain: false };
function readDisplaySettings() {
  if (typeof window === 'undefined') return DEFAULT_DISPLAY;
  try { return { ...DEFAULT_DISPLAY, ...JSON.parse(localStorage.getItem(DISPLAY_KEY) ?? '{}') } as typeof DEFAULT_DISPLAY; } catch { return DEFAULT_DISPLAY; }
}

type HandbookCharacter = {
  id: string; group: string; name: string; epithet: string; tint: number; no: string; stamp: string; stampCol: string;
  fields: string[][]; lore: string[]; behaviour: string;
  gold?: number; ability?: string; uses?: string; abilityText?: string; kit?: string[];
};
// Case records are the supplied Handbook's CHARS, including its deliberate redactions.
const R_ = '█';
const CHARS: HandbookCharacter[] = [
  { id: 'enforcer', group: 'AT THE TABLE', name: 'Enforcer', epithet: 'The Debt Collector', tint: 0x7a3a2a, gold: 2, no: '0117', stamp: 'IN SESSION', stampCol: '#7c1f19',
    fields: [['NAME', 'Augustin Marr'], ['AGE', '47'], ['SEX', 'Male'], ['HEIGHT', '6′4″'], ['FORMERLY', 'Collector for a private lender, Lower Quay'], ['OFFENCE', 'Recovered debts by force. Three debtors died in his custody; the ledgers recorded them as settled.'], ['STATUS', 'Seated. Match ' + R_ + '.']],
    lore: ['Marr kept every pair of cuffs he ever closed. The Table returned them to him, locked, and he has not asked for the keys.', 'The face was taken in the first session. What replaced it is loaded and points wherever he looks. He has never been seen to fire it at the Table, and he has never been seen to lower it.'],
    behaviour: 'Speaks rarely. Watches hands rather than faces. Counts chambers when no one is talking.',
    ability: 'Quick Draw', uses: 'ONCE PER MATCH', abilityText: 'Fire the Pistol without a Bullet.', kit: ['pistol', 'bullet', 'cloth'] },
  { id: 'medic', group: 'AT THE TABLE', name: 'Medic', epithet: 'The Night Nurse', tint: 0x6a7a5a, gold: 3, no: '0203', stamp: 'IN SESSION', stampCol: '#7c1f19',
    fields: [['NAME', 'Sister ' + R_], ['AGE', '39'], ['SEX', 'Female'], ['HEIGHT', '5′7″'], ['FORMERLY', 'Ward sister, St. Ottilie fever hospital'], ['OFFENCE', 'During the outbreak, rationed the remaining medicine by her own judgement of who deserved it. Falsified the records of those she refused.'], ['STATUS', 'Seated. Match ' + R_ + '.']],
    lore: ['The syringes she wears were drawn for patients she chose not to treat. There are forty-one. The Table did not miscount.', 'She is still a capable nurse, and will revive anyone at the Table without being asked. Survivors report that she checks their pulse for longer than is necessary.'],
    behaviour: 'Keeps notes on every player. Calm when others are wounded; uneasy when they are not.',
    ability: 'Field Dressing', uses: 'PASSIVE', abilityText: 'Revive another player straight to 3 HP.', kit: ['medicine', 'antidote', 'knife'] },
  { id: 'smuggler', group: 'AT THE TABLE', name: 'Smuggler', epithet: 'The Contraband Runner', tint: 0x3a4a5a, gold: 4, no: '0088', stamp: 'IN SESSION', stampCol: '#7c1f19',
    fields: [['NAME', R_], ['AGE', R_], ['SEX', 'Male'], ['HEIGHT', '5′11″'], ['FORMERLY', 'Night boatman, the Black Reach docks'], ['OFFENCE', 'Ran cargo past the harbour customs for eleven years. Scuttled his boat with its crew aboard when the patrol closed in, to sink the evidence.'], ['STATUS', 'Seated. Match ' + R_ + '.']],
    lore: ['He came up from the scuttled hull still in the suit he wore to sink it. The Table bolted the helmet shut and let the sea keep growing on him; coral roots through the canvas, and the sores open when he moves.', 'He still carries contraband in a net at his hip, and he trades as though the patrol is a minute away. Nothing he hands over has ever been what it appeared to be.'],
    behaviour: 'Never sits with his back to the door. Listens to the room before every Trade.',
    ability: 'Private Stock', uses: 'PASSIVE', abilityText: 'See 4 Black Market offers instead of 3.', kit: ['cloth', 'poison'] },
  { id: 'locksmith', group: 'AT THE TABLE', name: 'Locksmith', epithet: 'Master of Wards', tint: 0x8a6a3a, gold: 3, no: '0154', stamp: 'IN SESSION', stampCol: '#7c1f19',
    fields: [['NAME', 'Edda Voss'], ['AGE', '52'], ['SEX', 'Female'], ['HEIGHT', '5′3″'], ['FORMERLY', 'Master locksmith, Guild of the Ward'], ['OFFENCE', 'Paid by a landlord to secure an overdue tenancy. Fitted the locks from the outside, with the family still inside, and did not return.'], ['STATUS', 'Seated. Match ' + R_ + '.']],
    lore: ['She is kept veiled now, behind a porcelain mask with a keyhole set in its brow. Her arms were refitted with gears at every joint, and they turn whether she wants them to or not. The wreath on her head is made of the keys she never gave back.', 'Voss is meticulous and unhurried. She is the only player on record to have opened every chest the Table has offered her.'],
    behaviour: 'Examines every lock in the room on arrival. Lowers the loupe when someone lies.',
    ability: 'Tumbler Sense', uses: 'ONCE PER ROUND', abilityText: 'Look inside a Chest before anyone opens it.', kit: ['key', 'lockpick', 'knife'] },
  { id: 'broker', group: 'AT THE TABLE', name: 'Broker', epithet: 'The Financier', tint: 0x4a3a5a, gold: 5, no: '0009', stamp: 'IN SESSION', stampCol: '#7c1f19',
    fields: [['NAME', 'Mr. ' + R_], ['AGE', '58'], ['SEX', 'Male'], ['HEIGHT', '6′1″'], ['FORMERLY', 'Private financier, Exchange Row'], ['OFFENCE', 'Bought the debts of an entire district, raised the interest, and collected the houses. Forty families evicted over one winter.'], ['STATUS', 'Seated. Match ' + R_ + '.']],
    lore: ['He wears a porcelain face for business. The one behind it is the one he used at home; it has not spoken since he arrived.', 'His mouth now takes only coin. He is the oldest seat at the Table still playing, and he has never once been short of Gold.'],
    behaviour: 'Agrees quickly. Restates every price before accepting it.',
    ability: 'Margin', uses: 'PASSIVE', abilityText: 'Sell items back for 1 more Gold, up to base price − 1.', kit: ['spyglass', 'handcuffs', 'knife'] },
  { id: 'scavenger', group: 'AT THE TABLE', name: 'Scavenger', epithet: 'The Pit Picker', tint: 0x5a6a3a, gold: 3, no: '0231', stamp: 'IN SESSION', stampCol: '#7c1f19',
    fields: [['NAME', 'Pim ' + R_], ['AGE', '34'], ['SEX', 'Female'], ['HEIGHT', '5′6″'], ['FORMERLY', 'Corpse handler, the plague pits; former army sapper'], ['OFFENCE', 'Stripped the dead in the pits for resale. When the dead ran out, took from the dying, and did not wait.'], ['STATUS', 'Seated. Match ' + R_ + '.']],
    lore: ['The mask and helmet are her own, kept from the war and from the pits. She has not removed either since arrival, and the Table has not asked her to.', 'Everything in her sack was taken from someone at this Table. She knows whose each item was, and when they stopped needing it.'],
    behaviour: 'Moves toward the Downed before anyone else does. Sorts her pack between turns.',
    ability: 'Salvage', uses: 'ONCE PER INTERMISSION', abilityText: 'Gain 1 Gold.', kit: ['knife', 'medicine', 'crowbar'] },
  { id: 'tallyman', group: 'BEHIND THE COUNTER', name: 'Tallyman', epithet: 'Keeper of the Public Shop', tint: 0x3a5a3a, no: '0002', stamp: 'RETAINED', stampCol: '#3a2a1a',
    fields: [['NAME', 'Horace Pell'], ['AGE', '44 at sentencing'], ['SEX', 'Male'], ['HEIGHT', '6′2″'], ['FORMERLY', 'Clerk to a grain merchant, Famine Street'], ['OFFENCE', 'Kept two sets of books during a famine. The merchant hoarded; Pell made the shortage look natural.'], ['STATUS', 'Lost at the Table. Retained.']],
    lore: ['Pell lost his match and stayed, as the rules require. The Table found him useful and gave him a counter instead of the dark.', 'He keeps the public ledger honestly now. He is courteous to every player, and he records every sale twice.'],
    behaviour: 'Polite, precise, patient. Does not discuss his own debt.' },
  { id: 'fence', group: 'BEHIND THE COUNTER', name: 'Fence', epithet: 'Keeper of the Black Market', tint: 0x8a2a20, no: R_, stamp: 'RETAINED', stampCol: '#3a2a1a',
    fields: [['NAME', R_], ['AGE', R_], ['SEX', R_], ['HEIGHT', R_], ['FORMERLY', R_], ['OFFENCE', R_], ['STATUS', 'Lost at the Table. Date ' + R_ + '. Retained.']],
    lore: ['The Fence\'s record was sealed by the Table itself. It is known that he lost, and that he was not sent below.', 'The watches on his coat are stopped at different hours. Players who have studied them believe each marks the moment someone at the Table ran out of time.'],
    behaviour: 'Deals only in private. Never names a price aloud.' },
  { id: 'dealer', group: 'TUTORIAL', name: 'The Dealer', epithet: 'The Table, in a man\'s shape', tint: 0x8a6a3a, no: '0000', stamp: 'THE HOUSE', stampCol: '#3a2a1a',
    fields: [['NAME', '—'], ['AGE', R_], ['SEX', '—'], ['HEIGHT', R_], ['NATURE', 'Not sentenced. Not human.'], ['OFFENCE', 'None recorded.']],
    lore: ['The Dealer is the Table itself, taking a human shape so that the sentenced have someone to face. What is under the brim is not recorded.', 'The Table exists so that debts are paid. He deals, he waits, and he decides when a debt is settled.'],
    behaviour: 'Patient. Does not blink.' }
];

type HandbookTab = 'items' | 'chars' | 'contracts' | 'wildcards';
const HANDBOOK_TABS = [['items', 'ITEMS'], ['chars', 'CHARACTERS'], ['contracts', 'CONTRACTS'], ['wildcards', 'WILDCARDS']] as const;
const itemCategory = (item: (typeof ITEM_BY_ID)[string]) => ['poison', 'antidote', 'medicine', 'stimulant'].includes(item.id) ? 'MEDICAL' : item.type === 'WEAPON' || item.type === 'AMMO' ? 'WEAPONS & AMMUNITION' : item.type === 'ARTIFACT' ? 'ARTIFACTS' : item.type === 'QUEST' ? 'QUEST' : 'TOOLS & EQUIPMENT';
const targetLabel = (target: string) => target === 'ONE_OTHER_PLAYER' ? '1 TARGET' : target === 'TWO_OTHER_PLAYERS' ? '2 TARGETS' : 'NO TARGET';
function Redacted({ value }: { value: string }) {
  return <>{value.split(/(█+)/).map((part, index) => part.includes('█') ? <span key={index} className="handbook-redaction" aria-label="Redacted">██████</span> : part)}</>;
}
export function ReferenceHandbook({ onClose }: { onClose?: () => void }) {
  const [tab, setTab] = useState<HandbookTab>('chars');
  const [selections, setSelections] = useState({ items: 'antidote', chars: 'enforcer', contracts: 'escapist', wildcards: 'seize' });
  const selected = selections[tab];
  const items = Object.values(ITEM_BY_ID);
  const character = CHARS.find(entry => entry.id === selections.chars)!;
  const characterSeal = useMemo(() => typeof document === 'undefined' ? '' : tableSealURL(character.stamp, character.stampCol, 132), [character.stamp, character.stampCol]);
  const item = ITEM_BY_ID[selections.items] ?? items[0]!;
  const contract = OBJECTIVES.find(entry => entry.id === selections.contracts)!;
  const wildcard = WILDCARDS.find(entry => entry.id === selections.wildcards)!;
  const role = Object.values(ROLE_KITS).find(entry => entry.id === character.id);
  const roleCopy = ROLE_COPY[character.id as keyof typeof ROLE_COPY];
  const groups = tab === 'chars' ? ['AT THE TABLE', 'BEHIND THE COUNTER', 'TUTORIAL'].map(title => ({ title, rows: CHARS.filter(entry => entry.group === title).map(entry => ({ id: entry.id, name: entry.name, epithet: entry.epithet })) }))
    : tab === 'items' ? [...new Set(items.map(itemCategory))].map(title => ({ title, rows: items.filter(entry => itemCategory(entry) === title).map(entry => ({ id: entry.id, name: entry.name, epithet: entry.rarity })) }))
    : tab === 'contracts' ? (['SUSTAINED', 'LATCHED'] as const).map(mode => ({ title: mode === 'SUSTAINED' ? 'SUSTAINED · HOLD UNTIL YOU LEAVE' : 'LATCHED · DONE ONCE IT HAPPENS', rows: OBJECTIVES.filter(entry => entry.mode === mode).map(entry => ({ id: entry.id, name: entry.name, epithet: 'ROUND ' + entry.unlockRound + '+ · ' + targetLabel(entry.targeting) })) }))
    : [{ title: 'ROUND 3 ONWARD · ONCE PER MATCH', rows: WILDCARDS.map(entry => ({ id: entry.id, name: entry.name, epithet: entry.targeting === 'NONE' ? 'NO TARGET' : 'CHOOSE A PLAYER' })) }];
  const name = tab === 'chars' ? character.name : tab === 'items' ? item.name : tab === 'contracts' ? contract.name : wildcard.name;
  const description = tab === 'items' ? ITEM_HELP[item.id] ?? '' : tab === 'contracts' ? OBJECTIVE_HELP[contract.id] ?? '' : tab === 'wildcards' ? wildcard.description : '';
  const contingency = contract.contingency?.response === 'KILL_KILLER_THEN_EXIT' ? 'If your target is killed, kill their killer, then leave.' : contract.contingency ? 'If your target is killed by someone else, kill their killer.' + (contract.id === 'executioner' ? ' If your target leaves, you fail.' : '') : undefined;
  const shopStock = items.filter(entry => entry.basePrice !== null && (character.id === 'tallyman' ? ['COMMON', 'UNCOMMON', 'RARE'].includes(entry.rarity) : !['ARTIFACT', 'QUEST'].includes(entry.rarity)));
  return <section className="reference-handbook" aria-label="Handbook">
    <header className="handbook-header"><h2>Handbook</h2><div className="handbook-tabs" role="tablist" aria-label="Handbook sections">{HANDBOOK_TABS.map(([id, label]) => <button id={'handbook-tab-' + id} key={id} type="button" role="tab" aria-selected={tab === id} aria-controls="handbook-panel" tabIndex={tab === id ? 0 : -1} onKeyDown={event => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); const index = HANDBOOK_TABS.findIndex(([value]) => value === tab); const next = event.key === 'Home' ? 0 : event.key === 'End' ? 3 : (index + (event.key === 'ArrowRight' ? 1 : 3)) % 4; const nextTab = HANDBOOK_TABS[next]![0]; setTab(nextTab); document.getElementById('handbook-tab-' + nextTab)?.focus(); }} onClick={() => setTab(id)}>{label}</button>)}</div>{onClose && <button className="handbook-close" type="button" onClick={onClose}><kbd>ESC</kbd> BACK TO MENU</button>}</header>
    <div id="handbook-panel" className="handbook-body" role="tabpanel" aria-labelledby={'handbook-tab-' + tab}>
      <nav className="handbook-catalog" aria-label={tab === 'chars' ? 'Characters' : tab}>{groups.map(group => <section className="handbook-group" key={group.title}><h3>{group.title}</h3><div className="handbook-items">{group.rows.map(row => <button key={row.id} type="button" aria-pressed={selected === row.id} className={selected === row.id ? 'selected' : ''} onClick={() => setSelections(previous => ({ ...previous, [tab]: row.id }))}>{tab === 'items' ? <ReferenceItemArt itemId={row.id} size={44} /> : tab === 'chars' ? <HandbookCharacterThumbnail roleId={row.id} tint={CHARS.find(entry => entry.id === row.id)!.tint} /> : <HandbookModel kind={tab} modelId={row.id} name={row.name} description={tab === 'contracts' ? OBJECTIVE_HELP[row.id] ?? '' : ''} thumbnail />}<span className="handbook-row-copy"><strong>{row.name}</strong><small>{row.epithet}</small></span></button>)}</div></section>)}</nav>
      <HandbookModel key={tab + selected} kind={tab} modelId={selected} name={name} description={description} tint={character.tint} />
      {tab === 'chars' ? <article className="handbook-case-file" aria-label={character.name + ' case file'}>
        <div className="handbook-file-body">{characterSeal && <img className="handbook-seal" src={characterSeal} alt={`${character.stamp} Table seal`} />}<div className="handbook-case-heading"><p>{character.group === 'AT THE TABLE' ? 'ROLE' : character.group === 'TUTORIAL' ? 'TUTORIAL' : 'SHOPKEEPER'} · {character.epithet}</p><h3>{character.name}</h3></div>
          <dl className="handbook-case-fields">{character.fields.map(([key, value]) => <div key={key}><dt>{key}</dt><dd><Redacted value={value!} /></dd></div>)}</dl>
          <section><h4>CASE NOTES</h4>{character.lore.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</section>
          <section className="handbook-behaviour"><h4>OBSERVED BEHAVIOUR</h4><p>{character.behaviour}</p></section>
          {role && <><section className="handbook-ability"><h4>PERMITTED ABILITY <span>{character.uses}</span></h4><h5>{role.ability.name}</h5><p>{roleCopy?.ability ?? character.abilityText}</p></section><section><h4>ISSUED ON ARRIVAL <CoinAmount amount={role.startingCoins} /></h4><ul className="handbook-starting-kit">{role.startingItems.map(id => <li key={id}><ReferenceItemArt itemId={id} size={32} />{itemName(id)}</li>)}</ul></section></>}
          {character.group === 'BEHIND THE COUNTER' && <section><h4>{character.id === 'fence' ? 'BLACK MARKET STOCK · BASE + 1' : 'PUBLIC SHOP STOCK'}</h4><ul className="handbook-stock">{shopStock.map(entry => <li key={entry.id}><span>{entry.name}</span><CoinAmount amount={entry.basePrice! + (character.id === 'fence' ? 1 : 0)} /></li>)}</ul></section>}
        </div>
      </article> : <article className="handbook-description" aria-live="polite"><header><p className="handbook-kind">{tab === 'items' ? 'ITEM · ' + itemCategory(item) : tab === 'contracts' ? 'CONTRACT · ' + contract.mode : 'WILDCARD · ROUND 3+'}</p><h3>{name}</h3><p className="item-rarity">{tab === 'items' ? item.rarity : tab === 'contracts' ? 'Unlocks Round ' + contract.unlockRound + ' · ' + targetLabel(contract.targeting).toLowerCase() : 'Draw from the centre deck · Use or Burn'}</p></header><p>{description}</p>{tab === 'contracts' && contingency && <section className="handbook-contingency"><h4>CONTINGENCY</h4><p>{contingency}</p></section>}<dl>{tab === 'items' ? <><div><dt>PRICE</dt><dd>{item.basePrice === null ? 'UNSELLABLE' : <CoinAmount amount={item.basePrice} />}</dd></div><div><dt>USE</dt><dd>{item.consumption === 'ONE_USE' ? 'ONE-USE' : item.consumption === 'REUSABLE' ? 'REUSABLE' : 'EQUIPMENT'}</dd></div></> : tab === 'contracts' ? <><div><dt>TARGETS</dt><dd>{targetLabel(contract.targeting)}</dd></div><div><dt>UNLOCKS</dt><dd>Round {contract.unlockRound}</dd></div></> : <><div><dt>TARGET</dt><dd>{wildcard.targeting === 'NONE' ? 'None' : wildcard.targeting === 'POCKET' ? 'Choose a Pocket' : wildcard.targeting === 'VISIBLE_ITEM' || wildcard.targeting === 'EXCHANGE' ? 'Choose a visible item' : 'Choose a player'}</dd></div><div><dt>IF BURNED</dt><dd>Discarded face-down. Nobody sees it.</dd></div></>}</dl></article>}
    </div>
  </section>;
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
