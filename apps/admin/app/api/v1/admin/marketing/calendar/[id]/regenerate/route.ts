import { marketingWrite } from "../../../../../../../../lib/marketing-api";
import { regenerateSchema } from "@bitg/core/marketing/validation";
import { regenerateCalendarItem } from "@bitg/database/marketing";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params;return marketingWrite(request,"regenerate",regenerateSchema,async(input,actor)=>({title:await regenerateCalendarItem(id,input.expectedVersion,actor)}),id);}
