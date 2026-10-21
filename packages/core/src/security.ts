import { createHmac, timingSafeEqual } from "node:crypto";

export function sameOrigin(origin: string | null, expected: string): boolean {
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(expected).origin; } catch { return false; }
}
export function secretMatches(actual: string | null, expected: string | undefined): boolean {
  if (!actual || !expected || expected.length < 32) return false;
  const a = Buffer.from(actual), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function rateKey(ip: string, secret: string, now = new Date()): string {
  if (secret.length < 32) throw new Error("RATE_LIMIT_SECRET must contain at least 32 characters");
  return createHmac("sha256", secret).update(`${now.toISOString().slice(0, 10)}:${ip}`).digest("hex");
}
export function networkIdentity(headers: Headers, trustProxy: boolean): string {
  // Behind a trusted reverse proxy, the rightmost entry is the nearest sender.
  // The production proxy must overwrite this header, as documented.
  return trustProxy ? (headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || "unknown") : "shared-untrusted-ingress";
}
export function vcardEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
}
export function buildVcard(input: { name: string; website: string; email?: string; phone?: string }): string {
  return ["BEGIN:VCARD", "VERSION:3.0", `FN:${vcardEscape(input.name)}`, "ORG:Beck In The Gym", `URL:${vcardEscape(input.website)}`,
    ...(input.email ? [`EMAIL;TYPE=WORK:${vcardEscape(input.email)}`] : []),
    ...(input.phone ? [`TEL;TYPE=WORK:${vcardEscape(input.phone)}`] : []), "END:VCARD", ""].join("\r\n");
}
export function safeInstagram(value: string | undefined): string | undefined {
  if (!value) return;
  try { const url = new URL(value); if (url.protocol === "https:" && ["instagram.com", "www.instagram.com"].includes(url.hostname) && !url.username && !url.password) return url.href; } catch { /* invalid configuration */ }
}
export function rejectLargeBody(request: Request, maximum = 8192): boolean {
  const length = request.headers.get("content-length");
  return length !== null && (!/^\d+$/.test(length) || Number(length) > maximum);
}
export async function readLimitedJson(request: Request, maximum = 8192): Promise<unknown> {
  if (rejectLargeBody(request, maximum) || !request.body) throw new Error("invalid-body");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > maximum) { await reader.cancel(); throw new Error("invalid-body"); }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally { reader.releaseLock(); }
}
