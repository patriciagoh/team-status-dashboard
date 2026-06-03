import { CATEGORIES, SIGNAL_COLOR } from "../categories";
import type { Derived } from "../roster";

export function EffortBreakdown({ d }: { d: Derived }) {
  return (
    <div>
      <div className="font-sans font-semibold text-[10px] leading-none tracking-[0.13em] uppercase text-muted mb-[12px]">
        Where the effort is going
      </div>
      <div className="flex flex-wrap border-t border-b border-line">
        {d.catOrder.map((k) => {
          const n = d.counts[k];
          if (!n) return null;
          const color = SIGNAL_COLOR[k] ?? "var(--ink)";
          const pct = Math.round((n / d.total) * 100);
          return (
            <div key={k} className="flex flex-col gap-[7px] pr-[22px] py-[13px] mr-[22px] border-r border-line last:border-r-0 last:mr-0 last:pr-0">
              <span className="flex items-baseline gap-[6px]">
                <span className="font-sans font-bold text-[24px] leading-none tracking-[-0.03em]" style={{ color }}>{n}</span>
                <span className="font-mono text-[11px] leading-none text-muted">{pct}%</span>
              </span>
              <span className="font-sans font-semibold text-[10.5px] leading-none tracking-[0.1em] uppercase text-muted">
                {CATEGORIES[k].label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
