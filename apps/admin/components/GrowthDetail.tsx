"use client";
import { useState,type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { draftKinds,draftKindLabels,draftStatusLabels,growthCategories,growthCategoryLabels,growthStatuses,growthStatusLabels,type DraftKind,type DraftStatus,type GrowthCategory,type GrowthStatus } from "@bitg/core/growth/labels";
import { formatDate } from "@bitg/core/marketing/dates";
import { send } from "./ActionButton";
type Note={id:string;body:string;remind_on:string|null;done:boolean;created_at:string};
type Draft={id:string;kind:DraftKind;subject:string;body:string;method:"ai"|"template";model:string|null;status:DraftStatus;version:number;created_at:string};
const stamp=(value:string)=>new Date(value).toLocaleString("nl-NL",{timeZone:"Europe/Amsterdam",dateStyle:"medium",timeStyle:"short"});

export function GrowthCrm({id,status,category,followUpOn,version,today}:{id:string;status:GrowthStatus;category:GrowthCategory;followUpOn:string|null;version:number;today:string}){
  const router=useRouter(),[busy,setBusy]=useState(false),[error,setError]=useState(""),[date,setDate]=useState(followUpOn??"");
  async function patch(body:Record<string,unknown>){setBusy(true);setError("");try{await send(`/api/v1/admin/growth/opportunities/${id}`,"PATCH",{expectedVersion:version,...body});}catch(e){setError(e instanceof Error?e.message:"Dat is niet gelukt.");}finally{setBusy(false);router.refresh();}}
  return <div className="crm">
    <ol className="pipeline" aria-label="Status in de pipeline">{growthStatuses.map(s=><li key={s}><button type="button" className={s===status?"current":""} aria-pressed={s===status} disabled={busy||s===status} onClick={()=>patch({status:s})}>{growthStatusLabels[s]}</button></li>)}</ol>
    <div className="settings-form">
      <label>Opvolgdatum<span className="btn-row" style={{flexWrap:"nowrap"}}><input type="date" min={today} value={date} onChange={e=>setDate(e.target.value)}/><button type="button" className="secondary small" disabled={busy||date===(followUpOn??"")} onClick={()=>patch({followUpOn:date||null})}>Opslaan</button></span></label>
      <label>Categorie<select value={category} disabled={busy} onChange={e=>patch({category:e.target.value})}>{growthCategories.map(c=><option key={c} value={c}>{growthCategoryLabels[c]}</option>)}</select></label>
    </div>
    <p role="alert">{error}</p>
  </div>;
}

export function GrowthNotes({id,notes,today}:{id:string;notes:Note[];today:string}){
  const router=useRouter(),[busy,setBusy]=useState(false),[error,setError]=useState("");
  async function add(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=event.currentTarget,data=new FormData(form);setBusy(true);setError("");try{await send(`/api/v1/admin/growth/opportunities/${id}/notes`,"POST",{body:String(data.get("body")),remindOn:String(data.get("remindOn")||"")||null});form.reset();}catch(e){setError(e instanceof Error?e.message:"Opslaan is niet gelukt.");}finally{setBusy(false);router.refresh();}}
  async function done(note:Note){setBusy(true);try{await send(`/api/v1/admin/growth/notes/${note.id}/done`,"POST",{});}catch(e){setError(e instanceof Error?e.message:"Dat is niet gelukt.");}finally{setBusy(false);router.refresh();}}
  return <>
    <form className="note-form" onSubmit={add}><label>Notitie<textarea name="body" required maxLength={4000} placeholder="Bijvoorbeeld: gebeld met de organisatie, terugbellen na de open dag."/></label><label>Herinnering (optioneel)<input type="date" name="remindOn" min={today}/></label><button type="submit" className="small" disabled={busy}>Notitie toevoegen</button><p role="alert">{error}</p></form>
    {notes.length?<ul className="list notes">{notes.map(n=><li key={n.id}><div className="grow"><p className="title" style={{whiteSpace:"pre-wrap",fontWeight:400}}>{n.body}</p><p className="meta">{stamp(n.created_at)}{n.remind_on&&<> · herinnering {formatDate(n.remind_on,{day:"numeric",month:"long"})}{n.done?" (afgerond)":n.remind_on<today?" (verlopen)":""}</>}</p></div>{n.remind_on&&!n.done&&<button type="button" className="secondary small" disabled={busy} onClick={()=>done(n)}>Afgerond</button>}</li>)}</ul>:<p className="small muted">Nog geen notities.</p>}
  </>;
}

function DraftCard({draft}:{draft:Draft}){
  const router=useRouter(),[subject,setSubject]=useState(draft.subject),[body,setBody]=useState(draft.body),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const dirty=subject!==draft.subject||body!==draft.body;
  async function patch(change:Record<string,unknown>){setBusy(true);setMessage("");try{await send(`/api/v1/admin/growth/drafts/${draft.id}`,"PATCH",{expectedVersion:draft.version,...change});setMessage("Opgeslagen.");}catch(e){setMessage(e instanceof Error?e.message:"Dat is niet gelukt.");}finally{setBusy(false);router.refresh();}}
  async function copy(){try{await navigator.clipboard.writeText(`${subject}\n\n${body}`);setMessage("Gekopieerd. Controleer de tekst voordat je hem zelf verstuurt.");}catch{setMessage("Kopiëren is niet gelukt; selecteer de tekst handmatig.");}}
  return <article className={`draft status-${draft.status}`}>
    <div className="btn-row" style={{justifyContent:"space-between"}}><strong>{draftKindLabels[draft.kind]}</strong><span className="btn-row"><span className={`tag ${draft.method==="ai"?"real":""}`}>{draft.method==="ai"?"AI-concept":"Sjabloon"}</span><span className={`tag status-${draft.status==="approved"||draft.status==="sent_manually"?"approved":draft.status==="discarded"?"rejected":"draft"}`}>{draftStatusLabels[draft.status]}</span></span></div>
    <p className="small muted" style={{margin:"2px 0 10px"}}>{stamp(draft.created_at)}{draft.model?` · ${draft.model}`:""}</p>
    <label>Onderwerp<input value={subject} maxLength={200} onChange={e=>setSubject(e.target.value)}/></label>
    <label>Tekst<textarea value={body} maxLength={8000} rows={12} onChange={e=>setBody(e.target.value)}/></label>
    <div className="btn-row" style={{marginTop:10}}>
      <button type="button" className="secondary small" disabled={busy||!dirty} onClick={()=>patch({subject,body})}>Wijzigingen opslaan</button>
      {draft.status==="draft"&&<button type="button" className="small" disabled={busy||dirty} onClick={()=>patch({status:"approved"})}>Goedkeuren</button>}
      <button type="button" className="secondary small" onClick={copy}>Kopiëren</button>
      {draft.status==="approved"&&<button type="button" className="secondary small" disabled={busy} onClick={()=>patch({status:"sent_manually"})}>Ik heb dit zelf verstuurd</button>}
      {draft.status!=="discarded"&&draft.status!=="sent_manually"&&<button type="button" className="secondary small" disabled={busy} onClick={()=>patch({status:"discarded"})}>Verwerpen</button>}
    </div>
    <p className="notice muted" role="status">{message}</p>
  </article>;
}
export function GrowthAssistant({id,drafts,aiConfigured}:{id:string;drafts:Draft[];aiConfigured:boolean}){
  const router=useRouter(),[kind,setKind]=useState<DraftKind>("email"),[instructions,setInstructions]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  async function create(){setBusy(true);setMessage("");try{const result=await send(`/api/v1/admin/growth/opportunities/${id}/drafts`,"POST",{kind,...(instructions.trim()?{instructions:instructions.trim()}:{})});setMessage(result.budgetReached?"Het AI-budget voor deze maand is bereikt; er is een sjabloon gemaakt.":result.method==="ai"?"AI-concept klaar. Controleer het voordat je iets verstuurt.":"Sjabloon klaar. Vul de [placeholders] zelf in.");setInstructions("");}catch(e){setMessage(e instanceof Error?e.message:"Dat is niet gelukt.");}finally{setBusy(false);router.refresh();}}
  return <>
    <div className="assistant-form">
      <label>Soort concept<select value={kind} onChange={e=>setKind(e.target.value as DraftKind)}>{draftKinds.map(k=><option key={k} value={k}>{draftKindLabels[k]}</option>)}</select></label>
      <label className="grow">Extra wens (optioneel)<input value={instructions} maxLength={600} onChange={e=>setInstructions(e.target.value)} placeholder="Bijvoorbeeld: informeel, nadruk op duotraining"/></label>
      <button type="button" className="small" disabled={busy} onClick={create}>{busy?"Concept maken…":"Concept maken"}</button>
    </div>
    <p className="small muted">{aiConfigured?"Concepten worden door AI voorbereid op basis van de bron.":"AI is niet gekoppeld: je krijgt een sjabloon met [placeholders]."} Er wordt nooit automatisch iets verstuurd; jij beoordeelt, past aan en verstuurt zelf.</p>
    <p className="notice muted" role="status">{message}</p>
    <div className="drafts">{drafts.map(d=><DraftCard key={`${d.id}-${d.version}`} draft={d}/>)}</div>
  </>;
}
