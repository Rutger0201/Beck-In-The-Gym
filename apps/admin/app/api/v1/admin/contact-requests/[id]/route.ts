import { authorisedOwner } from "../../../../../../lib/authorize";
import { statusSchema } from "@bitg/core/validation";
import { sameOrigin,readLimitedJson } from "@bitg/core/security";
import { changeStatus } from "@bitg/database/contacts";
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    if(!process.env.ADMIN_URL||!sameOrigin(request.headers.get("origin"),process.env.ADMIN_URL))return Response.json({error:"Forbidden"},{status:403});
    const owner=await authorisedOwner(request.headers);if(!owner)return Response.json({error:"Unauthorized"},{status:401});
    const {id}=await params;if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return Response.json({error:"Invalid request"},{status:400});
    const parsed=statusSchema.safeParse(await readLimitedJson(request,1024));if(!parsed.success)return Response.json({error:"Invalid request"},{status:400});
    const changed=await changeStatus(id,parsed.data.status,parsed.data.expectedVersion,owner.user.id);
    return Response.json({updated:changed},{status:changed?200:409});
  }catch{return Response.json({error:"Request failed"},{status:503});}
}
