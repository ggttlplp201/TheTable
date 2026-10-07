# Deterministic QA matrix

This matrix is the executable-spec backlog for The Table. Test scenarios use a seeded random source and injected absolute clock/deadline scheduler; no test may rely on wall-clock sleeps, unspecified item order, or a browser's local time.

## Current runnable lobby contract

`apps/server/test/lobby.integration.spec.ts` is a passing Socket.IO integration suite using an ephemeral `createTableServer()` per test. It covers 2P/3P/4P joins, capacity, competing role claims, reconnect rotation, stale-socket revocation, and private-chat delivery leakage.

| Area | Deterministic scenario | Required assertion | Current status |
| --- | --- | --- | --- |
| 2P / 3P / 4P | Create, then join exactly `n - 1` isolated client connections. | Seats are `0..n-1`, each published revision is monotonic, no client's private identity is reused. | Passing |
| Capacity | Join five named clients to one code. | Fifth acknowledgement is `ROOM_FULL`; revision/player count remain four. | Passing |
| Reconnect | Disconnect/reconnect one client with its current token, then retry the consumed token. | Same player and seat; new token; old token rejects; stale socket has no command or disconnect authority. | Passing |
| Single-socket identity | Create/join Room A, then create/join Room B from the same socket and disconnect. | The prior room is explicitly left and marked disconnected (or the second admission is rejected); only one room/player identity is active per socket. | Passing; second admission is rejected |
| Role ownership | Two clients concurrently claim the same role. | Exactly one succeeds; loser receives `ROLE_TAKEN`; one revision/one owner. | Passing |
| Projection | Give every private field a distinct sentinel and serialize every event and acknowledgement per client. | Public/other-owner views exclude objective, pocket content, Black Market, private chat and inspection data. | Passing for owner/public/spectator projections and chat |

## Future state-machine contract

| Risk | Deterministic setup | Required assertions | Current status |
| --- | --- | --- | --- |
| Turn timeout | Inject deadline `t=60000`; advance fake clock to `59999`, then `60000`; invoke scheduler twice. | No mutation before deadline; exactly one skip/revision after; duplicate wake-up is idempotent. | Passing |
| Trade timeout | Lock actor offer/request, pause actor deadline, set target response deadline `t=30000`, advance once. | Defaults to accept; transfer is atomic; locks release; actor timer resumes with preserved remaining time. | Passing |
| Threat timeout | Cover with Cloth and commit item; target disconnects at deadline. | Connected timeout complies; disconnect cancels; committed item/ammunition follow the final rules; no dangling lock. | Passing |
| Atomicity | Force invalid second leg of a trade/threat transfer (capacity, stale revision, disconnected target). | No coins or item instance moves; no event/partial revision; all locks release or remain coherent. | Passing |
| Ownership | Generate inventories with unique instance IDs, then run acquire/trade/steal/discard/death transitions. | Every instance exists in exactly one legal location; stack amounts obey caps; discarded artifacts/token return to their pools. | Passing through transition invariants |
| Downed timing | Down a player immediately before aggressor's next turn, cross an Intermission, revive on final legal turn. | One free loot then rescue window; poison pauses while downed; death occurs immediately before aggressor acts only if still downed. | Passing for both specified seat schedules |
| 2P / 3P / 4P simulations | Seed and replay full rounds with scripted legal commands/timeouts. | Fixed seats, every living player receives one normal opportunity/round, unique compatible objectives/roles, no invariant violation. | Passing: 60 replay simulations plus 1,500 assignment cases |
| Idempotency | Submit each mutating command twice with same command id and stale expected revision. | Same stored outcome for duplicate; stale revision cannot replay effects. | Passing across reconnect and altered-payload conflicts |

## Browser and mobile E2E gate

`pnpm test:e2e` runs Playwright against the local server and Vite client with independent browser contexts: one desktop (`1440x900`) and one touch phone (`390x844`). The runnable suite does not sleep for wall-clock deadlines or share browser storage between identities.

1. Desktop creates, phone joins, both claim distinct roles, ready, start, and complete a Trade/Accept interaction. **Passing.**
2. A replacement phone context reconnects from its persisted token, receives a rotated token, retains its seat, and revokes the abandoned page. Concurrent same-token restores caused by React effect replay are coalesced into one request so the one-use credential cannot be consumed twice by one page. **Passing.**
3. The phone has no horizontal overflow and all entry/lobby primary controls meet the 56px target. **Passing.** Normal-turn skip and Trade auto-Accept now run through the injected scheduler in Playwright, with assertions at deadline minus 1 ms, the exact deadline, and a duplicate advance. **Passing.**
4. Distinct private objective sentinels are checked against opposite-player DOM, received Socket.IO `room:view` frames, and saved browser storage. **Passing.**
5. Three isolated browser contexts (including a touch phone) play seed `5424`: two Pistol shots, Downed rescue window across Intermission, permanent death, automatic read-only spectator promotion while the match continues, a 100-point Executioner exit, Results, host rematch, and a second start. **Passing.**
6. Active/Downed spectator probes reject; DEAD gameplay/chat probes reject; spectators receive all objectives and chest loot with empty capabilities. A living Results viewer receives the banked objective while the failed Collector objective stays absent from DOM, socket frames, and storage. A non-host rematch rejects, and an exited spectator host can rematch. **Passing.**

## Harness and remaining release checks

- `qa/e2e/fixtures.ts` creates and closes a real Socket.IO server for each test, using `apps/server/test/browser-harness.ts` for seed and clock injection. The Playwright process owns clock control; no HTTP/socket test route or production seam exists. Default local ports are web `4173` and server `3101`; one worker is required.
- Typecheck E2E with `pnpm exec tsc -p qa/e2e/tsconfig.json --noEmit` in addition to `pnpm typecheck`. The test config reuses the server package’s existing Node types; no root dependency is needed.
- `E2E_EXTERNAL_SERVER=1` retains the existing external smoke mode and explicitly skips the two lifecycle tests, since deployed servers cannot accept fake-clock control. It is not the full local lifecycle gate.
- Run deployed multi-device checks against the chosen single-owner hosting topology before release.
