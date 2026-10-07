# Audio implementation report

Implemented `@the-table/audio` in `packages/audio` as an isolated, replaceable Web Audio layer.

- Centralized stable cue/event/item mappings cover selection/set-down, weapons, medicine/antidote, trade/threat, chests/shop, turn/response warnings, downed/death/exit/results, doors, footsteps, room ambience, and intro.
- Public cues route from projected event kinds. Private cues require `privatePayloads[selfId]`; the package never infers secrets from public text.
- Procedural oscillator/filter synthesis provides gritty temporary SFX with no external assets.
- Volume/mute are clamped and persisted; context creation, storage, intro controller, and lifecycle are injectable.
- `dispose()` disconnects the master graph, closes the context, and resets intro state.
- Authoritative event IDs are deduplicated in a bounded 512-entry receipt window; receipts clear on disposal. Room/shop ambience has an explicit idempotent loop lifecycle and is stopped during disposal.
- Intro timing is an independent presentation state machine and never gates authoritative commands.

Integration in `apps/web`: create one engine per match shell, call `start()` from the first user gesture, feed each new projected event to `handleEvent(event, localPlayerId)`, start/stop `startAmbience('room'|'shop')` with the current shell, and call `dispose()` on teardown. Use `play(AUDIO_CUE_IDS.uiSelect)` for local interaction feedback and `playItem(itemId)` for inventory selection. Do not use intro completion as a command or render gate.

Validation: run `pnpm --filter @the-table/audio test`, `pnpm --filter @the-table/audio typecheck`, and `pnpm --filter @the-table/audio build`.
