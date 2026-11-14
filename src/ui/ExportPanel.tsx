import { useState } from 'react';
import {
  addDays, addMonths, datesBetween, exportCSV, exportRows, formatHM, toISODate, weekDates,
  type State,
} from '../core/model';
import { exportXLSX } from '../core/xlsx';

interface Props {
  state: State;
  /** Date used to seed the range (the week being viewed). */
  date: string;
  onClose: () => void;
}

function presets(date: string): { label: string; from: string; to: string }[] {
  const week = weekDates(date);
  const monthStart = date.slice(0, 8) + '01';
  const prevMonthStart = addMonths(date, -1);
  return [
    { label: 'Vecka', from: week[0], to: week[6] },
    { label: 'Förra veckan', from: addDays(week[0], -7), to: addDays(week[0], -1) },
    { label: 'Månad', from: monthStart, to: addDays(addMonths(date, 1), -1) },
    { label: 'Förra månaden', from: prevMonthStart, to: addDays(monthStart, -1) },
    { label: 'I år', from: date.slice(0, 4) + '-01-01', to: date.slice(0, 4) + '-12-31' },
  ];
}

function download(data: BlobPart, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ExportPanel({ state, date, onClose }: Props) {
  const ps = presets(date);
  const [from, setFrom] = useState(ps[0].from);
  const [to, setTo] = useState(ps[0].to);
  const valid = !!from && !!to && from <= to;
  const dates = valid ? datesBetween(from, to) : [];
  const rows = exportRows(state, dates);
  const total = rows.reduce((s, r) => s + r.minutes, 0);
  const name = `tapper_${from}_${to}`;

  return (
    <>
      <div className="cal-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label="Exportera">
        <div className="sheet-head">
          <strong>Exportera</strong>
          <button className="icon-btn sm" aria-label="Stäng" onClick={onClose}>✕</button>
        </div>

        <div className="segmented">
          {ps.map((p) => (
            <button
              key={p.label} className={from === p.from && to === p.to ? 'on' : ''}
              onClick={() => { setFrom(p.from); setTo(p.to); }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="range">
          <label className="field">
            <span>Från</span>
            <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="field">
            <span>Till</span>
            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>

        <div className="export-summary">
          {valid
            ? <>{dates.length} dagar · {rows.length} rader · <strong>{formatHM(total)}</strong></>
            : 'Välj ett giltigt intervall'}
        </div>

        <div className="editor-actions">
          <span className="spacer" />
          <button
            disabled={!rows.length}
            onClick={() => download('﻿' + exportCSV(state, dates), 'text/csv;charset=utf-8', `${name}.csv`)}
          >
            CSV
          </button>
          <button
            className="primary" disabled={!rows.length}
            onClick={() => download(
              exportXLSX(state, dates) as BlobPart,
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              `${name}.xlsx`,
            )}
          >
            Excel
          </button>
        </div>
        <p className="hint">Exporterad {toISODate(new Date())}. Excel-filen har en flik med alla rader och en med summering per projekt.</p>
      </div>
    </>
  );
}
