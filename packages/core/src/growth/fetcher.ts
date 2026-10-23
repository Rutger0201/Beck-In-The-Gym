// Polite HTTP access for discovery: HTTPS only, no private hosts, robots.txt respected for crawled pages,
// one request per host per second (or the site's crawl-delay), bounded bodies, retries with backoff.
import { isIP } from "node:net";
import { parseRobots, robotsAllows, type RobotsRules } from "./robots.ts";

export const userAgent = "BITG-GrowthPipeline/1.0 (+personal training Almere; respects robots.txt)";
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
export class BlockedUrl extends Error {}
export class FetchFailed extends Error { status: number | null; constructor(message: string, status: number | null = null) { super(message); this.status = status; } }

function privateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || !host.includes(".")) return true;
  if (isIP(host) === 6) return true;
  if (isIP(host) === 4) { const [a, b] = host.split(".").map(Number); return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127); }
  return false;
}
export function assertPublicHttps(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || privateHost(url.hostname) || (url.port && url.port !== "443")) throw new BlockedUrl("Only public HTTPS URLs are fetched");
  return url;
}
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class Fetcher {
  private robots = new Map<string, Promise<RobotsRules | null>>();
  private nextSlot = new Map<string, number>();
  requests = 0;
  private readonly fetchImpl: FetchLike;
  private readonly options: { retries?: number; timeoutMs?: number; maxBytes?: number; minIntervalMs?: number; backoffMs?: number };
  constructor(fetchImpl: FetchLike = fetch, options: { retries?: number; timeoutMs?: number; maxBytes?: number; minIntervalMs?: number; backoffMs?: number } = {}) { this.fetchImpl = fetchImpl; this.options = options; }

  private async pace(host: string, delayMs: number) {
    const now = Date.now(), slot = Math.max(now, this.nextSlot.get(host) ?? 0);
    this.nextSlot.set(host, slot + delayMs);
    if (slot > now) await pause(slot - now);
  }
  private async once(url: URL, accept: string, headers: Record<string, string>): Promise<Response> {
    let current = url;
    // Redirects are followed manually so every hop passes the same public-HTTPS check.
    for (let hop = 0; hop < 4; hop++) {
      this.requests++;
      const response = await this.fetchImpl(current.toString(), { headers: { "User-Agent": userAgent, Accept: accept, ...headers }, redirect: "manual", signal: AbortSignal.timeout(this.options.timeoutMs ?? 15_000) });
      if (response.status >= 300 && response.status < 400 && response.headers.get("location")) { current = assertPublicHttps(new URL(response.headers.get("location")!, current).toString()); continue; }
      return response;
    }
    throw new FetchFailed("Too many redirects");
  }
  private async body(response: Response): Promise<string> {
    const max = this.options.maxBytes ?? 2_000_000, length = Number(response.headers.get("content-length") || 0);
    if (length > max) throw new FetchFailed("Response too large");
    const text = await response.text();
    if (text.length > max) throw new FetchFailed("Response too large");
    return text;
  }
  async rules(url: URL): Promise<RobotsRules | null> {
    let entry = this.robots.get(url.origin);
    if (!entry) {
      entry = this.once(new URL("/robots.txt", url.origin), "text/plain", {}).then(async response => {
        if (response.status >= 500) return { allow: [], disallow: ["/"], crawlDelay: null }; // unreachable robots.txt: assume disallowed (RFC 9309)
        return response.ok ? parseRobots(await this.body(response), userAgent) : null; // 4xx: no restrictions
      }).catch(() => ({ allow: [], disallow: ["/"], crawlDelay: null }));
      this.robots.set(url.origin, entry);
    }
    return entry;
  }
  // crawl: true checks robots.txt first (web pages, feeds); API endpoints of official search providers skip it.
  async text(value: string, { accept = "*/*", crawl = true, headers = {} as Record<string, string> } = {}): Promise<string> {
    const url = assertPublicHttps(value);
    let delayMs = this.options.minIntervalMs ?? 1000;
    if (crawl) {
      const rules = await this.rules(url);
      if (rules && !robotsAllows(rules, `${url.pathname}${url.search}`)) throw new BlockedUrl("Disallowed by robots.txt");
      if (rules?.crawlDelay) delayMs = Math.max(delayMs, Math.min(30, rules.crawlDelay) * 1000);
    }
    const retries = this.options.retries ?? 2;
    for (let attempt = 0; ; attempt++) {
      await this.pace(url.host, delayMs);
      let response: Response;
      try { response = await this.once(url, accept, headers); }
      catch (error) {
        // Network errors and timeouts are retried; blocked URLs and redirect loops are final.
        if (error instanceof BlockedUrl || error instanceof FetchFailed || attempt >= retries) throw error;
        await pause((this.options.backoffMs ?? 1000) * 2 ** attempt); continue;
      }
      if (response.ok) return this.body(response);
      if ((response.status !== 429 && response.status < 500) || attempt >= retries) throw new FetchFailed(`HTTP ${response.status}`, response.status);
      const after = Number(response.headers.get("retry-after"));
      await pause(Number.isFinite(after) && after > 0 ? Math.min(after, 10) * 1000 : (this.options.backoffMs ?? 1000) * 2 ** attempt);
    }
  }
}
