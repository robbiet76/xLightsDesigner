#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_FIXTURE = "training-packages/training-package-v1/modules/xlights_sequencer_execution/datasets/combined_target_context_fixture_summary.json";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function str(value = "") {
  return String(value || "").trim();
}

function findSubmodelRecord(records = []) {
  return arr(records).find((record) => str(record?.targetKind) === "submodel") || null;
}

export function validateCombinedTargetContextTrainingFixture({
  fixturePath = DEFAULT_FIXTURE
} = {}) {
  const fixture = readJson(fixturePath);
  const errors = [];
  const examples = arr(fixture.examples);

  const derivedFrom = arr(fixture.source?.derivedFrom);
  if (!derivedFrom.includes("display/model-index.json")) {
    errors.push("fixture source must derive from display/model-index.json");
  }
  if (!derivedFrom.includes("display/target-behavior.json")) {
    errors.push("fixture source must derive from display/target-behavior.json");
  }

  let fingerprintMatchCount = 0;
  let submodelExpectationCount = 0;

  examples.forEach((example, exampleIndex) => {
    const modelIndex = example.displayModelIndexShape || {};
    const targetBehavior = example.targetBehaviorShape || {};
    const expectation = example.candidateSelectionExpectation || {};
    const modelRecords = arr(modelIndex.records);
    const behaviorRecords = arr(targetBehavior.records);
    const submodel = findSubmodelRecord(modelRecords);

    if (modelIndex.artifactType !== "target_metadata_index_v1") {
      errors.push(`examples[${exampleIndex}] displayModelIndexShape artifactType must be target_metadata_index_v1`);
    }
    if (targetBehavior.artifactType !== "project_target_behavior_learning_v1") {
      errors.push(`examples[${exampleIndex}] targetBehaviorShape artifactType must be project_target_behavior_learning_v1`);
    }
    if (!submodel) {
      errors.push(`examples[${exampleIndex}] must include a model-index submodel record`);
      return;
    }

    submodelExpectationCount += 1;
    const submodelFingerprint = str(submodel.identity?.fingerprint);
    const candidateFingerprints = arr(expectation.candidateRealizationRef?.targetFingerprints).map((row) => str(row));
    const matchedBehavior = behaviorRecords.find((record) => str(record?.targetFingerprint) === submodelFingerprint) || null;

    if (!submodelFingerprint) {
      errors.push(`examples[${exampleIndex}] submodel record must include identity.fingerprint`);
    }
    if (!candidateFingerprints.includes(submodelFingerprint)) {
      errors.push(`examples[${exampleIndex}] candidate realization must carry the model-index submodel fingerprint`);
    }
    if (!matchedBehavior) {
      errors.push(`examples[${exampleIndex}] target behavior must match the model-index submodel fingerprint`);
    } else {
      fingerprintMatchCount += 1;
      if (str(matchedBehavior.recordId) !== str(expectation.expectedBehaviorRecordId)) {
        errors.push(`examples[${exampleIndex}] expectedBehaviorRecordId must match the fingerprint-linked behavior record`);
      }
      if (str(matchedBehavior.targetId) === str(submodel.targetId)) {
        errors.push(`examples[${exampleIndex}] behavior record should prove fingerprint matching across a target rename`);
      }
    }

    const policy = arr(expectation.planningPolicy).join(" ").toLowerCase();
    if (!policy.includes("fingerprint before current display name")) {
      errors.push(`examples[${exampleIndex}] must assert fingerprint-before-name behavior`);
    }
    if (!policy.includes("first-class target")) {
      errors.push(`examples[${exampleIndex}] must assert first-class submodel target behavior`);
    }
    if (!policy.includes("advisory") || !policy.includes("validation authoritative")) {
      errors.push(`examples[${exampleIndex}] must keep behavior evidence advisory and validation authoritative`);
    }
    if (!policy.includes("do not infer")) {
      errors.push(`examples[${exampleIndex}] must assert no semantic inference from target names`);
    }
  });

  if (fingerprintMatchCount === 0) errors.push("fixture must include at least one fingerprint-linked behavior match");
  if (submodelExpectationCount === 0) errors.push("fixture must include at least one submodel expectation");

  return {
    ok: errors.length === 0,
    fixturePath,
    exampleCount: examples.length,
    fingerprintMatchCount,
    submodelExpectationCount,
    errors
  };
}

function parseArgs(argv) {
  const args = { fixturePath: DEFAULT_FIXTURE };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--fixture") args.fixturePath = argv[++index];
    else if (arg === "--help") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/sequencer-render-training/tooling/validate-combined-target-context-training-fixture.mjs [--fixture <fixture.json>]
`;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      process.stdout.write(usage());
      process.exit(0);
    }
    const result = validateCombinedTargetContextTrainingFixture(args);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.ok) process.exit(1);
  } catch (error) {
    console.error(error?.stack || String(error));
    process.exit(1);
  }
}
