// Parsers that turn allowed source formats into raw discoveries. Pure functions: fetching lives in fetcher.ts.
import type { SourceKind } from "./labels.ts";
import { canonicalUrl, cleanTitle, clip, decodeEntities, stripHtml } from "./text.ts";

export type RawItem = {
  sourceKind: SourceKind; source: string; title: string; summary: string; url: string;
  publishedAt: Date | null; startsOn: string | null; endsOn: string | null;
  locationText: string | null; lat: number | null; lon: number | null; organisation: string | null; query: string | null;
};
const item = (base: Partial<RawItem> & Pick<RawItem, "sourceKind" | "source" | "title" | "url">): RawItem | null => {
  // Calendar and agenda entries without their own page are told apart by a fragment on the feed URL.
  const url = canonicalUrl(base.url, base.sourceKind === "ical" || base.sourceKind === "jsonld"), title = clip(base.title, 200);
  if (!url || title.length < 3) return null;
  return { publishedAt: null, startsOn: null, endsOn: null, locationText: null, lat: null, lon: null, organisation: null, query: null, ...base, url, title, summary: clip(base.summary || "", 1200) };
};
const validDate = (value: Date) => (Number.isNaN(value.getTime()) ? null : value);

function tag(block: string, name: string): string | null {
  const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return match ? match[1] : null;
}
function attr(block: string, name: string, attribute: string): string | null {
  const match = block.match(new RegExp(`<${name}\\s[^>]*${attribute}="([^"]*)"`, "i"));
  return match ? decodeEntities(match[1]) : null;
}
// RSS 2.0 and Atom. Google News adds <source url="…">Publisher</source>.
export function parseFeed(xml: string, sourceKind: SourceKind, source: string, query: string | null = null): RawItem[] {
  const blocks = [...xml.matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)].map(match => match[2]);
  return blocks.flatMap(block => {
    const publisher = stripHtml(tag(block, "source") || "") || null;
    const link = stripHtml(tag(block, "link") || "") || attr(block, "link", "href") || "";
    const date = tag(block, "pubDate") || tag(block, "published") || tag(block, "updated") || tag(block, "dc:date");
    const summary = stripHtml(tag(block, "description") || tag(block, "summary") || tag(block, "content") || "");
    const title = cleanTitle(tag(block, "title") || "", publisher);
    // Google News descriptions repeat the headline and publisher; keep them only when they add text.
    const useful = summary && !summary.startsWith(title) ? summary : "";
    const result = item({ sourceKind, source: publisher ? `${source} · ${clip(publisher, 40)}` : source, title, url: link, summary: useful, publishedAt: date ? validDate(new Date(stripHtml(date))) : null, query });
    return result ? [result] : [];
  });
}

// iCalendar (RFC 5545): unfold lines, read VEVENTs. Times are reduced to calendar dates.
function icsDate(value: string | undefined): string | null {
  const match = value?.match(/(\d{4})(\d{2})(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}
const icsText = (value: string | undefined) => (value || "").replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").trim();
export function parseIcs(text: string, source: string, fallbackUrl: string): RawItem[] {
  const lines = text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  const events: Record<string, string>[] = [];
  let current: Record<string, string> | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") { current = {}; continue; }
    if (line === "END:VEVENT") { if (current) events.push(current); current = null; continue; }
    if (!current) continue;
    const colon = line.indexOf(":"); if (colon < 1) continue;
    const key = line.slice(0, colon).split(";")[0].toUpperCase();
    current[key] ??= line.slice(colon + 1); current[`${key}#`] ??= line.slice(0, colon);
  }
  return events.flatMap(event => {
    const [lat, lon] = (event.GEO || "").split(";").map(Number);
    const geo = Number.isFinite(lat) && Number.isFinite(lon) && event.GEO ? { lat, lon } : { lat: null, lon: null };
    const startsOn = icsDate(event.DTSTART), uid = icsText(event.UID);
    // Without an event URL the feed page is the source; the UID keeps events apart.
    const url = icsText(event.URL) || `${fallbackUrl}#${encodeURIComponent(uid || `${startsOn}-${icsText(event.SUMMARY)}`)}`;
    const result = item({ sourceKind: "ical", source, title: icsText(event.SUMMARY), summary: icsText(event.DESCRIPTION), url, startsOn, endsOn: icsDate(event.DTEND), locationText: icsText(event.LOCATION) || null, organisation: icsText((event["ORGANIZER#"] || "").match(/CN="?([^";:]+)/i)?.[1]) || null, ...geo });
    return result ? [result] : [];
  });
}

// schema.org JSON-LD on public agenda pages: events and sports organisations.
const eventType = /Event$/, organisationType = /^(SportsClub|SportsOrganization|SportsTeam|ExerciseGym|HealthClub|SportsActivityLocation)$/;
type Json = Record<string, unknown>;
const str = (value: unknown): string => (typeof value === "string" ? value : Array.isArray(value) && typeof value[0] === "string" ? value[0] : "");
function walk(value: unknown, out: Json[]) {
  if (Array.isArray(value)) { for (const entry of value) walk(entry, out); return; }
  if (!value || typeof value !== "object") return;
  const node = value as Json;
  if (node["@graph"]) walk(node["@graph"], out);
  if (node["@type"]) out.push(node);
  if (node.subEvent) walk(node.subEvent, out);
}
function placeOf(location: unknown): { text: string | null; lat: number | null; lon: number | null } {
  const place = (Array.isArray(location) ? location[0] : location) as Json | string | undefined;
  if (!place) return { text: null, lat: null, lon: null };
  if (typeof place === "string") return { text: place, lat: null, lon: null };
  const address = place.address as Json | string | undefined;
  const addressText = typeof address === "string" ? address : address ? [address.streetAddress, address.postalCode, address.addressLocality].map(str).filter(Boolean).join(", ") : "";
  const geo = place.geo as Json | undefined, lat = Number(geo?.latitude), lon = Number(geo?.longitude);
  return { text: [str(place.name), addressText].filter(Boolean).join(", ") || null, lat: Number.isFinite(lat) && geo ? lat : null, lon: Number.isFinite(lon) && geo ? lon : null };
}
export function parseJsonLd(html: string, source: string, pageUrl: string): RawItem[] {
  const nodes: Json[] = [];
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { walk(JSON.parse(match[1].trim()), nodes); } catch { /* invalid block on a third-party page */ }
  }
  return nodes.flatMap(node => {
    const types = [node["@type"]].flat().map(String);
    const isEvent = types.some(type => eventType.test(type)), isOrganisation = types.some(type => organisationType.test(type));
    if (!isEvent && !isOrganisation) return [];
    const place = placeOf(node.location ?? (isOrganisation ? { address: node.address, geo: node.geo, name: node.name } : undefined));
    const organizer = node.organizer as Json | undefined;
    const url = str(node.url) ? new URL(str(node.url), pageUrl).toString() : `${pageUrl}#${encodeURIComponent(str(node.name))}`;
    const result = item({ sourceKind: "jsonld", source, title: stripHtml(str(node.name)), summary: stripHtml(str(node.description)), url, startsOn: isEvent ? icsDate(str(node.startDate).replace(/-/g, "")) : null, endsOn: isEvent ? icsDate(str(node.endDate).replace(/-/g, "")) : null, locationText: place.text, lat: place.lat, lon: place.lon, organisation: isOrganisation ? stripHtml(str(node.name)) : stripHtml(str(organizer?.name)) || null });
    return result ? [result] : [];
  });
}

// Official search APIs.
export function parseBrave(json: unknown, query: string): RawItem[] {
  const results = ((json as { web?: { results?: unknown[] } })?.web?.results || []) as { title?: string; url?: string; description?: string; page_age?: string }[];
  return results.flatMap(result => { const entry = item({ sourceKind: "brave", source: "Brave Search", title: stripHtml(result.title || ""), url: result.url || "", summary: stripHtml(result.description || ""), publishedAt: result.page_age ? validDate(new Date(result.page_age)) : null, query }); return entry ? [entry] : []; });
}
export function parseGoogleCse(json: unknown, query: string): RawItem[] {
  const results = ((json as { items?: unknown[] })?.items || []) as { title?: string; link?: string; snippet?: string }[];
  return results.flatMap(result => { const entry = item({ sourceKind: "google_cse", source: "Google Programmable Search", title: result.title || "", url: result.link || "", summary: result.snippet || "", query }); return entry ? [entry] : []; });
}
