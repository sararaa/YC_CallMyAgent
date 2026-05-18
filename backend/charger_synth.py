"""Synthesize a frontend-shaped ChargerData object from a charger_X_summary.md file.

The frontend (ChargePulse) expects:
  { id, location, model, installDate, firmwareVersion, lastServiced, status,
    healthScore, usageHistory: [{date, sessions, kwh, hasFault}], pastWorkOrders }

We extract sessions-started, completion rate, fault counts from the markdown to
derive a plausible 30-day usage history. The real markdown is the source of truth.
"""
from __future__ import annotations

import re
import random
from datetime import date, timedelta
from pathlib import Path
from typing import Optional

from sqlmodel import select

from backend import config
from backend.db import models
from backend.db.session import get_session


def _grab(markdown: str, pattern: str, default: str = "") -> str:
    m = re.search(pattern, markdown, re.IGNORECASE)
    return m.group(1).strip() if m else default


def _int(s: str) -> int:
    try:
        return int(re.sub(r"[^0-9]", "", s or "0"))
    except Exception:  # noqa: BLE001
        return 0


def synth_usage_history(sessions_total: int, fault_count: int, completion_rate: float) -> list[dict]:
    """Derive a plausible 30-day usage history.

    Distributes session totals across 30 days with some weekday bias and
    marks days with simulated faults proportional to the fault_count."""
    days = 30
    rng = random.Random(sessions_total or 1)
    base_per_day = max(1, sessions_total // 90)  # markdown covers ~90 days
    fault_density = min(0.4, fault_count / 1500.0) if fault_count else 0.0

    history = []
    today = date.today()
    for i in range(days):
        d = today - timedelta(days=days - 1 - i)
        weekday = d.weekday()  # 0..6
        # Slight weekday bias: a bit higher Tue/Thu (matches telemetry pattern)
        bias = 1.15 if weekday in (1, 3) else (0.85 if weekday in (5, 6) else 1.0)
        sessions = max(0, int(rng.gauss(base_per_day * bias, base_per_day * 0.25)))
        has_fault = rng.random() < fault_density
        if has_fault:
            sessions = max(0, sessions // 4)
        kwh = int(sessions * (20 + rng.random() * 8))
        history.append({
            "date": d.isoformat(),
            "sessions": sessions,
            "kwh": kwh,
            "hasFault": has_fault,
        })
    return history


def synth_charger(charger_id: str) -> Optional[dict]:
    """Build a ChargerData dict from Data_RAG/{charger_id}_summary.md, or None if not found."""
    cid = (charger_id or "").strip().lower()
    path = config.DATA_RAG_DIR / f"{cid}_summary.md"
    if not path.exists():
        return None

    md = path.read_text()

    sessions_started = _int(_grab(md, r"Sessions started\s*\|\s*(\d[\d,]*)"))
    sessions_completed = _int(_grab(md, r"Sessions completed\s*\|\s*(\d[\d,]*)"))
    completion_rate = (sessions_completed / sessions_started) if sessions_started else 0.0
    fault_count = _int(_grab(md, r"Faulted\s*\|\s*(\d[\d,]*)"))
    unavailable = _int(_grab(md, r"Unavailable\s*\|\s*(\d[\d,]*)"))

    # Health score heuristic: completion% minus penalty for fault density
    fault_density = (fault_count / max(1, sessions_started)) if sessions_started else 0
    base = completion_rate * 100
    penalty = min(60.0, fault_density * 8000)  # tuned for our data magnitudes
    health = max(5, min(99, int(base - penalty)))

    # Status: degraded if very high faults, offline if unavailable dominates
    total_events = sessions_started + fault_count + unavailable
    status = "online"
    if total_events and unavailable / max(1, total_events) > 0.4:
        status = "offline"
    elif fault_density > 0.4:
        status = "degraded"

    usage_history = synth_usage_history(sessions_started, fault_count, completion_rate)

    # Past work orders for this charger from DB (best-effort — table may not exist yet)
    past_wos: list[dict] = []
    try:
        with get_session() as db:
            rows = db.exec(
                select(models.WorkOrder)
                .where(models.WorkOrder.charger_id == cid)
                .order_by(models.WorkOrder.created_at.desc())
                .limit(5)
            ).all()
            past_wos = [_wo_to_frontend(r) for r in rows]
    except Exception:  # noqa: BLE001
        pass

    return {
        "id": cid,
        "location": f"Volt Network · {cid.upper()} pad",
        "model": "ChargeForward DC-200",
        "installDate": "2026-02-28",
        "firmwareVersion": "v4.12.1",
        "lastServiced": "—",
        "status": status,
        "healthScore": health,
        "usageHistory": usage_history,
        "pastWorkOrders": past_wos,
    }


def _wo_to_frontend(wo: models.WorkOrder) -> dict:
    """Adapt our WorkOrder row to their frontend WorkOrder shape."""
    return {
        "id": f"wo-{wo.id}",
        "woNumber": f"WO-{wo.created_at.strftime('%Y')}-{wo.id:04d}",
        "date": wo.created_at.isoformat(),
        "chargerId": wo.charger_id,
        "location": f"Volt Network · {wo.charger_id.upper()} pad",
        "customerName": "—",
        "faultCode": "—",
        "urgency": _severity_to_urgency(wo.severity),
        "status": _wo_status_to_frontend(wo.status),
        "assignedTech": None,
        "summary": wo.symptoms,
        "parts": [],
        "timeline": [
            {"event": "Work order created", "timestamp": wo.created_at.isoformat()},
        ],
        "resolutionSummary": None,
        # Volt-specific extras (extra fields are harmless to the frontend)
        "reason": wo.reason,
        "confidence": wo.confidence,
    }


def _severity_to_urgency(sev: str) -> str:
    return {"critical": "P1", "high": "P1", "medium": "P2", "low": "P3"}.get(sev, "P3")


def _wo_status_to_frontend(s: str) -> str:
    return {
        "open": "open",
        "dispatched": "dispatched",
        "in_progress": "in_progress",
        "complete": "complete",
        "resolved": "resolved",
        "cancelled": "cancelled",
    }.get(s, "open")
