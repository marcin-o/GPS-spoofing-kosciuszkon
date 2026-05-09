"""Pydantic v2 schemas for POST /api/score/onboard.

Field names mirror frontend/mocks/handlers.ts byte-for-byte.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

OnboardClass = Literal["clean", "meaconing", "sophisticated"]


class OnboardScoreRequest(BaseModel):
    """Open-ended feature bag — extra keys are passed through to the model."""

    model_config = ConfigDict(extra="allow")

    features: dict[str, Any] = Field(default_factory=dict)


class ShapContribution(BaseModel):
    feature: str
    value: float
    contribution: float


class OnboardScoreResponse(BaseModel):
    score: float = Field(ge=0.0, le=1.0)
    klass: OnboardClass = Field(serialization_alias="class", validation_alias="class")
    shap: list[ShapContribution]

    model_config = ConfigDict(populate_by_name=True)
