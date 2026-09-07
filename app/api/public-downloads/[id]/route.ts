import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{id:string}> }) {
  const { id } = await params;
  const asset = await env.DB.prepare("SELECT a.r2_key,a.original_name,a.content_type FROM public_downloads d JOIN storage_assets a ON a.id=d.asset_id JOIN organizations o ON o.id=d.organization_id WHERE d.id=?1 AND d.status='published' AND o.status='active'").bind(id).first<{r2_key:string;original_name:string;content_type:string}>();
  if (!asset) return Response.json({ error: "Download not found." }, { status: 404 });
  const object = await env.BUCKET.get(asset.r2_key); if (!object) return Response.json({ error: "File unavailable." }, { status: 404 });
  const safeName = asset.original_name.replace(/["\\\r\n]/g,"_");
  return new Response(object.body, { headers: { "content-type": asset.content_type, "content-disposition": `attachment; filename="${safeName}"`, "cache-control": "public, max-age=300", "x-content-type-options": "nosniff" } });
}
