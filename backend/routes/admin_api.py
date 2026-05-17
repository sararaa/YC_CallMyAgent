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
