from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_globe_ws_streams_valid_batches() -> None:
    with client.websocket_connect(
        "/ws/globe?scenario=baltic_teleport&speed=10"
    ) as ws:
        batches = [ws.receive_json() for _ in range(3)]
    for b in batches:
        assert b["context"] == "live_globe"
        assert isinstance(b["aircraft"], list)
        assert len(b["aircraft"]) >= 1
        ac = b["aircraft"][0]
        assert "ensemble_score" in ac and "ratio" in ac["ensemble_score"]
        assert "sub_scores" in ac and set(ac["sub_scores"]) == {
            "iforest_v1", "iforest_v2", "lstm_ae",
        }
        assert ac["dominant_submodel"] in {"iforest_v1", "iforest_v2", "lstm_ae"}
        assert ac["verdict"] in ("OK", "WARNING", "CRITICAL")
