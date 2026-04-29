import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  applyLayerCompositionRetentionCleanup,
  planLayerCompositionRetentionCleanup
} from "./apply-layer-composition-retention.mjs";

function makeTempRun() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "xld-layer-retention-"));
}

function writeFile(filePath, content = "data") {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  return filePath;
}

test("retention cleanup deletes only summarized purge-eligible artifacts inside run root", () => {
  const runRoot = makeTempRun();
  const rawFseq = writeFile(path.join(runRoot, "raw", "pass-1.fseq"), "raw");
  const fullGif = writeFile(path.join(runRoot, "raw", "pass-1.gif"), "gif");
  const observation = writeFile(path.join(runRoot, "observations", "pass-1.json"), "{}");
  const unsummarizedRaw = writeFile(path.join(runRoot, "raw", "pass-2.fseq"), "raw2");
  const outside = writeFile(path.join(os.tmpdir(), `outside-${Date.now()}.fseq`), "outside");

  const plan = planLayerCompositionRetentionCleanup({
    runRoot,
    ledger: {
      artifacts: [
        { path: rawFseq, artifactClass: "raw_fseq", summarized: true },
        { path: fullGif, artifactClass: "full_gif", summarized: true },
        { path: observation, artifactClass: "composition_stack_observation", summarized: true },
        { path: unsummarizedRaw, artifactClass: "raw_fseq", summarized: false },
        { path: outside, artifactClass: "raw_fseq", summarized: true }
      ]
    }
  });

  assert.equal(plan.deletionCount, 2);
  assert.equal(plan.deletions.some((row) => row.path === rawFseq), true);
  assert.equal(plan.deletions.some((row) => row.path === fullGif), true);
  assert.equal(plan.kept.find((row) => row.path === observation).reason, "always_keep_class");
  assert.equal(plan.kept.find((row) => row.path === unsummarizedRaw).reason, "not_summarized");
  assert.equal(plan.kept.find((row) => row.path === outside).reason, "outside_allowed_roots");

  const result = applyLayerCompositionRetentionCleanup(plan);
  assert.equal(result.deletedCount, 2);
  assert.equal(fs.existsSync(rawFseq), false);
  assert.equal(fs.existsSync(fullGif), false);
  assert.equal(fs.existsSync(observation), true);
  assert.equal(fs.existsSync(unsummarizedRaw), true);
  assert.equal(fs.existsSync(outside), true);
});

test("retention cleanup can delete explicitly allowed external staged artifacts", () => {
  const runRoot = makeTempRun();
  const externalRoot = fs.mkdtempSync(path.join(os.tmpdir(), "xld-layer-external-show-"));
  const allowed = writeFile(path.join(externalRoot, "xld-layer-composition-pass.xsq"), "<xsequence />");
  const notFlagged = writeFile(path.join(externalRoot, "manual-sequence.xsq"), "<xsequence />");
  const outside = writeFile(path.join(os.tmpdir(), `xld-layer-outside-${Date.now()}.xsq`), "<xsequence />");

  const plan = planLayerCompositionRetentionCleanup({
    runRoot,
    retentionPolicy: {
      externalDeleteRoots: [externalRoot]
    },
    ledger: {
      artifacts: [
        { path: allowed, artifactClass: "temporary_sequence_copy", summarized: true, allowExternalDelete: true },
        { path: notFlagged, artifactClass: "temporary_sequence_copy", summarized: true },
        { path: outside, artifactClass: "temporary_sequence_copy", summarized: true, allowExternalDelete: true }
      ]
    }
  });

  assert.equal(plan.deletionCount, 1);
  assert.equal(plan.deletions[0].path, allowed);
  assert.equal(plan.deletions[0].deletionScope, "allowed_external_root");
  assert.equal(plan.kept.find((row) => row.path === notFlagged).reason, "outside_allowed_roots");
  assert.equal(plan.kept.find((row) => row.path === outside).reason, "outside_allowed_roots");

  const result = applyLayerCompositionRetentionCleanup(plan);
  assert.equal(result.deletedCount, 1);
  assert.equal(fs.existsSync(allowed), false);
  assert.equal(fs.existsSync(notFlagged), true);
  assert.equal(fs.existsSync(outside), true);
});

test("retention cleanup preserves proof-critical and unreviewed failure artifacts", () => {
  const runRoot = makeTempRun();
  const proofRaw = writeFile(path.join(runRoot, "raw", "proof.gif"), "proof");
  const failureRaw = writeFile(path.join(runRoot, "raw", "failure.fseq"), "failure");

  const plan = planLayerCompositionRetentionCleanup({
    runRoot,
    ledger: {
      artifacts: [
        { path: proofRaw, artifactClass: "full_gif", summarized: true, proofCritical: true },
        { path: failureRaw, artifactClass: "raw_fseq", summarized: true, failureUnreviewed: true }
      ]
    }
  });

  assert.equal(plan.deletionCount, 0);
  assert.equal(plan.kept.find((row) => row.path === proofRaw).reason, "proof_critical");
  assert.equal(plan.kept.find((row) => row.path === failureRaw).reason, "failure_unreviewed");
});
