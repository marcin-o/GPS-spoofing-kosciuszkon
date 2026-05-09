from fastapi import APIRouter

router = APIRouter(prefix="/flights", tags=["flights"])


@router.get("/live")
def get_live_flights():
    return {"aircraft": [], "source": "mock", "cached": False}
