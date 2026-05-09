"""Thin wrapper over ml.inference.score() with model warm-up."""
from __future__ import annotations

import logging
import time
from typing import Any

logger = logging.getLogger(__name__)

_warmed = False
_latency_cache: dict[str, float] = {}


def warm_up() -> dict[str, float]:
    """Force model load + record a representative latency per scenario.

    Cached for /api/health.
    """
    global _warmed
    from ml.inference import score
    from ml.schemas import (
        AISSOU_FEATURES, LSTM_TRAJ_DIM, LSTM_TRAJ_LEN,
        OPENSKY_FEATURES, TEXBAT_FEATURES,
    )

    samples: list[tuple[str, dict]] = [
        ("texbat", {f: 0.0 for f in TEXBAT_FEATURES}),
        ("aissou", {f: 0.0 for f in AISSOU_FEATURES}),
        ("opensky_ensemble", {
            **{f: 0.0 for f in OPENSKY_FEATURES},
            "trajectory": [[54.0, 18.0, 10000, 230, 90]] * LSTM_TRAJ_LEN,
        }),
    ]
    out: dict[str, float] = {}
    for name, payload in samples:
        t0 = time.perf_counter()
        try:
            score(name, payload)
            dt = (time.perf_counter() - t0) * 1000
            out[name] = round(dt, 2)
        except Exception as exc:
            logger.warning("warm-up failed for %s: %s", name, exc)
            out[name] = -1.0
    _latency_cache.update(out)
    _warmed = True
    return out


def latency() -> dict[str, float]:
    if not _warmed:
        return warm_up()
    return dict(_latency_cache)


def run(scenario: str, payload: dict) -> dict[str, Any]:
    from ml.inference import score
    return score(scenario, payload)
