import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

log = logging.getLogger("volt.observer")


class EventBus:
    """In-memory pub/sub fanned out to dashboard WebSocket subscribers."""

    def __init__(self) -> None:
        self._subs: set[asyncio.Queue] = set()
        self._lock = asyncio.Lock()

    async def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=512)
        async with self._lock:
            self._subs.add(q)
        return q

    async def unsubscribe(self, q: asyncio.Queue) -> None:
        async with self._lock:
            self._subs.discard(q)

    async def emit(self, event_type: str, session_id: str | None, payload: dict[str, Any]) -> None:
        event = {
            "type": event_type,
            "session_id": session_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "payload": payload,
        }
        dead: list[asyncio.Queue] = []
        for q in list(self._subs):
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                log.warning("dashboard subscriber slow, dropping event %s", event_type)
                dead.append(q)
        for q in dead:
            await self.unsubscribe(q)


bus = EventBus()
