import { listOpportunities } from "@bitg/database/marketing";
import { addDays,formatDate,localDate } from "@bitg/core/marketing/dates";
import { scoreWeights } from "@bitg/core/marketing/scoring";
import { ActionButton } from "../../../components/ActionButton";
import { OpportunityBoard } from "../../../components/OpportunityBoard";
export const dynamic="force-dynamic";
export default async function Opportunities(){
  const opportunities=await listOpportunities(),period=opportunities[0]?.period;
  return <>
    <div className="mk-head"><div><p className="eyebrow">MODULE B · OPPORTUNITY SCORING</p><h1>Kansen.</h1><p>{period?`De ${opportunities.length} beste kansen voor ${formatDate(period,{month:"long",year:"numeric"})}.`:"Nog geen kansen geselecteerd."} Score = relevantie {Math.round(scoreWeights.relevance*100)}% · impact {Math.round(scoreWeights.impact*100)}% · uitvoerbaarheid {Math.round(scoreWeights.feasibility*100)}% · kosten {Math.round(scoreWeights.cost*100)}%.</p></div>
      <ActionButton url="/api/v1/admin/marketing/research" label="Kansen vernieuwen" busyLabel="Bezig…" done="{opportunities} kansen bijgewerkt."/></div>
    <OpportunityBoard opportunities={opportunities} tomorrow={addDays(localDate(),1)}/>
  </>;
}
