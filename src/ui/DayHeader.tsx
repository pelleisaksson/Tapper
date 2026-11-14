import { useEffect, useRef, useState } from 'react';
import {
  addDays, addMonths, dayTotal, formatHM, fromISODate, isoWeek, monthWeeks, toISODate, weekDates,
  type State,
} from '../core/model';

interface Props {
  state: State;
  date: string;
  setDate: (d: string) => void;
  minus: boolean;
  setMinus: (m: boolean) => void;
}

/** Compact header: ‹ date › on the left, minus toggle and running counter on the right. */
export function DayHeader({ state, date, setDate, minus, setMinus }: Props) {
  const [calOpen, setCalOpen] = useState(false);
  const [calMonth, setCalMonth] = useState(date);
  const today = toISODate(new Date());
  const total = dayTotal(state, date);
  const weekTotal = weekDates(date).reduce((s, d) => s + dayTotal(state, d), 0);

  // Brief pulse on the counter whenever the total changes.
  const [pulse, setPulse] = useState(false);
  const prev = useRef(total);
  useEffect(() => {
    if (prev.current === total) return;
    prev.current = total;
    setPulse(true);
    const t = window.setTimeout(() => setPulse(false), 180);
    return () => window.clearTimeout(t);
  }, [total]);

  const d = fromISODate(date);
  const label = date === today
    ? 'Idag'
    : d.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');

  function pick(x: string) {
    setDate(x);
    setCalOpen(false);
  }

  return (
    <header className="topbar day-header">
      <div className="datenav">
        <button className="icon-btn" aria-label="Föregående dag" onClick={() => setDate(addDays(date, -1))}>‹</button>
        <button
          className="date-btn" aria-expanded={calOpen} aria-label="Välj dag i kalender"
          onClick={() => { setCalMonth(date); setCalOpen((o) => !o); }}
        >
          {label}
        </button>
        <button className="icon-btn" aria-label="Nästa dag" onClick={() => setDate(addDays(date, 1))}>›</button>
      </div>

      <div className="header-right">
        <button
          className={`minus-btn ${minus ? 'on' : ''}`} aria-pressed={minus} aria-label="Minusläge"
          onClick={() => setMinus(!minus)}
        >
          −
        </button>
        <div className="counter-box" aria-live="polite">
          <div className={`counter ${pulse ? 'pulse' : ''}`}>{formatHM(total)}</div>
          <div className="counter-sub">v{isoWeek(date)} · {formatHM(weekTotal)}</div>
        </div>
      </div>

      {calOpen && (
        <>
          <div className="cal-backdrop" onClick={() => setCalOpen(false)} />
          <div className="calendar" role="dialog" aria-label="Välj dag">
            <div className="cal-head">
              <button className="icon-btn" aria-label="Föregående månad" onClick={() => setCalMonth(addMonths(calMonth, -1))}>‹</button>
              <span className="cal-title">
                {fromISODate(calMonth).toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })}
              </span>
              <button className="icon-btn" aria-label="Nästa månad" onClick={() => setCalMonth(addMonths(calMonth, 1))}>›</button>
            </div>
            <table className="cal-grid">
              <thead>
                <tr>
                  <th>v</th>
                  {['mån', 'tis', 'ons', 'tor', 'fre', 'lör', 'sön'].map((w) => <th key={w}>{w}</th>)}
                </tr>
              </thead>
              <tbody>
                {monthWeeks(calMonth).map((wk) => (
                  <tr key={wk[0]}>
                    <td className="cal-wk">{isoWeek(wk[0])}</td>
                    {wk.map((x) => {
                      const m = dayTotal(state, x);
                      const other = x.slice(0, 7) !== calMonth.slice(0, 7);
                      return (
                        <td key={x}>
                          <button
                            className={`cal-day ${x === date ? 'on' : ''} ${x === today ? 'today' : ''} ${other ? 'other' : ''}`}
                            onClick={() => pick(x)}
                          >
                            <span>{fromISODate(x).getDate()}</span>
                            <small>{m ? formatHM(m) : ''}</small>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="cal-foot">
              <button onClick={() => pick(today)}>Idag</button>
            </div>
          </div>
        </>
      )}
    </header>
  );
}
