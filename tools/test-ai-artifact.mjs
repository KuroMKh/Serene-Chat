import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const directoryArgument = process.argv.indexOf("--dir");
const directory = directoryArgument >= 0 && process.argv[directoryArgument + 1]
  ? pathToFileURL(`${path.resolve(process.argv[directoryArgument + 1])}${path.sep}`)
  : new URL("../frontend/public/models/risk/", import.meta.url);
const model = JSON.parse(await readFile(new URL("model.json", directory), "utf8"));
const thresholds = JSON.parse(await readFile(new URL("thresholds.json", directory), "utf8"));
const manifest = model.weightsManifest?.[0];

if (model.format !== "layers-model" || !model.modelTopology) {
  throw new Error("Unsupported or incomplete TensorFlow.js layers model.");
}
if (!manifest?.paths?.includes("weights.bin") || !Array.isArray(manifest.weights) || !manifest.weights.length) {
  throw new Error("Model must reference weights.bin and contain weight specifications.");
}

const expectedBytes = manifest.weights.reduce((total, weight) => {
  const elements = weight.shape.reduce((product, size) => product * size, 1);
  const bytesPerElement = weight.dtype === "float32" || weight.dtype === "int32" ? 4 : 1;
  return total + elements * bytesPerElement;
}, 0);
const weightFile = await stat(new URL("weights.bin", directory));
if (weightFile.size !== expectedBytes) {
  throw new Error(`weights.bin is ${weightFile.size} bytes; expected ${expectedBytes}.`);
}

for (const name of ["LOW", "MEDIUM", "HIGH"]) {
  if (!Number.isFinite(thresholds[name])) throw new Error(`Missing ${name} threshold.`);
}
if (!(thresholds.LOW <= thresholds.MEDIUM && thresholds.MEDIUM <= thresholds.HIGH)) {
  throw new Error("Thresholds must be ordered LOW <= MEDIUM <= HIGH.");
}

console.log(`Classifier artifacts are valid (${manifest.weights.length} tensors, ${weightFile.size} bytes).`);
