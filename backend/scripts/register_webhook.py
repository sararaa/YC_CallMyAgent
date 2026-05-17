"""Register our webhook URL with AgentPhone.

Without this, AgentPhone has no destination to POST inbound-call events to and
your number will play "we are experiencing technical difficulties."

Usage:
  # Once you've got ngrok running:
  ngrok http 8000
  # then:
  AGENTPHONE_WEBHOOK_URL=https://<ngrok-host>/webhooks/agentphone \\
    backend/.venv/bin/python -m backend.scripts.register_webhook

Or pass the URL inline:
  backend/.venv/bin/python -m backend.scripts.register_webhook \\
    https://<ngrok-host>/webhooks/agentphone
"""
from __future__ import annotations

import json
import os
import sys

import httpx

from backend import config

API = "https://api.agentphone.ai/v1/webhooks"


def main() -> None:
    if not config.AGENTPHONE_API_KEY:
        print("ERROR: AGENTPHONE_API_KEY not set in .env / .env.local")
        sys.exit(1)

    url = (
        sys.argv[1] if len(sys.argv) > 1
        else os.getenv("AGENTPHONE_WEBHOOK_URL", "")
    ).strip()
    if not url:
        print(
            "ERROR: webhook URL not provided.\n"
            "Pass it as an argument or set AGENTPHONE_WEBHOOK_URL.\n"
            "Example: python -m backend.scripts.register_webhook https://abc.ngrok-free.app/webhooks/agentphone"
        )
        sys.exit(1)
    if not url.startswith("https://"):
        print(f"WARNING: webhook URL is not HTTPS — AgentPhone may reject it: {url}")

    body = {"url": url, "contextLimit": 10}
    headers = {
        "Authorization": f"Bearer {config.AGENTPHONE_API_KEY}",
        "Content-Type": "application/json",
    }
    print(f"POST {API}")
    print(f"  body = {json.dumps(body)}")
    resp = httpx.post(API, json=body, headers=headers, timeout=20.0)
    print(f"Response: {resp.status_code}")
    try:
        print(json.dumps(resp.json(), indent=2))
    except Exception:
        print(resp.text)
    if resp.status_code >= 400:
        sys.exit(2)


if __name__ == "__main__":
    main()
