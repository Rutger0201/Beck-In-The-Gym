// Pure text helpers for discovered content. No network access here.
const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", euro: "€", eacute: "é", euml: "ë", iuml: "ï", ouml: "ö", uuml: "ü", ndash: "–", mdash: "—", hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“" };
export function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") { const point = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : Number(code.slice(1)); return point > 0 && point < 0x110000 ? String.fromCodePoint(point) : ""; }
    return named[code.toLowerCase()] ?? match;
  });
}
export function stripHtml(value: string): string {
  const tags = (text: string) => text.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<\/?[a-z][^>]*>/gi, " ");
  // Feeds often entity-encode their HTML (Google News does), so tags are removed again after decoding.
  return tags(decodeEntities(tags(value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")))).replace(/\s+/g, " ").trim();
}
export function clip(value: string, max: number): string {
  const clean = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}
// Personal contact details found in third-party text are never stored; the contact route is the organisation's own page.
export function redactContactDetails(value: string): string {
  return value.replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[e-mailadres verwijderd]").replace(/(\+31|0031|\b0)[\s-]?\(?\d{1,3}\)?([\s-]?\d){6,8}\b/g, "[telefoonnummer verwijderd]");
}
const tracking = /^(utm_\w+|fbclid|gclid|mc_cid|mc_eid|ref|ref_src|igshid|oc)$/i;
export function canonicalUrl(value: string, keepHash = false): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    url.protocol = "https:"; if (!keepHash) url.hash = ""; url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    for (const key of [...url.searchParams.keys()]) if (tracking.test(key)) url.searchParams.delete(key);
    url.searchParams.sort();
    const text = url.toString();
    return text.length <= 500 ? text.replace(/\/(\?|#|$)/, "$1") : null;
  } catch { return null; }
}
export function hostOf(value: string): string { try { return new URL(value).hostname.replace(/^www\./, ""); } catch { return ""; } }
export function normaliseText(value: string): string {
  return value.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
const stopwords = new Set("de het een en in op van voor met aan bij te is om door naar uit over als ook nog dit dat die wat the a of and to for at on".split(" "));
export function tokens(value: string): Set<string> { return new Set(normaliseText(value).split(" ").filter(word => word.length > 2 && !stopwords.has(word))); }
// Jaccard similarity on content words; used to merge the same story reported by different outlets.
export function similarity(a: string, b: string): number {
  const x = tokens(a), y = tokens(b);
  if (!x.size || !y.size) return 0;
  let shared = 0; for (const word of x) if (y.has(word)) shared++;
  return shared / (x.size + y.size - shared);
}
// Google News titles end in " - Publisher"; drop it for comparison and display.
export function cleanTitle(value: string, publisher?: string | null): string {
  const title = stripHtml(value);
  return publisher && title.endsWith(` - ${publisher}`) ? title.slice(0, -publisher.length - 3).trim() : title;
}

const months: Record<string, number> = { jan: 1, januari: 1, feb: 2, februari: 2, mrt: 3, maart: 3, apr: 4, april: 4, mei: 5, jun: 6, juni: 6, jul: 7, juli: 7, aug: 8, augustus: 8, sep: 9, sept: 9, september: 9, okt: 10, oktober: 10, nov: 11, november: 11, dec: 12, december: 12 };
const iso = (y: number, m: number, d: number) => { const date = new Date(Date.UTC(y, m - 1, d)); return date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date.toISOString().slice(0, 10) : null; };
// First explicit date in Dutch text ("14 november", "za 14 nov 2026", "14-11-2026") that lies within a year from today.
export function extractDate(text: string, today: string): string | null {
  const year = Number(today.slice(0, 4)), found: string[] = [];
  for (const match of text.matchAll(/\b(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december|jan|feb|mrt|apr|jun|jul|aug|sept|sep|okt|nov|dec)\.?(?:\s+(20\d{2}))?/gi)) {
    const month = months[match[2].toLowerCase()], day = Number(match[1]);
    if (match[3]) { const date = iso(Number(match[3]), month, day); if (date) found.push(date); }
    // Without a year, a month well behind today means next year (a December article about "10 januari").
    else { const date = iso(Number(today.slice(5, 7)) - month >= 6 ? year + 1 : year, month, day); if (date) found.push(date); }
  }
  for (const match of text.matchAll(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/g)) { const date = iso(Number(match[3]), Number(match[2]), Number(match[1])); if (date) found.push(date); }
  const limit = iso(year + 1, Number(today.slice(5, 7)), Math.min(28, Number(today.slice(8, 10))))!;
  return found.filter(date => date >= today && date <= limit).sort()[0] ?? null;
}
