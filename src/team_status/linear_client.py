from __future__ import annotations
from typing import Optional
import httpx

ENDPOINT = "https://api.linear.app/graphql"

_QUERY = """
query TeamStatus($teamId: String!, $teamIdFilter: ID!, $since: DateTimeOrDuration!) {
  team(id: $teamId) {
    id
    name
    activeCycle { id name startsAt }
    members { nodes { id name email active } }
  }
  issues(
    first: 250
    filter: {
      team: { id: { eq: $teamIdFilter } }
      or: [
        { state: { type: { eq: "started" } } }
        { updatedAt: { gt: $since } }
      ]
    }
  ) {
    nodes {
      id identifier title createdAt updatedAt
      assignee { id }
      state { name type }
      team { id key name }
      cycle { id startsAt }
      labels { nodes { name } }
      project { id name }
    }
  }
}
"""

_LENT_QUERY = """
query LentOut($memberIds: [ID!]!, $teamId: ID!, $since: DateTimeOrDuration!) {
  issues(
    first: 250
    filter: {
      assignee: { id: { in: $memberIds } }
      team: { id: { neq: $teamId } }
      or: [
        { state: { type: { eq: "started" } } }
        { updatedAt: { gt: $since } }
      ]
    }
  ) {
    nodes {
      id identifier title createdAt updatedAt
      assignee { id }
      state { name type }
      team { id key name }
      cycle { id startsAt }
      labels { nodes { name } }
      project { id name }
    }
  }
}
"""


class LinearClient:
    def __init__(self, api_key: str, http: Optional[httpx.Client] = None):
        self._key = api_key
        self._http = http or httpx.Client(timeout=30)

    def _post(self, query: str, variables: dict) -> dict:
        resp = self._http.post(
            ENDPOINT,
            headers={"Authorization": self._key, "Content-Type": "application/json"},
            json={"query": query, "variables": variables},
        )
        # Surface GraphQL errors (which arrive with HTTP 400 and a JSON body)
        # before raise_for_status swallows the body into a generic status error.
        try:
            payload = resp.json()
        except ValueError:
            payload = None
        if isinstance(payload, dict) and payload.get("errors"):
            messages = "; ".join(e.get("message", str(e)) for e in payload["errors"])
            raise RuntimeError(f"Linear API error: {messages}")
        resp.raise_for_status()
        return payload["data"]

    def fetch_team_data(self, team_id: str, recently_touched_hours: int) -> dict:
        since = f"-PT{recently_touched_hours}H"
        data = self._post(_QUERY, {"teamId": team_id, "teamIdFilter": team_id,
                                   "since": since})
        team = data["team"]
        members = [m for m in team["members"]["nodes"] if m.get("active", True)]
        issues_by_id = {n["id"]: n for n in data["issues"]["nodes"]}

        member_ids = [m["id"] for m in members]
        if member_ids:
            lent = self._post(_LENT_QUERY,
                              {"memberIds": member_ids, "teamId": team_id, "since": since})
            for n in lent["issues"]["nodes"]:
                issues_by_id.setdefault(n["id"], n)

        return {"team": team, "members": members, "issues": list(issues_by_id.values())}
