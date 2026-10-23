import { marketingWrite } from "../../../../../../../../lib/marketing-api";
import { growthNoteSchema } from "@bitg/core/growth/validation";
import { addGrowthNote } from "@bitg/database/growth";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params;return marketingWrite(request,"growth_note",growthNoteSchema,async(input,actor)=>({id:await addGrowthNote(id,input,actor)}),id,16384);}
