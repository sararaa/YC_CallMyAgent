````markdown
# Volt — Voice Support Agent for EV Charging (Hackathon Build)

## 0. Project brief

We're building a voice AI customer support agent for an EV charging network, for a YC hackathon. A caller dials a phone number, talks to the agent, and the agent walks them through a structured support flow: greeting → problem scoping → triage (user/software/hardware) → branch-specific resolution → wrap-up with a generated report.

**The hackathon win condition is observability theater.** We are building a live operator dashboard that visualizes the agent's state machine, memory retrieval, tool calls, and latency in real time while a call is happening. **The dashboard IS the demo.** Judges must be able to see the agent think while it talks. Spend disproportionate effort on dashboard polish — it is worth more than any backend feature.

Pitch frame: "voice agent infrastructure — state-machine orchestration plus dual-tier memory for low-latency support agents." Polish, observability, and architectural clarity beat feature breadth.

## 1. Before you write code — confirm with me

Print this checklist back to me, fill in your assumptions, and wait for my confirmation before scaffolding.

1. Full list of charger IDs in `Data_RAG/`. Format is `Data_RAG/chargerX_summary.md`. I have at least `charger1_summary.md`. Ask me which ones exist.
2. AgentPhone setup — do I have a number provisioned? Webhook URL configured? Tell me exactly which env vars and config you'll need from me, and I'll fill them in.
3. Supermemory key — do I have an account and an API key? Same for Moss. List the env vars cleanly.
4. Gemini API key — print where it goes.
5. Where should the SQLite DB file live? Default `backend/db/volt.db`, confirm.
6. Port assignments — default backend `:8000`, frontend `:3000`. Confirm or change.

After I confirm those, build.

## 2. Stack (locked, do not deviate)

- **Backend:** Python 3.11+, FastAPI, `uvicorn`, WebSockets via `fastapi.WebSocket`
- **LLM:** Gemini 2.5 Flash via the `google-genai` SDK, **text mode with function calling** — NOT Gemini Live. See §3.
- **Telephony:** AgentPhone (text webhook in, text reply out — AgentPhone handles STT and TTS on its end). See §3.
- **DB:** SQLite via SQLModel for work orders, remote commands, reports, call logs
- **Memory hot tier:** Moss SDK (`moss` Python package, `usemoss.dev`), real but key stubbed
- **Memory cold tier:** Supermemory SDK (`supermemory` Python package), real but key stubbed
- **Frontend:** Next.js 14+ (App Router), TypeScript, Tailwind, Framer Motion, native WebSocket. One app, two routes: `/dashboard` (observability star) and `/admin` (work orders + commands + reports queues).
- **Fonts:** Inter via `next/font/google` at weights 400/500/600/700, used as the closest free fallback to OpenAI's Söhne. Use `font-feature-settings: "cv11", "ss03"` for the slightly-modern numeral set.
- **Color palette:**
  - `--bg`: `#FAFAF7` (warm white)
  - `--surface`: `#FFFFFF`
  - `--ink`: `#0F1419` (near-black text)
  - `--ink-2`: `#52606D` (secondary text)
  - `--muted`: `#9CA3AF`
  - `--border`: `#E5E7EB`
  - `--primary`: `#1A8870` (sage/teal — for active states, success)
  - `--primary-soft`: `#D5EBE3`
  - `--blue`: `#3B82F6` (accent for cold-tier memory, knowledge)
  - `--blue-soft`: `#DBEAFE`
  - `--warn`: `#D97706` (amber for in-progress / pending)
  - `--danger`: `#DC2626` (red for faults, high severity)
- **State management:** backend authoritative. Frontend uses React Context + a WebSocket reducer. No Redux, no Zustand. Do not over-engineer the FE state.

## 3. Critical architectural notes

### 3.1 We are NOT using Gemini Live
AgentPhone is a text-webhook telephony service. It transcribes the caller's voice and sends text to our webhook. We reply with text, AgentPhone speaks it back. We never touch raw audio. **Use `gemini-2.5-flash` in standard generation mode with function calling.** If you find yourself reaching for `google.genai.live`, audio resampling, μ-law/PCM, or WebSocket audio bridging — stop. Re-read this section.

### 3.2 Tool-gated state machine
States restrict which tools Gemini sees. Each turn, build the `tools=[...]` argument from the current state's whitelist only. This makes the state machine physically enforced — Gemini cannot call a tool that wasn't sent.

### 3.3 Two memory tiers with cache-aside
- **Moss** = hot tier, sub-10ms, session-scoped, wiped at `end_call`.
- **Supermemory** = cold tier, ~50-150ms, persists across calls, scoped by `containerTag = caller_phone_number`.
- On call start, preload Supermemory profile + top-K relevant chunks into Moss **in parallel** with the AgentPhone handshake. Don't block the first turn on preload — if it hasn't finished by turn 1, Moss queries gracefully miss and Supermemory takes the hit.
- During the call, `recall_session` hits Moss only. `recall_knowledge` tries Moss first (it has preloaded chunks), falls back to Supermemory on miss.
- At `end_call`, push the full transcript and a natural-language action summary to Supermemory, then wipe the Moss session index.

### 3.4 Real-shaped stubs for missing keys
If `SUPERMEMORY_API_KEY` or `MOSS_API_KEY` is empty, log a warning at startup and use realistic in-memory stubs so the demo still runs end-to-end. The stubs must:
- Return the same JSON shape as the real SDKs
- Add fake latency (`asyncio.sleep(0.05)` for Supermemory stub, `asyncio.sleep(0.008)` for Moss stub) so the latency counters still look right on the dashboard
- Emit the same observability events as real calls

## 4. State machine spec

Put this in `backend/state_machine.py` verbatim:

```python
BASE_PROMPT = """You are Volt, a voice customer support agent for ChargeForward, an EV charging network.
You're on a phone call. Keep replies short, warm, and natural — one or two sentences at a time.
Never invent telemetry, error codes, or account details. Always use tools to fetch real data.
You operate in discrete stages. Use the transition tools to advance when the current stage's goal is met.
If you don't know which stage you're in, look at the STAGE marker in the system prompt."""

STATES = {
    "greeting": {
        "suffix": "STAGE: Greeting. Greet the caller warmly. Ask how you can help. As soon as they describe any issue, call advance_to_scoping.",
        "tools": ["advance_to_scoping"],
    },
    "scoping": {
        "suffix": "STAGE: Problem scoping. Understand the problem in plain language. Ask 1-2 focused clarifying questions. Don't diagnose yet. When you can categorize the issue, call advance_to_triage.",
        "tools": ["recall_session", "advance_to_triage"],
    },
    "triage": {
        "suffix": "STAGE: Triage. Decide whether this is a USER issue (account/app/payment/confusion), a SOFTWARE issue (charger online but misbehaving, session errors, communication faults), or a HARDWARE issue (physical damage, won't power on, connector/cable problems). If unclear, ask one targeted question. Then call exactly one route_to_* tool.",
        "tools": ["recall_session", "route_to_user_issue", "route_to_software_issue", "route_to_hardware_issue"],
    },
    "resolve_user": {
        "suffix": "STAGE: User issue resolution. Walk the caller through the relevant steps using recall_knowledge for the right guide. Confirm resolution. Then call advance_to_wrap_up.",
        "tools": ["recall_session", "recall_knowledge", "advance_to_wrap_up"],
    },
    "resolve_software": {
        "suffix": "STAGE: Software issue resolution. Get the charger ID, call get_charger_telemetry. Identify the fault from telemetry. Search the knowledge base for remote resolution steps. Issue a remote command via send_remote_command if appropriate. Then call advance_to_wrap_up.",
        "tools": ["recall_session", "recall_knowledge", "get_charger_telemetry", "send_remote_command", "advance_to_wrap_up"],
    },
    "resolve_hardware": {
        "suffix": "STAGE: Hardware issue resolution. Get the charger ID and visible symptoms. Call get_charger_telemetry to confirm the fault. Then call create_work_order with severity, symptoms, and telemetry snapshot. Then call advance_to_wrap_up.",
        "tools": ["recall_session", "recall_knowledge", "get_charger_telemetry", "create_work_order", "advance_to_wrap_up"],
    },
    "wrap_up": {
        "suffix": "STAGE: Wrap up. Summarize what happened and what was done in one or two sentences. Then call generate_report. Then thank the caller and call end_call.",
        "tools": ["generate_report", "end_call"],
    },
}

TRANSITION_MAP = {
    "advance_to_scoping": "scoping",
    "advance_to_triage": "triage",
    "route_to_user_issue": "resolve_user",
    "route_to_software_issue": "resolve_software",
    "route_to_hardware_issue": "resolve_hardware",
    "advance_to_wrap_up": "wrap_up",
}

# Graph layout for the dashboard. Don't move these or the SVG positions break.
LAYOUT = {
    "greeting":         {"x": 0.10, "y": 0.50, "label": "Greeting"},
    "scoping":          {"x": 0.28, "y": 0.50, "label": "Scoping"},
    "triage":           {"x": 0.46, "y": 0.50, "label": "Triage"},
    "resolve_user":     {"x": 0.66, "y": 0.20, "label": "User Issue"},
    "resolve_software": {"x": 0.66, "y": 0.50, "label": "Software"},
    "resolve_hardware": {"x": 0.66, "y": 0.80, "label": "Hardware"},
    "wrap_up":          {"x": 0.88, "y": 0.50, "label": "Wrap Up"},
}
```

## 5. Tool specs

All tools are async, take JSON args, return JSON. Every tool call emits 2 observability events: `tool_call_start` and `tool_call_end` (see §6).

### 5.1 Memory tools (real SDK, key-stubbed fallback)
- `recall_session(query: str)` — hits Moss with `session_id` from context. Returns `{ "results": [{"text", "source", "score"}], "latency_ms", "hit": bool }`.
- `recall_knowledge(query: str)` — hits Moss first (preloaded chunks). On miss, falls back to Supermemory with `container_tag = caller_phone`. Returns same shape, plus `"tier": "moss" | "supermemory"`.

### 5.2 Telemetry tool (real markdown files)
- `get_charger_telemetry(charger_id: str)` — reads `Data_RAG/{charger_id}_summary.md` from disk and returns `{ "charger_id", "markdown": "<full text>", "loaded_ms": <int> }`. Hand the whole markdown to Gemini — let the model reason over it. Do not pre-parse.
- Validation: if file doesn't exist, return `{ "error": "unknown_charger", "available": [list of known IDs] }` and let Gemini ask the caller for the right ID. Do not crash.

### 5.3 Action tools (SQLite + Supermemory mirror)
- `send_remote_command(charger_id, command)` where `command` is enum `["reboot", "reset_session", "clear_fault", "ota_update"]`. Writes `RemoteCommand` row, returns `{ "command_id", "status": "queued" }`.
- `create_work_order(charger_id, severity, symptoms, telemetry_snippet)` where `severity` is enum `["low", "medium", "high", "critical"]`. Writes `WorkOrder` row, returns `{ "work_order_id", "status": "open" }`.
- `generate_report(resolution_type, summary, actions_taken, follow_up_needed)` — writes `CallReport` row with all fields plus `session_id` and `caller_phone`. Returns `{ "report_id" }`.

### 5.4 Transition tools
Each transition tool takes no args (or optionally `reason: str` for logging). On call:
1. Update `current_state` for this session.
2. Emit `state_transition` event with `{from, to, reason, timestamp}`.
3. Return `{ "ok": true, "new_state": <name> }` to Gemini.
The next turn rebuilds the tool list from `STATES[new_state]["tools"]`.

### 5.5 `end_call`
1. Push the full transcript to Supermemory with `containerTag = caller_phone`, content type `chat`.
2. Push a natural-language action summary to Supermemory ("Caller reported... agent diagnosed... actions taken: work order WO-123 created for CHG-002").
3. Wipe the Moss index for this session.
4. Emit `call_end` event with `{report_id, duration_s, final_state}`.
5. Return `{ "ok": true }` and close the conversation thread.

## 6. Observability event schema

All events flow over a single WebSocket at `ws://localhost:8000/ws/dashboard`. Event envelope:

```json
{ "type": "<event_type>", "session_id": "<uuid>", "timestamp": "<iso>", "payload": { ... } }
```

Event types (be strict about these names):
- `call_start` → `{ caller_phone, session_id }`
- `call_end` → `{ report_id, duration_s, final_state }`
- `state_transition` → `{ from, to, reason }`
- `tool_call_start` → `{ request_id, tool, args }`
- `tool_call_end` → `{ request_id, tool, result_preview, duration_ms, ok }`
- `memory_query` → `{ tier: "moss"|"supermemory", query, results: [...], duration_ms, hit }`
- `transcript` → `{ role: "caller"|"agent", text }`
- `latency_sample` → `{ component: "gemini"|"moss"|"supermemory", ms }` (emit on every relevant call)
- `admin_update` → `{ kind: "work_order"|"remote_command"|"report", id, fields }` (so admin view updates without polling)

The frontend reducer indexes events into derived state: current state, transcript array, memory hits, latency rolling averages, etc.

## 7. Backend file layout

```
backend/
├── main.py                    # FastAPI app, lifespan, route registration
├── agent.py                   # turn loop: receive text → build tools list → Gemini call → tool execution → reply
├── state_machine.py           # STATES, TRANSITION_MAP, LAYOUT
├── observer.py                # event bus: in-memory pub/sub, fanout to dashboard WS
├── session.py                 # per-call state: current_state, history, caller_phone, session_id
├── routes/
│   ├── agentphone.py          # webhook endpoint(s) for AgentPhone
│   ├── dashboard_ws.py        # /ws/dashboard for live event stream
│   └── admin_api.py           # /api/admin/* REST endpoints for the admin view
├── tools/
│   ├── __init__.py            # TOOL_REGISTRY + schemas (Gemini function declarations)
│   ├── memory.py              # recall_session, recall_knowledge
│   ├── telemetry.py           # get_charger_telemetry
│   ├── actions.py             # send_remote_command, create_work_order, generate_report
│   └── transitions.py         # advance_to_*, route_to_*, end_call
├── memory/
│   ├── moss_client.py         # real client + stub
│   └── supermemory_client.py  # real client + stub
├── db/
│   ├── models.py              # SQLModel: RemoteCommand, WorkOrder, CallReport, CallLog
│   └── session.py             # engine, get_session
└── data/
    └── (chargers live at repo-root Data_RAG/ — don't duplicate)
```

## 8. Frontend file layout

```
frontend/
├── app/
│   ├── layout.tsx             # Inter font, global styles, palette CSS vars
│   ├── page.tsx               # → redirects to /dashboard
│   ├── dashboard/page.tsx     # the demo star
│   └── admin/page.tsx         # work orders / commands / reports queues
├── components/
│   ├── dashboard/
│   │   ├── TopBar.tsx
│   │   ├── StateGraph.tsx     # the centerpiece — see §9
│   │   ├── TranscriptPanel.tsx
│   │   ├── MemoryWall.tsx
│   │   ├── ToolPalette.tsx
│   │   ├── LatencyTicker.tsx
│   │   └── ArtifactDrawer.tsx # telemetry markdown, work orders, reports popping in
│   ├── admin/
│   │   ├── WorkOrderQueue.tsx
│   │   ├── CommandQueue.tsx
│   │   └── ReportQueue.tsx
│   └── primitives/
│       ├── Pill.tsx
│       ├── Card.tsx
│       └── Tooltip.tsx
├── lib/
│   ├── ws.ts                  # WebSocket client + reconnect
│   ├── reducer.ts             # event reducer → derived UI state
│   ├── types.ts               # shared event types (match backend §6)
│   └── format.ts              # ms formatting, phone masking, time
└── styles/
    └── globals.css            # CSS vars from §2
```

## 9. Dashboard spec — the centerpiece (TRYHARD)

The `/dashboard` page is the demo. Spend time here. The layout is a single full-viewport view, no scroll. Grid:

```
┌──────────────────────────────────────────────────────────────────────────┐
│  TOP BAR (h-16)                                                          │
│  [● LIVE]  Volt · Call from +1 (***) ***-1847 · 02:14                    │
│  Stage: Resolve Hardware    Latency: G 412ms · M 7ms · SM 84ms           │
├──────────────────────────────────┬───────────────────────────────────────┤
│                                  │                                       │
│  STATE GRAPH                     │  TRANSCRIPT                           │
│  (60% width, 60% height)         │  (40% width, 60% height)              │
│                                  │  scrolling list, newest at bottom     │
│                                  │  caller bubbles right, agent left     │
│                                  │  inline tool pills, expandable        │
│                                  │                                       │
├──────────────────────────────────┴───────────────────────────────────────┤
│                                                                          │
│  MEMORY WALL (left 55%)                  TOOL PALETTE (right 45%)        │
│  Two columns: MOSS (hot) | SM (cold)     Grid of tools, locked/unlocked  │
│  Chunks fly in from edges                Active state's tools highlighted│
│  Source label, score, latency badge      Recently fired tools pulse      │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

A floating `ArtifactDrawer` slides up from the bottom-right when a tool produces a substantial artifact (telemetry markdown rendered, work order card, generated report). Drawer stays for ~6 seconds then minimizes to a clickable thumbnail.

### 9.1 State graph (the money shot)

- SVG-based, ~720px wide × 400px tall, with 7 nodes positioned per `LAYOUT` constants from §4 (multiply ratios by viewBox).
- Each node = a rounded rect, ~120×56px, with the state label centered, Inter 500 14px.
- Edges = quadratic Bézier curves between nodes, 2px stroke.
- **Visual states** for each node:
  - `pending` (not yet visited): stroke `--border`, fill `--surface`, text `--muted`.
  - `active` (current state): stroke `--primary` 3px, fill `--primary-soft`, text `--ink`, with a **soft pulsing aura** at 1.5s period using Framer Motion. The aura is a second SVG rect offset by +6px radius with low opacity that animates 0.3→0 opacity and 1.0→1.2 scale.
  - `visited` (past states on the taken path): stroke `--primary` 2px solid, fill `--primary-soft` 50% opacity, text `--ink`, a small ✓ in the top-right corner.
  - `eliminated` (branches NOT taken after the triage fork): stroke `--muted` dashed 1.5px, fill `--bg`, text `--muted` with 40% opacity. Add a subtle diagonal hash pattern overlay.
- **Edges** mirror node state: traversed edges are solid `--primary`; not-yet-traversed are dashed `--border`; eliminated edges are dashed `--muted` 40% opacity.
- **The fork animation (critical):** when a `route_to_*` transition fires from `triage`, animate over 800ms:
  1. The chosen branch's edge: dash-array starts at `100, 100` and animates `stroke-dashoffset` from 100 to 0, drawing the line. Easing: `easeOutQuart`.
  2. Simultaneously, the chosen target node fades from `pending` → `active`.
  3. With a 200ms delay, the two non-chosen branches: edges fade to 40% and turn dashed; target nodes ease to `eliminated`. This must feel like *commitment* — the dashboard visually decides.
- **Active node pulse:** the `active` node has the pulsing aura described above, plus its label gets a very subtle font-weight bump from 500 to 600 to differentiate.
- **Hover state:** hovering any node shows a tooltip with the state's `suffix` text (so judges can see the agent's stage-specific instructions).

### 9.2 Transcript panel

- Each turn rendered as a chat bubble: agent on the left (`--primary-soft` bg), caller on the right (`--surface` bg with `--border`).
- Tool calls render **inline between turns** as a pill row: small rounded badges with the tool name, an icon, a duration badge. Hover/click expands to show args and result preview as a card below.
- Pills are color-coded by category:
  - Memory tools: `--blue-soft` bg, `--blue` border
  - Telemetry: `--primary-soft` bg, `--primary` border
  - Actions (write): `--warn` tinted bg `#FEF3C7`, `--warn` border
  - Transitions: `--ink` bg, `--surface` text (pop)
- Newest at the bottom. Auto-scroll unless the user has manually scrolled up (sticky-bottom pattern).
- Streaming: if Gemini's reply is incremental, type it out into the bubble character-by-character at ~30 chars/sec for the demo feel. (Even though AgentPhone returns the final text in one shot, you can fake the typing client-side after receiving the `transcript` event.)

### 9.3 Memory wall

- Two columns, labeled `MOSS · hot · sub-10ms` and `SUPERMEMORY · cold · ~50ms`.
- When a `memory_query` event arrives, a chunk card flies in from the corresponding column's outer edge using Framer Motion's `initial`/`animate`/`exit`. Spring config: stiffness 200, damping 22.
- Card shows: chunk text (truncated to 2 lines, full on hover), source label (e.g., `charger2_summary.md § Fault History`), latency badge (`7ms` or `84ms`).
- Hit vs miss: cache hits get a tiny green dot, misses get a faded card with "miss" tag.
- Old cards age out: opacity decays after 8 seconds, removed after 12. Cap at 6 visible per column to prevent clutter.

### 9.4 Tool palette

- Grid of all 12 tools across all states. Each tool is a tile, ~140×80px.
- For each tile, the *currently available* state is one of three:
  - **`available`** (in current state's whitelist): full color, hover ready, subtle `--primary` glow.
  - **`locked`**: grayscale, lock icon overlay, `--muted` text. This is the visualization of physics — judges see Gemini is constrained.
  - **`firing`**: when a `tool_call_start` arrives, the tile flashes `--primary-soft` then settles, with a small spinner. On `tool_call_end`, brief check or X. ~600ms total animation.
- Reorder tiles when state changes so available ones float to the top (subtle reflow animation, 300ms).

### 9.5 Latency ticker

- Three big numbers in the top bar, label + ms.
- Update on every `latency_sample` event using a rolling mean of the last 5 samples per component.
- When a number changes by more than 20%, animate the digit with a quick odometer-style flip (Framer Motion).
- Color: green when within healthy range (Gemini <600ms, Moss <15ms, Supermemory <120ms), amber if over, red if 2x over.

### 9.6 Artifact drawer

- When a tool produces something visual-worthy, slide a card up from the bottom-right:
  - `get_charger_telemetry`: a rendered markdown card showing the first ~300 lines of the file with syntax-highlighted code blocks, a header with charger ID and location.
  - `create_work_order`: a "ticket" card — work order ID, severity badge (color matches `--danger` for high, `--warn` for medium), charger, symptoms, timestamp.
  - `send_remote_command`: a compact "command queued" card showing command, target, status.
  - `generate_report`: a polished, full-width report card with sections: Caller, Issue Summary, Resolution Path, Actions Taken, Follow-Up. This is the demo's grand finale — make it look like an actual deliverable.
- Drawer auto-minimizes to a small thumbnail after 6s, click to re-expand.

### 9.7 Demo helpers

- **Reset button** in the top-right corner: clears the dashboard state, closes any open session, resets DB. One keystroke `R` also resets.
- **Connection status** small dot near the top — green when WS connected, amber reconnecting, red dead. Auto-reconnect with backoff.
- **Pre-call "ready" state**: when no call is active, the dashboard shows a clean idle view with `Ready` + `Waiting for incoming call...` and the state graph in all-pending. Looks intentional, not broken.

## 10. Admin dashboard (`/admin`)

Less polish than `/dashboard`, but still clean. Three sections stacked or as tabs:

1. **Work Orders** — table or card grid, sortable by created_at and severity, status pills (open/in_progress/resolved), severity color-coded.
2. **Remote Commands** — table with command type, target charger, status (queued/sent/acknowledged), created_at.
3. **Call Reports** — list of past calls with caller phone (masked), final state, resolution_type, duration, report summary preview, click to expand.

All views update live via the `admin_update` event over the same WebSocket. No polling. Manual refresh button as backup.

## 11. Environment variables — print these for me

At first run, print this block and ask me to populate `.env`:

```
# Gemini
GEMINI_API_KEY=

# Telephony
AGENTPHONE_API_KEY=
AGENTPHONE_NUMBER=        # e.g. +14155551234
AGENTPHONE_WEBHOOK_SECRET= # optional, for signed webhook verification

# Memory tiers (leave blank to use stubs)
SUPERMEMORY_API_KEY=
MOSS_API_KEY=
MOSS_PROJECT_ID=

# App
PORT=8000
DASHBOARD_ORIGIN=http://localhost:3000
DB_PATH=backend/db/volt.db
```

Also print a second block listing where I need to point AgentPhone's webhook (`POST https://<my-public-url>/webhooks/agentphone`) and tell me to use ngrok or Cloudflare Tunnel for the demo.

## 12. Demo flow you should optimize for

The hero demo is the **hardware path** because it has the most artifacts to show. Build the system so this flow is smooth as glass:

1. Caller: "Hi, my charger at the UC Davis lot won't start a session. Screen is on but nothing happens when I plug in."
2. Agent (greeting → scoping → triage): asks 1 clarifier, then routes to hardware.
3. **Fork animation fires.** Two branches dim.
4. Agent: "Can I get the charger ID? It's usually on a sticker on the unit."
5. Caller: "It's charger2."
6. `get_charger_telemetry("charger2")` fires. Tool palette flashes. **Markdown artifact drawer slides up showing the telemetry file.**
7. Agent reasons over telemetry: "Looks like the contactor is welded — that's a hardware fault that needs a technician."
8. `create_work_order(...)` fires. **Work order card slides into the drawer.**
9. Agent: "I've created a work order, severity high, a technician will be there within 24 hours."
10. Wrap-up. `generate_report` fires. **Final report card displays.**
11. `end_call`. Memory write to Supermemory visible in the Memory Wall.

Rehearse this. The demo script lives in `docs/DEMO.md` — write a checklist version of these 11 steps once everything works.

## 13. Anti-patterns — do NOT do these

- Do not use Gemini Live, native audio, WebSocket audio bridging, μ-law, PCM resampling. AgentPhone handles all that.
- Do not build a frontend state library beyond React Context + reducer. WS event reducer is plenty.
- Do not parse the charger markdown into structured fields. Hand the raw text to Gemini.
- Do not invent severity or telemetry values. Always route through the real markdown.
- Do not block the first agent turn on Supermemory preload. It runs in parallel.
- Do not store work orders / reports / commands only in Supermemory. SQLite is the operational store. Supermemory is the cross-call memory.
- Do not over-format the dashboard with bullets/headers/text walls. It should feel like an instrument, not a doc page.
- Do not skip the fork animation. It is the single most important visual moment.
- Do not ship without a working reset button. We will reset between demo runs.

## 14. Build order (suggested)

1. Scaffold backend + frontend, env loading, basic FastAPI app, Next.js app with palette + Inter loaded
2. SQLite models + migrations
3. Observer event bus + WS endpoint + frontend WS client + reducer
4. State machine + Gemini integration + dummy AgentPhone simulator (lets you test without a phone)
5. Telemetry tool (real markdown loading) + transition tools
6. Action tools (DB writes) + admin endpoints + admin views
7. Memory clients (stubs first, real SDKs second) + cache-aside in `recall_knowledge`
8. AgentPhone webhook wiring + ngrok instructions
9. Dashboard: TopBar, then StateGraph, then TranscriptPanel, then MemoryWall, then ToolPalette, then LatencyTicker, then ArtifactDrawer (in that order — graph is the keystone)
10. Demo flow rehearsal + reset wiring + edge cases (unknown charger, missing data, dropped connection)

When step 9 starts, do not move to step 10 until the StateGraph and fork animation look genuinely impressive on screen. That is the part that wins the hackathon.

Ask before scaffolding. Confirm §1.
````

---

# ADDENDUM — Memory Architecture (overrides §3.3, §5.1, §5.5, §6, §9.3 where conflicting)

This addendum is authoritative. Where it conflicts with the original prompt, this wins.

## A. Three memory tiers, not two

| Tier | Implementation | Purpose | Latency |
|---|---|---|---|
| Session cache | Moss index named `session-{session_id}`, created at call start with `autorefresh=True`, populated continuously, deleted at end_call | Recent turns + preloaded user context | <10ms |
| Knowledge | Moss index named `volt-kb`, built ONCE offline by `backend/scripts/upload.py` from `Data_RAG/*.md` | Static support knowledge base | <10ms |
| Long-term | Supermemory, scoped by `containerTag=caller_phone` | Cross-call user history | ~80-150ms |

Supermemory is **plumbing, not a tool**. The agent never queries it directly during a call. It is read once at call start (preload into session Moss) and written once at end_call.

## B. Required new file: `backend/scripts/upload.py`

One-shot script. Reads every `Data_RAG/chargerX_summary.md`, creates Moss index `volt-kb`, calls `moss.create_index("volt-kb", chunks)` with each markdown file broken into ~500-token chunks preserving section headers. Run manually before the demo. Print "Indexed N chargers into volt-kb" on success.

## C. Call lifecycle (overrides any earlier flow)

```
Call start (AgentPhone webhook fires):
  1. Spawn session record with session_id = uuid4(), caller_phone from webhook
  2. moss.create_index(f"session-{session_id}", [placeholder_doc])
  3. moss.load_index(f"session-{session_id}", autorefresh=True)
  4. asyncio.create_task(preload_from_supermemory(session_id, caller_phone))
     -- pull profile + top-K chunks, then moss.add_docs into session index
     -- DO NOT await this. First turn must not block on preload.
  5. Return greeting text to AgentPhone.

Every turn:
  1. AgentPhone webhook delivers user text.
  2. await moss.add_docs(f"session-{session_id}", [{id, text, role:"user", ts}])
  3. Run Gemini turn loop with state-filtered tools.
  4. await moss.add_docs(f"session-{session_id}", [{id, text, role:"agent", ts}])
  5. Return reply text to AgentPhone.

Call end (end_call tool fires):
  1. Build transcript string + action summary string.
  2. await supermemory.add(content=transcript, containerTag=caller_phone, contentType="chat")
  3. await supermemory.add(content=action_summary, containerTag=caller_phone, contentType="text")
  4. await moss.delete_index(f"session-{session_id}")
  5. Emit call_end observability event.
```

## D. Tools (overrides §5.1)

- `recall_session(query: str)` — `moss.query(f"session-{session_id}", query, top_k=5)`. Returns `{results, latency_ms, tier: "session"}`.
- `recall_knowledge(query: str)` — `moss.query("volt-kb", query, top_k=5)`. Returns `{results, latency_ms, tier: "knowledge"}`.
- No tool exposes Supermemory to the agent.

## E. Memory client wrapper requirements (`backend/memory/moss_client.py`)

- Single shared `MossClient` instance (project_id + project_key from env).
- Wrap `load_index` to always pass `autorefresh=True`.
- If autorefresh has noticeable propagation delay in testing, add a fallback: after each `add_docs`, await a short `load_index` re-call to force refresh. Keep this behind a config flag `MOSS_FORCE_REFRESH_ON_ADD=true` so it's tunable on demo day.
- Graceful degradation: if `MOSS_API_KEY` or `MOSS_PROJECT_ID` missing, log a warning at startup and use an in-memory dict-based stub that mimics `create_index`, `add_docs`, `query`, `delete_index` with the same return shapes, plus `asyncio.sleep(0.008)` to keep latency counters realistic.

## F. Observability events (overrides §6)

- `memory_query` event payload: `{tier: "session" | "knowledge" | "long_term", query, results, duration_ms, hit}`. Three valid tier values, not two.
- `latency_sample` event payload: `{component: "moss_session" | "moss_kb" | "supermemory" | "gemini", ms}`. Four components, not three.
- New event: `memory_ingest` — fired on every `add_docs`. Payload: `{tier, doc_id, text_preview, latency_ms}`. The dashboard renders these as small pulses in the relevant lane so judges see the cache growing in real time.

## G. Dashboard Memory Wall (overrides §9.3)

Three vertical lanes side by side, not two columns:

| Lane | Label | Header subtitle | Color |
|---|---|---|---|
| Left | `SESSION CACHE` | `Moss · session-{id} · <10ms` | `--primary` sage |
| Center | `KNOWLEDGE` | `Moss · volt-kb · <10ms` | `--blue` |
| Right | `LONG-TERM` | `Supermemory · {phone} · ~80ms` | `--warn` amber |

Each lane shows incoming chunks as cards with: text preview (2 lines), source label, latency badge, hit/miss dot.

**Bookend animations (critical):**
- **Call start preload:** when Supermemory returns preloaded chunks, animate them flying OUT of the LONG-TERM lane and INTO the SESSION CACHE lane. Use Framer Motion `layoutId` for shared-element transitions. Duration 1200ms with stagger 80ms between chunks. This is the visual proof of "preload from cold to hot."
- **Call end write-back:** when `end_call` fires, render a single large "Transcript" card in the SESSION CACHE lane, then animate it flying INTO the LONG-TERM lane. Duration 1500ms. This is the visual proof of "persistence."

The long-term lane being mostly idle during the call is intentional — it makes the bookend animations land harder. Do not "fake" activity in this lane during the call.

## H. Top bar latency display (overrides §9.5)

Four numbers, not three: `G {gemini}ms · MS {moss_session}ms · MK {moss_kb}ms · SM {supermemory}ms`. Healthy thresholds: Gemini <600, Moss <15, Supermemory <120. Color amber if exceeded, red at 2x.

## I. Anti-patterns added to §13

- Do not expose Supermemory as a tool to the agent. It is plumbing.
- Do not skip `autorefresh=True` on session index load. The cache won't be queryable.
- Do not pre-build the session Moss index outside the call lifecycle. Each call gets a fresh one, deleted on end.
- Do not animate activity in the LONG-TERM lane during the call body. It only fires at start (preload) and end (write-back).

## J. Build order patch (overrides §14)

Insert as step 6.5 (between Memory clients and AgentPhone wiring):
- 6.5: Write `backend/scripts/upload.py` and dry-run it against `Data_RAG/`. Confirm `moss.list_indexes()` shows `volt-kb` with the expected document count. This must work before any session work begins.