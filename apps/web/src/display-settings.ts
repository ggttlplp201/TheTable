export type TableTextSize = 'S' | 'M' | 'L';
export const TABLE_TEXT_SIZES: readonly TableTextSize[] = ['S', 'M', 'L'];

export type DisplaySettings = {
  textSize: TableTextSize;
  log: boolean;
  grain: boolean;
};

export const DISPLAY_KEY = 'the-table:display:v1';
export const DEFAULT_DISPLAY: DisplaySettings = { textSize: 'M', log: true, grain: false };

function validTextSize(value: unknown): value is TableTextSize {
  return TABLE_TEXT_SIZES.includes(value as TableTextSize);
}

export function readDisplaySettings(): DisplaySettings {
  if (typeof window === 'undefined') return { ...DEFAULT_DISPLAY };
  try {
    const stored = JSON.parse(localStorage.getItem(DISPLAY_KEY) ?? '{}') as Partial<DisplaySettings>;
    return {
      textSize: validTextSize(stored.textSize) ? stored.textSize : DEFAULT_DISPLAY.textSize,
      log: typeof stored.log === 'boolean' ? stored.log : DEFAULT_DISPLAY.log,
      grain: typeof stored.grain === 'boolean' ? stored.grain : DEFAULT_DISPLAY.grain,
    };
  } catch {
    return { ...DEFAULT_DISPLAY };
  }
}

export function applyDisplaySettings(settings: DisplaySettings, announce = false) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.tableTextSize = settings.textSize;
  document.documentElement.dataset.tableLog = String(settings.log);
  document.documentElement.dataset.tableGrain = settings.grain ? 'normal' : 'low';
  if (announce && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('table-visual-settings', {
      detail: { grain: settings.grain ? .16 : .06, textSize: settings.textSize, log: settings.log },
    }));
  }
}

export function saveDisplaySettings(settings: DisplaySettings) {
  try { localStorage.setItem(DISPLAY_KEY, JSON.stringify(settings)); } catch { /* Settings still apply in this tab. */ }
  applyDisplaySettings(settings, true);
}

export function initializeDisplaySettings() {
  applyDisplaySettings(readDisplaySettings());
}
