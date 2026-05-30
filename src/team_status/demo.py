"""Bundled fictional data so the dashboard can be generated with no Linear
credentials and no network — used for the public POC / demo deploy
(`python -m team_status.cli --demo`). All names, emails, and tickets here are
invented; any resemblance to real people or work is coincidental."""
from __future__ import annotations


def _issue(iid, ident, title, assignee, state_type, team_id, team_name,
           cycle_id, created, updated, labels=None, project=None):
    return {
        "id": iid, "identifier": ident, "title": title,
        "createdAt": created, "updatedAt": updated,
        "assignee": {"id": assignee} if assignee else None,
        "state": {"name": state_type.title(), "type": state_type},
        "team": {"id": team_id, "key": team_name[:3].upper(), "name": team_name},
        "cycle": {"id": cycle_id, "startsAt": "2026-05-25T04:00:00.000Z"} if cycle_id else None,
        "labels": {"nodes": [{"name": l} for l in (labels or [])]},
        "project": {"id": "p", "name": project} if project else None,
    }

_TEAM_ID = "demo-team-0001"
_CYCLE_ID = "demo-cycle-24"

_MEMBERS = [
    {"id": "u1", "name": "Alex Rivera", "email": "alex.rivera@example.com", "active": True},
    {"id": "u2", "name": "Sam Okafor", "email": "sam.okafor@example.com", "active": True},
    {"id": "u3", "name": "Jordan Blake", "email": "jordan.blake@example.com", "active": True},
    {"id": "u4", "name": "Morgan Diaz", "email": "morgan.diaz@example.com", "active": True},
    {"id": "u5", "name": "Riley Chen", "email": "riley.chen@example.com", "active": True},
    {"id": "u6", "name": "Casey Lin", "email": "casey.lin@example.com", "active": True},
    {"id": "u7", "name": "Taylor Reed", "email": "taylor.reed@example.com", "active": True},
    {"id": "u8", "name": "Robin Vega", "email": "robin.vega@example.com", "active": True},
]

# A spread across every category so the POC shows the full range.
_ISSUES = [
    _issue("i1", "PLAT-412", "Rich link previews in web messenger", "u1", "started",
           _TEAM_ID, "Platform", _CYCLE_ID, "2026-05-26T10:00:00.000Z", "2026-05-30T12:00:00.000Z",
           labels=["frontend"]),                                              # planned
    _issue("i2", "INC-88", "Outbound webhook retries failing", "u2", "started",
           _TEAM_ID, "Platform", None, "2026-05-30T08:00:00.000Z", "2026-05-30T11:30:00.000Z",
           labels=["incident", "sev2"]),                                      # incident
    _issue("i3", "GROW-201", "Onboarding flow empty-state bug", "u3", "started",
           "other-team-2", "Growth", "growth-cycle-9", "2026-05-28T09:00:00.000Z",
           "2026-05-30T10:15:00.000Z"),                                       # lent to another team
    _issue("i4", "PLAT-377", "Typing indicator flickers on reconnect", "u4", "started",
           _TEAM_ID, "Platform", _CYCLE_ID, "2026-05-25T09:00:00.000Z", "2026-05-30T09:40:00.000Z"),  # planned
    _issue("i5", "SUP-1042", "ACME cannot load conversation history", "u5", "started",
           _TEAM_ID, "Platform", None, "2026-05-29T14:00:00.000Z", "2026-05-30T09:20:00.000Z",
           labels=["support", "customer"]),                                  # support
    _issue("i6", "PLAT-509", "Spike: message reactions data model", "u6", "started",
           _TEAM_ID, "Platform", None, "2026-05-29T13:00:00.000Z", "2026-05-30T08:55:00.000Z"),       # unplanned (not in cycle)
    _issue("i7", "PLAT-420", "Message reactions GA rollout", "u7", "started",
           _TEAM_ID, "Platform", _CYCLE_ID, "2026-05-27T10:00:00.000Z", "2026-05-30T11:00:00.000Z"),  # planned, added mid-sprint
    # u8 (Robin Vega) has nothing active -> "No tracked activity"
]

DEMO_TEAM_DATA = {
    "team": {
        "id": _TEAM_ID,
        "name": "Platform",
        "activeCycle": {"id": _CYCLE_ID, "name": "Sprint 24",
                        "startsAt": "2026-05-25T04:00:00.000Z"},
        "members": {"nodes": _MEMBERS},
    },
    "members": _MEMBERS,
    "issues": _ISSUES,
}


class DemoClient:
    """Drop-in replacement for LinearClient that returns bundled fictional data."""

    def fetch_team_data(self, team_id, recently_touched_hours):
        return DEMO_TEAM_DATA
