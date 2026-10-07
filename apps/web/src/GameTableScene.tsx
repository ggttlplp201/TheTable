import { useEffect, useMemo, useRef, useState } from 'react';
import type { PublicRoomView } from '@the-table/game';

const SEATS = [
  { position: [0, 0, 2.18] as const, rotationY: Math.PI, color: 0xb4955c },
  { position: [2.65, 0, 0] as const, rotationY: -Math.PI / 2, color: 0x875d49 },
  { position: [0, 0, -2.18] as const, rotationY: 0, color: 0x536f78 },
  { position: [-2.65, 0, 0] as const, rotationY: Math.PI / 2, color: 0x7a7450 },
] as const;

export function GameTableScene({ room }: { room: PublicRoomView }) {
  const mount = useRef<HTMLDivElement>(null);
  const [renderFailed, setRenderFailed] = useState(false);
  const seats = useMemo(() => room.players.flatMap(player => {
    if (!player.roleId) return [];
    const seat = SEATS[player.seat];
    if (!seat) return [];
    return [{ id: player.id, role: player.roleId, color: seat.color, position: seat.position, rotationY: seat.rotationY, label: player.name }];
  }), [room.players]);
  const chestSignature = room.chests?.map(chest => `${chest.kind}:${chest.availability}`).join('|') ?? '';
  const rosterSignature = seats.map(seat => `${seat.id}:${seat.role}:${seat.label}:${seat.position.join(',')}`).join('|');

  useEffect(() => {
    const target = mount.current;
    if (!target) return;
    setRenderFailed(false);
    let cancelled = false;
    let frame = 0;
    let dispose: (() => void) | undefined;

    void Promise.all([import('@the-table/visual'), import('three')]).then(([visual, THREE]) => {
      if (cancelled) return;
      const width = Math.max(1, target.clientWidth);
      const height = Math.max(1, target.clientHeight);
      const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
      renderer.shadowMap.enabled = true;
      renderer.setSize(width, height, false);
      target.replaceChildren(renderer.domElement);
      const kit = new visual.VisualKit({ seed: room.code });
      const scene = visual.createTableScene(kit, {
        aspect: width / height,
        seats,
        includeChests: false,
      });
      // A compact table overview avoids placing the camera inside the front player's model.
      const camera = visual.createCamera('spectator', width / height);
      for (const chest of room.chests ?? []) {
        if (chest.availability !== 'AVAILABLE') continue;
        const model = kit.createChest(chest.kind === 'STANDARD' ? 'standard' : 'black');
        model.position.set(chest.kind === 'STANDARD' ? -1.15 : 1.2, visual.TABLE_TOP_Y, -0.6);
        model.rotation.y = chest.kind === 'STANDARD' ? 0.3 : -0.3;
        model.scale.setScalar(1.1);
        scene.scene.add(model);
      }
      const post = visual.createPostPipeline(renderer, Math.ceil(width / 2), Math.ceil(height / 2), { grain: 0.09, saturation: 0.7 });
      const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
      const draw = (now: number) => {
        post.render(scene.scene, camera, motion.matches ? 0 : now / 1000);
        if (!motion.matches) frame = requestAnimationFrame(draw);
      };
      const changeMotion = () => { cancelAnimationFrame(frame); draw(performance.now()); };
      motion.addEventListener('change', changeMotion);
      const observer = new ResizeObserver(entries => {
        const box = entries[0]?.contentRect;
        if (!box || box.width < 1 || box.height < 1) return;
        renderer.setSize(box.width, box.height, false);
        camera.aspect = box.width / box.height;
        camera.updateProjectionMatrix();
        post.resize(Math.ceil(box.width / 2), Math.ceil(box.height / 2));
        if (motion.matches) post.render(scene.scene, camera, 0);
      });
      observer.observe(target);
      frame = requestAnimationFrame(draw);
      dispose = () => {
        observer.disconnect();
        motion.removeEventListener('change', changeMotion);
        cancelAnimationFrame(frame);
        post.dispose();
        kit.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    }).catch(() => {
      if (!cancelled) setRenderFailed(true);
    });

    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [room.code, rosterSignature, chestSignature]);

  return <div className="scene-frame" ref={mount} aria-label="The Table game room">
    {renderFailed && <p className="scene-fallback" role="status">The table view is unavailable. Match state is still connected.</p>}
  </div>;
}
