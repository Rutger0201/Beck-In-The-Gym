import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { twoFactor } from "better-auth/plugins";
import { database } from "@bitg/database/client";
import * as schema from "@bitg/database/schema";
function createAuth(){
  const secret=process.env.BETTER_AUTH_SECRET;
  if(!secret||secret.length<32||!process.env.ADMIN_URL)throw new Error("Authentication is not configured");
  if(process.env.NODE_ENV==="production"&&new URL(process.env.ADMIN_URL).protocol!=="https:")throw new Error("ADMIN_URL must use HTTPS");
  return betterAuth({
    appName:"Beck Business",baseURL:process.env.ADMIN_URL,secret,
    database:drizzleAdapter(database(),{provider:"pg",schema}),
    trustedOrigins:[new URL(process.env.ADMIN_URL).origin],
    emailAndPassword:{enabled:true,disableSignUp:true,minPasswordLength:14,maxPasswordLength:128},
    session:{expiresIn:60*60*8,updateAge:60*15,freshAge:60*10},
    rateLimit:{enabled:true,storage:"database",window:60,max:10},
    plugins:[twoFactor({issuer:"Beck Business"})],
    advanced:{useSecureCookies:process.env.NODE_ENV==="production",defaultCookieAttributes:{sameSite:"lax",httpOnly:true},crossSubDomainCookies:{enabled:false}},
    logger:{disabled:process.env.NODE_ENV==="production"}
  });
}
let instance:ReturnType<typeof createAuth>|undefined;
export function auth(){return instance??=createAuth();}
