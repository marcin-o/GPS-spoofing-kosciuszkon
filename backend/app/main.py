import logging
import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Make the repo root importable so `from ml.inference import ...` works
# without requiring PYTHONPATH gymnastics at the call site.
_REPO_ROOT = Path(__file__).resolve().parents[2]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from app.config import settings
from app.routers import (
    alerts_speak,
    explain,
    flights,
    globe_ws,
    health,
    incidents,
    onboard_ws,
    replay_ws,
    report,
    scenarios,
    score,
    ships,
)
from app.services import aisstream, ml_service

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s %(levelname)s %(name)s | %(message)s")

app = FastAPI(title="GNSS Defense Monitor API", version="0.2.0")

# CORS — broaden to localhost ports for the new dashboard.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_origin,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(scenarios.router, prefix="/api")
app.include_router(report.router, prefix="/api")
app.include_router(explain.router, prefix="/api")

# Legacy endpoints kept for the older Next.js page that still uses MSW.
app.include_router(flights.router, prefix="/api")
app.include_router(ships.router, prefix="/api")
app.include_router(incidents.router, prefix="/api")
app.include_router(score.router, prefix="/api")
app.include_router(alerts_speak.router, prefix="/api")

# WebSockets — no /api prefix per spec.
app.include_router(onboard_ws.router)
app.include_router(globe_ws.router)
app.include_router(replay_ws.router)


@app.on_event("startup")
async def _startup() -> None:
    aisstream.start()
    ml_service.warm_up()


@app.on_event("shutdown")
async def _shutdown() -> None:
    aisstream.stop()
