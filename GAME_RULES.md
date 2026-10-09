# The Table — Canonical v14 Rules

Canonical target for the post-closed-beta v14 implementation. The approved `the_table_v14_post_beta_revision_no_experimental_items.md` supersedes conflicting v13 wording. Preserve the tested early-game baseline and all unchanged combat, item, Role, reward, scoring, and secrecy rules. No experimental items are included. Track implementation and verification in `audit/V14_IMPLEMENTATION.md`; this rules reference is the intended contract, not a claim that all gates have passed.

## Match and turns

- Three or four unique players and unique Roles; four players is the primary balance target. No production two-player mode, scoring, or objective variants.
- Fixed seat order for the entire match. A round ends after every living active player receives one normal turn opportunity; then Intermission runs.
- A normal turn lasts 60 seconds and allows exactly one Primary Action plus unlimited Free Actions. Timeout skips the Primary Action.
- Trade and Threat pause the acting timer and give the target a separate 30-second response timer.
- Free Actions are global voice, global or one-recipient private text, and information review. Living players, including Downed players, may use them at any time, including during responses and Intermission. Spectators cannot communicate.
- Primary Actions are item use on self/table, Trade or Threat, or an item/action toward another player.

## Objectives, exits, and score

- Each player receives one secret objective, independent of Role and unique within a match.
- States are `ACTIVE`, `EXIT_READY`, `BANKED`, or `FAILED`. `BANKED` and `FAILED` count as resolved. For forced match closure, the all-objectives condition is reached when no assigned objective remains `ACTIVE`; living `EXIT_READY` players are then auto-banked.
- Historical/action objectives latch once completed. Escapist, Collector, Tycoon, and Arsenal are sustained and must still be true when Leave Table is chosen.
- First readiness grants 3 Coins; contingency readiness grants 2. The reward cannot repeat.
- Leave Table first becomes available on the player's next normal turn after readiness. Choosing to stay defers the chance to their next normal turn. A chosen exit is final.
- A successful exit or qualifying death-objective resolution reveals the objective. An ordinary failed death does not reveal that objective to living players; verified spectators still receive god view. A ready player who later dies scores zero unless their objective explicitly banks through death.
- The match ends when one active player remains or no assigned objective remains `ACTIVE`. Exit-ready living players forced out by either condition auto-bank by completion timestamp, then seat order.
- Exit scores: 4P `100/70/45/25`; 3P `100/65/35`. Death/unresolved/concede is zero. Contingency gets 80%, nearest whole number.
- Recompute viability after irreversible changes. Permanently impossible contracts become `FAILED` exactly once, with an owner-private reason. Temporary scarcity, Downed targets, or lost sustained requirements do not cause failure. Failure status/reasons stay private to the owner and verified spectators; ordinary public events must not disclose `OBJECTIVE_FAILED`. Public objective information remains the existing completed/not-completed flag until a permitted reveal.
- Executioner fails when the original target exits; qualifying killer contingencies remain. Guardian succeeds if its target exits or survives through Round 4, with the existing qualifying killer contingency. Kingmaker fails if its target fails/concedes or permanently cannot succeed without a defined contingency. Martyr fails when someone else is first permanent death.
- For Extortionist, Duelist, Savior, Graverobber, Poisoner, and Merchant, completed distinct targets plus remaining distinct unqualified living targets must still be able to reach two. Downed targets remain potentially available. Betrayer tracks every completed Trade partner and fails only when neither an existing partner nor a new legal partner can ever satisfy the contract. Do not fail item/chest objectives for temporary item distribution or cooldowns.
- On their own normal turn, an active player with a `FAILED` contract may Concede or keep playing. Concede ends their turn, scores zero, and makes them a read-only Spectator. It does not reveal the objective to living players or create attacker loot. Ordinary inventory leaves play; Artifacts and Passage Token return normally.

## Objective assignment

- Never assign an impossible objective. At most two target-specific objectives in 4P and one death-as-success objective per match.
- Guardian and Kingmaker cannot target Martyr/death-objective players. Reroll excessive Role/objective shortcuts.
- Merchant requires two distinct Trade partners. Objective assignment has no two-player exceptions.
- The authoritative deck contains: Escapist, Collector, Tycoon, Executioner, Guardian, Kingmaker, Martyr, Phoenix, Betrayer, Extortionist, Con Artist, Duelist, Savior, Graverobber, Poisoner, Chest Raider, Merchant, Hidden Hand, Survivor, Arsenal.

## Roles

- Enforcer: Pistol, Bullet, Cloth, 2 Coins. Quick Draw once per match is a modifier inside a legal Pistol action, not a second action.
- Medic: Medicine, Antidote, Knife, 3 Coins. Passive Field Dressing revives another player to 3 HP instead of 2. Self-revive remains 2 HP.
- Smuggler: Cloth, Bag, Poison, 4 Coins. Passive Private Stock gives four private Black Market offers instead of three.
- Locksmith: Key, Lockpick, Knife, 3 Coins. Tumbler Sense is a Free Action once per complete Round: privately learn whether Standard Chest contains an Artifact and whether it contains a Rare regular item, never exact contents.
- Broker: Spyglass, Handcuffs, Knife, 5 Coins. Passive Margin gives resale +1 Coin, capped at base price minus one.
- Scavenger: Knife, Medicine, Crowbar, 3 Coins. Passive Salvage grants 1 Coin once per Intermission when forced capacity discard/replacement occurs.

## Secret initial setup

- Assign kits and private objectives. Exactly one random player receives one private bonus from Knife, Poison, Spyglass, Handcuffs, Medicine, Key, Cloth, or Bullet.
- Every player locks one eligible starting item into the default Pocket; the bonus recipient may choose the bonus or a normal kit item. Starting inventories stay hidden from other players until all choices resolve, then reveal together.
- Start Round 1 directly. There is no pre-round shop or Intermission 0.

## Inventory and hidden information

- Six visible slots, one default Pocket, Coins outside inventory. Bullets stack to three per slot.
- Public sees Pocket occupancy only. A placed item is locked until used, stolen, destroyed, or otherwise removed. Refill empty Pockets only during Intermission.
- Pocket items cannot be traded or demanded. Owners may use legal Pocket items. Bag, Safe, and Armor must remain visible and cannot be Pocketed.
- Visible Bag grants a second Pocket. Losing Bag ejects its Pocket item to visible inventory and may trigger overflow.
- Acquisition beyond visible capacity starts a 15-second choice: discard incoming or replace one visible item. Removed Artifacts/Passage Token return to their defined pools; ordinary items leave play.

## Items

- Max HP 5. Knife costs 4, is one-use, adjacent only, and deals 2 direct damage.
- Pistol costs 7, is reusable, targets any living non-Downed player, consumes one Bullet per 3 direct damage shot unless Quick Draw is spent.
- Bullet costs 2 and stacks to three. Poison costs 4 and deals 1 at the start of the next three living owner turns. Antidote costs 3 and removes it.
- Medicine costs 4, heals 2 HP up to max, or revives to 2 HP. Armor costs 5, visibly blocks one entire Knife/Pistol hit, then is consumed; it does not block Poison.
- Cloth costs 2 and is consumed by a covered Threat. Bag 5; Safe 4; Spyglass 4; Pickpocket 4; Key 3; Lockpick 5; Crowbar 6; Black Key 7; Handcuffs 5.
- Safe visibly protects one Pocket from Pickpocket and Spyglass/Glass Eye. Spyglass privately reveals exact contents of a chosen unprotected Pocket. Pickpocket steals from a chosen unprotected Pocket and fails harmlessly otherwise.
- Key/Lockpick are one-use Standard Chest access. Crowbar is reusable Standard access but destroys one random loot slot. Black Key is one-use Black Chest access.
- Handcuffs prevents the target initiating Trade or Threat on their next normal turn only.
- Brass Idol rerolls one personal Black Market option once per Intermission. Glass Eye gives a private weapon yes/no for one unprotected Pocket once per round. Red Ledger discounts one Public Shop purchase by 1 once per Intermission.
- Passage Token is a persistent quest object. Artifacts and Passage Token cannot be sold and return to their pools if removed from active possession.
- Counterfeit Coin is removed. The prototype Extra Pocket is replaced by Bag.

## Trade and Threat

- Both consume the actor's Primary Action and exclude Downed or disconnected targets.
- Trade may offer/request any visible items and Coins, including a zero offer. Only explicit Accept transfers assets atomically. After 30 seconds, Trade expires as Decline, transfers nothing, releases locks, and reports `Trade expired — declined`. Disconnect still cancels.
- Threat demands visible items/Coins. Open mode presents a valid visible weapon. Covered mode consumes one Cloth and commits exactly one visible item, weapon or bluff.
- Target Comply/Refuse timeout defaults to Comply. Demanded assets lock. Comply transfers assets without attack. Covered items are always revealed after resolution.
- Refuse attacks only if the committed weapon is legal against that target. Knife requires adjacency. Pistol requires Bullet or unused Quick Draw. Knife is consumed on attack; Pistol consumes ammo/Quick Draw. Comply consumes neither weapon nor ammo.

## Combat, Downed, and death

- At 0 HP, immediately become Downed; damage stops at zero. Downed players cannot be damaged, newly Poisoned, traded with, threatened, or normally targeted.
- Aggressor may immediately loot one visible item for free. Every other living player's normal turn within the rescue window may include one extra Downed Interaction: loot one visible item or use an appropriate revive/help item.
- On the Downed player's turn, they may self-revive with Medicine, consuming that turn; otherwise no normal action.
- Pocketed Medicine is usable. Off-turn UI distinguishes waiting with Medicine from no Medicine; on-turn UI offers revive to 2 HP or Pass Downed Turn. Downed players retain chat, public information, event log, turn order, own inventory/Pockets/objective and handbook access, but cannot shop or take ordinary hostile/Primary Actions.
- The rescue window ends immediately before the original aggressor's next normal turn. If still Downed, the target permanently dies before the aggressor acts. Intermission can occur inside the window.
- Existing Poison pauses while Downed without damage or tick consumption and resumes on the next living normal turn after revive.
- On permanent death, ordinary inventory leaves play; Artifacts and Passage Token return to their pools.

## Chests and markets

- Standard Chest appears in Round 1 with two hidden slots. Opening slot A is 60% Common / 40% Uncommon; slot B is 50% 2 Coins / 35% Common / 15% Uncommon. No Rare, Artifact, Special/Black Key, or Quest in the opening chest. Unopened contents persist. Opening consumes a Primary Action; later refreshes use the normal table starting next round.
- Black Chest appears at Round 3, persists unopened, and refreshes two rounds after opening.
- Every Intermission begins with a full Public Shop refresh and fresh private Black Markets. Living non-Downed players may sell any number of visible eligible items, buy at most one Public item, and buy at most one Black Market item.
- First shopper is random among living non-Downed players; direction coin chooses ascending/descending seats, skipping inactive/Downed seats.
- Resale is `max(1, floor(base/2))`; Broker adds one capped at base minus one. Black Market price is base plus one.
- Public Shop: four slots. Slot one is support/utility; slot two interaction/combat; remaining rarity is 50% Common, 40% Uncommon, 10% Rare with duplicate avoidance.
- Black Market: three private offers, four for Smuggler; Common 15%, Uncommon 50%, Rare 30%, Special 5%, no exact duplicate, one purchase.
- Guarantee an obtainable Black Key by end of Round 3 when Escapist or Chest Raider is present.

## Pipelined Intermission

- Refresh markets and reveal the Public order once, with a concise 2–3 second die/coin presentation. Order stays visible; presentation does not create extra rule timers.
- Simultaneous preparation: `INTERMISSION_PREP_MS = 15_000`. Every eligible connected living non-Downed player may inspect Public stock, sell old eligible visible items, fill empty eligible Pockets, and use Free Actions. Private markets stay locked.
- Public decisions: `PUBLIC_SHOP_DECISION_MS = 15_000` per eligible shopper, in the drawn order. Buy at most one Public item or Pass; timeout is Pass.
- Resolving a Public decision immediately unlocks that owner's private market and advances Public purchasing to the next shopper. Private buying, selling, and Pocket management proceed concurrently and never block the Public queue.
- Each eligible player can buy at most one private item and choose Finish Intermission after their Public decision. After the final Public decision, `PRIVATE_MARKET_GRACE_MS = 20_000`; finish early if everyone is done, otherwise timeout passes unfinished private choices and begins the next round. Timing values are centralized prototype configuration, not a normal-turn rebalance.
- Sell old eligible visible items at any point before finishing, including after buying. Any item acquired in the current Intermission is ineligible for resale until the next Intermission. Artifacts and Passage Token remain unsellable; resale prices are unchanged.
- New purchases may fill empty Pockets; locked contents cannot be voluntarily swapped. One legal destination places immediately; multiple destinations require an explicit choice.
- Disconnected eligible players automatically pass/finish so they cannot block the queue; reconnection does not grant a second Public opportunity.

## Communication, projection, and reconnect

- Public: Role, HP, Coins, visible inventory, Pocket occupancy, statuses, generic objective-complete flag, round/order/active player/timers/shop/chest state/event log.
- Owner-private: objective/progress, Pocket contents, Black Market, private messages and inspections.
- Spectators see all objectives, Pockets, chests, Black Markets, statuses, and timers, but cannot send communications or gameplay input.
- Connected timeout defaults are Trade Decline, Threat Comply, turn skip, Public Shop Pass, and private grace finish. Disconnect cancels pending interactions targeting that player, prevents new targets, and lets their turns expire. Reconnect restores the same seat and authorized state.
- Failure reasons, hidden usable ammunition, ability state, private market offers, and private inspection details are owner-private. Progress is server-derived and rendered using player names, never opaque IDs. Concede does not disclose a failed contract.
- Chat recipient and draft persist for the match across closing, phase changes and Trade/Threat interruptions. A private draft never silently becomes Global. Response controls, exact assets, timer and timeout default stay readable while compact Chat is open.
