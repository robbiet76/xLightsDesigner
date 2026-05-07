import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

function writeFile(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text);
}

function writeJson(filePath, payload) {
  writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

test("production benchmark manifest uses optional metadata instead of name inference", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-production-manifest-builder-"));
  const sequenceDir = path.join(root, "SequenceA");
  const outPath = path.join(root, "manifest.json");
  const metadataPath = path.join(root, "benchmark-metadata.json");
  writeFile(path.join(sequenceDir, "SequenceA.xsq"), `<?xml version="1.0" encoding="UTF-8"?><xsequence/>`);
  writeJson(metadataPath, {
    initialAuditSubset: ["SequenceA"],
    sequences: {
      SequenceA: {
        styleTags: ["dramatic", "high_energy"],
        humanReview: {
          status: "pending",
          notes: "Important calibration sequence.",
          knownStrengths: ["section contrast"],
          knownWeaknesses: []
        }
      }
    }
  });

  execFileSync("python3", [
    "scripts/sequencer-render-training/tooling/build-mature-sequence-benchmark-manifest.py",
    "--show-root",
    root,
    "--benchmark-metadata",
    metadataPath,
    "--out",
    outPath
  ], { cwd: path.resolve("."), stdio: "pipe" });

  const manifest = JSON.parse(fs.readFileSync(outPath, "utf8"));
  assert.equal(manifest.artifactType, "production_sequence_read_benchmark_manifest_v1");
  assert.equal(manifest.summary.sequenceCount, 1);
  assert.equal(manifest.summary.initialAuditSubsetCount, 1);
  assert.equal(manifest.metadataSource, metadataPath);
  assert.deepEqual(manifest.initialAuditSubset, ["SequenceA"]);
  assert.equal(manifest.sequences[0].sequenceId, "SequenceA");
  assert.deepEqual(manifest.sequences[0].styleTags, ["dramatic", "high_energy"]);
  assert.equal(manifest.sequences[0].initialAuditSubset, true);
  assert.equal(manifest.sequences[0].humanReview.notes, "Important calibration sequence.");
});

test("production benchmark manifest defaults to neutral annotations", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-production-manifest-neutral-"));
  const sequenceDir = path.join(root, "HolidayRoad");
  const outPath = path.join(root, "manifest.json");
  writeFile(path.join(sequenceDir, "HolidayRoad.xsq"), `<?xml version="1.0" encoding="UTF-8"?><xsequence/>`);

  execFileSync("python3", [
    "scripts/sequencer-render-training/tooling/build-mature-sequence-benchmark-manifest.py",
    "--show-root",
    root,
    "--out",
    outPath
  ], { cwd: path.resolve("."), stdio: "pipe" });

  const manifest = JSON.parse(fs.readFileSync(outPath, "utf8"));
  assert.equal(manifest.summary.sequenceCount, 1);
  assert.equal(manifest.summary.initialAuditSubsetCount, 0);
  assert.deepEqual(manifest.initialAuditSubset, []);
  assert.deepEqual(manifest.sequences[0].styleTags, []);
  assert.equal(manifest.sequences[0].initialAuditSubset, false);
});

test("production benchmark manifest supports explicit folder exclusions", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-production-manifest-exclude-"));
  const outPath = path.join(root, "manifest.json");
  writeFile(path.join(root, "Keep", "Keep.xsq"), `<?xml version="1.0" encoding="UTF-8"?><xsequence/>`);
  writeFile(path.join(root, "Skip", "Skip.xsq"), `<?xml version="1.0" encoding="UTF-8"?><xsequence/>`);

  execFileSync("python3", [
    "scripts/sequencer-render-training/tooling/build-mature-sequence-benchmark-manifest.py",
    "--show-root",
    root,
    "--exclude-folder",
    "Skip",
    "--out",
    outPath
  ], { cwd: path.resolve("."), stdio: "pipe" });

  const manifest = JSON.parse(fs.readFileSync(outPath, "utf8"));
  assert.deepEqual(manifest.sequences.map((sequence) => sequence.sequenceId), ["Keep"]);
  assert.deepEqual(manifest.excludedFolders, ["Skip", "Static"]);
});
