"use client";
import { useState,type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { GrowthSettings } from "@bitg/core/growth/validation";
import { send } from "./ActionButton";
const lines=(value:FormDataEntryValue|null)=>String(value||"").split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
export function GrowthSettingsForm({settings,version,keys}:{settings:GrowthSettings;version:number;keys:{brave:boolean;googleCse:boolean}}){
  const router=useRouter(),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  async function save(event:FormEvent<HTMLFormElement>){event.preventDefault();const data=new FormData(event.currentTarget);setBusy(true);setMessage("");
    const next:GrowthSettings={regions:lines(data.get("regions")),searchTerms:lines(data.get("searchTerms")),maxDistanceKm:Number(data.get("maxDistanceKm")),sources:{news:data.get("news")==="on",brave:data.get("brave")==="on",googleCse:data.get("googleCse")==="on"},rssFeeds:lines(data.get("rssFeeds")),icalFeeds:lines(data.get("icalFeeds")),pages:lines(data.get("pages")),maxQueriesPerRun:Number(data.get("maxQueriesPerRun")),maxAnalysesPerRun:Number(data.get("maxAnalysesPerRun")),monthlyAiBudgetCents:Math.round(Number(data.get("monthlyAiBudget"))*100),scanEveryDays:Number(data.get("scanEveryDays")),weeklyDigest:data.get("weeklyDigest")==="on",autoSend:false};
    try{await send("/api/v1/admin/growth/settings","PUT",{expectedVersion:version,settings:next});setMessage("Instellingen opgeslagen.");}
    catch(e){setMessage(e instanceof Error&&!e.message.startsWith("Dat is")?e.message:"Opslaan is niet gelukt. Controleer of alle links met https:// beginnen en de aantallen binnen de grenzen vallen.");}finally{setBusy(false);router.refresh();}}
  return <form className="settings-form" onSubmit={save}>
    <label>Regio's (één per regel; Almere eerst)<textarea name="regions" rows={4} defaultValue={settings.regions.join("\n")} required/></label>
    <label>Zoektermen (één per regel)<textarea name="searchTerms" rows={8} defaultValue={settings.searchTerms.join("\n")} required/></label>
    <label>Maximale afstand vanaf Almere (km)<input name="maxDistanceKm" type="number" min={5} max={250} defaultValue={settings.maxDistanceKm} required/></label>
    <label>Scan uitvoeren elke<select name="scanEveryDays" defaultValue={settings.scanEveryDays}><option value={1}>dag</option><option value={2}>2 dagen</option><option value={7}>week</option></select></label>
    <fieldset className="full sources-fieldset"><legend>Zoekbronnen</legend>
      <label className="check-row"><input type="checkbox" name="news" defaultChecked={settings.sources.news}/>Google News RSS (geen sleutel nodig)</label>
      <label className="check-row"><input type="checkbox" name="brave" defaultChecked={settings.sources.brave}/>Brave Search API {keys.brave?"(sleutel aanwezig)":"(sleutel ontbreekt: BRAVE_SEARCH_API_KEY)"}</label>
      <label className="check-row"><input type="checkbox" name="googleCse" defaultChecked={settings.sources.googleCse}/>Google Programmable Search {keys.googleCse?"(sleutel aanwezig)":"(sleutels ontbreken: GOOGLE_CSE_API_KEY en GOOGLE_CSE_ID)"}</label>
    </fieldset>
    <label className="full">RSS- of Atom-feeds (één https-link per regel)<textarea name="rssFeeds" rows={3} defaultValue={settings.rssFeeds.join("\n")} placeholder="https://www.voorbeeld.nl/nieuws/rss"/></label>
    <label className="full">Evenementenkalenders in iCal-formaat (.ics)<textarea name="icalFeeds" rows={3} defaultValue={settings.icalFeeds.join("\n")} placeholder="https://www.sportvereniging.nl/agenda.ics"/></label>
    <label className="full">Agendapagina's en verenigingssites met schema.org-gegevens<textarea name="pages" rows={3} defaultValue={settings.pages.join("\n")} placeholder="https://www.uitagenda.nl/sport"/></label>
    <label>Zoekopdrachten per scan<input name="maxQueriesPerRun" type="number" min={1} max={40} defaultValue={settings.maxQueriesPerRun} required/></label>
    <label>AI-analyses per scan<input name="maxAnalysesPerRun" type="number" min={0} max={60} defaultValue={settings.maxAnalysesPerRun} required/></label>
    <label>Maximaal AI-budget per maand (€)<input name="monthlyAiBudget" type="number" min={0} max={500} step={1} defaultValue={settings.monthlyAiBudgetCents/100} required/></label>
    <label className="check-row"><input type="checkbox" name="weeklyDigest" defaultChecked={settings.weeklyDigest}/>Wekelijkse samenvatting per e-mail (maandag, alleen naar jouw eigen adres)</label>
    <label className="check-row full"><input type="checkbox" checked={false} disabled readOnly/>Automatisch berichten versturen — staat uit en kan niet worden ingeschakeld. Concepten verstuur je altijd zelf.</label>
    <button type="submit" disabled={busy}>Opslaan</button><p className="notice full muted" role="status">{message}</p>
  </form>;
}
