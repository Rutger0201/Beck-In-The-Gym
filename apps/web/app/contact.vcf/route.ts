import { buildVcard } from "@bitg/core/security";
import { siteConfig } from "../../lib/site";
export function GET(){const config=siteConfig();return new Response(buildVcard({name:config.name,website:config.url,email:config.email,phone:config.phone}),{headers:{"Content-Type":"text/vcard; charset=utf-8","Content-Disposition":'attachment; filename="beck-in-the-gym.vcf"',"Cache-Control":"public, max-age=3600"}});}
