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
