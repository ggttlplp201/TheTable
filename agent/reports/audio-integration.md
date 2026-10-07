# Web audio integration report

Integrated `@the-table/audio` into the match shell in `apps/web`.

- One audio engine is owned by the application, survives lobby-to-match/rematch transitions, and is disposed with the application.
- `AudioContext` creation/resume is gated behind the explicit `Enable sound` gesture available before room admission, so a player may authorize the match-start arrival sounds before the match begins.
- Public projected events are forwarded from `room.public.events`; owner-only inspection payloads are matched by event ID and passed only for the current authorized player. Spectators receive no private cue payload.
- The audio package's event receipt window prevents replayed/reconnected projections from repeating cues.
- Room ambience follows normal play, shop ambience follows Intermission, and ambience stops at Results.
- Volume and mute controls use the package's persisted storage state.
- The visual runtime owns the 7.2-second arrival and emits semantic beats to this shared engine. Footstep, chair, and table sounds follow that cadence; the obsolete independent 2.4-second audio notice is no longer used by the web client.
- Accepted owner actions add authorized local detail for item handling, ammunition, Pocket movement, buying/selling, inventory overflow, and lobby controls. Structured public metadata supplies exact weapon/chest-tool cues without parsing text.

Final validation: 70 web tests and 8 audio tests pass within the 194-test workspace gate; typecheck, build, six Playwright scenarios, and both browser smokes pass. The build retains the lazy Three.js chunk-size warning.
