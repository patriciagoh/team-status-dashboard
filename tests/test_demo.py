from team_status.config import Config, TeamConfig
from team_status.demo import DemoClient
from team_status import cli


def test_demo_renders_without_credentials_and_covers_categories(tmp_path):
    cfg = Config(teams=[TeamConfig("Platform", "demo-team-0001", "auto")])
    cli.run_once(cfg, DemoClient(),
                 snapshots_dir=tmp_path / "s",
                 corrections_path=tmp_path / "c.json",
                 dashboard_path=tmp_path / "d.html",
                 now="2026-05-30T14:00:00Z", slack_connected=False)
    html = (tmp_path / "d.html").read_text()
    assert "Platform" in html
    # fictional, abbreviated names — no real data
    assert "Alex R." in html
    # only abbreviated names render — full names / emails must never appear
    assert "Alex Rivera" not in html and "@example.com" not in html
    # the demo data exercises the full category range
    for badge in ["Planned", "Incident", "Support", "Lent out", "Unplanned"]:
        assert badge in html
    assert "No tracked activity" in html  # Robin Vega has nothing active
