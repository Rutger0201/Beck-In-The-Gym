import test from "node:test";
import assert from "node:assert/strict";
import { parseFeed,parseIcs,parseJsonLd,parseBrave,parseGoogleCse,type RawItem } from "../packages/core/src/growth/sources.ts";
import { parseRobots,robotsAllows } from "../packages/core/src/growth/robots.ts";
import { canonicalUrl,extractDate,redactContactDetails,similarity,stripHtml } from "../packages/core/src/growth/text.ts";
import { detectCategory,locate,screen } from "../packages/core/src/growth/classify.ts";
import { dedupe,prepare,planSources,rotateQueries,discover } from "../packages/core/src/growth/discovery.ts";
import { Fetcher,BlockedUrl,assertPublicHttps } from "../packages/core/src/growth/fetcher.ts";
import { opportunityScore,growthBreakdown } from "../packages/core/src/growth/scoring.ts";
import { distanceKm,homeBase,project,unproject,detectPlace,geographyFactor } from "../packages/core/src/growth/geo.ts";
import { templateDraft } from "../packages/core/src/growth/drafts.ts";
import { draftKinds } from "../packages/core/src/growth/labels.ts";
import { defaultGrowthSettings,growthSettingsRequestSchema,growthPatchSchema,growthDraftPatchSchema,readGrowthSettings } from "../packages/core/src/growth/validation.ts";
import { estimateCostCents,aiStatus } from "../packages/core/src/ai/claude.ts";

const now=new Date("2026-10-22T10:00:00Z"),today="2026-10-22";
const raw=(over:Partial<RawItem>={}):RawItem=>({sourceKind:"news",source:"Google News",title:"Vitaliteitsweek bij gemeente Almere voor medewerkers",summary:"",url:"https://example.nl/nieuws/vitaliteitsweek",publishedAt:new Date("2026-10-20T08:00:00Z"),startsOn:null,endsOn:null,locationText:null,lat:null,lon:null,organisation:null,query:"vitaliteitsweek Almere",...over});

test("RSS and Atom feeds are parsed, Google News publisher suffix removed",()=>{
  const xml=`<rss><channel><item><title>Sportdag voor bedrijven in Lelystad op 14 november - Omroep Flevoland</title><link>https://news.google.com/rss/articles/abc?oc=5</link><pubDate>Tue, 20 Oct 2026 08:00:00 GMT</pubDate><description>&lt;a href="x"&gt;Sportdag voor bedrijven in Lelystad op 14 november&lt;/a&gt; Omroep Flevoland</description><source url="https://www.omroepflevoland.nl">Omroep Flevoland</source></item>
    <item><title><![CDATA[Open dag &amp; clinic]]></title><link>https://club.nl/open-dag?utm_source=x</link></item></channel></rss>`;
  const items=parseFeed(xml,"news","Google News","sportdag Lelystad");
  assert.equal(items.length,2);
  assert.equal(items[0].title,"Sportdag voor bedrijven in Lelystad op 14 november");
  assert.equal(items[0].source,"Google News · Omroep Flevoland");
  assert.equal(items[0].summary,"","headline repeats are dropped");
  assert.equal(items[0].url,"https://news.google.com/rss/articles/abc","tracking parameters are removed");
  assert.equal(items[1].title,"Open dag & clinic");assert.equal(items[1].url,"https://club.nl/open-dag");
  const atom=parseFeed(`<feed><entry><title>Bootcamp in het park</title><link href="https://a.nl/b"/><updated>2026-10-01T00:00:00Z</updated><summary>Elke zaterdag</summary></entry></feed>`,"rss","a.nl");
  assert.equal(atom[0].url,"https://a.nl/b");assert.equal(atom[0].summary,"Elke zaterdag");
});
test("iCal events keep dates, location, geo and organiser",()=>{
  const ics="BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:42@club\r\nSUMMARY:Open dag atletiekvereniging\r\nDTSTART;TZID=Europe/Amsterdam:20261114T100000\r\nDTEND:20261114T160000\r\nLOCATION:Sportpark Fanny Blankers-Koen\\, Almere\r\nGEO:52.37;5.22\r\nORGANIZER;CN=\"AV Almere\":mailto:info@club.nl\r\nDESCRIPTION:Kom langs\\nen doe mee\r\n  aan clinics\r\nEND:VEVENT\r\nEND:VCALENDAR";
  const [event]=parseIcs(ics,"club.nl","https://club.nl/agenda.ics");
  assert.equal(event.startsOn,"2026-11-14");assert.equal(event.endsOn,"2026-11-14");
  assert.equal(event.locationText,"Sportpark Fanny Blankers-Koen, Almere");assert.equal(event.lat,52.37);assert.equal(event.lon,5.22);
  assert.equal(event.organisation,"AV Almere");assert.equal(event.summary,"Kom langs en doe mee aan clinics");
  assert.ok(event.url.startsWith("https://club.nl/agenda.ics#"));
});
test("schema.org JSON-LD events and sports clubs are extracted",()=>{
  const html=`<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"SportsEvent","name":"Almere City Run","startDate":"2026-11-29T09:00:00+01:00","url":"/run","location":{"@type":"Place","name":"Esplanade","address":{"addressLocality":"Almere"},"geo":{"latitude":52.371,"longitude":5.219}},"organizer":{"name":"Stichting Run"}},{"@type":"SportsClub","name":"Hockeyclub Lelystad","address":"Lelystad"},{"@type":"WebPage","name":"x"}]}</script><script type="application/ld+json">{broken</script>`;
  const items=parseJsonLd(html,"agenda.nl","https://agenda.nl/sport");
  assert.equal(items.length,2);
  assert.deepEqual([items[0].title,items[0].startsOn,items[0].url,items[0].organisation,items[0].lat],["Almere City Run","2026-11-29","https://agenda.nl/run","Stichting Run",52.371]);
  assert.equal(items[1].organisation,"Hockeyclub Lelystad");assert.equal(items[1].startsOn,null);
});
test("official search API responses are mapped",()=>{
  assert.equal(parseBrave({web:{results:[{title:"<b>Bedrijfsfitness</b> Almere",url:"https://b.nl",description:"x"}]}},"q")[0].title,"Bedrijfsfitness Almere");
  assert.equal(parseGoogleCse({items:[{title:"t1 t2 t3",link:"https://g.nl/a",snippet:"s"}]},"q")[0].url,"https://g.nl/a");
  assert.deepEqual(parseBrave({},"q"),[]);
});
test("robots.txt rules follow longest match and agent groups",()=>{
  const rules=parseRobots("User-agent: *\nDisallow: /private\nAllow: /private/agenda\nCrawl-delay: 2\n\nUser-agent: OtherBot\nDisallow: /","BITG-GrowthPipeline/1.0");
  assert.equal(robotsAllows(rules,"/agenda"),true);assert.equal(robotsAllows(rules,"/private/x"),false);assert.equal(robotsAllows(rules,"/private/agenda/1"),true);assert.equal(rules.crawlDelay,2);
  const specific=parseRobots("User-agent: *\nAllow: /\nUser-agent: BITG-GrowthPipeline\nDisallow: /","BITG-GrowthPipeline/1.0");
  assert.equal(robotsAllows(specific,"/"),false);
  assert.equal(robotsAllows(parseRobots("User-agent: *\nDisallow: /*.ics$","x"),"/agenda.ics"),false);
});
test("text helpers: canonical URLs, dates, redaction, similarity",()=>{
  assert.equal(canonicalUrl("http://www.Club.nl/a/?utm_medium=x&b=2&a=1#top"),"https://club.nl/a?a=1&b=2");
  assert.equal(canonicalUrl("javascript:alert(1)"),null);assert.equal(canonicalUrl("https://u:p@x.nl"),null);
  assert.equal(extractDate("Op zaterdag 14 november is de open dag",today),"2026-11-14");
  assert.equal(extractDate("Gehouden op 3 oktober",today),null,"past dates are ignored");
  assert.equal(extractDate("Inschrijven voor 10 januari",today.replace("10-22","12-20")),"2027-01-10","early next year");
  assert.equal(extractDate("Datum: 05-12-2026",today),"2026-12-05");
  assert.ok(!redactContactDetails("Mail jan@club.nl of bel 06-12345678").match(/jan@|12345678/));
  assert.ok(similarity("Sportdag voor bedrijven in Lelystad","Lelystad: sportdag voor bedrijven")>0.7);
  assert.ok(similarity("Sportdag Lelystad","Hardloopwedstrijd Almere")<0.2);
  assert.equal(stripHtml("<p>A &amp; B&#33;</p>"),"A & B!");
});
test("privacy screening drops personal profiles and health details of individuals",()=>{
  assert.equal(screen(raw({url:"https://linkedin.com/in/jan-jansen"})).keep,false);
  assert.equal(screen(raw({url:"https://instagram.com/p/abc"})).keep,false);
  assert.equal(screen(raw({url:"https://facebook.com/events/123"})).keep,true,"public Facebook events are allowed");
  assert.equal(screen(raw({title:"Ik zoek een personal trainer na mijn burn-out in Almere"})).keep,false);
  assert.equal(screen(raw({title:"KWF loop tegen kanker in Almere"})).keep,true,"events about health causes stay");
});
test("classification, location and geography",()=>{
  assert.equal(detectCategory(raw()),"corporate");
  assert.equal(detectCategory(raw({title:"Hockeyclub zoekt trainer voor krachttraining",query:null})),"partnership");
  assert.equal(detectCategory(raw({sourceKind:"ical",title:"Workshop kettlebell"})),"workshop");
  assert.equal(detectPlace("Open dag in Almere Haven")?.name,"Almere Haven");
  const located=locate(raw({title:"Sportdag in Lelystad"}));
  assert.equal(located.place,"Lelystad");assert.equal(located.precision,"place");assert.ok(located.distanceKm!>20&&located.distanceKm!<30);
  assert.equal(locate(raw({lat:52.37,lon:5.22})).precision,"exact");
  assert.equal(locate(raw({lat:48.85,lon:2.35,title:"Parijs"})).precision,null,"coordinates outside NL are ignored");
  assert.equal(geographyFactor(5,40),5);assert.equal(geographyFactor(null,40),2);assert.equal(geographyFactor(200,40),1);
  assert.ok(Math.abs(distanceKm(homeBase,{lat:52.5185,lon:5.4714})-23)<2);
  const p=project({lat:52.35,lon:5.26},10),back=unproject(p,10);
  assert.ok(Math.abs(back.lat-52.35)<1e-9&&Math.abs(back.lon-5.26)<1e-9);
});
test("Opportunity Score is a weighted 0-100 scale with six visible factors",()=>{
  assert.equal(opportunityScore({relevance:1,value:1,geography:1,likelihood:1,urgency:1,reliability:1}),0);
  assert.equal(opportunityScore({relevance:5,value:5,geography:5,likelihood:5,urgency:5,reliability:5}),100);
  assert.ok(opportunityScore({relevance:5,value:3,geography:3,likelihood:3,urgency:3,reliability:3})>opportunityScore({relevance:3,value:3,geography:3,likelihood:3,urgency:5,reliability:3}));
  assert.equal(growthBreakdown({relevance:5,value:4,geography:3,likelihood:2,urgency:1,reliability:9}).at(-1)!.value,5);
});
test("processing deduplicates, drops ended or distant items and scores the rest",()=>{
  const items=[raw(),raw({url:"https://other.nl/vitaliteit",title:"Vitaliteitsweek gemeente Almere voor medewerkers"}),raw({url:"https://x.nl/oud",title:"Sportdag Almere",startsOn:"2026-09-01",endsOn:"2026-09-01"}),
    raw({url:"https://x.nl/ver",title:"Sportdag in Zwolle",query:null}),raw({url:"https://x.nl/maastricht",title:"Bootcamp",lat:50.85,lon:5.69}),raw({url:"https://linkedin.com/in/someone",title:"Coach"})];
  const settings={...defaultGrowthSettings,maxDistanceKm:15};
  const result=prepare(items,settings,now);
  assert.equal(result.screened,1);assert.equal(result.duplicates,1);assert.equal(result.outdated,1);assert.equal(result.distant,2);
  assert.equal(result.candidates.length,1);
  const [candidate]=result.candidates;
  assert.equal(candidate.sources.length,2,"the duplicate URL is kept as 'also seen'");
  assert.match(candidate.fingerprint,/^[0-9a-f]{64}$/);assert.ok(candidate.score>=0&&candidate.score<=100);
  assert.equal(candidate.insight.valueEstimate,null,"rules never estimate a value");
  assert.equal(dedupe([raw(),raw()]).duplicates,1);
});
test("query rotation covers all combinations over consecutive days",()=>{
  const settings={...defaultGrowthSettings,searchTerms:["a","b","c"],regions:["X","Y"],maxQueriesPerRun:4};
  const seen=new Set<string>();for(let day=0;day<3;day++)for(const q of rotateQueries(settings,new Date(now.getTime()+day*86400000)))seen.add(q);
  assert.equal(seen.size,6);
  const {jobs,inactive}=planSources({...settings,sources:{news:true,brave:true,googleCse:false}},{},now);
  assert.equal(jobs.length,4);assert.deepEqual(inactive.map(i=>i.kind),["brave"],"missing keys are reported, not silently skipped");
});
const response=(body:string,status=200,headers:Record<string,string>={})=>new Response(body,{status,headers});
test("fetcher: HTTPS only, no private hosts, robots.txt respected, retries with backoff",async()=>{
  assert.throws(()=>assertPublicHttps("http://club.nl"),BlockedUrl);
  for(const host of ["https://localhost/x","https://127.0.0.1/","https://10.1.2.3/","https://192.168.1.1/","https://[::1]/","https://intranet/"])assert.throws(()=>assertPublicHttps(host),BlockedUrl,host);
  const calls:string[]=[];let attempts=0;
  const fake=async(url:string)=>{calls.push(url);if(url.endsWith("/robots.txt"))return response("User-agent: *\nDisallow: /geheim");if(url.includes("/flaky")){attempts++;return attempts<3?response("busy",503):response("ok");}if(url.includes("/redirect"))return response("",302,{location:"http://insecure.nl/"});return response("hello");};
  const fetcher=new Fetcher(fake,{minIntervalMs:0,backoffMs:1});
  assert.equal(await fetcher.text("https://club.nl/agenda"),"hello");
  await assert.rejects(()=>fetcher.text("https://club.nl/geheim/x"),BlockedUrl);
  assert.equal(await fetcher.text("https://club.nl/flaky"),"ok");assert.equal(attempts,3);
  await assert.rejects(()=>fetcher.text("https://club.nl/redirect"),BlockedUrl,"redirects to http are refused");
  assert.equal(calls.filter(c=>c.endsWith("/robots.txt")).length,1,"robots.txt is cached per origin");
  const api=new Fetcher(async url=>{calls.push(url);return response("{}");},{minIntervalMs:0});
  await api.text("https://api.search.brave.com/x",{crawl:false});assert.ok(!calls.includes("https://api.search.brave.com/robots.txt"));
  const failing=new Fetcher(async()=>response("nope",404),{minIntervalMs:0,backoffMs:1});
  const run=await discover([{key:"a",kind:"rss",label:"A",run:f=>f.text("https://a.nl/feed").then(()=>[])}],failing,Date.now()+5000);
  assert.equal(run.results[0].ok,false);assert.match(run.results[0].error!,/404/);
});
test("template drafts never invent contact details, prices or results",()=>{
  for(const kind of draftKinds){
    const draft=templateDraft({kind,title:"Vitaliteitsweek gemeente",organisation:null,category:"corporate",place:"Almere",date:"2026-11-14",why:"Reden.",nextStep:"Stap.",url:"https://x.nl"});
    assert.ok(draft.subject.length>3&&draft.body.length>40,kind);
    assert.ok(!/@|€|\b06[-\s]?\d|gegarandeerd|resultaat gegarandeerd/i.test(draft.body),kind);
  }
  assert.ok(templateDraft({kind:"email",title:"t",organisation:null,category:"event",place:null,date:null,why:"",nextStep:"",url:"https://x.nl"}).body.includes("[naam contactpersoon]"));
});
test("settings and CRM validation refuse auto-sending and unsafe sources",()=>{
  const settings={...defaultGrowthSettings};
  assert.equal(growthSettingsRequestSchema.safeParse({expectedVersion:1,settings}).success,true);
  assert.equal(growthSettingsRequestSchema.safeParse({expectedVersion:1,settings:{...settings,autoSend:true}}).success,false);
  assert.equal(growthSettingsRequestSchema.safeParse({expectedVersion:1,settings:{...settings,rssFeeds:["http://x.nl/rss"]}}).success,false);
  assert.equal(growthPatchSchema.safeParse({expectedVersion:1,status:"won"}).success,true);
  assert.equal(growthPatchSchema.safeParse({expectedVersion:1}).success,false);
  assert.equal(growthPatchSchema.safeParse({expectedVersion:1,followUpOn:null}).success,true,"a follow-up date can be cleared");
  assert.equal(growthDraftPatchSchema.safeParse({expectedVersion:1,status:"sent"}).success,false);
  assert.equal(readGrowthSettings({sources:{brave:true}}).sources.news,true);assert.equal(readGrowthSettings(null).regions[0],"Almere");
});
test("AI is optional and costed",()=>{
  const key=process.env.ANTHROPIC_API_KEY;delete process.env.ANTHROPIC_API_KEY;
  assert.equal(aiStatus().configured,false);
  if(key)process.env.ANTHROPIC_API_KEY=key;
  assert.equal(estimateCostCents("claude-opus-5-5",1_000_000,0),360);
  assert.ok(estimateCostCents("claude-opus-5-5",1500,400)>=1);
});
