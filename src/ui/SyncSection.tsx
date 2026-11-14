import { useState } from 'react';
import type { SyncApi } from './useSync';

const STATUS_TEXT: Record<SyncApi['status'], string> = {
  off: 'Inte aktiverad',
  'signed-out': 'Inte inloggad',
  syncing: 'Synkar…',
  synced: 'Synkad',
  offline: 'Offline – synkar när nätet är tillbaka',
  error: 'Kunde inte synka',
};

export function SyncSection({ sync }: { sync: SyncApi }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (sync.status === 'off') {
    return (
      <section>
        <h2>Synk</h2>
        <p className="hint">Synk är inte aktiverad i den här versionen. All data sparas på enheten.</p>
      </section>
    );
  }

  if (!sync.email) {
    return (
      <section>
        <h2>Synk mellan enheter</h2>
        {step === 'email' ? (
          <form
            className="editor plain"
            onSubmit={(e) => {
              e.preventDefault();
              act(async () => { await sync.sendCode(email.trim()); setStep('code'); });
            }}
          >
            <p className="hint">Logga in med din e-post för att synka mellan telefon och surfplatta. Din befintliga tid följer med.</p>
            <label className="field">
              <span>E-post</span>
              <input type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <div className="editor-actions">
              <span className="spacer" />
              <button className="primary" disabled={busy || !email.includes('@')}>Skicka kod</button>
            </div>
          </form>
        ) : (
          <form
            className="editor plain"
            onSubmit={(e) => { e.preventDefault(); act(() => sync.verifyCode(email.trim(), code)); }}
          >
            <p className="hint">Vi har skickat en kod till <strong>{email}</strong>. Skriv in den här, eller öppna länken i mejlet på den här enheten.</p>
            <label className="field">
              <span>Kod</span>
              <input
                autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={10}
                value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              />
            </label>
            <div className="editor-actions">
              <button type="button" onClick={() => { setStep('email'); setCode(''); }}>Byt e-post</button>
              <span className="spacer" />
              <button className="primary" disabled={busy || code.length < 6}>Logga in</button>
            </div>
          </form>
        )}
        {msg && <p className="error-text">{msg}</p>}
      </section>
    );
  }

  return (
    <section>
      <h2>Synk mellan enheter</h2>
      <div className="row">
        <span className="row-main">
          <span>{sync.email}</span>
          <small>
            <span className={`status-dot ${sync.status}`} />
            {STATUS_TEXT[sync.status]}
            {sync.lastSynced && sync.status === 'synced'
              && ` · ${sync.lastSynced.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`}
          </small>
        </span>
        <button onClick={sync.syncNow} disabled={sync.status === 'syncing'}>Synka nu</button>
      </div>
      {sync.status === 'error' && sync.error && <p className="error-text">{sync.error}</p>}
      <div className="editor-actions" style={{ marginTop: 12 }}>
        <span className="spacer" />
        <button
          className="danger"
          onClick={() => {
            if (confirm('Logga ut? Datan finns kvar i ditt konto men tas bort från den här enheten.')) {
              act(sync.signOut);
            }
          }}
        >
          Logga ut
        </button>
      </div>
    </section>
  );
}
