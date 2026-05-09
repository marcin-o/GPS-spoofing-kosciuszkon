from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_inject_changes_verdict() -> None:
    # Reset first.
    client.post("/api/inject/texbat_spoof/reset")
    with client.websocket_connect(
        "/ws/onboard?scenario=texbat_spoof&speed=50"
    ) as ws:
        # Pre-inject baseline (first few ticks should be OK).
        before = [ws.receive_json() for _ in range(3)]
        assert all(t["verdict"] == "OK" for t in before)

        # Trigger injection (HTTP) — synchronous so target is set before next tick.
        r = client.post("/api/inject/texbat_spoof")
        assert r.status_code == 200
        # Drain a few ticks; verdict must climb to WARNING or CRITICAL.
        post = [ws.receive_json() for _ in range(8)]

    seen_alert = any(t["verdict"] in ("WARNING", "CRITICAL") for t in post)
    assert seen_alert, f"verdicts after inject: {[t['verdict'] for t in post]}"

    # Reset for next test.
    client.post("/api/inject/texbat_spoof/reset")
