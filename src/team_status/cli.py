from __future__ import annotations
import os
import sys
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


def main(argv=None):
    parser = argparse.ArgumentParser(description="Run one team-status pull")
    parser.add_argument("--config", default="config.json")
    parser.add_argument("--snapshots", default="snapshots")
    parser.add_argument("--corrections", default="corrections.json")
    parser.add_argument("--out", default="dashboard.html")
    parser.add_argument("--demo", action="store_true",
                        help="Use bundled fictional data (no Linear key / network). "
                             "Used for the public POC deploy.")
    args = parser.parse_args(argv)

    cfg = load_config(Path(args.config))
    if args.demo:
        from .demo import DemoClient
        client = DemoClient()
    else:
        api_key = os.environ.get("LINEAR_API_KEY")
        if not api_key:
            sys.exit("LINEAR_API_KEY env var is required "
                     "(Linear → Settings → Security & access → Personal API keys). "
                     "Or pass --demo to render bundled sample data.")
        client = LinearClient(api_key=api_key)
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    slack_token = os.environ.get("SLACK_BOT_TOKEN")
    slack_client = None
    if slack_token:
        from .slack_client import SlackClient
        slack_client = SlackClient(token=slack_token)
    # watched_channels + email_by_slack config wiring is a documented follow-up;
    # with no channels configured the enrichment block is a no-op even with a token.
    result = run_once(cfg, client, Path(args.snapshots), Path(args.corrections),
                      Path(args.out), now=now, slack_connected=bool(slack_token),
                      slack_client=slack_client)
    print(result["summary"])
    print(f"Wrote {result['dashboard_path']}")


if __name__ == "__main__":
    main()
