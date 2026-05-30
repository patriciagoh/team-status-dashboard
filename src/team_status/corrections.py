from __future__ import annotations
from pathlib import Path
import json
from .classify import RosterRow, WorkItem, CATEGORIES

# Map a loosely-typed override (e.g. "ad-hoc", "Ad Hoc") to a canonical category.
_CANONICAL = {c.replace("-", "").replace(" ", "").replace("_", ""): c for c in CATEGORIES}


def _normalize_category(value):
    """Return the canonical category for a human-entered override, or None if
    it isn't a recognized category (so a typo can't produce a broken badge)."""
    if not value:
        return None
    key = value.strip().lower().replace("-", "").replace(" ", "").replace("_", "")
    return _CANONICAL.get(key)


def load_corrections(path: Path) -> dict:
    p = Path(path)
    if not p.exists():
        return {}
    return json.loads(p.read_text())


def apply_corrections(rows: list[RosterRow], corrections: dict, date: str) -> None:
    for row in rows:
        entry = corrections.get(row.member_id, {}).get(date)
        if not entry:
            continue
        row.corrected = True
        row.corrected_by = entry.get("author")
        note = entry.get("note")
        override = _normalize_category(entry.get("category_override"))
        if row.primary is None and (override or note):
            row.primary = WorkItem(None, note or "(adjusted)",
                                   override or "adhoc", "low")
        else:
            if override:
                row.primary.why = override
            if note:
                row.primary.tags = list(row.primary.tags) + [note]
