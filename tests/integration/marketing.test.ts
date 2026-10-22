import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
const configured=Boolean(process.env.MIGRATION_DATABASE_URL&&process.env.ADMIN_DATABASE_URL&&process.env.DATABASE_URL);
// Exercises the admin-role data layer against the migrated schema and granted roles.
test("marketing pipeline: leased runs, idempotent research, planning and versioned review",{skip:!configured},async()=>{
  const db=await import("../../packages/database/src/marketing.ts"),{pool}=await import("../../packages/database/src/client.ts");
  const owner=new pg.Client({connectionString:process.env.MIGRATION_DATABASE_URL}),web=new pg.Client({connectionString:process.env.DATABASE_URL});await owner.connect();await web.connect();
  const clean=()=>owner.query("TRUNCATE marketing_calendar_items,marketing_opportunities,marketing_research_items,marketing_runs");
  try{
    await clean();
    const first=await db.runResearch("schedule",null);
    assert.ok(first.opportunities>=10&&first.opportunities<=20);assert.equal(first.added,first.items);
    const second=await db.runResearch("schedule",null);
    assert.equal(second.added,0,"repeat research adds no duplicates");
    assert.equal(Number((await owner.query("SELECT count(*) FROM marketing_research_items")).rows[0].count),first.items);
    await assert.rejects(()=>db.runResearch("manual",null),db.RunConflict,"manual runs are rate limited");
    // A crashed run blocks nothing once its lease has expired.
    await owner.query("INSERT INTO marketing_runs(activity_id,job,trigger,lease_until) VALUES('bitg','plan','manual',now()-interval '1 minute')");
    const opportunities=await db.listOpportunities();assert.equal(opportunities.length,first.opportunities);
    const actor=null as unknown as string;
    const plan=await db.generatePlan(actor,{start:"2026-11-02",days:28});assert.ok(plan.planned>=6);
    assert.equal(Number((await owner.query("SELECT count(*) FROM marketing_runs WHERE job='plan' AND status='failed'")).rows[0].count),1);
    const items=await db.listCalendar("2026-11-02","2026-11-29");assert.equal(items.length,plan.planned);
    const item=items[0];
    const version=await db.updateCalendarItem(item.id,{status:"approved"},item.version,actor);
    await assert.rejects(()=>db.updateCalendarItem(item.id,{status:"rejected"},item.version,actor),db.VersionConflict,"stale versions are rejected");
    await assert.rejects(()=>db.updateCalendarItem(items[1].id,{status:"published"},items[1].version,actor),db.InvalidChange,"drafts cannot be marked published");
    await db.updateCalendarItem(item.id,{hook:"Nieuwe hook"},version,actor);
    assert.equal((await db.listCalendar(item.scheduled_for,item.scheduled_for))[0].status,"draft","editing approved content returns it to draft");
    const regenerated=await db.regenerateCalendarItem(items[1].id,items[1].version,actor);assert.ok(regenerated&&regenerated!==items[1].title);
    await db.updateCalendarItem(items[2].id,{status:"approved"},items[2].version,actor);
    await new Promise(resolve=>setTimeout(resolve,10_100));
    const again=await db.generatePlan(actor,{start:"2026-11-02",days:28});
    assert.ok((await db.listCalendar(items[2].scheduled_for,items[2].scheduled_for)).some(entry=>entry.id===items[2].id&&entry.status==="approved"),"approved items survive replanning");
    assert.ok(again.kept>=1);
    const target=opportunities.find(o=>o.status==="open")!;
    await db.updateOpportunity(target.id,{planFor:"2026-11-30"},target.version,actor);
    assert.equal((await db.listCalendar("2026-11-30","2026-11-30"))[0].generated_by,"owner");
    await assert.rejects(()=>web.query("SELECT * FROM marketing_opportunities"),"the public role has no marketing access");
    const due=await db.runDueJobs();assert.equal(due.research,"not_due");
  }finally{await clean();await web.end();await owner.end();await pool("admin").end();}
});
