# Volt — demo checklist

## One-time setup

```bash
# 1. Python deps
backend/.venv/bin/pip install -r requirements.txt

# 2. Env — put real keys in .env.local (already gitignored)
cp .env.example .env.local   # then edit

# 3. Frontend deps
cd frontend && npm install && cd ..

# 4. Index the knowledge base (Moss real mode only — stub mode auto-loads on boot)
backend/.venv/bin/python -m backend.scripts.upload
```

## Running the demo

Three terminals.

```bash
# T1 — backend
backend/.venv/bin/uvicorn backend.main:app --reload --port 8000

# T2 — frontend
cd frontend && npm run dev

# T3 — tunnel (only if testing with a real phone via AgentPhone)
ngrok http 8000
# point AgentPhone webhook → POST https://<ngrok>/webhooks/agentphone
```

Open `http://localhost:3000/dashboard` on the demo screen.
Open `http://localhost:3000/admin` on a side screen for the work-order queues.

## Demo flow — the hardware path (the hero)

Spec §12. Don't deviate.

1. Caller: *"Hi, my charger at the UC Davis lot won't start a session. Screen is on but nothing happens when I plug in."*
2. Agent: greeting → scoping → triage. One clarifier max.
3. **Fork animation fires** when triage commits to hardware. The two other branches dim with a hash overlay.
4. Agent: *"Can I get the charger ID? It's usually on a sticker on the unit."*
5. Caller: *"It's charger2."*
6. `get_charger_telemetry("charger2")` fires. Tool palette flashes. **Telemetry markdown card slides up.**
7. Agent reasons from telemetry. (Don't invent codes — the model reads the actual file.)
8. `create_work_order(...)` fires. **Work order card slides up.**
9. Agent: *"I've created a work order, severity high. A technician will be there within 24 hours."*
10. Wrap-up. `generate_report` → **report card with confidence stamp** slides up.
11. `end_call` → memory write-back animation in the Memory Wall.

## Testing without a phone

Backend ships with a `/simulate` endpoint:

```bash
curl -X POST http://localhost:8000/simulate \
  -H 'content-type: application/json' \
  -d '{
    "caller_phone": "+15555550100",
    "script": [
      "Hi, my charger at the UC Davis lot wont start a session. Screen is on but nothing happens when I plug in.",
      "It is charger2.",
      "Thanks, that works for me."
    ],
    "delay_s": 0.6
  }'
```

The dashboard renders every event live. Reset between runs with the **Reset** button (top-right) or press **R**.

## Reset

- UI button (top-right of dashboard) or keypress **R**
- HTTP: `POST /api/admin/reset` (clears SQLite + in-memory sessions, emits `reset` event)

## Edge cases to spot-check

- **Unknown charger ID** → tool returns `{error: unknown_charger, available: [...]}`. The agent should ask the caller for the right ID instead of hallucinating.
- **No GEMINI_API_KEY** → reply is a fallback ("Sorry, I had a hiccup..."). Set the key.
- **No Moss / Supermemory keys** → stub mode logs a warning on boot. Latency counters still look right because the stubs simulate 8ms / 80ms.
- **WebSocket reconnect** → kill the backend mid-call, restart it. Frontend reconnects with exponential backoff.

## Anti-patterns (spec §13)

- No Gemini Live, no audio.
- No frontend state libraries beyond Context + reducer.
- No pre-parsing charger markdown — Gemini gets the raw text.
- No long-term-lane activity during the call body — only preload (start) and write-back (end).
