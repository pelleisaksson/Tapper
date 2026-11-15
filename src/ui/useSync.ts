import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { emptyState, type State } from '../core/model';
import { emptyMeta, syncOnce } from '../core/sync';
import { loadMeta, saveMeta } from '../core/storage';
import { openedFromRecoveryLink, supabase, supabaseRemote } from '../sync/supabase';
import { updateChecked } from '../update';

export type SyncStatus = 'off' | 'signed-out' | 'syncing' | 'synced' | 'offline' | 'error';

export interface SyncApi {
  status: SyncStatus;
  email: string | null;
  lastSynced: Date | null;
  error: string | null;
  syncNow: () => void;
  /** True after opening a password-reset link: the user should pick a new password. */
  recovering: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  /** Returns true if the account is ready, false if the email must be confirmed first. */
  signUp: (email: string, password: string) => Promise<boolean>;
  resetPassword: (email: string) => Promise<void>;
  setNewPassword: (password: string) => Promise<void>;
  sendCode: (email: string) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
}

/** Supabase error messages in Swedish for the cases users actually hit. */
export function authErrorText(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Fel e-post eller lösenord.';
  if (m.includes('email not confirmed')) return 'E-postadressen är inte bekräftad än. Klicka på länken i mejlet från Supabase och försök igen.';
  if (m.includes('already registered')) return 'Det finns redan ett konto med den e-posten. Logga in istället.';
  if (m.includes('password should be')) return 'Lösenordet är för kort. Använd minst 6 tecken.';
  if (m.includes('rate limit') || m.includes('security purposes')) return 'För många försök. Vänta en stund och försök igen.';
  if (m.includes('token has expired') || m.includes('invalid')) return 'Koden eller länken är ogiltig eller för gammal.';
  if (m.includes('failed to fetch')) return 'Ingen kontakt med servern. Kontrollera nätet.';
  return msg;
}

const LOCAL_DEBOUNCE = 1200;
const REMOTE_DEBOUNCE = 300;
const HEARTBEAT = 60_000;
const SHOW_SYNCING_AFTER = 1000;

export function useSync(
  state: State,
  getState: () => State,
  update: (fn: (s: State) => State) => void,
): SyncApi {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<SyncStatus>(supabase ? 'signed-out' : 'off');
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(openedFromRecoveryLink);

  const metaRef = useRef(loadMeta());
  const running = useRef(false);
  const again = useRef(false);
  const timer = useRef<number>();

  // ---- Session ----
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  const run = useCallback(async () => {
    if (!supabase || !userId) return;
    if (running.current) { again.current = true; return; }
    if (!navigator.onLine) { setStatus('offline'); return; }
    running.current = true;
    // Let a pending update reload the page before this (possibly old) code syncs.
    await updateChecked();
    // Background syncs take a fraction of a second; only show "Synkar…" if one
    // is actually slow, so the status doesn't flicker.
    const slow = window.setTimeout(() => setStatus('syncing'), SHOW_SYNCING_AFTER);
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
      window.clearTimeout(slow);
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
  const redirectTo = window.location.origin + window.location.pathname;

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) return false;
    const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } });
    if (error) throw error;
    return !!data.session;
  }, [redirectTo]);

  const resetPassword = useCallback(async (email: string) => {
    if (!supabase) return;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  }, [redirectTo]);

  const setNewPassword = useCallback(async (password: string) => {
    if (!supabase) return;
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    setRecovering(false);
  }, []);

  const sendCode = useCallback(async (email: string) => {
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
    });
    if (error) throw error;
  }, [redirectTo]);

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
    recovering, syncNow: run, signIn, signUp, resetPassword, setNewPassword, sendCode, verifyCode, signOut,
  };
}
