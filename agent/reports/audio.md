# Audio implementation report

Implemented `@the-table/audio` in `packages/audio` as an isolated, replaceable Web Audio layer.

- Centralized stable cue/event/item mappings cover every authoritative engine event, every canonical item, local inventory/coin/Pocket feedback, turn/response warnings, results, footsteps/chair/table movement, and room/shop ambience.
- Public cues route from projected event kinds. Private cues require `privatePayloads[selfId]`; the package never infers secrets from public text.
- Procedural oscillator/filter synthesis provides gritty temporary SFX with no external assets.
- Volume/mute are clamped and persisted; context creation, storage, intro controller, and lifecycle are injectable.
- `dispose()` disconnects the master graph, closes the context, and resets intro state.
- Authoritative event IDs are deduplicated in a bounded 512-entry receipt window; receipts clear on disposal. Room/shop ambience has an explicit idempotent loop lifecycle and is stopped during disposal.
- Intro timing is an independent presentation state machine and never gates authoritative commands.

Integration in `apps/web`: the application owns one engine across entry, lobby, match, Results, and rematch. `start()` is available behind a pre-match user gesture; projected events flow through `handleEvent`, accepted owner actions add authorized local detail, ambience follows phase, and `GameTableScene` arrival beats drive footsteps/chair/table cues. Intro completion remains presentation-only and never gates commands.

Validation: the final gate passed 8 audio tests within 194 workspace tests, full typechecks/builds, and real-browser presentation/gameplay smokes.
