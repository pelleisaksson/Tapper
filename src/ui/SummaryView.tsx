import { useState } from 'react';
import { datesBetween, formatHM, formatMoney, periodRange, projectTotals, type State } from '../core/model';
import { ExportPanel } from './ExportPanel';

interface Props {
  state: State;
  date: string;
  period: 'month' | 'year';
}

/** Month and year: hours and amount per customer and project. */
export function SummaryView({ state, date, period }: Props) {
  const [exporting, setExporting] = useState(false);
  const range = periodRange(period, date);
  const totals = projectTotals(state, datesBetween(range.from, range.to));

  const groups = state.customers
    .map((c) => {
      const projects = state.projects
        .filter((p) => p.customerId === c.id && totals.has(p.id))
        .map((p) => ({ project: p, ...totals.get(p.id)! }));
      return {
        customer: c,
        projects,
        minutes: projects.reduce((s, x) => s + x.minutes, 0),
        amount: projects.reduce((s, x) => s + x.amount, 0),
      };
    })
    .filter((g) => g.projects.length > 0);

  const totalMin = groups.reduce((s, g) => s + g.minutes, 0);
  const totalAmount = groups.reduce((s, g) => s + g.amount, 0);
  const money = (v: number) => (v > 0 ? formatMoney(v) : '');

  return (
    <div className="week-view">
      <div className="table-wrap">
        {groups.length === 0 ? (
          <p className="empty-period">Ingen tid registrerad {period === 'month' ? 'den här månaden' : 'det här året'}.</p>
        ) : (
          <table className="summary">
            {groups.map((g) => (
              <tbody key={g.customer.id}>
                <tr className="customer-row">
                  <td className="acc"><span className="bar" style={{ background: g.customer.color }} />{g.customer.name}</td>
                  <td>{formatHM(g.minutes)}</td>
                  <td className="amount">{money(g.amount)}</td>
                </tr>
                {g.projects.map((x) => (
                  <tr key={x.project.id} className="project-row">
                    <td className="acc">{x.project.name}</td>
                    <td>{formatHM(x.minutes)}</td>
                    <td className="amount">{money(x.amount)}</td>
                  </tr>
                ))}
              </tbody>
            ))}
            <tfoot>
              <tr>
                <td className="acc">Totalt</td>
                <td>{formatHM(totalMin)}</td>
                <td className="amount">{money(totalAmount)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
      <div className="period-foot">
        <span />
        <button className="primary" onClick={() => setExporting(true)}>Exportera</button>
      </div>
      {exporting && <ExportPanel state={state} date={date} period={period} onClose={() => setExporting(false)} />}
    </div>
  );
}
