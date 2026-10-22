import { marketingWrite } from "../../../../../../lib/marketing-api";
import { settingsRequestSchema } from "@bitg/core/marketing/validation";
import { saveSettings } from "@bitg/database/marketing";
export async function PUT(request:Request){return marketingWrite(request,"settings",settingsRequestSchema,async(input,actor)=>({version:await saveSettings(input.settings,input.expectedVersion,actor)}));}
