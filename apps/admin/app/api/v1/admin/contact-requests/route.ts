import { authorisedOwner } from "../../../../../lib/authorize";
import { contactStatuses } from "@bitg/core/validation";
import { listContacts } from "@bitg/database/contacts";
export async function GET(request:Request){
  try{if(!await authorisedOwner(request.headers))return Response.json({error:"Unauthorized"},{status:401});const status=new URL(request.url).searchParams.get("status");if(status&&!contactStatuses.includes(status as typeof contactStatuses[number]))return Response.json({error:"Invalid status"},{status:400});return Response.json({requests:await listContacts(status||undefined)},{headers:{"Cache-Control":"private, no-store"}});}catch{return Response.json({error:"Request failed"},{status:503});}
}
