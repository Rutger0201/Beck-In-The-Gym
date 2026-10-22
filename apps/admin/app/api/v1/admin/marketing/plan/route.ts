import { marketingWrite } from "../../../../../../lib/marketing-api";
import { planRequestSchema } from "@bitg/core/marketing/validation";
import { generatePlan } from "@bitg/database/marketing";
export async function POST(request:Request){return marketingWrite(request,"plan",planRequestSchema,(input,actor)=>generatePlan(actor,input));}
