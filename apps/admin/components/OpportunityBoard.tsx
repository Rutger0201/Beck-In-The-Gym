"use client";
import { useMemo,useState } from "react";
import { useRouter } from "next/navigation";
import { categoryLabels,channelLabels,opportunityStatusLabels,type Category,type Channel,type OpportunityStatus } from "@bitg/core/marketing/labels";
import { scoreBreakdown,priorityBand } from "@bitg/core/marketing/scoring";
import { send } from "./ActionButton";
type Opportunity={id:string;title:string;description:string;audience:string;channel:Channel;category:string;relevance:number;impact:number;feasibility:number;cost_level:number;score:number;rationale:string[];effort_minutes:number;cost_min_eur:number;cost_max_eur:number;expected_impact:{label:string;range:string;confidence:string;basis:string};best_moment:string|null;action:string;source:string;is_demo:boolean;status:OpportunityStatus;version:number};
const hours=(minutes:number)=>minutes>=60?`${Math.floor(minutes/60)} u${minutes%60?` ${minutes%60} min`:""}`:`${minutes} min`;
export function OpportunityBoard({opportunities,tomorrow}:{opportunities:Opportunity[];tomorrow:string}){
  const router=useRouter(),[query,setQuery]=useState(""),[channel,setChannel]=useState(""),[status,setStatus]=useState("open"),[band,setBand]=useState(""),[busy,setBusy]=useState<string|null>(null),[error,setError]=useState(""),[dates,setDates]=useState<Record<string,string>>({});
  const visible=useMemo(()=>opportunities.filter(o=>(!status||o.status===status)&&(!channel||o.channel===channel)&&(!band||priorityBand(o.score)===band)&&(!query||`${o.title} ${o.description} ${o.audience}`.toLowerCase().includes(query.toLowerCase()))),[opportunities,query,channel,status,band]);
  async function change(o:Opportunity,body:Record<string,unknown>){setBusy(o.id);setError("");try{await send(`/api/v1/admin/marketing/opportunities/${o.id}`,"PATCH",{expectedVersion:o.version,...body});router.refresh();}catch(e){setError(e instanceof Error?e.message:"Dat is niet gelukt.");router.refresh();}finally{setBusy(null);}}
  const used=[...new Set(opportunities.map(o=>o.channel))];
  return <>
    <div className="toolbar-mk">
      <label className="search">Zoeken<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Onderwerp, doelgroep…"/></label>
      <label>Status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Alle</option>{Object.entries(opportunityStatusLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
      <label>Kanaal<select value={channel} onChange={e=>setChannel(e.target.value)}><option value="">Alle kanalen</option>{used.map(c=><option key={c} value={c}>{channelLabels[c]}</option>)}</select></label>
      <label>Prioriteit<select value={band} onChange={e=>setBand(e.target.value)}><option value="">Alle</option><option value="hoog">Hoog (75+)</option><option value="middel">Middel (55–74)</option><option value="laag">Laag</option></select></label>
    </div>
    <p role="alert">{error}</p>
    <p className="small muted">{visible.length} van {opportunities.length} kansen</p>
    <div className="opp-grid">{visible.map(o=><article key={o.id} className="mk-card opp">
      <header><span className={`score ${priorityBand(o.score)} big`} style={{"--s":o.score} as React.CSSProperties}><span>{o.score}</span></span><div><h3>{o.title}</h3><p className="small muted">{channelLabels[o.channel]} · {categoryLabels[o.category as Category]||o.category}</p></div></header>
      <p>{o.description}</p>
      <dl className="facts"><dt>Doelgroep</dt><dd>{o.audience}</dd><dt>Tijd</dt><dd>± {hours(o.effort_minutes)}</dd><dt>Kosten</dt><dd>{o.cost_max_eur?`€${o.cost_min_eur}–${o.cost_max_eur}, alleen na jouw akkoord`:"Geen"}</dd><dt>Verwachte impact</dt><dd>{o.expected_impact.label}: {o.expected_impact.range} · zekerheid {o.expected_impact.confidence}</dd><dt>Beste moment</dt><dd>{o.best_moment||"Nog niet onderbouwd; volgt uit gekoppelde bereikcijfers"}</dd><dt>Bron</dt><dd>{o.source}{o.is_demo&&<> <span className="tag demo">Voorbeeld</span></>}</dd></dl>
      <p><strong>Actievoorstel:</strong> {o.action}</p>
      <details className="more"><summary>Onderbouwing van de score</summary>
        <ul className="bars">{scoreBreakdown({relevance:o.relevance,impact:o.impact,feasibility:o.feasibility,cost:o.cost_level}).map(p=><li key={p.key}><span>{p.label}</span><span className="bar"><i style={{width:`${p.value*20}%`}}/></span><span>{p.value}/5</span></li>)}</ul>
        <ul className="rationale">{o.rationale.map(line=><li key={line}>{line}</li>)}</ul><p className="small muted" style={{marginTop:8}}>{o.expected_impact.basis}</p></details>
      <div className="btn-row" style={{marginTop:"auto"}}>
        {o.status==="open"?<><input type="date" aria-label="Datum voor inplannen" min={tomorrow} value={dates[o.id]||tomorrow} onChange={e=>setDates({...dates,[o.id]:e.target.value})} style={{width:"auto",padding:"7px"}}/><button className="small" disabled={busy===o.id} onClick={()=>change(o,{planFor:dates[o.id]||tomorrow})}>Inplannen</button><button className="secondary small" disabled={busy===o.id} onClick={()=>change(o,{status:"dismissed"})}>Afwijzen</button></>
        :<><span className="tag">{opportunityStatusLabels[o.status]}</span>{o.status==="planned"&&<button className="secondary small" disabled={busy===o.id} onClick={()=>change(o,{status:"done"})}>Markeer als uitgevoerd</button>}<button className="secondary small" disabled={busy===o.id} onClick={()=>change(o,{status:"open"})}>Heropenen</button></>}
      </div>
    </article>)}</div>
    {!visible.length&&<div className="empty-mk"><p>Geen kansen voor deze filters.</p></div>}
  </>;
}
