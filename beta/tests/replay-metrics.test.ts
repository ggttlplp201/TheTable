import { afterEach, describe, expect, it } from 'vitest';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { assignEventRounds, calculateMetrics, parseResults, parseResultSummary } from '../runner/metrics.js';
import type { EvidenceEvent, MetricsInput } from '../runner/metrics.js';
import { ReplayRecorder } from '../runner/replay-recorder.js';
import { FINDINGS_SECTIONS, generateFindings } from '../runner/reviewer.js';
const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true }))); });
async function temporary() { const dir = await mkdtemp(path.join(os.tmpdir(), 'table-beta-evidence-')); directories.push(dir); return dir; }
function event(sequence: number, text: string): EvidenceEvent { return { id: `event-${sequence}`, sequence, text, firstObservedAt: new Date(1000 * sequence).toISOString(), roundObserved: 9, round: null, observers: ['a'], evidence: [`player-a/observations.jsonl#${sequence}`] }; }
function input(events: EvidenceEvent[]): MetricsInput { return { matchId: 'match-test', status: 'completed', startedAt: new Date(0).toISOString(), endedAt: new Date(10_000).toISOString(), events, roundsObserved: [1, 2], results: [], noMeaningfulActions: [] }; }
const start = 'Starting inventories are revealed. Round 1 begins.';
const end = 'The match has ended.';
function recorder(directory: string) { return new ReplayRecorder(directory, { matchId: 'match-001', kind: 'smoke', startedAt: new Date(0).toISOString(), assignments: [], rulesFingerprint: 'test', model: 'test' }); }
async function feedback(directory: string, status = 'complete') {
  for (const player of ['a', 'b', 'c', 'd']) {
    await writeFile(path.join(directory, `player-${player}-feedback.md`), '# Independent feedback\n');
    await writeFile(path.join(directory, `player-${player}-feedback.json`), JSON.stringify({ status, answers: Array.from({ length: 18 }, (_, index) => ({ question: `Question ${index}`, answer: 'Observed response.' })) }));
  }
}

describe('UI-evidence metrics', () => {
  it('deduces rounds from complete sequence rather than the later observation header', () => {
    const rounds = assignEventRounds([event(1, start), event(2, "Ada's turn begins."), event(3, 'Intermission begins; both markets refresh.'), event(4, 'Ada purchased an item.'), event(5, 'Standard Chest is available.'), event(6, "Bruno's turn begins."), event(7, 'Bruno offered a Trade to Ada.')]);
    expect(rounds.map(row => row.round)).toEqual([1, 1, 1, null, null, 2, 2]);
    expect(calculateMetrics(input([...rounds, event(8, end)])).firstInteractionRound.trade?.value).toBe(2);
  });
  it('does not fabricate zeroes, rounds, sources, or timeout distinctions', () => {
    const metrics = calculateMetrics(input([event(1, start), event(3, 'Ada took 2 damage.'), event(4, 'Ada declined the Trade.'), event(5, end)]));
    expect(metrics.coverage.missingSequences).toEqual([2]);
    expect(metrics.counters.pistolShots).toMatchObject({ value: null, observedMinimum: 0 });
    expect(metrics.counters.damageReceived).toMatchObject({ value: null, observedMinimum: 2 });
    expect(metrics.counters.damageDealt?.value).toBeNull();
    expect(metrics.counters.poisonTicks?.value).toBeNull();
    expect(metrics.counters.tradesDeclined?.value).toBeNull();
    expect(metrics.counters.tradeTimeouts?.value).toBeNull();
    expect(metrics.firstInteractionRound.damage?.value).toBeNull();
  });
  it('counts zero only when an observable event family has uninterrupted completed history', () => {
    const metrics = calculateMetrics(input([event(1, start), event(2, 'Ada used Pistol.'), event(3, 'Bruno took 3 damage.'), event(4, end)]));
    expect(metrics.counters.pistolShots?.value).toBe(1);
    expect(metrics.counters.knifeUses?.value).toBe(0);
    expect(metrics.counters.damageReceived?.value).toBe(3);
    expect(metrics.counters.coinsSpent?.value).toBeNull();
    expect(metrics.firstInteractionRound.trade?.value).toBeNull();
  });
  it('uses visible final-results duration and rounds without inventing missing terminal events', () => {
    const fixture = input([event(1, start), event(2, "Ada's turn begins.")]);
    fixture.resultSummary = parseResultSummary('The table empties\nMATCH · 4 ROUNDS · 3:07');
    const metrics = calculateMetrics(fixture);
    expect(metrics.durationMs).toMatchObject({ value: 187000, evidence: ['results.txt'] });
    expect(metrics.totalRounds.value).toBe(4);
    expect(metrics.coverage.completePublicEventLog).toBe(false);
    expect(metrics.counters.pistolShots).toMatchObject({ value: null, observedMinimum: 0 });
  });
  it('does not turn several no-action decisions into distinct dead turns', () => {
    const fixture = input([event(1, start), event(2, end)]);
    fixture.noMeaningfulActions = [1, 2].map(index => ({ playerId: 'a', observationId: `o${index}`, evidence: `e${index}` }));
    expect(calculateMetrics(fixture).counters.turnsWithNoMeaningfulAction?.value).toBeNull();
    fixture.noMeaningfulActions = fixture.noMeaningfulActions.map(row => ({ ...row, turnKey: 'turn-1' }));
    expect(calculateMetrics(fixture).counters.turnsWithNoMeaningfulAction?.value).toBe(1);
  });
  it('does not count self-revival as the first player-versus-player interaction', () => {
    const metrics = calculateMetrics(input([event(1, start), event(2, 'Ada revived Ada to 2 HP.'), event(3, 'Intermission begins; both markets refresh.'), event(4, "Ada's turn begins."), event(5, 'Ada offered a Trade to Bruno.'), event(6, end)]));
    expect(metrics.firstInteractionRound.playerVsPlayer?.value).toBe(2);
  });
  it('reads final scores only from actual tab-separated results rows', () => {
    expect(parseResults('EXIT\tPLAYER\tROLE\tOBJECTIVE\tRESULT\tPTS\n1\tADA\tBROKER\tCollector ✓\t⤴ ESCAPED\t100\n—\tBRUNO\tGUARD\tObjective unrevealed\tSTAYED\t0')).toEqual([
      { name: 'ADA', role: 'BROKER', objective: 'Collector', exitOrder: 1, result: '⤴ ESCAPED', score: 100 },
      { name: 'BRUNO', role: 'GUARD', objective: null, exitOrder: null, result: 'STAYED', score: 0 },
    ]);
    expect(parseResults('Ada probably won with 100 points')).toEqual([]);
  });
});

describe('replay boundaries', () => {
  it('deduplicates public events and keeps private text out of aggregate chronology', async () => {
    const directory = await temporary(), replay = recorder(directory);
    for (const playerId of ['a', 'b'] as const) await replay.recordObservation({ id: `${playerId}-1`, playerId, capturedAt: new Date(1000).toISOString(), round: 1, text: `${playerId} private pocket secret`, visibleEvents: [{ sequence: 1, text: start }] });
    await replay.recordAction({ playerId: 'a', at: new Date(2000).toISOString(), observationId: 'a-1', action: { type: 'click', controlId: 'attack' }, outcome: 'performed' });
    await replay.finalize({ status: 'blocked', endedAt: new Date(3000).toISOString(), feedbackComplete: false });
    const raw = await readFile(path.join(directory, 'replay.json'), 'utf8');
    const saved = JSON.parse(raw) as { events: EvidenceEvent[] };
    expect(saved.events).toHaveLength(1);
    expect(saved.events[0]?.observers).toEqual(['a', 'b']);
    expect(raw).not.toContain('private pocket secret');
    expect(raw).not.toContain('attack');
    expect(await readFile(path.join(directory, 'player-a/observations.jsonl'), 'utf8')).toContain('a private pocket secret');
  });
  it('refuses result aggregation when interviews have not been completed', async () => {
    const directory = await temporary(), replay = recorder(directory);
    await replay.recordObservation({ id: 'a-1', playerId: 'a', capturedAt: new Date(1).toISOString(), round: 1, text: '', visibleEvents: [] });
    await feedback(directory, 'incomplete');
    await expect(replay.recordResults('secret objectives')).rejects.toThrow(/complete independent interview/);
    expect(await readFile(path.join(directory, 'results.txt'), 'utf8').catch(() => null)).toBeNull();
    await expect(replay.finalize({ status: 'blocked', endedAt: new Date(2000).toISOString(), feedbackComplete: false })).resolves.toMatchObject({ status: 'blocked' });
  });
  it('requires separate reviews and synthesis even when all 23 evidence packages exist', async () => {
    const directory = await temporary(), template = path.join(directory, 'template'), replaysDir = path.join(directory, 'replays');
    const replay = recorder(template);
    await replay.recordObservation({ id: 'a-1', playerId: 'a', capturedAt: new Date(1000).toISOString(), round: 1, text: '', visibleEvents: [{ sequence: 1, text: start }] });
    await replay.recordObservation({ id: 'a-2', playerId: 'a', capturedAt: new Date(3000).toISOString(), round: 1, text: '', visibleEvents: [{ sequence: 1, text: start }, { sequence: 2, text: "Ada's turn begins." }] });
    await feedback(template);
    await replay.recordResults(['A', 'B', 'C', 'D'].map((name, index) => `${index + 1}\t${name}\tROLE\tObjective ✓\tESCAPED\t100`).join('\n'));
    for (const player of ['a', 'b', 'c', 'd']) {
      await writeFile(path.join(template, `player-${player}-video.webm`), 'test video fixture');
      await writeFile(path.join(template, 'screenshots', `player-${player}-00001-final.png`), 'test screenshot fixture');
    }
    await replay.finalize({ status: 'completed', endedAt: new Date(4000).toISOString(), feedbackComplete: true });
    await mkdir(replaysDir);
    for (let index = 0; index < 23; index++) {
      const target = path.join(replaysDir, `match-${index}`);
      await cp(template, target, { recursive: true });
      const artifact = JSON.parse(await readFile(path.join(target, 'replay.json'), 'utf8')) as { metadata: { matchId: string; kind: string } };
      artifact.metadata.matchId = `match-${index}`;
      artifact.metadata.kind = index < 3 ? 'smoke' : 'full';
      await writeFile(path.join(target, 'replay.json'), JSON.stringify(artifact));
    }
    const aggregate = async () => JSON.parse(await readFile(path.join(directory, 'aggregate-metrics.json'), 'utf8')) as { evidenceGatePassed: boolean; completionGatePassed: boolean; independentReview: { passed: boolean } };
    await generateFindings({ replaysDir, outputDir: directory });
    expect(await aggregate()).toMatchObject({ evidenceGatePassed: true, completionGatePassed: false });
    await generateFindings({ replaysDir, outputDir: directory, complete: async () => { throw new Error('Reviewer unavailable'); } });
    expect(await aggregate()).toMatchObject({ completionGatePassed: false, independentReview: { passed: false } });
    const imageSamples: string[][] = [];
    await generateFindings({ replaysDir, outputDir: directory, complete: async request => {
      if (request.images) { imageSamples.push(request.images); return 'Review completed using attached test evidence.'; }
      return FINDINGS_SECTIONS.map(section => `## ${section}\n\nNo supported balance recommendation.`).join('\n\n');
    } });
    expect(await aggregate()).toMatchObject({ completionGatePassed: true, independentReview: { passed: true } });
    expect(imageSamples).toHaveLength(23);
    for (const sample of imageSamples) for (const player of ['a', 'b', 'c', 'd']) expect(sample.some(file => path.basename(file).startsWith(`player-${player}-`))).toBe(true);
  }, 20_000);
  it('reviews every oversized dossier chunk only after four interviews, and propagates partial review failures', async () => {
    const directory = await temporary(), replaysDir = path.join(directory, 'replays'), matchDir = path.join(replaysDir, 'match-001');
    const replay = recorder(matchDir);
    await replay.recordObservation({ id: 'private-long-a', playerId: 'a', capturedAt: new Date(1000).toISOString(), round: 1, text: `BEGIN_PRIVATE_A\n${'Visible private observation with a source marker. 🃏\n'.repeat(25_000)}END_PRIVATE_A`, visibleEvents: [{ sequence: 1, text: start }] });
    await replay.finalize({ status: 'blocked', endedAt: new Date(2000).toISOString(), feedbackComplete: false });
    await feedback(matchDir);
    await writeFile(path.join(matchDir, 'player-d-feedback.json'), JSON.stringify({ status: 'incomplete', answers: [] }));
    const artifact = JSON.parse(await readFile(path.join(matchDir, 'replay.json'), 'utf8')) as { feedbackComplete: boolean };
    artifact.feedbackComplete = true; // Even an incorrect recorder flag must not bypass actual interviews.
    await writeFile(path.join(matchDir, 'replay.json'), JSON.stringify(artifact));
    for (const player of ['a', 'b', 'c', 'd']) await writeFile(path.join(matchDir, 'screenshots', `player-${player}-00001-final.png`), 'test image');
    let callsBeforeInterviews = 0;
    await generateFindings({ replaysDir, outputDir: directory, complete: async () => { callsBeforeInterviews++; return 'must not be called'; } });
    expect(callsBeforeInterviews).toBe(0);
    expect(await readFile(path.join(matchDir, 'reviewer-dossier.txt'), 'utf8').catch(() => null)).toBeNull();
    await feedback(matchDir);
    const chunks: string[] = [];
    let matchSyntheses = 0;
    await generateFindings({ replaysDir, outputDir: directory, complete: async request => {
      for (const player of ['a', 'b', 'c', 'd']) expect(JSON.parse(await readFile(path.join(matchDir, `player-${player}-feedback.json`), 'utf8')).status).toBe('complete');
      expect(request.prompt.length).toBeLessThan(105_000);
      if (request.prompt.startsWith('Review every supplied observation in EVIDENCE CHUNK')) {
        expect(request.images).toBeUndefined();
        expect(request.prompt).toContain('match-001/reviewer-dossier.txt#chars-');
        chunks.push(request.prompt.split('\nBEGIN EVIDENCE CHUNK\n')[1]!.split('\nEND EVIDENCE CHUNK')[0]!);
        return `Chunk ${chunks.length} reviewed; original source range retained.`;
      }
      if (request.images) { matchSyntheses++; expect(request.images).toHaveLength(4); expect(request.prompt).toContain('ALL CHUNK NOTES'); return 'Supported match review from all chunk notes and four images.'; }
      return FINDINGS_SECTIONS.map(section => `## ${section}\n\nNo balance conclusion from this fixture.`).join('\n\n');
    } });
    const dossier = await readFile(path.join(matchDir, 'reviewer-dossier.txt'), 'utf8');
    expect(dossier.length).toBeGreaterThan(100_000);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join('')).toBe(dossier);
    expect(matchSyntheses).toBe(1);
    const audit = JSON.parse(await readFile(path.join(matchDir, 'reviewer-chunks.json'), 'utf8')) as { status: string; chunks: Array<{ start: number; end: number }> };
    expect(audit.status).toBe('complete');
    expect(audit.chunks[0]?.start).toBe(0);
    expect(audit.chunks.at(-1)?.end).toBe(dossier.length);
    for (let index = 1; index < audit.chunks.length; index++) expect(audit.chunks[index]?.start).toBe(audit.chunks[index - 1]?.end);
    let failedCalls = 0;
    await generateFindings({ replaysDir, outputDir: directory, complete: async request => {
      expect(request.images).toBeUndefined();
      if (++failedCalls === 2) throw new Error('Synthetic chunk failure');
      return 'First chunk reviewed.';
    } });
    expect(failedCalls).toBe(2);
    const failedAudit = JSON.parse(await readFile(path.join(matchDir, 'reviewer-chunks.json'), 'utf8')) as { status: string; chunks: unknown[] };
    expect(failedAudit.status).toBe('failed');
    expect(failedAudit.chunks).toHaveLength(1);
    const aggregate = JSON.parse(await readFile(path.join(directory, 'aggregate-metrics.json'), 'utf8')) as { independentReview: { matchesReviewed: number; passed: boolean } };
    expect(aggregate.independentReview).toMatchObject({ matchesReviewed: 0, passed: false });
    expect(await readFile(path.join(directory, 'FAST_BETA_FINDINGS.md'), 'utf8')).toContain('Synthetic chunk failure');
  });
  it('consolidates every oversized batch-review note within the bound and fails the gate on a reduction error', async () => {
    const directory = await temporary(), replaysDir = path.join(directory, 'replays'), firstDir = path.join(replaysDir, 'match-001');
    const replay = recorder(firstDir);
    await replay.recordObservation({ id: 'a-1', playerId: 'a', capturedAt: new Date(1000).toISOString(), round: 1, text: 'Known UI evidence.', visibleEvents: [{ sequence: 1, text: start }] });
    await feedback(firstDir);
    for (const player of ['a', 'b', 'c', 'd']) await writeFile(path.join(firstDir, 'screenshots', `player-${player}-00001-final.png`), 'test image');
    await replay.finalize({ status: 'blocked', endedAt: new Date(2000).toISOString(), feedbackComplete: true });
    const secondDir = path.join(replaysDir, 'match-002');
    await cp(firstDir, secondDir, { recursive: true });
    const second = JSON.parse(await readFile(path.join(secondDir, 'replay.json'), 'utf8')) as { metadata: { matchId: string } };
    second.metadata.matchId = 'match-002';
    await writeFile(path.join(secondDir, 'replay.json'), JSON.stringify(second));
    const longNotes = 'Evidence event-1: unknown outcome; do not infer balance.\n'.repeat(1300);
    expect(longNotes.length).toBeLessThan(100_000);
    const reduced: string[] = [];
    let finalCalls = 0;
    await generateFindings({ replaysDir, outputDir: directory, complete: async request => {
      expect(request.prompt.length).toBeLessThan(105_000);
      if (request.images) return longNotes;
      if (request.prompt.startsWith('Consolidate batch review notes')) {
        reduced.push(request.prompt.split('\nBEGIN BATCH REVIEW NOTES\n')[1]!.split('\nEND BATCH REVIEW NOTES')[0]!);
        return `Batch source portion ${reduced.length}: both matches are smoke/blocked; evidence event-1 is unknown. Preserve incomplete completion status.`;
      }
      finalCalls++;
      expect(request.prompt).toContain('reviewer-batch-dossier.txt#chars-');
      return FINDINGS_SECTIONS.map(section => `## ${section}\n\nNo balance conclusion.`).join('\n\n');
    } });
    const dossier = await readFile(path.join(directory, 'reviewer-batch-dossier.txt'), 'utf8');
    expect(reduced.length).toBeGreaterThan(1);
    expect(reduced.join('')).toBe(dossier);
    expect(dossier).toContain('match-001 (smoke)');
    expect(dossier).toContain('match-002 (smoke)');
    expect(finalCalls).toBe(1);
    const audit = JSON.parse(await readFile(path.join(directory, 'reviewer-batch-chunks.json'), 'utf8')) as { status: string; finalCharacters: number; levels: Array<{ chunks: Array<{ start: number; end: number }> }> };
    expect(audit.status).toBe('complete');
    expect(audit.finalCharacters).toBeLessThanOrEqual(100_000);
    expect(audit.levels[0]?.chunks.at(-1)?.end).toBe(dossier.length);
    let reductions = 0;
    await generateFindings({ replaysDir, outputDir: directory, complete: async request => {
      if (request.images) return longNotes;
      if (request.prompt.startsWith('Consolidate batch review notes')) {
        if (++reductions === 2) throw new Error('Synthetic batch consolidation failure');
        return 'First batch portion reviewed.';
      }
      throw new Error('Final synthesis must not run after reduction failure.');
    } });
    expect(reductions).toBe(2);
    const failedAudit = JSON.parse(await readFile(path.join(directory, 'reviewer-batch-chunks.json'), 'utf8')) as { status: string; levels: Array<{ chunks: unknown[] }> };
    expect(failedAudit.status).toBe('failed');
    expect(failedAudit.levels[0]?.chunks).toHaveLength(1);
    const aggregate = JSON.parse(await readFile(path.join(directory, 'aggregate-metrics.json'), 'utf8')) as { independentReview: { matchesReviewed: number; synthesisCompleted: boolean; passed: boolean } };
    expect(aggregate.independentReview).toMatchObject({ matchesReviewed: 2, synthesisCompleted: false, passed: false });
    expect(await readFile(path.join(directory, 'FAST_BETA_FINDINGS.md'), 'utf8')).toContain('Synthetic batch consolidation failure');
  });
  it('produces honest empty-batch findings without calling a model', async () => {
    const directory = await temporary();
    await mkdir(path.join(directory, 'replays'));
    let called = false;
    await generateFindings({ replaysDir: path.join(directory, 'replays'), outputDir: directory, complete: async () => { called = true; return 'invented'; } });
    const report = await readFile(path.join(directory, 'FAST_BETA_FINDINGS.md'), 'utf8');
    expect(called).toBe(false);
    for (const heading of FINDINGS_SECTIONS) expect(report).toContain(`## ${heading}`);
    expect(report).toContain('NOT passed');
    const aggregate = JSON.parse(await readFile(path.join(directory, 'aggregate-metrics.json'), 'utf8')) as { completionGatePassed: boolean; averageRounds: { value: number | null }; matchesCompleted: number };
    expect(aggregate.completionGatePassed).toBe(false);
    expect(aggregate.averageRounds.value).toBeNull();
    expect(aggregate.matchesCompleted).toBe(0);
  });
});
