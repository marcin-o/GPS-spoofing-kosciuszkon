"""Map ratios → verdicts and generate human-readable Polish reasons.

Reason templates are driven off the ML-team's actual feature columns
(power_*MHz, sqm_asym_max, position_drift_m, …) so the demo narrative
matches what the model is actually picking up. Numbers are computed
from the row, never literal — a reason that doesn't carry data
shouldn't exist in the list.
"""
from __future__ import annotations

from typing import Iterable

VERDICT_OK = "OK"
VERDICT_WARNING = "WARNING"
VERDICT_CRITICAL = "CRITICAL"


def verdict_for(ratio: float) -> str:
    if ratio >= 1.5:
        return VERDICT_CRITICAL
    if ratio >= 1.0:
        return VERDICT_WARNING
    return VERDICT_OK


def combined_verdict(ratios: Iterable[float]) -> str:
    return verdict_for(max(ratios, default=0.0))


def dominant_layer(scores: dict[str, dict]) -> str:
    return max(scores.items(), key=lambda kv: kv[1].get("ratio", 0.0))[0]


# ─────────────────────────────────────────────────── onboard reasons


def _aissou_channel_score(row: dict, ch: int) -> tuple[float, str]:
    """Per-channel anomaly magnitude + name of the dominant component.

    Returns (mag, dominant_name). ``mag`` is the sum of three normalized
    components (≈ "how many σ above clean each metric is, summed"). The
    label is whichever component contributed most.
    """
    doppler = abs(float(row.get(f"Carrier_Doppler_hz_ch{ch}", 0.0)))
    tcd     = abs(float(row.get(f"TCD_ch{ch}", 0.0)))
    cn0_off = abs(float(row.get(f"CN0_ch{ch}", 45.0)) - 45.0)
    parts = (
        ("Doppler", doppler / 1500.0),
        ("TCD",     tcd * 5.0),
        ("C/N₀",    cn0_off / 5.0),
    )
    dom_name = max(parts, key=lambda kv: kv[1])[0]
    return sum(p[1] for p in parts), dom_name


def onboard_reasons(layer: str, ratio: float, row: dict) -> list[str]:
    reasons: list[str] = []
    if layer == "L1":
        # TEXBAT signal-layer features (MLdev's bundle).
        sqm_asym = float(row.get("sqm_asym_max", 0.0))
        sqm_peak = float(row.get("sqm_peak_mean", 1.0))
        power2  = float(row.get("power_2MHz", -45.0))
        pos_drift = float(row.get("position_drift_m", 0.0))
        clock_err = float(row.get("clock_error_m", 0.0))
        psr_std = float(row.get("pseudorange_std", 2.0))
        cn0_std = float(row.get("cn0_std", 2.5))

        if sqm_asym > 0.18:
            reasons.append(f"Asymetria piku korelacyjnego SQM: {sqm_asym:.2f} (próg: 0.18)")
        if sqm_peak < 0.85:
            reasons.append(f"Peak korelacyjny obniżony: {sqm_peak:.2f}")
        if power2 > -40.0:
            reasons.append(f"Power 2MHz podniesiony: {power2:+.1f} dBm")
        if pos_drift > 15.0:
            reasons.append(f"Position drift: {pos_drift:.0f} m")
        if abs(clock_err) > 8.0:
            reasons.append(f"Clock error: {clock_err:+.1f} m")
        if psr_std > 5.0:
            reasons.append(f"Pseudorange std: {psr_std:.1f} m (clean ~2)")
        if cn0_std < 1.0:
            reasons.append(f"C/N₀ std spadło do {cn0_std:.2f} (płaska charakterystyka)")
        if not reasons:
            reasons.append("Sygnał TEXBAT w normie")

    elif layer == "L2":
        # Aissou per-channel — rank channels by composite anomaly magnitude.
        ranked = sorted(
            ((ch, *_aissou_channel_score(row, ch)) for ch in range(8)),
            key=lambda x: x[1],
            reverse=True,
        )
        for ch, mag, dom in ranked[:2]:
            if mag > 1.0:
                reasons.append(
                    f"Anomalia kanału PRN{ch+1}: dominanta {dom}, amplituda {mag:.2f}"
                )
        if not reasons:
            reasons.append("Wszystkie 8 kanałów Aissou stabilne")

    return reasons[:4]


# ─────────────────────────────────────────────────── globe reasons


def globe_reasons(submodel: str, ratio: float, ac_row: dict) -> list[str]:
    """Reason lines for a single aircraft tick.

    ``ac_row`` is the scored aircraft entry (see ml_service._prescore_globe):
    has ``position``, ``ensemble_score``, ``sub_scores``, ``dominant_submodel``,
    optional ``is_anomaly`` / ``anomaly_kind``.
    """
    reasons: list[str] = []
    sub_scores = ac_row.get("sub_scores") or {}
    pos = ac_row.get("position") or {}

    label = {
        "iforest_v1": "IsolationForest v1 (snapshot)",
        "iforest_v2": "IsolationForest v2 (multi-time)",
        "lstm_ae":    "LSTM-AE (trajektoria)",
    }.get(submodel, submodel)

    sub = sub_scores.get(submodel, {})
    sub_ratio = sub.get("ratio") if isinstance(sub, dict) else None
    if isinstance(sub_ratio, (int, float)):
        reasons.append(f"{label}: ratio {sub_ratio:.2f}× (próg 1.0×)")
    else:
        reasons.append(f"{label}: dominujący sub-model w ensemble")

    # Concrete state at this tick.
    if pos:
        lat = pos.get("lat")
        lon = pos.get("lon")
        alt = pos.get("alt")
        vel = pos.get("velocity")
        if isinstance(lat, (int, float)) and isinstance(lon, (int, float)):
            reasons.append(
                f"Pozycja {lat:.2f}°{'N' if lat >= 0 else 'S'}, "
                f"{lon:.2f}°{'E' if lon >= 0 else 'W'}"
                + (f" · alt {float(alt):.0f} m" if isinstance(alt, (int, float)) else "")
                + (f" · {float(vel):.0f} m/s" if isinstance(vel, (int, float)) else "")
            )

    kind = str(ac_row.get("anomaly_kind") or "")
    if kind:
        kind_pl = {"teleport": "skok pozycji", "smooth_drift": "płynny drift"}.get(kind, kind)
        reasons.append(f"Wzorzec: {kind_pl}")

    return reasons[:3]
