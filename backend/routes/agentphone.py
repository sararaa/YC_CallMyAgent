"""AgentPhone integration.

AgentPhone (YC P26) is a hosted telephony service. It transcribes the caller's
voice and POSTs JSON to a webhook we register with their /v1/webhooks endpoint.
We respond with `{ "text": "..." }` and AgentPhone speaks it back.

Webhook contract (per https://docs.agentphone.ai/documentation/guides/webhooks):
  POST <our-url>
  body:
    {
      "event": "agent.message" | "agent.call_ended" | ...,
      "channel": "voice" | "sms",
      "timestamp": "<iso>",
      "agentId": "agt_...",
      "data": {
        "callId": "call_...",
        "numberId": "num_...",
        "from": "+1...",       # caller's number
        "to": "+1...",         # our agentphone number
        "status": "in-progress",
        "transcript": "...",   # caller's most recent utterance
        "direction": "inbound"
      },
      "recentHistory": [...]
    }
  expected response: { "text": "..." }  (extra fields ignored)

We also expose a /simulate endpoint for manual testing without dialling in.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from backend import config
from backend.agent import run_turn
from backend import session as call_session
from backend.db import models
from backend.db.session import get_session
from backend.memory import moss_client, supermemory_client
from backend.observer import bus
from backend.post_call import extract_and_create_wo
from backend.tools import memory as memory_tool
from backend.tools.actions import end_call as end_call_tool

log = logging.getLogger("volt.agentphone")
router = APIRouter()


async def _preload_from_supermemory(s) -> None:
    """Pull profile + recent context, push into the session Moss cache.
    Fire-and-forget — first turn must not block on this."""
    try:
        profile = await supermemory_client.get_profile(s.caller_phone)
        recent = await supermemory_client.search("recent topics", s.caller_phone, top_k=5)
        docs = []
        if profile:
            docs.append({"id": f"{s.session_id}-profile",
                         "text": profile,
                         "metadata": {"source": "supermemory.profile"}})
        for i, hit in enumerate(recent.hits):
            docs.append({"id": f"{s.session_id}-recent-{i}",
                         "text": hit.text,
                         "metadata": {"source": hit.source or "supermemory.recent"}})
        if docs:
            await moss_client.add_docs(f"session-{s.session_id}", docs)
            await bus.emit("memory_ingest", s.session_id, {
                "tier": "session",
                "doc_id": "preload-batch",
                "text_preview": f"preloaded {len(docs)} items from long-term",
                "latency_ms": 0.0,
                "preload": True,
                "count": len(docs),
            })
    except Exception as e:  # noqa: BLE001
        log.warning("preload failed: %s", e)


async def _start_call(caller_phone: str) -> dict:
    """Begin a new call session."""
    s = call_session.new_session(caller_phone)
    with get_session() as db:
        cl = models.CallLog(session_id=s.session_id, caller_phone=caller_phone)
        db.add(cl)
        db.commit()
    await moss_client.create_index(f"session-{s.session_id}", [{
        "id": f"{s.session_id}-init",
        "text": f"Call started with {caller_phone}",
        "metadata": {"source": "system"},
    }])
    asyncio.create_task(_preload_from_supermemory(s))
    await bus.emit("call_start", s.session_id, {
        "caller_phone": caller_phone,
        "session_id": s.session_id,
    })
    return {"session_id": s.session_id}


# ---------- AgentPhone webhook ----------

async def _handle_agentphone_webhook(request: Request) -> dict:
    """Real AgentPhone webhook handler. Lenient parser — always returns {"text": ...}
    so we never play silence at the caller. Mounted at BOTH `/` and
    `/webhooks/agentphone` because AgentPhone POSTs to the registered URL exactly,
    and observed behaviour shows them hitting root."""
    try:
        body = await request.json()
    except Exception:
        body = {}
    log.info("AGENTPHONE webhook (%s): %s", request.url.path, json.dumps(body)[:600])

    event = body.get("event") or ""
    channel = body.get("channel") or "voice"
    data = body.get("data") or {}

    # Only voice for now. SMS would need a different reply shape.
    if channel != "voice":
        return {"text": ""}

    caller = (data.get("from") or "").strip()

    # Call ended → wrap up if we still have an active session.
    # On call_ended, `transcript` is a LIST of {role, content} turns containing
    # the full conversation. We extract a session_id BEFORE tearing down so the
    # post-call work-order extractor (which runs as a background task) can
    # write to the right session row.
    if event in ("agent.call_ended", "call.ended", "call_ended"):
        transcript_turns = data.get("transcript") if isinstance(data.get("transcript"), list) else []
        session_id_for_postcall = ""
        if caller:
            s = call_session.by_caller(caller)
            if s:
                session_id_for_postcall = s.session_id
                try:
                    await end_call_tool(s)
                except Exception as e:  # noqa: BLE001
                    log.warning("end_call_tool failed: %s", e)
                call_session.end(s.session_id)
        # Fire-and-forget retroactive WO extraction. This survives the
        # session being torn down because it takes primitive args.
        if session_id_for_postcall and transcript_turns:
            asyncio.create_task(
                extract_and_create_wo(session_id_for_postcall, caller, transcript_turns)
            )
        return {"text": ""}

    # For active-call events, transcript is the caller's latest utterance (string).
    raw_t = data.get("transcript")
    transcript = raw_t.strip() if isinstance(raw_t, str) else ""

    if not caller:
        return {"text": "Sorry, I lost the line for a moment."}

    s = call_session.by_caller(caller)

    # First contact for this caller → start a session and play a greeting
    if s is None:
        await _start_call(caller)
        s = call_session.by_caller(caller)
        greeting = "Hi, thanks for calling ChargeForward — this is Volt. How can I help?"
        if s is not None:
            s.history.append({"role": "model", "parts": [{"text": greeting}]})
            try:
                await memory_tool.append_turn(s, "agent", greeting)
            except Exception as e:  # noqa: BLE001
                log.warning("greeting append_turn failed: %s", e)
            await bus.emit("transcript", s.session_id, {"role": "agent", "text": greeting})
        if not transcript or s is None:
            return {"text": greeting}
        async with s.lock:
            s.last_caller_utterance = transcript
            reply = await run_turn(s, transcript)
        return {"text": f"{greeting} {reply}".strip()}

    # Ongoing call — run the turn loop on the caller's transcript.
    # Serialize via per-session lock; AgentPhone occasionally delivers
    # overlapping webhooks for the same call which used to race the agent.
    if not transcript:
        return {"text": ""}
    async with s.lock:
        # De-dup: AgentPhone re-delivers the same utterance after disconnect
        if transcript == s.last_caller_utterance:
            log.info("dedup: identical utterance re-delivered, skipping")
            return {"text": ""}
        s.last_caller_utterance = transcript
        if s.call_ended:
            return {"text": ""}
        reply = await run_turn(s, transcript)
    return {"text": reply}


@router.post("/webhooks/agentphone")
async def agentphone_webhook_subpath(request: Request) -> dict:
    return await _handle_agentphone_webhook(request)


@router.post("/")
async def agentphone_webhook_root(request: Request) -> dict:
    return await _handle_agentphone_webhook(request)


@router.get("/")
async def root_status() -> dict:
    """Friendly status so hitting the base URL in a browser isn't a 404."""
    return {
        "service": "volt",
        "ok": True,
        "post_here": "AgentPhone webhooks land at POST / and POST /webhooks/agentphone",
        "dashboard": "http://localhost:3000",
    }


# ---------- Simulator (manual testing without a phone) ----------

class SimulateRequest(BaseModel):
    caller_phone: str = "+15555550100"
    script: list[str]
    delay_s: float = 0.4


@router.post("/simulate")
async def simulate(req: SimulateRequest) -> dict:
    await _start_call(req.caller_phone)
    s = call_session.by_caller(req.caller_phone)
    if s is None:
        raise HTTPException(500, "could not create session")
    greeting = "Hi, thanks for calling ChargeForward — this is Volt. How can I help?"
    s.history.append({"role": "model", "parts": [{"text": greeting}]})
    await memory_tool.append_turn(s, "agent", greeting)
    await bus.emit("transcript", s.session_id, {"role": "agent", "text": greeting})

    transcript: list[dict] = [{"role": "agent", "text": greeting}]
    for line in req.script:
        await asyncio.sleep(req.delay_s)
        reply = await run_turn(s, line)
        transcript.append({"role": "caller", "text": line})
        transcript.append({"role": "agent", "text": reply})
        if s.current_state == "wrap_up":
            await asyncio.sleep(req.delay_s)
            reply2 = await run_turn(s, "(thanks!)")
            transcript.append({"role": "caller", "text": "(thanks!)"})
            transcript.append({"role": "agent", "text": reply2})
            break
    return {"session_id": s.session_id, "final_state": s.current_state, "transcript": transcript}
