"""Map ratios → verdicts and generate human-readable Polish reasons."""
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
    """Given {'L1': {...}, 'L2': {...}} return key with highest ratio."""
    return max(scores.items(), key=lambda kv: kv[1].get("ratio", 0.0))[0]


def onboard_reasons(layer: str, ratio: float, row: dict) -> list[str]:
    """Generate Polish-language reason bullets driven by row-level features."""
    reasons: list[str] = []
    if layer == "L1":
        cn0_std = float(row.get("tx_cn0_std", 2.5))
        agc = float(row.get("tx_agc_mean", 0.4))
        prr = float(row.get("tx_pseudorange_residual_mean", 0.0))
        dr = float(row.get("tx_doppler_residual", 0.0))
        mp = float(row.get("tx_multipath_indicator", 0.0))
        if cn0_std < 1.5:
            drop_pct = max(0, int((1 - cn0_std / 2.5) * 100))
            reasons.append(f"Wariancja C/N₀ spadła o {drop_pct}% w ostatnich 30s")
        if abs(prr) > 30:
            reasons.append(f"Residuum pseudorange: {abs(prr):.0f}m (próg: 50m)")
        if abs(dr) > 15:
            reasons.append(f"Anomalia Doppler residuum: {abs(dr):.1f} Hz")
        if agc > 0.55:
            reasons.append(f"Poziom AGC podniesiony: {agc:.2f}")
        if mp > 0.5:
            reasons.append(f"Wzrost wskaźnika multipath: {mp:.2f}")
        if not reasons:
            reasons.append("Sygnał TEXBAT w normie")
    elif layer == "L2":
        per_channel = {
            ch: max(
                abs(float(row.get(f"ai_ch{ch}_cn0", 0))),
                abs(float(row.get(f"ai_ch{ch}_doppler", 0))),
                abs(float(row.get(f"ai_ch{ch}_residual", 0))),
                abs(float(row.get(f"ai_ch{ch}_variance", 0))),
            )
            for ch in range(8)
        }
        sorted_ch = sorted(per_channel.items(), key=lambda kv: kv[1], reverse=True)
        for ch, mag in sorted_ch[:2]:
            if mag > 1.5:
                reasons.append(f"Anomalia kanału PRN{ch+1}: amplituda {mag:.2f}σ")
        if not reasons:
            reasons.append("Wszystkie 8 kanałów Aissou stabilne")
    if ratio >= 1.5:
        reasons.append("Verdict: CRITICAL — ratio przekroczył 1.5×")
    elif ratio >= 1.0:
        reasons.append("Verdict: WARNING — ratio powyżej progu (1.0×)")
    return reasons[:4]


def globe_reasons(submodel: str, ratio: float, ac_row: dict) -> list[str]:
    reasons: list[str] = []
    if submodel == "iforest_v1":
        reasons.append("IsolationForest v1: anomalia w features bazowych")
    elif submodel == "iforest_v2":
        reasons.append("IsolationForest v2-multitime: niespójność wieloskali")
    elif submodel == "lstm_ae":
        reasons.append("LSTM-AE: błąd rekonstrukcji trajektorii powyżej progu")
    if abs(float(ac_row.get("f_lat_delta", 0))) > 0.5:
        reasons.append(f"Skok pozycji: Δlat={float(ac_row['f_lat_delta']):.2f}°")
    if float(ac_row.get("f_nic", 8)) < 4:
        reasons.append(f"NIC dropped to {int(ac_row['f_nic'])}")
    if float(ac_row.get("f_trajectory_smoothness", 0.9)) < 0.5:
        reasons.append("Trajektoria nieciągła")
    if ratio >= 1.5:
        reasons.append("Ensemble verdict: CRITICAL")
    return reasons[:3]
