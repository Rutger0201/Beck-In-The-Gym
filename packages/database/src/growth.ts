import "server-only";
import { randomUUID } from "node:crypto";
import type pg from "pg";
import { pool } from "./client.ts";
import { finishRun, startRun, tracked, RunConflict, VersionConflict, type Trigger } from "./marketing.ts";
import { addDays, localDate, startOfWeek } from "@bitg/core/marketing/dates";
import { readGrowthSettings, type GrowthSettings } from "@bitg/core/growth/validation";
import { Fetcher, type FetchLike } from "@bitg/core/growth/fetcher";
import { discover, geocode, planSources, prepare, searchKeys, withExactLocation, type Candidate } from "@bitg/core/growth/discovery";
import { analyseWithAi, draftWithAi, type DraftInput } from "@bitg/core/growth/ai";
import { templateDraft } from "@bitg/core/growth/drafts";
import { opportunityScore, promisingScore } from "@bitg/core/growth/scoring";
import { similarity } from "@bitg/core/growth/text";
import { aiStatus, AiDeclined } from "@bitg/core/ai/claude";
import { activeStatuses, growthCategoryLabels, growthStatusLabels, type DraftKind, type DraftStatus, type GrowthCategory, type GrowthFactors, type GrowthInsight, type GrowthStatus } from "@bitg/core/growth/labels";

async function transaction<T>(work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool("admin").connect();
  try { await client.query("BEGIN"); const result = await work(client); await client.query("COMMIT"); return result; }
  catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}
async function audit(client: pg.PoolClient, actor: string | null, action: string, subject: string | null, details: Record<string, unknown>) {
  await client.query("INSERT INTO audit_events(id,actor_id,activity_id,action,subject_id,details) VALUES($1,$2,'bitg',$3,$4,$5)", [randomUUID(), actor, action, subject, JSON.stringify(details)]);
}
async function history(client: pg.PoolClient | pg.Pool, id: string, event: string, details: Record<string, unknown>, actor: string | null = null) {
  await client.query("INSERT INTO growth_history(activity_id,opportunity_id,event,details,actor_id) VALUES('bitg',$1,$2,$3,$4)", [id, event, JSON.stringify(details), actor]);
}

export async function getGrowthSettings(): Promise<{ settings: GrowthSettings; version: number }> {
  const result = await pool("admin").query("SELECT settings,version FROM growth_settings WHERE activity_id='bitg'");
  return { settings: readGrowthSettings(result.rows[0]?.settings), version: result.rows[0]?.version ?? 1 };
}
export async function saveGrowthSettings(settings: GrowthSettings, version: number, actor: string) {
  return transaction(async client => {
    const result = await client.query("UPDATE growth_settings SET settings=$1,version=version+1,updated_at=now() WHERE activity_id='bitg' AND version=$2 RETURNING version", [JSON.stringify(settings), version]);
    if (result.rowCount !== 1) throw new VersionConflict();
    await audit(client, actor, "growth.settings_changed", null, { version: version + 1 });
    return result.rows[0].version as number;
  });
}
export async function growthSpendThisMonth(): Promise<number> {
  const result = await pool("admin").query("SELECT coalesce(sum(cost_cents),0)::int AS cents FROM marketing_runs WHERE activity_id='bitg' AND job LIKE 'growth%' AND started_at>=date_trunc('month',now())");
  return result.rows[0].cents as number;
}

type Existing = { id: string; fingerprint: string; content_hash: string; title: string; event_date: string | null; analysis_method: "rules" | "ai"; category_locked: boolean; category: GrowthCategory; relevance: number; value: number; likelihood: number; also_seen: string[] };
// Upsert one candidate. AI-assessed factors (relevance, value, likelihood) and an owner-chosen category survive
// refreshes; distance, urgency and reliability are recomputed every run because they depend on today.
async function store(client: pg.PoolClient, candidate: Candidate, existing: Existing | undefined): Promise<"new" | "updated" | "seen"> {
  const raw = candidate.raw, located = candidate.located;
  if (!existing) {
    const result = await client.query(`INSERT INTO growth_opportunities(activity_id,fingerprint,content_hash,title,summary,url,also_seen,source,source_kind,query,organisation,category,place,lat,lon,geo_precision,distance_km,event_date,published_at,relevance,value,geography,likelihood,urgency,reliability,score,insight)
      VALUES('bitg',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26) RETURNING id`,
      [candidate.fingerprint, candidate.contentHash, candidate.title, candidate.summary, raw.url, JSON.stringify(candidate.sources.slice(1, 10)), raw.source.slice(0, 120), raw.sourceKind, raw.query, raw.organisation?.slice(0, 200) ?? null, candidate.category, located.place?.slice(0, 200) ?? null, located.lat, located.lon, located.precision, located.distanceKm, candidate.date, raw.publishedAt, ...factorList(candidate.factors), candidate.score, JSON.stringify(candidate.insight)]);
    await history(client, result.rows[0].id, "discovered", { source: raw.source, score: candidate.score });
    return "new";
  }
  const kept: GrowthFactors = existing.analysis_method === "ai" ? { ...candidate.factors, relevance: existing.relevance, value: existing.value, likelihood: existing.likelihood } : candidate.factors;
  const changed = existing.content_hash !== candidate.contentHash, alsoSeen = [...new Set([...existing.also_seen, ...candidate.sources.filter(url => url !== raw.url)])].slice(0, 10);
  await client.query(`UPDATE growth_opportunities SET last_seen_at=now(),seen_count=seen_count+1,also_seen=$2,geography=$3,urgency=$4,reliability=$5,relevance=$6,value=$7,likelihood=$8,score=$9,
      content_hash=$10,summary=CASE WHEN $11 THEN $12 ELSE summary END,event_date=coalesce($13,event_date),place=coalesce(place,$14),lat=coalesce(lat,$15),lon=coalesce(lon,$16),geo_precision=coalesce(geo_precision,$17),distance_km=coalesce(distance_km,$18),
      category=CASE WHEN category_locked OR analysis_method='ai' THEN category ELSE $19 END,insight=CASE WHEN analysis_method='ai' THEN insight ELSE $20 END,updated_at=now() WHERE id=$1`,
    [existing.id, JSON.stringify(alsoSeen), kept.geography, kept.urgency, kept.reliability, kept.relevance, kept.value, kept.likelihood, opportunityScore(kept), candidate.contentHash, changed, candidate.summary, candidate.date, located.place, located.lat, located.lon, located.precision, located.distanceKm, candidate.category, JSON.stringify(candidate.insight)]);
  if (changed) await history(client, existing.id, "refreshed", { source: raw.source });
  return changed ? "updated" : "seen";
}
const factorList = (f: GrowthFactors) => [f.relevance, f.value, f.geography, f.likelihood, f.urgency, f.reliability];

// Retention (AVG): rejected items after 90 days, untouched new items after 120 days, public help requests after 30 days.
async function purge(client: pg.PoolClient) {
  const removed = await client.query(`DELETE FROM growth_opportunities WHERE activity_id='bitg' AND (
      (status='rejected' AND status_changed_at<now()-interval '90 days') OR (status='new' AND last_seen_at<now()-interval '120 days') OR (category='client_demand' AND status='new' AND first_seen_at<now()-interval '30 days'))`);
  await client.query("DELETE FROM growth_source_checks WHERE activity_id='bitg' AND checked_at<now()-interval '90 days'");
  return removed.rowCount || 0;
}

export type ScanOptions = { fetchImpl?: FetchLike; now?: Date; budgetMs?: number; analyse?: typeof analyseWithAi; fetcherOptions?: ConstructorParameters<typeof Fetcher>[1] };
export async function runGrowthScan(trigger: Trigger, actor: string | null = null, options: ScanOptions = {}) {
  const runId = await startRun("growth", trigger, { leaseSeconds: 600, minIntervalSeconds: trigger === "manual" ? 60 : 0 });
  let costCents = 0;
  try {
    const stats = await scan(runId, actor, options, cost => { costCents += cost; });
    await finishRun(runId, { stats: { ...stats, costCents }, costCents });
    return { ...stats, costCents };
  } catch (error) {
    await finishRun(runId, { error: error instanceof Error ? error.message : "Onbekende fout", costCents });
    throw error;
  }
}
async function scan(runId: string, actor: string | null, { fetchImpl, now = new Date(), budgetMs = 90_000, analyse = analyseWithAi, fetcherOptions }: ScanOptions, spend: (cents: number) => void) {
  const started = Date.now(), { settings } = await getGrowthSettings(), fetcher = new Fetcher(fetchImpl, fetcherOptions);
  // 1. Discovery (logged per source)
  const { jobs, inactive } = planSources(settings, searchKeys(), now);
  const { items, results } = await discover(jobs, fetcher, started + budgetMs * 0.55);
  for (const result of results) await pool("admin").query("INSERT INTO growth_source_checks(activity_id,run_id,key,kind,label,ok,items,error,ms) VALUES('bitg',$1,$2,$3,$4,$5,$6,$7,$8)", [runId, result.key.slice(0, 600), result.kind, result.label.slice(0, 300), result.ok, result.items, result.error, result.ms]);
  // 2. Processing: privacy screening, deduplication, rule assessment
  const prepared = prepare(items, settings, now);
  // 3. Exact locations for calendar and agenda items (PDOK), bounded per run
  let geocoded = 0;
  for (let index = 0; index < prepared.candidates.length && geocoded < 10 && Date.now() < started + budgetMs * 0.65; index++) {
    const candidate = prepared.candidates[index];
    if (candidate.located.precision === "exact" || !candidate.raw.locationText || (candidate.raw.sourceKind !== "ical" && candidate.raw.sourceKind !== "jsonld")) continue;
    geocoded++;
    const point = await geocode(fetcher, candidate.raw.locationText).catch(() => null);
    if (point) prepared.candidates[index] = withExactLocation(candidate, point, settings, now);
  }
  // 4. Storage with cross-run deduplication
  const counts = await transaction(async client => {
    const known = await client.query<Existing>("SELECT id,fingerprint,content_hash,title,event_date::text AS event_date,analysis_method,category_locked,category,relevance,value,likelihood,also_seen FROM growth_opportunities WHERE activity_id='bitg' AND last_seen_at>now()-interval '120 days' ORDER BY last_seen_at DESC LIMIT 3000");
    const byFingerprint = new Map(known.rows.map(row => [row.fingerprint, row]));
    let added = 0, updated = 0, merged = 0;
    for (const candidate of prepared.candidates) {
      let existing = byFingerprint.get(candidate.fingerprint);
      if (!existing) { existing = known.rows.find(row => similarity(row.title, candidate.title) >= 0.7 && (row.event_date ?? null) === candidate.date); if (existing) merged++; }
      const outcome = await store(client, candidate, existing);
      if (outcome === "new") added++; else if (outcome === "updated") updated++;
    }
    const removed = await purge(client);
    if (actor) await audit(client, actor, "growth.scan", null, { added, updated });
    return { added, updated, merged, removed };
  });
  // 5. AI analysis of new or changed items, highest rule score first, within run and monthly budget
  const ai = aiStatus();
  let analysed = 0, aiFailures = 0, aiDismissed = 0, budgetReached = 0;
  if (ai.configured && settings.maxAnalysesPerRun > 0) {
    let spent = await growthSpendThisMonth();
    const pending = await pool("admin").query("SELECT id,title,summary,url,source,place,distance_km,event_date::text AS event_date,category,category_locked,status,geography,urgency,reliability,content_hash FROM growth_opportunities WHERE activity_id='bitg' AND status = ANY($1) AND analysed_hash IS DISTINCT FROM content_hash ORDER BY score DESC,first_seen_at DESC LIMIT $2", [activeStatuses, settings.maxAnalysesPerRun]);
    for (const row of pending.rows) {
      if (spent >= settings.monthlyAiBudgetCents) { budgetReached = 1; break; }
      if (Date.now() > started + budgetMs) break;
      try {
        const result = await analyse({ title: row.title, summary: row.summary, source: row.source, url: row.url, place: row.place, distanceKm: row.distance_km === null ? null : Number(row.distance_km), date: row.event_date, ruleCategory: row.category });
        spend(result.costCents); spent += result.costCents; analysed++;
        const factors: GrowthFactors = { relevance: result.relevance, value: result.value, likelihood: result.likelihood, geography: row.geography, urgency: row.urgency, reliability: row.reliability };
        const dismiss = !result.isOpportunity && row.status === "new";
        if (dismiss) aiDismissed++;
        await pool("admin").query("UPDATE growth_opportunities SET relevance=$2,value=$3,likelihood=$4,score=$5,insight=$6,category=CASE WHEN category_locked THEN category ELSE $7 END,organisation=coalesce(organisation,$8),analysis_method='ai',analysis_model=$9,analysed_hash=$10,analysed_at=now(),status=CASE WHEN $11 THEN 'rejected' ELSE status END,status_changed_at=CASE WHEN $11 THEN now() ELSE status_changed_at END,updated_at=now() WHERE id=$1",
          [row.id, factors.relevance, factors.value, factors.likelihood, opportunityScore(factors), JSON.stringify(result.insight), result.category, result.organisation, result.model, row.content_hash, dismiss]);
        await history(pool("admin"), row.id, dismiss ? "ai_dismissed" : "analysed", { model: result.model, score: opportunityScore(factors) });
      } catch (error) {
        aiFailures++;
        const cents = error instanceof AiDeclined ? Number((error as AiDeclined & { costCents?: number }).costCents) || 0 : 0;
        spend(cents); spent += cents;
        // Mark as analysed for this content so a declined item is not retried (and paid for) every run.
        if (error instanceof AiDeclined) await pool("admin").query("UPDATE growth_opportunities SET analysed_hash=content_hash WHERE id=$1", [row.id]);
        console.error("growth.analysis failed", error instanceof Error ? error.name : "unknown");
      }
    }
  }
  return {
    sources: results.length, sourceErrors: results.filter(result => !result.ok).length, inactiveSources: inactive.length, requests: fetcher.requests, found: items.length,
    screened: prepared.screened, duplicates: prepared.duplicates + counts.merged, outdated: prepared.outdated, distant: prepared.distant,
    added: counts.added, updated: counts.updated, removed: counts.removed, geocoded, analysed, aiDismissed, aiFailures, budgetReached
  };
}

export async function runDueGrowthJobs(now = new Date()) {
  const { settings } = await getGrowthSettings();
  const last = await pool("admin").query("SELECT max(started_at) FILTER (WHERE job='growth' AND status='succeeded') AS scan, max(started_at) FILTER (WHERE job='growth_digest' AND status='succeeded') AS digest FROM marketing_runs WHERE activity_id='bitg'");
  const lastScan = last.rows[0]?.scan ? new Date(last.rows[0].scan).getTime() : 0, lastDigest = last.rows[0]?.digest ? new Date(last.rows[0].digest).getTime() : 0;
  const outcome: { scan: string; digest: string } = { scan: "not_due", digest: "not_due" };
  if (now.getTime() - lastScan >= settings.scanEveryDays * 86400000 - 300000) {
    try { await runGrowthScan("schedule", null, { now }); outcome.scan = "ran"; }
    catch (error) { if (error instanceof RunConflict) outcome.scan = "busy"; else { outcome.scan = "failed"; console.error("growth.scan failed", error instanceof Error ? error.name : "unknown"); } }
  }
  // Weekly summary on Monday (Amsterdam time), only when switched on.
  if (settings.weeklyDigest && new Date(`${localDate(now)}T12:00:00Z`).getUTCDay() === 1 && now.getTime() - lastDigest > 6 * 86400000) {
    try { await tracked("growth_digest", "schedule", {}, () => sendWeeklyDigest(now)); outcome.digest = "sent"; }
    catch (error) { outcome.digest = error instanceof RunConflict ? "busy" : "failed"; }
  }
  return outcome;
}

export type GrowthRow = {
  id: string; title: string; summary: string; url: string; also_seen: string[]; source: string; source_kind: string; organisation: string | null; category: GrowthCategory; category_locked: boolean;
  place: string | null; lat: number | null; lon: number | null; geo_precision: "exact" | "address" | "place" | null; distance_km: number | null; event_date: string | null; published_at: string | null;
  relevance: number; value: number; geography: number; likelihood: number; urgency: number; reliability: number; score: number; insight: GrowthInsight;
  analysis_method: "rules" | "ai"; analysis_model: string | null; status: GrowthStatus; follow_up_on: string | null; is_demo: boolean; first_seen_at: string; last_seen_at: string; seen_count: number; version: number; open_reminders: number;
};
const rowColumns = "o.id,o.title,o.summary,o.url,o.also_seen,o.source,o.source_kind,o.organisation,o.category,o.category_locked,o.place,o.lat,o.lon,o.geo_precision,o.distance_km::float AS distance_km,o.event_date::text AS event_date,o.published_at,o.relevance,o.value,o.geography,o.likelihood,o.urgency,o.reliability,o.score,o.insight,o.analysis_method,o.analysis_model,o.status,o.follow_up_on::text AS follow_up_on,o.is_demo,o.first_seen_at,o.last_seen_at,o.seen_count,o.version,(SELECT count(*)::int FROM growth_notes n WHERE n.opportunity_id=o.id AND n.remind_on IS NOT NULL AND NOT n.done) AS open_reminders";
const iso = (value: unknown) => (value ? new Date(value as string).toISOString() : null);
const mapRow = (row: Record<string, unknown>) => ({ ...row, published_at: iso(row.published_at), first_seen_at: iso(row.first_seen_at), last_seen_at: iso(row.last_seen_at) }) as GrowthRow;
export async function listGrowth(limit = 500): Promise<GrowthRow[]> {
  const result = await pool("admin").query(`SELECT ${rowColumns} FROM growth_opportunities o WHERE o.activity_id='bitg' ORDER BY (o.status='rejected'),o.score DESC,o.first_seen_at DESC LIMIT $1`, [limit]);
  return result.rows.map(mapRow);
}
export async function growthOverview(now = new Date()) {
  const today = localDate(now);
  const result = await pool("admin").query(`SELECT
      count(*) FILTER (WHERE first_seen_at>=now()-interval '7 days' AND status<>'rejected')::int AS new_this_week,
      count(*) FILTER (WHERE score>=$1 AND status = ANY($2))::int AS promising,
      count(*) FILTER (WHERE category IN ('event','workshop') AND event_date BETWEEN $3::date AND $3::date+30 AND status<>'rejected')::int AS events_30,
      count(*) FILTER (WHERE category IN ('partnership','corporate') AND status = ANY($2))::int AS partnerships,
      count(*) FILTER (WHERE status = ANY($2) AND follow_up_on IS NOT NULL AND follow_up_on<=$3::date+7)::int AS follow_ups,
      count(*) FILTER (WHERE status = ANY($2) AND follow_up_on IS NOT NULL AND follow_up_on<$3::date)::int AS overdue,
      count(*) FILTER (WHERE status='won')::int AS won
    FROM growth_opportunities WHERE activity_id='bitg'`, [promisingScore, activeStatuses, today]);
  const reminders = await pool("admin").query("SELECT n.id,n.body,n.remind_on::text AS remind_on,o.id AS opportunity_id,o.title FROM growth_notes n JOIN growth_opportunities o ON o.id=n.opportunity_id WHERE n.activity_id='bitg' AND NOT n.done AND n.remind_on IS NOT NULL AND n.remind_on<=$1::date+7 ORDER BY n.remind_on LIMIT 10", [today]);
  return { ...(result.rows[0] as { new_this_week: number; promising: number; events_30: number; partnerships: number; follow_ups: number; overdue: number; won: number }), reminders: reminders.rows as { id: string; body: string; remind_on: string; opportunity_id: string; title: string }[] };
}
export async function getGrowthItem(id: string) {
  const result = await pool("admin").query(`SELECT ${rowColumns} FROM growth_opportunities o WHERE o.id=$1 AND o.activity_id='bitg'`, [id]);
  if (result.rowCount !== 1) return null;
  const [notes, drafts, events] = await Promise.all([
    pool("admin").query("SELECT id,body,remind_on::text AS remind_on,done,created_at FROM growth_notes WHERE opportunity_id=$1 ORDER BY created_at DESC", [id]),
    pool("admin").query("SELECT id,kind,subject,body,method,model,status,version,created_at,updated_at FROM growth_drafts WHERE opportunity_id=$1 ORDER BY created_at DESC", [id]),
    pool("admin").query("SELECT id,event,details,created_at FROM growth_history WHERE opportunity_id=$1 ORDER BY created_at DESC LIMIT 50", [id])
  ]);
  return {
    item: mapRow(result.rows[0]),
    notes: notes.rows.map(row => ({ ...row, created_at: iso(row.created_at)! })) as { id: string; body: string; remind_on: string | null; done: boolean; created_at: string }[],
    drafts: drafts.rows.map(row => ({ ...row, created_at: iso(row.created_at)!, updated_at: iso(row.updated_at)! })) as { id: string; kind: DraftKind; subject: string; body: string; method: "ai" | "template"; model: string | null; status: DraftStatus; version: number; created_at: string; updated_at: string }[],
    history: events.rows.map(row => ({ ...row, created_at: iso(row.created_at)! })) as { id: string; event: string; details: Record<string, unknown>; created_at: string }[]
  };
}
export async function updateGrowth(id: string, change: { status?: GrowthStatus; category?: GrowthCategory; followUpOn?: string | null }, version: number, actor: string) {
  return transaction(async client => {
    const result = await client.query(`UPDATE growth_opportunities SET status=coalesce($2,status),status_changed_at=CASE WHEN $2::text IS NOT NULL AND $2<>status THEN now() ELSE status_changed_at END,
        category=coalesce($3,category),category_locked=category_locked OR $3::text IS NOT NULL,follow_up_on=CASE WHEN $4 THEN $5::date ELSE follow_up_on END,version=version+1,updated_at=now()
      WHERE id=$1 AND activity_id='bitg' AND version=$6 RETURNING version`, [id, change.status ?? null, change.category ?? null, change.followUpOn !== undefined, change.followUpOn ?? null, version]);
    if (result.rowCount !== 1) throw new VersionConflict();
    if (change.status) await history(client, id, "status", { status: change.status, label: growthStatusLabels[change.status] }, actor);
    if (change.category) await history(client, id, "category", { category: change.category, label: growthCategoryLabels[change.category] }, actor);
    if (change.followUpOn !== undefined) await history(client, id, "follow_up", { on: change.followUpOn }, actor);
    await audit(client, actor, "growth.opportunity_changed", id, { status: change.status ?? null, category: change.category ?? null, followUp: change.followUpOn !== undefined });
    return result.rows[0].version as number;
  });
}
export async function addGrowthNote(id: string, note: { body: string; remindOn?: string | null }, actor: string) {
  return transaction(async client => {
    const exists = await client.query("SELECT 1 FROM growth_opportunities WHERE id=$1 AND activity_id='bitg'", [id]);
    if (exists.rowCount !== 1) throw new VersionConflict();
    const result = await client.query("INSERT INTO growth_notes(activity_id,opportunity_id,body,remind_on,actor_id) VALUES('bitg',$1,$2,$3,$4) RETURNING id", [id, note.body, note.remindOn ?? null, actor]);
    await history(client, id, "note", { reminder: note.remindOn ?? null }, actor);
    await audit(client, actor, "growth.note_added", id, { reminder: Boolean(note.remindOn) });
    return result.rows[0].id as string;
  });
}
export async function completeGrowthNote(noteId: string, actor: string) {
  const result = await pool("admin").query("UPDATE growth_notes SET done=true WHERE id=$1 AND activity_id='bitg' AND NOT done RETURNING opportunity_id", [noteId]);
  if (result.rowCount !== 1) throw new VersionConflict();
  await history(pool("admin"), result.rows[0].opportunity_id, "reminder_done", {}, actor);
}
// Drafts are prepared, never sent: the platform has no outbound channel to third parties.
export async function createGrowthDraft(id: string, request: { kind: DraftKind; instructions?: string }, actor: string, draft = draftWithAi) {
  const found = await getGrowthItem(id);
  if (!found) throw new VersionConflict();
  const { item } = found;
  const input: DraftInput = { kind: request.kind, title: item.title, organisation: item.organisation, category: item.category, place: item.place, date: item.event_date, why: item.insight.why || "", nextStep: item.insight.nextStep || "", url: item.url, instructions: request.instructions };
  const write = async (content: { subject: string; body: string }, method: "ai" | "template", model: string | null) => transaction(async client => {
    const result = await client.query("INSERT INTO growth_drafts(activity_id,opportunity_id,kind,subject,body,method,model) VALUES('bitg',$1,$2,$3,$4,$5,$6) RETURNING id", [id, request.kind, content.subject.slice(0, 200), content.body.slice(0, 8000), method, model]);
    await history(client, id, "draft", { kind: request.kind, method }, actor);
    await audit(client, actor, "growth.draft_created", id, { kind: request.kind, method });
    return { id: result.rows[0].id as string, method };
  });
  if (!aiStatus().configured) return write(templateDraft(input), "template", null);
  const { settings } = await getGrowthSettings();
  if (await growthSpendThisMonth() >= settings.monthlyAiBudgetCents) return { ...(await write(templateDraft(input), "template", null)), budgetReached: true };
  let saved: { id: string; method: "ai" | "template" } | undefined;
  await tracked("growth_draft", "manual", {}, async () => {
    try { const result = await draft(input); saved = await write(result, "ai", result.model); return { costCents: result.costCents, fallback: 0 }; }
    catch (error) { saved = await write(templateDraft(input), "template", null); return { costCents: error instanceof AiDeclined ? Number((error as AiDeclined & { costCents?: number }).costCents) || 0 : 0, fallback: 1 }; }
  });
  return saved!;
}
export async function updateGrowthDraft(draftId: string, change: { subject?: string; body?: string; status?: DraftStatus }, version: number, actor: string) {
  return transaction(async client => {
    // Editing an approved draft sends it back to concept, so nothing changes after approval unnoticed.
    const result = await client.query(`UPDATE growth_drafts SET subject=coalesce($2,subject),body=coalesce($3,body),
        status=coalesce($4,CASE WHEN ($2::text IS NOT NULL OR $3::text IS NOT NULL) AND status='approved' THEN 'draft' ELSE status END),version=version+1,updated_at=now()
      WHERE id=$1 AND activity_id='bitg' AND version=$5 RETURNING version,opportunity_id,status`, [draftId, change.subject ?? null, change.body ?? null, change.status ?? null, version]);
    if (result.rowCount !== 1) throw new VersionConflict();
    if (change.status) await history(client, result.rows[0].opportunity_id, "draft_status", { status: change.status }, actor);
    await audit(client, actor, "growth.draft_changed", draftId, { status: change.status ?? null, edited: change.subject !== undefined || change.body !== undefined });
    return result.rows[0].version as number;
  });
}

export async function latestSourceChecks() {
  const result = await pool("admin").query("SELECT DISTINCT ON (key) key,kind,label,ok,items,error,ms,checked_at FROM growth_source_checks WHERE activity_id='bitg' AND checked_at>now()-interval '14 days' ORDER BY key,checked_at DESC");
  return result.rows.map(row => ({ ...row, checked_at: iso(row.checked_at)! })) as { key: string; kind: string; label: string; ok: boolean; items: number; error: string | null; ms: number; checked_at: string }[];
}
export async function listGrowthRuns(limit = 15) {
  const result = await pool("admin").query("SELECT id,job,trigger,status,started_at,finished_at,stats,error,cost_cents FROM marketing_runs WHERE activity_id='bitg' AND job LIKE 'growth%' ORDER BY started_at DESC LIMIT $1", [limit]);
  return result.rows.map(row => ({ ...row, started_at: iso(row.started_at)!, finished_at: iso(row.finished_at) })) as { id: string; job: string; trigger: string; status: string; started_at: string; finished_at: string | null; stats: Record<string, number>; error: string | null; cost_cents: number }[];
}

// Weekly summary to the owner only (CONTACT_RECIPIENT_EMAIL). Titles and links only; nothing goes to third parties.
export async function weeklyDigestText(now = new Date()) {
  const today = localDate(now), week = startOfWeek(today);
  const top = await pool("admin").query("SELECT title,url,score,category,place,event_date::text AS event_date FROM growth_opportunities WHERE activity_id='bitg' AND status = ANY($1) AND first_seen_at>=now()-interval '7 days' ORDER BY score DESC LIMIT 10", [activeStatuses]);
  const due = await pool("admin").query("SELECT title,follow_up_on::text AS follow_up_on FROM growth_opportunities WHERE activity_id='bitg' AND status = ANY($1) AND follow_up_on IS NOT NULL AND follow_up_on<=$2::date ORDER BY follow_up_on LIMIT 10", [activeStatuses, addDays(today, 7)]);
  const lines = [`Growth Pipeline — week van ${week}`, "", top.rowCount ? "Nieuwe kansen deze week:" : "Deze week zijn er geen nieuwe kansen gevonden.",
    ...top.rows.map(row => `• [${row.score}] ${row.title} (${growthCategoryLabels[row.category as GrowthCategory]}${row.place ? `, ${row.place}` : ""}${row.event_date ? `, ${row.event_date}` : ""})\n  ${row.url}`),
    "", due.rowCount ? "Opvolgacties tot en met volgende week:" : "Geen opvolgacties gepland.", ...due.rows.map(row => `• ${row.follow_up_on}: ${row.title}`),
    "", `Open het dashboard: ${process.env.ADMIN_URL}/growth`, "", "Deze samenvatting is automatisch opgesteld. Er zijn geen berichten aan derden verstuurd."];
  return { subject: `BITG Growth Pipeline · ${top.rowCount} nieuwe kansen`, text: lines.join("\n"), count: top.rowCount || 0 };
}
export async function sendWeeklyDigest(now = new Date()) {
  const key = process.env.BREVO_API_KEY, from = process.env.MAIL_FROM, owner = process.env.CONTACT_RECIPIENT_EMAIL;
  if (!key || !from || !owner) throw new Error("Mail is not configured");
  const digest = await weeklyDigestText(now);
  const response = await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST", signal: AbortSignal.timeout(15000), headers: { "api-key": key, "Content-Type": "application/json" }, body: JSON.stringify({ sender: { name: "Beck In The Gym", email: from }, to: [{ email: owner }], subject: digest.subject, textContent: digest.text }) });
  if (!response.ok) throw new Error("Provider rejected delivery");
  return { opportunities: digest.count };
}
