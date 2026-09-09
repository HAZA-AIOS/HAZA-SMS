import { env } from "cloudflare:workers";
import { authorize, canAccessCampus } from "../../../../lib/authorization";
import { requireSameOrigin } from "../../../../lib/security";

export const dynamic = "force-dynamic";
export async function POST(request: Request) { return save(request, false); }
export async function PATCH(request: Request) { return save(request, true); }
async function save(request: Request, editing: boolean) {
  const origin = requireSameOrigin(request); if (origin) return origin;
  const auth = await authorize("settings.edit"); if (!auth) return Response.json({ error: "You do not have permission to publish updates." }, { status: 403 });
  const data = await request.json() as Record<string,string>, kind = data.kind === "event" ? "event" : "news", title = (data.title ?? "").trim(), summary = (data.summary ?? "").trim(), campusId = (data.campusId ?? "").trim() || null;
  if (!title || !summary) return Response.json({ error: "Title and summary are required." }, { status: 400 });
  if (campusId && !canAccessCampus(auth, campusId)) return Response.json({ error: "Campus not available." }, { status: 403 });
  const eventStartsAt = data.eventStartsAt ? Date.parse(data.eventStartsAt) : null;
  if (data.eventStartsAt && !Number.isFinite(eventStartsAt)) return Response.json({ error: "Enter a valid event date." }, { status: 400 });
  const id = editing ? String(data.id ?? "") : crypto.randomUUID(), now = Date.now();
  if (editing) {
    const existing = await env.DB.prepare("SELECT campus_id FROM public_news_events WHERE id=?1 AND organization_id=?2").bind(id,auth.organizationId).first<{campus_id:string|null}>();
    if (!existing) return Response.json({error:"Update not found."},{status:404});
    if (existing.campus_id && !canAccessCampus(auth,existing.campus_id)) return Response.json({error:"Campus not available."},{status:403});
    await env.DB.prepare("UPDATE public_news_events SET campus_id=?1,kind=?2,title=?3,summary=?4,event_starts_at=?5,location=?6 WHERE id=?7 AND organization_id=?8").bind(campusId,kind,title.slice(0,140),summary.slice(0,1000),eventStartsAt,(data.location??"").trim().slice(0,160)||null,id,auth.organizationId).run();
    return Response.json({ok:true,id});
  }
  await env.DB.prepare("INSERT INTO public_news_events (id,organization_id,campus_id,kind,title,summary,event_starts_at,location,status,published_at,created_by) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,'published',?9,?10)").bind(id,auth.organizationId,campusId,kind,title.slice(0,140),summary.slice(0,1000),eventStartsAt,(data.location??"").trim().slice(0,160)||null,now,auth.userId).run();
  return Response.json({ ok: true, id });
}

export async function DELETE(request: Request) {
  const origin = requireSameOrigin(request); if (origin) return origin;
  const auth = await authorize("settings.edit"); if (!auth) return Response.json({ error: "Permission denied." }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const result = await env.DB.prepare("DELETE FROM public_news_events WHERE id=?1 AND organization_id=?2").bind(id,auth.organizationId).run();
  if (!result.meta.changes) return Response.json({ error: "Update not found." }, { status: 404 });
  return Response.json({ ok: true });
}
