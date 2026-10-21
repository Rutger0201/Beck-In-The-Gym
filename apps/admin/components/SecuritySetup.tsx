"use client";
import { useState,type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "../lib/auth-client";
export function SecuritySetup(){
  const router=useRouter(),[setup,setSetup]=useState<{totpURI:string;backupCodes:string[]}|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setError("");const data=new FormData(event.currentTarget);
    try{if(!setup){const result=await authClient.twoFactor.enable({password:String(data.get("password"))});if(result.error||!result.data)throw new Error();setSetup(result.data);}else{const result=await authClient.twoFactor.verifyTotp({code:String(data.get("code")),trustDevice:false});if(result.error)throw new Error();router.replace("/");router.refresh();}}catch{setError("Instellen is niet gelukt. Controleer je invoer en probeer opnieuw.");}finally{setBusy(false);}}
  const secret=setup?new URL(setup.totpURI).searchParams.get("secret"):null;
  return <form onSubmit={submit}>{!setup?<label>Bevestig je wachtwoord<input type="password" name="password" autoComplete="current-password" required/></label>:<><p>Voeg in je authenticator een account toe voor <strong>Beck Business</strong> met deze sleutel:</p><code className="setup-key">{secret}</code><h2>Herstelcodes</h2><p>Deze codes worden alleen nu getoond. Bewaar ze voordat je verdergaat.</p><pre className="backup-codes">{setup.backupCodes.join("\n")}</pre><label><span><input type="checkbox" required/> Ik heb mijn herstelcodes veilig opgeslagen.</span></label><label>Code uit je authenticator<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required/></label></>}<button disabled={busy}>{busy?"Controleren…":setup?"Beveiliging afronden":"Authenticator instellen"}</button><p role="alert">{error}</p></form>;
}
