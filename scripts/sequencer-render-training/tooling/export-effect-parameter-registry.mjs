#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function str(value = "") {
  return String(value || "").trim();
}

function normalizeKey(value = "") {
  return str(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

const inputPath = process.argv[2]
  ? resolve(process.argv[2])
  : resolve("scripts/sequencer-render-training/catalog/effective-effect-parameter-registry.json");
const outputPath = process.argv[3]
  ? resolve(process.argv[3])
  : resolve("apps/xlightsdesigner-ui/agent/sequence-agent/generated/effect-parameter-registry.js");

const source = JSON.parse(readFileSync(inputPath, "utf8"));
const effects = {};

for (const [effectName, effectRecord] of Object.entries(source.effects || {})) {
  const parameters = {};
  for (const [parameterName, parameterRecord] of Object.entries(effectRecord?.parameters || {})) {
    const upstream = parameterRecord?.upstream && typeof parameterRecord.upstream === "object"
      ? parameterRecord.upstream
      : {};
    const id = str(upstream.id);
    const controlType = str(upstream.controlType);
    if (!id || !controlType) continue;
    parameters[normalizeKey(parameterName)] = {
      parameterName,
      type: str(upstream.type || parameterRecord.type),
      controlType,
      upstreamId: id,
      defaultValue: upstream.default ?? null,
      min: Number.isFinite(Number(upstream.min)) ? Number(upstream.min) : null,
      max: Number.isFinite(Number(upstream.max)) ? Number(upstream.max) : null,
      divisor: Number.isFinite(Number(upstream.divisor)) ? Number(upstream.divisor) : 1
    };
  }
  if (Object.keys(parameters).length) {
    effects[effectName] = {
      complexityClass: str(effectRecord?.complexityClass),
      parameters
    };
  }
}

const artifact = {
  artifactType: "sequencer_effect_parameter_registry_bundle",
  artifactVersion: "1.0",
  sourcePath: inputPath,
  sourceVersion: str(source.version),
  generatedAt: new Date().toISOString(),
  effectCount: Object.keys(effects).length,
  effects
};

writeFileSync(
  outputPath,
  `export const EFFECT_PARAMETER_REGISTRY_BUNDLE = ${JSON.stringify(artifact)};\n`,
  "utf8"
);

console.log(JSON.stringify({ ok: true, outputPath, effectCount: artifact.effectCount }, null, 2));
