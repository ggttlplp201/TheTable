import { useRef, useState, type UIEvent } from 'react';
import { GAME_CONSTANTS, WILDCARDS } from '@the-table/content';

const CHAPTERS = [
  ['goal', 'Goal & objective'], ['turns', 'Turns & rounds'], ['deals', 'Trade & threats'],
  ['survival', 'Inventory & combat'], ['intermission', 'Intermission'], ['wildcards', 'Wildcards'], ['chests', 'Chests & items'],
  ['leaving', 'Leaving the table'], ['conduct', 'Communication'],
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
        <p>Everyone receives a <strong>secret objective</strong>. Complete yours, then leave the table before the other players do. Finishing an objective does not immediately remove you from danger: <strong>Leave Table becomes available on your next normal turn</strong>, and other players can still rob, attack, or sabotage you until you exit.</p>
        <p>Your <strong>Role</strong> and <strong>Objective</strong> are separate. A Role only determines your starting equipment and a small special ability. Your private contract always states its exact completion condition.</p>
      </article>

      <article className="rules-chapter" id="rules-turns">
        <h2>Turns & rounds</h2>
        <p>Before Round 1, choose one eligible starting item for your default Pocket. One random player privately receives a modest bonus item and may hide it instead. Starting inventories are revealed together once every choice is locked. Shopping begins after the first complete Round.</p>
        <p>Players act in fixed seat order. A Round ends after every active player has received one turn. Every living player still at the table, including Downed players, receives <strong>+{GAME_CONSTANTS.roundIncome} Gold in Round Income</strong> before Intermission shopping begins. Dead, exited, and conceded players receive none.</p>
        <div className="rules-turn-layout"><div><strong className="rules-big-number">{seconds(GAME_CONSTANTS.normalTurnMs)}</strong><span>seconds on your turn</span></div><div><h3>Choose one Primary Action</h3><ul><li><b>Use Item</b> — use an item on a player or table object.</li><li><b>Trade</b> — offer or request visible items and Gold.</li><li><b>Threaten</b> — demand visible items or Gold using a weapon or bluff.</li><li><b>Draw Wildcard</b> — once per match, from Round {GAME_CONSTANTS.wildcardUnlockRound}; use it publicly or burn it privately.</li></ul></div></div>
        <p>Your turn ends automatically when your Primary Action and its required decisions resolve. Use <strong>Pass Turn</strong> or press <strong>Space</strong> to pass before committing an action.</p><p>Each Round you receive two private <strong>Tasks</strong>. Complete either for +2 Gold; the other is cancelled. Unfinished Tasks expire at Round end. Open Tasks with <strong>J</strong>.</p><p className="rules-note"><strong>Free Actions:</strong> talk, message players, review your objective, inspect public information, or read either handbook. These never consume your Primary Action. Locksmith’s Tumbler Sense is also a Free Action once per complete Round; it privately reports whether the Standard Chest holds an Artifact and whether it holds a Rare regular item. If the timer expires first, your turn is skipped.</p>
        <table><thead><tr><th>Role ability</th><th>Action cost</th></tr></thead><tbody><tr><td>Quick Draw</td><td>Pistol action modifier · once per match</td></tr><tr><td>Field Dressing</td><td>Passive</td></tr><tr><td>Private Stock</td><td>Passive</td></tr><tr><td>Tumbler Sense</td><td>Free Action · once per complete Round</td></tr><tr><td>Margin</td><td>Passive</td></tr><tr><td>Salvage</td><td>Passive trigger · once per Intermission</td></tr></tbody></table>
      </article>

      <article className="rules-chapter" id="rules-deals">
        <h2>Trade & threaten</h2>
        <div className="rules-split"><section><h3>Trading</h3><p>A Trade consumes your Primary Action. Offer any number of visible items and Gold; request any number of the other player’s visible items and Gold. Offering nothing is legal. Assets transfer only after an explicit Accept.</p><dl><div><dt>Response</dt><dd>{seconds(GAME_CONSTANTS.interactionResponseMs)} seconds</dd></div><div><dt>No response</dt><dd>Decline automatically</dd></div><div><dt>Never tradable</dt><dd>Pocket items</dd></div></dl></section><section><h3>Threatening</h3><p>Demand visible items and/or Gold. The target may <strong>Comply</strong> to transfer everything safely, or <strong>Refuse</strong> and risk the attack.</p><dl><div><dt>Open</dt><dd>Show a valid weapon</dd></div><div><dt>Covered</dt><dd>Hide a weapon or bluff under Cloth</dd></div><div><dt>No response</dt><dd>Comply automatically</dd></div></dl></section></div>
        <p className="rules-note">Trade timeout = Decline. Threat timeout = Comply. A Knife can only threaten an adjacent player; a covered Knife aimed farther away is a bluff. A Pistol reaches anyone but needs a Bullet. Covered items are always revealed after resolution. Downed players cannot Trade, Threat, or be targeted by either.</p>
      </article>

      <article className="rules-chapter" id="rules-survival">
        <h2>Inventory, combat & being Downed</h2>
        <div className="rules-inventory-line"><span><b>{GAME_CONSTANTS.visibleInventorySlots}</b> visible slots</span><span><b>{GAME_CONSTANTS.defaultPockets}</b> hidden Pocket</span><span><b>{GAME_CONSTANTS.maxHp}</b> starting HP</span></div>
        <p>Everyone sees your visible items. They can see whether a Pocket is occupied, but not what is inside. Pocketed items stay locked there until used, stolen, destroyed, or otherwise removed; they cannot normally be traded or demanded. A Bag grants a second Pocket.</p>
        <table><thead><tr><th>Danger</th><th>Result</th><th>Counter</th></tr></thead><tbody><tr><td>Knife</td><td>2 damage · adjacent only · one-use</td><td>Armor</td></tr><tr><td>Pistol</td><td>3 damage · any player · spends 1 Bullet</td><td>Armor</td></tr><tr><td>Poison</td><td>1 damage at the start of the next 3 living turns</td><td>Antidote</td></tr></tbody></table>
        <p>Armor blocks one complete Knife or Pistol hit, then breaks. It does not protect against Poison.</p>
        <h3>At 0 HP</h3><p>You become <strong>Downed</strong>, not dead. The attacker may immediately loot one visible item. Every other living player gets one optional Downed Interaction on their normal turn before the attacker returns: loot one visible item or use an appropriate item to help. On your own Downed turn, Medicine can self-revive you to 2 HP; otherwise you pass and remain Downed. If you are still Downed, you permanently die <strong>immediately before the original attacker receives their next normal turn</strong>.</p>
        <p className="rules-note"><strong>You stay socially present while Downed.</strong> You may use global voice, global/private text, read Chat and the event log, inspect public information, your own inventory/Pockets and objective, read the handbook, and follow the turn order and rescue deadline. You cannot take an ordinary Primary Action or shop.</p>
        <p className="rules-note">If full inventory receives another item, you have {seconds(GAME_CONSTANTS.acquisitionChoiceMs)} seconds to discard it or replace a visible item.</p>
      </article>

      <article className="rules-chapter" id="rules-intermission">
        <h2>Intermission & shopping</h2>
        <p>After each complete Round, <strong>Round Income pays +{GAME_CONSTANTS.roundIncome} Gold</strong> to every living player still at the table, including Downed players. Then a die chooses the first Public shopper and a coin chooses the seat-order direction. The final order stays visible. Intermission is pipelined so private tasks do not make the whole table wait.</p>
        <ol className="rules-flow"><li><b>{seconds(GAME_CONSTANTS.intermissionPrepMs)}s preparation</b><span>Everyone may inspect stock, sell old eligible items, fill empty Pockets, and chat. Private markets stay locked.</span></li><li><b>{seconds(GAME_CONSTANTS.publicShopDecisionMs)}s Public decisions</b><span>In order, buy at most one Public item or Pass. No choice means Pass.</span></li><li><b>Private markets in parallel</b><span>Your market unlocks as soon as your Public decision resolves while the next player takes theirs.</span></li><li><b>{seconds(GAME_CONSTANTS.privateMarketGraceMs)}s final grace</b><span>After the last Public decision, finish private shopping and Pocket management. The phase ends early if everyone finishes.</span></li></ol>
        <div className="rules-split"><section><h3>Public Shop</h3><p>Everyone sees the same stock. Once bought, an offer disappears for everybody.</p></section><section><h3>Black Market</h3><p>Each player sees different private offers priced one Gold above base. Smugglers receive four choices instead of three. Phoenix receives one private 4-Gold Medicine opportunity in the first eligible Intermission when they do not already own Medicine.</p></section></div>
        <p className="rules-note">You may sell any number of old eligible visible items at any point before you finish, even after buying. An item acquired during this Intermission cannot be sold until the next Intermission. Artifacts and the Passage Token remain unsellable.</p>
      </article>

      <article className="rules-chapter" id="rules-wildcards">
        <h2>Wildcards · Round {GAME_CONSTANTS.wildcardUnlockRound}</h2>
        <p>The ten-card Wildcard Deck appears in the center circle at the start of Round {GAME_CONSTANTS.wildcardUnlockRound}. Each player may draw <strong>once per match</strong>, on their own normal turn while not Downed. Drawing immediately spends your Primary Action and cannot be cancelled. Cards are drawn without replacement.</p>
        <ol className="rules-flow"><li><b>Draw privately</b><span>Only you see your card. Your normal turn timer keeps running.</span></li><li><b>Use or Burn</b><span>Use reveals the card to everyone, then you choose any required targets. Burn discards it face-down with no effect and keeps its identity secret from other active players.</span></li><li><b>Resolve immediately</b><span>You cannot keep a card for later, put it in inventory or a Pocket, trade, steal, sell, or protect it with Safe.</span></li></ol>
        <table><thead><tr><th>Wildcard</th><th>Effect</th></tr></thead><tbody>{WILDCARDS.map(card => <tr key={card.id}><td>{card.name}</td><td>{card.description}</td></tr>)}</tbody></table>
        <p className="rules-note">Item effects target visible inventory only, except Search Warrant: it reveals one occupied Pocket publicly, but Safe blocks it. Targeted cards respect the normal protection against targeting Downed players. Table-wide effects include living Downed players; Second Chance does not revive them or remove Poison. Ordinary overflow and Artifact/Passage Token return rules still apply.</p>
        <p>If your timer expires or you disconnect before choosing, the private card burns. After Use, you cannot undo the public reveal or switch to Burn; an unresolved target choice expires without an effect. A card with no legal target is still spent.</p>
      </article>

      <article className="rules-chapter" id="rules-chests">
        <h2>Chests, artifacts & utility</h2>
        <div className="rules-split"><section><h3>Standard Chest · Round 1</h3><p>The first chest contains only Common or Uncommon items, or 2 Gold. Later refills use the full loot table. Open it with a one-use Key or Lockpick, or a reusable Crowbar that destroys one random reward. Unopened contents persist; an opened Chest refills next Round.</p></section><section><h3>Black Chest · Round 3</h3><p>Requires a one-use Black Key. It holds more valuable rewards and may contain the Passage Token. It refreshes two Rounds after opening.</p></section></div>
        <p>Opening either Chest consumes your Primary Action.</p>
        <table><thead><tr><th>Item</th><th>What it does</th></tr></thead><tbody><tr><td>Medicine</td><td>Heal 2 normal HP or revive to 2 HP; the Medic revives another player to 3 HP.</td></tr><tr><td>Stimulant</td><td>Restore 2 HP; healing above 5 becomes public Temporary HP up to +2. It cannot revive.</td></tr><tr><td>Antidote</td><td>Remove Poison.</td></tr><tr><td>Cloth</td><td>Conceal a visible item during a Threat; consumed afterward.</td></tr><tr><td>Safe</td><td>Protect one Pocket from inspection and theft.</td></tr><tr><td>Spyglass</td><td>Reveal the exact contents of one unprotected Pocket.</td></tr><tr><td>Pickpocket</td><td>Steal from one unprotected Pocket.</td></tr><tr><td>Handcuffs</td><td>Block Trade and Threat on the target’s next normal turn.</td></tr></tbody></table>
        <h3>Artifacts</h3><ul><li><b>Brass Idol</b> — reroll one personal Black Market option once per Intermission.</li><li><b>Glass Eye</b> — once per Round, privately learn whether an unprotected Pocket contains a weapon.</li><li><b>Red Ledger</b> — once per Intermission, discount one Public Shop purchase by 1 Gold.</li></ul><p>Artifacts are reusable, can be traded or stolen, and may be required by objectives.</p>
      </article>

      <article className="rules-chapter" id="rules-leaving">
        <h2>Completing, leaving & scoring</h2>
        <p>First completion grants <strong>{GAME_CONSTANTS.readinessRewards.first} Gold</strong>. Other players only see that you completed an objective; the contract remains private until you leave. <strong>When you complete your objective, Leave Table unlocks at the start of your next normal turn.</strong> Sustained objectives must still be valid when you exit. You may stay when the door opens, but dying later scores zero.</p>
        <p>If irreversible events make your contract permanently impossible, its state becomes <strong>FAILED</strong> and your private contract explains why. Temporary scarcity or a currently Downed target is not failure. On your own normal turn, you may continue interfering with the table or <strong>Concede</strong> for 0 points and become a read-only Spectator. Conceding does not reveal your contract to living players.</p>
        <p>Choosing <strong>Leave Table</strong> exits immediately and cannot be stopped. Earlier exits are worth more.</p>
        <p><strong>Tycoon requires at least 15 Gold and one successful Trade.</strong> The Trade must transfer at least one item or Gold and stays credited afterward. You must still hold 15 or more Gold when you leave. Falling below 15 removes Exit-Ready; the readiness reward is granted only once.</p>
        <table className="score-table"><thead><tr><th>Exit order</th><th>3 players</th><th>4 players</th></tr></thead><tbody>{[0, 1, 2, 3].map(index => <tr key={index}><td>{index + 1}{index === 0 ? 'st' : index === 1 ? 'nd' : index === 2 ? 'rd' : 'th'}</td><td>{GAME_CONSTANTS.exitScores[3][index] ?? '—'}</td><td>{GAME_CONSTANTS.exitScores[4][index] ?? '—'}</td></tr>)}</tbody></table>
        <p className="rules-note">Permanent death or an unresolved objective scores 0. A completed contingency scores 80% of the applicable exit value, rounded to the nearest whole point.</p>
      </article>

      <article className="rules-chapter" id="rules-conduct">
        <h2>Communication & spectators</h2>
        <p>Living players may use global voice, global text, and private text messages at any time. Promises are not binding: lying, bluffing, bargaining, cooperation, threats, betrayals, and temporary alliances are all part of the game.</p>
        <p>Players who permanently die or successfully leave become Spectators. Spectators see objectives, Pocket contents, Chest contents, and Black Markets, but <strong>cannot communicate or interact</strong>.</p>
      </article>
    </div>
  </section>;
}
