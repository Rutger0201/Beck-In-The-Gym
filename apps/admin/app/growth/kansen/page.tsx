import { listGrowth } from "@bitg/database/growth";
import { growthWeights } from "@bitg/core/growth/scoring";
import { growthFactorLabels,growthFactors } from "@bitg/core/growth/labels";
import { localDate } from "@bitg/core/marketing/dates";
import { ActionButton } from "../../../components/ActionButton";
import { GrowthFeed } from "../../../components/GrowthFeed";
export const dynamic="force-dynamic";
export default async function Feed(){
  const items=await listGrowth();
  return <>
    <div className="mk-head"><div><p className="eyebrow">OPPORTUNITY FEED</p><h1>Kansen.</h1><p>Opportunity Score 0–100 = {growthFactors.map(f=>`${growthFactorLabels[f].toLowerCase()} ${Math.round(growthWeights[f]*100)}%`).join(" · ")}.</p></div>
      <ActionButton url="/api/v1/admin/growth/scan" label="Nu scannen" busyLabel="Bezig met scannen…" done="{added} nieuw, {updated} bijgewerkt."/></div>
    <GrowthFeed items={items} today={localDate()}/>
  </>;
}
