# Frontend Fidelity Gate

The visual baseline is the two checked-in files in `reference/`. Gameplay correctness remains governed by `GAME_RULES.md`.

## Required capture matrix

Capture at 1440 x 900 and 390 x 844 where applicable. Store production captures under `test-results/fidelity/` and compare them with the matching standalone screen.

| Group | Required states |
| --- | --- |
| Entry | title, create/join, lobby, role selection |
| Gameplay | 2/3/4-player table, item selected, Use targeting, Trade builder/response, Threat builder/response, objective, objective complete, Downed, spectator, exit-ready |
| Economy | Public Shop, Black Market, sell-back, Standard Chest, Black Chest, overflow |
| Meta | results, handbook, settings |
| Mobile | core HUD, Trade, Threat, Public Shop, Black Market, objective, Downed |

## Scorecard

Score each state from 0 to 5 for first-person presence, composition, geometry/models, lighting, materials, post-processing, typography, HUD layout, atmosphere, interaction integration, and overall fidelity. Acceptance requires every category at least 4 and overall fidelity at least 4.5. Do not mark a state accepted without a direct browser comparison.

## Automated gates

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright test qa/e2e/table.spec.ts --workers=1
pnpm exec playwright test qa/e2e/lifecycle.spec.ts --workers=1
```

The browser suite must also assert:

- `html.scrollHeight <= html.clientHeight` during an active match.
- no horizontal overflow at desktop or phone sizes.
- the scene fills the match viewport.
- active players can move the seated camera with pointer input.
- touch controls retain at least 44px targets, with primary mobile controls at least 56px.
- no action composer is present for spectators.
- private objectives and offers never appear in another player's DOM, storage, or frames.
- Trade, Threat, objective, market, chest, settings, and chat surfaces are dialogs over the live table.

## Manual self-audit

- [ ] Gameplay fits one viewport with no normal page scrolling.
- [ ] The camera reads as a seated first-person view and can look around.
- [ ] Players, public inventories, Pocket occupancy, and chests are physical scene objects.
- [ ] Use, Trade, Threat, objective, Downed, shops, exit, and results use the designed in-game presentation.
- [ ] Debug UI appears only in development with `?debug=1`.
- [ ] Obsolete prototype mechanics remain excluded.
- [ ] Mobile focus panels keep the shared table visible behind them.
