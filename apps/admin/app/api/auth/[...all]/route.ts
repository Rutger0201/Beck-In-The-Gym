import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "../../../../lib/auth";
export const runtime="nodejs";
export async function GET(request:Request){try{return await toNextJsHandler(auth()).GET(request);}catch{return Response.json({error:"Authentication unavailable"},{status:503});}}
export async function POST(request:Request){try{return await toNextJsHandler(auth()).POST(request);}catch{return Response.json({error:"Authentication unavailable"},{status:503});}}
