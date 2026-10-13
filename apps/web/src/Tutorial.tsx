import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import type { AudioEngine } from '@the-table/audio';
import { AUDIO_CUE_IDS } from '@the-table/audio';
import { HUMAN, TutorialController, type TutorialStep } from '@the-table/game/tutorial';
import { MatchView } from './MatchView';
import { TutorialClient } from './tutorial-client';
import { recordTutorialMetric, saveTutorialPreferences } from './tutorial-storage';
import './tutorial.css';
const CONTINUE = new Set<TutorialStep>(['dealer', 'inventory', 'privacy', 'reward', 'bluff', 'practiceDone', 'income', 'objective', 'burn']);
const CHAPTERS = ['Take a seat', 'Trade & Tasks', 'Threats & bluffs', 'Stay alive', 'Spend & explore', 'Wildcard & exit'];
type GuidePosition = { left: number; top: number };
type GuideDrag = GuidePosition & { pointerId: number; width: number; height: number };
const GUIDE_VIEWPORT_MARGIN = 12;

function clampGuidePosition(left: number, top: number, width: number, height: number): GuidePosition {
  return {
    left: Math.max(GUIDE_VIEWPORT_MARGIN, Math.min(left, window.innerWidth - width - GUIDE_VIEWPORT_MARGIN)),
    top: Math.max(GUIDE_VIEWPORT_MARGIN, Math.min(top, window.innerHeight - height - GUIDE_VIEWPORT_MARGIN)),
  };
}

export default function Tutorial({ chapter, audio, audioStarted, onEnableAudio, onExit }: { chapter: number; audio: AudioEngine; audioStarted: boolean; onEnableAudio: () => void; onExit: (join: boolean) => void }) {
  const [, refresh] = useState(0);
  const [controller] = useState(() => { const value = new TutorialController(); value.resume(chapter); return value; });
  const changed = useCallback(() => refresh(value => value + 1), []);
  const [client] = useState(() => new TutorialClient(controller, changed));
  const guideRef = useRef<HTMLElement>(null);
  const guideDrag = useRef<GuideDrag | null>(null);
  const [guidePosition, setGuidePosition] = useState<GuidePosition | null>(null);
  const [guideDragging, setGuideDragging] = useState(false);
  const recorded = useRef(0);
  const completed = controller.step === 'complete';
  const { title, text, focus } = controller.instruction;
  useEffect(() => {
    saveTutorialPreferences({ tutorialLastChapter: controller.chapter, skippedForNow: true, ...(completed ? { tutorialCompleted: true } : {}) });
    for (const metric of controller.metrics.slice(recorded.current)) recordTutorialMetric(metric);
    recorded.current = controller.metrics.length;
  });
  useEffect(() => { if (audioStarted) audio.play(AUDIO_CUE_IDS.tutorialPage); }, [audio, audioStarted, controller.step]);
  useEffect(() => {
    const abandon = () => { if (controller.step !== 'complete') recordTutorialMetric({ kind: 'abandoned', chapter: controller.chapter }); };
    window.addEventListener('pagehide', abandon);
    return () => window.removeEventListener('pagehide', abandon);
  }, [controller]);
  useEffect(() => {
    const keepGuideOnScreen = () => setGuidePosition(current => {
      const guide = guideRef.current;
      if (!current || !guide) return current;
      const bounds = guide.getBoundingClientRect();
      return clampGuidePosition(current.left, current.top, bounds.width, bounds.height);
    });
    window.addEventListener('resize', keepGuideOnScreen);
    return () => window.removeEventListener('resize', keepGuideOnScreen);
  }, []);
  useEffect(() => {
    guideDrag.current = null;
    setGuideDragging(false);
    setGuidePosition(null);
  }, [controller.step]);
  const exit = (join: boolean) => { if (!completed) recordTutorialMetric({ kind: 'abandoned', chapter: controller.chapter }); onExit(join); };
  const cameraTravel = useCallback((degrees: number) => { if (controller.look(degrees)) changed(); }, [controller, changed]);
  const beginGuideDrag = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    const guide = guideRef.current;
    if (!guide) return;
    const bounds = guide.getBoundingClientRect();
    guideDrag.current = {
      pointerId: event.pointerId,
      left: event.clientX - bounds.left,
      top: event.clientY - bounds.top,
      width: bounds.width,
      height: bounds.height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setGuidePosition({ left: bounds.left, top: bounds.top });
    setGuideDragging(true);
    event.preventDefault();
  }, []);
  const moveGuide = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = guideDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setGuidePosition(clampGuidePosition(event.clientX - drag.left, event.clientY - drag.top, drag.width, drag.height));
  }, []);
  const endGuideDrag = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (guideDrag.current?.pointerId !== event.pointerId) return;
    guideDrag.current = null;
    setGuideDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);
  const moveGuideWithKeyboard = useCallback((event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const direction = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as const)[event.key as 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown'];
    if (!direction) return;
    const guide = guideRef.current;
    if (!guide) return;
    const bounds = guide.getBoundingClientRect();
    const distance = event.shiftKey ? 4 : 16;
    setGuidePosition(clampGuidePosition(bounds.left + direction[0] * distance, bounds.top + direction[1] * distance, bounds.width, bounds.height));
    event.preventDefault();
  }, []);
  const guideStyle: CSSProperties | undefined = guidePosition ? { left: guidePosition.left, top: guidePosition.top, right: 'auto', bottom: 'auto', transform: 'none' } : undefined;
  return <main className="tutorial-shell" data-focus={focus} data-step={controller.step}>
    {!completed && <MatchView room={client.view()} client={client} connected viewerId={HUMAN} voice={{ enabled: false, iceServers: [], relayConfigured: false }} audioEngine={audio} audioStarted={audioStarted} onEnableAudio={onEnableAudio} onView={changed} onCameraTravel={cameraTravel} guideFocus={focus} onReturnHome={() => exit(false)} />}
    {!completed && <button className="tutorial-exit" type="button" onClick={() => exit(false)}>← EXIT TUTORIAL</button>}
    {!completed ? <aside ref={guideRef} className="tutorial-guide" data-guide-focus={focus} data-dragged={guidePosition ? 'true' : undefined} data-dragging={guideDragging ? 'true' : undefined} style={guideStyle} aria-label="Dealer lesson">
      <header><span>THE DEALER · {controller.chapter}/6</span><span className="tutorial-guide-controls"><button className="tutorial-guide-drag" type="button" aria-label="Move tutorial prompt. Drag, or use the arrow keys." title="Drag to move" onPointerDown={beginGuideDrag} onPointerMove={moveGuide} onPointerUp={endGuideDrag} onPointerCancel={endGuideDrag} onKeyDown={moveGuideWithKeyboard}>MOVE</button></span></header>
      <div className="tutorial-chapters" aria-label={CHAPTERS[controller.chapter - 1]}>{CHAPTERS.map((name, index) => <i key={name} className={index + 1 <= controller.chapter ? 'done' : ''} title={name} />)}</div>
      <h2>{title}</h2><p>{text}</p>
      {CONTINUE.has(controller.step) && <button className="tutorial-continue" type="button" onClick={() => { controller.next(); changed(); }}>CONTINUE →</button>}
      {controller.step === 'practice' && <button className="tutorial-skip" type="button" onClick={() => { controller.skipPractice(); changed(); }}>Skip optional practice</button>}
      <small>TRAINING · TIMERS PAUSED</small>
    </aside> : <section className="tutorial-complete" aria-label="Tutorial complete">
      <h1>Tutorial completed</h1>
      <button className="tutorial-continue" type="button" onClick={() => exit(true)}>JOIN A GAME</button>
      <button type="button" onClick={() => exit(false)}>MAIN MENU</button>
    </section>}
  </main>;
}
