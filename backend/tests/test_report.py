from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_report_returns_pdf() -> None:
    r = client.get("/api/report/sess-001",
                   params={"scenario": "texbat_spoof",
                           "verdicts": "OK,OK,WARNING,CRITICAL,CRITICAL"})
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/pdf")
    body = r.content
    assert body.startswith(b"%PDF-")
    assert len(body) > 1000  # not empty
