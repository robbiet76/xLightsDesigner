import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildAudioAnalysisQualityReport } from "../agent/audio-analyst/audio-analysis-quality.js";

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

function extractArtifact(stateFile = {}) {
  const localStateRaw = str(stateFile?.localStateRaw);
  const state = localStateRaw ? JSON.parse(localStateRaw) : stateFile;
  return state?.audioAnalysis?.artifact || null;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const state = readJson(options.statePath);
  const artifact = extractArtifact(state);
  if (!artifact) {
    throw new Error("No audioAnalysis.artifact found in state file.");
  }
  const report = buildAudioAnalysisQualityReport(artifact);
  const text = JSON.stringify(report, null, 2);
  if (options.out) {
    fs.writeFileSync(options.out, `${text}\n`);
  } else {
    process.stdout.write(`${text}\n`);
  }
}

main();
