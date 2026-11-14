import { emptyState, DEFAULT_SETTINGS, type State } from './model';
import { emptyMeta, type SyncMeta } from './sync';

// Local-first persistence. The domain logic never touches storage directly,
// so this module can be swapped (e.g. for SwiftData on iOS).

const KEY = 'tapper.state.v1';
const META_KEY = 'tapper.sync.v1';

export function loadState(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyState();
    const s = JSON.parse(raw) as Partial<State>;
    return {
      customers: s.customers ?? [],
      projects: s.projects ?? [],
      taps: s.taps ?? [],
      settings: { ...DEFAULT_SETTINGS, ...s.settings },
    };
  } catch {
    return emptyState();
  }
}

export function saveState(state: State): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable (private mode etc.) – app still works in memory */
  }
}

export interface StoredMeta { userId: string | null; meta: SyncMeta }

export function loadMeta(): StoredMeta {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (raw) return JSON.parse(raw) as StoredMeta;
  } catch { /* ignore */ }
  return { userId: null, meta: emptyMeta() };
}

export function saveMeta(m: StoredMeta): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(m));
  } catch { /* ignore */ }
}
