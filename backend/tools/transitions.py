from backend.observer import bus
from backend.session import CallSession
from backend.state_machine import TRANSITION_MAP


def _clamp(c: float | None) -> float | None:
    if c is None:
        return None
    return max(0.0, min(1.0, float(c)))


async def _transition(s: CallSession, tool_name: str, reason: str | None, confidence: float | None) -> dict:
    new_state = TRANSITION_MAP[tool_name]
    old_state = s.current_state
    s.current_state = new_state
    confidence = _clamp(confidence)
    if confidence is not None:
        s.confidence_samples.append(confidence)
    await bus.emit("state_transition", s.session_id, {
        "from": old_state,
        "to": new_state,
        "reason": reason,
        "confidence": confidence,
    })
    return {"ok": True, "new_state": new_state}


async def advance_to_scoping(s: CallSession, **_kw) -> dict:
    return await _transition(s, "advance_to_scoping", None, None)


async def advance_to_triage(s: CallSession, **_kw) -> dict:
    return await _transition(s, "advance_to_triage", None, None)


async def advance_to_wrap_up(s: CallSession, **_kw) -> dict:
    return await _transition(s, "advance_to_wrap_up", None, None)


async def route_to_user_issue(s: CallSession, reason: str | None = None, confidence: float | None = None, **_kw) -> dict:
    return await _transition(s, "route_to_user_issue", reason, confidence)


async def route_to_software_issue(s: CallSession, reason: str | None = None, confidence: float | None = None, **_kw) -> dict:
    return await _transition(s, "route_to_software_issue", reason, confidence)


async def route_to_hardware_issue(s: CallSession, reason: str | None = None, confidence: float | None = None, **_kw) -> dict:
    return await _transition(s, "route_to_hardware_issue", reason, confidence)
