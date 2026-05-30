from __future__ import annotations
from dataclasses import dataclass
from typing import Optional
from .classify import RosterRow

OFF_PLAN = {"unplanned", "lent", "incident", "support", "adhoc"}


@dataclass
class ChangeNote:
    kind: str          # baseline|no_change|switched|recategorized|back_on_plan|appeared|wrapped
    text: str


def _ident(row: RosterRow) -> Optional[str]:
    return row.primary.issue_identifier if row.primary else None


def _why(row: RosterRow) -> str:
    return row.primary.why if row.primary else "none"


def diff_rows(prev: Optional[list[RosterRow]], curr: list[RosterRow]):
    if prev is None:
        notes = {r.member_id: ChangeNote("baseline", "baseline — first look")
                 for r in curr}
        return notes, "Baseline — first look at this team."

    prev_by = {r.member_id: r for r in prev}
    notes: dict[str, ChangeNote] = {}
    moved = 0
    total = len(curr)

    for row in curr:
        p = prev_by.get(row.member_id)
        if p is None:
            notes[row.member_id] = ChangeNote("baseline", "baseline — first look")
            continue
        pi, ci = _ident(p), _ident(row)
        pw, cw = _why(p), _why(row)

        p_has_item = p.primary is not None
        c_has_item = row.primary is not None

        if not c_has_item and not p_has_item:
            notes[row.member_id] = ChangeNote("no_change", "no change")
        elif not c_has_item and p_has_item:
            notes[row.member_id] = ChangeNote("wrapped", "→ wrapped up")
        elif not p_has_item and c_has_item:
            if cw == "adhoc":
                notes[row.member_id] = ChangeNote("appeared", "▲ new, no ticket")
            else:
                notes[row.member_id] = ChangeNote("appeared", f"▲ started {ci}")
        elif ci == pi and cw == pw:
            notes[row.member_id] = ChangeNote("no_change", "no change")
        elif ci == pi and cw != pw:
            notes[row.member_id] = ChangeNote("recategorized", f"▲ now {cw.capitalize()}")
        else:  # different item
            if pw in OFF_PLAN and cw == "planned":
                notes[row.member_id] = ChangeNote("back_on_plan", "→ back on plan")
            elif cw == "adhoc":
                notes[row.member_id] = ChangeNote("appeared", "▲ new, no ticket")
            else:
                notes[row.member_id] = ChangeNote("switched", f"▲ was {pi}")

        if cw in OFF_PLAN and (pw != cw or ci != pi) and notes[row.member_id].kind != "no_change":
            if not (pw in OFF_PLAN and cw in OFF_PLAN and pi == ci):
                moved += 1

    summary = f"{moved} of {total} moved off-plan since the last snapshot."
    return notes, summary
