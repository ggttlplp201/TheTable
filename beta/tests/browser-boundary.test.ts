import { createServer, type Server } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import { join } from 'node:path';
import { chromium, type Browser } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BrowserPlayer } from '../runner/browser-player';
import type { Decision, Observation, UIAction } from '../runner/types';

let browser: Browser;
let server: Server;
let baseUrl: string;
let outputDir: string;
const players: BrowserPlayer[] = [];
const pageHtml = (name: string) => `<!doctype html><html><head><title>Boundary fixture</title><style>
.sr-only {width:1px;height:1px;position:absolute;overflow:hidden;clip:rect(0,0,0,0)}
.match-utility {opacity:0} .match-utility:focus-within {opacity:1}
.asset-tile {display:block;width:100px;height:50px;border:1px solid black} .asset-tile input{opacity:0;width:1px;height:1px}
</style></head><body><div class="match-viewport" data-viewer="player"><p class="core-round">ROUND 2</p><h1>Objective visible to ${name}</h1>
<p role="alert">A visible rejection.</p><p hidden role="alert">A hidden alert.</p>
<div hidden>Hidden other objective</div><div style="display:none">Invisible Pocket</div><div style="opacity:0">Transparent secret</div>
<div class="debug-dashboard"><p>Developer private state</p><button>Inject inventory</button></div><div class="sr-only"><select aria-label="Hidden selector"><option>Secret item</option></select></div>
<label>Message<textarea></textarea></label><select aria-label="Private recipient"><option>GLOBAL</option><option>Private: Friend</option></select>
<label class="asset-tile"><input type="checkbox"><span class="sr-only">Key</span><span>Trade Key</span></label>
<button disabled>Disabled action</button><button aria-disabled="true">Unavailable purchase</button>
<button onclick="this.textContent='Changed control'">Change control</button>
<button onclick="setTimeout(() => document.querySelector('#mutable').outerHTML='<button id=mutable>Replacement target</button>', 700)">Schedule replacement</button>
<button id="mutable">Original target</button>
<button onclick="setTimeout(() => document.querySelector('.match-viewport').dataset.viewer='spectator', 700)">Schedule spectator</button>
<button onclick="document.querySelector('h1').textContent=document.querySelector('textarea').value">Send message</button>
<button onclick="document.querySelector('.match-viewport').dataset.viewer='spectator';document.querySelector('h1').textContent='Other player private objective'">Become spectator</button>
<button onclick="document.querySelector('.match-viewport').insertAdjacentHTML('beforeend','<div class=results-stage>Private results secrets</div>')">Finish match</button>
<nav class="match-utility"><button>Contract</button><button>Log</button></nav>
<ol class="event-log"><li><span class="event-sequence">7</span><span>A visible event.</span></li></ol>
</div></body></html>`;

function decision(observation: Observation, action: UIAction): Decision {
  return { observationId: observation.id, action, intent: 'Exercise visible UI', noMeaningfulAction: false };
}
function control(observation: Observation, name: string) {
  const result = observation.controls.find(item => item.name === name);
  if (!result) throw new Error(`Missing visible fixture control ${name}`);
  return result.id;
}
async function player(id: 'a' | 'b' | 'c' | 'd') {
  const result = await BrowserPlayer.create(browser, { playerId: id, url: `${baseUrl}/${id}`, outputDir: join(outputDir, id) });
  players.push(result); return result;
}

beforeAll(async () => {
  outputDir = await mkdtemp(join(tmpdir(), 'table-beta-boundary-'));
  server = createServer((request, response) => { response.setHeader('content-type', 'text/html'); response.end(pageHtml(request.url ?? 'unknown')); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Fixture server did not bind.');
  baseUrl = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true });
}, 30_000);
afterAll(async () => {
  await Promise.allSettled(players.map(item => item.close()));
  await browser?.close();
  if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  if (outputDir) await rm(outputDir, { recursive: true, force: true });
}, 30_000);

describe('player browser boundary', () => {
  it('runs DOM inspection under the actual tsx CLI transpiler without captured helpers', async () => {
    const script = `
      import { chromium } from '@playwright/test';
      import { buildObservation, disposeBindings } from './beta/runner/observation-builder.ts';
      const browser = await chromium.launch({headless:true});
      try {
        const page = await browser.newPage();
        await page.setContent('<main><h1>UI only</h1><button>Visible control</button></main>');
        const result = await buildObservation(page, 'a');
        if (result.observation.controls[0]?.name !== 'Visible control') throw new Error('Missing visible control');
        await disposeBindings(result.bindings);
        console.log('DOM serialization passed');
      } finally { await browser.close(); }
    `;
    const { stdout } = await promisify(execFile)(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', script], { timeout: 30_000 });
    expect(stdout).toContain('DOM serialization passed');
  }, 35_000);

  it('exposes only that session’s rendered UI and blocks hidden/developer controls', async () => {
    const a = await player('a'), b = await player('b');
    const ao = await a.observe(), bo = await b.observe();
    expect(ao.text).toContain('Objective visible to /a');
    expect(ao.text).not.toContain('Objective visible to /b');
    expect(bo.text).toContain('Objective visible to /b');
    for (const secret of ['Hidden other objective', 'Invisible Pocket', 'Transparent secret', 'Developer private state', 'Secret item']) expect(ao.text).not.toContain(secret);
    expect(ao.controls.some(item => /Inject inventory|Hidden selector/.test(item.name))).toBe(false);
    expect(ao.round).toBe(2);
    expect(ao.visibleEvents).toEqual([{ sequence: 7, text: 'A visible event.' }]);
    expect(ao.errors).toEqual(['A visible rejection.']);
    await expect(a.act(decision(ao, { type: 'click', controlId: control(bo, 'Send message') }))).rejects.toThrow('current observation');
    const current = await a.observe();
    await expect(a.act(decision(current, { type: 'click', controlId: control(current, 'Disabled action') }))).rejects.toThrow('disabled');
    const disabled = await a.observe();
    await expect(a.act(decision(disabled, { type: 'click', controlId: control(disabled, 'Unavailable purchase') }))).rejects.toThrow('disabled');
  });
  it('performs normal input and label clicks, consumes observation ids, and saves video/screenshots', async () => {
    const p = await player('c');
    let obs = await p.observe();
    const fill = decision(obs, { type: 'fill', controlId: control(obs, 'Message'), text: 'A real UI message' });
    await p.act(fill);
    await expect(p.act(fill)).rejects.toThrow('stale');
    obs = await p.observe();
    await p.act(decision(obs, { type: 'select', controlId: control(obs, 'Private recipient'), option: 'Private: Friend' }));
    obs = await p.observe();
    const checkbox = obs.controls.find(item => item.kind === 'checkbox');
    expect(checkbox).toBeDefined();
    await p.act(decision(obs, { type: 'check', controlId: checkbox!.id, checked: true }));
    obs = await p.observe();
    expect(obs.controls.find(item => item.kind === 'checkbox')?.value).toBe('true');
    await p.act(decision(obs, { type: 'click', controlId: control(obs, 'Send message') }));
    expect((await p.observe()).text).toContain('A real UI message');
    const screenshot = await p.screenshot('UI-input');
    expect((await readFile(screenshot)).subarray(1, 4).toString()).toBe('PNG');
    const video = await p.close();
    expect((await stat(video)).size).toBeGreaterThan(0);
  });
  it('redacts spectator and result secrets before constructing any player observation', async () => {
    const spectator = await player('d');
    let obs = await spectator.observe();
    await spectator.act(decision(obs, { type: 'click', controlId: control(obs, 'Become spectator') }));
    obs = await spectator.observe();
    expect(obs).toMatchObject({ phase: 'spectator', text: '', controls: [], visibleEvents: [], errors: [], round: null });
    await expect(spectator.act(decision(obs, { type: 'press', key: 'Escape' }))).rejects.toThrow('Terminal');
    const results = await player('a');
    obs = await results.observe();
    await results.act(decision(obs, { type: 'click', controlId: control(obs, 'Finish match') }));
    expect(await results.observe()).toMatchObject({ phase: 'results', text: '', controls: [], visibleEvents: [], errors: [], round: null });
  });
  it('rejects controls replaced or terminal transitions occurring while a model thinks', async () => {
    const p = await player('c');
    let obs = await p.observe();
    await p.act(decision(obs, { type: 'click', controlId: control(obs, 'Schedule replacement') }));
    obs = await p.observe();
    const original = control(obs, 'Original target');
    await delay(850);
    await expect(p.act(decision(obs, { type: 'click', controlId: original }))).rejects.toThrow('changed');
    obs = await p.observe();
    await p.act(decision(obs, { type: 'click', controlId: control(obs, 'Schedule spectator') }));
    obs = await p.observe();
    await delay(850);
    await expect(p.act(decision(obs, { type: 'click', controlId: control(obs, 'Send message') }))).rejects.toThrow('terminal');
  });
  it('reveals fading production tools with normal Tab navigation before reading them', async () => {
    const p = await player('b');
    const hidden = await p.observe();
    expect(hidden.controls.some(item => item.name === 'Contract')).toBe(false);
    const revealed = await p.revealTableTools();
    expect(revealed?.controls.some(item => item.name === 'Contract')).toBe(true);
    expect(revealed?.controls.some(item => item.name === 'Log')).toBe(true);
  }, 30_000);
  it('rejects scripts, arbitrary navigation keys, invisible targets and unbounded waits', async () => {
    const p = await player('b');
    let obs = await p.observe();
    await expect(p.act(decision(obs, { type: 'press', key: 'Control+Shift+J' }))).rejects.toThrow('navigation keys');
    obs = await p.observe();
    await expect(p.act(decision(obs, { type: 'wait', ms: 60_000 }))).rejects.toThrow('5000');
    obs = await p.observe();
    await expect(p.act(decision(obs, { type: 'fill', controlId: 'document.body', text: 'evil' }))).rejects.toThrow('current observation');
    await expect(BrowserPlayer.create(browser, { playerId: 'a', url: `${baseUrl}/?debug=1`, outputDir })).rejects.toThrow('Debug UI');
  });
});
