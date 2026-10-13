import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { RoundTasks } from '@the-table/game';
import { TaskList, TasksHud } from './Tasks';
const tasks: RoundTasks = { round: 3, reward: 2, completed: false, replacementUsed: false, opportunityTaken: false, jobs: [{ id: 'trade', status: 'ACTIVE', progress: 0, prerequisites: [] }, { id: 'wildcard', status: 'ACTIVE', progress: 0, prerequisites: [] }] };
describe('private Tasks presentation', () => {
  it('starts collapsed with a discoverable keyboard toggle and no action or acceptance step', () => {
    const html = renderToStaticMarkup(<TasksHud tasks={tasks} />);
    expect(html).toContain('aria-keyshortcuts="J"'); expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('Trade with'); expect(html).not.toContain('dialog');
  });
  it('shows canonical rules and both outcomes without exposing prerequisite instance IDs', () => {
    const completed = structuredClone(tasks); completed.completed = true; completed.jobs[0]!.status = 'COMPLETED'; completed.jobs[1]!.status = 'CANCELLED'; completed.jobs[0]!.prerequisites = ['secret-instance'];
    const html = renderToStaticMarkup(<TaskList tasks={completed} />);
    expect(html).toContain('ROUND 3'); expect(html).toContain('PRIVATE'); expect(html).toContain('CANCELLED'); expect(html).toContain('✓ DONE'); expect(html).not.toContain('secret-instance');
  });
});
