import type { Person } from "../types";

export function ExpandedPanel({ person }: { person: Person }) {
  const first = person.name.split(" ")[0];
  return (
    <div className="px-[14px] pt-[4px] pb-[18px] pl-[52px] bg-oat">
      <div className="grid grid-cols-2 gap-[24px] bg-paper border border-line rounded-sm px-[18px] py-[15px]">
        <div>
          <div className="font-sans font-semibold text-[10px] leading-none tracking-[0.13em] uppercase text-muted mb-[10px]">
            Open items
          </div>
          <div className="flex flex-col gap-[7px]">
            {person.detail.tickets.map((t) => (
              <div key={t} className="flex items-center gap-[9px]">
                <span className="w-[4px] h-[4px] rounded-full shrink-0" style={{ background: "var(--matcha)" }} aria-hidden="true" />
                <span className="font-mono text-[13px] leading-[1.4] text-ink-2">{t}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="rounded-sm px-[16px] py-[13px]" style={{ background: "var(--yolk-tint)", border: "1px solid var(--cat-unplanned-border)" }}>
            <div className="font-sans font-bold text-[10.5px] leading-none tracking-[0.16em] uppercase text-yolk-deep mb-[8px]">
              Why
            </div>
            <div className="font-sans text-[14.5px] leading-[1.55] text-yolk-tint-text">{person.detail.note}</div>
          </div>
          {person.conf === "low" && (
            <div className="mt-[12px]">
              <span className="inline-block font-sans font-semibold text-[10px] leading-none tracking-[0.08em] uppercase text-muted border border-dashed border-line-2 rounded-pill px-[8px] py-[3px] whitespace-nowrap">
                inferred · low confidence
              </span>
            </div>
          )}
          {/* Display-only per spec — write-back wiring is a deferred phase. No onClick intentionally; the button stays a visible, focusable affordance. */}
          <button type="button" className="tsd-focus mt-[14px] font-sans font-semibold text-[12px] leading-none text-matcha-deep bg-transparent border-none p-0 cursor-pointer inline-flex items-center gap-[5px]">
            Correct {first}'s row
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
