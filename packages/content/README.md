# Content package

This package is the single source of truth for item, role, objective, shop/chest, and balance metadata. It intentionally excludes Counterfeit Coin and Extra Pocket; Bag is the capacity item defined by the rules. Runtime semantic audio IDs and completeness manifests live in `@the-table/audio` so there is only one cue registry.

Known rule/schema discrepancies are kept explicit here rather than silently inventing gameplay behavior:

- The schema only defines `Item`, while the rules require effect metadata, player-count eligibility, market weights, and chest weights. Those fields are represented in this package as content metadata and remain engine-agnostic.
- The three named artifacts are modeled once each as reusable, pocket-eligible `ARTIFACT` items: Brass Idol, Glass Eye, and Red Ledger.
- Role ability prose gives exact starting kits/coins and constraints, but not a universal structured effect vocabulary. Canonical ability IDs are preserved as Quick Draw, Field Dressing, Private Stock, Tumbler Sense, Margin, and Salvage.
- The detailed Standard Chest Slot A/Slot B and Black Chest premium tables are sourced from the authoritative v13 DOCX; `CHEST_DISTRIBUTIONS` exposes those exact percentages and refresh behavior.

Objective assignment is intentionally not performed by this package. `objectivesForPlayerCount` exposes immutable eligibility, while the optional test helper `assignObjectives` requires an explicit RNG function and has no nondeterministic default; authoritative seeded assignment belongs in `packages/game`.
