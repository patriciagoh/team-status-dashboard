// web/src/components/Login.tsx
import { useState, type FormEvent } from "react";
import type { AuthPort } from "../auth/AuthPort";

const fieldClass =
  "font-mono text-[13px] text-ink px-[12px] py-[9px] rounded-[8px] border border-line-2 bg-transparent";

export function Login({ authPort }: { authPort: AuthPort }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await authPort.signIn(email, password);
    } catch {
      setError("Sign-in failed. Check your email and password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-[24px]">
      <form
        onSubmit={onSubmit}
        aria-labelledby="login-title"
        className="w-full max-w-[360px] flex flex-col gap-[18px] p-[32px] rounded-[14px] border border-line-2"
      >
        <h1 id="login-title" className="font-serif font-normal text-[24px] leading-none tracking-[-0.02em] text-ink m-0">
          Sign in
        </h1>
        <label className="flex flex-col gap-[6px] font-mono text-[12px] text-ink-2">
          Email
          <input
            type="email" name="email" autoComplete="username" required
            value={email} onChange={(e) => setEmail(e.target.value)}
            className={fieldClass} style={{ outlineColor: "var(--focus)" }}
          />
        </label>
        <label className="flex flex-col gap-[6px] font-mono text-[12px] text-ink-2">
          Password
          <input
            type="password" name="password" autoComplete="current-password" required
            value={password} onChange={(e) => setPassword(e.target.value)}
            className={fieldClass} style={{ outlineColor: "var(--focus)" }}
          />
        </label>
        {error && (
          <p role="alert" className="font-mono text-[12px] m-0" style={{ color: "var(--rust-deep)" }}>
            {error}
          </p>
        )}
        <button
          type="submit" disabled={busy}
          className="font-sans font-semibold text-[13px] px-[16px] py-[10px] rounded-[8px] border-0 cursor-pointer disabled:opacity-60"
          style={{ background: "var(--matcha)", color: "var(--paper)" }}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
