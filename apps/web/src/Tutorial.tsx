import { useCallback, useEffect, useRef, useState } from 'react';
import type { AudioEngine } from '@the-table/audio';
import { AUDIO_CUE_IDS } from '@the-table/audio';
import { HUMAN, TutorialController, type TutorialStep } from '@the-table/game/tutorial';
import { MatchView } from './MatchView';
import { TutorialClient } from './tutorial-client';
import { recordTutorialMetric, saveTutorialPreferences } from './tutorial-storage';
import './tutorial.css';
const CONTINUE = new Set<TutorialStep>(['dealer', 'inventory', 'privacy', 'reward', 'bluff', 'practiceDone', 'income', 'objective', 'burn']);
const CHAPTERS = ['Take a seat', 'Trade & Tasks', 'Threats & bluffs', 'Stay alive', 'Spend & explore', 'Wildcard & exit'];
const SKILLS = ['Hide items', 'Trade', 'Threaten / call a bluff', 'Survive being Downed', 'Complete Tasks', 'Earn and spend Gold', 'Open Chests', 'Complete a Contract', 'Use a Wildcard', 'Leave the table'];
export default function Tutorial({ chapter, audio, audioStarted, onEnableAudio, onExit, onReplay }: { chapter: number; audio: AudioEngine; audioStarted: boolean; onEnableAudio: () => void; onExit: (join: boolean) => void; onReplay: () => void }) {
  const [, refresh] = useState(0);
  const [controller] = useState(() => { const value = new TutorialController(); value.resume(chapter); return value; });
  const changed = useCallback(() => refresh(value => value + 1), []);
  const [client] = useState(() => new TutorialClient(controller, changed));
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
  const exit = (join: boolean) => { if (!completed) recordTutorialMetric({ kind: 'abandoned', chapter: controller.chapter }); onExit(join); };
  const cameraTravel = useCallback((degrees: number) => { if (controller.look(degrees)) changed(); }, [controller, changed]);
  return <main className="tutorial-shell" data-focus={focus} data-step={controller.step}>
    {!completed && <MatchView room={client.view()} client={client} connected viewerId={HUMAN} voice={{ enabled: false, iceServers: [], relayConfigured: false }} audioEngine={audio} audioStarted={audioStarted} onEnableAudio={onEnableAudio} onView={changed} onCameraTravel={cameraTravel} guideFocus={focus} onReturnHome={() => exit(false)} />}
    {!completed ? <aside className="tutorial-guide" aria-label="Dealer lesson">
      <header><span>THE DEALER · {controller.chapter}/6</span><button type="button" aria-label="Save tutorial and return to menu" onClick={() => exit(false)}>×</button></header>
      <div className="tutorial-chapters" aria-label={CHAPTERS[controller.chapter - 1]}>{CHAPTERS.map((name, index) => <i key={name} className={index + 1 <= controller.chapter ? 'done' : ''} title={name} />)}</div>
      <h2>{title}</h2><p>{text}</p>
      {CONTINUE.has(controller.step) && <button className="tutorial-continue" type="button" onClick={() => { controller.next(); changed(); }}>CONTINUE →</button>}
      {controller.step === 'practice' && <button className="tutorial-skip" type="button" onClick={() => { controller.skipPractice(); changed(); }}>Skip optional practice</button>}
      <small>TRAINING · TIMERS PAUSED</small>
    </aside> : <section className="tutorial-complete" aria-label="Tutorial complete">
      <span>LESSON COMPLETE</span><h1>You're ready for The Table</h1>
      <ul>{SKILLS.map(skill => <li key={skill}>✓ {skill}</li>)}</ul>
      <p>3–4 players. Secret Objectives.<br />Trust nobody completely.</p>
      <button className="tutorial-continue" type="button" onClick={() => exit(true)}>JOIN A GAME</button>
      <button type="button" onClick={() => { recordTutorialMetric({ kind: 'replayed', chapter: 1 }); onReplay(); }}>PLAY TUTORIAL AGAIN</button>
      <button type="button" onClick={() => exit(false)}>MAIN MENU</button>
    </section>}
  </main>;
}
