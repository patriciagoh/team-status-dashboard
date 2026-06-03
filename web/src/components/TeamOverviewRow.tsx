import type { TeamDerived } from "../roster";
import { SIGNAL_COLOR } from "../categories";

export function TeamOverviewRow({ team, first }: { team: TeamDerived; first: boolean }) {
  return (
    <div className="flex items-center gap-[18px] px-[16px] pt-[15px] pb-[14px] bg-oat"
      style={{ borderTop: first ? "none" : "1px solid var(--line-2)", borderBottom: "1px solid var(--line)" }}>
      <span className="inline-flex items-baseline gap-[9px] whitespace-nowrap">
        <span className="font-sans font-bold text-[12px] leading-none tracking-[0.14em] uppercase text-matcha-deep">{team.name}</span>
        <span className="font-mono text-[11px] leading-none text-muted">{team.headcount}</span>
      </span>
      <div className="flex flex-wrap items-baseline gap-x-[14px] gap-y-[2px]">
        {team.tally.map((t) => (
          <span key={t.key} className="inline-flex items-baseline gap-[5px]">
            <span className="font-mono font-bold text-[13px] leading-none" style={{ color: SIGNAL_COLOR[t.key] ?? "var(--ink-2)" }}>{t.count}</span>
            <span className="font-sans text-[11.5px] leading-none text-muted">{t.label.toLowerCase()}</span>
          </span>
        ))}
      </div>
      <span className="flex-1 min-w-[12px] h-px" style={{ background: "var(--line)" }} aria-hidden="true" />
      <span className="font-mono font-bold text-[11px] leading-none whitespace-nowrap" style={{ color: team.offPlan ? "var(--rust-deep)" : "var(--matcha-deep)" }}>
        {team.offPlan ? `${team.offPlan} off-plan` : "all on plan"}
      </span>
    </div>
  );
}
