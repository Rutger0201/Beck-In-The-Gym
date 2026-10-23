"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
const links=[["/marketing","Overzicht"],["/marketing/kansen","Kansen"],["/marketing/kalender","Kalender"],["/marketing/instellingen","Instellingen"]] as const;
export function MarketingNav(){const path=usePathname();return <nav className="mk-nav" aria-label="Marketing">{links.map(([href,label])=><Link key={href} href={href} aria-current={path===href?"page":undefined}>{label}</Link>)}<Link className="mk-nav-back" href="/growth">Growth Pipeline</Link><Link href="/">Contactaanvragen</Link></nav>;}
