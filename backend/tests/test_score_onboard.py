from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_score_onboard_clean_signal() -> None:
    r = client.post(
        "/api/score/onboard",
        json={
            "features": {
                "cn0_ch1": 48,
                "doppler_ch1": 1500,
                "agc_level": 0.4,
                "satellite_count": 12,
                "carrier_phase_var": 0.04,
            }
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert set(body.keys()) == {"score", "class", "shap"}
    assert 0.0 <= body["score"] <= 1.0
    assert body["class"] in {"clean", "meaconing", "sophisticated"}
    assert isinstance(body["shap"], list) and len(body["shap"]) <= 5
    for entry in body["shap"]:
        assert set(entry.keys()) == {"feature", "value", "contribution"}
    # Strong signal: a healthy CN0 with nominal Doppler should not be classified as spoofing.
    assert body["class"] == "clean"


def test_score_onboard_spoofing_signal() -> None:
    r = client.post(
        "/api/score/onboard",
        json={
            "features": {
                "cn0_ch1": 18,
                "doppler_ch1": 4200,
                "agc_level": 0.9,
                "satellite_count": 4,
                "carrier_phase_var": 0.5,
            }
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["score"] >= 0.55
    assert body["class"] in {"meaconing", "sophisticated"}


def test_score_onboard_accepts_empty_features() -> None:
    r = client.post("/api/score/onboard", json={"features": {}})
    assert r.status_code == 200
    body = r.json()
    assert "score" in body and "class" in body and "shap" in body
