from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional
from .models import Snapshot, Issue
from .config import Config

CATEGORIES = ["planned", "unplanned", "lent", "incident", "support", "adhoc", "none"]


@dataclass
class WorkItem:
    issue_identifier: Optional[str]
    title: str
    why: str
    confidence: str               # "high" | "low"
    tags: list[str] = field(default_factory=list)


@dataclass
class RosterRow:
    member_id: str
    member_name: str
    primary: Optional[WorkItem]
    others: list[WorkItem] = field(default_factory=list)
    corrected: bool = False
    corrected_by: Optional[str] = None


def _parse(ts: str) -> datetime:
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


def _has_label(issue: Issue, needles: list[str]) -> bool:
    hay = [l.lower() for l in issue.labels]
    if issue.project_name:
        hay.append(issue.project_name.lower())
    return any(n.lower() in h for h in hay for n in needles)


def _why(issue: Issue, snap: Snapshot, cfg: Config) -> tuple[str, list[str]]:
    tags: list[str] = []
    if _has_label(issue, cfg.incident_labels):
        return "incident", tags
    if _has_label(issue, cfg.support_labels):
        return "support", tags
    if issue.team_id != snap.team_id:
        return "lent", tags
    if snap.active_cycle_id and issue.cycle_id == snap.active_cycle_id:
        if snap.cycle_started_at and _parse(issue.created_at) > _parse(snap.cycle_started_at):
            tags.append("added mid-sprint")
        return "planned", tags
    return "unplanned", tags


def _is_now(issue: Issue, cutoff: datetime) -> bool:
    return issue.state_type == "started" or _parse(issue.updated_at) >= cutoff


def classify(snap: Snapshot, cfg: Config, now: str) -> list[RosterRow]:
    cutoff = _parse(now) - timedelta(hours=cfg.recently_touched_hours)
    by_member: dict[str, list[Issue]] = {m.id: [] for m in snap.members}
    for issue in snap.issues:
        if issue.assignee_id in by_member and _is_now(issue, cutoff):
            by_member[issue.assignee_id].append(issue)

    rows: list[RosterRow] = []
    for m in snap.members:
        issues = by_member[m.id]
        issues.sort(key=lambda i: (i.state_type != "started",
                                    -_parse(i.updated_at).timestamp()))
        items: list[WorkItem] = []
        for i in issues:
            why, tags = _why(i, snap, cfg)
            confidence = "high" if i.state_type == "started" else "low"
            items.append(WorkItem(i.identifier, i.title, why, confidence, tags))
        rows.append(RosterRow(
            member_id=m.id, member_name=m.name,
            primary=items[0] if items else None,
            others=items[1:],
        ))
    return rows
