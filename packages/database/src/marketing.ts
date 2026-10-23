import "server-only";
import { randomUUID } from "node:crypto";
import type pg from "pg";
import { pool } from "./client.ts";
import { addDays, localDate, startOfMonth } from "@bitg/core/marketing/dates";
import { collectResearch, deriveOpportunities } from "@bitg/core/marketing/research";
import { alternativeIdea, planCalendar, type PlanCandidate } from "@bitg/core/marketing/planner";
import type { LeadSignal } from "@bitg/core/marketing/leads";
import { readSettings, type MarketingSettings } from "@bitg/core/marketing/validation";
import type { CalendarBrief, CalendarStatus, Channel, OpportunityStatus } from "@bitg/core/marketing/labels";

type Job = "research" | "plan" | "growth" | "growth_digest" | "growth_draft";
export type Trigger = "manual" | "schedule";
export class RunConflict extends Error {}
export class VersionConflict extends Error {}
export class InvalidChange extends Error {}
async function transaction<T>(work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool("admin").connect();
  try { await client.query("BEGIN"); const result = await work(client); await client.query("COMMIT"); return result; }
  catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}
async function audit(client: pg.PoolClient, actor: string | null, action: string, subject: string | null, details: Record<string, unknown>) {
  await client.query("INSERT INTO audit_events(id,actor_id,activity_id,action,subject_id,details) VALUES($1,$2,'bitg',$3,$4,$5)", [randomUUID(), actor, action, subject, JSON.stringify(details)]);
}

export async function getSettings(): Promise<{ settings: MarketingSettings; version: number }> {
  const result = await pool("admin").query("SELECT settings,version FROM marketing_settings WHERE activity_id='bitg'");
  return { settings: readSettings(result.rows[0]?.settings), version: result.rows[0]?.version ?? 1 };
}
export async function saveSettings(settings: MarketingSettings, version: number, actor: string) {
  return transaction(async client => {
    const result = await client.query("UPDATE marketing_settings SET settings=$1,version=version+1,updated_at=now() WHERE activity_id='bitg' AND version=$2 RETURNING version", [JSON.stringify(settings), version]);
    if (result.rowCount !== 1) throw new VersionConflict();
    await audit(client, actor, "marketing.settings_changed", null, { version: version + 1 });
    return result.rows[0].version as number;
  });
}

// Runs are leased: a crashed run is marked failed once its lease expires, so the job can restart.
export async function startRun(job: Job, trigger: Trigger, { leaseSeconds = 300, minIntervalSeconds = 0 } = {}): Promise<string> {
  return transaction(async client => {
    await client.query("UPDATE marketing_runs SET status='failed',finished_at=now(),error='Lease verlopen; run is opnieuw te starten' WHERE activity_id='bitg' AND job=$1 AND status='running' AND lease_until<now()", [job]);
    if (minIntervalSeconds > 0) {
      const recent = await client.query("SELECT 1 FROM marketing_runs WHERE activity_id='bitg' AND job=$1 AND status<>'failed' AND started_at>now()-make_interval(secs=>$2)", [job, minIntervalSeconds]);
      if (recent.rowCount) throw new RunConflict();
    }
    const result = await client.query("INSERT INTO marketing_runs(activity_id,job,trigger,lease_until) VALUES('bitg',$1,$2,now()+make_interval(secs=>$3)) ON CONFLICT DO NOTHING RETURNING id", [job, trigger, leaseSeconds]);
    if (result.rowCount !== 1) throw new RunConflict();
    return result.rows[0].id as string;
  });
}
export async function finishRun(id: string, outcome: { stats?: Record<string, number>; error?: string; costCents?: number }) {
  await pool("admin").query("UPDATE marketing_runs SET status=$2,finished_at=now(),stats=$3,error=$4,cost_cents=$5 WHERE id=$1 AND status='running'", [id, outcome.error ? "failed" : "succeeded", JSON.stringify(outcome.stats || {}), outcome.error?.slice(0, 500) ?? null, Math.max(0, Math.round(outcome.costCents ?? 0))]);
}
export async function tracked<T extends Record<string, number>>(job: Job, trigger: Trigger, options: Parameters<typeof startRun>[2], work: () => Promise<T>): Promise<T> {
  const id = await startRun(job, trigger, options);
  try { const stats = await work(); await finishRun(id, { stats, costCents: stats.costCents }); return stats; }
  catch (error) { await finishRun(id, { error: error instanceof Error ? error.message : "Onbekende fout" }); throw error; }
}

export async function leadSignals(days = 120): Promise<LeadSignal[]> {
  // Only the fields needed for aggregate analysis; names, addresses and message text stay in the database.
  const result = await pool("admin").query("SELECT goal,format,experience,phone IS NOT NULL AS has_phone,coalesce(length(message),0) AS message_length,position('?' in coalesce(message,''))>0 AS has_question,created_at FROM contact_requests WHERE activity_id='bitg' AND created_at>now()-make_interval(days=>$1)", [days]);
  return result.rows.map(row => ({ goal: row.goal, format: row.format, experience: row.experience, hasPhone: row.has_phone, messageLength: Number(row.message_length), hasQuestion: row.has_question, createdAt: new Date(row.created_at) }));
}

export async function runResearch(trigger: Trigger, actor: string | null = null, now = new Date()) {
  return tracked("research", trigger, { minIntervalSeconds: trigger === "manual" ? 30 : 0 }, async () => {
    const items = collectResearch({ now, leads: await leadSignals() }), drafts = deriveOpportunities(items, { now }), period = startOfMonth(localDate(now));
    return transaction(async client => {
      let added = 0;
      for (const item of items) {
        const result = await client.query("INSERT INTO marketing_research_items(activity_id,source,kind,title,summary,url,ref,fingerprint,expires_at) VALUES('bitg',$1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(activity_id,fingerprint) DO UPDATE SET last_seen_at=now(),expires_at=EXCLUDED.expires_at,title=EXCLUDED.title,summary=EXCLUDED.summary RETURNING (xmax=0) AS inserted", [item.source, item.kind, item.title, item.summary, item.url, item.ref, item.fingerprint, item.expiresAt]);
        if (result.rows[0].inserted) added++;
      }
      const removed = (await client.query("DELETE FROM marketing_research_items WHERE activity_id='bitg' AND expires_at<now()")).rowCount || 0;
      for (const draft of drafts) {
        // Scores refresh; the owner's decision (status) on an existing opportunity is preserved.
        await client.query("INSERT INTO marketing_opportunities(activity_id,period,fingerprint,title,description,audience,channel,category,relevance,impact,feasibility,cost_level,score,rationale,effort_minutes,cost_min_eur,cost_max_eur,expected_impact,best_moment,action,brief,source) VALUES('bitg',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) ON CONFLICT(activity_id,period,fingerprint) DO UPDATE SET title=EXCLUDED.title,description=EXCLUDED.description,audience=EXCLUDED.audience,channel=EXCLUDED.channel,category=EXCLUDED.category,relevance=EXCLUDED.relevance,impact=EXCLUDED.impact,feasibility=EXCLUDED.feasibility,cost_level=EXCLUDED.cost_level,score=EXCLUDED.score,rationale=EXCLUDED.rationale,effort_minutes=EXCLUDED.effort_minutes,cost_min_eur=EXCLUDED.cost_min_eur,cost_max_eur=EXCLUDED.cost_max_eur,expected_impact=EXCLUDED.expected_impact,best_moment=EXCLUDED.best_moment,action=EXCLUDED.action,brief=EXCLUDED.brief,source=EXCLUDED.source,updated_at=now()",
          [period, draft.fingerprint, draft.title, draft.description, draft.audience, draft.channel, draft.category, draft.factors.relevance, draft.factors.impact, draft.factors.feasibility, draft.factors.cost, draft.score, JSON.stringify(draft.rationale), draft.effortMinutes, draft.costEur[0], draft.costEur[1], JSON.stringify(draft.expectedImpact), draft.bestMoment, draft.action, JSON.stringify(draft.brief), draft.source]);
      }
      // Open opportunities that dropped out of this month's selection are stale; decided ones stay for history.
      const stale = (await client.query("DELETE FROM marketing_opportunities WHERE activity_id='bitg' AND period=$1 AND status='open' AND NOT (fingerprint=ANY($2))", [period, drafts.map(draft => draft.fingerprint)])).rowCount || 0;
      if (actor) await audit(client, actor, "marketing.research_run", null, { added, removed, opportunities: drafts.length });
      return { items: items.length, added, removed, opportunities: drafts.length, stale };
    });
  });
}
export async function runDueJobs(now = new Date()) {
  const { settings } = await getSettings();
  const last = await pool("admin").query("SELECT max(started_at) AS at FROM marketing_runs WHERE activity_id='bitg' AND job='research' AND status='succeeded'");
  const at = last.rows[0]?.at ? new Date(last.rows[0].at).getTime() : 0;
  if (now.getTime() - at < settings.researchEveryDays * 86400000 - 300000) return { research: "not_due" as const };
  try { return { research: "ran" as const, ...(await runResearch("schedule", null, now)) }; }
  catch (error) { if (error instanceof RunConflict) return { research: "busy" as const }; throw error; }
}

export type OpportunityRow = Awaited<ReturnType<typeof listOpportunities>>[number];
export async function listOpportunities(period?: string) {
  const result = await pool("admin").query("SELECT id,period::text AS period,title,description,audience,channel,category,relevance,impact,feasibility,cost_level,score,rationale,effort_minutes,cost_min_eur,cost_max_eur,expected_impact,best_moment,action,brief,source,is_demo,status,version,updated_at FROM marketing_opportunities WHERE activity_id='bitg' AND period=coalesce($1::date,(SELECT max(period) FROM marketing_opportunities WHERE activity_id='bitg')) ORDER BY score DESC,effort_minutes,title", [period ?? null]);
  return result.rows.map(row => ({ ...row, updated_at: new Date(row.updated_at).toISOString() })) as {
    id: string; period: string; title: string; description: string; audience: string; channel: Channel; category: string; relevance: number; impact: number; feasibility: number; cost_level: number; score: number; rationale: string[];
    effort_minutes: number; cost_min_eur: number; cost_max_eur: number; expected_impact: { label: string; range: string; confidence: string; basis: string }; best_moment: string | null; action: string; brief: CalendarBrief; source: string; is_demo: boolean; status: OpportunityStatus; version: number; updated_at: string;
  }[];
}
export async function updateOpportunity(id: string, change: { status?: OpportunityStatus; planFor?: string }, version: number, actor: string) {
  return transaction(async client => {
    const result = await client.query("UPDATE marketing_opportunities SET status=$1,version=version+1,updated_at=now() WHERE id=$2 AND activity_id='bitg' AND version=$3 RETURNING id,title,channel,category,effort_minutes,brief", [change.planFor ? "planned" : change.status, id, version]);
    if (result.rowCount !== 1) throw new VersionConflict();
    const row = result.rows[0];
    if (change.planFor) await client.query("INSERT INTO marketing_calendar_items(activity_id,opportunity_id,scheduled_for,channel,category,title,brief,effort_minutes,generated_by) VALUES('bitg',$1,$2,$3,$4,$5,$6,$7,'owner')", [id, change.planFor, row.channel, row.category, row.title, JSON.stringify(row.brief), row.effort_minutes]);
    await audit(client, actor, "marketing.opportunity_changed", id, { status: change.planFor ? "planned" : change.status, planned: Boolean(change.planFor) });
    return true;
  });
}

export type CalendarRow = Awaited<ReturnType<typeof listCalendar>>[number];
export async function listCalendar(from: string, to: string) {
  const result = await pool("admin").query("SELECT id,opportunity_id,scheduled_for::text AS scheduled_for,channel,category,title,brief,notes,effort_minutes,status,generated_by,is_demo,version FROM marketing_calendar_items WHERE activity_id='bitg' AND scheduled_for BETWEEN $1 AND $2 ORDER BY scheduled_for,created_at", [from, to]);
  return result.rows as { id: string; opportunity_id: string | null; scheduled_for: string; channel: Channel; category: string; title: string; brief: CalendarBrief; notes: string | null; effort_minutes: number; status: CalendarStatus; generated_by: string; is_demo: boolean; version: number }[];
}
async function candidates(client: pg.PoolClient): Promise<PlanCandidate[]> {
  const result = await client.query("SELECT id,fingerprint,title,channel,category,effort_minutes,score,brief FROM marketing_opportunities WHERE activity_id='bitg' AND status IN ('open','planned') AND period=(SELECT max(period) FROM marketing_opportunities WHERE activity_id='bitg')");
  return result.rows.map(row => ({ opportunityId: row.id, fingerprint: row.fingerprint, title: row.title, channel: row.channel, category: row.category, effortMinutes: row.effort_minutes, score: row.score, brief: row.brief }));
}
// Replaces unapproved planner drafts in the window. Approved, published and owner-made items are kept.
export async function generatePlan(actor: string, { start = addDays(localDate(), 1), days = 30 } = {}) {
  return tracked("plan", "manual", { minIntervalSeconds: 10 }, async () => {
    const { settings } = await getSettings(), end = addDays(start, days - 1);
    return transaction(async client => {
      const removed = (await client.query("DELETE FROM marketing_calendar_items WHERE activity_id='bitg' AND generated_by='planner' AND status IN ('draft','rejected') AND scheduled_for BETWEEN $1 AND $2", [start, end])).rowCount || 0;
      const kept = await client.query("SELECT scheduled_for::text AS day,sum(effort_minutes)::int AS minutes FROM marketing_calendar_items WHERE activity_id='bitg' AND status<>'rejected' AND scheduled_for BETWEEN $1 AND $2 GROUP BY 1", [start, end]);
      const planned = planCalendar({ start, days, settings, candidates: await candidates(client), occupied: new Map(kept.rows.map(row => [row.day, row.minutes])) });
      for (const item of planned) await client.query("INSERT INTO marketing_calendar_items(activity_id,opportunity_id,scheduled_for,channel,category,title,brief,effort_minutes,generated_by) VALUES('bitg',$1,$2,$3,$4,$5,$6,$7,'planner')", [item.opportunityId, item.scheduledFor, item.channel, item.category, item.title, JSON.stringify(item.brief), item.effortMinutes]);
      await audit(client, actor, "marketing.plan_generated", null, { start, days, planned: planned.length, removed });
      return { planned: planned.length, removed, kept: kept.rowCount || 0 };
    });
  });
}
export async function updateCalendarItem(id: string, change: { scheduledFor?: string; title?: string; hook?: string; notes?: string; channel?: Channel; status?: Exclude<CalendarStatus, "scheduled"> }, version: number, actor: string) {
  return transaction(async client => {
    const current = await client.query("SELECT status,brief FROM marketing_calendar_items WHERE id=$1 AND activity_id='bitg' AND version=$2 FOR UPDATE", [id, version]);
    if (current.rowCount !== 1) throw new VersionConflict();
    // Only approved content can be recorded as published (manually, by the owner).
    if (change.status === "published" && current.rows[0].status !== "approved" && current.rows[0].status !== "published") throw new InvalidChange();
    const brief = change.hook === undefined ? current.rows[0].brief : { ...current.rows[0].brief, hook: change.hook };
    // Editing approved content sends it back to draft, so nothing changes after approval unnoticed.
    const edited = change.title !== undefined || change.hook !== undefined || change.notes !== undefined || change.channel !== undefined;
    const status = change.status ?? (edited && current.rows[0].status === "approved" ? "draft" : current.rows[0].status);
    const result = await client.query("UPDATE marketing_calendar_items SET scheduled_for=coalesce($1,scheduled_for),title=coalesce($2,title),brief=$3,notes=coalesce($4,notes),channel=coalesce($5,channel),status=$6,version=version+1,updated_at=now() WHERE id=$7 RETURNING version", [change.scheduledFor ?? null, change.title ?? null, JSON.stringify(brief), change.notes ?? null, change.channel ?? null, status, id]);
    await audit(client, actor, "marketing.calendar_changed", id, { status, moved: Boolean(change.scheduledFor), edited });
    return result.rows[0].version as number;
  });
}
export async function regenerateCalendarItem(id: string, version: number, actor: string) {
  return transaction(async client => {
    const current = await client.query("SELECT title,category,scheduled_for::text AS scheduled_for FROM marketing_calendar_items WHERE id=$1 AND activity_id='bitg' AND version=$2 AND status IN ('draft','rejected') FOR UPDATE", [id, version]);
    if (current.rowCount !== 1) throw new VersionConflict();
    const used = await client.query("SELECT title FROM marketing_calendar_items WHERE activity_id='bitg' AND id<>$1 AND scheduled_for BETWEEN $2::date-30 AND $2::date+30", [id, current.rows[0].scheduled_for]);
    const idea = alternativeIdea(current.rows[0], await candidates(client), used.rows.map(row => row.title));
    if (!idea) return null;
    await client.query("UPDATE marketing_calendar_items SET title=$1,channel=$2,category=$3,brief=$4,effort_minutes=$5,opportunity_id=$6,notes=NULL,status='draft',version=version+1,updated_at=now() WHERE id=$7", [idea.title, idea.channel, idea.category, JSON.stringify(idea.brief), idea.effortMinutes, idea.opportunityId ?? null, id]);
    await audit(client, actor, "marketing.calendar_regenerated", id, {});
    return idea.title;
  });
}

export async function listResearch(limit = 30) {
  const result = await pool("admin").query("SELECT id,source,kind,title,summary,url,is_demo,first_seen_at,last_seen_at FROM marketing_research_items WHERE activity_id='bitg' AND expires_at>=now() ORDER BY first_seen_at DESC,(kind IN ('trend','performance','seasonal','local')) DESC,kind,title LIMIT $1", [limit]);
  return result.rows.map(row => ({ ...row, first_seen_at: new Date(row.first_seen_at).toISOString(), last_seen_at: new Date(row.last_seen_at).toISOString() })) as { id: string; source: string; kind: string; title: string; summary: string; url: string | null; is_demo: boolean; first_seen_at: string; last_seen_at: string }[];
}
export async function listRuns(limit = 10) {
  const result = await pool("admin").query("SELECT id,job,trigger,status,started_at,finished_at,stats,error,cost_cents FROM marketing_runs WHERE activity_id='bitg' ORDER BY started_at DESC LIMIT $1", [limit]);
  return result.rows.map(row => ({ ...row, started_at: new Date(row.started_at).toISOString(), finished_at: row.finished_at ? new Date(row.finished_at).toISOString() : null })) as { id: string; job: Job; trigger: Trigger; status: string; started_at: string; finished_at: string | null; stats: Record<string, number>; error: string | null; cost_cents: number }[];
}
export async function costSummary() {
  const result = await pool("admin").query("SELECT coalesce(sum(cost_cents),0)::int AS cents,count(*)::int AS runs FROM marketing_runs WHERE activity_id='bitg' AND started_at>=date_trunc('month',now())");
  return result.rows[0] as { cents: number; runs: number };
}
