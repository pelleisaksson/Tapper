import { useEffect, useRef, useState } from 'react';
import {
  tap, removeTap, minutesFor, intervalFor, intervalLabel, formatDuration, tileOrder, rateFor, amountFor, formatMoney,
  type State, type Tap,
} from '../core/model';
import { usePages } from './useFitGrid';
import { luminance, readableText, tint } from '../core/color';

interface Props {
  state: State;
  update: (fn: (s: State) => State) => void;
  date: string;
  /** Edit mode: a tap subtracts one interval. */
  editMode: boolean;
  onSetup: () => void;
}

interface Float { id: string; projectId: string; text: string }

/** Small tonal shifts so a customer's projects form a mosaic in the customer's color. */
const SHADES = [0, 0.12, -0.1, 0.22, -0.18, 0.06, -0.04, 0.16];
const shade = (color: string, i: number) => tint(color, SHADES[i % SHADES.length]);

export function KeysView({ state, update, date, editMode, onSetup }: Props) {
  const [lastTap, setLastTap] = useState<Tap | null>(null);
  const [floats, setFloats] = useState<Float[]>([]);
  const undoTimer = useRef<number>();

  const tiles = tileOrder(state, state.settings.tileSort);
  const count = tiles.length;
  const [pagerRef, pages, size] = usePages<HTMLDivElement>(count);
  const [page, setPage] = useState(0);

  // Track the visible page while swiping.
  function onScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    if (el.clientWidth) setPage(Math.round(el.scrollLeft / el.clientWidth));
  }
  function goTo(i: number) {
    const el = pagerRef.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  }
  // Keep a valid page when the number of pages shrinks.
  useEffect(() => { if (page > pages.length - 1) goTo(pages.length - 1); }, [pages.length]);
  // Arrow keys switch page on a keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea')) return;
      if (e.key === 'ArrowRight' && page < pages.length - 1) goTo(page + 1);
      if (e.key === 'ArrowLeft' && page > 0) goTo(page - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [page, pages.length]);

  useEffect(() => () => window.clearTimeout(undoTimer.current), []);

  function press(projectId: string) {
    const r = tap(state, projectId, date, editMode);
    if (!r.tap) return;
    const t = r.tap;
    update(() => r.state);
    navigator.vibrate?.(8);
    setLastTap(t);
    window.clearTimeout(undoTimer.current);
    undoTimer.current = window.setTimeout(() => setLastTap(null), 4000);
    const f: Float = { id: t.id, projectId, text: (t.minutes > 0 ? '+' : '−') + formatDuration(t.minutes) };
    setFloats((fs) => [...fs, f]);
    window.setTimeout(() => setFloats((fs) => fs.filter((x) => x.id !== f.id)), 700);
  }

  function undo() {
    if (!lastTap) return;
    const id = lastTap.id;
    update((s) => removeTap(s, id));
    setLastTap(null);
  }

  return (
    <div className="keys-view">
      {count === 0 ? (
        <div className="empty">
          <p>Lägg upp en kund och dess projekt för att få tangenter.</p>
          <button className="primary" onClick={onSetup}>Lägg till kund</button>
        </div>
      ) : (
        <div ref={pagerRef} className={`pager ${editMode ? 'minus' : ''} ${pages.length > 1 ? 'has-dots' : ''}`} onScroll={onScroll}>
          {pages.map((pg, pi) => {
            const cols = pg.cols;
            // The last tile stretches over any empty cells in its row.
            const lastSpan = cols - (pg.count % cols || cols) + 1;
            const pageTiles = tiles.slice(pg.start, pg.start + pg.count);
            return (
              <div
                key={pi} className="mosaic" aria-label={pages.length > 1 ? `Sida ${pi + 1} av ${pages.length}` : undefined}
                style={{
                  gridTemplateColumns: `repeat(${cols}, 1fr)`,
                  ...(pg.rows ? { gridTemplateRows: `repeat(${pg.rows}, 1fr)` } : { gridAutoRows: '1fr' }),
                  width: size.w || undefined,
                }}
              >
                {pageTiles.map(({ customer, project: p, shade: i }, index) => {
                  const count = pg.count;
                  const grid = { cols };
                  const min = minutesFor(state.taps, p.id, date);
                  const rate = rateFor(state, p);
                  const interval = (editMode ? '−' : '+') + intervalLabel(intervalFor(state, p));
                  const isLast = index === count - 1;
                  // Only the row at the bottom of the screen needs room for the home indicator and dots.
                  const inLastRow = pg.rows
                    ? Math.floor(index / grid.cols) === pg.rows - 1
                    : index >= count - (count % grid.cols || grid.cols);
                  const bg = shade(customer.color, i);
                  return (
                    <button
                      key={p.id}
                      className={`tile ${min > 0 ? 'has-time' : ''} ${inLastRow ? 'edge-bottom' : ''}`}
                      style={{
                        '--tile': bg,
                        '--tile-hover': tint(bg, luminance(bg) > 0.35 ? -0.1 : 0.14),
                        color: readableText(bg),
                        gridColumn: isLast && lastSpan > 1 ? `span ${lastSpan}` : undefined,
                      } as React.CSSProperties}
                      onClick={() => press(p.id)}
                      aria-label={`${customer.name}, ${p.name}, ${formatDuration(min)} registrerat`}
                    >
                      <span className="tile-row tile-top">
                        <span className="tile-customer">{customer.name}</span>
                        <span className="tile-interval">{interval}</span>
                      </span>
                      <span
                        className="tile-mid"
                        style={{ '--longest': Math.max(7, ...p.name.split(/\s+/).map((w) => w.length)) } as React.CSSProperties}
                      >
                        <span className="tile-name">{p.name}</span>
                        {min > 0 && (
                          <>
                            <span className="tile-rule" />
                            <span className="tile-time">{formatDuration(min)}</span>
                          </>
                        )}
                      </span>
                      <span className="tile-row tile-bottom">
                        {rate !== undefined && (
                          <>
                            <span className="tile-rate">{formatMoney(rate)}/h</span>
                            <span className="tile-sum">{formatMoney(amountFor(min, rate))}</span>
                          </>
                        )}
                      </span>
                      {floats.filter((f) => f.projectId === p.id).map((f) => (
                        <span key={f.id} className="float">{f.text}</span>
                      ))}
                    </button>
                  );
                      })}
              </div>
            );
          })}
        </div>
      )}

      {pages.length > 1 && (
        <div className="page-dots" role="tablist" aria-label="Sidor">
          {pages.map((_, i) => (
            <button
              key={i} role="tab" aria-selected={i === page} aria-label={`Sida ${i + 1}`}
              className={i === page ? 'on' : ''} onClick={() => goTo(i)}
            />
          ))}
        </div>
      )}

      {lastTap && (
        <button className="undo-toast" onClick={undo}>
          Ångra {lastTap.minutes > 0 ? '+' : '−'}{formatDuration(lastTap.minutes)}
        </button>
      )}
    </div>
  );
}
