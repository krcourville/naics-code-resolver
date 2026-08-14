/** Confidence banding per §C: High >=.70, Medium .40-.69, Low <.40; also
 * Q&A whenever the top-2 scores are within .10 of each other, regardless of band. */
export type ConfidenceLabel = "high" | "medium" | "low";

export interface Confidence {
  label: ConfidenceLabel;
  offerQA: boolean;
}

export function classifyConfidence(topScore: number, secondScore: number | undefined): Confidence {
  const label: ConfidenceLabel = topScore >= 0.7 ? "high" : topScore >= 0.4 ? "medium" : "low";
  const narrowMargin = secondScore !== undefined && topScore - secondScore < 0.1;
  return { label, offerQA: label !== "high" || narrowMargin };
}
