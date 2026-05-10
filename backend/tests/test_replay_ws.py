"""Smoke tests for /ws/replay/onboard and /ws/replay/globe.

Verify that:
- The burst-send endpoints return a single replay_init message.
- The message shape is consistent with the live WS shape (same fields).
- ticks list is non-empty and each tick matches the expected schema.
"""
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


# ─────────────────────────────────────────────── onboard replay

def test_replay_onboard_returns_init_bundle() -> None:
    with client.websocket_connect("/ws/replay/onboard?scenario=normal_waw_gdn") as ws:
        bundle = ws.receive_json()
    assert bundle["kind"] == "replay_init"
    assert bundle["scenario_id"] == "normal_waw_gdn"
    assert bundle["mode"] == "onboard"
    assert isinstance(bundle["duration_s"], (int, float))
    assert isinstance(bundle["ticks"], list)
    assert len(bundle["ticks"]) > 0


def test_replay_onboard_tick_schema() -> None:
    with client.websocket_connect("/ws/replay/onboard?scenario=texbat_spoof") as ws:
        bundle = ws.receive_json()
    ticks = bundle["ticks"]
    for t in ticks[:5]:
        assert t["context"] == "onboard"
        assert "scores" in t and "L1" in t["scores"] and "L2" in t["scores"]
        for layer in ("L1", "L2"):
            s = t["scores"][layer]
            assert "ratio" in s and isinstance(s["ratio"], (int, float))
            assert "threshold" in s
            assert "model_version" in s
        assert t["verdict"] in ("OK", "WARNING", "CRITICAL")
        assert t["dominant_layer"] in ("L1", "L2")
        assert isinstance(t["top_reasons"], list)
        assert "position" in t and "lat" in t["position"]
        assert isinstance(t["is_attack"], bool)


def test_replay_onboard_effective_tick_sequential() -> None:
    """effective_tick must equal tick (no inject fast-forward in replay)."""
    with client.websocket_connect("/ws/replay/onboard?scenario=normal_waw_gdn") as ws:
        bundle = ws.receive_json()
    ticks = bundle["ticks"]
    for i, t in enumerate(ticks):
        assert t["tick"] == i
        assert t["effective_tick"] == i


def test_replay_onboard_invalid_scenario() -> None:
    with client.websocket_connect("/ws/replay/onboard?scenario=baltic_teleport") as ws:
        msg = ws.receive_json()
    assert "error" in msg


# ─────────────────────────────────────────────── globe replay

def test_replay_globe_returns_init_bundle() -> None:
    with client.websocket_connect("/ws/replay/globe?scenario=baltic_teleport") as ws:
        bundle = ws.receive_json()
    assert bundle["kind"] == "replay_init"
    assert bundle["scenario_id"] == "baltic_teleport"
    assert bundle["mode"] == "live_globe"
    assert isinstance(bundle["ticks"], list)
    assert len(bundle["ticks"]) > 0


def test_replay_globe_tick_schema() -> None:
    with client.websocket_connect("/ws/replay/globe?scenario=baltic_teleport") as ws:
        bundle = ws.receive_json()
    ticks = bundle["ticks"]
    for t in ticks[:3]:
        assert t["context"] == "live_globe"
        assert isinstance(t["aircraft"], list)
        if t["aircraft"]:
            a = t["aircraft"][0]
            assert "icao24" in a
            assert "ensemble_score" in a
            assert "ratio" in a["ensemble_score"]
            assert "sub_scores" in a
            assert a["verdict"] in ("OK", "WARNING", "CRITICAL")
            assert "top_reasons" in a
            assert "position" in a


def test_replay_globe_effective_tick_sequential() -> None:
    with client.websocket_connect("/ws/replay/globe?scenario=baltic_teleport") as ws:
        bundle = ws.receive_json()
    ticks = bundle["ticks"]
    for i, t in enumerate(ticks):
        assert t["tick"] == i
        assert t["effective_tick"] == i


def test_replay_globe_invalid_scenario() -> None:
    with client.websocket_connect("/ws/replay/globe?scenario=normal_waw_gdn") as ws:
        msg = ws.receive_json()
    assert "error" in msg
