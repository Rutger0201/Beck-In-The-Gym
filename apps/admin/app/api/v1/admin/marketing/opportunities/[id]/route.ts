import { marketingWrite } from "../../../../../../../lib/marketing-api";
import { opportunityPatchSchema } from "@bitg/core/marketing/validation";
import { updateOpportunity } from "@bitg/database/marketing";
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params;return marketingWrite(request,"opportunity",opportunityPatchSchema,({expectedVersion,...change},actor)=>updateOpportunity(id,change,expectedVersion,actor).then(()=>({ok:true})),id);}
