"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { growthCategoryLabels,growthStatuses,growthStatusLabels,type GrowthStatus } from "@bitg/core/growth/labels";
import { formatDate } from "@bitg/core/marketing/dates";
import { send } from "./ActionButton";
import { GrowthScore,type FeedItem } from "./GrowthFeed";
type Card=FeedItem&{open_reminders:number};
export function CrmBoard({items,today}:{items:Card[];today:string}){
  const router=useRouter(),[busy,setBusy]=useState<string|null>(null),[error,setError]=useState(""),[over,setOver]=useState<GrowthStatus|null>(null);
  async function move(id:string,status:GrowthStatus){const item=items.find(i=>i.id===id);if(!item||item.status===status)return;setBusy(id);setError("");try{await send(`/api/v1/admin/growth/opportunities/${id}`,"PATCH",{expectedVersion:item.version,status});}catch(e){setError(e instanceof Error?e.message:"Dat is niet gelukt.");}finally{setBusy(null);router.refresh();}}
  return <>
    <p role="alert">{error}</p>
    <div className="crm-board">{growthStatuses.map(status=>{const list=items.filter(i=>i.status===status).sort((a,b)=>(a.follow_up_on??"9999").localeCompare(b.follow_up_on??"9999")||b.score-a.score);const limit=status==="new"||status==="rejected"?12:50;return <section key={status} className={`crm-col${over===status?" drop":""}`} onDragOver={e=>{e.preventDefault();setOver(status);}} onDragLeave={()=>setOver(o=>o===status?null:o)} onDrop={e=>{e.preventDefault();setOver(null);move(e.dataTransfer.getData("text/plain"),status);}} aria-label={growthStatusLabels[status]}>
      <h2>{growthStatusLabels[status]} <span className="muted">{list.length}</span></h2>
      {list.slice(0,limit).map(i=><article key={i.id} className="crm-card" draggable onDragStart={e=>{e.dataTransfer.setData("text/plain",i.id);e.dataTransfer.effectAllowed="move";}}>
        <div className="btn-row" style={{flexWrap:"nowrap",alignItems:"flex-start"}}><GrowthScore score={i.score}/><div style={{minWidth:0}}><Link href={`/growth/${i.id}`} className="crm-title">{i.title}</Link><p className="small muted" style={{margin:0}}>{growthCategoryLabels[i.category]}{i.place?` · ${i.place}`:""}</p></div></div>
        <div className="btn-row" style={{justifyContent:"space-between",marginTop:8}}>
          <span className="small">{i.follow_up_on?<span className={i.follow_up_on<today?"overdue":""}>Opvolgen {formatDate(i.follow_up_on,{day:"numeric",month:"short"})}</span>:i.event_date?`Datum ${formatDate(i.event_date,{day:"numeric",month:"short"})}`:""}{i.open_reminders>0&&` · ${i.open_reminders} herinnering${i.open_reminders>1?"en":""}`}</span>
          <select aria-label="Status wijzigen" value={i.status} disabled={busy===i.id} onChange={e=>move(i.id,e.target.value as GrowthStatus)}>{growthStatuses.map(s=><option key={s} value={s}>{growthStatusLabels[s]}</option>)}</select>
        </div>
      </article>)}
      {list.length>limit&&<p className="small muted">en {list.length-limit} meer in de <Link className="inline" href="/growth/kansen">feed</Link></p>}
      {!list.length&&<p className="small muted">Leeg</p>}
    </section>;})}</div>
    <p className="small muted">Sleep een kaart naar een andere kolom of kies de status in de kaart. Elke wijziging wordt vastgelegd in de historie van de kans.</p>
  </>;
}
