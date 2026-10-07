# Deterministic lifecycle browser acceptance

## Implemented scope

The local Playwright suite now owns a fresh real `createTableServer()` per test inside the Playwright worker. `apps/server/test/browser-harness.ts` injects the existing `RoomStoreAdapter` seed callback and runtime `Clock`; no production file, client UI, gameplay rule, root package manifest, or lockfile changed for this work. The old `browser-e2e.md` lifecycle/fake-clock limitations are superseded by this report.

Seed `5424` assigns Executioner to seat 0 (target seat 1), Collector to seat 1, and Tycoon to seat 2. Ordinary Enforcer, Smuggler, and Locksmith role kits are used. There is no fixture mutation of HP, objective, inventory, life state, score, or phase. Room/player/session IDs remain securely generated; the assertions use seats and admitted identities, not random IDs.

`qa/e2e/lifecycle.spec.ts` drives the actual UI through admission, role selection, ready/start, two Pistol shots (second using Quick Draw), normal turns, and shopping. The rescue window crosses Intermission. Permanent death automatically publishes verified spectator god view while two players remain active; no explicit spectate request triggers promotion. Tests verify all objectives, hidden chest loot, empty capabilities, absent gameplay/chat forms, and server rejection of crafted gameplay/chat packets sent through the same browser socket. Active and Downed spectate requests reject.

The host then chooses Leave Table, scoring 100 points. Results verify exact scores, exit order, revealed banked Executioner objective, and failed Collector privacy for the living witness at DOM, received-frame, and storage boundaries. Spectators see the failed objective. Non-host rematch rejects, while the exited spectator host can rematch. All identities, seats, session tokens, and roles survive; readiness, HP, score, life state, and objective state reset. The players ready and start another match through UI controls.

The second scenario advances the injected scheduler to one millisecond before a normal-turn deadline, exactly onto it, then onto it again. It asserts no early transition and exactly one skip. A UI-proposed Trade repeats these boundaries for automatic Accept, including atomic coin movement, cleared proposal, spent Primary Action, and preserved/resumed turn time. No sync command or browser event wakes the deadline. Results also have no gameplay deadline left to fire.

## Isolation and operation

- Local E2E uses dedicated ports `4173` (Vite) and `3101` (server); `E2E_WEB_URL` and `E2E_SERVER_URL` override them. Vite receives the explicit selected port. Existing servers are not reused.
- `qa/e2e/fixtures.ts` is an automatic test fixture, so existing lobby/reconnect/privacy/mobile smoke tests use the same isolated server lifetime. Teardown closes rooms/sockets and checks that scheduled tasks and runtime errors are absent.
- Clock advances execute due callbacks in chronological order, yielding one event-loop turn for queued server work and rescheduling. There are no wall-clock sleeps or native game timers. Browser Date is fixed for lifecycle views; it never controls server state.
- The clock is callable only from the Node test process. It is not serialized into application code, exposed via HTTP/Socket.IO, enabled by production environment variables, or imported by the production entrypoint. The server build includes `src` only.
- Browser authorization probes are an init-script helper in `qa/e2e/browser-wire.ts`, wrapping the browser’s native WebSocket only in these tests. Gameplay and lifecycle progress use the application controls; probes only attempt commands those controls correctly hide.
- One worker is required for the fixed local server port. `E2E_EXTERNAL_SERVER=1` keeps external smoke testing and explicitly skips lifecycle tests, since production cannot inject time.

## Validation

Run the full browser gate with `pnpm test:e2e`; run only the new scenarios with `pnpm exec playwright test qa/e2e/lifecycle.spec.ts`.

Run `pnpm --filter @the-table/server test`, `pnpm typecheck`, and `pnpm exec tsc -p qa/e2e/tsconfig.json --noEmit`. The standalone E2E config obtains Node types from the server package’s existing dependency, so it needs no root manifest or lock change. Three server harness tests verify the seed, actual scheduled publication without a command wake-up, and callback rescheduling/cancellation/monotonicity.

Final results on 2026-10-06:

- Full Playwright gate: **6 passed**, including both new lifecycle scenarios (37.4 seconds).
- Server suite: **42 passed** across 5 files, including 3 new harness tests.
- Full workspace `pnpm typecheck`: **passed**.
- Standalone E2E `tsc -p qa/e2e/tsconfig.json --noEmit`: **passed**.
- `git diff --check`: **passed**.

Initial browser runs exposed two test locator mismatches (target option name and requested Coins label); both were corrected against the existing UI. No product fix was needed.

## Remaining scope

Deployed multi-device validation remains a release check. This coverage does not expand the current gameplay rules, production client, or deployment topology, and does not claim exhaustive 4P objectives or every timeout type at browser level; those retain engine/server coverage.
