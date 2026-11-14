import { emptyState, DEFAULT_SETTINGS, type State } from './model';

// Local-first persistence. Swap this module for a sync backend
// (or for SwiftData/Core Data on iOS) without touching the domain logic.

const KEY = 'tapper.state.v1';

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
