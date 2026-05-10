from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_explain_returns_real_shap_for_known_tick() -> None:
    r = client.get("/api/explain/texbat_spoof-135")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["scenario_id"] == "texbat_spoof"
    assert body["dominant_layer"] in ("L1", "L2")
    assert isinstance(body["top_features"], list) and len(body["top_features"]) >= 3
    for f in body["top_features"]:
        assert isinstance(f["feature"], str)
        assert isinstance(f["value"], (int, float))
        assert isinstance(f["contribution"], (int, float))
    assert body["predicted_proba"] >= 0
    assert body["ratio"] >= 0


def test_explain_rejects_bad_tick_id() -> None:
    r = client.get("/api/explain/notatick")
    assert r.status_code == 400
    r = client.get("/api/explain/texbat_spoof-abc")
    assert r.status_code == 400


def test_explain_rejects_unknown_scenario() -> None:
    r = client.get("/api/explain/no_such_scenario-5")
    assert r.status_code == 404
