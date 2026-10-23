import { getGrowthSettings,latestSourceChecks,listGrowthRuns,growthSpendThisMonth } from "@bitg/database/growth";
import { aiStatus } from "@bitg/core/ai/claude";
import { searchKeys } from "@bitg/core/growth/discovery";
import { ActionButton } from "../../../components/ActionButton";
import { GrowthSettingsForm } from "../../../components/GrowthSettingsForm";
export const dynamic="force-dynamic";
const jobs:Record<string,string>={growth:"Scan",growth_digest:"Weekoverzicht",growth_draft:"Concept"},statuses:Record<string,string>={running:"Loopt",succeeded:"Geslaagd",failed:"Mislukt"};
const stamp=(value:string)=>new Date(value).toLocaleString("nl-NL",{timeZone:"Europe/Amsterdam",dateStyle:"short",timeStyle:"short"});
const euro=(cents:number)=>`€${(cents/100).toFixed(2).replace(".",",")}`;
export default async function Settings(){
  const [{settings,version},checks,runs,spent]=await Promise.all([getGrowthSettings(),latestSourceChecks(),listGrowthRuns(20),growthSpendThisMonth()]);
  const keys=searchKeys(),ai=aiStatus(),mail=Boolean(process.env.BREVO_API_KEY&&process.env.MAIL_FROM&&process.env.CONTACT_RECIPIENT_EMAIL);
  const integrations=[
    {name:"Google News RSS",state:settings.sources.news?"Actief":"Uitgeschakeld",ok:settings.sources.news,detail:"Openbare nieuwsfeeds per zoekterm en regio. Alleen titel, link, bron en datum worden gebruikt."},
    {name:"RSS-, iCal- en agendapagina's",state:`${settings.rssFeeds.length+settings.icalFeeds.length+settings.pages.length} ingesteld`,ok:settings.rssFeeds.length+settings.icalFeeds.length+settings.pages.length>0,detail:"Eigen bronnen. robots.txt wordt gerespecteerd, maximaal één verzoek per seconde per site."},
    {name:"PDOK Locatieserver en BRT-kaart",state:"Actief",ok:true,detail:"Open data van de overheid voor locaties en de kaart. Geen sleutel nodig."},
    {name:"AI-analyse (Claude)",state:ai.configured?`Actief · ${ai.model}`:"Niet gekoppeld",ok:ai.configured,detail:ai.configured?"Beoordeelt nieuwe en gewijzigde kansen binnen het maandbudget.":"Stel ANTHROPIC_API_KEY in op de adminserver. Tot die tijd: transparante vuistregels en sjablonen."},
    {name:"Brave Search API",state:keys.brave?(settings.sources.brave?"Actief":"Sleutel aanwezig, uitgeschakeld"):"Sleutel vereist",ok:Boolean(keys.brave&&settings.sources.brave),detail:"Officiële zoek-API (BRAVE_SEARCH_API_KEY). Gratis instapniveau beschikbaar."},
    {name:"Google Programmable Search",state:keys.googleCseKey&&keys.googleCseId?(settings.sources.googleCse?"Actief":"Sleutels aanwezig, uitgeschakeld"):"Sleutels vereist",ok:Boolean(keys.googleCseKey&&keys.googleCseId&&settings.sources.googleCse),detail:"GOOGLE_CSE_API_KEY en GOOGLE_CSE_ID. Google neemt geen nieuwe klanten meer aan voor deze API; Brave is het alternatief."},
    {name:"Wekelijkse e-mail",state:settings.weeklyDigest?(mail?"Actief":"Aan, maar mail niet ingesteld"):"Uitgeschakeld",ok:settings.weeklyDigest&&mail,detail:"Via de bestaande Brevo-koppeling, alleen naar CONTACT_RECIPIENT_EMAIL."},
    {name:"Facebook, Instagram, LinkedIn",state:"Niet beschikbaar",ok:false,detail:"Deze platforms bieden geen toegestane API om openbare evenementen of berichten van anderen te doorzoeken. Er wordt niet gescraped en niet ingelogd. Openbare Facebook-evenementen kunnen wel via zoekresultaten binnenkomen."}
  ];
  return <>
    <div className="mk-head"><div><p className="eyebrow">BRONNEN, AUTOMATISERING EN MONITORING</p><h1>Instellingen.</h1><p>De scan draait {settings.scanEveryDays===1?"dagelijks":`elke ${settings.scanEveryDays} dagen`} mee met de bestaande achtergrondtaak. Er worden nooit automatisch berichten verstuurd.</p></div></div>
    <div className="mk-grid">
      <section className="mk-card span-12"><h2>Koppelingen</h2><p className="sub muted">Welke integraties actief zijn en welke nog toegang vereisen. Sleutels staan alleen in de serveromgeving.</p>
        <div className="integrations">{integrations.map(i=><div key={i.name}><strong>{i.name}</strong><span>{i.detail}</span><br/><span className={`tag${i.ok?" real":""}`} style={{marginTop:8}}>{i.state}</span></div>)}</div></section>
      <section className="mk-card span-8"><h2>Zoekopdrachten en bronnen</h2><p className="sub muted">Zoektermen worden gecombineerd met regio's en rouleren over de dagen, zodat alle combinaties aan bod komen.</p><GrowthSettingsForm settings={settings} version={version} keys={{brave:Boolean(keys.brave),googleCse:Boolean(keys.googleCseKey&&keys.googleCseId)}}/></section>
      <section className="mk-card span-4"><h2>AI-kosten deze maand</h2><p className="kpi"><span className="value">{euro(spent)}</span><span className="note">budget {euro(settings.monthlyAiBudgetCents)} · daarna worden kansen met vuistregels beoordeeld en concepten als sjabloon gemaakt</span></p>
        <h2 style={{marginTop:24}}>Privacy (AVG)</h2><ul className="rationale" style={{color:"var(--text)"}}><li>Alleen organisaties, evenementen en openbare pagina's; geen profielen van privépersonen.</li><li>Persoonlijke socialemediaprofielen en gezondheidsinformatie van personen worden niet opgeslagen.</li><li>E-mailadressen en telefoonnummers uit bronnen worden verwijderd.</li><li>Openbare hulpvragen worden na 30 dagen verwijderd, afgewezen kansen na 90 dagen, onaangeraakte kansen na 120 dagen.</li></ul></section>
      <section className="mk-card span-12"><h2>Bronstatus</h2><p className="sub muted">Laatste controle per bron (14 dagen). Mislukte bronnen worden bij de volgende scan opnieuw geprobeerd; elke aanvraag krijgt tot 3 pogingen.</p>
        {checks.length?<div className="table-scroll"><table className="runs"><thead><tr><th>Bron</th><th>Laatste controle</th><th>Status</th><th>Items</th><th>Duur</th></tr></thead><tbody>{checks.sort((a,b)=>Number(a.ok)-Number(b.ok)||a.label.localeCompare(b.label)).map(c=><tr key={c.key}><td>{c.label}</td><td>{stamp(c.checked_at)}</td><td><span className={`tag ${c.ok?"status-approved":"status-rejected"}`}>{c.ok?"OK":"Fout"}</span>{c.error&&<span className="small muted"> {c.error}</span>}</td><td>{c.items}</td><td>{(c.ms/1000).toFixed(1)} s</td></tr>)}</tbody></table></div>:<div className="empty-mk"><p>Nog geen bronnen gecontroleerd.</p></div>}</section>
      <section className="mk-card span-12"><h2>Runs en logging</h2><p className="sub muted">Elke scan, weekoverzicht en AI-concept wordt vastgelegd. Een vastgelopen scan wordt na tien minuten vrijgegeven.</p>
        <div className="btn-row" style={{marginBottom:12}}><ActionButton url="/api/v1/admin/growth/scan" label="Nu scannen" busyLabel="Bezig…" secondary done="{found} resultaten verwerkt, {added} nieuw."/></div>
        <div className="table-scroll"><table className="runs"><thead><tr><th>Gestart</th><th>Taak</th><th>Aanleiding</th><th>Status</th><th>Resultaat</th><th>Kosten</th></tr></thead><tbody>{runs.map(run=><tr key={run.id}><td>{stamp(run.started_at)}</td><td>{jobs[run.job]||run.job}</td><td>{run.trigger==="manual"?"Handmatig":"Gepland"}</td><td><span className={`tag ${run.status==="succeeded"?"status-approved":run.status==="failed"?"status-rejected":""}`}>{statuses[run.status]||run.status}</span></td><td className="small">{run.error||Object.entries(run.stats).filter(([,v])=>v).map(([k,v])=>`${k}: ${v}`).join(" · ")}</td><td>{euro(run.cost_cents)}</td></tr>)}</tbody></table></div>
        {!runs.length&&<div className="empty-mk"><p>Nog geen runs.</p></div>}</section>
    </div>
  </>;
}
