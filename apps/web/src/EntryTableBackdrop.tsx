import { useEffect, useRef } from 'react';
import type { TitleScene, StillRenderer } from './reference-game-kit.js';
import './entry-vhs.css';

/**
 * Title screen backdrop (Game UI board 01): the empty table — room, lamp, both chests, the door — slowly
 * orbited and rendered with the game's normal low-res post-FX, without VHS distortion or text overlays.
 * Reduced motion shows one still frame with the same look.
 */
export function EntryTableBackdrop() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let disposed = false, frame = 0;
    let title: TitleScene | undefined, still: StillRenderer | undefined;
    let detach = () => {};
    const cleanup = () => {
      cancelAnimationFrame(frame);
      detach();
      title?.dispose(); title = undefined;
      still?.dispose(); still?.r.domElement.remove(); still = undefined;
    };
    void Promise.all([import('three'), import('./reference-game-kit.js')]).then(([THREE, kit]) => {
      const target = host.current; if (disposed || !target) return;
      const motion = matchMedia('(prefers-reduced-motion: reduce)');
      // Match the reference's 1/3-resolution target and nearest-neighbour upscale.
      const width = () => Math.max(160, Math.round(target.clientWidth / 3)), height = () => Math.max(90, Math.round(target.clientHeight / 3));
      still = kit.makeStill(THREE, width(), height());
      still.post.uniforms.uE!.value = 2.3;
      title = kit.buildTitleScene(THREE);
      still.r.domElement.className = 'entry-vhs-canvas'; target.appendChild(still.r.domElement);
      const camera = new THREE.PerspectiveCamera(50, width() / height(), .05, 40);
      let elapsed = 0, last = performance.now();
      // Push the table right of centre so the menu on the left stays readable.
      const frameCamera = () => { camera.aspect = width() / height(); camera.setViewOffset(width(), height(), -Math.round(width() * .19), 0, width(), height()); camera.updateProjectionMatrix(); };
      frameCamera();
      const draw = () => {
        if (disposed || document.hidden || !title || !still) return;
        const t = performance.now() / 1000, k = motion.matches ? 0 : elapsed;
        const angle = k * .07 + .6, radius = 3.7 + Math.sin(k * .11) * .2;
        camera.position.set(Math.sin(angle) * radius, 2.55 + Math.sin(k * .17) * .1, Math.cos(angle) * radius); camera.lookAt(0, .8, 0);
        if (title.lamp) { title.lamp.rotation.z = motion.matches ? 0 : Math.sin(t * .7) * .035; title.lamp.rotation.x = motion.matches ? 0 : Math.cos(t * .5) * .02; }
        still.render(title.scene, camera, { t: motion.matches ? 0 : t });
        still.r.domElement.dataset.motion = motion.matches ? 'reduced' : 'idle';
      };
      const loop = (now: number) => {
        frame = 0;
        if (disposed || document.hidden || motion.matches) return;
        elapsed += Math.min((now - last) / 1000, .1); last = now;
        draw(); frame = requestAnimationFrame(loop);
      };
      const resume = () => {
        cancelAnimationFrame(frame); frame = 0; last = performance.now(); draw();
        if (!disposed && !document.hidden && !motion.matches) frame = requestAnimationFrame(loop);
      };
      const resize = new ResizeObserver(() => {
        if (disposed || !still) return;
        // Keep one WebGL context and redraw still frames after a resize.
        still.resize(width(), height()); frameCamera(); draw();
      });
      detach = () => {
        resize.disconnect();
        motion.removeEventListener('change', resume);
        document.removeEventListener('visibilitychange', resume);
      };
      resize.observe(target);
      motion.addEventListener('change', resume);
      document.addEventListener('visibilitychange', resume);
      resume();
    }).catch(() => { cleanup(); /* WebGL unavailable: the dark background and menu still work. */ });
    return () => { disposed = true; cleanup(); };
  }, []);
  return <div className="entry-vhs" aria-hidden="true">
    <div className="entry-vhs-host" ref={host} />
    <div className="entry-vhs-shade" />
  </div>;
}
