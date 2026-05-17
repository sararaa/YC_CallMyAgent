import math
from datetime import datetime, timezone

from backend.db import models
from backend.db.session import get_session
from backend.memory import supermemory_client, moss_client
from backend.observer import bus
from backend.session import CallSession


def _clamp(c: float | None) -> float | None:
    if c is None:
        return None
    return max(0.0, min(1.0, float(c)))


async def send_remote_command(
    s: CallSession,
    charger_id: str,
    command: str,
    reason: str | None = None,
    confidence: float | None = None,
    **_kw,
) -> dict:
    confidence = _clamp(confidence)
    if confidence is not None:
        s.confidence_samples.append(confidence)
    with get_session() as db:
        rc = models.RemoteCommand(
            session_id=s.session_id,
            charger_id=charger_id,
            command=command,
            reason=reason,
            confidence=confidence,
        )
        db.add(rc)
        db.commit()
        db.refresh(rc)
        cid = rc.id
    await bus.emit("admin_update", s.session_id, {
        "kind": "remote_command",
        "id": cid,
        "fields": {
            "charger_id": charger_id,
            "command": command,
            "status": "queued",
            "reason": reason,
            "confidence": confidence,
        },
    })
    await bus.emit("tool_artifact", s.session_id, {
        "kind": "remote_command",
        "command_id": cid,
        "charger_id": charger_id,
        "command": command,
        "status": "queued",
    })
    return {"command_id": cid, "status": "queued"}


async def create_work_order(
    s: CallSession,
    charger_id: str,
    severity: str,
    symptoms: str,
    telemetry_snippet: str = "",
    reason: str | None = None,
    confidence: float | None = None,
    **_kw,
) -> dict:
    confidence = _clamp(confidence)
    if confidence is not None:
        s.confidence_samples.append(confidence)
    with get_session() as db:
        wo = models.WorkOrder(
            session_id=s.session_id,
            charger_id=charger_id,
            severity=severity,
            symptoms=symptoms,
            telemetry_snippet=telemetry_snippet,
            reason=reason,
            confidence=confidence,
        )
        db.add(wo)
        db.commit()
        db.refresh(wo)
        woid = wo.id
    await bus.emit("admin_update", s.session_id, {
        "kind": "work_order",
        "id": woid,
        "fields": {
            "charger_id": charger_id,
            "severity": severity,
            "symptoms": symptoms,
            "status": "open",
            "reason": reason,
            "confidence": confidence,
        },
    })
    await bus.emit("tool_artifact", s.session_id, {
        "kind": "work_order",
        "work_order_id": woid,
        "charger_id": charger_id,
        "severity": severity,
        "symptoms": symptoms,
        "status": "open",
    })
    # Also emit a frontend-shaped work order for ChargePulse
    from backend.charger_synth import _wo_to_frontend
    from backend.db.session import get_session
    with get_session() as db:
        wo_row = db.get(models.WorkOrder, woid)
        if wo_row:
            fe_wo = _wo_to_frontend(wo_row)
            fe_wo["customerName"] = s.caller_phone
            await bus.emit("work_order_created", s.session_id, fe_wo)
    return {"work_order_id": woid, "status": "open"}


def _geo_mean(xs: list[float]) -> float | None:
    xs = [max(1e-6, x) for x in xs]
    if not xs:
        return None
    return math.exp(sum(math.log(x) for x in xs) / len(xs))


_SEVERITY_FROM_RESOLUTION = {"hardware": "critical", "software": "warning", "user": "info", "unresolved": "warning"}
_URGENCY_DEFAULT = {"hardware": "P1", "software": "P2", "user": "P3", "unresolved": "P3"}


async def generate_report(
    s: CallSession,
    resolution_type: str,
    summary: str,
    actions_taken: list[str] | str,
    follow_up_needed: str = "",
    confidence: float | None = None,
    fault_code: str = "",
    fault_description: str = "",
    urgency: str = "",
    parts: list[dict] | None = None,
    **_kw,
) -> dict:
    if isinstance(actions_taken, list):
        actions_str = "\n".join(actions_taken)
    else:
        actions_str = str(actions_taken or "")
    confidence = _clamp(confidence)
    if confidence is not None:
        s.confidence_samples.append(confidence)
    overall = _geo_mean(s.confidence_samples)
    with get_session() as db:
        r = models.CallReport(
            session_id=s.session_id,
            caller_phone=s.caller_phone,
            resolution_type=resolution_type,
            summary=summary,
            actions_taken=actions_str,
            follow_up_needed=follow_up_needed,
            confidence=confidence,
            overall_confidence=overall,
        )
        db.add(r)
        db.commit()
        db.refresh(r)
        rid = r.id
    await bus.emit("admin_update", s.session_id, {
        "kind": "report",
        "id": rid,
        "fields": {
            "resolution_type": resolution_type,
            "summary": summary,
            "actions_taken": actions_str,
            "follow_up_needed": follow_up_needed,
            "confidence": confidence,
            "overall_confidence": overall,
        },
    })
    await bus.emit("tool_artifact", s.session_id, {
        "kind": "report",
        "report_id": rid,
        "resolution_type": resolution_type,
        "summary": summary,
        "actions_taken": actions_str,
        "follow_up_needed": follow_up_needed,
        "confidence": confidence,
        "overall_confidence": overall,
    })

    # Emit a GeminiResult-shaped event for the ChargePulse Gemini panel
    severity = _SEVERITY_FROM_RESOLUTION.get(resolution_type, "info")
    pct = int(round((confidence if confidence is not None else (overall or 0.85)) * 100))
    response_window = {"P1": "Within 2 hours", "P2": "Within 24 hours", "P3": "Within 72 hours", "P4": "Next maintenance"}.get(
        urgency or _URGENCY_DEFAULT.get(resolution_type, "P3"), "Within 72 hours"
    )
    gemini_result = {
        "faultCode": fault_code or "—",
        "faultDescription": fault_description or summary,
        "confidence": pct,
        "severity": severity,
        "urgency": urgency or _URGENCY_DEFAULT.get(resolution_type, "P3"),
        "downtimeRisk": "High — unit non-functional" if severity == "critical" else "Moderate",
        "responseWindow": response_window,
        "parts": [
            {"name": p.get("name", ""), "partNumber": p.get("part_number", ""), "stock": p.get("stock", "in_stock")}
            for p in (parts or [])
        ],
        "diagnosticSummary": summary,
    }
    await bus.emit("gemini_analysis", s.session_id, gemini_result)
    return {"report_id": rid, "overall_confidence": overall}


async def end_call(s: CallSession, **_kw) -> dict:
    """Push transcript + summary to Supermemory, wipe Moss session index."""
    transcript_lines = []
    for turn in s.history:
        role = turn.get("role", "?")
        for part in turn.get("parts", []):
            if isinstance(part, dict) and part.get("text"):
                transcript_lines.append(f"{role.upper()}: {part['text']}")
    transcript = "\n".join(transcript_lines)

    overall = _geo_mean(s.confidence_samples)
    action_summary = (
        f"Call with {s.caller_phone} ended in state {s.current_state}. "
        f"Overall self-reported confidence: {overall:.2f}." if overall is not None
        else f"Call with {s.caller_phone} ended in state {s.current_state}."
    )

    await supermemory_client.add(
        content=transcript or "(empty transcript)",
        container_tag=s.caller_phone,
        metadata={"kind": "transcript", "session_id": s.session_id},
    )
    await supermemory_client.add(
        content=action_summary,
        container_tag=s.caller_phone,
        metadata={"kind": "action_summary", "session_id": s.session_id},
    )
    await bus.emit("memory_ingest", s.session_id, {
        "tier": "long_term",
        "doc_id": f"{s.session_id}-transcript",
        "text_preview": (transcript[:120] or "(empty)"),
        "latency_ms": 0.0,
    })

    await moss_client.delete_index(f"session-{s.session_id}")

    duration_s = (datetime.now(timezone.utc) - s.started_at).total_seconds()
    with get_session() as db:
        from sqlmodel import select  # local import to keep top tidy
        existing = db.exec(select(models.CallLog).where(models.CallLog.session_id == s.session_id)).first()
        if existing:
            existing.ended_at = datetime.now(timezone.utc)
            existing.final_state = s.current_state
            existing.duration_s = duration_s
            db.add(existing)
            db.commit()

    await bus.emit("call_end", s.session_id, {
        "duration_s": duration_s,
        "final_state": s.current_state,
        "overall_confidence": overall,
    })
    return {"ok": True}
