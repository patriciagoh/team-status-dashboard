import type { Person } from "../types";

export function SinceNote({ person }: { person: Person }) {
  if (!person.since) {
    return <span className="font-mono text-[11px] leading-none text-muted">no change</span>;
  }
  const isNew = /new this snapshot/i.test(person.since);
  return (
    <span className="inline-flex items-center gap-[6px] font-mono font-bold text-[11px] leading-[1.4] text-ink-2">
      <span
        className="w-[5px] h-[5px] rounded-full shrink-0"
        style={{ background: isNew ? "var(--matcha)" : "var(--yolk)" }}
      />
      {person.since}
    </span>
  );
}
