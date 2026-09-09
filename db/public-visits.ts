import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const publicVisitCounts = sqliteTable("public_visit_counts", {
  id: text("id").primaryKey(),
  total: integer("total").notNull().default(0),
});
