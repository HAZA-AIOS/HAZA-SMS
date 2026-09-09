import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
export const parentFeedback = sqliteTable("parent_feedback", {
 id: text("id").primaryKey(), organizationId: text("organization_id").notNull(),
 name: text("name").notNull(), message: text("message").notNull(),
 status: text("status").notNull().default("published"), createdAt: integer("created_at").notNull(),
}, t => [index("parent_feedback_org_status_created_idx").on(t.organizationId,t.status,t.createdAt)]);
export const publicFormLimits = sqliteTable("public_form_limits", {
 key: text("key").primaryKey(), attempts: integer("attempts").notNull(), expiresAt: integer("expires_at").notNull(),
});
