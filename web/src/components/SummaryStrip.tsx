import type { Derived } from "../roster";
import { StatTile } from "./StatTile";
import { EffortBreakdown } from "./EffortBreakdown";

export function SummaryStrip({ d }: { d: Derived }) {
  return (
    <section aria-label="Team summary" className="mt-[26px] grid grid-cols-[auto_1fr] gap-[32px] items-center">
      <div className="flex gap-[34px] pr-[34px] border-r border-line-2">
        <StatTile big={d.onPlan} label="on plan" />
        <StatTile big={d.counts.unplanned} label="off plan" tone="yolk" />
        <StatTile big={d.firefighting} label="firefighting" tone="rust" />
        <StatTile big={d.changed} label="changed" />
      </div>
      <EffortBreakdown d={d} />
    </section>
  );
}
