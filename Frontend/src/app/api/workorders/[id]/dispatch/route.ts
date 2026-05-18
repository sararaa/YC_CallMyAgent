const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const raw = id.replace(/^wo-/, "");
  const body = await req.json().catch(() => ({}));
  try {
    const res = await fetch(`${BACKEND}/api/admin/work_orders/${raw}/dispatch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ technician_email: body.technicianEmail ?? null }),
      cache: "no-store",
    });
    return Response.json(await res.json(), { status: res.status });
  } catch (e) {
    return Response.json({ error: "backend_unreachable", detail: String(e) }, { status: 502 });
  }
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const raw = id.replace(/^wo-/, "");
  try {
    const res = await fetch(`${BACKEND}/api/admin/work_orders/${raw}/dispatch`, { cache: "no-store" });
    if (!res.ok) return Response.json({ error: "not_found" }, { status: res.status });
    return Response.json(await res.json());
  } catch (e) {
    return Response.json({ error: "backend_unreachable", detail: String(e) }, { status: 502 });
  }
}
