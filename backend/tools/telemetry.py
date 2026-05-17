import time

from backend import config
from backend.observer import bus
from backend.session import CallSession


def _available_chargers() -> list[str]:
    return sorted(p.stem.replace("_summary", "") for p in config.DATA_RAG_DIR.glob("*_summary.md"))


async def get_charger_telemetry(s: CallSession, charger_id: str) -> dict:
    cid = (charger_id or "").strip().lower()
    path = config.DATA_RAG_DIR / f"{cid}_summary.md"
    t = time.perf_counter()

    if not path.exists():
        result = {"error": "unknown_charger", "available": _available_chargers()}
        await bus.emit("tool_artifact", s.session_id, {
            "kind": "telemetry_error",
            "charger_id": cid,
            "available": result["available"],
        })
        return result

    markdown = path.read_text()
    loaded_ms = (time.perf_counter() - t) * 1000
    await bus.emit("tool_artifact", s.session_id, {
        "kind": "telemetry",
        "charger_id": cid,
        "markdown": markdown,
    })
    return {"charger_id": cid, "markdown": markdown, "loaded_ms": int(loaded_ms)}
