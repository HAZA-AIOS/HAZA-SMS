import { env } from "cloudflare:workers";
import { authorize, canAccessCampus } from "../../../../../lib/authorization";
import { enforceRateLimit, requireSameOrigin } from "../../../../../lib/security";

export const dynamic = "force-dynamic";
const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024;
const keyPrefix = (organizationId: string) => `organizations/${organizationId}/public-downloads/`;

function validKey(key: string, organizationId: string) {
  return key.startsWith(keyPrefix(organizationId)) && !key.includes("..") && key.length <= 500;
}

export async function POST(request: Request) {
  const origin = requireSameOrigin(request); if (origin) return origin;
  const auth = await authorize("settings.edit");
  if (!auth) return Response.json({ error: "You do not have permission to publish downloads." }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Invalid upload request." }, { status: 400 });

  if (body.action === "initiate") {
    if (!await enforceRateLimit(auth, "public.download.multipart", 20, 300)) return Response.json({ error: "Upload limit reached. Try again later." }, { status: 429 });
    const title = String(body.title ?? "").trim(), description = String(body.description ?? "").trim();
    const campusId = String(body.campusId ?? "").trim() || null, fileName = String(body.fileName ?? "").trim();
    const contentType = String(body.contentType ?? "application/octet-stream").slice(0, 255), size = Number(body.size);
    if (!title || !fileName || !Number.isSafeInteger(size) || size < 1 || size > MAX_FILE_SIZE) return Response.json({ error: "Add a title and choose a file up to 5 GB." }, { status: 400 });
    if (campusId && !canAccessCampus(auth, campusId)) return Response.json({ error: "Campus not available." }, { status: 403 });
    const assetId = crypto.randomUUID(), safeName = fileName.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120) || "download";
    const key = `${keyPrefix(auth.organizationId)}${assetId}-${safeName}`;
    const upload = await env.BUCKET.createMultipartUpload(key, { httpMetadata: { contentType } });
    const metadata = { assetId, title: title.slice(0, 120), description: description.slice(0, 500), campusId, fileName: fileName.slice(0, 255), contentType, size };
    return Response.json({ uploadId: upload.uploadId, key, metadata: btoa(JSON.stringify(metadata)) });
  }

  if (body.action === "complete") {
    const uploadId = String(body.uploadId ?? ""), key = String(body.key ?? "");
    const metadataToken = String(body.metadata ?? "");
    if (!uploadId || !validKey(key, auth.organizationId) || !metadataToken || !Array.isArray(body.parts)) return Response.json({ error: "Invalid multipart upload." }, { status: 400 });
    let metadata: { assetId:string;title:string;description:string;campusId:string|null;fileName:string;contentType:string;size:number };
    try { metadata = JSON.parse(atob(metadataToken)); } catch { return Response.json({ error: "Invalid upload metadata." }, { status: 400 }); }
    if (!key.includes(`/${metadata.assetId}-`) || !Number.isSafeInteger(metadata.size) || metadata.size < 1 || metadata.size > MAX_FILE_SIZE) return Response.json({ error: "Invalid upload metadata." }, { status: 400 });
    if (metadata.campusId && !canAccessCampus(auth, metadata.campusId)) return Response.json({ error: "Campus not available." }, { status: 403 });
    const parts = body.parts.map((part) => ({ partNumber: Number((part as Record<string, unknown>).partNumber), etag: String((part as Record<string, unknown>).etag ?? "") }));
    if (!parts.length || parts.some((part, index) => part.partNumber !== index + 1 || !part.etag)) return Response.json({ error: "Upload parts are incomplete." }, { status: 400 });
    await env.BUCKET.resumeMultipartUpload(key, uploadId).complete(parts);
    const object = await env.BUCKET.head(key);
    if (!object || object.size !== metadata.size) { await env.BUCKET.delete(key); return Response.json({ error: "Uploaded file size could not be verified." }, { status: 400 }); }
    const id = crypto.randomUUID(), now = Date.now();
    try { await env.DB.batch([
      env.DB.prepare("INSERT INTO storage_assets (id,organization_id,campus_id,asset_type,r2_key,original_name,content_type,size_bytes,uploaded_by) VALUES (?1,?2,?3,'public_download',?4,?5,?6,?7,?8)").bind(metadata.assetId, auth.organizationId, metadata.campusId, key, metadata.fileName, metadata.contentType, metadata.size, auth.userId),
      env.DB.prepare("INSERT INTO public_downloads (id,organization_id,campus_id,asset_id,title,description,status,published_at,created_by) VALUES (?1,?2,?3,?4,?5,?6,'published',?7,?8)").bind(id, auth.organizationId, metadata.campusId, metadata.assetId, metadata.title, metadata.description || null, now, auth.userId),
    ]); } catch (error) { await env.BUCKET.delete(key); throw error; }
    return Response.json({ ok: true, id });
  }
  return Response.json({ error: "Unsupported upload action." }, { status: 400 });
}

export async function PUT(request: Request) {
  const origin = requireSameOrigin(request); if (origin) return origin;
  const auth = await authorize("settings.edit"); if (!auth) return Response.json({ error: "Permission denied." }, { status: 403 });
  const url = new URL(request.url), uploadId = url.searchParams.get("uploadId") ?? "", key = url.searchParams.get("key") ?? "", partNumber = Number(url.searchParams.get("partNumber"));
  if (!uploadId || !validKey(key, auth.organizationId) || !Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10_000 || !request.body) return Response.json({ error: "Invalid upload part." }, { status: 400 });
  const part = await env.BUCKET.resumeMultipartUpload(key, uploadId).uploadPart(partNumber, request.body);
  return Response.json({ partNumber: part.partNumber, etag: part.etag });
}

export async function DELETE(request: Request) {
  const origin = requireSameOrigin(request); if (origin) return origin;
  const auth = await authorize("settings.edit"); if (!auth) return Response.json({ error: "Permission denied." }, { status: 403 });
  const url = new URL(request.url), uploadId = url.searchParams.get("uploadId") ?? "", key = url.searchParams.get("key") ?? "";
  if (!uploadId || !validKey(key, auth.organizationId)) return Response.json({ error: "Invalid upload." }, { status: 400 });
  await env.BUCKET.resumeMultipartUpload(key, uploadId).abort();
  return Response.json({ ok: true });
}
