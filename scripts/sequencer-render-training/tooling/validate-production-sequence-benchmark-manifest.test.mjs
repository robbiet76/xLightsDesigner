import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { validateProductionSequenceBenchmarkManifest } from "./validate-production-sequence-benchmark-manifest.mjs";

function writeFile(filePath, text = "") {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text);
}

function manifest(root, overrides = {}) {
  const xsq = path.join(root, "Song", "Song.xsq");
  const fseq = path.join(root, "Song", "Song.fseq");
  writeFile(xsq, "<xsequence />");
  writeFile(fseq, "");
  return {
    artifactType: "production_sequence_read_benchmark_manifest_v1",
    artifactVersion: 1,
    schema: "production_sequence_read_benchmark_manifest_v1",
    showRoot: root,
    readOnly: true,
    policy: {
      purpose: "production_sequence_read_calibration_only",
      trainSequencingPolicy: false,
      copyStylisticPatterns: false,
      mutateSourceSequences: false,
      promotionRequiresHumanReview: true,
      allowRenderFromXSQWhenNeeded: true,
      primaryOutcome: "calibrate_whole_display_sequence_reading"
    },
    evidencePriority: [
      "full_sequence_render",
      "section_render",
      "target_composition",
      "layer_stack",
      "effect_capability"
    ],
    sequences: [{
      sequenceId: "Song",
      folderName: "Song",
      folderPath: path.join(root, "Song"),
      readOnly: true,
      benchmarkUse: "production_sequence_read_calibration",
      expectedEvidenceScope: "full_sequence_render",
      xsq: { path: xsq, name: "Song.xsq" },
      fseq: { present: true, path: fseq, name: "Song.fseq", count: 1 },
      requiresRender: false,
      styleTags: ["general"],
      initialAuditSubset: true,
      humanReview: { status: "pending", notes: "", knownStrengths: [], knownWeaknesses: [] },
      readGoals: [
        "whole_display_energy_arc",
        "section_contrast",
        "target_usage_and_handoff",
        "effect_vocabulary_and_variation",
        "color_story",
        "density_and_brightness_ranges",
        "submodel_usage_when_present"
      ]
    }],
    ...overrides
  };
}

test("production sequence benchmark manifest validates read-only calibration references", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-production-sequence-manifest-"));
  const result = validateProductionSequenceBenchmarkManifest(manifest(root));

  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.summary.sequenceCount, 1);
  assert.equal(result.summary.withFseq, 1);
  assert.equal(result.summary.evidencePriority[0], "full_sequence_render");
});

test("production sequence benchmark manifest rejects training or mutation policy", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-production-sequence-manifest-bad-"));
  const result = validateProductionSequenceBenchmarkManifest(manifest(root, {
    policy: {
      purpose: "production_sequence_read_calibration_only",
      trainSequencingPolicy: true,
      copyStylisticPatterns: false,
      mutateSourceSequences: true,
      promotionRequiresHumanReview: false,
      primaryOutcome: "calibrate_whole_display_sequence_reading"
    }
  }));

  assert.equal(result.ok, false);
  assert.equal(result.errors.some((error) => error.includes("trainSequencingPolicy")), true);
  assert.equal(result.errors.some((error) => error.includes("mutateSourceSequences")), true);
  assert.equal(result.errors.some((error) => error.includes("promotionRequiresHumanReview")), true);
});
