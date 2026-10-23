import type { ReactNode } from "react";
import type { Metadata } from "next";
import { requireOwner } from "../../lib/authorize";
import { GrowthNav } from "../../components/GrowthNav";
import "../marketing/marketing.css";
import "./growth.css";
export const metadata:Metadata={title:"Beck Business — Growth Pipeline",robots:{index:false,follow:false}};
export const dynamic="force-dynamic";
export default async function GrowthLayout({children}:{children:ReactNode}){await requireOwner();return <main className="mk growth"><GrowthNav/>{children}</main>;}
