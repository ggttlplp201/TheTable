import { randomUUID } from 'node:crypto';
import type { ElementHandle, JSHandle, Page } from '@playwright/test';
import type { Observation, PlayerId, UIControl } from './types';

// This is the entire model/browser boundary. Only rendered UI and accessible
// labels are read. Never add application objects, storage, wire messages, or
// game-package imports here. Control selectors never come from a model.
const CONTROL_SELECTOR = 'button, input:not([type="hidden"]):not([type="password"]), textarea, select, a[href], [role="button"], [role="checkbox"], [role="radio"]';
const EXCLUDED_SELECTOR = '.debug-dashboard, .scene-inventory-access, [hidden], [aria-hidden="true"], .sr-only, script, style, template, noscript';

export interface ControlBinding {
  snapshot: JSHandle<ReturnType<typeof inspectDom>>;
  index: number;
  control: UIControl;
  fingerprint: string;
  labelProxy: boolean;
}
export interface ObservedPage {
  observation: Observation;
  bindings: Map<string, ControlBinding>;
}

/** Pure DOM inspection; deliberately receives no application or network state. */
function inspectDom({ controlsSelector, excludedSelector, target }: { controlsSelector: string; excludedSelector: string; target?: Element }) {
  // Object methods remain self-contained when tsx preserves function names.
  // Named nested arrows would introduce a Node-only __name helper into this
  // function when Playwright serializes it for execution in the browser.
  const view = {
  visible(element: Element): boolean {
    if (element.closest(excludedSelector)) return false;
    const bounds = element.getBoundingClientRect();
    if (bounds.width <= 1 || bounds.height <= 1) return false;
    for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor);
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || Number(style.opacity) === 0) return false;
      if (ancestor instanceof HTMLDetailsElement && !ancestor.open && element !== ancestor.querySelector('summary') && !ancestor.querySelector('summary')?.contains(element)) return false;
    }
    return true;
  },
  exists(selector: string) { return [...document.querySelectorAll(selector)].some(view.visible); },
  renderedText(root: Element): string {
    const parts: string[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const parent = node.parentElement;
      if (parent && view.visible(parent) && node.textContent?.trim()) parts.push(node.textContent.trim());
    }
    return parts.join('\n');
  },
  };
  // Check terminal UI before reading ANY text: spectator/results screens reveal
  // opponents' secrets. They must never enter the player's interview context.
  const terminal = document.querySelector('.results-stage') ? 'results' : document.querySelector('[data-viewer="spectator"]') ? 'spectator' : null;
  if (terminal) return { phase: terminal as 'results' | 'spectator', text: '', round: null, controls: [], events: [], errors: [] };

  const text = view.renderedText(document.body);
  const controls = (target ? [target] : [...document.querySelectorAll(controlsSelector)]).flatMap((element, index) => {
    if (element.closest('.debug-dashboard, .scene-inventory-access, [hidden], [aria-hidden="true"], .sr-only')) return [];
    const input = element instanceof HTMLInputElement ? element : null;
    const label = input?.labels?.[0];
    // Production asset tiles use a transparent checkbox inside a visible label.
    // Clicking that label is the real user interaction, never force-checking it.
    const labelProxy = Boolean(input && ['checkbox', 'radio'].includes(input.type) && label && view.visible(label));
    if (!view.visible(element) && !labelProxy) return [];
    const kind: UIControl['kind'] = element instanceof HTMLSelectElement ? 'select'
      : input?.type === 'checkbox' || element.getAttribute('role') === 'checkbox' ? 'checkbox'
      : input?.type === 'radio' || element.getAttribute('role') === 'radio' ? 'radio'
      : element instanceof HTMLTextAreaElement || input && !['button', 'submit', 'reset'].includes(input.type) ? 'textbox'
      : element instanceof HTMLAnchorElement ? 'link' : 'button';
    if (input?.type === 'range' || input?.type === 'file') return [];
    const accessibleLabels = 'labels' in element ? [...((element as HTMLInputElement).labels ?? [])].map(item => item.textContent?.trim() ?? '').join(' ') : '';
    const name = (element.getAttribute('aria-label') || accessibleLabels || view.renderedText(element) || element.getAttribute('title') || element.getAttribute('placeholder') || '').replace(/\s+/g, ' ').trim();
    if (!name) return [];
    const role = element.getAttribute('role') || (kind === 'select' ? 'combobox' : input?.type === 'number' ? 'spinbutton' : kind);
    const enabled = !element.matches(':disabled') && element.getAttribute('aria-disabled') !== 'true' && !element.closest('[inert]');
    const value = input && ['checkbox', 'radio'].includes(input.type) ? String(input.checked)
      : element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement ? element.value
      : element instanceof HTMLSelectElement ? element.selectedOptions[0]?.label ?? '' : element.getAttribute('aria-pressed') ?? undefined;
    const options = element instanceof HTMLSelectElement ? [...element.options].filter(option => !option.disabled && !option.hidden).map(option => option.label) : undefined;
    return [{ index, kind, role, name, enabled, value, options, labelProxy, element, labelElement: labelProxy ? label ?? null : null,
      fingerprint: JSON.stringify([element.tagName, input?.type ?? '', kind, name]) }];
  });
  const events = [...document.querySelectorAll('.event-log > li')].filter(view.visible).flatMap(element => {
    const sequenceText = element.querySelector('.event-sequence');
    const sequence = Number(sequenceText?.textContent?.trim());
    const eventText = [...element.children].filter(child => child !== sequenceText).map(view.renderedText).join(' ').trim();
    return Number.isInteger(sequence) && sequence > 0 && eventText ? [{ sequence, text: eventText }] : [];
  });
  const roundLabel = [...document.querySelectorAll('.core-round')].find(view.visible);
  const roundMatch = roundLabel ? view.renderedText(roundLabel).match(/\bROUND\s+(\d+)\b/i) : null;
  const phase: Observation['phase'] = view.exists('[aria-label="Private match setup"]') ? 'setup'
    : view.exists('.match-viewport') ? 'playing'
    : view.exists('.role-select-stage, .lobby-board') ? 'lobby' : 'entry';
  const errors = [...document.querySelectorAll('[role="alert"]')].filter(view.visible).map(view.renderedText).filter(Boolean);
  return { phase, text, round: roundMatch ? Number(roundMatch[1]) : null, controls, events, errors };
}

export async function buildObservation(page: Page, playerId: PlayerId): Promise<ObservedPage> {
  const id = randomUUID();
  // Capture exact DOM nodes alongside safe metadata in the same evaluation.
  // The retained snapshot prevents an asynchronously changed index from
  // retargeting a later action. DOM handles never enter the model observation.
  const snapshot = await page.evaluateHandle(inspectDom, { controlsSelector: CONTROL_SELECTOR, excludedSelector: EXCLUDED_SELECTOR });
  const bindings = new Map<string, ControlBinding>();
  try {
    const dom = await snapshot.evaluate(state => ({ ...state, controls: state.controls.map(({ element: _element, labelElement: _label, ...control }) => control) }));
    const controls = dom.controls.map((item, index): UIControl => {
      const control: UIControl = { id: `${id}:${index}`, role: item.role, name: item.name, kind: item.kind, enabled: item.enabled,
        ...(item.value === undefined ? {} : { value: item.value }), ...(item.options === undefined ? {} : { options: item.options }) };
      bindings.set(control.id, { snapshot, index, control, fingerprint: item.fingerprint, labelProxy: item.labelProxy });
      return control;
    });
    if (!bindings.size) await snapshot.dispose();
    return { observation: { id, playerId, capturedAt: new Date().toISOString(), url: page.url(), title: await page.title(), text: dom.text,
      round: dom.round, phase: dom.phase, controls, visibleEvents: dom.events, errors: dom.errors }, bindings };
  } catch (error) {
    await snapshot.dispose();
    throw error;
  }
}

export async function disposeBindings(bindings: Map<string, ControlBinding>): Promise<void> {
  await Promise.allSettled([...new Set([...bindings.values()].map(binding => binding.snapshot))].map(snapshot => snapshot.dispose()));
  bindings.clear();
}

/** Atomically recheck terminal state and the original node's visible metadata. */
export async function validateBinding(page: Page, binding: ControlBinding): Promise<{element: ElementHandle<Element>; label: ElementHandle<Element> | null}> {
  const controls = await binding.snapshot.getProperty('controls');
  const entry = await controls.getProperty(String(binding.index));
  let element: ElementHandle<Element> | null = null;
  let label: ElementHandle<Element> | null = null;
  try {
    const [elementProperty, labelProperty] = await Promise.all([entry.getProperty('element'), entry.getProperty('labelElement')]);
    element = elementProperty.asElement();
    label = labelProperty.asElement();
    if (!label) await labelProperty.dispose();
    if (!element) { await elementProperty.dispose(); throw new Error('The observed control no longer has a DOM element.'); }
    const fresh = await page.evaluate(inspectDom, { controlsSelector: CONTROL_SELECTOR, excludedSelector: EXCLUDED_SELECTOR, target: element });
    if (fresh.phase === 'spectator' || fresh.phase === 'results') throw new Error('Player has reached a terminal screen; further player actions are blocked.');
    const match = fresh.controls[0];
    if (!match || match.fingerprint !== binding.fingerprint) throw new Error('Observed control changed; inspect the UI again.');
    if (!match.enabled) throw new Error('The visible UI control is disabled.');
    return { element, label };
  } catch (error) {
    await element?.dispose();
    await label?.dispose();
    throw error;
  } finally { await controls.dispose(); await entry.dispose(); }
}
