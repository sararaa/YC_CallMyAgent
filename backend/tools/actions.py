import asyncio
import logging
import math
from datetime import datetime, timezone

from sqlmodel import select

from backend.charger_synth import _wo_to_frontend
from backend.db import models
from backend.db.session import get_session
from backend.memory import supermemory_client, moss_client
from backend.observer import bus
from backend.session import CallSession

log = logging.getLogger("volt.actions")

# Demo-time only: pretend a remote reboot takes a few seconds. Without this
# the tool returns instantly with status="queued" and the agent races on to
# the next reply, never giving the caller a moment to describe what's
# happening on the charger screen. Sleeping here forces the model's tool
# loop to wait inside the turn before it produces user-facing text. Easy
# to disable by setting to 0.0.
SIMULATED_REBOOT_S = 5.0


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
    await bus.emit("state_focus", s.session_id, {
        "state": s.current_state,
        "text": f"Sending {command} → {charger_id}",
    })
    # Demo theatre: pretend the reboot actually takes a few seconds so the
    # agent (a) doesn't race on to its next reply, (b) gives the caller
    # time to watch the charger screen, and (c) returns `status="completed"`
    # rather than a permanently-queued command. Synchronously sleeping here
    # blocks Gemini's turn loop until the tool resolves — which is exactly
    # what we want for the demo.
    req_id = getattr(s, "current_req_id", "") or ""
    if SIMULATED_REBOOT_S > 0:
        log.info(
            "TOOL[%s] send_remote_command simulating reboot wait_s=%.1f charger_id=%s command=%s",
            req_id, SIMULATED_REBOOT_S, charger_id, command,
        )
        await asyncio.sleep(SIMULATED_REBOOT_S)
        with get_session() as db:
            rc_row = db.get(models.RemoteCommand, cid)
            if rc_row:
                rc_row.status = "completed"
                db.add(rc_row)
                db.commit()
        await bus.emit("admin_update", s.session_id, {
            "kind": "remote_command",
            "id": cid,
            "fields": {
                "charger_id": charger_id,
                "command": command,
                "status": "completed",
                "reason": reason,
                "confidence": confidence,
            },
        })
        await bus.emit("tool_artifact", s.session_id, {
            "kind": "remote_command",
            "command_id": cid,
            "charger_id": charger_id,
            "command": command,
            "status": "completed",
        })
        log.info(
            "TOOL[%s] send_remote_command reboot completed charger_id=%s command=%s command_id=%d",
            req_id, charger_id, command, cid,
        )
        return {
            "command_id": cid,
            "status": "completed",
            "outcome": "reboot_completed",
        }
    return {"command_id": cid, "status": "queued"}


def _read_charger_summary_excerpt(charger_id: str) -> str:
    """Direct read of Data_RAG/{charger_id}_summary.md. Returns a trimmed
    excerpt suitable for embedding in a work order, or '' if no file."""
    from backend import config as _config
    cid = (charger_id or "").strip().lower()
    path = _config.DATA_RAG_DIR / f"{cid}_summary.md"
    if not path.exists():
        return ""
    try:
        text = path.read_text()
    except Exception:  # noqa: BLE001
        return ""
    # Take the Overview + key tables (first ~2000 chars usually covers it),
    # but cut at a section boundary if we can.
    excerpt = text[:2200]
    cutoff = excerpt.rfind("\n---")
    if cutoff > 500:
        excerpt = excerpt[:cutoff].rstrip()
    return excerpt.strip()


async def _enrich_with_kb(symptoms: str, charger_id: str) -> str:
    """Build a rich details block for the work order. Combines:
      - The charger's own summary.md excerpt (direct file read, fast & reliable)
      - Top Moss volt-kb chunks matching the symptoms (best-effort; if Moss is
        503 or returns nothing, we still have the summary excerpt)
    """
    parts: list[str] = []

    # 1. Charger-specific telemetry from the markdown file
    summary = _read_charger_summary_excerpt(charger_id)
    if summary:
        parts.append(f"## Charger telemetry summary — {charger_id}\n{summary}")

    # 2. KB matches (TRIAGE.md, KB-* PDFs, etc) keyed on the symptoms
    try:
        from backend import config as _config
        from backend.memory import moss_client as _moss
        query = f"{symptoms} {charger_id}".strip()
        res = await _moss.query(_config.VOLT_KB_INDEX, query, top_k=4)
    except Exception:  # noqa: BLE001
        res = None

    if res and res.hits:
        kb_lines = ["## Relevant knowledge base"]
        for h in res.hits[:3]:
            source = h.source or "kb"
            # Skip the charger's own summary — we already included it above
            if charger_id and source.startswith(f"{charger_id}_summary"):
                continue
            body = (h.text or "").strip().replace("\n\n", "\n")
            if len(body) > 700:
                body = body[:700].rsplit(" ", 1)[0] + "…"
            kb_lines.append(f"\n### {source}  (score {h.score:.2f})\n{body}")
        if len(kb_lines) > 1:
            parts.append("\n".join(kb_lines))

    return "\n\n".join(parts)


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

    # Enrich the work order with relevant KB context so the details section
    # carries the same guidance the technician would otherwise have to look up.
    kb_block = await _enrich_with_kb(symptoms, charger_id)
    enriched_telemetry = telemetry_snippet or ""
    if kb_block:
        enriched_telemetry = (
            f"{enriched_telemetry}\n\n{kb_block}" if enriched_telemetry else kb_block
        ).strip()

    with get_session() as db:
        wo = models.WorkOrder(
            session_id=s.session_id,
            charger_id=charger_id,
            severity=severity,
            symptoms=symptoms,
            telemetry_snippet=enriched_telemetry,
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
    await bus.emit("state_focus", s.session_id, {
        "state": s.current_state,
        "text": f"Opening {severity}-severity work order · {charger_id}",
    })
    # Also emit a frontend-shaped work order for ChargePulse
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
    # Idempotent: only insert once per session. If the model calls generate_report
    # multiple times (parallel webhooks, retries, etc.), upsert.
    with get_session() as db:
        existing = db.exec(select(models.CallReport).where(models.CallReport.session_id == s.session_id)).first()
        if existing:
            existing.resolution_type = resolution_type
            existing.summary = summary
            existing.actions_taken = actions_str
            existing.follow_up_needed = follow_up_needed
            existing.confidence = confidence
            existing.overall_confidence = overall
            db.add(existing)
            db.commit()
            db.refresh(existing)
            rid = existing.id
        else:
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
    s.report_generated = True
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
    """Mark the call as ended and schedule async teardown.

    CRITICAL: this returns FAST. The actual teardown work (Supermemory
    transcript+summary writes, Moss session-index delete, CallLog finalize,
    `call_end` event) runs in a background task so the HTTP response back to
    AgentPhone is not blocked by ~3s of Supermemory latency.

    Hangup path: we set `s.hangup_after_reply = True` so the webhook handler
    appends `{"hangup": true}` to its JSON response. AgentPhone's documented
    behavior is to speak the response text in full before tearing the call
    down — see https://docs.agentphone.ai/documentation/guides/webhooks
    ("Voice webhook responses"). The previous defensive fallback (a delayed
    POST to /v1/calls/{call_id}/end) was REMOVED in this round: it cut the
    goodbye off mid-sentence at ~3.5s because TTS for a ~30-word goodbye
    is closer to 9-10s. The body flag alone is the supported path.
    """
    if s.call_ended:
        log.info(
            "END_CALL[%s] tool re-invoked (idempotent no-op) call_id=%s",
            getattr(s, "current_req_id", "") or "", s.agentphone_call_id,
        )
        return {"ok": True, "already_ended": True}

    s.call_ended = True
    s.hangup_after_reply = True
    # Defensive: any prior pending_reply is from an earlier turn and is no
    # longer the canonical text — the agent.py end_call branch will set
    # pending_reply to the goodbye after this tool returns. If a stray
    # webhook arrives in between, we want the call_already_ended early
    # return (empty text) to fire instead of echoing stale text.
    s.pending_reply = ""

    duration_s = (datetime.now(timezone.utc) - s.started_at).total_seconds()
    overall = _geo_mean(s.confidence_samples)

    log.info(
        "END_CALL[%s] marked call_ended=True hangup_after_reply=True call_id=%s state=%s "
        "scheduling bg teardown (hangup_via=response_flag, api_fallback=disabled)",
        getattr(s, "current_req_id", "") or "",
        s.agentphone_call_id, s.current_state,
    )

    asyncio.create_task(_end_call_teardown(s, duration_s, overall))

    return {"ok": True, "overall_confidence": overall}


async def _end_call_teardown(s: CallSession, duration_s: float, overall: float | None) -> None:
    """Background: push transcript + summary to Supermemory, wipe Moss session
    index, finalize CallLog, emit `call_end`. Runs detached from the webhook
    request so AgentPhone gets the goodbye text immediately.

    Failures here are logged but do not affect the call lifecycle — the
    caller has already heard the goodbye and AgentPhone has already hung
    up by the time this either succeeds or fails.
    """
    req_id = getattr(s, "current_req_id", "") or ""
    try:
        transcript_lines = []
        for turn in s.history:
            role = turn.get("role", "?")
            for part in turn.get("parts", []):
                if isinstance(part, dict) and part.get("text"):
                    transcript_lines.append(f"{role.upper()}: {part['text']}")
        transcript = "\n".join(transcript_lines)

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

        with get_session() as db:
            existing = db.exec(
                select(models.CallLog).where(models.CallLog.session_id == s.session_id)
            ).first()
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
        log.info(
            "END_CALL[%s] bg teardown complete call_id=%s duration_s=%.1f",
            req_id, s.agentphone_call_id, duration_s,
        )
    except Exception as e:  # noqa: BLE001
        log.warning(
            "END_CALL[%s] bg teardown FAILED call_id=%s err=%s",
            req_id, s.agentphone_call_id, e,
        )
