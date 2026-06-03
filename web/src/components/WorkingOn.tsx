import type { Person } from "../types";

export function WorkingOn({ person }: { person: Person }) {
  const low = person.conf === "low";
  if (low) {
    return (
      <span className="font-serif italic text-[13.5px] leading-[1.35] text-matcha-deep">
        <span className="text-muted italic">~ </span>
        {person.what}
      </span>
    );
  }
  return (
    <span className="font-sans text-[13.5px] leading-[1.35] text-ink">{person.what}</span>
  );
}
