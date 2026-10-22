import { createHash } from "node:crypto";
import type { CalendarBrief, Category, Channel, ExpectedImpact, ResearchKind, ScoreFactors } from "./labels.ts";
import { addDays, addMonths, localDate, monthOf, startOfMonth } from "./dates.ts";
import { seasonalWindows, standardCta, themes, themeByKey } from "./library.ts";
import { summariseLeads, type LeadSignal } from "./leads.ts";
import { clampFactor, expectedImpact, priorityScore, scoreRationale } from "./scoring.ts";

export type ResearchItem = { source: string; kind: ResearchKind; title: string; summary: string; url: string | null; fingerprint: string; expiresAt: Date; ref: string };
export type OpportunityDraft = {
  fingerprint: string; title: string; description: string; audience: string; channel: Channel; category: Category; factors: ScoreFactors; score: number;
  rationale: string[]; effortMinutes: number; costEur: [number, number]; expectedImpact: ExpectedImpact; bestMoment: string | null; action: string; source: string; themeKey: string | null; brief: CalendarBrief;
};
export const librarySource = "BITG-themabibliotheek", seasonSource = "Seizoenskalender", leadSource = "Eigen contactaanvragen";
const goalCategories: Record<string, Category[]> = { strength: ["education", "technique"], muscle: ["progress"], fitness: ["motivation", "education"], technique: ["technique"], unsure: ["faq", "introduction"] };
const goalLabels: Record<string, string> = { strength: "sterker worden", muscle: "spieropbouw", fitness: "algemene fitheid", technique: "techniek", unsure: "nog geen vast doel" };
const monthNames = ["", "januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];

export function normaliseText(value: string): string {
  return value.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
export function fingerprint(...parts: string[]): string {
  return createHash("sha256").update(parts.map(normaliseText).join("|")).digest("hex");
}
export function dedupeResearch<T extends { fingerprint: string }>(items: T[]): T[] {
  return [...new Map(items.map(item => [item.fingerprint, item])).values()];
}
function endOfDay(date: string): Date { return new Date(`${addDays(date, 1)}T00:00:00Z`); }
function activeWindows(today: string, horizonDays: number) {
  const months = new Set([monthOf(today), monthOf(addDays(today, horizonDays))]);
  return seasonalWindows.filter(window => window.months.some(month => months.has(month)));
}

export function collectResearch({ now = new Date(), leads = [] as LeadSignal[], horizonDays = 30 } = {}): ResearchItem[] {
  const today = localDate(now), items: ResearchItem[] = [];
  for (const window of activeWindows(today, horizonDays)) {
    const lastMonth = window.months.at(-1)!, year = Number(today.slice(0, 4)) + (lastMonth < monthOf(today) ? 1 : 0);
    items.push({ source: seasonSource, kind: "seasonal", title: window.title, summary: window.summary, url: null, ref: `season:${window.key}`, fingerprint: fingerprint("season", window.key, String(year)), expiresAt: endOfDay(addDays(addMonths(`${year}-${String(lastMonth).padStart(2, "0")}-01`, 1), -1)) });
  }
  for (const theme of themes) items.push({ source: librarySource, kind: theme.kind, title: theme.title, summary: theme.summary, url: null, ref: `theme:${theme.key}`, fingerprint: fingerprint("theme", theme.key), expiresAt: endOfDay(addDays(today, 35)) });
  const summary = summariseLeads(leads, now);
  if (summary.total >= 3 && summary.topGoal) {
    items.push({ source: leadSource, kind: "performance", title: `Meeste aanvragen gaan over ${goalLabels[summary.topGoal.goal] || summary.topGoal.goal}`, summary: `${summary.topGoal.count} van de ${summary.total} contactaanvragen in de afgelopen ${summary.days} dagen noemen dit doel. Content hierover sluit aan bij wat bezoekers echt vragen.`, url: null, ref: `goal:${summary.topGoal.goal}`, fingerprint: fingerprint("leads-goal", summary.topGoal.goal, startOfMonth(today)), expiresAt: endOfDay(addDays(today, 31)) });
  }
  if (summary.total >= 3 && summary.beginners / summary.total >= 0.4) {
    items.push({ source: leadSource, kind: "performance", title: "Veel aanvragen komen van beginners", summary: `${summary.beginners} van de ${summary.total} aanvragen in de afgelopen ${summary.days} dagen komen van mensen die net beginnen.`, url: null, ref: "goal:unsure", fingerprint: fingerprint("leads-beginners", startOfMonth(today)), expiresAt: endOfDay(addDays(today, 31)) });
  }
  return dedupeResearch(items);
}

export function deriveOpportunities(items: ResearchItem[], { now = new Date(), measured = false, limit = 20 } = {}): OpportunityDraft[] {
  const today = localDate(now), windows = activeWindows(today, 30);
  const seasonCategories = new Set(windows.map(window => window.category));
  const leadCategories = new Map<Category, string>();
  for (const item of items.filter(entry => entry.kind === "performance")) for (const category of goalCategories[item.ref.slice(5)] || []) leadCategories.set(category, item.title.toLowerCase());
  const drafts: OpportunityDraft[] = [];
  for (const item of items) {
    if (item.ref.startsWith("theme:")) {
      const theme = themeByKey.get(item.ref.slice(6)); if (!theme) continue;
      const reasons: Partial<Record<keyof ScoreFactors, string>> = {};
      let relevance = theme.factors.relevance;
      if (seasonCategories.has(theme.category)) { relevance++; reasons.relevance = "past bij het huidige seizoen"; }
      if (leadCategories.has(theme.category)) { relevance++; reasons.relevance = `${reasons.relevance ? `${reasons.relevance}; ` : ""}sluit aan bij recente aanvragen (${leadCategories.get(theme.category)})`; }
      if (theme.costEur[1] > 0) reasons.cost = `geschat €${theme.costEur[0]}–${theme.costEur[1]}, alleen na jouw akkoord`;
      const factors = { ...theme.factors, relevance: clampFactor(relevance) };
      drafts.push({ fingerprint: item.fingerprint, title: theme.title, description: theme.summary, audience: theme.audience, channel: theme.channel, category: theme.category, factors, score: priorityScore(factors), rationale: scoreRationale(factors, reasons), effortMinutes: theme.effortMinutes, costEur: theme.costEur, expectedImpact: expectedImpact(factors, measured), bestMoment: seasonCategories.has(theme.category) ? "Binnen het huidige seizoensvenster" : null, action: theme.action, source: item.source, themeKey: theme.key, brief: theme.brief });
    } else if (item.ref.startsWith("season:")) {
      const window = seasonalWindows.find(entry => `season:${entry.key}` === item.ref); if (!window) continue;
      const factors = { relevance: 5, impact: 4, feasibility: 4, cost: 5 };
      drafts.push({ fingerprint: item.fingerprint, title: window.title, description: window.summary, audience: "Mensen die rond dit moment (opnieuw) willen starten", channel: window.channel, category: window.category, factors, score: priorityScore(factors), rationale: scoreRationale(factors, { relevance: "terugkerend seizoensmoment" }), effortMinutes: 60, costEur: [0, 0], expectedImpact: expectedImpact(factors, measured), bestMoment: `Seizoensvenster: ${window.months.map(month => monthNames[month]).join(" en ")}`, action: window.action, source: item.source, themeKey: null, brief: { hook: window.hook, outline: ["Herkenbaar moment van het seizoen", "Eén concreet, haalbaar advies", "Uitnodiging voor een kennismaking"], cta: standardCta, visual: "Eigen trainingsbeeld in de gym, donkere achtergrond, BITG-logo klein rechtsonder." } });
    }
  }
  return selectTop(drafts, limit);
}
export function selectTop(drafts: OpportunityDraft[], limit = 20): OpportunityDraft[] {
  return dedupeResearch(drafts).sort((a, b) => b.score - a.score || a.effortMinutes - b.effortMinutes || a.title.localeCompare(b.title)).slice(0, Math.max(10, Math.min(20, limit)));
}
