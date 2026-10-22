import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { locales,pageKeys,slugs,isLocale,resolvePage,pageUrl } from "@bitg/core/routes";
import { copy,pageDescription } from "../../../lib/content";
import { header,footer,pageMarkup } from "../../../lib/render";
import { siteConfig } from "../../../lib/site";
type Props={params:Promise<{locale:string;slug?:string[]}>};
export const dynamicParams=false;
export function generateStaticParams(){return locales.flatMap(locale=>pageKeys.map(page=>({locale,slug:slugs[locale][page]?[slugs[locale][page]]:[]})));}
export async function generateMetadata({params}:Props):Promise<Metadata>{
  const {locale,slug=[]}=await params;if(!isLocale(locale))notFound();const page=resolvePage(locale,slug);if(!page)notFound();
  const config=siteConfig(),title=page==="home"?(locale==="nl"?"Personal trainer Almere | Beck In The Gym":"Personal trainer in Almere | Beck In The Gym"):`${copy(locale).nav[page]} | Beck In The Gym`;
  return {metadataBase:new URL(config.url),title,description:pageDescription(locale,page).slice(0,160),alternates:{canonical:pageUrl(locale,page),languages:{nl:pageUrl("nl",page),en:pageUrl("en",page),"x-default":pageUrl("nl",page)}},robots:config.published&&page!=="card"&&page!=="results"?{index:true,follow:true}:{index:false,follow:false},openGraph:{title,description:pageDescription(locale,page).slice(0,160),url:pageUrl(locale,page),siteName:"Beck In The Gym",locale:locale==="nl"?"nl_NL":"en_GB",type:"website",images:[{url:"/brand/logo-black.jpg",width:1280,height:720,alt:"Beck In The Gym"}]},twitter:{card:"summary_large_image",title}};
}
export default async function Page({params}:Props){
  const {locale,slug=[]}=await params;if(!isLocale(locale))notFound();const page=resolvePage(locale,slug);if(!page)notFound();const config=siteConfig();
  const publicConfig={...config,formAvailable:Boolean(process.env.DATABASE_URL&&process.env.RATE_LIMIT_SECRET&&process.env.CONTACT_RECIPIENT_EMAIL&&process.env.MAIL_FROM&&process.env.BREVO_API_KEY)};
  const analytics=process.env.ANALYTICS_APPROVED==="true"&&/^[a-z0-9-]+$/.test(process.env.GOATCOUNTER_CODE||"")?process.env.GOATCOUNTER_CODE:undefined;
  // No gym address, review, qualification or rating is inferred from the training location.
  const structuredData={"@context":"https://schema.org","@type":"Organization",name:"Beck In The Gym",url:config.url,logo:`${config.url}/brand/logo-white.png`,areaServed:{"@type":"City",name:"Almere"},...(config.verified&&config.email?{email:config.email}:{}),...(config.verified&&config.phone?{telephone:config.phone}:{})};
  return <><div dangerouslySetInnerHTML={{__html:header(locale,page,config.adminUrl)}}/><main id="main" tabIndex={-1} dangerouslySetInnerHTML={{__html:pageMarkup(locale,page,publicConfig)}}/><div dangerouslySetInnerHTML={{__html:footer(locale,publicConfig)}}/>{config.verified&&<script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(structuredData).replace(/</g,"\\u003c")}}/>}{analytics&&<script data-goatcounter={`https://${analytics}.goatcounter.com/count`} data-goatcounter-settings={JSON.stringify({path:pageUrl(locale,page),allow_local:false})} async src="https://gc.zgo.at/count.js"/>}</>;
}
