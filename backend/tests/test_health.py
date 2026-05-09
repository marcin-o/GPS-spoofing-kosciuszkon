from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_returns_ok_with_model_versions() -> None:
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["service"] == "gnss-defense-monitor-backend"
    assert "model_loaded" in body and isinstance(body["model_loaded"], bool)
    assert isinstance(body["model_versions"], list) and len(body["model_versions"]) >= 5
    versions = {m["version"] for m in body["model_versions"]}
    assert "texbat-xgb-v1" in versions
    assert "aissou-xgb-bin-v1" in versions
    assert "opensky-iforest-v1" in versions
    assert isinstance(body["inference_latency_ms"], dict)
    assert "texbat" in body["inference_latency_ms"]
