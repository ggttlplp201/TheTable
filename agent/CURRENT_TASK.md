# Current Task

## Goal

Implement the next vertical slice: authoritative game initialization, role starting kits, compatible secret-objective assignment, and initial per-player projections.

## Relevant rules

- Two to four players and unique roles/objectives.
- Roles and objectives are independent except explicit compatibility/player-count filters.
- Starting kits and coins come only from authoritative v13 content.
- Objectives are private; public state exposes only a generic completion flag.

## Likely files

`packages/game/src/content.ts`, initialization/assignment engine, server start command, and tests.

## Acceptance criteria

- Starting inventory and coin totals exactly match every Role.
- Objective selection respects 2P exclusions, uniqueness, target constraints, and death-objective cap.
- Seeded assignment is deterministic and cannot dead-end valid 2–4 player lobbies.
- Only each owner receives objective identity/progress.

## Tests required

Every Role kit, 2P/3P/4P assignment, uniqueness, target compatibility, and projection leakage.

## Non-goals

Turn resolution, final 3D parity, voice infrastructure, and deployment are later slices.

## Risk

HIGH
