import type { Decision, Observation, UIAction } from './types.js';

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected object');
  return value as Record<string, unknown>;
}
function fields(value: Record<string, unknown>, allowed: string[]) {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`Unexpected field: ${key}`);
}
function text(value: unknown, max: number): value is string { return typeof value === 'string' && value.length > 0 && value.length <= max; }
export function parseDecision(raw: string, observation: Observation): Decision {
  const value = object(JSON.parse(raw));
  fields(value, ['observationId','intent','action','noMeaningfulAction']);
  if (value.observationId !== observation.id) throw new Error('Stale observation ID');
  if (!text(value.intent, 1500) || typeof value.noMeaningfulAction !== 'boolean') throw new Error('Invalid decision metadata');
  const action = object(value.action);
  const kinds: Record<string,string[]> = {click:['type','controlId'],fill:['type','controlId','text'],select:['type','controlId','option'],check:['type','controlId','checked'],press:['type','controlId','key'],scroll:['type','deltaX','deltaY'],wait:['type','ms']};
  if (typeof action.type !== 'string' || !kinds[action.type]) throw new Error('Unsupported UI action');
  fields(action, kinds[action.type]!);
  if (['click','fill','select','check'].includes(action.type) || action.controlId !== undefined) {
    const control = observation.controls.find(c => c.id === action.controlId && c.enabled);
    if (!control) throw new Error('Action must target a currently observed enabled control');
    if (action.type === 'fill' && (control.kind !== 'textbox' || typeof action.text !== 'string' || action.text.length > 2000)) throw new Error('Invalid textbox action');
    if (action.type === 'select' && (control.kind !== 'select' || !text(action.option,500) || !control.options?.includes(action.option))) throw new Error('Invalid visible select option');
    if (action.type === 'check' && (!['checkbox','radio'].includes(control.kind) || typeof action.checked !== 'boolean')) throw new Error('Invalid checkbox action');
  }
  if (action.type === 'press' && !['Escape','Tab','Enter','Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Shift+Tab','PageUp','PageDown','Home','End','1','2','3'].includes(String(action.key))) throw new Error('Only player UI keys are permitted');
  if (action.type === 'scroll' && ![action.deltaX, action.deltaY].every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1200)) throw new Error('Invalid scroll');
  if (action.type === 'wait' && (typeof action.ms !== 'number' || !Number.isInteger(action.ms) || action.ms < 100 || action.ms > 5000)) throw new Error('Wait must be 100–5000ms');
  if (['spectator','results'].includes(observation.phase)) throw new Error('Terminal players cannot act');
  return {observationId: observation.id, intent:value.intent, noMeaningfulAction:value.noMeaningfulAction, action:action as unknown as UIAction};
}
