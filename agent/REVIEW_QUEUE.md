# Review Queue

## QA-004 — complete gameplay browser surface and deterministic lifecycle E2E

**Status:** CLOSED.

**Evidence:** The complete command UI and six-scenario Playwright gate cover desktop/phone admission, reconnect rotation, privacy sentinels, Trade, exact turn/Trade deadlines, permanent death, automatic spectator projection, Results/scoring, and rematch. See `agent/reports/gameplay-ui.md`, `agent/reports/browser-e2e.md`, and `agent/reports/lifecycle-e2e.md`.

## QA-005 — final presentation and voice parity are active

**Evidence:** The production game is locally playable and the audio runtime is integrated, but the current intro does not yet implement the specified first-person walk/chair/settle sequence, the cue/clip map is not exhaustive against the brief, and voice has server signaling without browser media peers.

**Impact:** These are the remaining local Definition-of-Done gaps before deployed Docker validation and a four-device release playtest.

Known prototype mismatches are resolved by the game-design specification and tracked in `GAME_RULES.md` and `agent/DECISIONS.md`.
