import QRCode from "qrcode";
import { pageUrl } from "@bitg/core/routes";
import { siteConfig } from "../../lib/site";
export async function GET(request:Request){const lang=new URL(request.url).searchParams.get("lang")==="en"?"en":"nl";const svg=await QRCode.toString(`${siteConfig().url}${pageUrl(lang,"card")}`,{type:"svg",margin:2,errorCorrectionLevel:"M",color:{dark:"#151811",light:"#ffffff"}});return new Response(svg,{headers:{"Content-Type":"image/svg+xml; charset=utf-8","Cache-Control":"public, max-age=3600","Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; sandbox"}});}
