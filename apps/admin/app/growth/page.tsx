import Link from "next/link";
import { growthOverview,listGrowth,listGrowthRuns,latestSourceChecks,growthSpendThisMonth,getGrowthSettings } from "@bitg/database/growth";
import { aiStatus } from "@bitg/core/ai/claude";
import { activeStatuses,growthCategoryLabels } from "@bitg/core/growth/labels";
import { promisingScore } from "@bitg/core/growth/scoring";
import { addDays,formatDate,localDate } from "@bitg/core/marketing/dates";
import { ActionButton } from "../../components/ActionButton";
import { GrowthScore,MethodTag } from "../../components/GrowthFeed";
import { OpportunityMap,type MapPoint } from "../../components/OpportunityMap";
export const dynamic="force-dynamic";
const stamp=(value:string)=>new Date(value).toLocaleString("nl-NL",{timeZone:"Europe/Amsterdam",dateStyle:"medium",timeStyle:"short"});
export default async function GrowthOverview(){
  const today=localDate();
  const [overview,items,runs,checks,spent,{settings}]=await Promise.all([growthOverview(),listGrowth(),listGrowthRuns(1),latestSourceChecks(),growthSpendThisMonth(),getGrowthSettings()]);
  const ai=aiStatus(),last=runs.find(run=>run.job==="growth"),active=items.filter(i=>activeStatuses.includes(i.status));
  const promising=active.filter(i=>i.score>=promisingScore).slice(0,6);
  const events=active.filter(i=>(i.category==="event"||i.category==="workshop")&&i.event_date&&i.event_date>=today&&i.event_date<=addDays(today,30)).sort((a,b)=>a.event_date!.localeCompare(b.event_date!)).slice(0,8);
  const followUps=active.filter(i=>i.follow_up_on&&i.follow_up_on<=addDays(today,7)).sort((a,b)=>a.follow_up_on!.localeCompare(b.follow_up_on!)).slice(0,8);
  const points:MapPoint[]=active.filter(i=>i.lat!==null&&i.lon!==null&&i.geo_precision).map(i=>({id:i.id,title:i.title,lat:i.lat!,lon:i.lon!,score:i.score,category:i.category,precision:i.geo_precision!,place:i.place,date:i.event_date}));
  const failing=checks.filter(c=>!c.ok);
  return <>
    <div className="mk-head"><div><p className="eyebrow">BITG · ADMIN · GROWTH PIPELINE</p><h1>Growth Pipeline.</h1>
      <p>{last?`Laatste scan: ${stamp(last.started_at)} · ${last.status==="succeeded"?`geslaagd, ${last.stats.added??0} nieuw en ${last.stats.updated??0} bijgewerkt`:last.status==="running"?"loopt nog":`mislukt (${last.error||"onbekende fout"})`}`:"Nog geen scan uitgevoerd."}</p>
      <p className="small">{ai.configured?<><span className="tag real">AI-analyse actief</span> {ai.model} · €{(spent/100).toFixed(2).replace(".",",")} van €{(settings.monthlyAiBudgetCents/100).toFixed(0)} deze maand</>:<><span className="tag">Regelgebaseerd</span> AI is niet gekoppeld; kansen worden beoordeeld met transparante vuistregels.</>}</p></div>
      <div className="btn-row"><ActionButton url="/api/v1/admin/growth/scan" label="Nu scannen" busyLabel="Bezig met scannen… (tot 1,5 minuut)" done="{added} nieuwe kansen, {updated} bijgewerkt, {duplicates} dubbelingen samengevoegd, {sourceErrors} bronnen met fouten."/></div></div>
    {failing.length>0&&<p role="alert">{failing.length} {failing.length===1?"bron gaf":"bronnen gaven"} bij de laatste controle een fout. <Link className="inline" href="/growth/instellingen">Bekijk de bronstatus</Link>.</p>}
    <div className="g-kpis">
      <section className="mk-card kpi g-kpi"><span className="label">Nieuw deze week</span><span className="value">{overview.new_this_week}</span><span className="note">kansen gevonden</span></section>
      <section className="mk-card kpi g-kpi"><span className="label">Kansrijke leads</span><span className="value">{overview.promising}</span><span className="note">score {promisingScore}+ en lopend</span></section>
      <section className="mk-card kpi g-kpi"><span className="label">Evenementen · 30 dagen</span><span className="value">{overview.events_30}</span><span className="note">met bekende datum</span></section>
      <section className="mk-card kpi g-kpi"><span className="label">Samenwerkingen</span><span className="value">{overview.partnerships}</span><span className="note">bedrijven en sportorganisaties</span></section>
      <section className="mk-card kpi g-kpi"><span className="label">Opvolgacties</span><span className="value">{overview.follow_ups}</span><span className="note">{overview.overdue?`${overview.overdue} verlopen · `:""}komende 7 dagen</span></section>
    </div>
    <div className="mk-grid">
      <section className="mk-card span-7"><h2>Kansenkaart</h2><p className="sub muted">Alleen lopende kansen met een verifieerbare locatie uit de bron, via PDOK of op plaatsniveau.</p><OpportunityMap points={points}/></section>
      <section className="mk-card span-5"><h2>Kansrijke leads</h2><p className="sub muted">Hoogste Opportunity Scores die nog lopen.</p>
        {promising.length?<ul className="list">{promising.map(i=><li key={i.id}><GrowthScore score={i.score}/><div className="grow"><p className="title"><Link href={`/growth/${i.id}`}>{i.title}</Link></p><p className="meta">{growthCategoryLabels[i.category]}{i.place?` · ${i.place}`:""} · <MethodTag method={i.analysis_method}/></p></div></li>)}</ul>:<div className="empty-mk"><p>Nog geen kansen met een score van {promisingScore} of hoger.</p></div>}
        <p className="small" style={{marginBottom:0}}><Link className="inline" href="/growth/kansen">Alle kansen in de feed →</Link></p></section>

      <section className="mk-card span-6"><h2>Sportevenementen komende 30 dagen</h2><p className="sub muted">Overweeg een stand, demonstratie of samenwerking.</p>
        {events.length?<ul className="list">{events.map(i=><li key={i.id}><div className="date-chip"><strong>{formatDate(i.event_date!,{day:"numeric"})}</strong><span>{formatDate(i.event_date!,{month:"short"})}</span></div><div className="grow"><p className="title"><Link href={`/growth/${i.id}`}>{i.title}</Link></p><p className="meta">{i.place||"Locatie onbekend"} · score {i.score}</p></div></li>)}</ul>:<div className="empty-mk"><p>Geen evenementen met een datum in de komende 30 dagen. Voeg evenementenkalenders toe bij Bronnen voor meer dekking.</p></div>}</section>
      <section className="mk-card span-6"><h2>Openstaande opvolgacties</h2><p className="sub muted">Opvolgdatums en herinneringen tot en met volgende week.</p>
        {followUps.length+overview.reminders.length?<ul className="list">{followUps.map(i=><li key={i.id}><div className="grow"><p className="title"><Link href={`/growth/${i.id}`}>{i.title}</Link></p><p className="meta">Opvolgen {formatDate(i.follow_up_on!,{weekday:"short",day:"numeric",month:"short"})}{i.follow_up_on!<today?" · verlopen":""}</p></div></li>)}
          {overview.reminders.map(r=><li key={r.id}><div className="grow"><p className="title"><Link href={`/growth/${r.opportunity_id}`}>{r.title}</Link></p><p className="meta">Herinnering {formatDate(r.remind_on,{weekday:"short",day:"numeric",month:"short"})}: {r.body.slice(0,90)}{r.body.length>90?"…":""}</p></div></li>)}</ul>:<div className="empty-mk"><p>Geen opvolgacties gepland. Zet een opvolgdatum bij een kans in de CRM.</p></div>}</section>
    </div>
  </>;
}
