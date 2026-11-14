import { bestGrid } from './useFitGrid';

test('phone portrait with 7 tiles uses 2 columns and fills the height', () => {
  expect(bestGrid(7, 386, 560)).toEqual({ cols: 2, rowHeight: null });
});

test('tablet landscape with 7 tiles uses 4 columns', () => {
  expect(bestGrid(7, 1076, 640).cols).toBe(4);
});

test('falls back to scrolling rows when tiles get too short', () => {
  const g = bestGrid(40, 386, 560);
  expect(g.rowHeight).not.toBeNull();
});
