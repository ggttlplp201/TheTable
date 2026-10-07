# Web audio integration report

Integrated `@the-table/audio` into the match shell in `apps/web`.

- Audio engine is created once per mounted match and disposed on match exit, rematch, room close, or unmount.
- `AudioContext` creation/resume is gated behind the explicit `Enable sound` gesture. Event effects remain inert until that gesture.
- Public projected events are forwarded from `room.public.events`; owner-only inspection payloads are matched by event ID and passed only for the current authorized player. Spectators receive no private cue payload.
- The audio package's event receipt window prevents replayed/reconnected projections from repeating cues.
- Room ambience follows normal play, shop ambience follows Intermission, and ambience stops at Results.
- Volume and mute controls use the package's persisted storage state.
- The 2.4s intro starts from the same user gesture, has a visible skip control, and is presentation-only; it does not gate commands, projections, or rematch.

Validation: `pnpm --filter @the-table/web test` (50 tests), typecheck, and build passed; `pnpm --filter @the-table/audio test` (6 tests), typecheck, and build passed. The build retains the existing large Three.js chunk warning. The workspace dependency was added to `apps/web/package.json`; `pnpm-lock.yaml` remains untouched by this task.
