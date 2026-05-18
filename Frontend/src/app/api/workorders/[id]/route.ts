/**
 * GET /api/workorders/[id] — proxies to Python backend and applies the same
 * shape transformation as the list route so WorkOrder fields are always present.
 */
const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

function toFrontendWO(r: Record<string, unknown>): Record<string, unknown> {
  const sev = String(r.severity || "low");
  const urgency =
    sev === "critical" || sev === "high" ? "P1" :
    sev === "medium" ? "P2" : "P3";
  const created = (r.created_at as string) || new Date().toISOString();
  const id = r.id as number;
  return {
    id: `wo-${id}`,
    woNumber: `WO-${new Date(created).getFullYear()}-${String(id).padStart(4, "0")}`,
    date: created,
    chargerId: r.charger_id,
    location: `Volt Network · ${String(r.charger_id || "").toUpperCase()} pad`,
    customerName: "—",
    faultCode: "—",
    urgency,
    status: String(r.status || "open"),
    assignedTech: null,
    summary: r.symptoms,
    parts: [],
    timeline: [{ event: "Work order created", timestamp: created }],
    reason: r.reason,
    confidence: r.confidence,
  };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const raw = id.replace(/^wo-/, "");
  try {
    const res = await fetch(`${BACKEND}/api/admin/work_orders/${raw}`, { cache: "no-store" });
    if (!res.ok) return Response.json({ error: "not_found", id }, { status: res.status });
    const data = await res.json() as Record<string, unknown>;
    return Response.json(toFrontendWO(data));
  } catch (e) {
    return Response.json({ error: "backend_unreachable", detail: String(e) }, { status: 502 });
  }
}
