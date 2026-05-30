from __future__ import annotations
from pathlib import Path
from typing import Optional
import json
from .models import Member, Issue, Snapshot


def build_snapshot(data: dict, captured_at: str) -> Snapshot:
    team = data["team"]
    cycle = team.get("activeCycle") or {}
    members = [Member(id=m["id"], name=m["name"], email=m.get("email", ""))
               for m in data["members"]]
    issues = []
    for n in data["issues"]:
        assignee = n.get("assignee") or {}
        state = n.get("state") or {}
        itm_team = n.get("team") or {}
        cyc = n.get("cycle") or {}
        proj = n.get("project") or {}
        labels = [l["name"] for l in (n.get("labels") or {}).get("nodes", [])]
        issues.append(Issue(
            id=n["id"], identifier=n["identifier"], title=n["title"],
            assignee_id=assignee.get("id"),
            state_name=state.get("name", ""), state_type=state.get("type", ""),
            team_id=itm_team.get("id", ""), team_key=itm_team.get("key", ""),
            team_name=itm_team.get("name", ""),
            cycle_id=cyc.get("id"), cycle_started_at=cyc.get("startsAt"),
            labels=labels, project_name=proj.get("name"),
            created_at=n["createdAt"], updated_at=n["updatedAt"],
        ))
    return Snapshot(
        team_id=team["id"], team_name=team["name"],
        active_cycle_id=cycle.get("id"), active_cycle_name=cycle.get("name"),
        cycle_started_at=cycle.get("startsAt"),
        captured_at=captured_at, members=members, issues=issues,
    )


def write_snapshot(snap: Snapshot, directory: Path) -> Path:
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    stamp = snap.captured_at.replace(":", "").replace("-", "")[:13]  # YYYYMMDDTHHMM
    path = directory / f"{snap.team_id}-{stamp}.json"
    path.write_text(json.dumps(snap.to_dict(), indent=2))
    return path


def latest_two(directory: Path, team_id: str) -> tuple[Optional[Snapshot], Optional[Snapshot]]:
    directory = Path(directory)
    files = sorted(directory.glob(f"{team_id}-*.json"))
    snaps = [Snapshot.from_dict(json.loads(f.read_text())) for f in files[-2:]]
    if len(snaps) == 0:
        return None, None
    if len(snaps) == 1:
        return None, snaps[0]
    return snaps[0], snaps[1]
