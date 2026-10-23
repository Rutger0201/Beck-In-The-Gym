// Client-safe vocabulary for the Growth Pipeline. No server or Node imports here.
export const growthCategories = ["client_demand", "corporate", "event", "partnership", "campaign", "workshop"] as const;
export type GrowthCategory = (typeof growthCategories)[number];
export const growthCategoryLabels: Record<GrowthCategory, string> = {
  client_demand: "Openbare hulpvraag", corporate: "Bedrijfsfitness", event: "Evenement", partnership: "Samenwerking", campaign: "Lokale campagne", workshop: "Workshop & small group"
};
// CRM pipeline: Nieuw → Interessant → Contact opnemen → In gesprek → Gewonnen / Afgewezen.
export const growthStatuses = ["new", "interesting", "contact", "in_conversation", "won", "rejected"] as const;
export type GrowthStatus = (typeof growthStatuses)[number];
export const growthStatusLabels: Record<GrowthStatus, string> = { new: "Nieuw", interesting: "Interessant", contact: "Contact opnemen", in_conversation: "In gesprek", won: "Gewonnen", rejected: "Afgewezen" };
export const activeStatuses: readonly GrowthStatus[] = ["new", "interesting", "contact", "in_conversation"];
export const sourceKinds = ["news", "rss", "ical", "jsonld", "brave", "google_cse"] as const;
export type SourceKind = (typeof sourceKinds)[number];
export const sourceKindLabels: Record<SourceKind, string> = { news: "Google News RSS", rss: "RSS-feed", ical: "Evenementenkalender (iCal)", jsonld: "Agendapagina (schema.org)", brave: "Brave Search API", google_cse: "Google Programmable Search" };
export const draftKinds = ["proposal", "email", "campaign", "intro", "plan"] as const;
export type DraftKind = (typeof draftKinds)[number];
export const draftKindLabels: Record<DraftKind, string> = { proposal: "Samenwerkingsvoorstel", email: "E-mail aan bedrijf", campaign: "Promotiecampagne", intro: "Introductiebericht", plan: "Acquisitieplan" };
export const draftStatuses = ["draft", "approved", "sent_manually", "discarded"] as const;
export type DraftStatus = (typeof draftStatuses)[number];
export const draftStatusLabels: Record<DraftStatus, string> = { draft: "Concept", approved: "Goedgekeurd", sent_manually: "Handmatig verstuurd", discarded: "Verworpen" };
export const growthFactors = ["relevance", "value", "geography", "likelihood", "urgency", "reliability"] as const;
export type GrowthFactor = (typeof growthFactors)[number];
export type GrowthFactors = Record<GrowthFactor, number>;
export const growthFactorLabels: Record<GrowthFactor, string> = {
  relevance: "Relevantie voor BITG", value: "Commerciële waarde", geography: "Afstand en ligging", likelihood: "Kans op samenwerking of klant", urgency: "Urgentie en contactmogelijkheid", reliability: "Betrouwbaarheid en actualiteit"
};
export const analysisMethods = ["ai", "rules"] as const;
export type AnalysisMethod = (typeof analysisMethods)[number];
export type GrowthInsight = { why: string; benefit: string; nextStep: string; valueEstimate: string | null };
export type GeoPrecision = "exact" | "address" | "place";
export const geoPrecisionLabels: Record<GeoPrecision, string> = { exact: "Exacte locatie uit de bron", address: "Adres via PDOK", place: "Plaatsniveau" };
