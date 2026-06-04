// web/src/Root.tsx
import { useEffect, useState } from "react";
import type { AuthPort, Session } from "./auth/AuthPort";
import App from "./App";
import { Login } from "./components/Login";

export function Root({ authPort }: { authPort: AuthPort | null }) {
  if (!authPort) return <App />; // demo: no gate
  return <AuthGate authPort={authPort} />;
}

function AuthGate({ authPort }: { authPort: AuthPort }) {
  // undefined = still resolving the initial session
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    let settled = false; // onAuthChange is authoritative — once it fires, the getSession seed must not clobber it
    authPort.getSession().then((s) => { if (active && !settled) setSession(s); });
    const unsub = authPort.onAuthChange((s) => { settled = true; if (active) setSession(s); });
    return () => { active = false; unsub(); };
  }, [authPort]);

  if (session === undefined) {
    return <div className="p-[38px_48px_44px] font-mono text-[12px] text-muted">Loading…</div>;
  }
  if (session === null) {
    return <Login authPort={authPort} />;
  }
  return <App onSignOut={() => { void authPort.signOut(); }} editable />;
}
