# Review Queue

## QA-004 — complete gameplay browser surface and deterministic lifecycle E2E

**Status:** CLOSED.

**Evidence:** The complete command UI and six-scenario Playwright gate cover desktop/phone admission, reconnect rotation, privacy sentinels, Trade, exact turn/Trade deadlines, permanent death, automatic spectator projection, Results/scoring, and rematch. See `agent/reports/gameplay-ui.md`, `agent/reports/browser-e2e.md`, and `agent/reports/lifecycle-e2e.md`.

## QA-005 — final presentation and voice parity

**Status:** CLOSED.

**Evidence:** The 7.2-second assigned-seat arrival, rematch/skip policy, structured public clips, exhaustive semantic audio map, synchronized arrival sounds, accepted local-action cues, and authenticated opt-in WebRTC voice are implemented. Privacy, reduced-motion, teardown, TURN credential gating, and real-browser behavior are covered by unit/integration/smoke tests. See `agent/reports/presentation.md`, `agent/reports/audio-coverage.md`, `agent/reports/voice.md`, and `agent/reports/final-integration.md`.

## QA-006 — deployed release validation

**Status:** BLOCKED ON EXTERNAL RELEASE INPUTS.

**Evidence:** Static packaging validation passes, but Docker/Compose are unavailable on this machine and no public HTTPS hosting target or TURN credentials were supplied. The image smoke and four-independent-device deployed playtest therefore remain the final release gate.

Known prototype mismatches are resolved by the game-design specification and tracked in `GAME_RULES.md` and `agent/DECISIONS.md`.
