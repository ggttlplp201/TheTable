# Audio package

`@the-table/audio` is a replaceable client-side Web Audio adapter. It owns no gameplay state and never delays or gates server resolution. Call `handleEvent(projectedEvent, selfId)` after authoritative projections; public events produce public cues and private cues require a private payload for that player.

All sound is procedural and temporary. `mappings.ts` is the stable semantic boundary and `synth.ts` may be replaced with decoded assets or another mixer. `createContext` and `storage` are injectable for SSR, tests, and platform policies. `startAmbience('room'|'shop')` and `stopAmbience()` own an idempotent looped procedural noise bed. `dispose()` stops ambience, disconnects the graph, and closes the context. Volume and mute persist under `the-table.audio.volume` and `the-table.audio.muted`.

Event IDs are remembered in a bounded 512-entry receipt window, so reconnect snapshots and replayed projection history do not repeat authoritative cues. Events without IDs remain playable.

`audio.intro` exposes `arm`, `start`, `tick`, and `skip` for the intro sequence. It is presentation-only: authoritative gameplay continues if a player skips, reloads, joins late, or the sequence is interrupted.
