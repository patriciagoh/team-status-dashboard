import json
from pathlib import Path
import httpx
from team_status.linear_client import LinearClient
from team_status.snapshot import build_snapshot

FIXTURE = json.loads((Path(__file__).parent / "fixtures" / "linear_graphql_response.json").read_text())


def _client():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["authorization"] == "lin_api_test"
        return httpx.Response(200, json=FIXTURE)
    transport = httpx.MockTransport(handler)
    return LinearClient(api_key="lin_api_test",
                        http=httpx.Client(transport=transport))


def test_fetch_team_data_parses_members_and_issues():
    data = _client().fetch_team_data("t1", recently_touched_hours=24)
    assert {m["id"] for m in data["members"]} == {"m1", "m2"}
    assert len(data["issues"]) == 2


def test_build_snapshot_maps_into_models():
    data = _client().fetch_team_data("t1", recently_touched_hours=24)
    snap = build_snapshot(data, captured_at="2026-05-29T13:00:00Z")
    assert snap.team_name == "Platform"
    assert snap.active_cycle_name == "Q2 - Sprint 3"
    assert snap.cycle_started_at.startswith("2026-05-25")
    mex = next(i for i in snap.issues if i.identifier == "MEX-412")
    assert mex.assignee_id == "m1"
    assert mex.state_type == "started"
    assert mex.labels == ["frontend"]
    inc = next(i for i in snap.issues if i.identifier == "INC-88")
    assert inc.cycle_id is None


def test_post_surfaces_graphql_error_message_on_400():
    # Linear returns HTTP 400 with a JSON {"errors":[...]} body for bad queries.
    # _post must raise a RuntimeError carrying the GraphQL message, not a bare
    # HTTPStatusError that hides the body.
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(400, json={"errors": [
            {"message": 'Variable "$teamId" of type "ID!" used in position expecting type "String!".'}]})
    client = LinearClient(api_key="k",
                          http=httpx.Client(transport=httpx.MockTransport(handler)))
    try:
        client.fetch_team_data("t1", recently_touched_hours=24)
        assert False, "expected RuntimeError"
    except RuntimeError as e:
        assert "used in position expecting type" in str(e)
