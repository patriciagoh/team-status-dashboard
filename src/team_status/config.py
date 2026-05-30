from __future__ import annotations
from dataclasses import dataclass, field
from pathlib import Path
from typing import Union
import json

DEFAULT_INCIDENT = ["incident", "sev1", "sev2", "sev3", "outage"]
DEFAULT_SUPPORT = ["support", "customer", "escalation"]


@dataclass
class TeamConfig:
    name: str
    linear_team_id: str
    members: Union[str, list[str]] = "auto"   # "auto" or explicit member-id list


@dataclass
class Config:
    teams: list[TeamConfig]
    recently_touched_hours: int = 24
    incident_labels: list[str] = field(default_factory=lambda: list(DEFAULT_INCIDENT))
    support_labels: list[str] = field(default_factory=lambda: list(DEFAULT_SUPPORT))


def load_config(path: Path) -> Config:
    d = json.loads(Path(path).read_text())
    return Config(
        teams=[TeamConfig(**t) for t in d.get("teams", [])],
        recently_touched_hours=d.get("recently_touched_hours", 24),
        incident_labels=d.get("incident_labels", list(DEFAULT_INCIDENT)),
        support_labels=d.get("support_labels", list(DEFAULT_SUPPORT)),
    )
