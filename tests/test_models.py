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
