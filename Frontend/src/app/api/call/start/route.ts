/**
 * POST /api/call/start
 *
 * Kicks off a scripted demo call by POSTing to the Python backend's
 * /simulate endpoint. All subsequent events (transcript, Gemini analysis,
 * work order) stream over the dashboard WebSocket — the frontend doesn't
 * need to fetch anything else after this.
 */
const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

const DEFAULT_SCRIPT = [
  "Hi, my charger at the UC Davis lot won't start a session. The screen is on but nothing happens when I plug in.",
  "It's charger2.",
  "Thanks, that helps.",
];

export async function POST(req: Request) {
  let body: { caller_phone?: string; script?: string[]; delay_s?: number } = {};
  try { body = await req.json(); } catch { /* allow empty body */ }

  const payload = {
    caller_phone: body.caller_phone || "+14155551847",
    script: body.script || DEFAULT_SCRIPT,
    delay_s: body.delay_s ?? 0.5,
  };

  // Fire and forget — the simulate run takes ~15-30s. We return immediately;
  // all state arrives via WebSocket.
  fetch(`${BACKEND}/simulate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  }).catch((e) => console.error("simulate POST failed", e));

  return Response.json({
    callId: `pending-${Date.now()}`,
    callerId: "Marcus Webb",
    chargerId: "charger2",
    callerPhone: payload.caller_phone,
  });
}
