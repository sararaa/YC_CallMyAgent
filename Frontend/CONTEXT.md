# ChargePulse — Frontend Context

Built during the YC CallMyAgent Hackathon session. This document captures the full
structure, every API surface, and every integration point that needs to be wired to
real services before going live.

---

## What Was Built

A real-time EV charger diagnostic call monitoring dashboard. The UI auto-runs a demo
flow on page load: a simulated inbound call is transcribed live, Gemini analyzes the
fault, and a work order is generated automatically.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind v4 · Framer Motion ·
Zustand · Recharts · Lucide React

**Deploy target:** Vercel

---

## Project Structure

```
frontend/
  src/
    app/                          ← Next.js App Router pages + API routes
      page.tsx                    ← Main dashboard (3-panel layout, runs demo flow)
      layout.tsx                  ← Root layout: Navbar + ToastNotification + WorkOrderModal
      globals.css                 ← Design system: @theme colors, keyframes, .glass utility
      work-orders/
        page.tsx                  ← Work order list (table + grid, search + filter)
        [id]/page.tsx             ← Individual work order detail page
      api/
        call/
          start/route.ts          ← POST  — initiate a call session
          transcript/route.ts     ← GET   — SSE stream of live transcription
        gemini/
          analyze/route.ts        ← POST  — SSE stream of Gemini analysis
        charger/
          [id]/route.ts           ← GET   — charger context + history
        workorder/
          generate/route.ts       ← POST  — create work order from call
        workorders/
          route.ts                ← GET   — paginated work order list
          [id]/route.ts           ← GET   — single work order detail

    components/
      layout/
        Navbar.tsx                ← Logo, DEMO MODE badge, LIVE timer, nav links, avatar
        ToastNotification.tsx     ← Bottom-right spring toast with 10s auto-dismiss
      panels/
        GeminiPanel.tsx           ← Left panel: thinking block → staggered result cards
        CallPanel.tsx             ← Center panel: header + waveform + transcript + input
        ChargerPanel.tsx          ← Right panel: info + graph + health score + past WOs
      gemini/
        ThinkingBlock.tsx         ← Collapsible streaming thinking text (Claude-style)
        FaultCard.tsx             ← Fault code + animated radial confidence arc
        UrgencyCard.tsx           ← P1/P2/P3/P4 badge + downtime risk
        PartsCard.tsx             ← Parts list with stock status dots
        DiagnosticCard.tsx        ← Typewriter-effect summary paragraph
      call/
        CallHeader.tsx            ← Caller name, charger ID, LIVE badge, duration timer
        AudioWaveform.tsx         ← 20-bar CSS keyframe waveform (active/paused)
        Transcript.tsx            ← Chat bubbles with AnimatePresence + typing indicator
        InputArea.tsx             ← Disabled during call, editable notes after
      charger/
        ChargerInfoCard.tsx       ← Fields grid + status dot + copyable ID
        UsageGraph.tsx            ← dynamic() wrapper (ssr:false) for Recharts
        UsageGraphInner.tsx       ← AreaChart: sessions + kWh, fault day ReferenceLine
        HealthScore.tsx           ← Animated SVG donut, color-coded 0–100
        PastWorkOrders.tsx        ← Last 5 WOs for charger, links to detail page
      workorders/
        WorkOrderModal.tsx        ← Full-screen overlay: fields, parts, tech dropdown, actions
        WorkOrderTable.tsx        ← Dark table with row-level navigation
        WorkOrderCard.tsx         ← Glassmorphism card with urgency border glow
        WorkOrderTimeline.tsx     ← Vertical timeline with staggered Framer entrance
        FilterBar.tsx             ← Search + status chips + sort + view toggle + export
      ui/
        Badge.tsx                 ← Variant badge (cyan/violet/red/amber/green/gray)
        GlassCard.tsx             ← Reusable glassmorphism card with optional glow + style
        StatusDot.tsx             ← Colored dot with ping animation for online status
        CopyableId.tsx            ← Click-to-copy with checkmark feedback
        LoadingSkeleton.tsx       ← Skeleton + PanelSkeleton components

    lib/
      types.ts                    ← All TypeScript interfaces and union types
      utils.ts                    ← cn(), formatDuration(), urgencyColor/Bg, statusBg, etc.
      mockData.ts                 ← All demo data (chargers, work orders, transcript, Gemini)

    store/
      callStore.ts                ← status, callerId, chargerId, duration, transcript[]
      geminiStore.ts              ← isThinking, thinkingText, isComplete, results
      workOrderStore.ts           ← currentWO, workOrders[], showModal, showToast
      chargerStore.ts             ← activeCharger
```

---

## Demo Flow (currently fully mocked)

Triggered automatically on `src/app/page.tsx` mount via `useEffect`:

```
1.  POST /api/call/start
        ↓ returns { callId, callerId, chargerId }
2.  GET  /api/charger/CHG-4471
        ↓ populates right panel with charger context
3.  Start interval → callStore.tickDuration() every 1s
4.  GET  /api/call/transcript   (SSE)
        ↓ streams words → callStore.addMessage / updateLastMessage
        ↓ receives { type: 'call_ended' } → callStore.endCall()
5.  POST /api/gemini/analyze    (SSE)
        ↓ streams thinking text → geminiStore.appendThinking()
        ↓ receives { type: 'result', data } → geminiStore.setComplete()
6.  POST /api/workorder/generate
        ↓ returns WorkOrder → workOrderStore.setCurrentWO() + showToastNotification()
```

---

## API Routes — What Each One Does & What Needs to Change

### `POST /api/call/start`
**File:** `src/app/api/call/start/route.ts`

**Current (mock):** Returns hardcoded `{ callId, callerId: 'Marcus Webb', chargerId: 'CHG-4471', callerPhone }` after 400ms.

**Real implementation needed:**
- This should be triggered by an **inbound webhook from your telephony provider** (e.g., Twilio, Bland.ai, Vapi, or whatever phone agent is making the call).
- The phone agent (agentPhone) should POST here when a call connects, sending the caller's phone number and/or charger ID (extracted from their speech or IVR).
- Should create a call session in your database and return a `callId`.
- Fields to receive from phone agent: `callerPhone`, `chargerId` (if known via IVR), `agentId`.

```typescript
// Expected real request body from phone agent webhook:
{
  callId: string           // from telephony provider
  callerPhone: string      // e.g. "+14155550182"
  chargerId?: string       // if extracted from IVR menu
  agentId: string          // which AI phone agent handled it
}
```

---

### `GET /api/call/transcript`
**File:** `src/app/api/call/transcript/route.ts`

**Current (mock):** Streams a hardcoded sample transcript word-by-word via SSE at 120ms/word, with 700ms pauses at sentence boundaries.

**Real implementation needed:**
- Wire to your **real-time transcription provider** — Deepgram, AssemblyAI, or the transcription output from your phone agent (Bland.ai / Vapi both emit transcription webhooks).
- The route should accept a `?callId=` query param and stream that call's live transcription.
- Two options:
  - **WebSocket relay:** Phone agent → your backend WebSocket → this SSE endpoint.
  - **Webhook accumulator:** Phone agent sends transcription chunks to a POST endpoint → this SSE polls/streams them out.
- SSE event format (keep this — the frontend expects it):
```
data: {"type":"message_start","messageId":"msg-abc"}
data: {"type":"word","messageId":"msg-abc","word":" Hello"}
data: {"type":"call_ended"}
```

---

### `POST /api/gemini/analyze`
**File:** `src/app/api/gemini/analyze/route.ts`

**Current (mock):** Streams hardcoded thinking text char-by-char then returns a hardcoded `GeminiResult` JSON object.

**Real implementation needed:**
- Call **Google Gemini Flash** (or Gemini 2.0 Flash Thinking) with the call transcript as input.
- Use the Gemini SDK with streaming enabled.
- Prompt should ask Gemini to:
  1. Think through the fault (extended thinking → stream as `thinking_chunk` events)
  2. Return structured JSON matching the `GeminiResult` type
- Request body from frontend: `{ transcript: string, chargerId: string }`
- You'll need: `GOOGLE_AI_API_KEY` in `.env.local`

```typescript
// GeminiResult shape the frontend expects:
{
  faultCode: string             // e.g. "EVSE-E023"
  faultDescription: string
  confidence: number            // 0–100
  severity: 'critical' | 'warning' | 'info'
  urgency: 'P1' | 'P2' | 'P3' | 'P4'
  downtimeRisk: string
  responseWindow: string        // e.g. "Within 2 hours"
  parts: {
    name: string
    partNumber: string
    stock: 'in_stock' | 'low_stock' | 'order_required'
  }[]
  diagnosticSummary: string
}
```

SSE event format (keep this — frontend parses it):
```
data: {"type":"thinking_start"}
data: {"type":"thinking_chunk","text":"...one char..."}
data: {"type":"thinking_done"}
data: {"type":"result","data":{...GeminiResult}}
```

---

### `GET /api/charger/[id]`
**File:** `src/app/api/charger/[id]/route.ts`

**Current (mock):** Returns one of 3 hardcoded chargers from `mockData.ts` (CHG-4471, CHG-2209, CHG-8834).

**Real implementation needed:**
- Query your **charger management system / OCPP backend** for:
  - Static info: model, location, install date, firmware
  - Current status: online/offline/degraded
  - Health score (calculated from recent fault history)
  - Last 30 days of usage (sessions per day, kWh per day)
  - Past work orders for this charger
- Data sources could be: ChargePoint API, OCPI, your own OCPP server (e.g., SteVe, EVerest), or a custom telemetry database.
- The `ChargerData` shape the frontend expects is in `src/lib/types.ts`.

---

### `POST /api/workorder/generate`
**File:** `src/app/api/workorder/generate/route.ts`

**Current (mock):** Waits 1.5s then returns a hardcoded work order built from the sample Gemini result.

**Real implementation needed:**
- Receive the Gemini analysis result + call metadata.
- Create a real work order in your **field service management system** (e.g., Salesforce Field Service, ServiceNow, or your own DB).
- Optionally: use another LLM call to generate a polished natural-language summary.
- Return the saved `WorkOrder` object with a real database ID.
- Request body:
```typescript
{
  callId: string
  chargerId: string
  customerName: string
  geminiResult: GeminiResult
}
```

---

### `GET /api/workorders`
**File:** `src/app/api/workorders/route.ts`

**Current (mock):** Filters/sorts/paginates the 10 hardcoded work orders from `mockData.ts`.

**Real implementation needed:**
- Query your work order database with the same filter params: `search`, `status`, `sort`, `page`, `limit`.
- Response shape the frontend expects:
```typescript
{ orders: WorkOrder[], total: number, page: number, limit: number }
```

---

### `GET /api/workorders/[id]`
**File:** `src/app/api/workorders/[id]/route.ts`

**Current (mock):** Finds a work order by ID from the hardcoded array.

**Real implementation needed:** Query your DB by work order ID. Returns a single `WorkOrder`.

---

## Open Integration Points (Webhooks to Fill In)

These are the external services that need to be connected. None are wired yet.

### 1. Phone Agent (agentPhone)
**What it needs to do:**
- Receive inbound calls from EV charger customers
- Run a conversational script to gather: charger ID, issue description, urgency
- Send real-time transcription to the frontend (via `POST /api/call/transcript` or a WebSocket relay)
- Fire a webhook to `POST /api/call/start` when a call connects, including caller metadata

**Likely providers:** Bland.ai, Vapi.ai, Twilio + OpenAI Realtime, Retell AI

**Environment variables needed:**
```
PHONE_AGENT_API_KEY=
PHONE_AGENT_WEBHOOK_SECRET=   # to verify webhook authenticity
PHONE_NUMBER=                  # the number customers call
```

---

### 2. Gemini (AI Analysis)
**What it needs to do:**
- Accept the full call transcript
- Run extended thinking to identify the EVSE fault code
- Return structured JSON (faultCode, urgency, parts, etc.)
- Stream the thinking + result back to the frontend via SSE

**Integration point:** `src/app/api/gemini/analyze/route.ts` — replace mock with real SDK call.

**Environment variables needed:**
```
GOOGLE_AI_API_KEY=             # Google AI Studio or Vertex AI key
GEMINI_MODEL=gemini-2.0-flash-thinking-exp   # or gemini-1.5-flash
```

**SDK:**
```bash
npm install @google/generative-ai
```

---

### 3. Supermemory (RAG — already partially set up at root level)
**What it needs to do:**
- Store EV charger repair manuals, fault code databases, and historical case notes
- Be queried during Gemini analysis to provide relevant context (RAG)
- The `ingest_pdfs.js` script at the repo root already handles pushing PDFs in

**Integration point:** Inside `POST /api/gemini/analyze` — before calling Gemini, query Supermemory for context related to the charger model and reported symptoms, then inject the results into the Gemini prompt.

**Environment variables (already in `.env.local` at repo root, need to be added to `frontend/.env.local`):**
```
SUPERMEMORY_API_KEY=sm_uAH611...
CLAUDE_SUPERMEMORY=sm_uAH611...   # second key — unclear purpose, possibly different container
```

**Query pattern:**
```typescript
import Supermemory from 'supermemory'
const client = new Supermemory({ apiKey: process.env.SUPERMEMORY_API_KEY })
const results = await client.search.execute({
  q: `${chargerModel} ${reportedSymptom} fault diagnosis`,
  containerTags: ['rag_data'],
})
// inject results[0..2].content into Gemini prompt as context
```

---

### 4. Charger Management / OCPP Backend
**What it needs to do:**
- Serve real charger data (status, usage history, health score) for `GET /api/charger/[id]`

**Integration point:** `src/app/api/charger/[id]/route.ts` — replace mock lookup with real API call.

**Environment variables needed:**
```
CHARGER_API_URL=
CHARGER_API_KEY=
```

---

### 5. Work Order / Field Service System
**What it needs to do:**
- Persist work orders created by `POST /api/workorder/generate`
- Serve them back via `GET /api/workorders` and `GET /api/workorders/[id]`
- Handle technician assignment and status updates

**Integration point:** The three workorder API routes.

---

## Environment Variables (create `frontend/.env.local`)

```bash
# Gemini
GOOGLE_AI_API_KEY=

# Phone agent (Bland/Vapi/Twilio)
PHONE_AGENT_API_KEY=
PHONE_AGENT_WEBHOOK_SECRET=

# Supermemory (copy from root .env.local)
SUPERMEMORY_API_KEY=sm_uAH611CrP4NZLxCF7Mkv6C_4u3B9o8DVpDXGQEDvBBMBHUXu0dXEvoeOXf0SLVnBuVbQRbhvEag1FyAkWSmRC9n
CLAUDE_SUPERMEMORY=sm_uAH611CrP4NZLxCF7Mkv6C_RxUaIIMeE98Ic5JEJARat9BdOdzApWzLy92anKEoavsWMs4YDmV0u72TRNrIlEce

# Charger backend
CHARGER_API_URL=
CHARGER_API_KEY=

# Work order system
WORKORDER_API_URL=
WORKORDER_API_KEY=
```

---

## Global State (Zustand Stores)

| Store | File | Key state |
|---|---|---|
| `callStore` | `src/store/callStore.ts` | `status`, `callerId`, `chargerId`, `duration`, `transcript[]` |
| `geminiStore` | `src/store/geminiStore.ts` | `isThinking`, `thinkingText`, `isComplete`, `results` |
| `workOrderStore` | `src/store/workOrderStore.ts` | `currentWO`, `workOrders[]`, `showModal`, `showToast` |
| `chargerStore` | `src/store/chargerStore.ts` | `activeCharger` |

All stores are client-side only. They reset on page refresh. When wiring real data, the
stores stay as-is — just feed them from the API responses that flow through `page.tsx`.

---

## Type Reference (`src/lib/types.ts`)

```typescript
CallStatus     = 'idle' | 'active' | 'ended'
FaultSeverity  = 'critical' | 'warning' | 'info'
Urgency        = 'P1' | 'P2' | 'P3' | 'P4'
WOStatus       = 'open' | 'dispatched' | 'resolved' | 'on_hold'
StockStatus    = 'in_stock' | 'low_stock' | 'order_required'
ChargerStatus  = 'online' | 'offline' | 'degraded'
```

Full interfaces: `TranscriptMessage`, `GeminiResult`, `ChargerData`, `WorkOrder`,
`WorkOrderPart`, `WorkOrderTimelineEvent`, `UsageDay`

---

## Design Tokens (Tailwind v4 — defined in `globals.css @theme`)

| Token | Value | Used for |
|---|---|---|
| `bg-base` | `#0a0a0f` | Page background |
| `bg-panel` | `#0d0d1a` | Panel backgrounds |
| `cyan-electric` | `#00d4ff` | Primary accent, CTAs, LIVE indicator |
| `violet-electric` | `#7c3aed` | Caller chat bubbles, secondary accent |
| `green-neon` | `#00ff88` | Healthy/online status, health score |
| `amber-warn` | `#f59e0b` | Warnings, P2 urgency, Demo badge |
| `red-critical` | `#ef4444` | Critical faults, P1 urgency, LIVE dot |

`.glass` utility: `backdrop-blur(12px)` + semi-transparent bg + subtle white border.

---

## Mock Data Location

All demo data lives in `src/lib/mockData.ts`:
- `MOCK_CHARGERS` — 3 chargers with 30 days of usage history each
- `MOCK_WORK_ORDERS` — 10 work orders across all statuses and urgencies
- `SAMPLE_TRANSCRIPT` — frustrated customer call about CHG-4471
- `SAMPLE_GEMINI_THINKING` — multi-sentence reasoning monologue
- `SAMPLE_GEMINI_RESULT` — structured fault analysis matching the transcript
- `TECHNICIANS` — 5 names for the assignment dropdown

To switch from demo to real data: replace the imports in each API route with actual
database/API calls. The store structure and component props do not need to change.

---

## Running Locally

```bash
cd frontend
npm run dev        # http://localhost:3000
npm run build      # production build (passes clean as of this session)
```

The app auto-runs the full demo flow on every page load. To replay it, refresh.
