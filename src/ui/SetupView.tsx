import { useRef, useState } from 'react';
import {
  newId, paletteOf, PRESET_INTERVALS, intervalLabel, intervalFor, rateFor, formatMoney,
  type Customer, type Project, type Interval, type State,
} from '../core/model';
import type { SyncApi } from './useSync';
import { SyncSection } from './SyncSection';
import { ColorPicker } from './ColorPicker';
import { PinIcon } from './icons';
import { parseASE } from '../core/ase';

type Update = (fn: (s: State) => State) => void;

type Editing =
  | { kind: 'customer'; draft: Customer; isNew: boolean }
  | { kind: 'project'; draft: Project; isNew: boolean }
  | null;

function IntervalPicker({ value, onChange, inheritLabel }: {
  value: Interval | undefined;
  onChange: (v: Interval | undefined) => void;
  /** When set, shows an "inherit" option with this label. */
  inheritLabel?: string;
}) {
  const isCustom = value !== undefined && !PRESET_INTERVALS.includes(value);
  return (
    <div className="segmented">
      {inheritLabel && (
        <button className={value === undefined ? 'on' : ''} onClick={() => onChange(undefined)}>{inheritLabel}</button>
      )}
      {PRESET_INTERVALS.map((i) => (
        <button key={String(i)} className={value === i ? 'on' : ''} onClick={() => onChange(i)}>
          {intervalLabel(i)}
        </button>
      ))}
      <input
        className={isCustom ? 'on' : ''} type="number" min={1} inputMode="numeric" placeholder="min"
        aria-label="Eget intervall i minuter"
        value={isCustom ? (value as number) : ''}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (n > 0) onChange(n);
        }}
      />
    </div>
  );
}

/** Hourly rate in kr. Empty = inherit (shown as placeholder). */
function RateInput({ value, onChange, inherited, label = 'Timpris (kr/h)' }: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  inherited?: number;
  label?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number" min={0} step={10} inputMode="numeric"
        placeholder={inherited ? `Ärver ${formatMoney(inherited)}/h` : 'Inget timpris'}
        value={value ?? ''}
        onChange={(e) => {
          const v = e.target.value.trim();
          const n = Number(v.replace(',', '.'));
          onChange(v === '' || !Number.isFinite(n) || n < 0 ? undefined : n);
        }}
      />
    </label>
  );
}

function CustomerEditor({ initial, isNew, onSave, onCancel, onRemove, defaultLabel, inheritedRate, palette }: {
  initial: Customer; isNew: boolean; defaultLabel: string; inheritedRate?: number; palette: string[];
  onSave: (c: Customer) => void; onCancel: () => void; onRemove: () => void;
}) {
  const [c, setC] = useState(initial);
  return (
    <div className="editor">
      <label className="field">
        <span>Kund</span>
        <input autoFocus value={c.name} placeholder="Kundens namn" onChange={(e) => setC({ ...c, name: e.target.value })} />
      </label>
      <label className="field">
        <span>Kundnummer</span>
        <input value={c.code ?? ''} placeholder="Valfritt" onChange={(e) => setC({ ...c, code: e.target.value || undefined })} />
      </label>
      <div className="field">
        <span>Färg</span>
        <ColorPicker value={c.color} palette={palette} onChange={(color) => setC({ ...c, color })} />
      </div>
      <div className="field">
        <span>Intervall</span>
        <IntervalPicker inheritLabel={defaultLabel} value={c.interval} onChange={(interval) => setC({ ...c, interval })} />
      </div>
      <RateInput value={c.rate} inherited={inheritedRate} onChange={(rate) => setC({ ...c, rate })} />
      <div className="editor-actions">
        {!isNew && <button className="danger" onClick={onRemove}>Ta bort</button>}
        <span className="spacer" />
        <button onClick={onCancel}>Avbryt</button>
        <button className="primary" disabled={!c.name.trim()} onClick={() => onSave(c)}>Spara</button>
      </div>
    </div>
  );
}

function ProjectEditor({ initial, isNew, onSave, onCancel, onRemove, inheritLabel, inheritedRate }: {
  initial: Project; isNew: boolean; inheritLabel: string; inheritedRate?: number;
  onSave: (p: Project) => void; onCancel: () => void; onRemove: () => void;
}) {
  const [p, setP] = useState(initial);
  return (
    <div className="editor">
      <label className="field">
        <span>Projekt</span>
        <input autoFocus value={p.name} placeholder="Projektets namn" onChange={(e) => setP({ ...p, name: e.target.value })} />
      </label>
      <label className="field">
        <span>Projektkod</span>
        <input value={p.code ?? ''} placeholder="Valfritt" onChange={(e) => setP({ ...p, code: e.target.value || undefined })} />
      </label>
      <div className="field">
        <span>Intervall</span>
        <IntervalPicker inheritLabel={inheritLabel} value={p.interval} onChange={(interval) => setP({ ...p, interval })} />
      </div>
      <RateInput value={p.rate} inherited={inheritedRate} onChange={(rate) => setP({ ...p, rate })} />
      <div className="editor-actions">
        {!isNew && <button className="danger" onClick={onRemove}>Ta bort</button>}
        <span className="spacer" />
        <button onClick={onCancel}>Avbryt</button>
        <button className="primary" disabled={!p.name.trim()} onClick={() => onSave(p)}>Spara</button>
      </div>
    </div>
  );
}

function moveIn<T extends { id: string }>(arr: T[], id: string, dir: -1 | 1, sameGroup: (a: T, b: T) => boolean): T[] {
  const i = arr.findIndex((x) => x.id === id);
  let j = i + dir;
  while (j >= 0 && j < arr.length && !sameGroup(arr[i], arr[j])) j += dir;
  if (i < 0 || j < 0 || j >= arr.length) return arr;
  const out = [...arr];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

/** The palette offered when picking colors; replaceable with a .ase file. */
function PaletteField({ palette, isCustom, onChange }: {
  palette: string[]; isCustom: boolean; onChange: (p: string[] | undefined) => void;
}) {
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  return (
    <div className="field">
      <span>Färgpalett</span>
      <div className="colors">
        {palette.map((c) => <span key={c} className="swatch static" style={{ background: c }} title={c} />)}
      </div>
      <div className="editor-actions">
        <button type="button" onClick={() => file.current?.click()}>Ladda upp .ase-fil</button>
        {isCustom && (
          <button type="button" className="link" onClick={() => { onChange(undefined); setMsg({ text: 'Standardpaletten används igen.' }); }}>
            Återställ standard
          </button>
        )}
        <input
          ref={file} type="file" accept=".ase,application/octet-stream" hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              const colors = [...new Set(parseASE(await f.arrayBuffer()).map((s) => s.hex))];
              onChange(colors);
              setMsg({ text: `${colors.length} färger inlästa från ${f.name}. Befintliga kunder behåller sina färger.` });
            } catch (err) {
              setMsg({ text: err instanceof Error ? err.message : String(err), error: true });
            }
          }}
        />
      </div>
      {msg && <p className={msg.error ? 'error-text' : 'info-text'}>{msg.text}</p>}
    </div>
  );
}

export function SetupView({ state, update, startAdding, sync }: {
  state: State; update: Update; startAdding?: boolean; sync: SyncApi;
}) {
  const palette = paletteOf(state);
  const newCustomer = (): Editing => ({
    kind: 'customer', isNew: true,
    draft: { id: newId(), name: '', color: palette[state.customers.length % palette.length] },
  });
  const [editing, setEditing] = useState<Editing>(() => (startAdding ? newCustomer() : null));
  const defaultLabel = `Standard (${intervalLabel(state.settings.defaultInterval)})`;

  function saveCustomer(c: Customer) {
    update((s) => ({
      ...s,
      customers: s.customers.some((x) => x.id === c.id)
        ? s.customers.map((x) => (x.id === c.id ? c : x))
        : [...s.customers, c],
    }));
    // A new customer goes straight on to its first project.
    const isNew = !state.customers.some((x) => x.id === c.id);
    setEditing(isNew ? { kind: 'project', isNew: true, draft: { id: newId(), customerId: c.id, name: '' } } : null);
  }

  function saveProject(p: Project) {
    update((s) => ({
      ...s,
      projects: s.projects.some((x) => x.id === p.id)
        ? s.projects.map((x) => (x.id === p.id ? p : x))
        : [...s.projects, p],
    }));
    setEditing(null);
  }

  function removeCustomer(c: Customer) {
    const ids = new Set(state.projects.filter((p) => p.customerId === c.id).map((p) => p.id));
    if (state.taps.some((t) => ids.has(t.projectId))) {
      if (!confirm(`${c.name} har registrerad tid. Arkivera kunden? Tiden finns kvar i veckovyn.`)) return;
      update((s) => ({ ...s, customers: s.customers.map((x) => (x.id === c.id ? { ...x, archived: true } : x)) }));
    } else {
      if (!confirm(`Ta bort ${c.name} och dess projekt?`)) return;
      update((s) => ({
        ...s,
        customers: s.customers.filter((x) => x.id !== c.id),
        projects: s.projects.filter((p) => p.customerId !== c.id),
      }));
    }
    setEditing(null);
  }

  function removeProject(p: Project) {
    if (state.taps.some((t) => t.projectId === p.id)) {
      if (!confirm(`${p.name} har registrerad tid. Arkivera projektet? Tiden finns kvar i veckovyn.`)) return;
      update((s) => ({ ...s, projects: s.projects.map((x) => (x.id === p.id ? { ...x, archived: true } : x)) }));
    } else {
      if (!confirm(`Ta bort ${p.name}?`)) return;
      update((s) => ({ ...s, projects: s.projects.filter((x) => x.id !== p.id) }));
    }
    setEditing(null);
  }

  const customers = state.customers.filter((c) => !c.archived);
  const archivedCustomers = state.customers.filter((c) => c.archived);
  const archivedProjects = state.projects.filter(
    (p) => p.archived && !state.customers.find((c) => c.id === p.customerId)?.archived,
  );
  const restore = (kind: 'customers' | 'projects', id: string) =>
    update((s) => ({ ...s, [kind]: (s[kind] as { id: string }[]).map((x) => (x.id === id ? { ...x, archived: false } : x)) }));

  return (
    <>
    <div className="setup-view">
      {/* Sync status first, so it is visible without scrolling. */}
      <SyncSection sync={sync} />
      <section>
        {customers.map((c, ci) => {
          const projects = state.projects.filter((p) => p.customerId === c.id && !p.archived);
          const custInterval = c.interval ?? state.settings.defaultInterval;
          const custRate = c.rate ?? state.settings.hourlyRate;
          return (
            <div key={c.id} className="customer" style={{ '--c': c.color } as React.CSSProperties}>
              {editing?.kind === 'customer' && editing.draft.id === c.id ? (
                <CustomerEditor
                  initial={editing.draft} isNew={false} defaultLabel={defaultLabel} inheritedRate={state.settings.hourlyRate} palette={palette}
                  onSave={saveCustomer} onCancel={() => setEditing(null)} onRemove={() => removeCustomer(c)}
                />
              ) : (
                <div className="row customer-head">
                  <button className="row-main" onClick={() => setEditing({ kind: 'customer', isNew: false, draft: c })}>
                    <strong>{c.name}</strong>
                    <small>{[c.code, intervalLabel(custInterval), custRate ? `${formatMoney(custRate)}/h` : ''].filter(Boolean).join(' · ')}</small>
                  </button>
                  <button className="icon-btn sm" aria-label="Flytta upp" disabled={ci === 0}
                    onClick={() => update((s) => ({ ...s, customers: moveIn(s.customers, c.id, -1, (_a, b) => !b.archived) }))}>↑</button>
                  <button className="icon-btn sm" aria-label="Flytta ner" disabled={ci === customers.length - 1}
                    onClick={() => update((s) => ({ ...s, customers: moveIn(s.customers, c.id, 1, (_a, b) => !b.archived) }))}>↓</button>
                </div>
              )}

              {projects.map((p, pi) =>
                editing?.kind === 'project' && editing.draft.id === p.id ? (
                  <ProjectEditor
                    key={p.id} initial={editing.draft} isNew={false} inheritLabel={`Kundens (${intervalLabel(custInterval)})`} inheritedRate={custRate}
                    onSave={saveProject} onCancel={() => setEditing(null)} onRemove={() => removeProject(p)}
                  />
                ) : (
                  <div key={p.id} className="row project">
                    <button className="row-main" onClick={() => setEditing({ kind: 'project', isNew: false, draft: p })}>
                      <span>{p.name}</span>
                      <small>{[p.code, intervalLabel(intervalFor(state, p)), rateFor(state, p) ? `${formatMoney(rateFor(state, p)!)}/h` : ''].filter(Boolean).join(' · ')}</small>
                    </button>
                    <button
                      className={`icon-btn sm pin-btn ${p.pinned ? 'on' : ''}`} aria-pressed={!!p.pinned}
                      aria-label={p.pinned ? `Lossa ${p.name}` : `Fäst ${p.name} överst`}
                      title={p.pinned ? 'Fäst överst – tryck för att lossa' : 'Fäst överst'}
                      onClick={() => update((s) => ({ ...s, projects: s.projects.map((x) => (x.id === p.id ? { ...x, pinned: !x.pinned || undefined } : x)) }))}
                    >
                      <PinIcon filled={!!p.pinned} />
                    </button>
                    <button className="icon-btn sm" aria-label="Flytta upp" disabled={pi === 0}
                      onClick={() => update((s) => ({ ...s, projects: moveIn(s.projects, p.id, -1, (a, b) => a.customerId === b.customerId && !b.archived) }))}>↑</button>
                    <button className="icon-btn sm" aria-label="Flytta ner" disabled={pi === projects.length - 1}
                      onClick={() => update((s) => ({ ...s, projects: moveIn(s.projects, p.id, 1, (a, b) => a.customerId === b.customerId && !b.archived) }))}>↓</button>
                  </div>
                ),
              )}

              {editing?.kind === 'project' && editing.isNew && editing.draft.customerId === c.id ? (
                <ProjectEditor
                  initial={editing.draft} isNew inheritLabel={`Kundens (${intervalLabel(custInterval)})`} inheritedRate={custRate}
                  onSave={saveProject} onCancel={() => setEditing(null)} onRemove={() => {}}
                />
              ) : (
                <button className="row add" onClick={() => setEditing({ kind: 'project', isNew: true, draft: { id: newId(), customerId: c.id, name: '' } })}>
                  + Projekt
                </button>
              )}
            </div>
          );
        })}

        {editing?.kind === 'customer' && editing.isNew ? (
          <div className="customer" style={{ '--c': editing.draft.color } as React.CSSProperties}>
            <CustomerEditor
              initial={editing.draft} isNew defaultLabel={defaultLabel} inheritedRate={state.settings.hourlyRate} palette={palette}
              onSave={saveCustomer} onCancel={() => setEditing(null)} onRemove={() => {}}
            />
          </div>
        ) : (
          <button className="primary block" onClick={() => setEditing(newCustomer())}>+ Ny kund</button>
        )}
      </section>

      <section>
        <h2>Inställningar</h2>
        <div className="field">
          <span>Standardintervall</span>
          <IntervalPicker
            value={state.settings.defaultInterval}
            onChange={(v) => v !== undefined && update((s) => ({ ...s, settings: { ...s.settings, defaultInterval: v } }))}
          />
        </div>
        <RateInput
          label="Timpris (kr/h)"
          value={state.settings.hourlyRate}
          onChange={(hourlyRate) => update((s) => ({ ...s, settings: { ...s.settings, hourlyRate } }))}
        />
        <PaletteField
          palette={palette} isCustom={!!state.settings.palette?.length}
          onChange={(p) => update((s) => ({ ...s, settings: { ...s.settings, palette: p } }))}
        />
        <label className="field">
          <span>Arbetsdag (timmar)</span>
          <input
            type="number" min={0.5} step={0.5} inputMode="decimal" defaultValue={state.settings.workdayMinutes / 60}
            onChange={(e) => {
              const h = parseFloat(e.target.value.replace(',', '.'));
              if (h > 0) update((s) => ({ ...s, settings: { ...s.settings, workdayMinutes: Math.round(h * 60) } }));
            }}
          />
        </label>
      </section>


      {(archivedCustomers.length > 0 || archivedProjects.length > 0) && (
        <section>
          <h2>Arkiv</h2>
          {archivedCustomers.map((c) => (
            <div key={c.id} className="row">
              <span className="row-main"><span>{c.name}</span><small>Kund</small></span>
              <button onClick={() => restore('customers', c.id)}>Återställ</button>
            </div>
          ))}
          {archivedProjects.map((p) => (
            <div key={p.id} className="row">
              <span className="row-main">
                <span>{p.name}</span>
                <small>{state.customers.find((c) => c.id === p.customerId)?.name}</small>
              </span>
              <button onClick={() => restore('projects', p.id)}>Återställ</button>
            </div>
          ))}
        </section>
      )}
      <p className="version">
        Version {__APP_BUILD__} · {new Date(__APP_BUILT_AT__).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })}
      </p>
    </div>
    </>
  );
}
