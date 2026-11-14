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
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function customerOf(state: State, project: Project): Customer | undefined {
  return state.customers.find((c) => c.id === project.customerId);
}

/** Effective interval: project → customer → global default. */
export function intervalFor(state: State, project: Project): Interval {
  return project.interval ?? customerOf(state, project)?.interval ?? state.settings.defaultInterval;
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
}

/** One row per project and day with registered time, in date and list order. */
export function exportRows(state: State, dates: string[]): ExportRow[] {
  const rows: ExportRow[] = [];
  for (const date of dates) {
    for (const p of state.projects) {
      const minutes = minutesFor(state.taps, p.id, date);
      if (minutes === 0) continue;
      const c = customerOf(state, p);
      rows.push({
        date, minutes,
        customer: c?.name ?? '', customerCode: c?.code ?? '',
        project: p.name, projectCode: p.code ?? '',
      });
    }
  }
  return rows;
}

/** Total minutes per customer/project over the rows. */
export function summarize(rows: ExportRow[]): { customer: string; project: string; minutes: number }[] {
  const map = new Map<string, { customer: string; project: string; minutes: number }>();
  for (const r of rows) {
    const k = r.customer + '\u0000' + r.project;
    const e = map.get(k) ?? { customer: r.customer, project: r.project, minutes: 0 };
    e.minutes += r.minutes;
    map.set(k, e);
  }
  return [...map.values()];
}

export const EXPORT_HEADERS = ['Datum', 'Kund', 'Kundnr', 'Projekt', 'Projektkod', 'Minuter', 'Timmar'];

/** Semicolon-separated CSV (opens correctly in Swedish Excel). */
export function exportCSV(state: State, dates: string[]): string {
  const rows = [EXPORT_HEADERS];
  for (const r of exportRows(state, dates)) {
    rows.push([r.date, r.customer, r.customerCode, r.project, r.projectCode, String(r.minutes), formatHours(r.minutes)]);
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
