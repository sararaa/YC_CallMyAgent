import asyncio
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone


@dataclass
class CallSession:
    session_id: str
    caller_phone: str
    current_state: str = "greeting"
    history: list[dict] = field(default_factory=list)  # gemini Content list
    started_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    confidence_samples: list[float] = field(default_factory=list)
    last_debug: dict | None = None  # last raw Gemini I/O for /api/admin/debug
    report_generated: bool = False  # idempotency flag for generate_report
    call_ended: bool = False  # idempotency flag for end_call
    # Serializes turn-processing per call so overlapping AgentPhone webhooks
    # don't race the same state machine.
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    # Deduplicate identical caller utterances re-delivered by AgentPhone.
    last_caller_utterance: str = ""
    # The AgentPhone callId for this call. Used to ignore stale call_ended
    # webhooks that match by phone number but belong to a DIFFERENT call.
    agentphone_call_id: str = ""
    # Signals when the Moss session index has been created. Background
    # writes (append_turn, preload) await this before touching Moss.
    index_ready: asyncio.Event = field(default_factory=asyncio.Event)


_sessions: dict[str, CallSession] = {}
_by_caller: dict[str, str] = {}


def new_session(caller_phone: str) -> CallSession:
    sid = str(uuid.uuid4())
    s = CallSession(session_id=sid, caller_phone=caller_phone)
    _sessions[sid] = s
    _by_caller[caller_phone] = sid
    return s


def get(session_id: str) -> CallSession | None:
    return _sessions.get(session_id)


def by_caller(caller_phone: str) -> CallSession | None:
    sid = _by_caller.get(caller_phone)
    return _sessions.get(sid) if sid else None


def end(session_id: str) -> None:
    s = _sessions.pop(session_id, None)
    if s:
        _by_caller.pop(s.caller_phone, None)


def reset_all() -> None:
    _sessions.clear()
    _by_caller.clear()
