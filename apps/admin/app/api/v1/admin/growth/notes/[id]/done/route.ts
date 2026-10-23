import { marketingWrite } from "../../../../../../../../lib/marketing-api";
import { completeGrowthNote } from "@bitg/database/growth";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params;return marketingWrite(request,"growth_note_done",null,(_,actor)=>completeGrowthNote(id,actor),id);}
