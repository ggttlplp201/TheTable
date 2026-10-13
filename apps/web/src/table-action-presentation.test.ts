import { describe, expect, it } from 'vitest';
import { Group, Mesh, Vector3 } from 'three';
import type { VisualKit } from '@the-table/visual';
import { actionFlash, actionSeatPoint, createChestToolPresentation, createPublicActionPresentation, knifeHitStrength, pistolHitStrength, spyglassZoom } from './table-action-presentation';
import { latestOwnSpyglassTarget } from './owner-scene-inspection';
import { ownerRoom, spectatorRoom } from './test-fixtures';
import { publicSeats } from './table-presentation';

describe('source scene action samplers', () => {
  it('samples source hit and flash timing absolutely without frame-dependent accumulation', () => {
    expect(knifeHitStrength(.4)).toBe(0); expect(knifeHitStrength(.8 + .8 / 6)).toBe(1);
    expect(knifeHitStrength(1.7)).toBeLessThan(.25);
    expect(actionFlash('medicine', 3.59).opacity).toBe(0);
    expect(actionFlash('medicine', 3.6)).toEqual({ color: '#ffd890', opacity: .55 });
    expect(actionFlash('medicine', 3.6 + 1 / 60).opacity).toBeCloseTo(.55 * .93);
    expect(actionFlash('antidote', 2.5)).toEqual({ color: '#a8e070', opacity: .45 });
    expect(actionFlash('armor', 1.25).opacity).toBe(0); // v13 has no armor equip action.
  });
  it('preserves exact owner healing points and rotates opponent paths without changing state', () => {
    const room = ownerRoom().public, original = structuredClone(room), [near, far] = publicSeats(room, 'p1');
    expect(actionSeatPoint(near!, .18, 1.32, 1.82).toArray()).toEqual([.18, 1.32, 1.82]);
    expect(actionSeatPoint(far!, 0, 1.5, 2.18).toArray()).toEqual([0, 1.5, -2.08]);
    expect(room).toEqual(original);
  });
  it('travels to the public knife target and resets pooled blade transforms on replay', () => {
    const kit = { createItem() { const model = new Group(), blade = new Group(); blade.name = 'blade'; model.add(blade); return model; }, mesh: (geometry: never, material: never) => new Mesh(geometry, material) } as unknown as VisualKit;
    const action = createPublicActionPresentation(kit, 'knife'), target = new Vector3(0, 1.3, -1.5);
    const geometry = { start: new Vector3(-.75, .962, 1.12), target, held: target, mouth: target, arm: target, actorYaw: 0 };
    action.apply(.8, geometry); expect(action.anchor.position.y).toBeCloseTo(1.3);
    expect(action.anchor.position.distanceTo(target)).toBeCloseTo(.5);
    action.apply(2.3, geometry); expect(action.model.getObjectByName('blade')!.rotation.z).toBeCloseTo(-1.4);
    action.apply(0, geometry); expect(action.model.getObjectByName('blade')!.rotation.z).toBeCloseTo(0);
    expect(action.anchor.position.toArray()).toEqual(geometry.start.toArray());
    action.finish(); expect(action.anchor.visible).toBe(false);
  });
  it('sends every targeted action to its target instead of playing it at the owner seat', () => {
    const kit = { createItem() { const model = new Group(), part = new Group(); part.name = 'blade'; model.add(part); const broken = new Group(); broken.add(new Group(), new Group()); model.add(broken); return model; }, mesh: (geometry: never, material: never) => new Mesh(geometry, material) } as unknown as VisualKit;
    const start = new Vector3(-.75, .962, 1.12), target = new Vector3(0, 1.3, -1.5), front = new Vector3(0, 1.22, -1.4), wrist = new Vector3(.2, .99, -1.2);
    const geometry = { start, target, held: start, mouth: target, arm: target, actorYaw: 0, recipientFront: front, recipientYaw: 0, wrist };
    const poison = createPublicActionPresentation(kit, 'poison'); poison.apply(1.6, geometry);
    expect(poison.anchor.position.distanceTo(new Vector3(front.x, front.y + .12, front.z))).toBeLessThan(.01);
    poison.apply(3.15, geometry); expect(poison.anchor.position.distanceTo(start)).toBeLessThan(.02);
    const cuffs = createPublicActionPresentation(kit, 'handcuffs'); cuffs.apply(1.3, geometry);
    expect(cuffs.anchor.position.distanceTo(wrist)).toBeLessThan(.01);
    const armor = createPublicActionPresentation(kit, 'armor'); armor.apply(1.0, geometry);
    expect(armor.anchor.position.toArray()).toEqual(front.toArray());
    expect(pistolHitStrength(1.49)).toBe(0); expect(pistolHitStrength(1.5)).toBe(1);
  });
  it('drives chest tools into the real keyhole and withdraws them after the lock gives', () => {
    const kit = { createItem: () => new Group() } as unknown as VisualKit;
    const keyhole = new Vector3(-1.1, 1.17, -.4), forward = new Vector3(0, 0, 1), start = new Vector3(-.75, .962, 1.12);
    const key = createChestToolPresentation(kit, 'key'), geometry = { start, keyhole, forward, chestYaw: 0 };
    key.apply(0, geometry); expect(key.anchor.position.toArray()).toEqual(start.toArray());
    key.apply(1.0, geometry); expect(key.anchor.position.z).toBeCloseTo(keyhole.z + .22, 1);
    key.apply(1.6, geometry); expect(key.anchor.position.distanceTo(keyhole.clone().setZ(keyhole.z + .015))).toBeLessThan(.01);
    key.apply(2.9, geometry); expect(key.anchor.position.z).toBeGreaterThan(keyhole.z + .1);
  });
  it('uses the source58→20→58 Spyglass envelope', () => {
    expect(spyglassZoom(0)).toBe(0); expect(spyglassZoom(.8)).toBeCloseTo(.5);
    expect(58 - 38 * spyglassZoom(1.5)).toBe(20); expect(spyglassZoom(3.4)).toBe(0);
  });
});

describe('owner-only scene inspection adapter', () => {
  it('passes only target identity from a correlated owner Spyglass event', () => {
    const room = ownerRoom();
    room.public.events = [{ id: 'spy', kind: 'POCKET_INSPECTED', sequence: 1, at: 1, actorId: 'p1', targetIds: ['p2'], publicText: '' }];
    room.private.inspections = [{ eventId: 'spy', payload: { targetId: 'p2', pocketIndex: 0, item: { itemId: 'poison', instanceId: 'PRIVATE', quantity: 1 } } }];
    expect(latestOwnSpyglassTarget(room, 'p1')).toEqual({ eventId: 'spy', targetId: 'p2' });
    expect(latestOwnSpyglassTarget(room, 'p2')).toBeUndefined();
    room.public.events[0]!.actorId = 'p2'; expect(latestOwnSpyglassTarget(room, 'p1')).toBeUndefined();
    room.public.events[0]!.actorId = 'p1'; room.private.inspections[0]!.payload = { targetId: 'p2', pocketIndex: 0, blocked: true };
    expect(latestOwnSpyglassTarget(room, 'p1')).toBeUndefined();
    expect(latestOwnSpyglassTarget(spectatorRoom(), 'p1')).toBeUndefined();
  });
});
