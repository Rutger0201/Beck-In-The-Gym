"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
const links=[["/growth","Overzicht"],["/growth/kansen","Opportunity feed"],["/growth/crm","Leads & CRM"],["/growth/instellingen","Bronnen & instellingen"]] as const;
export function GrowthNav(){const path=usePathname();return <nav className="mk-nav" aria-label="Growth Pipeline">{links.map(([href,label])=><Link key={href} href={href} aria-current={path===href||(href==="/growth/kansen"&&/^\/growth\/[0-9a-f-]{36}$/.test(path))?"page":undefined}>{label}</Link>)}<Link className="mk-nav-back" href="/marketing">Marketing</Link><Link href="/">Contactaanvragen</Link></nav>;}
