/**
 * GET /api/charger/[id] — proxy to the Python backend.
 * Next.js 16: params is async.
 */
const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const res = await fetch(`${BACKEND}/api/admin/charger/${id}`, { cache: "no-store" });
    if (!res.ok) return Response.json({ error: "unknown_charger", id }, { status: res.status });
    return Response.json(await res.json());
  } catch (e) {
    return Response.json({ error: "backend_unreachable", detail: String(e) }, { status: 502 });
  }
}
