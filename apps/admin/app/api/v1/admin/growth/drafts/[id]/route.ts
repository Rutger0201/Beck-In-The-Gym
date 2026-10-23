import { marketingWrite } from "../../../../../../../lib/marketing-api";
import { growthDraftPatchSchema } from "@bitg/core/growth/validation";
import { updateGrowthDraft } from "@bitg/database/growth";
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params;return marketingWrite(request,"growth_draft_update",growthDraftPatchSchema,async({expectedVersion,...change},actor)=>({version:await updateGrowthDraft(id,change,expectedVersion,actor)}),id,32768);}
