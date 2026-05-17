"""AgentPhone integration.

AgentPhone is a text-webhook telephony service: it transcribes the caller and
POSTs JSON to us; we reply with text and AgentPhone speaks it back. We never
touch raw audio.

We also expose a /simulate endpoint for testing without a real phone.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlmodel import select

from backend import config
from backend.agent import run_turn
from backend import session as call_session
from backend.db import models
from backend.db.session import get_session
from backend.memory import moss_client, supermemory_client
from backend.observer import bus
from backend.tools import memory as memory_tool

log = logging.getLogger("volt.agentphone")
router = APIRouter()


class IncomingTurn(BaseModel):
    caller_phone: str
    text: Optional[str] = None
    event: Optional[str] = None  # "call_start" | "call_end" | "message" (default)


class TurnReply(BaseModel):
    text: str
    session_id: str
    state: str


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
    # CallLog row
    with get_session() as db:
        cl = models.CallLog(session_id=s.session_id, caller_phone=caller_phone)
        db.add(cl)
        db.commit()
    # Create empty session Moss index with a placeholder doc
    await moss_client.create_index(f"session-{s.session_id}", [{
        "id": f"{s.session_id}-init",
        "text": f"Call started with {caller_phone}",
        "metadata": {"source": "system"},
    }])
    # Kick off preload — DO NOT await
    asyncio.create_task(_preload_from_supermemory(s))
    await bus.emit("call_start", s.session_id, {
        "caller_phone": caller_phone,
        "session_id": s.session_id,
    })
    return {"session_id": s.session_id}


@router.post("/webhooks/agentphone", response_model=TurnReply)
async def agentphone_webhook(payload: IncomingTurn) -> TurnReply:
    event = (payload.event or "message").lower()
    phone = payload.caller_phone.strip()

    if event == "call_start":
        info = await _start_call(phone)
        sid = info["session_id"]
        s = call_session.get(sid)
        greeting = "Hi, thanks for calling ChargeForward — this is Volt. How can I help?"
        # Pre-seed transcript so the model has its own greeting in history
        s.history.append({"role": "model", "parts": [{"text": greeting}]})
        await memory_tool.append_turn(s, "agent", greeting)
        await bus.emit("transcript", sid, {"role": "agent", "text": greeting})
        return TurnReply(text=greeting, session_id=sid, state=s.current_state)

    # message turn
    s = call_session.by_caller(phone)
    if s is None:
        # Cold start: also create session implicitly
        info = await _start_call(phone)
        s = call_session.get(info["session_id"])

    if event == "call_end":
        from backend.tools.actions import end_call
        result = await end_call(s)
        call_session.end(s.session_id)
        return TurnReply(text="Goodbye.", session_id=s.session_id, state="ended")

    if not payload.text:
        raise HTTPException(400, "text required for message events")
    reply = await run_turn(s, payload.text)
    state = s.current_state
    if state == "wrap_up" and any(t.get("function_response", {}).get("name") == "end_call" for t in [p for h in s.history[-2:] for p in h.get("parts", [])]):
        # end_call already cleaned up
        call_session.end(s.session_id)
        state = "ended"
    return TurnReply(text=reply, session_id=s.session_id, state=state)


# ---------- Simulator (manual testing without AgentPhone) ----------

class SimulateRequest(BaseModel):
    caller_phone: str = "+15555550100"
    script: list[str]  # caller lines, in order
    delay_s: float = 0.4


@router.post("/simulate")
async def simulate(req: SimulateRequest) -> dict:
    """Run a scripted conversation. Replies + events stream over /ws/dashboard."""
    await _start_call(req.caller_phone)
    s = call_session.by_caller(req.caller_phone)
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
            # Let the model produce generate_report + end_call from wrap_up via an empty nudge
            await asyncio.sleep(req.delay_s)
            reply2 = await run_turn(s, "(thanks!)")
            transcript.append({"role": "caller", "text": "(thanks!)"})
            transcript.append({"role": "agent", "text": reply2})
            break
    return {"session_id": s.session_id, "final_state": s.current_state, "transcript": transcript}
