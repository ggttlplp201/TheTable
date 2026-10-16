import { useRef, useState, type UIEvent } from 'react';
import { GAME_CONSTANTS } from '@the-table/content';

const CHAPTERS = [
  ['goal', 'Goal'], ['turns', 'Turns'], ['deals', 'Trade & threats'],
  ['survival', 'Combat & Downed'], ['intermission', 'Shopping'], ['wildcards', 'Wildcards'], ['chests', 'Chests'],
  ['leaving', 'Exit & score'], ['conduct', 'Chat & spectators'],
] as const;
type ChapterId = typeof CHAPTERS[number][0];

const seconds = (milliseconds: number) => Math.round(milliseconds / 1000);

export function HowToPlay({ onTutorial }: { onTutorial?: () => void } = {}) {
  const scroll = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<ChapterId>(CHAPTERS[0][0]);
  const go = (id: string) => {
    setActive(id as ChapterId);
    scroll.current?.querySelector<HTMLElement>(`#rules-${id}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };
  const track = (event: UIEvent<HTMLDivElement>) => {
    const container = event.currentTarget;
    let current: ChapterId = CHAPTERS[0][0];
    for (const [id] of CHAPTERS) {
      const section = container.querySelector<HTMLElement>(`#rules-${id}`);
      if (section && section.offsetTop <= container.scrollTop + 110) current = id;
    }
    setActive(current);
  };

  return <section className="how-to-play" aria-label="How to play The Table">
    <nav className="rules-nav" aria-label="How to play chapters">
      <header><strong>How to Play</strong></header>
      {CHAPTERS.map(([id, label], index) => <button type="button" key={id} className={active === id ? 'selected' : ''} aria-current={active === id ? 'page' : undefined} onClick={() => go(id)}><span>{String(index + 1).padStart(2, '0')}</span>{label}</button>)}
      <p><b>3–4</b> players<br /><b>{seconds(GAME_CONSTANTS.normalTurnMs)} sec</b> per turn</p>
    </nav>

    <div className="rules-scroll" ref={scroll} onScroll={track} tabIndex={0}>
      <header className="rules-hero">{onTutorial && <button type="button" onClick={onTutorial}>PLAY TUTORIAL WITH THE DEALER</button>}
        <ol aria-label="The game in four steps"><li><b>1</b><span>Read your private objective</span></li><li><b>2</b><span>Use items, trade, or threaten</span></li><li><b>3</b><span>Complete your contract</span></li><li><b>4</b><span>Leave before the others</span></li></ol>
      </header>

      <article className="rules-chapter" id="rules-goal">
        <h2>Your goal</h2>
        <p>Complete your <strong>secret objective</strong>. Leave on your next normal turn. Until then, you can still be attacked or robbed.</p>
        <p>Role = starting items and ability. Contract = objective.</p>
      </article>

      <article className="rules-chapter" id="rules-turns">
        <h2>Turns & rounds</h2>
        <p>Before Round 1, Pocket one eligible item. One random player gets a bonus. Inventories reveal together.</p>
        <p>Each active player gets one turn per Round, in seat order.</p>
        <div className="rules-turn-layout"><div><strong className="rules-big-number">{seconds(GAME_CONSTANTS.normalTurnMs)}</strong><span>seconds per turn</span></div><div><h3>Choose one action</h3><ul><li><b>Use Item</b></li><li><b>Trade</b></li><li><b>Threaten</b></li><li><b>Draw Wildcard</b> — once per match, from Round {GAME_CONSTANTS.wildcardUnlockRound}</li></ul></div></div>
        <p>Actions end your turn. <strong>Pass Turn</strong> or <strong>Space</strong> passes. Timeout passes.</p>
        <p>Two Tasks per Round. First completed pays +2 Gold; the other cancels. Both expire at Round end. Press <strong>J</strong>.</p>
        <p className="rules-note"><strong>Free:</strong> talk, message, inspect, read, and use abilities marked Free.</p>
      </article>

      <article className="rules-chapter" id="rules-deals">
        <h2>Trade & threaten</h2>
        <div className="rules-split"><section><h3>Trade</h3><p>Offer/request visible items or Gold. Nothing moves until <strong>Accept</strong>.</p><dl><div><dt>Response</dt><dd>{seconds(GAME_CONSTANTS.interactionResponseMs)} seconds</dd></div><div><dt>Timeout</dt><dd>Decline</dd></div><div><dt>Excluded</dt><dd>Pockets</dd></div></dl></section><section><h3>Threat</h3><p>Demand visible items or Gold. <strong>Comply</strong> transfers them; <strong>Refuse</strong> risks attack.</p><dl><div><dt>Open</dt><dd>Show weapon</dd></div><div><dt>Covered</dt><dd>Weapon or bluff</dd></div><div><dt>Timeout</dt><dd>Comply</dd></div></dl></section></div>
        <p className="rules-note">Knife: adjacent. Pistol: any player + Bullet. Covered items reveal. Downed players are excluded.</p>
      </article>

      <article className="rules-chapter" id="rules-survival">
        <h2>Inventory, combat & being Downed</h2>
        <div className="rules-inventory-line"><span><b>{GAME_CONSTANTS.visibleInventorySlots}</b> visible slots</span><span><b>{GAME_CONSTANTS.defaultPockets}</b> hidden Pocket</span><span><b>{GAME_CONSTANTS.maxHp}</b> starting HP</span></div>
        <p>Visible items are public. Pocket contents are hidden and normally untradable. Bag adds one Pocket.</p>
        <table><thead><tr><th>Danger</th><th>Result</th><th>Counter</th></tr></thead><tbody><tr><td>Knife</td><td>2 damage · adjacent only · one-use</td><td>Armor</td></tr><tr><td>Pistol</td><td>3 damage · any player · spends 1 Bullet</td><td>Armor</td></tr><tr><td>Poison</td><td>1 damage at the start of the next 3 living turns</td><td>Antidote</td></tr></tbody></table>
        <p>Armor blocks one weapon hit, then breaks. Poison bypasses it.</p>
        <h3>At 0 HP</h3><p>You are <strong>Downed</strong>. Attacker loots one visible item. Before their next turn, each other living player may loot or help. On your Downed turn, Medicine revives at 2 HP; otherwise pass. Still Downed when the attacker returns: die.</p>
        <p className="rules-note">Downed: chat and inspect only. No normal actions or shopping.</p>
        <p className="rules-note">Inventory full: within {seconds(GAME_CONSTANTS.acquisitionChoiceMs)} seconds, discard the new item or replace one.</p>
      </article>

      <article className="rules-chapter" id="rules-intermission">
        <h2>Intermission & shopping</h2>
        <p>After each Round, seated living players—including Downed—get <strong>+{GAME_CONSTANTS.roundIncome} Gold</strong>. Die = first shopper. Coin = direction.</p>
        <ol className="rules-flow"><li><b>{seconds(GAME_CONSTANTS.intermissionPrepMs)}s prepare</b><span>Inspect, sell, Pocket, chat.</span></li><li><b>{seconds(GAME_CONSTANTS.publicShopDecisionMs)}s Public</b><span>Buy one or Pass. Timeout passes.</span></li><li><b>Black Market</b><span>Unlocks after your Public choice.</span></li><li><b>{seconds(GAME_CONSTANTS.privateMarketGraceMs)}s grace</b><span>Finish privately. Ends when all finish.</span></li></ol>
        <div className="rules-split"><section><h3>Public</h3><p>Shared stock. Purchases remove offers.</p></section><section><h3>Black Market</h3><p>Private; +1 Gold. Smuggler sees four. Phoenix may get 4-Gold Medicine.</p></section></div>
        <p className="rules-note">Sell old visible items. New purchases wait until next Intermission. Artifacts and Passage Token cannot be sold.</p>
      </article>

      <article className="rules-chapter" id="rules-wildcards">
        <h2>Wildcards · Round {GAME_CONSTANTS.wildcardUnlockRound}</h2>
        <p>From Round {GAME_CONSTANTS.wildcardUnlockRound}, draw <strong>once per match</strong> on your turn. It spends your action.</p>
        <ol className="rules-flow"><li><b>Draw</b><span>Private. Timer runs.</span></li><li><b>Use or Burn</b><span>Use reveals; Burn hides.</span></li><li><b>Resolve now</b><span>Cannot keep or transfer.</span></li></ol>
        <p className="rules-note">Timeout/disconnect burns it. No target still spends it. See <strong>Handbook → Wildcards</strong>.</p>
      </article>

      <article className="rules-chapter" id="rules-chests">
        <h2>Chests</h2>
        <p>Opening spends your action.</p>
        <div className="rules-split"><section><h3>Standard · Round 1</h3><p>Key, Lockpick, or reusable Crowbar. Crowbar destroys one reward. Refills next Round.</p></section><section><h3>Black · Round 3</h3><p>Needs Black Key. Better rewards; may hold Passage Token. Refills after two Rounds.</p></section></div>
        <p className="rules-note">Item effects: <strong>Handbook → Items</strong>.</p>
      </article>

      <article className="rules-chapter" id="rules-leaving">
        <h2>Exit & score</h2>
        <p>First completion earns <strong>{GAME_CONSTANTS.readinessRewards.first} Gold</strong>. Contract stays private. Door unlocks next turn; sustained conditions must remain true.</p>
        <p><strong>Leave Table</strong> exits immediately. Earlier = more points. Stay and die = 0.</p>
        <p>Impossible objective = <strong>Failed</strong>. <strong>Concede</strong> on your turn for 0 and spectate.</p>
        <table className="score-table"><thead><tr><th>Exit order</th><th>3 players</th><th>4 players</th></tr></thead><tbody>{[0, 1, 2, 3].map(index => <tr key={index}><td>{index + 1}{index === 0 ? 'st' : index === 1 ? 'nd' : index === 2 ? 'rd' : 'th'}</td><td>{GAME_CONSTANTS.exitScores[3][index] ?? '—'}</td><td>{GAME_CONSTANTS.exitScores[4][index] ?? '—'}</td></tr>)}</tbody></table>
        <p className="rules-note">Death/incomplete: 0. Contingency: 80%, rounded.</p>
      </article>

      <article className="rules-chapter" id="rules-conduct">
        <h2>Chat & spectators</h2>
        <p>Living players: voice, global chat, private messages. Deals are not binding.</p>
        <p>Dead/exited players spectate. They see everything but <strong>cannot communicate or act</strong>.</p>
      </article>
    </div>
  </section>;
}
