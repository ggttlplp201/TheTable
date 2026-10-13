import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

// Start all context closures together so one browser-context hang cannot leave
// the other players recording indefinitely. Unknown failures remain explicit.
export async function finalizePlayers(sessions, directory, onStage = async () => {}) {
  return Promise.allSettled([...sessions].map(async ([player, session]) => {
    let stage = 'closing-context';
    try {
      await onStage(player, stage);
      await session.context.close();
      stage = 'saving-video';
      await onStage(player, stage);
      await session.page.video().saveAs(resolve(directory, `player-${player}-video.webm`));
      await onStage(player, 'complete');
      return player;
    } catch (error) {
      await onStage(player, 'failed', { failedStage: stage, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }));
}

async function selfTest() {
  let release;
  const held = new Promise(resolve => { release = resolve; });
  const calls = [], stages = [];
  const sessions = new Map(['a', 'b', 'c', 'd'].map(player => [player, {
    context: { close: async () => { calls.push(`close-${player}`); if (player === 'a') await held; if (player === 'd') throw new Error('synthetic close failure'); } },
    page: { video: () => ({ saveAs: async path => { calls.push(`save-${player}`); assert.ok(path.endsWith(`player-${player}-video.webm`)); } }) },
  }]));
  const pending = finalizePlayers(sessions, '/synthetic', async (p, stage, details) => stages.push({ p, stage, details }));
  await new Promise(resolve => setImmediate(resolve));
  for (const player of ['a', 'b', 'c', 'd']) assert.ok(calls.includes(`close-${player}`));
  for (const player of ['b', 'c']) assert.ok(calls.includes(`save-${player}`));
  assert.ok(!calls.includes('save-a'));
  assert.ok(!calls.includes('save-d'));
  release();
  const results = await pending;
  assert.deepEqual(results.map(r => r.status), ['fulfilled', 'fulfilled', 'fulfilled', 'rejected']);
  assert.equal(stages.find(s => s.p === 'd' && s.stage === 'failed').details.failedStage, 'closing-context');
  assert.ok(stages.some(s => s.p === 'a' && s.stage === 'complete'));
  console.log('Synthetic finalization checks passed: stalled first close does not block other closes/saves; failures are retained per player.');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] !== '--self-test') throw new Error('Use --self-test');
  await selfTest();
}
