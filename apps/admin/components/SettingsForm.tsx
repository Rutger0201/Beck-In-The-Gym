"use client";
import { useState,type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { MarketingSettings } from "@bitg/core/marketing/validation";
import { send } from "./ActionButton";
export function SettingsForm({settings,version}:{settings:MarketingSettings;version:number}){
  const router=useRouter(),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  async function save(event:FormEvent<HTMLFormElement>){event.preventDefault();const data=new FormData(event.currentTarget);setBusy(true);setMessage("");
    try{await send("/api/v1/admin/marketing/settings","PUT",{expectedVersion:version,settings:{postsPerWeek:Number(data.get("postsPerWeek")),weeklyMinutes:Number(data.get("weeklyHours"))*60,region:String(data.get("region")),researchEveryDays:Number(data.get("researchEveryDays")),autoPublish:false}});setMessage("Instellingen opgeslagen.");router.refresh();}
    catch(e){setMessage(e instanceof Error?e.message:"Opslaan is niet gelukt.");router.refresh();}finally{setBusy(false);}}
  return <form className="settings-form" onSubmit={save}>
    <label>Berichten per week<select name="postsPerWeek" defaultValue={settings.postsPerWeek}>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
    <label>Maximale tijd per week (uren)<input name="weeklyHours" type="number" min={0.5} max={15} step={0.5} defaultValue={settings.weeklyMinutes/60} required/></label>
    <label>Regio voor lokale kansen<input name="region" defaultValue={settings.region} minLength={2} maxLength={80} required/></label>
    <label>Research uitvoeren elke<select name="researchEveryDays" defaultValue={settings.researchEveryDays}><option value={1}>dag</option><option value={7}>week</option><option value={30}>30 dagen</option></select></label>
    <label className="check-row full"><input type="checkbox" checked={false} disabled readOnly/>Automatisch publiceren — staat uit en kan pas na koppeling en jouw expliciete toestemming per kanaal worden ingeschakeld.</label>
    <button type="submit" disabled={busy}>Opslaan</button><p className="notice full muted" role="status">{message}</p>
  </form>;
}
