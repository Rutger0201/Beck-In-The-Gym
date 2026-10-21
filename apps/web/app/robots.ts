import type { MetadataRoute } from "next";
import { siteConfig } from "../lib/site";
export default function robots():MetadataRoute.Robots{const site=siteConfig();return site.published?{rules:{userAgent:"*",allow:"/",disallow:["/api/","/visitekaartje","/en/business-card"]},sitemap:`${site.url}/sitemap.xml`}:{rules:{userAgent:"*",disallow:"/"}};}
