# Team Status Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Linear-fed dashboard that, twice a day, shows what every Platform engineer is working on, why (planned / unplanned / incident / support / lent-out / ad-hoc), and how it changed since the last snapshot — as a single self-contained HTML roster.

**Architecture:** A Python pull engine authenticates to Linear's GraphQL API with a personal API key, builds an immutable snapshot per run, and writes it to disk. Pure functions classify each snapshot into a roster and diff it against the previous snapshot. A renderer bakes the result into a self-contained `dashboard.html`. A corrections overlay and a Slack enrichment layer (gated on a token) sit on top. Scheduling is via macOS `launchd`.

**Tech Stack:** Python 3.11+, `httpx` (Linear GraphQL), `jinja2` (HTML render), `pytest` (tests). No web server in v1.

---

## File Structure

```
team-status-dashboard/
├── pyproject.toml                      # package + deps + pytest config
├── config.json                         # teams, label sets, recency window
├── src/team_status/
│   ├── __init__.py
│   ├── models.py                       # dataclasses + JSON (de)serialization
│   ├── config.py                       # load config.json with defaults
│   ├── classify.py                     # PURE: Snapshot -> list[RosterRow]
│   ├── diff.py                         # PURE: (prev, curr) -> diffs + summary
│   ├── corrections.py                  # load + apply corrections overlay
│   ├── linear_client.py                # I/O: Linear GraphQL queries
│   ├── snapshot.py                     # build Snapshot from client; read/write files
│   ├── render.py                       # roster -> dashboard.html (jinja2)
│   ├── slack_client.py                 # I/O: Slack channel history (gated)
│   ├── cli.py                          # orchestrates one pull run
│   └── templates/
│       └── dashboard.html.j2
├── tests/
│   ├── fixtures/
│   │   └── linear_graphql_response.json
│   ├── test_models.py
│   ├── test_config.py
│   ├── test_classify.py
│   ├── test_diff.py
│   ├── test_corrections.py
│   ├── test_linear_client.py
│   ├── test_render.py
│   └── test_cli.py
├── scripts/
│   ├── com.ada.teamstatus.plist        # launchd template
│   └── setup-schedule.sh
└── snapshots/                          # gitignored, created at runtime
```

**Responsibilities:** `models` is the shared data contract (no logic). `classify`/`diff`/`corrections` are pure logic (no I/O) — the testable core. `linear_client`/`slack_client`/`snapshot` isolate all network + file I/O. `render` is presentation only. `cli` is the only place that wires I/O to logic.

---

## Task 1: Project scaffold

**Files:**
- Create: `pyproject.toml`
- Create: `src/team_status/__init__.py`
- Create: `tests/__init__.py`

- [ ] **Step 1: Create `pyproject.toml`**

```toml
[project]
name = "team-status"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = ["httpx>=0.27", "jinja2>=3.1"]

[project.optional-dependencies]
dev = ["pytest>=8.0"]

[build-system]
requires = ["setuptools>=68"]
build-backend = "setuptools.build_meta"

[tool.setuptools.packages.find]
where = ["src"]

[tool.setuptools.package-data]
team_status = ["templates/*.j2"]

[tool.pytest.ini_options]
pythonpath = ["src"]
testpaths = ["tests"]
```

- [ ] **Step 2: Create empty package files**

Create `src/team_status/__init__.py` (empty) and `tests/__init__.py` (empty).

- [ ] **Step 3: Create venv and install**

Run:
```bash
cd /Users/patricia/team-status-dashboard
python3 -m venv .venv && .venv/bin/pip install -q -e ".[dev]"
```
Expected: installs httpx, jinja2, pytest with no errors.

- [ ] **Step 4: Verify pytest runs (no tests yet)**

Run: `.venv/bin/pytest -q`
Expected: "no tests ran" (exit code 5) — confirms discovery works.

- [ ] **Step 5: Commit**

```bash
git add pyproject.toml src tests
git commit -m "chore: scaffold team-status package"
```

---

## Task 2: Data models

**Files:**
- Create: `src/team_status/models.py`
- Test: `tests/test_models.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_models.py
from team_status.models import Member, Issue, Snapshot


def _issue(**kw):
    base = dict(
        id="i1", identifier="MEX-412", title="Rich link previews",
        assignee_id="m1", state_name="In Progress", state_type="started",
        team_id="t1", team_key="MEX", team_name="Platform",
        cycle_id="c1", cycle_started_at="2026-05-25T04:00:00Z",
        labels=["frontend"], project_name=None,
        created_at="2026-05-26T10:00:00Z", updated_at="2026-05-29T12:00:00Z",
    )
    base.update(kw)
    return Issue(**base)


def test_snapshot_roundtrips_through_dict():
    snap = Snapshot(
        team_id="t1", team_name="Platform",
        active_cycle_id="c1", active_cycle_name="Q2 - Sprint 3",
        cycle_started_at="2026-05-25T04:00:00Z",
        captured_at="2026-05-29T13:00:00Z",
        members=[Member(id="m1", name="Alex Rivera", email="alex.rivera@example.com")],
        issues=[_issue()],
        slack_connected=False,
    )
    restored = Snapshot.from_dict(snap.to_dict())
    assert restored == snap
    assert restored.issues[0].identifier == "MEX-412"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/pytest tests/test_models.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'team_status.models'`.

- [ ] **Step 3: Write minimal implementation**

```python
# src/team_status/models.py
from __future__ import annotations
from dataclasses import dataclass, asdict, field
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/pytest tests/test_models.py -q`
Expected: PASS (1 passed).

- [ ] **Step 5: Commit**

```bash
git add src/team_status/models.py tests/test_models.py
git commit -m "feat: add core data models with JSON round-trip"
```

---

## Task 3: Config loader

**Files:**
- Create: `src/team_status/config.py`
- Create: `config.json`
- Test: `tests/test_config.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_config.py
import json
from team_status.config import load_config, Config


def test_load_config_applies_defaults(tmp_path):
    p = tmp_path / "config.json"
    p.write_text(json.dumps({
        "teams": [{"name": "Platform",
                   "linear_team_id": "demo-team-0001", "members": "auto"}]
    }))
    cfg = load_config(p)
    assert isinstance(cfg, Config)
    assert cfg.teams[0].name == "Platform"
    assert cfg.recently_touched_hours == 24          # default
    assert "incident" in cfg.incident_labels         # default
    assert "support" in cfg.support_labels           # default


def test_explicit_values_override_defaults(tmp_path):
    p = tmp_path / "config.json"
    p.write_text(json.dumps({
        "teams": [], "recently_touched_hours": 12,
        "incident_labels": ["sev1"], "support_labels": ["cust"]
    }))
    cfg = load_config(p)
    assert cfg.recently_touched_hours == 12
    assert cfg.incident_labels == ["sev1"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/pytest tests/test_config.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'team_status.config'`.

- [ ] **Step 3: Write minimal implementation**

```python
# src/team_status/config.py
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/pytest tests/test_config.py -q`
Expected: PASS (2 passed).

- [ ] **Step 5: Create the real `config.json`**

```json
{
  "teams": [
    {
      "name": "Platform",
      "linear_team_id": "demo-team-0001",
      "members": "auto"
    }
  ],
  "recently_touched_hours": 24,
  "incident_labels": ["incident", "sev1", "sev2", "sev3", "outage"],
  "support_labels": ["support", "customer", "escalation"]
}
```

- [ ] **Step 6: Commit**

```bash
git add src/team_status/config.py tests/test_config.py config.json
git commit -m "feat: add config loader with sensible defaults"
```

---

## Task 4: Classifier (pure logic)

**Files:**
- Create: `src/team_status/classify.py`
- Test: `tests/test_classify.py`

This is the core. Categories: `planned`, `unplanned`, `lent`, `incident`, `support`, `adhoc`, `none`.

- [ ] **Step 1: Write the failing test (output types + planned/incident/lent/recency)**

```python
# tests/test_classify.py
from team_status.models import Member, Issue, Snapshot
from team_status.config import Config, TeamConfig
from team_status.classify import classify, RosterRow, WorkItem

CFG = Config(teams=[TeamConfig("MEX", "t1", "auto")])
CYCLE_START = "2026-05-25T04:00:00Z"


def _snap(issues, members=None):
    return Snapshot(
        team_id="t1", team_name="MEX", active_cycle_id="c1",
        active_cycle_name="Q2 - Sprint 3", cycle_started_at=CYCLE_START,
        captured_at="2026-05-29T13:00:00Z",
        members=members or [Member("m1", "Alex Rivera", "jp@example.com")],
        issues=issues,
    )


def _issue(**kw):
    base = dict(
        id="i", identifier="MEX-1", title="t", assignee_id="m1",
        state_name="In Progress", state_type="started",
        team_id="t1", team_key="MEX", team_name="MEX",
        cycle_id="c1", cycle_started_at=CYCLE_START,
        labels=[], project_name=None,
        created_at="2026-05-26T10:00:00Z", updated_at="2026-05-29T12:00:00Z",
    )
    base.update(kw)
    return Issue(**base)


def test_in_cycle_started_issue_is_planned_high_confidence():
    rows = classify(_snap([_issue()]), CFG, now="2026-05-29T13:00:00Z")
    assert len(rows) == 1
    row = rows[0]
    assert row.member_id == "m1"
    assert row.primary.why == "planned"
    assert row.primary.confidence == "high"
    assert row.primary.issue_identifier == "MEX-1"


def test_incident_label_overrides_cycle():
    rows = classify(_snap([_issue(labels=["Incident"])]), CFG, now="2026-05-29T13:00:00Z")
    assert rows[0].primary.why == "incident"


def test_support_label_is_support():
    rows = classify(_snap([_issue(labels=["customer-escalation"])]), CFG, now="2026-05-29T13:00:00Z")
    assert rows[0].primary.why == "support"


def test_issue_on_other_team_is_lent():
    rows = classify(_snap([_issue(team_id="OTHER", cycle_id=None)]), CFG, now="2026-05-29T13:00:00Z")
    assert rows[0].primary.why == "lent"


def test_assigned_not_in_cycle_is_unplanned():
    rows = classify(_snap([_issue(cycle_id=None)]), CFG, now="2026-05-29T13:00:00Z")
    assert rows[0].primary.why == "unplanned"


def test_added_after_cycle_start_gets_mid_sprint_tag():
    rows = classify(_snap([_issue(created_at="2026-05-27T10:00:00Z")]), CFG, now="2026-05-29T13:00:00Z")
    assert "added mid-sprint" in rows[0].primary.tags


def test_recency_only_item_is_low_confidence():
    # not started, but updated within window
    rows = classify(
        _snap([_issue(state_type="unstarted", state_name="Todo",
                      updated_at="2026-05-29T12:30:00Z")]),
        CFG, now="2026-05-29T13:00:00Z",
    )
    assert rows[0].primary.confidence == "low"


def test_no_activity_member_has_none_primary():
    rows = classify(_snap([], members=[Member("m9", "Idle", "i@example.com")]),
                    CFG, now="2026-05-29T13:00:00Z")
    assert rows[0].primary is None


def test_old_untouched_unstarted_issue_is_excluded():
    rows = classify(
        _snap([_issue(state_type="unstarted", state_name="Todo",
                      updated_at="2026-05-01T00:00:00Z")]),
        CFG, now="2026-05-29T13:00:00Z",
    )
    assert rows[0].primary is None


def test_started_issue_ordered_before_recency_only():
    started = _issue(id="a", identifier="MEX-A", updated_at="2026-05-29T09:00:00Z")
    touched = _issue(id="b", identifier="MEX-B", state_type="unstarted",
                     state_name="Todo", updated_at="2026-05-29T12:55:00Z")
    rows = classify(_snap([touched, started]), CFG, now="2026-05-29T13:00:00Z")
    assert rows[0].primary.issue_identifier == "MEX-A"
    assert rows[0].others[0].issue_identifier == "MEX-B"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/pytest tests/test_classify.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'team_status.classify'`.

- [ ] **Step 3: Write minimal implementation**

```python
# src/team_status/classify.py
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
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
        # started first, then most-recently-updated
        issues.sort(key=lambda i: (i.state_type != "started", ), reverse=False)
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/pytest tests/test_classify.py -q`
Expected: PASS (10 passed).

- [ ] **Step 5: Commit**

```bash
git add src/team_status/classify.py tests/test_classify.py
git commit -m "feat: add pure classifier with category priority + confidence"
```

---

## Task 5: Diff (pure logic)

**Files:**
- Create: `src/team_status/diff.py`
- Test: `tests/test_diff.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_diff.py
from team_status.classify import RosterRow, WorkItem
from team_status.diff import diff_rows, ChangeNote

OFF_PLAN = {"unplanned", "lent", "incident", "support", "adhoc"}


def _row(mid, ident, why):
    item = WorkItem(ident, "t", why, "high") if ident or why != "none" else None
    if why == "none":
        item = None
    return RosterRow(member_id=mid, member_name=mid, primary=item)


def test_no_previous_snapshot_is_baseline():
    curr = [_row("m1", "MEX-1", "planned")]
    notes, summary = diff_rows(None, curr)
    assert notes["m1"].kind == "baseline"
    assert "first look" in summary.lower()


def test_same_item_same_why_is_no_change():
    prev = [_row("m1", "MEX-1", "planned")]
    curr = [_row("m1", "MEX-1", "planned")]
    notes, _ = diff_rows(prev, curr)
    assert notes["m1"].kind == "no_change"


def test_switched_item_reports_previous():
    prev = [_row("m1", "MEX-377", "planned")]
    curr = [_row("m1", "MEX-412", "planned")]
    notes, _ = diff_rows(prev, curr)
    assert notes["m1"].kind == "switched"
    assert "MEX-377" in notes["m1"].text


def test_category_change_same_item():
    prev = [_row("m1", "MEX-1", "planned")]
    curr = [_row("m1", "MEX-1", "incident")]
    notes, _ = diff_rows(prev, curr)
    assert notes["m1"].kind == "recategorized"
    assert "incident" in notes["m1"].text.lower()


def test_returned_to_plan():
    prev = [_row("m1", "INC-9", "incident")]
    curr = [_row("m1", "MEX-1", "planned")]
    notes, _ = diff_rows(prev, curr)
    assert notes["m1"].kind == "back_on_plan"


def test_appeared_adhoc_no_ticket():
    prev = [_row("m1", None, "none")]
    curr = [RosterRow("m1", "m1", WorkItem(None, "CI flakiness", "adhoc", "low"))]
    notes, _ = diff_rows(prev, curr)
    assert notes["m1"].kind == "appeared"
    assert "no ticket" in notes["m1"].text.lower()


def test_summary_counts_moves_off_plan():
    prev = [_row("m1", "MEX-1", "planned"), _row("m2", "MEX-2", "planned")]
    curr = [_row("m1", "INC-9", "incident"), _row("m2", "MEX-2", "planned")]
    _, summary = diff_rows(prev, curr)
    assert "1 of 2" in summary
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/pytest tests/test_diff.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'team_status.diff'`.

- [ ] **Step 3: Write minimal implementation**

```python
# src/team_status/diff.py
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

        if ci is None and pi is None:
            notes[row.member_id] = ChangeNote("no_change", "no change")
        elif ci is None and pi is not None:
            notes[row.member_id] = ChangeNote("wrapped", "→ wrapped up")
        elif pi is None and ci is not None:
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

        # count a move onto off-plan work since last snapshot
        if cw in OFF_PLAN and (pw != cw or ci != pi) and notes[row.member_id].kind != "no_change":
            if not (pw in OFF_PLAN and cw in OFF_PLAN and pi == ci):
                moved += 1

    summary = f"{moved} of {total} moved off-plan since the last snapshot."
    return notes, summary
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/pytest tests/test_diff.py -q`
Expected: PASS (7 passed).

- [ ] **Step 5: Commit**

```bash
git add src/team_status/diff.py tests/test_diff.py
git commit -m "feat: add pure rolling diff with off-plan summary"
```

---

## Task 6: Corrections overlay

**Files:**
- Create: `src/team_status/corrections.py`
- Test: `tests/test_corrections.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_corrections.py
import json
from team_status.classify import RosterRow, WorkItem
from team_status.corrections import load_corrections, apply_corrections


def test_missing_file_returns_empty(tmp_path):
    assert load_corrections(tmp_path / "nope.json") == {}


def test_override_category_and_note(tmp_path):
    p = tmp_path / "corrections.json"
    p.write_text(json.dumps({
        "m1": {"2026-05-29": {
            "category_override": "adhoc",
            "note": "Pulled into Growth bug, no ticket",
            "author": "shola@example.com",
            "at": "2026-05-29T15:12:00Z"}}}))
    corr = load_corrections(p)
    rows = [RosterRow("m1", "Shola", WorkItem("MEX-1", "t", "planned", "high"))]
    apply_corrections(rows, corr, date="2026-05-29")
    assert rows[0].primary.why == "adhoc"
    assert rows[0].corrected is True
    assert rows[0].corrected_by == "shola@example.com"
    assert "Growth" in rows[0].primary.title or rows[0].primary.tags


def test_correction_for_other_date_is_ignored(tmp_path):
    p = tmp_path / "corrections.json"
    p.write_text(json.dumps({
        "m1": {"2026-05-28": {"category_override": "adhoc",
                              "author": "x", "at": "x"}}}))
    corr = load_corrections(p)
    rows = [RosterRow("m1", "Shola", WorkItem("MEX-1", "t", "planned", "high"))]
    apply_corrections(rows, corr, date="2026-05-29")
    assert rows[0].primary.why == "planned"
    assert rows[0].corrected is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/pytest tests/test_corrections.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'team_status.corrections'`.

- [ ] **Step 3: Write minimal implementation**

```python
# src/team_status/corrections.py
from __future__ import annotations
from pathlib import Path
import json
from .classify import RosterRow, WorkItem


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
        override = entry.get("category_override")
        if row.primary is None and (override or note):
            row.primary = WorkItem(None, note or "(adjusted)",
                                   override or "adhoc", "low")
        else:
            if override:
                row.primary.why = override
            if note:
                row.primary.tags = list(row.primary.tags) + [note]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/pytest tests/test_corrections.py -q`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add src/team_status/corrections.py tests/test_corrections.py
git commit -m "feat: add corrections overlay keyed by member+date"
```

---

## Task 7: Linear client + snapshot builder

**Files:**
- Create: `src/team_status/linear_client.py`
- Create: `src/team_status/snapshot.py`
- Create: `tests/fixtures/linear_graphql_response.json`
- Test: `tests/test_linear_client.py`

The Linear GraphQL endpoint is `https://api.linear.app/graphql`. A personal API key is sent in the `Authorization` header **verbatim** (no `Bearer` prefix). The client must be injectable so tests use a fake transport (no live calls).

- [ ] **Step 1: Create the fixture**

```json
// tests/fixtures/linear_graphql_response.json
{
  "data": {
    "team": {
      "id": "t1",
      "name": "Platform",
      "activeCycle": {"id": "c1", "name": "Q2 - Sprint 3", "startsAt": "2026-05-25T04:00:00.000Z"},
      "members": {"nodes": [
        {"id": "m1", "name": "Alex Rivera", "email": "alex.rivera@example.com", "active": true},
        {"id": "m2", "name": "Sam Okafor", "email": "sam.okafor@example.com", "active": true}
      ]}
    },
    "issues": {"nodes": [
      {"id": "i1", "identifier": "MEX-412", "title": "Rich link previews",
       "createdAt": "2026-05-26T10:00:00.000Z", "updatedAt": "2026-05-29T12:00:00.000Z",
       "assignee": {"id": "m1"}, "state": {"name": "In Progress", "type": "started"},
       "team": {"id": "t1", "key": "MEX", "name": "Platform"},
       "cycle": {"id": "c1", "startsAt": "2026-05-25T04:00:00.000Z"},
       "labels": {"nodes": [{"name": "frontend"}]}, "project": null},
      {"id": "i2", "identifier": "INC-88", "title": "Webhook retries failing",
       "createdAt": "2026-05-29T08:00:00.000Z", "updatedAt": "2026-05-29T11:30:00.000Z",
       "assignee": {"id": "m2"}, "state": {"name": "In Progress", "type": "started"},
       "team": {"id": "t1", "key": "MEX", "name": "Platform"},
       "cycle": null, "labels": {"nodes": [{"name": "incident"}]}, "project": null}
    ]}
  }
}
```

- [ ] **Step 2: Write the failing test**

```python
# tests/test_linear_client.py
import json
from pathlib import Path
import httpx
from team_status.linear_client import LinearClient
from team_status.snapshot import build_snapshot

FIXTURE = json.loads((Path(__file__).parent / "fixtures" / "linear_graphql_response.json").read_text())


def _client():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["authorization"] == "lin_api_test"
        return httpx.Response(200, json=FIXTURE)
    transport = httpx.MockTransport(handler)
    return LinearClient(api_key="lin_api_test",
                        http=httpx.Client(transport=transport))


def test_fetch_team_data_parses_members_and_issues():
    data = _client().fetch_team_data("t1", recently_touched_hours=24)
    assert {m["id"] for m in data["members"]} == {"m1", "m2"}
    assert len(data["issues"]) == 2


def test_build_snapshot_maps_into_models():
    data = _client().fetch_team_data("t1", recently_touched_hours=24)
    snap = build_snapshot(data, captured_at="2026-05-29T13:00:00Z")
    assert snap.team_name == "Platform"
    assert snap.active_cycle_name == "Q2 - Sprint 3"
    assert snap.cycle_started_at.startswith("2026-05-25")
    mex = next(i for i in snap.issues if i.identifier == "MEX-412")
    assert mex.assignee_id == "m1"
    assert mex.state_type == "started"
    assert mex.labels == ["frontend"]
    inc = next(i for i in snap.issues if i.identifier == "INC-88")
    assert inc.cycle_id is None
```

- [ ] **Step 3: Run test to verify it fails**

Run: `.venv/bin/pytest tests/test_linear_client.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'team_status.linear_client'`.

- [ ] **Step 4: Write the Linear client**

```python
# src/team_status/linear_client.py
from __future__ import annotations
from typing import Optional
import httpx

ENDPOINT = "https://api.linear.app/graphql"

_QUERY = """
query TeamStatus($teamId: String!, $since: DateTimeOrDuration!) {
  team(id: $teamId) {
    id
    name
    activeCycle { id name startsAt }
    members { nodes { id name email active } }
  }
  issues(
    first: 250
    filter: {
      team: { id: { eq: $teamId } }
      or: [
        { state: { type: { eq: "started" } } }
        { updatedAt: { gt: $since } }
      ]
    }
  ) {
    nodes {
      id identifier title createdAt updatedAt
      assignee { id }
      state { name type }
      team { id key name }
      cycle { id startsAt }
      labels { nodes { name } }
      project { id name }
    }
  }
}
"""

# NOTE: the team-scoped query above finds planned/unplanned/incident/support work.
# Lent-out work (member assigned on ANOTHER team's board) is fetched by a second
# pass keyed on member ids — see fetch_team_data.

_LENT_QUERY = """
query LentOut($memberIds: [ID!]!, $teamId: ID!, $since: DateTimeOrDuration!) {
  issues(
    first: 250
    filter: {
      assignee: { id: { in: $memberIds } }
      team: { id: { neq: $teamId } }
      or: [
        { state: { type: { eq: "started" } } }
        { updatedAt: { gt: $since } }
      ]
    }
  ) {
    nodes {
      id identifier title createdAt updatedAt
      assignee { id }
      state { name type }
      team { id key name }
      cycle { id startsAt }
      labels { nodes { name } }
      project { id name }
    }
  }
}
"""


class LinearClient:
    def __init__(self, api_key: str, http: Optional[httpx.Client] = None):
        self._key = api_key
        self._http = http or httpx.Client(timeout=30)

    def _post(self, query: str, variables: dict) -> dict:
        resp = self._http.post(
            ENDPOINT,
            headers={"Authorization": self._key, "Content-Type": "application/json"},
            json={"query": query, "variables": variables},
        )
        resp.raise_for_status()
        payload = resp.json()
        if "errors" in payload:
            raise RuntimeError(f"Linear API error: {payload['errors']}")
        return payload["data"]

    def fetch_team_data(self, team_id: str, recently_touched_hours: int) -> dict:
        since = f"-PT{recently_touched_hours}H"
        data = self._post(_QUERY, {"teamId": team_id, "since": since})
        team = data["team"]
        members = [m for m in team["members"]["nodes"] if m.get("active", True)]
        issues = list(data["issues"]["nodes"])

        member_ids = [m["id"] for m in members]
        if member_ids:
            lent = self._post(_LENT_QUERY,
                              {"memberIds": member_ids, "teamId": team_id, "since": since})
            issues.extend(lent["issues"]["nodes"])

        return {"team": team, "members": members, "issues": issues}
```

- [ ] **Step 5: Write the snapshot builder**

```python
# src/team_status/snapshot.py
from __future__ import annotations
from pathlib import Path
from typing import Optional
import json
from .models import Member, Issue, Snapshot


def _iso(ts: Optional[str]) -> Optional[str]:
    return ts  # Linear already returns ISO-8601; kept as-is


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
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `.venv/bin/pytest tests/test_linear_client.py -q`
Expected: PASS (2 passed).

- [ ] **Step 7: Commit**

```bash
git add src/team_status/linear_client.py src/team_status/snapshot.py tests/test_linear_client.py tests/fixtures/linear_graphql_response.json
git commit -m "feat: add Linear GraphQL client + snapshot builder/store"
```

---

## Task 8: Dashboard renderer

**Files:**
- Create: `src/team_status/templates/dashboard.html.j2`
- Create: `src/team_status/render.py`
- Test: `tests/test_render.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_render.py
from team_status.classify import RosterRow, WorkItem
from team_status.diff import ChangeNote
from team_status.render import render_dashboard


def test_render_contains_team_summary_and_rows():
    rows = [
        RosterRow("m1", "Alex Rivera", WorkItem("MEX-412", "Rich link previews", "planned", "high")),
        RosterRow("m2", "Sam Okafor", WorkItem("INC-88", "Webhook retries failing", "incident", "high")),
    ]
    notes = {"m1": ChangeNote("no_change", "no change"),
             "m2": ChangeNote("switched", "▲ was MEX-377")}
    html = render_dashboard(
        team_name="Platform", captured_at="2026-05-29T14:00:00Z",
        summary="1 of 2 moved off-plan since the last snapshot.",
        rows=rows, notes=notes, slack_connected=False,
    )
    assert "Platform" in html
    assert "Alex Rivera" in html and "Sam Okafor" in html
    assert "MEX-412" in html and "INC-88" in html
    assert "moved off-plan" in html
    assert "Slack: not connected" in html
    assert "▲ was MEX-377" in html
    assert "<!DOCTYPE html>" in html.strip()[:20] or "<!doctype html>" in html.strip()[:20].lower()


def test_render_shows_no_tracked_activity_for_empty_row():
    rows = [RosterRow("m3", "Idle Person", None)]
    notes = {"m3": ChangeNote("no_change", "no change")}
    html = render_dashboard("MEX", "2026-05-29T14:00:00Z", "", rows, notes, True)
    assert "No tracked activity" in html
    assert "Slack: connected" in html
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/pytest tests/test_render.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'team_status.render'`.

- [ ] **Step 3: Create the template**

```jinja
{# src/team_status/templates/dashboard.html.j2 #}
<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{ team_name }} — Working On Now</title>
<style>
  :root{--plan:#2563eb;--unp:#d97706;--inc:#dc2626;--sup:#7c3aed;--help:#0d9488;--lent:#4f46e5;--none:#9ca3af;}
  body{font:14px/1.45 -apple-system,Segoe UI,Roboto,sans-serif;color:#111827;margin:0;background:#f9fafb;}
  header{padding:18px 24px;background:#fff;border-bottom:1px solid #e5e7eb;}
  h1{font-size:18px;margin:0 0 4px;}
  .meta{color:#6b7280;font-size:12px;}
  .summary{margin-top:8px;font-weight:600;}
  .slack{display:inline-block;margin-left:8px;padding:2px 8px;border-radius:10px;font-size:11px;
         background:{{ '#dcfce7' if slack_connected else '#fee2e2' }};
         color:{{ '#166534' if slack_connected else '#991b1b' }};}
  .filters{padding:10px 24px;background:#fff;border-bottom:1px solid #e5e7eb;}
  .chip{cursor:pointer;border:1px solid #d1d5db;border-radius:14px;padding:3px 10px;margin-right:6px;
        font-size:12px;background:#fff;}
  .chip.active{background:#111827;color:#fff;border-color:#111827;}
  table{width:100%;border-collapse:collapse;background:#fff;}
  th,td{text-align:left;padding:9px 24px;border-bottom:1px solid #f0f0f0;vertical-align:top;}
  th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#6b7280;}
  .badge{display:inline-block;padding:2px 9px;border-radius:11px;font-size:11px;font-weight:600;color:#fff;}
  .low{opacity:.55;}
  .chg{color:#dc2626;font-weight:600;font-size:13px;}
  .same{color:#9ca3af;font-size:13px;}
  .tag{font-size:11px;color:#6b7280;}
  .corrected{font-size:11px;color:#7c3aed;}
  .more{font-size:12px;color:#6b7280;}
</style></head><body>
<header>
  <h1>{{ team_name }} — what everyone's working on</h1>
  <div class="meta">Snapshot: {{ captured_at }}
    <span class="slack">Slack: {{ 'connected' if slack_connected else 'not connected' }}</span></div>
  {% if summary %}<div class="summary">{{ summary }}</div>{% endif %}
</header>
<div class="filters">
  <span class="chip active" data-why="all" onclick="filt(this)">All</span>
  {% for key,label in [('planned','Planned'),('unplanned','Unplanned'),('incident','Incident'),('support','Support'),('lent','Lent out'),('adhoc','Ad-hoc')] %}
  <span class="chip" data-why="{{key}}" onclick="filt(this)">{{label}}</span>
  {% endfor %}
</div>
<table><thead><tr><th>Person</th><th>Working on now</th><th>Why</th><th>Since last snapshot</th></tr></thead><tbody>
{% for row in rows %}
{% set why = row.primary.why if row.primary else 'none' %}
<tr data-why="{{ why }}">
  <td>{{ row.member_name }}{% if row.corrected %}<div class="corrected">✎ adjusted by {{ row.corrected_by }}</div>{% endif %}</td>
  <td>
    {% if row.primary %}
      {% if row.primary.issue_identifier %}<b>{{ row.primary.issue_identifier }}</b> {% endif %}{{ row.primary.title }}
      {% for t in row.primary.tags %}<div class="tag">· {{ t }}</div>{% endfor %}
      {% if row.others %}<div class="more">+{{ row.others|length }} more</div>{% endif %}
    {% else %}<span class="same">No tracked activity</span>{% endif %}
  </td>
  <td>{% if row.primary %}<span class="badge {{ ('low' if row.primary.confidence=='low' else '') }}"
        style="background:var(--{{ {'planned':'plan','unplanned':'unp','incident':'inc','support':'sup','adhoc':'help','lent':'lent','none':'none'}[why] }})">
        {{ {'planned':'Planned','unplanned':'Unplanned','incident':'Incident','support':'Support','adhoc':'Ad-hoc','lent':'Lent out','none':'—'}[why] }}</span>{% endif %}</td>
  <td>{% set n = notes.get(row.member_id) %}
    {% if n and n.kind in ['no_change','baseline'] %}<span class="same">{{ n.text }}</span>
    {% elif n %}<span class="chg">{{ n.text }}</span>{% endif %}</td>
</tr>
{% endfor %}
</tbody></table>
<script>
function filt(el){
  document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
  var w=el.getAttribute('data-why');
  document.querySelectorAll('tbody tr').forEach(function(tr){
    tr.style.display=(w==='all'||tr.getAttribute('data-why')===w)?'':'none';
  });
}
</script>
</body></html>
```

- [ ] **Step 4: Write the renderer**

```python
# src/team_status/render.py
from __future__ import annotations
from pathlib import Path
from typing import Optional
from jinja2 import Environment, FileSystemLoader, select_autoescape
from .classify import RosterRow
from .diff import ChangeNote

_TEMPLATE_DIR = Path(__file__).parent / "templates"
_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATE_DIR)),
    autoescape=select_autoescape(["html", "j2"]),
)


def render_dashboard(team_name: str, captured_at: str, summary: str,
                     rows: list[RosterRow], notes: dict[str, ChangeNote],
                     slack_connected: bool) -> str:
    template = _env.get_template("dashboard.html.j2")
    return template.render(
        team_name=team_name, captured_at=captured_at, summary=summary,
        rows=rows, notes=notes, slack_connected=slack_connected,
    )


def write_dashboard(html: str, path: Path) -> Path:
    path = Path(path)
    path.write_text(html)
    return path
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `.venv/bin/pytest tests/test_render.py -q`
Expected: PASS (2 passed).

- [ ] **Step 6: Commit**

```bash
git add src/team_status/render.py src/team_status/templates/dashboard.html.j2 tests/test_render.py
git commit -m "feat: add self-contained roster dashboard renderer"
```

---

## Task 9: CLI orchestration

**Files:**
- Create: `src/team_status/cli.py`
- Test: `tests/test_cli.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_cli.py
import json
from pathlib import Path
from team_status.config import Config, TeamConfig
from team_status import cli


class FakeClient:
    def fetch_team_data(self, team_id, recently_touched_hours):
        return {
            "team": {"id": "t1", "name": "Platform",
                     "activeCycle": {"id": "c1", "name": "Q2 - Sprint 3",
                                     "startsAt": "2026-05-25T04:00:00.000Z"},
                     "members": {"nodes": [
                         {"id": "m1", "name": "Alex Rivera", "email": "jp@example.com", "active": True}]}},
            "issues": [
                {"id": "i1", "identifier": "MEX-412", "title": "Rich link previews",
                 "createdAt": "2026-05-26T10:00:00.000Z", "updatedAt": "2026-05-29T12:00:00.000Z",
                 "assignee": {"id": "m1"}, "state": {"name": "In Progress", "type": "started"},
                 "team": {"id": "t1", "key": "MEX", "name": "Platform"},
                 "cycle": {"id": "c1", "startsAt": "2026-05-25T04:00:00.000Z"},
                 "labels": {"nodes": []}, "project": None}],
        }


def test_run_once_writes_snapshot_and_dashboard(tmp_path):
    cfg = Config(teams=[TeamConfig("Platform", "t1", "auto")])
    out = cli.run_once(cfg, client=FakeClient(),
                       snapshots_dir=tmp_path / "snapshots",
                       corrections_path=tmp_path / "corrections.json",
                       dashboard_path=tmp_path / "dashboard.html",
                       now="2026-05-29T14:00:00Z", slack_connected=False)
    assert (tmp_path / "dashboard.html").exists()
    snaps = list((tmp_path / "snapshots").glob("t1-*.json"))
    assert len(snaps) == 1
    html = (tmp_path / "dashboard.html").read_text()
    assert "Alex Rivera" in html and "MEX-412" in html
    assert out["dashboard_path"].endswith("dashboard.html")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/pytest tests/test_cli.py -q`
Expected: FAIL — `ImportError: cannot import name 'run_once'` (or module missing).

- [ ] **Step 3: Write the implementation**

```python
# src/team_status/cli.py
from __future__ import annotations
import os
import argparse
from pathlib import Path
from datetime import datetime, timezone
from .config import load_config, Config
from .linear_client import LinearClient
from .snapshot import build_snapshot, write_snapshot, latest_two
from .classify import classify
from .diff import diff_rows
from .corrections import load_corrections, apply_corrections
from .render import render_dashboard, write_dashboard


def run_once(cfg: Config, client, snapshots_dir: Path, corrections_path: Path,
             dashboard_path: Path, now: str, slack_connected: bool) -> dict:
    team = cfg.teams[0]   # v1: single team; loop here when scaling
    data = client.fetch_team_data(team.linear_team_id, cfg.recently_touched_hours)
    snap = build_snapshot(data, captured_at=now)
    snap.slack_connected = slack_connected
    write_snapshot(snap, snapshots_dir)

    prev_snap, curr_snap = latest_two(snapshots_dir, snap.team_id)
    prev_rows = classify(prev_snap, cfg, now=prev_snap.captured_at) if prev_snap else None
    curr_rows = classify(curr_snap, cfg, now=now)

    corrections = load_corrections(corrections_path)
    date = now[:10]
    apply_corrections(curr_rows, corrections, date=date)

    notes, summary = diff_rows(prev_rows, curr_rows)
    html = render_dashboard(
        team_name=snap.team_name, captured_at=now, summary=summary,
        rows=curr_rows, notes=notes, slack_connected=slack_connected,
    )
    write_dashboard(html, dashboard_path)
    return {"dashboard_path": str(dashboard_path), "summary": summary}


def main(argv=None):
    parser = argparse.ArgumentParser(description="Run one team-status pull")
    parser.add_argument("--config", default="config.json")
    parser.add_argument("--snapshots", default="snapshots")
    parser.add_argument("--corrections", default="corrections.json")
    parser.add_argument("--out", default="dashboard.html")
    args = parser.parse_args(argv)

    api_key = os.environ["LINEAR_API_KEY"]
    cfg = load_config(Path(args.config))
    client = LinearClient(api_key=api_key)
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    result = run_once(cfg, client, Path(args.snapshots), Path(args.corrections),
                      Path(args.out), now=now, slack_connected=False)
    print(result["summary"])
    print(f"Wrote {result['dashboard_path']}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/pytest tests/test_cli.py -q`
Expected: PASS (1 passed).

- [ ] **Step 5: Run the FULL suite**

Run: `.venv/bin/pytest -q`
Expected: PASS (all tests green).

- [ ] **Step 6: Commit**

```bash
git add src/team_status/cli.py tests/test_cli.py
git commit -m "feat: wire pull->classify->diff->render orchestration + CLI"
```

---

## Task 10: Live smoke test against real Linear + confirm membership

**Files:**
- Modify: `config.json` (only if real membership differs from "auto")

This task uses a **real** Linear API key to verify the engine works end-to-end and to resolve the "team membership accuracy" risk from the spec. No new code unless a bug surfaces.

- [ ] **Step 1: Generate a Linear personal API key**

In Linear → Settings → Security & access → Personal API keys → New key. Export it:
```bash
export LINEAR_API_KEY="lin_api_..."
```

- [ ] **Step 2: Run one real pull**

Run:
```bash
cd /Users/patricia/team-status-dashboard
.venv/bin/python -m team_status.cli --config config.json
```
Expected: prints a summary line + "Wrote dashboard.html"; `snapshots/` has one `demo-team-0001-*.json`.

- [ ] **Step 3: Open and eyeball the dashboard**

Run: `open dashboard.html`
Verify: real Platform members appear; "Working on now" looks plausible; categories/badges render; Slack banner says "not connected".

- [ ] **Step 4: Confirm membership**

If the roster is missing people or includes non-members, the `team.members` query is wrong for this workspace. Fall back to an explicit member list in `config.json` (`"members": ["<id>", ...]`) and adjust `cli.run_once` to filter `snap.members` to that list. (Add a quick test in `tests/test_cli.py` for the explicit-list path if you make this change.)

- [ ] **Step 5: Run a SECOND pull and verify the diff**

Run the same command again after a minute. Open `dashboard.html`. Expected: "Since last snapshot" column now shows real change notes (mostly "no change" if nothing moved), and the summary line reflects a real comparison.

- [ ] **Step 6: Commit any config/code fixes**

```bash
git add -A
git commit -m "chore: verify engine against live Linear; confirm MEX membership"
```

---

## Task 11: Scheduling via launchd

**Files:**
- Create: `scripts/com.ada.teamstatus.plist`
- Create: `scripts/setup-schedule.sh`

- [ ] **Step 1: Create the launchd plist template**

```xml
<!-- scripts/com.ada.teamstatus.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.ada.teamstatus</string>
  <key>ProgramArguments</key>
  <array>
    <string>__PROJECT__/.venv/bin/python</string>
    <string>-m</string><string>team_status.cli</string>
    <string>--config</string><string>__PROJECT__/config.json</string>
    <string>--snapshots</string><string>__PROJECT__/snapshots</string>
    <string>--corrections</string><string>__PROJECT__/corrections.json</string>
    <string>--out</string><string>__PROJECT__/dashboard.html</string>
  </array>
  <key>WorkingDirectory</key><string>__PROJECT__</string>
  <key>EnvironmentVariables</key><dict>
    <key>LINEAR_API_KEY</key><string>__LINEAR_API_KEY__</string>
  </dict>
  <key>StartCalendarInterval</key>
  <array>
    <dict><key>Hour</key><integer>9</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>14</integer><key>Minute</key><integer>0</integer></dict>
  </array>
  <key>StandardOutPath</key><string>__PROJECT__/snapshots/launchd.log</string>
  <key>StandardErrorPath</key><string>__PROJECT__/snapshots/launchd.err</string>
</dict></plist>
```

- [ ] **Step 2: Create the setup script**

```bash
#!/usr/bin/env bash
# scripts/setup-schedule.sh — install the 9am/2pm launchd job
set -euo pipefail
PROJECT="$(cd "$(dirname "$0")/.." && pwd)"
: "${LINEAR_API_KEY:?Set LINEAR_API_KEY in your environment first}"
DEST="$HOME/Library/LaunchAgents/com.ada.teamstatus.plist"

sed -e "s|__PROJECT__|$PROJECT|g" \
    -e "s|__LINEAR_API_KEY__|$LINEAR_API_KEY|g" \
    "$PROJECT/scripts/com.ada.teamstatus.plist" > "$DEST"

launchctl unload "$DEST" 2>/dev/null || true
launchctl load "$DEST"
echo "Installed. Runs daily at 09:00 and 14:00. Dashboard: $PROJECT/dashboard.html"
echo "Test now with: launchctl start com.ada.teamstatus"
```

- [ ] **Step 3: Make executable and verify syntax**

Run:
```bash
chmod +x scripts/setup-schedule.sh
bash -n scripts/setup-schedule.sh && echo "script syntax OK"
```
Expected: "script syntax OK".

- [ ] **Step 4: Install and trigger a test run**

Run:
```bash
export LINEAR_API_KEY="lin_api_..."   # if not already set
./scripts/setup-schedule.sh
launchctl start com.ada.teamstatus
sleep 5 && cat snapshots/launchd.log
```
Expected: log shows the summary + "Wrote ...dashboard.html"; a new snapshot file exists.

- [ ] **Step 5: Commit**

```bash
git add scripts/com.ada.teamstatus.plist scripts/setup-schedule.sh
git commit -m "feat: add launchd 9am/2pm scheduling + setup script"
```

---

## Task 12: Slack enrichment layer (gated on token)

**Files:**
- Create: `src/team_status/slack_client.py`
- Modify: `src/team_status/cli.py` (detect token, pass `slack_connected`, add ad-hoc rows)
- Test: `tests/test_slack_client.py`

This adds 🟢 Ad-hoc / no-ticket detection from Slack channel history. It activates only when `SLACK_BOT_TOKEN` is set; otherwise the dashboard keeps showing "Slack: not connected" exactly as before. **Do not start this task until a working Slack bot token exists.**

- [ ] **Step 1: Write the failing test**

```python
# tests/test_slack_client.py
import httpx
from team_status.slack_client import SlackClient, adhoc_candidates


def _client(payload):
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["authorization"] == "Bearer xoxb-test"
        return httpx.Response(200, json=payload)
    return SlackClient(token="xoxb-test",
                       http=httpx.Client(transport=httpx.MockTransport(handler)))


def test_recent_messages_parsed():
    payload = {"ok": True, "messages": [
        {"user": "U1", "text": "can someone help me debug CI flakiness", "ts": "1780000000.0"}]}
    msgs = _client(payload).channel_history("C1", oldest="1779990000")
    assert msgs[0]["user"] == "U1"


def test_adhoc_candidates_excludes_members_with_active_tickets():
    msgs = [{"user": "U1", "text": "helping with onboarding bug", "ts": "1780000000.0"}]
    # email_by_slack maps Slack user -> email; members_with_tickets is a set of emails
    rows = adhoc_candidates(
        msgs, email_by_slack={"U1": "graham.scanlon@example.com"},
        members_with_tickets={"alex.rivera@example.com"})
    assert rows[0]["email"] == "graham.scanlon@example.com"


def test_adhoc_candidates_skips_members_already_on_tickets():
    msgs = [{"user": "U1", "text": "looking into this", "ts": "1780000000.0"}]
    rows = adhoc_candidates(
        msgs, email_by_slack={"U1": "alex.rivera@example.com"},
        members_with_tickets={"alex.rivera@example.com"})
    assert rows == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/pytest tests/test_slack_client.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'team_status.slack_client'`.

- [ ] **Step 3: Write the implementation**

```python
# src/team_status/slack_client.py
from __future__ import annotations
from typing import Optional
import httpx

SLACK_API = "https://slack.com/api"


class SlackClient:
    def __init__(self, token: str, http: Optional[httpx.Client] = None):
        self._token = token
        self._http = http or httpx.Client(timeout=30)

    def _get(self, method: str, params: dict) -> dict:
        resp = self._http.get(
            f"{SLACK_API}/{method}",
            headers={"Authorization": f"Bearer {self._token}"},
            params=params,
        )
        resp.raise_for_status()
        data = resp.json()
        if not data.get("ok", False):
            raise RuntimeError(f"Slack API error: {data.get('error')}")
        return data

    def channel_history(self, channel_id: str, oldest: str) -> list[dict]:
        data = self._get("conversations.history",
                         {"channel": channel_id, "oldest": oldest, "limit": 200})
        return data.get("messages", [])


def adhoc_candidates(messages: list[dict], email_by_slack: dict[str, str],
                     members_with_tickets: set[str]) -> list[dict]:
    """A team member who posted in a watched channel but has no active ticket
    is doing ad-hoc / no-ticket work."""
    out = []
    seen = set()
    for m in messages:
        email = email_by_slack.get(m.get("user", ""))
        if not email or email in members_with_tickets or email in seen:
            continue
        seen.add(email)
        out.append({"email": email, "text": m.get("text", ""), "ts": m.get("ts")})
    return out
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/pytest tests/test_slack_client.py -q`
Expected: PASS (3 passed).

- [ ] **Step 5: Wire Slack into `cli.run_once` (additive, gated)**

In `src/team_status/cli.py`, add an optional Slack pass. Replace the `run_once` signature/body intro to accept Slack inputs and, when present, append ad-hoc rows for members who have no `primary` item:

```python
def run_once(cfg, client, snapshots_dir, corrections_path, dashboard_path,
             now, slack_connected, slack_client=None, watched_channels=None,
             email_by_slack=None):
    team = cfg.teams[0]
    data = client.fetch_team_data(team.linear_team_id, cfg.recently_touched_hours)
    snap = build_snapshot(data, captured_at=now)
    snap.slack_connected = slack_connected
    write_snapshot(snap, snapshots_dir)

    prev_snap, curr_snap = latest_two(snapshots_dir, snap.team_id)
    prev_rows = classify(prev_snap, cfg, now=prev_snap.captured_at) if prev_snap else None
    curr_rows = classify(curr_snap, cfg, now=now)

    # Slack ad-hoc enrichment (only fills EMPTY rows; never overrides a ticket)
    if slack_client and watched_channels and email_by_slack:
        from .slack_client import adhoc_candidates
        from .classify import WorkItem
        from datetime import datetime
        oldest = str(int(datetime.fromisoformat(now.replace("Z", "+00:00")).timestamp())
                     - cfg.recently_touched_hours * 3600)
        with_tickets = {m.email for m, r in zip(snap.members, curr_rows) if r.primary}
        msgs = []
        for ch in watched_channels:
            msgs.extend(slack_client.channel_history(ch, oldest=oldest))
        cands = adhoc_candidates(msgs, email_by_slack, with_tickets)
        email_to_row = {m.email: r for m, r in zip(snap.members, curr_rows)}
        for c in cands:
            row = email_to_row.get(c["email"])
            if row and row.primary is None:
                row.primary = WorkItem(None, c["text"][:80], "adhoc", "low")

    corrections = load_corrections(corrections_path)
    apply_corrections(curr_rows, corrections, date=now[:10])
    notes, summary = diff_rows(prev_rows, curr_rows)
    html = render_dashboard(snap.team_name, now, summary, curr_rows, notes, slack_connected)
    write_dashboard(html, dashboard_path)
    return {"dashboard_path": str(dashboard_path), "summary": summary}
```

In `main()`, detect the token and build the Slack client when present:
```python
    slack_token = os.environ.get("SLACK_BOT_TOKEN")
    slack_client = None
    if slack_token:
        from .slack_client import SlackClient
        slack_client = SlackClient(token=slack_token)
    # watched_channels + email_by_slack come from config additions (see Step 6)
    result = run_once(cfg, client, Path(args.snapshots), Path(args.corrections),
                      Path(args.out), now=now, slack_connected=bool(slack_token),
                      slack_client=slack_client)
```

- [ ] **Step 6: Verify existing CLI test still passes (gated path is opt-in)**

Run: `.venv/bin/pytest tests/test_cli.py tests/test_slack_client.py -q`
Expected: PASS — `test_run_once_writes_snapshot_and_dashboard` still green (Slack args default to None), Slack tests green.

- [ ] **Step 7: Run the FULL suite**

Run: `.venv/bin/pytest -q`
Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add src/team_status/slack_client.py src/team_status/cli.py tests/test_slack_client.py
git commit -m "feat: add gated Slack ad-hoc enrichment layer"
```

---

## Self-Review Notes

- **Spec coverage:** audience/tone (Tasks 8 confidence + corrected byline), classification all six categories + priority + mid-sprint + confidence (Task 4), rolling diff + summary (Task 5), corrections overlay with promote-ready shape (Task 6), Linear API-key engine + lent-out via second query (Task 7), self-contained roster + filter-by-why (Task 8), live verification + membership risk (Task 10), 9am/2pm scheduling (Task 11), Slack drop-in + "not connected" banner (Tasks 8 & 12), multi-team config (Task 3, loop noted in `cli`).
- **Promotion path:** corrections shape and snapshot store are unchanged when moving to a hosted backend; only `cli` orchestration and a write API would be added.
- **Known follow-ups (not v1):** hosted deployment + in-UI corrections API; resolving `watched_channels`/`email_by_slack` config for Slack (stubbed in Task 12 `main`); multi-team grouping UI once a second team is added.
```
