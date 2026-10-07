# Decisions

## D001 Repository location

- Decision: Build in `/Users/leon/Library/Mobile Documents/com~apple~CloudDocs/Development/the table`.
- Reason: The user explicitly corrected the production directory. The earlier Documents path is retained only as a compatibility symlink for the cached Codex project entry.
- Affected systems: all repository files and tooling.
- Source: current session workspace context and the user's instruction to distinguish attached-document instructions from the request.

## D002 Production shape

- Decision: Use a TypeScript workspace with a React/Vite client, a long-running Node realtime server, Socket.IO transport, and a framework-independent deterministic game package.
- Reason: The game requires bidirectional room state, server-owned timers, reconnect recovery, and testable rules. A long-running server avoids relying on serverless WebSocket behavior.
- Affected systems: client, server, protocol, deployment, tests.
- Source: server-authoritative and reconnect requirements.

## D003 Prototype isolation

- Decision: Preserve the supplied 3D geometry, materials, shaders, cameras, and animation clips in a visual-reference area, but do not import prototype `ITEMS` data as gameplay content.
- Reason: Prototype prices, types, effects, and items conflict with the final specification.
- Affected systems: content, renderer, HUD, handbook.
- Source: source-of-truth hierarchy.

## D004 Removed content

- Decision: Counterfeit Coin and Extra Pocket are excluded. The production item is Bag, which grants one additional Pocket while visibly held.
- Reason: v13 explicitly removes Counterfeit Coin and defines Bag.
- Affected systems: content, shops, icons, objectives, inventory.
- Source: game specification section 16 and item handbook.

## D005 Intermission disconnect safety

- Decision: If the active shopper disconnects, finish that shopping opportunity without a purchase or transfer and advance the queue. Previously disconnected shoppers are skipped when reached. No new Intermission timer is introduced.
- Reason: The source defines normal-turn and response timeout behavior but no shopping deadline; waiting until room expiry would deadlock the live match.
- Affected systems: game engine, realtime scheduler, reconnect behavior.
- Source: section 16 disconnect safety plus hub production-safety interpretation.

## D006 Artifact circulation

- Decision: Brass Idol, Glass Eye, and Red Ledger each have one circulating instance; Passage Token is also singleton. Held or pending instances are unavailable to chest generation and return to their pool when they leave active possession.
- Reason: The handbook describes Artifacts as contestable and explicitly returns them to their chest pool after leaving active possession.
- Affected systems: chest generation, inventory invariants, death/discard overflow.
- Source: item handbook and chest rules.

## D007 Forced objective closure

- Decision: The all-objectives end condition triggers when no assigned objective remains `ACTIVE`. Living `EXIT_READY` players auto-bank by first-readiness timestamp and then seat order.
- Reason: This makes section 16's explicit forced banking of living Exit-Ready players reachable while retaining the exposed waiting turn whenever any objective remains active.
- Affected systems: objective transitions, match end, score ordering.
- Source: section 16 reconciled by hub ruling.

## D008 Objective reveal privacy

- Decision: Ordinary failed deaths do not reveal the objective to living players. Successful exits and qualifying death-objective resolutions do; verified spectators retain god view.
- Reason: The full v13 section 2 is narrower than the earlier concise summary.
- Affected systems: public projection, spectator projection, action log.
- Source: authoritative v13 section 2.
