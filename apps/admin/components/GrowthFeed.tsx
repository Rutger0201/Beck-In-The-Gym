"use client";
import { useMemo,useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { growthCategories,growthCategoryLabels,growthStatuses,growthStatusLabels,sourceKindLabels,type GrowthCategory,type GrowthInsight,type GrowthStatus,type SourceKind } from "@bitg/core/growth/labels";
import { growthBand } from "@bitg/core/growth/scoring";
import { formatDate } from "@bitg/core/marketing/dates";
import { send } from "./ActionButton";
export type FeedItem={id:string;title:string;summary:string;url:string;source:string;source_kind:string;organisation:string|null;category:GrowthCategory;place:string|null;distance_km:number|null;event_date:string|null;score:number;insight:GrowthInsight;analysis_method:"rules"|"ai";status:GrowthStatus;follow_up_on:string|null;is_demo:boolean;first_seen_at:string;version:number};
export function GrowthScore({score,big}:{score:number;big?:boolean}){return <span className={`score ${growthBand(score)}${big?" big":""}`} style={{"--s":score} as React.CSSProperties} title={`Opportunity Score ${score} van 100`}><span>{score}</span></span>;}
export function MethodTag({method}:{method:"rules"|"ai"}){return method==="ai"?<span className="tag real" title="Beoordeeld door AI op basis van de bron">AI-analyse</span>:<span className="tag" title="Beoordeeld met de transparante vuistregels; AI is niet gekoppeld of nog niet uitgevoerd">Regels</span>;}
export function GrowthFeed({items,today}:{items:FeedItem[];today:string}){
  const router=useRouter(),[query,setQuery]=useState(""),[category,setCategory]=useState(""),[status,setStatus]=useState("active"),[place,setPlace]=useState(""),[minScore,setMinScore]=useState(0),[from,setFrom]=useState(""),[to,setTo]=useState(""),[sort,setSort]=useState("score"),[busy,setBusy]=useState<string|null>(null),[error,setError]=useState("");
  const places=useMemo(()=>[...new Set(items.map(i=>i.place).filter(Boolean) as string[])].sort(),[items]);
  const visible=useMemo(()=>items.filter(i=>(!category||i.category===category)&&(status==="active"?i.status!=="rejected"&&i.status!=="won":!status||i.status===status)&&(!place||i.place===place)&&i.score>=minScore&&(!from||(i.event_date??"")>=from)&&(!to||(i.event_date!==null&&i.event_date<=to))&&(!query||`${i.title} ${i.summary} ${i.organisation||""}`.toLowerCase().includes(query.toLowerCase())))
    .sort((a,b)=>sort==="date"?(a.event_date??"9999").localeCompare(b.event_date??"9999"):sort==="new"?b.first_seen_at.localeCompare(a.first_seen_at):b.score-a.score),[items,query,category,status,place,minScore,from,to,sort]);
  async function change(item:FeedItem,next:GrowthStatus){setBusy(item.id);setError("");try{await send(`/api/v1/admin/growth/opportunities/${item.id}`,"PATCH",{expectedVersion:item.version,status:next});}catch(e){setError(e instanceof Error?e.message:"Dat is niet gelukt.");}finally{setBusy(null);router.refresh();}}
  return <>
    <div className="toolbar-mk">
      <label className="search">Zoeken<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Organisatie, evenement…"/></label>
      <label>Categorie<select value={category} onChange={e=>setCategory(e.target.value)}><option value="">Alle</option>{growthCategories.map(c=><option key={c} value={c}>{growthCategoryLabels[c]}</option>)}</select></label>
      <label>Status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="active">Lopend</option><option value="">Alle</option>{growthStatuses.map(s=><option key={s} value={s}>{growthStatusLabels[s]}</option>)}</select></label>
      <label>Locatie<select value={place} onChange={e=>setPlace(e.target.value)}><option value="">Overal</option>{places.map(p=><option key={p} value={p}>{p}</option>)}</select></label>
      <label>Minimale score: {minScore}<input type="range" min={0} max={90} step={10} value={minScore} onChange={e=>setMinScore(Number(e.target.value))}/></label>
      <label>Datum vanaf<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
      <label>Datum tot<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
      <label>Sorteren<select value={sort} onChange={e=>setSort(e.target.value)}><option value="score">Hoogste score</option><option value="date">Eerstvolgende datum</option><option value="new">Nieuwste</option></select></label>
    </div>
    <p role="alert">{error}</p>
    <p className="small muted">{visible.length} van {items.length} kansen{from||to?" · datumfilter toont alleen kansen met een datum":""}</p>
    <div className="opp-grid">{visible.map(i=><article key={i.id} className={`mk-card opp growth-card cat-${i.category}`}>
      <header><GrowthScore score={i.score} big/><div><h3><Link href={`/growth/${i.id}`}>{i.title}</Link></h3><p className="small muted">{i.organisation&&i.organisation!==i.title?`${i.organisation} · `:""}{growthCategoryLabels[i.category]}</p></div></header>
      <dl className="facts"><dt>Locatie</dt><dd>{i.place?`${i.place}${i.distance_km!==null?` · ${String(i.distance_km).replace(".",",")} km`:""}`:"Onbekend"}</dd><dt>Datum</dt><dd>{i.event_date?`${formatDate(i.event_date,{weekday:"short",day:"numeric",month:"long",year:"numeric"})}${i.event_date<today?" (voorbij)":""}`:"Geen datum"}</dd><dt>Bron</dt><dd><a href={i.url} target="_blank" rel="noopener noreferrer nofollow">{i.source}</a> · {sourceKindLabels[i.source_kind as SourceKind]||i.source_kind}</dd></dl>
      <p>{i.insight.why}</p>
      <p><strong>Aanbevolen actie:</strong> {i.insight.nextStep}</p>
      <div className="btn-row" style={{marginTop:"auto",justifyContent:"space-between"}}>
        <span className="btn-row"><MethodTag method={i.analysis_method}/>{i.is_demo&&<span className="tag demo">Demo</span>}{i.follow_up_on&&<span className={`tag${i.follow_up_on<today?" status-rejected":""}`}>Opvolgen {formatDate(i.follow_up_on,{day:"numeric",month:"short"})}</span>}</span>
        <label className="inline-select"><span className="sr-only">Status</span><select value={i.status} disabled={busy===i.id} onChange={e=>change(i,e.target.value as GrowthStatus)}>{growthStatuses.map(s=><option key={s} value={s}>{growthStatusLabels[s]}</option>)}</select></label>
      </div>
    </article>)}</div>
    {!visible.length&&<div className="empty-mk"><p>{items.length?"Geen kansen voor deze filters.":"Nog geen kansen gevonden. Start een scan om de eerste kansen te verzamelen."}</p></div>}
  </>;
}
