import time
import uuid

from backend import config
from backend.memory import moss_client, supermemory_client
from backend.observer import bus
from backend.session import CallSession


def _session_index(s: CallSession) -> str:
    return f"session-{s.session_id}"


async def recall_session(s: CallSession, query: str) -> dict:
    t = time.perf_counter()
    res = await moss_client.query(_session_index(s), query, top_k=5)
    duration_ms = (time.perf_counter() - t) * 1000

    results = [{"text": h.text, "source": h.source, "score": h.score} for h in res.hits]
    payload = {
        "tier": "session",
        "query": query,
        "results": results,
        "duration_ms": duration_ms,
        "hit": res.hit,
    }
    await bus.emit("memory_query", s.session_id, payload)
    await bus.emit("latency_sample", s.session_id, {"component": "moss_session", "ms": duration_ms})
    return {"results": results, "latency_ms": duration_ms, "hit": res.hit, "tier": "session"}


async def recall_knowledge(s: CallSession, query: str) -> dict:
    """Cache-aside: query Moss volt-kb first, fall through to Supermemory on miss.

    Behaviour:
      - ALWAYS emit whatever Moss returned to the knowledge lane (even weak hits),
        so the UI reflects what was actually found.
      - Consider a query "strong" if any score >= threshold. Only then return
        knowledge-only; otherwise also query Supermemory as a fallback so the
        agent has more options.
      - Threshold is intentionally lenient — real Moss MiniLM scores are often
        in the 0.2-0.4 range even for relevant hits.
    """
    t = time.perf_counter()
    res = await moss_client.query(config.VOLT_KB_INDEX, query, top_k=5)
    duration_ms = (time.perf_counter() - t) * 1000

    threshold = 0.15 if config.using_moss_stub() else 0.25
    moss_results = [{"text": h.text, "source": h.source, "score": h.score} for h in res.hits]
    strong = res.hit and any(h.score >= threshold for h in res.hits)

    # Always emit knowledge with the real results (don't show "no match" if
    # we actually got back partial hits).
    await bus.emit("memory_query", s.session_id, {
        "tier": "knowledge",
        "query": query,
        "results": moss_results,
        "duration_ms": duration_ms,
        "hit": bool(moss_results),
    })
    await bus.emit("latency_sample", s.session_id, {"component": "moss_kb", "ms": duration_ms})

    if strong:
        return {"results": moss_results, "latency_ms": duration_ms, "hit": True, "tier": "knowledge"}

    # Weak or no hit — also try Supermemory as a fallback
    t2 = time.perf_counter()
    sm = await supermemory_client.search(query, container_tag=s.caller_phone, top_k=5)
    sm_ms = (time.perf_counter() - t2) * 1000
    sm_results = [{"text": h.text, "source": h.source, "score": h.score} for h in sm.hits]
    await bus.emit("memory_query", s.session_id, {
        "tier": "long_term", "query": query, "results": sm_results, "duration_ms": sm_ms, "hit": sm.hit,
    })
    await bus.emit("latency_sample", s.session_id, {"component": "supermemory", "ms": sm_ms})

    # Return whichever side had results, preferring knowledge if it had anything.
    if moss_results:
        return {"results": moss_results, "latency_ms": duration_ms, "hit": True, "tier": "knowledge", "weak": True}
    return {"results": sm_results, "latency_ms": sm_ms, "hit": sm.hit, "tier": "long_term"}


async def append_turn(s: CallSession, role: str, text: str) -> None:
    """Append a turn to the session Moss index and emit memory_ingest."""
    doc_id = f"{s.session_id}-{uuid.uuid4().hex[:8]}"
    t = time.perf_counter()
    await moss_client.add_docs(_session_index(s), [{
        "id": doc_id,
        "text": text,
        "metadata": {"role": role, "session_id": s.session_id, "source": role},
    }])
    duration_ms = (time.perf_counter() - t) * 1000
    await bus.emit("memory_ingest", s.session_id, {
        "tier": "session",
        "doc_id": doc_id,
        "text_preview": text[:80],
        "latency_ms": duration_ms,
    })
