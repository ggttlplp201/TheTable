import { describe, expect, it } from 'vitest';
import { Group, Vector3 } from 'three';
import { TABLE_TOP_Y, VisualKit, type CanvasFactory, type CanvasLike } from '@the-table/visual';
import { createSeatRestraint, placeRestrainedHand } from './table-restraints';
import { TABLE_SEATS } from './table-presentation';

// Exercise the real reference character joints/materials without requiring a WebGL context.
const gradient = { addColorStop() {} };
const context = new Proxy({ createRadialGradient: () => gradient, createLinearGradient: () => gradient }, { get: (target, key) => key in target ? target[key as keyof typeof target] : () => {} });
const canvasFactory: CanvasFactory = (width, height) => ({ width, height, getContext: () => context }) as unknown as CanvasLike;
const makeKit = () => new VisualKit({ seed: 'restraint-regression', canvasFactory });

describe('physical table restraints', () => {
  it.each(['enforcer', 'medic', 'smuggler', 'locksmith', 'broker', 'scavenger'] as const)('pins the real %s wrist to the tabletop through idle motion, from every seat', role => {
    const kit = makeKit();
    try {
      for (const seat of TABLE_SEATS) {
        const character = kit.createCharacter(role, seat.color, role);
        character.position.set(seat.position[0]!, seat.position[1]!, seat.position[2]!); character.rotation.y = seat.rotationY;
        const restraint = createSeatRestraint(kit, character, 'player', false);
        restraint.setCuffed(true, 0, false); const post = restraint.post.position.clone();
        for (const time of [0, 1, 2, 5, 10]) {
          restraint.restorePose(); kit.animateCharacter(character, time, .5); restraint.apply(time, false);
          const wrist = character.getObjectByName('armLeft')!.getObjectByName('hand')!.getWorldPosition(new Vector3());
          expect(wrist.y).toBeCloseTo(TABLE_TOP_Y + .08, 5);
          expect(restraint.wristCuff.position.distanceTo(wrist)).toBeLessThan(.0001);
          expect(restraint.post.position.toArray()).toEqual(post.toArray());
          expect(restraint.postCuff.position.y).toBeCloseTo(TABLE_TOP_Y + .135);
          expect(restraint.tether.visible).toBe(true);
        }
        restraint.dispose();
      }
    } finally { kit.dispose(); }
  });
  it('shows just the owner sleeve and hand outside the deliberately hidden torso', () => {
    const kit = makeKit();
    try {
      const character = kit.createCharacter('broker', 0x6a8ab8); character.rotation.y = Math.PI; character.position.z = 2.18;
      character.getObjectByName('upper')!.visible = false;
      const restraint = createSeatRestraint(kit, character, 'self', true);
      restraint.setCuffed(true, 0, false); kit.animateCharacter(character, 0); restraint.apply(0, true);
      expect(restraint.ownerArm?.visible).toBe(true);
      expect(restraint.ownerArm?.getObjectByName('head')).toBeUndefined();
      restraint.root.updateWorldMatrix(true, true);
      expect(restraint.ownerArm!.getObjectByName('hand')!.getWorldPosition(new Vector3()).distanceTo(restraint.wristCuff.position)).toBeLessThan(.0001);
      restraint.restorePose(); restraint.setCuffed(false, 1, false); kit.animateCharacter(character, 1); restraint.apply(1, true);
      expect(restraint.ownerArm?.visible).toBe(false); expect(restraint.tether.visible).toBe(false);
      expect(restraint.post.visible).toBe(true);
    } finally { kit.dispose(); }
  });
  it('animates a fresh attachment, keeps it beyond the action clip, and releases without leaving a stuck pose', () => {
    const kit = makeKit();
    try {
      const character = kit.createCharacter('medic', 0xb84030);
      const restraint = createSeatRestraint(kit, character, 'p2', false);
      restraint.setCuffed(false, 0, false); restraint.setCuffed(true, 1, true);
      kit.animateCharacter(character, 0); restraint.apply(1.4, false);
      expect(restraint.root.userData.handWeight).toBeGreaterThan(0); expect(restraint.root.userData.handWeight).toBeLessThan(1);
      expect(restraint.wristCuff.getObjectByName('hingedJaw')!.rotation.z).toBeGreaterThan(0);
      restraint.restorePose(); kit.animateCharacter(character, 8); restraint.apply(8, false);
      expect(restraint.tether.visible).toBe(true); expect(restraint.wristCuff.getObjectByName('hingedJaw')!.rotation.z).toBe(0);
      restraint.restorePose(); restraint.setCuffed(false, 9, true); kit.animateCharacter(character, 9.5); restraint.apply(9.5, false);
      expect(restraint.tether.visible).toBe(false);
      expect(character.getObjectByName('armLeft')!.rotation.x).toBeCloseTo(-.4);
      expect(character.getObjectByName('armLeft')!.getObjectByName('hand')!.rotation.x).toBeCloseTo(0);
    } finally { kit.dispose(); }
  });
  it('snaps to the authoritative state on reconnect/reduced motion and hides the restraint when the player leaves', () => {
    const kit = makeKit();
    try {
      const character = kit.createCharacter('medic', 0xb84030), restraint = createSeatRestraint(kit, character, 'p2', false);
      restraint.setCuffed(true, 0, true); kit.animateCharacter(character, 0); restraint.apply(0, true);
      expect(restraint.root.userData.handWeight).toBe(1); expect(restraint.tether.visible).toBe(true);
      restraint.restorePose(); restraint.apply(1, true, false); expect(restraint.tether.visible).toBe(false);
      const root = new Group(); root.add(restraint.root); restraint.dispose(); expect(root.children).toHaveLength(0);
    } finally { kit.dispose(); }
  });
  it('does not crash if a fallback character has no articulated arm', () => {
    expect(() => placeRestrainedHand(new Group(), new Vector3(0, 1, 0))).not.toThrow();
  });
});
