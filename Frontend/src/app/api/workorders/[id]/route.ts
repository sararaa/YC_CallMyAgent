/**
 * GET /api/workorders/[id] — proxies to Python backend.
 * The backend already runs _wo_to_frontend and returns camelCase fields.
 * We just fill in any missing fields with safe defaults.
 */
const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

function toFrontendWO(r: Record<string, unknown>): Record<string, unknown> {
  const created = (r.date || r.created_at) as string || new Date().toISOString();
  const rawId = r.id as string || "";
  const numericId = rawId.replace(/^wo-/, "");

  return {
    ...r,
    id: rawId.startsWith("wo-") ? rawId : `wo-${rawId}`,
    woNumber: r.woNumber || `WO-${new Date(created).getFullYear()}-${numericId.padStart(4, "0")}`,
    date: created,
    chargerId: (r.chargerId || r.charger_id || "CHARGER1") as string,
    faultCode: (r.faultCode || r.fault_code || "E101") as string,
    location: r.location || `Volt Network · ${String(r.chargerId || r.charger_id || "").toUpperCase()} pad`,
    urgency: r.urgency || "P3",
    status: String(r.status || "open"),
    assignedTech: "Sina Vaghefi",
    summary: r.summary || r.symptoms || "",
    parts: (r.parts as unknown[]) || [],
    timeline: (r.timeline as unknown[]) || [{ event: "Work order created", timestamp: created }],
    details: r.details || "",
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
