import { env } from "cloudflare:workers";
import { authorize } from "../../../../lib/authorization";
import { enforceRateLimit, requireSameOrigin } from "../../../../lib/security";

export const dynamic = "force-dynamic";
const assetTypes = new Set(["logo_primary", "logo_secondary", "report_header", "principal_signature", "paid_stamp", "student_handbook"]);
const contentTypes = new Set(["image/png", "image/jpeg", "application/pdf"]);

export async function POST(request: Request) {
  const sameOrigin=requireSameOrigin(request);if(sameOrigin)return sameOrigin;
  const auth = await authorize("settings.edit");
  if (!auth) return Response.json({ error: "You do not have permission to upload configuration assets." }, { status: 403 });
  if(!await enforceRateLimit(auth,"asset.upload",20,300))return Response.json({error:"Upload limit reached. Try again later."},{status:429});
  const data = await request.formData();
  const file = data.get("file"), assetType = String(data.get("assetType") ?? ""), campusId = String(data.get("campusId") ?? "").trim() || null;
  if (!(file instanceof File) || !assetTypes.has(assetType) || !contentTypes.has(file.type) || file.size < 1 || file.size > 10 * 1024 * 1024) {
    return Response.json({ error: "Choose a PNG, JPEG or PDF file up to 10 MB." }, { status: 400 });
  }
  if (campusId) {
    const campus = await env.DB.prepare("SELECT id FROM campuses WHERE id=?1 AND organization_id=?2").bind(campusId, auth.organizationId).first();
    if (!campus) return Response.json({ error: "Campus not found." }, { status: 404 });
  }
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-100) || "asset";
  const id = crypto.randomUUID();
  const r2Key = `organizations/${auth.organizationId}/campuses/${campusId ?? "school"}/${assetType}/${id}-${safeName}`;
  await env.BUCKET.put(r2Key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
  try {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO storage_assets (id,organization_id,campus_id,asset_type,r2_key,original_name,content_type,size_bytes,uploaded_by) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)").bind(id, auth.organizationId, campusId, assetType, r2Key, file.name.slice(0, 255), file.type, file.size, auth.userId),
      env.DB.prepare("INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome) VALUES (?1,?2,?3,?4,'asset.upload','storage_asset',?5,'success')").bind(crypto.randomUUID(), auth.organizationId, campusId, auth.userId, id),
    ]);
  } catch (error) {
    await env.BUCKET.delete(r2Key);
    throw error;
  }
  return Response.json({ ok: true });
}
