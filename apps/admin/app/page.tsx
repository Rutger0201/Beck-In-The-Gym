import { requireOwner } from "../lib/authorize";
import { listContacts } from "@bitg/database/contacts";
import { ContactList } from "../components/ContactList";
import { mailHealth } from "@bitg/database/mail";
export const dynamic="force-dynamic";
export default async function Dashboard(){await requireOwner();const [contacts,mail]=await Promise.all([listContacts(),mailHealth()]);return <main className="dashboard"><header><div><p className="eyebrow">BECK IN THE GYM</p><h1>Contactaanvragen.</h1><p>Overzicht en opvolging van kennismakingsaanvragen.</p></div></header>{mail.failed>0&&<p role="alert">{mail.failed} e-mailopdrachten zijn na herhaalde pogingen niet verstuurd. Controleer de maildienst en volg deze aanvragen handmatig op.</p>}{mail.pending>0&&<p className="muted small">{mail.pending} e-mailopdrachten wachten op verwerking.</p>}<ContactList contacts={contacts.map(c=>({...c,created_at:new Date(c.created_at).toISOString(),updated_at:new Date(c.updated_at).toISOString()}))}/></main>;}
