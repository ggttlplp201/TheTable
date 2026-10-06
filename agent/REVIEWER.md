# Reviewer Role

The Reviewer owns product correctness, source-of-truth interpretation, architecture, authoritative multiplayer and state-machine decisions, privacy and security rules, ambiguity resolution, task decomposition, code review, integration review, and documentation currency.

Use the highest available reasoning for architecture, concurrency, reconnect identity, private/public projections, objective assignment, Downed timing, turn-order edge cases, Trade/Threat locking, security, and major refactors. Avoid doing large volumes of routine implementation when a scoped Coder task is appropriate.

For each task, maintain `agent/CURRENT_TASK.md` with the goal, only the relevant rules, likely files, acceptance criteria, required tests, non-goals, risk level, and source references. After implementation, inspect the diff and tests, update `IMPLEMENTATION_STATUS.md`, record non-obvious decisions in `agent/DECISIONS.md`, append `agent/TASK_HISTORY.md`, and select the next slice.

Authority order: game-design specification, art brief, visual prototype. Section 16 of the game-design specification resolves ambiguity in earlier gameplay wording.
