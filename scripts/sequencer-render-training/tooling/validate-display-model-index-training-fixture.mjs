#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_CONTRACT = "training-packages/training-package-v1/modules/xlights_sequencer_execution/contracts/display_model_index_v1.json";
const DEFAULT_FIXTURE = "training-packages/training-package-v1/modules/xlights_sequencer_execution/datasets/custom_model_index_fixture_summary.json";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function getByPath(object, fieldPath) {
  return String(fieldPath || "")
    .split(".")
    .reduce((current, key) => (current && typeof current === "object" ? current[key] : undefined), object);
}

function hasValue(object, fieldPath) {
  const value = getByPath(object, fieldPath);
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function validateRecordFields({ record, fields, errors, prefix }) {
  for (const field of fields) {
    if (!hasValue(record, field)) {
      errors.push(`${prefix} missing ${field}`);
    }
  }
}

export function validateDisplayModelIndexTrainingFixture({
  contractPath = DEFAULT_CONTRACT,
  fixturePath = DEFAULT_FIXTURE
} = {}) {
  const contract = readJson(contractPath);
  const fixture = readJson(fixturePath);
  const errors = [];
  const examples = normalizeArray(fixture.examples);

  if (contract.contract !== "display_model_index_v1") {
    errors.push("contract must be display_model_index_v1");
  }
  if (fixture.source?.derivedFrom !== "display/model-index.json") {
    errors.push("fixture source must derive from display/model-index.json");
  }

  let recordCount = 0;
  let customRecordCount = 0;
  let submodelRecordCount = 0;
  let customSubmodelRecordCount = 0;
  let builtinSubmodelRecordCount = 0;

  examples.forEach((example, exampleIndex) => {
    const shape = example.displayModelIndexShape || {};
    const records = normalizeArray(shape.records);
    if (shape.artifactType !== "target_metadata_index_v1") {
      errors.push(`examples[${exampleIndex}] artifactType must be target_metadata_index_v1`);
    }
    if (!records.length) {
      errors.push(`examples[${exampleIndex}] must include records`);
    }
    recordCount += records.length;

    records.forEach((record, recordIndex) => {
      const prefix = `examples[${exampleIndex}].records[${recordIndex}]`;
      validateRecordFields({
        record,
        fields: normalizeArray(contract.requiredRecordFields),
        errors,
        prefix
      });

      if (record.identity?.canonicalType === "custom") {
        customRecordCount += 1;
        validateRecordFields({
          record,
          fields: normalizeArray(contract.customModelFields),
          errors,
          prefix
        });
      }

      if (record.targetKind === "submodel") {
        submodelRecordCount += 1;
        validateRecordFields({
          record,
          fields: normalizeArray(contract.submodelRecordFields),
          errors,
          prefix
        });
        const hints = normalizeArray(record.structure?.submodelMetadata?.structureHints);
        if (hints.includes("custom_submodel")) customSubmodelRecordCount += 1;
        if (hints.includes("builtin_submodel")) builtinSubmodelRecordCount += 1;
      }
    });

    const assertions = normalizeArray(example.trainingAssertions).join(" ").toLowerCase();
    if (!assertions.includes("shared target collection")) {
      errors.push(`examples[${exampleIndex}] must assert shared target collection behavior`);
    }
    if (!assertions.includes("first-class target")) {
      errors.push(`examples[${exampleIndex}] must assert first-class submodel target behavior`);
    }
    if (!assertions.includes("do not infer") && !assertions.includes("not infer")) {
      errors.push(`examples[${exampleIndex}] must assert no semantic inference from names`);
    }
  });

  if (customRecordCount === 0) errors.push("fixture must include at least one custom model record");
  if (submodelRecordCount === 0) errors.push("fixture must include at least one submodel record");
  if (customSubmodelRecordCount === 0) errors.push("fixture must include at least one custom parent submodel record");
  if (builtinSubmodelRecordCount === 0) errors.push("fixture must include at least one built-in parent submodel record");

  return {
    ok: errors.length === 0,
    contractPath,
    fixturePath,
    exampleCount: examples.length,
    recordCount,
    customRecordCount,
    submodelRecordCount,
    customSubmodelRecordCount,
    builtinSubmodelRecordCount,
    errors
  };
}

function parseArgs(argv) {
  const args = {
    contractPath: DEFAULT_CONTRACT,
    fixturePath: DEFAULT_FIXTURE
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--contract") args.contractPath = argv[++index];
    else if (arg === "--fixture") args.fixturePath = argv[++index];
    else if (arg === "--help") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/sequencer-render-training/tooling/validate-display-model-index-training-fixture.mjs [--contract <contract.json>] [--fixture <fixture.json>]
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
    const result = validateDisplayModelIndexTrainingFixture(args);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.ok) process.exit(1);
  } catch (error) {
    console.error(error?.stack || String(error));
    process.exit(1);
  }
}
