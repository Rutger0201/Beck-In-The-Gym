import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { isLocale } from "@bitg/core/routes";
import "../global.css";
export default async function RootLayout({children,params}:{children:ReactNode;params:Promise<{locale:string}>}) {
  const {locale}=await params; if(!isLocale(locale))notFound();
  return <html lang={locale} data-theme="dark"><head><meta name="color-scheme" content="dark"/><meta name="theme-color" content="#111310"/></head><body>{children}<script src="/site.js" defer/></body></html>;
}
