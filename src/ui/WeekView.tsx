import { useState } from 'react';
import {
  weekDates, isoWeek, minutesFor, dayTotal, customerMinutes, formatHM, addDays, fromISODate, type State,
} from '../core/model';
import { ExportPanel } from './ExportPanel';

interface Props {
  state: State;
  date: string;
  setDate: (d: string) => void;
  openDay: (d: string) => void;
}

export function WeekView({ state, date, setDate, openDay }: Props) {
  const dates = weekDates(date);
  const hasTime = (projectId: string) => dates.some((d) => minutesFor(state.taps, projectId, d) > 0);
  const groups = state.customers
    .map((c) => ({
      customer: c,
      projects: state.projects.filter(
        (p) => p.customerId === c.id && ((!p.archived && !c.archived) || hasTime(p.id)),
      ),
    }))
    .filter((g) => g.projects.length > 0);
  const weekTotal = dates.reduce((s, d) => s + dayTotal(state, d), 0);
  const cell = (m: number) => (m ? formatHM(m) : '–');
  const [exporting, setExporting] = useState(false);

  return (
    <div className="week-view">
      <header className="topbar">
        <div className="datenav">
          <button className="icon-btn" aria-label="Föregående vecka" onClick={() => setDate(addDays(date, -7))}>‹</button>
          <span className="date-btn static">Vecka {isoWeek(date)}</span>
          <button className="icon-btn" aria-label="Nästa vecka" onClick={() => setDate(addDays(date, 7))}>›</button>
        </div>
        <div className="header-right">
          <button className="text-btn" onClick={() => setExporting(true)}>Exportera</button>
          <div className="counter-box"><div className="counter">{formatHM(weekTotal)}</div></div>
        </div>
      </header>

      <div className="table-wrap">
        <table className="week">
          <thead>
            <tr>
              <th className="acc" />
              {dates.map((d) => (
                <th key={d}>
                  <button className="link" onClick={() => openDay(d)}>
                    {fromISODate(d).toLocaleDateString('sv-SE', { weekday: 'short' }).replace('.', '')}
                    <small>{fromISODate(d).getDate()}</small>
                  </button>
                </th>
              ))}
              <th>Σ</th>
            </tr>
          </thead>
          {groups.map(({ customer, projects }) => {
            const cSum = dates.reduce((s, d) => s + customerMinutes(state, customer.id, d), 0);
            return (
              <tbody key={customer.id}>
                <tr className="customer-row">
                  <td className="acc"><span className="bar" style={{ background: customer.color }} />{customer.name}</td>
                  {dates.map((d) => <td key={d}>{cell(customerMinutes(state, customer.id, d))}</td>)}
                  <td className="sum">{formatHM(cSum)}</td>
                </tr>
                {projects.map((p) => {
                  const sum = dates.reduce((s, d) => s + minutesFor(state.taps, p.id, d), 0);
                  return (
                    <tr key={p.id} className="project-row">
                      <td className="acc">{p.name}</td>
                      {dates.map((d) => {
                        const m = minutesFor(state.taps, p.id, d);
                        return <td key={d} className={m ? '' : 'zero'}>{cell(m)}</td>;
                      })}
                      <td className="sum">{formatHM(sum)}</td>
                    </tr>
                  );
                })}
              </tbody>
            );
          })}
          <tfoot>
            <tr>
              <td className="acc">Totalt</td>
              {dates.map((d) => <td key={d}>{formatHM(dayTotal(state, d))}</td>)}
              <td className="sum">{formatHM(weekTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {exporting && <ExportPanel state={state} date={date} onClose={() => setExporting(false)} />}
    </div>
  );
}
