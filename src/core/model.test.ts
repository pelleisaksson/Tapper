import {
  emptyState, tap, minutesFor, dayTotal, removeTap, weekDates, isoWeek,
  formatHM, formatHours, exportCSV, intervalLabel, intervalFor, keyboard, monthWeeks, addMonths, datesBetween, rateFor, amountFor, formatMoney, projectTotals,
  periodRange, shiftPeriod, periodLabel, tileOrder, formatDuration, setNote, noteFor, type TileSort, type State,
} from './model';

function stateWith(...intervals: (number | 'day' | undefined)[]): State {
  const s = emptyState();
  s.customers = [{ id: 'c0', name: 'Kund AB', code: 'K1', color: '#000' }];
  s.projects = intervals.map((interval, i) => ({ id: `a${i}`, customerId: 'c0', name: `Projekt ${i}`, interval }));
  return s;
}

const D = '2026-11-16';

test('tap adds the default interval', () => {
  let s = stateWith(undefined);
  s = tap(s, 'a0', D).state;
  s = tap(s, 'a0', D).state;
  expect(minutesFor(s.taps, 'a0', D)).toBe(30);
});

test('per-account interval overrides default, day uses workday length', () => {
  let s = stateWith(60, 'day');
  s = tap(s, 'a0', D).state;
  s = tap(s, 'a1', D).state;
  expect(minutesFor(s.taps, 'a0', D)).toBe(60);
  expect(minutesFor(s.taps, 'a1', D)).toBe(480);
  expect(dayTotal(s, D)).toBe(540);
});

test('interval falls back project -> customer -> default', () => {
  let s = stateWith(undefined);
  s.customers[0].interval = 30;
  expect(intervalFor(s, s.projects[0])).toBe(30);
  s.projects[0].interval = 60;
  expect(intervalFor(s, s.projects[0])).toBe(60);
});

test('keyboard groups active projects by customer', () => {
  const s = stateWith(15, 15);
  s.projects[1].archived = true;
  s.customers.push({ id: 'c1', name: 'Tom kund', color: '#fff' });
  const k = keyboard(s);
  expect(k).toHaveLength(1);
  expect(k[0].projects.map((p) => p.id)).toEqual(['a0']);
});

test('minus mode subtracts but never below zero', () => {
  let s = stateWith(30);
  s = tap(s, 'a0', D).state;
  s = tap(s, 'a0', D, true).state;
  expect(minutesFor(s.taps, 'a0', D)).toBe(0);
  const r = tap(s, 'a0', D, true);
  expect(r.tap).toBeNull();
});

test('minus clamps a partial interval', () => {
  let s = stateWith(15);
  s = tap(s, 'a0', D).state;
  s = { ...s, projects: [{ ...s.projects[0], interval: 60 }] };
  s = tap(s, 'a0', D, true).state;
  expect(minutesFor(s.taps, 'a0', D)).toBe(0);
});

test('undo removes a tap', () => {
  let s = stateWith(15);
  const r = tap(s, 'a0', D);
  s = removeTap(r.state, r.tap!.id);
  expect(minutesFor(s.taps, 'a0', D)).toBe(0);
});

test('taps are per date', () => {
  let s = stateWith(15);
  s = tap(s, 'a0', D).state;
  expect(minutesFor(s.taps, 'a0', '2026-11-17')).toBe(0);
});

test('week and ISO week number', () => {
  expect(weekDates('2026-11-18')).toEqual([
    '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22',
  ]);
  expect(isoWeek('2026-11-16')).toBe(47);
  expect(isoWeek('2026-01-01')).toBe(1);
  expect(isoWeek('2027-01-01')).toBe(53);
});

test('formatting', () => {
  expect(formatHM(90)).toBe('1:30');
  expect(formatHours(45)).toBe('0,75');
  expect(intervalLabel(15)).toBe('15 min');
  expect(intervalLabel(60)).toBe('1 h');
  expect(intervalLabel('day')).toBe('Dag');
});

test('CSV export', () => {
  let s = stateWith(30);
  s.projects[0].code = 'P-1';
  s = tap(s, 'a0', D).state;
  expect(exportCSV(s, [D])).toBe(
    'Datum;Kund;Kundnr;Projekt;Projektkod;Minuter;Timmar;Timpris;Belopp;Kommentar\n2026-11-16;Kund AB;K1;Projekt 0;P-1;30;0,5;;;',
  );
});

test('month weeks are Monday-based and cover the month', () => {
  const w = monthWeeks('2026-11-14');
  expect(w[0][0]).toBe('2026-10-26');
  expect(w[w.length - 1][6]).toBe('2026-12-06');
  expect(w).toHaveLength(6);
  expect(addMonths('2026-12-31', 1)).toBe('2027-01-01');
});

test('datesBetween is inclusive', () => {
  expect(datesBetween('2026-12-30', '2027-01-02')).toEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
  expect(datesBetween('2026-12-30', '2026-12-29')).toEqual([]);
});

test('hourly rate falls back project -> customer -> global, 0 means none', () => {
  const s = stateWith(15);
  expect(rateFor(s, s.projects[0])).toBeUndefined();
  s.settings.hourlyRate = 900;
  expect(rateFor(s, s.projects[0])).toBe(900);
  s.customers[0].rate = 1000;
  expect(rateFor(s, s.projects[0])).toBe(1000);
  s.projects[0].rate = 0;
  expect(rateFor(s, s.projects[0])).toBeUndefined();
  s.projects[0].rate = 1200;
  expect(rateFor(s, s.projects[0])).toBe(1200);
  expect(amountFor(45, 1200)).toBe(900);
  expect(formatMoney(2850)).toMatch(/^2\s850 kr$/);
});

test('CSV and totals include rate and amount', () => {
  let s = stateWith(30);
  s.settings.hourlyRate = 1000;
  s = tap(s, 'a0', D).state;
  s = tap(s, 'a0', '2026-11-17').state;
  expect(exportCSV(s, [D]).split('\n')[1]).toBe('2026-11-16;Kund AB;K1;Projekt 0;;30;0,5;1000;500;');
  expect(projectTotals(s, weekDates(D)).get('a0')).toEqual({ minutes: 60, amount: 1000 });
});

test('periods', () => {
  expect(periodRange('month', '2026-02-14')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  expect(periodRange('year', '2026-02-14')).toEqual({ from: '2026-01-01', to: '2026-12-31' });
  expect(periodRange('week', '2026-11-18')).toEqual({ from: '2026-11-16', to: '2026-11-22' });
  expect(shiftPeriod('year', '2026-02-14', 1)).toBe('2027-02-01');
  expect(periodLabel('week', '2026-11-18')).toBe('Vecka 47');
});

test('tile order: custom, most used, customer A–Ö, project A–Ö', () => {
  let s = emptyState();
  s.customers = [
    { id: 'c1', name: 'Örebro AB', color: '#000' },
    { id: 'c2', name: 'Alfa', color: '#fff' },
  ];
  s.projects = [
    { id: 'p1', customerId: 'c1', name: 'Zeta' },
    { id: 'p2', customerId: 'c1', name: 'Beta' },
    { id: 'p3', customerId: 'c2', name: 'Gamma' },
  ];
  const ids = (sort: TileSort) => tileOrder(s, sort, D).map((t) => t.project.id);
  expect(ids('custom')).toEqual(['p1', 'p2', 'p3']);
  expect(ids('customer')).toEqual(['p3', 'p2', 'p1']);
  expect(ids('project')).toEqual(['p2', 'p3', 'p1']);
  s = tap(s, 'p3', D).state;
  s = tap(s, 'p3', D).state;
  s = tap(s, 'p2', D).state;
  s = tap(s, 'p1', '2026-01-01').state; // older than 90 days: not counted
  expect(ids('used')).toEqual(['p3', 'p2', 'p1']);
  // shade follows the custom position within the customer, whatever the order
  expect(tileOrder(s, 'project', D).find((t) => t.project.id === 'p2')!.shade).toBe(1);
});

test('duration format', () => {
  expect(formatDuration(0)).toBe('0 min');
  expect(formatDuration(45)).toBe('45 min');
  expect(formatDuration(60)).toBe('1 h');
  expect(formatDuration(90)).toBe('1 h 30 min');
  expect(formatDuration(480)).toBe('8 h');
});

test('comments are one per project and day and exported as a column', () => {
  let s = stateWith(30);
  s = tap(s, 'a0', D).state;
  s = setNote(s, 'a0', D, 'Första');
  s = setNote(s, 'a0', D, 'Skrev rapport; "utkast"');
  expect(s.notes).toHaveLength(1);
  expect(noteFor(s, 'a0', D)).toBe('Skrev rapport; "utkast"');
  const csv = exportCSV(s, [D]).split('\n');
  expect(csv[0].endsWith(';Kommentar')).toBe(true);
  expect(csv[1].endsWith(';"Skrev rapport; ""utkast"""')).toBe(true);
  expect(setNote(s, 'a0', D, '   ').notes).toHaveLength(0);
});

test('pinned projects come first, A–Ö, whatever the sort', () => {
  const s = emptyState();
  s.customers = [{ id: 'c1', name: 'Kund', color: '#000' }];
  s.projects = [
    { id: 'p1', customerId: 'c1', name: 'Delta' },
    { id: 'p2', customerId: 'c1', name: 'Charlie', pinned: true },
    { id: 'p3', customerId: 'c1', name: 'Alfa' },
    { id: 'p4', customerId: 'c1', name: 'Bravo', pinned: true },
  ];
  for (const sort of ['custom', 'used', 'customer', 'project'] as TileSort[]) {
    expect(tileOrder(s, sort, D).slice(0, 2).map((t) => t.project.name)).toEqual(['Bravo', 'Charlie']);
  }
  expect(tileOrder(s, 'custom', D).map((t) => t.project.name)).toEqual(['Bravo', 'Charlie', 'Delta', 'Alfa']);
  expect(tileOrder(s, 'project', D).map((t) => t.project.name)).toEqual(['Bravo', 'Charlie', 'Alfa', 'Delta']);
});
