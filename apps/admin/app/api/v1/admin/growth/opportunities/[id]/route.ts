import { marketingWrite } from "../../../../../../../lib/marketing-api";
import { growthPatchSchema } from "@bitg/core/growth/validation";
import { updateGrowth } from "@bitg/database/growth";
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params;return marketingWrite(request,"growth_opportunity",growthPatchSchema,async({expectedVersion,...change},actor)=>({version:await updateGrowth(id,change,expectedVersion,actor)}),id);}
