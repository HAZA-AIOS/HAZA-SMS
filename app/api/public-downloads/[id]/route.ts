import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{id:string}> }) {
  const { id } = await params;
  const asset = await env.DB.prepare("SELECT a.r2_key,a.original_name,a.content_type FROM public_downloads d JOIN storage_assets a ON a.id=d.asset_id JOIN organizations o ON o.id=d.organization_id WHERE d.id=?1 AND d.status='published' AND o.status='active'").bind(id).first<{r2_key:string;original_name:string;content_type:string}>();
  if (!asset) return Response.json({ error: "Download not found." }, { status: 404 });
  if (/\.pdf$/i.test(asset.original_name) && ["application/octet-stream", ""].includes(asset.content_type)) asset.content_type="application/pdf";
  const head = await env.BUCKET.head(asset.r2_key); if (!head) return Response.json({error:"File unavailable."},{status:404});
  const rangeHeader=_request.headers.get("range");let offset=0,end=head.size-1;
  if(rangeHeader){
    const match=/^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
    if(!match||(!match[1]&&!match[2]))return new Response(null,{status:416,headers:{"content-range":`bytes */${head.size}`}});
    if(!match[1])offset=Math.max(0,head.size-Number(match[2]));else {offset=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]));}
    if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(end)||offset>end||offset>=head.size)return new Response(null,{status:416,headers:{"content-range":`bytes */${head.size}`}});
  }
  const object=await env.BUCKET.get(asset.r2_key,rangeHeader?{range:{offset,length:end-offset+1}}:undefined);
  if(!object)return new Response(null,{status:404});
  const preview = new URL(_request.url).searchParams.get("preview") === "1";
  if(preview && !["image/jpeg","image/png","image/webp","image/gif","application/pdf"].includes(asset.content_type)) return new Response(null,{status:415});
  const safeName = asset.original_name.replace(/["\\\r\n]/g,"_");
  return new Response(object.body, { status:rangeHeader?206:200, headers: { "accept-ranges":"bytes", "content-length":String(end-offset+1), ...(rangeHeader?{"content-range":`bytes ${offset}-${end}/${head.size}`} : {}), "content-type": asset.content_type, "content-disposition": `${preview ? "inline" : "attachment"}; filename="${safeName}"`, "cache-control": "public, max-age=300", "x-content-type-options": "nosniff" } });
}
