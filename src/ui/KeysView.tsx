import { useEffect, useRef, useState } from 'react';
import {
  tap, removeTap, minutesFor, intervalFor, intervalLabel, formatHM, keyboard, type State, type Tap,
} from '../core/model';
import { DayHeader } from './DayHeader';

interface Props {
  state: State;
  update: (fn: (s: State) => State) => void;
  date: string;
  setDate: (d: string) => void;
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

export function KeysView({ state, update, date, setDate, onSetup }: Props) {
  const [minus, setMinus] = useState(false);
  const [lastTap, setLastTap] = useState<Tap | null>(null);
  const [floats, setFloats] = useState<Float[]>([]);
  const undoTimer = useRef<number>();

  const groups = keyboard(state);

  useEffect(() => () => window.clearTimeout(undoTimer.current), []);

  function press(projectId: string) {
    const r = tap(state, projectId, date, minus);
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
      <DayHeader state={state} date={date} setDate={setDate} />

      {groups.length === 0 ? (
        <div className="empty">
          <p>Lägg upp en kund och dess projekt för att få tangenter.</p>
          <button className="primary" onClick={onSetup}>Lägg till kund</button>
        </div>
      ) : (
        <div className={`mosaic ${minus ? 'minus' : ''}`}>
          {groups.flatMap(({ customer, projects }) =>
            projects.map((p, i) => {
              const min = minutesFor(state.taps, p.id, date);
              return (
                <button
                  key={p.id}
                  className={`tile ${min > 0 ? 'has-time' : ''}`}
                  style={{ '--tile': shade(customer.color, i) } as React.CSSProperties}
                  onClick={() => press(p.id)}
                  aria-label={`${customer.name}, ${p.name}, ${formatHM(min)} registrerat`}
                >
                  <span className="tile-top">
                    <span className="tile-customer">{customer.name}</span>
                    <span className="tile-interval">
                      {(minus ? '−' : '+') + intervalLabel(intervalFor(state, p))}
                    </span>
                  </span>
                  <span className="tile-name">{p.name}</span>
                  <span className="tile-bottom">
                    <span className="tile-code">{p.code}</span>
                    <span className="tile-time">{min > 0 ? formatHM(min) : ''}</span>
                  </span>
                  {floats.filter((f) => f.projectId === p.id).map((f) => (
                    <span key={f.id} className="float">{f.text}</span>
                  ))}
                </button>
              );
            }),
          )}
        </div>
      )}

      <div className="keys-footer">
        <button className={`toggle ${minus ? 'on' : ''}`} aria-pressed={minus} onClick={() => setMinus((m) => !m)}>
          Minus
        </button>
        {lastTap && (
          <button className="undo" onClick={undo}>
            Ångra {lastTap.minutes > 0 ? '+' : '−'}{formatHM(Math.abs(lastTap.minutes))}
          </button>
        )}
      </div>
    </div>
  );
}
