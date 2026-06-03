# Team Status Dashboard

> Twice a day, a single roster that answers: **what is each person working on right now, why, and what changed since the last look** — pulled from Linear (and, optionally, Slack).

A manager or director constantly needs to know "what is this person on, and why?" Today that means clicking through Linear, asking around, and piecing it together from Slack — and tickets are never the whole story (incidents, support, lent-out work, and ad-hoc requests rarely map cleanly to a board). This tool replaces the clicking-and-asking with one self-contained `dashboard.html` that logs everyone automatically and classifies each person's current work as **planned / unplanned / incident / support / lent-out / ad-hoc**, with a confidence cue and a "since you last looked" diff.

It's built for everyone — managers *and* the engineers themselves (each person sees their own row), so the tone is neutral and descriptive, low-confidence guesses read as tentative, and anyone can correct their own row.

## Live demo

**▶ https://patriciagoh.github.io/team-status-dashboard/**

The live page is a **proof of concept built from bundled fictional data** (`--demo`) — no real people, no Linear key, no network. It's published to GitHub Pages and gated behind a shared password ([staticrypt](https://github.com/robinmoisson/staticrypt), client-side AES). **Ask Patricia for the password.**

The deploy runs automatically on a weekday schedule (≈09:00 and 14:00 ET) via GitHub Actions — see [`.github/workflows/dashboard.yml`](.github/workflows/dashboard.yml) and [`HOSTING.md`](HOSTING.md).

## How it works

Four small, independently testable pieces. The snapshot JSON is the contract between them:

```
Linear API ─┐
            ├─▶ pull engine ─▶ snapshot JSON ─▶ classify + diff ─▶ dashboard.html
Slack ──────┘   (I/O)         (one per run)      (pure logic)       (self-contained)
                                                       ▲
                                          corrections.json ─┘
```

- **Pull engine** (`linear_client.py`, `snapshot.py`) — isolates all network + file I/O. Authenticates to Linear's GraphQL API with a personal API key and writes one immutable snapshot per run.
- **Classifier** (`classify.py`) — a **pure function**: snapshot → categorized roster. Incident/support override cycle membership; assigns `high`/`low` confidence.
- **Diff** (`diff.py`) — a **pure function**: compares the two latest snapshots into per-person change notes + a team summary ("*2 of 11 moved off-plan since the last snapshot*").
- **Renderer** (`render.py`) — bakes the result into one self-contained `dashboard.html` (inline CSS/JS, filter-by-why chips, privacy-light name abbreviation). No server required.

A **corrections** overlay (`corrections.json`, keyed by person + date) lets anyone adjust their own row; the inferred value is preserved underneath. A **Slack** enrichment layer (gated on a bot token) fills only *empty* rows with ad-hoc / no-ticket work and never overrides a ticket.

Design rationale and the full build are documented in [`docs/superpowers/specs/`](docs/superpowers/specs/) and [`docs/superpowers/plans/`](docs/superpowers/plans/).

## Run it locally

Requires **Python 3.11+**.

```bash
git clone https://github.com/patriciagoh/team-status-dashboard.git
cd team-status-dashboard
python3 -m venv .venv && .venv/bin/pip install -e ".[dev]"
```

**See it immediately with bundled sample data — no credentials:**

```bash
.venv/bin/python -m team_status.cli --demo
open dashboard.html
```

**Run the tests:**

```bash
.venv/bin/pytest -q
```

### Against your real Linear

1. Generate a personal API key: **Linear → Settings → Security & access → Personal API keys** (no admin needed).
2. Edit [`config.json`](config.json) — set your team's `linear_team_id` and label sets:

   ```json
   {
     "teams": [{ "name": "Platform", "linear_team_id": "<your-team-id>", "members": "auto" }],
     "recently_touched_hours": 24,
     "incident_labels": ["incident", "sev1", "sev2", "sev3", "outage"],
     "support_labels": ["support", "customer", "escalation"]
   }
   ```

   Add a team = one more entry; the dashboard groups by team once more than one is configured.
3. Run it:

   ```bash
   export LINEAR_API_KEY=lin_api_...
   .venv/bin/python -m team_status.cli         # writes dashboard.html
   ```

**Optional — Slack ad-hoc enrichment:** set `SLACK_BOT_TOKEN` (scopes: `channels:read`, `channels:history`, `groups:read`, `groups:history`, `users:read`). The dashboard shows a "Slack: not connected" banner until a token is present.

### Schedule it (macOS)

Install a `launchd` job that runs at 09:00 and 14:00 daily:

```bash
export LINEAR_API_KEY=lin_api_...
./scripts/setup-schedule.sh
```

## Status & non-goals

This is a **v1 proof of concept**: local-first, built to promote to a hosted multi-user app. It is **not** a productivity scorecard, not time tracking — it describes *what* and *why*, never *how much* or *how well*.

## Project layout

```
src/team_status/
  models.py        # shared data contract (dataclasses + JSON round-trip)
  config.py        # config.json loader with defaults
  classify.py      # PURE: Snapshot -> roster rows
  diff.py          # PURE: (prev, curr) -> change notes + summary
  corrections.py   # corrections overlay
  linear_client.py # Linear GraphQL I/O
  slack_client.py  # Slack history I/O (gated on token)
  snapshot.py      # build / read / write snapshots
  render.py        # roster -> dashboard.html (Jinja2)
  demo.py          # bundled fictional data for --demo
  cli.py           # wires I/O to the pure core
tests/             # one suite per module + Linear fixture
docs/superpowers/  # design spec + implementation plan
scripts/           # launchd plist + setup-schedule.sh
```
