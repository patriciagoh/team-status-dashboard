import httpx
from team_status.slack_client import SlackClient, adhoc_candidates


def _client(payload):
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["authorization"] == "Bearer xoxb-test"
        return httpx.Response(200, json=payload)
    return SlackClient(token="xoxb-test",
                       http=httpx.Client(transport=httpx.MockTransport(handler)))


def test_recent_messages_parsed():
    payload = {"ok": True, "messages": [
        {"user": "U1", "text": "can someone help me debug CI flakiness", "ts": "1780000000.0"}]}
    msgs = _client(payload).channel_history("C1", oldest="1779990000")
    assert msgs[0]["user"] == "U1"


def test_adhoc_candidates_excludes_members_with_active_tickets():
    msgs = [{"user": "U1", "text": "helping with onboarding bug", "ts": "1780000000.0"}]
    rows = adhoc_candidates(
        msgs, email_by_slack={"U1": "graham.scanlon@example.com"},
        members_with_tickets={"alex.rivera@example.com"})
    assert rows[0]["email"] == "graham.scanlon@example.com"


def test_adhoc_candidates_skips_members_already_on_tickets():
    msgs = [{"user": "U1", "text": "looking into this", "ts": "1780000000.0"}]
    rows = adhoc_candidates(
        msgs, email_by_slack={"U1": "alex.rivera@example.com"},
        members_with_tickets={"alex.rivera@example.com"})
    assert rows == []
