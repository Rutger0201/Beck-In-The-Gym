import { listCalendar,getSettings } from "@bitg/database/marketing";
import { addDays,isValidDate,localDate,startOfMonth,startOfWeek } from "@bitg/core/marketing/dates";
import { ActionButton } from "../../../components/ActionButton";
import { MarketingCalendar } from "../../../components/MarketingCalendar";
export const dynamic="force-dynamic";
type Props={searchParams:Promise<{d?:string;v?:string}>};
export default async function Calendar({searchParams}:Props){
  const params=await searchParams,today=localDate(),anchor=params.d&&isValidDate(params.d)?params.d:today,view=params.v==="week"||params.v==="day"?params.v:"month";
  const from=view==="month"?startOfWeek(startOfMonth(anchor)):view==="week"?startOfWeek(anchor):anchor,to=addDays(from,view==="month"?41:view==="week"?6:0);
  const [items,{settings}]=await Promise.all([listCalendar(from,to),getSettings()]);
  return <>
    <div className="mk-head"><div><p className="eyebrow">MODULE D · MARKETINGKALENDER</p><h1>Kalender.</h1><p>Voorstel voor {settings.postsPerWeek} berichten per week, maximaal {Math.round(settings.weeklyMinutes/6)/10} uur per week. Goedgekeurde berichten blijven staan bij een nieuwe planning.</p></div>
      <ActionButton url="/api/v1/admin/marketing/plan" label="Nieuwe 30-dagenplanning" busyLabel="Planning maken…" done="{planned} concepten gepland, {kept} dagen behouden."/></div>
    <MarketingCalendar items={items} anchor={anchor} view={view} today={today}/>
  </>;
}
