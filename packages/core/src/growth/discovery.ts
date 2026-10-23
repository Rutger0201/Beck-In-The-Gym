// Discovery and processing stages of the pipeline: sources → raw items → screening → deduplication → rule assessment.
// The database layer adds AI analysis, storage and history. Everything here runs without API keys except the
// optional search APIs.
import { createHash } from "node:crypto";
import type { GrowthCategory, GrowthFactors, GrowthInsight, SourceKind } from "./labels.ts";
import type { GrowthSettings } from "./validation.ts";
import { Fetcher } from "./fetcher.ts";
import { parseBrave, parseFeed, parseGoogleCse, parseIcs, parseJsonLd, type RawItem } from "./sources.ts";
import { detectCategory, eventDate, locate, ruleFactors, ruleInsight, screen, type Located } from "./classify.ts";
import { opportunityScore } from "./scoring.ts";
import { hostOf, normaliseText, redactContactDetails, similarity } from "./text.ts";
import { distanceKm, homeBase, isInNetherlands } from "./geo.ts";
import { localDate } from "../marketing/dates.ts";

export type SourceJob = { key: string; kind: SourceKind; label: string; run: (fetcher: Fetcher) => Promise<RawItem[]> };
export type SourceResult = { key: string; kind: SourceKind; label: string; ok: boolean; items: number; error: string | null; ms: number };
export type Keys = { brave?: string; googleCseKey?: string; googleCseId?: string };
export function searchKeys(env: Record<string, string | undefined> = process.env): Keys {
  return { brave: env.BRAVE_SEARCH_API_KEY || undefined, googleCseKey: env.GOOGLE_CSE_API_KEY || undefined, googleCseId: env.GOOGLE_CSE_ID || undefined };
}
// Search queries rotate through every term × region combination across days, within the per-run limit.
export function rotateQueries(settings: GrowthSettings, now: Date): string[] {
  const all = settings.searchTerms.flatMap(term => settings.regions.map(region => `${term} ${region}`));
  const day = Math.floor(now.getTime() / 86400000), count = Math.min(all.length, settings.maxQueriesPerRun), start = (day * count) % all.length;
  return Array.from({ length: count }, (_, index) => all[(start + index) % all.length]);
}
export function planSources(settings: GrowthSettings, keys: Keys, now = new Date()): { jobs: SourceJob[]; inactive: { kind: SourceKind; reason: string }[] } {
  const jobs: SourceJob[] = [], inactive: { kind: SourceKind; reason: string }[] = [], queries = rotateQueries(settings, now);
  if (settings.sources.news) for (const query of queries) jobs.push({ key: `news:${query}`, kind: "news", label: `Google News: ${query}`, run: async fetcher => parseFeed(await fetcher.text(`https://news.google.com/rss/search?q=${encodeURIComponent(`${query} when:30d`)}&hl=nl&gl=NL&ceid=NL:nl`, { accept: "application/rss+xml" }), "news", "Google News", query) });
  if (settings.sources.brave && keys.brave) for (const query of queries) jobs.push({ key: `brave:${query}`, kind: "brave", label: `Brave Search: ${query}`, run: async fetcher => parseBrave(JSON.parse(await fetcher.text(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&country=nl&search_lang=nl&count=10&freshness=pm`, { accept: "application/json", crawl: false, headers: { "X-Subscription-Token": keys.brave! } })), query) });
  else if (settings.sources.brave) inactive.push({ kind: "brave", reason: "BRAVE_SEARCH_API_KEY ontbreekt" });
  if (settings.sources.googleCse && keys.googleCseKey && keys.googleCseId) for (const query of queries) jobs.push({ key: `cse:${query}`, kind: "google_cse", label: `Google Search: ${query}`, run: async fetcher => parseGoogleCse(JSON.parse(await fetcher.text(`https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(keys.googleCseKey!)}&cx=${encodeURIComponent(keys.googleCseId!)}&q=${encodeURIComponent(query)}&gl=nl&lr=lang_nl&dateRestrict=m1`, { accept: "application/json", crawl: false })), query) });
  else if (settings.sources.googleCse) inactive.push({ kind: "google_cse", reason: "GOOGLE_CSE_API_KEY of GOOGLE_CSE_ID ontbreekt" });
  for (const url of settings.rssFeeds) jobs.push({ key: `rss:${url}`, kind: "rss", label: `RSS: ${hostOf(url)}`, run: async fetcher => parseFeed(await fetcher.text(url, { accept: "application/rss+xml, application/atom+xml, application/xml" }), "rss", hostOf(url)) });
  for (const url of settings.icalFeeds) jobs.push({ key: `ical:${url}`, kind: "ical", label: `Kalender: ${hostOf(url)}`, run: async fetcher => parseIcs(await fetcher.text(url, { accept: "text/calendar" }), hostOf(url), url) });
  for (const url of settings.pages) jobs.push({ key: `page:${url}`, kind: "jsonld", label: `Pagina: ${hostOf(url)}`, run: async fetcher => parseJsonLd(await fetcher.text(url, { accept: "text/html" }), hostOf(url), url) });
  return { jobs, inactive };
}
// Sources run one after another (each host is paced anyway); a failing source is logged and skipped.
export async function discover(jobs: SourceJob[], fetcher: Fetcher, deadline: number): Promise<{ items: RawItem[]; results: SourceResult[] }> {
  const items: RawItem[] = [], results: SourceResult[] = [];
  for (const job of jobs) {
    if (Date.now() > deadline) { results.push({ key: job.key, kind: job.kind, label: job.label, ok: false, items: 0, error: "Overgeslagen: tijdslimiet van de run bereikt", ms: 0 }); continue; }
    const started = Date.now();
    try { const found = await job.run(fetcher); items.push(...found); results.push({ key: job.key, kind: job.kind, label: job.label, ok: true, items: found.length, error: null, ms: Date.now() - started }); }
    catch (error) { results.push({ key: job.key, kind: job.kind, label: job.label, ok: false, items: 0, error: error instanceof Error ? error.message.slice(0, 200) : "Onbekende fout", ms: Date.now() - started }); }
  }
  return { items, results };
}

// PDOK Locatieserver (Dutch government open data, no key) for location texts without coordinates.
export async function geocode(fetcher: Fetcher, query: string): Promise<{ lat: number; lon: number; label: string } | null> {
  const json = JSON.parse(await fetcher.text(`https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${encodeURIComponent(query)}&rows=1&fl=weergavenaam,centroide_ll`, { accept: "application/json", crawl: false, headers: {} })) as { response?: { docs?: { weergavenaam?: string; centroide_ll?: string }[] } };
  const doc = json.response?.docs?.[0], match = doc?.centroide_ll?.match(/POINT\(([-\d.]+) ([-\d.]+)\)/);
  if (!doc || !match) return null;
  const point = { lat: Number(match[2]), lon: Number(match[1]) };
  return isInNetherlands(point) ? { ...point, label: doc.weergavenaam || query } : null;
}

export function sha256(value: string): string { return createHash("sha256").update(value).digest("hex"); }
export type Candidate = {
  fingerprint: string; contentHash: string; raw: RawItem; title: string; summary: string; category: GrowthCategory; located: Located; date: string | null;
  factors: GrowthFactors; score: number; insight: GrowthInsight; sources: string[];
};
// Merge the same story from several outlets: identical URL, or near-identical title with the same date.
export function dedupe(items: RawItem[]): { items: (RawItem & { alsoSeen: string[] })[]; duplicates: number } {
  const kept: (RawItem & { alsoSeen: string[] })[] = [];
  let duplicates = 0;
  for (const item of items) {
    const twin = kept.find(other => other.url === item.url || (similarity(other.title, item.title) >= 0.7 && (other.startsOn ?? "") === (item.startsOn ?? "")));
    if (!twin) { kept.push({ ...item, alsoSeen: [] }); continue; }
    duplicates++;
    if (twin.url !== item.url && !twin.alsoSeen.includes(item.url)) twin.alsoSeen.push(item.url);
    // Keep the richer record: official calendars and longer summaries win.
    if ((item.sourceKind === "ical" || item.sourceKind === "jsonld") && twin.sourceKind !== "ical" && twin.sourceKind !== "jsonld") Object.assign(twin, { ...item, alsoSeen: twin.alsoSeen });
    else if (!twin.summary && item.summary) twin.summary = item.summary;
  }
  return { items: kept, duplicates };
}
export function prepare(items: RawItem[], settings: GrowthSettings, now = new Date()): { candidates: Candidate[]; screened: number; duplicates: number; outdated: number; distant: number } {
  const today = localDate(now), candidates: Candidate[] = [];
  let screened = 0, outdated = 0, distant = 0;
  const allowed = items.filter(item => { const verdict = screen(item); if (!verdict.keep) screened++; return verdict.keep; });
  const { items: unique, duplicates } = dedupe(allowed);
  for (const raw of unique) {
    const item = { ...raw, summary: redactContactDetails(raw.summary), title: redactContactDetails(raw.title) };
    const date = eventDate(item, today);
    const ended = (item.endsOn ?? item.startsOn) !== null && (item.endsOn ?? item.startsOn)! < today;
    const stale = item.publishedAt !== null && now.getTime() - item.publishedAt.getTime() > 60 * 86400000 && !date;
    if (ended || stale) { outdated++; continue; }
    const located = locate(item);
    if (located.distanceKm !== null && located.distanceKm > settings.maxDistanceKm * 3) { distant++; continue; }
    const category = detectCategory(item), factors = ruleFactors(item, category, located, date, now, today, settings.maxDistanceKm);
    const contentHash = sha256(normaliseText(`${item.title}|${item.summary}|${date ?? ""}|${located.place ?? ""}`));
    candidates.push({ fingerprint: sha256(item.url), contentHash, raw: item, title: item.title, summary: item.summary, category, located, date, factors, score: opportunityScore(factors), insight: ruleInsight(category, date, today), sources: [item.url, ...raw.alsoSeen] });
  }
  return { candidates, screened, duplicates, outdated, distant };
}
export function withExactLocation(candidate: Candidate, point: { lat: number; lon: number; label: string }, settings: GrowthSettings, now = new Date()): Candidate {
  const located: Located = { place: candidate.located.place ?? point.label, lat: point.lat, lon: point.lon, precision: "address", distanceKm: Math.round(distanceKm(homeBase, point) * 10) / 10 };
  const factors = ruleFactors(candidate.raw, candidate.category, located, candidate.date, now, localDate(now), settings.maxDistanceKm);
  return { ...candidate, located, factors, score: opportunityScore(factors) };
}
