import type { MetadataRoute } from "next";
import { locales,pageKeys,pageUrl } from "@bitg/core/routes";
import { siteConfig } from "../lib/site";
export default function sitemap():MetadataRoute.Sitemap{const {url,published}=siteConfig();if(!published)return [];return locales.flatMap(locale=>pageKeys.filter(page=>page!=="card"&&page!=="results").map(page=>({url:`${url}${pageUrl(locale,page)}`,alternates:{languages:{nl:`${url}${pageUrl("nl",page)}`,en:`${url}${pageUrl("en",page)}`}}})));}
