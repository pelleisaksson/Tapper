import { useLayoutEffect, useRef, useState } from 'react';

export interface FitGrid { cols: number; rowHeight: number | null }

const MIN_ROW = 76;
const GAP = 2;

/**
 * Pick a column count so `n` tiles fill the container as evenly as possible
 * (tiles close to square, few empty cells). If tiles would get shorter than
 * MIN_ROW the grid falls back to fixed-height rows and scrolls.
 */
export function bestGrid(n: number, w: number, h: number): FitGrid {
  if (n <= 0 || w <= 0 || h <= 0) return { cols: 1, rowHeight: null };
  const maxCols = Math.max(1, Math.floor(w / 110));
  let best = { cols: 1, score: -Infinity, fits: false };
  for (let c = 1; c <= Math.min(n, maxCols); c++) {
    const rows = Math.ceil(n / c);
    const tw = (w - GAP * (c - 1)) / c;
    const th = (h - GAP * (rows - 1)) / rows;
    const fits = th >= MIN_ROW;
    const aspect = Math.min(tw, th) / Math.max(tw, th); // 1 = square
    const empty = c * rows - n;
    const score = (fits ? 1000 : 0) + aspect * 10 - empty * 1.5 + Math.min(tw, th) / 100;
    if (score > best.score) best = { cols: c, score, fits };
  }
  return { cols: best.cols, rowHeight: best.fits ? null : MIN_ROW + 30 };
}

export function useFitGrid<T extends HTMLElement>(n: number) {
  const ref = useRef<T>(null);
  const [grid, setGrid] = useState<FitGrid>({ cols: 2, rowHeight: null });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const g = bestGrid(n, el.clientWidth, el.clientHeight);
      setGrid((old) => (old.cols === g.cols && old.rowHeight === g.rowHeight ? old : g));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [n]);
  return [ref, grid] as const;
}
