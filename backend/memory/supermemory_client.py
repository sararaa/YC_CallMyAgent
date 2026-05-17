"""Thin async wrapper around the supermemory SDK + an in-memory stub."""
from __future__ import annotations

import asyncio
import logging
import re
import time
from dataclasses import dataclass
from typing import Any

from backend import config

log = logging.getLogger("volt.supermemory")


def _sanitize_tag(tag: str) -> str:
    """Supermemory container tags must match /^[a-zA-Z0-9_:-]+$/. Phone numbers
    have a `+` prefix which fails the regex. Strip everything else and prefix
    so the tag is stable and human-readable in their dashboard."""
    cleaned = re.sub(r"[^a-zA-Z0-9_:-]", "", tag or "")
    return f"caller_{cleaned}" if cleaned else "anon"


@dataclass
class SmHit:
    id: str
    text: str
    score: float
    source: str | None = None


@dataclass
class SmResult:
    hits: list[SmHit]
    latency_ms: float
    hit: bool


# ---------- Real client ----------

class _RealSm:
    def __init__(self) -> None:
        from supermemory import AsyncSupermemory  # noqa: WPS433
        self._client = AsyncSupermemory(api_key=config.SUPERMEMORY_API_KEY)

    async def add(self, content: str, container_tag: str, metadata: dict | None = None) -> str:
        tag = _sanitize_tag(container_tag)
        t = time.perf_counter()
        try:
            # Supermemory SDK: .add() is at top-level, not under .memories.
            # .memories only exposes forget/update_memory.
            res = await self._client.add(
                content=content,
                container_tag=tag,
                metadata=metadata or {},
            )
            mid = getattr(res, "id", "") or getattr(res, "memory_id", "")
        except Exception as e:  # noqa: BLE001
            log.warning("supermemory add failed: %s", e)
            mid = ""
        log.info("sm.add latency_ms=%.1f", (time.perf_counter() - t) * 1000)
        return mid

    async def search(self, query: str, container_tag: str, top_k: int = 10) -> SmResult:
        tag = _sanitize_tag(container_tag)
        t = time.perf_counter()
        try:
            res = await self._client.search.execute(
                q=query,
                container_tags=[tag],
                limit=top_k,
            )
            raw_hits = getattr(res, "results", []) or []
        except Exception as e:  # noqa: BLE001
            log.warning("supermemory search failed: %s", e)
            raw_hits = []
        latency_ms = (time.perf_counter() - t) * 1000
        hits: list[SmHit] = []
        for r in raw_hits:
            content = getattr(r, "content", "") or ""
            score = float(getattr(r, "score", 0.0) or 0.0)
            mid = str(getattr(r, "id", "") or getattr(r, "memory_id", "") or "")
            md = getattr(r, "metadata", None) or {}
            source = md.get("source") if isinstance(md, dict) else None
            hits.append(SmHit(id=mid, text=content, score=score, source=source))
        return SmResult(hits=hits, latency_ms=latency_ms, hit=bool(hits))

    async def get_profile(self, container_tag: str) -> str:
        """Best-effort: search for a 'profile' tagged memory; fall back to ''."""
        res = await self.search("user profile summary", container_tag, top_k=1)
        return res.hits[0].text if res.hits else ""


# ---------- Stub ----------

class _StubSm:
    def __init__(self) -> None:
        self._store: dict[str, list[dict]] = {}

    @staticmethod
    def _score(q: str, text: str) -> float:
        qs = set(q.lower().split())
        ts = set(text.lower().split())
        if not qs or not ts:
            return 0.0
        return len(qs & ts) / (len(qs) ** 0.5 * len(ts) ** 0.5)

    async def add(self, content: str, container_tag: str, metadata: dict | None = None) -> str:
        await asyncio.sleep(0.05)
        mid = f"sm-{len(self._store.get(container_tag, []))}"
        self._store.setdefault(container_tag, []).append(
            {"id": mid, "content": content, "metadata": metadata or {}}
        )
        return mid

    async def search(self, query: str, container_tag: str, top_k: int = 10) -> SmResult:
        t = time.perf_counter()
        await asyncio.sleep(0.08)
        items = self._store.get(container_tag, [])
        scored = sorted(
            ((self._score(query, i["content"]), i) for i in items),
            key=lambda x: x[0],
            reverse=True,
        )[:top_k]
        hits = [
            SmHit(
                id=i["id"],
                text=i["content"],
                score=float(s),
                source=(i.get("metadata") or {}).get("source"),
            )
            for s, i in scored if s > 0
        ]
        latency_ms = (time.perf_counter() - t) * 1000
        return SmResult(hits=hits, latency_ms=latency_ms, hit=bool(hits))

    async def get_profile(self, container_tag: str) -> str:
        items = self._store.get(container_tag, [])
        for i in items:
            if (i.get("metadata") or {}).get("kind") == "profile":
                return i["content"]
        return ""


# ---------- Singleton ----------

_client: Any | None = None


def client() -> Any:
    global _client
    if _client is None:
        if config.using_supermemory_stub():
            log.warning("Supermemory running in STUB mode.")
            _client = _StubSm()
        else:
            _client = _RealSm()
    return _client


async def add(content: str, container_tag: str, metadata: dict | None = None) -> str:
    return await client().add(content, container_tag, metadata)


async def search(q: str, container_tag: str, top_k: int = 10) -> SmResult:
    return await client().search(q, container_tag, top_k=top_k)


async def get_profile(container_tag: str) -> str:
    return await client().get_profile(container_tag)
