import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

let _pool: pg.Pool | null = null;
let _db: NodePgDatabase<typeof schema> | null = null;

function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL or SUPABASE_DATABASE_URL must be set.",
    );
  }
  return databaseUrl;
}

/**
 * Get the database pool. Lazily initialized so tests that mock the DB module
 * don't fail on import.
 */
export function getPool(): pg.Pool {
  if (!_pool) {
    _pool = new Pool({ connectionString: getDatabaseUrl() });
  }
  return _pool;
}

/**
 * Get the Drizzle ORM instance. Lazily initialized.
 */
export function getDb(): NodePgDatabase<typeof schema> {
  if (!_db) {
    _db = drizzle(getPool(), { schema });
  }
  return _db;
}

// Re-export with proxy pattern for backwards compatibility
export const pool = new Proxy<pg.Pool>({} as pg.Pool, {
  get(_target, prop) {
    return (getPool() as any)[prop];
  },
});

export const db = new Proxy<NodePgDatabase<typeof schema>>({} as NodePgDatabase<typeof schema>, {
  get(_target, prop) {
    return (getDb() as any)[prop];
  },
});

export * from "./schema";
export { supabase, supabaseAdmin, getSupabaseClient, getSupabaseAdmin } from "./supabase";