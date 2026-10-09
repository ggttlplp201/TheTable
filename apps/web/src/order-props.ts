import { CanvasTexture, Mesh, MeshLambertMaterial, PlaneGeometry, type Object3D, type Scene } from 'three';
import type { OrderRevealFrame } from './order-reveal';
import { orderPropPose } from './order-reveal';

/** Animate the source scene's ORDER DIE and DIRECTION COIN in place. */
export function createOrderProps(scene: Scene) {
  let die: Mesh | undefined, coin: Mesh | undefined;
  scene.traverse(object => {
    if (object instanceof Mesh && object.userData.label === 'ORDER DIE') die = object;
    if (object instanceof Mesh && object.userData.label === 'DIRECTION COIN') coin = object;
  });
  const originals = [die, coin].filter((object): object is Mesh => Boolean(object)).map(object => ({ object, position: object.position.clone(), rotation: object.rotation.clone(), scale: object.scale.clone(), material: object.material }));
  const materials: MeshLambertMaterial[] = [], textures: CanvasTexture[] = [], labels: Object3D[] = [];
  const texture = (paint: (context: CanvasRenderingContext2D) => void) => {
    const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 32;
    paint(canvas.getContext('2d')!);
    const map = new CanvasTexture(canvas); textures.push(map);
    const material = new MeshLambertMaterial({ map, transparent: true }); materials.push(material); return material;
  };
  const pips = [[16,16], [8,8,24,24], [8,8,16,16,24,24], [8,8,8,24,24,8,24,24], [8,8,8,24,16,16,24,8,24,24], [8,8,8,16,8,24,24,8,24,16,24,24]];
  const dieMaterials = [1,6,2,5,3,4].map(number => texture(context => {
    context.fillStyle = '#d6c9ab'; context.fillRect(0, 0, 32, 32); context.fillStyle = '#1a1410';
    const points = pips[number - 1]!;
    for (let index = 0; index < points.length; index += 2) context.fillRect(points[index]! - 2, points[index + 1]! - 2, 4, 4);
  }));
  if (die) die.material = dieMaterials;
  if (coin) for (const [label, y, angle] of [['H', .0065, -Math.PI / 2], ['T', -.0065, Math.PI / 2]] as const) {
    const face = new Mesh(new PlaneGeometry(.07, .07), texture(context => {
      context.fillStyle = '#392613'; context.font = 'bold 26px monospace'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(label, 16, 17);
    }));
    face.position.y = y; face.rotation.x = angle; coin.add(face); labels.push(face);
  }
  let active = false;
  return {
    apply(frame: OrderRevealFrame | undefined, reduced: boolean) {
      if (!frame) {
        if (active) for (const entry of originals) { entry.object.position.copy(entry.position); entry.object.rotation.copy(entry.rotation); entry.object.scale.copy(entry.scale); }
        active = false; return;
      }
      active = true;
      const pose = orderPropPose(frame, reduced);
      if (die) {
        die.position.set(-.19 + pose.dieX, pose.dieY, .3); die.scale.setScalar(2.2);
        const seat = frame.phase === 'announce' ? 2 : frame.seatNumber;
        const x = seat === 3 ? -Math.PI / 2 : seat === 4 ? Math.PI / 2 : 0;
        const z = seat === 1 ? Math.PI / 2 : 0;
        die.rotation.set(x + pose.dieRotation, pose.dieRotation * .7, z + pose.dieRotation * .3);
      }
      if (coin) { coin.position.set(.22, pose.coinY, .3); coin.scale.setScalar(2.2); coin.rotation.set(pose.coinRotation, 0, 0); }
    },
    dispose() {
      for (const label of labels) { label.removeFromParent(); (label as Mesh).geometry.dispose(); }
      for (const entry of originals) entry.object.material = entry.material;
      materials.forEach(material => material.dispose()); textures.forEach(map => map.dispose());
    },
  };
}
