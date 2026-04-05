import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { mergeVisualHintDefinitions } from "../runtime/visual-hint-definitions.js";

function str(value = "") {
  return String(value || "").trim();
}

function parseArgs(argv = []) {
  const options = {
    statePath: path.join(os.homedir(), "Library", "Application Support", "xlightsdesigner-desktop-v2", "xlightsdesigner-state.json"),
    out: ""
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = str(argv[index]);
    if (token === "--state") {
      options.statePath = str(argv[index + 1] || options.statePath) || options.statePath;
      index += 1;
    } else if (token === "--out") {
      options.out = str(argv[index + 1] || "") || "";
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }
  return options;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function buildReport(state = {}) {
  const records = mergeVisualHintDefinitions(state?.metadata?.visualHintDefinitions || []);
  const systemDefined = records.filter((row) => str(row?.source).toLowerCase() === "system");
  const pending = records.filter((row) => str(row?.status).toLowerCase() === "pending_definition");
  const managedDefined = records.filter((row) => {
    const source = str(row?.source).toLowerCase();
    const status = str(row?.status).toLowerCase();
    return source !== "system" && status === "defined";
  });

  return {
    artifactType: "visual_hint_definition_report_v1",
    createdAt: new Date().toISOString(),
    counts: {
      total: records.length,
      systemDefined: systemDefined.length,
      pending: pending.length,
      managedDefined: managedDefined.length
    },
    systemDefined: systemDefined.map((row) => ({
      name: row.name,
      semanticClass: row.semanticClass,
      behavioralIntent: row.behavioralIntent
    })),
    pending: pending.map((row) => ({
      name: row.name,
      definedBy: row.definedBy,
      provenance: row.provenance || {}
    })),
    managedDefined: managedDefined.map((row) => ({
      name: row.name,
      semanticClass: row.semanticClass,
      behavioralIntent: row.behavioralIntent,
      behavioralTags: Array.isArray(row.behavioralTags) ? row.behavioralTags : [],
      definedBy: row.definedBy,
      provenance: row.provenance || {}
    }))
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const state = readJson(options.statePath);
  const report = buildReport(state);
  const text = JSON.stringify(report, null, 2);
  if (options.out) {
    fs.writeFileSync(options.out, `${text}\n`);
  } else {
    process.stdout.write(`${text}\n`);
  }
}

main();
