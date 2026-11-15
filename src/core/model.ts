// Tapper core: pure domain logic, no UI or storage dependencies.
// Kept framework-free so it can be reused (or ported 1:1) in a native iOS app.

/** Billing interval: a number of minutes, or a full workday. */
export type Interval = number | 'day';

export const PRESET_INTERVALS: Interval[] = [15, 30, 60, 'day'];

export interface Customer {
  id: string;
  name: string;
  /** Optional customer number. */
  code?: string;
  color: string;
  /** Default interval for the customer's projects. */
  interval?: Interval;
  /** Hourly rate (SEK) for the customer's projects; overrides the global rate. */
  rate?: number;
  archived?: boolean;
}

/** A project is a billing account – one key on the keyboard. */
export interface Project {
  id: string;
  customerId: string;
  name: string;
  /** Optional project/billing code. */
  code?: string;
  /** Overrides customer and global interval. */
  interval?: Interval;
  /** Hourly rate (SEK); overrides customer and global rate. */
  rate?: number;
  archived?: boolean;
}

/** One tap on a key. Negative minutes = a correction (tap in minus mode). */
export interface Tap {
  id: string;
  projectId: string;
  /** Local date, YYYY-MM-DD. */
  date: string;
  minutes: number;
  at: number;
}

export interface Settings {
  defaultInterval: Interval;
  workdayMinutes: number;
  /** Global hourly rate (SEK). Unset = no rate. */
  hourlyRate?: number;
}

export interface State {
  customers: Customer[];
  projects: Project[];
  taps: Tap[];
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = { defaultInterval: 15, workdayMinutes: 480 };

export const KEY_COLORS = [
  '#1f6feb', '#d9480f', '#2f9e44', '#c2255c', '#7048e8',
  '#0b7285', '#e67700', '#495057',
];

export function emptyState(): State {
  return { customers: [], projects: [], taps: [], settings: { ...DEFAULT_SETTINGS } };
}

export function newId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function customerOf(state: State, project: Project): Customer | undefined {
  return state.customers.find((c) => c.id === project.customerId);
}

/** Effective interval: project → customer → global default. */
export function intervalFor(state: State, project: Project): Interval {
  return project.interval ?? customerOf(state, project)?.interval ?? state.settings.defaultInterval;
}

/** Effective hourly rate: project → customer → global. Undefined or 0 = no rate. */
export function rateFor(state: State, project: Project): number | undefined {
  const r = project.rate ?? customerOf(state, project)?.rate ?? state.settings.hourlyRate;
  return r && r > 0 ? r : undefined;
}

/** Amount in whole kronor for minutes at an hourly rate. */
export function amountFor(minutes: number, rate: number | undefined): number {
  return rate ? Math.round((minutes / 60) * rate) : 0;
}

/** 2850 -> "2 850 kr" */
export function formatMoney(kr: number): string {
  return `${Math.round(kr).toLocaleString('sv-SE')} kr`;
}

/** Active projects grouped by active customer, in list order. */
export function keyboard(state: State): { customer: Customer; projects: Project[] }[] {
  return state.customers
    .filter((c) => !c.archived)
    .map((customer) => ({
      customer,
      projects: state.projects.filter((p) => p.customerId === customer.id && !p.archived),
    }))
    .filter((g) => g.projects.length > 0);
}

export function intervalMinutes(interval: Interval, settings: Settings): number {
  return interval === 'day' ? settings.workdayMinutes : interval;
}

export function intervalLabel(interval: Interval): string {
  if (interval === 'day') return 'Dag';
  if (interval < 60) return `${interval} min`;
  const h = interval / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(2).replace(/0+$/, '')} h`;
}

/** Minutes registered for a project on a date. Never below zero. */
export function minutesFor(taps: Tap[], projectId: string, date: string): number {
  let sum = 0;
  for (const t of taps) if (t.projectId === projectId && t.date === date) sum += t.minutes;
  return Math.max(0, sum);
}

export function customerMinutes(state: State, customerId: string, date: string): number {
  return state.projects
    .filter((p) => p.customerId === customerId)
    .reduce((s, p) => s + minutesFor(state.taps, p.id, date), 0);
}

export function dayTotal(state: State, date: string): number {
  return state.projects.reduce((s, p) => s + minutesFor(state.taps, p.id, date), 0);
}

/**
 * Register one tap. In minus mode the tap subtracts one interval,
 * but never takes the project below zero for that day.
 * Returns the tap that was added, or null if nothing changed.
 */
export function tap(
  state: State,
  projectId: string,
  date: string,
  minus = false,
  now = Date.now(),
): { state: State; tap: Tap | null } {
  const project = state.projects.find((p) => p.id === projectId);
  if (!project) return { state, tap: null };
  let minutes = intervalMinutes(intervalFor(state, project), state.settings);
  if (minus) {
    const current = minutesFor(state.taps, projectId, date);
    minutes = -Math.min(minutes, current);
    if (minutes === 0) return { state, tap: null };
  }
  const t: Tap = { id: newId(), projectId, date, minutes, at: now };
  return { state: { ...state, taps: [...state.taps, t] }, tap: t };
}

export function removeTap(state: State, tapId: string): State {
  return { ...state, taps: state.taps.filter((t) => t.id !== tapId) };
}

/** Clear all taps for a project on a given date. */
export function clearDay(state: State, projectId: string, date: string): State {
  return {
    ...state,
    taps: state.taps.filter((t) => !(t.projectId === projectId && t.date === date)),
  };
}

// ---------- Dates (local time, YYYY-MM-DD) ----------

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date: string, n: number): string {
  const d = fromISODate(date);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

/** Monday-based week containing the date. */
export function weekDates(date: string): string[] {
  const d = fromISODate(date);
  const offset = (d.getDay() + 6) % 7;
  const monday = addDays(date, -offset);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** ISO 8601 week number. */
export function isoWeek(date: string): number {
  const d = fromISODate(date);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const jan4 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
}

// ---------- Formatting & export ----------

/** 90 -> "1:30" */
export function formatHM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

/** 90 -> "1,5" (Swedish decimal hours) */
export function formatHours(minutes: number): string {
  const h = Math.round((minutes / 60) * 100) / 100;
  return String(h).replace('.', ',');
}

/** All dates from..to inclusive (empty if to < from). */
export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < 3700; d = addDays(d, 1)) out.push(d);
  return out;
}

export interface ExportRow {
  date: string;
  customer: string;
  customerCode: string;
  project: string;
  projectCode: string;
  minutes: number;
  rate?: number;
  amount: number;
}

/** One row per project and day with registered time, in date and list order. */
export function exportRows(state: State, dates: string[]): ExportRow[] {
  const rows: ExportRow[] = [];
  for (const date of dates) {
    for (const p of state.projects) {
      const minutes = minutesFor(state.taps, p.id, date);
      if (minutes === 0) continue;
      const c = customerOf(state, p);
      const rate = rateFor(state, p);
      rows.push({
        date, minutes, rate, amount: amountFor(minutes, rate),
        customer: c?.name ?? '', customerCode: c?.code ?? '',
        project: p.name, projectCode: p.code ?? '',
      });
    }
  }
  return rows;
}

/** Total minutes per customer/project over the rows. */
export function summarize(rows: ExportRow[]): { customer: string; project: string; minutes: number; amount: number }[] {
  const map = new Map<string, { customer: string; project: string; minutes: number; amount: number }>();
  for (const r of rows) {
    const k = r.customer + '\u0000' + r.project;
    const e = map.get(k) ?? { customer: r.customer, project: r.project, minutes: 0, amount: 0 };
    e.minutes += r.minutes;
    e.amount += r.amount;
    map.set(k, e);
  }
  return [...map.values()];
}

export const EXPORT_HEADERS = ['Datum', 'Kund', 'Kundnr', 'Projekt', 'Projektkod', 'Minuter', 'Timmar', 'Timpris', 'Belopp'];

/** Semicolon-separated CSV (opens correctly in Swedish Excel). */
export function exportCSV(state: State, dates: string[]): string {
  const rows = [EXPORT_HEADERS];
  for (const r of exportRows(state, dates)) {
    rows.push([
      r.date, r.customer, r.customerCode, r.project, r.projectCode, String(r.minutes), formatHours(r.minutes),
      r.rate ? String(r.rate) : '', r.rate ? String(r.amount) : '',
    ]);
  }
  return rows
    .map((r) => r.map((c) => (/[";\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(';'))
    .join('\n');
}

/** Monday-based weeks covering the month of the given date (6 rows max, padded with adjacent days). */
export function monthWeeks(date: string): string[][] {
  const d = fromISODate(date);
  const first = toISODate(new Date(d.getFullYear(), d.getMonth(), 1));
  const last = toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  const weeks: string[][] = [];
  let week = weekDates(first);
  while (week[0] <= last) {
    weeks.push(week);
    week = weekDates(addDays(week[0], 7));
  }
  return weeks;
}

export function addMonths(date: string, n: number): string {
  const d = fromISODate(date);
  return toISODate(new Date(d.getFullYear(), d.getMonth() + n, 1));
}

// ---------- Periods ----------

export type Period = 'day' | 'week' | 'month' | 'year';

/** First and last date of the period containing `date`. */
export function periodRange(period: Period, date: string): { from: string; to: string } {
  if (period === 'day') return { from: date, to: date };
  if (period === 'week') {
    const w = weekDates(date);
    return { from: w[0], to: w[6] };
  }
  if (period === 'month') return { from: date.slice(0, 8) + '01', to: addDays(addMonths(date, 1), -1) };
  return { from: date.slice(0, 4) + '-01-01', to: date.slice(0, 4) + '-12-31' };
}

/** Move `date` by n periods. */
export function shiftPeriod(period: Period, date: string, n: number): string {
  if (period === 'day') return addDays(date, n);
  if (period === 'week') return addDays(date, 7 * n);
  if (period === 'month') return addMonths(date, n);
  return addMonths(date, 12 * n);
}

export function periodLabel(period: Period, date: string): string {
  const d = fromISODate(date);
  if (period === 'week') return `Vecka ${isoWeek(date)}`;
  if (period === 'month') return d.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' });
  if (period === 'year') return String(d.getFullYear());
  return d.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');
}

/** Minutes and amount per project over a set of dates. */
export function projectTotals(state: State, dates: string[]): Map<string, { minutes: number; amount: number }> {
  const set = new Set(dates);
  const minutes = new Map<string, Map<string, number>>();
  for (const t of state.taps) {
    if (!set.has(t.date)) continue;
    const byDate = minutes.get(t.projectId) ?? new Map<string, number>();
    byDate.set(t.date, (byDate.get(t.date) ?? 0) + t.minutes);
    minutes.set(t.projectId, byDate);
  }
  const out = new Map<string, { minutes: number; amount: number }>();
  for (const p of state.projects) {
    const byDate = minutes.get(p.id);
    if (!byDate) continue;
    const rate = rateFor(state, p);
    let m = 0;
    let a = 0;
    for (const v of byDate.values()) {
      const day = Math.max(0, v);
      m += day;
      a += amountFor(day, rate);
    }
    if (m > 0) out.set(p.id, { minutes: m, amount: a });
  }
  return out;
}

/** Total registered minutes from..to inclusive. */
export function dateRangeTotal(state: State, from: string, to: string): number {
  let sum = 0;
  for (const v of projectTotals(state, datesBetween(from, to)).values()) sum += v.minutes;
  return sum;
}
