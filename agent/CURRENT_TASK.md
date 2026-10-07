# Current Task

## Goal

Complete the player-facing gameplay vertical slice on top of the verified engine/server foundation: every legal command must have a clear desktop/mobile control, every private/public projection must render at the correct audience boundary, and a representative multiplayer match must be executable through browser automation.

## Relevant rules

- The server projection is the only client-visible authority; never infer hidden or stale state.
- Exactly one Primary Action per normal turn; Free Actions remain available where legal.
- Trade, Threat, overflow, Downed interaction, Intermission, exit, Results, spectator, chat, reconnect, and rematch states need explicit UI.
- Private objectives, Pockets, Black Markets, messages, and inspection results render only for the authorized owner; verified spectators receive god view but no action controls.
- Phone layouts must preserve every action with large targets and no horizontal overflow.

## Likely files

`apps/web`, new `qa/e2e` coverage and Playwright configuration, plus isolated audio/deployment packages and reports. Gameplay legality remains in `packages/game`; transport authority remains in `apps/server`.

## Acceptance criteria

- A 2–4 player match can be played from join through Results/rematch using only browser controls.
- Desktop and 390px phone layouts expose all legal commands without leaking private state.
- Multi-context E2E covers admission, reconnect rotation, one representative turn/interaction, private projection isolation, exit/death/spectator flow, scoring, and rematch.
- Sound mappings are replaceable and audience-aware; deployment remains a single authoritative server owner.

## Tests required

Component/adapter tests for command payloads, Playwright desktop/phone contexts, accessibility checks for primary controls, full workspace tests/typechecks/builds, and privacy sentinels at DOM/network boundaries.

## Non-goals

Changing gameplay rules, introducing distributed room ownership, or tuning prototype balance without playtest evidence.

## Risk

HIGH
