// Import of customers and projects from CSV or Excel (.xlsx).
//
// One row per project, with a header row. Recognised columns (case-insensitive,
// Swedish or English): Kund, Kundnr, Projekt, Projektkod, Timpris, Intervall.
// Existing customers and projects are matched by name and never duplicated.

import { newId, type Customer, type Interval, type Project, type State } from './model';

// ---------- CSV ----------

/** Decode bytes as UTF-8, falling back to Windows-1252 (older Swedish Excel CSV). */
export function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, '');
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

/** Parse CSV with ; , or tab as delimiter (detected from the header line) and "quoted" fields. */
export function parseCSV(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const counts = [';', ',', '\t'].map((d) => [d, firstLine.split(d).length] as const);
  const delim = counts.sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
    } else if (ch === '"' && field === '') quoted = true;
    else if (ch === delim) { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

// ---------- XLSX ----------

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Read the files of a ZIP archive (stored or deflated entries). */
async function unzip(buf: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const v = new DataView(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Filen är inte en giltig Excel-fil.');
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const files = new Map<string, Uint8Array>();
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const method = v.getUint16(p + 10, true);
    const csize = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true);
    const extraLen = v.getUint16(p + 30, true);
    const commentLen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(buf, p + 46, nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    const raw = new Uint8Array(buf.slice(start, start + csize));
    if (method === 0) files.set(name, raw);
    else if (method === 8) files.set(name, await inflateRaw(raw));
  }
  return files;
}

const unescapeXml = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d))).replace(/&amp;/g, '&');

/** Text of all <t> elements in a fragment (handles rich text runs). */
const textOf = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => unescapeXml(m[1])).join('');

function colIndex(ref: string): number {
  const letters = ref.replace(/[0-9]/g, '');
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** Rows of the first worksheet as strings. */
export async function readXLSX(buf: ArrayBuffer): Promise<string[][]> {
  const files = await unzip(buf);
  const dec = new TextDecoder();
  const get = (name: string) => (files.has(name) ? dec.decode(files.get(name)!) : null);
  const shared = [...(get('xl/sharedStrings.xml') ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]));
  // First sheet in workbook order.
  let sheetPath = 'xl/worksheets/sheet1.xml';
  const wb = get('xl/workbook.xml');
  const rels = get('xl/_rels/workbook.xml.rels');
  const firstId = wb?.match(/<sheet\b[^>]*\br:id="([^"]+)"/)?.[1];
  let target: string | undefined;
  if (firstId && rels) {
    target = rels.match(new RegExp(`<Relationship\\b[^>]*Id="${firstId}"[^>]*Target="([^"]+)"`))?.[1]
      ?? rels.match(new RegExp(`<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="${firstId}"`))?.[1];
  }
  if (target) sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
  const sheet = get(sheetPath) ?? [...files.keys()].filter((k) => k.startsWith('xl/worksheets/')).sort().map(get)[0];
  if (!sheet) throw new Error('Hittade inget kalkylblad i filen.');

  const rows: string[][] = [];
  for (const rm of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    for (const cm of rm[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1];
      const inner = cm[2] ?? '';
      const ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1];
      const type = attrs.match(/\bt="([^"]+)"/)?.[1];
      const v = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let value = '';
      if (type === 's' && v !== undefined) value = shared[Number(v)] ?? '';
      else if (type === 'inlineStr') value = textOf(inner);
      else if (v !== undefined) value = unescapeXml(v);
      const idx = ref ? colIndex(ref) : row.length;
      while (row.length < idx) row.push('');
      row[idx] = value;
    }
    if (row.some((c) => c.trim() !== '')) rows.push(row);
  }
  return rows;
}

/** Rows from a CSV or XLSX file's bytes, chosen by file name. */
export async function readTable(name: string, buf: ArrayBuffer): Promise<string[][]> {
  if (/\.xlsx$/i.test(name)) return readXLSX(buf);
  if (/\.xls$/i.test(name)) throw new Error('Det gamla Excel-formatet (.xls) stöds inte. Spara filen som .xlsx eller CSV.');
  return parseCSV(decodeText(new Uint8Array(buf)));
}

// ---------- Mapping to customers and projects ----------

const COLUMNS: Record<string, string[]> = {
  customer: ['kund', 'kundnamn', 'customer', 'client', 'klient'],
  customerCode: ['kundnr', 'kundnummer', 'kund nr', 'kund-nr', 'customer number', 'customer no', 'customer id'],
  project: ['projekt', 'projektnamn', 'project', 'uppdrag'],
  projectCode: ['projektkod', 'projektnr', 'projektnummer', 'project code', 'project number', 'project no'],
  rate: ['timpris', 'pris', 'kr/h', 'rate', 'hourly rate', 'timarvode'],
  interval: ['intervall', 'debiteringsintervall', 'interval'],
};

const norm = (s: string) => s.trim().toLowerCase().replace(/[.:]/g, '').replace(/\s+/g, ' ');

/** "15", "15 min", "1 h", "1,5 h", "dag" -> Interval; undefined if empty or unreadable. */
export function parseInterval(raw: string): Interval | undefined {
  const s = raw.trim().toLowerCase();
  if (!s) return undefined;
  if (/^(dag|day|heldag)$/.test(s)) return 'day';
  const m = s.replace(',', '.').match(/^(\d+(?:\.\d+)?)\s*(min|minuter|m|h|tim|timme|timmar)?$/);
  if (!m) return undefined;
  const n = Number(m[1]);
  const minutes = m[2] && /^(h|tim|timme|timmar)$/.test(m[2]) ? n * 60 : n;
  return minutes > 0 ? Math.round(minutes) : undefined;
}

/** "1 150", "1150 kr", "950,00" -> number; undefined if empty or unreadable. */
export function parseRate(raw: string): number | undefined {
  const s = raw.replace(/kr(\/h)?|sek/gi, '').replace(/[\s ]/g, '').replace(',', '.');
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export interface ImportPlan {
  customers: Customer[];       // new customers
  projects: Project[];         // new projects (customerId may refer to a new or existing customer)
  existingCustomers: number;   // rows whose customer already existed
  skippedProjects: number;     // projects that already existed
  warnings: string[];
}

/**
 * Work out what a table would add. Nothing is changed until applyImport.
 * `palette` gives colors to new customers, continuing after the existing ones.
 */
export function planImport(state: State, table: string[][], palette: string[]): ImportPlan {
  if (table.length < 2) throw new Error('Filen behöver en rubrikrad och minst en rad med data.');
  const header = table[0].map(norm);
  const col = (key: string) => header.findIndex((h) => COLUMNS[key].includes(h));
  const idx = Object.fromEntries(Object.keys(COLUMNS).map((k) => [k, col(k)])) as Record<string, number>;
  if (idx.customer < 0) throw new Error('Hittade ingen kolumn för kund. Rubrikraden behöver en kolumn som heter "Kund".');

  const key = (s: string) => s.trim().toLocaleLowerCase('sv');
  const byName = new Map(state.customers.map((c) => [key(c.name), c]));
  const newCustomers: Customer[] = [];
  const newProjects: Project[] = [];
  const projectKeys = new Set(state.projects.map((p) => `${p.customerId}|${key(p.name)}`));
  const seenExisting = new Set<string>();
  let skipped = 0;
  const warnings: string[] = [];
  const cell = (row: string[], k: string) => (idx[k] >= 0 ? (row[idx[k]] ?? '').trim() : '');

  table.slice(1).forEach((row, i) => {
    const line = i + 2;
    const customerName = cell(row, 'customer');
    if (!customerName) {
      if (row.some((c) => c.trim())) warnings.push(`Rad ${line}: ingen kund angiven, raden hoppades över.`);
      return;
    }
    let customer = byName.get(key(customerName));
    if (customer && !newCustomers.includes(customer)) seenExisting.add(customer.id);
    if (!customer) {
      customer = {
        id: newId(),
        name: customerName,
        code: cell(row, 'customerCode') || undefined,
        color: palette[(state.customers.length + newCustomers.length) % palette.length],
      };
      newCustomers.push(customer);
      byName.set(key(customerName), customer);
    }
    const projectName = cell(row, 'project');
    if (!projectName) return;
    const pk = `${customer.id}|${key(projectName)}`;
    if (projectKeys.has(pk)) { skipped++; return; }
    projectKeys.add(pk);
    const rateRaw = cell(row, 'rate');
    const rate = parseRate(rateRaw);
    if (rateRaw && rate === undefined) warnings.push(`Rad ${line}: timpriset "${rateRaw}" kunde inte läsas.`);
    const intervalRaw = cell(row, 'interval');
    const interval = parseInterval(intervalRaw);
    if (intervalRaw && interval === undefined) warnings.push(`Rad ${line}: intervallet "${intervalRaw}" kunde inte läsas.`);
    newProjects.push({
      id: newId(),
      customerId: customer.id,
      name: projectName,
      code: cell(row, 'projectCode') || undefined,
      rate,
      interval,
    });
  });

  return { customers: newCustomers, projects: newProjects, existingCustomers: seenExisting.size, skippedProjects: skipped, warnings };
}

export function applyImport(state: State, plan: ImportPlan): State {
  return { ...state, customers: [...state.customers, ...plan.customers], projects: [...state.projects, ...plan.projects] };
}

/** CSV template (semicolon-separated, opens directly in Swedish Excel). */
export const IMPORT_TEMPLATE =
  '﻿Kund;Kundnr;Projekt;Projektkod;Timpris;Intervall\n' +
  'Exempelkund AB;1001;Webbplats;WEB-01;950;15 min\n' +
  'Exempelkund AB;1001;Support;;950;30 min\n' +
  'Annan kund;;Rådgivning;;1200;1 h\n';
