import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
const configured=Boolean(process.env.MIGRATION_DATABASE_URL&&process.env.ADMIN_DATABASE_URL&&process.env.DATABASE_URL);
const day=(offset:number)=>new Date(Date.now()+offset*86400000).toISOString().slice(0,10);
const compact=(date:string)=>date.replace(/-/g,"");
// A fake internet: no real network calls, but every request goes through the real fetcher (robots.txt, pacing, retries).
function fakeWeb(){
  const calls:string[]=[];let flaky=0;
  const reply=(body:string,status=200)=>new Response(body,{status});
  const fetchImpl=async(url:string)=>{
    calls.push(url);
    if(url.endsWith("/robots.txt"))return url.includes("blocked.example")?reply("User-agent: *\nDisallow: /"):reply("User-agent: *\nAllow: /");
    if(url.startsWith("https://news.google.com/rss/search")){
      if(url.includes("bootcamp")&&flaky++<1)return reply("unavailable",503);
      return reply(`<rss><channel>
        <item><title>Gemeente Almere start vitaliteitsweek voor medewerkers - Almere Deze Week</title><link>https://almeredezeweek.example/vitaliteitsweek</link><pubDate>${new Date().toUTCString()}</pubDate><source url="https://almeredezeweek.example">Almere Deze Week</source></item>
        <item><title>Vitaliteitsweek voor medewerkers gemeente Almere van start - Omroep</title><link>https://omroep.example/nieuws/vitaliteit</link><pubDate>${new Date().toUTCString()}</pubDate><source url="https://omroep.example">Omroep</source></item>
        <item><title>Personal coach Jan</title><link>https://www.linkedin.com/in/jan-coach</link></item>
      </channel></rss>`);
    }
    if(url==="https://club.example/agenda.ics")return reply(`BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:open-dag\r\nSUMMARY:Open dag atletiekvereniging\r\nDTSTART:${compact(day(14))}T100000\r\nLOCATION:Sportpark Almere Buiten\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:oud\r\nSUMMARY:Clubkampioenschap vorig jaar\r\nDTSTART:${compact(day(-30))}\r\nEND:VEVENT\r\nEND:VCALENDAR`);
    if(url.startsWith("https://api.pdok.nl/"))return reply(JSON.stringify({response:{docs:[{weergavenaam:"Sportpark, Almere",centroide_ll:"POINT(5.2771 52.3861)"}]}}));
    if(url==="https://agenda.example/sport")return reply(`<script type="application/ld+json">{"@type":"SportsClub","name":"Hockeyclub Lelystad","address":"Lelystad"}</script>`);
    if(url.startsWith("https://blocked.example/"))return reply("should never be fetched");
    return reply("not found",404);
  };
  return {fetchImpl,calls};
}
// The shared admin pool is closed by the marketing suite, which runs after this one in the same process.
test("growth pipeline: discovery, dedupe, storage, AI analysis, CRM, drafts, retention",{skip:!configured},async()=>{
  const db=await import("../../packages/database/src/growth.ts"),marketing=await import("../../packages/database/src/marketing.ts");
  const {defaultGrowthSettings}=await import("../../packages/core/src/growth/validation.ts");
  const owner=new pg.Client({connectionString:process.env.MIGRATION_DATABASE_URL}),web=new pg.Client({connectionString:process.env.DATABASE_URL});await owner.connect();await web.connect();
  const clean=()=>owner.query("TRUNCATE growth_opportunities,growth_notes,growth_drafts,growth_history,growth_source_checks,marketing_runs CASCADE");
  const actor=null as unknown as string,key=process.env.ANTHROPIC_API_KEY;delete process.env.ANTHROPIC_API_KEY;
  try{
    await clean();await owner.query("UPDATE growth_settings SET settings='{}',version=1");
    const {version}=await db.getGrowthSettings();
    await db.saveGrowthSettings({...defaultGrowthSettings,searchTerms:["vitaliteitsweek","bootcamp"],regions:["Almere"],maxQueriesPerRun:2,icalFeeds:["https://club.example/agenda.ics"],pages:["https://agenda.example/sport","https://blocked.example/agenda"]},version,actor);
    await assert.rejects(()=>db.saveGrowthSettings(defaultGrowthSettings,version,actor),marketing.VersionConflict);
    const web1=fakeWeb(),fast={minIntervalMs:0,backoffMs:1};
    const first=await db.runGrowthScan("schedule",null,{fetchImpl:web1.fetchImpl,fetcherOptions:fast});
    assert.equal(first.sources,5);assert.equal(first.sourceErrors,1,"robots.txt disallow is logged as a source error");
    assert.ok(!web1.calls.includes("https://blocked.example/agenda"),"disallowed pages are never fetched");
    assert.equal(first.screened,2,"LinkedIn profiles are dropped (once per query)");
    assert.ok(first.duplicates>=3,"the same story from two outlets and two queries is merged");
    assert.equal(first.outdated,1);assert.equal(first.geocoded,2,"calendar and agenda locations are geocoded");
    assert.equal(first.added,3);assert.equal(first.analysed,0,"no AI key: rules only");
    const items=await db.listGrowth();
    assert.equal(items.length,3);
    const story=items.find(i=>i.title.includes("vitaliteitsweek"))!,event=items.find(i=>i.title.startsWith("Open dag"))!,club=items.find(i=>i.title==="Hockeyclub Lelystad")!;
    assert.equal(story.category,"corporate");assert.equal(story.also_seen.length,1);assert.equal(story.analysis_method,"rules");
    assert.equal(event.geo_precision,"address");assert.equal(event.place,"Almere Buiten");assert.equal(event.event_date,day(14));assert.equal(event.category,"event");
    assert.equal(club.category,"partnership");assert.equal(club.place,"Lelystad");
    assert.equal(Number((await owner.query("SELECT count(*) FROM growth_source_checks")).rows[0].count),5);
    // Idempotent refresh: nothing new, seen twice
    await owner.query("UPDATE marketing_runs SET started_at=started_at-interval '2 minutes'");
    const second=await db.runGrowthScan("manual",actor,{fetchImpl:fakeWeb().fetchImpl,fetcherOptions:fast});
    assert.equal(second.added,0);assert.equal((await db.listGrowth()).find(i=>i.id===story.id)!.seen_count,2);
    await assert.rejects(()=>db.runGrowthScan("manual",actor,{fetchImpl:fakeWeb().fetchImpl,fetcherOptions:fast}),marketing.RunConflict,"manual scans are rate limited");
    // AI analysis with a stub provider: only changed content is analysed, cost is tracked, irrelevant items are rejected
    process.env.ANTHROPIC_API_KEY="test-only";
    await owner.query("UPDATE marketing_runs SET started_at=started_at-interval '2 minutes'");
    const stub=async(input:{title:string;ruleCategory:"corporate"|"event"|"partnership"|"client_demand"|"campaign"|"workshop"})=>({isOpportunity:!input.title.startsWith("Hockeyclub"),category:input.ruleCategory,organisation:"Gemeente Almere",relevance:5,value:5,likelihood:4,insight:{why:"Waarom.",benefit:"Voordeel.",nextStep:"Stap.",valueEstimate:null},costCents:2,model:"stub-model"});
    const third=await db.runGrowthScan("manual",actor,{fetchImpl:fakeWeb().fetchImpl,fetcherOptions:fast,analyse:stub});
    assert.equal(third.analysed,3);assert.equal(third.aiDismissed,1);assert.equal(third.costCents,6);
    assert.equal(await db.growthSpendThisMonth(),6);
    const analysed=(await db.getGrowthItem(story.id))!.item;
    assert.equal(analysed.analysis_method,"ai");assert.equal(analysed.insight.why,"Waarom.");assert.ok(analysed.score>story.score);
    assert.equal((await db.getGrowthItem(club.id))!.item.status,"rejected");
    await owner.query("UPDATE marketing_runs SET started_at=started_at-interval '2 minutes'");
    assert.equal((await db.runGrowthScan("manual",actor,{fetchImpl:fakeWeb().fetchImpl,fetcherOptions:fast,analyse:stub})).analysed,0,"unchanged items are not re-analysed (no extra cost)");
    assert.equal((await db.getGrowthItem(story.id))!.item.relevance,5,"AI factors survive refreshes");
    // CRM: status, follow-up, versioning, notes, history
    const v2=await db.updateGrowth(story.id,{status:"contact",followUpOn:day(2)},analysed.version,actor);
    await assert.rejects(()=>db.updateGrowth(story.id,{status:"won"},analysed.version,actor),marketing.VersionConflict);
    await db.updateGrowth(story.id,{category:"workshop"},v2,actor);
    await db.addGrowthNote(story.id,{body:"Gebeld met HR, terugbellen.",remindOn:day(3)},actor);
    const overview=await db.growthOverview();
    assert.equal(overview.follow_ups,1);assert.equal(overview.reminders.length,1);assert.equal(overview.events_30,1);assert.equal(overview.new_this_week,2);
    const detail=(await db.getGrowthItem(story.id))!;
    assert.equal(detail.item.category,"workshop");assert.equal(detail.item.category_locked,true);
    assert.deepEqual(new Set(detail.history.map(h=>h.event)),new Set(["discovered","analysed","status","follow_up","category","note"]));
    await db.completeGrowthNote(detail.notes[0].id,actor);assert.equal((await db.growthOverview()).reminders.length,0);
    // Drafts: template without AI, AI with a stub; nothing is sent
    delete process.env.ANTHROPIC_API_KEY;
    const template=await db.createGrowthDraft(story.id,{kind:"email"},actor);assert.equal(template.method,"template");
    process.env.ANTHROPIC_API_KEY="test-only";
    const ai=await db.createGrowthDraft(story.id,{kind:"proposal",instructions:"kort"},actor,async()=>({subject:"Voorstel",body:"Beste [naam],\n\nTekst.",costCents:3,model:"stub-model"}));assert.equal(ai.method,"ai");
    const drafts=(await db.getGrowthItem(story.id))!.drafts;assert.equal(drafts.length,2);
    const proposal=drafts.find(d=>d.kind==="proposal")!;
    const approved=await db.updateGrowthDraft(proposal.id,{status:"approved"},proposal.version,actor);
    await db.updateGrowthDraft(proposal.id,{body:"Aangepast"},approved,actor);
    assert.equal((await db.getGrowthItem(story.id))!.drafts.find(d=>d.id===proposal.id)!.status,"draft","editing an approved draft returns it to concept");
    assert.equal(await db.growthSpendThisMonth(),9);
    // Monitoring, digest, scheduling, privileges, retention
    assert.ok((await db.latestSourceChecks()).some(c=>!c.ok&&/robots/.test(c.error||"")));
    const digest=await db.weeklyDigestText();assert.match(digest.text,/vitaliteitsweek/);assert.match(digest.text,/geen berichten aan derden/);
    assert.equal((await db.runDueGrowthJobs()).scan,"not_due");
    await assert.rejects(()=>web.query("SELECT * FROM growth_opportunities"),"the public role has no growth access");
    await owner.query("UPDATE growth_opportunities SET status_changed_at=now()-interval '91 days' WHERE id=$1",[club.id]);
    await owner.query("UPDATE marketing_runs SET started_at=started_at-interval '2 minutes'");
    const purged=await db.runGrowthScan("manual",actor,{fetchImpl:fakeWeb().fetchImpl,fetcherOptions:fast,analyse:stub});
    assert.equal(purged.removed,1);assert.equal(await db.getGrowthItem(club.id),null,"rejected items are removed after 90 days");
  }finally{if(key)process.env.ANTHROPIC_API_KEY=key;else delete process.env.ANTHROPIC_API_KEY;await clean();await owner.query("UPDATE growth_settings SET settings='{}',version=1");await web.end();await owner.end();}
});
