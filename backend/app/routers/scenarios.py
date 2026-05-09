"""GET /api/scenarios — list demo scenarios."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.services import replay_engine

router = APIRouter(tags=["scenarios"])


@router.get("/scenarios")
async def list_scenarios() -> list[dict]:
    return replay_engine.list_scenarios()


@router.get("/scenarios/{scenario_id}")
async def get_scenario(scenario_id: str) -> dict:
    meta = replay_engine.get_meta(scenario_id)
    if not meta:
        raise HTTPException(status_code=404, detail="scenario not found")
    return meta


@router.post("/inject/{scenario_id}")
async def inject(scenario_id: str) -> dict:
    meta = replay_engine.get_meta(scenario_id)
    if not meta:
        raise HTTPException(status_code=404, detail="scenario not found")
    target = replay_engine.inject(scenario_id)
    return {"scenario_id": scenario_id, "target_tick": target, "status": "injected"}


@router.post("/inject/{scenario_id}/reset")
async def reset_inject(scenario_id: str) -> dict:
    replay_engine.reset(scenario_id)
    return {"scenario_id": scenario_id, "status": "reset"}
