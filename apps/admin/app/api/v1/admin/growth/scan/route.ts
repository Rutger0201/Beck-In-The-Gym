import { marketingWrite } from "../../../../../../lib/marketing-api";
import { runGrowthScan } from "@bitg/database/growth";
export async function POST(request:Request){return marketingWrite(request,"growth_scan",null,(_,actor)=>runGrowthScan("manual",actor));}
