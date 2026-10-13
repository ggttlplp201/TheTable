import { useEffect, useRef, useState } from 'react';
import { TASKS, type TaskId } from '@the-table/content';
import type { RoundTasks } from '@the-table/game';
import type { AudioEngine } from '@the-table/audio';
import { jobIconURL } from './reference-game-kit.js';
import { ReferenceItemArt } from './ReferenceItemArt';
import './tasks.css';

const ART: Record<TaskId, string> = { trade: 'deal', damage: 'blood', extort: 'debt', heal: 'patch', revive: 'revive', loot: 'fallen', 'open-chest': 'crack', 'inspect-pocket': 'look', pickpocket: 'sticky', 'break-armor': 'guard', 'call-bluff': 'callbluff', bluff: 'sellbluff', wildcard: 'table', 'receive-coins': 'pay' };
const icons = new Map<TaskId, string>();
function TaskIcon({ id }: { id: TaskId }) {
  const [src, setSrc] = useState(icons.get(id));
  useEffect(() => { const url = icons.get(id) ?? jobIconURL(ART[id], '#d8ccb0'); icons.set(id, url); setSrc(url); }, [id]);
  return src ? <img src={src} width={32} height={32} alt="" /> : <span className="task-icon" />;
}
export function TaskList({ tasks }: { tasks: RoundTasks }) {
  return <><header><span>ROUND {tasks.round} · TASKS</span><small>PRIVATE</small></header><p>Complete either one for <b>+{tasks.reward} GOLD <ReferenceItemArt itemId="coin" size={20} label="" /></b></p>
    <ul>{tasks.jobs.map(task => { const definition = TASKS.find(value => value.id === task.id)!; return <li key={task.id} data-status={task.status}><TaskIcon id={task.id} /><div><strong>{definition.name}</strong><span>{definition.description}</span></div><small>{task.status === 'COMPLETED' ? '✓ DONE' : task.status === 'CANCELLED' ? 'CANCELLED' : task.status === 'EXPIRED' ? 'EXPIRED' : ''}</small></li>; })}</ul></>;
}
/** Receives only the authenticated owner's projection. No public task lookup exists. */
export function TasksHud({ tasks, audio }: { tasks: RoundTasks; audio?: Pick<AudioEngine, 'play'> | undefined }) {
  const [open, setOpen] = useState(false);
  const [beat, setBeat] = useState<'reveal' | 'complete' | null>(null);
  const [completionStage, setCompletionStage] = useState(0);
  const seen = useRef({ round: -1, completed: tasks.completed });
  useEffect(() => {
    if (seen.current.round !== tasks.round) {
      setBeat('reveal'); setOpen(false); audio?.play('task.reveal');
    } else if (tasks.completed && !seen.current.completed) {
      setBeat('complete'); setOpen(false); setCompletionStage(0); audio?.play('task.stamp');
    }
    seen.current = { round: tasks.round, completed: tasks.completed };
  }, [tasks.round, tasks.completed, audio]);
  // Timer setup must be replayable on its own. React StrictMode (and a change
  // in audio readiness) may clean up an effect after the round was observed.
  useEffect(() => {
    if (!beat) return;
    const timers: number[] = [];
    if (beat === 'complete') {
      timers.push(window.setTimeout(() => { setCompletionStage(1); audio?.play('task.coin'); }, 450));
      timers.push(window.setTimeout(() => { setCompletionStage(2); audio?.play('task.cancel'); }, 800));
    }
    timers.push(window.setTimeout(() => setBeat(null), beat === 'complete' ? 1700 : 1500));
    return () => timers.forEach(timer => window.clearTimeout(timer));
  }, [beat, tasks.round, audio]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || (event.target as HTMLElement)?.closest('input,textarea,select,[contenteditable="true"]')) return;
      if (event.key.toLowerCase() === 'j') { event.preventDefault(); setOpen(value => !value); }
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, []);
  const expanded = open || beat !== null;
  return <aside className="tasks-hud" aria-label="Your private Tasks">
    {expanded && <div className={`tasks-popup${beat ? ` tasks-${beat}` : ''}`} id="private-tasks" role={beat ? 'status' : undefined} data-completion-stage={completionStage}>
      {beat === 'complete' && <div className="tasks-completion"><strong>TASK COMPLETE</strong><b>+{tasks.reward} <ReferenceItemArt itemId="coin" size={20} label="Gold" /></b></div>}
      <TaskList tasks={tasks} />
    </div>}
    <button type="button" aria-keyshortcuts="J" aria-expanded={expanded} aria-controls="private-tasks" onClick={() => setOpen(value => !value)}><kbd>J</kbd> {tasks.completed ? '✓ TASKS · DONE' : 'TASKS · 0 / 1'}</button>
  </aside>;
}
