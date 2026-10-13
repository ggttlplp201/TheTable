export const PLAYER_IDS = ['a', 'b', 'c', 'd'] as const;
export type PlayerId = typeof PLAYER_IDS[number];
export interface UIControl {
  id: string; role: string; name: string;
  kind: 'button' | 'textbox' | 'select' | 'checkbox' | 'radio' | 'link';
  enabled: boolean; value?: string; options?: string[];
}
export interface Observation {
  id: string; playerId: PlayerId; capturedAt: string; url: string; title: string;
  text: string; round: number | null;
  phase: 'entry' | 'lobby' | 'setup' | 'playing' | 'spectator' | 'results';
  controls: UIControl[]; visibleEvents: {sequence: number; text: string}[];
  screenshotPath?: string; errors?: string[];
}
export type UIAction =
  | {type: 'click'; controlId: string}
  | {type: 'fill'; controlId: string; text: string}
  | {type: 'select'; controlId: string; option: string}
  | {type: 'check'; controlId: string; checked: boolean}
  | {type: 'press'; key: string; controlId?: string}
  | {type: 'scroll'; deltaX: number; deltaY: number}
  | {type: 'wait'; ms: number};
export interface Decision {
  observationId: string; intent: string; action: UIAction; noMeaningfulAction: boolean;
}
export interface Assignment {
  playerId: PlayerId; persona: PlayerId; seat: number; rolePreference: string;
}
export interface CompletionInput {system: string; prompt: string; images?: string[]; format?: 'json'|'text'}
export interface ModelClient { complete(input: CompletionInput): Promise<string> }
