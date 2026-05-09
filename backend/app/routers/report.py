"""GET /api/report/{session_id} — generate a PDF incident report."""
from __future__ import annotations

import io
import time
from datetime import datetime, timezone

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from app.services import ml_service, replay_engine

# Mirror of ML-team's bundle metadata. Inlined here so the report doesn't
# depend on legacy ml.schemas module.
_LAYERS = [
    ("L1 (signal)",  "XGBoost",   "texbat-xgb-v1",                 0.984),
    ("L2 (channel)", "XGBoost",   "aissou-xgb-binary-v1",          0.976),
    ("L3 ensemble",  "OR-fusion", "opensky-ensemble-v1",           0.935),
]

router = APIRouter()


@router.get("/report/{session_id}")
async def get_report(
    session_id: str,
    scenario: str = Query("normal_waw_gdn"),
    verdicts: str = Query(""),
):
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib import colors
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak,
    )

    meta = replay_engine.get_meta(scenario) or {"name": scenario, "mode": "?",
                                                   "description": ""}

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
                             rightMargin=36, leftMargin=36,
                             topMargin=42, bottomMargin=36)
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=styles["Heading1"], textColor=colors.HexColor("#EE3124"))
    body = styles["BodyText"]
    mono = ParagraphStyle("mono", parent=body, fontName="Courier", fontSize=9)

    story = []
    story.append(Paragraph("GNSS DEFENSE MONITOR — INCIDENT REPORT", h1))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        f"Session: <b>{session_id}</b> &nbsp; · &nbsp; "
        f"Generated: {datetime.now(timezone.utc).isoformat(timespec='seconds')}",
        body,
    ))
    story.append(Spacer(1, 12))

    story.append(Paragraph(f"<b>Scenario:</b> {meta['name']} ({meta['mode']})", body))
    story.append(Paragraph(meta.get("description", ""), body))
    story.append(Spacer(1, 12))

    # Model versions table.
    rows = [["Layer", "Model", "Version", "F1"]]
    for layer, kind, version, f1 in _LAYERS:
        rows.append([layer, kind, version, f"{f1:.3f}"])
    tbl = Table(rows, colWidths=[100, 120, 180, 50])
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#222")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(tbl)
    story.append(Spacer(1, 16))

    # Verdict timeline.
    story.append(Paragraph("<b>Verdict timeline</b> (last received from session)", body))
    story.append(Spacer(1, 4))
    if verdicts:
        bins = verdicts.split(",")
        cells = [bins[i:i + 12] for i in range(0, len(bins), 12)]
        if not cells:
            cells = [["(no data)"]]
        timeline_rows = []
        for c in cells:
            timeline_rows.append([Paragraph(x, mono) for x in c])
        if timeline_rows:
            tlt = Table(timeline_rows)
            tlt.setStyle(TableStyle([
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f3f3f3")),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
            ]))
            story.append(tlt)
    else:
        story.append(Paragraph("(no verdicts forwarded; demo session was idle)", body))
    story.append(Spacer(1, 16))

    # Inference latency self-check.
    lat = ml_service.latency()
    story.append(Paragraph("<b>Inference latency (self-check)</b>", body))
    lat_rows = [["Scenario", "Latency (ms)"]]
    for k, v in lat.items():
        lat_rows.append([k, f"{v:.2f}"])
    lt = Table(lat_rows, colWidths=[160, 80])
    lt.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#222")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
    ]))
    story.append(lt)
    story.append(Spacer(1, 16))

    story.append(Paragraph(
        "<i>Report compiled by GNSS Defense Monitor for Kościuszkon 2026 / "
        "Honeywell theme. Models: synthetic stand-ins; pipeline: production-shaped.</i>",
        body,
    ))

    doc.build(story)
    buf.seek(0)
    fname = f"gnss_incident_{session_id}_{int(time.time())}.pdf"
    return StreamingResponse(
        buf, media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={fname}"},
    )
