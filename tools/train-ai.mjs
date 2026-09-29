import * as tf from "@tensorflow/tfjs";
import * as use from "@tensorflow-models/universal-sentence-encoder";
import { parse } from "csv-parse";
import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const args = parseArgs(process.argv.slice(2));
const csvPath = path.resolve(args.csv ?? "training-data/Suicide_Detection.csv");
const extraCsvPaths = String(args["extra-csv"] ?? "")
  .split(",")
  .map(value => value.trim())
  .filter(Boolean)
  .map(value => path.resolve(value));
const outputDirectory = path.resolve(args.output ?? "frontend/public/models/risk");
const samplesPerClass = positiveInt(args.samples, 20000);
const extraSamplesPerClass = positiveInt(args["extra-samples"], samplesPerClass);
const epochs = positiveInt(args.epochs, 20);
const batchSize = positiveInt(args.batch, 128);
const embeddingBatchSize = positiveInt(args["embedding-batch"], 128);
const validationFraction = 0.2;
const seed = positiveInt(args.seed, 2026);

console.log(`Reading ${csvPath}`);
const samples = await loadBalancedSample(csvPath, samplesPerClass, seed);
console.log(`Loaded ${samples.positive.length} suicide and ${samples.negative.length} non-suicide posts.`);

for (const [index, extraCsvPath] of extraCsvPaths.entries()) {
  console.log(`Reading extra dataset ${extraCsvPath}`);
  const extra = await loadBalancedSample(extraCsvPath, extraSamplesPerClass, seed + index + 1);
  samples.positive.push(...extra.positive);
  samples.negative.push(...extra.negative);
  console.log(`Added ${extra.positive.length} suicide and ${extra.negative.length} non-suicide rows.`);
}

const rows = shuffle([
  ...samples.positive.map(text => ({ text, label: 1 })),
  ...samples.negative.map(text => ({ text, label: 0 }))
], mulberry32(seed));

const validationSize = Math.max(2, Math.floor(rows.length * validationFraction));
const validationRows = rows.slice(0, validationSize);
const trainingRows = rows.slice(validationSize);

console.log("Loading the same Universal Sentence Encoder used by the website...");
const encoder = await use.load();
const trainX = await embedRows(encoder, trainingRows, embeddingBatchSize, "training");
const validationX = await embedRows(encoder, validationRows, embeddingBatchSize, "validation");
const trainY = tf.tensor2d(trainingRows.map(row => row.label), [trainingRows.length, 1]);
const validationY = tf.tensor2d(validationRows.map(row => row.label), [validationRows.length, 1]);

const classifier = tf.sequential({
  layers: [
    tf.layers.dense({
      inputShape: [512],
      units: 64,
      activation: "relu",
      kernelRegularizer: tf.regularizers.l2({ l2: 0.0001 })
    }),
    tf.layers.dropout({ rate: 0.3 }),
    tf.layers.dense({ units: 1, activation: "sigmoid" })
  ]
});
classifier.compile({
  optimizer: tf.train.adam(0.01),
  loss: "binaryCrossentropy",
  metrics: ["accuracy"]
});

console.log(`Training ${epochs} epochs...`);
await classifier.fit(trainX, trainY, {
  epochs,
  batchSize,
  shuffle: true,
  validationData: [validationX, validationY],
  callbacks: {
    onEpochEnd(epoch, logs) {
      const accuracy = logs.acc ?? logs.accuracy ?? 0;
      const validationAccuracy = logs.val_acc ?? logs.val_accuracy ?? 0;
      console.log(`epoch ${epoch + 1}/${epochs} loss=${logs.loss.toFixed(4)} acc=${accuracy.toFixed(4)} val_acc=${validationAccuracy.toFixed(4)}`);
    }
  }
});

const probabilities = Array.from(await classifier.predict(validationX).data());
const labels = validationRows.map(row => row.label);
const thresholdResult = chooseThreshold(probabilities, labels);
const thresholds = {
  LOW: round(Math.max(0.15, thresholdResult.threshold * 0.6)),
  MEDIUM: round(Math.max(0.3, thresholdResult.threshold * 0.8)),
  HIGH: round(thresholdResult.threshold)
};
const metadata = {
  createdAt: new Date().toISOString(),
  embeddingModel: "@tensorflow-models/universal-sentence-encoder@1.3.3",
  sources: [csvPath, ...extraCsvPaths],
  trainingSamples: trainingRows.length,
  validationSamples: validationRows.length,
  seed,
  epochs,
  precision: round(thresholdResult.precision),
  recall: round(thresholdResult.recall),
  f2: round(thresholdResult.f2)
};

await saveBrowserModel(classifier, outputDirectory);
await writeFile(path.join(outputDirectory, "thresholds.json"), `${JSON.stringify(thresholds, null, 2)}\n`, "utf8");
await writeFile(path.join(outputDirectory, "training-metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
console.log(`Saved browser classifier to ${outputDirectory}`);
console.log(`Validation precision=${metadata.precision} recall=${metadata.recall} F2=${metadata.f2}`);

tf.dispose([trainX, validationX, trainY, validationY]);
classifier.dispose();

async function loadBalancedSample(filename, limit, randomSeed) {
  const random = mulberry32(randomSeed);
  const buckets = { suicide: [], "non-suicide": [] };
  const seen = { suicide: 0, "non-suicide": 0 };
  const parser = createReadStream(filename).pipe(parse({ columns: true, skip_empty_lines: true, relax_quotes: true }));

  for await (const row of parser) {
    const label = String(row.class ?? "").trim().toLowerCase();
    const text = cleanText(row.text);
    const reviewed = String(row.reviewed ?? "").trim().toLowerCase();
    if (reviewed && !["true", "yes", "1"].includes(reviewed)) continue;
    if (!(label in buckets) || text.length < 4) continue;
    seen[label] += 1;
    if (buckets[label].length < limit) buckets[label].push(text);
    else {
      const index = Math.floor(random() * seen[label]);
      if (index < limit) buckets[label][index] = text;
    }
  }

  if (buckets.suicide.length < 2 || buckets["non-suicide"].length < 2) {
    throw new Error("CSV needs text/class columns and both suicide/non-suicide labels.");
  }
  return { positive: buckets.suicide, negative: buckets["non-suicide"] };
}

async function saveBrowserModel(model, directory) {
  let capturedArtifacts;
  await model.save(tf.io.withSaveHandler(async artifacts => {
    capturedArtifacts = artifacts;
    return { modelArtifactsInfo: tf.io.getModelArtifactsInfoForJSON(artifacts) };
  }));

  if (!capturedArtifacts?.modelTopology || !capturedArtifacts?.weightSpecs || !capturedArtifacts?.weightData) {
    throw new Error("TensorFlow.js did not produce complete model artifacts.");
  }

  const modelJson = {
    modelTopology: capturedArtifacts.modelTopology,
    format: capturedArtifacts.format ?? "layers-model",
    generatedBy: capturedArtifacts.generatedBy ?? `TensorFlow.js tfjs-layers ${tf.version.tfjs}`,
    convertedBy: capturedArtifacts.convertedBy ?? null,
    weightsManifest: [{ paths: ["weights.bin"], weights: capturedArtifacts.weightSpecs }]
  };

  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "model.json"), `${JSON.stringify(modelJson)}\n`, "utf8");
  await writeFile(path.join(directory, "weights.bin"), Buffer.from(capturedArtifacts.weightData));
}

async function embedRows(model, inputRows, size, label) {
  const chunks = [];
  for (let start = 0; start < inputRows.length; start += size) {
    const texts = inputRows.slice(start, start + size).map(row => row.text);
    chunks.push(await model.embed(texts));
    const done = Math.min(start + size, inputRows.length);
    if (done === inputRows.length || done % (size * 10) === 0) console.log(`Embedded ${label}: ${done}/${inputRows.length}`);
  }
  const result = tf.concat(chunks, 0);
  chunks.forEach(chunk => chunk.dispose());
  return result;
}

function chooseThreshold(probabilities, labels) {
  let best = { threshold: 0.5, precision: 0, recall: 0, f2: -1 };
  for (let threshold = 0.3; threshold <= 0.9; threshold += 0.01) {
    let truePositive = 0, falsePositive = 0, falseNegative = 0;
    probabilities.forEach((probability, index) => {
      const predicted = probability >= threshold ? 1 : 0;
      if (predicted && labels[index]) truePositive += 1;
      else if (predicted) falsePositive += 1;
      else if (labels[index]) falseNegative += 1;
    });
    const precision = truePositive / Math.max(1, truePositive + falsePositive);
    const recall = truePositive / Math.max(1, truePositive + falseNegative);
    const f2 = (5 * precision * recall) / Math.max(Number.EPSILON, 4 * precision + recall);
    if (f2 > best.f2) best = { threshold, precision, recall, f2 };
  }
  return best;
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
}

function parseArgs(values) {
  const result = {};
  for (let i = 0; i < values.length; i += 1) {
    if (!values[i].startsWith("--")) continue;
    const key = values[i].slice(2);
    result[key] = values[i + 1]?.startsWith("--") ? true : values[++i];
  }
  return result;
}

function positiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function mulberry32(seedValue) {
  return function random() {
    let value = seedValue += 0x6D2B79F5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function shuffle(items, random) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function round(value) {
  return Number(value.toFixed(4));
}
