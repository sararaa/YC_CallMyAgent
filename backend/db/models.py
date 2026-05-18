from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


def _now() -> datetime:
    return datetime.now(timezone.utc)


class WorkOrder(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: str = Field(index=True)
    charger_id: str = Field(index=True)
    severity: str  # low | medium | high | critical
    symptoms: str
    telemetry_snippet: str
    status: str = "open"  # open | in_progress | resolved
    reason: Optional[str] = None
    confidence: Optional[float] = None
    created_at: datetime = Field(default_factory=_now)


class RemoteCommand(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: str = Field(index=True)
    charger_id: str = Field(index=True)
    command: str  # reboot | reset_session | clear_fault | ota_update
    status: str = "queued"  # queued | sent | acknowledged
    reason: Optional[str] = None
    confidence: Optional[float] = None
    created_at: datetime = Field(default_factory=_now)


class CallReport(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: str = Field(index=True, unique=True)
    caller_phone: str = Field(index=True)
    resolution_type: str  # user | software | hardware | unresolved
    summary: str
    actions_taken: str  # newline-joined list
    follow_up_needed: str
    confidence: Optional[float] = None
    overall_confidence: Optional[float] = None  # geometric mean across the call
    created_at: datetime = Field(default_factory=_now)


class CallLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: str = Field(index=True, unique=True)
    caller_phone: str = Field(index=True)
    started_at: datetime = Field(default_factory=_now)
    ended_at: Optional[datetime] = None
    final_state: Optional[str] = None
    duration_s: Optional[float] = None


class TechnicianDispatch(SQLModel, table=True):
    __tablename__ = "technicianDispatch"
    id: Optional[int] = Field(default=None, primary_key=True)
    work_order_id: int = Field(index=True, unique=True)  # one dispatch per WO
    technician_email: str
    agentmail_inbox_id: str = Field(index=True)  # hot path for webhook lookup
    agentmail_client_id: str                      # == f"wo-{work_order_id}"
    status: str = "pending"   # pending | dispatched | in_progress | complete
    email_thread: str = "[]"  # JSON list of {direction, from, subject, body, timestamp}
    dispatched_at: datetime = Field(default_factory=_now)
    completed_at: Optional[datetime] = None
