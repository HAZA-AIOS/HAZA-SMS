// Keep Worker bindings scoped so runtime globals do not override browser types.
declare module "cloudflare:workers" {
  import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
  export const env: { DB: D1Database; BUCKET: R2Bucket };
}
