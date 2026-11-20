interface Props {
  onSignup: () => void;
  onSignin: () => void;
}

/** Start screen when signed out: the logo between "create account" and "sign in". */
export function Welcome({ onSignup, onSignin }: Props) {
  return (
    <div className="welcome">
      <div className="welcome-row">
        <button className="welcome-btn" onClick={onSignup}>Skapa konto</button>
        <img className="welcome-tapir" src="./logo.svg" alt="Slira" />
        <button className="welcome-btn primary" onClick={onSignin}>Logga in på ditt konto</button>
      </div>
      <p className="welcome-name">Slira</p>
    </div>
  );
}
