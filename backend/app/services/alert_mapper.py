"""Map ratios → verdicts and generate human-readable Polish reasons.

Reason templates are driven off the ML-team's actual feature columns
(power_*MHz, sqm_asym_max, position_drift_m, …) so the demo narrative
matches what the model is actually picking up.
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

def onboard_reasons(layer: str, ratio: float, row: dict) -> list[str]:
    reasons: list[str] = []
    if layer == "L1":
        # TEXBAT signal-layer features (MLdev's bundle)
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
        # Aissou per-channel — find anomalous channel by amplitude.
        worst_ch = -1
        worst_mag = 0.0
        for ch in range(8):
            doppler = abs(float(row.get(f"Carrier_Doppler_hz_ch{ch}", 0.0)))
            tcd     = abs(float(row.get(f"TCD_ch{ch}", 0.0)))
            cn0_off = abs(float(row.get(f"CN0_ch{ch}", 45.0)) - 45.0)
            mag = doppler / 1500.0 + tcd * 5.0 + cn0_off / 5.0
            if mag > worst_mag:
                worst_mag = mag
                worst_ch = ch
        if worst_ch >= 0 and worst_mag > 1.5:
            reasons.append(f"Anomalia kanału PRN{worst_ch+1}: TCD/Doppler 3.4σ powyżej baseline")
        # Find second worst.
        second_worst_ch = -1
        second_worst_mag = 0.0
        for ch in range(8):
            if ch == worst_ch:
                continue
            doppler = abs(float(row.get(f"Carrier_Doppler_hz_ch{ch}", 0.0)))
            tcd     = abs(float(row.get(f"TCD_ch{ch}", 0.0)))
            cn0_off = abs(float(row.get(f"CN0_ch{ch}", 45.0)) - 45.0)
            mag = doppler / 1500.0 + tcd * 5.0 + cn0_off / 5.0
            if mag > second_worst_mag:
                second_worst_mag = mag
                second_worst_ch = ch
        if second_worst_ch >= 0 and second_worst_mag > 1.0:
            reasons.append(f"Anomalia kanału PRN{second_worst_ch+1}: amplituda {second_worst_mag:.2f}σ")
        if not reasons:
            reasons.append("Wszystkie 8 kanałów Aissou stabilne")

    if ratio >= 1.5:
        reasons.append("Verdict: CRITICAL — ratio przekroczył 1.5×")
    elif ratio >= 1.0:
        reasons.append("Verdict: WARNING — ratio powyżej progu (1.0×)")
    return reasons[:4]


# ─────────────────────────────────────────────────── globe reasons

def globe_reasons(submodel: str, ratio: float, ac_row: dict) -> list[str]:
    reasons: list[str] = []
    if submodel == "iforest_v1":
        reasons.append("IsolationForest v1: anomalia w features bazowych")
    elif submodel == "iforest_v2":
        reasons.append("IsolationForest v2-multitime: niespójność trajektorii")
    if ratio >= 1.5:
        reasons.append("Ensemble verdict: CRITICAL")
    return reasons[:3]
