import { readFile } from "node:fs/promises";

const filename = new URL("../frontend/public/models/risk-classifier.json", import.meta.url);
const artifact = JSON.parse(await readFile(filename, "utf8"));

if (artifact.format !== "serene-use-logistic-regression" || artifact.version !== 1) {
  throw new Error("Unsupported risk classifier format/version.");
}
if (!Array.isArray(artifact.weights) || artifact.weights.length !== 512) {
  throw new Error("Classifier must contain exactly 512 weights.");
}
if (!Number.isFinite(artifact.bias)) throw new Error("Classifier bias is invalid.");
for (const name of ["low", "medium", "high"]) {
  if (!Number.isFinite(artifact.thresholds?.[name])) throw new Error(`Missing ${name} threshold.`);
}
if (!(artifact.thresholds.low <= artifact.thresholds.medium && artifact.thresholds.medium <= artifact.thresholds.high)) {
  throw new Error("Thresholds must be ordered low <= medium <= high.");
}

console.log(`Classifier artifact is valid (${artifact.training.trainingSamples} training samples).`);
