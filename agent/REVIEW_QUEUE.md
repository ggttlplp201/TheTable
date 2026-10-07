# Review Queue

## QA-004 — complete gameplay browser surface and multi-device E2E are pending

**Evidence:** The deterministic engine and real Socket.IO adapter now cover commands, deadlines, ownership, projections, idempotency, and reconnects. The current React client implements admission/lobby/reconnect plus a read-only match shell, but not every gameplay command, chat, market, overflow, spectator detail, or Results control.

**Impact:** Engine/server acceptance is executable, but full desktop/mobile playability and browser-visible privacy need Playwright coverage after the command surfaces land. The remaining gates are recorded in `qa/TEST_MATRIX.md`.

Known prototype mismatches are resolved by the game-design specification and tracked in `GAME_RULES.md` and `agent/DECISIONS.md`.
