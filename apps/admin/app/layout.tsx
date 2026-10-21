import type { ReactNode } from "react";
import type { Metadata } from "next";
import "./admin.css";
export const metadata:Metadata={title:"Beck Business — contactbeheer",robots:{index:false,follow:false}};
export default function Layout({children}:{children:ReactNode}){return <html lang="nl"><body><div className="admin-brand"><img src="/brand/logo-white.png" width="180" height="101" alt="Beck In The Gym"/><span>BECK BUSINESS</span></div>{children}</body></html>;}
