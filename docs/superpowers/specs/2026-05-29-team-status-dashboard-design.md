# Team Status Dashboard — Design

**Date:** 2026-05-29
**Author:** Patricia Goh (with Claude)
**Status:** Draft for review

## Problem

A manager or director constantly needs to answer "what is this person working on right now, and why?" Today that means clicking through Linear, asking around, or piecing it together from Slack. Reality is messy: people work across multiple project tracks, get pulled into incidents and support, get lent to other teams, and pick up ad-hoc requests that never get a ticket. Tickets are not a reliable source of truth.

This tool replaces the clicking-around-and-asking with a single dashboard that logs everyone, twice a day, and shows **what** each person is working on, **why** (planned vs. unplanned vs. incident vs. support vs. lent-out vs. ad-hoc), and **how that changed since the last look**.

## Goals

- One glance answers "what is everyone working on now, and why" for a team.
- Distinguish planned work from the unplanned reality (incidents, support, lent-out, ad-hoc).
- Surface change: what shifted since the previous snapshot.
- Pull automatically twice a day (9:00 and 14:00 local) — no one has to trigger it.
- Start with the **Platform** team; scale to the full engineering org by config.
- Be "simple and clear as day" — a roster you can scan in seconds.

## Non-Goals (v1)

- Not a productivity/performance scorecard. It describes *what* and *why*, not *how much* or *how well*.
- Not a live-hosted multi-user app in v1 (designed to promote to that — see §9).
- Not time tracking. No per-task hours.
- Search-based Slack discovery is out of v1 scope (needs a user token); v1 Slack uses channel history (see §6).

## Audience & Tone

Everyone, **including the engineers themselves** — managers, directors, and each person sees their own row. This raises the bar on accuracy and tone:
- Inferred categories show a **confidence** level so tentative guesses read as tentative.
- Anyone can **correct** their own row (see §7).
- Language is neutral and descriptive ("Ad-hoc / no ticket"), never judgmental.

## Decisions (locked during brainstorming)

| Decision | Choice |
|---|---|
| Audience | Everyone, including engineers (transparency both ways) |
| Classification | Auto-infer from signals **+ let people correct** |
| Data sources | **Linear-first**; Slack is a drop-in enrichment layer |
| Slack access | Dedicated Slack app/token (claude.ai connector can't run headless); **bot token** preferred, search optional |
| Diff baseline | **Rolling** — compare to the previous snapshot |
| v1 scope | **Local now, built to promote** to hosted |
| Layout | **The Roster** (one row per person) + filter/sort by "why" |
| "Working on now" | **In-progress issues + anything touched in the last ~24h** |
| Pull schedule | 9:00 and 14:00 local, via `launchd` |
| First team | Platform (`demo-team-0001`) |
| Current cycle (example) | Q2 – Sprint 3 (2026-05-25 → 2026-06-08) |

## Architecture

Four small, independently testable pieces:

```
Linear API ─┐
            ├─▶  pull engine  ──▶  snapshot JSON  ──▶  classify + diff  ──▶  dashboard.html
Slack (later)┘      (python)        (one per pull)        (python)            (self-contained)
                                                                                   ▲
                                                          corrections.json ────────┘
```

1. **Pull engine** (Python) — authenticates to Linear with a long-lived **personal API key** (generated in Linear → Settings → API; no admin needed). Fetches team members, their active issues, issue cycle/label/team/project metadata. Writes one immutable snapshot file per run. Later, also reads Slack channel history via a bot token.
2. **Classifier** — a **pure function**: snapshot → categorized roster. No I/O. Trivially unit-testable.
3. **Diff** — compares the two latest snapshots, produces per-person change notes + a team summary line.
4. **Dashboard** — the engine regenerates a single **self-contained `dashboard.html`** with the data baked in. Opens locally, shares as a file, or drops onto any static host. No server required for v1.

Rationale for the split: each unit has one job and a clean interface (snapshot JSON is the contract). The classifier and diff hold all the logic and are pure, so they're cheap to test and safe to change. The engine isolates all I/O and credentials.

## Classification Logic

"Working on now" for a person = their Linear issues that are **in a Started/In-Progress state OR were created/updated/commented by them in the last ~24h**. Items are ordered most-recently-touched first. Each item is assigned a **why**:

| Signal (evaluated in priority order) | Why |
|---|---|
| Label/keyword matches incident set (`incident`, `sev1/2/3`, `outage`) | 🔴 **Incident** |
| Label/project matches support set (`support`, `customer`, `escalation`) | 🟣 **Support** |
| Issue is assigned on a **different team's** board | 🟦 **Lent to another team** |
| Issue is in **this team's current cycle** | 🔵 **Planned** |
| Assigned, this team, **not** in current cycle | 🟠 **Unplanned / added scope** |
| Issue was added to the cycle **after** it started | 🟠 + "added mid-sprint" tag |
| (Slack, later) active in a help/incident thread with **no matching ticket** | 🟢 **Ad-hoc / no ticket** |

Incident and Support take priority over cycle membership (a planned ticket that became an incident reads as an incident).

**Confidence:** `high` when the category comes from an explicit fact (cycle membership, an exact label); `low` when inferred from a keyword match or recency heuristic. Rendered subtly (e.g., a faint "~" or lighter badge) so low-confidence rows look tentative.

**Multiple items:** show the primary (most-recently-touched) item inline; collapse the rest behind "**+N more**".

**Empty:** if a person has no active or recently-touched issues and Slack is unavailable, the row reads "**No tracked activity**" (honest, not alarming) at `low` confidence.

## The Diff ("since you last looked")

Compares each person's current primary item + category against the previous snapshot:

- Switched item → `▲ was MEX-377`
- Newly appeared (esp. ad-hoc/incident) → `▲ new` / `▲ new, no ticket`
- Returned to planned work → `→ back on plan`
- Category change with same item → `▲ now Incident`
- Nothing changed → `no change` (muted)

Team summary line at the top, e.g. *"2 of 11 moved off-plan since 9:00 AM."*

First snapshot of a team (no prior) shows all rows as "baseline — first look."

## Corrections (auto-infer + let people correct)

A `corrections.json` overlay, keyed by `person_id` + `date`:

```json
{
  "b5488320-...": {
    "2026-05-29": {
      "category_override": "adhoc",
      "note": "Pulled into Growth onboarding bug, no ticket yet",
      "author": "sam.okafor@example.com",
      "at": "2026-05-29T15:12:00Z"
    }
  }
}
```

The dashboard overlays corrections on inferred data and marks the row "✎ adjusted by <author>." Inferred value is preserved underneath (auditable).

- **Local v1:** correct by editing `corrections.json`, or via a small "suggest correction" helper that appends an entry.
- **Promotion:** the hosted version's correction API writes the **exact same shape**, so moving to in-UI corrections is wiring, not a data-model change.

## Config & Scale

`config.json`:

```json
{
  "teams": [
    {
      "name": "Platform",
      "linear_team_id": "demo-team-0001",
      "members": "auto"          // "auto" = pull from Linear team membership; or an explicit list
    }
  ],
  "recently_touched_hours": 24,
  "incident_labels": ["incident", "sev1", "sev2", "sev3", "outage"],
  "support_labels": ["support", "customer", "escalation"]
}
```

Adding a team = one more entry. The dashboard groups rows by team once more than one team is configured — the path to the full engineering org.

## Scheduling & Slack-Readiness

- A `launchd` plist fires the engine at 09:00 and 14:00 local. A `setup-schedule.sh` installs it. (Engine is also runnable on demand for testing / ad-hoc refresh.)
- The dashboard shows a **"Slack: not connected"** banner while no Slack token is configured. When a bot token is added (`channels:read`, `channels:history`, `groups:read`, `groups:history`, `users:read`), the same engine begins populating 🟢 Ad-hoc / no-ticket rows from channel history filtered to team members + the last ~24h. No UI change required.

## Dashboard UI

- **Roster table:** Person · Working on now · Why (color badge) · Since last snapshot · (confidence cue).
- **Filter/sort by "why"** chips at the top (e.g., click "Incident" to see only firefighting) — recovers the "how much is off-plan" view from the grouped layout without leaving the roster.
- Header: team name, snapshot timestamp, the team summary diff line, Slack-connection banner.
- Self-contained single HTML file (inline CSS/JS, data baked in). Accessible, neutral styling consistent with the user's existing tools.

## Testing

- **Classifier:** unit tests over recorded Linear payload fixtures covering every category + priority-override cases (incident-over-cycle, lent-out, mid-sprint add, empty).
- **Diff:** unit tests over synthetic snapshot pairs (switch, appear, return, category-change, no-change, first-snapshot).
- **Pull engine:** one thin integration test against a captured Linear API response (no live calls in CI).
- TDD: write the failing test first for classifier and diff logic.

## Risks & Open Items

- **Slack access is unconfirmed** — may need a workspace admin to install an app / mint a bot token. Tracked in parallel; does not block Linear-first v1.
- **Linear team membership accuracy** — `list_users` by team needs verification (initial probe returned a broad set); v1 will confirm actual Platform membership, with an explicit member list as fallback.
- **Recency heuristic noise** — "touched in last 24h" may surface drive-by comments; mitigated by ordering (in-progress first) and low-confidence marking.
- **Tone/transparency** — since engineers see their own row, copy and confidence cues must avoid implying judgment.

## Build Order (for the plan)

1. Pull engine: Linear auth + fetch + write snapshot (real data for Platform).
2. Classifier (pure, TDD) over the snapshot.
3. Diff (pure, TDD).
4. Dashboard generator (self-contained HTML, roster + filter).
5. Corrections overlay.
6. `launchd` scheduling + setup script.
7. Slack enrichment layer (gated on token; built behind the "not connected" banner).
