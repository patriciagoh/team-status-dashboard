import type { Snapshot } from "../types";

export function Header({ snapshot, total }: { snapshot: Snapshot; total: number }) {
  const day = snapshot.day.split(",")[0];
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
            Snapshot · {day} {snapshot.time}
          </span>
        </span>
        <span className="font-mono text-[12px] leading-none text-muted">
          next refresh {snapshot.next}
        </span>
      </div>
    </header>
  );
}
