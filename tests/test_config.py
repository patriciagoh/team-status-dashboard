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
    assert cfg.support_labels == ["cust"]
