import { marketingWrite } from "../../../../../../../lib/marketing-api";
import { calendarPatchSchema } from "@bitg/core/marketing/validation";
import { updateCalendarItem } from "@bitg/database/marketing";
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params;return marketingWrite(request,"calendar",calendarPatchSchema,async({expectedVersion,...change},actor)=>({version:await updateCalendarItem(id,change,expectedVersion,actor)}),id);}
