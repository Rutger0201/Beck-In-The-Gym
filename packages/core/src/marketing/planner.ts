import type { CalendarBrief, Category, Channel } from "./labels.ts";
import { paidChannels } from "./labels.ts";
import { addDays, isoWeekday, startOfWeek } from "./dates.ts";
import { themes } from "./library.ts";

export type PlanCandidate = { fingerprint: string | null; title: string; channel: Channel; category: Category; effortMinutes: number; score: number; brief: CalendarBrief; opportunityId?: string | null };
export type PlannedItem = { scheduledFor: string; channel: Channel; category: Category; title: string; brief: CalendarBrief; effortMinutes: number; opportunityId: string | null };
export type PlanSettings = { postsPerWeek: number; weeklyMinutes: number };
export const defaultPlanSettings: PlanSettings = { postsPerWeek: 3, weeklyMinutes: 180 };
// Spread across the week so a solo trainer never has to produce on consecutive days at 3 per week.
export const weekdayPatterns: Record<number, number[]> = { 1: [3], 2: [2, 5], 3: [1, 3, 5], 4: [1, 2, 4, 6], 5: [1, 2, 3, 4, 5] };
export const categoryRotation: Category[] = ["education", "introduction", "technique", "motivation", "progress", "faq", "behind_scenes", "technique", "education", "local", "progress", "promotion"];
// Paid campaigns and outreach actions are proposed as opportunities, never auto-planned as content.
const nonContent: readonly Channel[] = [...paidChannels, "partnership", "referral"];

export function libraryCandidates(): PlanCandidate[] {
  return themes.map(theme => ({ fingerprint: null, title: theme.title, channel: theme.channel, category: theme.category, effortMinutes: theme.effortMinutes, score: 0, brief: theme.brief }));
}
function pool(candidates: PlanCandidate[]): PlanCandidate[] {
  const seen = new Set<string>(), result: PlanCandidate[] = [];
  for (const candidate of [...candidates].sort((a, b) => b.score - a.score).concat(libraryCandidates())) {
    if (nonContent.includes(candidate.channel) || seen.has(candidate.title)) continue;
    seen.add(candidate.title); result.push(candidate);
  }
  return result;
}

export function planCalendar({ start, days = 30, settings = defaultPlanSettings, candidates = [] as PlanCandidate[], occupied = new Map<string, number>() }: { start: string; days?: number; settings?: PlanSettings; candidates?: PlanCandidate[]; occupied?: Map<string, number> }): PlannedItem[] {
  const pattern = weekdayPatterns[Math.min(5, Math.max(1, Math.round(settings.postsPerWeek)))];
  const ideas = pool(candidates), used = new Set<string>(), minutes = new Map<string, number>(), planned: PlannedItem[] = [];
  let slot = 0, lastPromotion = -Infinity;
  for (let offset = 0; offset < days; offset++) {
    const date = addDays(start, offset), week = startOfWeek(date);
    if (!pattern.includes(isoWeekday(date))) continue;
    if (occupied.has(date)) { minutes.set(week, (minutes.get(week) || 0) + (occupied.get(date) || 0)); slot++; continue; }
    const budget = settings.weeklyMinutes - (minutes.get(week) || 0);
    let chosen: PlanCandidate | undefined;
    for (let attempt = 0; attempt < categoryRotation.length && !chosen; attempt++) {
      const category = categoryRotation[(slot + attempt) % categoryRotation.length];
      if (category === "promotion" && offset - lastPromotion < 14) continue;
      chosen = ideas.find(idea => idea.category === category && !used.has(idea.title) && idea.effortMinutes <= budget);
    }
    chosen ??= ideas.find(idea => !used.has(idea.title) && idea.category !== "promotion" && idea.effortMinutes <= budget);
    slot++;
    if (!chosen) continue;
    used.add(chosen.title); minutes.set(week, (minutes.get(week) || 0) + chosen.effortMinutes);
    if (chosen.category === "promotion") lastPromotion = offset;
    planned.push({ scheduledFor: date, channel: chosen.channel, category: chosen.category, title: chosen.title, brief: chosen.brief, effortMinutes: chosen.effortMinutes, opportunityId: chosen.opportunityId ?? null });
  }
  return planned;
}

// A different idea for the same slot: same category first, never a title already in the plan.
export function alternativeIdea(current: { title: string; category: Category }, candidates: PlanCandidate[], usedTitles: Iterable<string> = []): PlanCandidate | undefined {
  const used = new Set([current.title, ...usedTitles]), ideas = pool(candidates).filter(idea => !used.has(idea.title));
  return ideas.find(idea => idea.category === current.category) ?? ideas.find(idea => idea.category !== "promotion");
}
