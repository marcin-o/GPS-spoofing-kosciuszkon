from fastapi import APIRouter

router = APIRouter(prefix="/incidents", tags=["incidents"])


@router.get("")
def list_incidents():
    return {"incidents": []}


@router.get("/{incident_id}")
def get_incident(incident_id: str):
    return {"id": incident_id}


@router.get("/{incident_id}/trajectory")
def get_incident_trajectory(incident_id: str):
    return {"incident_id": incident_id, "points": []}
