import { marketingWrite } from "../../../../../../../../lib/marketing-api";
import { growthDraftRequestSchema } from "@bitg/core/growth/validation";
import { createGrowthDraft } from "@bitg/database/growth";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params;return marketingWrite(request,"growth_draft",growthDraftRequestSchema,(input,actor)=>createGrowthDraft(id,input,actor),id);}
