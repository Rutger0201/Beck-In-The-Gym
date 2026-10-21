import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "../../lib/auth";
import { ownerCanAccess } from "@bitg/database/contacts";
import { SecuritySetup } from "../../components/SecuritySetup";
export const dynamic="force-dynamic";
export default async function Security(){const session=await auth().api.getSession({headers:await headers()});if(!session||!await ownerCanAccess(session.user.id))redirect("/login");if(session.user.twoFactorEnabled)redirect("/");return <main className="auth-card"><p className="eyebrow">EENMALIG INSTELLEN</p><h1>Beveilig je account.</h1><p>Voeg de sleutel toe in je authenticator en bewaar de herstelcodes op een veilige plek. Contactaanvragen blijven afgeschermd totdat dit is afgerond.</p><SecuritySetup/></main>;}
