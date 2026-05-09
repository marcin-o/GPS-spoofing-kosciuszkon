from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_explain_returns_pending_status_no_fake_shap() -> None:
    r = client.get("/api/explain/tick-12345")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "pending"
    assert "SHAP" in body["message"]
    # No fake SHAP values — placeholders explicitly set to None.
    for f in body["placeholder_features"]:
        assert f["value"] is None
        assert f["contribution"] is None
