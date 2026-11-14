import { useCallback, useEffect, useState } from 'react';
import type { State } from '../core/model';
import { loadState, saveState } from '../core/storage';

export function useStore() {
  const [state, setState] = useState<State>(loadState);
  useEffect(() => saveState(state), [state]);
  const update = useCallback((fn: (s: State) => State) => setState(fn), []);
  return [state, update] as const;
}
