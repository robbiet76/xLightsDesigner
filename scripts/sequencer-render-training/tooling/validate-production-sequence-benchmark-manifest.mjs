#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const REQUIRED_READ_GOALS = [
  "whole_display_energy_arc",
  "section_contrast",
  "target_usage_and_handoff",
  "effect_vocabulary_and_variation",
  "color_story"
];

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function str(value = "") {
  return String(value || "").trim();
}

function resolvePath(value = "") {
  const normalized = str(value);
  return path.isAbsolute(normalized) ? normalized : path.resolve(REPO_ROOT, normalized);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sequencePathExists(sequence = {}, key = "xsq") {
  const filePath = str(sequence?.[key]?.path);
  return filePath && fs.existsSync(resolvePath(filePath));
}

export function validateProductionSequenceBenchmarkManifest(manifest = {}) {
  const errors = [];
  if (str(manifest.artifactType) !== "production_sequence_read_benchmark_manifest_v1") {
    errors.push("artifactType must be production_sequence_read_benchmark_manifest_v1");
  }
  if (Number(manifest.artifactVersion) !== 1) {
    errors.push("artifactVersion must be 1");
  }
  if (manifest.readOnly !== true) {
    errors.push("manifest.readOnly must be true");
  }
  const policy = manifest.policy || {};
  if (str(policy.purpose) !== "production_sequence_read_calibration_only") {
    errors.push("policy.purpose must be production_sequence_read_calibration_only");
  }
  if (policy.trainSequencingPolicy !== false) {
    errors.push("policy.trainSequencingPolicy must be false");
  }
  if (policy.copyStylisticPatterns !== false) {
    errors.push("policy.copyStylisticPatterns must be false");
  }
  if (policy.mutateSourceSequences !== false) {
    errors.push("policy.mutateSourceSequences must be false");
  }
  if (policy.promotionRequiresHumanReview !== true) {
    errors.push("policy.promotionRequiresHumanReview must be true");
  }
  if (str(policy.primaryOutcome) !== "calibrate_whole_display_sequence_reading") {
    errors.push("policy.primaryOutcome must be calibrate_whole_display_sequence_reading");
  }
  const evidencePriority = arr(manifest.evidencePriority).map(str);
  if (evidencePriority[0] !== "full_sequence_render" || evidencePriority[1] !== "section_render") {
    errors.push("evidencePriority must start with full_sequence_render then section_render");
  }

  const sequenceIds = new Set();
  const sequences = arr(manifest.sequences);
  if (!sequences.length) errors.push("sequences must not be empty");
  for (const [index, sequence] of sequences.entries()) {
    const label = `sequences[${index}]`;
    const sequenceId = str(sequence.sequenceId || sequence.folderName);
    if (!sequenceId) errors.push(`${label}.sequenceId is required`);
    if (sequenceIds.has(sequenceId)) errors.push(`duplicate sequenceId: ${sequenceId}`);
    sequenceIds.add(sequenceId);
    if (sequence.readOnly !== true) errors.push(`${label}.readOnly must be true`);
    if (str(sequence.benchmarkUse) !== "production_sequence_read_calibration") {
      errors.push(`${label}.benchmarkUse must be production_sequence_read_calibration`);
    }
    if (str(sequence.expectedEvidenceScope) !== "full_sequence_render") {
      errors.push(`${label}.expectedEvidenceScope must be full_sequence_render`);
    }
    if (!sequencePathExists(sequence, "xsq")) {
      errors.push(`${label}.xsq.path must exist`);
    }
    if (sequence.fseq?.present === true && str(sequence.fseq?.path) && !sequencePathExists(sequence, "fseq")) {
      errors.push(`${label}.fseq.path must exist when provided`);
    }
    const readGoals = new Set(arr(sequence.readGoals).map(str));
    for (const goal of REQUIRED_READ_GOALS) {
      if (!readGoals.has(goal)) errors.push(`${label}.readGoals missing ${goal}`);
    }
    if (str(sequence.humanReview?.status || "pending") !== "pending"
      && !["pending", "reviewed", "excluded"].includes(str(sequence.humanReview?.status))) {
      errors.push(`${label}.humanReview.status must be pending, reviewed, or excluded`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    summary: {
      sequenceCount: sequences.length,
      withFseq: sequences.filter((sequence) => sequence.fseq?.present === true).length,
      requiresRender: sequences.filter((sequence) => sequence.requiresRender === true).length,
      initialAuditSubsetCount: sequences.filter((sequence) => sequence.initialAuditSubset === true).length,
      evidencePriority
    }
  };
}

function parseArgs(argv = []) {
  const args = { manifestPath: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = str(argv[index]);
    if (arg === "--manifest") args.manifestPath = argv[++index];
    else if (arg === "--help") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/sequencer-render-training/tooling/validate-production-sequence-benchmark-manifest.mjs --manifest <manifest.json>
`;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help || !args.manifestPath) {
      process.stdout.write(usage());
      process.exit(args.help ? 0 : 1);
    }
    const result = validateProductionSequenceBenchmarkManifest(readJson(resolvePath(args.manifestPath)));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.ok) process.exit(1);
  } catch (error) {
    console.error(error?.stack || String(error));
    process.exit(1);
  }
}
