import { useEffect, useRef, useState } from 'react';
import { TASKS, type TaskId } from '@the-table/content';
import type { RoundTasks } from '@the-table/game';
import type { AudioEngine } from '@the-table/audio';
import { jobIconURL } from './reference-game-kit.js';
import { CoinAmount, ReferenceItemArt } from './ReferenceItemArt';
import { createPortal } from 'react-dom';
import './tasks.css';

const ART: Record<TaskId, string> = { trade: 'deal', damage: 'blood', extort: 'debt', heal: 'patch', revive: 'revive', loot: 'fallen', 'open-chest': 'crack', 'inspect-pocket': 'look', pickpocket: 'sticky', 'break-armor': 'guard', 'call-bluff': 'callbluff', bluff: 'sellbluff', wildcard: 'table', 'receive-coins': 'pay' };
const icons = new Map<TaskId, string>();
function TaskIcon({ id }: { id: TaskId }) {
  const [src, setSrc] = useState(icons.get(id));
  useEffect(() => { const url = icons.get(id) ?? jobIconURL(ART[id], '#d8ccb0'); icons.set(id, url); setSrc(url); }, [id]);
  return src ? <img src={src} width={32} height={32} alt="" /> : <span className="task-icon" />;
}
export const TASK_COMPLETION_HOLD_MS = 1500;
export const TASK_FOLD_MS = 200;
export function TaskList({ tasks, completionStage }: { tasks: RoundTasks; completionStage?: number }) {
  return <><header><span>{completionStage !== undefined ? 'TASK COMPLETE' : `ROUND ${tasks.round} · TASKS`}</span></header>
    <ul>{tasks.jobs.map(task => {
      const definition = TASKS.find(value => value.id === task.id)!;
      const status = task.status === 'CANCELLED' && completionStage !== undefined && completionStage < 2 ? 'ACTIVE' : task.status;
      return <li key={task.id} data-status={status}><TaskIcon id={task.id} /><div className="task-copy"><strong>{definition.name.toUpperCase()}</strong><span>{status === 'CANCELLED' ? 'CANCELLED' : definition.description}</span>{status === 'COMPLETED' && <small className="task-stamp" aria-label="✓ DONE">COMPLETE</small>}{status === 'EXPIRED' && <small>EXPIRED</small>}</div><b className="task-reward">+{tasks.reward}<ReferenceItemArt itemId="coin" size={22} label="Gold" /></b></li>;
    })}</ul></>;
}
/** Receives only the authenticated owner's projection. No public task lookup exists. */
export function TasksHud({ tasks, audio }: { tasks: RoundTasks; audio?: Pick<AudioEngine, 'play'> | undefined }) {
  const [open, setOpen] = useState(false);
  const [beat, setBeat] = useState<'reveal' | 'complete' | null>(null);
  const [completionStage, setCompletionStage] = useState(0);
  const hud = useRef<HTMLElement>(null);
  const [goldFeedback, setGoldFeedback] = useState<{ row: Element; total: Element; before: number } | null>(null);
  const audioRef = useRef(audio);
  audioRef.current = audio;
  const seen = useRef({ round: -1, completed: tasks.completed });
  useEffect(() => {
    if (seen.current.round !== tasks.round) {
      setBeat('reveal'); setOpen(false); audioRef.current?.play('task.reveal');
    } else if (tasks.completed && !seen.current.completed) {
      setBeat('complete'); setOpen(false); setCompletionStage(0); audioRef.current?.play('task.stamp');
    }
    seen.current = { round: tasks.round, completed: tasks.completed };
  }, [tasks.round, tasks.completed]);
  // Timer setup is replayable independently of observing the round, including StrictMode.
  useEffect(() => {
    if (!beat) return;
    const timers: number[] = [];
    if (beat === 'complete') {
      const row = [...hud.current?.closest('.match-viewport')?.querySelectorAll('.self-vital-row') ?? []].find(row => row.firstElementChild?.textContent === 'GOLD');
      const total = row?.querySelector('strong');
      const amount = Number.parseInt(total?.querySelector('.coin-amount')?.textContent ?? '', 10);
      setGoldFeedback(row && total && Number.isFinite(amount) ? { row, total, before: Math.max(0, amount - tasks.reward) } : null);
      timers.push(window.setTimeout(() => { setCompletionStage(1); audioRef.current?.play('task.coin'); }, 450));
      timers.push(window.setTimeout(() => { setCompletionStage(2); audioRef.current?.play('task.cancel'); }, 800));
      timers.push(window.setTimeout(() => setCompletionStage(3), TASK_COMPLETION_HOLD_MS));
    }
    timers.push(window.setTimeout(() => setBeat(null), beat === 'complete' ? TASK_COMPLETION_HOLD_MS + TASK_FOLD_MS : 1500));
    return () => timers.forEach(timer => window.clearTimeout(timer));
  }, [beat, tasks.round]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || (event.target as HTMLElement)?.closest('input,textarea,select,[contenteditable="true"]')) return;
      if (event.defaultPrevented) return;
      if (event.key.toLowerCase() === 'j') { event.preventDefault(); setBeat(null); setOpen(!(open || beat !== null)); }
      if (event.key === 'Escape') { setBeat(null); setOpen(false); }
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [open, beat]);
  const expanded = open || beat !== null;
  return <aside ref={hud} className="tasks-hud" aria-label="Your private Tasks">
    {expanded && <div className={`tasks-popup${beat ? ` tasks-${beat}` : ''}`} id="private-tasks" role={beat ? 'status' : undefined} data-completion-stage={completionStage}>
      <TaskList tasks={tasks} {...(beat === 'complete' ? { completionStage } : {})} />
      {beat === 'complete' && <p className="tasks-completion" aria-live="polite">+{tasks.reward} GOLD<ReferenceItemArt itemId="coin" size={20} label="" /></p>}
    </div>}
    <button className="tasks-tab" type="button" aria-keyshortcuts="J" aria-expanded={expanded} aria-controls="private-tasks" onClick={() => { setBeat(null); setOpen(!expanded); }}><kbd>J</kbd> {tasks.completed ? '✓ TASKS · DONE' : 'TASKS · 0 / 1'}</button>
    {goldFeedback && beat === 'complete' && completionStage === 0 && createPortal(<span className="task-gold-pending"><CoinAmount amount={goldFeedback.before} /></span>, goldFeedback.total)}
    {goldFeedback && beat === 'complete' && completionStage > 0 && createPortal(<span className="task-gold-gain" aria-label={`Task reward: ${tasks.reward} Gold`}>+{tasks.reward}</span>, goldFeedback.row)}
  </aside>;
}
