"use client";
import { useEffect,useState,type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { addDays,addMonths,formatDate,isoWeekday,startOfMonth,startOfWeek } from "@bitg/core/marketing/dates";
import { calendarStatusLabels,categoryLabels,channelLabels,channels,type CalendarBrief,type CalendarStatus,type Category,type Channel } from "@bitg/core/marketing/labels";
import { send } from "./ActionButton";
export type Item={id:string;scheduled_for:string;channel:Channel;category:string;title:string;brief:CalendarBrief;notes:string|null;effort_minutes:number;status:CalendarStatus;generated_by:string;is_demo:boolean;version:number};
type View="month"|"week"|"day";
const views:[View,string][]=[["month","Maand"],["week","Week"],["day","Dag"]];
const dows=["Ma","Di","Wo","Do","Vr","Za","Zo"];
const vertical:Channel[]=["instagram_reel","instagram_story","tiktok","youtube_short"];

function Preview({item,hook}:{item:Item;hook:string}){
  return <div className="preview"><div className={`phone${vertical.includes(item.channel)?"":" square"}`} aria-label={`Voorbeeldweergave ${channelLabels[item.channel]}`}><div className="brandline"><span>{channelLabels[item.channel].toUpperCase()}</span><span>CONCEPT</span></div><p className="hook">{hook||item.title}</p><div className="brandline"><span>BECK IN THE GYM</span><img src="/brand/logo-white.png" alt=""/></div></div>
    <div className="brief"><strong>Opzet</strong><ol>{(item.brief.outline||[]).map(step=><li key={step}>{step}</li>)}</ol><strong>Call-to-action</strong><p style={{margin:"4px 0 8px"}}>{item.brief.cta}</p><strong>Beeld</strong><p style={{margin:"4px 0"}}>{item.brief.visual}</p><p className="small">Sjabloon uit de themabibliotheek. AI-teksten volgen in de Content Studio (fase 3).</p></div></div>;
}

function Editor({item,close,today}:{item:Item;close:()=>void;today:string}){
  const router=useRouter(),[busy,setBusy]=useState(false),[error,setError]=useState(""),[hook,setHook]=useState(item.brief.hook||"");
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==="Escape")close();};addEventListener("keydown",key);return()=>removeEventListener("keydown",key);},[close]);
  useEffect(()=>setHook(item.brief.hook||""),[item]);
  async function act(body:Record<string,unknown>,url=`/api/v1/admin/marketing/calendar/${item.id}`,method="PATCH"){setBusy(true);setError("");try{const result=await send(url,method,{expectedVersion:item.version,...body});if(url.endsWith("regenerate")&&!result.title)setError("Er is geen ander passend idee meer beschikbaar.");router.refresh();if(!url.endsWith("regenerate"))close();}catch(e){setError(e instanceof Error?e.message:"Dat is niet gelukt.");router.refresh();}finally{setBusy(false);}}
  function save(event:FormEvent<HTMLFormElement>){event.preventDefault();const data=new FormData(event.currentTarget);const next={title:String(data.get("title")),channel:String(data.get("channel")),scheduledFor:String(data.get("date")),hook,notes:String(data.get("notes")||"")},previous={title:item.title,channel:item.channel,scheduledFor:item.scheduled_for,hook:item.brief.hook||"",notes:item.notes||""};const changed=Object.fromEntries(Object.entries(next).filter(([key,value])=>previous[key as keyof typeof previous]!==value));if(!Object.keys(changed).length){close();return;}act(changed);}
  return <div className="editor" role="dialog" aria-modal="true" aria-labelledby="editor-title"><button className="backdrop" aria-label="Sluiten" onClick={close}/><div className="editor-panel">
    <div className="btn-row" style={{justifyContent:"space-between"}}><span className={`tag status-${item.status}`}>{calendarStatusLabels[item.status]}</span><button className="secondary small" onClick={close}>Sluiten</button></div>
    <h2 id="editor-title">{item.title}</h2><p className="small muted" style={{margin:0}}>{categoryLabels[item.category as Category]||item.category} · ± {item.effort_minutes} min · {item.generated_by==="planner"?"voorgesteld door de planner":"door jou ingepland"}</p>
    <Preview item={item} hook={hook}/>
    <form onSubmit={save}>
      <label>Titel<input name="title" defaultValue={item.title} minLength={3} maxLength={200} required/></label>
      <div className="settings-form"><label>Kanaal<select name="channel" defaultValue={item.channel}>{channels.map(c=><option key={c} value={c}>{channelLabels[c]}</option>)}</select></label><label>Datum<input type="date" name="date" defaultValue={item.scheduled_for} required/></label></div>
      <label>Hook<textarea value={hook} onChange={e=>setHook(e.target.value)} maxLength={300}/></label>
      <label>Notities, caption of script<textarea name="notes" defaultValue={item.notes||""} maxLength={4000} placeholder="Schrijf hier je eigen caption of script."/></label>
      <p role="alert">{error}</p>
      <div className="btn-row"><button type="submit" className="secondary small" disabled={busy}>Wijzigingen opslaan</button>
        {item.status!=="approved"&&item.status!=="published"&&<button type="button" className="small" disabled={busy} onClick={()=>act({status:"approved"})}>Goedkeuren</button>}
        {item.status!=="rejected"&&item.status!=="published"&&<button type="button" className="secondary small" disabled={busy} onClick={()=>act({status:"rejected"})}>Afwijzen</button>}
        {(item.status==="draft"||item.status==="rejected")&&<button type="button" className="secondary small" disabled={busy} onClick={()=>act({},`/api/v1/admin/marketing/calendar/${item.id}/regenerate`,"POST")}>Opnieuw genereren</button>}
        {item.status==="approved"&&item.scheduled_for<=today&&<button type="button" className="secondary small" disabled={busy} onClick={()=>act({status:"published"})}>Markeer als gepubliceerd</button>}
      </div>
      <p className="small muted" style={{margin:0}}>Goedgekeurde content wordt niet automatisch gepubliceerd. Een bewerking zet goedgekeurde content terug naar concept.</p>
    </form></div></div>;
}

export function MarketingCalendar({items,anchor,view,today}:{items:Item[];anchor:string;view:View;today:string}){
  const router=useRouter(),[local,setLocal]=useState(items),[open,setOpen]=useState<string|null>(null),[over,setOver]=useState<string|null>(null),[error,setError]=useState("");
  useEffect(()=>setLocal(items),[items]);
  const go=(d:string,v:View=view)=>router.push(`/marketing/kalender?d=${d}&v=${v}`);
  const start=view==="month"?startOfWeek(startOfMonth(anchor)):view==="week"?startOfWeek(anchor):anchor;
  const length=view==="month"?42:view==="week"?7:1,days=Array.from({length},(_,i)=>addDays(start,i));
  const step=(dir:number)=>go(view==="month"?addMonths(anchor,dir):addDays(anchor,dir*(view==="week"?7:1)));
  const title=view==="month"?formatDate(anchor,{month:"long",year:"numeric"}):view==="week"?`${formatDate(start,{day:"numeric",month:"short"})} – ${formatDate(addDays(start,6),{day:"numeric",month:"short",year:"numeric"})}`:formatDate(anchor,{weekday:"long",day:"numeric",month:"long"});
  async function move(id:string,date:string){const item=local.find(i=>i.id===id);if(!item||item.scheduled_for===date)return;setError("");setLocal(local.map(i=>i.id===id?{...i,scheduled_for:date}:i));try{const {version}=await send(`/api/v1/admin/marketing/calendar/${id}`,"PATCH",{expectedVersion:item.version,scheduledFor:date});setLocal(list=>list.map(i=>i.id===id?{...i,version}:i));}catch(e){setError(e instanceof Error?e.message:"Verplaatsen is niet gelukt.");}router.refresh();}
  const current=local.find(i=>i.id===open);
  const chip=(item:Item)=><button key={item.id} type="button" className={`chip ${item.status}`} draggable onDragStart={e=>{e.dataTransfer.setData("text/plain",item.id);e.dataTransfer.effectAllowed="move";}} onClick={()=>setOpen(item.id)}><small>{channelLabels[item.channel]} · {calendarStatusLabels[item.status]}</small>{item.title}</button>;
  return <>
    <div className="cal-toolbar"><div className="btn-row"><button className="secondary small" onClick={()=>step(-1)} aria-label="Vorige">←</button><button className="secondary small" onClick={()=>go(today)}>Vandaag</button><button className="secondary small" onClick={()=>step(1)} aria-label="Volgende">→</button><h2>{title}</h2></div>
      <div className="seg-control" role="group" aria-label="Weergave">{views.map(([v,label])=><button key={v} aria-pressed={view===v} onClick={()=>go(anchor,v)}>{label}</button>)}</div></div>
    <p role="alert">{error}</p>
    {view==="day"?<div className="cal-dayview">{local.filter(i=>i.scheduled_for===anchor).map(item=><article key={item.id} className="mk-card"><div className="btn-row" style={{justifyContent:"space-between"}}><strong>{item.title}</strong><span className={`tag status-${item.status}`}>{calendarStatusLabels[item.status]}</span></div><p className="small muted">{channelLabels[item.channel]} · ± {item.effort_minutes} min</p><Preview item={item} hook={item.brief.hook}/><button className="small" style={{marginTop:12}} onClick={()=>setOpen(item.id)}>Bekijken en bewerken</button></article>)}{!local.some(i=>i.scheduled_for===anchor)&&<div className="empty-mk"><p>Niets gepland op deze dag.</p></div>}</div>
    :<div className={`cal ${view}`}>{dows.map(d=><div key={d} className="cal-dow">{d}</div>)}{days.map(day=>{const list=local.filter(i=>i.scheduled_for===day);return <div key={day} className={`cal-day${view==="month"&&day.slice(0,7)!==anchor.slice(0,7)?" out":""}${day===today?" today":""}${over===day?" drop":""}${list.length||day===today?"":" empty-day"}`} onDragOver={e=>{e.preventDefault();setOver(day);}} onDragLeave={()=>setOver(o=>o===day?null:o)} onDrop={e=>{e.preventDefault();setOver(null);move(e.dataTransfer.getData("text/plain"),day);}}>
      <button type="button" className="num" style={{background:"none",border:0,padding:0,textAlign:"left",color:"inherit",cursor:"pointer"}} onClick={()=>go(day,"day")}>{dows[isoWeekday(day)-1]} {formatDate(day,{day:"numeric",month:view==="month"?undefined:"short"})}</button>{list.map(chip)}</div>;})}</div>}
    <div className="legend"><span><i style={{background:"var(--accent)"}}/>Concept</span><span><i style={{background:"var(--good)"}}/>Goedgekeurd / gepubliceerd</span><span><i style={{background:"#c76b5a"}}/>Afgewezen</span><span>Sleep een bericht naar een andere dag, of wijzig de datum in het bericht zelf.</span></div>
    {current&&<Editor item={current} close={()=>setOpen(null)} today={today}/>}
  </>;
}
