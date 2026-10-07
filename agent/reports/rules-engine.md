# Rules engine handoff

## Result and scope

Implemented the deterministic game core in `packages/game` and integrated the authoritative `@the-table/content` package. No server, web, content, visual, or shared documentation files were edited by this task; this report is its documentation boundary.

Source authority: `/Users/leon/Downloads/multiplayer_game_design_core_v13.docx`, especially sections 2–11 and 16; `GAME_RULES.md`, `CONTENT_SCHEMA.md`, `ARCHITECTURE.md`, and `agent/REVIEWER.md`. The full DOCX was read because the concise rules did not contain every objective predicate and contained an objective-reveal discrepancy.

Implemented:

- Exact six Role starting kits, visible equipment effects, unique Roles, seeded objective/target assignment, player-count exclusions, death-objective cap, target cap, Guardian/Kingmaker death-target exclusion, and impossible Kingmaker → Executioner → Kingmaker dependency avoidance.
- All twenty objective predicates, event-based progress, targets and one-step contingencies, unlock rounds, latched/sustained readiness, once-only rewards, next-turn exit eligibility, explicit Stay, death failure, forced banking, scoring, and same-tick completion-time/seat ordering.
- Fixed seats, round/Intermission/Results transitions, 60-second turn deadlines, paused turns and 30-second response deadlines, 15-second overflow decisions, reconnect cancellation, and disconnected-shopper skipping.
- Inventory ownership, Bullet stacking, locked Pockets, visible Bag/Safe/Armor, Safe assignment, Bag loss/ejection, atomic item transfers, overflow replacement/discard, and Artifact/Passage Token returns.
- All normal item effects, visible/Open and covered Threats, zero-offer Trades, ammo/Quick Draw, Armor, Poison, Medicine/Medic healing, Antidote, Handcuffs, information inspection, theft, chest access, immediate attacker loot, and extra Downed rescue/help/loot.
- Distinct Down events and fixed-seat rescue expiry, including Intermission within the window, departed aggressors, self-revival consuming the turn, and paused Poison resuming only at the next living turn.
- Seeded shops, shopper order/direction, both purchase limits, resale, role/artifact market benefits, chest persistence/refresh/distributions, and a Black Key opportunity guarantee.
- Allowlisted public/owner views, verified dead/exited spectator view with no action capabilities, private inspections/markets/overflow decisions, and privacy of ordinary failed-death objectives.
- Post-transition invariants covering ownership, stacks, coins, HP/life, equipment/Pockets, objective uniqueness, pool conservation, and phase/timer consistency.

## Stable integration contract

All exports are available through `@the-table/game`.

```ts
applyCommand(room, actorId, command: GameCommand, now): RoomState
startMatch(room, { seed, now }): RoomState
applyTimeout(room, now): RoomState
getNextDeadline(room): number | undefined
setConnection(room, playerId, 'CONNECTED' | 'DISCONNECTED', now): RoomState
resetMatch(room, now): RoomState
transition(room, command: GameCommand & { actorId: string }, now): RoomState
projectPublicRoom(room): PublicRoomView
projectPrivatePlayer(player, room?): PlayerPrivateView
projectAuthorizedRoom(room, requesterId): AuthorizedRoomView
projectSpectatorRoom(room, requesterId): SpectatorView
assertRoomInvariants(room): void
```

Commands clone input and return the new state only after legality and invariants succeed. A rejection leaves the input unchanged and throws `GameError` with a typed code. Server-provided time must be finite and monotonic. An early timeout is an identity/no-revision operation. The server owns authentication, command serialization, idempotency, transport validation, and seed secrecy; gameplay does not read wall-clock time or ambient randomness.

`RoomStoreOptions.issueSessions: false` lets the server use its own session registry without accumulating unused lobby tokens. Existing lobby APIs remain compatible. `CLAIM_ROLE` preserves `ROLE_TAKEN` and `ROLE_UNKNOWN` errors; `READY` and `SET_READY` are aliases.

`DOWNED_INTERACTION` supports `LOOT`, `REVIVE`, and `HELP`. HELP accepts Medicine or Antidote; Antidote cures paused Poison without reviving or consuming the normal Primary Action. The server owner updated the strict parser accordingly.

Spectator player entries are `{ public, private }` allowlists; full chest/market contents are also included. The requester must already be DEAD or EXITED. Spectators have an empty capability list; this does not bypass server-side input rejection.

## Decisions and resolved ambiguities

1. **All-objective forced closure — explicit hub ruling:** a match closes when no objective remains ACTIVE. BANKED/FAILED are resolved, and remaining living EXIT_READY players are automatically banked by completion timestamp and seat. This reconciles section 16's otherwise contradictory instruction about EXIT_READY players at all-objective resolution. Exposed waiting turns remain while any objective is ACTIVE.
2. **Disconnected shoppers — explicit hub ruling:** skip the current or queued disconnected shopper without making a purchase/transfer and without inventing an Intermission timer. A preexisting overflow retains its existing 15-second deadline; a new round begins after that outstanding choice resolves.
3. **Artifact circulation — explicit hub ruling:** one circulating instance per Artifact type, and a singleton Passage Token. Held/chest/overflow Artifacts are excluded from the available pool; return them when removed from possession. When the Artifact pool is exhausted, generation renormalizes the remaining specified chest outcomes rather than inventing substitute loot.
4. **Objective reveal — source-confirmed and hub-approved:** ordinary failed-death objectives remain hidden from living players. v13 section 2 permits reveal only on successful exit or qualifying death-objective resolution. The concise rules' broader wording needs correction by the hub.
5. **Rescue scheduling:** fixed seat positions remain meaningful after an aggressor exits/dies, so their departure cannot create an immortal Downed target. Rescue expiry is checked immediately before that position would next receive a normal turn.
6. **Sustained restoration:** loss locks readiness, but restoration retains the original once-only reward, first readiness timestamp, and initial waiting threshold. A Primary Action still declines that turn's exit opportunity.
7. **Three-player assignment:** at most one assigned-target objective implements the source's instruction to allow these cautiously. No Role kit instantly satisfies an objective, so no additional arbitrary Role exclusions were introduced.
8. **Within-rarity selection:** uniform among eligible definitions; the source provides rarity weights and emphasizes the Black Market's rarer categories but supplies no numeric per-item weights. Exact duplicates are prevented per offer set.
9. **Seat adjacency:** circular adjacency uses the fixed match seats; dead/exited seats are not compressed into new combat neighbors.

## Verification

Final combined command:

```sh
node node_modules/vitest/vitest.mjs run packages/game/src apps/server/test
```

**91 tests passed across 6 files**: 52 game tests and 39 server tests. Server integration tests are owned by the realtime task; this task ran them against the finished game changes.

Also passed:

```sh
node node_modules/typescript/bin/tsc -p packages/game/tsconfig.json --noEmit
node node_modules/typescript/bin/tsc -p packages/game/tsconfig.json
git diff --check -- packages/game
```

Coverage includes all Role kits and objective predicates, 1,500 seeded assignment cases, 60 deterministic 2P/3P/4P replay simulations with invariant checks on each transition, timer defaults/locks, both specified Downed schedules, poison/revival, dead aggressors, objective contingencies, same-tick scoring, forced all-ready closure, disconnect/reconnect, inventory overflow, private-state sentinel checks, and spectator gating.

The ordinary-death reveal assertion and Kingmaker/Executioner dependency regression were included in the final run. No unresolved engine test/typecheck/build failure remains. Visual behavior, UI coverage of every command, network persistence, deployment, and balance tuning remain with their respective task owners.
