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

function regressingRecord(passId, quality = 0.81) {
  return {
    ...record(passId, quality, ["quality_trend_not_stable_or_improving"]),
    sampleCount: 3,
    trendStatus: "regressing"
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
  writeJson(path.join(runRoot, "controller-state.json"), {
    artifactType: "sequencing_quality_training_controller_state_v1",
    nextQueue: []
  });
}

function writeFullSequenceReview(runRoot, overrides = {}) {
  writeJson(path.join(runRoot, "full-sequence-review-loop.json"), {
    artifactType: "full_sequence_review_loop_v1",
    status: "ready",
    windowCount: 2,
    evidenceEligibleWindowCount: 2,
    timingSources: ["section"],
    qualityDimensions: ["energy_progression", "timing_alignment", "repetition_with_variation"],
    ...overrides
  });
}

function writeVideoAestheticScore(runRoot, overrides = {}) {
  writeJson(path.join(runRoot, "video-aesthetic-score.json"), {
    artifactType: "video_aesthetic_score_v1",
    status: "ready",
    scoredWindowCount: 2,
    evidenceEligibleWindowCount: 2,
    qualityDimensions: [
      "display_evolution",
      "pacing_variety",
      "visual_balance",
      "motion_interest"
    ],
    scores: {
      overallAestheticScore: 0.61,
      displayEvolution: 0.59,
      pacingVariety: 0.22,
      transitionFlow: 0.73,
      focalClarity: 0.8,
      visualBalance: 0.3,
      motionInterest: 0.48,
      colorDiscipline: 0.7,
      clutterControl: 0.93,
      qualityConsistency: 0.9
    },
    recommendationSummary: [
      "Add clearer variation in motion, density, or palette across repeated sections.",
      "Rebalance coverage across the display or explicitly use negative space as an intentional choice."
    ],
    promotion: {
      evidenceEligible: false,
      blockers: ["overall_aesthetic_score_below_threshold"]
    },
    ...overrides
  });
}

function writeVideoAestheticAttemptComparison(runRoot, overrides = {}) {
  writeJson(path.join(runRoot, "video-aesthetic-attempt-comparison.json"), {
    artifactType: "video_aesthetic_attempt_comparison_v1",
    status: "ready",
    comparisonStatus: "neutral",
    promotionEligible: false,
    summary: {
      overallAestheticScoreDelta: -0.001,
      improvedDimensionCount: 3,
      regressedDimensionCount: 2
    },
    ...overrides
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
  assert.equal(state.nextQueue[0].goalId, "layer.rgb_primary.basic");
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

test("controller does not repeat sufficiently sampled regressing records forever", () => {
  const runRoot = tempDir();
  writeRunRoot(runRoot, [regressingRecord("foundation_brightness_variant", 0.81)]);

  const state = buildSequencingQualityControllerState({
    curriculum: curriculum(),
    latestRunRoot: runRoot
  });

  assert.equal(state.controllerDecision.nextAction, "plan_goal_coverage");
  assert.equal(state.nextQueue[0].reason, "coverage_gap");
  assert.equal(state.nextQueue[0].goalId, "layer.rgb_primary.basic");
});

test("controller does not map layer records onto future goals without layer coverage", () => {
  const runRoot = tempDir();
  writeRunRoot(runRoot, [{
    ...record("reversed_layer_order", 0.84),
    effectName: "Shimmer"
  }]);

  const state = buildSequencingQualityControllerState({
    curriculum: {
      ...curriculum(),
      goals: [{
        goalId: "display.full_sequence.quality_v1",
        areaId: "layer_composition",
        priority: 1,
        status: "not_started",
        requiredStableSamples: 2,
        coverage: {
          reviewScopes: ["whole_sequence_window"]
        }
      }]
    },
    latestRunRoot: runRoot
  });

  assert.equal(state.controllerDecision.nextAction, "plan_goal_coverage");
  assert.equal(state.nextQueue[0].reason, "coverage_gap");
});

test("controller status does not count layer records for non-family submodel goals", () => {
  const runRoot = tempDir();
  writeRunRoot(runRoot, [record("three_layer_default", 0.84, [])]);

  const state = buildSequencingQualityControllerState({
    curriculum: {
      ...curriculum(),
      goals: [{
        goalId: "submodel.vendor_fixture.basic",
        areaId: "layer_composition",
        priority: 1,
        status: "not_started",
        requiredStableSamples: 2,
        coverage: {
          effects: ["Color Wash"],
          targetScopes: ["submodel"]
        }
      }]
    },
    latestRunRoot: runRoot
  });

  assert.equal(state.goalStatuses[0].durableCandidateCount, 0);
  assert.equal(state.goalStatuses[0].evidenceStatus, "not_started");
});

test("controller counts durable structured submodel records for submodel goals", () => {
  const runRoot = tempDir();
  writeRunRoot(runRoot, [{
    ...record("sibling_submodels_split", 0.85, []),
    experimentId: "submodel-structure-vendor_basic-mono_white",
    family: "submodel_structure",
    targetScopes: ["submodel"],
    modelTypes: ["custom"],
    leadTargets: ["CustomFace/Face"],
    sampleCount: 2,
    trendStatus: "stable"
  }]);

  const state = buildSequencingQualityControllerState({
    curriculum: {
      ...curriculum(),
      goals: [{
        goalId: "submodel.vendor_fixture.basic",
        areaId: "layer_composition",
        priority: 1,
        status: "not_started",
        requiredStableSamples: 2,
        coverage: {
          targetScopes: ["submodel"],
          modelTypes: ["custom"],
          effects: ["Color Wash"]
        }
      }]
    },
    latestRunRoot: runRoot
  });

  assert.equal(state.goalStatuses[0].durableCandidateCount, 1);
  assert.equal(state.goalStatuses[0].evidenceStatus, "in_progress");
  assert.equal(state.controllerDecision.nextAction, "idle");
});

test("controller counts durable display review records for display-level goals", () => {
  const runRoot = tempDir();
  writeRunRoot(runRoot, [{
    ...record("sibling_submodels_split", 0.86, []),
    experimentId: "display-quality-review-mono_white",
    family: "display_quality_review",
    sampleCount: 2,
    trendStatus: "stable",
    reviewScopes: ["section_video", "whole_sequence_window", "full_display_contact_sheet"],
    qualityDimensions: ["coverage_balance", "motion_coherence", "palette_readability"]
  }]);

  const state = buildSequencingQualityControllerState({
    curriculum: {
      ...curriculum(),
      goals: [{
        goalId: "display.full_sequence.quality_v1",
        areaId: "display_level_composition",
        priority: 1,
        status: "not_started",
        requiredStableSamples: 2,
      coverage: {
        families: ["display_quality_review"],
        reviewScopes: ["whole_sequence_window"],
        qualityDimensions: ["motion_coherence", "palette_readability"]
        }
      }]
    },
    latestRunRoot: runRoot
  });

  assert.equal(state.goalStatuses[0].durableCandidateCount, 1);
  assert.equal(state.goalStatuses[0].evidenceStatus, "in_progress");
});

test("controller does not repeat arbitrary blocked effect records for display-only goals", () => {
  const runRoot = tempDir();
  writeRunRoot(runRoot, [{
    ...record("reversed_layer_order", 0.83),
    effectName: "Shimmer",
    reviewScopes: ["section_video", "whole_sequence_window", "full_display_contact_sheet"],
    qualityDimensions: ["coverage_balance", "motion_coherence", "palette_readability"]
  }]);

  const state = buildSequencingQualityControllerState({
    curriculum: {
      ...curriculum(),
      goals: [{
        goalId: "display.full_sequence.quality_v1",
        areaId: "display_level_composition",
        priority: 1,
        status: "not_started",
        requiredStableSamples: 2,
        coverage: {
          families: ["display_quality_review"],
          reviewScopes: ["whole_sequence_window"],
          qualityDimensions: ["motion_coherence"]
        }
      }]
    },
    latestRunRoot: runRoot
  });

  assert.equal(state.goalStatuses[0].blockedPromisingCount, 0);
  assert.equal(state.controllerDecision.selectionReason, "coverage_gap");
  assert.equal(state.nextQueue[0].goalId, "display.full_sequence.quality_v1");
});

test("controller counts durable music timing records for music-structure goals", () => {
  const runRoot = tempDir();
  writeRunRoot(runRoot, [{
    ...record("section_energy_build", 0.86, []),
    experimentId: "music-structure-review-mono_white",
    family: "music_structure_review",
    sampleCount: 2,
    trendStatus: "stable",
    timingSources: ["section"],
    musicQualityDimensions: ["energy_progression", "timing_alignment", "repetition_with_variation"]
  }]);

  const state = buildSequencingQualityControllerState({
    curriculum: {
      ...curriculum(),
      goals: [{
        goalId: "music.structure_alignment.v1",
        areaId: "musical_structure",
        priority: 1,
        status: "not_started",
        requiredStableSamples: 2,
        coverage: {
          families: ["music_structure_review"],
          timingSources: ["section", "beat"],
          qualityDimensions: ["energy_progression", "timing_alignment"]
        }
      }]
    },
    latestRunRoot: runRoot
  });

  assert.equal(state.goalStatuses[0].durableCandidateCount, 1);
  assert.equal(state.goalStatuses[0].evidenceStatus, "in_progress");
});

test("controller does not advance past explicitly blocked curriculum goals", () => {
  const runRoot = tempDir();
  writeRunRoot(runRoot, [{
    ...record("section_energy_build", 0.86, []),
    experimentId: "music-structure-review-mono_white",
    family: "music_structure_review",
    sampleCount: 2,
    trendStatus: "stable",
    timingSources: ["section"],
    musicQualityDimensions: ["energy_progression", "timing_alignment"]
  }]);

  const state = buildSequencingQualityControllerState({
    curriculum: {
      ...curriculum(),
      goals: [{
        goalId: "music.structure_alignment.v1",
        areaId: "musical_structure",
        priority: 1,
        status: "not_started",
        blockedBy: ["needs broader full-sequence review loop"],
        coverage: {
          families: ["music_structure_review"],
          timingSources: ["section"],
          qualityDimensions: ["energy_progression"]
        }
      }]
    },
    latestRunRoot: runRoot
  });

  assert.equal(state.controllerDecision.selectedGoalId, "music.structure_alignment.v1");
  assert.equal(state.controllerDecision.nextAction, "resolve_blocker");
  assert.deepEqual(state.controllerDecision.blockedBy, ["needs broader full-sequence review loop"]);
  assert.equal(state.nextQueue[0].blockedBy[0], "needs broader full-sequence review loop");
});

test("controller plans earlier unblocked coverage before later blocked goals", () => {
  const runRoot = tempDir();
  writeRunRoot(runRoot, []);
  writeFullSequenceReview(runRoot);

  const state = buildSequencingQualityControllerState({
    curriculum: {
      ...curriculum(),
      goals: [{
        goalId: "display.full_sequence.quality_v1",
        areaId: "display_level_composition",
        priority: 1,
        status: "not_started",
        requiredStableSamples: 2,
        coverage: {
          families: ["display_quality_review"],
          reviewScopes: ["whole_sequence_window"],
          qualityDimensions: ["motion_coherence"]
        }
      }, {
        goalId: "creative.intent_match.v1",
        areaId: "creative_intent_matching",
        priority: 2,
        status: "not_started",
        blockedBy: ["needs display-level and musical-structure evidence first"],
        coverage: {
          intentDimensions: ["mood"]
        }
      }]
    },
    latestRunRoot: runRoot
  });

  assert.equal(state.controllerDecision.selectedGoalId, "display.full_sequence.quality_v1");
  assert.equal(state.controllerDecision.nextAction, "plan_goal_coverage");
  assert.equal(state.nextQueue[0].reason, "coverage_gap");
});

test("controller resolves full-sequence loop blocker when review loop artifact is ready", () => {
  const runRoot = tempDir();
  writeRunRoot(runRoot, [{
    ...record("section_energy_build", 0.86, []),
    experimentId: "music-structure-review-mono_white",
    family: "music_structure_review",
    sampleCount: 2,
    trendStatus: "stable",
    timingSources: ["section"],
    musicQualityDimensions: ["energy_progression", "timing_alignment"]
  }]);
  writeFullSequenceReview(runRoot);

  const state = buildSequencingQualityControllerState({
    curriculum: {
      ...curriculum(),
      goals: [{
        goalId: "music.structure_alignment.v1",
        areaId: "musical_structure",
        priority: 1,
        status: "not_started",
        blockedBy: ["needs broader full-sequence review loop"],
        coverage: {
          families: ["music_structure_review"],
          timingSources: ["section"],
          qualityDimensions: ["energy_progression"]
        }
      }, {
        goalId: "creative.intent_match.v1",
        areaId: "creative_intent_matching",
        priority: 2,
        status: "not_started",
        coverage: {
          reviewScopes: ["whole_sequence_window"]
        }
      }]
    },
    latestRunRoot: runRoot
  });

  assert.deepEqual(state.goalStatuses[0].blockers, []);
  assert.equal(state.controllerDecision.selectedGoalId, "creative.intent_match.v1");
});

test("controller uses weak video aesthetic score to steer display quality coverage", () => {
  const runRoot = tempDir();
  writeRunRoot(runRoot, []);
  writeFullSequenceReview(runRoot);
  writeVideoAestheticScore(runRoot);

  const state = buildSequencingQualityControllerState({
    curriculum: {
      ...curriculum(),
      goals: [{
        goalId: "display.full_sequence.quality_v1",
        areaId: "display_level_composition",
        priority: 1,
        status: "not_started",
        coverage: {
          families: ["display_quality_review"],
          qualityDimensions: ["coverage_balance", "regional_variety"]
        },
        completionCriteria: {
          minimumDurableCandidateCount: 2
        }
      }]
    },
    latestRunRoot: runRoot
  });

  assert.equal(state.controllerDecision.selectedGoalId, "display.full_sequence.quality_v1");
  assert.equal(state.controllerDecision.selectionReason, "video_aesthetic_score_below_threshold");
  assert.equal(state.nextQueue[0].reason, "coverage_gap");
  assert.equal(state.nextQueue[0].improvementSource, "video_aesthetic_score");
  assert.equal(state.nextQueue[0].overallAestheticScore, 0.61);
  assert.deepEqual(
    state.nextQueue[0].weakDimensions.slice(0, 2).map((row) => row.dimension),
    ["pacing_variety", "visual_balance"]
  );
  assert.equal(state.videoAestheticSummary.status, "ready");
  assert.equal(state.videoAestheticSummary.overallAestheticScore, 0.61);
});

test("controller changes video aesthetic strategy after neutral attempt", () => {
  const runRoot = tempDir();
  writeRunRoot(runRoot, []);
  writeFullSequenceReview(runRoot);
  writeVideoAestheticScore(runRoot);
  writeVideoAestheticAttemptComparison(runRoot);

  const state = buildSequencingQualityControllerState({
    curriculum: {
      ...curriculum(),
      goals: [{
        goalId: "display.full_sequence.quality_v1",
        areaId: "display_level_composition",
        priority: 1,
        status: "not_started",
        coverage: {
          families: ["display_quality_review"],
          qualityDimensions: ["coverage_balance", "regional_variety"]
        },
        completionCriteria: {
          minimumDurableCandidateCount: 2
        }
      }]
    },
    latestRunRoot: runRoot
  });

  assert.equal(state.controllerDecision.selectionReason, "video_aesthetic_score_below_threshold");
  assert.equal(state.nextQueue[0].previousAttemptStatus, "neutral");
  assert.equal(state.nextQueue[0].avoidStrategy, "simultaneous_display_balance_revision");
  assert.equal(state.nextQueue[0].nextStrategy, "section_window_pacing_balance");
  assert.equal(state.videoAestheticAttemptSummary.comparisonStatus, "neutral");
  assert.equal(state.videoAestheticAttemptSummary.overallAestheticScoreDelta, -0.001);
});

test("controller does not repeat section-window strategy after neutral section-window attempt", () => {
  const runRoot = tempDir();
  writeRunRoot(runRoot, []);
  writeFullSequenceReview(runRoot);
  writeVideoAestheticScore(runRoot);
  writeVideoAestheticAttemptComparison(runRoot);
  writeJson(path.join(runRoot, "controller-state.json"), {
    artifactType: "sequencing_quality_training_controller_state_v1",
    nextQueue: [{
      nextStrategy: "section_window_pacing_balance"
    }]
  });

  const state = buildSequencingQualityControllerState({
    curriculum: {
      ...curriculum(),
      goals: [{
        goalId: "display.full_sequence.quality_v1",
        areaId: "display_level_composition",
        priority: 1,
        status: "not_started",
        coverage: {
          families: ["display_quality_review"],
          qualityDimensions: ["coverage_balance", "regional_variety"]
        },
        completionCriteria: {
          minimumDurableCandidateCount: 2
        }
      }]
    },
    latestRunRoot: runRoot
  });

  assert.equal(state.nextQueue[0].previousAttemptStatus, "neutral");
  assert.equal(state.nextQueue[0].avoidStrategy, "section_window_pacing_balance");
  assert.equal(state.nextQueue[0].nextStrategy, "regional_focus_contrast");
});

test("controller avoids recently ineffective video aesthetic strategies", () => {
  const firstRoot = tempDir();
  const secondRoot = tempDir();
  const latestRoot = tempDir();
  for (const root of [firstRoot, secondRoot, latestRoot]) {
    writeRunRoot(root, []);
    writeFullSequenceReview(root);
    writeVideoAestheticScore(root);
  }
  writeVideoAestheticAttemptComparison(firstRoot, { comparisonStatus: "regressed" });
  writeJson(path.join(firstRoot, "controller-state.json"), {
    artifactType: "sequencing_quality_training_controller_state_v1",
    nextQueue: [{ nextStrategy: "section_window_pacing_balance" }]
  });
  writeVideoAestheticAttemptComparison(secondRoot, { comparisonStatus: "neutral" });
  writeJson(path.join(secondRoot, "controller-state.json"), {
    artifactType: "sequencing_quality_training_controller_state_v1",
    nextQueue: [{ nextStrategy: "regional_focus_contrast" }]
  });
  writeVideoAestheticAttemptComparison(latestRoot, { comparisonStatus: "neutral" });
  writeJson(path.join(latestRoot, "controller-state.json"), {
    artifactType: "sequencing_quality_training_controller_state_v1",
    nextQueue: [{ nextStrategy: "regional_focus_contrast" }]
  });
  const records = JSON.parse(fs.readFileSync(path.join(latestRoot, "cross-run-quality-records.json"), "utf8"));
  writeJson(path.join(latestRoot, "cross-run-quality-records.json"), {
    ...records,
    sourceRunRoots: [firstRoot, secondRoot, latestRoot]
  });

  const state = buildSequencingQualityControllerState({
    curriculum: {
      ...curriculum(),
      goals: [{
        goalId: "display.full_sequence.quality_v1",
        areaId: "display_level_composition",
        priority: 1,
        status: "not_started",
        coverage: {
          families: ["display_quality_review"],
          qualityDimensions: ["coverage_balance", "regional_variety"]
        },
        completionCriteria: {
          minimumDurableCandidateCount: 2
        }
      }]
    },
    latestRunRoot: latestRoot
  });

  assert.equal(state.nextQueue[0].previousAttemptStatus, "neutral");
  assert.equal(state.nextQueue[0].avoidStrategy, "section_window_pacing_balance,regional_focus_contrast");
  assert.equal(state.nextQueue[0].nextStrategy, "rgb_primary_regional_focus_contrast");
});

test("controller selects focal consistency repair after all current video strategies are ineffective", () => {
  const roots = [tempDir(), tempDir(), tempDir(), tempDir()];
  const strategies = [
    "section_window_pacing_balance",
    "regional_focus_contrast",
    "rgb_primary_regional_focus_contrast",
    "simultaneous_display_balance_revision"
  ];
  roots.forEach((root, index) => {
    writeRunRoot(root, []);
    writeFullSequenceReview(root);
    writeVideoAestheticScore(root);
    writeVideoAestheticAttemptComparison(root, { comparisonStatus: index === 0 ? "regressed" : "neutral" });
    writeJson(path.join(root, "controller-state.json"), {
      artifactType: "sequencing_quality_training_controller_state_v1",
      nextQueue: [{ nextStrategy: strategies[index] }]
    });
  });
  const latestRoot = roots[roots.length - 1];
  const records = JSON.parse(fs.readFileSync(path.join(latestRoot, "cross-run-quality-records.json"), "utf8"));
  writeJson(path.join(latestRoot, "cross-run-quality-records.json"), {
    ...records,
    sourceRunRoots: roots
  });

  const state = buildSequencingQualityControllerState({
    curriculum: {
      ...curriculum(),
      goals: [{
        goalId: "display.full_sequence.quality_v1",
        areaId: "display_level_composition",
        priority: 1,
        status: "not_started",
        coverage: {
          families: ["display_quality_review"],
          qualityDimensions: ["coverage_balance", "regional_variety"]
        },
        completionCriteria: {
          minimumDurableCandidateCount: 2
        }
      }]
    },
    latestRunRoot: latestRoot
  });

  assert.equal(state.nextQueue[0].previousAttemptStatus, "neutral");
  assert.equal(state.nextQueue[0].nextStrategy, "focal_consistency_repair");
});

test("controller moves improved regional focus to rgb primary when color discipline remains weak", () => {
  const runRoot = tempDir();
  writeRunRoot(runRoot, []);
  writeFullSequenceReview(runRoot);
  writeVideoAestheticScore(runRoot, {
    scores: {
      overallAestheticScore: 0.704,
      displayEvolution: 0.92,
      pacingVariety: 0.23,
      transitionFlow: 0.66,
      focalClarity: 0.77,
      visualBalance: 0.45,
      motionInterest: 0.56,
      colorDiscipline: 0.636,
      clutterControl: 1,
      qualityConsistency: 0.97
    }
  });
  writeVideoAestheticAttemptComparison(runRoot, {
    comparisonStatus: "improved",
    promotionEligible: true,
    summary: {
      overallAestheticScoreDelta: 0.012,
      improvedDimensionCount: 4,
      regressedDimensionCount: 0
    }
  });
  writeJson(path.join(runRoot, "controller-state.json"), {
    artifactType: "sequencing_quality_training_controller_state_v1",
    nextQueue: [{
      nextStrategy: "regional_focus_contrast"
    }]
  });

  const state = buildSequencingQualityControllerState({
    curriculum: {
      ...curriculum(),
      goals: [{
        goalId: "display.full_sequence.quality_v1",
        areaId: "display_level_composition",
        priority: 1,
        status: "not_started",
        coverage: {
          families: ["display_quality_review"],
          qualityDimensions: ["coverage_balance", "regional_variety"]
        },
        completionCriteria: {
          minimumDurableCandidateCount: 2
        }
      }]
    },
    latestRunRoot: runRoot
  });

  assert.equal(state.nextQueue[0].previousAttemptStatus, "improved");
  assert.equal(state.nextQueue[0].nextStrategy, "rgb_primary_regional_focus_contrast");
  assert.equal(state.nextQueue[0].avoidStrategy, "");
});

test("controller resolves creative prerequisite blocker from display and music evidence", () => {
  const runRoot = tempDir();
  writeRunRoot(runRoot, [
    {
      ...record("display_review", 0.86, []),
      experimentId: "display-quality-review-mono_white",
      family: "display_quality_review",
      sampleCount: 2,
      trendStatus: "stable",
      reviewScopes: ["whole_sequence_window"],
      qualityDimensions: ["motion_coherence"]
    },
    {
      ...record("music_review", 0.84, []),
      experimentId: "music-structure-review-mono_white",
      family: "music_structure_review",
      sampleCount: 2,
      trendStatus: "stable",
      timingSources: ["section"],
      musicQualityDimensions: ["energy_progression"]
    }
  ]);
  writeFullSequenceReview(runRoot);

  const state = buildSequencingQualityControllerState({
    curriculum: {
      ...curriculum(),
      goals: [{
        goalId: "display.full_sequence.quality_v1",
        areaId: "display_level_composition",
        priority: 1,
        status: "not_started",
        coverage: {
          families: ["display_quality_review"],
          reviewScopes: ["whole_sequence_window"],
          qualityDimensions: ["motion_coherence"]
        }
      }, {
        goalId: "music.structure_alignment.v1",
        areaId: "musical_structure",
        priority: 2,
        status: "not_started",
        blockedBy: ["needs broader full-sequence review loop"],
        coverage: {
          families: ["music_structure_review"],
          timingSources: ["section"],
          qualityDimensions: ["energy_progression"]
        }
      }, {
        goalId: "creative.intent_match.v1",
        areaId: "creative_intent_matching",
        priority: 3,
        status: "not_started",
        blockedBy: ["needs display-level and musical-structure evidence first"],
        coverage: {
          reviewMethods: ["deterministic_metrics"]
        }
      }]
    },
    latestRunRoot: runRoot
  });

  const creativeStatus = state.goalStatuses.find((row) => row.goalId === "creative.intent_match.v1");
  assert.deepEqual(creativeStatus.blockers, []);
  assert.equal(state.controllerDecision.selectedGoalId, "creative.intent_match.v1");
  assert.equal(state.controllerDecision.selectionReason, "coverage_gap");
});

test("controller counts durable creative intent records for creative goals", () => {
  const runRoot = tempDir();
  writeRunRoot(runRoot, [{
    ...record("emphasis_negative_space", 0.84, []),
    experimentId: "creative-intent-probe-mono_white",
    sampleCount: 2,
    trendStatus: "stable",
    intentDimensions: ["mood", "palette", "pace", "emphasis", "style", "negative_space"],
    reviewMethods: ["deterministic_metrics", "vision_review"]
  }]);

  const state = buildSequencingQualityControllerState({
    curriculum: {
      ...curriculum(),
      goals: [{
        goalId: "creative.intent_match.v1",
        areaId: "creative_intent_matching",
        priority: 1,
        status: "not_started",
        coverage: {
          intentDimensions: ["mood", "palette", "negative_space"],
          reviewMethods: ["deterministic_metrics"]
        }
      }]
    },
    latestRunRoot: runRoot
  });

  assert.equal(state.goalStatuses[0].durableCandidateCount, 1);
  assert.equal(state.goalStatuses[0].evidenceStatus, "in_progress");
});

test("controller blocks creative revision comparison until baseline creative evidence exists", () => {
  const runRoot = tempDir();
  writeRunRoot(runRoot, []);

  const state = buildSequencingQualityControllerState({
    curriculum: {
      ...curriculum(),
      goals: [{
        goalId: "creative.intent_revision_comparison.v1",
        areaId: "creative_intent_matching",
        priority: 1,
        status: "not_started",
        requiredStableSamples: 2,
        blockedBy: ["needs baseline creative-intent evidence first"],
        coverage: {
          families: ["creative_intent_revision_comparison"],
          reviewMethods: ["before_after_revision_comparison"]
        }
      }]
    },
    latestRunRoot: runRoot
  });

  assert.equal(state.controllerDecision.nextAction, "resolve_blocker");
  assert.deepEqual(state.controllerDecision.blockedBy, ["needs baseline creative-intent evidence first"]);
});

test("controller plans creative revision comparison after baseline creative evidence", () => {
  const runRoot = tempDir();
  writeRunRoot(runRoot, [{
    ...record("emphasis_negative_space", 0.84, []),
    experimentId: "creative-intent-probe-mono_white",
    family: "creative_intent_probe",
    sampleCount: 2,
    trendStatus: "stable",
    intentDimensions: ["mood", "palette", "pace", "emphasis", "style", "negative_space"],
    reviewMethods: ["deterministic_metrics"]
  }]);

  const state = buildSequencingQualityControllerState({
    curriculum: {
      ...curriculum(),
      goals: [{
        goalId: "creative.intent_match.v1",
        areaId: "creative_intent_matching",
        priority: 1,
        status: "not_started",
        requiredStableSamples: 2,
        coverage: {
          families: ["creative_intent_probe"],
          reviewMethods: ["deterministic_metrics"]
        },
        completionCriteria: {
          minimumDurableCandidateCount: 1
        }
      }, {
        goalId: "creative.intent_revision_comparison.v1",
        areaId: "creative_intent_matching",
        priority: 2,
        status: "not_started",
        requiredStableSamples: 2,
        blockedBy: ["needs baseline creative-intent evidence first"],
        coverage: {
          families: ["creative_intent_revision_comparison"],
          reviewMethods: ["before_after_revision_comparison"]
        }
      }]
    },
    latestRunRoot: runRoot
  });

  assert.equal(state.controllerDecision.selectedGoalId, "creative.intent_revision_comparison.v1");
  assert.equal(state.controllerDecision.nextAction, "plan_goal_coverage");
  assert.equal(state.nextQueue[0].reason, "coverage_gap");
});

test("controller counts durable creative revision comparison records", () => {
  const runRoot = tempDir();
  writeRunRoot(runRoot, [{
    ...record("intent_targeted_revision", 0.87, []),
    experimentId: "creative-intent-revision-comparison-mono_white",
    family: "creative_intent_revision_comparison",
    sampleCount: 2,
    trendStatus: "stable",
    intentDimensions: ["mood", "palette", "pace", "emphasis", "style", "negative_space"],
    reviewMethods: ["deterministic_metrics", "before_after_revision_comparison"]
  }]);

  const state = buildSequencingQualityControllerState({
    curriculum: {
      ...curriculum(),
      goals: [{
        goalId: "creative.intent_revision_comparison.v1",
        areaId: "creative_intent_matching",
        priority: 1,
        status: "not_started",
        requiredStableSamples: 2,
        coverage: {
          families: ["creative_intent_revision_comparison"],
          reviewMethods: ["before_after_revision_comparison"]
        }
      }]
    },
    latestRunRoot: runRoot
  });

  assert.equal(state.goalStatuses[0].durableCandidateCount, 1);
  assert.equal(state.goalStatuses[0].evidenceStatus, "in_progress");
});

test("controller keeps blocked creative intent records out of effect-fit queues", () => {
  const runRoot = tempDir();
  writeRunRoot(runRoot, [{
    ...record("mood_palette_pace", 0.85),
    experimentId: "creative-intent-probe-mono_white",
    sampleCount: 1,
    trendStatus: "single_run_baseline",
    intentDimensions: ["mood", "palette", "pace"],
    reviewMethods: ["deterministic_metrics"]
  }]);

  const state = buildSequencingQualityControllerState({
    curriculum: {
      ...curriculum(),
      goals: [{
        goalId: "effect_fit.core_effects.v1",
        areaId: "effect_behavior",
        priority: 1,
        status: "not_started",
        coverage: {
          effects: ["Color Wash"]
        }
      }, {
        goalId: "creative.intent_match.v1",
        areaId: "creative_intent_matching",
        priority: 2,
        status: "not_started",
        coverage: {
          intentDimensions: ["mood", "palette"],
          reviewMethods: ["deterministic_metrics"]
        }
      }]
    },
    latestRunRoot: runRoot
  });

  assert.equal(state.controllerDecision.selectedGoalId, "creative.intent_match.v1");
  assert.equal(state.nextQueue[0].reason, "repeat_blocked_promising_record");
  assert.equal(state.nextQueue[0].experimentId, "creative-intent-probe-mono_white");
});

test("controller advances past goals with durable evidence and no repeat queue", () => {
  const runRoot = tempDir();
  writeRunRoot(runRoot, [
    {
      ...record("one_layer_foundation", 0.84, []),
      sampleCount: 2,
      trendStatus: "stable"
    }
  ]);

  const state = buildSequencingQualityControllerState({
    curriculum: {
      ...curriculum(),
      goals: [{
        goalId: "layer.rgb_primary.basic",
        areaId: "layer_composition",
        priority: 1,
        status: "not_started",
        requiredStableSamples: 2,
        coverage: {
          families: ["same_target_layer_stack"],
          paletteProfiles: ["mono_white"],
          effects: ["Color Wash"]
        }
      }, {
        goalId: "submodel.vendor_fixture.basic",
        areaId: "layer_composition",
        priority: 2,
        status: "not_started",
        requiredStableSamples: 2,
        coverage: {
          targetScopes: ["submodel"],
          effects: ["Color Wash"]
        }
      }]
    },
    latestRunRoot: runRoot
  });

  assert.equal(state.controllerDecision.nextAction, "plan_goal_coverage");
  assert.equal(state.nextQueue[0].goalId, "submodel.vendor_fixture.basic");
});

test("controller treats durable completion criteria as covered evidence", () => {
  const runRoot = tempDir();
  writeRunRoot(runRoot, [
    {
      ...record("one_layer_foundation", 0.84, []),
      sampleCount: 2,
      trendStatus: "stable"
    },
    {
      ...record("two_layer_default", 0.85, []),
      sampleCount: 2,
      trendStatus: "stable"
    }
  ]);

  const state = buildSequencingQualityControllerState({
    curriculum: {
      ...curriculum(),
      goals: [{
        goalId: "layer.same_target.mono_white.basic",
        areaId: "layer_composition",
        priority: 1,
        status: "not_started",
        requiredStableSamples: 2,
        coverage: {
          families: ["same_target_layer_stack"],
          paletteProfiles: ["mono_white"],
          effects: ["Color Wash"]
        },
        completionCriteria: {
          minimumDurableCandidateCount: 2
        }
      }, {
        goalId: "effect_fit.core_effects.v1",
        areaId: "effect_behavior",
        priority: 2,
        status: "not_started",
        requiredStableSamples: 2,
        coverage: {
          effects: ["Single Strand"]
        }
      }]
    },
    latestRunRoot: runRoot
  });

  assert.equal(state.goalStatuses[0].evidenceStatus, "covered");
  assert.equal(state.controllerDecision.nextAction, "plan_goal_coverage");
  assert.equal(state.nextQueue[0].goalId, "effect_fit.core_effects.v1");
});

test("controller matches xLights internal SingleStrand name to single strand coverage", () => {
  const runRoot = tempDir();
  writeRunRoot(runRoot, [{
    ...record("single_strand_linear_motion", 0.84),
    experimentId: "core-effect-fit-mono_white",
    family: "core_effect_fit",
    effectName: "SingleStrand",
    modelTypes: ["single_line"],
    targetScopes: ["model"]
  }]);

  const state = buildSequencingQualityControllerState({
    curriculum: {
      ...curriculum(),
      goals: [{
        goalId: "effect_fit.core_effects.v1",
        areaId: "effect_behavior",
        priority: 1,
        status: "not_started",
        requiredStableSamples: 2,
        coverage: {
          effects: ["Single Strand"],
          modelTypes: ["single_line"]
        }
      }]
    },
    latestRunRoot: runRoot
  });

  assert.equal(state.controllerDecision.selectedGoalId, "effect_fit.core_effects.v1");
  assert.equal(state.nextQueue[0].passId, "single_strand_linear_motion");
  assert.equal(state.nextQueue[0].reason, "repeat_blocked_promising_record");
});

test("controller tracks distinct effect-fit coverage units", () => {
  const runRoot = tempDir();
  writeRunRoot(runRoot, [
    {
      ...record("single_strand_linear_motion", 0.84, []),
      experimentId: "core-effect-fit-mono_white",
      family: "core_effect_fit",
      effectName: "SingleStrand",
      modelTypes: ["single_line"],
      sampleCount: 2,
      trendStatus: "stable"
    },
    {
      ...record("bars_group_motion", 0.84, []),
      experimentId: "core-effect-fit-mono_white",
      family: "core_effect_fit",
      effectName: "Bars",
      modelTypes: ["arch"],
      targetScopes: ["group"],
      sampleCount: 2,
      trendStatus: "stable"
    },
    {
      ...record("color_wash_radial_fill", 0.85, []),
      experimentId: "core-effect-fit-mono_white",
      family: "core_effect_fit",
      effectName: "Color Wash",
      modelTypes: ["star"],
      sampleCount: 2,
      trendStatus: "stable"
    },
    {
      ...record("legacy_marquee_layer", 0.85, []),
      experimentId: "group-model-interplay-mono_white",
      family: "group_model_interplay",
      effectName: "Marquee",
      modelTypes: ["single_line"],
      sampleCount: 2,
      trendStatus: "stable"
    }
  ]);

  const state = buildSequencingQualityControllerState({
    curriculum: {
      ...curriculum(),
      goals: [{
        goalId: "effect_fit.core_effects.v1",
        areaId: "effect_behavior",
        priority: 1,
        status: "not_started",
        requiredStableSamples: 2,
        coverage: {
          families: ["core_effect_fit"],
          effects: ["Single Strand", "Bars", "Color Wash", "Marquee"],
          modelTypes: ["single_line", "arch", "star"],
          paletteProfiles: ["mono_white"]
        },
        completionCriteria: {
          minimumDistinctCoverageUnitCount: 4,
          distinctCoverageFields: ["paletteProfile", "effect", "modelType"],
          desiredCoverageUnits: [{
            paletteProfile: "mono_white",
            effect: "Single Strand",
            modelType: "single_line"
          }, {
            paletteProfile: "mono_white",
            effect: "Bars",
            modelType: "arch"
          }, {
            paletteProfile: "mono_white",
            effect: "Color Wash",
            modelType: "star"
          }, {
            paletteProfile: "mono_white",
            effect: "Marquee",
            modelType: "single_line"
          }]
        }
      }]
    },
    latestRunRoot: runRoot
  });

  assert.equal(state.goalStatuses[0].durableCandidateCount, 3);
  assert.equal(state.goalStatuses[0].distinctCoverageUnitCount, 3);
  assert.equal(state.goalStatuses[0].missingCoverageUnitCount, 1);
  assert.equal(state.goalStatuses[0].evidenceStatus, "in_progress");
  assert.equal(state.nextQueue[0].reason, "coverage_gap");
  assert.deepEqual(state.nextQueue[0].missingCoverageUnits, [{
    paletteProfile: "mono_white",
    effect: "Marquee",
    modelType: "single_line"
  }]);
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
