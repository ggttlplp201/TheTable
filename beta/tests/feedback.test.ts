import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FEEDBACK_QUESTIONS, feedbackQuestionCount, freezeInterviewRecord, parseFeedbackResponse, runFeedback } from '../runner/feedback-runner.js';
import type { Observation } from '../runner/types.js';

function observation(overrides: Partial<Observation> = {}): Observation {
  return { id: 'a-1', playerId: 'a', capturedAt: '2026-10-07T12:00:00.000Z', url: 'http://localhost:4173', title: 'The Table', text: 'My own contract', round: 1, phase: 'playing', controls: [], visibleEvents: [], ...overrides };
}
const complete = () => JSON.stringify({ answers: FEEDBACK_QUESTIONS.map((_, index) => ({ question: index + 1, answer: `Observed answer ${index + 1}` })) });

describe('independent interview boundary', () => {
  it('versions the expanded interview without invalidating historical evidence', () => {
    expect(feedbackQuestionCount()).toBe(18);
    expect(feedbackQuestionCount('round-income-wildcards')).toBe(28);
    expect(feedbackQuestionCount('compact-tasks-tutorial-v2')).toBe(47);
    expect(feedbackQuestionCount('unknown')).toBe(-1);
  });
  it('rejects a mixed-player observation record and unowned decisions', () => {
    expect(() => freezeInterviewRecord('a', [observation(), observation({ playerId: 'b' })], [])).toThrow('mixed-player');
    expect(() => freezeInterviewRecord('a', [observation()], [{ observationId: 'b-1', intent: 'hidden', action: { type: 'wait', ms: 100 }, noMeaningfulAction: false }])).toThrow('without player');
  });
  it('freezes before spectator or results disclosure, even if later observations look active', () => {
    for (const phase of ['spectator', 'results'] as const) {
      const record = freezeInterviewRecord('a', [observation(), observation({ id: 'a-2', phase, text: 'OPPONENT_SECRET' }), observation({ id: 'a-3', text: 'LATER_SECRET' })], []);
      expect(record.observations.map(item => item.id)).toEqual(['a-1']);
    }
  });
  it('requires all base and patch questions with numbered nonempty answers', () => {
    expect(FEEDBACK_QUESTIONS).toHaveLength(47);
    expect(parseFeedbackResponse(complete())).toHaveLength(FEEDBACK_QUESTIONS.length);
    expect(() => parseFeedbackResponse('{"answers":[]}')).toThrow(String(FEEDBACK_QUESTIONS.length));
    const invalid = JSON.parse(complete()) as { answers: { question: number; answer: string }[] };
    invalid.answers[1]!.question = 1;
    expect(() => parseFeedbackResponse(JSON.stringify(invalid))).toThrow('answer 2');
    invalid.answers[1] = { question: 2, answer: ' ' };
    expect(() => parseFeedbackResponse(JSON.stringify(invalid))).toThrow('answer 2');
  });
  it('keeps failed attempts and never passes spectator text into an interview', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'table-feedback-'));
    try {
      const prompts: string[] = [];
      const report = await runFeedback({ playerId: 'a', persona: 'Aggressive', observations: [observation(), observation({ id: 'a-2', phase: 'spectator', text: 'OPPONENT_SECRET' })], decisions: [], outputDir: directory,
        model: async ({ prompt }) => { prompts.push(prompt); return prompts.length === 1 ? '{"answers":[]}' : complete(); },
      });
      expect(report.status).toBe('complete');
      expect(report.attempts).toBe(2);
      expect(report.errors).toHaveLength(1);
      expect(prompts.every(prompt => !prompt.includes('OPPONENT_SECRET'))).toBe(true);
      expect(report.sourceObservationIds).toEqual(['a-1']);
      const saved = JSON.parse(await readFile(join(directory, 'player-a-feedback.json'), 'utf8'));
      expect(saved.questionnaireVersion).toBe('compact-tasks-tutorial-v2');
      expect(saved.answers).toHaveLength(FEEDBACK_QUESTIONS.length);
      expect(await readFile(join(directory, 'player-a-feedback-attempt-1.txt'), 'utf8')).toBe('{"answers":[]}');
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
  it('records an incomplete interview without model calls when no player evidence exists', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'table-feedback-empty-'));
    try {
      let called = false;
      const report = await runFeedback({ playerId: 'd', persona: 'Cautious', observations: [], decisions: [], outputDir: directory, model: async () => { called = true; return complete(); } });
      expect(called).toBe(false);
      expect(report.status).toBe('incomplete');
      expect(report.answers).toEqual([]);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
});
