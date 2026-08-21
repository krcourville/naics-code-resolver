/** Confidence banding per §C: High >=.70, Medium .40-.69, Low <.40. */
type ConfidenceLabel = "high" | "medium" | "low";

export const CONFIDENCE_EMOJI: Record<ConfidenceLabel, string> = {
  high: "🟢",
  medium: "🟡",
  low: "🔴",
};

export interface Confidence {
  label: ConfidenceLabel;
}

export function classifyConfidence(topScore: number): Confidence {
  const label: ConfidenceLabel = topScore >= 0.7 ? "high" : topScore >= 0.4 ? "medium" : "low";
  return { label };
}
