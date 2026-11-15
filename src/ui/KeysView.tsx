import { useEffect, useRef, useState } from 'react';
import {
  tap, removeTap, minutesFor, intervalFor, intervalLabel, formatHM, tileOrder, rateFor, amountFor, formatMoney,
  type State, type Tap,
} from '../core/model';
import { useFitGrid } from './useFitGrid';

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
const SHADES = [0, 12, -10, 22, -18, 6, -4, 16];
function shade(color: string, i: number): string {
  const s = SHADES[i % SHADES.length];
  if (s === 0) return color;
  return s > 0
    ? `color-mix(in srgb, ${color}, white ${s}%)`
    : `color-mix(in srgb, ${color}, black ${-s}%)`;
}

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
    const f: Float = { id: t.id, projectId, text: (t.minutes > 0 ? '+' : '−') + formatHM(Math.abs(t.minutes)) };
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
            return (
              <button
                key={p.id}
                className={`tile ${min > 0 ? 'has-time' : ''}`}
                style={{
                  '--tile': shade(customer.color, i),
                  gridColumn: isLast && lastSpan > 1 ? `span ${lastSpan}` : undefined,
                } as React.CSSProperties}
                onClick={() => press(p.id)}
                aria-label={`${customer.name}, ${p.name}, ${formatHM(min)} registrerat`}
              >
                <span className="tile-row tile-top">
                  <span className="tile-customer">{customer.name}</span>
                  <span className="tile-interval">{interval}</span>
                </span>
                <span className="tile-mid">
                  <span className="tile-name">{p.name}</span>
                  {min > 0 && (
                    <>
                      <span className="tile-rule" />
                      <span className="tile-time">{formatHM(min)}</span>
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
          Ångra {lastTap.minutes > 0 ? '+' : '−'}{formatHM(Math.abs(lastTap.minutes))}
        </button>
      )}
    </div>
  );
}
