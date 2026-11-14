import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { emptyState, type State } from '../core/model';
import { emptyMeta, syncOnce } from '../core/sync';
import { loadMeta, saveMeta } from '../core/storage';
import { supabase, supabaseRemote } from '../sync/supabase';

export type SyncStatus = 'off' | 'signed-out' | 'syncing' | 'synced' | 'offline' | 'error';

export interface SyncApi {
  status: SyncStatus;
  email: string | null;
  lastSynced: Date | null;
  error: string | null;
  syncNow: () => void;
  sendCode: (email: string) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const LOCAL_DEBOUNCE = 1200;
const REMOTE_DEBOUNCE = 300;
const HEARTBEAT = 60_000;

export function useSync(
  state: State,
  getState: () => State,
  update: (fn: (s: State) => State) => void,
): SyncApi {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<SyncStatus>(supabase ? 'signed-out' : 'off');
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const metaRef = useRef(loadMeta());
  const running = useRef(false);
  const again = useRef(false);
  const timer = useRef<number>();

  // ---- Session ----
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  const run = useCallback(async () => {
    if (!supabase || !userId) return;
    if (running.current) { again.current = true; return; }
    if (!navigator.onLine) { setStatus('offline'); return; }
    running.current = true;
    setStatus('syncing');
    // Data synced under another account must not leak into this one.
    if (metaRef.current.userId !== userId) metaRef.current = { userId, meta: emptyMeta() };
    try {
      await syncOnce(
        supabaseRemote(supabase, userId),
        getState,
        (s) => update(() => s),
        () => metaRef.current.meta,
        (m) => { metaRef.current = { userId, meta: m }; saveMeta(metaRef.current); },
      );
      setStatus('synced');
      setLastSynced(new Date());
      setError(null);
    } catch (e) {
      setStatus(navigator.onLine ? 'error' : 'offline');
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      running.current = false;
      if (again.current) { again.current = false; window.setTimeout(run, 0); }
    }
  }, [userId, getState, update]);

  const schedule = useCallback((ms: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(run, ms);
  }, [run]);

  // ---- Triggers ----
  useEffect(() => {
    if (!supabase || !userId) { if (supabase) setStatus('signed-out'); return; }
    run();
    const client = supabase;
    const channel = client
      .channel(`items-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items', filter: `user_id=eq.${userId}` },
        () => schedule(REMOTE_DEBOUNCE))
      .subscribe();
    const onOnline = () => run();
    const onOffline = () => setStatus('offline');
    const onVisible = () => document.visibilityState === 'visible' && run();
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisible);
    const beat = window.setInterval(run, HEARTBEAT);
    return () => {
      client.removeChannel(channel);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(beat);
      window.clearTimeout(timer.current);
    };
  }, [userId, run, schedule]);

  // Local edits → push shortly after.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (userId) schedule(LOCAL_DEBOUNCE);
  }, [state, userId, schedule]);

  // ---- Auth actions ----
  const sendCode = useCallback(async (email: string) => {
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    });
    if (error) throw error;
  }, []);

  const verifyCode = useCallback(async (email: string, code: string) => {
    if (!supabase) return;
    const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'email' });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await run();
    await supabase.auth.signOut();
    // Local data belongs to the account; clear it so the next user starts clean.
    metaRef.current = { userId: null, meta: emptyMeta() };
    saveMeta(metaRef.current);
    update(() => emptyState());
    setLastSynced(null);
  }, [run, update]);

  return {
    status, error, lastSynced,
    email: session?.user.email ?? null,
    syncNow: run, sendCode, verifyCode, signOut,
  };
}
