from fastapi import APIRouter

router = APIRouter(prefix="/demo", tags=["demo"])


@router.get("/alerts")
def get_demo_alerts():
    return {"alerts": []}
