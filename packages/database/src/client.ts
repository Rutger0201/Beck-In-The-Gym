import "server-only";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.ts";
const pools = new Map<string, pg.Pool>();
export function pool(role: "web" | "admin" = "web") {
  const connectionString = role === "admin" ? process.env.ADMIN_DATABASE_URL : process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Database is not configured");
  let result = pools.get(role);
  if (!result) {
    result = new pg.Pool({ connectionString, max: 5, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined });
    pools.set(role, result);
  }
  return result;
}
export function database() { return drizzle(pool("admin"), { schema }); }
