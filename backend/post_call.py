"""Post-call retrospective work order extraction.

Runs AFTER `agent.call_ended` arrives from AgentPhone. If the live agent didn't
get to open a work order (network blip, model gave up, caller hung up early),
this fires a single Gemini Flash call over the full transcript and creates a
work order retroactively. Idempotent: if a WO already exists for this
session_id, it's a no-op.

This function takes primitive args (not a CallSession) because by the time it
runs, the in-memory session may already have been torn down.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any

from google import genai
from google.genai import types as gtypes
from pydantic import BaseModel, Field
from sqlmodel import select

from backend import config
from backend.charger_synth import _wo_to_frontend
from backend.db import models
from backend.db.session import get_session
from backend.observer import bus

log = logging.getLogger("volt.post_call")

# Reuse a single Gemini client across post-call extractions.
_client: genai.Client | None = None


def _gemini() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=config.GEMINI_API_KEY)
    return _client


class PostCallExtract(BaseModel):
    needs_work_order: bool = Field(description="True if the call identified a charger fault that warrants dispatching a technician.")
    charger_id: str = Field(default="", description="The charger ID mentioned by the caller (e.g. 'charger3'). Empty if not mentioned.")
    severity: str = Field(default="medium", description="One of: low, medium, high, critical.")
    symptoms: str = Field(default="", description="One-sentence description of the caller's reported symptoms.")
    telemetry_snippet: str = Field(default="", description="Any specific fault codes or telemetry observations from the agent's analysis, if mentioned.")
    fault_code: str = Field(default="", description="The fault code identified, if any.")
    rationale: str = Field(default="", description="Brief one-sentence rationale for the decision.")


def _format_transcript(turns: list[dict]) -> str:
    lines = []
    for t in turns or []:
        role = (t.get("role") or "").upper()
        content = t.get("content") or ""
        if content:
            lines.append(f"{role}: {content}")
    return "\n".join(lines)


async def _wo_exists(session_id: str) -> bool:
    try:
        with get_session() as db:
            existing = db.exec(
                select(models.WorkOrder).where(models.WorkOrder.session_id == session_id)
            ).first()
            return existing is not None
    except Exception as e:  # noqa: BLE001
        log.warning("post-call wo exists check failed: %s", e)
        return False


async def extract_and_create_wo(
    session_id: str,
    caller_phone: str,
    transcript_turns: list[dict],
) -> dict[str, Any]:
    """If no WO exists for this session yet, ask Gemini whether one is warranted
    based on the full transcript, and create it if so."""
    if not session_id:
        return {"skipped": True, "reason": "no_session_id"}

    if await _wo_exists(session_id):
        log.info("post-call: WO already exists for session %s, skipping", session_id)
        return {"skipped": True, "reason": "already_exists"}

    transcript = _format_transcript(transcript_turns)
    if not transcript.strip():
        return {"skipped": True, "reason": "empty_transcript"}

    sys = (
        "You are a post-call analyst for an EV charging support service. You read the full "
        "transcript of a support call and decide whether a hardware/repair work order should "
        "be opened for the charger discussed. Open a work order when: the caller reported a "
        "physical fault, won't-power-on, connector damage, persistent fault codes, or any "
        "hardware issue that needs a field technician. Do NOT open a work order for purely "
        "user-side issues (app problems, payment confusion, account questions) or for "
        "issues already resolved during the call."
    )
    prompt = (
        "Decide if this call warrants opening a work order. "
        "If yes, fill in the fields based on what was actually discussed. "
        "Do not invent telemetry or fault codes — only use what was mentioned.\n\n"
        f"TRANSCRIPT:\n{transcript}\n"
    )

    try:
        resp = await _gemini().aio.models.generate_content(
            model=config.GEMINI_MODEL,
            contents=prompt,
            config=gtypes.GenerateContentConfig(
                system_instruction=sys,
                response_mime_type="application/json",
                response_schema=PostCallExtract,
                temperature=0.2,
            ),
        )
    except Exception as e:  # noqa: BLE001
        log.warning("post-call gemini call failed: %s", e)
        return {"error": str(e)}

    text = getattr(resp, "text", "") or ""
    try:
        parsed = PostCallExtract.model_validate_json(text)
    except Exception as e:  # noqa: BLE001
        log.warning("post-call json parse failed: %s; raw=%r", e, text[:200])
        return {"error": "parse_failed"}

    log.info("post-call extract: %s", parsed.model_dump())

    if not parsed.needs_work_order:
        return {"created": False, "reason": "not_warranted", "rationale": parsed.rationale}

    severity = parsed.severity if parsed.severity in {"low", "medium", "high", "critical"} else "medium"
    charger = (parsed.charger_id or "unknown").strip().lower() or "unknown"

    # Double-check idempotency right before write (in case the live agent
    # snuck one in during the Gemini call).
    if await _wo_exists(session_id):
        log.info("post-call: WO appeared during analysis, skipping write")
        return {"skipped": True, "reason": "race_already_exists"}

    try:
        with get_session() as db:
            wo = models.WorkOrder(
                session_id=session_id,
                charger_id=charger,
                severity=severity,
                symptoms=parsed.symptoms or "(post-call extracted)",
                telemetry_snippet=parsed.telemetry_snippet,
                reason=f"[post-call] {parsed.rationale}",
                confidence=0.75,
            )
            db.add(wo)
            db.commit()
            db.refresh(wo)
            woid = wo.id
            wo_row = db.get(models.WorkOrder, woid)
    except Exception as e:  # noqa: BLE001
        log.warning("post-call wo write failed: %s", e)
        return {"error": str(e)}

    await bus.emit("admin_update", session_id, {
        "kind": "work_order",
        "id": woid,
        "fields": {
            "charger_id": charger,
            "severity": severity,
            "symptoms": parsed.symptoms,
            "status": "open",
            "reason": f"[post-call] {parsed.rationale}",
            "confidence": 0.75,
            "post_call": True,
        },
    })
    if wo_row:
        fe_wo = _wo_to_frontend(wo_row)
        fe_wo["customerName"] = caller_phone
        fe_wo["postCall"] = True
        await bus.emit("work_order_created", session_id, fe_wo)
    await bus.emit("tool_artifact", session_id, {
        "kind": "work_order",
        "work_order_id": woid,
        "charger_id": charger,
        "severity": severity,
        "symptoms": parsed.symptoms,
        "status": "open",
        "post_call": True,
    })

    log.info("post-call: created WO-%d for session %s (charger=%s)", woid, session_id, charger)
    return {"created": True, "work_order_id": woid}
