import "server-only";
import { randomUUID } from "node:crypto";
import type { ContactInput, ContactStatus } from "@bitg/core/validation";
import { pool } from "./client.ts";

export async function submitContact(input: ContactInput, rateIdentity: string) {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    // Fixed database function accepts inserts only, enforces the activity and rate limit,
    // and creates both notification jobs in the same transaction.
    const result = await client.query<{ accepted: boolean }>("SELECT submit_bitg_contact($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,$10) AS accepted", [input.requestId, input.name, input.email, input.phone, input.goal, input.experience, input.format, input.message, input.locale, rateIdentity]);
    await client.query("COMMIT");
    return result.rows[0].accepted;
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}
export async function ownerCanAccess(userId: string): Promise<boolean> {
  const result = await pool("admin").query("SELECT 1 FROM memberships WHERE user_id=$1 AND activity_id='bitg' AND role='owner'", [userId]);
  return result.rowCount === 1;
}
export async function listContacts(status?: string) {
  const result = await pool("admin").query("SELECT id,name,email,phone,goal,experience,format,message,locale,status,version,created_at,updated_at FROM contact_requests WHERE activity_id='bitg' AND ($1::text IS NULL OR status=$1) ORDER BY created_at DESC LIMIT 200", [status || null]);
  return result.rows;
}
export async function changeStatus(id: string, status: ContactStatus, version: number, actor: string) {
  const client = await pool("admin").connect();
  try {
    await client.query("BEGIN");
    const result = await client.query("UPDATE contact_requests SET status=$1,version=version+1,updated_at=now(),retention_at=now()+interval '6 months' WHERE id=$2 AND activity_id='bitg' AND version=$3 RETURNING id", [status, id, version]);
    if (result.rowCount !== 1) { await client.query("ROLLBACK"); return false; }
    await client.query("INSERT INTO audit_events(id,actor_id,activity_id,action,subject_id,details) VALUES($1,$2,'bitg','contact.status_changed',$3,$4)", [randomUUID(), actor, id, JSON.stringify({ status, version: version + 1 })]);
    await client.query("COMMIT"); return true;
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}
