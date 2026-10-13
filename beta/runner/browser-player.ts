import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Browser, BrowserContext, Page } from '@playwright/test';
import { buildObservation, disposeBindings, validateBinding, type ObservedPage } from './observation-builder';
import type { Decision, Observation, PlayerId } from './types';

export interface BrowserPlayerOptions { playerId: PlayerId; url: string; outputDir: string }
const SETUP_TIMEOUT = 45_000;
const ALLOWED_KEYS = /^(?:(?:Shift\+)?Tab|Enter|Escape|Space|Arrow(?:Up|Down|Left|Right)|PageUp|PageDown|Home|End|[123jJ])$/;

/** Owns exactly one isolated session. Neither Page nor context reaches an AI. */
export class BrowserPlayer {
  readonly playerId: PlayerId;
  readonly #context: BrowserContext;
  readonly #page: Page;
  readonly #outputDir: string;
  #current: ObservedPage | undefined;
  #screenshotIndex = 0;
  #closedVideo: string | undefined;
  private constructor(context: BrowserContext, page: Page, options: BrowserPlayerOptions) {
    this.playerId = options.playerId; this.#context = context; this.#page = page; this.#outputDir = resolve(options.outputDir);
  }
  static async create(browser: Browser, options: BrowserPlayerOptions): Promise<BrowserPlayer> {
    const url = new URL(options.url);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('The beta requires an http(s) game URL.');
    if (url.searchParams.has('debug')) throw new Error('Debug UI must not be enabled for beta gameplay.');
    const outputDir = resolve(options.outputDir);
    await mkdir(join(outputDir, 'screenshots'), { recursive: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 },
      recordVideo: { dir: join(outputDir, '.videos', options.playerId), size: { width: 1440, height: 1000 } } });
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(15_000);
      await page.goto(options.url, { waitUntil: 'load', timeout: 60_000 });
      return new BrowserPlayer(context, page, options);
    } catch (error) { await context.close(); throw error; }
  }
  async observe(): Promise<Observation> {
    if (this.#current) await disposeBindings(this.#current.bindings);
    this.#current = await buildObservation(this.#page, this.playerId);
    return this.#current.observation;
  }
  async act(decision: Decision): Promise<void> {
    if (!this.#current || decision.observationId !== this.#current.observation.id) throw new Error('Decision refers to a stale or foreign observation.');
    if (['spectator', 'results'].includes(this.#current.observation.phase)) throw new Error('Terminal player observations cannot perform actions.');
    await this.#page.bringToFront();
    const action = decision.action;
    const current = this.#current;
    // A decision is single-use, including rejected actions. The next decision
    // must inspect the current UI instead of replaying a stale command.
    this.#current = undefined;
    try {
    if (action.type === 'wait') {
      if (!Number.isFinite(action.ms) || action.ms < 0 || action.ms > 5_000) throw new Error('UI wait must be between 0 and 5000 milliseconds.');
      await this.#page.waitForTimeout(action.ms); return;
    }
    if (action.type === 'scroll') {
      if (![action.deltaX, action.deltaY].every(value => Number.isFinite(value) && Math.abs(value) <= 2_000)) throw new Error('Scroll distance must be within 2000 pixels.');
      await this.#page.mouse.wheel(action.deltaX, action.deltaY); return;
    }
    if (action.type === 'press' && !ALLOWED_KEYS.test(action.key)) throw new Error('Only ordinary game navigation keys are permitted.');
    if (action.type === 'press' && !action.controlId) {
      const fresh = await buildObservation(this.#page, this.playerId);
      try {
        if (['spectator', 'results'].includes(fresh.observation.phase)) throw new Error('Player has reached a terminal screen.');
        await this.#page.keyboard.press(action.key); return;
      } finally { await disposeBindings(fresh.bindings); }
    }
    const binding = current.bindings.get('controlId' in action ? action.controlId ?? '' : '');
    if (!binding) throw new Error('Action must target a control from this player’s current observation.');
    const { element, label } = await validateBinding(this.#page, binding);
    try {
      switch (action.type) {
        case 'click':
          if (binding.control.kind === 'link') throw new Error('Navigation links are outside gameplay; use the visible game controls.');
          await element.click(); break;
        case 'fill':
          if (binding.control.kind !== 'textbox') throw new Error('Only visible text fields can be filled.');
          if (action.text.length > 2_000) throw new Error('Text input exceeds the beta UI limit.');
          await element.fill(action.text); break;
        case 'select':
          if (binding.control.kind !== 'select' || !binding.control.options?.includes(action.option)) throw new Error('Select a currently visible option label.');
          await element.selectOption({ label: action.option }); break;
        case 'check':
          if (!['checkbox', 'radio'].includes(binding.control.kind)) throw new Error('Only visible checkboxes or radios can be checked.');
          if (await element.isChecked() !== action.checked) {
            if (binding.labelProxy && label) await label.click();
            else await element.setChecked(action.checked);
          }
          break;
        case 'press': await element.press(action.key); break;
      }
    } finally { await element.dispose(); await label?.dispose(); }
    } finally { await disposeBindings(current.bindings); }
  }
  async screenshot(label: string): Promise<string> {
    const safe = label.replace(/[^a-z0-9_-]/gi, '-').slice(0, 80) || 'state';
    const path = join(this.#outputDir, 'screenshots', `player-${this.playerId}-${String(++this.#screenshotIndex).padStart(5, '0')}-${safe}.png`);
    await this.#page.screenshot({ path, fullPage: true });
    return path;
  }
  /** Reveal the fading toolbar using ordinary pointer movement or keyboard navigation. */
  async revealTableTools(timeoutMs = 5_000): Promise<Observation | null> {
    await this.#page.bringToFront();
    const deadline = Date.now() + timeoutMs;
    let attempts = 0;
    while (Date.now() < deadline) {
      const observation = await this.observe();
      if (observation.phase !== 'playing') return null;
      if (await this.#page.locator('[role="dialog"]:visible, .forced-decision:visible').count()) return null;
      if (observation.controls.some(control => control.enabled && control.name === 'Contract')) return observation;
      // Moving the pointer over the bottom-right HUD reveals its public toolbar.
      // Coordinates come from the viewport, not hidden element geometry/state.
      // We only click after the next strict observation shows the controls.
      const viewport = this.#page.viewportSize();
      if (viewport && attempts % 3 === 0) await this.#page.mouse.move(viewport.width - 150, viewport.height - 105);
      else await this.#page.keyboard.press('Tab');
      attempts++;
      await this.#page.waitForTimeout(150);
    }
    return null;
  }
  async inspectHistory(): Promise<Observation | null> {
    const before = await this.revealTableTools();
    if (!before || !before.controls.some(control => control.enabled && control.name === 'Log')) return null;
    await this.#page.getByRole('button', { name: 'Log', exact: true }).click();
    try {
      await this.#page.getByRole('dialog', { name: 'Table history', exact: true }).waitFor({ state: 'visible' });
      return await this.observe();
    } finally {
      // The production close button also fades. Escape is the visible dialog's
      // normal keyboard close behavior and never targets an invisible control.
      if (await this.#page.getByRole('dialog', { name: 'Table history', exact: true }).isVisible()) await this.#page.keyboard.press('Escape');
      if (this.#current) await disposeBindings(this.#current.bindings);
      this.#current = undefined;
    }
  }
  async readHandbook(): Promise<string> {
    await this.#page.bringToFront();
    const skipTraining = this.#page.getByRole('button', { name: 'SKIP FOR NOW', exact: true });
    if (await skipTraining.isVisible()) await skipTraining.click();
    await this.#page.getByRole('button', { name: 'HOW TO PLAY', exact: true }).click({ timeout: SETUP_TIMEOUT });
    const handbook = this.#page.getByRole('region', { name: 'How to play The Table', exact: true });
    await handbook.waitFor({ state: 'visible', timeout: SETUP_TIMEOUT });
    // The complete player-facing rules are rendered in this scrollable panel.
    // No source-code handbook or objective-generation data is supplied.
    const text = await handbook.innerText();
    await this.#page.getByRole('button', { name: '× CLOSE', exact: true }).click({ timeout: SETUP_TIMEOUT });
    return text;
  }
  async createRoom(name: string): Promise<string> {
    await this.#page.bringToFront();
    await this.#page.getByRole('button', { name: /create room/i }).click({ timeout: SETUP_TIMEOUT });
    await this.#page.getByLabel(/name at the table/i).fill(name, { timeout: SETUP_TIMEOUT });
    await this.#page.getByRole('button', { name: /^create room$/i }).click({ timeout: SETUP_TIMEOUT });
    await this.#page.getByRole('heading', { name: 'Choose your starting kit', exact: true }).waitFor({ timeout: SETUP_TIMEOUT });
    const visibleCode = await this.#page.locator('.role-select-stage .kicker').innerText();
    const code = visibleCode.match(/\bROOM\s+([A-Z0-9]{6})\b/i)?.[1];
    if (!code) throw new Error('UI BLOCKER: room code was not visible in the role-selection screen.');
    return code;
  }
  async joinRoom(code: string, name: string): Promise<void> {
    await this.#page.bringToFront();
    await this.#page.getByRole('button', { name: /^join room$/i }).click({ timeout: SETUP_TIMEOUT });
    await this.#page.getByLabel(/name at the table/i).fill(name, { timeout: SETUP_TIMEOUT });
    await this.#page.getByLabel('Room Code', { exact: true }).fill(code, { timeout: SETUP_TIMEOUT });
    await this.#page.getByRole('button', { name: /take a seat/i }).click({ timeout: SETUP_TIMEOUT });
    await this.#page.getByRole('heading', { name: 'Choose your starting kit', exact: true }).waitFor({ timeout: SETUP_TIMEOUT });
  }
  async chooseRoleAndReady(role: string): Promise<void> {
    await this.#page.bringToFront();
    const escaped = role.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await this.#page.getByRole('button', { name: new RegExp(`^${escaped}\\b`, 'i') }).click({ timeout: SETUP_TIMEOUT });
    await this.#page.getByRole('button', { name: /^ready up$/i }).click({ timeout: SETUP_TIMEOUT });
  }
  async startMatch(): Promise<void> {
    await this.#page.bringToFront();
    await this.#page.getByRole('button', { name: /^start match$/i }).click({ timeout: SETUP_TIMEOUT });
  }
  /** Reviewer-only: call after every player interview has been sealed. */
  async resultsSummary(): Promise<string> {
    const results = this.#page.locator('.results-stage .reference-results');
    if (!await results.isVisible()) return '';
    return results.innerText();
  }
  async close(): Promise<string> {
    if (this.#closedVideo) return this.#closedVideo;
    if (this.#current) await disposeBindings(this.#current.bindings);
    this.#current = undefined;
    const video = this.#page.video();
    await this.#context.close();
    if (!video) throw new Error(`No recorded video exists for player ${this.playerId}.`);
    const path = join(this.#outputDir, `player-${this.playerId}-video.webm`);
    await video.saveAs(path);
    await video.delete();
    this.#closedVideo = path;
    return path;
  }
}
