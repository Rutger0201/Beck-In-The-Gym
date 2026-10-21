import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import pg from 'pg';
const connectionString = process.env.MIGRATION_DATABASE_URL;
if (!connectionString) throw new Error('Set MIGRATION_DATABASE_URL to the migration-owner connection');
const client = new pg.Client({ connectionString, ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : undefined });
await client.connect();
try {
  await client.query('SELECT pg_advisory_lock(9283741)');
  await client.query('CREATE TABLE IF NOT EXISTS bitg_migrations(name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
  const directory = new URL('../packages/database/migrations/', import.meta.url);
  for (const name of (await readdir(directory)).filter(n => n.endsWith('.sql')).sort()) {
    const sql = await readFile(new URL(name, directory), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const prior = await client.query('SELECT checksum FROM bitg_migrations WHERE name=$1', [name]);
    if (prior.rowCount) { if (prior.rows[0].checksum !== checksum) throw new Error(`Applied migration changed: ${name}`); continue; }
    await client.query('BEGIN');
    try { await client.query(sql); await client.query('INSERT INTO bitg_migrations(name,checksum) VALUES($1,$2)', [name,checksum]); await client.query('COMMIT'); console.log(`Applied ${name}`); }
    catch (error) { await client.query('ROLLBACK'); throw error; }
  }
} finally { await client.query('SELECT pg_advisory_unlock(9283741)'); await client.end(); }
