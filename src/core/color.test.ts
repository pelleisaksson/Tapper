import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseASE } from './ase';
import { normalizeHex, readableText, tint, hsvToHex, hexToHsv, DARK_TEXT, LIGHT_TEXT, contrast } from './color';

test('reads the Adobe Color theme', () => {
  const buf = readFileSync(join(__dirname, 'fixtures/theme.ase'));
  const swatches = parseASE(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  expect(swatches.map((s) => s.hex)).toEqual(['#95b9d4', '#d4ba94', '#7e8a94', '#7f7361', '#324654']);
});

test('rejects files that are not ASE', () => {
  expect(() => parseASE(new TextEncoder().encode('hello world!!').buffer)).toThrow(/inte en .ase-fil/);
});

test('hex normalisation', () => {
  expect(normalizeHex('ABC')).toBe('#aabbcc');
  expect(normalizeHex(' #95B9D4 ')).toBe('#95b9d4');
  expect(normalizeHex('#12345')).toBeNull();
  expect(normalizeHex('zzzzzz')).toBeNull();
});

test('text color is readable on light and dark tiles', () => {
  expect(readableText('#d4ba94')).toBe(DARK_TEXT);
  expect(readableText('#95b9d4')).toBe(DARK_TEXT);
  expect(readableText('#324654')).toBe(LIGHT_TEXT);
  for (const bg of ['#95b9d4', '#d4ba94', '#7e8a94', '#7f7361', '#324654', tint('#d4ba94', 0.22)]) {
    expect(contrast(bg, readableText(bg))).toBeGreaterThanOrEqual(4.5);
  }
});

test('hsv round trip and tint', () => {
  expect(hsvToHex(0, 1, 1)).toBe('#ff0000');
  const { h, s, v } = hexToHsv('#324654');
  expect(hsvToHex(h, s, v)).toBe('#324654');
  expect(tint('#000000', 0.5)).toBe('#808080');
  expect(tint('#ffffff', -1)).toBe('#000000');
});
