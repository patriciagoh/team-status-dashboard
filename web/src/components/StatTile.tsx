type Tone = "ink" | "yolk" | "rust";

export function StatTile({ big, label, tone = "ink" }: { big: number; label: string; tone?: Tone }) {
  const color =
    tone === "rust" ? "var(--rust-deep)" : tone === "yolk" ? "var(--yolk-deep)" : "var(--ink)";
  return (
    <div className="flex flex-col gap-[5px]">
      <span className="font-sans font-bold text-[38px] leading-none tracking-[-0.03em]" style={{ color }}>
        {big}
      </span>
      <span className="font-sans font-semibold text-[10.5px] leading-[1.2] tracking-[0.1em] uppercase text-muted">
        {label}
      </span>
    </div>
  );
}
