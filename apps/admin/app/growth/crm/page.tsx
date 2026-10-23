import { listGrowth } from "@bitg/database/growth";
import { localDate } from "@bitg/core/marketing/dates";
import { CrmBoard } from "../../../components/CrmBoard";
export const dynamic="force-dynamic";
export default async function Crm(){
  const items=await listGrowth(800);
  return <>
    <div className="mk-head"><div><p className="eyebrow">LEAD & PARTNERSHIP CRM</p><h1>Pipeline.</h1><p>Nieuw → Interessant → Contact opnemen → In gesprek → Gewonnen of Afgewezen. Afgewezen kansen worden na 90 dagen verwijderd.</p></div></div>
    <CrmBoard items={items} today={localDate()}/>
  </>;
}
