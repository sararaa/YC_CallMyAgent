# Usage

Four terminals total. Three stay running, one is for one-shot setup.

## Run

**Terminal 1 — Frontend**
```bash
cd Frontend && npm run dev
```

**Terminal 2 — Backend**
```bash
backend/.venv/bin/uvicorn backend.main:app --reload --port 8000
```

**Terminal 3 — Tunnel**
```bash
ngrok http 8000
```
Copy the `https://*.ngrok-free.app` URL it prints.

**Terminal 4 — Register the webhook** _(one-shot, repeat only when the ngrok URL changes)_
```bash
backend/.venv/bin/python -m backend.scripts.register_webhook <NGROK_URL>
```

You should see a `200` response with a webhook `id`. Now call the AgentPhone number.

## Between calls

Nothing to do — just hang up and dial again.

## If the backend shuts down mid-call

You may need to refresh Terminal 2:
1. `Ctrl+C` in the backend terminal
2. Re-run the same `uvicorn` command

Everything else (frontend, ngrok, webhook registration) stays untouched.

## When ngrok restarts

Free-tier ngrok issues a new URL every restart. If that happens, re-run Terminal 4 with the new URL.
