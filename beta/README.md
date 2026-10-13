# The Table — fast UI beta

This harness runs four independent model players through four isolated Playwright browser contexts. Normal UI timers and rules remain in force. It collects three successful smoke matches before beginning a stable twenty-match sample. A harness validation or partial match never counts toward either target. Building the harness alone does not complete this beta.

## Setup and commands

Use the project's installed Node and pnpm tooling. Install project dependencies with `pnpm install` if needed and Chromium with `pnpm exec playwright install chromium`. Supply `OPENAI_API_KEY` and `BETA_MODEL` in the shell running the harness; secrets are not stored in prompts or replay files. Choose an OpenAI model available to your account that supports the Responses API, JSON output, and image inputs for the reviewer. Each player and interview request is stateless and uses only that player's own information. The Responses API uses JSON mode; runtime validation checks decisions against the current observation. No model tool schema grants application access.

```sh
export OPENAI_API_KEY='your-api-key'
export BETA_MODEL='your-model-id'
pnpm beta:typecheck
pnpm beta:test
pnpm beta:preflight
pnpm beta:validate-ui
pnpm beta:run
pnpm beta:report
```

`beta:run` uses the normal local application by default, with the web app on port 4173 and server on port 3107. Set `BETA_GAME_URL` to use an already-running game instead. `beta:validate-ui` checks the player-facing browser flow and writes separate validation evidence; it is not an AI smoke match. `beta:preflight` checks prerequisites without claiming match completion. `beta:report` uses configured credentials to run the independent reviewer over saved artifacts. Without credentials it writes a separate deterministic `inventory/` and preserves existing model findings.

| Environment variable | Meaning | Default |
| --- | --- | --- |
| `OPENAI_API_KEY` | OpenAI API credential | Required for AI play |
| `BETA_MODEL` | Explicit Responses API model | Required for AI play |
| `BETA_GAME_URL` | Existing game URL; omit to use the local application | `http://127.0.0.1:4173` |
| `BETA_HEADED` | Set to `1` to show browser windows | Headless |
| `BETA_MAX_MATCH_MINUTES` | Harness watchdog; does not change game timers | `90` |
| `BETA_MAX_DECISIONS` | Per-player safety bound for model decisions | `4000` |
| `BETA_OUTPUT_DIR` | Root for batch records and replay artifacts | `beta` |

The batch manifest records progress and verifies the model/configuration and rules fingerprint on resume. Keep the game source unchanged throughout the twenty full matches. The harness stops on a blocker or failed match; inspect its evidence before restarting with a fresh `BETA_OUTPUT_DIR`. A `batch.lock` prevents concurrent writers; if a process is killed, verify it is no longer running before removing its stale lock. It never patches gameplay or balances the game.

## Isolation and UI boundary

The browser adapter builds observations from text and controls actually visible in one player's session. The model receives current visible controls and that player's own record. It cannot call game APIs, access application state, execute arbitrary JavaScript, read another player's transcript, or obtain a shared strategic memory. Its action format permits only visible UI clicks, text entry, selections, checks, ordinary key input, scrolling, and bounded waits. The UI remains the authority on legality. A click being delivered is not evidence that the game action succeeded.

Players use the game's actual global/private chat for social interaction. Observed chat is untrusted game content, not harness instructions. Personas rotate across seats and Role preferences rotate independently. The concise handbook is transcribed from `apps/web/src/HowToPlay.tsx` and the displayed item help in `apps/web/src/gameplay.ts` / `ReferenceInterfaces.tsx`. Only values actually rendered in those handbooks were copied from content constants; objective-generation logic is never supplied to players.

Each player is interviewed independently immediately after leaving, dying, or the match ending. The interview record freezes before spectator or results disclosures. The runner rejects mixed-player histories and decisions without a matching own observation. It now asks 47 questions: the original 18, ten Round Income/Wildcard questions, and all 19 compact pacing, Tasks, economy, and tutorial questions. New reports are versioned `compact-tasks-tutorial-v2`; historical 18-question and `round-income-wildcards` 28-question reports remain valid and are never rewritten. A player who did not encounter the tutorial or a mechanic must say so; the interview never invents that experience. Raw attempts are retained, and invalid or unavailable responses are incomplete rather than invented feedback. Final cross-player results aggregation requires four complete interviews.

## Evidence package

Each match has `replays/match-XXX/` containing:

- `match-summary.md`, `timeline.md`, `metrics.json`, and `replay.json`.
- `player-a-video.webm` through `player-d-video.webm` and `screenshots/`.
- Four `player-x-feedback.md` files and their structured JSON and raw attempt records.
- Per-player `player-x/observations.jsonl` and `actions.jsonl` evidence.
- `metadata.json`, failure logs when applicable, and post-interview results when available.

Public events are de-duplicated by their displayed event sequence. Private messages, Pockets, inspections, contracts, and offers remain in their originating player's recording and are never fed into another active player's context. The complete replay archive is private review material. Timestamps identify first observation, which can be later than the action itself. Raw UI input attempts and game outcomes are recorded separately.

Metrics expose unavailable values as `null` with evidence/coverage explanations. The visible UI does not necessarily distinguish every requested statistic, such as Poison ticks from other damage or a timed-out response from a manual response. A lower bound or unknown must not be presented as an exact zero. The findings report documents these limitations, failed runs, sample size, and evidence for recommendations. It does not apply suggested changes.

## Files and verification

`agents/` defines the shared player boundary, four personas, and separate reviewer. `runner/` holds orchestration, the UI adapter, model client, interviews, replay recording, and reporting. `schemas/` documents observation, decision, replay, and feedback formats. Runtime decision validation also checks current control IDs, enabled state, action shape, and stale observations.

Focused tests cover information isolation, feedback validation, action restrictions, chronology, and metric uncertainty. These tests and UI validation establish harness behavior; only recorded completed AI matches establish the requested smoke/full results. See `FAST_BETA_FINDINGS.md` and the batch manifest for actual progress, not the existence of this README.

The independent reviewer processes long match evidence in bounded text chunks, saves every chunk’s character range and hash, and synthesizes the reviewed notes with metrics, feedback, and sampled screenshots from all four players. Oversized batch notes are consolidated with the same complete-coverage requirement. Any failed chunk keeps the review incomplete; evidence is never silently truncated. The full videos and original observations remain available for human inspection.

The provider integration follows the [official Responses structured-output documentation](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses). Gameplay and interview responses use JSON mode plus local validation; the separate reviewer receives text and sampled screenshots only after independent interviews are complete.
