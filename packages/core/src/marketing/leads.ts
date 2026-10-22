import type { LeadQuality } from "./labels.ts";
import { addDays, localDate, startOfWeek } from "./dates.ts";

// Aggregation input only: no names, e-mail addresses or message text leave the database.
export type LeadSignal = { goal: string; format: string | null; experience: string | null; hasPhone: boolean; messageLength: number; hasQuestion: boolean; createdAt: Date };

// Transparent heuristic, shown as such in the dashboard.
export function classifyLead(lead: Omit<LeadSignal, "createdAt">): LeadQuality {
  if (lead.format && (lead.messageLength >= 40 || lead.hasPhone)) return "concrete";
  if (lead.goal !== "unsure" && (lead.format || lead.experience)) return "prospect";
  if (lead.goal === "unsure" || lead.hasQuestion) return "info";
  return "general";
}
export function weeklyLeadCounts(leads: LeadSignal[], now = new Date(), weeks = 8) {
  const current = startOfWeek(localDate(now));
  const buckets = Array.from({ length: weeks }, (_, index) => ({ week: addDays(current, (index - weeks + 1) * 7), concrete: 0, prospect: 0, info: 0, general: 0, total: 0 }));
  for (const lead of leads) {
    const bucket = buckets.find(item => item.week === startOfWeek(localDate(lead.createdAt)));
    if (!bucket) continue;
    bucket[classifyLead(lead)]++; bucket.total++;
  }
  return buckets;
}
export function summariseLeads(leads: LeadSignal[], now = new Date(), days = 90) {
  const since = now.getTime() - days * 86400000;
  const recent = leads.filter(lead => lead.createdAt.getTime() >= since);
  const byGoal: Record<string, number> = {}, byQuality: Record<LeadQuality, number> = { concrete: 0, prospect: 0, info: 0, general: 0 };
  let beginners = 0;
  for (const lead of recent) { byGoal[lead.goal] = (byGoal[lead.goal] || 0) + 1; byQuality[classifyLead(lead)]++; if (lead.experience === "beginner") beginners++; }
  const topGoal = Object.entries(byGoal).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return { days, total: recent.length, byGoal, byQuality, beginners, topGoal: topGoal ? { goal: topGoal[0], count: topGoal[1] } : undefined };
}
