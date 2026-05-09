import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import (
    alerts_speak,
    explain,
    flights,
    health,
    incidents,
    score,
    ships,
)
from app.services import aisstream

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="GPS Spoofing Sentinel API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(flights.router, prefix="/api")
app.include_router(ships.router, prefix="/api")
app.include_router(incidents.router, prefix="/api")
app.include_router(explain.router, prefix="/api")
app.include_router(score.router, prefix="/api")
app.include_router(alerts_speak.router, prefix="/api")


@app.on_event("startup")
async def _startup() -> None:
    aisstream.start()


@app.on_event("shutdown")
async def _shutdown() -> None:
    aisstream.stop()
