"""Thin async-friendly wrapper around inferedge-moss + an in-memory stub.

The stub mimics the same return shapes so the rest of the app (and the
dashboard) doesn't care which one is active. Stubs sleep ~8ms to keep
the latency counters realistic for the demo.
"""
from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from typing import Any

from backend import config

log = logging.getLogger("volt.moss")


@dataclass
class QueryHit:
    id: str
    text: str
    score: float
    source: str | None = None


@dataclass
class QueryResult:
    hits: list[QueryHit]
    latency_ms: float
    hit: bool


# ---------- Real client (inferedge-moss) ----------

class _RealMoss:
    def __init__(self) -> None:
        from inferedge_moss import MossClient  # noqa: WPS433
        self._client = MossClient(config.MOSS_PROJECT_ID, config.MOSS_PROJECT_KEY)

    async def create_index(self, name: str, docs: list[dict]) -> None:
        from inferedge_moss import DocumentInfo  # noqa: WPS433
        infos = [DocumentInfo(id=d["id"], text=d["text"], metadata=d.get("metadata")) for d in docs]
        await asyncio.to_thread(self._client.create_index, name, infos, "moss-minilm")
        await asyncio.to_thread(self._client.load_index, name)

    async def add_docs(self, name: str, docs: list[dict]) -> None:
        from inferedge_moss import DocumentInfo  # noqa: WPS433
        infos = [DocumentInfo(id=d["id"], text=d["text"], metadata=d.get("metadata")) for d in docs]
        await asyncio.to_thread(self._client.add_docs, name, infos)
        if config.MOSS_FORCE_REFRESH_ON_ADD:
            await asyncio.to_thread(self._client.load_index, name)

    async def query(self, name: str, q: str, top_k: int = 5) -> QueryResult:
        from inferedge_moss import QueryOptions  # noqa: WPS433
        t = time.perf_counter()
        try:
            res = await asyncio.to_thread(self._client.query, name, q, QueryOptions(top_k=top_k, alpha=0.8))
        except Exception as e:  # noqa: BLE001
            log.warning("moss query failed on %s: %s", name, e)
            return QueryResult(hits=[], latency_ms=(time.perf_counter() - t) * 1000, hit=False)
        latency_ms = (time.perf_counter() - t) * 1000
        hits = [
            QueryHit(
                id=str(d.id),
                text=d.text,
                score=float(getattr(d, "score", 0.0)),
                source=(d.metadata or {}).get("source") if getattr(d, "metadata", None) else None,
            )
            for d in res.docs
        ]
        return QueryResult(hits=hits, latency_ms=latency_ms, hit=bool(hits))

    async def delete_index(self, name: str) -> None:
        try:
            await asyncio.to_thread(self._client.delete_index, name)
        except Exception as e:  # noqa: BLE001
            log.warning("moss delete_index(%s) failed: %s", name, e)


# ---------- Stub (in-memory) ----------

class _StubMoss:
    """Cosine-free, token-overlap scoring stub. Good enough for demo continuity."""

    def __init__(self) -> None:
        self._indexes: dict[str, list[dict]] = {}

    @staticmethod
    def _score(q: str, text: str) -> float:
        q_tokens = set(q.lower().split())
        t_tokens = set(text.lower().split())
        if not q_tokens or not t_tokens:
            return 0.0
        overlap = len(q_tokens & t_tokens)
        return overlap / (len(q_tokens) ** 0.5 * len(t_tokens) ** 0.5)

    async def create_index(self, name: str, docs: list[dict]) -> None:
        await asyncio.sleep(0.008)
        self._indexes[name] = list(docs)

    async def add_docs(self, name: str, docs: list[dict]) -> None:
        await asyncio.sleep(0.008)
        self._indexes.setdefault(name, []).extend(docs)

    async def query(self, name: str, q: str, top_k: int = 5) -> QueryResult:
        t = time.perf_counter()
        await asyncio.sleep(0.008)
        docs = self._indexes.get(name, [])
        scored = sorted(
            ((self._score(q, d["text"]), d) for d in docs),
            key=lambda x: x[0],
            reverse=True,
        )[:top_k]
        hits = [
            QueryHit(
                id=d["id"],
                text=d["text"],
                score=float(s),
                source=(d.get("metadata") or {}).get("source"),
            )
            for s, d in scored if s > 0
        ]
        latency_ms = (time.perf_counter() - t) * 1000
        return QueryResult(hits=hits, latency_ms=latency_ms, hit=bool(hits))

    async def delete_index(self, name: str) -> None:
        await asyncio.sleep(0.005)
        self._indexes.pop(name, None)


# ---------- Singleton ----------

_client: Any | None = None


def client() -> Any:
    global _client
    if _client is None:
        if config.using_moss_stub():
            log.warning("Moss running in STUB mode.")
            _client = _StubMoss()
        else:
            _client = _RealMoss()
    return _client


async def create_index(name: str, docs: list[dict]) -> None:
    await client().create_index(name, docs)


async def add_docs(name: str, docs: list[dict]) -> None:
    await client().add_docs(name, docs)


async def query(name: str, q: str, top_k: int = 5) -> QueryResult:
    return await client().query(name, q, top_k=top_k)


async def delete_index(name: str) -> None:
    await client().delete_index(name)
