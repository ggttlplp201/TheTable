import { readFile, writeFile, stat, realpath, readdir, mkdir, mkdtemp, rm, symlink, cp } from 'node:fs/promises';
import { resolve, relative, basename, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

// Offline evidence tooling: no application imports, browser access, or network calls.
const PLAYERS = ['a', 'b', 'c', 'd'];
const MOMENTS = [
  ['opening-table-view', 'Opening table view', ['opening', 'table-view']],
  ['first-turn', 'First turn', ['turn']],
  ['first-item-use', 'First item use', ['item-use', 'use-item']],
  ['first-trade', 'First Trade', ['trade']],
  ['first-threat', 'First Threat', ['threat']],
  ['covered-threat', 'Covered Threat', []],
  ['chest-interaction', 'Chest interaction', ['chest', 'standard-chest', 'black-chest']],
  ['public-shop', 'Public Shop', ['shop']],
  ['black-market', 'Black Market', []],
  ['pocket-interaction', 'Pocket interaction', ['pocket']],
  ['downed-state', 'Downed state', ['downed']],
  ['objective-completion', 'Objective completion', ['objective-complete']],
  ['exit-ready', 'Exit-ready', []], ['exit', 'Exit', ['leave-table']],
  ['result-screen', 'Result screen', ['results']],
];
const norm = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const md = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('|', '\\|').replace(/\r?\n/g, '<br>');
const link = (dir, path, label = basename(path)) => `[${md(label)}](${relative(dir, path).split('/').map(encodeURIComponent).join('/')})`;
const time = ms => Number.isFinite(ms) ? `${Math.floor(ms / 60000)}:${(ms % 60000 / 1000).toFixed(3).padStart(6, '0')}` : 'not recorded';
const entry = (level, code, message) => ({ level, code, message });
async function fileExists(path) { try { return (await stat(path)).isFile(); } catch { return false; } }
function interview(text) {
  const markers = [...text.matchAll(/^(?:\s*#{1,6}\s*)?\s*(?:\*\*)?(\d{1,2})[.):]\s*(.*)$/gm)];
  const answers = markers.map((m, i) => ({ number: Number(m[1]), text: (m[2] + text.slice(m.index + m[0].length, markers[i + 1]?.index ?? text.length)).trim().replace(/^\*\*\s*/, '') }));
  const missing = Array.from({ length: 32 }, (_, i) => i + 1).filter(n => !answers.some(a => a.number === n && a.text && !/^(?:tbd|todo|pending|\.\.\.)[.!]?$/i.test(a.text)));
  const duplicate = [...new Set(answers.filter((a, i) => answers.findIndex(b => b.number === a.number) !== i).map(a => a.number))];
  const extra = answers.filter(a => a.number < 1 || a.number > 32).map(a => a.number);
  return { numberedSections: answers.length, missing, duplicate, extra, complete: !missing.length && !duplicate.length && !extra.length };
}
function probeVideo(path) {
  const result = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', path], { encoding: 'utf8', timeout: 20000 });
  if (result.error?.code === 'ENOENT') return { available: false };
  if (result.error || result.status !== 0) return { available: true, error: result.error?.message ?? (result.stderr.trim() || 'ffprobe failed') };
  try {
    const durationMs = Number(JSON.parse(result.stdout).format?.duration) * 1000;
    return Number.isFinite(durationMs) && durationMs > 0 ? { available: true, durationMs } : { available: true, error: 'No positive duration returned' };
  } catch (error) { return { available: true, error: error.message }; }
}
async function inspect(dir, options) {
  const issues = [];
  const error = (code, message) => issues.push(entry('error', code, message));
  const warning = (code, message) => issues.push(entry('warning', code, message));
  const base = { dir, issues, interviews: {}, videos: {}, coverage: [] };
  // Gate BEFORE reading any interview or replay: all four feedback files must exist.
  for (const p of PLAYERS) if (!await fileExists(resolve(dir, `player-${p}-feedback.md`))) error('feedback-missing', `Player ${p.toUpperCase()} feedback is missing.`);
  if (!await fileExists(resolve(dir, 'replay.json'))) error('not-finalized', 'Final replay.json is missing. Finish recording before reporting.');
  if (issues.length) return base;
  for (const p of PLAYERS) {
    base.interviews[p] = interview(await readFile(resolve(dir, `player-${p}-feedback.md`), 'utf8'));
    if (!base.interviews[p].complete) error('interview-incomplete', `Player ${p.toUpperCase()} needs 32 nonempty, uniquely numbered answer sections.`);
  }
  if (issues.length) return base;
  async function json(name, optional = false) {
    try { return JSON.parse(await readFile(resolve(dir, name), 'utf8')); }
    catch (e) { if (!optional || e.code !== 'ENOENT') error('json', `${name}: ${e.message}`); return null; }
  }
  const replay = await json('replay.json');
  const metrics = await json('metrics.json');
  if (!replay || !metrics) return base;
  base.replay = replay;
  if (!Number.isInteger(replay.match) || replay.match < 1 || replay.match > 5 || basename(dir) !== `match-${String(replay.match).padStart(3, '0')}`) error('match-identity', 'Replay match number must be 1–5 and agree with its match-XXX directory.');
  if (replay.schemaVersion !== 1 || replay.mode !== 'ui-observation-replay' || !Array.isArray(replay.events)) error('replay-schema', 'Expected recorder schemaVersion 1, ui-observation-replay, and events array.');
  if (!Number.isFinite(Date.parse(replay.startedAt)) || !Number.isFinite(Date.parse(replay.endedAt)) || Date.parse(replay.endedAt) < Date.parse(replay.startedAt)) error('not-finalized', 'Replay needs valid, ordered start/end timestamps.');
  const events = Array.isArray(replay.events) ? replay.events : [];
  const end = events.findLast(e => e?.kind === 'match-recording-end');
  if (!end) error('not-finalized', 'No match-recording-end event exists.');
  else if (end.outcome !== replay.outcome) error('outcome-mismatch', 'Final event and replay outcome disagree.');
  if (!['completed', 'blocked', 'interrupted'].includes(replay.outcome)) warning('outcome', 'Unrecognized recorder outcome; completion is not inferred.');
  if (await fileExists(resolve(dir, 'events.jsonl'))) {
    const lines = (await readFile(resolve(dir, 'events.jsonl'), 'utf8')).split(/\r?\n/).filter(l => l.trim());
    const log = [];
    for (let i = 0; i < lines.length; i++) try { log.push(JSON.parse(lines[i])); } catch (e) { error('jsonl', `events.jsonl line ${i + 1}: ${e.message}`); }
    if (log.length !== events.length || log.some((e, i) => JSON.stringify(e) !== JSON.stringify(events[i]))) warning('event-log-mismatch', 'events.jsonl differs from replay.json; reports use finalized replay.json.');
  } else warning('event-log-missing', 'events.jsonl absent; finalized replay.json is used.');
  for (const p of PLAYERS) {
    await json(`player-${p}-latest.json`, true);
    const path = resolve(dir, `player-${p}-video.webm`);
    if (!await fileExists(path) || !(await stat(path)).size) { error('video-missing', `Player ${p.toUpperCase()} video missing or empty.`); continue; }
    const probe = await (options.probeVideo ?? probeVideo)(path);
    base.videos[p] = { path, sizeBytes: (await stat(path)).size, ...probe };
    if (!probe.available) warning('ffprobe-unavailable', `Player ${p.toUpperCase()} video exists; ffprobe unavailable, duration unchecked.`);
    if (probe.error) error('video-invalid', `Player ${p.toUpperCase()} video: ${probe.error}`);
    if (!Number.isFinite(Date.parse(replay.videos?.[p]?.startedAt))) warning('video-timing', `Player ${p.toUpperCase()} video start metadata missing/invalid.`);
  }
  const shots = new Map();
  async function shot(value, index) {
    if (value == null) return null;
    if (typeof value !== 'string' || !value.trim()) { error('screenshot-path', `Event ${index + 1} screenshot must be a nonempty path string.`); return null; }
    const path = isAbsolute(value) ? value : resolve(dir, value);
    if (shots.has(path)) return shots.get(path);
    try {
      const canonical = await realpath(path); // Resolve absolute paths through workspace symlinks.
      const info = await stat(canonical);
      if (!info.isFile() || !info.size) throw new Error('not a nonempty file');
      const result = { path, canonical }; shots.set(path, result); return result;
    } catch (e) { error('screenshot-missing', `Event ${index + 1} screenshot cannot resolve: ${value} (${e.message})`); shots.set(path, null); return null; }
  }
  base.byPlayer = Object.fromEntries(PLAYERS.map(p => [p, { inputs: 0, observations: 0, notes: 0 }]));
  base.observations = []; base.notes = [];
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    if (!event || typeof event !== 'object') { error('event-schema', `Event ${i + 1} is not an object.`); continue; }
    if (!Number.isFinite(Date.parse(event.timestamp))) error('event-time', `Event ${i + 1} has invalid timestamp.`);
    if (event.player != null && !PLAYERS.includes(event.player)) error('event-player', `Event ${i + 1} has invalid player.`);
    if (['input', 'observation', 'note'].includes(event.kind)) {
      if (!PLAYERS.includes(event.player)) error('event-player', `Event ${i + 1} needs a player.`);
      if (!Number.isFinite(event.videoOffsetMs) || event.videoOffsetMs < 0) error('video-offset', `Event ${i + 1} needs nonnegative video offset.`);
      const duration = base.videos[event.player]?.durationMs;
      if (duration && event.videoOffsetMs > duration + 2000) warning('video-offset-range', `Event ${i + 1} offset exceeds video duration by over two seconds; inspect timing.`);
    }
    const row = base.byPlayer[event.player];
    if (event.kind === 'input' && row) row.inputs++;
    if (event.kind === 'observation') {
      if (row) row.observations++;
      if (!event.screenshot) error('observation-screenshot', `Observation ${i + 1} lacks a screenshot.`);
      base.observations.push({ ...event, index: i, shot: await shot(event.screenshot, i) });
    }
    if (event.kind === 'note') { if (row) row.notes++; base.notes.push({ ...event, index: i, shot: await shot(event.screenshot, i) }); }
  }
  for (const note of base.notes) {
    const matches = note.shot ? base.observations.filter(o => o.player === note.player && o.shot?.canonical === note.shot.canonical) : [];
    note.evidence = matches.findLast(o => Date.parse(o.timestamp) <= Date.parse(note.timestamp)) ?? matches[0] ?? null;
    if (!note.evidence) warning('note-unlinked', `Note ${note.index + 1} has no matching screenshot observation for its player; observer review required.`);
    if (note.severity && !/^P[0-3]$/.test(note.severity)) warning('note-severity', `Note ${note.index + 1} has unrecognized player-proposed severity.`);
  }
  for (const p of PLAYERS) {
    if (!base.byPlayer[p].observations) error('player-observation-missing', `Player ${p.toUpperCase()} has no UI observations.`);
    if (!base.byPlayer[p].inputs) warning('player-input-missing', `Player ${p.toUpperCase()} has no recorded inputs.`);
  }
  const inputCount = Object.values(base.byPlayer).reduce((n, row) => n + row.inputs, 0);
  if (metrics.gameplayInputs !== inputCount || metrics.observations !== base.observations.length) warning('metrics-counts', 'Saved metrics counts differ from replay; reports calculate counts from replay.');
  if (metrics.match !== replay.match || metrics.outcome !== replay.outcome) error('metrics-identity', 'metrics.json match/outcome disagrees with replay.json.');
  base.coverage = MOMENTS.map(([id, label, aliases]) => {
    const claims = base.notes.filter(n => [id, ...aliases].includes(norm(n.event)));
    return { id, label, status: claims.some(n => n.evidence) ? 'observed' : claims.length ? 'player-reported' : 'not encountered', evidence: claims.map(n => ({ player: n.player, noteEventIndex: n.index, observationEventIndex: n.evidence?.index ?? null, timestamp: n.evidence?.timestamp ?? n.timestamp, videoOffsetMs: n.evidence?.videoOffsetMs ?? n.videoOffsetMs, screenshot: n.evidence?.screenshot ?? n.screenshot ?? null })) };
  });
  return base;
}
function validation(m) {
  return { schemaVersion: 1, generatedAt: new Date().toISOString(), match: m.replay?.match ?? basename(m.dir), valid: !m.issues.some(i => i.level === 'error'), errors: m.issues.filter(i => i.level === 'error'), warnings: m.issues.filter(i => i.level === 'warning'), interviews: m.interviews, videos: m.videos, coverage: m.coverage, interpretation: 'Structural validation only. Interview numbering does not prove answer substance or independence. Observed coverage means player-labeled screenshot evidence pending semantic review. Not encountered means no matching labeled evidence, not proof of absence. UI/input/video replay is not deterministic engine-state replay.' };
}
function video(m, p, ms) { return m.videos[p] ? `${link(m.dir, m.videos[p].path, `Player ${p.toUpperCase()} video`)} at ${time(ms)}` : 'not available'; }
const COVERAGE_NOTE = 'Observed = player-labeled moment with a matching recorded screenshot, pending semantic review. Player-reported = label without matching screenshot. Not encountered = no matching labeled evidence; absence does not prove the event never happened. “First” is a player label, not independently verified. No UI-text heuristics or hidden state are used.';
async function writeReports(m) {
  const { dir, replay, byPlayer, notes, observations, coverage } = m;
  const count = kind => replay.events.filter(e => e.kind === kind).length;
  const summary = [`# Match ${replay.match} evidence summary`, '', `Recorder-reported outcome: **${md(replay.outcome)}**. Reason: ${md(replay.reason ?? 'not supplied')}. This does not independently verify game completion.`, '', `Recording: ${md(replay.startedAt)} to ${md(replay.endedAt)} (${time(Date.parse(replay.endedAt) - Date.parse(replay.startedAt))}).`, '', `${count('input')} input attempts; ${count('observation')} observations; ${notes.length} player notes; ${count('browser-error')} browser-error events. Inputs are recorded before execution and do not establish action success.`, '', 'All four interviews contain 32 nonempty numbered sections. Answer substance and independence need observer review.', '', '| Player | Input attempts | Observations | Notes | Interview | Video |', '|---|---:|---:|---:|---|---|', ...PLAYERS.map(p => `| ${p.toUpperCase()} | ${byPlayer[p].inputs} | ${byPlayer[p].observations} | ${byPlayer[p].notes} | ${link(dir, resolve(dir, `player-${p}-feedback.md`))} | ${link(dir, m.videos[p].path)} |`), '', '[Timeline](timeline.md) · [Player notes](ui-issues.md) · [Replay](replay.json) · [Metrics](metrics.json) · [Validation](validation.json)', '', '## Screenshot coverage', '', COVERAGE_NOTE, '', '| Moment | Status | Evidence |', '|---|---|---|', ...coverage.map(c => `| ${c.label} | ${c.status} | ${c.evidence.map(e => `[Player ${e.player.toUpperCase()}, ${time(e.videoOffsetMs)}](timeline.md#event-${(e.observationEventIndex ?? e.noteEventIndex) + 1})`).join('; ') || 'No labeled evidence'} |`), '', '## Validation', '', ...m.issues.map(i => `- ${i.level.toUpperCase()}: ${md(i.message)}`), ...(m.issues.length ? [] : ['No structural errors or warnings.']), '', 'Replay scope: actual UI observations, input attempts, and four videos, not a deterministic engine-state replay. Video offsets originate at browser-context creation; encoder startup can introduce subsecond uncertainty.', ''].join('\n');
  const timeline = [`# Match ${replay.match} UI timeline`, '', 'Recorder events sorted by timestamp, with original replay indexes retained. Input records are attempts; inspect following observations for results. Video offsets have recorder/encoder timing uncertainty.', ''];
  const ordered = replay.events.map((e, index) => ({ ...e, index })).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp) || a.index - b.index);
  for (const e of ordered) {
    timeline.push(`<a id="event-${e.index + 1}"></a>`, `## ${md(e.timestamp)} — ${md(e.player?.toUpperCase() ?? 'recorder')} — ${md(e.kind)}`, '', `Replay array index: ${e.index} (zero based). ${e.player ? video(m, e.player, e.videoOffsetMs) : 'Recorder event.'}`, '');
    if (e.kind === 'observation') {
      const shot = observations.find(o => o.index === e.index)?.shot;
      timeline.push(shot ? link(dir, shot.path, 'Recorded screenshot') : 'Screenshot unavailable.', '', '<details><summary>Recorded accessibility text</summary>', '', md(e.text ?? 'Not recorded.'), '', '</details>', '');
    } else if (e.kind === 'note') timeline.push(`Player-reported ${md(e.event ?? 'note')}: ${md(e.observation ?? 'Not recorded.')}`, '', `[Review note](ui-issues.md#note-${e.index + 1})`, '');
    else timeline.push(md(JSON.stringify(Object.fromEntries(Object.entries(e).filter(([key]) => !['timestamp', 'elapsedMs', 'player', 'kind', 'index', 'videoOffsetMs'].includes(key))))), '');
  }
  const noteReport = [`# Match ${replay.match} player notes for observer review`, '', 'These are player-reported observations, not confirmed defects. Severity is the player’s proposal. Positive observations and coverage markers remain notes; no defect counts or consensus are inferred.', '', 'Observer severity rubric: P0 prevents completion; P1 major confusion or important interaction broken; P2 noticeable usability problem; P3 polish.', ''];
  if (!notes.length) noteReport.push('No player notes recorded. This does not establish that there were no UI issues.', '');
  for (const n of notes) noteReport.push(`<a id="note-${n.index + 1}"></a>`, `## Player ${md(n.player?.toUpperCase())}: ${md(n.event ?? 'unclassified note')}`, '',
    '- STATUS: Player-reported; needs observer review.',
    `- TIMESTAMP: ${md(n.evidence?.timestamp ?? n.timestamp)} (${n.evidence ? 'screenshot observation' : 'note submission; no matched screenshot observation'}).`,
    `- NOTE SUBMITTED: ${md(n.timestamp)}; video offset ${time(n.videoOffsetMs)}.`,
    `- PLAYER: ${md(n.player?.toUpperCase())}`,
    `- SEVERITY: ${md(n.severity ?? 'Unclassified')} (player-proposed, not independently confirmed).`,
    `- SCREEN: ${md(n.screen ?? n.event ?? 'Not recorded')}`,
    `- WHAT HAPPENED: ${md(n.observation ?? 'Not recorded')}`,
    `- WHAT THE PLAYER EXPECTED: ${md(n.expected ?? 'Not recorded')}`,
    `- SCREENSHOT: ${n.shot ? link(dir, n.shot.path) : 'Not supplied or unresolved'}`,
    `- VIDEO TIMESTAMP: ${video(m, n.player, n.evidence?.videoOffsetMs ?? n.videoOffsetMs)} (${n.evidence ? 'screenshot observation' : 'note submission only'}).`,
    `- RECOMMENDED FIX: ${n.expected ? `Player-requested outcome: ${md(n.expected)}. Observer review must determine whether a change is needed and specify any implementation.` : 'Needs observer review; no expected behavior or fix was supplied.'}`,
    `- SOURCE: [Note event ${n.index + 1}](timeline.md#event-${n.index + 1})${n.evidence ? `; [screenshot observation ${n.evidence.index + 1}](timeline.md#event-${n.evidence.index + 1})` : ''}.`, '');
  await writeFile(resolve(dir, 'match-summary.md'), summary);
  await writeFile(resolve(dir, 'timeline.md'), timeline.join('\n'));
  await writeFile(resolve(dir, 'ui-issues.md'), noteReport.join('\n'));
}
export async function generateReports(root, selected = [], options = {}) {
  const names = selected.length ? selected : (await readdir(root, { withFileTypes: true })).filter(e => e.isDirectory() && /^match-\d{3}$/.test(e.name)).map(e => e.name).sort();
  if (!names.length || names.some(n => !/^match-\d{3}$/.test(n))) throw new Error('Select existing match-XXX directories.');
  const matches = [];
  for (const name of names) matches.push(await inspect(resolve(root, name), options));
  const validations = matches.map(validation);
  const batch = { schemaVersion: 1, generatedAt: new Date().toISOString(), valid: validations.every(v => v.valid), selectedMatches: names, matches: validations, finalFindingsGenerated: false };
  for (let i = 0; i < matches.length; i++) if (await fileExists(resolve(matches[i].dir, 'replay.json'))) await writeFile(resolve(matches[i].dir, 'validation.json'), JSON.stringify(validations[i], null, 2) + '\n');
  await writeFile(resolve(root, 'validation.json'), JSON.stringify(batch, null, 2) + '\n');
  if (!batch.valid) return batch; // Refuse all final Markdown generation on failed validation.
  for (const m of matches) await writeReports(m);
  await writeFile(resolve(root, 'coverage.json'), JSON.stringify({ generatedAt: batch.generatedAt, selectedMatches: names, interpretation: COVERAGE_NOTE, matches: matches.map(m => ({ match: m.replay.match, coverage: m.coverage })) }, null, 2) + '\n');
  const index = ['# Full UI beta replay index', '', `This invocation covers ${matches.length} finalized package(s); ${matches.filter(m => m.replay.outcome === 'completed').length} have recorder-reported outcome completed. Game completion still requires observer review. ${matches.length === 5 ? 'Five packages are represented.' : 'The five-match brief is not yet represented by five packages in this index.'}`, '', 'This index and generated notes do not replace final observer findings or the fast-beta comparison.', '', '| Match | Recorder outcome | Summary | Timeline | Player notes | Validation |', '|---|---|---|---|---|---|', ...matches.map(m => `| ${m.replay.match} | ${md(m.replay.outcome)} | ${link(root, resolve(m.dir, 'match-summary.md'))} | ${link(root, resolve(m.dir, 'timeline.md'))} | ${link(root, resolve(m.dir, 'ui-issues.md'))} | ${link(root, resolve(m.dir, 'validation.json'))} |`), '', '## Screenshot coverage', '', COVERAGE_NOTE, '', '| Moment | ' + matches.map(m => `Match ${m.replay.match}`).join(' | ') + ' |', '|---|' + matches.map(() => '---|').join(''), ...MOMENTS.map(([id, label]) => `| ${label} | ${matches.map(m => m.coverage.find(c => c.id === id).status).join(' | ')} |`), '', '[Coverage data](coverage.json) · [Validation](validation.json)', '', 'No engine-state replay, successful-input guarantee, confirmed defect, or player consensus is inferred.', ''].join('\n');
  await writeFile(resolve(root, 'index.md'), index);
  return batch;
}
// Safe batch refresh: finalized replay candidates only, root artifacts only.
// A recorder still writing events has no replay.json and is never inspected here.
export async function generateAggregateReports(root, options = {}) {
  const names = (await readdir(root, { withFileTypes: true })).filter(e => e.isDirectory() && /^match-\d{3}$/.test(e.name)).map(e => e.name).sort();
  const selected = [], skipped = [];
  for (const name of names) {
    if (await fileExists(resolve(root, name, 'replay.json'))) selected.push(name);
    else skipped.push({ match: name, reason: 'No finalized replay.json; evidence was not inspected.' });
  }
  const matches = [];
  for (const name of selected) matches.push(await inspect(resolve(root, name), options));
  const validations = matches.map(validation);
  const batch = {
    schemaVersion: 1, generatedAt: new Date().toISOString(), mode: 'aggregate',
    valid: validations.length > 0 && validations.every(v => v.valid),
    selectedMatches: selected, skippedMatches: skipped, matches: validations,
    errors: selected.length ? [] : [entry('error', 'no-finalized-matches', 'No finalized replay packages found.')],
    finalFindingsGenerated: false, perMatchReportsWritten: false,
  };
  await writeFile(resolve(root, 'validation.json'), JSON.stringify(batch, null, 2) + '\n');
  await writeFile(resolve(root, 'coverage.json'), JSON.stringify({
    generatedAt: batch.generatedAt, mode: 'aggregate', selectedMatches: selected,
    skippedMatches: skipped, interpretation: COVERAGE_NOTE,
    matches: matches.map((m, i) => ({ match: validations[i].match, valid: validations[i].valid, coverage: m.coverage })),
  }, null, 2) + '\n');
  const rows = [];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i], v = validations[i];
    const existing = async name => await fileExists(resolve(m.dir, name)) ? link(root, resolve(m.dir, name)) : 'Not generated';
    rows.push(`| ${md(v.match)} | ${md(m.replay?.outcome ?? 'Not assessed')} | ${v.valid ? 'PASS' : `FAIL (${v.errors.length} errors)`}; ${v.warnings.length} warnings | ${await existing('match-summary.md')} | ${await existing('timeline.md')} | ${await existing('ui-issues.md')} |`);
  }
  const index = ['# Full UI beta replay index', '',
    `Aggregate refresh covers ${matches.length} finalized replay candidate(s); ${validations.filter(v => v.valid).length} pass structural validation. ${matches.filter(m => m.replay?.outcome === 'completed').length} have recorder-reported outcome completed; game completion requires observer review.`, '',
    `${matches.length === 5 && batch.valid ? 'Five structurally valid packages are represented.' : 'The five-match brief is not yet represented by five structurally valid packages.'}`, '',
    'Only root validation, coverage, and this index were refreshed. Existing match summaries, timelines, player notes, observer reviews, and per-match validation files were preserved byte for byte. The current [batch validation](validation.json) is authoritative for this refresh; linked reports may predate it.', '',
    'This index does not replace final observer findings or the fast-beta comparison. Invalid packages remain listed for diagnosis; unassessed coverage must not be interpreted as an unencountered event.', '',
    '| Match | Recorder outcome | Current structural validation | Summary | Timeline | UI issues / notes |',
    '|---|---|---|---|---|---|', ...rows, '',
    ...(skipped.length ? ['## Unfinalized directories', '', ...skipped.map(s => `- ${md(s.match)}: ${s.reason}`), ''] : []),
    ...batch.errors.map(e => `- ERROR: ${e.message}`), '',
    '## Screenshot coverage', '', COVERAGE_NOTE, '',
    ...(matches.length ? ['| Moment | ' + validations.map(v => `Match ${md(v.match)}`).join(' | ') + ' |', '|---|' + matches.map(() => '---|').join(''),
      ...MOMENTS.map(([id, label]) => `| ${label} | ${matches.map((m, i) => `${m.coverage.find(c => c.id === id)?.status ?? 'not assessed'}${validations[i].valid ? '' : ' (validation failed)'}`).join(' | ')} |`)] : ['No finalized package coverage to assess.']), '',
    '[Coverage data](coverage.json) · [Current batch validation](validation.json)', '',
    'No engine-state replay, successful-input guarantee, confirmed defect, or player consensus is inferred.', '',
  ].join('\n');
  await writeFile(resolve(root, 'index.md'), index);
  return batch;
}
async function selfTest() {
  const root = await mkdtemp(join(tmpdir(), 'table-ui-report-test-'));
  try {
    const dir = resolve(root, 'match-001');
    await mkdir(resolve(dir, 'screenshots'), { recursive: true });
    const events = [], videos = {}, start = '2026-01-01T00:00:00.000Z';
    const feedback = Array.from({ length: 32 }, (_, i) => `${i + 1}. Synthetic answer ${i + 1}.`).join('\n');
    for (const p of PLAYERS) {
      await writeFile(resolve(dir, `player-${p}-feedback.md`), feedback);
      await writeFile(resolve(dir, `player-${p}-video.webm`), 'synthetic video; probe injected');
      await writeFile(resolve(dir, 'screenshots', `${p}.png`), 'synthetic screenshot');
      videos[p] = { startedAt: start };
      events.push({ timestamp: start, player: p, kind: 'observation', screenshot: `screenshots/${p}.png`, text: 'Synthetic UI', videoOffsetMs: 100 });
      events.push({ timestamp: start, player: p, kind: 'input', action: { type: 'key', key: 'Escape' }, videoOffsetMs: 200 });
    }
    await symlink(resolve(dir, 'screenshots', 'a.png'), resolve(root, 'a-link.png'));
    events.push({ timestamp: '2026-01-01T00:00:01.000Z', player: 'a', kind: 'note', event: 'public-shop', observation: 'Synthetic report', expected: 'Synthetic expectation', screenshot: resolve(root, 'a-link.png'), videoOffsetMs: 1000 });
    events.push({ timestamp: '2026-01-01T00:00:01.500Z', player: 'b', kind: 'note', event: 'trade', observation: 'Synthetic unlinked report', severity: 'P2', videoOffsetMs: 1500 });
    events.push({ timestamp: '2026-01-01T00:00:02.000Z', player: null, kind: 'match-recording-end', outcome: 'completed' });
    const replay = { schemaVersion: 1, mode: 'ui-observation-replay', match: 1, outcome: 'completed', startedAt: start, endedAt: '2026-01-01T00:00:03.000Z', videos, events };
    const metrics = { match: 1, outcome: 'completed', gameplayInputs: 4, observations: 4 };
    await writeFile(resolve(dir, 'replay.json'), JSON.stringify(replay));
    await writeFile(resolve(dir, 'metrics.json'), JSON.stringify(metrics));
    await writeFile(resolve(dir, 'events.jsonl'), events.map(e => JSON.stringify(e)).join('\n'));
    const options = { probeVideo: () => ({ available: true, durationMs: 3000 }) };
    let result = await generateReports(root, [], options);
    assert.equal(result.valid, true);
    const coverage = result.matches[0].coverage;
    assert.equal(coverage.find(c => c.id === 'public-shop').status, 'observed');
    assert.equal(coverage.find(c => c.id === 'public-shop').evidence[0].videoOffsetMs, 100);
    assert.equal(coverage.find(c => c.id === 'first-trade').status, 'player-reported');
    assert.equal(coverage.find(c => c.id === 'downed-state').status, 'not encountered');
    assert.match(await readFile(resolve(dir, 'ui-issues.md'), 'utf8'), /not confirmed defects/);
    assert.match(await readFile(resolve(dir, 'ui-issues.md'), 'utf8'), /0:00\.100/);
    const second = resolve(root, 'match-002');
    await cp(dir, second, { recursive: true });
    await writeFile(resolve(second, 'replay.json'), JSON.stringify({ ...replay, match: 2 }));
    await writeFile(resolve(second, 'metrics.json'), JSON.stringify({ ...metrics, match: 2 }));
    // Explicit generation retains its selected-only behavior; aggregate restores all.
    result = await generateReports(root, ['match-001'], options);
    assert.deepEqual(result.selectedMatches, ['match-001']);
    const preserved = new Map();
    for (const matchDir of [dir, second]) for (const name of ['match-summary.md', 'timeline.md', 'ui-issues.md', 'observer-review.md', 'observer-review.json', 'validation.json']) {
      const path = resolve(matchDir, name), bytes = `Reviewed synthetic artifact: ${path}\nDo not regenerate.\n`;
      await writeFile(path, bytes); preserved.set(path, bytes);
    }
    // Missing report links must stay missing; aggregation is not report generation.
    await rm(resolve(second, 'timeline.md'));
    preserved.delete(resolve(second, 'timeline.md'));
    const active = resolve(root, 'match-003');
    await mkdir(active);
    await writeFile(resolve(active, 'player-a-feedback.md'), 'Unfinished fixture. Do not inspect.');
    await writeFile(resolve(active, 'events.jsonl'), '{unfinalized evidence must not be parsed');
    result = await generateAggregateReports(root, options);
    assert.equal(result.valid, true);
    assert.deepEqual(result.selectedMatches, ['match-001', 'match-002']);
    assert.deepEqual(result.skippedMatches.map(s => s.match), ['match-003']);
    assert.equal(result.perMatchReportsWritten, false);
    for (const [path, bytes] of preserved) assert.equal(await readFile(path, 'utf8'), bytes);
    assert.equal(await fileExists(resolve(second, 'timeline.md')), false);
    assert.match(await readFile(resolve(root, 'index.md'), 'utf8'), /Unfinalized directories/);
    assert.match(await readFile(resolve(root, 'index.md'), 'utf8'), /Not generated/);
    assert.equal(JSON.parse(await readFile(resolve(root, 'coverage.json'), 'utf8')).matches.length, 2);
    // A replay candidate with absent interviews fails without parsing its replay.
    const unsealed = resolve(root, 'match-004');
    await mkdir(unsealed);
    await writeFile(resolve(unsealed, 'replay.json'), '{must remain unread until interviews exist');
    result = await generateAggregateReports(root, options);
    assert.equal(result.valid, false);
    assert.ok(result.matches[2].errors.some(e => e.code === 'feedback-missing'));
    assert.equal(result.matches[2].errors.some(e => e.code === 'json'), false);
    assert.match(await readFile(resolve(root, 'index.md'), 'utf8'), /not assessed \(validation failed\)/);
    for (const [path, bytes] of preserved) assert.equal(await readFile(path, 'utf8'), bytes);
    assert.equal(await fileExists(resolve(unsealed, 'validation.json')), false);
    assert.equal(await fileExists(resolve(unsealed, 'match-summary.md')), false);
    const empty = resolve(root, 'empty');
    await mkdir(empty);
    const noMatches = await generateAggregateReports(empty, options);
    assert.equal(noMatches.valid, false);
    assert.equal(noMatches.errors[0].code, 'no-finalized-matches');
    for (const fixture of [second, active, unsealed, empty]) await rm(fixture, { recursive: true });
    const unavailable = await generateReports(root, [], { probeVideo: () => ({ available: false }) });
    assert.equal(unavailable.valid, true);
    assert.ok(unavailable.matches[0].warnings.some(e => e.code === 'ffprobe-unavailable'));
    const invalidVideo = await generateReports(root, [], { probeVideo: () => ({ available: true, error: 'Synthetic decoder failure' }) });
    assert.equal(invalidVideo.valid, false);
    assert.ok(invalidVideo.matches[0].errors.some(e => e.code === 'video-invalid'));
    replay.endedAt = null;
    await writeFile(resolve(dir, 'replay.json'), JSON.stringify(replay));
    result = await generateReports(root, [], options);
    assert.ok(result.matches[0].errors.some(e => e.code === 'not-finalized'));
    replay.endedAt = '2026-01-01T00:00:03.000Z';
    replay.match = 2;
    await writeFile(resolve(dir, 'replay.json'), JSON.stringify(replay));
    result = await generateReports(root, [], options);
    assert.ok(result.matches[0].errors.some(e => e.code === 'match-identity'));
    replay.match = 1;
    await writeFile(resolve(dir, 'replay.json'), JSON.stringify(replay));
    await rm(resolve(dir, 'player-d-feedback.md'));
    await rm(resolve(dir, 'match-summary.md'));
    result = await generateReports(root, [], options);
    assert.equal(result.valid, false);
    assert.equal(await fileExists(resolve(dir, 'match-summary.md')), false);
    await writeFile(resolve(dir, 'player-d-feedback.md'), '1. Only one answer.');
    result = await generateReports(root, [], options);
    assert.ok(result.matches[0].errors.some(e => e.code === 'interview-incomplete'));
    await writeFile(resolve(dir, 'player-d-feedback.md'), feedback);
    await writeFile(resolve(dir, 'metrics.json'), '{broken');
    result = await generateReports(root, [], options);
    assert.ok(result.matches[0].errors.some(e => e.code === 'json'));
    await writeFile(resolve(dir, 'metrics.json'), JSON.stringify(metrics));
    await rm(resolve(dir, 'player-a-video.webm'));
    await rm(resolve(dir, 'screenshots', 'b.png'));
    result = await generateReports(root, [], options);
    assert.ok(result.matches[0].errors.some(e => e.code === 'video-missing'));
    assert.ok(result.matches[0].errors.some(e => e.code === 'screenshot-missing'));
    assert.equal(interview(Array.from({ length: 32 }, () => '1. Repeated').join('\n')).complete, false);
    console.log('Synthetic self-test passed: finalized/interview gates, JSON, video/screenshot validation, symlink evidence timing, conservative coverage, aggregate scope and byte-for-byte per-match preservation.');
  } finally { await rm(root, { recursive: true, force: true }); }
}
async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--self-test')) { if (args.length !== 1) throw new Error('--self-test must be used alone.'); await selfTest(); return; }
  if (args.includes('--help')) { console.log('Usage: node qa/full-ui/report.mjs [--root PATH] [--match 1|match-001 ...]\n       node qa/full-ui/report.mjs --aggregate [--root PATH]\n       node qa/full-ui/report.mjs --self-test\n--aggregate refreshes root validation/coverage/index only, across all finalized replay packages; never rewrites per-match artifacts. Cannot combine with --match.\nPer-match generation requires finalized replay and all four complete interviews.'); return; }
  let root = fileURLToPath(new URL('../../beta/full-ui/', import.meta.url));
  const selected = [];
  let aggregate = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--aggregate') aggregate = true;
    else if (args[i] === '--root' && args[i + 1]) root = resolve(args[++i]);
    else if (args[i] === '--match' && args[i + 1]) { const value = args[++i]; selected.push(/^\d{1,3}$/.test(value) ? `match-${value.padStart(3, '0')}` : value); }
    else throw new Error(`Unknown or incomplete argument: ${args[i]}`);
  }
  if (aggregate && selected.length) throw new Error('--aggregate covers all finalized matches and cannot be combined with --match.');
  const result = aggregate ? await generateAggregateReports(root) : await generateReports(root, [...new Set(selected)]);
  console.log(JSON.stringify({ mode: aggregate ? 'aggregate' : 'generate', valid: result.valid, matches: result.selectedMatches, skippedMatches: result.skippedMatches ?? [], validation: resolve(root, 'validation.json'), reportsGenerated: !aggregate && result.valid, aggregateRefreshed: aggregate, errors: [...(result.errors ?? []), ...result.matches.flatMap(m => m.errors.map(e => ({ match: m.match, ...e })))] }, null, 2));
  if (!result.valid) process.exitCode = 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(e => { console.error(e.message); process.exitCode = 1; });
