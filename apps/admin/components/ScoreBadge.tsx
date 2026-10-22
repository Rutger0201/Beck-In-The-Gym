import { priorityBand } from "@bitg/core/marketing/scoring";
export function ScoreBadge({score,big}:{score:number;big?:boolean}){return <span className={`score ${priorityBand(score)}${big?" big":""}`} style={{"--s":score} as React.CSSProperties} title={`Prioriteitsscore ${score} van 100 (${priorityBand(score)})`}><span>{score}</span></span>;}
