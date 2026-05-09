"""JSON fixture loaders (lazy + cached)."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

_DATA_DIR = Path(__file__).resolve().parents[1] / "data"


def _read(name: str) -> Any:
    with (_DATA_DIR / name).open("r", encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def flights_fixture() -> list[dict[str, Any]]:
    return _read("live_flights_mock.json")


@lru_cache(maxsize=1)
def ships_fixture() -> list[dict[str, Any]]:
    return _read("ships_mock.json")


@lru_cache(maxsize=1)
def incidents_fixture() -> list[dict[str, Any]]:
    return _read("incidents.json")


def trajectory_file(incident_id: str) -> Path:
    return _DATA_DIR / "trajectories" / f"{incident_id}.json"
