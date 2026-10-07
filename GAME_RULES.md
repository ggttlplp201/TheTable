# The Table Implementation Rules

This is the concise implementation reference derived from `multiplayer_game_design_core_v13.docx`. The source document remains authoritative. Its section 16 controls earlier ambiguous wording.

## Match and turns

- Two to four unique players and unique Roles; four players is the primary balance target.
- Fixed seat order for the entire match. A round ends after every living active player receives one normal turn opportunity; then Intermission runs.
- A normal turn lasts 60 seconds and allows exactly one Primary Action plus unlimited Free Actions. Timeout skips the Primary Action.
- Trade and Threat pause the acting timer and give the target a separate 30-second response timer.
- Free Actions are global voice, global or one-recipient private text, and information review. Living players may use them at any time.
- Primary Actions are item use on self/table, Trade or Threat, or an item/action toward another player.

## Objectives, exits, and score

- Each player receives one secret objective, independent of Role and unique within a match.
- States are `ACTIVE`, `EXIT_READY`, `BANKED`, or `FAILED`. `BANKED` and `FAILED` count as resolved. For forced match closure, the all-objectives condition is reached when no assigned objective remains `ACTIVE`; living `EXIT_READY` players are then auto-banked.
- Historical/action objectives latch once completed. Escapist, Collector, Tycoon, and Arsenal are sustained and must still be true when Leave Table is chosen.
- First readiness grants 3 Coins; contingency readiness grants 2. The reward cannot repeat.
- Leave Table first becomes available on the player's next normal turn after readiness. Choosing to stay defers the chance to their next normal turn. A chosen exit is final.
- A successful exit or qualifying death-objective resolution reveals the objective. An ordinary failed death does not reveal that objective to living players; verified spectators still receive god view. A ready player who later dies scores zero unless their objective explicitly banks through death.
- The match ends when one active player remains or no assigned objective remains `ACTIVE`. Exit-ready living players forced out by either condition auto-bank by completion timestamp, then seat order.
- Exit scores: 4P `100/70/45/25`; 3P `100/65/35`; 2P `100/50`. Death/unresolved is zero. Contingency gets 80%, nearest whole number.

## Objective assignment

- Never assign an impossible objective. At most two target-specific objectives in 4P and one death-as-success objective per match.
- Guardian and Kingmaker cannot target Martyr/death-objective players. Reroll excessive Role/objective shortcuts.
- Two-player exclusions: Guardian, Kingmaker, Duelist, Savior, Graverobber, Poisoner, Extortionist, and any requirement for two distinct other players. Merchant becomes two successful Trades with the opponent in different rounds; Survivor resolves when the opponent exits or permanently dies.
- The authoritative deck contains: Escapist, Collector, Tycoon, Executioner, Guardian, Kingmaker, Martyr, Phoenix, Betrayer, Extortionist, Con Artist, Duelist, Savior, Graverobber, Poisoner, Chest Raider, Merchant, Hidden Hand, Survivor, Arsenal.

## Roles

- Enforcer: Pistol, 1 Bullet, 2 Coins. Quick Draw once per match fires an owned Pistol without a Bullet.
- Medic: Medicine, Antidote, 3 Coins. Medicine revives another player to 3 HP instead of 2.
- Smuggler: Cloth, Bag, 4 Coins. Sees four private Black Market offers instead of three.
- Locksmith: Key, Lockpick, 3 Coins. Once per complete round privately learns whether Standard Chest contains an Artifact and whether it contains a Rare regular item.
- Broker: Spyglass, 6 Coins. Resale +1 Coin, capped at base price minus one.
- Scavenger: Knife, Medicine, 3 Coins. Once per Intermission gains 1 Coin when forced capacity discard/replacement occurs.

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
- Trade may offer/request any visible items and Coins, including a zero offer. Target Accept/Decline timeout defaults to Accept. Selected assets lock; Accept transfers atomically, Decline transfers nothing.
- Threat demands visible items/Coins. Open mode presents a valid visible weapon. Covered mode consumes one Cloth and commits exactly one visible item, weapon or bluff.
- Target Comply/Refuse timeout defaults to Comply. Demanded assets lock. Comply transfers assets without attack. Covered items are always revealed after resolution.
- Refuse attacks only if the committed weapon is legal against that target. Knife requires adjacency. Pistol requires Bullet or unused Quick Draw. Knife is consumed on attack; Pistol consumes ammo/Quick Draw. Comply consumes neither weapon nor ammo.

## Combat, Downed, and death

- At 0 HP, immediately become Downed; damage stops at zero. Downed players cannot be damaged, newly Poisoned, traded with, threatened, or normally targeted.
- Aggressor may immediately loot one visible item for free. Every other living player's normal turn within the rescue window may include one extra Downed Interaction: loot one visible item or use an appropriate revive/help item.
- On the Downed player's turn, they may self-revive with Medicine, consuming that turn; otherwise no normal action.
- The rescue window ends immediately before the original aggressor's next normal turn. If still Downed, the target permanently dies before the aggressor acts. Intermission can occur inside the window.
- Existing Poison pauses while Downed without damage or tick consumption and resumes on the next living normal turn after revive.
- On permanent death, ordinary inventory leaves play; Artifacts and Passage Token return to their pools.

## Chests and markets

- Standard Chest appears at Round 2 with two hidden slots. Unopened contents persist. Opening consumes a Primary Action and makes it unavailable for the round; it refreshes next round.
- Black Chest appears at Round 3, persists unopened, and refreshes two rounds after opening.
- Every Intermission begins with a full Public Shop refresh and fresh private Black Markets. Living non-Downed players may sell any number of visible eligible items, buy at most one Public item, and buy at most one Black Market item.
- First shopper is random among living non-Downed players; direction coin chooses ascending/descending seats, skipping inactive/Downed seats.
- Resale is `max(1, floor(base/2))`; Broker adds one capped at base minus one. Black Market price is base plus one.
- Public Shop: three slots in 2P, four otherwise. Slot one is support/utility; slot two interaction/combat; remaining rarity is 50% Common, 40% Uncommon, 10% Rare with duplicate avoidance.
- Black Market: three private offers, four for Smuggler; Common 15%, Uncommon 50%, Rare 30%, Special 5%, no exact duplicate, one purchase.
- Guarantee an obtainable Black Key by end of Round 3 when Escapist or Chest Raider is present.

## Communication, projection, and reconnect

- Public: Role, HP, Coins, visible inventory, Pocket occupancy, statuses, generic objective-complete flag, round/order/active player/timers/shop/chest state/event log.
- Owner-private: objective/progress, Pocket contents, Black Market, private messages and inspections.
- Spectators see all objectives, Pockets, chests, Black Markets, statuses, and timers, but cannot send communications or gameplay input.
- Connected timeout defaults are Trade Accept, Threat Comply, and turn skip. Disconnect cancels pending interactions targeting that player, prevents new targets, and lets their turns expire. Reconnect restores the same seat and authorized state.
