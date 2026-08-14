import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BeaconModel, type BeaconParams } from "../src/naics/beacon-model.ts";
import { classifyConfidence } from "../src/naics/confidence.ts";
import { flattenHierarchy, type HierarchyTree } from "../src/naics/hierarchy.ts";

const text = process.argv[2];
if (!text) {
  console.error('usage: pnpm run infer "business description"');
  process.exit(1);
}

const readJson = <T>(relPath: string): T =>
  JSON.parse(readFileSync(fileURLToPath(new URL(relPath, import.meta.url)), "utf-8")) as T;

const model = new BeaconModel(readJson<BeaconParams>("../public/naics-model.json"));
const titles = flattenHierarchy(readJson<HierarchyTree>("../public/naics-hierarchy.json"));

const top = model.predictTopN(text, 10);
const { label, offerQA } = classifyConfidence(top[0]?.score ?? 0, top[1]?.score);

console.log(`confidence: ${label} (offer Q&A: ${offerQA})`);
for (const { naics, score } of top) {
  console.log(`${naics}\t${score.toFixed(6)}\t${titles.get(naics) ?? "(unknown)"}`);
}
