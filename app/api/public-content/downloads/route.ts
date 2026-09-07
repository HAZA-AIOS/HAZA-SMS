import { env } from "cloudflare:workers";
import { authorize, canAccessCampus } from "../../../../lib/authorization";
import { enforceRateLimit, requireSameOrigin } from "../../../../lib/security";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const origin = requireSameOrigin(request); if (origin) return origin;
  const auth = await authorize("settings.edit");
  if (!auth) return Response.json({ error: "You do not have permission to publish downloads." }, { status: 403 });
  if (!await enforceRateLimit(auth, "public.download.upload", 20, 300)) return Response.json({ error: "Upload limit reached. Try again later." }, { status: 429 });
  const data = await request.formData(), file = data.get("file"), title = String(data.get("title") ?? "").trim(), description = String(data.get("description") ?? "").trim(), campusId = String(data.get("campusId") ?? "").trim() || null;
  if (!(file instanceof File) || !title || file.size < 1 || file.size > 25 * 1024 * 1024) return Response.json({ error: "Add a title and choose a file up to 25 MB." }, { status: 400 });
  if (campusId && !canAccessCampus(auth, campusId)) return Response.json({ error: "Campus not available." }, { status: 403 });
  const assetId = crypto.randomUUID(), id = crypto.randomUUID(), safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120) || "download", r2Key = `organizations/${auth.organizationId}/public-downloads/${assetId}-${safeName}`, now = Date.now();
  await env.BUCKET.put(r2Key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type || "application/octet-stream" } });
  try { await env.DB.batch([
    env.DB.prepare("INSERT INTO storage_assets (id,organization_id,campus_id,asset_type,r2_key,original_name,content_type,size_bytes,uploaded_by) VALUES (?1,?2,?3,'public_download',?4,?5,?6,?7,?8)").bind(assetId, auth.organizationId, campusId, r2Key, file.name.slice(0,255), file.type || "application/octet-stream", file.size, auth.userId),
    env.DB.prepare("INSERT INTO public_downloads (id,organization_id,campus_id,asset_id,title,description,status,published_at,created_by) VALUES (?1,?2,?3,?4,?5,?6,'published',?7,?8)").bind(id, auth.organizationId, campusId, assetId, title.slice(0,120), description.slice(0,500) || null, now, auth.userId),
  ]); } catch (error) { await env.BUCKET.delete(r2Key); throw error; }
  return Response.json({ ok: true, id });
}

export async function DELETE(request: Request) {
  const origin = requireSameOrigin(request); if (origin) return origin;
  const auth = await authorize("settings.edit"); if (!auth) return Response.json({ error: "Permission denied." }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const item = await env.DB.prepare("SELECT d.asset_id,a.r2_key FROM public_downloads d JOIN storage_assets a ON a.id=d.asset_id WHERE d.id=?1 AND d.organization_id=?2").bind(id, auth.organizationId).first<{asset_id:string;r2_key:string}>();
  if (!item) return Response.json({ error: "Download not found." }, { status: 404 });
  await env.DB.prepare("DELETE FROM public_downloads WHERE id=?1 AND organization_id=?2").bind(id, auth.organizationId).run();
  await env.DB.prepare("DELETE FROM storage_assets WHERE id=?1 AND organization_id=?2").bind(item.asset_id, auth.organizationId).run();
  await env.BUCKET.delete(item.r2_key);
  return Response.json({ ok: true });
}
