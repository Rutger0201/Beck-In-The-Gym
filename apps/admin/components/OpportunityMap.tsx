"use client";
import { useEffect,useMemo,useRef,useState,type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { homeBase,project,unproject,type Point } from "@bitg/core/growth/geo";
import { growthCategories,growthCategoryLabels,geoPrecisionLabels,type GeoPrecision,type GrowthCategory } from "@bitg/core/growth/labels";
import { growthBand } from "@bitg/core/growth/scoring";
export type MapPoint={id:string;title:string;lat:number;lon:number;score:number;category:GrowthCategory;precision:GeoPrecision;place:string|null;date:string|null};
// PDOK BRT-Achtergrondkaart (Kadaster, open data, no key). Tiles are darkened with a CSS filter to match the admin theme.
const tileUrl=(z:number,x:number,y:number)=>`https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/grijs/EPSG:3857/${z}/${x}/${y}.png`;
const minZoom=7,maxZoom=15;
type Group={key:string;lat:number;lon:number;items:MapPoint[];best:number;exact:boolean};
export function OpportunityMap({points,height=440}:{points:MapPoint[];height?:number}){
  const box=useRef<HTMLDivElement>(null),drag=useRef<{x:number;y:number;cx:number;cy:number;moved:boolean}|null>(null);
  const [width,setWidth]=useState(640),[view,setView]=useState<{center:Point;zoom:number}>({center:homeBase,zoom:9}),[open,setOpen]=useState<string|null>(null);
  const [shown,setShown]=useState<Set<GrowthCategory>>(()=>new Set(growthCategories));
  useEffect(()=>{const el=box.current;if(!el)return;const observer=new ResizeObserver(([entry])=>setWidth(Math.max(240,Math.round(entry.contentRect.width))));observer.observe(el);return()=>observer.disconnect();},[]);
  useEffect(()=>{const el=box.current;if(!el)return;const wheel=(e:WheelEvent)=>{e.preventDefault();setView(v=>({...v,zoom:Math.min(maxZoom,Math.max(minZoom,v.zoom+(e.deltaY<0?1:-1)))}));};el.addEventListener("wheel",wheel,{passive:false});return()=>el.removeEventListener("wheel",wheel);},[]);
  const visible=points.filter(p=>shown.has(p.category));
  // Items at the same coordinates (place-level precision) share one marker with a count.
  const groups=useMemo(()=>{const map=new Map<string,Group>();for(const p of visible){const key=`${p.lat.toFixed(4)},${p.lon.toFixed(4)}`,g=map.get(key);if(g){g.items.push(p);g.best=Math.max(g.best,p.score);g.exact||=p.precision!=="place";}else map.set(key,{key,lat:p.lat,lon:p.lon,items:[p],best:p.score,exact:p.precision!=="place"});}return [...map.values()].sort((a,b)=>a.best-b.best);},[visible]);
  const center=project(view.center,view.zoom),origin={x:center.x-width/2,y:center.y-height/2},n=2**view.zoom,tiles:{key:string;src:string;left:number;top:number}[]=[];
  for(let tx=Math.floor(origin.x/256);tx<=Math.floor((origin.x+width)/256);tx++)for(let ty=Math.floor(origin.y/256);ty<=Math.floor((origin.y+height)/256);ty++){if(ty<0||ty>=n)continue;tiles.push({key:`${view.zoom}/${tx}/${ty}`,src:tileUrl(view.zoom,((tx%n)+n)%n,ty),left:tx*256-origin.x,top:ty*256-origin.y});}
  function down(e:ReactPointerEvent<HTMLDivElement>){if((e.target as HTMLElement).closest("button,a"))return;drag.current={x:e.clientX,y:e.clientY,cx:center.x,cy:center.y,moved:false};e.currentTarget.setPointerCapture(e.pointerId);}
  function move(e:ReactPointerEvent<HTMLDivElement>){const d=drag.current;if(!d)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.abs(dx)+Math.abs(dy)>3)d.moved=true;setView(v=>({...v,center:unproject({x:d.cx-dx,y:d.cy-dy},v.zoom)}));}
  function up(){if(drag.current&&!drag.current.moved)setOpen(null);drag.current=null;}
  function fit(){if(!groups.length){setView({center:homeBase,zoom:9});return;}const lats=groups.map(g=>g.lat),lons=groups.map(g=>g.lon),c={lat:(Math.min(...lats)+Math.max(...lats))/2,lon:(Math.min(...lons)+Math.max(...lons))/2};let zoom=maxZoom;while(zoom>minZoom){const a=project({lat:Math.max(...lats),lon:Math.min(...lons)},zoom),b=project({lat:Math.min(...lats),lon:Math.max(...lons)},zoom);if(b.x-a.x<width-80&&b.y-a.y<height-80)break;zoom--;}setView({center:c,zoom:Math.min(zoom,12)});}
  const zoomBy=(step:number)=>setView(v=>({...v,zoom:Math.min(maxZoom,Math.max(minZoom,v.zoom+step))}));
  const home=project(homeBase,view.zoom),active=groups.find(g=>g.key===open);
  return <figure className="gmap-wrap">
    <div className="gmap-filters" role="group" aria-label="Categorieën op de kaart">{growthCategories.map(c=><button key={c} type="button" className={`chip-toggle cat-${c}`} aria-pressed={shown.has(c)} onClick={()=>setShown(s=>{const next=new Set(s);if(next.has(c))next.delete(c);else next.add(c);return next;})}><i/>{growthCategoryLabels[c]}</button>)}</div>
    <div ref={box} className="gmap" style={{height}} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={()=>{drag.current=null;}} role="application" aria-label="Interactieve kaart met kansen. Sleep om te verschuiven, scroll of gebruik de knoppen om te zoomen.">
      <div className="gmap-tiles" aria-hidden="true">{tiles.map(t=><img key={t.key} src={t.src} alt="" width={256} height={256} draggable={false} style={{left:t.left,top:t.top}} onError={e=>{e.currentTarget.style.visibility="hidden";}}/>)}</div>
      <span className="gmap-home" style={{left:home.x-origin.x,top:home.y-origin.y}} title="BITG, Almere" aria-hidden="true"/>
      {groups.map(g=>{const p=project(g,view.zoom);const x=p.x-origin.x,y=p.y-origin.y;if(x<-20||y<-20||x>width+20||y>height+20)return null;return <button key={g.key} type="button" className={`gmap-marker ${growthBand(g.best)}${g.exact?"":" approx"}${open===g.key?" open":""}`} style={{left:x,top:y}} onClick={()=>setOpen(open===g.key?null:g.key)} aria-label={`${g.items.length} ${g.items.length===1?"kans":"kansen"} bij ${g.items[0].place||"deze locatie"}, hoogste score ${g.best}`}>{g.items.length>1?g.items.length:g.best}</button>;})}
      {active&&(()=>{const p=project(active,view.zoom);return <div className="gmap-pop" style={{left:Math.min(Math.max(8,p.x-origin.x-130),width-268),top:Math.max(8,p.y-origin.y+18)}}>
        <p className="small muted" style={{margin:"0 0 6px"}}>{active.items[0].place||"Locatie"} · {geoPrecisionLabels[active.items[0].precision]}</p>
        <ul>{active.items.sort((a,b)=>b.score-a.score).slice(0,6).map(i=><li key={i.id}><Link href={`/growth/${i.id}`}><strong>{i.score}</strong> {i.title}</Link><span className="small muted">{growthCategoryLabels[i.category]}{i.date?` · ${i.date}`:""}</span></li>)}</ul>
        {active.items.length>6&&<p className="small muted" style={{margin:"6px 0 0"}}>en {active.items.length-6} meer op deze plek</p>}</div>;})()}
      <div className="gmap-controls"><button type="button" onClick={()=>zoomBy(1)} aria-label="Inzoomen">+</button><button type="button" onClick={()=>zoomBy(-1)} aria-label="Uitzoomen">−</button><button type="button" onClick={fit} aria-label="Alle kansen tonen">⤢</button></div>
      <span className="gmap-attrib">Kaart: © Kadaster / PDOK</span>
    </div>
    <figcaption className="legend"><span><i className="dot hoog"/>Score 70+</span><span><i className="dot middel"/>50–69</span><span><i className="dot laag"/>&lt;50</span><span><i className="dot ring"/>Locatie op plaatsniveau</span><span>{visible.length} van {points.length} kansen met locatie</span></figcaption>
  </figure>;
}
