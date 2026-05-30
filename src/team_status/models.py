from __future__ import annotations
from dataclasses import dataclass, asdict
from typing import Optional


@dataclass
class Member:
    id: str
    name: str
    email: str


@dataclass
class Issue:
    id: str
    identifier: str
    title: str
    assignee_id: Optional[str]
    state_name: str
    state_type: str          # backlog|unstarted|started|completed|canceled
    team_id: str
    team_key: str
    team_name: str
    cycle_id: Optional[str]
    cycle_started_at: Optional[str]
    labels: list[str]
    project_name: Optional[str]
    created_at: str
    updated_at: str


@dataclass
class Snapshot:
    team_id: str
    team_name: str
    active_cycle_id: Optional[str]
    active_cycle_name: Optional[str]
    cycle_started_at: Optional[str]
    captured_at: str
    members: list[Member]
    issues: list[Issue]
    slack_connected: bool = False

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "Snapshot":
        return cls(
            team_id=d["team_id"],
            team_name=d["team_name"],
            active_cycle_id=d.get("active_cycle_id"),
            active_cycle_name=d.get("active_cycle_name"),
            cycle_started_at=d.get("cycle_started_at"),
            captured_at=d["captured_at"],
            members=[Member(**m) for m in d["members"]],
            issues=[Issue(**i) for i in d["issues"]],
            slack_connected=d.get("slack_connected", False),
        )
