// Client-safe vocabulary for the marketing module. No server or Node imports here.
export const channels = ["instagram_reel", "instagram_post", "instagram_story", "carousel", "tiktok", "youtube_short", "blog", "google_business", "google_ads", "meta_ads", "local", "partnership", "referral"] as const;
export type Channel = (typeof channels)[number];
export const channelLabels: Record<Channel, string> = {
  instagram_reel: "Instagram Reel", instagram_post: "Instagram-post", instagram_story: "Instagram Story", carousel: "Carrousel", tiktok: "TikTok", youtube_short: "YouTube Short",
  blog: "Blog / SEO", google_business: "Google Bedrijfsprofiel", google_ads: "Google Ads", meta_ads: "Meta Ads", local: "Lokale actie", partnership: "Samenwerking", referral: "Referral"
};
export const paidChannels: readonly Channel[] = ["google_ads", "meta_ads"];
export const categories = ["education", "technique", "progress", "motivation", "introduction", "behind_scenes", "faq", "promotion", "local"] as const;
export type Category = (typeof categories)[number];
export const categoryLabels: Record<Category, string> = {
  education: "Educatie krachttraining", technique: "Oefeningstechniek", progress: "Spieropbouw & progressie", motivation: "Motivatie & consistentie", introduction: "Persoonlijke kennismaking",
  behind_scenes: "Behind the scenes", faq: "Veelgestelde vragen", promotion: "Promotie", local: "Lokale marketing"
};
export const researchKinds = ["trend", "evergreen", "question", "mistake", "seasonal", "competitor", "local", "performance"] as const;
export type ResearchKind = (typeof researchKinds)[number];
export const researchKindLabels: Record<ResearchKind, string> = { trend: "Trend", evergreen: "Kernonderwerp", question: "Veelgestelde vraag", mistake: "Trainingsfout", seasonal: "Seizoen", competitor: "Concurrentie", local: "Lokaal", performance: "Eigen data" };
export const opportunityStatuses = ["open", "planned", "dismissed", "done"] as const;
export type OpportunityStatus = (typeof opportunityStatuses)[number];
export const opportunityStatusLabels: Record<OpportunityStatus, string> = { open: "Open", planned: "Ingepland", dismissed: "Afgewezen", done: "Uitgevoerd" };
// "scheduled" is reserved for publishing integrations; nothing is ever published automatically.
export const calendarStatuses = ["draft", "approved", "rejected", "scheduled", "published"] as const;
export type CalendarStatus = (typeof calendarStatuses)[number];
export const calendarStatusLabels: Record<CalendarStatus, string> = { draft: "Concept", approved: "Goedgekeurd", rejected: "Afgewezen", scheduled: "Ingepland", published: "Gepubliceerd" };
export const leadQualities = ["concrete", "prospect", "info", "general"] as const;
export type LeadQuality = (typeof leadQualities)[number];
export const leadQualityLabels: Record<LeadQuality, string> = { concrete: "Concrete aanvraag", prospect: "Potentiële klant", info: "Wil meer informatie", general: "Algemene vraag" };
export const integrations = [
  { id: "analytics", name: "Websitebezoek", detail: "GoatCounter of Google Analytics 4", phase: 5 },
  { id: "search_console", name: "Google Search Console", detail: "Zoekopdrachten, posities en kliks", phase: 5 },
  { id: "meta", name: "Instagram (Meta)", detail: "Bereik, interactie en publiceren na goedkeuring", phase: 5 },
  { id: "tiktok", name: "TikTok", detail: "Bereik en publiceren na goedkeuring", phase: 5 },
  { id: "youtube", name: "YouTube", detail: "Shorts-statistieken en trendonderwerpen", phase: 5 },
  { id: "ai", name: "AI-tekstgeneratie", detail: "Captions, scripts en analyses", phase: 3 }
] as const;
export type CalendarBrief = { hook: string; outline: string[]; cta: string; visual: string };
export type ScoreFactors = { relevance: number; impact: number; feasibility: number; cost: number };
export type ExpectedImpact = { label: string; range: string; confidence: "laag" | "middel" | "hoog"; basis: string };
