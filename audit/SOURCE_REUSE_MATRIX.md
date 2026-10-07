# Source Reuse Matrix

## Authority

Gameplay and all command legality come from `GAME_RULES.md` and the authoritative server projection. The standalone HTML files under `reference/` are visual and interaction references only. They never create client-side state, reveal private information, or bypass capability checks.

| Component | Standalone HTML reference | Original source | Production implementation | Reused / ported | Replaced and why |
| --- | --- | --- | --- | --- | --- |
| First-person table shell | Scene: seated table view | Art handoff scene and `game-kit.js` | `GameTableScene.tsx`, `table-scene-runtime.ts`, `packages/visual/src/scenes.ts` | Seated framing, constrained look, table composition, fog, grain, lamp, opponents, chests | Standalone state simulator replaced by authoritative public projection |
| Camera | Scene: desktop pointer-look and mobile focus | `Table Scene v2.dc.html` | `table-scene-runtime.ts` | Constrained seated pointer-look and touch drag; spectator god view | Free orbit and detached active-player cameras excluded |
| Player bodies and seats | Scene: opponents around table | Visual kit character builders | `packages/visual/src/scenes.ts`, runtime semantic hit targets | Physical seat layout, role color, life-state animation | Prototype names and sample state excluded |
| Visible inventories | Scene: six physical slots at each seat | Visual kit item builders | `table-scene-runtime.ts` | Six-slot public item rows, hover/raycast metadata | DOM inventory lists demoted to overlay and accessibility support |
| Pockets | Scene: Pocket plates | Visual kit primitives | `table-scene-runtime.ts`, `MatchView.tsx` | Occupied/empty indicators only | Pocket contents never enter the public scene graph |
| Chests | Scene: standard and black physical chests | Visual kit chest builders | `table-scene-runtime.ts`, `MatchView.tsx` | Physical placement, public state, semantic interaction | Text-only chest panel retained only inside contextual overlay |
| Exit | Scene: room door and exit focus | Scene door model | `packages/visual/src/scenes.ts`, runtime `EXIT` intent | Door is a semantic world target | Exit legality remains capability-gated by server |
| Core HUD | UI Screens: gameplay HUD | `Game UI Screens.dc.html` | `MatchView.tsx`, `styles.css` | Compact top clock, seat ribbon, bottom hand and action dock | Persistent dashboard columns removed |
| Use Item | UI Screens: selected item and targeting | Existing authoritative form command builder | `ActionForms.tsx` inside match overlay; physical item intents in runtime | Scene item selection opens compact focused flow | Select fields remain as accessible fallback, not persistent primary UI |
| Trade | UI Screens: Trade Builder and response | Existing trade command and pending proposal projection | `TradeForm`, `PendingInteraction`, overlay compositor | Two-party overlay over visible table, paused response decision | Standalone fake inventory and prices excluded |
| Threat | UI Screens: Threat Builder and response | Existing threat command and covered-item rules | `ThreatForm`, `PendingInteraction`, danger overlay | Open/covered presentation, demand, backing item, timed comply/refuse | Client-side resolution excluded |
| Objective | UI Screens: parchment contract | Final objective definitions and private projection | `PrivateDetail` in paper overlay | Private contract, progress, completion and exit-ready copy | Permanent dashboard card removed |
| Downed / Help / Loot | UI Screens: Downed focus | Final downed capabilities and immediate loot projection | `DownedForm` and forced decision overlay | Contextual seat intent and focused state | Permanent main panel removed |
| Public Shop | UI Screens: public market | Authoritative shop offers and purchase order | `Markets` in world overlay | Item-card grid, visible order and buy/sell controls | Sample stock/prices excluded |
| Black Market | UI Screens: under-table red market | Authorized private offers | `Markets` danger treatment | Red/dark private presentation and reroll capability | Public exposure of private offers excluded |
| Chat / voice / settings | UI Screens: compact utility panels | Existing chat, WebRTC and audio engines | `ChatPanel`, `VoicePanel`, `AudioControls` in temporary overlays | Behavior reused unchanged | Persistent sidebar removed |
| Spectator | Scene/UI Screens: god view | Verified spectator projection | fixed spectator camera and `SpectatorDetails` overlay | Read-only private inspection view | Actions, chat composer and scene interaction disabled |
| Results | UI Screens: final results | Authoritative final scores | `Results` full-screen stage | Ranking and rematch presentation | Prototype scoring excluded |
| Handbook | UI Screens: handbook | `GAME_RULES.md` | compact `Handbook` overlay | Visual hierarchy and essential player guidance | Does not duplicate full rules text |
| Debug dashboard | Previous production UI | Existing panels/forms | `MatchView.tsx` under dev-only `?debug=1` | Existing tooling remains available to developers | Never rendered for normal production matches |

## Non-negotiable integration invariants

- All commands pass through `useMatchActions`, capability checks, expected revisions, and idempotency keys.
- The scene receives `PublicRoomView` only. Private objective, Pocket content, inspections, and Black Market offers stay in authorized React overlays.
- Scene clicks emit intent only. They never mutate game state.
- The final rules exclude obsolete prototype mechanics even when a visual reference depicts them.
- Active players use the seated camera. Spectators use the fixed read-only camera.

