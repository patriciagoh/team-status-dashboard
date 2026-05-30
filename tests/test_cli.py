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
            "members": [
                {"id": "m1", "name": "Alex Rivera", "email": "jp@example.com", "active": True}
            ],
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
    assert "Alex R." in html and "Alex Rivera" not in html and "MEX-412" in html
    assert out["dashboard_path"].endswith("dashboard.html")
