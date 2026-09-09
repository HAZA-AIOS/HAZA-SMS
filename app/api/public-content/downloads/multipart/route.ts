import { boundedBody, fail } from "../../../../../lib/public-forms";
import { env } from "cloudflare:workers";
import { authorize, canAccessCampus } from "../../../../../lib/authorization";
import { enforceRateLimit, requireSameOrigin } from "../../../../../lib/security";

export const dynamic = "force-dynamic";
const MULTIPART_CHUNK_SIZE = 10 * 1024 * 1024;
const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024;
const MAX_PARTS = Math.ceil(MAX_FILE_SIZE / MULTIPART_CHUNK_SIZE);
const keyPrefix = (organizationId: string) => `organizations/${organizationId}/public-downloads/`;
const pendingKey = (key: string, uploadId: string) => `${key}.multipart-${encodeURIComponent(uploadId)}.json`;

type UploadMetadata = {
  uploadId: string; assetId: string; organizationId: string; campusId: string | null;
  title: string; description: string; fileName: string; contentType: string;
  size: number; totalParts: number;
};

function validKey(key: string, organizationId: string) {
  return key.startsWith(keyPrefix(organizationId)) && !key.includes("..") && key.length <= 500;
}

function validUploadId(uploadId: string) {
  return uploadId.length > 0 && uploadId.length <= 256;
}

async function getUploadMetadata(key: string, uploadId: string, organizationId: string) {
  if (!validKey(key, organizationId) || !validUploadId(uploadId)) return null;
  const pending = await env.BUCKET.get(pendingKey(key, uploadId));
  if (!pending) return null;
  const metadata = await pending.json<UploadMetadata>().catch(() => null);
  if (!metadata || metadata.uploadId !== uploadId || metadata.organizationId !== organizationId) return null;
  return metadata;
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
    const contentType = String(body.contentType || "application/octet-stream").slice(0, 255), size = Number(body.size);
    if (!title || !fileName || !Number.isSafeInteger(size) || size < 1 || size > MAX_FILE_SIZE) return Response.json({ error: "Add a title and choose a file up to 5 GB." }, { status: 400 });
    if (campusId && !canAccessCampus(auth, campusId)) return Response.json({ error: "Campus not available." }, { status: 403 });
    const assetId = crypto.randomUUID(), safeName = fileName.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120) || "download";
    const key = `${keyPrefix(auth.organizationId)}${assetId}-${safeName}`;
    const upload = await env.BUCKET.createMultipartUpload(key, { httpMetadata: { contentType } });
    const metadata: UploadMetadata = {
      uploadId: upload.uploadId, assetId, organizationId: auth.organizationId, campusId,
      title: title.slice(0, 120), description: description.slice(0, 500),
      fileName: fileName.slice(0, 255), contentType, size,
      totalParts: Math.ceil(size / MULTIPART_CHUNK_SIZE),
    };
    await env.BUCKET.put(pendingKey(key, upload.uploadId), JSON.stringify(metadata), { httpMetadata: { contentType: "application/json" } });
    return Response.json({ uploadId: upload.uploadId, key });
  }

  if (body.action === "complete") {
    const uploadId = String(body.uploadId ?? ""), key = String(body.key ?? "");
    const metadata = await getUploadMetadata(key, uploadId, auth.organizationId);
    if (!metadata || !Array.isArray(body.parts)) return Response.json({ error: "Invalid multipart upload." }, { status: 400 });
    if (metadata.campusId && !canAccessCampus(auth, metadata.campusId)) return Response.json({ error: "Campus not available." }, { status: 403 });
    const parts = body.parts.map((part) => ({ partNumber: Number((part as Record<string, unknown>).partNumber), etag: String((part as Record<string, unknown>).etag ?? "") }));
    if (parts.length !== metadata.totalParts || parts.some((part, index) => part.partNumber !== index + 1 || !part.etag)) return Response.json({ error: "Upload parts are incomplete." }, { status: 400 });
    await env.BUCKET.resumeMultipartUpload(key, uploadId).complete(parts);
    const object = await env.BUCKET.head(key);
    if (!object || object.size !== metadata.size) {
      await env.BUCKET.delete([key, pendingKey(key, uploadId)]);
      return Response.json({ error: "Uploaded file size could not be verified." }, { status: 400 });
    }
    const id = crypto.randomUUID(), now = Date.now();
    try {
      await env.DB.batch([
        env.DB.prepare("INSERT INTO storage_assets (id,organization_id,campus_id,asset_type,r2_key,original_name,content_type,size_bytes,uploaded_by) VALUES (?1,?2,?3,'public_download',?4,?5,?6,?7,?8)").bind(metadata.assetId, auth.organizationId, metadata.campusId, key, metadata.fileName, metadata.contentType, metadata.size, auth.userId),
        env.DB.prepare("INSERT INTO public_downloads (id,organization_id,campus_id,asset_id,title,description,status,published_at,created_by) VALUES (?1,?2,?3,?4,?5,?6,'published',?7,?8)").bind(id, auth.organizationId, metadata.campusId, metadata.assetId, metadata.title, metadata.description || null, now, auth.userId),
      ]);
      await env.BUCKET.delete(pendingKey(key, uploadId));
    } catch (error) {
      await env.BUCKET.delete([key, pendingKey(key, uploadId)]);
      throw error;
    }
    return Response.json({ ok: true, id });
  }
  return Response.json({ error: "Unsupported upload action." }, { status: 400 });
}

export async function PUT(request: Request) {
  const origin = requireSameOrigin(request); if (origin) return origin;
  const auth = await authorize("settings.edit"); if (!auth) return Response.json({ error: "Permission denied." }, { status: 403 });
  const url = new URL(request.url), uploadId = url.searchParams.get("uploadId") ?? "", key = url.searchParams.get("key") ?? "", partNumber = Number(url.searchParams.get("partNumber"));
  if (!request.body) return Response.json({ error: "Invalid upload part." }, { status: 400 });
  const metadata = await getUploadMetadata(key, uploadId, auth.organizationId);

  if (!metadata || !Number.isInteger(partNumber) || partNumber < 1 || partNumber > metadata.totalParts || partNumber > MAX_PARTS) return Response.json({ error: "Invalid upload part." }, { status: 400 });
  const expectedLength = partNumber === metadata.totalParts ? metadata.size - MULTIPART_CHUNK_SIZE * (metadata.totalParts - 1) : MULTIPART_CHUNK_SIZE;
  if (metadata.campusId && !canAccessCampus(auth, metadata.campusId)) return Response.json({ error: "Campus not available." }, { status: 403 });
  let bytes: Uint8Array;
  try { bytes = await boundedBody(request, expectedLength); } catch (error) { return fail(error); }
  if (bytes.byteLength !== expectedLength) return Response.json({ error: "Upload part size does not match the selected file." }, { status: 400 });
  const part = await env.BUCKET.resumeMultipartUpload(key, uploadId).uploadPart(partNumber, bytes);
  return Response.json({ partNumber: part.partNumber, etag: part.etag });
}

export async function DELETE(request: Request) {
  const origin = requireSameOrigin(request); if (origin) return origin;
  const auth = await authorize("settings.edit"); if (!auth) return Response.json({ error: "Permission denied." }, { status: 403 });
  const url = new URL(request.url), uploadId = url.searchParams.get("uploadId") ?? "", key = url.searchParams.get("key") ?? "";
  const metadata = await getUploadMetadata(key, uploadId, auth.organizationId);
  if (!metadata) return Response.json({ error: "Invalid upload." }, { status: 400 });
  await env.BUCKET.resumeMultipartUpload(key, uploadId).abort();
  await env.BUCKET.delete(pendingKey(key, uploadId));
  return Response.json({ ok: true });
}
