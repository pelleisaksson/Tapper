import { useCallback, useEffect, useRef, useState } from 'react';
import type { State } from '../core/model';
import { loadState, saveState } from '../core/storage';

/**
 * App state with a synchronously updated ref, so background sync always reads
 * the very latest state (including a tap made a millisecond ago).
 */
export function useStore() {
  const ref = useRef<State>();
  if (!ref.current) ref.current = loadState();
  const [state, setState] = useState<State>(ref.current);
  useEffect(() => saveState(state), [state]);
  const update = useCallback((fn: (s: State) => State) => {
    ref.current = fn(ref.current!);
    setState(ref.current);
  }, []);
  const getState = useCallback(() => ref.current!, []);
  return { state, update, getState };
}
