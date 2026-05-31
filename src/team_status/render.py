from __future__ import annotations
from pathlib import Path
from typing import Optional
from jinja2 import Environment, FileSystemLoader, select_autoescape
from .classify import RosterRow
from .diff import ChangeNote

_TEMPLATE_DIR = Path(__file__).parent / "templates"

# Product roadmap shown in-app under the "Ideas" section. Edit here to update.
IDEAS = [
    ("Activate the Slack signal",
     "Detect ticketless / ad-hoc work — who got pulled into a help or incident thread with no Linear issue."),
    ("Trends over time",
     "Chart planned vs. unplanned % per person and team across weeks, not just the rolling diff."),
    ("Proactive digest",
     "Post a 9am/2pm summary to Slack instead of waiting for someone to open the dashboard."),
    ("Evidence drill-down",
     "Link each row to the Linear issue or Slack thread behind its category, with the confidence reasoning."),
    ("Director / org rollup",
     "Aggregate across teams: off-plan %, incident/support load, and cross-team lending."),
    ("Self-service corrections",
     "Let each person fix their own row's category and add a one-line note, right in the UI."),
    ("Richer signals",
     "Add GitHub PRs/reviews, incident tools (PagerDuty/Rootly), and support systems as work sources."),
    ("Calendar / PTO awareness",
     "Show 'on PTO' or 'in meetings all day' instead of a false 'No tracked activity'."),
    ("One-line AI summary",
     "A human sentence per person ('mostly on reactions GA; pulled into a webhook incident this morning')."),
    ("Load & context-switch flags",
     "Gentle, descriptive nudges for over-spread, repeatedly idle, or all-unplanned patterns — never a scorecard."),
]


def abbreviate_name(full: str) -> str:
    """Display a person as first name + last-name initial ("Sam Okafor" ->
    "Sam O.") to keep the dashboard privacy-light. Email-style names fall back
    to their local part ("dana.petrov@example.com" -> "dana P.")."""
    name = (full or "").strip()
    if not name:
        return name
    if " " not in name and "@" in name:
        name = name.split("@", 1)[0].replace(".", " ").replace("_", " ").strip()
    parts = name.split()
    if len(parts) == 1:
        return parts[0]
    return f"{parts[0]} {parts[-1][0].upper()}."


_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATE_DIR)),
    autoescape=select_autoescape(["html", "j2"]),
)
_env.filters["abbrev"] = abbreviate_name


def render_dashboard(team_name: str, captured_at: str, summary: str,
                     rows: list[RosterRow], notes: dict[str, ChangeNote],
                     slack_connected: bool) -> str:
    template = _env.get_template("dashboard.html.j2")
    return template.render(
        team_name=team_name, captured_at=captured_at, summary=summary,
        rows=rows, notes=notes, slack_connected=slack_connected, ideas=IDEAS,
    )


def write_dashboard(html: str, path: Path) -> Path:
    path = Path(path)
    path.write_text(html)
    return path
