import { readFileSync } from 'node:fs';
import { join } from 'node:path';

test('styles.css has balanced braces (an unclosed block silently drops every rule after it)', () => {
  const css = readFileSync(join(__dirname, 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  let depth = 0;
  for (const ch of css) {
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    expect(depth).toBeGreaterThanOrEqual(0);
  }
  expect(depth).toBe(0);
});
