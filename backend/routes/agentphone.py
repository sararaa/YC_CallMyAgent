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
import time
import uuid
from difflib import SequenceMatcher
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


# How long (seconds) the active-call branch waits for a quiet period from
# AgentPhone before actually running run_turn on the latest transcript.
# AgentPhone delivers ASR partials in a volley: previous diagnosis showed
# intra-utterance webhook gaps of 29ms – 2.8s and inter-utterance gaps of
# 9-17s, so a 1.0-1.5s window is the sweet spot — long enough to coalesce
# partials inside one utterance, short enough to feel responsive once the
# caller actually pauses.
DEBOUNCE_S = 1.1


async def _init_moss_session(s) -> None:
    """Background: create the Moss session index and signal readiness.
    We set index_ready even on failure so dependent writes don't hang forever."""
    try:
        await moss_client.create_index(f"session-{s.session_id}", [{
            "id": f"{s.session_id}-init",
            "text": f"Call started with {s.caller_phone}",
            "metadata": {"source": "system"},
        }])
    except Exception as e:  # noqa: BLE001
        log.warning("Moss create_index for session %s failed: %s", s.session_id, e)
    finally:
        s.index_ready.set()


async def _preload_from_supermemory(s) -> None:
    """Pull profile + recent context, push into the session Moss cache.
    Background task — first turn must not block on this."""
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
            # Wait for the session index to exist before writing.
            await s.index_ready.wait()
            if s.call_ended:
                return
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


async def _start_call(caller_phone: str, agentphone_call_id: str = "") -> dict:
    """Begin a new call session. Returns immediately; Moss work happens
    in the background so the FIRST Gemini turn isn't blocked by it."""
    s = call_session.new_session(caller_phone)
    s.agentphone_call_id = agentphone_call_id
    with get_session() as db:
        cl = models.CallLog(session_id=s.session_id, caller_phone=caller_phone)
        db.add(cl)
        db.commit()
    # Emit call_start FIRST so the frontend can reset before any other event.
    await bus.emit("call_start", s.session_id, {
        "caller_phone": caller_phone,
        "session_id": s.session_id,
    })
    # Fire-and-forget Moss work. index_ready gates anything that needs the index.
    asyncio.create_task(_init_moss_session(s))
    asyncio.create_task(_preload_from_supermemory(s))
    return {"session_id": s.session_id}


def _similar_enough(a: str, b: str) -> bool:
    """True if two short utterances are likely the same speech (ASR rewrites
    like contraction changes, light punctuation drift). Uses stdlib difflib."""
    if not a or not b:
        return False
    # Cheap pre-filter: very different lengths can't be the same speech.
    if max(len(a), len(b)) > 0 and min(len(a), len(b)) / max(len(a), len(b)) < 0.7:
        return False
    return SequenceMatcher(None, a, b).ratio() >= 0.85


# ---------- ASR debounce ----------
#
# Each webhook in an ASR volley schedules (and cancels the prior) debounced
# turn task. Only the LAST scheduled task — the one that survives `DEBOUNCE_S`
# without being superseded — actually invokes `run_turn` against the coalesced
# transcript. The webhook handlers themselves return immediately with the
# previously-cached `pending_reply`, so AgentPhone is never blocked.


async def _debounced_turn(s, req_id: str, t_arrival: float) -> str:
    """Wait for a quiet period, then run a real Gemini turn on the latest
    coalesced transcript. Designed to be cancelled freely while sleeping
    or while waiting on the session lock.

    Returns the agent's reply text (or "" on no-op / abort), so the webhook
    handler that scheduled this task can await it and return the reply on
    the SAME HTTP response that closed the volley — instead of caching it
    for the next webhook (which would put the reply one turn behind).

    Reads:  s.pending_transcript, s.last_run_transcript, s.call_ended
    Writes: s.last_run_transcript, s.pending_reply, s.hangup_after_reply
    """
    await asyncio.sleep(DEBOUNCE_S)  # cancellation here propagates to the awaiter

    async with s.lock:
        if s.call_ended:
            log.info(
                "DEBOUNCE[%s] aborted (call_ended) call_id=%s",
                req_id, s.agentphone_call_id,
            )
            return ""
        transcript_to_run = (s.pending_transcript or "").strip()
        if not transcript_to_run:
            log.info("DEBOUNCE[%s] no-op (empty pending_transcript)", req_id)
            return ""
        if transcript_to_run == s.last_run_transcript:
            log.info(
                "DEBOUNCE[%s] no-op (transcript unchanged) transcript_len=%d",
                req_id, len(transcript_to_run),
            )
            return s.pending_reply or ""
        s.last_run_transcript = transcript_to_run
        s.last_caller_utterance = transcript_to_run
        s.current_req_id = req_id
        t_turn = time.perf_counter()
        try:
            reply = await run_turn(s, transcript_to_run, req_id=req_id)
        except Exception as e:  # noqa: BLE001
            log.exception("DEBOUNCE[%s] run_turn raised: %s", req_id, e)
            return s.pending_reply or ""
        turn_ms = (time.perf_counter() - t_turn) * 1000
        hangup = bool(s.hangup_after_reply)
        # When end_call fires, the agent.py end_call branch already set
        # pending_reply to the goodbye — don't overwrite. For normal turns
        # this becomes the sticky reply that any race-survivor webhooks
        # might still want to read.
        if not hangup:
            s.pending_reply = reply or ""
        total_wait_ms = (time.perf_counter() - t_arrival) * 1000
        log.info(
            "DEBOUNCE[%s] fired transcript_len=%d reply_len=%d turn_ms=%.0f total_wait_ms=%.0f hangup=%s state=%s preview=%r",
            req_id, len(transcript_to_run), len(reply or ""), turn_ms,
            total_wait_ms, hangup, s.current_state, (reply or "")[:80],
        )
        return reply or ""


def _schedule_debounced_turn(s, transcript: str, req_id: str, t_arrival: float) -> asyncio.Task:
    """Caller MUST hold s.lock. Updates pending_transcript to the latest
    seen text, cancels any prior in-flight debounced task, schedules a
    fresh one, and returns the new task so the caller can await it
    outside the lock.
    """
    s.pending_transcript = transcript or ""
    cancelled = s.cancel_pending_turn(reason="superseded_by_new_webhook")
    task = asyncio.create_task(_debounced_turn(s, req_id, t_arrival))
    s.pending_turn_task = task
    log.info(
        "WEBHOOK[%s] debounce scheduled transcript_len=%d delay_s=%.2f (prior task cancelled=%s)",
        req_id, len(transcript or ""), DEBOUNCE_S, cancelled,
    )
    return task


async def _await_scheduled_turn(s, task: asyncio.Task, req_id: str) -> str:
    """Await a debounced turn task scheduled by _schedule_debounced_turn.
    Returns the agent's reply on success, "" if a newer webhook cancelled
    this task (i.e. another webhook in the same ASR volley will deliver
    the reply on its own HTTP response).
    """
    try:
        return await task
    except asyncio.CancelledError:
        log.info(
            "WEBHOOK[%s] my debounce task cancelled by newer webhook — returning empty",
            req_id,
        )
        return ""
    except Exception as e:  # noqa: BLE001
        log.warning("WEBHOOK[%s] debounce task raised: %s", req_id, e)
        return s.pending_reply or ""


def _consume_hangup(s) -> bool:
    """If a hangup is pending, consume the flag exactly once and clear
    pending_reply so subsequent webhooks don't loop back into the
    `call_ended_deliver_goodbye` defensive branch."""
    if s.hangup_after_reply:
        s.hangup_after_reply = False
        s.pending_reply = ""
        return True
    return False


# ---------- AgentPhone webhook ----------

def _finalize(req_id: str, t_arrival: float, text: str, ctx: dict, hangup: bool = False) -> dict:
    """Single chokepoint for webhook returns. Emits RETURN + SUMMARY logs
    tagged with req_id so the user can grep for one correlation id and see
    every meaningful checkpoint of the request.

    When `hangup=True`, includes AgentPhone's documented `"hangup": true`
    body field so AgentPhone speaks `text` then ends the call (see
    https://docs.agentphone.ai/documentation/guides/webhooks).
    """
    total_ms = (time.perf_counter() - t_arrival) * 1000
    text_len = len(text or "")
    preview = (text or "")[:80]
    return_level = log.warning if total_ms > 25000 else log.info
    return_level(
        "WEBHOOK[%s] RETURN total=%.0fms text_len=%d hangup=%s preview=%r",
        req_id, total_ms, text_len, hangup, preview,
    )
    log.info(
        "SUMMARY[%s] event=%s caller_phone_tail=%s state=%s dedup=%s "
        "lock_ms=%s turn_ms=%s total_ms=%.0f return_text_len=%d hangup=%s branch=%s",
        req_id,
        ctx.get("event"),
        ctx.get("caller_tail"),
        ctx.get("state"),
        ctx.get("dedup"),
        ctx.get("lock_ms"),
        ctx.get("turn_ms"),
        total_ms,
        text_len,
        hangup,
        ctx.get("branch"),
    )
    body: dict = {"text": text}
    if hangup:
        body["hangup"] = True
    return body


async def _handle_agentphone_webhook(request: Request) -> dict:
    """Real AgentPhone webhook handler. Lenient parser — always returns {"text": ...}
    so we never play silence at the caller. Mounted at BOTH `/` and
    `/webhooks/agentphone` because AgentPhone POSTs to the registered URL exactly,
    and observed behaviour shows them hitting root."""
    req_id = uuid.uuid4().hex[:8]
    t_arrival = time.perf_counter()
    raw = b""
    try:
        raw = await request.body()
        body = json.loads(raw) if raw else {}
    except Exception:
        body = {}

    event = body.get("event") or ""
    channel = body.get("channel") or "voice"
    data = body.get("data") or {}
    caller = (data.get("from") or "").strip()
    incoming_call_id = (data.get("callId") or "").strip()
    caller_tail = caller[-4:] if caller else ""

    ctx: dict = {
        "event": event,
        "caller_tail": caller_tail,
        "state": None,
        "dedup": "none",
        "lock_ms": None,
        "turn_ms": None,
        "branch": "unknown",
    }

    log.info(
        "WEBHOOK[%s] arrived path=%s body_bytes=%d event=%s caller_tail=%s call_id=%s channel=%s transcript_present=%s",
        req_id, request.url.path, len(raw or b""), event, caller_tail,
        incoming_call_id, channel,
        isinstance(data.get("transcript"), str) and bool((data.get("transcript") or "").strip()),
    )
    # If caller phone is missing on an active-call webhook, dump the body at
    # INFO so we can diagnose payload-shape drift from AgentPhone. Otherwise
    # keep it at DEBUG to avoid flooding the log.
    if event in ("agent.message",) and not caller:
        log.info(
            "WEBHOOK[%s] caller missing on agent.message — body keys=%s data keys=%s body=%s",
            req_id, list(body.keys()), list(data.keys()), json.dumps(body)[:800],
        )
    else:
        log.debug("WEBHOOK[%s] body=%s", req_id, json.dumps(body)[:600])

    # Only voice for now. SMS would need a different reply shape.
    if channel != "voice":
        ctx["branch"] = "non_voice_channel"
        return _finalize(req_id, t_arrival, "", ctx)

    # Call ended → wrap up if we still have an active session.
    # IMPORTANT: only honor this event if its callId matches the session's
    # callId. AgentPhone sometimes re-delivers stale call_ended events from
    # PREVIOUS calls with the same phone number; without this check we'd end
    # the active call by mistake.
    if event in ("agent.call_ended", "call.ended", "call_ended"):
        ctx["branch"] = "call_ended"
        transcript_turns = data.get("transcript") if isinstance(data.get("transcript"), list) else []
        session_id_for_postcall = ""
        honored = False
        reason = "no_active_session"
        if caller:
            s = call_session.by_caller(caller)
            if s:
                ctx["state"] = s.current_state
                if s.agentphone_call_id and incoming_call_id and s.agentphone_call_id != incoming_call_id:
                    log.warning(
                        "WEBHOOK[%s] call_ended IGNORED stale: event callId=%s but active session callId=%s",
                        req_id, incoming_call_id, s.agentphone_call_id,
                    )
                    ctx["branch"] = "call_ended_ignored_stale"
                    return _finalize(req_id, t_arrival, "", ctx)
                session_id_for_postcall = s.session_id
                honored = True
                reason = "matched_active_session"
                # Stop any debounced turn task so it doesn't run Gemini
                # against a session we're about to tear down.
                if s.cancel_pending_turn(reason="call_ended_event"):
                    log.info(
                        "WEBHOOK[%s] cancelled pending debounce task on call_ended event",
                        req_id,
                    )
                try:
                    await end_call_tool(s)
                except Exception as e:  # noqa: BLE001
                    log.warning("WEBHOOK[%s] end_call_tool failed: %s", req_id, e)
                call_session.end(s.session_id)
            else:
                reason = "no_session_for_caller"
        else:
            reason = "no_caller_in_event"
        log.info(
            "WEBHOOK[%s] call_ended honored=%s reason=%s transcript_turns=%d",
            req_id, honored, reason, len(transcript_turns) if isinstance(transcript_turns, list) else 0,
        )
        # Fire-and-forget retroactive WO extraction. This survives the
        # session being torn down because it takes primitive args.
        if session_id_for_postcall and transcript_turns:
            asyncio.create_task(
                extract_and_create_wo(session_id_for_postcall, caller, transcript_turns)
            )
        return _finalize(req_id, t_arrival, "", ctx)

    # For active-call events, transcript is the caller's latest utterance (string).
    raw_t = data.get("transcript")
    transcript = raw_t.strip() if isinstance(raw_t, str) else ""

    if not caller:
        ctx["branch"] = "missing_caller"
        return _finalize(req_id, t_arrival, "Sorry, I lost the line for a moment.", ctx)

    s = call_session.by_caller(caller)

    # First contact for this caller → start a session.
    # Two sub-branches:
    #   (a) transcript is empty: AgentPhone hasn't played any opener yet and
    #       the caller hasn't spoken. We speak our greeting; that becomes the
    #       call's opening line. Record it in history + memory + dashboard.
    #   (b) transcript is non-empty: AgentPhone already played its own opener
    #       and the caller has already spoken. We must NOT prepend our greeting
    #       (the caller never hears it AND a doubled opener confuses ASR). We
    #       also must NOT push the greeting into history / memory / dashboard
    #       transcript — it never happened. Just run the turn and return the
    #       agent reply.
    if s is None:
        ctx["branch"] = "first_contact"
        await _start_call(caller, agentphone_call_id=incoming_call_id)
        s = call_session.by_caller(caller)
        greeting = "Hi, thanks for calling ChargeForward — this is Volt. How can I help?"
        if not transcript or s is None:
            log.info(
                "WEBHOOK[%s] FIRST_CONTACT caller_tail=%s transcript_present=False prepending_greeting=True branch=greeting_only",
                req_id, caller_tail,
            )
            if s is not None:
                s.current_req_id = req_id
                ctx["state"] = s.current_state
                s.history.append({"role": "model", "parts": [{"text": greeting}]})
                try:
                    await memory_tool.append_turn(s, "agent", greeting)
                except Exception as e:  # noqa: BLE001
                    log.warning("WEBHOOK[%s] greeting append_turn failed: %s", req_id, e)
                await bus.emit("transcript", s.session_id, {"role": "agent", "text": greeting})
                s.pending_reply = greeting
            ctx["branch"] = "first_contact_greeting_only"
            return _finalize(req_id, t_arrival, greeting, ctx)
        # Non-empty transcript: AgentPhone already greeted, caller already spoke.
        # Route through the same debounce as ongoing turns so the first turn
        # benefits from the ASR-volley wait. We AWAIT the scheduled task so
        # the reply rides out on the same HTTP response that closed the
        # volley — no "one turn behind" effect.
        s.current_req_id = req_id
        ctx["state"] = s.current_state
        log.info(
            "WEBHOOK[%s] FIRST_CONTACT caller_tail=%s transcript_present=True prepending_greeting=False "
            "branch=with_turn — debouncing first turn (awaiting task). transcript_len=%d",
            req_id, caller_tail, len(transcript),
        )
        t_lock_req = time.perf_counter()
        log.info("WEBHOOK[%s] awaiting session lock (locked=%s)", req_id, s.lock.locked())
        async with s.lock:
            lock_ms = (time.perf_counter() - t_lock_req) * 1000
            ctx["lock_ms"] = f"{lock_ms:.0f}"
            _log_lock_acquired(req_id, lock_ms)
            s.last_caller_utterance = transcript
            my_task = _schedule_debounced_turn(s, transcript, req_id, t_arrival)
        reply = await _await_scheduled_turn(s, my_task, req_id)
        hangup = _consume_hangup(s)
        ctx["state"] = s.current_state
        ctx["branch"] = "first_contact_with_turn_debounced"
        return _finalize(req_id, t_arrival, reply, ctx, hangup=hangup)

    # If we don't yet have a callId stored (e.g. session created before
    # AgentPhone sent one), pick it up from this event.
    if not s.agentphone_call_id and incoming_call_id:
        s.agentphone_call_id = incoming_call_id
    s.current_req_id = req_id
    ctx["state"] = s.current_state

    # Ongoing call — run the turn loop on the caller's transcript.
    # Serialize via per-session lock; AgentPhone occasionally delivers
    # overlapping webhooks for the same call which used to race the agent.
    if not transcript:
        ctx["branch"] = "no_transcript"
        ctx["dedup"] = "empty"
        log.info("WEBHOOK[%s] dedup=empty (no transcript in webhook)", req_id)
        return _finalize(req_id, t_arrival, "", ctx)

    t_lock_req = time.perf_counter()
    log.info("WEBHOOK[%s] awaiting session lock (locked=%s)", req_id, s.lock.locked())
    async with s.lock:
        lock_ms = (time.perf_counter() - t_lock_req) * 1000
        ctx["lock_ms"] = f"{lock_ms:.0f}"
        _log_lock_acquired(req_id, lock_ms)
        if s.call_ended:
            # Defensive: end_call has already fully run. If a hangup is
            # still pending (rare — would mean the goodbye couldn't ride
            # its triggering webhook for some reason), deliver it here
            # and clear the flag.
            if s.hangup_after_reply and s.pending_reply:
                ctx["branch"] = "call_ended_deliver_goodbye"
                goodbye = s.pending_reply
                log.info(
                    "WEBHOOK[%s] delivering deferred goodbye len=%d hangup=True call_id=%s",
                    req_id, len(goodbye), s.agentphone_call_id,
                )
                s.pending_reply = ""
                s.hangup_after_reply = False
                return _finalize(req_id, t_arrival, goodbye, ctx, hangup=True)
            ctx["branch"] = "call_already_ended"
            log.info(
                "WEBHOOK[%s] post-end_call webhook dropped (caller still talking?) "
                "transcript_preview=%r call_id=%s",
                req_id, (transcript or "")[:60], s.agentphone_call_id,
            )
            return _finalize(req_id, t_arrival, "", ctx)

        # ASR debounce: AgentPhone splits a single caller utterance across
        # multiple webhooks (intra-utterance gaps up to 2.8s). Each webhook
        # overwrites pending_transcript with the latest text, cancels the
        # prior debounced task, schedules a fresh one, and AWAITS it.
        # When a newer webhook cancels this one, our await throws
        # CancelledError and we return empty. The last-surviving webhook's
        # task completes normally and its reply rides out on the same
        # HTTP response — no "one turn behind" effect.
        #
        # Dedup classification is kept for log clarity only.
        prev = s.last_caller_utterance
        dedup_kind = "none"
        if prev:
            if transcript == prev:
                dedup_kind = "identical"
            elif transcript.startswith(prev) or prev.startswith(transcript):
                dedup_kind = "prefix"
            elif _similar_enough(transcript, prev):
                dedup_kind = "fuzzy"
        ctx["dedup"] = dedup_kind
        s.last_caller_utterance = transcript
        log.info(
            "WEBHOOK[%s] dedup_kind=%s prev_len=%d now_len=%d — debouncing (will await)",
            req_id, dedup_kind, len(prev), len(transcript),
        )
        my_task = _schedule_debounced_turn(s, transcript, req_id, t_arrival)
        ctx["branch"] = "ongoing_debounce_scheduled"
    reply = await _await_scheduled_turn(s, my_task, req_id)
    hangup = _consume_hangup(s)
    ctx["state"] = s.current_state
    return _finalize(req_id, t_arrival, reply, ctx, hangup=hangup)


def _log_lock_acquired(req_id: str, lock_ms: float) -> None:
    if lock_ms > 500:
        log.warning("WEBHOOK[%s] lock acquired after %.0fms (>500ms!)", req_id, lock_ms)
    else:
        log.info("WEBHOOK[%s] lock acquired after %.0fms", req_id, lock_ms)


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
