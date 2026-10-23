import { z } from "zod";
import { draftKinds, draftStatuses, growthCategories, growthStatuses } from "./labels.ts";
import { isValidDate } from "../marketing/dates.ts";

const text = (max: number) => z.string().trim().max(max).refine(v => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v), "invalid characters");
const date = z.string().refine(isValidDate, "invalid date");
const version = z.number().int().positive();
// Owner-configured sources must be public HTTPS URLs; private hosts are refused again at fetch time.
const httpsUrl = z.string().trim().max(500).refine(value => { try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; } }, "https only");
export const growthSettingsSchema = z.object({
  regions: z.array(text(60).min(2)).min(1).max(12),
  searchTerms: z.array(text(80).min(3)).min(1).max(40),
  maxDistanceKm: z.number().int().min(5).max(250),
  sources: z.object({ news: z.boolean(), brave: z.boolean(), googleCse: z.boolean() }).strict(),
  rssFeeds: z.array(httpsUrl).max(20),
  icalFeeds: z.array(httpsUrl).max(20),
  pages: z.array(httpsUrl).max(30),
  maxQueriesPerRun: z.number().int().min(1).max(40),
  maxAnalysesPerRun: z.number().int().min(0).max(60),
  monthlyAiBudgetCents: z.number().int().min(0).max(50000),
  scanEveryDays: z.number().int().min(1).max(7),
  weeklyDigest: z.boolean(),
  // Nothing is ever sent to third parties automatically; this flag cannot be switched on.
  autoSend: z.literal(false)
}).strict();
export type GrowthSettings = z.infer<typeof growthSettingsSchema>;
export const defaultGrowthSettings: GrowthSettings = {
  regions: ["Almere", "Lelystad", "Zeewolde", "Flevoland"],
  searchTerms: ["sportevenement", "vitaliteitsweek", "bedrijfsfitness", "vitaliteit medewerkers", "open dag sportvereniging", "hardloopwedstrijd", "sportdag bedrijven", "bootcamp", "workshop krachttraining", "gezondheidsmarkt", "sportvereniging zoekt trainer", "personal trainer gezocht"],
  maxDistanceKm: 40,
  sources: { news: true, brave: false, googleCse: false },
  rssFeeds: [], icalFeeds: [], pages: [],
  maxQueriesPerRun: 12, maxAnalysesPerRun: 20, monthlyAiBudgetCents: 1000, scanEveryDays: 1, weeklyDigest: false, autoSend: false
};
export const growthSettingsRequestSchema = z.object({ expectedVersion: version, settings: growthSettingsSchema }).strict();
export function readGrowthSettings(value: unknown): GrowthSettings {
  const stored = value && typeof value === "object" ? value as Partial<GrowthSettings> : {};
  const parsed = growthSettingsSchema.safeParse({ ...defaultGrowthSettings, ...stored, sources: { ...defaultGrowthSettings.sources, ...(stored.sources || {}) } });
  return parsed.success ? parsed.data : defaultGrowthSettings;
}

export const growthPatchSchema = z.object({
  expectedVersion: version,
  status: z.enum(growthStatuses).optional(),
  category: z.enum(growthCategories).optional(),
  followUpOn: date.nullable().optional()
}).strict().refine(value => value.status !== undefined || value.category !== undefined || value.followUpOn !== undefined, "nothing to change");
export const growthNoteSchema = z.object({ body: text(4000).min(1), remindOn: date.nullable().optional() }).strict();
export const growthDraftRequestSchema = z.object({ kind: z.enum(draftKinds), instructions: text(600).optional() }).strict();
export const growthDraftPatchSchema = z.object({
  expectedVersion: version,
  subject: text(200).optional(),
  body: text(8000).min(1).optional(),
  // "sent_manually" records that the owner sent it outside this system; the platform itself sends nothing.
  status: z.enum(draftStatuses).optional()
}).strict().refine(value => value.subject !== undefined || value.body !== undefined || value.status !== undefined, "nothing to change");
export const growthFilterSchema = z.object({
  category: z.enum(growthCategories).optional(), status: z.enum(growthStatuses).optional(), minScore: z.coerce.number().int().min(0).max(100).optional(),
  place: text(60).optional(), from: date.optional(), to: date.optional()
});
