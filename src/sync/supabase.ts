import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { PartialPushError, type Remote, type Row } from '../core/sync';

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * True when the app was opened from a password reset link. Read before the
 * client consumes the URL, since its PASSWORD_RECOVERY event fires too early
 * for React to catch.
 */
export const openedFromRecoveryLink =
  typeof window !== 'undefined' && /[#&?]type=recovery\b/.test(window.location.hash + window.location.search);

/** null when the app is built without Supabase config – it then runs local-only. */
export const supabase: SupabaseClient | null =
  URL && KEY
    ? createClient(URL, KEY, {
        // Implicit flow: links in emails (confirm, reset password) work even when
        // opened in another browser than the one that asked for them.
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' },
      })
    : null;

const PAGE = 1000;

export const NOTES_NEED_MIGRATION =
  'Kommentarerna kan inte synkas förrän databasen har uppdaterats (se docs/SETUP.md, steg "Kommentarer"). Allt annat synkas som vanligt.';
/** Re-read a few seconds back so rows committed slightly out of order are not missed. */
const OVERLAP_MS = 10_000;

export function supabaseRemote(client: SupabaseClient, userId: string): Remote {
  return {
    async pull(since) {
      const out: Row[] = [];
      const from = since ? new Date(new Date(since).getTime() - OVERLAP_MS).toISOString() : null;
      for (let offset = 0; ; offset += PAGE) {
        let q = client
          .from('items')
          .select('kind,id,data,sort,deleted,updated_at')
          .order('updated_at', { ascending: true })
          .order('id', { ascending: true })
          .range(offset, offset + PAGE - 1);
        if (from) q = q.gt('updated_at', from);
        const { data, error } = await q;
        if (error) throw error;
        out.push(...(data as Row[]));
        if (!data || data.length < PAGE) break;
      }
      return out;
    },
    async push(rows) {
      const out: Row[] = [];
      const upsert = async (batch: Row[]) => {
        for (let i = 0; i < batch.length; i += 500) {
          const chunk = batch.slice(i, i + 500).map((r) => ({
            user_id: userId, kind: r.kind, id: r.id, data: r.data, sort: r.sort, deleted: r.deleted,
          }));
          const { data, error } = await client
            .from('items')
            .upsert(chunk, { onConflict: 'user_id,kind,id' })
            .select('kind,id,data,sort,deleted,updated_at');
          if (error) throw error;
          out.push(...(data as Row[]));
        }
      };
      // Comments go last and separately: on a database created before comments
      // existed, the kind check rejects them, and that must not block everything else.
      await upsert(rows.filter((r) => r.kind !== 'note'));
      const notes = rows.filter((r) => r.kind === 'note');
      try {
        await upsert(notes);
      } catch (e) {
        const err = e as { code?: string; message?: string };
        const cause = err.code === '23514' || /items_kind_check/.test(err.message ?? '')
          ? new Error(NOTES_NEED_MIGRATION)
          : (e as Error);
        throw new PartialPushError(out, cause);
      }
      return out;
    },
  };
}
