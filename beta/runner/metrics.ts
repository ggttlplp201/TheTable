/** Metrics use rendered UI evidence only. Missing or ambiguous telemetry stays null. */
export type PlayerId = 'a' | 'b' | 'c' | 'd';
export interface EvidenceEvent {
  id: string;
  sequence: number;
  text: string;
  firstObservedAt: string;
  roundObserved: number | null;
  round: number | null;
  observers: PlayerId[];
  evidence: string[];
}
export interface Metric<T = number> {
  value: T | null;
  evidence: string[];
  reason?: string;
  observedMinimum?: number;
}
export interface ResultRow {
  name: string;
  exitOrder: number | null;
  role: string;
  objective: string | null;
  result: string;
  score: number;
}
export interface MetricsInput {
  matchId: string;
  status: 'completed' | 'blocked' | 'failed';
  startedAt: string;
  endedAt: string;
  events: EvidenceEvent[];
  publicLogConflict?: boolean;
  roundsObserved: number[];
  results: ResultRow[];
  resultSummary?: { durationMs: number | null; totalRounds: number | null };
  noMeaningfulActions: Array<{ playerId: PlayerId; observationId: string; evidence: string; turnKey?: string }>;
}
export interface MatchMetrics {
  schemaVersion: 1;
  matchId: string;
  status: MetricsInput['status'];
  coverage: { completePublicEventLog: boolean; missingSequences: number[]; eventCount: number; notes: string[] };
  durationMs: Metric;
  harnessDurationMs: number;
  totalRounds: Metric;
  players: Array<{ name: string; role: Metric<string>; objective: Metric<string>; objectiveCompletionRound: Metric; exitOrder: Metric; finalScore: Metric; permanentDeaths: Metric; downs: Metric; revives: Metric; damageDealt: Metric; damageReceived: Metric }>;
  counters: Record<string, Metric>;
  firstInteractionRound: Record<string, Metric>;
  selfReportedNoMeaningfulActionObservations: MetricsInput['noMeaningfulActions'];
}
const unknown = <T = number>(reason: string, evidence: string[] = []): Metric<T> => ({ value: null, evidence, reason });
const evidenceFor = (events: EvidenceEvent[]) => events.map(event => `replay.json#${event.id}`);
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hasStart = (event: EvidenceEvent) => event.text === 'Starting inventories are revealed. Round 1 begins.';
const hasEnd = (event: EvidenceEvent) => event.text === 'The match has ended.';

/** Only sequence order is exact. Browser observation times are not event timestamps. */
export function assignEventRounds(events: EvidenceEvent[]): EvidenceEvent[] {
  let round: number | null = null;
  let intermission = false;
  let previous = 0;
  return [...events].sort((a, b) => a.sequence - b.sequence).map(event => {
    if (event.sequence !== previous + 1) round = null;
    previous = event.sequence;
    if (hasStart(event)) { round = 1; intermission = false; }
    let assigned = round;
    if (event.text === 'Intermission begins; both markets refresh.') intermission = true;
    else if (intermission) {
      if (/^.+['’]s turn begins\.$/.test(event.text)) {
        if (round !== null) round += 1;
        intermission = false;
        assigned = round;
      } else assigned = null; // Market and next-round refresh events have no displayed round marker.
    }
    return { ...event, round: assigned };
  });
}

export function parseResults(text: string): ResultRow[] {
  const rows: ResultRow[] = [];
  for (const line of text.split('\n')) {
    const cells = line.split('\t').map(cell => cell.trim());
    if (cells.length !== 6 || !/^\d+$/.test(cells[5] ?? '') || !/^(?:\d+|—|-)$/.test(cells[0] ?? '')) continue;
    const [exit, name, role, objective, result, score] = cells as [string, string, string, string, string, string];
    if (!name || !role || !/ESCAPED|DIED|STAYED/.test(result)) continue;
    rows.push({ name, role, objective: /unrevealed/i.test(objective) ? null : objective.replace(/\s*[✓✕].*$/, ''), exitOrder: /^\d+$/.test(exit) ? Number(exit) : null, result, score: Number(score) });
  }
  return rows;
}

export function parseResultSummary(text: string): { durationMs: number | null; totalRounds: number | null } {
  const match = text.match(/MATCH\s*·\s*(\d+)\s+ROUNDS(?:\s*·\s*(\d+):(\d{2}))?/);
  return { totalRounds: match ? Number(match[1]) : null, durationMs: match?.[2] !== undefined && match[3] !== undefined ? (Number(match[2]) * 60 + Number(match[3])) * 1000 : null };
}

export function calculateMetrics(input: MetricsInput): MatchMetrics {
  const events = assignEventRounds(input.events);
  const sequences = new Set(events.map(event => event.sequence));
  const last = events.at(-1)?.sequence ?? 0;
  const missingSequences = Array.from({ length: last }, (_, index) => index + 1).filter(sequence => !sequences.has(sequence));
  const complete = !input.publicLogConflict && input.status === 'completed' && events.some(hasStart) && events.some(hasEnd) && missingSequences.length === 0;
  const matching = (pattern: RegExp) => events.filter(event => pattern.test(event.text));
  const count = (pattern: RegExp): Metric => {
    const matches = matching(pattern);
    return complete ? { value: matches.length, evidence: evidenceFor(matches) } : { value: null, observedMinimum: matches.length, evidence: evidenceFor(matches), reason: 'Public event history is incomplete; the observed count is only a lower bound.' };
  };
  const firstRound = (pattern: RegExp | ((event: EvidenceEvent) => boolean)): Metric => {
    const first = (typeof pattern === 'function' ? events.filter(pattern) : matching(pattern))[0];
    if (!first) return unknown(complete ? 'No matching interaction occurred.' : 'No matching interaction was observed; history is incomplete.');
    if (missingSequences.some(sequence => sequence < first.sequence) || first.round === null) return unknown('The first interaction round cannot be established from uninterrupted visible history.', evidenceFor([first]));
    return { value: first.round, evidence: evidenceFor([first]) };
  };
  const start = events.find(hasStart), end = events.find(hasEnd);
  const counters: Record<string, Metric> = {
    permanentDeaths: count(/^.+ permanently died\.$/),
    downs: count(/^.+ is Downed\.$/),
    revives: count(/^.+ revived .+ to \d+ HP\.$/),
    damageDealt: unknown('Damage log text identifies the recipient but does not expose the source or distinguish direct damage from Poison.'),
    damageReceived: unknown('No complete damage history is available.'),
    poisonApplications: count(/^.+ used Poison on .+\.$/),
    poisonTicks: unknown('Visible damage log text does not distinguish Poison ticks from direct damage.'),
    tradesProposed: count(/^.+ offered a Trade to .+\.$/),
    tradesAccepted: count(/^.+ accepted .+['’]s Trade\.$/),
    tradesDeclined: unknown('The visible event log does not reliably label manual responses versus timeout responses.', evidenceFor(matching(/^.+ declined the Trade\.$/))),
    tradeTimeouts: unknown('The visible event log does not reliably label manual responses versus timeout responses.'),
    tradeDeclineMessages: count(/^.+ declined the Trade\.$/),
    openThreats: count(/^.+ made a open Threat against .+\.$/),
    coveredThreats: count(/^.+ made a covered Threat against .+\.$/),
    threatCompliance: count(/^.+ complied\.(?: The covered item was .+\.)?$/),
    threatRefusal: count(/^.+ refused\.(?: The covered item was .+\.)?$/),
    successfulHarmlessBluffs: unknown('A revealed non-weapon and compliance do not establish that demanded assets were received.'),
    failedBluffs: unknown('Visible prose does not establish the threatening player’s intended bluff or weapon usability.'),
    pistolShots: count(/^.+ used Pistol\.$/),
    knifeUses: count(/^.+ used Knife\.$/),
    itemsPurchased: count(/^.+ purchased (?:.+ from the Public Shop|an item)\.$/),
    itemsSold: count(/^.+ sold .+\.$/),
    blackMarketPurchases: unknown('The public purchase message does not name the market for a private purchase.'),
    chestOpenings: count(/^.+ opened the (?:Standard|Black) Chest\.$/),
    pocketInspections: count(/^.+ inspected a Pocket\.$/),
    successfulPickpockets: unknown('The visible Pickpocket log reports use, not the hidden result.'),
    pickpocketUses: count(/^.+ used Pickpocket on .+\.$/),
    coinsEarned: unknown('Gross earnings are not exposed by the UI event log; net balances cannot reconstruct gross transfers.'),
    coinsSpent: unknown('Exact transaction amounts are not exposed by the UI event log.'),
    turnsSkipped: unknown('Turn-ended messages do not distinguish deliberate endings, idle timeouts, and skips.'),
    turnsWithNoMeaningfulAction: unknown('Decision observations are not necessarily distinct turns. See separate self-reported observation records.'),
  };
  const damage = matching(/^.+ took \d+ damage\.$/);
  const damageTotal = damage.reduce((sum, event) => sum + Number(event.text.match(/took (\d+) damage/)?.[1] ?? 0), 0);
  counters.damageReceived = complete ? { value: damageTotal, evidence: evidenceFor(damage) } : { ...unknown('Damage observations are incomplete.', evidenceFor(damage)), observedMinimum: damageTotal };
  const turnReports = input.noMeaningfulActions.filter(report => report.turnKey);
  if (turnReports.length === input.noMeaningfulActions.length && turnReports.length > 0) counters.turnsWithNoMeaningfulAction = { value: new Set(turnReports.map(report => `${report.playerId}:${report.turnKey}`)).size, evidence: turnReports.map(report => report.evidence) };
  const players = input.results.map(result => {
    const namePattern = escapeRegExp(result.name);
    const ownDamage = matching(new RegExp(`^${namePattern} took (\\d+) damage\\.$`, 'i'));
    const amount = ownDamage.reduce((sum, event) => sum + Number(event.text.match(/took (\d+) damage/)?.[1] ?? 0), 0);
    const completion = events.find(event => new RegExp(`^${namePattern} is ready to leave\\.$`, 'i').test(event.text));
    return {
      name: result.name,
      role: { value: result.role, evidence: ['results.txt'] },
      objective: result.objective ? { value: result.objective, evidence: ['results.txt'] } : unknown<string>('Objective was not revealed in the results UI.', ['results.txt']),
      objectiveCompletionRound: completion?.round != null && !missingSequences.some(sequence => sequence < completion.sequence) ? { value: completion.round, evidence: evidenceFor([completion]) } : unknown('Objective completion round is not established by the observed public log.'),
      exitOrder: result.exitOrder === null ? unknown('No exit order was shown.', ['results.txt']) : { value: result.exitOrder, evidence: ['results.txt'] },
      finalScore: { value: result.score, evidence: ['results.txt'] },
      permanentDeaths: count(new RegExp(`^${namePattern} permanently died\\.$`, 'i')),
      downs: count(new RegExp(`^${namePattern} is Downed\\.$`, 'i')),
      revives: count(new RegExp(`^${namePattern} revived .+ to \\d+ HP\\.$`, 'i')),
      damageDealt: unknown('The visible damage text does not identify the source.'),
      damageReceived: complete ? { value: amount, evidence: evidenceFor(ownDamage) } : { ...unknown('Damage history is incomplete.', evidenceFor(ownDamage)), observedMinimum: amount },
    };
  });
  return {
    schemaVersion: 1, matchId: input.matchId, status: input.status,
    coverage: { completePublicEventLog: complete, missingSequences, eventCount: events.length, notes: ['Metrics contain only visible UI evidence. Null means unknown, ambiguous, or not applicable, never zero.', 'Event sequence is exact; timestamps are first browser observations, not server event times.', 'Private observations are archived separately and are never player prompt inputs for another session.', 'Results were collected only after independent feedback.', ...(complete ? [] : ['The terminal screen can replace the public event-log UI before the final events are observed. Video and final-score evidence establish match completion, but event counts remain unknown/lower bounds.'])] },
    durationMs: input.status === 'completed' && input.resultSummary?.durationMs != null ? { value: input.resultSummary.durationMs, evidence: ['results.txt'], reason: 'Duration displayed by the final-results UI, rounded down to whole seconds.' } : start && end && Date.parse(end.firstObservedAt) > Date.parse(start.firstObservedAt) ? { value: Math.max(0, Date.parse(end.firstObservedAt) - Date.parse(start.firstObservedAt)), evidence: evidenceFor([start, end]), reason: 'Observed match duration; browser polling delay affects both endpoints.' } : unknown('Separate match-start and match-end browser observation times are required.'),
    harnessDurationMs: Math.max(0, Date.parse(input.endedAt) - Date.parse(input.startedAt)),
    totalRounds: input.status === 'completed' && input.resultSummary?.totalRounds != null ? { value: input.resultSummary.totalRounds, evidence: ['results.txt'] } : complete && input.roundsObserved.length ? { value: Math.max(...input.roundsObserved), evidence: ['replay.json#observations'] } : unknown('A completed match with a visible round counter is required.'),
    players, counters,
    firstInteractionRound: {
      playerVsPlayer: firstRound(event => {
        if (/^.+ (?:offered a Trade to .+|made a (?:open|covered) Threat against .+|used (?:Knife|Pistol))\.$/.test(event.text)) return true;
        const interaction = event.text.match(/^(.+) used .+ on (.+)\.$/) ?? event.text.match(/^(.+) revived (.+) to \d+ HP\.$/) ?? event.text.match(/^(.+) looted .+ from (.+)\.$/);
        return Boolean(interaction && interaction[1] !== interaction[2]);
      }),
      damage: firstRound(/^.+ took \d+ damage\.$/),
      trade: firstRound(/^.+ offered a Trade to .+\.$/),
      threat: firstRound(/^.+ made a (?:open|covered) Threat against .+\.$/),
      chest: firstRound(/^.+ (?:opened the (?:Standard|Black) Chest|inspected Standard Chest)\.$/),
    },
    selfReportedNoMeaningfulActionObservations: input.noMeaningfulActions,
  };
}
