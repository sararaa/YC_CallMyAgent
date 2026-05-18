"""Thin async wrapper around the agentmail Python SDK + an in-memory stub.

Real mode: pip install agentmail, set AGENTMAIL_API_KEY.
Stub mode: logs every action at INFO level; returns deterministic fake data.
Pattern mirrors moss_client.py / supermemory_client.py.
"""
from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field

from backend import config

log = logging.getLogger("volt.agentmail")


@dataclass
class InboxInfo:
    inbox_id: str
    email: str


@dataclass
class SendResult:
    message_id: str


# ---------- Real client ----------

class _RealAgentMail:
    def __init__(self) -> None:
        from agentmail import AsyncAgentMail  # noqa: WPS433
        from agentmail.inboxes.types import CreateInboxRequest  # noqa: WPS433
        self._CreateInboxRequest = CreateInboxRequest
        self._client = AsyncAgentMail(api_key=config.AGENTMAIL_API_KEY)

    async def create_inbox(self, wo_id: int) -> InboxInfo:
        username = f"wo-{wo_id}"
        result = await self._client.inboxes.create(
            request=self._CreateInboxRequest(
                username=username,
                client_id=username,
                display_name="Volt Dispatch",
            )
        )
        email = getattr(result, "email", None) or getattr(result, "address", None) or f"{username}@agentmail.to"
        inbox_id = getattr(result, "inbox_id", None) or getattr(result, "id", username)
        return InboxInfo(inbox_id=inbox_id, email=email)

    async def send_message(self, inbox_id: str, to: str, subject: str, text: str, html: str) -> SendResult:
        result = await self._client.inboxes.messages.send(
            inbox_id,
            to=[to],
            subject=subject,
            text=text,
            html=html,
            labels=["unreplied"],
        )
        mid = getattr(result, "message_id", None) or getattr(result, "id", uuid.uuid4().hex[:12])
        return SendResult(message_id=mid)

    async def reply(self, inbox_id: str, message_id: str, text: str, html: str) -> None:
        await self._client.inboxes.messages.reply(
            inbox_id,
            message_id,
            text=text,
            html=html,
        )

    async def update_labels(self, inbox_id: str, message_id: str, add: list[str], remove: list[str]) -> None:
        await self._client.inboxes.messages.update(
            inbox_id,
            message_id,
            add_labels=add,
            remove_labels=remove,
        )


# ---------- Stub ----------

class _StubAgentMail:
    async def create_inbox(self, wo_id: int) -> InboxInfo:
        inbox_id = f"stub-inbox-wo-{wo_id}"
        log.info("[AGENTMAIL STUB] create_inbox wo-%d → %s", wo_id, inbox_id)
        return InboxInfo(inbox_id=inbox_id, email=f"wo-{wo_id}@agentmail.to")

    async def send_message(self, inbox_id: str, to: str, subject: str, text: str, html: str) -> SendResult:
        mid = uuid.uuid4().hex[:12]
        log.info("[AGENTMAIL STUB] send_message inbox=%s to=%s subject=%r → message_id=%s", inbox_id, to, subject, mid)
        log.debug("[AGENTMAIL STUB] body:\n%s", text)
        return SendResult(message_id=mid)

    async def reply(self, inbox_id: str, message_id: str, text: str, html: str) -> None:
        log.info("[AGENTMAIL STUB] reply inbox=%s message_id=%s", inbox_id, message_id)
        log.debug("[AGENTMAIL STUB] reply body:\n%s", text)

    async def update_labels(self, inbox_id: str, message_id: str, add: list[str], remove: list[str]) -> None:
        log.info("[AGENTMAIL STUB] update_labels inbox=%s message_id=%s add=%s remove=%s", inbox_id, message_id, add, remove)


# ---------- Singleton ----------

def _build() -> _RealAgentMail | _StubAgentMail:
    if config.using_agentmail_stub():
        return _StubAgentMail()
    try:
        return _RealAgentMail()
    except Exception as e:
        log.warning("AgentMail real client failed to init (%s) — falling back to stub", e)
        return _StubAgentMail()


am_client: _RealAgentMail | _StubAgentMail = _build()
