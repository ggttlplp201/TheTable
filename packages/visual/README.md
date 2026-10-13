# `@the-table/visual`

Reusable Three.js presentation primitives for The Table. This package ports the supplied art prototype's low-poly models, materials, procedural textures, lighting, cameras, chests, table, shops, characters, post-processing, and item presentation clips. It has no dependency on `support.js` or the `.dc.html` runtime.

The package deliberately contains no authoritative gameplay content. Prices, item effects, shop composition, inventory ownership, legal actions, player health, and private information must arrive from the client projection. The removed Counterfeit Coin is not exported. The prototype Extra Pocket model is replaced by the visible `bag` item. The table's center is reserved for event/order presentation and never creates a Pistol.

## Loading

Keep the lobby bundle light by dynamically importing this package only on Three.js routes:

```ts
const visual = await import('@the-table/visual');
const kit = new visual.VisualKit({ seed: roomVisualSeed });
const table = visual.createTableScene(kit, {
  aspect: width / height,
  seats: projectedPlayers.map((player) => ({
    id: player.id,
    role: player.role,
    color: player.seatColor,
    position: seatPosition(player.seat),
    rotationY: seatRotation(player.seat),
    label: player.name,
  })),
});
```

`VisualKit` accepts a stable number or string seed. Each procedural texture derives its own namespaced random stream, so the same seed produces the same pixels regardless of model construction order. Browser callers can omit `canvasFactory`; SSR, Node, and non-DOM renderers must inject one.

## Model API

```ts
const item = kit.createItem('bag', { label: 'Mara’s Bag' });
const chest = kit.createChest('standard', 'closed');
const character = kit.createCharacter('smuggler', 0x8fb0a0, 'Mara', 'seated');

scene.add(item, chest, character);
kit.animateCharacter(character, elapsedSeconds, seatPhase);
```

`ITEM_MODEL_IDS` is the complete production visual registry. It includes item visuals and the `armorBroken` state, but does not include prices or rules. `CHARACTER_IDS` contains the six playable roles plus `tallyman` and `fence`.

`ITEM_PRESENTATION` contains the neutral rotation/height needed by flat items. It is presentation metadata only.

## Scene builders

- `createTableScene(kit, options)` builds the room, table, lamp, exit, optional chests, supplied seats, and an empty center presentation area.
- `createPublicShopScene(kit, { offers })` builds the Tallyman scene using caller-supplied visual offers.
- `createBlackMarketScene(kit, { offers })` builds the Fence scene using caller-supplied visual offers.
- `createCamera(view, aspect)` creates `seat`, `left`, `door`, `down`, `spectator`, or `downed` cameras.
- `projectAnchors(camera, anchors)` returns normalized 0–1 screen coordinates for DOM overlays.

Scene bundles expose `{ scene, camera, anchors, interactive, characters }`. `interactive` is an allowlist for raycasting; callers should not raycast every scene object.

Shop offers use opaque caller IDs and visual item IDs:

```ts
const shop = createPublicShopScene(kit, {
  offers: projection.publicShop.map((offer) => ({
    id: offer.instanceId,
    itemId: offer.itemId,
    label: offer.displayName,
    sold: offer.sold,
  })),
});
```

The renderer never derives offer legality or pricing.

## Presentation clips

`PRESENTATION_CLIPS` and `runPresentationClip` provide deterministic, scrubbable item motion. Each call resets the pivot and item to its neutral pose before applying the requested time:

```ts
const pivot = new THREE.Group();
const pistol = kit.createItem('pistol');
pivot.add(pistol);

runPresentationClip('pistol', pivot, pistol, elapsed, {
  lift: 0.32,
  floor: 0,
});
```

Clip time is clamped to `[0, duration]`; animation completion must never gate an authoritative game transition. Artifact items without specified physical actions are listed in `ITEMS_WITHOUT_CLIPS`.

## Match arrival

`TableArrival(camera, seat, character?, onBeat?, body?)` owns a six-second cosmetic arrival plus a 1.4-second seated hold. Pass a public `SeatVisual` and matching first-person chair, legs, and hands in `body`. The camera approaches in a straight line, pauses, pulls the chair back, steps past its side, sits, and settles. Legs appear only during the sit. Gameplay pointer-look remains independent of this introductory timing. `sampleArrival(seat, seconds)` is deterministic and scrubbable for inspection/tests. `update(seconds)` emits each semantic footstep/chair/settle beat once; `finish()` and `dispose()` restore the camera and first-person props without emitting remaining beats.

The caller owns eligibility, reduced motion, skipping and persistence. No arrival function has command, timer or room-state access. The web adapter keeps authoritative updates and all gameplay controls active throughout, avoids historical event replay, disposes on unmount/context loss, and uses static rendering for reduced motion.

## Pixel post-processing

`createPostPipeline(renderer, width, height, options)` renders through the ported exposure, gamma, desaturation, sodium grade, animated grain, Bayer dither, color quantization, and vignette pass. Render at the desired low internal resolution and upscale the renderer canvas with CSS `image-rendering: pixelated`.

```ts
const post = createPostPipeline(renderer, Math.ceil(width / 3), Math.ceil(height / 3));
post.render(table.scene, table.camera, elapsedSeconds);
```

`COLOR_GRADES.spectator` supplies the cold spectator tint; callers can also lower saturation through the post options.

## Resource ownership

All geometries, materials, and canvas textures created by a `VisualKit` belong to that kit and may be shared among its models. Dispose the kit only after every object it created has left all scenes:

```ts
post.dispose();
kit.dispose(); // idempotent
```

For a standalone graph that does not share kit resources, `disposeObject3D(root)` recursively disposes unique geometries, materials, and textures. Do not call it on one model while sibling models still use the same kit-owned materials.
