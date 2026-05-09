from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_returns_ok_with_model_loaded_flag() -> None:
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["service"] == "gps-spoofing-sentinel-backend"
    assert "model_loaded" in body
    assert isinstance(body["model_loaded"], bool)
