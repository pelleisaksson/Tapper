// Backend-agnostic, offline-first sync.
//
// The local State is flattened into rows (customer / project / tap / settings).
// A snapshot remembers each row as it was last agreed with the server, so local
// changes are found by diffing – no change tracking needed in the UI code.
//
// Conflict rule: last writer wins per row. A row changed locally and not yet
// pushed is never overwritten by a pull; it is pushed and wins. Taps are
// separate rows, so taps from different devices never conflict.

import { DEFAULT_SETTINGS, type Customer, type Note, type Project, type Settings, type State, type Tap } from './model';

export type Kind = 'customer' | 'project' | 'tap' | 'note' | 'settings';

export interface Row {
  kind: Kind;
  id: string;
  data: unknown;
  sort: number;
  deleted: boolean;
  /** Server timestamp (ISO). Only set on rows coming from the server. */
  updated_at?: string;
}

export interface SyncMeta {
  /** key -> serialized row content as last agreed with the server */
  snapshot: Record<string, string>;
  /** Server timestamp of the newest row seen. */
  cursor: string | null;
  /** How snapshot entries are serialized. Missing = 1 (plain JSON.stringify). */
  format?: number;
}

/** Current snapshot serialization: JSON with sorted keys. */
export const SNAPSHOT_FORMAT = 2;

export interface Remote {
  /** Rows changed after `since` (all rows if null), oldest first. */
  pull(since: string | null): Promise<Row[]>;
  /** Upsert rows; returns them with server timestamps. */
  push(rows: Row[]): Promise<Row[]>;
}

/** Thrown by Remote.push when only some rows were saved. */
export class PartialPushError extends Error {
  constructor(public saved: Row[], public cause: Error) {
    super(cause.message);
  }
}

export const emptyMeta = (): SyncMeta => ({ snapshot: {}, cursor: null, format: SNAPSHOT_FORMAT });

const SETTINGS_ID = 'settings';
export const keyOf = (r: { kind: Kind; id: string }) => `${r.kind}:${r.id}`;
/** JSON with sorted object keys: the database (jsonb) does not keep key order. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') {
    const entries = Object.entries(v as Record<string, unknown>)
      .filter(([, x]) => x !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, x]) => `${JSON.stringify(k)}:${stable(x)}`).join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}
const content = (r: Row) => stable([r.data, r.sort]);

/**
 * Re-encode a snapshot written by an older app version in the current format.
 * Without this, every row would look locally edited after an upgrade, and a
 * device with stale data would push it all and overwrite newer edits.
 */
export function migrateMeta(meta: SyncMeta): SyncMeta {
  if ((meta.format ?? 1) >= SNAPSHOT_FORMAT) return meta;
  const snapshot: Record<string, string> = {};
  for (const [k, v] of Object.entries(meta.snapshot)) {
    try {
      snapshot[k] = stable(JSON.parse(v));
    } catch {
      snapshot[k] = v;
    }
  }
  return { ...meta, snapshot, format: SNAPSHOT_FORMAT };
}

export function rowsOf(state: State): Map<string, Row> {
  const m = new Map<string, Row>();
  const add = (kind: Kind, id: string, data: unknown, sort: number) =>
    m.set(`${kind}:${id}`, { kind, id, data, sort, deleted: false });
  state.customers.forEach((c, i) => add('customer', c.id, c, i));
  state.projects.forEach((p, i) => add('project', p.id, p, i));
  state.taps.forEach((t) => add('tap', t.id, t, 0));
  (state.notes ?? []).forEach((n) => add('note', n.id, n, 0));
  add('settings', SETTINGS_ID, state.settings, 0);
  return m;
}

/** Rows that differ from the snapshot, including deletions (as tombstones). */
export function dirtyRows(state: State, meta: SyncMeta): Row[] {
  const out: Row[] = [];
  const current = rowsOf(state);
  for (const [k, r] of current) if (meta.snapshot[k] !== content(r)) out.push(r);
  for (const k of Object.keys(meta.snapshot)) {
    if (current.has(k)) continue;
    const i = k.indexOf(':');
    out.push({ kind: k.slice(0, i) as Kind, id: k.slice(i + 1), data: null, sort: 0, deleted: true });
  }
  return out;
}

function sortedBy<T extends { id: string }>(items: Map<string, { v: T; sort: number }>): T[] {
  return [...items.values()].sort((a, b) => a.sort - b.sort || (a.v.id < b.v.id ? -1 : 1)).map((x) => x.v);
}

/**
 * Apply server rows to the state, skipping rows that are dirty locally.
 * Returns the new state and the remote rows that were actually applied.
 */
export function applyRemote(state: State, remote: Row[], meta: SyncMeta): { state: State; applied: Row[] } {
  if (remote.length === 0) return { state, applied: [] };
  const protect = new Set(dirtyRows(state, meta).map(keyOf));
  // Settings is a single row with a fixed id. On a device that has never
  // synced it, the local value is just the defaults, not a real edit: adopt
  // the account's settings instead of overwriting them.
  const settingsKey = keyOf({ kind: 'settings', id: SETTINGS_ID });
  if (!(settingsKey in meta.snapshot)) protect.delete(settingsKey);
  // Keep only the newest version of each row.
  const latest = new Map<string, Row>();
  for (const r of remote) latest.set(keyOf(r), r);

  const customers = new Map(state.customers.map((v, i) => [v.id, { v, sort: i }]));
  const projects = new Map(state.projects.map((v, i) => [v.id, { v, sort: i }]));
  const taps = new Map(state.taps.map((t) => [t.id, t]));
  const notes = new Map((state.notes ?? []).map((n) => [n.id, n]));
  let settings: Settings = state.settings;
  const applied: Row[] = [];

  for (const [k, r] of latest) {
    if (protect.has(k)) continue;
    // Already agreed (e.g. overlapping pull or our own push echoed back).
    if (r.deleted ? !(k in meta.snapshot) : meta.snapshot[k] === content(r)) continue;
    applied.push(r);
    switch (r.kind) {
      case 'customer':
        if (r.deleted) customers.delete(r.id);
        else customers.set(r.id, { v: r.data as Customer, sort: r.sort });
        break;
      case 'project':
        if (r.deleted) projects.delete(r.id);
        else projects.set(r.id, { v: r.data as Project, sort: r.sort });
        break;
      case 'tap':
        if (r.deleted) taps.delete(r.id);
        else taps.set(r.id, r.data as Tap);
        break;
      case 'note':
        if (r.deleted) notes.delete(r.id);
        else notes.set(r.id, r.data as Note);
        break;
      case 'settings':
        if (!r.deleted) settings = { ...DEFAULT_SETTINGS, ...(r.data as Settings) };
        break;
    }
  }

  return {
    applied,
    state: {
      customers: sortedBy(customers),
      projects: sortedBy(projects),
      taps: [...taps.values()].sort((a, b) => a.at - b.at),
      notes: [...notes.values()],
      settings,
    },
  };
}

/** Record rows as agreed with the server. */
export function commit(meta: SyncMeta, rows: Row[]): SyncMeta {
  const snapshot = { ...meta.snapshot };
  let cursor = meta.cursor;
  for (const r of rows) {
    const k = keyOf(r);
    if (r.deleted) delete snapshot[k];
    else snapshot[k] = content(r);
    if (r.updated_at && (!cursor || r.updated_at > cursor)) cursor = r.updated_at;
  }
  // Keep the format as is: commit never upgrades a snapshot it didn't migrate.
  return { snapshot, cursor, format: meta.format };
}

/**
 * One sync round. `getState`/`setState` give access to the live state so that
 * edits made while the network calls are in flight are never lost: they stay
 * dirty and go out on the next round.
 */
export async function syncOnce(
  remote: Remote,
  getState: () => State,
  setState: (s: State) => void,
  getMeta: () => SyncMeta,
  setMeta: (m: SyncMeta) => void,
): Promise<{ pulled: number; pushed: number }> {
  // 0. Bring a snapshot from an older app version up to date before comparing.
  const migrated = migrateMeta(getMeta());
  if (migrated !== getMeta()) setMeta(migrated);

  // 1. Pull and apply.
  const pulled = await remote.pull(getMeta().cursor);
  const r = applyRemote(getState(), pulled, getMeta());
  if (r.applied.length) setState(r.state);
  // Cursor advances past everything pulled, even rows skipped as locally dirty.
  const afterPull = commit(getMeta(), r.applied);
  for (const p of pulled) if (p.updated_at && (!afterPull.cursor || p.updated_at > afterPull.cursor)) afterPull.cursor = p.updated_at;
  setMeta(afterPull);

  // 2. Push local changes.
  const dirty = dirtyRows(getState(), getMeta());
  if (dirty.length) {
    let saved: Row[];
    let failure: Error | null = null;
    try {
      saved = await remote.push(dirty);
    } catch (e) {
      if (!(e instanceof PartialPushError)) throw e;
      saved = e.saved;
      failure = e.cause;
    }
    // Commit the content we pushed (not whatever the state is now), and only rows
    // the server actually saved; the rest stay dirty and are retried next round.
    const stamp = new Map(saved.map((s) => [keyOf(s), s.updated_at]));
    setMeta(commit(getMeta(), dirty.filter((d) => stamp.has(keyOf(d))).map((d) => ({ ...d, updated_at: stamp.get(keyOf(d)) }))));
    if (failure) throw failure;
  }
  return { pulled: r.applied.length, pushed: dirty.length };
}
