import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import type { AudioEngine } from '@the-table/audio';
import { AUDIO_CUE_IDS } from '@the-table/audio';
import { HUMAN, TutorialController, type TutorialStep } from '@the-table/game/tutorial';
import { ReferenceItemArt } from './ReferenceItemArt';
import { MatchView } from './MatchView';
import { EXIT_DURATION } from './table-exit-presentation';
import { TutorialClient } from './tutorial-client';
import { recordTutorialMetric, saveTutorialPreferences } from './tutorial-storage';
import './tutorial.css';
const CONTINUE = new Set<TutorialStep>(['dealer', 'inventory', 'privacy', 'reward', 'bluff', 'practiceDone', 'income', 'objective', 'burn']);
const AUTO_ADVANCE_MS: Partial<Record<TutorialStep, number>> = { privacy: 2500, reward: 1700, bluff: 1500, income: 1600, objective: 2500, burn: 2500 };
const CHAPTERS = ['Take a seat', 'Trade & Tasks', 'Threats & bluffs', 'Stay alive', 'Spend & explore', 'Wildcard & exit'];
const TRADE_TRAIL = ['TRADE', 'THE DEALER', 'KEY', '2 GOLD', 'SEND'];
const STRIPS: Partial<Record<TutorialStep, [string, string]>> = {
  look: ['LOOK AROUND THE TABLE', 'MOUSE / TRACKPAD · DRAG TO LOOK'],
  pocket: ['PUT MEDICINE IN YOUR POCKET', 'Open Pockets, select Medicine, then place it.'],
  refuse: ['REFUSE THE COVERED THREAT', 'The hidden item may be real or a bluff. REFUSE to call it.'],
  practice: ['MAKE A COVERED THREAT', 'Cover your Knife with Cloth. Demand 1 Gold from The Dealer.'],
  downed: ['DOWNED — NOT DEAD', 'Revive with Medicine before The Dealer’s next normal turn.'],
  publicShop: ['BUY A KEY AT THE PUBLIC SHOP', 'Shared stock. If someone buys it, it is gone.'],
  blackMarket: ['YOUR PRIVATE BLACK MARKET', 'Only you can see these offers. Buy the Antidote.'],
  chest: ['OPEN THE STANDARD CHEST', 'Use your Key.'],
  draw: ['DRAW A WILDCARD', 'Once per match. Costs your Primary Action.'],
  use: ['USE THE WILDCARD', 'USE reveals the card. BURN keeps its identity secret.'],
  seize: ['CHOOSE THE DEALER', 'Select a visible item, then resolve SEIZE.'],
  exit: ['LEAVE THE TABLE', 'Your Contract is complete. Use the door prompt.'],
};
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
  const [guideHeight, setGuideHeight] = useState(126);
  const [completionVisible, setCompletionVisible] = useState(false);
  const [tradeStage, setTradeStage] = useState(0);
  const recorded = useRef(0);
  const spokenStep = useRef<TutorialStep | null>(null);
  const completed = controller.step === 'complete';
  const { title: lessonTitle, text: lessonText, focus } = controller.instruction;
  const tradeTitles = ['OPEN TRADE', 'CHOOSE THE DEALER', 'GIVE YOUR KEY', 'ASK FOR 2 GOLD', 'SEND THE OFFER'];
  const [title, text] = controller.step === 'trade' ? [tradeTitles[tradeStage]!, 'Give your Key to The Dealer in exchange for 2 Gold.'] : STRIPS[controller.step] ?? [lessonTitle, lessonText];
  useEffect(() => {
    if (!completed) { setCompletionVisible(false); return; }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setCompletionVisible(true); return; }
    const timer = window.setTimeout(() => setCompletionVisible(true), EXIT_DURATION * 1000);
    return () => window.clearTimeout(timer);
  }, [completed]);
  useEffect(() => {
    const guide = guideRef.current;
    if (!guide) return;
    const resize = () => setGuideHeight(guide.getBoundingClientRect().height);
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(guide);
    return () => observer.disconnect();
  }, [completed]);
  useEffect(() => {
    if (controller.step !== 'trade') return;
    let frame = 0;
    let ring: Element | null = null;
    const update = () => {
      ring?.removeAttribute('data-tutorial-target');
      const form = document.querySelector<HTMLFormElement>('.tutorial-shell .reference-trade');
      let stage = 0;
      if (form) {
        const target = form.querySelector<HTMLSelectElement>('[name="targetId"]');
        const key = controller.room.players.find(player => player.id === HUMAN)?.inventory.visible.find(item => item?.itemId === 'key');
        const selected = [...form.querySelectorAll<HTMLInputElement>('[name="offeredItems"]')].find(input => input.value === key?.instanceId);
        const gold = form.querySelector<HTMLInputElement>('[name="requestedCoins"]');
        stage = target?.value !== 'dealer' ? 1 : !selected?.checked ? 2 : Number(gold?.value) !== 2 ? 3 : 4;
        ring = stage === 1 ? target : stage === 2 ? selected?.closest('.asset-tile') ?? null : stage === 3 ? gold?.closest('.reference-coin-stepper') ?? null : form.querySelector('[aria-label="Propose Trade"]');
        ring?.setAttribute('data-tutorial-target', 'true');
      }
      setTradeStage(stage);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    update();
    const observer = new MutationObserver(schedule);
    const match = document.querySelector('.tutorial-shell .match-viewport');
    if (match) observer.observe(match, { childList: true, subtree: true });
    document.addEventListener('input', schedule, true);
    document.addEventListener('change', schedule, true);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); document.removeEventListener('input', schedule, true); document.removeEventListener('change', schedule, true); ring?.removeAttribute('data-tutorial-target'); };
  }, [controller, controller.step]);
  useEffect(() => {
    saveTutorialPreferences({ tutorialLastChapter: controller.chapter, skippedForNow: true, ...(completed ? { tutorialCompleted: true } : {}) });
    for (const metric of controller.metrics.slice(recorded.current)) recordTutorialMetric(metric);
    recorded.current = controller.metrics.length;
  });
  useEffect(() => {
    if (!audioStarted || spokenStep.current === controller.step) return;
    spokenStep.current = controller.step;
    audio.play(AUDIO_CUE_IDS.tutorialPage);
  }, [audio, audioStarted, controller.step]);
  useEffect(() => {
    const step = controller.step;
    const duration = AUTO_ADVANCE_MS[step];
    if (duration === undefined) return;
    const timer = window.setTimeout(() => {
      if (controller.step !== step) return;
      controller.next();
      changed();
    }, duration);
    return () => window.clearTimeout(timer);
  }, [controller, controller.step, changed]);
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
  const cameraLook = useCallback((headingDegrees: number) => { if (controller.look(headingDegrees)) changed(); }, [controller, changed]);
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
  return <main className="tutorial-shell" data-focus={focus} data-step={controller.step} style={{ '--tutorial-guide-height': `${guideHeight}px` } as CSSProperties}>
    {!completionVisible && <MatchView room={client.view()} client={client} connected viewerId={HUMAN} voice={{ enabled: false, iceServers: [], relayConfigured: false }} audioEngine={audio} audioStarted={audioStarted} onEnableAudio={onEnableAudio} onView={changed} onCameraTravel={cameraLook} guideFocus={focus} onReturnHome={() => exit(false)} />}
    {!completed && <button className="tutorial-exit" type="button" onClick={() => exit(false)}>← EXIT TUTORIAL</button>}
    {!completed ? <aside ref={guideRef} className="tutorial-guide" data-guide-focus={focus} data-dragged={guidePosition ? 'true' : undefined} data-dragging={guideDragging ? 'true' : undefined} style={guideStyle} aria-label="Dealer lesson">
      <header><span>THE DEALER · {controller.chapter}/6</span><span className="tutorial-guide-controls"><button className="tutorial-guide-drag" type="button" aria-label="Move tutorial prompt. Drag, or use the arrow keys." title="Drag to move" onPointerDown={beginGuideDrag} onPointerMove={moveGuide} onPointerUp={endGuideDrag} onPointerCancel={endGuideDrag} onKeyDown={moveGuideWithKeyboard}>MOVE</button></span></header>
      <div className="tutorial-chapters" aria-label={CHAPTERS[controller.chapter - 1]}>{CHAPTERS.map((name, index) => <i key={name} className={index + 1 <= controller.chapter ? 'done' : ''} title={name} />)}</div>
      <h2><span className="tutorial-instruction-marker" aria-hidden="true">◆</span>{title}</h2>
      {controller.step === 'privacy' ? <div className="tutorial-privacy"><div><small>YOU SEE</small><span><ReferenceItemArt itemId="medicine" size={28} label="" />MEDICINE</span></div><div><small>THE DEALER SEES</small><span>◆ POCKET OCCUPIED</span></div></div> : <p>{text}</p>}
      {controller.step === 'trade' && <ol className="tutorial-trade-trail" aria-label="Trade lesson steps">{TRADE_TRAIL.map((step, index) => <li key={step} aria-current={index === tradeStage ? 'step' : undefined} data-done={index < tradeStage || undefined}>{index < tradeStage ? '✓ ' : index === tradeStage ? '▸ ' : ''}{step}</li>)}</ol>}
      {CONTINUE.has(controller.step) && <button className="tutorial-continue" type="button" onClick={() => { controller.next(); changed(); }}>CONTINUE →</button>}
      {controller.step === 'practice' && <button className="tutorial-skip" type="button" onClick={() => { controller.skipPractice(); changed(); }}>Skip optional practice</button>}
      <small>TRAINING · TIMERS PAUSED</small>
    </aside> : completionVisible && <section className="tutorial-complete" aria-label="Tutorial complete">
      <h1>Tutorial completed</h1>
      <button className="tutorial-continue" type="button" onClick={() => exit(true)}>JOIN A GAME</button>
      <button type="button" onClick={() => { Object.assign(controller, new TutorialController()); recorded.current = 0; spokenStep.current = null; recordTutorialMetric({ kind: 'replayed', chapter: 1 }); setGuidePosition(null); setCompletionVisible(false); changed(); }}>PLAY AGAIN</button>
      <button type="button" onClick={() => exit(false)}>MAIN MENU</button>
    </section>}
  </main>;
}
