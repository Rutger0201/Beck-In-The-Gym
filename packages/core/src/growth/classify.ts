// Transparent rule-based assessment. Used on its own when no AI provider is configured, and always for the
// facts AI should not guess: distance, dates, source reliability and privacy screening.
import type { GrowthCategory, GrowthFactors, GrowthInsight, SourceKind } from "./labels.ts";
import type { RawItem } from "./sources.ts";
import { detectPlace, distanceKm, geographyFactor, homeBase, isInNetherlands, type Place } from "./geo.ts";
import { extractDate, hostOf, normaliseText } from "./text.ts";
import { daysBetween } from "../marketing/dates.ts";

const rules: Record<GrowthCategory, string[]> = {
  client_demand: ["personal trainer gezocht", "zoek een personal trainer", "zoek personal trainer", "wie kent een", "op zoek naar een trainer", "hulp bij afvallen", "beginnen met sporten", "sportmaatje"],
  corporate: ["bedrijfsfitness", "vitaliteit", "vitaliteitsweek", "medewerkers", "werkgever", "duurzame inzetbaarheid", "personeel", "teamuitje", "bedrijfssport", "verzuim", "hr "],
  event: ["evenement", "wedstrijd", "loop", "run", "marathon", "toernooi", "sportdag", "festival", "beurs", "markt", "open dag", "clinic", "sportweek", "fair"],
  partnership: ["sportvereniging", "vereniging", "sportschool", "gym", "sportcentrum", "club", "atletiek", "voetbalclub", "hockeyclub", "zwemvereniging", "sportbedrijf", "samenwerking", "zoekt trainer", "trainer gezocht"],
  campaign: ["gemeente", "campagne", "subsidie", "sportakkoord", "beweegactie", "gezonde wijk", "buurtsportcoach", "jopie", "fonds", "actie"],
  workshop: ["workshop", "clinic", "bootcamp", "small group", "groepstraining", "les", "cursus", "training voor"]
};
const strengthTerms = ["kracht", "krachttraining", "fitness", "spier", "gym", "personal train", "bootcamp", "workout", "vitaliteit", "beweg", "sport", "gezond", "conditie"];
// Pages from personal profiles are never processed (AVG: no profiles of private persons).
const personalProfile = [/(^|\.)linkedin\.com\/in\//, /(^|\.)instagram\.com\/(?!explore\/)/, /(^|\.)tiktok\.com\/@/, /(^|\.)(x|twitter)\.com\//, /(^|\.)facebook\.com\/(?!events\/)/, /(^|\.)threads\.net\//];
// Health information about identifiable people is special-category data; such requests are not stored.
const sensitive = ["diagnose", "ziekte", "kanker", "chemo", "burn-out", "burnout", "depressie", "angststoornis", "zwanger", "eetstoornis", "diabetes", "hartaanval", "revalidatie", "operatie", "hernia", "medicatie", "overgewicht", "obesitas"];
const firstPerson = /\b(ik|mijn|me|mij)\b/, sensitiveTerms = sensitive.map(normaliseText);

const includes = (text: string, terms: string[]) => terms.filter(term => text.includes(term)).length;
export function screen(item: RawItem): { keep: true } | { keep: false; reason: string } {
  const path = `${hostOf(item.url)}${(() => { try { return new URL(item.url).pathname; } catch { return ""; } })()}`;
  if (personalProfile.some(pattern => pattern.test(path))) return { keep: false, reason: "persoonlijk socialemediaprofiel" };
  const text = ` ${normaliseText(`${item.title} ${item.summary}`)} `;
  if (firstPerson.test(text) && includes(text, sensitiveTerms)) return { keep: false, reason: "gezondheidsinformatie van een persoon" };
  return { keep: true };
}
export function detectCategory(item: RawItem): GrowthCategory {
  const text = ` ${normaliseText(`${item.title} ${item.summary} ${item.query || ""}`)} `;
  if (item.sourceKind === "ical" || (item.sourceKind === "jsonld" && item.startsOn)) return text.includes("workshop") || text.includes("clinic") ? "workshop" : "event";
  if (item.sourceKind === "jsonld") return "partnership";
  const scores = (Object.keys(rules) as GrowthCategory[]).map(category => ({ category, hits: includes(text, rules[category]) * (category === "client_demand" ? 2 : 1) }));
  const best = scores.sort((a, b) => b.hits - a.hits)[0];
  return best.hits ? best.category : "campaign";
}
export type Located = { place: string | null; lat: number | null; lon: number | null; precision: "exact" | "address" | "place" | null; distanceKm: number | null };
export function locate(item: RawItem): Located {
  if (item.lat !== null && item.lon !== null && isInNetherlands({ lat: item.lat, lon: item.lon })) {
    const near = detectPlace(`${item.locationText || ""} ${item.title}`);
    return { place: near?.name ?? item.locationText, lat: item.lat, lon: item.lon, precision: "exact", distanceKm: Math.round(distanceKm(homeBase, { lat: item.lat, lon: item.lon }) * 10) / 10 };
  }
  const place: Place | undefined = detectPlace(`${item.locationText || ""} ${item.title} ${item.summary}`);
  return place ? { place: place.name, lat: place.lat, lon: place.lon, precision: "place", distanceKm: Math.round(distanceKm(homeBase, place) * 10) / 10 } : { place: item.locationText, lat: null, lon: null, precision: null, distanceKm: null };
}
export function eventDate(item: RawItem, today: string): string | null {
  return item.startsOn && item.startsOn >= today ? item.startsOn : extractDate(`${item.title} ${item.summary}`, today);
}
const sourceBase: Record<SourceKind, number> = { ical: 5, jsonld: 4, news: 4, rss: 3, brave: 3, google_cse: 3 };
export function reliabilityFactor(kind: SourceKind, publishedAt: Date | null, now: Date): number {
  let value = sourceBase[kind];
  if (publishedAt) { const age = (now.getTime() - publishedAt.getTime()) / 86400000; if (age > 90) value -= 2; else if (age > 30) value -= 1; }
  return Math.max(1, Math.min(5, value));
}
// Urgency combines time pressure with whether there is a concrete route to make contact.
export function urgencyFactor(date: string | null, today: string, kind: SourceKind, hasOrganisation: boolean): number {
  let value = 2;
  if (date) { const days = daysBetween(today, date); value = days < 0 ? 1 : days <= 7 ? 5 : days <= 30 ? 4 : days <= 90 ? 3 : 2; }
  if (hasOrganisation || kind === "ical" || kind === "jsonld") value += 1;
  return Math.max(1, Math.min(5, value));
}
const categoryValue: Record<GrowthCategory, number> = { corporate: 5, partnership: 4, workshop: 4, event: 3, client_demand: 3, campaign: 2 };
const categoryLikelihood: Record<GrowthCategory, number> = { client_demand: 4, partnership: 3, workshop: 3, corporate: 3, event: 2, campaign: 2 };
export function ruleFactors(item: RawItem, category: GrowthCategory, located: Located, date: string | null, now: Date, today: string, maxDistanceKm: number): GrowthFactors {
  const text = normaliseText(`${item.title} ${item.summary}`), fit = includes(text, strengthTerms);
  return {
    relevance: Math.min(5, 1 + Math.min(3, fit) + (located.distanceKm !== null && located.distanceKm <= maxDistanceKm ? 1 : 0)),
    value: categoryValue[category],
    geography: geographyFactor(located.distanceKm, maxDistanceKm),
    likelihood: Math.min(5, categoryLikelihood[category] + (item.organisation ? 1 : 0)),
    urgency: urgencyFactor(date, today, item.sourceKind, Boolean(item.organisation)),
    reliability: reliabilityFactor(item.sourceKind, item.publishedAt, now)
  };
}
// Recommendations follow the situations BITG cares about; they name a next step, never promised results or amounts.
const advice: Record<GrowthCategory, { why: string; benefit: string; step: string }> = {
  corporate: { why: "Een werkgever besteedt aandacht aan vitaliteit van medewerkers.", benefit: "Een introductieworkshop krachttraining of bedrijfsfitness kan leiden tot small-group- of duotrainingen.", step: "Zoek de contactpagina van de organisatie en stuur een kort, prijsloos voorstel voor een introductieworkshop." },
  event: { why: "Een sport- of beweegevenement trekt mensen die met hun gezondheid bezig zijn.", benefit: "Een stand, demonstratie of promotionele samenwerking vergroot lokale zichtbaarheid.", step: "Controleer op de bronpagina of er ruimte is voor standhouders of partners en neem contact op met de organisator." },
  partnership: { why: "Een sportorganisatie in de regio kan baat hebben bij aanvullende krachttraining.", benefit: "Een samenwerking (gastles, techniekavond, aanvullende krachttraining) brengt BITG bij gemotiveerde sporters.", step: "Onderzoek wie er over samenwerkingen gaat en stel een gratis techniekavond voor leden voor." },
  workshop: { why: "Er is vraag naar workshops of groepstraining.", benefit: "Een workshop of small-group training past bij het aanbod en verlaagt de drempel om kennis te maken.", step: "Bekijk de doelgroep en het moment en bereid een workshopvoorstel zonder tarieven voor." },
  client_demand: { why: "Iemand vraagt openbaar om begeleiding bij sporten.", benefit: "Een behulpzaam, niet-opdringerig antwoord kan een kennismaking opleveren.", step: "Reageer alleen via het platform waar de vraag gesteld is, met een algemene tip en een verwijzing naar het contactformulier." },
  campaign: { why: "Er loopt een lokale actie of campagne rond sport en bewegen.", benefit: "Aansluiten bij een lokale campagne geeft geloofwaardige zichtbaarheid.", step: "Lees de voorwaarden van de campagne en kijk of BITG als aanbieder of partner kan aansluiten." }
};
export function ruleInsight(category: GrowthCategory, date: string | null, today: string): GrowthInsight {
  const entry = advice[category];
  const timing = date ? ` Het vindt plaats op ${date}, over ${daysBetween(today, date)} dagen.` : "";
  return { why: `${entry.why}${timing}`, benefit: entry.benefit, nextStep: entry.step, valueEstimate: null };
}
