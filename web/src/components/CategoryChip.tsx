import type { Category } from "../types";
import { CATEGORIES } from "../categories";

export function CategoryChip({ cat }: { cat: Category }) {
  return (
    <span className="tsd-chip" data-cat={cat}>
      <span
        aria-hidden="true"
        className="inline-block w-[7px] h-[7px] rounded-full shrink-0"
        style={{ background: `var(--dot-${cat})` }}
      />
      {CATEGORIES[cat].label}
    </span>
  );
}
