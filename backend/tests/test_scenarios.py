from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_scenarios_list() -> None:
    r = client.get("/api/scenarios")
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body, list)
    assert len(body) >= 5
    ids = {s["id"] for s in body}
    assert {"normal_waw_gdn", "texbat_spoof", "aissou_channel_attack",
            "baltic_teleport", "smooth_drift_fleet"}.issubset(ids)
    for s in body:
        assert s["mode"] in {"onboard", "live_globe"}


def test_scenario_detail() -> None:
    r = client.get("/api/scenarios/texbat_spoof")
    assert r.status_code == 200
    assert r.json()["expected_dominant_layer"] == "L1"


def test_scenario_404() -> None:
    r = client.get("/api/scenarios/no_such_thing")
    assert r.status_code == 404
