from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import demo, detection, flights, health, incidents

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
app.include_router(demo.router, prefix="/api")
app.include_router(incidents.router, prefix="/api")
app.include_router(detection.router, prefix="/api")
