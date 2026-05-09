from pydantic import BaseModel


class FeatureContribution(BaseModel):
    feature: str
    value: float
    contribution: float


class ExplainResponse(BaseModel):
    aircraft_id: str
    top_features: list[FeatureContribution]
    plain_english: str
