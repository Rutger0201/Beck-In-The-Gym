import Link from "next/link";
import { notFound } from "next/navigation";
import { getGrowthItem } from "@bitg/database/growth";
import { aiStatus } from "@bitg/core/ai/claude";
import { geoPrecisionLabels,growthCategoryLabels,growthStatusLabels,sourceKindLabels,type GrowthStatus,type SourceKind } from "@bitg/core/growth/labels";
import { growthBreakdown,growthWeights } from "@bitg/core/growth/scoring";
import { formatDate,localDate } from "@bitg/core/marketing/dates";
import { GrowthScore,MethodTag } from "../../../components/GrowthFeed";
import { GrowthAssistant,GrowthCrm,GrowthNotes } from "../../../components/GrowthDetail";
export const dynamic="force-dynamic";
const events:Record<string,string>={discovered:"Gevonden",refreshed:"Bron gewijzigd en bijgewerkt",analysed:"Beoordeeld door AI",ai_dismissed:"Door AI als niet relevant afgewezen",status:"Status gewijzigd",category:"Categorie aangepast",follow_up:"Opvolgdatum gewijzigd",note:"Notitie toegevoegd",reminder_done:"Herinnering afgerond",draft:"Concept gemaakt",draft_status:"Conceptstatus gewijzigd"};
const stamp=(value:string)=>new Date(value).toLocaleString("nl-NL",{timeZone:"Europe/Amsterdam",dateStyle:"medium",timeStyle:"short"});
export default async function Opportunity({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))notFound();
  const found=await getGrowthItem(id);if(!found)notFound();
  const {item,notes,drafts,history}=found,today=localDate();
  return <>
    <p className="small" style={{margin:"0 0 12px"}}><Link className="inline" href="/growth/kansen">← Terug naar de feed</Link></p>
    <div className="mk-head"><div className="btn-row" style={{alignItems:"flex-start",flexWrap:"nowrap",gap:16}}><GrowthScore score={item.score} big/><div><p className="eyebrow">{growthCategoryLabels[item.category].toUpperCase()} · {growthStatusLabels[item.status].toUpperCase()}</p><h1 className="g-title">{item.title}</h1>{item.organisation&&item.organisation!==item.title&&<p>{item.organisation}</p>}</div></div></div>
    <div className="mk-grid">
      <section className="mk-card span-7"><h2>AI-samenvatting en advies</h2><p className="sub muted"><MethodTag method={item.analysis_method}/> {item.analysis_method==="ai"?`Beoordeeld met ${item.analysis_model}.`:"Beoordeeld met vaste vuistregels; zodra AI gekoppeld is volgt een inhoudelijke analyse."}{item.is_demo&&<> <span className="tag demo">Demo</span></>}</p>
        <dl className="facts insight"><dt>Waarom interessant</dt><dd>{item.insight.why}</dd><dt>Voordeel voor BITG</dt><dd>{item.insight.benefit}</dd><dt>Aanbevolen vervolgstap</dt><dd><strong>{item.insight.nextStep}</strong></dd><dt>Geschatte waarde</dt><dd>{item.insight.valueEstimate||"Niet verantwoord te onderbouwen uit de bron; er wordt geen bedrag geschat."}</dd></dl>
        {item.summary&&<><p className="eyebrow" style={{margin:"18px 0 4px"}}>UIT DE BRON</p><p className="small" style={{margin:0}}>{item.summary}</p></>}
      </section>
      <section className="mk-card span-5"><h2>Gegevens</h2>
        <dl className="facts"><dt>Locatie</dt><dd>{item.place||"Onbekend"}{item.distance_km!==null&&` · ${String(item.distance_km).replace(".",",")} km van Almere`}{item.geo_precision&&<><br/><span className="small muted">{geoPrecisionLabels[item.geo_precision]}</span></>}</dd>
          <dt>Datum</dt><dd>{item.event_date?formatDate(item.event_date,{weekday:"long",day:"numeric",month:"long",year:"numeric"}):"Geen datum bekend"}</dd>
          <dt>Bron</dt><dd><a href={item.url} target="_blank" rel="noopener noreferrer nofollow">{item.source}</a><br/><span className="small muted">{sourceKindLabels[item.source_kind as SourceKind]||item.source_kind}{item.published_at?` · gepubliceerd ${stamp(item.published_at)}`:""}</span></dd>
          {item.also_seen.length>0&&<><dt>Ook gezien</dt><dd>{item.also_seen.map(url=><a key={url} href={url} target="_blank" rel="noopener noreferrer nofollow" className="small" style={{display:"block",overflowWrap:"anywhere"}}>{url.replace(/^https:\/\//,"").slice(0,70)}</a>)}</dd></>}
          <dt>Contact</dt><dd>Via de officiële website of contactpagina van de organisatie. Er worden geen contactgegevens verzonnen of opgeslagen.</dd>
          <dt>Gezien</dt><dd>{item.seen_count}× sinds {stamp(item.first_seen_at)}</dd></dl>
        <details className="more" style={{marginTop:12}}><summary>Onderbouwing van de score</summary><ul className="bars">{growthBreakdown(item).map(p=><li key={p.key}><span>{p.label} ({Math.round(growthWeights[p.key]*100)}%)</span><span className="bar"><i style={{width:`${p.value*20}%`}}/></span><span>{p.value}/5</span></li>)}</ul>
          <p className="small muted" style={{marginTop:8}}>Afstand, urgentie en betrouwbaarheid worden bij elke scan opnieuw berekend. Relevantie, waarde en kans komen {item.analysis_method==="ai"?"uit de AI-analyse":"uit de vuistregels"}.</p></details>
      </section>
      <section className="mk-card span-12"><h2>CRM</h2><p className="sub muted">Status, opvolgdatum en categorie. Elke wijziging komt in de historie.</p><GrowthCrm id={item.id} status={item.status as GrowthStatus} category={item.category} followUpOn={item.follow_up_on} version={item.version} today={today}/></section>
      <section className="mk-card span-7"><h2>AI Action Assistant</h2><p className="sub muted">Voorstellen, e-mails, campagnes, introductieberichten en acquisitieplannen als concept.</p><GrowthAssistant id={item.id} drafts={drafts} aiConfigured={aiStatus().configured}/></section>
      <section className="mk-card span-5"><h2>Notities en herinneringen</h2><p className="sub muted">Herinneringen verschijnen in het overzicht bij de opvolgacties.</p><GrowthNotes id={item.id} notes={notes} today={today}/>
        <h2 style={{marginTop:24}}>Historie</h2><ol className="timeline">{history.map(h=><li key={h.id}><span className="small muted">{stamp(h.created_at)}</span> {events[h.event]||h.event}{typeof h.details.label==="string"?`: ${h.details.label}`:typeof h.details.score==="number"?` (score ${h.details.score})`:""}</li>)}</ol></section>
    </div>
  </>;
}
