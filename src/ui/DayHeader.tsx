import { useEffect, useRef, useState } from 'react';
import {
  addDays, addMonths, dayTotal, formatHM, fromISODate, isoWeek, monthWeeks, toISODate, weekDates,
  type State,
} from '../core/model';

interface Props {
  state: State;
  date: string;
  setDate: (d: string) => void;
}

/** Header with the running counter, a week strip and a month calendar. */
export function DayHeader({ state, date, setDate }: Props) {
  const [calOpen, setCalOpen] = useState(false);
  const [calMonth, setCalMonth] = useState(date);
  const today = toISODate(new Date());
  const total = dayTotal(state, date);
  const week = weekDates(date);
  const weekTotal = week.reduce((s, d) => s + dayTotal(state, d), 0);

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

  const label = date === today
    ? 'Idag'
    : fromISODate(date).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });

  function pick(d: string) {
    setDate(d);
    setCalOpen(false);
  }

  return (
    <div className="day-header">
      <div className="daybar">
        <button className="icon-btn" aria-label="Föregående dag" onClick={() => setDate(addDays(date, -1))}>‹</button>
        <div className="daybar-mid">
          <button
            className="date-btn" aria-expanded={calOpen}
            onClick={() => { setCalMonth(date); setCalOpen((o) => !o); }}
          >
            {label} <span className="caret">{calOpen ? '▴' : '▾'}</span>
          </button>
          <div className={`counter ${pulse ? 'pulse' : ''}`} aria-live="polite">{formatHM(total)}</div>
          <div className="counter-sub">Vecka {isoWeek(date)} · {formatHM(weekTotal)}</div>
        </div>
        <button className="icon-btn" aria-label="Nästa dag" onClick={() => setDate(addDays(date, 1))}>›</button>
      </div>

      <div className="week-strip" role="tablist" aria-label="Veckans dagar">
        {week.map((d) => {
          const m = dayTotal(state, d);
          return (
            <button
              key={d} role="tab" aria-selected={d === date}
              className={`ws-day ${d === date ? 'on' : ''} ${d === today ? 'today' : ''}`}
              onClick={() => setDate(d)}
            >
              <span className="ws-wd">{fromISODate(d).toLocaleDateString('sv-SE', { weekday: 'short' }).replace('.', '')}</span>
              <span className="ws-num">{fromISODate(d).getDate()}</span>
              <span className="ws-time">{m ? formatHM(m) : '·'}</span>
            </button>
          );
        })}
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
                    {wk.map((d) => {
                      const m = dayTotal(state, d);
                      const other = d.slice(0, 7) !== calMonth.slice(0, 7);
                      return (
                        <td key={d}>
                          <button
                            className={`cal-day ${d === date ? 'on' : ''} ${d === today ? 'today' : ''} ${other ? 'other' : ''}`}
                            onClick={() => pick(d)}
                          >
                            <span>{fromISODate(d).getDate()}</span>
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
    </div>
  );
}
