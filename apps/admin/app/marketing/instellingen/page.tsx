import { getSettings,listRuns,costSummary } from "@bitg/database/marketing";
import { integrations } from "@bitg/core/marketing/labels";
import { ActionButton } from "../../../components/ActionButton";
import { SettingsForm } from "../../../components/SettingsForm";
export const dynamic="force-dynamic";
const jobs={research:"Research",plan:"Planning"},statuses={running:"Loopt",succeeded:"Geslaagd",failed:"Mislukt"};
export default async function Settings(){
  const [{settings,version},runs,cost]=await Promise.all([getSettings(),listRuns(15),costSummary()]);
  return <>
    <div className="mk-head"><div><p className="eyebrow">AUTOMATISERING EN KOPPELINGEN</p><h1>Instellingen.</h1><p>Dagelijkse research draait zelfstandig mee met de geplande achtergrondtaak. Publicaties, advertenties en betaalde acties blijven altijd onder jouw controle.</p></div></div>
    <div className="mk-grid">
      <section className="mk-card span-7"><h2>Planning en frequentie</h2><p className="sub muted">De planner houdt zich aan dit tijdsbudget, zodat de kalender haalbaar blijft.</p><SettingsForm settings={settings} version={version}/></section>
      <section className="mk-card span-5"><h2>Kosten deze maand</h2><p className="sub muted">AI- en API-kosten per run worden hier opgeteld.</p><p className="kpi"><span className="value">€{(cost.cents/100).toFixed(2).replace(".",",")}</span><span className="note">{cost.runs} runs deze maand · de huidige bronnen zijn gratis; AI-kosten verschijnen na koppeling in fase 3</span></p></section>
      <section className="mk-card span-12"><h2>Achtergrondtaken</h2><p className="sub muted">Elke run wordt vastgelegd. Een vastgelopen run wordt na vijf minuten vrijgegeven en kan opnieuw starten.</p>
        <div className="btn-row" style={{marginBottom:12}}><ActionButton url="/api/v1/admin/marketing/research" label="Research opnieuw starten" busyLabel="Bezig…" secondary done="{items} signalen verwerkt."/></div>
        <div className="table-scroll"><table className="runs"><thead><tr><th>Gestart</th><th>Taak</th><th>Aanleiding</th><th>Status</th><th>Resultaat</th><th>Kosten</th></tr></thead><tbody>{runs.map(run=><tr key={run.id}><td>{new Date(run.started_at).toLocaleString("nl-NL",{timeZone:"Europe/Amsterdam",dateStyle:"short",timeStyle:"short"})}</td><td>{jobs[run.job]}</td><td>{run.trigger==="manual"?"Handmatig":"Gepland"}</td><td><span className={`tag ${run.status==="succeeded"?"status-approved":run.status==="failed"?"status-rejected":""}`}>{statuses[run.status as keyof typeof statuses]||run.status}</span></td><td className="small">{run.error||Object.entries(run.stats).map(([k,v])=>`${k}: ${v}`).join(" · ")}</td><td>€{(run.cost_cents/100).toFixed(2).replace(".",",")}</td></tr>)}</tbody></table></div>
        {!runs.length&&<div className="empty-mk"><p>Nog geen runs.</p></div>}</section>
      <section className="mk-card span-12"><h2>Koppelingen</h2><p className="sub muted">Alleen officiële API's. Sleutels worden uitsluitend server-side opgeslagen.</p><div className="integrations">{integrations.map(i=><div key={i.id}><strong>{i.name}</strong><span>{i.detail}</span><br/><span className="tag" style={{marginTop:8}}>Niet gekoppeld · fase {i.phase}</span></div>)}</div></section>
    </div>
  </>;
}
