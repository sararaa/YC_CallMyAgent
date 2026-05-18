"""POST /webhooks/agentmail — receives inbound technician email notifications."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from sqlmodel import select

from backend import config
from backend.db import models
from backend.db.session import get_session
from backend import technician_agent

log = logging.getLogger("volt.agentmail_webhook")
router = APIRouter()


class _MessagePayload(BaseModel):
    inbox_id: str = Field(alias="inboxId", default="")
    thread_id: str = Field(alias="threadId", default="")
    message_id: str = Field(alias="messageId", default="")
    from_addr: str = Field(alias="from", default="")
    subject: str = ""
    extracted_text: str = Field(alias="extractedText", default="")
    text: str = ""

    class Config:
        populate_by_name = True
        extra = "allow"

    @property
    def body(self) -> str:
        return self.extracted_text or self.text

    @property
    def sender(self) -> str:
        return self.from_addr


class WebhookPayload(BaseModel):
    type: str = ""
    event_type: str = Field(alias="eventType", default="")
    event_id: str = ""
    message: _MessagePayload = Field(default_factory=_MessagePayload)

    class Config:
        populate_by_name = True
        extra = "allow"


def _verify_hmac(raw_body: bytes, headers) -> None:
    secret = config.AGENTMAIL_WEBHOOK_SECRET
    if not secret or secret == "your_secret_here":
        log.warning("AGENTMAIL_WEBHOOK_SECRET not configured — skipping signature check")
        return
    # AgentMail uses Svix for webhooks — verify using svix-* headers
    svix_id = headers.get("svix-id", "")
    svix_ts = headers.get("svix-timestamp", "")
    svix_sig = headers.get("svix-signature", "")
    if not (svix_id and svix_ts and svix_sig):
        raise HTTPException(401, "Missing Svix signature headers")
    signed_content = f"{svix_id}.{svix_ts}.{raw_body.decode()}".encode()
    secret_bytes = base64.b64decode(secret.removeprefix("whsec_"))
    expected = "v1," + base64.b64encode(
        hmac.new(secret_bytes, signed_content, hashlib.sha256).digest()
    ).decode()
    # svix-signature may contain multiple space-separated v1,<sig> values
    if not any(hmac.compare_digest(expected, s.strip()) for s in svix_sig.split()):
        raise HTTPException(401, "Signature mismatch")


@router.post("/webhooks/agentmail", status_code=200)
async def agentmail_webhook(request: Request) -> dict:
    raw_body = await request.body()
    _verify_hmac(raw_body, request.headers)

    payload = WebhookPayload.model_validate(json.loads(raw_body))

    # AgentMail sends type="event", event_type="message.received"
    is_message_received = (
        payload.type == "message.received"
        or payload.event_type == "message.received"
    )
    if not is_message_received:
        log.debug("Ignoring AgentMail event type=%r event_type=%r", payload.type, payload.event_type)
        return {"ok": True, "skipped": True}

    msg = payload.message
    log.info("Webhook message.received inbox=%s message=%s from=%s", msg.inbox_id, msg.message_id, msg.sender)

    # Look up the dispatch record by inbox_id
    with get_session() as db:
        dispatch = db.exec(
            select(models.TechnicianDispatch)
            .where(models.TechnicianDispatch.agentmail_inbox_id == msg.inbox_id)
        ).first()

        if not dispatch:
            log.warning("No TechnicianDispatch for inbox_id=%s", msg.inbox_id)
            return {"ok": True, "skipped": True}

        wo = db.get(models.WorkOrder, dispatch.work_order_id)
        if not wo:
            log.error("WorkOrder %d not found for dispatch %d", dispatch.work_order_id, dispatch.id)
            raise HTTPException(500, "Work order not found")

    await technician_agent.handle_technician_email(
        dispatch=dispatch,
        wo=wo,
        extracted_text=msg.body,
        message_id=msg.message_id,
        from_email=msg.sender,
        subject=msg.subject,
    )

    return {"ok": True}
