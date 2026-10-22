"use client";
import { useState } from "react";
import { leadQualities,leadQualityLabels,type LeadQuality } from "@bitg/core/marketing/labels";
type Week={week:string;total:number}&Record<LeadQuality,number>;
const colors:Record<LeadQuality,string>={concrete:"var(--q1)",prospect:"var(--q2)",info:"var(--q3)",general:"var(--q4)"};
const label=(week:string)=>new Intl.DateTimeFormat("nl-NL",{day:"numeric",month:"short",timeZone:"UTC"}).format(new Date(`${week}T00:00:00Z`));
// Stacked weekly bars, best quality at the base. Real contact requests only.
export function LeadChart({weeks}:{weeks:Week[]}){
  const [active,setActive]=useState<Week|null>(null);
  const max=Math.max(4,...weeks.map(w=>w.total)),step=Math.ceil(max/4),top=step*4,width=560,height=180,left=26,bottom=22,plot=height-bottom-6,slot=(width-left)/weeks.length,bar=Math.min(34,slot*.55);
  const y=(value:number)=>6+plot-(value/top)*plot;
  return <figure style={{margin:0}}>
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Contactaanvragen per week, gestapeld naar kwaliteit">
      {[0,1,2,3,4].map(i=><g key={i}><line className="grid" x1={left} x2={width} y1={y(i*step)} y2={y(i*step)}/><text x={left-6} y={y(i*step)+4} textAnchor="end">{i*step}</text></g>)}
      {weeks.map((week,index)=>{const x=left+index*slot+(slot-bar)/2;let base=0;return <g key={week.week} className="week" onMouseEnter={()=>setActive(week)} onMouseLeave={()=>setActive(null)} onFocus={()=>setActive(week)} onBlur={()=>setActive(null)} tabIndex={0}>
        <rect className="hit" x={left+index*slot} y={0} width={slot} height={height-bottom}/>
        {leadQualities.map(quality=>{const value=week[quality];if(!value)return null;const y0=y(base),y1=y(base+value);base+=value;return <rect key={quality} className="seg" x={x} y={y1+1} width={bar} height={Math.max(1,y0-y1-2)} rx={2} fill={colors[quality]}/>;})}
        <text x={left+index*slot+slot/2} y={height-6} textAnchor="middle">{label(week.week)}</text>
      </g>;})}
    </svg>
    <div className="legend">{leadQualities.map(q=><span key={q}><i style={{background:colors[q]}}/>{leadQualityLabels[q]}</span>)}</div>
    <p className="chart-tip" aria-live="polite">{active?`Week van ${label(active.week)}: ${active.total} aanvragen${active.total?` (${leadQualities.filter(q=>active[q]).map(q=>`${active[q]} ${leadQualityLabels[q].toLowerCase()}`).join(", ")})`:""}`:"Beweeg over een week voor details."}</p>
    <details className="more"><summary>Tabelweergave</summary><div className="table-scroll"><table className="runs"><thead><tr><th>Week</th>{leadQualities.map(q=><th key={q}>{leadQualityLabels[q]}</th>)}<th>Totaal</th></tr></thead><tbody>{weeks.map(w=><tr key={w.week}><td>{label(w.week)}</td>{leadQualities.map(q=><td key={q}>{w[q]}</td>)}<td>{w.total}</td></tr>)}</tbody></table></div></details>
  </figure>;
}
