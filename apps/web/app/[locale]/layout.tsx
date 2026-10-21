import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { isLocale } from "@bitg/core/routes";
import "../global.css";
const themeScript = "try{var t=localStorage.getItem('bitg-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}";
export default async function RootLayout({children,params}:{children:ReactNode;params:Promise<{locale:string}>}) {
  const {locale}=await params; if(!isLocale(locale))notFound();
  return <html lang={locale} suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:themeScript}}/><meta name="color-scheme" content="light dark"/></head><body>{children}<script src="/site.js" defer/></body></html>;
}
