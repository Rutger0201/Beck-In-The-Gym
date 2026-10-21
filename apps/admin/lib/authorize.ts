import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ownerCanAccess } from "@bitg/database/contacts";
import { auth } from "./auth";
export async function authorisedOwner(requestHeaders:Headers){
  const result=await auth().api.getSession({headers:requestHeaders});
  if(!result||!result.user.twoFactorEnabled||!await ownerCanAccess(result.user.id))return null;
  return result;
}
export async function requireOwner(){
  const h=await headers();
  const result=await auth().api.getSession({headers:h});
  if(!result)redirect("/login");
  if(!await ownerCanAccess(result.user.id))redirect("/login?denied=1");
  if(!result.user.twoFactorEnabled)redirect("/security");
  return result;
}
