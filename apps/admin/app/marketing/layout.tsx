import type { ReactNode } from "react";
import type { Metadata } from "next";
import { requireOwner } from "../../lib/authorize";
import { MarketingNav } from "../../components/MarketingNav";
import "./marketing.css";
export const metadata:Metadata={title:"Beck Business — marketing",robots:{index:false,follow:false}};
export const dynamic="force-dynamic";
export default async function MarketingLayout({children}:{children:ReactNode}){await requireOwner();return <main className="mk"><MarketingNav/>{children}</main>;}
