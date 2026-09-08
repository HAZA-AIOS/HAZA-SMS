import { env } from "cloudflare:workers";
import { authorize, canAccessCampus } from "../../../lib/authorization";
import { enforceRateLimit, requireSameOrigin } from "../../../lib/security";

export const dynamic = "force-dynamic";
const clean = (value: unknown, max = 2000) => String(value ?? "").trim().slice(0, max);

export async function GET() {
  const auth = await authorize("communications.view");
  if (!auth) return Response.json({ error: "You do not have permission to view communications." }, { status: 403 });
  const campusClause = auth.activeCampusId ? " AND (x.campus_id IS NULL OR x.campus_id=?3)" : "";
  const bindScope = (statement: D1PreparedStatement) => auth.activeCampusId ? statement.bind(auth.organizationId, auth.userId, auth.activeCampusId) : statement.bind(auth.organizationId, auth.userId);
  const [announcements, messages, notifications, users, preferences] = await Promise.all([
    bindScope(env.DB.prepare(`SELECT x.*,c.name campus_name,u.display_name created_by_name FROM communication_announcements x LEFT JOIN campuses c ON c.id=x.campus_id JOIN users u ON u.id=x.created_by WHERE x.organization_id=?1${campusClause} ORDER BY x.created_at DESC LIMIT 150`)).all(),
    bindScope(env.DB.prepare(`SELECT x.*,sender.display_name sender_name,recipient.display_name recipient_name,c.name campus_name FROM direct_messages x JOIN users sender ON sender.id=x.sender_user_id JOIN users recipient ON recipient.id=x.recipient_user_id LEFT JOIN campuses c ON c.id=x.campus_id WHERE x.organization_id=?1 AND (x.sender_user_id=?2 OR x.recipient_user_id=?2)${campusClause} AND ((x.sender_user_id=?2 AND x.archived_by_sender=0) OR (x.recipient_user_id=?2 AND x.archived_by_recipient=0)) ORDER BY x.created_at DESC LIMIT 200`)).all(),
    env.DB.prepare("SELECT * FROM user_notifications WHERE organization_id=?1 AND user_id=?2 ORDER BY read_at IS NULL DESC,created_at DESC LIMIT 150").bind(auth.organizationId, auth.userId).all(),
    env.DB.prepare("SELECT DISTINCT u.id,u.display_name,u.email FROM users u JOIN organization_memberships om ON om.user_id=u.id WHERE om.organization_id=?1 AND om.status='active' AND u.status='active' AND u.id<>?2 ORDER BY u.display_name").bind(auth.organizationId, auth.userId).all(),
    env.DB.prepare("SELECT id,event_code,channel,enabled FROM notification_preferences WHERE organization_id=?1 AND (campus_id IS ?2 OR campus_id IS NULL) ORDER BY event_code,channel").bind(auth.organizationId, auth.activeCampusId).all(),
  ]);
  return Response.json({ announcements: announcements.results, messages: messages.results, notifications: notifications.results, users: users.results, preferences: preferences.results, campuses: auth.campuses, activeCampusId: auth.activeCampusId, currentUserId: auth.userId, canSend: auth.permissions.has("communications.send"), canManageAnnouncements: auth.permissions.has("announcements.manage"), canManageNotifications: auth.permissions.has("notifications.manage") }, { headers: { "cache-control": "private, no-store" } });
}

export async function POST(request: Request) {
  const sameOrigin = requireSameOrigin(request); if (sameOrigin) return sameOrigin;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null, action = clean(body?.action, 30);
  const required = action === "announcement" ? "announcements.manage" : action === "message" ? "communications.send" : "notifications.manage";
  const auth = await authorize(required);
  if (!auth) return Response.json({ error: "You do not have permission for this communication action." }, { status: 403 });
  if (!await enforceRateLimit(auth, `communications.${action}`, 60, 300)) return Response.json({ error: "Communication limit reached. Try again shortly." }, { status: 429 });
  const id = crypto.randomUUID(), now = Date.now();
  if (action === "message") {
    const recipientUserId = clean(body?.recipientUserId, 80), subject = clean(body?.subject, 160), messageBody = clean(body?.body, 5000), campusId = clean(body?.campusId, 80) || auth.activeCampusId || null;
    if (!subject || !messageBody || (campusId && !canAccessCampus(auth, campusId))) return Response.json({ error: "Choose a valid recipient and enter a subject and message." }, { status: 400 });
    const recipient = await env.DB.prepare("SELECT u.id FROM users u JOIN organization_memberships om ON om.user_id=u.id WHERE u.id=?1 AND om.organization_id=?2 AND om.status='active' AND u.status='active'").bind(recipientUserId, auth.organizationId).first();
    if (!recipient) return Response.json({ error: "Recipient is not an active member of this school." }, { status: 400 });
    await env.DB.batch([
      env.DB.prepare("INSERT INTO direct_messages (id,organization_id,campus_id,sender_user_id,recipient_user_id,subject,body) VALUES (?1,?2,?3,?4,?5,?6,?7)").bind(id, auth.organizationId, campusId, auth.userId, recipientUserId, subject, messageBody),
      env.DB.prepare("INSERT INTO user_notifications (id,organization_id,campus_id,user_id,event_code,title,body,entity_type,entity_id) VALUES (?1,?2,?3,?4,'direct_message',?5,?6,'direct_message',?7)").bind(crypto.randomUUID(), auth.organizationId, campusId, recipientUserId, subject, messageBody.slice(0, 240), id),
      env.DB.prepare("INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome) VALUES (?1,?2,?3,?4,'communications.message.send','direct_message',?5,'success')").bind(crypto.randomUUID(), auth.organizationId, campusId, auth.userId, id),
    ]);
  } else if (action === "announcement") {
    const title = clean(body?.title, 160), announcementBody = clean(body?.body, 5000), campusId = clean(body?.campusId, 80) || auth.activeCampusId || null, audience = ["all","staff","parents","students"].includes(String(body?.audience)) ? String(body?.audience) : "all", priority = ["normal","important","urgent"].includes(String(body?.priority)) ? String(body?.priority) : "normal", status = body?.status === "published" ? "published" : "draft", expiresAt = body?.expiresAt ? Date.parse(String(body.expiresAt)) : null;
    if (!title || !announcementBody || (campusId && !canAccessCampus(auth, campusId))) return Response.json({ error: "Enter a title, message and valid campus." }, { status: 400 });
    const recipients = status === "published" ? await env.DB.prepare(`SELECT DISTINCT u.id FROM users u JOIN organization_memberships om ON om.user_id=u.id AND om.organization_id=?1 AND om.status='active' LEFT JOIN membership_roles mr ON mr.membership_id=om.id LEFT JOIN roles r ON r.id=mr.role_id WHERE u.status='active' AND (?2='all' OR (?2='staff' AND r.key NOT IN ('parent','student')) OR (?2='parents' AND r.key='parent') OR (?2='students' AND r.key='student')) AND (?3 IS NULL OR mr.campus_id=?3 OR mr.campus_id IS NULL)`).bind(auth.organizationId, audience, campusId).all<{id:string}>() : { results: [] as {id:string}[] };
    const statements = [env.DB.prepare("INSERT INTO communication_announcements (id,organization_id,campus_id,title,body,priority,audience,status,published_at,expires_at,created_by) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)").bind(id, auth.organizationId, campusId, title, announcementBody, priority, audience, status, status === "published" ? now : null, Number.isFinite(expiresAt) ? expiresAt : null, auth.userId), env.DB.prepare("INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome) VALUES (?1,?2,?3,?4,'communications.announcement.create','communication_announcement',?5,'success')").bind(crypto.randomUUID(), auth.organizationId, campusId, auth.userId, id)];
    for (const recipient of recipients.results) statements.push(env.DB.prepare("INSERT INTO user_notifications (id,organization_id,campus_id,user_id,event_code,title,body,entity_type,entity_id) VALUES (?1,?2,?3,?4,'announcement',?5,?6,'communication_announcement',?7)").bind(crypto.randomUUID(), auth.organizationId, campusId, recipient.id, title, announcementBody.slice(0, 240), id));
    await env.DB.batch(statements);
  } else if (action === "preference") {
    const eventCode = clean(body?.eventCode, 60), channel = clean(body?.channel, 20), campusId = clean(body?.campusId, 80) || auth.activeCampusId || null, enabled = body?.enabled ? 1 : 0;
    if (!["announcement","direct_message","assignment_due"].includes(eventCode) || !["in_app","email"].includes(channel) || (campusId && !canAccessCampus(auth, campusId))) return Response.json({ error: "Invalid notification preference." }, { status: 400 });
    await env.DB.prepare("INSERT INTO notification_preferences (id,organization_id,campus_id,event_code,channel,enabled) VALUES (?1,?2,?3,?4,?5,?6) ON CONFLICT(organization_id,campus_id,event_code,channel) DO UPDATE SET enabled=excluded.enabled,updated_at=unixepoch()*1000").bind(id, auth.organizationId, campusId, eventCode, channel, enabled).run();
  } else return Response.json({ error: "Invalid communication action." }, { status: 400 });
  return Response.json({ ok: true, id });
}

export async function PATCH(request: Request) {
  const sameOrigin = requireSameOrigin(request); if (sameOrigin) return sameOrigin;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null, action = clean(body?.action, 30), id = clean(body?.id, 80);
  const auth = await authorize("communications.view"); if (!auth || !id) return Response.json({ error: "Permission denied." }, { status: 403 });
  if (action === "read_notification") await env.DB.prepare("UPDATE user_notifications SET read_at=COALESCE(read_at,unixepoch()*1000),updated_at=unixepoch()*1000 WHERE id=?1 AND organization_id=?2 AND user_id=?3").bind(id, auth.organizationId, auth.userId).run();
  else if (action === "read_message") await env.DB.prepare("UPDATE direct_messages SET read_at=COALESCE(read_at,unixepoch()*1000),updated_at=unixepoch()*1000 WHERE id=?1 AND organization_id=?2 AND recipient_user_id=?3").bind(id, auth.organizationId, auth.userId).run();
  else if (action === "archive_message") await env.DB.prepare("UPDATE direct_messages SET archived_by_sender=CASE WHEN sender_user_id=?3 THEN 1 ELSE archived_by_sender END,archived_by_recipient=CASE WHEN recipient_user_id=?3 THEN 1 ELSE archived_by_recipient END,updated_at=unixepoch()*1000 WHERE id=?1 AND organization_id=?2 AND (sender_user_id=?3 OR recipient_user_id=?3)").bind(id, auth.organizationId, auth.userId).run();
  else return Response.json({ error: "Invalid communication update." }, { status: 400 });
  return Response.json({ ok: true });
}
