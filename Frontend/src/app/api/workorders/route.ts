/**
 * GET /api/workorders — proxies to Python /api/admin/work_orders, adapting
 * the schema to the PigeonPlatform WorkOrder shape and applying client-style
 * search/status filtering and pagination.
 */
const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

function toFrontendWO(r: Record<string, unknown>): Record<string, unknown> {
  const sev = String(r.severity || "low");
  const urgency =
    sev === "critical" || sev === "high" ? "P1" :
    sev === "medium" ? "P2" : "P3";
  const statusMap: Record<string, string> = {
    open: "open", in_progress: "dispatched", resolved: "resolved",
  };
  const created = (r.created_at as string) || new Date().toISOString();
  const id = r.id as number;
  return {
    id: `wo-${id}`,
    woNumber: `WO-${new Date(created).getFullYear()}-${String(id).padStart(4, "0")}`,
    date: created,
    chargerId: r.charger_id,
    location: `PigeonPlatform · ${String(r.charger_id || "").toUpperCase()} pad`,
    customerName: "—",
    faultCode: "—",
    urgency,
    status: statusMap[String(r.status || "open")] || "open",
    assignedTech: null,
    summary: r.symptoms,
    parts: [],
    timeline: [{ event: "Work order created", timestamp: created }],
    reason: r.reason,
    confidence: r.confidence,
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const search = (url.searchParams.get("search") || "").toLowerCase();
  const status = url.searchParams.get("status");
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const limit = parseInt(url.searchParams.get("limit") || "20", 10);

  try {
    const res = await fetch(`${BACKEND}/api/admin/work_orders`, { cache: "no-store" });
    const rows = (await res.json()) as Record<string, unknown>[];
    let orders = rows.map(toFrontendWO);
    if (search) {
      orders = orders.filter((o) => JSON.stringify(o).toLowerCase().includes(search));
    }
    if (status && status !== "all") {
      orders = orders.filter((o) => o.status === status);
    }
    const total = orders.length;
    const start = (page - 1) * limit;
    return Response.json({ orders: orders.slice(start, start + limit), total, page, limit });
  } catch (e) {
    return Response.json({ orders: [], total: 0, page, limit, error: String(e) }, { status: 502 });
  }
}
