"use client";
import { useState,type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "../lib/auth-client";
export function LoginForm(){
  const router=useRouter(),[step,setStep]=useState<"password"|"totp"|"backup">("password"),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setError("");const data=new FormData(event.currentTarget);
    try{
      if(step==="password"){
        const result=await authClient.signIn.email({email:String(data.get("email")),password:String(data.get("password"))});
        if(result.error)throw new Error();
        if(result.data&&"twoFactorRedirect" in result.data&&result.data.twoFactorRedirect){setStep("totp");return;}
      }else{
        const code=String(data.get("code"));
        const result=step==="backup"?await authClient.twoFactor.verifyBackupCode({code}):await authClient.twoFactor.verifyTotp({code,trustDevice:false});
        if(result.error)throw new Error();
      }
      router.replace("/");router.refresh();
    }catch{setError("Inloggen is niet gelukt. Controleer je gegevens en probeer opnieuw.");}finally{setBusy(false);}
  }
  return <form onSubmit={submit}>{step==="password"?<><label>E-mailadres<input name="email" type="email" autoComplete="username" required/></label><label>Wachtwoord<input name="password" type="password" autoComplete="current-password" required/></label></>:<label>{step==="backup"?"Herstelcode":"Code uit je authenticator"}<input key={step} name="code" autoComplete="one-time-code" inputMode={step==="totp"?"numeric":"text"} pattern={step==="totp"?"[0-9]{6}":undefined} required/></label>}<button disabled={busy}>{busy?"Controleren…":"Inloggen"}</button>{step!=="password"&&<button className="secondary" type="button" onClick={()=>setStep(step==="backup"?"totp":"backup")}>{step==="backup"?"Gebruik authenticator":"Gebruik een herstelcode"}</button>}<p role="alert">{error}</p></form>;
}
