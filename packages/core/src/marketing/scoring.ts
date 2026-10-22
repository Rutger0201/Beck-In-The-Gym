import type { ExpectedImpact, ScoreFactors } from "./labels.ts";

// Transparent, fixed weights. Each factor is 1-5; cost is inverted (5 = free).
export const scoreWeights = { relevance: 0.35, impact: 0.3, feasibility: 0.2, cost: 0.15 } as const;
const factorLabels: Record<keyof ScoreFactors, string> = { relevance: "Relevantie voor BITG", impact: "Potentiële impact", feasibility: "Uitvoerbaarheid", cost: "Kosten" };
const levelText = ["", "zeer laag", "laag", "gemiddeld", "hoog", "zeer hoog"];
const costText = ["", "hoge kosten", "merkbare kosten", "beperkte kosten", "vrijwel gratis", "gratis"];

export function clampFactor(value: number): number {
  if (!Number.isFinite(value)) throw new Error("Invalid score factor");
  return Math.min(5, Math.max(1, Math.round(value)));
}
export function priorityScore(factors: ScoreFactors): number {
  const weighted = (Object.keys(scoreWeights) as (keyof ScoreFactors)[]).reduce((sum, key) => sum + clampFactor(factors[key]) * scoreWeights[key], 0);
  return Math.round(1 + ((weighted - 1) / 4) * 99);
}
export function scoreBreakdown(factors: ScoreFactors) {
  return (Object.keys(scoreWeights) as (keyof ScoreFactors)[]).map(key => {
    const value = clampFactor(factors[key]);
    return { key, label: factorLabels[key], value, weight: scoreWeights[key], points: Math.round(((value - 1) / 4) * 99 * scoreWeights[key]), text: key === "cost" ? costText[value] : levelText[value] };
  });
}
export function scoreRationale(factors: ScoreFactors, reasons: Partial<Record<keyof ScoreFactors, string>> = {}): string[] {
  return scoreBreakdown(factors).map(part => `${part.label}: ${part.text} (${part.value}/5, weegt ${Math.round(part.weight * 100)}%)${reasons[part.key] ? ` — ${reasons[part.key]}` : ""}`);
}
export function priorityBand(score: number): "hoog" | "middel" | "laag" {
  return score >= 75 ? "hoog" : score >= 55 ? "middel" : "laag";
}
// Without connected measurements the honest answer is a wide, low-confidence range.
export function expectedImpact(factors: ScoreFactors, measured = false): ExpectedImpact {
  const impact = clampFactor(factors.impact);
  const ranges = ["", "klein", "klein tot gemiddeld", "gemiddeld", "gemiddeld tot groot", "groot"];
  return {
    label: impact >= 4 ? "Zichtbaarheid en aanvragen" : impact === 3 ? "Vertrouwen en zichtbaarheid" : "Merkbeeld",
    range: ranges[impact],
    confidence: measured ? "middel" : "laag",
    basis: measured ? "Gebaseerd op gemeten resultaten van vergelijkbare content." : "Inschatting op basis van vakkennis; nog geen gekoppelde meetdata. Wordt nauwkeuriger zodra resultaten gekoppeld zijn."
  };
}
