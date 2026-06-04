import type { Snapshot } from "../types";

export function Header({ snapshot, total, onSignOut }: { snapshot: Snapshot; total: number; onSignOut?: () => void }) {
  const synced = snapshot.day.trim();
  return (
    <header className="flex justify-between items-center">
      <div className="flex items-baseline gap-[12px]">
        <h1 className="font-serif font-normal text-[26px] leading-none tracking-[-0.02em] text-ink m-0 whitespace-nowrap">
          Team status
        </h1>
        <span className="font-mono text-[12px] leading-none text-muted">
          / engineering · {total} people
        </span>
      </div>
      <div className="flex items-center gap-[14px] flex-wrap">
        <span className="inline-flex items-center gap-[7px]">
          <span className="tsd-pulse w-[7px] h-[7px] rounded-full" style={{ background: "var(--matcha)" }} aria-hidden="true" />
          <span className="font-mono font-bold text-[12px] leading-none text-ink-2">
            {synced ? `Synced · ${synced}` : "Not yet synced"}
          </span>
        </span>
        {onSignOut && (
          <button type="button" onClick={onSignOut}
            className="font-mono text-[12px] leading-none text-muted hover:text-ink-2 underline underline-offset-2 border-0 bg-transparent cursor-pointer p-0"
            style={{ outlineColor: "var(--focus)" }}>
            Sign out
          </button>
        )}
      </div>
    </header>
  );
}
