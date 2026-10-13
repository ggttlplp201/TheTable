import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

export function parseArguments(args) {
  let brief = false, logLines = null, eventLines = null;
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--brief') brief = true;
    else if (args[i] === '--log-lines' || args[i] === '--event-lines') {
      const flag = args[i], value = args[++i];
      if (!/^\d+$/.test(value ?? '') || !Number.isSafeInteger(Number(value))) throw new Error(`${flag} requires a nonnegative integer`);
      if (flag === '--log-lines') logLines = Number(value);
      else eventLines = Number(value);
    } else positional.push(args[i]);
  }
  const [player, operation = 'observe', argument] = positional;
  if (!['a', 'b', 'c', 'd'].includes(player)) throw new Error('Use your assigned player a/b/c/d');
  if (positional.length > 3) throw new Error('Expected player, operation, and at most one JSON/file argument');
  if (logLines !== null && !brief) throw new Error('--log-lines requires --brief; default JSON is never shortened');
  if (eventLines !== null && !brief) throw new Error('--event-lines requires --brief; default JSON is never shortened');
  return { player, operation, argument, brief, logLines, eventLines };
}

// Display-only: preserve non-log content and entire retained log entry subtrees.
// Match explicit accessible role "log" only; do not guess from headings or prose.
export function compactLogBlocks(text, maximum) {
  if (maximum === null) return text;
  const lines = text.split(/\r?\n/), result = [];
  for (let i = 0; i < lines.length; i++) {
    const heading = lines[i].match(/^(\s*)- log(?: "(?:[^"\\]|\\.)*")?:\s*$/);
    if (!heading) { result.push(lines[i]); continue; }
    const indentation = heading[1].length;
    let end = i + 1;
    while (end < lines.length && (!lines[end].trim() || lines[end].match(/^\s*/)[0].length > indentation)) end++;
    const body = lines.slice(i + 1, end);
    const candidates = body.map((line, index) => ({ index, match: line.match(/^(\s*)- /) })).filter(row => row.match);
    const childIndent = Math.min(...candidates.map(row => row.match[1].length));
    const entries = candidates.filter(row => row.match[1].length === childIndent).map(row => row.index);
    result.push(lines[i]);
    if (entries.length <= maximum) result.push(...body);
    else {
      const omitted = entries.length - maximum;
      result.push(...body.slice(0, entries[0]));
      result.push(`${' '.repeat(childIndent)}- [${omitted} earlier log entries omitted from display; full recorder evidence retained]`);
      if (maximum > 0) result.push(...body.slice(entries[omitted]));
    }
    i = end - 1;
  }
  return result.join('\n');
}

// Display-only event-list handling. A plain list must be explicitly scoped by an
// Event Log dialog/region or preceding Event Log heading. Never trim arbitrary lists.
export function compactEventHistory(text, maximum) {
  if (maximum === null) return text;
  const lines = text.split(/\r?\n/), result = [];
  const indentation = line => line.match(/^\s*/)[0].length;
  const eventName = '(?:(?:Public )?Event Log|Event Log · Public)';
  const namedList = new RegExp(`^\\s*- list "${eventName}":\\s*$`, 'i');
  const eventContainer = new RegExp(`^\\s*- (?:dialog|region|complementary) "${eventName}":\\s*$`, 'i');
  const eventHeading = new RegExp(`^\\s*- heading "${eventName}"(?: \\[level=\\d+\\])?:?\\s*$`, 'i');
  for (let i = 0; i < lines.length; i++) {
    const plainList = /^\s*- list:\s*$/.test(lines[i]);
    let eventList = namedList.test(lines[i]);
    const listIndent = indentation(lines[i]);
    if (plainList) {
      for (let j = i - 1; j >= 0; j--) {
        if (!lines[j].trim()) continue;
        const depth = indentation(lines[j]);
        if (depth > listIndent) continue;
        if (depth < listIndent) {
          eventList = eventContainer.test(lines[j]) || eventHeading.test(lines[j]);
          break;
        }
        if (eventHeading.test(lines[j])) { eventList = true; break; }
        // A different heading/list starts a different section.
        if (/^\s*- (?:heading|list)(?:\s|:|$)/.test(lines[j])) break;
      }
    }
    if (!eventList) { result.push(lines[i]); continue; }
    let end = i + 1;
    while (end < lines.length && (!lines[end].trim() || indentation(lines[end]) > listIndent)) end++;
    const body = lines.slice(i + 1, end);
    const candidates = body.map((line, index) => ({ index, line })).filter(row => /^\s*- /.test(row.line));
    const childIndent = Math.min(...candidates.map(row => indentation(row.line)));
    const children = candidates.filter(row => indentation(row.line) === childIndent);
    // Fail open if this is not a conventional event list; preserve unknown markup.
    const conventional = children.every(row => /^\s*- listitem(?:\s|:|$)/.test(row.line));
    result.push(lines[i]);
    if (!conventional || children.length <= maximum) result.push(...body);
    else {
      const omitted = children.length - maximum;
      result.push(...body.slice(0, children[0].index));
      result.push(`${' '.repeat(childIndent)}- [${omitted} earlier event entries omitted from display; full recorder evidence retained]`);
      if (maximum > 0) result.push(...body.slice(children[omitted].index));
    }
    i = end - 1;
  }
  return result.join('\n');
}

export function formatResponse(value, { brief = false, logLines = null, eventLines = null } = {}) {
  if (!brief) return JSON.stringify(value, null, 2);
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return JSON.stringify(value, null, 2);
  const lines = [];
  for (const [key, item] of Object.entries(value)) {
    if (key === 'text') continue;
    lines.push(`${key}: ${typeof item === 'string' ? item : JSON.stringify(item)}`);
  }
  if (typeof value.text === 'string') lines.push('', compactEventHistory(compactLogBlocks(value.text, logLines), eventLines));
  return lines.join('\n');
}

export async function runClient(args, dependencies = {}) {
  const options = parseArguments(args);
  const read = dependencies.readFile ?? readFile;
  const request = dependencies.fetch ?? globalThis.fetch;
  const connection = JSON.parse(await read(new URL(`../../beta/full-ui/player-${options.player}-connection.json`, import.meta.url), 'utf8'));
  let body = options.argument && options.operation !== 'feedback-file' ? JSON.parse(options.argument) : {};
  if (options.operation === 'feedback-file') {
    if (!options.argument) throw new Error('feedback-file requires a path');
    body = { markdown: await read(options.argument, 'utf8') };
  }
  const operation = options.operation === 'feedback-file' ? 'feedback' : options.operation;
  const response = await request(`http://127.0.0.1:${connection.port}/${options.player}/${operation}`, {
    method: 'POST', headers: { Authorization: `Bearer ${connection.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const value = await response.json();
  return { ok: response.ok, output: formatResponse(value, options) };
}

async function selfTest() {
  const text = '- heading "Own turn"\n- log "History":\n  - generic: old one\n  - generic: old two\n    - text: nested old detail\n  - generic: newest\n    - text: nested recent detail\n- button "Action"\n- heading "Log":\n  - text: this heading is not a log role';
  const value = { player: 'a', timestamp: '2026-01-01T00:00:00Z', screenshot: '/synthetic/own.png', videoOffsetMs: 1200, text };
  assert.equal(formatResponse(value), JSON.stringify(value, null, 2));
  assert.ok(formatResponse(value, { brief: true }).includes(text));
  assert.ok(formatResponse(value, { brief: true }).includes('screenshot: /synthetic/own.png'));
  const shortened = formatResponse(value, { brief: true, logLines: 1 });
  assert.ok(!shortened.includes('old one'));
  assert.ok(!shortened.includes('nested old detail'));
  assert.ok(shortened.includes('nested recent detail'));
  assert.ok(shortened.includes('button "Action"'));
  assert.ok(shortened.includes('this heading is not a log role'));
  assert.ok(shortened.includes('2 earlier log entries omitted'));
  assert.equal(value.text, text);
  assert.equal(compactLogBlocks(text, 100), text);
  assert.ok(compactLogBlocks(text, 0).includes('3 earlier log entries omitted'));
  assert.ok(!compactLogBlocks(text, 0).includes('nested recent detail'));
  assert.throws(() => parseArguments(['a', '--log-lines', '2']), /requires --brief/);
  assert.throws(() => parseArguments(['a', '--brief', '--log-lines', '-1']), /nonnegative/);
  assert.deepEqual(parseArguments(['--brief', 'a', 'observe', '--log-lines', '2']), { player: 'a', operation: 'observe', argument: undefined, brief: true, logLines: 2, eventLines: null });
  const eventText = '- main:\n  - list "At the table":\n    - listitem: untouched player\n  - button "Open event log": untouched summary\n  - dialog "Event Log":\n    - heading "Event Log" [level=2]\n    - button "Close"\n    - list:\n      - listitem: ancient event\n        - text: old nested detail\n      - listitem: middle event\n      - listitem: latest event\n        - text: latest nested detail\n    - button "Clear filter"\n  - list:\n    - listitem: unrelated list';
  const eventValue = { ...value, text: eventText };
  const eventShort = formatResponse(eventValue, { brief: true, eventLines: 1 });
  assert.ok(!eventShort.includes('ancient event'));
  assert.ok(!eventShort.includes('old nested detail'));
  assert.ok(!eventShort.includes('middle event'));
  assert.ok(eventShort.includes('latest nested detail'));
  for (const keep of ['untouched player', 'untouched summary', 'Clear filter', 'unrelated list', 'Close']) assert.ok(eventShort.includes(keep));
  assert.ok(eventShort.includes('2 earlier event entries omitted'));
  assert.equal(eventValue.text, eventText);
  assert.equal(formatResponse(eventValue, { eventLines: 0 }), JSON.stringify(eventValue, null, 2));
  assert.equal(compactEventHistory(eventText, null), eventText);
  assert.equal(compactEventHistory(eventText, 99), eventText);
  assert.ok(!compactEventHistory(eventText, 0).includes('latest event'));
  const headingList = '- heading "Event log" [level=2]\n- list:\n  - listitem: heading old\n  - listitem: heading recent\n- heading "Inventory" [level=2]\n- list:\n  - listitem: keep inventory one\n  - listitem: keep inventory two';
  const headingShort = compactEventHistory(headingList, 1);
  assert.ok(!headingShort.includes('heading old'));
  assert.ok(headingShort.includes('heading recent'));
  assert.ok(headingShort.includes('keep inventory one'));
  const tableChat = '- dialog "Table chat":\n  - heading "CHAT" [level=2]\n  - log "Messages":\n    - generic: preserve chat message\n  - heading "EVENT LOG · PUBLIC" [level=2]\n  - list:\n    - listitem: public old\n      - text: public old detail\n    - listitem: public recent\n      - text: public recent detail\n  - button "Close chat"';
  const publicShort = compactEventHistory(tableChat, 1);
  assert.ok(!publicShort.includes('public old'));
  assert.ok(publicShort.includes('public recent detail'));
  assert.ok(publicShort.includes('preserve chat message'));
  assert.ok(publicShort.includes('Close chat'));
  assert.ok(publicShort.includes('1 earlier event entries omitted'));
  const namedEvents = '- list "Public Event Log":\n  - listitem: named old\n  - listitem: named recent';
  assert.ok(!compactEventHistory(namedEvents, 1).includes('named old'));
  const unknownMarkup = '- dialog "Event Log":\n  - list:\n    - generic: preserve unfamiliar markup\n    - listitem: preserve mixed structure';
  assert.equal(compactEventHistory(unknownMarkup, 0), unknownMarkup);
  const unscoped = '- list:\n  - listitem: keep one\n  - listitem: keep two';
  assert.equal(compactEventHistory(unscoped, 0), unscoped);
  const combined = formatResponse({ ...value, text: `${text}\n${eventText}` }, { brief: true, logLines: 1, eventLines: 1 });
  assert.ok(combined.includes('2 earlier log entries omitted'));
  assert.ok(combined.includes('2 earlier event entries omitted'));
  assert.throws(() => parseArguments(['c', '--event-lines', '2']), /requires --brief/);
  for (const bad of ['-1', '1.5', '9007199254740992', '']) assert.throws(() => parseArguments(['c', '--brief', '--event-lines', bad]), /nonnegative/);
  assert.throws(() => parseArguments(['c', '--brief', '--event-lines']), /nonnegative/);
  assert.deepEqual(parseArguments(['c', 'observe', '--brief', '--event-lines', '5', '--log-lines', '2']), { player: 'c', operation: 'observe', argument: undefined, brief: true, logLines: 2, eventLines: 5 });
  let requestArgs;
  const mock = {
    readFile: async (path, encoding) => { assert.equal(encoding, 'utf8'); return path instanceof URL ? JSON.stringify({ port: 1234, token: 'synthetic-token' }) : 'synthetic feedback'; },
    fetch: async (...args) => { requestArgs = args; return { ok: true, json: async () => value }; },
  };
  const response = await runClient(['a', 'action', '{"type":"key","key":"Escape"}', '--brief'], mock);
  assert.equal(response.ok, true);
  assert.equal(requestArgs[0], 'http://127.0.0.1:1234/a/action');
  assert.deepEqual(JSON.parse(requestArgs[1].body), { type: 'key', key: 'Escape' });
  await runClient(['a', 'feedback-file', '/synthetic/feedback.md'], mock);
  assert.deepEqual(JSON.parse(requestArgs[1].body), { markdown: 'synthetic feedback' });
  const failed = await runClient(['b', 'observe', '--brief'], { ...mock, fetch: async () => ({ ok: false, json: async () => ({ error: 'Synthetic failure' }) }) });
  assert.equal(failed.ok, false);
  assert.equal(failed.output, 'error: Synthetic failure');
  console.log('Client synthetic self-test passed: default JSON, brief text, display-only log/event-list trimming, request/feedback bodies, error status.');
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--self-test') return selfTest();
  if (args.length === 1 && args[0] === '--help') {
    console.log('Usage: node qa/full-ui/client.mjs PLAYER [OPERATION [JSON|FILE]] [--brief [--log-lines N] [--event-lines N]]\n       node qa/full-ui/client.mjs --self-test\n--brief prints screenshot/time metadata and raw accessibility text. --log-lines keeps the latest N entries of explicit ARIA log blocks. --event-lines keeps the last N rendered entries of explicitly identified Event Log lists. Both limits affect displayed text only.');
    return;
  }
  const result = await runClient(args);
  console.log(result.output);
  if (!result.ok) process.exitCode = 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
