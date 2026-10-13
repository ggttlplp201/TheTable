# Full UI beta recorder

Run from the repository root. This recorder launches four headed, isolated Playwright browser contexts. Gameplay uses only real production controls via mouse/keyboard and accessible controls discovered by each player. It has no application imports, socket probes, hidden-state reads, direct commands, seeded scenarios or clock manipulation. The normal production server must already be running at `BETA_URL` (default `http://127.0.0.1:4317`).

Start: `node qa/full-ui/recorder.mjs`. Coordinator starts a new recording with POST `http://127.0.0.1:4318/admin/start` and JSON `{"match":1}`. Match directories cannot be overwritten. Each player uses only their own assigned letter and `node qa/full-ui/client.mjs LETTER observe`. This returns their screenshot path and accessibility text. Use the image viewer on that player's screenshot to inspect the actual first-person view.

Input: `node qa/full-ui/client.mjs LETTER action JSON`. Allowed input objects:

- `{"type":"click","x":100,"y":100}`
- `{"type":"move","x":100,"y":100}`
- `{"type":"drag","x":100,"y":100,"toX":400,"toY":150,"button":"left"}`
- `{"type":"wheel","dy":400,"dx":0}`
- `{"type":"type","text":"..."}` (focused UI field)
- `{"type":"key","key":"Escape"}`
- `{"type":"role","role":"button","name":"EXACT NAME OBSERVED IN YOUR UI"}`; optional `nth` for repeated controls; `operation:"fill"` or `operation:"select"` and `value` for textbox/select.

These are input-device instructions, not game-control selectors. Discover all game controls yourself. No arbitrary JavaScript, URLs, HTTP requests to the game, app internals, console, or other players' session information is available through this interface. Never inspect another player's screenshots/files. All social communication must happen inside the game chat. Coordinator logistics may carry the public room code and recording readiness only.

Record a private observation with `note` and JSON fields such as `{"event":"camera","severity":"P2","observation":"...","expected":"...","screenshot":"..."}`. Notes and all observations/inputs have wall-clock and video offsets. Submit all 32 interview answers independently using `feedback` with `{"markdown":"..."}`, or `feedback-file PATH` (a file you wrote containing only your own experience). Feedback comes before other players' secret information is exposed.

Coordinator finishes after all four interviews: POST `/admin/finish` with `{"outcome":"completed|blocked|interrupted","reason":"..."}`. This closes contexts and finalizes four WebM files, replay.json and metrics.json. The replay is a timestamped UI observation/input replay plus actual videos, not an engine-state replay. Video offsets are measured from context creation, with subsecond encoder-startup uncertainty. Screenshot coverage should be marked observed/not encountered, never staged through state injection. Recorder infrastructure may be changed between runs; the production game build remains frozen.

## Finalized evidence reports

After all four interviews are submitted and recording is finalized, run `node qa/full-ui/report.mjs`. Use `--match 1` (repeatable) to select specific finalized packages, or `--root PATH` for a separate evidence root. The index/coverage files represent only the packages selected by that invocation. No report generation is permitted until all four feedback files exist, each contains 32 nonempty uniquely numbered sections, and replay/video/screenshot validation passes. Failed validation writes diagnostics and leaves existing Markdown reports untouched; consult validation.json before relying on old reports.

For a safe batch refresh after observer review, use `node qa/full-ui/report.mjs --aggregate` (optionally `--root PATH`). This regenerates **only root** `validation.json`, `coverage.json`, and `index.md` across every directory with a finalized `replay.json`. It preserves every per-match artifact, including reviewed summaries, issues, timelines, observer reviews, and per-match validation files. The refreshed root validation is authoritative for this invocation. `--aggregate` cannot be combined with `--match`; explicit per-match generation keeps the behavior above and can overwrite generated match reports.

Aggregate mode skips directories without `replay.json` without reading their evidence, and lists those omissions. Replay candidates still require all four complete interviews before their replay is read. Invalid candidates are listed with validation errors and unassessed coverage where applicable; the command exits unsuccessfully, but refreshes batch diagnostics and the index without generating findings. No finalized packages is also a validation failure. Existing report links may predate the current validation; missing reports remain missing.

The helper creates per-match `match-summary.md`, `timeline.md`, `ui-issues.md`, and `validation.json`, plus root `index.md`, `coverage.json`, and `validation.json`. These are evidence reports; the observer still writes final findings and the fast-beta comparison. Notes remain player-reported, with proposed severity and requested outcome preserved. Matched screenshot observation timestamps/video offsets take precedence over later note submission times. `ffprobe`, when installed, checks video duration; otherwise validation warns that duration was not checked.

Coverage uses exact normalized note event labels: `opening-table-view`, `first-turn`, `first-item-use`, `first-trade`, `first-threat`, `covered-threat`, `chest-interaction`, `public-shop`, `black-market`, `pocket-interaction`, `downed-state`, `objective-completion`, `exit-ready`, `exit`, and `result-screen`. Common labels such as `trade`, `threat`, `shop`, `pocket`, and `downed` are also recognized. Observed means a label has a matching screenshot observation and still needs semantic review; player-reported means a label lacks that link; not encountered means no matching labeled evidence was recorded, not proof of absence. No UI-text guessing is used.

`node qa/full-ui/report.mjs --self-test` creates and removes only synthetic temporary fixtures, without reading beta evidence or connecting to the game.

## Compact client output

Add `--brief` to any player command to print metadata (including screenshot path, timestamp, and video offset) followed by readable accessibility text. Example: `node qa/full-ui/client.mjs a observe --brief`. Default output remains unchanged JSON.

Optional `--brief --log-lines 12` keeps the latest twelve top-level entries inside explicit ARIA `log` blocks, including each retained entry’s nested details. Other UI content is preserved. Trimming is labeled and happens only in client display; recorder screenshots, text, events, and videos remain complete. If the accessibility tree uses a heading or generic region instead of the `log` role, its text is deliberately not trimmed. Optional `--brief --event-lines 12` separately keeps the last twelve rendered entries in lists explicitly identified as Event Log history by a named list, dialog/region, or heading, including the observed `EVENT LOG · PUBLIC` heading inside Table chat. It preserves whole retained entry subtrees, other lists, controls, metadata, and the compact Open event log button summary. Unknown or mixed list structures remain untrimmed. Both flags accept zero and can be combined; neither changes the request or recorded evidence. Use untrimmed output to inspect earlier history. `node qa/full-ui/client.mjs --self-test` uses only synthetic in-memory responses and no connection files or server.

## Future recorder variant (not running)

`recorder-next.mjs` is an unstarted copy of the existing recorder with one change: action exceptions append an `input-failed` event linked to the preceding input timestamp/video offset. The event distinguishes input-dispatch exceptions from failures while capturing the later observation. Neither implies a game-side rejection; partial input may have occurred. The original exception still returns to the caller. This variant has only syntax/static synthetic checks, not a live match test. Do not start it alongside the current recorder; it shares the same port, connection files, and output root. Adoption requires a clean between-match recorder boundary. `recorder.mjs` and the game are unchanged.

### Proposed feedback-before-spectator gate

For a future recorder, add a reversible per-player observation hold, armed before any explicit action that can enter spectator mode. While held, continue recording full raw video and observations into quarantined evidence, but return only an explicit “observations withheld pending interviews” notice and timestamp—no screenshot path, accessibility text, or latest-file shortcut. Pause that player’s further gameplay inputs while accepting their private notes and feedback. Record hold/release events; do not delete or rewrite evidence. Release spectator observations only after all four complete interviews have been collected and sealed.

A delivery gate must run before results reach the player agent. Matching terminal/spectator words in text that has already been delivered is too late. UI-only recording has no reliable advance signal for asynchronous elimination or automatic spectator transitions, so a manually armed hold before an explicit exit cannot guarantee uncontaminated interviews. A guaranteed approach needs a trustworthy UI-level pre-reveal boundary; absent that, withhold observations before the potentially revealing interval and collect interviews, or honestly mark any already-exposed interview as potentially contaminated. Do not silently omit that limitation or change the game mid-batch. This section is a proposal only; no gate is enabled by either recorder file.


## Recovery-aware recorder

`node qa/full-ui/recorder-robust.mjs` starts a fresh recorder after the previous recorder has stopped. It preserves the UI-only client protocol and interview disclosure guard. It records per-player raw video paths and original start times in `recording.json`, closes all four contexts concurrently, checkpoints per-player close/save stages in `finalization.json`, and reuses one finish promise so retries/signals cannot append duplicate end events. Player requests close when finalization starts. The original recording-end event defines replay/metrics duration; video flushing time is separate. All four sealed interviews are required for outcome `completed`.

A stalled browser can still stall closure. Read `admin/status` or `finalization.json`; this implementation deliberately does not kill processes or claim completion on a timeout. Raw videos, source events, and checkpoints remain available for explicit recovery. `node qa/full-ui/finalize-players.mjs --self-test` tests the parallel close/save boundary with synthetic sessions, including a stalled first close and a failed close. Match 003's actual recovery is documented in its `recovery.md`/`recovery.json`.
