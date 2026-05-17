import asyncio
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.observer import bus

log = logging.getLogger("volt.ws")
router = APIRouter()


@router.websocket("/ws/dashboard")
async def dashboard(ws: WebSocket) -> None:
    await ws.accept()
    q = await bus.subscribe()
    await ws.send_json({"type": "hello", "session_id": None, "timestamp": None, "payload": {"ok": True}})
    try:
        while True:
            event = await q.get()
            await ws.send_json(event)
    except WebSocketDisconnect:
        pass
    except Exception:  # noqa: BLE001
        log.exception("dashboard ws crashed")
    finally:
        await bus.unsubscribe(q)
        try:
            await ws.close()
        except Exception:  # noqa: BLE001
            pass


async def heartbeat_task() -> None:
    """Optional background ticker — not started by default."""
    while True:
        await asyncio.sleep(30)
        await bus.emit("heartbeat", None, {"ts": True})
