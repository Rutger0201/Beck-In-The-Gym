import { marketingWrite } from "../../../../../../lib/marketing-api";
import { runResearch } from "@bitg/database/marketing";
export async function POST(request:Request){return marketingWrite(request,"research",null,(_,actor)=>runResearch("manual",actor));}
