import { useState } from 'react';
import { toISODate } from '../core/model';
import { useStore } from './useStore';
import { KeysView } from './KeysView';
import { WeekView } from './WeekView';
import { SetupView } from './SetupView';

type Tab = 'keys' | 'week' | 'setup';

export function App() {
  const [state, update] = useStore();
  const [tab, setTab] = useState<Tab>('keys');
  const [date, setDate] = useState(() => toISODate(new Date()));
  const [setupAdding, setSetupAdding] = useState(false);

  const go = (t: Tab) => { setSetupAdding(false); setTab(t); };

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">Tapper</span>
        <nav className="tabs">
          <button className={tab === 'keys' ? 'on' : ''} onClick={() => go('keys')}>Dag</button>
          <button className={tab === 'week' ? 'on' : ''} onClick={() => go('week')}>Vecka</button>
          <button className={tab === 'setup' ? 'on' : ''} onClick={() => go('setup')}>Kunder</button>
        </nav>
      </header>
      <main>
        {tab === 'keys' && (
          <KeysView
            state={state} update={update} date={date} setDate={setDate}
            onSetup={() => { setSetupAdding(true); setTab('setup'); }}
          />
        )}
        {tab === 'week' && (
          <WeekView state={state} date={date} setDate={setDate} openDay={(d) => { setDate(d); setTab('keys'); }} />
        )}
        {tab === 'setup' && <SetupView state={state} update={update} startAdding={setupAdding} />}
      </main>
    </div>
  );
}
