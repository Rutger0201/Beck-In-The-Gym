import test from "node:test";
import assert from "node:assert/strict";
import { priorityScore,scoreBreakdown,expectedImpact,clampFactor } from "../packages/core/src/marketing/scoring.ts";
import { collectResearch,deriveOpportunities,fingerprint,dedupeResearch } from "../packages/core/src/marketing/research.ts";
import { planCalendar,alternativeIdea } from "../packages/core/src/marketing/planner.ts";
import { classifyLead,weeklyLeadCounts,summariseLeads,type LeadSignal } from "../packages/core/src/marketing/leads.ts";
import { addDays,isoWeekday,localDate,startOfWeek,isValidDate,addMonths } from "../packages/core/src/marketing/dates.ts";
import { themes } from "../packages/core/src/marketing/library.ts";
import { calendarPatchSchema,opportunityPatchSchema,readSettings,settingsRequestSchema } from "../packages/core/src/marketing/validation.ts";
import { paidChannels } from "../packages/core/src/marketing/labels.ts";

const now=new Date("2026-10-22T10:00:00Z");
const lead=(over:Partial<LeadSignal>={}):LeadSignal=>({goal:"muscle",format:null,experience:null,hasPhone:false,messageLength:0,hasQuestion:false,createdAt:now,...over});

test("priority score is a transparent weighted 1-100 scale",()=>{
  assert.equal(priorityScore({relevance:1,impact:1,feasibility:1,cost:1}),1);
  assert.equal(priorityScore({relevance:5,impact:5,feasibility:5,cost:5}),100);
  assert.ok(priorityScore({relevance:5,impact:3,feasibility:3,cost:3})>priorityScore({relevance:3,impact:3,feasibility:3,cost:5}),"relevance weighs more than cost");
  assert.deepEqual(scoreBreakdown({relevance:5,impact:4,feasibility:3,cost:2}).map(p=>p.value),[5,4,3,2]);
  assert.equal(clampFactor(9),5);assert.throws(()=>clampFactor(Number.NaN));
  assert.equal(expectedImpact({relevance:5,impact:5,feasibility:5,cost:5}).confidence,"laag","no measurements means low confidence");
});
test("research is deduplicated and never invents trend data",()=>{
  const items=collectResearch({now});
  assert.equal(new Set(items.map(i=>i.fingerprint)).size,items.length);
  assert.ok(items.every(i=>i.kind!=="trend"&&i.kind!=="competitor"),"trend sources are not connected yet");
  assert.ok(items.some(i=>i.kind==="seasonal"),"October has a seasonal window");
  assert.equal(fingerprint("theme","Squat"),fingerprint("THEME","squat "));
  assert.equal(dedupeResearch([...items,...items]).length,items.length);
  assert.ok(items.every(i=>i.expiresAt>now));
});
test("lead signals only appear with enough real requests",()=>{
  assert.ok(!collectResearch({now,leads:[lead(),lead()]}).some(i=>i.kind==="performance"));
  const items=collectResearch({now,leads:[lead(),lead(),lead({goal:"strength"})]});
  const signal=items.find(i=>i.kind==="performance");
  assert.ok(signal&&signal.title.includes("spieropbouw")&&signal.summary.startsWith("2 van de 3"));
  const boosted=deriveOpportunities(items,{now}).find(o=>o.category==="progress"&&o.rationale.join(" ").includes("recente aanvragen"));
  assert.ok(boosted,"matching themes are boosted with an explanation");
});
test("monthly selection holds 10-20 ranked, explained opportunities",()=>{
  const drafts=deriveOpportunities(collectResearch({now}),{now});
  assert.ok(drafts.length>=10&&drafts.length<=20);
  for(let i=1;i<drafts.length;i++)assert.ok(drafts[i-1].score>=drafts[i].score);
  for(const draft of drafts){assert.equal(draft.rationale.length,4);assert.ok(draft.action.length>10);assert.ok(draft.score>=1&&draft.score<=100);assert.ok(draft.brief.cta.includes("contactformulier"));}
});
test("library copy keeps BITG's product boundaries",()=>{
  const copy=JSON.stringify(themes).toLowerCase();
  for(const banned of ["€ per","tarief:","boek nu","gegarandeerd","binnen 30 dagen","voor en na"])assert.ok(!copy.includes(banned),banned);
  assert.ok(themes.filter(t=>paidChannels.includes(t.channel)).every(t=>t.action.includes("akkoord")),"paid actions require approval");
});
test("30-day plan is realistic, varied and never includes paid campaigns",()=>{
  const candidates=deriveOpportunities(collectResearch({now}),{now}).map(o=>({...o,opportunityId:null}));
  const plan=planCalendar({start:"2026-10-26",candidates,settings:{postsPerWeek:3,weeklyMinutes:180}});
  assert.ok(plan.length>=8&&plan.length<=13);
  assert.ok(plan.every(p=>[1,3,5].includes(isoWeekday(p.scheduledFor))));
  assert.ok(plan.every(p=>!paidChannels.includes(p.channel)&&p.channel!=="partnership"));
  assert.equal(new Set(plan.map(p=>p.title)).size,plan.length);
  const weeks=new Map<string,number>();for(const p of plan)weeks.set(startOfWeek(p.scheduledFor),(weeks.get(startOfWeek(p.scheduledFor))||0)+p.effortMinutes);
  assert.ok([...weeks.values()].every(m=>m<=180),"weekly time budget holds");
  for(let i=1;i<plan.length;i++)assert.ok(plan[i].category!==plan[i-1].category||plan[i].title!==plan[i-1].title);
  assert.ok(new Set(plan.map(p=>p.category)).size>=5,"categories alternate");
  assert.ok(plan.filter(p=>p.category==="promotion").length<=2);
  const kept=planCalendar({start:"2026-10-26",candidates,occupied:new Map([["2026-10-26",45]])});
  assert.ok(!kept.some(p=>p.scheduledFor==="2026-10-26"),"approved items keep their day");
  const other=alternativeIdea(plan[0],candidates,plan.map(p=>p.title));
  assert.ok(other&&other.title!==plan[0].title&&!plan.some(p=>p.title===other.title));
});
test("lead quality heuristic distinguishes the four groups",()=>{
  assert.equal(classifyLead(lead({format:"one",messageLength:80})),"concrete");
  assert.equal(classifyLead(lead({format:"duo",hasPhone:true})),"concrete");
  assert.equal(classifyLead(lead({experience:"beginner"})),"prospect");
  assert.equal(classifyLead(lead({goal:"unsure"})),"info");
  assert.equal(classifyLead(lead()),"general");
  const weeks=weeklyLeadCounts([lead(),lead({createdAt:new Date("2026-10-13T10:00:00Z"),format:"one",hasPhone:true}),lead({createdAt:new Date("2025-01-01")})],now,4);
  assert.equal(weeks.length,4);assert.equal(weeks.at(-1)!.total,1);assert.equal(weeks.at(-2)!.concrete,1);
  assert.equal(summariseLeads([lead(),lead({createdAt:new Date("2026-01-01")})],now,30).total,1);
});
test("calendar dates are timezone-safe",()=>{
  assert.equal(localDate(new Date("2026-10-24T22:30:00Z")),"2026-10-25");
  assert.equal(addDays("2026-10-31",1),"2026-11-01");assert.equal(isoWeekday("2026-10-25"),7);assert.equal(startOfWeek("2026-10-25"),"2026-10-19");
  assert.equal(addMonths("2026-12-15",1),"2027-01-01");assert.equal(isValidDate("2026-02-30"),false);
});
test("marketing input validation rejects scheduling and auto-publishing tricks",()=>{
  assert.equal(calendarPatchSchema.safeParse({expectedVersion:1,status:"approved"}).success,true);
  assert.equal(calendarPatchSchema.safeParse({expectedVersion:1,status:"scheduled"}).success,false);
  assert.equal(calendarPatchSchema.safeParse({expectedVersion:1}).success,false);
  assert.equal(calendarPatchSchema.safeParse({expectedVersion:1,scheduledFor:"2026-13-01"}).success,false);
  assert.equal(calendarPatchSchema.safeParse({expectedVersion:1,title:"ok title",extra:1}).success,false);
  assert.equal(opportunityPatchSchema.safeParse({expectedVersion:1,planFor:"2026-11-02"}).success,true);
  assert.equal(settingsRequestSchema.safeParse({expectedVersion:1,settings:{postsPerWeek:3,weeklyMinutes:180,region:"Almere",researchEveryDays:1,autoPublish:true}}).success,false);
  assert.equal(readSettings({postsPerWeek:9}).postsPerWeek,3);assert.equal(readSettings(null).region,"Almere");
});
