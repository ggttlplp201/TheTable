import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdir, writeFile, appendFile, readFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

// Deliberately no application imports, socket probes, request interception, state
// evaluation, synthetic game clock, or internal command endpoints.
const root = resolve('beta/full-ui');
const url = process.env.BETA_URL ?? 'http://127.0.0.1:4317';
const port = Number(process.env.BETA_RECORDER_PORT ?? 4318);
const players = ['a', 'b', 'c', 'd'];
const viewport = { width: 1440, height: 900 };
const browser = await chromium.launch({ headless: false, args: [
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
] });
let current;
const sessions = new Map();
const tokens = Object.fromEntries(players.map(p => [p, randomUUID()]));
await mkdir(root, { recursive: true });
for (const p of players) await writeFile(resolve(root, `player-${p}-connection.json`), JSON.stringify({ player: p, token: tokens[p], port }));
const stamp = () => ({ timestamp: new Date().toISOString(), elapsedMs: current ? Date.now() - current.started : 0 });
async function record(player, kind, details) {
  const entry = { ...stamp(), player, kind, ...details };
  if (current) {
    current.events.push(entry);
    await appendFile(resolve(current.dir, 'events.jsonl'), `${JSON.stringify(entry)}\n`);
  }
  return entry;
}
async function observe(player) {
  const s = sessions.get(player);
  if (!s) throw new Error('No match is currently recording');
  s.serial++;
  const name = `player-${player}-${String(s.serial).padStart(5, '0')}.png`;
  const shot = resolve(current.dir, 'screenshots', name);
  await s.page.screenshot({ path: shot });
  const text = await s.page.locator('body').ariaSnapshot();
  const observation = { ...stamp(), player, screenshot: shot, text, viewport, videoOffsetMs: Date.now() - s.started };
  await writeFile(resolve(current.dir, `player-${player}-latest.json`), JSON.stringify(observation, null, 2));
  await record(player, 'observation', observation);
  return observation;
}
function finite(n) { if (!Number.isFinite(n)) throw new Error('Expected finite input'); return n; }
function point(x, y) { finite(x); finite(y); if (x < 0 || x >= viewport.width || y < 0 || y >= viewport.height) throw new Error('Pointer outside viewport'); }
async function action(player, a) {
  const s = sessions.get(player);
  if (!s) throw new Error('No match is currently recording');
  const page = s.page;
  await record(player, 'input', { action: a, videoOffsetMs: Date.now() - s.started });
  switch (a.type) {
    case 'click': point(a.x, a.y); await page.mouse.click(a.x, a.y, { button: a.button ?? 'left', clickCount: a.count ?? 1 }); break;
    case 'move': point(a.x, a.y); await page.mouse.move(a.x, a.y); break;
    case 'drag': point(a.x, a.y); point(a.toX, a.toY); await page.mouse.move(a.x, a.y); await page.mouse.down({ button: a.button ?? 'left' }); await page.mouse.move(a.toX, a.toY, { steps: a.steps ?? 20 }); await page.mouse.up({ button: a.button ?? 'left' }); break;
    case 'wheel': await page.mouse.wheel(finite(a.dx ?? 0), finite(a.dy)); break;
    case 'type': if (typeof a.text !== 'string') throw new Error('Text required'); await page.keyboard.insertText(a.text); break;
    case 'key': if (typeof a.key !== 'string' || /F12|Control\+Shift\+[IJC]|Meta\+Alt\+[IJC]/i.test(a.key)) throw new Error('Unsupported key'); await page.keyboard.press(a.key); break;
    case 'role': {
      if (!['button','textbox','checkbox','radio','combobox','option','tab','link','slider','spinbutton'].includes(a.role)) throw new Error('Unsupported UI role');
      let target = page.getByRole(a.role, { name: a.name, exact: true });
      if (a.nth !== undefined) target = target.nth(a.nth);
      if (!await target.isVisible()) throw new Error('UI control is not visible');
      if (a.operation === 'fill') await target.fill(a.value, { timeout: 4000 });
      else if (a.operation === 'select') await target.selectOption({ label: a.value }, { timeout: 4000 });
      else await target.click({ timeout: 4000 });
      break;
    }
    default: throw new Error('Allowed: click, move, drag, wheel, type, key, role');
  }
  await page.waitForTimeout(200);
  return observe(player);
}
async function begin(number) {
  if (current) throw new Error('Finish the current match first');
  if (!Number.isInteger(number) || number < 1 || number > 5) throw new Error('Match must be 1–5');
  const dir = resolve(root, `match-${String(number).padStart(3, '0')}`);
  await mkdir(dir); // Refuse to overwrite evidence.
  await mkdir(resolve(dir, 'screenshots'));
  await mkdir(resolve(dir, 'raw-video'));
  current = { number, dir, started: Date.now(), events: [], videos: {} };
  for (const player of players) {
    const started = Date.now();
    const context = await browser.newContext({ viewport, recordVideo: { dir: resolve(dir, 'raw-video'), size: viewport }, colorScheme: 'dark' });
    const page = await context.newPage();
    sessions.set(player, { context, page, started, serial: 0 });
    current.videos[player] = { startedAt: new Date(started).toISOString(), matchOffsetMs: started - current.started, timing: 'Offsets from browser-context creation; encoding startup may introduce subsecond uncertainty.' };
    page.on('pageerror', error => void record(player, 'browser-error', { message: error.message }));
    await page.goto(url, { waitUntil: 'networkidle' });
    await observe(player);
  }
  await record(null, 'match-recording-start', { number, url, viewport, headed: true });
  return { number, dir, started: current.started };
}
async function finish(body) {
  if (!current) throw new Error('No match active');
  await record(null, 'match-recording-end', { outcome: body.outcome, reason: body.reason });
  for (const [player, s] of sessions) {
    await s.context.close();
    await s.page.video().saveAs(resolve(current.dir, `player-${player}-video.webm`));
  }
  const result = { schemaVersion: 1, mode: 'ui-observation-replay', note: 'Chronological actual UI observations and mouse/keyboard inputs, alongside four videos; not an engine-state replay.', match: current.number, url, startedAt: new Date(current.started).toISOString(), endedAt: new Date().toISOString(), outcome: body.outcome, reason: body.reason, videos: current.videos, events: current.events };
  await writeFile(resolve(current.dir, 'replay.json'), JSON.stringify(result, null, 2));
  await writeFile(resolve(current.dir, 'metrics.json'), JSON.stringify({ match: current.number, outcome: body.outcome, durationMs: Date.now() - current.started, playerCount: 4, headed: true, wallClock: true, gameplayInputs: current.events.filter(e=>e.kind === 'input').length, inputsByPlayer: Object.fromEntries(players.map(p=>[p,current.events.filter(e=>e.kind === 'input' && e.player === p).length])), observations: current.events.filter(e=>e.kind === 'observation').length, notes: current.events.filter(e=>e.kind === 'note'), videos: current.videos, internalGameCalls: 0 }, null, 2));
  const dir = current.dir;
  sessions.clear(); current = null;
  return { dir, outcome: body.outcome };
}
async function readBody(req) {
  let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 100000) throw new Error('Body too large'); }
  return body ? JSON.parse(body) : {};
}
const server = createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const parts = req.url.split('/').filter(Boolean);
    const body = await readBody(req);
    let result;
    if (parts[0] === 'admin') {
      if (parts[1] === 'start') result = await begin(body.match);
      else if (parts[1] === 'finish') result = await finish(body);
      else if (parts[1] === 'status') result = { match: current?.number ?? null, feedback: current ? await Promise.all(players.map(async p=> { try { await readFile(resolve(current.dir, `player-${p}-feedback.md`)); return p; } catch { return null; } })) : [] };
      else throw new Error('Unknown administration operation');
    } else {
      const [player, operation] = parts;
      if (!players.includes(player) || req.headers.authorization !== `Bearer ${tokens[player]}`) throw new Error('Player authentication failed');
      const s = sessions.get(player);
      if (!s) throw new Error('No active match');
      if (s.busy) throw new Error('Player already has an input in progress');
      s.busy = true;
      try {
        if (operation === 'observe') result = await observe(player);
        else if (operation === 'action') result = await action(player, body);
        else if (operation === 'note') result = await record(player, 'note', { ...body, videoOffsetMs: Date.now() - s.started });
        else if (operation === 'feedback') {
          if (typeof body.markdown !== 'string' || body.markdown.length < 100) throw new Error('Complete independent feedback required');
          await writeFile(resolve(current.dir, `player-${player}-feedback.md`), body.markdown);
          result = await record(player, 'feedback-submitted', { videoOffsetMs: Date.now() - s.started });
        } else throw new Error('Unknown UI operation');
      } finally { s.busy = false; }
    }
    res.end(JSON.stringify(result));
  } catch (error) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: error.message }));
  }
});
server.listen(port, '127.0.0.1', () => console.log(`UI-only recorder on http://127.0.0.1:${port}; production UI ${url}`));
for (const signal of ['SIGTERM','SIGINT']) process.on(signal, async () => { if (current) await finish({ outcome: 'interrupted', reason: signal }); await browser.close(); server.close(); process.exit(0); });
