import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BeaconModel, type BeaconParams } from "../src/naics/beacon-model.ts";

const text = process.argv[2];
if (!text) {
  console.error('usage: npm run infer -- "business description"');
  process.exit(1);
}

const modelPath = fileURLToPath(new URL("../public/naics-model.json", import.meta.url));
const params = JSON.parse(readFileSync(modelPath, "utf-8")) as BeaconParams;
const model = new BeaconModel(params);

for (const { naics, score } of model.predictTopN(text, 10)) {
  console.log(`${naics}\t${score.toFixed(6)}`);
}
