"""AI-powered handler for inbound technician emails.

Entry point: handle_technician_email(dispatch, wo, extracted_text, message_id)

Flow:
  1. Classify intent (Gemini, function-calling, one-shot)
  2. Route to sub-handler: accepted | question | done | unclear
  3. Sub-handler builds a grounded reply from charger data + memory
  4. Reply via AgentMail, update labels, emit WS events
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from google import genai
from google.genai import types as gtypes

from backend import config
from backend.agentmail_client import am_client
from backend.db import models
from backend.db.session import get_session
from backend.memory import moss_client, supermemory_client
from backend.observer import bus

log = logging.getLogger("volt.tech_agent")

_gemini_client: genai.Client | None = None


def _gemini() -> genai.Client:
    global _gemini_client
    if _gemini_client is None:
        _gemini_client = genai.Client(api_key=config.GEMINI_API_KEY)
    return _gemini_client


# ---------- Classifier function declarations ----------

_CLASSIFIER_TOOLS = [{"function_declarations": [
    {
        "name": "classify_accepted",
        "description": "Technician accepted the dispatch (e.g. 'accepted', 'on my way', 'confirmed', 'will attend', 'heading over').",
        "parameters": {"type": "OBJECT", "properties": {}, "required": []},
    },
    {
        "name": "classify_question",
        "description": "Technician is asking a factual question about the charger, fault history, parts, or repair procedure.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "question_text": {
                    "type": "STRING",
                    "description": "The specific question, extracted verbatim or paraphrased concisely.",
                }
            },
            "required": ["question_text"],
        },
    },
    {
        "name": "classify_done",
        "description": "Technician reports the job is complete (e.g. 'done', 'fixed', 'resolved', 'completed', 'finished', 'all good').",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "resolution_note": {
                    "type": "STRING",
                    "description": "Brief summary of what was done, if the technician stated it. Empty string if not mentioned.",
                }
            },
            "required": [],
        },
    },
    {
        "name": "classify_unclear",
        "description": "Intent cannot be clearly determined from the email. Use only if none of the above fit.",
        "parameters": {"type": "OBJECT", "properties": {}, "required": []},
    },
]}]

_CLASSIFIER_SYSTEM = (
    "You are a dispatch coordinator for an EV charging network. "
    "A field technician has replied to a work order email. "
    "Classify their intent by calling exactly one of the provided functions. "
    "Do not produce any text output — only a function call."
)


# ---------- Helpers ----------

def _now() -> datetime:
    return datetime.now(timezone.utc)


def _charger_context(charger_id: str) -> str:
    """Read the last 1500 chars of the charger summary markdown."""
    path = config.DATA_RAG_DIR / f"{charger_id.lower()}_summary.md"
    if not path.exists():
        return f"(No summary file found for {charger_id})"
    text = path.read_text()
    return text[-1500:] if len(text) > 1500 else text


def _html(text: str) -> str:
    """Minimal plain-text → HTML conversion for email body."""
    lines = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").split("\n")
    return "<br>\n".join(lines)


def _append_thread_entry(dispatch: models.TechnicianDispatch, direction: str, from_: str, subject: str, body: str) -> None:
    thread: list = json.loads(dispatch.email_thread or "[]")
    thread.append({
        "direction": direction,
        "from": from_,
        "subject": subject,
        "body": body,
        "timestamp": _now().isoformat(),
    })
    dispatch.email_thread = json.dumps(thread)


async def _emit_events(dispatch: models.TechnicianDispatch, wo: models.WorkOrder, direction: str, from_: str, subject: str, body_preview: str) -> None:
    thread: list = json.loads(dispatch.email_thread or "[]")
    await bus.emit("technician_email", None, {
        "wo_id": wo.id,
        "direction": direction,
        "from": from_,
        "subject": subject,
        "body_preview": body_preview,
    })
    await bus.emit("dispatch_update", None, {
        "wo_id": wo.id,
        "status": dispatch.status,
        "technician_email": dispatch.technician_email,
        "inbox_id": dispatch.agentmail_inbox_id,
        "thread_count": len(thread),
    })


# ---------- Sub-handlers ----------

async def _handle_accepted(dispatch: models.TechnicianDispatch, wo: models.WorkOrder, inbound_subject: str, message_id: str) -> None:
    # Capture before any session operations (detached-object safety)
    inbox_id = dispatch.agentmail_inbox_id
    wo_id = wo.id
    charger_id = wo.charger_id

    body_text = (
        f"Hi,\n\n"
        f"Thanks for accepting Work Order WO-{wo_id}.\n\n"
        f"We're assigning you to charger {charger_id.upper()} — you're all set to head on-site.\n\n"
        f"Let me know if you have any questions, or reply \"done\" when the repair is complete.\n\n"
        f"— Volt Dispatch System\n"
    )
    subject = f"Re: [VoltDispatch] WO-{wo_id} — Confirmed"

    with get_session() as db:
        dispatch_row = db.get(models.TechnicianDispatch, dispatch.id)
        if dispatch_row:
            dispatch_row.status = "in_progress"
            db.add(dispatch_row)
        wo_row = db.get(models.WorkOrder, wo_id)
        if wo_row:
            wo_row.status = "in_progress"
            db.add(wo_row)
        db.commit()

    try:
        await am_client.reply(inbox_id, message_id, text=body_text, html=_html(body_text))
        await am_client.update_labels(inbox_id, message_id, add=["replied"], remove=["unreplied"])
    except Exception as e:
        log.warning("Failed to send acceptance reply for WO-%d: %s", wo_id, e)

    _append_thread_entry(dispatch, "outbound", f"wo-{wo.id}@agentmail.to", subject, body_text)
    with get_session() as db:
        db.add(dispatch)
        db.commit()

    await _emit_events(dispatch, wo, "outbound", f"wo-{wo.id}@agentmail.to", subject, body_text)
    log.info("Technician accepted WO-%d; sent charger history", wo.id)


async def _handle_question(dispatch: models.TechnicianDispatch, wo: models.WorkOrder, question_text: str, message_id: str) -> None:
    moss_res = await moss_client.query("volt-kb", question_text, top_k=5)
    moss_ctx = "\n".join(f"[KB] {h.text[:400]}" for h in moss_res.hits) or "(no KB results)"

    sm_res = await supermemory_client.search(question_text, container_tag=wo.charger_id, top_k=3)
    sm_ctx = "\n".join(f"[History] {h.text[:400]}" for h in sm_res.hits) if hasattr(sm_res, "hits") else ""

    context = f"{moss_ctx}\n{sm_ctx}".strip()

    answer_prompt = f"""\
A field technician servicing charger {wo.charger_id.upper()} (Work Order WO-{wo.id}) asks:

"{question_text}"

Use only the following retrieved context to answer. Be concise and actionable for a field technician.
If the context doesn't contain enough information, say so honestly.

CONTEXT:
{context}
"""
    resp = await _gemini().aio.models.generate_content(
        model=config.GEMINI_MODEL,
        contents=[gtypes.Content(role="user", parts=[gtypes.Part(text=answer_prompt)])],
        config=gtypes.GenerateContentConfig(
            system_instruction="You are a technical support assistant for EV charging infrastructure. Answer field technician questions concisely and accurately based only on the provided context.",
            temperature=0.2,
        ),
    )
    answer = (resp.text or "I don't have enough information to answer that confidently. Please contact your supervisor.").strip()

    body_text = f"""\
Hi,

In answer to your question:

"{question_text}"

ANSWER
------
{answer}

Reply "done" when the job is complete, or ask another question.

— Volt Dispatch System
"""
    subject = f"Re: [VoltDispatch] WO-{wo.id} — Answer"

    with get_session() as db:
        if dispatch.status == "dispatched":
            dispatch.status = "in_progress"
            wo_row = db.get(models.WorkOrder, wo.id)
            if wo_row and wo_row.status == "dispatched":
                wo_row.status = "in_progress"
                db.add(wo_row)
        db.add(dispatch)
        db.commit()
        db.refresh(dispatch)

    await am_client.reply(dispatch.agentmail_inbox_id, message_id, text=body_text, html=_html(body_text))
    await am_client.update_labels(dispatch.agentmail_inbox_id, message_id, add=["replied"], remove=["unreplied"])

    _append_thread_entry(dispatch, "outbound", f"wo-{wo.id}@agentmail.to", subject, body_text)
    with get_session() as db:
        db.add(dispatch)
        db.commit()

    await _emit_events(dispatch, wo, "outbound", f"wo-{wo.id}@agentmail.to", subject, body_text)
    log.info("Answered technician question for WO-%d: %r", wo.id, question_text[:80])


async def _handle_done(dispatch: models.TechnicianDispatch, wo: models.WorkOrder, resolution_note: str, message_id: str) -> None:
    completed_at = _now()
    body_text = f"""\
Hi,

Work Order WO-{wo.id} for charger {wo.charger_id.upper()} has been marked complete.
{f"Resolution: {resolution_note}" if resolution_note else ""}
Completed at: {completed_at.strftime('%Y-%m-%d %H:%M UTC')}

The dashboard has been updated. Great work!

— Volt Dispatch System
"""
    subject = f"Re: [VoltDispatch] WO-{wo.id} — Closed"

    with get_session() as db:
        dispatch.status = "complete"
        dispatch.completed_at = completed_at
        wo_row = db.get(models.WorkOrder, wo.id)
        if wo_row:
            wo_row.status = "complete"
            if resolution_note:
                wo_row.reason = resolution_note
            db.add(wo_row)
        db.add(dispatch)
        db.commit()
        db.refresh(dispatch)

    await am_client.reply(dispatch.agentmail_inbox_id, message_id, text=body_text, html=_html(body_text))
    await am_client.update_labels(dispatch.agentmail_inbox_id, message_id, add=["replied"], remove=["unreplied"])

    _append_thread_entry(dispatch, "outbound", f"wo-{wo.id}@agentmail.to", subject, body_text)
    with get_session() as db:
        db.add(dispatch)
        db.commit()

    await _emit_events(dispatch, wo, "outbound", f"wo-{wo.id}@agentmail.to", subject, body_text)
    log.info("WO-%d marked complete by technician", wo.id)


async def _handle_unclear(dispatch: models.TechnicianDispatch, wo: models.WorkOrder, message_id: str) -> None:
    body_text = f"""\
Hi,

Thanks for your message regarding Work Order WO-{wo.id}.

Could you clarify your intent? Please reply with one of:
  • "accepted" — to confirm you are en route
  • A specific question about the charger or repair
  • "done" — when the job is complete

— Volt Dispatch System
"""
    subject = f"Re: [VoltDispatch] WO-{wo.id} — Clarification Needed"

    await am_client.reply(dispatch.agentmail_inbox_id, message_id, text=body_text, html=_html(body_text))
    await am_client.update_labels(dispatch.agentmail_inbox_id, message_id, add=["replied"], remove=["unreplied"])

    _append_thread_entry(dispatch, "outbound", f"wo-{wo.id}@agentmail.to", subject, body_text)
    with get_session() as db:
        db.add(dispatch)
        db.commit()

    await _emit_events(dispatch, wo, "outbound", f"wo-{wo.id}@agentmail.to", subject, body_text)


# ---------- Intent classifier ----------

def _keyword_classify(text: str) -> tuple[str, str, str]:
    """Fast keyword fallback used when Gemini is unavailable."""
    t = text.lower()
    done_words = ["done", "fixed", "complete", "finished", "resolved", "all good", "all done", "job done", "repaired"]
    accept_words = ["accept", "accepted", "on my way", "heading over", "heading there", "will attend", "confirmed", "i'll be there", "omw", "ok ", "okay", "sure", "yes", "got it", "acknowledged"]
    if any(w in t for w in done_words):
        return "done", "", text.strip()
    if any(w in t for w in accept_words) and "?" not in t:
        return "accepted", "", ""
    if "?" in t:
        return "question", text.strip(), ""
    return "unclear", "", ""


async def _classify(wo: models.WorkOrder, extracted_text: str) -> tuple[str, str, str]:
    """Returns (intent, question_text, resolution_note). Tries Gemini, falls back to keywords."""
    if not config.GEMINI_API_KEY:
        return _keyword_classify(extracted_text)

    classifier_prompt = (
        f"Work Order WO-{wo.id} — Charger {wo.charger_id.upper()}\n"
        f"Symptoms: {wo.symptoms}\n\n"
        f"Technician email:\n---\n{extracted_text}\n---"
    )
    try:
        resp = await _gemini().aio.models.generate_content(
            model=config.GEMINI_MODEL,
            contents=[gtypes.Content(role="user", parts=[gtypes.Part(text=classifier_prompt)])],
            config=gtypes.GenerateContentConfig(
                system_instruction=_CLASSIFIER_SYSTEM,
                tools=_CLASSIFIER_TOOLS,
                temperature=0.1,
            ),
        )
        candidate = (resp.candidates or [None])[0]
        if candidate and candidate.content:
            for part in candidate.content.parts:
                if not part.function_call:
                    continue
                fn = part.function_call.name
                args = dict(part.function_call.args or {})
                if fn == "classify_accepted":
                    return "accepted", "", ""
                if fn == "classify_question":
                    return "question", args.get("question_text", extracted_text), ""
                if fn == "classify_done":
                    return "done", "", args.get("resolution_note", "")
                return "unclear", "", ""
    except Exception:
        log.exception("Gemini classify failed, using keywords")

    return _keyword_classify(extracted_text)


# ---------- Entry point ----------

async def handle_technician_email(
    dispatch: models.TechnicianDispatch,
    wo: models.WorkOrder,
    extracted_text: str,
    message_id: str,
    from_email: str,
    subject: str,
) -> None:
    # Record inbound email in thread first
    _append_thread_entry(dispatch, "inbound", from_email, subject, extracted_text)
    with get_session() as db:
        db.add(dispatch)
        db.commit()

    await _emit_events(dispatch, wo, "inbound", from_email, subject, extracted_text)

    log.info("WO-%d classifying body (len=%d): %r", wo.id, len(extracted_text), extracted_text[:120])
    intent, question_text, resolution_note = await _classify(wo, extracted_text)
    log.info("WO-%d intent=%s question=%r", wo.id, intent, question_text[:80] if question_text else "")

    if intent == "accepted":
        await _handle_accepted(dispatch, wo, subject, message_id)
    elif intent == "question":
        await _handle_question(dispatch, wo, question_text, message_id)
    elif intent == "done":
        await _handle_done(dispatch, wo, resolution_note, message_id)
    else:
        await _handle_unclear(dispatch, wo, message_id)
