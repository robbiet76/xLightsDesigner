import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildSequencingQualityControllerState } from "./run-sequencing-quality-controller.mjs";

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "xld-quality-controller-test-"));
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function curriculum(overrides = {}) {
  return {
    artifactType: "sequencing_quality_curriculum_v1",
    artifactVersion: 1,
    curriculumId: "sequencing-quality-v1",
    selectionPolicy: {
      cleanupRequiredAfterEveryLoop: true,
      promotionRequires: {
        minimumStableSamples: 2,
        minimumOverallQuality: 0.72,
        acceptedTrendStatuses: ["stable", "improving"]
      }
    },
    areas: [{ areaId: "layer_composition", priority: 1 }],
    goals: [{
      goalId: "layer.same_target.mono_white.basic",
      areaId: "layer_composition",
      priority: 1,
      status: "in_progress",
      requiredStableSamples: 2,
      coverage: {
        families: ["same_target_layer_stack"],
        paletteProfiles: ["mono_white"],
        effects: ["Color Wash"]
      },
      completionCriteria: {
        minimumSelectorReadyPriorCount: 8
      }
    }, {
      goalId: "layer.rgb_primary.basic",
      areaId: "layer_composition",
      priority: 2,
      status: "not_started",
      requiredStableSamples: 2,
      coverage: {
        families: ["same_target_layer_stack"],
        paletteProfiles: ["rgb_primary"],
        effects: ["Color Wash"]
      }
    }],
    ...overrides
  };
}

function record(passId, quality, blockers = ["insufficient_repeated_quality_evidence"]) {
  return {
    recordId: `record:${passId}`,
    experimentId: "same-target-layer-stack-mono_white",
    passId,
    effectName: "Color Wash",
    leadTargets: ["Vendor Star"],
    sampleCount: 1,
    trendStatus: "single_run_baseline",
    quality: {
      latestOverallQuality: quality,
      meanOverallQuality: quality
    },
    promotion: {
      durableCandidate: blockers.length === 0,
      blockers
    }
  };
}

function writeRunRoot(runRoot, records) {
  writeJson(path.join(runRoot, "cross-run-quality-records.json"), {
    artifactType: "layer_composition_quality_records_v1",
    durableCandidateCount: records.filter((row) => row.promotion.durableCandidate).length,
    blockedRecordCount: records.filter((row) => !row.promotion.durableCandidate).length,
    records
  });
  writeJson(path.join(runRoot, "cross-run-quality-priors-promoted.json"), {
    artifactType: "layer_composition_priors_v1",
    selectorReadyCount: 1,
    promotionState: "reviewed_with_selector_ready_priors",
    priors: [{
      priorId: "layer_composition:same_target_layer_stack:mono_white:one_layer_foundation",
      selectorReady: true,
      scope: {
        experimentId: "same-target-layer-stack-mono_white",
        passId: "one_layer_foundation",
        effectNames: ["Color Wash"]
      }
    }]
  });
  writeJson(path.join(runRoot, "pass-runner-summary.json"), {
    artifactType: "layer_composition_pass_runner_summary_v1",
    processedPasses: 4,
    renderReviewAcceptedEvidenceCount: 3,
    renderReviewEligibleQualityMean: 0.81
  });
  writeJson(path.join(runRoot, "final-retention-cleanup-result.json"), {
    artifactType: "layer_composition_retention_cleanup_plan_v1",
    dryRun: false,
    deletionCount: 12,
    deletionBytes: 2048,
    keptCount: 30
  });
}

test("controller queues blocked promising records for the active curriculum goal", () => {
  const runRoot = tempDir();
  writeRunRoot(runRoot, [
    record("low_quality", 0.6),
    record("three_layer_default", 0.84),
    record("reversed_layer_order", 0.82),
    record("durable", 0.9, [])
  ]);

  const state = buildSequencingQualityControllerState({
    curriculum: curriculum(),
    latestRunRoot: runRoot,
    maxQueue: 2
  });

  assert.equal(state.artifactType, "sequencing_quality_training_controller_state_v1");
  assert.equal(state.controllerDecision.selectedGoalId, "layer.same_target.mono_white.basic");
  assert.equal(state.controllerDecision.nextAction, "plan_quality_repeats");
  assert.deepEqual(state.nextQueue.map((row) => row.passId), ["three_layer_default", "reversed_layer_order"]);
  assert.equal(state.nextQueue[0].reason, "repeat_blocked_promising_record");
  assert.equal(state.coverageSummary.acceptedEvidenceCount, 3);
  assert.equal(state.promotionSummary.selectorReadyPriorCount, 1);
  assert.equal(state.cleanupSummary.status, "completed");
});

test("controller waits for evidence when no latest run root is available", () => {
  const state = buildSequencingQualityControllerState({
    curriculum: curriculum(),
    latestRunRoot: ""
  });

  assert.equal(state.controllerDecision.nextAction, "await_evidence");
  assert.equal(state.controllerDecision.selectionReason, "missing_latest_evidence");
  assert.deepEqual(state.nextQueue, []);
  assert.ok(state.controllerDecision.blockedBy.includes("latest_run_root"));
});

test("controller plans a coverage gap when no promising repeat exists", () => {
  const runRoot = tempDir();
  writeRunRoot(runRoot, [record("below_threshold", 0.5)]);

  const state = buildSequencingQualityControllerState({
    curriculum: curriculum(),
    latestRunRoot: runRoot
  });

  assert.equal(state.controllerDecision.nextAction, "plan_goal_coverage");
  assert.equal(state.nextQueue[0].reason, "coverage_gap");
  assert.equal(state.nextQueue[0].goalId, "layer.same_target.mono_white.basic");
});

test("controller can plan from quality evidence when promoted priors are not present yet", () => {
  const runRoot = tempDir();
  writeRunRoot(runRoot, [record("three_layer_default", 0.84)]);
  fs.rmSync(path.join(runRoot, "cross-run-quality-priors-promoted.json"));

  const state = buildSequencingQualityControllerState({
    curriculum: curriculum(),
    latestRunRoot: runRoot
  });

  assert.equal(state.controllerDecision.nextAction, "plan_quality_repeats");
  assert.equal(state.nextQueue[0].passId, "three_layer_default");
  assert.equal(state.promotionSummary.selectorReadyPriorCount, 0);
});

test("controller increments loop index from a previous state", () => {
  const runRoot = tempDir();
  const previousStatePath = path.join(runRoot, "previous-state.json");
  writeJson(previousStatePath, { loopIndex: 7 });
  writeRunRoot(runRoot, [record("three_layer_default", 0.84)]);

  const state = buildSequencingQualityControllerState({
    curriculum: curriculum(),
    latestRunRoot: runRoot,
    previousStatePath
  });

  assert.equal(state.loopIndex, 8);
});
