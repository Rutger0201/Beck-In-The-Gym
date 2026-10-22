"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
const messages:Record<number,string>={409:"Dit is intussen gewijzigd. Het overzicht is vernieuwd.",429:"Er loopt al een run of er is net een gestart. Probeer het zo opnieuw.",401:"Je sessie is verlopen. Log opnieuw in."};
export async function send(url:string,method:string,body?:unknown){const response=await fetch(url,{method,headers:{"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)});if(!response.ok)throw new Error(messages[response.status]||"Dat is niet gelukt. Probeer het opnieuw.");return response.json();}
export function ActionButton({url,label,busyLabel,body,secondary,done}:{url:string;label:string;busyLabel:string;body?:unknown;secondary?:boolean;done?:string}){
  const router=useRouter(),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  async function run(){setBusy(true);setMessage("");try{const result=await send(url,"POST",body??{});setMessage(done?done.replace(/\{(\w+)\}/g,(_,key)=>String(result[key]??"")):"Klaar.");router.refresh();}catch(error){setMessage(error instanceof Error?error.message:"Dat is niet gelukt.");}finally{setBusy(false);}}
  return <span className="btn-row"><button type="button" className={secondary?"secondary small":"small"} disabled={busy} onClick={run}>{busy?busyLabel:label}</button><span className="notice muted" role="status">{message}</span></span>;
}
