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


def test_creates_work_item_when_primary_is_none(tmp_path):
    p = tmp_path / "corrections.json"
    p.write_text(json.dumps({
        "m1": {"2026-05-29": {
            "category_override": "support",
            "note": "async Slack triage",
            "author": "shola@example.com",
            "at": "2026-05-29T10:00:00Z"}}}))
    corr = load_corrections(p)
    rows = [RosterRow("m1", "Shola", None)]      # primary is None
    apply_corrections(rows, corr, date="2026-05-29")
    assert rows[0].primary is not None
    assert rows[0].primary.why == "support"
    assert rows[0].primary.title == "async Slack triage"
    assert rows[0].corrected is True


def test_hyphenated_category_override_normalizes(tmp_path):
    p = tmp_path / "corrections.json"
    p.write_text(json.dumps({
        "m1": {"2026-05-29": {"category_override": "ad-hoc",  # hyphenated, as in the spec
                              "author": "x", "at": "x"}}}))
    corr = load_corrections(p)
    rows = [RosterRow("m1", "Shola", WorkItem("MEX-1", "t", "planned", "high"))]
    apply_corrections(rows, corr, date="2026-05-29")
    assert rows[0].primary.why == "adhoc"   # normalized to canonical


def test_invalid_category_override_is_ignored(tmp_path):
    p = tmp_path / "corrections.json"
    p.write_text(json.dumps({
        "m1": {"2026-05-29": {"category_override": "banana",  # not a real category
                              "note": "still note this", "author": "x", "at": "x"}}}))
    corr = load_corrections(p)
    rows = [RosterRow("m1", "Shola", WorkItem("MEX-1", "t", "planned", "high"))]
    apply_corrections(rows, corr, date="2026-05-29")
    assert rows[0].primary.why == "planned"          # bad override ignored, no broken badge
    assert rows[0].corrected is True                 # still marked corrected
    assert "still note this" in rows[0].primary.tags  # note still applied
