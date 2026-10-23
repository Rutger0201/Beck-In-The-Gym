import { growthFactorLabels, growthFactors, type GrowthFactor, type GrowthFactors } from "./labels.ts";

// Fixed, visible weights. Each factor is 1-5; the Opportunity Score runs from 0 to 100.
export const growthWeights: Record<GrowthFactor, number> = { relevance: 0.25, value: 0.2, geography: 0.15, likelihood: 0.15, urgency: 0.1, reliability: 0.15 };
const levels = ["", "zeer laag", "laag", "gemiddeld", "hoog", "zeer hoog"];
export function clampGrowthFactor(value: number): number {
  if (!Number.isFinite(value)) throw new Error("Invalid score factor");
  return Math.min(5, Math.max(1, Math.round(value)));
}
export function opportunityScore(factors: GrowthFactors): number {
  const weighted = growthFactors.reduce((sum, key) => sum + clampGrowthFactor(factors[key]) * growthWeights[key], 0);
  return Math.round(((weighted - 1) / 4) * 100);
}
export function growthBreakdown(factors: GrowthFactors) {
  return growthFactors.map(key => { const value = clampGrowthFactor(factors[key]); return { key, label: growthFactorLabels[key], value, weight: growthWeights[key], text: levels[value] }; });
}
export function growthBand(score: number): "hoog" | "middel" | "laag" { return score >= 70 ? "hoog" : score >= 50 ? "middel" : "laag"; }
export const promisingScore = 70;
