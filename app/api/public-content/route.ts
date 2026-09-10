import { env } from "cloudflare:workers";
import { authorize } from "../../../lib/authorization";

export const dynamic = "force-dynamic";
export async function GET() {
  const auth = await authorize("settings.edit");
  if (!auth) return Response.json({ error: "You do not have permission to manage public content." }, { status: 403 });
  const [campuses, downloads, newsEvents] = await Promise.all([
    env.DB.prepare("SELECT id,name FROM campuses WHERE organization_id=?1 AND status='active' ORDER BY is_main DESC,name").bind(auth.organizationId).all(),
    env.DB.prepare("SELECT d.id,d.title,d.description,d.category,a.content_type,d.status,a.original_name,a.size_bytes,c.name campus_name FROM public_downloads d JOIN storage_assets a ON a.id=d.asset_id LEFT JOIN campuses c ON c.id=d.campus_id WHERE d.organization_id=?1 ORDER BY d.published_at DESC,d.created_at DESC").bind(auth.organizationId).all(),
    env.DB.prepare("SELECT n.id,n.campus_id,n.kind,n.title,n.summary,n.event_starts_at,n.location,n.status,c.name campus_name FROM public_news_events n LEFT JOIN campuses c ON c.id=n.campus_id WHERE n.organization_id=?1 ORDER BY COALESCE(n.event_starts_at,n.published_at) DESC").bind(auth.organizationId).all(),
  ]);
  return Response.json({ campuses: campuses.results, downloads: downloads.results, newsEvents: newsEvents.results, canManage: true });
}
