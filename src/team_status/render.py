from __future__ import annotations
from pathlib import Path
from typing import Optional
from jinja2 import Environment, FileSystemLoader, select_autoescape
from .classify import RosterRow
from .diff import ChangeNote

_TEMPLATE_DIR = Path(__file__).parent / "templates"


def abbreviate_name(full: str) -> str:
    """Display a person as first name + last-name initial ("Sam Okafor" ->
    "Sam O.") to keep the dashboard privacy-light. Email-style names fall back
    to their local part ("dana.petrov@example.com" -> "danil r.")."""
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
        rows=rows, notes=notes, slack_connected=slack_connected,
    )


def write_dashboard(html: str, path: Path) -> Path:
    path = Path(path)
    path.write_text(html)
    return path
