from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_speak_returns_audio_for_known_incident() -> None:
    r = client.post("/api/alerts/flight-8243/speak")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("audio/mpeg")
    assert len(r.content) > 0


def test_speak_returns_audio_for_compound_alert_id() -> None:
    r = client.post("/api/alerts/flight-8243-spoof/speak")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("audio/mpeg")
    assert len(r.content) > 0


def test_speak_503_for_unknown_alert_with_no_backup() -> None:
    r = client.post("/api/alerts/no-such-incident-xyz/speak")
    assert r.status_code == 503


def test_speak_400_for_invalid_id() -> None:
    r = client.post("/api/alerts/..%2Fetc/speak")
    # Either FastAPI rejects the path or our regex does — both are acceptable.
    assert r.status_code in {400, 404}
