# FastAPI backend for the Jazan POC dashboard
from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional

import json
import math

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware


BASE_DIR = Path(__file__).resolve().parent
OUT_DIR = BASE_DIR / "outputs"
ART_DIR = OUT_DIR / "artifacts"
KPIS_CSV = OUT_DIR / "kpis_breach7d.csv"
SUMMARY_JSON = OUT_DIR / "kpis_summary.json"


app = FastAPI(title="Jazan POC API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)


def load_summary() -> Dict[str, Any]:
    if not SUMMARY_JSON.exists():
        raise HTTPException(status_code=404, detail="Summary data not found.")
    with SUMMARY_JSON.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def load_kpis() -> pd.DataFrame:
    """Load the KPI time-series that powers the dashboard."""
    if not KPIS_CSV.exists():
        raise HTTPException(status_code=500, detail=f"Missing KPI data CSV at {KPIS_CSV}")

    df = pd.read_csv(KPIS_CSV, parse_dates=["ts"])
    if "ts" not in df.columns:
        raise HTTPException(status_code=500, detail="Expected a 'ts' column in KPI data.")

    df = df.set_index("ts").sort_index()
    df.index.name = "ts"
    return df


def derive_alerts(
    prob_s: pd.Series,
    thr_s: pd.Series,
    persist_k: int,
    cooldown_h: int,
) -> pd.Series:
    """Replicate the alerting logic with persistence and cooldown handling."""
    above = (prob_s >= thr_s).astype(int)
    alerts = np.zeros(len(above), dtype=int)
    times = prob_s.index
    i = 0

    while i < len(above):
        if above.iloc[i]:
            j = i
            while j < len(above) and above.iloc[j]:
                j += 1

            length = j - i
            if length >= persist_k:
                fire_idx = i + persist_k - 1
                alerts[fire_idx] = 1
                cool_until = times[fire_idx] + pd.Timedelta(hours=cooldown_h)

                while j < len(times) and times[j] < cool_until:
                    j += 1
            i = j
        else:
            i += 1

    return pd.Series(alerts, index=prob_s.index, name="alert_flag")


def _format_pct(value: Optional[float]) -> str:
    try:
        return f"{float(value):.1%}"
    except (TypeError, ValueError):
        return "n/a"


def adjust_probability(prob: float, prior: Optional[float], temperature: float = 6.0, mix: float = 0.5) -> float:
    """Apply a light monotonic calibration by cooling logits and blending with regime prior."""
    if not np.isfinite(prob):
        return float(prob)

    eps = 1e-6
    clipped = float(min(max(prob, eps), 1.0 - eps))
    logit = math.log(clipped / (1.0 - clipped))
    cooled = 1.0 / (1.0 + math.exp(-logit / max(temperature, eps)))

    prior_val = prior if prior is not None and np.isfinite(prior) else clipped
    adjusted = (1.0 - mix) * cooled + mix * float(prior_val)
    return float(min(max(adjusted, 0.0), 1.0))


def build_explanation(row: pd.Series, threshold: float, summary: Dict[str, Any]) -> Dict[str, List[str]]:
    reasons: List[str] = []
    actions: List[str] = []

    prob = float(row.get("prob_breach7d", 0.0))
    regime = str(row.get("regime") or "unknown")
    ratio = prob / threshold if threshold else float("inf")
    risk_band = str(row.get("risk_band") or summary.get("risk_band") or "")

    if threshold and prob >= threshold:
        reasons.append(
            f"Forecast breach probability { _format_pct(prob) } exceeds the regime-adjusted threshold { _format_pct(threshold) }."
        )
        actions.append("Initiate the breach-risk response checklist and notify the shift supervisor.")
    else:
        reasons.append(
            f"Forecast breach probability { _format_pct(prob) } remains below the effective threshold { _format_pct(threshold) }."
        )
        actions.append("Continue monitoring at the normal cadence; no breach mitigation required yet.")

    if risk_band:
        reasons.append(f"Risk band classified as **{risk_band.upper()}**, guiding operator urgency.")

    regime_notes = {
        "normal": "Unit is in normal operating regime; baseline thresholds apply.",
        "post_startup": "Post-startup regime detected — threshold multiplier reduces nuisance alerts during stabilization.",
        "low_load": "Low-load operations detected; increased threshold reflects slower fouling dynamics.",
        "shutdown": "Unit reported as shutdown; probability spikes may stem from instrumentation or purge cycles.",
    }
    if regime in regime_notes:
        reasons.append(regime_notes[regime])

    dp_excess = row.get("dp_excess_mbar")
    if pd.notna(dp_excess):
        if dp_excess > 0.15:
            reasons.append("Differential-pressure excess is elevated, pointing to filter fouling or restriction.")
            actions.append("Inspect strainer differential-pressure readings and schedule cleaning if rise persists.")
        elif dp_excess < 0.02:
            reasons.append("Differential-pressure excess is near baseline; no immediate obstruction signals detected.")

    health_score = row.get("health_score")
    if pd.notna(health_score) and health_score < 70:
        reasons.append(f"Asset health score dropped to {health_score:.0f}, reinforcing the elevated breach probability.")
        actions.append("Review latest maintenance logs and confirm critical instrumentation calibrations.")

    ratio_text = ""
    if np.isfinite(ratio):
        ratio_text = f"Probability is {ratio:.1f}× the current threshold."
    if ratio_text:
        reasons.append(ratio_text)

    # Deduplicate while preserving order
    unique_reasons: List[str] = []
    for item in reasons:
        if item not in unique_reasons:
            unique_reasons.append(item)

    unique_actions: List[str] = []
    for item in actions:
        if item not in unique_actions:
            unique_actions.append(item)

    return {"reasons": unique_reasons, "actions": unique_actions}


@app.get("/api/summary")
def get_summary() -> Dict[str, Any]:
    return load_summary()


@app.get("/api/kpis")
def get_kpis(
    base_thr: float = Query(0.10, ge=0.0, le=1.0),
    persist_k: int = Query(5, ge=1, le=48),
    cooldown_h: int = Query(48, ge=1, le=168),
    m_normal: float = Query(1.0, ge=0.5, le=2.0),
    m_post: float = Query(1.1, ge=0.5, le=2.0),
    m_low: float = Query(1.2, ge=0.5, le=2.0),
    m_shut: float = Query(1.3, ge=0.5, le=2.0),
    lookback_days: int = Query(60, ge=1, le=365),
):
    df = load_kpis()

    mult_map = {
        "normal": m_normal,
        "post_startup": m_post,
        "low_load": m_low,
        "shutdown": m_shut,
    }
    thr_eff = pd.Series(base_thr, index=df.index, dtype=float) * df["regime"].map(mult_map).astype(float).fillna(1.0)
    alerts = derive_alerts(df["prob_breach7d"], thr_eff, persist_k, cooldown_h)

    regime_priors = df.groupby("regime")["prob_breach7d"].mean().to_dict()

    cutoff = df.index.max() - pd.Timedelta(days=lookback_days)
    tail = df[df.index >= cutoff].copy()
    tail["threshold_eff"] = thr_eff.loc[tail.index]
    tail["alert_flag"] = alerts.loc[tail.index]
    tail["prob_raw"] = tail["prob_breach7d"]
    tail["prob_breach7d"] = [
        adjust_probability(float(row["prob_breach7d"]), regime_priors.get(row["regime"]))
        for _, row in tail.iterrows()
    ]

    def band_for(prob: float, thr: float) -> str:
        if thr and prob >= thr:
            return "high"
        if thr and prob >= 0.6 * thr:
            return "medium"
        return "low"

    tail["risk_band"] = [
        band_for(float(row["prob_breach7d"]), float(row["threshold_eff"])) for _, row in tail.iterrows()
    ]
    tail["risk_ratio"] = [
        (float(row["prob_breach7d"]) / float(row["threshold_eff"])) if row["threshold_eff"] else None
        for _, row in tail.iterrows()
    ]

    items = [
        {
            "ts": ts.to_pydatetime().isoformat(),
            "prob_breach7d": float(row["prob_breach7d"]),
            "prob_breach7d_raw": float(row["prob_raw"]),
            "threshold_eff": float(row["threshold_eff"]),
            "regime": str(row["regime"]),
            "alert_flag": int(row["alert_flag"]),
            "risk_band": str(row["risk_band"]),
            "risk_ratio": float(row["risk_ratio"]) if row["risk_ratio"] is not None else None,
            "dp_excess_mbar": float(row["dp_excess_mbar"]) if pd.notna(row.get("dp_excess_mbar")) else None,
            "health_score": float(row["health_score"]) if pd.notna(row.get("health_score")) else None,
        }
        for ts, row in tail.iterrows()
    ]

    explanation: Optional[Dict[str, List[str]]] = None
    meta: Dict[str, Any] = {}
    if not tail.empty:
        summary = {}
        try:
            summary = load_summary()
        except HTTPException:
            summary = {}

        last_row = tail.iloc[-1]
        explanation = build_explanation(last_row, float(last_row["threshold_eff"]), summary)
        band_counts = tail["risk_band"].value_counts().to_dict()
        meta = {
            "window_start": tail.index.min().to_pydatetime().isoformat(),
            "window_end": tail.index.max().to_pydatetime().isoformat(),
            "points": len(tail),
            "risk_band_counts": {
                "high": int(band_counts.get("high", 0)),
                "medium": int(band_counts.get("medium", 0)),
                "low": int(band_counts.get("low", 0)),
            },
            "alerts_fired": int((tail["alert_flag"] == 1).sum()),
            "latest": {
                "risk_band": str(last_row["risk_band"]),
                "risk_ratio": float(last_row["risk_ratio"]) if last_row["risk_ratio"] is not None else None,
                "prob_breach7d": float(last_row["prob_breach7d"]),
                "prob_breach7d_raw": float(last_row["prob_raw"]),
                "threshold_eff": float(last_row["threshold_eff"]),
            },
            "regime_priors": {k: float(v) for k, v in regime_priors.items()},
        }

    return {"items": items, "explanation": explanation, "meta": meta}


@app.get("/api/export_kpis")
def export_kpis(
    base_thr: float = 0.10,
    persist_k: int = 5,
    cooldown_h: int = 48,
    m_normal: float = 1.0,
    m_post: float = 1.1,
    m_low: float = 1.2,
    m_shut: float = 1.3,
) -> Dict[str, str]:
    df = load_kpis().copy()
    mult_map = {
        "normal": m_normal,
        "post_startup": m_post,
        "low_load": m_low,
        "shutdown": m_shut,
    }
    thr_eff = pd.Series(base_thr, index=df.index, dtype=float) * df["regime"].map(mult_map).astype(float).fillna(1.0)
    alerts = derive_alerts(df["prob_breach7d"], thr_eff, persist_k, cooldown_h)

    df["threshold_eff"] = thr_eff
    df["alert_flag"] = alerts

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUT_DIR / "kpis_breach7d_tuned.csv"
    df.to_csv(out_path, index=True)
    return {"path": str(out_path)}


@app.get("/health")
def healthcheck() -> Dict[str, str]:
    return {"status": "ok"}
