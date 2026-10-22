import "server-only";
import { pool } from "./client.ts";
type Delivery={id:string;contact_id:string;kind:"owner"|"receipt";attempts:number;email:string;name:string;locale:string};
function configuration(){
  const key=process.env.BREVO_API_KEY,from=process.env.MAIL_FROM,owner=process.env.CONTACT_RECIPIENT_EMAIL;
  if(!key||!from||!owner||![from,owner].every(v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)))throw new Error("Mail is not configured");
  return{key,from,owner};
}
export async function deliverPendingMail(){
  const config=configuration();
  // A lease survives process crashes. SKIP LOCKED prevents concurrent workers
  // from claiming the same job. The lease must outlast a full batch (10 sends
  // with a 15 s timeout each), or a second worker can re-claim and resend.
  const jobs=await pool("admin").query<Delivery>(`WITH pending AS (SELECT id FROM mail_outbox WHERE sent_at IS NULL AND attempts<8 AND available_at<=now() AND (lease_until IS NULL OR lease_until<now()) ORDER BY available_at FOR UPDATE SKIP LOCKED LIMIT 10), claimed AS (UPDATE mail_outbox AS o SET attempts=attempts+1,lease_until=now()+interval '5 minutes' FROM pending WHERE o.id=pending.id RETURNING o.*) SELECT claimed.id,claimed.contact_id,claimed.kind,claimed.attempts,c.email,c.name,c.locale FROM claimed JOIN contact_requests c ON c.id=claimed.contact_id`);
  let sent=0,failed=0;
  for(const job of jobs.rows){
    const nl=job.locale==="nl";
    const subject=job.kind==="owner"?"Nieuwe kennismakingsaanvraag · Beck In The Gym":nl?"Je aanvraag is ontvangen · Beck In The Gym":"Your request has been received · Beck In The Gym";
    // Fixed templates: submitted free text is never relayed to arbitrary recipients.
    const text=job.kind==="owner"?`Er staat een nieuwe kennismakingsaanvraag klaar in Beck Business.\n\nOpen de beveiligde omgeving: ${process.env.ADMIN_URL}\n\nDe aanvraag is daar te bekijken en op te volgen.`:nl?"Bedankt voor je kennismakingsaanvraag bij Beck In The Gym. Je bericht is ontvangen. Ik neem contact met je op om te bespreken welke begeleiding bij je past.\n\nGroet,\nBeck In The Gym":"Thank you for contacting Beck In The Gym. Your request has been received. I'll get in touch to discuss the coaching that could suit you.\n\nBest wishes,\nBeck In The Gym";
    try{
      const response=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",signal:AbortSignal.timeout(15000),headers:{"api-key":config.key,"Content-Type":"application/json"},body:JSON.stringify({sender:{name:"Beck In The Gym",email:config.from},to:[{email:job.kind==="owner"?config.owner:job.email}],subject,textContent:text,headers:{idempotencyKey:job.id}})});
      if(!response.ok)throw new Error("Provider rejected delivery");
      const result=await response.json() as {messageId?:string};
      await pool("admin").query("UPDATE mail_outbox SET sent_at=now(),lease_until=NULL,provider_id=$1 WHERE id=$2",[result.messageId||null,job.id]);sent++;
    }catch{
      await pool("admin").query("UPDATE mail_outbox SET lease_until=NULL,available_at=now()+make_interval(secs => LEAST(3600,60*power(2,attempts)::integer)) WHERE id=$1",[job.id]);failed++;
    }
  }
  return{sent,failed};
}
export async function mailHealth(){
  const result=await pool("admin").query("SELECT count(*) FILTER (WHERE sent_at IS NULL AND attempts<8) AS pending,count(*) FILTER (WHERE sent_at IS NULL AND attempts>=8) AS failed FROM mail_outbox");
  return{pending:Number(result.rows[0].pending),failed:Number(result.rows[0].failed)};
}
export async function purgeExpiredRequests(){
  // Delete only after the recorded retention deadline; operational metadata
  // contains no submitted message, name or email address.
  const client=await pool("admin").connect();
  try{
    await client.query("BEGIN");
    const deleted=await client.query("DELETE FROM contact_requests WHERE retention_at<=now() RETURNING id");
    await client.query("DELETE FROM rate_limits WHERE expires_at<now()-interval '1 day'");
    await client.query("DELETE FROM auth_session WHERE expires_at<now()");
    await client.query("DELETE FROM auth_verification WHERE expires_at<now()");
    await client.query("DELETE FROM auth_rate_limit WHERE last_request < $1",[Date.now()-86400000]);
    await client.query("COMMIT");return deleted.rowCount||0;
  }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
}
