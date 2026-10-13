import { BoxGeometry, CylinderGeometry, Group, Quaternion, TorusGeometry, Vector3, type Object3D } from 'three';
import { TABLE_TOP_Y, type VisualKit } from '@the-table/visual';

const DOWN = new Vector3(0, -1, 0);
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };
const HAND_ON_FELT = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);

/** Solves the existing two-joint arm, rather than stretching a detached hand toward the table. */
export function placeRestrainedHand(character: Group, wrist: Vector3, weight = 1): void {
  const shoulder = character.getObjectByName('armLeft');
  const elbow = shoulder?.getObjectByName('elbow'), hand = elbow?.getObjectByName('hand');
  if (!shoulder?.parent || !elbow || !hand) return;
  character.updateWorldMatrix(true, true);
  const destination = shoulder.parent.worldToLocal(wrist.clone());
  const delta = destination.sub(shoulder.position), upperLength = elbow.position.length(), lowerLength = hand.position.length();
  const distance = Math.max(.001, Math.min(delta.length(), upperLength + lowerLength - .001));
  const direction = delta.normalize();
  const along = (upperLength ** 2 - lowerLength ** 2 + distance ** 2) / (2 * distance);
  const bend = new Vector3(-.18, -1, -.12).addScaledVector(direction, -new Vector3(-.18, -1, -.12).dot(direction)).normalize();
  const elbowDelta = direction.clone().multiplyScalar(along).addScaledVector(bend, Math.sqrt(Math.max(0, upperLength ** 2 - along ** 2)));
  const forearmDelta = direction.clone().multiplyScalar(distance).sub(elbowDelta);
  const upperRotation = new Quaternion().setFromUnitVectors(DOWN, elbowDelta.normalize());
  const lowerRotation = new Quaternion().setFromUnitVectors(DOWN, forearmDelta.normalize());
  shoulder.quaternion.slerp(upperRotation, weight);
  elbow.quaternion.slerp(upperRotation.clone().invert().multiply(lowerRotation), weight);
  character.updateWorldMatrix(true, true);
  const palmRotation = character.getWorldQuaternion(new Quaternion()).multiply(HAND_ON_FELT);
  hand.quaternion.slerp(elbow.getWorldQuaternion(new Quaternion()).invert().multiply(palmRotation), weight);
  character.updateWorldMatrix(true, true);
}

/** Public status presentation only. No inventory or owner-private data enters this rig. */
export function createSeatRestraint(kit: VisualKit, character: Group, playerId: string, firstPerson: boolean) {
  const root = new Group(); root.name = `seatRestraint:${playerId}`;
  const post = kit.group(
    kit.mesh(new BoxGeometry(.18, .025, .17), kit.materials.wood, 0, .0125),
    kit.mesh(new CylinderGeometry(.042, .05, .27, 7), kit.materials.wood, 0, .15),
    kit.mesh(new CylinderGeometry(.056, .046, .025, 7), kit.materials.wood, 0, .297),
    kit.mesh(new CylinderGeometry(.054, .054, .022, 8), kit.materials.metal, 0, .045),
  );
  post.name = `restraintPost:${playerId}`;
  // The same seat-local offset puts every post on the wooden perimeter, clear of item slots.
  character.updateWorldMatrix(true, true);
  post.position.copy(character.localToWorld(new Vector3(-.68, TABLE_TOP_Y, .7)));
  post.quaternion.copy(character.getWorldQuaternion(new Quaternion()));
  root.add(post);

  const cuff = (name: string) => {
    const group = new Group(); group.name = name;
    const fixed = kit.mesh(new TorusGeometry(.068, .012, 5, 12, Math.PI), kit.materials.metal);
    const jaw = new Group(); jaw.position.x = -.068; jaw.name = 'hingedJaw';
    jaw.add(kit.mesh(new TorusGeometry(.068, .012, 5, 12, Math.PI), kit.materials.metal, .068, 0, 0, 0, 0, Math.PI));
    group.add(fixed, jaw, kit.mesh(new BoxGeometry(.027, .035, .029), kit.materials.metal, .069), kit.mesh(new BoxGeometry(.007, .014, .031), kit.materials.dark, .07));
    return group;
  };
  const tether = new Group(); tether.name = `restraintTether:${playerId}`; tether.visible = false;
  const wristCuff = cuff('wristCuff'), postCuff = cuff('postCuff');
  const links = Array.from({ length: 7 }, (_, index) => {
    const link = kit.mesh(new TorusGeometry(.019, .005, 4, 8), kit.materials.metal);
    link.name = `chainLink:${index}`; tether.add(link); return link;
  });
  tether.add(wristCuff, postCuff); root.add(tether);
  const shoulder = character.getObjectByName('armLeft');
  const elbow = shoulder?.getObjectByName('elbow'), hand = elbow?.getObjectByName('hand');
  const joints = [shoulder, elbow, hand].filter((joint): joint is Object3D => Boolean(joint));
  let naturalPose: Quaternion[] | undefined;
  // The owner's torso is intentionally hidden in first person. Render only the same rig's
  // sleeve/hand outside that hidden subtree while restrained, never a second whole character.
  const ownerArm = firstPerson && shoulder ? shoulder.clone(true) : undefined;
  if (ownerArm) { ownerArm.name = 'firstPersonRestrainedArm'; ownerArm.visible = false; root.add(ownerArm); }
  let active = false, initialized = false, attachedAt: number | undefined, releasedAt: number | undefined;
  let releaseWeight = 0;
  const wrist = new Vector3(), linkStart = new Vector3(), linkEnd = new Vector3();
  const seatRotation = character.getWorldQuaternion(new Quaternion());
  const handWeight = (now: number) => attachedAt === undefined ? 1 : smooth((now - attachedAt - .1) / .8);
  const restorePose = () => { naturalPose?.forEach((rotation, index) => joints[index]!.quaternion.copy(rotation)); naturalPose = undefined; };
  return {
    root, post, tether, wristCuff, postCuff, ownerArm,
    /** Run before ordinary idle animation so a released arm never inherits the IK pose. */
    restorePose,
    setCuffed(value: boolean, now: number, animate: boolean) {
      if (value === active && initialized) return;
      if (!value && active) { releaseWeight = handWeight(now); releasedAt = animate ? now : undefined; }
      else releasedAt = undefined;
      attachedAt = value && initialized && animate ? now : undefined;
      active = value; initialized = true;
    },
    apply(now: number, reducedMotion: boolean, present = true) {
      const weight = active ? reducedMotion ? 1 : handWeight(now)
        : releasedAt === undefined || reducedMotion ? 0 : releaseWeight * (1 - smooth((now - releasedAt) / .35));
      root.userData.cuffed = active && present;
      root.userData.handWeight = weight;
      tether.visible = active && present && weight > 0;
      if (ownerArm) ownerArm.visible = present && weight > 0;
      if (!present || weight <= 0 || !hand) return;
      naturalPose = joints.map(joint => joint.quaternion.clone());
      wrist.copy(character.localToWorld(new Vector3(-.38, TABLE_TOP_Y + .08, .66)));
      placeRestrainedHand(character, wrist, weight);
      if (ownerArm && shoulder) {
        ownerArm.position.copy(shoulder.getWorldPosition(new Vector3()));
        ownerArm.quaternion.copy(shoulder.getWorldQuaternion(new Quaternion()));
        ownerArm.scale.copy(shoulder.getWorldScale(new Vector3()));
        ownerArm.getObjectByName('elbow')!.quaternion.copy(elbow!.quaternion);
        ownerArm.getObjectByName('hand')!.quaternion.copy(hand.quaternion);
      }
      if (!tether.visible) return;
      const elapsed = attachedAt === undefined || reducedMotion ? 10 : now - attachedAt;
      const settle = smooth((elapsed - .7) / .45), closed = smooth((elapsed - .95) / .28);
      wristCuff.position.copy(hand.getWorldPosition(wrist));
      wristCuff.position.y += (1 - settle) * .2;
      wristCuff.quaternion.copy(seatRotation); // Vertical hoop around the horizontal wrist.
      postCuff.position.copy(post.position).add(new Vector3(0, .135 + (1 - settle) * .16, 0));
      postCuff.quaternion.copy(seatRotation).multiply(HAND_ON_FELT); // Horizontal hoop around the upright post.
      wristCuff.getObjectByName('hingedJaw')!.rotation.z = (1 - closed) * 1.15;
      postCuff.getObjectByName('hingedJaw')!.rotation.z = (1 - closed) * .85;
      root.updateWorldMatrix(true, true);
      linkStart.copy(wristCuff.position).add(new Vector3(-.067, 0, 0).applyQuaternion(seatRotation));
      linkEnd.copy(postCuff.position).add(new Vector3(.067, 0, 0).applyQuaternion(seatRotation));
      links.forEach((link, index) => {
        const fraction = index / (links.length - 1);
        link.position.lerpVectors(linkStart, linkEnd, fraction);
        link.position.y -= Math.sin(fraction * Math.PI) * (.032 + (reducedMotion ? 0 : Math.sin(Math.min(elapsed, 1.7) * 13) * .012 * (1 - smooth((elapsed - 1.2) / .5))));
        link.quaternion.copy(seatRotation); link.rotateY(index % 2 ? Math.PI / 2 : 0);
      });
    },
    dispose() { restorePose(); root.removeFromParent(); }, // Geometry/materials are owned by VisualKit.
  };
}
