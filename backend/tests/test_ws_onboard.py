from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_onboard_ws_streams_valid_ticks() -> None:
    with client.websocket_connect(
        "/ws/onboard?scenario=normal_waw_gdn&speed=20"
    ) as ws:
        ticks = [ws.receive_json() for _ in range(10)]
    for t in ticks:
        assert t["context"] == "onboard"
        assert "scores" in t and "L1" in t["scores"] and "L2" in t["scores"]
        for layer in ("L1", "L2"):
            s = t["scores"][layer]
            assert "ratio" in s and "threshold" in s
            assert "model_version" in s
            assert isinstance(s["ratio"], (int, float))
        assert t["verdict"] in ("OK", "WARNING", "CRITICAL")
        assert t["dominant_layer"] in ("L1", "L2")
        assert isinstance(t["top_reasons"], list)
        assert "position" in t and "lat" in t["position"]
