import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";
const cookieName = "__Host-tms-visit";
const headers = { "cache-control": "no-store" };

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return Response.json({ error: "Same-origin request required." }, { status: 403, headers });
  }
  try {
    const counted = (request.headers.get("cookie") || "").split(";").some(value => value.trim() === `${cookieName}=1`);
    const row = counted
      ? await env.DB.prepare("SELECT total FROM public_visit_counts WHERE id = 'landing'").first<{ total: number }>()
      : await env.DB.prepare("INSERT INTO public_visit_counts (id,total) VALUES ('landing',1) ON CONFLICT(id) DO UPDATE SET total=total+1 RETURNING total").first<{ total: number }>();
    return Response.json({ total: row?.total ?? 0 }, {
      headers: counted ? headers : { ...headers, "set-cookie": `${cookieName}=1; Path=/; Max-Age=86400; HttpOnly; Secure; SameSite=Lax` },
    });
  } catch (error) {
    console.error("Public visit counter failed", error);
    return Response.json({ error: "Visit count temporarily unavailable." }, { status: 503, headers });
  }
}
