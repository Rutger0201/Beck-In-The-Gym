import { z } from "zod";
import { calendarStatuses, channels, opportunityStatuses } from "./labels.ts";
import { isValidDate } from "./dates.ts";

const text = (max: number) => z.string().trim().max(max).refine(v => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v), "invalid characters");
const date = z.string().refine(isValidDate, "invalid date");
const version = z.number().int().positive();
// The owner may move, edit and judge drafts. "scheduled" and "published" stay reserved for publishing integrations,
// except that the owner may record a manual publication of approved content.
export const calendarPatchSchema = z.object({
  expectedVersion: version,
  scheduledFor: date.optional(),
  title: text(200).min(3).optional(),
  hook: text(300).optional(),
  notes: text(4000).optional(),
  channel: z.enum(channels).optional(),
  status: z.enum(calendarStatuses).exclude(["scheduled"]).optional()
}).strict().refine(value => Object.keys(value).length > 1, "nothing to change");
export const regenerateSchema = z.object({ expectedVersion: version }).strict();
export const opportunityPatchSchema = z.object({ expectedVersion: version, status: z.enum(opportunityStatuses).optional(), planFor: date.optional() }).strict().refine(value => value.status || value.planFor, "nothing to change");
export const planRequestSchema = z.object({ start: date.optional(), days: z.number().int().min(7).max(31).optional() }).strict();
export const marketingSettingsSchema = z.object({
  postsPerWeek: z.number().int().min(1).max(5),
  weeklyMinutes: z.number().int().min(30).max(900),
  region: text(80).min(2),
  researchEveryDays: z.number().int().min(1).max(30),
  autoPublish: z.literal(false)
}).strict();
export type MarketingSettings = z.infer<typeof marketingSettingsSchema>;
export const defaultMarketingSettings: MarketingSettings = { postsPerWeek: 3, weeklyMinutes: 180, region: "Almere", researchEveryDays: 1, autoPublish: false };
export const settingsRequestSchema = z.object({ expectedVersion: version, settings: marketingSettingsSchema }).strict();
export function readSettings(value: unknown): MarketingSettings {
  const parsed = marketingSettingsSchema.safeParse({ ...defaultMarketingSettings, ...(value && typeof value === "object" ? value : {}) });
  return parsed.success ? parsed.data : defaultMarketingSettings;
}
