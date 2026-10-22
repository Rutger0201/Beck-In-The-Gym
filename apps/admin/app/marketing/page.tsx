import Link from "next/link";
import { listOpportunities,listCalendar,listResearch,listRuns,leadSignals } from "@bitg/database/marketing";
import { addDays,formatDate,localDate,startOfWeek } from "@bitg/core/marketing/dates";
import { channelLabels,calendarStatusLabels,integrations,researchKindLabels,type ResearchKind } from "@bitg/core/marketing/labels";
import { summariseLeads,weeklyLeadCounts } from "@bitg/core/marketing/leads";
import { ActionButton } from "../../components/ActionButton";
import { LeadChart } from "../../components/LeadChart";
import { ScoreBadge } from "../../components/ScoreBadge";
export const dynamic="force-dynamic";
// Illustration only, rendered with a visible "Voorbeeld" label until analytics is connected.
const demoVisits=[42,51,47,60,58,66,71,64,79,83,77,90];
export default async function MarketingOverview(){
  const now=new Date(),today=localDate(now),week=startOfWeek(today);
  const [opportunities,calendar,research,runs,leads]=await Promise.all([listOpportunities(),listCalendar(addDays(today,-30),addDays(today,30)),listResearch(12),listRuns(1),leadSignals()]);
  const open=opportunities.filter(o=>o.status==="open"),top=open.slice(0,5),actions=open.slice(0,3);
  const thisWeek=calendar.filter(item=>item.scheduled_for>=week&&item.scheduled_for<=addDays(week,6)&&item.status!=="rejected");
  const drafts=calendar.filter(item=>item.status==="draft"&&item.scheduled_for>=today);
  const approved=calendar.filter(item=>item.status==="approved"&&item.scheduled_for>=today),published=calendar.filter(item=>item.status==="published");
  const fresh=research.filter(item=>now.getTime()-new Date(item.first_seen_at).getTime()<7*86400000);
  const month=summariseLeads(leads,now,30),weeks=weeklyLeadCounts(leads,now,8),last=runs[0];
  const max=Math.max(...demoVisits);
  return <>
    <div className="mk-head"><div><p className="eyebrow">AI MARKETING MANAGER</p><h1>Marketing.</h1><p>{last?`Laatste research: ${new Date(last.started_at).toLocaleString("nl-NL",{timeZone:"Europe/Amsterdam",dateStyle:"medium",timeStyle:"short"})} · ${last.status==="succeeded"?"geslaagd":last.status==="running"?"loopt":"mislukt"}`:"Nog geen research uitgevoerd."}</p></div>
      <div className="btn-row"><ActionButton url="/api/v1/admin/marketing/research" label="Research nu uitvoeren" busyLabel="Bezig met research…" done="{opportunities} kansen bijgewerkt, {added} nieuwe signalen."/></div></div>
    <div className="mk-grid">
      <section className="mk-card span-3 kpi"><span className="label">Aanvragen · 30 dagen</span><span className="value">{month.total}</span><span className="note">{month.byQuality.concrete} concreet · <span className="tag real">Echte data</span></span></section>
      <section className="mk-card span-3 kpi"><span className="label">Open kansen</span><span className="value">{open.length}</span><span className="note">{top[0]?`Hoogste score ${top[0].score}`:"Voer research uit om kansen te vinden"}</span></section>
      <section className="mk-card span-3 kpi"><span className="label">Wacht op goedkeuring</span><span className="value">{drafts.length}</span><span className="note"><Link className="inline" href="/marketing/kalender">Naar de kalender</Link></span></section>
      <section className="mk-card span-3 kpi"><span className="label">Goedgekeurd · komend</span><span className="value">{approved.length}</span><span className="note">{published.length} gepubliceerd (laatste 30 dagen)</span></section>

      <section className="mk-card span-7"><h2>Beste kansen voor de komende 30 dagen</h2><p className="sub muted">Gerangschikt op relevantie, impact, uitvoerbaarheid en kosten.</p>
        {top.length?<ul className="list">{top.map(o=><li key={o.id}><ScoreBadge score={o.score}/><div className="grow"><p className="title">{o.title}</p><p className="meta">{channelLabels[o.channel]} · ±{o.effort_minutes} min · {o.cost_max_eur?`€${o.cost_min_eur}–${o.cost_max_eur}`:"geen kosten"}</p></div></li>)}</ul>:<div className="empty-mk"><p>Nog geen kansen. Start de eerste research om kansen te verzamelen en te scoren.</p></div>}
        <p className="small" style={{marginBottom:0}}><Link className="inline" href="/marketing/kansen">Alle kansen en onderbouwing →</Link></p></section>
      <section className="mk-card span-5"><h2>Prioriteiten deze week</h2><p className="sub muted">Week van {formatDate(week,{day:"numeric",month:"long"})}</p>
        {thisWeek.length?<ul className="list">{thisWeek.map(item=><li key={item.id}><div className="grow"><p className="title">{item.title}</p><p className="meta">{formatDate(item.scheduled_for)} · {channelLabels[item.channel]}</p></div><span className={`tag status-${item.status}`}>{calendarStatusLabels[item.status]}</span></li>)}</ul>:<div className="empty-mk"><p>Nog niets gepland deze week.</p><ActionButton url="/api/v1/admin/marketing/plan" label="Maak 30-dagenplanning" busyLabel="Planning maken…" secondary done="{planned} conceptberichten gepland."/></div>}
        {actions.length>0&&<><p className="eyebrow" style={{margin:"16px 0 4px"}}>DRIE BELANGRIJKSTE ACTIES</p><ol className="rationale" style={{color:"var(--text)"}}>{actions.map(o=><li key={o.id}>{o.action}</li>)}</ol></>}</section>

      <section className="mk-card span-6"><h2>Leads en kwaliteit</h2><p className="sub muted">Contactaanvragen per week, ingedeeld met een transparante vuistregel (keuze begeleidingsvorm, toelichting, telefoonnummer). <span className="tag real">Echte data</span></p><LeadChart weeks={weeks}/>
        <p className="small muted" style={{margin:"8px 0 0"}}>Koppeling aan specifieke marketingacties volgt met UTM-links en analytics (fase 5). Er worden geen namen of berichten geanalyseerd.</p></section>
      <section className="mk-card span-6"><h2>Nieuwe trends en signalen</h2><p className="sub muted">Uit de researchpipeline. Externe trendbronnen worden gekoppeld in fase 5.</p>
        {research.length?<ul className="list">{(fresh.length?fresh:research).slice(0,6).map(item=><li key={item.id}><div className="grow"><p className="title">{item.title}</p><p className="meta">{researchKindLabels[item.kind as ResearchKind]||item.kind} · {item.source}</p></div>{item.is_demo&&<span className="tag demo">Voorbeeld</span>}</li>)}</ul>:<div className="empty-mk"><p>Nog geen signalen verzameld.</p></div>}</section>

      <section className="mk-card span-6"><h2>Wacht op goedkeuring</h2><p className="sub muted">Concepten worden nooit automatisch gepubliceerd.</p>
        {drafts.length?<ul className="list">{drafts.slice(0,6).map(item=><li key={item.id}><div className="grow"><p className="title">{item.title}</p><p className="meta">{formatDate(item.scheduled_for)} · {channelLabels[item.channel]}</p></div></li>)}</ul>:<div className="empty-mk"><p>Geen concepten die wachten.</p></div>}</section>
      <section className="mk-card span-6"><h2>Gepland en gepubliceerd</h2><p className="sub muted">Goedgekeurde en handmatig gepubliceerde berichten.</p>
        {approved.length+published.length?<ul className="list">{[...approved,...published].slice(0,6).map(item=><li key={item.id}><div className="grow"><p className="title">{item.title}</p><p className="meta">{formatDate(item.scheduled_for)} · {channelLabels[item.channel]}</p></div><span className={`tag status-${item.status}`}>{calendarStatusLabels[item.status]}</span></li>)}</ul>:<div className="empty-mk"><p>Nog niets goedgekeurd.</p></div>}</section>

      <section className="mk-card span-12"><h2>Marketingresultaten</h2><p className="sub muted">Bereik, bezoek en campagnecijfers verschijnen zodra de bronnen gekoppeld zijn. Tot die tijd worden er geen cijfers geschat.</p>
        <div className="mk-grid"><div className="span-8"><div className="integrations">{integrations.map(i=><div key={i.id}><strong>{i.name}</strong><span>{i.detail}</span><br/><span className="tag" style={{marginTop:8}}>Niet gekoppeld · fase {i.phase}</span></div>)}</div></div>
          <figure className="span-4" style={{margin:0}} aria-label="Voorbeeldgrafiek websitebezoek, geen echte data"><div className="btn-row" style={{justifyContent:"space-between"}}><strong className="small">Websitebezoek per week</strong><span className="tag demo">Voorbeeld · geen echte data</span></div>
            <svg className="chart" viewBox="0 0 240 70" aria-hidden="true">{demoVisits.map((v,i)=><rect key={i} x={i*20+4} y={66-v/max*60} width={12} height={v/max*60} rx={2} fill="var(--q4)"/>)}</svg>
            <figcaption className="small muted">Zo ziet deze grafiek eruit na koppeling van analytics.</figcaption></figure></div></section>
    </div>
  </>;
}
