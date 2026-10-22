import "server-only";
import { safeInstagram } from "@bitg/core/security";
export function siteConfig() {
  const rawUrl = process.env.SITE_URL || "http://localhost:3000";
  const url = new URL(rawUrl);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") throw new Error("Production SITE_URL must use HTTPS");
  const email = process.env.CONTACT_EMAIL?.trim();
  const phone = process.env.CONTACT_PHONE?.trim();
  const admin = URL.canParse(process.env.ADMIN_URL || "") ? new URL(process.env.ADMIN_URL!) : undefined;
  return {
    url: url.origin,
    adminUrl: admin && /^https?:$/.test(admin.protocol) ? admin.href : undefined,
    published: process.env.PUBLICATION_APPROVED === "true",
    name: process.env.CONTACT_FULL_NAME?.trim() || "Rutger",
    email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined,
    phone: phone && /^\+?[\d ()-]{6,30}$/.test(phone) ? phone : undefined,
    whatsapp: /^\d{8,15}$/.test(process.env.CONTACT_WHATSAPP || "") ? process.env.CONTACT_WHATSAPP : undefined,
    instagram: safeInstagram(process.env.CONTACT_INSTAGRAM),
    privacyEmail: process.env.PRIVACY_CONTACT_EMAIL?.trim() || email,
    legalName: process.env.LEGAL_NAME,
    legalAddress: process.env.LEGAL_ADDRESS,
    kvk: process.env.LEGAL_KVK,
    vatId: process.env.LEGAL_VAT_ID,
    verified: process.env.BUSINESS_DETAILS_APPROVED === "true"
  };
}
