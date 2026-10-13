import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assignEventRounds, calculateMetrics, parseResults, parseResultSummary } from './metrics.js';
import type { EvidenceEvent, MatchMetrics, PlayerId, ResultRow } from './metrics.js';
import { feedbackQuestionCount } from './feedback-runner.js';

export interface ReplayMetadata {
  matchId: string;
  kind: 'smoke' | 'full' | 'validation';
  startedAt: string;
  assignments: Array<{ playerId: PlayerId; persona: PlayerId; seat: number; rolePreference: string }>;
  rulesFingerprint: string;
  model: string;
}
export interface RecorderObservation {
  id: string;
  playerId: PlayerId;
  capturedAt: string;
  round: number | null;
  text: string;
  screenshotPath?: string;
  visibleEvents: Array<{ sequence: number; text: string }>;
}
export interface RecordedAction {
  playerId: PlayerId;
  at: string;
  observationId: string;
  action: unknown;
  outcome: 'performed' | 'rejected';
  error?: string;
  reason?: string;
  noMeaningfulAction?: boolean;
  turnKey?: string;
}
export interface RecordedFailure {
  playerId?: PlayerId;
  at: string;
  reason: string;
  screenshotPath?: string;
  intendedAction?: unknown;
}
export interface ReplayPackage {
  schemaVersion: 1;
  metadata: ReplayMetadata;
  status: 'completed' | 'blocked' | 'failed';
  endedAt: string;
  feedbackComplete: boolean;
  events: EvidenceEvent[];
  observations: Array<{ id: string; playerId: PlayerId; capturedAt: string; round: number | null; evidence: string; screenshotPath?: string }>;
  failures: RecordedFailure[];
  playerArtifacts: Array<{ playerId: PlayerId; observations: string; actions: string; feedback: string; video: string }>;
  results: ResultRow[];
  limitations: string[];
}
const players: PlayerId[] = ['a', 'b', 'c', 'd'];
const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
const markdown = (text: string) => text.replace(/[\r\n]+/g, ' ').replace(/[\\`*_{}\[\]<>]/g, '\\$&');
const timestamp = (at: string, origin: string) => {
  const seconds = Math.max(0, Math.floor((Date.parse(at) - Date.parse(origin)) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};

/** Recorder is write-only during play. It has no API for reading another player's observations. */
export class ReplayRecorder {
  private events = new Map<number, EvidenceEvent>();
  private observations: ReplayPackage['observations'] = [];
  private failures: RecordedFailure[] = [];
  private results: ResultRow[] = [];
  private noMeaningfulActions: Array<{ playerId: PlayerId; observationId: string; evidence: string; turnKey?: string }> = [];
  private initialized: Promise<void>;
  private writes: Promise<void> = Promise.resolve();
  private finalized = false;
  private resultText: string | undefined;

  constructor(readonly directory: string, readonly metadata: ReplayMetadata) {
    this.initialized = this.initialize();
  }
  private async initialize(): Promise<void> {
    await mkdir(path.join(this.directory, 'screenshots'), { recursive: true });
    await Promise.all(players.map(playerId => mkdir(path.join(this.directory, `player-${playerId}`), { recursive: true })));
    await writeFile(path.join(this.directory, 'metadata.json'), json(this.metadata), { flag: 'wx' });
  }
  private enqueue(work: () => Promise<void>): Promise<void> {
    if (this.finalized) return Promise.reject(new Error('Replay has already been finalized.'));
    const result = this.writes.then(() => this.initialized).then(work);
    this.writes = result.catch(() => {});
    return result;
  }
  recordObservation(observation: RecorderObservation): Promise<void> {
    return this.enqueue(async () => {
      this.assertPlayer(observation.playerId);
      const relative = `player-${observation.playerId}/observations.jsonl`;
      const evidence = `${relative}#${observation.id}`;
      await appendFile(path.join(this.directory, relative), `${JSON.stringify(observation)}\n`);
      this.observations.push({ id: observation.id, playerId: observation.playerId, capturedAt: observation.capturedAt, round: observation.round, evidence, ...(observation.screenshotPath ? { screenshotPath: observation.screenshotPath } : {}) });
      for (const visible of observation.visibleEvents) {
        if (!Number.isSafeInteger(visible.sequence) || visible.sequence < 1 || !visible.text) continue;
        const existing = this.events.get(visible.sequence);
        if (existing) {
          if (existing.text !== visible.text) {
            this.failures.push({ playerId: observation.playerId, at: observation.capturedAt, reason: `UI BLOCKER: conflicting public event text at sequence ${visible.sequence}; replay cannot establish a single chronology.`, ...(observation.screenshotPath ? { screenshotPath: observation.screenshotPath } : {}) });
          } else {
            if (Date.parse(observation.capturedAt) < Date.parse(existing.firstObservedAt)) {
              existing.firstObservedAt = observation.capturedAt;
              existing.roundObserved = observation.round;
            }
            if (!existing.observers.includes(observation.playerId)) existing.observers.push(observation.playerId);
            if (existing.evidence.length < 8 && !existing.evidence.includes(evidence)) existing.evidence.push(evidence);
          }
        } else this.events.set(visible.sequence, { id: `event-${visible.sequence}`, sequence: visible.sequence, text: visible.text, firstObservedAt: observation.capturedAt, roundObserved: observation.round, round: null, observers: [observation.playerId], evidence: [evidence] });
      }
    });
  }
  recordAction(action: RecordedAction): Promise<void> {
    return this.enqueue(async () => {
      this.assertPlayer(action.playerId);
      const relative = `player-${action.playerId}/actions.jsonl`;
      await appendFile(path.join(this.directory, relative), `${JSON.stringify(action)}\n`);
      if (action.noMeaningfulAction) this.noMeaningfulActions.push({ playerId: action.playerId, observationId: action.observationId, evidence: `${relative}#${action.observationId}`, ...(action.turnKey ? { turnKey: action.turnKey } : {}) });
      // A successful click is not proof of an accepted gameplay action; no game event is synthesized.
    });
  }
  recordFailure(failure: RecordedFailure): Promise<void> {
    return this.enqueue(async () => {
      if (failure.playerId) this.assertPlayer(failure.playerId);
      this.failures.push(failure);
      await appendFile(path.join(this.directory, 'failures.jsonl'), `${JSON.stringify(failure)}\n`);
    });
  }
  recordResults(text: string): Promise<void> {
    return this.enqueue(async () => {
      // Results can expose objectives. Refuse cross-player aggregation before all interviews exist.
      await this.requireFeedback();
      this.resultText = text;
      this.results = parseResults(text);
      await writeFile(path.join(this.directory, 'results.txt'), text);
    });
  }
  private assertPlayer(playerId: PlayerId): void {
    if (!players.includes(playerId)) throw new Error('Invalid player identity.');
  }
  private async requireFeedback(): Promise<void> {
    for (const playerId of players) {
      const text = await readFile(path.join(this.directory, `player-${playerId}-feedback.md`), 'utf8').catch(() => '');
      if (!text.trim()) throw new Error(`Cannot aggregate results before player ${playerId}'s independent feedback is saved.`);
      const report = JSON.parse(await readFile(path.join(this.directory, `player-${playerId}-feedback.json`), 'utf8')) as { questionnaireVersion?: string; status?: string; answers?: Array<{ question?: string; answer?: string }> };
      if (report.status !== 'complete' || report.answers?.length !== feedbackQuestionCount(report.questionnaireVersion) || report.answers.some(answer => !answer.question?.trim() || !answer.answer?.trim())) throw new Error(`Cannot aggregate results before player ${playerId}'s complete independent interview.`);
    }
  }
  async finalize(options: { status: 'completed' | 'blocked' | 'failed'; endedAt: string; feedbackComplete: boolean }): Promise<MatchMetrics> {
    await this.initialized;
    await this.writes;
    if (this.finalized) throw new Error('Replay has already been finalized.');
    if (options.feedbackComplete) await this.requireFeedback();
    this.finalized = true;
    const events = assignEventRounds([...this.events.values()]);
    const metrics = calculateMetrics({ matchId: this.metadata.matchId, status: options.status, startedAt: this.metadata.startedAt, endedAt: options.endedAt, events, publicLogConflict: this.failures.some(failure => failure.reason.includes('conflicting public event text')), roundsObserved: this.observations.flatMap(observation => observation.round === null ? [] : [observation.round]), results: this.results, ...(this.resultText ? { resultSummary: parseResultSummary(this.resultText) } : {}), noMeaningfulActions: this.noMeaningfulActions });
    const replay: ReplayPackage = {
      schemaVersion: 1, metadata: this.metadata, ...options, events, observations: this.observations, failures: this.failures,
      playerArtifacts: players.map(playerId => ({ playerId, observations: `player-${playerId}/observations.jsonl`, actions: `player-${playerId}/actions.jsonl`, feedback: `player-${playerId}-feedback.md`, video: `player-${playerId}-video.webm` })),
      results: this.results,
      limitations: ['Public events are de-duplicated by their displayed sequence. Actions and private observations remain in the originating player directory.', 'Event times are first observations, not exact gameplay timestamps. Historical events may first appear together.', 'The final score UI can replace the public event log; final results establish completion without inventing a missing MATCH_ENDED log entry.', 'A recorded UI input does not imply that the game accepted or completed the intended action.', 'Private messages and private information appear only inside the originating player observation/video files. These are review artifacts and must never be supplied to another active player.', ...(!this.resultText ? ['No post-interview results UI was captured.'] : [])],
    };
    const story = events.map(event => `- ${timestamp(event.firstObservedAt, this.metadata.startedAt)} observed · ${event.round === null ? 'Round unknown' : `Round ${event.round}`} · #${event.sequence} — ${markdown(event.text)} ([evidence](${event.evidence[0] ?? 'replay.json'}))`).join('\n');
    const finalResults = this.results.length ? this.results.map(result => `- ${markdown(result.name)} — ${result.score} points; ${markdown(result.result)}${result.exitOrder === null ? '' : `; exit ${result.exitOrder}`}.`).join('\n') : 'No complete final-score evidence is available.';
    const timeline = `# ${this.metadata.matchId} — observed timeline\n\nTimestamps show when a browser first observed each event. Displayed sequence numbers establish event order. A missing round is unknown. Private messages and individual UI actions are preserved in each player’s own observation/action archive and video.\n\n${story || 'No gameplay events were observed.'}\n\n## Final result\n\n${finalResults}\n`;
    const summary = `# ${this.metadata.matchId}\n\n- Status: ${options.status}\n- Sample: ${this.metadata.kind}\n- Rules fingerprint: ${this.metadata.rulesFingerprint}\n- Public event log complete: ${metrics.coverage.completePublicEventLog}\n- Individual feedback complete: ${options.feedbackComplete}\n- Duration: ${metrics.durationMs.value === null ? 'unknown' : `${Math.round(metrics.durationMs.value / 1000)} seconds; ${metrics.durationMs.reason ?? 'see metrics evidence'}`}\n- Rounds: ${metrics.totalRounds.value ?? 'unknown'}\n- Failures: ${this.failures.length}\n\n${finalResults}\n\nSee [timeline](timeline.md), [metrics](metrics.json), and [raw replay](replay.json). Null metrics mean unknown, not zero. Player directories contain private review material.\n`;
    await Promise.all([writeFile(path.join(this.directory, 'replay.json'), json(replay)), writeFile(path.join(this.directory, 'metrics.json'), json(metrics)), writeFile(path.join(this.directory, 'timeline.md'), timeline), writeFile(path.join(this.directory, 'match-summary.md'), summary)]);
    return metrics;
  }
}
