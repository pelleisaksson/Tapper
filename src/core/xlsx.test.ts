import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { emptyState, tap } from './model';
import { exportXLSX } from './xlsx';

test('xlsx is a valid zip with expected sheets and numbers', () => {
  let s = emptyState();
  s.customers = [{ id: 'c', name: 'Kund & Co', color: '#000' }];
  s.projects = [{ id: 'p', customerId: 'c', name: 'Projekt <1>' }];
  s = tap(s, 'p', '2026-11-16').state;
  s = tap(s, 'p', '2026-11-16').state;
  const bytes = exportXLSX(s, ['2026-11-16']);
  const dir = mkdtempSync(join(tmpdir(), 'xlsx-'));
  const f = join(dir, 'a.xlsx');
  writeFileSync(f, bytes);
  const py = `import zipfile,sys
z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None
print(sorted(z.namelist())); print(z.read('xl/worksheets/sheet1.xml').decode())`;
  const out = execFileSync('python3', ['-c', py, f]).toString();
  expect(out).toContain('xl/worksheets/sheet2.xml');
  expect(out).toContain('Kund &amp; Co');
  expect(out).toContain('Projekt &lt;1&gt;');
  expect(out).toContain('<v>46342</v>'); // 2026-11-16 as Excel serial
  expect(out).toContain('<v>0.5</v>');
});
