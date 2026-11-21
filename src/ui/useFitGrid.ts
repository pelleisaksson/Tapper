import { useLayoutEffect, useRef, useState } from 'react';

const GAP = 2;

/** Smallest tile size; below this the tiles go onto another page instead. */
export function minTile(width: number): { w: number; h: number } {
  return width >= 700 ? { w: 170, h: 150 } : { w: 125, h: 115 };
}

/**
 * Column count so `n` tiles fill a w×h area as evenly as possible (close to
 * square, few empty cells), never narrower or shorter than the minimum size.
 * Returns null if `n` tiles cannot fit at the minimum size.
 */
export function bestGrid(n: number, w: number, h: number, min = minTile(w)): number | null {
  if (n <= 0 || w <= 0 || h <= 0) return 1;
  const maxCols = Math.max(1, Math.floor((w + GAP) / (min.w + GAP)));
  let best: { cols: number; score: number } | null = null;
  for (let c = 1; c <= Math.min(n, maxCols); c++) {
    const rows = Math.ceil(n / c);
    const tw = (w - GAP * (c - 1)) / c;
    const th = (h - GAP * (rows - 1)) / rows;
    if (th < min.h) continue;
    const aspect = Math.min(tw, th) / Math.max(tw, th); // 1 = square
    const empty = c * rows - n;
    const score = aspect * 10 - empty * 1.5 + Math.min(tw, th) / 100;
    if (!best || score > best.score) best = { cols: c, score };
  }
  return best?.cols ?? null;
}

/** A page of tiles. `rows` is set when there are several pages: every page then has the same grid. */
export interface Page { start: number; count: number; cols: number; rows?: number }

/**
 * Split `n` tiles into pages, like an iPhone home screen. If everything fits
 * on one page, the best-fitting grid fills the screen. Otherwise every page uses
 * the same, densest grid that keeps the minimum tile size, so tiles look the
 * same on all pages and the last page is only partly filled.
 */
export function pageLayout(n: number, w: number, h: number): Page[] {
  if (n <= 0 || w <= 0 || h <= 0) return [{ start: 0, count: Math.max(0, n), cols: 2 }];
  const min = minTile(w);
  const cols = Math.max(1, Math.floor((w + GAP) / (min.w + GAP)));
  const rows = Math.max(1, Math.floor((h + GAP) / (min.h + GAP)));
  const perPage = cols * rows;
  if (n <= perPage) return [{ start: 0, count: n, cols: bestGrid(n, w, h, min) ?? cols }];
  const pages: Page[] = [];
  for (let start = 0; start < n; start += perPage) {
    pages.push({ start, count: Math.min(perPage, n - start), cols, rows });
  }
  return pages;
}

/** Measures the element and lays out `n` tiles in pages. */
export function usePages<T extends HTMLElement>(n: number) {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize((s) => (s.w === el.clientWidth && s.h === el.clientHeight ? s : { w: el.clientWidth, h: el.clientHeight }));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [n > 0]);
  return [ref, pageLayout(n, size.w, size.h), size] as const;
}
