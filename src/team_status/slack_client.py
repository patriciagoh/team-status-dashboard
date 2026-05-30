from __future__ import annotations
from typing import Optional
import httpx

SLACK_API = "https://slack.com/api"


class SlackClient:
    def __init__(self, token: str, http: Optional[httpx.Client] = None):
        self._token = token
        self._http = http or httpx.Client(timeout=30)

    def _get(self, method: str, params: dict) -> dict:
        resp = self._http.get(
            f"{SLACK_API}/{method}",
            headers={"Authorization": f"Bearer {self._token}"},
            params=params,
        )
        resp.raise_for_status()
        data = resp.json()
        if not data.get("ok", False):
            raise RuntimeError(f"Slack API error: {data.get('error')}")
        return data

    def channel_history(self, channel_id: str, oldest: str) -> list[dict]:
        data = self._get("conversations.history",
                         {"channel": channel_id, "oldest": oldest, "limit": 200})
        return data.get("messages", [])


def adhoc_candidates(messages: list[dict], email_by_slack: dict[str, str],
                     members_with_tickets: set[str]) -> list[dict]:
    """A team member who posted in a watched channel but has no active ticket
    is doing ad-hoc / no-ticket work."""
    out = []
    seen = set()
    for m in messages:
        email = email_by_slack.get(m.get("user", ""))
        if not email or email in members_with_tickets or email in seen:
            continue
        seen.add(email)
        out.append({"email": email, "text": m.get("text", ""), "ts": m.get("ts")})
    return out
