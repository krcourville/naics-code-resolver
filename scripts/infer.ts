import { loadNaics } from "@cajuncodemonkey/naics-search";
import { classifyConfidence } from "../apps/naics-resolver/src/naics/confidence.ts";

const text = process.argv[2];
if (!text) {
  console.error('usage: pnpm run infer "business description"');
  process.exit(1);
}

const { model, titles } = await loadNaics();
const top = model.predictTopN(text, 10);
const { label } = classifyConfidence(top[0]?.score ?? 0);

console.log(`confidence: ${label}`);
for (const { naics, score } of top) {
  console.log(`${naics}\t${score.toFixed(6)}\t${titles.get(naics) ?? "(unknown)"}`);
}
