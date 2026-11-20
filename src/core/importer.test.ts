import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { emptyState, KEY_COLORS } from './model';
import { applyImport, decodeText, parseCSV, parseInterval, parseRate, planImport, readTable, readXLSX } from './importer';
import { exportXLSX } from './xlsx';

const buf = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

test('CSV with semicolons, quotes and BOM', () => {
  const rows = parseCSV(decodeText(new TextEncoder().encode('﻿Kund;Projekt\n"Bygg; & Co";"Säg ""hej"""\r\nA;B\n\n')));
  expect(rows).toEqual([['Kund', 'Projekt'], ['Bygg; & Co', 'Säg "hej"'], ['A', 'B']]);
});

test('CSV with commas and Windows-1252 encoding', () => {
  const latin1 = new Uint8Array([...'Kund,Projekt\nAtelj'].map((c) => c.charCodeAt(0)).concat([0xe9], [...',F'].map((c) => c.charCodeAt(0)), [0xf6], [...'rstudie'].map((c) => c.charCodeAt(0))));
  expect(parseCSV(decodeText(latin1))).toEqual([['Kund', 'Projekt'], ['Ateljé', 'Förstudie']]);
});

test('reads a real (deflated, shared strings) Excel file', async () => {
  const rows = await readXLSX(buf(readFileSync(join(__dirname, 'fixtures/import.xlsx'))));
  expect(rows[0]).toEqual(['Kund', 'Kundnr', 'Projekt', 'Projektkod', 'Timpris', 'Intervall']);
  expect(rows[1]).toEqual(['Nordbanken', '1001', 'Ny webbplats', 'NB-01', '1150', '15 min']);
  expect(rows[3][0]).toBe('Ateljé & Lund');
  expect(rows).toHaveLength(5); // the empty row is dropped
});

test('reads the app\'s own Excel export (stored, inline strings)', async () => {
  const s = emptyState();
  s.customers = [{ id: 'c', name: 'Kund <1>', color: '#000' }];
  s.projects = [{ id: 'p', customerId: 'c', name: 'P' }];
  s.taps = [{ id: 't', projectId: 'p', date: '2026-11-16', minutes: 30, at: 1 }];
  const rows = await readTable('x.xlsx', exportXLSX(s, ['2026-11-16']).buffer as ArrayBuffer);
  expect(rows[0]).toEqual(['Kund', 'Projekt', 'Timmar', 'Belopp']);
  expect(rows[1].slice(0, 2)).toEqual(['Kund <1>', 'P']);
});

test('interval and rate parsing', () => {
  expect(parseInterval('15 min')).toBe(15);
  expect(parseInterval('30')).toBe(30);
  expect(parseInterval('1 h')).toBe(60);
  expect(parseInterval('1,5 timmar')).toBe(90);
  expect(parseInterval('Dag')).toBe('day');
  expect(parseInterval('ibland')).toBeUndefined();
  expect(parseRate('1 150 kr')).toBe(1150);
  expect(parseRate('950,50')).toBe(950.5);
  expect(parseRate('')).toBeUndefined();
});

test('plan: new customers and projects, existing ones matched by name, nothing duplicated', async () => {
  const s = emptyState();
  s.customers = [{ id: 'c0', name: 'Nordbanken', color: '#000' }];
  s.projects = [{ id: 'p0', customerId: 'c0', name: 'support' }];
  const rows = await readXLSX(buf(readFileSync(join(__dirname, 'fixtures/import.xlsx'))));
  const plan = planImport(s, rows, KEY_COLORS);
  expect(plan.customers.map((c) => c.name)).toEqual(['Ateljé & Lund', 'Kommunen']);
  expect(plan.projects.map((p) => p.name)).toEqual(['Ny webbplats', 'Varumärke', 'Förstudie']);
  expect(plan.skippedProjects).toBe(1); // "Support" already exists (case-insensitive)
  expect(plan.existingCustomers).toBe(1);
  const nb = plan.projects[0];
  expect(nb.customerId).toBe('c0');
  expect([nb.code, nb.rate, nb.interval]).toEqual(['NB-01', 1150, 15]);
  const fs = plan.projects[2];
  expect([fs.rate, fs.interval]).toEqual([1200, 'day']);
  expect(plan.customers[1].code).toBe('K-22');
  expect(plan.customers.map((c) => c.color)).toEqual([KEY_COLORS[1], KEY_COLORS[2]]);

  const after = applyImport(s, plan);
  expect(after.projects).toHaveLength(4);
  // Importing the same file again adds nothing.
  const again = planImport(after, rows, KEY_COLORS);
  expect([again.customers.length, again.projects.length]).toEqual([0, 0]);
});

test('plan: helpful errors and warnings', () => {
  const s = emptyState();
  expect(() => planImport(s, [['Namn', 'Projekt'], ['A', 'B']], KEY_COLORS)).toThrow(/kolumn för kund/);
  expect(() => planImport(s, [['Kund']], KEY_COLORS)).toThrow(/rubrikrad/);
  const plan = planImport(s, [['Customer', 'Project', 'Rate'], ['', 'X', ''], ['A', 'Y', 'gratis'], ['B', '', '']], KEY_COLORS);
  expect(plan.customers.map((c) => c.name)).toEqual(['A', 'B']);
  expect(plan.warnings).toHaveLength(2);
});
