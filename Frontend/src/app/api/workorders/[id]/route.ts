/**
 * GET /api/workorders/[id] — proxies to Python backend.
 * Strips the `wo-` prefix that the list view uses.
 */
const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const raw = id.replace(/^wo-/, "");
  try {
    const res = await fetch(`${BACKEND}/api/admin/work_orders/${raw}`, { cache: "no-store" });
    if (!res.ok) return Response.json({ error: "not_found", id }, { status: res.status });
    return Response.json(await res.json());
  } catch (e) {
    return Response.json({ error: "backend_unreachable", detail: String(e) }, { status: 502 });
  }
}
