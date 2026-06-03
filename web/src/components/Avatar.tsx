import type { Person } from "../types";

export function Avatar({ person, size = 26 }: { person: Person; size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full shrink-0 bg-paper text-ink-2 font-mono font-bold tracking-[0.02em]"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        border: `1.5px solid var(--dot-${person.cat})`,
        fontSize: `${Math.round(size * 0.33)}px`,
        lineHeight: 1,
      }}
    >
      {person.initials}
    </span>
  );
}
