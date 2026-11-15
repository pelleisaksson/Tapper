import { emptyState, tap, minutesFor, newId, setNote, noteFor, noteId, type State } from './model';
import { syncOnce, emptyMeta, dirtyRows, PartialPushError, type Remote, type Row, type SyncMeta, keyOf } from './sync';

/** In-memory server with a monotonic clock, like the Supabase table. */
class FakeServer {
  rows = new Map<string, Row>();
  t = 0;
  remote(): Remote {
    return {
      pull: async (since) =>
        [...this.rows.values()].filter((r) => !since || r.updated_at! > since).sort((a, b) => (a.updated_at! < b.updated_at! ? -1 : 1)),
      push: async (rows) =>
        rows.map((r) => {
          const saved = { ...r, updated_at: String(++this.t).padStart(8, '0') };
          this.rows.set(keyOf(r), saved);
          return saved;
        }),
    };
  }
}

class Device {
  state: State;
  meta: SyncMeta = emptyMeta();
  constructor(public server: FakeServer, state = emptyState()) { this.state = state; }
  sync() {
    return syncOnce(this.server.remote(), () => this.state, (s) => (this.state = s), () => this.meta, (m) => (this.meta = m));
  }
}

function seeded(): State {
  const s = emptyState();
  s.customers = [{ id: 'c1', name: 'Kund', color: '#000' }];
  s.projects = [{ id: 'p1', customerId: 'c1', name: 'A' }, { id: 'p2', customerId: 'c1', name: 'B' }];
  return s;
}

const D = '2026-11-16';

test('first sync pushes everything, second device receives it', async () => {
  const server = new FakeServer();
  const a = new Device(server, seeded());
  const r = await a.sync();
  expect(r.pushed).toBe(4); // customer, 2 projects, settings
  expect(dirtyRows(a.state, a.meta)).toEqual([]);

  const b = new Device(server);
  await b.sync();
  expect(b.state.projects.map((p) => p.name)).toEqual(['A', 'B']);
  expect(dirtyRows(b.state, b.meta)).toEqual([]);
});

test('taps from two devices merge without conflict', async () => {
  const server = new FakeServer();
  const a = new Device(server, seeded());
  await a.sync();
  const b = new Device(server);
  await b.sync();

  a.state = tap(a.state, 'p1', D).state;
  a.state = tap(a.state, 'p1', D).state;
  b.state = tap(b.state, 'p1', D).state;
  await a.sync();
  await b.sync();
  await a.sync();
  expect(minutesFor(a.state.taps, 'p1', D)).toBe(45);
  expect(minutesFor(b.state.taps, 'p1', D)).toBe(45);
});

test('deletes propagate', async () => {
  const server = new FakeServer();
  const a = new Device(server, seeded());
  await a.sync();
  const b = new Device(server);
  await b.sync();
  a.state = { ...a.state, projects: a.state.projects.filter((p) => p.id !== 'p2') };
  await a.sync();
  await b.sync();
  expect(b.state.projects.map((p) => p.id)).toEqual(['p1']);
});

test('reordering propagates', async () => {
  const server = new FakeServer();
  const a = new Device(server, seeded());
  await a.sync();
  const b = new Device(server);
  await b.sync();
  a.state = { ...a.state, projects: [...a.state.projects].reverse() };
  await a.sync();
  await b.sync();
  expect(b.state.projects.map((p) => p.id)).toEqual(['p2', 'p1']);
});

test('unpushed local edit wins over remote edit of same row', async () => {
  const server = new FakeServer();
  const a = new Device(server, seeded());
  await a.sync();
  const b = new Device(server);
  await b.sync();
  a.state = { ...a.state, projects: a.state.projects.map((p) => (p.id === 'p1' ? { ...p, name: 'Från A' } : p)) };
  await a.sync();
  b.state = { ...b.state, projects: b.state.projects.map((p) => (p.id === 'p1' ? { ...p, name: 'Från B' } : p)) };
  await b.sync();
  await a.sync();
  expect(b.state.projects[0].name).toBe('Från B');
  expect(a.state.projects[0].name).toBe('Från B');
});

test('edits made while a sync is in flight are kept and pushed next round', async () => {
  const server = new FakeServer();
  const a = new Device(server, seeded());
  const base = server.remote();
  const slow: Remote = {
    pull: base.pull,
    push: async (rows) => {
      // User taps while the push is on the wire.
      a.state = tap(a.state, 'p2', D).state;
      return base.push(rows);
    },
  };
  await syncOnce(slow, () => a.state, (s) => (a.state = s), () => a.meta, (m) => (a.meta = m));
  expect(dirtyRows(a.state, a.meta)).toHaveLength(1);
  await a.sync();
  const b = new Device(server);
  await b.sync();
  expect(minutesFor(b.state.taps, 'p2', D)).toBe(15);
});

test('a sync with nothing new changes nothing', async () => {
  const server = new FakeServer();
  const a = new Device(server, seeded());
  await a.sync();
  const before = a.state;
  a.meta = { ...a.meta, cursor: null }; // simulate an overlapping pull
  const r = await a.sync();
  expect(r).toEqual({ pulled: 0, pushed: 0 });
  expect(a.state).toBe(before);
});

test('ids are unique enough', () => {
  const ids = new Set(Array.from({ length: 5000 }, newId));
  expect(ids.size).toBe(5000);
});

test('a new device adopts the account settings instead of overwriting them with defaults', async () => {
  const server = new FakeServer();
  const a = new Device(server, seeded());
  a.state = { ...a.state, settings: { ...a.state.settings, defaultInterval: 30 } };
  await a.sync();

  const b = new Device(server); // fresh device, default settings (15 min)
  await b.sync();
  expect(b.state.settings.defaultInterval).toBe(30);

  await a.sync();
  expect(a.state.settings.defaultInterval).toBe(30);
});

test('changing settings on a synced device reaches the other device', async () => {
  const server = new FakeServer();
  const a = new Device(server, seeded());
  await a.sync();
  const b = new Device(server);
  await b.sync();
  b.state = { ...b.state, settings: { ...b.state.settings, defaultInterval: 60, workdayMinutes: 450 } };
  await b.sync();
  await a.sync();
  expect(a.state.settings).toEqual({ defaultInterval: 60, workdayMinutes: 450 });
});

/** Like Postgres jsonb: object keys come back in a different order. */
function reorderKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(reorderKeys);
  if (v && typeof v === 'object') {
    const e = Object.entries(v as Record<string, unknown>).reverse();
    return Object.fromEntries(e.map(([k, x]) => [k, reorderKeys(x)]));
  }
  return v;
}

test('rows echoed back with reordered keys are not treated as changes', async () => {
  const server = new FakeServer();
  const base = server.remote();
  const jsonb: Remote = {
    pull: async (since) => (await base.pull(since)).map((r) => ({ ...r, data: reorderKeys(r.data) })),
    push: async (rows) => (await base.push(rows)).map((r) => ({ ...r, data: reorderKeys(r.data) })),
  };
  const a = new Device(server, seeded());
  a.state = tap(a.state, 'p1', D).state;
  const run = () => syncOnce(jsonb, () => a.state, (s) => (a.state = s), () => a.meta, (m) => (a.meta = m));
  await run();
  const before = a.state;
  a.meta = { ...a.meta, cursor: null }; // overlapping pull returns everything again
  const r = await run();
  expect(r).toEqual({ pulled: 0, pushed: 0 });
  expect(a.state).toBe(before);
});

/** The snapshot format used before key-order-independent comparison (plain JSON.stringify). */
function legacySnapshot(meta: SyncMeta, state: State): SyncMeta {
  const snapshot: Record<string, string> = {};
  for (const k of Object.keys(meta.snapshot)) {
    const [kind, id] = [k.slice(0, k.indexOf(':')), k.slice(k.indexOf(':') + 1)];
    const list = kind === 'customer' ? state.customers : kind === 'project' ? state.projects : kind === 'tap' ? state.taps : null;
    const idx = list ? list.findIndex((x) => x.id === id) : 0;
    const data = kind === 'settings' ? state.settings : list![idx];
    snapshot[k] = JSON.stringify([data, kind === 'customer' || kind === 'project' ? idx : 0]);
  }
  return { ...meta, snapshot, format: undefined } as SyncMeta;
}

test('a device with an old-format snapshot and stale data does not overwrite newer edits', async () => {
  const server = new FakeServer();
  const phone = new Device(server, seeded());
  phone.state.customers[0] = { id: 'c1', name: 'Kund', color: '#000', code: 'K1' };
  await phone.sync();
  const ipad = new Device(server);
  await ipad.sync();
  // The iPad last synced with the old app version: its snapshot is in the old format.
  ipad.meta = legacySnapshot(ipad.meta, ipad.state);

  // Meanwhile the phone renames a project and changes the color.
  phone.state = {
    ...phone.state,
    customers: [{ ...phone.state.customers[0], color: '#d63b7a' }],
    projects: phone.state.projects.map((p) => (p.id === 'p1' ? { ...p, name: 'Nytt namn' } : p)),
  };
  await phone.sync();

  // The iPad, now on the new version, syncs with its stale data.
  await ipad.sync();
  await phone.sync();
  expect(ipad.state.customers[0].color).toBe('#d63b7a');
  expect(ipad.state.projects[0].name).toBe('Nytt namn');
  expect(phone.state.customers[0].color).toBe('#d63b7a');
  expect(phone.state.projects[0].name).toBe('Nytt namn');
});

test('comments sync between devices and an emptied comment is removed', async () => {
  const server = new FakeServer();
  const a = new Device(server, seeded());
  a.state = setNote(a.state, 'p1', D, 'Möte med styrgruppen');
  await a.sync();
  const b = new Device(server);
  await b.sync();
  expect(noteFor(b.state, 'p1', D)).toBe('Möte med styrgruppen');
  b.state = setNote(b.state, 'p1', D, '');
  await b.sync();
  await a.sync();
  expect(noteFor(a.state, 'p1', D)).toBe('');
});

test('if the server rejects comments, everything else is still committed and comments are retried', async () => {
  const server = new FakeServer();
  const base = server.remote();
  let notesAllowed = false;
  const remote: Remote = {
    pull: base.pull,
    push: async (rows) => {
      const saved = await base.push(rows.filter((r) => r.kind !== 'note'));
      if (!notesAllowed && rows.some((r) => r.kind === 'note')) throw new PartialPushError(saved, new Error('kind check'));
      return [...saved, ...(await base.push(rows.filter((r) => r.kind === 'note')))];
    },
  };
  const a = new Device(server, seeded());
  a.state = setNote(tap(a.state, 'p1', D).state, 'p1', D, 'Text');
  const run = () => syncOnce(remote, () => a.state, (s) => (a.state = s), () => a.meta, (m) => (a.meta = m));
  await expect(run()).rejects.toThrow('kind check');
  expect(dirtyRows(a.state, a.meta).map((r) => r.kind)).toEqual(['note']);
  notesAllowed = true;
  await run();
  expect(dirtyRows(a.state, a.meta)).toEqual([]);
  expect(server.rows.has('note:' + noteId('p1', D))).toBe(true);
});

test('rows of a kind this app version does not know are left alone, never deleted', async () => {
  // Like an older app version meeting comments for the first time.
  const server = new FakeServer();
  const a = new Device(server, seeded());
  await a.sync();
  server.rows.set('future:x1', { kind: 'future' as Row['kind'], id: 'x1', data: { text: 'hej' }, sort: 0, deleted: false, updated_at: String(++server.t).padStart(8, '0') });
  await a.sync();
  await a.sync();
  expect(server.rows.get('future:x1')!.deleted).toBe(false);
  expect(server.rows.get('future:x1')!.data).toEqual({ text: 'hej' });
  expect(dirtyRows(a.state, a.meta)).toEqual([]);
});

test('a deletion keeps the last content on the server so it can be recovered', async () => {
  const server = new FakeServer();
  const a = new Device(server, seeded());
  a.state = setNote(a.state, 'p1', D, 'Viktig text');
  await a.sync();
  a.state = setNote(a.state, 'p1', D, '');
  await a.sync();
  const row = server.rows.get('note:' + noteId('p1', D))!;
  expect(row.deleted).toBe(true);
  expect((row.data as { text: string }).text).toBe('Viktig text');
});

test('the same comment edited on two devices keeps both texts', async () => {
  const server = new FakeServer();
  const phone = new Device(server, seeded());
  await phone.sync();
  const ipad = new Device(server);
  await ipad.sync();
  phone.state = setNote(phone.state, 'p1', D, 'Skrev på telefonen');
  await phone.sync();
  // The iPad hasn't pulled yet and writes in the same field.
  ipad.state = setNote(ipad.state, 'p1', D, 'Skrev på iPaden');
  await ipad.sync();
  await phone.sync();
  for (const d of [phone, ipad]) {
    const text = noteFor(d.state, 'p1', D);
    expect(text).toContain('Skrev på telefonen');
    expect(text).toContain('Skrev på iPaden');
  }
});
