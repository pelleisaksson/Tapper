import { useEffect, useRef } from 'react';
import {
  formatDuration, fromISODate, minutesFor, noteFor, setNote, tileOrder, toISODate, type State,
} from '../core/model';

interface Props {
  state: State;
  update: (fn: (s: State) => State) => void;
  date: string;
  onClose: () => void;
}

/** Grows a textarea with its content. */
function autosize(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

/** One comment per project with registered time on the day. */
export function NotesPanel({ state, update, date, onClose }: Props) {
  const rows = tileOrder(state, 'custom')
    .map((t) => ({ ...t, minutes: minutesFor(state.taps, t.project.id, date) }))
    .filter((t) => t.minutes > 0);
  const first = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    document.querySelectorAll<HTMLTextAreaElement>('.note-input').forEach(autosize);
  }, []);

  const today = toISODate(new Date());
  const label = date === today
    ? 'idag'
    : fromISODate(date).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <>
      <div className="cal-backdrop" onClick={onClose} />
      <div className="sheet notes-sheet" role="dialog" aria-label="Kommentarer">
        <div className="sheet-head">
          <strong>Kommentarer {label}</strong>
          <button className="icon-btn sm" aria-label="Stäng" onClick={onClose}>✕</button>
        </div>
        {rows.length === 0 ? (
          <p className="hint">Ingen tid registrerad {label === 'idag' ? 'idag' : 'den här dagen'}. Registrera tid först, så kan du skriva vad du gjorde.</p>
        ) : (
          <div className="notes-list">
            {rows.map(({ customer, project, minutes }, i) => (
              <label key={project.id} className="note-row" style={{ '--c': customer.color } as React.CSSProperties}>
                <span className="note-head">
                  <span className="note-project">
                    <small>{customer.name}</small>
                    {project.name}
                  </span>
                  <span className="note-time">{formatDuration(minutes)}</span>
                </span>
                <textarea
                  ref={i === 0 ? first : undefined}
                  className="note-input" rows={2} placeholder="Vad gjorde du?"
                  value={noteFor(state, project.id, date)}
                  onChange={(e) => {
                    autosize(e.target);
                    const text = e.target.value;
                    update((s) => setNote(s, project.id, date, text));
                  }}
                />
              </label>
            ))}
          </div>
        )}
        <p className="hint">En kommentar per projekt och dag. Kommentarerna följer med i exporten.</p>
      </div>
    </>
  );
}
