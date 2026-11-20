import { useRef, useState } from 'react';
import { intervalLabel, formatMoney, type State } from '../core/model';
import { applyImport, IMPORT_TEMPLATE, planImport, readTable, type ImportPlan } from '../core/importer';

interface Props {
  state: State;
  update: (fn: (s: State) => State) => void;
  palette: string[];
}

const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function downloadTemplate() {
  const url = URL.createObjectURL(new Blob([IMPORT_TEMPLATE], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'slira-mall-kunder-och-projekt.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Import customers and projects from an Excel or CSV file, with a preview before anything changes. */
export function ImportSection({ state, update, palette }: Props) {
  const file = useRef<HTMLInputElement>(null);
  const [plan, setPlan] = useState<{ name: string; plan: ImportPlan } | null>(null);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);

  async function choose(f: File) {
    setMsg(null);
    setPlan(null);
    try {
      const table = await readTable(f.name, await f.arrayBuffer());
      setPlan({ name: f.name, plan: planImport(state, table, palette) });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : String(e), error: true });
    }
  }

  const nameOf = (id: string) =>
    plan?.plan.customers.find((c) => c.id === id)?.name ?? state.customers.find((c) => c.id === id)?.name ?? '';

  return (
    <section>
      <h2>Importera kunder och projekt</h2>
      <p className="hint">
        Från Excel (.xlsx) eller CSV med en rad per projekt och kolumnerna <strong>Kund</strong> och <strong>Projekt</strong>.
        Kolumnerna Kundnr, Projektkod, Timpris och Intervall är valfria. Kunder och projekt som redan finns hoppas över.
      </p>
      <div className="editor-actions" style={{ marginTop: 12 }}>
        <button type="button" onClick={() => file.current?.click()}>Välj fil…</button>
        <button type="button" className="link" onClick={downloadTemplate}>Ladda ner mall</button>
        <input
          ref={file} type="file" hidden
          accept=".xlsx,.csv,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) choose(f); }}
        />
      </div>

      {plan && (
        <div className="import-preview">
          <p>
            <strong>{plan.name}</strong>: {n(plan.plan.customers.length, 'ny kund', 'nya kunder')} och{' '}
            {n(plan.plan.projects.length, 'nytt projekt', 'nya projekt')}.
            {(plan.plan.skippedProjects > 0 || plan.plan.existingCustomers > 0) && (
              <> Fanns redan: {n(plan.plan.existingCustomers, 'kund', 'kunder')} och {n(plan.plan.skippedProjects, 'projekt', 'projekt')}.</>
            )}
          </p>
          {plan.plan.projects.length + plan.plan.customers.length > 0 && (
            <ul className="import-list">
              {plan.plan.projects.map((p) => (
                <li key={p.id}>
                  <span>{nameOf(p.customerId)} · {p.name}</span>
                  <small>{[p.code, p.interval !== undefined ? intervalLabel(p.interval) : '', p.rate !== undefined ? `${formatMoney(p.rate)}/h` : ''].filter(Boolean).join(' · ')}</small>
                </li>
              ))}
              {plan.plan.customers.filter((c) => !plan.plan.projects.some((p) => p.customerId === c.id)).map((c) => (
                <li key={c.id}><span>{c.name}</span><small>Kund utan projekt</small></li>
              ))}
            </ul>
          )}
          {plan.plan.warnings.length > 0 && (
            <ul className="import-warnings">{plan.plan.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          )}
          <div className="editor-actions">
            <span className="spacer" />
            <button type="button" onClick={() => setPlan(null)}>Avbryt</button>
            <button
              type="button" className="primary" disabled={plan.plan.customers.length + plan.plan.projects.length === 0}
              onClick={() => {
                const p = plan.plan;
                update((s) => applyImport(s, p));
                setPlan(null);
                setMsg({ text: `Importerade ${n(p.customers.length, 'kund', 'kunder')} och ${n(p.projects.length, 'projekt', 'projekt')}.` });
              }}
            >
              Importera
            </button>
          </div>
        </div>
      )}
      {msg && <p className={msg.error ? 'error-text' : 'info-text'}>{msg.text}</p>}
    </section>
  );
}
