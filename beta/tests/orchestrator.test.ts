import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Browser } from '@playwright/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Attempt } from '../runner/batch-state.js';
import type { Config } from '../runner/config.js';
import type { ReplayPackage } from '../runner/replay-recorder.js';
import type { CompletionInput, Observation, PlayerId } from '../runner/types.js';
import { FEEDBACK_QUESTIONS } from '../runner/feedback-runner.js';

// These mocks exist only in this unit-test module. Artifacts are never written
// into beta/replays and are not evidence of a real smoke or full AI match.
const mocked = vi.hoisted(() => ({ create: vi.fn(), complete: vi.fn(), fingerprint: vi.fn() }));
vi.mock('../runner/browser-player.js', () => ({ BrowserPlayer: { create: mocked.create } }));
vi.mock('../runner/model-client.js', () => ({ OpenAIClient: class { complete(input: CompletionInput) { return mocked.complete(input); } } }));
vi.mock('../runner/config.js', async importOriginal => ({
  ...await importOriginal<typeof import('../runner/config.js')>(), rulesFingerprint: mocked.fingerprint,
}));
import { runMatch } from '../runner/orchestrator.js';

const ids: PlayerId[] = ['a', 'b', 'c', 'd'];
const originalFingerprint = 'unit-test-stable-fingerprint';
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
interface Fixture {
  directory: string;
  config: Config;
  attempt: Attempt;
  prompts: Array<{ playerId: PlayerId; kind: 'decision' | 'interview'; input: CompletionInput }>;
  terminals: Set<PlayerId>;
  terminalRequested: Set<PlayerId>;
  interviews: Set<PlayerId>;
  closeStarted: Set<PlayerId>;
  closed: Set<PlayerId>;
  actionFailures: number;
  resultsReads: number;
  alwaysPlaying: boolean;
  failActionsFor?: PlayerId;
  invalidInterviewFor?: PlayerId;
  terminalGate?: ReturnType<typeof deferred>;
  interviewGate?: ReturnType<typeof deferred>;
  videoGate?: ReturnType<typeof deferred>;
}
let fixture: Fixture;

async function readJson<T>(name: string): Promise<T> {
  return JSON.parse(await readFile(join(fixture.directory, name), 'utf8')) as T;
}
function observation(playerId: PlayerId, count: number, phase: Observation['phase']): Observation {
  return {
    id: `${playerId}-unit-observation-${count}`, playerId, capturedAt: new Date().toISOString(),
    url: 'http://unit-test.invalid', title: 'Unit fixture only', phase, round: phase === 'playing' ? 1 : null,
    text: phase === 'results' ? 'TERMINAL_REVEALS_ALL_SECRETS' : `PRIVATE_${playerId.toUpperCase()}_KNOWLEDGE`,
    controls: [], visibleEvents: phase === 'playing' ? [{ sequence: 1, text: 'Starting inventories are revealed. Round 1 begins.' }] : [],
  };
}
function execute(): Promise<Attempt> {
  return runMatch({} as Browser, fixture.config, 0, fixture.attempt, originalFingerprint, new AbortController().signal);
}

beforeEach(async () => {
  vi.clearAllMocks();
  const directory = await mkdtemp(join(tmpdir(), 'table-orchestrator-unit-'));
  fixture = {
    directory,
    config: { url: 'http://unit-test.invalid', apiKey: 'unit-test-no-network', model: 'unit-test-model', headless: true, maxMatchMs: 10_000, maxDecisions: 20, outputDir: directory },
    attempt: { matchId: 'unit-fixture-only', kind: 'smoke', status: 'running', directory, feedbackComplete: false, videosComplete: false },
    prompts: [], terminals: new Set(), terminalRequested: new Set(), interviews: new Set(),
    closeStarted: new Set(), closed: new Set(), actionFailures: 0, resultsReads: 0, alwaysPlaying: false,
  };
  mocked.fingerprint.mockResolvedValue(originalFingerprint);
  mocked.complete.mockImplementation(async (input: CompletionInput) => {
    const isInterview = input.system.includes('being interviewed independently');
    const playerId = (isInterview ? input.system.match(/^You are Player ([A-D]),/)?.[1]?.toLowerCase() : JSON.parse(input.prompt).playerId) as PlayerId;
    if (!ids.includes(playerId)) throw new Error('Test model cannot identify the isolated player');
    fixture.prompts.push({ playerId, kind: isInterview ? 'interview' : 'decision', input });
    if (isInterview) {
      fixture.interviews.add(playerId);
      if (playerId === 'd') await fixture.interviewGate?.promise;
      const questions = fixture.invalidInterviewFor === playerId ? FEEDBACK_QUESTIONS.slice(0, 17) : FEEDBACK_QUESTIONS;
      return JSON.stringify({ answers: questions.map((_, index) => ({ question: index + 1, answer: `Unit-test response from ${playerId} to question ${index + 1}.` })) });
    }
    const current = (JSON.parse(input.prompt) as { current: Observation }).current;
    return JSON.stringify({ observationId: current.id, intent: 'Unit-test UI input only', action: { type: 'wait', ms: 100 }, noMeaningfulAction: false });
  });
  mocked.create.mockImplementation(async (_browser: Browser, options: { playerId: PlayerId; outputDir: string }) => {
    const playerId = options.playerId;
    let observations = 0;
    let screenshots = 0;
    return {
      readHandbook: async () => 'Public player handbook — unit fixture.',
      createRoom: async () => 'UNIT00', joinRoom: async () => {}, chooseRoleAndReady: async () => {}, startMatch: async () => {},
      observe: async () => {
        observations++;
        if (observations === 1) return observation(playerId, observations, 'lobby');
        if (observations === 2 || fixture.alwaysPlaying) return observation(playerId, observations, 'playing');
        fixture.terminalRequested.add(playerId);
        if (playerId === 'd') await fixture.terminalGate?.promise;
        fixture.terminals.add(playerId);
        return observation(playerId, observations, 'results');
      },
      screenshot: async (label: string) => {
        const directory = join(options.outputDir, 'screenshots');
        await mkdir(directory, { recursive: true });
        const path = join(directory, `player-${playerId}-${++screenshots}-${label}.png`);
        await writeFile(path, 'UNIT TEST PLACEHOLDER — not screenshot evidence');
        return path;
      },
      act: async () => {
        if (fixture.failActionsFor === playerId) { fixture.actionFailures++; throw new Error('Unit-test simulated UI rejection'); }
      },
      inspectHistory: async () => null,
      resultsSummary: async () => {
        fixture.resultsReads++;
        expect([...fixture.terminals].sort()).toEqual(ids);
        // Use real saved interview records to prove aggregation ordering.
        for (const id of ids) {
          const report = await readJson<{ status: string; answers: unknown[] }>(`player-${id}-feedback.json`);
          expect(report.status).toBe('complete');
          expect(report.answers).toHaveLength(FEEDBACK_QUESTIONS.length);
        }
        return ids.map((id, index) => `${index + 1}\tPlayer ${id.toUpperCase()}\tUnit Role\tUNIT_FINAL_${id}_SECRET\tESCAPED\t${100 - index * 20}`).join('\n');
      },
      close: async () => {
        fixture.closeStarted.add(playerId);
        if (playerId === 'c') await fixture.videoGate?.promise;
        const video = join(options.outputDir, `player-${playerId}-video.webm`);
        await writeFile(video, 'UNIT TEST PLACEHOLDER — no gameplay video');
        fixture.closed.add(playerId);
        return video;
      },
    };
  });
});
afterEach(async () => { await rm(fixture.directory, { recursive: true, force: true }); });

describe('runMatch orchestration regression tests (mock UI/model; never real beta evidence)', () => {
  it('keeps prompts player-local and waits for four terminals, complete interviews, and every video', async () => {
    fixture.terminalGate = deferred(); fixture.interviewGate = deferred(); fixture.videoGate = deferred();
    let settled = false;
    const pending = execute().then(value => { settled = true; return value; });
    try {
      await vi.waitFor(() => expect(fixture.terminalRequested.has('d')).toBe(true));
      expect(fixture.terminals.size).toBe(3);
      expect(fixture.resultsReads).toBe(0);
      expect(settled).toBe(false);
      fixture.terminalGate.resolve();
      await vi.waitFor(() => expect(fixture.interviews.has('d')).toBe(true));
      expect(fixture.resultsReads).toBe(0);
      expect(fixture.closeStarted.size).toBe(0);
      fixture.interviewGate.resolve();
      await vi.waitFor(() => expect(fixture.closeStarted.size).toBe(4));
      expect(fixture.resultsReads).toBe(1);
      expect(fixture.closed.has('c')).toBe(false);
      expect(settled).toBe(false);
      fixture.videoGate.resolve();
      const result = await pending;
      expect(result).toMatchObject({ status: 'completed', feedbackComplete: true, videosComplete: true });
      expect([...fixture.closed].sort()).toEqual(ids);
      for (const id of ids) {
        expect(fixture.prompts.some(call => call.playerId === id && call.kind === 'decision')).toBe(true);
        expect(fixture.prompts.some(call => call.playerId === id && call.kind === 'interview')).toBe(true);
      }
      for (const call of fixture.prompts) {
        const text = `${call.input.system}\n${call.input.prompt}`;
        expect(text).toContain(`PRIVATE_${call.playerId.toUpperCase()}_KNOWLEDGE`);
        for (const other of ids.filter(id => id !== call.playerId)) expect(text).not.toContain(`PRIVATE_${other.toUpperCase()}_KNOWLEDGE`);
        expect(text).not.toContain('TERMINAL_REVEALS_ALL_SECRETS');
        expect(text).not.toContain('UNIT_FINAL_');
      }
      const replay = await readJson<ReplayPackage>('replay.json');
      expect(replay.results).toHaveLength(4);
      expect(replay.events.map(event => event.text)).not.toContain('The match has ended.');
      expect((await readJson<{ coverage: { completePublicEventLog: boolean } }>('metrics.json')).coverage.completePublicEventLog).toBe(false);
    } finally {
      fixture.terminalGate.resolve(); fixture.interviewGate.resolve(); fixture.videoGate.resolve();
      await pending;
    }
  });

  it('settles every player and closes every browser after repeated UI errors without fabricating results', async () => {
    fixture.alwaysPlaying = true;
    fixture.failActionsFor = 'a';
    const result = await execute();
    expect(fixture.actionFailures).toBe(5);
    expect([...fixture.closed].sort()).toEqual(ids);
    expect(result.status).toBe('blocked');
    expect(fixture.resultsReads).toBe(0);
    const replay = await readJson<ReplayPackage>('replay.json');
    expect(replay.results).toEqual([]);
    expect(replay.failures.some(failure => failure.reason.includes('five rejected attempts'))).toBe(true);
    expect(replay.failures.some(failure => failure.screenshotPath && failure.intendedAction)).toBe(true);
  });

  it('fails when an interview omits a question even with four terminal screens and four videos', async () => {
    fixture.invalidInterviewFor = 'b';
    const result = await execute();
    expect(fixture.terminals.size).toBe(4);
    expect([...fixture.closed].sort()).toEqual(ids);
    expect(result).toMatchObject({ status: 'failed', feedbackComplete: false, videosComplete: true });
    expect(fixture.resultsReads).toBe(0);
    expect(fixture.prompts.filter(call => call.kind === 'interview' && call.playerId === 'b')).toHaveLength(2);
    const feedback = await readJson<{ status: string; answers: unknown[] }>('player-b-feedback.json');
    expect(feedback).toMatchObject({ status: 'incomplete', answers: [] });
    expect((await readJson<ReplayPackage>('replay.json')).results).toEqual([]);
  });

  it('persists failed replay and metrics when the rules fingerprint changes before finalization', async () => {
    mocked.fingerprint.mockResolvedValue('unit-test-changed-fingerprint');
    const result = await execute();
    expect(result).toMatchObject({ status: 'failed', feedbackComplete: true, videosComplete: true });
    const replay = await readJson<ReplayPackage>('replay.json');
    expect(replay.status).toBe('failed');
    expect(replay.failures.some(failure => failure.reason.includes('excluded from the stable sample'))).toBe(true);
    expect((await readJson<{ status: string }>('metrics.json')).status).toBe('failed');
    expect([...fixture.closed].sort()).toEqual(ids);
  });
});
