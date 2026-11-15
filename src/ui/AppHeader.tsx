import { useEffect, useRef, useState } from 'react';
import {
  addMonths, dateRangeTotal, formatDuration, formatHM, fromISODate, isoWeek, monthWeeks, dayTotal, periodLabel, periodRange,
  shiftPeriod, toISODate, TILE_SORTS, type Period, type State, type TileSort,
} from '../core/model';
import { CommentIcon, FullscreenIcon, GearIcon, PlusMinusIcon, SortIcon } from './icons';
import { useFullscreen } from './useFullscreen';
import { NotesPanel } from './NotesPanel';

export type View = Period | 'settings';

interface Props {
  state: State;
  view: View;
  setView: (v: View) => void;
  date: string;
  setDate: (d: string) => void;
  editMode: boolean;
  setEditMode: (m: boolean) => void;
  setTileSort: (s: TileSort) => void;
  update: (fn: (s: State) => State) => void;
  syncProblem: 'error' | 'offline' | null;
}

/**
 * Brand on the left, ‹ date + counter › centered, edit and settings icons on the right.
 * The centered date opens the calendar in the day view and returns to the day view elsewhere.
 */
export function AppHeader({ state, view, setView, date, setDate, editMode, setEditMode, setTileSort, update, syncProblem }: Props) {
  const [notesOpen, setNotesOpen] = useState(false);
  const fullscreen = useFullscreen();
  const [sortOpen, setSortOpen] = useState(false);
  const tileSort = state.settings.tileSort ?? 'custom';
  const [calOpen, setCalOpen] = useState(false);
  const [calMonth, setCalMonth] = useState(date);
  const today = toISODate(new Date());
  const period: Period = view === 'settings' ? 'day' : view;
  const range = periodRange(period, date);
  const total = dateRangeTotal(state, range.from, range.to);

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

  const label = period === 'day' && date === today ? 'Idag' : periodLabel(period, date);

  function onCenter() {
    if (view === 'day') {
      setCalMonth(date);
      setCalOpen((o) => !o);
    } else {
      setView('day');
    }
  }

  function openPeriod(p: Period) {
    // Month/year follow the month shown in the calendar; week follows the selected day.
    if (p !== 'week' && calMonth.slice(0, 7) !== date.slice(0, 7)) setDate(calMonth.slice(0, 8) + '01');
    setView(p);
    setCalOpen(false);
  }

  return (
    <header className="topbar app-header">
      <button
        className="brand" aria-label="SLAPPERapp – till idag"
        onClick={() => { setDate(today); setView('day'); setCalOpen(false); }}
      >
        SLAPPERapp
      </button>

      <div className="center">
        <button className="icon-btn" aria-label="Föregående" onClick={() => setDate(shiftPeriod(period, date, -1))}>‹</button>
        <button
          className="center-btn" onClick={onCenter} aria-expanded={view === 'day' ? calOpen : undefined}
          aria-label={view === 'day' ? 'Välj dag i kalender' : 'Till dagsvyn'}
        >
          <span className="center-label">{label}</span>
          <span className={`counter ${pulse ? 'pulse' : ''}`} aria-live="polite">{formatDuration(total)}</span>
        </button>
        <button className="icon-btn" aria-label="Nästa" onClick={() => setDate(shiftPeriod(period, date, 1))}>›</button>
      </div>

      <div className="actions">
        {view === 'day' && (
          <button
            className={`icon-btn tool ${sortOpen ? 'on' : ''}`} aria-label="Sortera" aria-expanded={sortOpen}
            onClick={() => setSortOpen((o) => !o)}
          >
            <SortIcon />
          </button>
        )}
        {view === 'day' && (
          <button
            className={`icon-btn tool ${editMode ? 'on' : ''}`} aria-pressed={editMode}
            aria-label="Plus/minus: tryck drar av tid" onClick={() => setEditMode(!editMode)}
          >
            <PlusMinusIcon />
          </button>
        )}
        {view === 'day' && (
          <button
            className={`icon-btn tool ${notesOpen ? 'on' : ''}`} aria-label="Kommentarer för dagen"
            aria-expanded={notesOpen} onClick={() => setNotesOpen((o) => !o)}
          >
            <CommentIcon />
          </button>
        )}
        {fullscreen.supported && (
          <button
            className="icon-btn tool fullscreen-btn" aria-pressed={fullscreen.active}
            aria-label={fullscreen.active ? 'Lämna fullskärm' : 'Fullskärm'} onClick={fullscreen.toggle}
          >
            <FullscreenIcon exit={fullscreen.active} />
          </button>
        )}
        <button
          className={`icon-btn tool ${view === 'settings' ? 'on' : ''}`} aria-label="Inställningar"
          aria-pressed={view === 'settings'} onClick={() => setView(view === 'settings' ? 'day' : 'settings')}
        >
          <GearIcon />
          {syncProblem && <span className={`nav-dot ${syncProblem}`} aria-label={syncProblem === 'error' ? 'Synkfel' : 'Offline'} />}
        </button>
      </div>

      {notesOpen && view === 'day' && (
        <NotesPanel state={state} update={update} date={date} onClose={() => setNotesOpen(false)} />
      )}

      {sortOpen && (
        <>
          <div className="cal-backdrop clear" onClick={() => setSortOpen(false)} />
          <div className="menu" role="menu" aria-label="Sortera rutorna">
            <div className="menu-title">Sortera</div>
            {TILE_SORTS.map((o) => (
              <button
                key={o.value} role="menuitemradio" aria-checked={tileSort === o.value}
                className={tileSort === o.value ? 'on' : ''}
                onClick={() => { setTileSort(o.value); setSortOpen(false); }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}

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
                            onClick={() => { setDate(x); setCalOpen(false); }}
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
              <button onClick={() => openPeriod('week')}>Vecka</button>
              <button onClick={() => openPeriod('month')}>Månad</button>
              <button onClick={() => openPeriod('year')}>År</button>
              <span className="spacer" />
              <button className="primary" onClick={() => { setDate(today); setCalOpen(false); }}>Idag</button>
            </div>
          </div>
        </>
      )}
    </header>
  );
}
