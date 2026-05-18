import json
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlmodel import select

from backend import config
from backend.agentmail_client import am_client
from backend.charger_synth import synth_charger, _wo_to_frontend
from backend.db import models
from backend.db.session import get_session, reset_db
from backend import session as call_session
from backend.observer import bus

router = APIRouter(prefix="/api/admin")


@router.get("/work_orders")
def work_orders() -> list[dict]:
    with get_session() as db:
        rows = db.exec(select(models.WorkOrder).order_by(models.WorkOrder.created_at.desc())).all()
        return [r.model_dump() for r in rows]


@router.get("/remote_commands")
def remote_commands() -> list[dict]:
    with get_session() as db:
        rows = db.exec(select(models.RemoteCommand).order_by(models.RemoteCommand.created_at.desc())).all()
        return [r.model_dump() for r in rows]


@router.get("/reports")
def reports() -> list[dict]:
    with get_session() as db:
        rows = db.exec(select(models.CallReport).order_by(models.CallReport.created_at.desc())).all()
        return [r.model_dump() for r in rows]


@router.get("/call_logs")
def call_logs() -> list[dict]:
    with get_session() as db:
        rows = db.exec(select(models.CallLog).order_by(models.CallLog.started_at.desc())).all()
        return [r.model_dump() for r in rows]


@router.get("/debug")
def debug_last_turn() -> dict:
    """Returns the most recent Gemini turn's full prompt + tools + response.
    Useful for figuring out 'what did Gemini actually see and say?' without
    tailing logs. Picks the most-recently-active live session."""
    from backend.session import _sessions  # noqa: WPS437 — debug introspection
    sessions = sorted(_sessions.values(), key=lambda s: s.started_at, reverse=True)
    if not sessions:
        return {"active_sessions": 0, "message": "No active sessions. Trigger a call via /simulate."}
    s = sessions[0]
    return {
        "session_id": s.session_id,
        "caller_phone": s.caller_phone,
        "current_state": s.current_state,
        "last_debug": s.last_debug,
        "active_sessions": len(sessions),
    }


@router.get("/charger/{charger_id}")
def charger(charger_id: str) -> dict:
    data = synth_charger(charger_id)
    if not data:
        raise HTTPException(404, f"unknown charger: {charger_id}")
    return data


@router.get("/work_orders/{wo_id}")
def work_order_detail(wo_id: int) -> dict:
    with get_session() as db:
        wo = db.get(models.WorkOrder, wo_id)
        if not wo:
            raise HTTPException(404, f"work order {wo_id} not found")
        return _wo_to_frontend(wo)


class DispatchRequest(BaseModel):
    technician_email: Optional[str] = None


@router.post("/work_orders/{wo_id}/dispatch")
async def dispatch_work_order(wo_id: int, body: DispatchRequest) -> dict:
    """Create an AgentMail inbox, send the initial email, and record the dispatch."""
    with get_session() as db:
        wo = db.get(models.WorkOrder, wo_id)
        if not wo:
            raise HTTPException(404, f"work order {wo_id} not found")
        # Capture attributes before session closes (detached instance safety)
        wo_charger_id = wo.charger_id
        wo_severity = wo.severity
        wo_symptoms = wo.symptoms
        wo_telemetry = wo.telemetry_snippet or "(No telemetry snippet captured)"

        # Idempotent: return existing active dispatch; allow re-dispatch after cancellation
        existing = db.exec(
            select(models.TechnicianDispatch).where(models.TechnicianDispatch.work_order_id == wo_id)
        ).first()
        if existing and existing.status != "cancelled":
            thread = json.loads(existing.email_thread or "[]")
            return {**existing.model_dump(), "email_thread": thread}

    tech_email = body.technician_email or config.TECHNICIAN_EMAIL

    # Create inbox (idempotent via clientId in AgentMail)
    inbox = await am_client.create_inbox(wo_id)

    subject = f"[VoltDispatch] WO-{wo_id} — {wo_charger_id.upper()} | {wo_severity.upper()}"
    body_text = f"""\
Hi,

You have been assigned Work Order WO-{wo_id} for charger {wo_charger_id.upper()}.

FAULT SUMMARY
-------------
Severity : {wo_severity.upper()}
Charger  : {wo_charger_id.upper()}
Symptoms : {wo_symptoms}

TELEMETRY SNAPSHOT
------------------
{wo_telemetry}

NEXT STEPS
----------
Reply "accepted" to confirm you are en route.
Reply with any questions about the charger or repair procedure.
Reply "done" when the repair is complete.

— Volt Dispatch System
  ChargeForward EV Network
"""
    html_body = "<br>\n".join(
        body_text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").split("\n")
    )

    await am_client.send_message(
        inbox_id=inbox.inbox_id,
        to=tech_email,
        subject=subject,
        text=body_text,
        html=html_body,
    )

    initial_thread = json.dumps([{
        "direction": "outbound",
        "from": inbox.email,
        "subject": subject,
        "body": body_text,
        "timestamp": models._now().isoformat(),
    }])

    with get_session() as db:
        # Re-dispatch: update the cancelled row in-place (unique constraint on work_order_id)
        cancelled_row = db.exec(
            select(models.TechnicianDispatch).where(models.TechnicianDispatch.work_order_id == wo_id)
        ).first()
        if cancelled_row:
            cancelled_row.technician_email = tech_email
            cancelled_row.agentmail_inbox_id = inbox.inbox_id
            cancelled_row.agentmail_client_id = f"wo-{wo_id}"
            cancelled_row.status = "pending"
            cancelled_row.email_thread = initial_thread
            cancelled_row.dispatched_at = models._now()
            cancelled_row.completed_at = None
            db.add(cancelled_row)
            dispatch_id = cancelled_row.id
        else:
            dispatch = models.TechnicianDispatch(
                work_order_id=wo_id,
                technician_email=tech_email,
                agentmail_inbox_id=inbox.inbox_id,
                agentmail_client_id=f"wo-{wo_id}",
                status="pending",
                email_thread=initial_thread,
            )
            db.add(dispatch)
            db.flush()
            dispatch_id = dispatch.id
        wo_row = db.get(models.WorkOrder, wo_id)
        if wo_row:
            wo_row.status = "dispatched"
            db.add(wo_row)
        db.commit()

    await bus.emit("dispatch_update", None, {
        "wo_id": wo_id,
        "status": "pending",
        "technician_email": tech_email,
        "inbox_id": inbox.inbox_id,
        "thread_count": 1,
    })
    await bus.emit("technician_email", None, {
        "wo_id": wo_id,
        "direction": "outbound",
        "from": inbox.email,
        "subject": subject,
        "body_preview": body_text,
    })

    with get_session() as db:
        dispatch = db.get(models.TechnicianDispatch, dispatch_id)
        thread = json.loads(dispatch.email_thread or "[]")
        return {**dispatch.model_dump(), "email_thread": thread}


@router.get("/work_orders/{wo_id}/dispatch")
def get_dispatch(wo_id: int) -> dict:
    with get_session() as db:
        dispatch = db.exec(
            select(models.TechnicianDispatch).where(models.TechnicianDispatch.work_order_id == wo_id)
        ).first()
        if not dispatch:
            raise HTTPException(404, f"no dispatch for work order {wo_id}")
        thread = json.loads(dispatch.email_thread or "[]")
        return {**dispatch.model_dump(), "email_thread": thread}


@router.post("/work_orders/{wo_id}/cancel")
async def cancel_work_order(wo_id: int) -> dict:
    """Cancel a work order and notify the technician if already dispatched."""
    with get_session() as db:
        wo = db.get(models.WorkOrder, wo_id)
        if not wo:
            raise HTTPException(404, f"work order {wo_id} not found")
        if wo.status in ("complete", "resolved", "cancelled"):
            raise HTTPException(400, f"work order is already {wo.status}")
        charger_id = wo.charger_id
        dispatch = db.exec(
            select(models.TechnicianDispatch).where(models.TechnicianDispatch.work_order_id == wo_id)
        ).first()
        dispatch_id = dispatch.id if dispatch else None
        dispatch_inbox_id = dispatch.agentmail_inbox_id if dispatch else None
        dispatch_tech_email = dispatch.technician_email if dispatch else None
        dispatch_status = dispatch.status if dispatch else None
        dispatch_thread_len = len(json.loads(dispatch.email_thread or "[]")) if dispatch else 0

    cancel_entry = None
    if dispatch_id and dispatch_status != "cancelled":
        subject = f"[VoltDispatch] WO-{wo_id} CANCELLED — {charger_id.upper()}"
        body_text = (
            f"Hi,\n\nWork Order WO-{wo_id} for charger {charger_id.upper()} has been cancelled.\n\n"
            "No further action is required. If you are already en route, please disregard.\n\n"
            "We apologise for any inconvenience.\n\n— Volt Dispatch System\n  ChargeForward EV Network\n"
        )
        html_body = "<br>\n".join(
            body_text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").split("\n")
        )
        try:
            await am_client.send_message(
                inbox_id=dispatch_inbox_id,
                to=dispatch_tech_email,
                subject=subject,
                text=body_text,
                html=html_body,
            )
        except Exception as e:
            import logging
            logging.getLogger("volt").warning("Cancel email failed (inbox may be stale): %s", e)
        cancel_entry = {
            "direction": "outbound",
            "from": f"wo-{wo_id}@agentmail.to",
            "subject": subject,
            "body": body_text,
            "timestamp": models._now().isoformat(),
        }
        with get_session() as db:
            dispatch_row = db.get(models.TechnicianDispatch, dispatch_id)
            if dispatch_row:
                thread = json.loads(dispatch_row.email_thread or "[]")
                thread.append(cancel_entry)
                dispatch_row.email_thread = json.dumps(thread)
                dispatch_row.status = "cancelled"
                db.add(dispatch_row)
                db.commit()
        await bus.emit("technician_email", None, {
            "wo_id": wo_id,
            "direction": "outbound",
            "from": f"wo-{wo_id}@agentmail.to",
            "subject": subject,
            "body_preview": body_text,
        })

    with get_session() as db:
        wo_row = db.get(models.WorkOrder, wo_id)
        if wo_row:
            wo_row.status = "cancelled"
            db.add(wo_row)
            db.commit()

    await bus.emit("dispatch_update", None, {
        "wo_id": wo_id,
        "status": "cancelled",
        "technician_email": dispatch_tech_email or "",
        "inbox_id": dispatch_inbox_id or "",
        "thread_count": dispatch_thread_len + (1 if cancel_entry else 0),
    })
    return {"ok": True, "wo_id": wo_id, "status": "cancelled", "email_sent": cancel_entry is not None}


@router.post("/work_orders/{wo_id}/confirm")
async def confirm_work_order(wo_id: int) -> dict:
    """Mark a dispatched work order as confirmed (technician accepted)."""
    with get_session() as db:
        wo = db.get(models.WorkOrder, wo_id)
        if not wo:
            raise HTTPException(404, f"work order {wo_id} not found")
        if wo.status not in ("dispatched", "pending"):
            raise HTTPException(400, f"work order status is {wo.status}, cannot confirm")
        wo.status = "in_progress"
        db.add(wo)
        dispatch = db.exec(
            select(models.TechnicianDispatch).where(models.TechnicianDispatch.work_order_id == wo_id)
        ).first()
        if dispatch:
            dispatch.status = "in_progress"
            db.add(dispatch)
        db.commit()

    await bus.emit("dispatch_update", None, {
        "wo_id": wo_id, "status": "in_progress",
        "technician_email": "", "inbox_id": "", "thread_count": 0,
    })
    return {"ok": True, "wo_id": wo_id, "status": "in_progress"}


@router.post("/work_orders/{wo_id}/reopen")
async def reopen_work_order(wo_id: int) -> dict:
    """Reopen a cancelled work order, resetting it to open status."""
    with get_session() as db:
        wo = db.get(models.WorkOrder, wo_id)
        if not wo:
            raise HTTPException(404, f"work order {wo_id} not found")
        if wo.status != "cancelled":
            raise HTTPException(400, f"work order is not cancelled (current status: {wo.status})")
        wo.status = "open"
        db.add(wo)
        db.commit()

    await bus.emit("dispatch_update", None, {
        "wo_id": wo_id,
        "status": "open",
        "technician_email": "",
        "inbox_id": "",
        "thread_count": 0,
    })
    return {"ok": True, "wo_id": wo_id, "status": "open"}


@router.post("/reset")
async def reset() -> dict:
    """Demo reset: clear DB, drop in-memory sessions, signal the dashboard."""
    reset_db()
    call_session.reset_all()
    await bus.emit("reset", None, {})
    return {"ok": True}


@router.post("/end_call")
async def end_call_active() -> dict:
    """End whatever call session is currently active. No-op if none."""
    from backend.session import _sessions  # introspection
    from backend.tools.actions import end_call as end_call_tool
    sessions = sorted(_sessions.values(), key=lambda s: s.started_at, reverse=True)
    if not sessions:
        return {"ok": False, "reason": "no_active_session"}
    s = sessions[0]
    await end_call_tool(s)
    call_session.end(s.session_id)
    return {"ok": True, "session_id": s.session_id}
