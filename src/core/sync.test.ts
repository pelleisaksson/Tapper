import { emptyState, tap, minutesFor, newId, type State } from './model';
import { syncOnce, emptyMeta, dirtyRows, type Remote, type Row, type SyncMeta, keyOf } from './sync';

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
