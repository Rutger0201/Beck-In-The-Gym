export const locales = ["nl", "en"] as const;
export type Locale = (typeof locales)[number];
export const pageKeys = ["home", "about", "training", "services", "approach", "results", "faq", "contact", "card", "privacy"] as const;
export type PageKey = (typeof pageKeys)[number];
export const slugs: Record<Locale, Record<PageKey, string>> = {
  nl: { home: "", about: "over-mij", training: "personal-training", services: "diensten", approach: "werkwijze", results: "ervaringen", faq: "veelgestelde-vragen", contact: "contact", card: "visitekaartje", privacy: "privacy" },
  en: { home: "", about: "about", training: "personal-training", services: "services", approach: "approach", results: "experiences", faq: "faq", contact: "contact", card: "business-card", privacy: "privacy" }
};
export function pageUrl(locale: Locale, page: PageKey): string {
  return `${locale === "en" ? "/en" : ""}/${slugs[locale][page]}`.replace(/\/$/, "") || "/";
}
export function resolvePage(locale: string, slug: string[]): PageKey | undefined {
  if (locale !== "nl" && locale !== "en") return;
  return pageKeys.find(key => slugs[locale][key] === slug.join("/"));
}
export const isLocale = (value: string): value is Locale => value === "nl" || value === "en";
