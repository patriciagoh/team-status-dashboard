from team_status.classify import RosterRow, WorkItem
from team_status.diff import ChangeNote
from team_status.render import render_dashboard, abbreviate_name


def test_abbreviate_name_first_plus_last_initial():
    assert abbreviate_name("Sam Okafor") == "Sam O."
    assert abbreviate_name("Alex Rivera") == "Alex R."
    assert abbreviate_name("Maya Bell-Stone") == "Maya B."


def test_abbreviate_name_three_parts_uses_last_token():
    assert abbreviate_name("Robin Park Vega") == "Robin V."


def test_abbreviate_name_single_token_unchanged():
    assert abbreviate_name("Cursor") == "Cursor"


def test_abbreviate_name_email_style_uses_local_part():
    assert abbreviate_name("dana.petrov@example.com") == "dana P."
    assert abbreviate_name("alana@example.com") == "alana"


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
    # names are abbreviated for privacy — full surnames must NOT appear
    assert "Alex R." in html and "Sam O." in html
    assert "Alex Rivera" not in html and "Okafor" not in html
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
