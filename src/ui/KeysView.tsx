import { useEffect, useRef, useState } from 'react';
import {
  tap, removeTap, minutesFor, intervalFor, intervalLabel, formatDuration, tileOrder, rateFor, amountFor, formatMoney,
  type State, type Tap,
} from '../core/model';
import { useFitGrid } from './useFitGrid';
import { readableText, tint } from '../core/color';

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
  const [gridRef, grid] = useFitGrid<HTMLDivElement>(count);
  // The last tile stretches over any empty cells so the mosaic has no holes.
  const lastSpan = grid.cols - (count % grid.cols || grid.cols) + 1;

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
        <div
          ref={gridRef}
          className={`mosaic ${editMode ? 'minus' : ''} ${grid.rowHeight ? 'scroll' : ''}`}
          style={{
            gridTemplateColumns: `repeat(${grid.cols}, 1fr)`,
            gridAutoRows: grid.rowHeight ? `${grid.rowHeight}px` : '1fr',
          }}
        >
          {tiles.map(({ customer, project: p, shade: i }, index) => {
            const min = minutesFor(state.taps, p.id, date);
            const rate = rateFor(state, p);
            const interval = (editMode ? '−' : '+') + intervalLabel(intervalFor(state, p));
            const isLast = index === count - 1;
            const inLastRow = !grid.rowHeight && index >= count - (count % grid.cols || grid.cols);
            const bg = shade(customer.color, i);
            return (
              <button
                key={p.id}
                className={`tile ${min > 0 ? 'has-time' : ''} ${inLastRow ? 'edge-bottom' : ''}`}
                style={{
                  '--tile': bg,
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
      )}

      {lastTap && (
        <button className="undo-toast" onClick={undo}>
          Ångra {lastTap.minutes > 0 ? '+' : '−'}{formatDuration(lastTap.minutes)}
        </button>
      )}
    </div>
  );
}
