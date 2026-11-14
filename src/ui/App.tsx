import { useState } from 'react';
import { toISODate } from '../core/model';
import { useStore } from './useStore';
import { useSync } from './useSync';
import { KeysView } from './KeysView';
import { WeekView } from './WeekView';
import { SetupView } from './SetupView';

type Tab = 'keys' | 'week' | 'setup';

export function App() {
  const { state, update, getState } = useStore();
  const sync = useSync(state, getState, update);
  const [tab, setTab] = useState<Tab>('keys');
  const [date, setDate] = useState(() => toISODate(new Date()));
  const [setupAdding, setSetupAdding] = useState(false);

  const go = (t: Tab) => { setSetupAdding(false); setTab(t); };

  return (
    <div className="app">
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
        {tab === 'setup' && <SetupView state={state} update={update} startAdding={setupAdding} sync={sync} />}
      </main>
      <nav className="bottomnav">
        <button className={tab === 'keys' ? 'on' : ''} onClick={() => go('keys')}>Dag</button>
        <button className={tab === 'week' ? 'on' : ''} onClick={() => go('week')}>Vecka</button>
        <button className={tab === 'setup' ? 'on' : ''} onClick={() => go('setup')}>
          Kunder
          {(sync.status === 'error' || sync.status === 'offline') && (
            <span className={`nav-dot ${sync.status}`} aria-label={sync.status === 'error' ? 'Synkfel' : 'Offline'} />
          )}
        </button>
      </nav>
    </div>
  );
}
