from fastapi import APIRouter, HTTPException
from sqlmodel import select

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
