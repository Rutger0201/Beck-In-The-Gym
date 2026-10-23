import { marketingWrite } from "../../../../../../lib/marketing-api";
import { growthSettingsRequestSchema } from "@bitg/core/growth/validation";
import { saveGrowthSettings } from "@bitg/database/growth";
export async function PUT(request:Request){return marketingWrite(request,"growth_settings",growthSettingsRequestSchema,async(input,actor)=>({version:await saveGrowthSettings(input.settings,input.expectedVersion,actor)}),undefined,65536);}
