import { bestGrid, minTile, pageLayout } from './useFitGrid';

test('few tiles: one page, filling the screen', () => {
  expect(pageLayout(7, 386, 834)).toEqual([{ start: 0, count: 7, cols: 2 }]);
  expect(pageLayout(7, 1076, 690)[0].cols).toBe(4);
});

test('tiles never get smaller than the minimum; extra tiles go to another page', () => {
  const w = 386, h = 720; // phone mosaic area
  const pages = pageLayout(40, w, h);
  expect(pages.length).toBeGreaterThan(1);
  const min = minTile(w);
  for (const p of pages) {
    const rows = p.rows ?? Math.ceil(p.count / p.cols);
    expect((w - 2 * (p.cols - 1)) / p.cols).toBeGreaterThanOrEqual(min.w);
    expect((h - 2 * (rows - 1)) / rows).toBeGreaterThanOrEqual(min.h);
  }
  expect(pages.reduce((s, p) => s + p.count, 0)).toBe(40);
  expect(pages.map((p) => p.start)).toEqual(pages.map((_, i) => i * pages[0].count));
});

test('19 projects fit on one page of an iPhone 17 Pro Max', () => {
  expect(pageLayout(19, 436, 834)).toHaveLength(1);
});

test('bestGrid returns null when tiles cannot fit at the minimum size', () => {
  expect(bestGrid(100, 386, 720)).toBeNull();
  expect(bestGrid(4, 386, 720)).toBe(2);
});

test('several pages share one grid; the last page is only partly filled', () => {
  const pages = pageLayout(19, 386, 600);
  expect(pages).toHaveLength(2);
  expect(pages[1]).toEqual({ start: pages[0].count, count: 19 - pages[0].count, cols: pages[0].cols, rows: pages[0].rows });
});
