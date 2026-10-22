import { secretMatches } from "@bitg/core/security";
import { deliverPendingMail,purgeExpiredRequests } from "@bitg/database/mail";
import { runDueJobs } from "@bitg/database/marketing";
export const runtime="nodejs";
export async function POST(request:Request){
  if((process.env.JOBS_SECRET||"").length<32||!secretMatches(request.headers.get("authorization"),process.env.JOBS_SECRET?`Bearer ${process.env.JOBS_SECRET}`:undefined))return Response.json({error:"Unauthorized"},{status:401});
  try{
    const deliveries=await deliverPendingMail();const removed=await purgeExpiredRequests();
    // Marketing research runs only when due and never blocks or fails mail delivery.
    const marketing=await runDueJobs().catch(error=>{console.error("marketing.jobs failed",error instanceof Error?error.name:"unknown");return {research:"failed"};});
    return Response.json({...deliveries,removed,marketing},{headers:{"Cache-Control":"no-store"}});
  }catch{return Response.json({error:"Job processing failed"},{status:503});}
}
