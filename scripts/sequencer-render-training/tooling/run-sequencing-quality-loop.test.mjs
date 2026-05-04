import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { runSequencingQualityLoop } from "./run-sequencing-quality-loop.mjs";

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "xld-quality-loop-test-"));
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function modelCatalog() {
  return {
    layoutName: "RenderTraining",
    showDir: "/tmp/render-training",
    fixtureSequencePath: "/tmp/render-training/RenderTraining-AnimationFixture.xsq",
    canonicalModels: {
      single_line_horizontal: {
        modelName: "SingleLineHorizontal",
        modelType: "single_line",
        geometryProfile: "single_line_horizontal",
        analyzerFamily: "linear"
      },
      arch_group: {
        modelName: "ArchGroup",
        modelType: "arch",
        geometryProfile: "arch_grouped",
        analyzerFamily: "linear"
      },
      arch_single: {
        modelName: "ArchSingle",
        modelType: "arch",
        geometryProfile: "arch_single",
        analyzerFamily: "linear"
      },
      spinner: {
        modelName: "Spinner",
        modelType: "spinner",
        geometryProfile: "spinner_standard",
        analyzerFamily: "radial"
      },
      star_triple_layer: {
        modelName: "StarTripleLayer",
        modelType: "star",
        geometryProfile: "star_multi_layer",
        analyzerFamily: "star"
      },
      tree_flat: {
        modelName: "TreeFlat",
        modelType: "tree_flat",
        geometryProfile: "tree_flat_single_layer",
        analyzerFamily: "tree"
      }
    }
  };
}

function blockedRecord(passId, quality = 0.84) {
  return {
    recordId: `record:${passId}`,
    experimentId: "same-target-layer-stack-mono_white",
    passId,
    effectName: "Color Wash",
    leadTargets: ["StarTripleLayer"],
    sampleCount: 1,
    trendStatus: "single_run_baseline",
    quality: {
      latestOverallQuality: quality,
      meanOverallQuality: quality
    },
    promotion: {
      durableCandidate: false,
      blockers: [
        "insufficient_repeated_quality_evidence",
        "quality_trend_not_stable_or_improving"
      ]
    }
  };
}

function writeLatestEvidence(runRoot) {
  writeJson(path.join(runRoot, "cross-run-quality-records.json"), {
    artifactType: "layer_composition_quality_records_v1",
    durableCandidateCount: 0,
    blockedRecordCount: 1,
    records: [blockedRecord("foundation_brightness_variant")]
  });
  writeJson(path.join(runRoot, "cross-run-quality-priors-promoted.json"), {
    artifactType: "layer_composition_priors_v1",
    selectorReadyCount: 0,
    promotionState: "reviewed_without_selector_ready_priors",
    priors: []
  });
  writeJson(path.join(runRoot, "pass-runner-summary.json"), {
    artifactType: "layer_composition_pass_runner_summary_v1",
    processedPasses: 1,
    renderReviewAcceptedEvidenceCount: 1,
    renderReviewEligibleQualityMean: 0.84
  });
  writeJson(path.join(runRoot, "final-retention-cleanup-result.json"), {
    artifactType: "layer_composition_retention_cleanup_plan_v1",
    dryRun: false,
    deletionCount: 1,
    deletionBytes: 100,
    keptCount: 10
  });
}

test("sequencing quality loop scaffolds a controller-filtered plan", async () => {
  const root = tempDir();
  const latestRunRoot = path.join(root, "latest");
  const loopRoot = path.join(root, "loop");
  const modelCatalogPath = path.join(root, "model-catalog.json");
  writeLatestEvidence(latestRunRoot);
  writeJson(modelCatalogPath, modelCatalog());

  const summary = await runSequencingQualityLoop({
    latestRunRoot,
    loopRoot,
    modelCatalogPath,
    runId: "loop-test",
    maxQueue: 1
  });

  assert.equal(summary.status, "scaffolded");
  assert.equal(summary.nextQueueCount, 1);
  assert.equal(summary.plan.experimentCount, 1);
  assert.equal(summary.plan.passCount, 5);
  assert.equal(summary.scaffold.passCount, 5);
  assert.equal(fs.existsSync(path.join(loopRoot, "controller-state.json")), true);
  assert.equal(fs.existsSync(path.join(loopRoot, "training-plan.json")), true);
  assert.equal(fs.existsSync(path.join(loopRoot, "checkpoints.json")), true);

  const plan = JSON.parse(fs.readFileSync(path.join(loopRoot, "training-plan.json"), "utf8"));
  assert.deepEqual(
    plan.experiments[0].passes.map((pass) => pass.passId),
    ["empty_baseline", "one_layer_foundation", "two_layer_default", "three_layer_default", "foundation_brightness_variant"]
  );
});

test("sequencing quality loop blocks cleanly when evidence is missing", async () => {
  const root = tempDir();
  const modelCatalogPath = path.join(root, "model-catalog.json");
  writeJson(modelCatalogPath, modelCatalog());

  const summary = await runSequencingQualityLoop({
    latestRunRoot: "",
    loopRoot: path.join(root, "loop"),
    modelCatalogPath
  });

  assert.equal(summary.status, "blocked_no_controller_queue");
  assert.equal(summary.controllerDecision.nextAction, "await_evidence");
  assert.equal(summary.nextQueueCount, 0);
});

test("sequencing quality loop writes cross-run quality summary after live execution", async () => {
  const root = tempDir();
  const latestRunRoot = path.join(root, "latest");
  const loopRoot = path.join(root, "loop");
  const modelCatalogPath = path.join(root, "model-catalog.json");
  writeLatestEvidence(latestRunRoot);
  writeJson(modelCatalogPath, modelCatalog());

  const summary = await runSequencingQualityLoop({
    latestRunRoot,
    loopRoot,
    modelCatalogPath,
    runId: "loop-test",
    maxQueue: 1,
    applyRender: true,
    deps: {
      runPasses: async ({ runRoot }) => {
        writeJson(path.join(runRoot, "pass-runner-summary.json"), {
          artifactType: "layer_composition_pass_runner_summary_v1",
          processedPasses: 1,
          stopStatus: "pass_limit_reached",
          stopReason: "requested_max_passes_reached",
          renderReviewAcceptedEvidenceCount: 1
        });
        return {
          processedPasses: 1,
          stopStatus: "pass_limit_reached",
          stopReason: "requested_max_passes_reached",
          renderReviewAcceptedEvidenceCount: 1
        };
      },
      buildQualityTrend: ({ runRoots, outPath }) => {
        const artifact = { artifactType: "layer_composition_quality_trend_v1", runRoots };
        writeJson(outPath, artifact);
        return artifact;
      },
      buildQualityRecords: ({ outPath }) => {
        const artifact = {
          artifactType: "layer_composition_quality_records_v1",
          recordCount: 2,
          durableCandidateCount: 1,
          blockedRecordCount: 1,
          records: []
        };
        writeJson(outPath, artifact);
        return artifact;
      }
    }
  });

  assert.equal(summary.status, "executed");
  assert.equal(summary.crossRunQuality.recordCount, 2);
  assert.equal(summary.crossRunQuality.durableCandidateCount, 1);
  assert.equal(fs.existsSync(path.join(loopRoot, "cross-run-quality-trend.json")), true);
  assert.equal(fs.existsSync(path.join(loopRoot, "cross-run-quality-records.json")), true);
});
