# Decisions

## D001 Repository location

- Decision: Build in the active shared workspace `/Users/leon/Documents/ChatGPT/the table`.
- Reason: This is the workspace explicitly provided to the session. The alternate iCloud path appears inside an attached build brief and is therefore contextual project material, not a higher-priority runtime instruction.
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
