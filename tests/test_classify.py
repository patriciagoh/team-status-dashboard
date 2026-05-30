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
