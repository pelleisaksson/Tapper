import { useEffect, useState } from 'react';
import { toISODate } from '../core/model';
import { useStore } from './useStore';
import { useSync } from './useSync';
import { AppHeader, type View } from './AppHeader';
import { KeysView } from './KeysView';
import { WeekView } from './WeekView';
import { SummaryView } from './SummaryView';
import { SetupView } from './SetupView';
import { Welcome } from './Welcome';

export function App() {
  const { state, update, getState } = useStore();
  const sync = useSync(state, getState, update);
  const [view, setView] = useState<View>('day');
  const [date, setDate] = useState(() => toISODate(new Date()));
  const [editMode, setEditMode] = useState(false);
  const [setupAdding, setSetupAdding] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | undefined>();
  // Signed out (with sync available): the start screen invites to sign in.
  const signedOut = sync.ready && sync.status !== 'off' && !sync.email && !sync.recovering;
  const sessionLoading = !sync.ready;
  // Signed in from the start screen: go straight to the tiles.
  useEffect(() => {
    if (sync.email && authMode) { setAuthMode(undefined); setView('day'); }
  }, [sync.email, authMode]);
  const openAuth = (mode: 'signin' | 'signup') => { setAuthMode(mode); setSetupAdding(false); setView('settings'); };

  // Opening a password reset link: go straight to where the new password is set.
  useEffect(() => { if (sync.recovering) setView('settings'); }, [sync.recovering]);

  const go = (v: View) => {
    setSetupAdding(false);
    if (v !== 'day') setEditMode(false);
    setView(v);
  };

  return (
    <div className="app">
      <AppHeader
        state={state} view={view} setView={go} date={date} setDate={setDate}
        editMode={editMode} setEditMode={setEditMode} update={update}
        setTileSort={(tileSort) => update((s) => ({ ...s, settings: { ...s.settings, tileSort } }))}
        syncProblem={sync.status === 'error' || sync.status === 'offline' ? sync.status : null}
      />
      <main>
        {view === 'day' && signedOut && (
          <Welcome onSignup={() => openAuth('signup')} onSignin={() => openAuth('signin')} />
        )}
        {view === 'day' && !signedOut && !sessionLoading && (
          <KeysView
            state={state} update={update} date={date} editMode={editMode}
            onSetup={() => { setSetupAdding(true); setView('settings'); }}
          />
        )}
        {view === 'week' && <WeekView state={state} date={date} openDay={(d) => { setDate(d); go('day'); }} />}
        {(view === 'month' || view === 'year') && <SummaryView state={state} date={date} period={view} />}
        {view === 'settings' && <SetupView state={state} update={update} startAdding={setupAdding} sync={sync} authMode={authMode} />}
      </main>
    </div>
  );
}
