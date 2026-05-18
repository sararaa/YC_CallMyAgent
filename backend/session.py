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
    # Correlation id for the currently in-flight webhook/turn. Best-effort
    # plumbing so debug logs across agent.py / tools / memory can be grep'd
    # by a single id. Always reset per webhook in the agentphone handler.
    current_req_id: str = ""
    # Last agent reply produced by a real turn. Returned (sticky) from dedup
    # branches so the last webhook of an ASR volley still carries text for
    # AgentPhone to speak instead of silence. Cleared on a fresh real turn.
    pending_reply: str = ""
    # When the end_call tool fires, this flips True so the AgentPhone webhook
    # handler appends `"hangup": true` to its JSON response. AgentPhone then
    # speaks the goodbye and tears down the call on its end. Single source
    # of truth for "this turn's HTTP reply should end the call."
    hangup_after_reply: bool = False
    # ------------------------------------------------------------------
    # ASR debounce plumbing. AgentPhone splits a single caller utterance
    # across multiple webhooks (intra-utterance gaps observed up to 2.8s).
    # Instead of running run_turn on every partial, the webhook handler
    # coalesces the volley: each webhook sets pending_transcript to the
    # latest text, cancels the prior pending_turn_task, and schedules a
    # new one on a short timer. When the timer fires (no newer webhook
    # arrived within DEBOUNCE_S), the debounced task acquires the lock
    # and runs run_turn on pending_transcript. last_run_transcript is
    # the transcript that was actually sent to Gemini last — used to
    # short-circuit a no-op debounce when the timer fires on text we
    # already responded to.
    pending_turn_task: asyncio.Task | None = None
    pending_transcript: str = ""
    last_run_transcript: str = ""

    def cancel_pending_turn(self, reason: str = "") -> bool:
        """Cancel any in-flight debounced turn task. Returns True if a task
        was actually cancelled (i.e. it existed and wasn't already done).
        Safe to call from any path that tears down the session or supersedes
        a pending turn."""
        t = self.pending_turn_task
        if t is None or t.done():
            return False
        t.cancel()
        return True


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
        # Cancel any orphan debounced-turn task so it doesn't fire after
        # teardown and try to run Gemini against a torn-down session.
        s.cancel_pending_turn(reason="session.end")
        _by_caller.pop(s.caller_phone, None)


def reset_all() -> None:
    for s in _sessions.values():
        s.cancel_pending_turn(reason="session.reset_all")
    _sessions.clear()
    _by_caller.clear()
