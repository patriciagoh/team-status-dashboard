import { useState } from "react";
import type { Person } from "../types";
import { Avatar } from "./Avatar";
import { CategoryChip } from "./CategoryChip";
import { SinceNote } from "./SinceNote";
import { WorkingOn } from "./WorkingOn";
import { ExpandedPanel } from "./ExpandedPanel";
import { ROSTER_GRID } from "./rosterGrid";

export function PersonRow({ person, idx, last }: { person: Person; idx: number; last: boolean }) {
  const [open, setOpen] = useState(false);
  const panelId = `person-panel-${person.name.replace(/\s+/g, "-").replace(/[^\w-]/g, "")}`;
  return (
    <div className="overflow-hidden" style={{ borderBottom: last && !open ? "none" : "1px solid var(--line)" }}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className={`tsd-row tsd-focus w-full text-left grid ${ROSTER_GRID} items-center px-[16px] py-[11px] cursor-pointer bg-transparent border-0`}
        style={open ? { background: "var(--row-open-bg)" } : undefined}
      >
        <span className="font-mono text-[12.5px] leading-none text-muted tabular-nums">
          {String(idx).padStart(2, "0")}
        </span>
        <span className="flex items-center gap-[10px] min-w-0">
          <Avatar person={person} size={26} />
          <span className="font-serif font-medium text-[15px] leading-[1.1] text-ink whitespace-nowrap">{person.name}</span>
          <span className="font-mono text-[10px] leading-none text-muted">{person.role}</span>
        </span>
        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"><WorkingOn person={person} /></span>
        <span><CategoryChip cat={person.cat} /></span>
        <span className="min-w-0"><SinceNote person={person} /></span>
        <span className="flex items-center justify-end gap-[8px]">
          <span className="font-mono font-bold text-[11px] leading-none text-matcha-deep text-right">{person.ticket || "—"}</span>
          <span className="tsd-arr font-mono text-[13px] leading-none text-matcha-deep shrink-0" aria-hidden="true">{open ? "⌄" : "→"}</span>
        </span>
      </button>
      {open && <ExpandedPanel person={person} id={panelId} />}
    </div>
  );
}
