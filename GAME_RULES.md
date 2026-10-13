# The Table — Canonical Rules + ZIP-Priority Mechanics Sync

Canonical target for the post-closed-beta v14 implementation plus `the_table_zip_priority_mechanics_sync_and_test_plan.md`. The latest ZIP remains authoritative for all presentation, art, animation, layout, interaction and audio. The mechanics sync adds Stimulant, restores the canonical decision timers, and adjusts Tasks, Tycoon and Phoenix while preserving the existing v14 and Wildcard rules. Player-facing currency is GOLD; internal `coin`/`coins` identifiers remain stable. This reference defines the intended rules and does not claim that human playtest gates have passed.

The approved `the_table_round_income_wildcard_patch.md` supersedes conflicting v14 economy/Tycoon wording and adds the separate Wildcard system below. Wildcards are table event cards, not experimental inventory items. Verification for this patch is tracked separately in `audit/ROUND_INCOME_WILDCARDS.md`.

## Match and turns

- Three or four unique players and unique Roles; four players is the primary balance target. No production two-player mode, scoring, or objective variants.
- Fixed seat order for the entire match. A round ends after every living active player receives one normal turn opportunity; then Intermission runs.
- A normal turn lasts 60 seconds and allows exactly one Primary Action plus unlimited Free Actions. Timeout skips the Primary Action.
- Trade and Threat pause the acting timer and give the target a separate 30-second response timer.
- Free Actions are global voice, global or one-recipient private text, and information review. Living players, including Downed players, may use them at any time, including during responses and Intermission. Spectators cannot communicate.
- Primary Actions are item use on self/table, Trade or Threat, an item/action toward another player, or drawing a Wildcard when eligible.

- Pass Turn (Space) immediately ends an uncommitted normal turn. It cannot bypass pending responses or a committed Primary Action.
- Resolved Primary Actions advance immediately after required responses and overflow choices. Immediate attacker loot offers a 15-second loot/Skip Loot decision; overflow decisions also allow 15 seconds. Cosmetic animations continue without blocking the next player's controls.

## Private Tasks

- Each Round, every active player receives two distinct private Tasks from the 14-task pool. Both are active; completing either automatically pays 2 Gold once and cancels the other. Unresolved Tasks expire at Round end; Task Gold can help satisfy a sustained objective but Task completion itself is not exit credit.
- Exclude defining objective duplicates and filter current tools/targets. Executioner and Duelist exclude DAMAGE; Extortionist excludes EXTORT; Savior excludes REVIVE; Graverobber excludes LOOT; Chest Raider excludes OPEN A CHEST; Hidden Hand excludes PICKPOCKET/LOOT. Betrayer excludes the required setup TRADE when no viable existing partner remains. Con Artist excludes an unresolved compliant-bluff step, but CALL A BLUFF does not satisfy its own armed-refusal step and remains eligible. Prefer at least one available interaction and different behavior categories. If a depleted table cannot support two immediately plausible jobs, relax plausibility for basic negotiation/resource tasks; telemetry records actual actionability.
- If both Tasks become permanently impossible before the owner's first normal opportunity, replace exactly one at that turn's start, at most once per Round. No manual reroll.
- Trade requires a real transfer; direct damage excludes Poison; HEAL requires at least one normal HP restored to another living player (pure Temporary HP never counts). Revival, visible loot, exact unblocked inspection, successful Pickpocket, Armor destruction, opening a chest, extortion, a compliant bluff, refusing a covered threat without damage, Wildcard Use (not Burn), and receiving 2 Gold in one Trade/Threat qualify for their matching Tasks.
- Only the owner sees identities/progress/cancellation. The public sees `PLAYER COMPLETED A TASK — +2 GOLD`. Verified spectators retain god view. Downed owners can complete reactive tasks; dead/exited/conceded players cannot receive rewards.
- Tasks retain the ZIP's top-right collapsible TASKS tab and approximately 1.5-second completion treatment. Round Income remains 2 Gold.

## Objectives, exits, and score

- Each player receives one secret objective, independent of Role and unique within a match.
- States are `ACTIVE`, `EXIT_READY`, `BANKED`, or `FAILED`. `BANKED` and `FAILED` count as resolved. For forced match closure, the all-objectives condition is reached when no assigned objective remains `ACTIVE`; living `EXIT_READY` players are then auto-banked.
- Historical/action objectives latch once completed. Escapist, Collector, Tycoon, and Arsenal are sustained and must still be true when Leave Table is chosen.
- Tycoon requires holding at least **15 Gold** and completing at least **one successful Trade** during the match. A successful Trade actually transfers an item or Gold; declined, expired and zero-transfer Trades give no credit. Trade credit latches, while falling below 15 Gold removes Exit-Ready. The readiness reward remains once-only, and Leave Table still waits for the next normal turn.
- Phoenix still requires two distinct recoveries from Downed. Its first eligible private Black Market guarantees Medicine at 4 Gold if it owns no Medicine in visible inventory or Pockets. This one-time offer has no markup and need not be purchased. If the player is Downed and has no market, preserve the opportunity until their first eligible market; owning Medicine consumes the guarantee without forcing another copy.
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
- Medicine costs 4, heals 2 normal HP up to max, or revives to 2 HP. It never creates or removes existing Temporary HP. Armor costs 5, visibly blocks one entire Knife/Pistol hit, then is consumed; it does not block Poison.
- Stimulant is a Pocket-eligible, one-use Uncommon Recovery/Defense item costing 5 Gold. Use on self or another living non-Downed player: restore 2 HP, converting healing beyond the normal maximum of 5 into Temporary HP, capped at +2. Reject a use that provides no benefit. It cannot revive. Temporary HP is public, persists across Rounds, absorbs damage before normal HP, and is zero after Downed/revival. Knife/Pistol resolve Armor → Temporary HP → normal HP; Poison resolves Temporary HP → normal HP. Stimulant appears in Public support/Uncommon, Black Market Uncommon and normal Uncommon Chest pools, but never Role kits, the Secret Bonus pool or the tutorial.
- Cloth costs 2 and is consumed by a covered Threat. Bag 5; Safe 4; Spyglass 4; Pickpocket 4; Key 3; Lockpick 5; Crowbar 6; Black Key 7; Handcuffs 5.
- Safe visibly protects one Pocket from Pickpocket and Spyglass/Glass Eye. Spyglass privately reveals exact contents of a chosen unprotected Pocket. Pickpocket steals from a chosen unprotected Pocket and fails harmlessly otherwise.
- Key/Lockpick are one-use Standard Chest access. Crowbar is reusable Standard access but destroys one random loot slot. Black Key is one-use Black Chest access.
- Handcuffs prevents the target initiating Trade or Threat on their next normal turn only.
- Brass Idol rerolls one personal Black Market option once per Intermission. Glass Eye gives a private weapon yes/no for one unprotected Pocket once per round. Red Ledger discounts one Public Shop purchase by 1 once per Intermission.
- Passage Token is a persistent quest object. Artifacts and Passage Token cannot be sold and return to their pools if removed from active possession.
- Counterfeit Coin is removed. The prototype Extra Pocket is replaced by Bag.

## Trade and Threat

- Both consume the actor's Primary Action and exclude Downed or disconnected targets.
- Trade may offer/request any visible items and Gold, including a zero offer. Only explicit Accept transfers assets atomically. After 30 seconds, Trade expires as Decline, transfers nothing, releases locks, and reports `Trade expired — declined`. Disconnect still cancels. A fully empty accepted Trade creates no successful-Trade credit.
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

- At the end of each complete Round, before any Intermission buying or selling, every living player still at the table receives `ROUND_INCOME = 2` Coins automatically. Downed and disconnected living players receive it; dead, exited, conceded, and spectator players do not. Each completed Round pays exactly once; mid-round match closure does not invent a completed Round.
- Feedback is `ROUND N COMPLETE / ROUND INCOME / +2 COINS TO EVERY ACTIVE PLAYER`, followed by the die/coin order reveal. Coin HUDs update immediately. Public log: `Round Income: all active players received 2 Coins.`
- Refresh markets and reveal the Public order once, with a concise 2–3 second die/coin presentation. Order stays visible; presentation does not create extra rule timers.
- Simultaneous preparation: `INTERMISSION_PREP_MS = 10_000`. Every eligible connected living non-Downed player may inspect Public stock, sell old eligible visible items, fill empty eligible Pockets, and use Free Actions. Private markets stay locked.
- Public decisions: `PUBLIC_SHOP_DECISION_MS = 30_000` per eligible shopper, in the drawn order. Buy at most one Public item or Pass; timeout is Pass. Decision time begins after the preserved transition presentation.
- Resolving a Public decision immediately unlocks that owner's private market and advances Public purchasing to the next shopper. Private buying, selling, and Pocket management proceed concurrently and never block the Public queue.
- Each eligible player can buy at most one private item and choose Finish Intermission after their Public decision. After the final Public decision, `PRIVATE_MARKET_GRACE_MS = 30_000`; finish immediately if everyone is done, otherwise timeout passes unfinished private choices and begins the next round. These are anti-stall maxima.
- Sell old eligible visible items at any point before finishing, including after buying. Any item acquired in the current Intermission is ineligible for resale until the next Intermission. Artifacts and Passage Token remain unsellable; resale prices are unchanged.
- New purchases may fill empty Pockets; locked contents cannot be voluntarily swapped. One legal destination places immediately; multiple destinations require an explicit choice.
- Disconnected eligible players automatically pass/finish so they cannot block the queue; reconnection does not grant a second Public opportunity.

## Wildcards

- Ten unique cards are shuffled deterministically at match start and drawn without replacement. The physical deck is absent in Rounds 1–2, enters the center circle at the beginning of Round 3, and stays available thereafter. Do not restore a center-table Pistol.
- Each player has exactly one draw opportunity per match, publicly `AVAILABLE` or `SPENT`. Draw is legal only on the player's own normal turn, while living and not Downed, with an unused Primary Action, from Round 3 onward.
- Draw immediately commits the Primary Action and once-per-match opportunity. Only the owner sees the drawn card. Draw cannot be cancelled, and the card cannot be held for a future turn.
- `USE` irreversibly reveals the card publicly, then opens required target selection and resolves immediately. The used card enters the public discard. `BURN` is available only before Use: it discards face-down with no effect and never discloses its identity to other active clients.
- Wildcards never occupy inventory/Pockets and cannot be traded, Threatened for, stolen, sold, or Safe-protected. Item effects affect visible inventory only unless explicitly stated below. Existing stack-transfer, equipment, overflow, and Artifact/Passage Token return rules apply.
- Table-wide effects include living Downed players still at the table. Targeted hostile cards preserve the normal rule against targeting Downed players. Dead, exited, and conceded seats never participate. Second Chance cannot revive.
- The existing normal-turn deadline continues during the decision. An unresolved private card burns on timeout/disconnect; an already-public target selection expires with no effect. No automatic target is chosen. No-legal-target Use is publicly spent with no effect. These non-stalling defaults add no extra turn time and never refund the draw.

| Card | Authoritative effect |
| --- | --- |
| Seize | Take one transferable visible item from another eligible active player. Artifacts and visible Passage Token transfer normally; overflow applies. |
| Destroy | Discard one visible item from another eligible active player. Ordinary items leave play; Artifacts and Passage Token use normal return rules. |
| Supply Drop | Every living active player receives one random Common/Uncommon normal item; exclude Rare, Artifact, Black Key, Passage Token, Special, and Quest. Resolve each overflow normally. |
| Shatter | Independently select and destroy one random visible item per living active player, including the user. Empty inventories lose nothing; Pockets are excluded. |
| Forced Exchange | Select one transferable visible item from the user and one from another eligible active player; swap atomically, with normal equipment/overflow rules. |
| Search Warrant | Select an occupied Pocket belonging to another eligible active player. Safe blocks it and the card stays spent; otherwise publicly reveal exact contents in the resolution event without moving the item. |
| Windfall | Every living active player, including the user, gains 2 Coins. Stacks with Round Income. |
| Redistribution | Determine the lowest-Coin living active player first, breaking ties with seeded randomness. Every other living active player with at least one Coin pays that recipient one Coin simultaneously. |
| Scramble | Select one random visible item per living active player first, then transfer all selected items simultaneously to the next living active seat clockwise, skipping departed seats. Empty players pass nothing. Transfers themselves do not return Artifacts/Passage Token to pools. |
| Second Chance | Every non-Downed living active player heals one HP, capped at five. Downed players stay Downed; Poison remains. |

- Public events include `ROUND_INCOME_GRANTED`, `WILDCARD_DECK_UNLOCKED`, `WILDCARD_USED`, `WILDCARD_BURNED`, `WILDCARD_TARGET_SELECTED`, and `WILDCARD_RESOLVED`. `WILDCARD_DRAWN_PRIVATE` carries its card identity only in authorized private payloads. Public burned entries contain no card identity.
- Server authority covers deck order, randomness, draw/use/burn, targets, simultaneous effects, overflow, and Coins. Clients never submit a card identity, shuffled order, random seed, or effect amount.
- Owner reconnect restores an unresolved private card. Other active clients cannot inspect it. Existing verified spectator god view may inspect private draw/burn history, but remains read-only; live public projections and logs stay redacted.

## Communication, projection, and reconnect

- Public: Role, HP, Coins, visible inventory, Pocket occupancy, statuses, generic objective-complete flag, round/order/active player/timers/shop/chest state/event log.
- Owner-private: objective/progress, Pocket contents, Black Market, private messages and inspections.
- Spectators see all objectives, Pockets, chests, Black Markets, statuses, and timers, but cannot send communications or gameplay input.
- Connected timeout defaults are Trade Decline, Threat Comply, turn skip, Public Shop Pass, and private grace finish. Disconnect cancels pending interactions targeting that player, prevents new targets, and lets their turns expire. Reconnect restores the same seat and authorized state.
- Failure reasons, hidden usable ammunition, ability state, private market offers, and private inspection details are owner-private. Progress is server-derived and rendered using player names, never opaque IDs. Concede does not disclose a failed contract.
- Chat recipient and draft persist for the match across closing, phase changes and Trade/Threat interruptions. A private draft never silently becomes Global. Response controls, exact assets, timer and timeout default stay readable while compact Chat is open.

## Tutorial vs The Dealer

The local six-chapter tutorial deliberately allows one human and a deterministic Dealer. It uses the production engine, authorized projections, table scene, inventory, Trade/Threat, revival, markets, chest, Contract and Wildcard controls. Production multiplayer still requires 3–4 players.

`mode = tutorial` permits controlled loadouts, an initial in-turn Pocket placement, a Standard-Chest-only training Contract that can complete in Round 2, paused timers, scripted Dealer responses, a Seize draw, and retry checkpoints. These exceptions cannot be selected through multiplayer commands. Tutorial exits carry no competitive score.

First-time training is optional; menu/handbook access, chapter resume, completion/version, and hint opt-out persist locally. The five one-time multiplayer hints concern Pocket secrecy, covered Threats, Downed survival, private markets and Wildcards. Local tutorial telemetry records starts, skips, chapter times, retries, abandonment, completion and replay.
