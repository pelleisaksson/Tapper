import { useState } from 'react';
import { authErrorText, type SyncApi } from './useSync';

const STATUS_TEXT: Record<SyncApi['status'], string> = {
  off: 'Inte aktiverad',
  'signed-out': 'Inte inloggad',
  syncing: 'Synkar…',
  synced: 'Synkad',
  offline: 'Offline – synkar när nätet är tillbaka',
  error: 'Kunde inte synka',
};

type Mode = 'signin' | 'signup' | 'reset' | 'code' | 'code-verify';

export function SyncSection({ sync }: { sync: SyncApi }) {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);

  async function act(fn: () => Promise<string | void>) {
    setBusy(true);
    setMsg(null);
    try {
      const info = await fn();
      if (info) setMsg({ text: info });
    } catch (e) {
      setMsg({ text: authErrorText(e), error: true });
    } finally {
      setBusy(false);
    }
  }

  const go = (m: Mode) => { setMode(m); setMsg(null); };
  const message = msg && <p className={msg.error ? 'error-text' : 'info-text'}>{msg.text}</p>;

  if (sync.status === 'off') {
    return (
      <section>
        <h2>Synk</h2>
        <p className="hint">Synk är inte aktiverad i den här versionen. All data sparas på enheten.</p>
      </section>
    );
  }

  // Opened a password reset link.
  if (sync.recovering) {
    return (
      <section>
        <h2>Välj nytt lösenord</h2>
        <form className="editor plain" onSubmit={(e) => { e.preventDefault(); act(() => sync.setNewPassword(password)); }}>
          <label className="field">
            <span>Nytt lösenord</span>
            <input type="password" autoComplete="new-password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <div className="editor-actions">
            <span className="spacer" />
            <button className="primary" disabled={busy || password.length < 6}>Spara lösenord</button>
          </div>
        </form>
        {message}
      </section>
    );
  }

  if (!sync.email) {
    const emailField = (
      <label className="field">
        <span>E-post</span>
        <input type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
    );
    const validEmail = email.includes('@');

    return (
      <section>
        <h2>Synk mellan enheter</h2>

        {(mode === 'signin' || mode === 'signup') && (
          <form
            className="editor plain"
            onSubmit={(e) => {
              e.preventDefault();
              if (mode === 'signin') act(() => sync.signIn(email.trim(), password));
              else act(async () => {
                const ready = await sync.signUp(email.trim(), password);
                if (!ready) {
                  setMode('signin');
                  return `Kontot är skapat. Vi har skickat ett mejl till ${email.trim()}. Klicka på länken i mejlet (det går bra att öppna den i vilken webbläsare som helst) och logga sedan in här.`;
                }
              });
            }}
          >
            <p className="hint">
              {mode === 'signin'
                ? 'Logga in för att synka mellan telefon och surfplatta. Tid du redan registrerat följer med.'
                : 'Skapa ett konto med din e-post och ett lösenord på minst 6 tecken.'}
            </p>
            {emailField}
            <label className="field">
              <span>Lösenord</span>
              <input
                type="password" required minLength={6}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password} onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <div className="editor-actions">
              <button type="button" className="link" onClick={() => go(mode === 'signin' ? 'signup' : 'signin')}>
                {mode === 'signin' ? 'Skapa konto' : 'Har redan konto'}
              </button>
              <span className="spacer" />
              <button className="primary" disabled={busy || !validEmail || password.length < 6}>
                {mode === 'signin' ? 'Logga in' : 'Skapa konto'}
              </button>
            </div>
            {mode === 'signin' && (
              <div className="auth-links">
                <button type="button" className="link" onClick={() => go('reset')}>Glömt lösenord?</button>
                <button type="button" className="link" onClick={() => go('code')}>Logga in med e-postkod</button>
              </div>
            )}
          </form>
        )}

        {mode === 'reset' && (
          <form
            className="editor plain"
            onSubmit={(e) => {
              e.preventDefault();
              act(async () => {
                await sync.resetPassword(email.trim());
                return 'Om kontot finns har vi skickat en länk. Öppna den, så kan du välja ett nytt lösenord.';
              });
            }}
          >
            <p className="hint">Vi skickar en länk där du kan välja ett nytt lösenord.</p>
            {emailField}
            <div className="editor-actions">
              <button type="button" className="link" onClick={() => go('signin')}>Tillbaka</button>
              <span className="spacer" />
              <button className="primary" disabled={busy || !validEmail}>Skicka länk</button>
            </div>
          </form>
        )}

        {mode === 'code' && (
          <form
            className="editor plain"
            onSubmit={(e) => { e.preventDefault(); act(async () => { await sync.sendCode(email.trim()); setMode('code-verify'); }); }}
          >
            <p className="hint">Kräver att koden finns med i inloggningsmejlet, se guiden. Annars kan du använda länken i mejlet.</p>
            {emailField}
            <div className="editor-actions">
              <button type="button" className="link" onClick={() => go('signin')}>Tillbaka</button>
              <span className="spacer" />
              <button className="primary" disabled={busy || !validEmail}>Skicka kod</button>
            </div>
          </form>
        )}

        {mode === 'code-verify' && (
          <form className="editor plain" onSubmit={(e) => { e.preventDefault(); act(() => sync.verifyCode(email.trim(), code)); }}>
            <p className="hint">Vi har skickat ett mejl till <strong>{email}</strong>. Skriv in koden, eller öppna länken på den här enheten.</p>
            <label className="field">
              <span>Kod</span>
              <input
                autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={10}
                value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              />
            </label>
            <div className="editor-actions">
              <button type="button" className="link" onClick={() => { go('code'); setCode(''); }}>Byt e-post</button>
              <span className="spacer" />
              <button className="primary" disabled={busy || code.length < 6}>Logga in</button>
            </div>
          </form>
        )}

        {message}
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
      {message}
    </section>
  );
}
