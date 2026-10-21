import { randomUUID } from "node:crypto";
import { contactSchema } from "@bitg/core/validation";
import { sameOrigin,rateKey,networkIdentity,readLimitedJson,rejectLargeBody } from "@bitg/core/security";
import { submitContact } from "@bitg/database/contacts";
import { siteConfig } from "../../../../lib/site";
import { copy } from "../../../../lib/content";
export const runtime="nodejs";
export async function POST(request:Request){
  const json=request.headers.get("content-type")?.includes("application/json");
  let locale:"nl"|"en"="nl";
  const respond=(status:number,message:string)=>{
    if(json)return Response.json({message},{status,headers:{"Cache-Control":"no-store",...(status===429?{"Retry-After":"600"}:{})}});
    const text=copy(locale).form;
    const safe=message.replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[ch]!);
    return new Response(`<!doctype html><html lang="${locale}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Beck In The Gym</title><body><main style="font:18px/1.7 system-ui;max-width:650px;margin:12vh auto;padding:25px"><h1>${status===202?text.successTitle:"Beck In The Gym"}</h1><p>${safe}</p><a href="${locale==="en"?"/en/contact":"/contact"}">${locale==="en"?"Back to contact":"Terug naar contact"}</a></main></body></html>`,{status,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}});
  };
  if(!sameOrigin(request.headers.get("origin"),siteConfig().url))return respond(403,"Request not permitted.");
  if(!process.env.DATABASE_URL||!process.env.RATE_LIMIT_SECRET||!process.env.CONTACT_RECIPIENT_EMAIL||!process.env.MAIL_FROM||!process.env.BREVO_API_KEY)return respond(503,copy(locale).form.unavailable);
  try{
    let body:unknown;
    if(json)body=await readLimitedJson(request);
    else if(request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")){
      // Use the same streaming size limit as the JSON endpoint, including requests
      // without Content-Length. Multipart/file uploads are not accepted.
      if(rejectLargeBody(request)||!request.body)return respond(400,copy(locale).form.invalid);
      const reader=request.body.getReader();let raw="",bytes=0;const decoder=new TextDecoder();
      try{while(true){const result=await reader.read();if(result.done)break;bytes+=result.value.byteLength;if(bytes>8192){await reader.cancel();return respond(400,copy(locale).form.invalid);}raw+=decoder.decode(result.value,{stream:true});}raw+=decoder.decode();}finally{reader.releaseLock();}
      body={...Object.fromEntries(new URLSearchParams(raw)),requestId:randomUUID()};
    }else return respond(415,"Unsupported content type.");
    if(body&&typeof body==="object"&&"locale" in body&&body.locale==="en")locale="en";
    const parsed=contactSchema.safeParse(body);
    if(!parsed.success)return respond(400,copy(locale).form.invalid);
    if(parsed.data.website)return respond(202,copy(locale).form.success);
    const key=rateKey(networkIdentity(request.headers,process.env.TRUST_PROXY==="true"),process.env.RATE_LIMIT_SECRET);
    const accepted=await submitContact(parsed.data,key);
    return respond(accepted?202:429,accepted?copy(locale).form.success:copy(locale).form.limited);
  }catch{
    // Never log submitted fields, database URLs or provider error payloads.
    console.error("Contact submission failed");
    return respond(503,copy(locale).form.error);
  }
}
