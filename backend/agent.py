"""Gemini 2.5 Flash turn loop. Text in, text out. Function calling drives the
state machine."""
from __future__ import annotations

import json
import logging
import time
import uuid

from google import genai
from google.genai import types as gtypes

from backend import config
from backend.observer import bus
from backend.session import CallSession
from backend.state_machine import system_prompt
from backend.tools import memory as memory_tool
from backend.tools.registry import dispatch, tools_for_state

log = logging.getLogger("volt.agent")

_client: genai.Client | None = None


def _gemini() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=config.GEMINI_API_KEY)
    return _client


def _to_part(text: str) -> gtypes.Part:
    return gtypes.Part(text=text)


def _content(role: str, text: str | None = None, parts: list[gtypes.Part] | None = None) -> gtypes.Content:
    return gtypes.Content(role=role, parts=parts or [_to_part(text or "")])


def _serialize_history(s: CallSession) -> list[gtypes.Content]:
    """Rebuild gtypes.Content list from the session's raw history dicts."""
    out: list[gtypes.Content] = []
    for turn in s.history:
        role = turn["role"]
        parts: list[gtypes.Part] = []
        for p in turn.get("parts", []):
            if "text" in p:
                parts.append(gtypes.Part(text=p["text"]))
            elif "function_call" in p:
                fc = p["function_call"]
                parts.append(gtypes.Part(function_call=gtypes.FunctionCall(name=fc["name"], args=fc.get("args") or {})))
            elif "function_response" in p:
                fr = p["function_response"]
                parts.append(gtypes.Part(function_response=gtypes.FunctionResponse(name=fr["name"], response=fr.get("response") or {})))
        out.append(gtypes.Content(role=role, parts=parts))
    return out


def _record_turn(s: CallSession, role: str, parts: list[dict]) -> None:
    s.history.append({"role": role, "parts": parts})


async def run_turn(s: CallSession, user_text: str, req_id: str = "") -> str:
    """Single webhook → reply turn. Drives Gemini with the current state's tools,
    executes any tool calls, loops until Gemini produces user-facing text.
    Returns the final text to send back to AgentPhone.

    `req_id` is a best-effort correlation id propagated from the webhook
    handler so logs across this turn (Gemini, tools, memory) can be grep'd
    by a single id. Defaults to "" so direct callers (simulator etc.) still work.
    """
    # Best-effort propagation: stash on session so tool dispatch can grab it.
    try:
        if req_id:
            s.current_req_id = req_id
        elif s.current_req_id:
            req_id = s.current_req_id
    except Exception:  # noqa: BLE001
        pass

    t_turn_start = time.perf_counter()
    log.info(
        "TURN[%s] start state=%s history_turns=%d user_text_len=%d preview=%r",
        req_id, s.current_state, len(s.history), len(user_text or ""), (user_text or "")[:80],
    )

    await bus.emit("transcript", s.session_id, {"role": "caller", "text": user_text})
    # Index the user turn into the session Moss cache
    try:
        await memory_tool.append_turn(s, "caller", user_text)
    except Exception as e:  # noqa: BLE001
        log.warning("[req_id=%s] append_turn caller failed: %s", req_id, e)

    _record_turn(s, "user", [{"text": user_text}])

    # Loop until model returns a plain-text reply (no more function calls queued).
    # Tools whose result the model genuinely needs to see before forming its
    # reply. Transition tools (advance_to_*, route_to_*) don't qualify — they
    # only change the next turn's tool set, and the model already produced
    # reply text alongside them, so we short-circuit and avoid an extra Gemini
    # round-trip per webhook. Big latency win.
    NEEDS_RESPONSE_LOOP = {
        "recall_session", "recall_knowledge",
        "get_charger_telemetry",
        "send_remote_command", "create_work_order",
        "generate_report",
    }

    for hop in range(4):  # safety cap (reduced from 8 — most turns finish in 1-2)
        tools = tools_for_state(s.current_state)
        sys = system_prompt(s.current_state)
        history = _serialize_history(s)

        tool_names = [d["name"] for t in tools for d in t.get("function_declarations", [])]
        log.info(
            "[req_id=%s] GEMINI > state=%s hop=%d history_turns=%d tools=%s",
            req_id, s.current_state, hop, len(history), tool_names,
        )
        log.debug("[req_id=%s] GEMINI > system_instruction=%r", req_id, sys)
        log.debug("[req_id=%s] GEMINI > history=%s", req_id, json.dumps(s.history, default=str)[:2000])

        t0 = time.perf_counter()
        try:
            resp = await _gemini().aio.models.generate_content(
                model=config.GEMINI_MODEL,
                contents=history,
                config=gtypes.GenerateContentConfig(
                    system_instruction=sys,
                    tools=tools,
                    temperature=0.4,
                    # CRITICAL: google-genai's Automatic Function Calling tries
                    # to execute function calls locally by looking for Python
                    # callables in `tools`. We pass plain dicts (function
                    # declarations), so AFC silently strips the response and
                    # we get candidates_tokens=None. Disable it.
                    automatic_function_calling=gtypes.AutomaticFunctionCallingConfig(disable=True),
                ),
            )
        except Exception as e:  # noqa: BLE001
            log.exception("[req_id=%s] GEMINI ! call failed: %s", req_id, e)
            s.last_debug = {
                "state": s.current_state,
                "hop": hop,
                "system_instruction": sys,
                "tools": tool_names,
                "history": s.history,
                "error": repr(e),
            }
            reply = "Sorry, I had a hiccup on my end. Could you repeat that?"
            await bus.emit("transcript", s.session_id, {"role": "agent", "text": reply, "error": str(e)})
            total_ms = (time.perf_counter() - t_turn_start) * 1000
            log.info(
                "TURN[%s] done total_ms=%.0f hops=%d final_state=%s reply_len=%d outcome=gemini_error",
                req_id, total_ms, hop + 1, s.current_state, len(reply),
            )
            return reply
        gemini_ms = (time.perf_counter() - t0) * 1000
        await bus.emit("latency_sample", s.session_id, {"component": "gemini", "ms": gemini_ms})
        try:
            usage = getattr(resp, "usage_metadata", None)
            finish = getattr((resp.candidates or [None])[0], "finish_reason", None)
            log.info(
                "[req_id=%s] GEMINI < %.0fms finish=%s prompt_tokens=%s candidates_tokens=%s",
                req_id, gemini_ms, finish,
                getattr(usage, "prompt_token_count", None) if usage else None,
                getattr(usage, "candidates_token_count", None) if usage else None,
            )
        except Exception:  # noqa: BLE001
            pass

        candidate = (resp.candidates or [None])[0]
        if not candidate or not candidate.content or not candidate.content.parts:
            reply = "Could you repeat that?"
            await bus.emit("transcript", s.session_id, {"role": "agent", "text": reply})
            total_ms = (time.perf_counter() - t_turn_start) * 1000
            log.info(
                "TURN[%s] done total_ms=%.0f hops=%d final_state=%s reply_len=%d outcome=empty_candidate",
                req_id, total_ms, hop + 1, s.current_state, len(reply),
            )
            return reply

        # Split parts: function calls vs text
        function_calls: list[gtypes.FunctionCall] = []
        text_chunks: list[str] = []
        recorded_parts: list[dict] = []
        for part in candidate.content.parts:
            if part.function_call:
                function_calls.append(part.function_call)
                recorded_parts.append({
                    "function_call": {"name": part.function_call.name, "args": dict(part.function_call.args or {})},
                })
            elif part.text:
                text_chunks.append(part.text)
                recorded_parts.append({"text": part.text})
        log.info(
            "[req_id=%s] GEMINI < parts: %d function_calls=%s text=%r",
            req_id, len(candidate.content.parts),
            [(fc.name, dict(fc.args or {})) for fc in function_calls],
            (" ".join(text_chunks))[:200],
        )
        s.last_debug = {
            "state": s.current_state,
            "hop": hop,
            "system_instruction": sys,
            "tools": tool_names,
            "history": s.history,
            "response_parts": recorded_parts,
            "duration_ms": gemini_ms,
        }
        _record_turn(s, "model", recorded_parts)

        # Execute every queued tool call
        if function_calls:
            tool_response_parts: list[dict] = []
            for fc in function_calls:
                request_id = uuid.uuid4().hex[:8]
                args = dict(fc.args or {})
                await bus.emit("tool_call_start", s.session_id, {
                    "request_id": request_id, "tool": fc.name, "args": args,
                })
                log.info(
                    "TOOL[%s] start name=%s tool_req=%s args=%s",
                    req_id, fc.name, request_id, json.dumps(args, default=str)[:200],
                )
                tstart = time.perf_counter()
                try:
                    result = await dispatch(s, fc.name, args)
                    ok = "error" not in (result or {})
                except Exception as e:  # noqa: BLE001
                    log.exception("[req_id=%s] tool %s failed", req_id, fc.name)
                    result = {"error": str(e)}
                    ok = False
                duration_ms = (time.perf_counter() - tstart) * 1000
                preview = _result_preview(result)
                log.info(
                    "TOOL[%s] end name=%s tool_req=%s duration_ms=%.0f ok=%s preview=%r",
                    req_id, fc.name, request_id, duration_ms, ok, preview[:160],
                )
                await bus.emit("tool_call_end", s.session_id, {
                    "request_id": request_id,
                    "tool": fc.name,
                    "result_preview": preview,
                    "duration_ms": duration_ms,
                    "ok": ok,
                    "confidence": args.get("confidence"),
                    "reason": args.get("reason"),
                })
                tool_response_parts.append({
                    "function_response": {"name": fc.name, "response": result or {}},
                })
                if fc.name == "end_call":
                    # Don't loop further; reply if model already produced text, else a polite goodbye.
                    reply = " ".join(text_chunks).strip() or "Thanks for calling. Have a great day."
                    _record_turn(s, "user", tool_response_parts)
                    # Stash the goodbye on the session so the webhook handler
                    # can include it in {"text": <goodbye>, "hangup": true}.
                    # end_call tool already set hangup_after_reply=True and
                    # cleared any stale pending_reply, so this is the new
                    # canonical reply for the single remaining HTTP response.
                    s.pending_reply = reply
                    await bus.emit("transcript", s.session_id, {"role": "agent", "text": reply})
                    total_ms = (time.perf_counter() - t_turn_start) * 1000
                    log.info(
                        "END_CALL[%s] returning goodbye len=%d preview=%r hangup_via=response_flag",
                        req_id, len(reply), reply[:120],
                    )
                    log.info(
                        "TURN[%s] done total_ms=%.0f hops=%d final_state=%s reply_len=%d outcome=end_call",
                        req_id, total_ms, hop + 1, s.current_state, len(reply),
                    )
                    return reply

            _record_turn(s, "user", tool_response_parts)

            # Short-circuit: if every tool the model called was a pure
            # transition / state-change tool, the model has already produced
            # the reply text and there's no value re-calling Gemini just to
            # acknowledge the transition. Send the existing text now; the
            # next webhook will be in the new state.
            called = {fc.name for fc in function_calls}
            needs_followup = bool(called & NEEDS_RESPONSE_LOOP)
            if not needs_followup and text_chunks:
                reply = " ".join(text_chunks).strip()
                if not reply:
                    reply = _filler_for_state(s.current_state)
                try:
                    await memory_tool.append_turn(s, "agent", reply)
                except Exception as e:  # noqa: BLE001
                    log.warning("[req_id=%s] append_turn agent (short-circuit) failed: %s", req_id, e)
                await bus.emit("transcript", s.session_id, {"role": "agent", "text": reply})
                total_ms = (time.perf_counter() - t_turn_start) * 1000
                log.info(
                    "TURN[%s] done total_ms=%.0f hops=%d final_state=%s reply_len=%d outcome=short_circuit_transition",
                    req_id, total_ms, hop + 1, s.current_state, len(reply),
                )
                return reply

            # Otherwise loop: send tool responses back to Gemini for a follow-up
            continue

        # No tool calls — we have a user-facing reply
        reply = " ".join(text_chunks).strip()
        if not reply:
            # Safety net: never return empty text → caller hears silence.
            reply = _filler_for_state(s.current_state)
        try:
            await memory_tool.append_turn(s, "agent", reply)
        except Exception as e:  # noqa: BLE001
            log.warning("[req_id=%s] append_turn agent failed: %s", req_id, e)
        await bus.emit("transcript", s.session_id, {"role": "agent", "text": reply})
        total_ms = (time.perf_counter() - t_turn_start) * 1000
        log.info(
            "TURN[%s] done total_ms=%.0f hops=%d final_state=%s reply_len=%d outcome=text_reply",
            req_id, total_ms, hop + 1, s.current_state, len(reply),
        )
        return reply

    # Hit safety cap
    fallback = "Let me make sure I understood — could you say that again?"
    await bus.emit("transcript", s.session_id, {"role": "agent", "text": fallback})
    total_ms = (time.perf_counter() - t_turn_start) * 1000
    log.warning(
        "TURN[%s] done total_ms=%.0f hops=4 final_state=%s reply_len=%d outcome=safety_cap_fallback",
        req_id, total_ms, s.current_state, len(fallback),
    )
    return fallback


_STATE_FILLERS = {
    "greeting":         "One moment, let me get you set up.",
    "scoping":          "Got it — let me make sure I understand.",
    "triage":           "OK, working out what category this falls under.",
    "resolve_user":     "Walking through this with you, one sec.",
    "resolve_software": "Let me check the charger's status.",
    "resolve_hardware": "Pulling up the charger's diagnostics.",
    "wrap_up":          "Wrapping things up now.",
    "ended":            "Thanks for calling — have a great day.",
}


def _filler_for_state(state: str) -> str:
    return _STATE_FILLERS.get(state, "One moment.")


def _result_preview(result: dict | None) -> str:
    if not result:
        return ""
    if "error" in result:
        return f"error: {result['error']}"
    interesting_keys = ("work_order_id", "command_id", "report_id", "new_state", "charger_id", "tier", "hit")
    bits = []
    for k in interesting_keys:
        if k in result:
            bits.append(f"{k}={result[k]}")
    if bits:
        return ", ".join(bits)
    return json.dumps(result)[:120]
