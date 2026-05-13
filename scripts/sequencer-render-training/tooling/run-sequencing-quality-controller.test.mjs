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
    metricScope: "full_sequence_render",
    promotionUse: "primary_human_level_quality_evidence",
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

function writeHumanCalibratedCandidateEvaluation(runRoot, overrides = {}) {
  writeJson(path.join(runRoot, "human-calibrated-candidate-evaluation.json"), {
    artifactType: "human_calibrated_candidate_evaluation_v1",
    status: "ready",
    summary: {
      candidateCount: 1,
      promotionEligibleCandidateCount: 0,
      optimizationMetricEvaluations: 0,
      guardrailMetricEvaluations: 3,
      diagnosticMetricEvaluations: 3,
      primaryRisk: "No current automated dimension is aligned enough for unattended promotion."
    },
    candidateEvaluations: [{
      status: "ready",
      promotionEligible: false,
      blockers: []
    }],
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

test("controller skips unsupported generic coverage gaps that would expand the full plan", () => {
  const runRoot = tempDir();
  writeRunRoot(runRoot, []);

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
    experimentId: "display-quality-review-rgb_primary",
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

test("controller can target a specific display review pass for repeat evidence", () => {
  const runRoot = tempDir();
  writeRunRoot(runRoot, [{
    ...record("display_focal_consistency_repair", 0.88, [
      "insufficient_repeated_quality_evidence",
      "quality_trend_not_stable_or_improving"
    ]),
    experimentId: "display-quality-review-mono_white",
    family: "display_quality_review",
    reviewScopes: ["section_video", "whole_sequence_window", "full_display_contact_sheet"],
    qualityDimensions: ["focal_clarity", "pacing_variety", "motion_interest", "quality_consistency", "visual_balance"]
  }, {
    ...record("display_motion_variety", 0.91, [
      "insufficient_repeated_quality_evidence"
    ]),
    experimentId: "display-quality-review-mono_white",
    family: "display_quality_review",
    reviewScopes: ["section_video", "whole_sequence_window", "full_display_contact_sheet"],
    qualityDimensions: ["coverage_balance", "motion_coherence", "palette_readability"]
  }]);

  const state = buildSequencingQualityControllerState({
    curriculum: {
      ...curriculum(),
      goals: [{
        goalId: "display.video_aesthetic.focal_consistency_v1",
        areaId: "display_level_composition",
        priority: 1,
        status: "not_started",
        requiredStableSamples: 2,
        coverage: {
          families: ["display_quality_review"],
          paletteProfiles: ["mono_white"],
          passIds: ["display_focal_consistency_repair"],
          reviewScopes: ["whole_sequence_window"],
          qualityDimensions: ["focal_clarity"]
        },
        completionCriteria: {
          minimumDistinctCoverageUnitCount: 1,
          distinctCoverageFields: ["paletteProfile", "passId"],
          desiredCoverageUnits: [{
            paletteProfile: "mono_white",
            passId: "display_focal_consistency_repair"
          }]
        }
      }]
    },
    latestRunRoot: runRoot
  });

  assert.equal(state.controllerDecision.selectedGoalId, "display.video_aesthetic.focal_consistency_v1");
  assert.equal(state.controllerDecision.selectionReason, "blocked_promising_records");
  assert.equal(state.nextQueue[0].reason, "repeat_blocked_promising_record");
  assert.equal(state.nextQueue[0].passId, "display_focal_consistency_repair");
});

test("controller covers targeted display aesthetic goal from durable pass evidence", () => {
  const runRoot = tempDir();
  writeRunRoot(runRoot, [{
    ...record("display_focal_consistency_repair", 0.88, []),
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
        goalId: "display.video_aesthetic.focal_consistency_v1",
        areaId: "display_level_composition",
        priority: 1,
        status: "not_started",
        requiredStableSamples: 2,
        coverage: {
          families: ["display_quality_review"],
          paletteProfiles: ["mono_white"],
          passIds: ["display_focal_consistency_repair"],
          reviewScopes: ["whole_sequence_window"]
        },
        completionCriteria: {
          minimumDistinctCoverageUnitCount: 1,
          distinctCoverageFields: ["paletteProfile", "passId"],
          desiredCoverageUnits: [{
            paletteProfile: "mono_white",
            passId: "display_focal_consistency_repair"
          }]
        }
      }]
    },
    latestRunRoot: runRoot
  });

  assert.equal(state.goalStatuses[0].evidenceStatus, "covered");
  assert.equal(state.goalStatuses[0].durableCandidateCount, 1);
  assert.equal(state.goalStatuses[0].distinctCoverageUnitCount, 1);
  assert.equal(state.controllerDecision.nextAction, "idle");
});

test("controller targets rgb display aesthetic records by palette and pass", () => {
  const runRoot = tempDir();
  writeRunRoot(runRoot, [{
    ...record("display_regional_focus_contrast", 0.85, [
      "insufficient_repeated_quality_evidence",
      "quality_trend_not_stable_or_improving"
    ]),
    experimentId: "display-quality-review-rgb_primary",
    family: "display_quality_review",
    reviewScopes: ["section_video", "whole_sequence_window", "full_display_contact_sheet"],
    qualityDimensions: ["coverage_balance", "motion_coherence", "palette_readability"]
  }, {
    ...record("display_regional_focus_contrast", 0.89, []),
    experimentId: "display-quality-review-rgb_primary",
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
        goalId: "display.video_aesthetic.rgb_regional_focus_v1",
        areaId: "display_level_composition",
        priority: 1,
        status: "not_started",
        requiredStableSamples: 2,
        coverage: {
          families: ["display_quality_review"],
          paletteProfiles: ["rgb_primary"],
          passIds: ["display_regional_focus_contrast"],
          reviewScopes: ["whole_sequence_window"]
        }
      }]
    },
    latestRunRoot: runRoot
  });

  assert.equal(state.controllerDecision.selectedGoalId, "display.video_aesthetic.rgb_regional_focus_v1");
  assert.equal(state.nextQueue[0].reason, "repeat_blocked_promising_record");
  assert.equal(state.nextQueue[0].experimentId, "display-quality-review-rgb_primary");
  assert.equal(state.nextQueue[0].passId, "display_regional_focus_contrast");
});

test("controller reports stalled goals when evidence regressed and is not repeatable", () => {
  const runRoot = tempDir();
  writeRunRoot(runRoot, [{
    ...record("display_regional_focus_contrast", 0.77, ["quality_trend_not_stable_or_improving"]),
    experimentId: "display-quality-review-rgb_primary",
    family: "display_quality_review",
    sampleCount: 2,
    trendStatus: "regressing",
    reviewScopes: ["section_video", "whole_sequence_window", "full_display_contact_sheet"],
    qualityDimensions: ["coverage_balance", "motion_coherence", "palette_readability"]
  }]);

  const state = buildSequencingQualityControllerState({
    curriculum: {
      ...curriculum(),
      goals: [{
        goalId: "display.video_aesthetic.rgb_regional_focus_v1",
        areaId: "display_level_composition",
        priority: 1,
        status: "not_started",
        requiredStableSamples: 2,
        coverage: {
          families: ["display_quality_review"],
          paletteProfiles: ["rgb_primary"],
          passIds: ["display_regional_focus_contrast"],
          reviewScopes: ["whole_sequence_window"]
        },
        completionCriteria: {
          minimumDistinctCoverageUnitCount: 1,
          distinctCoverageFields: ["paletteProfile", "passId"],
          desiredCoverageUnits: [{
            paletteProfile: "rgb_primary",
            passId: "display_regional_focus_contrast"
          }]
        }
      }]
    },
    latestRunRoot: runRoot
  });

  assert.equal(state.controllerDecision.selectedGoalId, "display.video_aesthetic.rgb_regional_focus_v1");
  assert.equal(state.controllerDecision.selectionReason, "nonrepeatable_regressed_evidence");
  assert.equal(state.controllerDecision.nextAction, "needs_strategy_expansion");
  assert.deepEqual(state.nextQueue, []);
});

test("controller uses auto-refill display goals before declaring strategy expansion", () => {
  const regressionRoots = [
    ["display.video_aesthetic.palette_motion_pacing_variation_v1", "display_palette_motion_pacing_variation"],
    ["display.video_aesthetic.palette_spatial_negative_space_v1", "display_palette_spatial_negative_space"],
    ["display.video_aesthetic.palette_motion_pacing_reprise_v1", "display_palette_motion_pacing_reprise"]
  ].map(([goalId, passId]) => {
    const root = tempDir();
    writeRunRoot(root, []);
    writeFullSequenceReview(root);
    writeVideoAestheticScore(root);
    writeVideoAestheticAttemptComparison(root, { comparisonStatus: "regressed" });
    writeJson(path.join(root, "controller-state.json"), {
      artifactType: "sequencing_quality_training_controller_state_v1",
      nextQueue: [{
        goalId,
        reason: "coverage_gap",
        missingCoverageUnits: [{ paletteProfile: "rgb_primary", passId }]
      }]
    });
    return root;
  });
  const latestRoot = tempDir();
  writeRunRoot(latestRoot, [{
    ...record("display_palette_foundation_focal_pacing_intro", 0.79, ["quality_trend_not_stable_or_improving"]),
    experimentId: "display-quality-review-rgb_primary",
    family: "display_quality_review",
    paletteProfiles: ["rgb_primary"],
    reviewScopes: ["whole_sequence_window"],
    sampleCount: 1,
    trendStatus: "single_run_baseline"
  }]);
  writeFullSequenceReview(latestRoot);
  writeVideoAestheticScore(latestRoot);
  writeVideoAestheticAttemptComparison(latestRoot, { comparisonStatus: "regressed" });
  writeJson(path.join(latestRoot, "controller-state.json"), {
    artifactType: "sequencing_quality_training_controller_state_v1",
    nextQueue: [{
      goalId: "display.video_aesthetic.palette_foundation_focal_pacing_v1",
      reason: "coverage_gap",
      missingCoverageUnits: [{ paletteProfile: "rgb_primary", passId: "display_palette_foundation_focal_pacing_intro" }]
    }]
  });
  writeJson(path.join(latestRoot, "cross-run-quality-records.json"), {
    ...JSON.parse(fs.readFileSync(path.join(latestRoot, "cross-run-quality-records.json"), "utf8")),
    sourceRunRoots: [...regressionRoots, latestRoot]
  });

  const state = buildSequencingQualityControllerState({
    curriculum: {
      ...curriculum(),
      goals: [{
        goalId: "display.video_aesthetic.palette_foundation_focal_pacing_v1",
        areaId: "display_level_composition",
        priority: 1,
        status: "not_started",
        coverage: {
          families: ["display_quality_review"],
          paletteProfiles: ["rgb_primary"],
          passIds: ["display_palette_foundation_focal_pacing_intro"],
          reviewScopes: ["whole_sequence_window"]
        },
        completionCriteria: {
          minimumDistinctCoverageUnitCount: 1,
          distinctCoverageFields: ["paletteProfile", "passId"],
          desiredCoverageUnits: [{ paletteProfile: "rgb_primary", passId: "display_palette_foundation_focal_pacing_intro" }]
        }
      }, {
        goalId: "display.video_aesthetic.auto_refill.motion_pacing_cycle_01_v1",
        areaId: "display_level_composition",
        priority: 2,
        status: "not_started",
        coverage: {
          families: ["display_quality_review"],
          paletteProfiles: ["rgb_primary"],
          passIds: ["display_palette_motion_pacing_validation_cycle_01"],
          reviewScopes: ["whole_sequence_window"]
        },
        completionCriteria: {
          minimumDistinctCoverageUnitCount: 1,
          distinctCoverageFields: ["paletteProfile", "passId"],
          desiredCoverageUnits: [{ paletteProfile: "rgb_primary", passId: "display_palette_motion_pacing_validation_cycle_01" }]
        }
      }]
    },
    latestRunRoot: latestRoot
  });

  assert.equal(state.controllerDecision.selectionReason, "targeted_display_redesign_exhausted_auto_refill");
  assert.equal(state.controllerDecision.nextAction, "plan_goal_coverage");
  assert.equal(state.nextQueue[0].goalId, "display.video_aesthetic.auto_refill.motion_pacing_cycle_01_v1");
});

test("controller pivots from repeated auto-refill regressions to adaptive repair", () => {
  const autoRefillRoots = [
    "display.video_aesthetic.auto_refill.motion_pacing_cycle_01_v1",
    "display.video_aesthetic.auto_refill.spatial_negative_space_cycle_01_v1",
    "display.video_aesthetic.auto_refill.spatial_focal_cycle_01_v1",
    "display.video_aesthetic.auto_refill.color_purpose_motion_cycle_01_v1"
  ].map((goalId, index) => {
    const root = tempDir();
    writeRunRoot(root, []);
    writeFullSequenceReview(root);
    writeVideoAestheticScore(root);
    writeVideoAestheticAttemptComparison(root, { comparisonStatus: "regressed" });
    writeJson(path.join(root, "controller-state.json"), {
      artifactType: "sequencing_quality_training_controller_state_v1",
      nextQueue: [{
        goalId,
        reason: "coverage_gap",
        missingCoverageUnits: [{ paletteProfile: "rgb_primary", passId: `display_palette_auto_refill_${index + 1}` }]
      }]
    });
    return root;
  });
  const latestRoot = autoRefillRoots.at(-1);
  writeJson(path.join(latestRoot, "cross-run-quality-records.json"), {
    ...JSON.parse(fs.readFileSync(path.join(latestRoot, "cross-run-quality-records.json"), "utf8")),
    sourceRunRoots: autoRefillRoots
  });

  const state = buildSequencingQualityControllerState({
    curriculum: {
      ...curriculum(),
      goals: [{
        goalId: "display.video_aesthetic.palette_focal_handoff_context_sequence_v1",
        areaId: "display_level_composition",
        priority: 1,
        status: "not_started",
        coverage: {
          families: ["display_quality_review"],
          paletteProfiles: ["rgb_primary"],
          passIds: [
            "display_palette_focal_handoff_context_intro",
            "display_palette_focal_handoff_context_lift",
            "display_palette_focal_handoff_context_release"
          ],
          reviewScopes: ["whole_sequence_window"]
        },
        completionCriteria: {
          minimumDistinctCoverageUnitCount: 3,
          distinctCoverageFields: ["paletteProfile", "passId"],
          desiredCoverageUnits: [
            { paletteProfile: "rgb_primary", passId: "display_palette_focal_handoff_context_intro" },
            { paletteProfile: "rgb_primary", passId: "display_palette_focal_handoff_context_lift" },
            { paletteProfile: "rgb_primary", passId: "display_palette_focal_handoff_context_release" }
          ]
        }
      }, {
        goalId: "display.video_aesthetic.auto_refill.motion_pacing_cycle_02_v1",
        areaId: "display_level_composition",
        priority: 2,
        status: "not_started",
        coverage: {
          families: ["display_quality_review"],
          paletteProfiles: ["rgb_primary"],
          passIds: ["display_palette_motion_pacing_validation_cycle_02"],
          reviewScopes: ["whole_sequence_window"]
        },
        completionCriteria: {
          minimumDistinctCoverageUnitCount: 1,
          distinctCoverageFields: ["paletteProfile", "passId"],
          desiredCoverageUnits: [{ paletteProfile: "rgb_primary", passId: "display_palette_motion_pacing_validation_cycle_02" }]
        }
      }]
    },
    latestRunRoot: latestRoot
  });

  assert.equal(state.controllerDecision.selectionReason, "auto_refill_regression_repair_pivot");
  assert.equal(state.nextQueue[0].goalId, "display.video_aesthetic.palette_focal_handoff_context_sequence_v1");
});

test("controller stops auto-refill after repeated regressions when no repair pivot remains", () => {
  const autoRefillRoots = [
    "display.video_aesthetic.auto_refill.motion_pacing_cycle_01_v1",
    "display.video_aesthetic.auto_refill.spatial_negative_space_cycle_01_v1",
    "display.video_aesthetic.auto_refill.spatial_focal_cycle_01_v1",
    "display.video_aesthetic.auto_refill.color_purpose_motion_cycle_01_v1"
  ].map((goalId, index) => {
    const root = tempDir();
    writeRunRoot(root, []);
    writeFullSequenceReview(root);
    writeVideoAestheticScore(root);
    writeVideoAestheticAttemptComparison(root, { comparisonStatus: "regressed" });
    writeJson(path.join(root, "controller-state.json"), {
      artifactType: "sequencing_quality_training_controller_state_v1",
      nextQueue: [{
        goalId,
        reason: "coverage_gap",
        missingCoverageUnits: [{ paletteProfile: "rgb_primary", passId: `display_palette_auto_refill_${index + 1}` }]
      }]
    });
    return root;
  });
  const latestRoot = autoRefillRoots.at(-1);
  writeJson(path.join(latestRoot, "cross-run-quality-records.json"), {
    ...JSON.parse(fs.readFileSync(path.join(latestRoot, "cross-run-quality-records.json"), "utf8")),
    sourceRunRoots: autoRefillRoots
  });

  const state = buildSequencingQualityControllerState({
    curriculum: {
      ...curriculum(),
      goals: [{
        goalId: "display.video_aesthetic.auto_refill.motion_pacing_cycle_02_v1",
        areaId: "display_level_composition",
        priority: 1,
        status: "not_started",
        coverage: {
          families: ["display_quality_review"],
          paletteProfiles: ["rgb_primary"],
          passIds: ["display_palette_motion_pacing_validation_cycle_02"],
          reviewScopes: ["whole_sequence_window"]
        },
        completionCriteria: {
          minimumDistinctCoverageUnitCount: 1,
          distinctCoverageFields: ["paletteProfile", "passId"],
          desiredCoverageUnits: [{ paletteProfile: "rgb_primary", passId: "display_palette_motion_pacing_validation_cycle_02" }]
        }
      }]
    },
    latestRunRoot: latestRoot
  });

  assert.equal(state.controllerDecision.nextAction, "needs_strategy_expansion");
  assert.equal(state.nextQueue.length, 0);
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

test("controller plans multi-section music structure after earlier curriculum is covered", () => {
  const runRoot = tempDir();
  writeRunRoot(runRoot, []);

  const state = buildSequencingQualityControllerState({
    curriculum: {
      ...curriculum(),
      goals: [{
        goalId: "music.structure_alignment.v1",
        areaId: "musical_structure",
        priority: 1,
        status: "covered",
        coverage: {
          families: ["music_structure_review"]
        }
      }, {
        goalId: "music.multi_section_structure.v1",
        areaId: "musical_structure",
        priority: 2,
        status: "not_started",
        coverage: {
          families: ["music_structure_review"],
          paletteProfiles: ["rgb_primary"],
          passIds: ["multi_section_energy_arc", "motif_reprise_variation", "lyric_phrase_release"],
          timingSources: ["section", "phrase", "beat", "lyric", "accent"]
        },
        completionCriteria: {
          minimumDistinctCoverageUnitCount: 3,
          distinctCoverageFields: ["paletteProfile", "passId"],
          desiredCoverageUnits: [
            { paletteProfile: "rgb_primary", passId: "multi_section_energy_arc" },
            { paletteProfile: "rgb_primary", passId: "motif_reprise_variation" },
            { paletteProfile: "rgb_primary", passId: "lyric_phrase_release" }
          ]
        }
      }]
    },
    latestRunRoot: runRoot
  });

  assert.equal(state.controllerDecision.selectedGoalId, "music.multi_section_structure.v1");
  assert.equal(state.nextQueue.length, 1);
  assert.equal(state.nextQueue[0].goalId, "music.multi_section_structure.v1");
  assert.ok(state.nextQueue[0].missingCoverageUnits.every((row) => row.paletteProfile === "rgb_primary"));
  assert.deepEqual(
    state.nextQueue[0].missingCoverageUnits.map((row) => row.passId),
    ["multi_section_energy_arc", "motif_reprise_variation", "lyric_phrase_release"]
  );
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

test("controller prioritizes palette repair when palette purpose is weak", () => {
  const runRoot = tempDir();
  writeRunRoot(runRoot, []);
  writeFullSequenceReview(runRoot);
  writeVideoAestheticScore(runRoot, {
    scores: {
      overallAestheticScore: 0.716,
      displayEvolution: 0.92,
      narrativeShape: 0.82,
      pacingVariety: 0.68,
      transitionFlow: 0.74,
      focalClarity: 0.84,
      focalHandoffStability: 0.67,
      visualBalance: 0.66,
      motionInterest: 0.75,
      colorDiscipline: 0.91,
      palettePurposeCoverage: 0.5,
      temporalContinuity: 0.7,
      clutterControl: 1,
      qualityConsistency: 0.8,
      fullSequenceContext: 0.73
    },
    recommendationSummary: [
      "Assign clearer color purposes across structure, support motion, focal accents, and background roles."
    ]
  });
  writeVideoAestheticAttemptComparison(runRoot, { comparisonStatus: "neutral" });

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
  assert.equal(state.nextQueue[0].nextStrategy, "palette_depth_contrast_motion_repair");
  assert.equal(state.nextQueue[0].weakDimensions[0].dimension, "palette_purpose_coverage");
});

test("controller continues full-sequence work when automated promotion passes but human gate blocks", () => {
  const runRoot = tempDir();
  writeRunRoot(runRoot, []);
  writeFullSequenceReview(runRoot);
  writeVideoAestheticScore(runRoot, {
    scores: {
      overallAestheticScore: 0.768,
      displayEvolution: 0.92,
      narrativeShape: 0.83,
      pacingVariety: 0.56,
      transitionFlow: 0.75,
      focalClarity: 0.91,
      focalHandoffStability: 0.65,
      visualBalance: 0.49,
      motionInterest: 0.75,
      colorDiscipline: 0.94,
      palettePurposeCoverage: 0.93,
      temporalContinuity: 0.5,
      localEvidenceReadability: 0.88,
      clutterControl: 1,
      qualityConsistency: 0.5,
      fullSequenceContext: 0.78
    },
    promotion: {
      evidenceEligible: true,
      blockers: []
    }
  });
  writeVideoAestheticAttemptComparison(runRoot, {
    comparisonStatus: "neutral",
    summary: {
      overallAestheticScoreDelta: 0.052,
      improvedDimensionCount: 9,
      regressedDimensionCount: 2
    }
  });
  writeHumanCalibratedCandidateEvaluation(runRoot);

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
      }, {
        goalId: "effect_fit.expanded_model_matrix.v1",
        areaId: "layer_composition",
        priority: 2,
        status: "not_started",
        coverage: {
          families: ["expanded_effect_fit"],
          paletteProfiles: ["rgb_primary"]
        }
      }]
    },
    latestRunRoot: runRoot
  });

  assert.equal(state.controllerDecision.selectedGoalId, "display.full_sequence.quality_v1");
  assert.equal(state.controllerDecision.selectionReason, "video_aesthetic_score_below_threshold");
  assert.equal(state.nextQueue[0].humanCalibratedPromotionBlocked, true);
  assert.equal(state.humanCalibratedCandidateSummary.promotionEligibleCandidateCount, 0);
  assert.notEqual(state.goalStatuses[0].evidenceStatus, "covered");
});

test("controller repeats improved music structure candidates before generic display repair", () => {
  const runRoot = tempDir();
  writeRunRoot(runRoot, [{
    recordId: "record:lyric_phrase_release",
    experimentId: "music-structure-review-rgb_primary",
    family: "music_structure_review",
    passId: "lyric_phrase_release",
    effectName: "Color Wash",
    leadTargets: ["Vendor Arch"],
    timingSources: ["section", "phrase", "beat", "lyric", "accent"],
    paletteProfiles: ["rgb_primary"],
    sampleCount: 1,
    trendStatus: "single_run_baseline",
    quality: {
      latestOverallQuality: 0.868717,
      meanOverallQuality: 0.868717
    },
    promotion: {
      durableCandidate: false,
      blockers: [
        "insufficient_repeated_quality_evidence",
        "quality_trend_not_stable_or_improving"
      ]
    }
  }]);
  writeFullSequenceReview(runRoot);
  writeVideoAestheticScore(runRoot, {
    scores: {
      overallAestheticScore: 0.799408,
      displayEvolution: 0.9,
      narrativeShape: 0.77,
      pacingVariety: 0.73,
      transitionFlow: 0.81,
      focalClarity: 0.89,
      focalHandoffStability: 0.78,
      visualBalance: 0.62,
      motionInterest: 0.76,
      colorDiscipline: 0.91,
      palettePurposeCoverage: 0.94,
      temporalContinuity: 0.83,
      localEvidenceReadability: 0.86,
      clutterControl: 1,
      qualityConsistency: 0.88,
      fullSequenceContext: 0.81
    },
    promotion: {
      evidenceEligible: true,
      blockers: []
    }
  });
  writeVideoAestheticAttemptComparison(runRoot, {
    comparisonStatus: "neutral",
    summary: {
      overallAestheticScoreDelta: 0.011034,
      improvedDimensionCount: 7,
      regressedDimensionCount: 4
    }
  });
  writeHumanCalibratedCandidateEvaluation(runRoot);
  writeJson(path.join(runRoot, "training-plan.json"), {
    artifactType: "layer_composition_training_plan_v1",
    experiments: [{
      experimentId: "music-structure-review-rgb_primary",
      family: "music_structure_review"
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
          reviewScopes: ["whole_sequence_window"],
          qualityDimensions: ["coverage_balance", "regional_variety"]
        },
        completionCriteria: {
          minimumDurableCandidateCount: 2
        }
      }, {
        goalId: "music.multi_section_structure.v1",
        areaId: "musical_structure",
        priority: 2,
        status: "not_started",
        coverage: {
          families: ["music_structure_review"],
          paletteProfiles: ["rgb_primary"],
          passIds: ["multi_section_energy_arc", "motif_reprise_variation", "lyric_phrase_release"],
          timingSources: ["section", "phrase", "beat", "lyric", "accent"]
        },
        completionCriteria: {
          minimumDistinctCoverageUnitCount: 3,
          distinctCoverageFields: ["paletteProfile", "passId"]
        }
      }]
    },
    latestRunRoot: runRoot
  });

  assert.equal(state.controllerDecision.selectedGoalId, "music.multi_section_structure.v1");
  assert.equal(state.controllerDecision.selectionReason, "music_structure_improved_repeat_evidence");
  assert.equal(state.nextQueue[0].passId, "lyric_phrase_release");
  assert.equal(state.nextQueue[0].selectionHint, "repeat the improved music-structure candidate before attempting generic display repair");
});

test("controller advances targeted display validation after a regressed display aesthetic target", () => {
  const runRoot = tempDir();
  writeRunRoot(runRoot, [{
    ...record("display_palette_section_pacing_consistency_repair", 0.824969),
    experimentId: "display-quality-review-rgb_primary",
    family: "display_quality_review",
    reviewScopes: ["whole_sequence_window"],
    qualityDimensions: ["pacing_variety", "visual_balance"]
  }]);
  writeFullSequenceReview(runRoot);
  writeVideoAestheticScore(runRoot, {
    scores: {
      overallAestheticScore: 0.784207,
      displayEvolution: 0.91,
      narrativeShape: 0.84,
      pacingVariety: 0.29,
      transitionFlow: 0.78,
      focalClarity: 0.85,
      focalHandoffStability: 0.69,
      visualBalance: 0.5,
      motionInterest: 0.74,
      colorDiscipline: 0.98,
      palettePurposeCoverage: 0.95,
      temporalContinuity: 0.91,
      localEvidenceReadability: 0.86,
      clutterControl: 1,
      qualityConsistency: 0.78,
      fullSequenceContext: 0.79
    },
    promotion: {
      evidenceEligible: true,
      blockers: []
    }
  });
  writeVideoAestheticAttemptComparison(runRoot, {
    comparisonStatus: "regressed",
    summary: {
      overallAestheticScoreDelta: -0.015201,
      improvedDimensionCount: 6,
      regressedDimensionCount: 6
    }
  });
  writeJson(path.join(runRoot, "controller-state.json"), {
    artifactType: "sequencing_quality_training_controller_state_v1",
    nextQueue: [{
      goalId: "display.video_aesthetic.palette_motion_pacing_variation_v1",
      reason: "coverage_gap",
      missingCoverageUnits: [{ paletteProfile: "rgb_primary", passId: "display_palette_motion_pacing_variation" }]
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
          reviewScopes: ["whole_sequence_window"],
          qualityDimensions: ["pacing_variety", "visual_balance"]
        },
        completionCriteria: {
          minimumDurableCandidateCount: 2
        }
      }, {
        goalId: "display.video_aesthetic.palette_motion_pacing_variation_v1",
        areaId: "display_level_composition",
        priority: 2,
        status: "not_started",
        coverage: {
          families: ["display_quality_review"],
          paletteProfiles: ["rgb_primary"],
          passIds: ["display_palette_motion_pacing_variation"],
          reviewScopes: ["whole_sequence_window"]
        },
        completionCriteria: {
          minimumDistinctCoverageUnitCount: 1,
          distinctCoverageFields: ["paletteProfile", "passId"],
          desiredCoverageUnits: [
            { paletteProfile: "rgb_primary", passId: "display_palette_motion_pacing_variation" }
          ]
        }
      }, {
        goalId: "display.video_aesthetic.palette_spatial_negative_space_v1",
        areaId: "display_level_composition",
        priority: 3,
        status: "not_started",
        coverage: {
          families: ["display_quality_review"],
          paletteProfiles: ["rgb_primary"],
          passIds: ["display_palette_spatial_negative_space"],
          reviewScopes: ["whole_sequence_window"]
        },
        completionCriteria: {
          minimumDistinctCoverageUnitCount: 1,
          distinctCoverageFields: ["paletteProfile", "passId"],
          desiredCoverageUnits: [
            { paletteProfile: "rgb_primary", passId: "display_palette_spatial_negative_space" }
          ]
        }
      }]
    },
    latestRunRoot: runRoot
  });

  assert.equal(state.controllerDecision.selectedGoalId, "display.video_aesthetic.palette_spatial_negative_space_v1");
  assert.equal(state.controllerDecision.selectionReason, "targeted_display_regression_next_validation");
  assert.equal(state.nextQueue[0].missingCoverageUnits[0].passId, "display_palette_spatial_negative_space");
});

test("controller keeps earlier regressed targeted display validations on cooldown", () => {
  const previousRoot = tempDir();
  writeRunRoot(previousRoot, []);
  writeFullSequenceReview(previousRoot);
  writeVideoAestheticScore(previousRoot);
  writeVideoAestheticAttemptComparison(previousRoot, { comparisonStatus: "regressed" });
  writeJson(path.join(previousRoot, "controller-state.json"), {
    artifactType: "sequencing_quality_training_controller_state_v1",
    nextQueue: [{
      goalId: "display.video_aesthetic.palette_motion_pacing_variation_v1",
      reason: "coverage_gap",
      missingCoverageUnits: [{ paletteProfile: "rgb_primary", passId: "display_palette_motion_pacing_variation" }]
    }]
  });
  writeJson(path.join(previousRoot, "pass-runner-summary.json"), {
    artifactType: "layer_composition_pass_runner_summary_v1",
    processedPasses: 8,
    renderReviewAcceptedEvidenceCount: 7,
    renderReviewEligibleQualityMean: 0.79
  });

  const latestRoot = tempDir();
  writeRunRoot(latestRoot, []);
  const records = JSON.parse(fs.readFileSync(path.join(latestRoot, "cross-run-quality-records.json"), "utf8"));
  writeJson(path.join(latestRoot, "cross-run-quality-records.json"), {
    ...records,
    sourceRunRoots: [previousRoot, latestRoot]
  });
  writeFullSequenceReview(latestRoot);
  writeVideoAestheticScore(latestRoot);
  writeVideoAestheticAttemptComparison(latestRoot, { comparisonStatus: "regressed" });
  writeJson(path.join(latestRoot, "controller-state.json"), {
    artifactType: "sequencing_quality_training_controller_state_v1",
    nextQueue: [{
      goalId: "display.video_aesthetic.palette_spatial_negative_space_v1",
      reason: "coverage_gap",
      missingCoverageUnits: [{ paletteProfile: "rgb_primary", passId: "display_palette_spatial_negative_space" }]
    }]
  });

  const displayGoal = (goalId, passId, priority) => ({
    goalId,
    areaId: "display_level_composition",
    priority,
    status: "not_started",
    coverage: {
      families: ["display_quality_review"],
      paletteProfiles: ["rgb_primary"],
      passIds: [passId],
      reviewScopes: ["whole_sequence_window"]
    },
    completionCriteria: {
      minimumDistinctCoverageUnitCount: 1,
      distinctCoverageFields: ["paletteProfile", "passId"],
      desiredCoverageUnits: [{ paletteProfile: "rgb_primary", passId }]
    }
  });

  const state = buildSequencingQualityControllerState({
    curriculum: {
      ...curriculum(),
      goals: [
        displayGoal("display.video_aesthetic.palette_motion_pacing_variation_v1", "display_palette_motion_pacing_variation", 1),
        displayGoal("display.video_aesthetic.palette_spatial_negative_space_v1", "display_palette_spatial_negative_space", 2),
        displayGoal("display.video_aesthetic.palette_motion_pacing_reprise_v1", "display_palette_motion_pacing_reprise", 3)
      ]
    },
    latestRunRoot: latestRoot
  });

  assert.equal(state.controllerDecision.selectedGoalId, "display.video_aesthetic.palette_motion_pacing_reprise_v1");
  assert.equal(state.nextQueue[0].missingCoverageUnits[0].passId, "display_palette_motion_pacing_reprise");
});

test("controller advances to holdout display strategy after repeated targeted display aesthetic regressions", () => {
  const roots = [
    ["display.video_aesthetic.palette_motion_pacing_variation_v1", "display_palette_motion_pacing_variation"],
    ["display.video_aesthetic.palette_spatial_negative_space_v1", "display_palette_spatial_negative_space"],
    ["display.video_aesthetic.palette_motion_pacing_reprise_v1", "display_palette_motion_pacing_reprise"]
  ].map(([goalId, passId]) => {
    const root = tempDir();
    writeRunRoot(root, []);
    writeFullSequenceReview(root);
    writeVideoAestheticScore(root);
    writeVideoAestheticAttemptComparison(root, { comparisonStatus: "regressed" });
    writeJson(path.join(root, "controller-state.json"), {
      artifactType: "sequencing_quality_training_controller_state_v1",
      nextQueue: [{
        goalId,
        reason: "coverage_gap",
        missingCoverageUnits: [{ paletteProfile: "rgb_primary", passId }]
      }]
    });
    writeJson(path.join(root, "pass-runner-summary.json"), {
      artifactType: "layer_composition_pass_runner_summary_v1",
      processedPasses: 8,
      renderReviewAcceptedEvidenceCount: 7,
      renderReviewEligibleQualityMean: 0.79
    });
    return root;
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
        goalId: "display.video_aesthetic.palette_motion_pacing_holdout_v1",
        areaId: "display_level_composition",
        priority: 1,
        status: "not_started",
        coverage: {
          families: ["display_quality_review"],
          paletteProfiles: ["rgb_primary"],
          passIds: ["display_palette_motion_pacing_holdout"],
          reviewScopes: ["whole_sequence_window"]
        },
        completionCriteria: {
          minimumDistinctCoverageUnitCount: 1,
          distinctCoverageFields: ["paletteProfile", "passId"],
          desiredCoverageUnits: [{ paletteProfile: "rgb_primary", passId: "display_palette_motion_pacing_holdout" }]
        }
      }]
    },
    latestRunRoot: latestRoot
  });

  assert.equal(state.controllerDecision.selectedGoalId, "display.video_aesthetic.palette_motion_pacing_holdout_v1");
  assert.equal(state.controllerDecision.selectionReason, "targeted_display_regression_cluster_redesign");
  assert.equal(state.controllerDecision.nextAction, "plan_goal_coverage");
  assert.equal(state.nextQueue[0].missingCoverageUnits[0].passId, "display_palette_motion_pacing_holdout");
});

test("controller selects redesigned guarded display target after regression cluster when available", () => {
  const roots = [
    ["display.video_aesthetic.palette_motion_pacing_variation_v1", "display_palette_motion_pacing_variation"],
    ["display.video_aesthetic.palette_spatial_negative_space_v1", "display_palette_spatial_negative_space"],
    ["display.video_aesthetic.palette_motion_pacing_reprise_v1", "display_palette_motion_pacing_reprise"]
  ].map(([goalId, passId]) => {
    const root = tempDir();
    writeRunRoot(root, []);
    writeFullSequenceReview(root);
    writeVideoAestheticScore(root);
    writeVideoAestheticAttemptComparison(root, { comparisonStatus: "regressed" });
    writeJson(path.join(root, "controller-state.json"), {
      artifactType: "sequencing_quality_training_controller_state_v1",
      nextQueue: [{
        goalId,
        reason: "coverage_gap",
        missingCoverageUnits: [{ paletteProfile: "rgb_primary", passId }]
      }]
    });
    writeJson(path.join(root, "pass-runner-summary.json"), {
      artifactType: "layer_composition_pass_runner_summary_v1",
      processedPasses: 8,
      renderReviewAcceptedEvidenceCount: 7,
      renderReviewEligibleQualityMean: 0.79
    });
    return root;
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
        goalId: "display.video_aesthetic.palette_foundation_guarded_motion_v1",
        areaId: "display_level_composition",
        priority: 1,
        status: "not_started",
        coverage: {
          families: ["display_quality_review"],
          paletteProfiles: ["rgb_primary"],
          passIds: [
            "display_palette_foundation_guarded_intro",
            "display_palette_foundation_guarded_lift",
            "display_palette_foundation_guarded_release"
          ],
          reviewScopes: ["whole_sequence_window"]
        },
        completionCriteria: {
          minimumDistinctCoverageUnitCount: 1,
          distinctCoverageFields: ["paletteProfile", "passId"],
          desiredCoverageUnits: [
            { paletteProfile: "rgb_primary", passId: "display_palette_foundation_guarded_intro" },
            { paletteProfile: "rgb_primary", passId: "display_palette_foundation_guarded_lift" },
            { paletteProfile: "rgb_primary", passId: "display_palette_foundation_guarded_release" }
          ]
        }
      }]
    },
    latestRunRoot: latestRoot
  });

  assert.equal(state.controllerDecision.selectedGoalId, "display.video_aesthetic.palette_foundation_guarded_motion_v1");
  assert.equal(state.controllerDecision.selectionReason, "targeted_display_regression_cluster_redesign");
  assert.deepEqual(
    state.nextQueue[0].missingCoverageUnits.map((unit) => unit.passId),
    [
      "display_palette_foundation_guarded_intro",
      "display_palette_foundation_guarded_lift",
      "display_palette_foundation_guarded_release"
    ]
  );
});

test("controller repeats improved guarded display redesign before expanding variants", () => {
  const regressionRoots = [
    ["display.video_aesthetic.palette_motion_pacing_variation_v1", "display_palette_motion_pacing_variation"],
    ["display.video_aesthetic.palette_spatial_negative_space_v1", "display_palette_spatial_negative_space"],
    ["display.video_aesthetic.palette_motion_pacing_reprise_v1", "display_palette_motion_pacing_reprise"]
  ].map(([goalId, passId]) => {
    const root = tempDir();
    writeRunRoot(root, []);
    writeFullSequenceReview(root);
    writeVideoAestheticScore(root);
    writeVideoAestheticAttemptComparison(root, { comparisonStatus: "regressed" });
    writeJson(path.join(root, "controller-state.json"), {
      artifactType: "sequencing_quality_training_controller_state_v1",
      nextQueue: [{
        goalId,
        reason: "coverage_gap",
        missingCoverageUnits: [{ paletteProfile: "rgb_primary", passId }]
      }]
    });
    writeJson(path.join(root, "pass-runner-summary.json"), {
      artifactType: "layer_composition_pass_runner_summary_v1",
      processedPasses: 8,
      renderReviewAcceptedEvidenceCount: 7,
      renderReviewEligibleQualityMean: 0.79
    });
    return root;
  });
  const latestRoot = tempDir();
  writeRunRoot(latestRoot, [
    "display_palette_foundation_guarded_intro",
    "display_palette_foundation_guarded_lift",
    "display_palette_foundation_guarded_release"
  ].map((passId) => ({
    ...record(passId, 0.84),
    experimentId: "display-quality-review-rgb_primary",
    family: "display_quality_review",
    paletteProfiles: ["rgb_primary"],
    reviewScopes: ["whole_sequence_window"]
  })));
  writeFullSequenceReview(latestRoot);
  writeVideoAestheticScore(latestRoot);
  writeVideoAestheticAttemptComparison(latestRoot, {
    comparisonStatus: "neutral",
    summary: {
      overallAestheticScoreDelta: 0.005,
      improvedDimensionCount: 4,
      regressedDimensionCount: 2
    }
  });
  writeJson(path.join(latestRoot, "controller-state.json"), {
    artifactType: "sequencing_quality_training_controller_state_v1",
    nextQueue: [{
      goalId: "display.video_aesthetic.palette_motion_pacing_reprise_v1",
      reason: "coverage_gap",
      missingCoverageUnits: [{ paletteProfile: "rgb_primary", passId: "display_palette_motion_pacing_reprise" }]
    }]
  });
  writeJson(path.join(latestRoot, "pass-runner-summary.json"), {
    artifactType: "layer_composition_pass_runner_summary_v1",
    processedPasses: 4,
    renderReviewAcceptedEvidenceCount: 3,
    renderReviewEligibleQualityMean: 0.84
  });
  writeJson(path.join(latestRoot, "cross-run-quality-records.json"), {
    ...JSON.parse(fs.readFileSync(path.join(latestRoot, "cross-run-quality-records.json"), "utf8")),
    sourceRunRoots: [...regressionRoots, latestRoot]
  });

  const state = buildSequencingQualityControllerState({
    curriculum: {
      ...curriculum(),
      goals: [{
        goalId: "display.video_aesthetic.palette_foundation_guarded_motion_v1",
        areaId: "display_level_composition",
        priority: 1,
        status: "not_started",
        coverage: {
          families: ["display_quality_review"],
          paletteProfiles: ["rgb_primary"],
          passIds: [
            "display_palette_foundation_guarded_intro",
            "display_palette_foundation_guarded_lift",
            "display_palette_foundation_guarded_release"
          ],
          reviewScopes: ["whole_sequence_window"]
        },
        completionCriteria: {
          minimumDistinctCoverageUnitCount: 3,
          distinctCoverageFields: ["paletteProfile", "passId"],
          desiredCoverageUnits: [
            { paletteProfile: "rgb_primary", passId: "display_palette_foundation_guarded_intro" },
            { paletteProfile: "rgb_primary", passId: "display_palette_foundation_guarded_lift" },
            { paletteProfile: "rgb_primary", passId: "display_palette_foundation_guarded_release" }
          ]
        }
      }]
    },
    latestRunRoot: latestRoot
  });

  assert.equal(state.controllerDecision.selectionReason, "targeted_display_regression_cluster_redesign_repeat");
  assert.deepEqual(
    state.nextQueue.map((row) => row.passId),
    [
      "display_palette_foundation_guarded_intro",
      "display_palette_foundation_guarded_lift",
      "display_palette_foundation_guarded_release"
    ]
  );
});

test("controller does not repeat a redesigned display branch that loses whole-sequence score", () => {
  const regressionRoots = [
    ["display.video_aesthetic.palette_motion_pacing_variation_v1", "display_palette_motion_pacing_variation"],
    ["display.video_aesthetic.palette_spatial_negative_space_v1", "display_palette_spatial_negative_space"],
    ["display.video_aesthetic.palette_motion_pacing_reprise_v1", "display_palette_motion_pacing_reprise"]
  ].map(([goalId, passId]) => {
    const root = tempDir();
    writeRunRoot(root, []);
    writeFullSequenceReview(root);
    writeVideoAestheticScore(root);
    writeVideoAestheticAttemptComparison(root, { comparisonStatus: "regressed" });
    writeJson(path.join(root, "controller-state.json"), {
      artifactType: "sequencing_quality_training_controller_state_v1",
      nextQueue: [{
        goalId,
        reason: "coverage_gap",
        missingCoverageUnits: [{ paletteProfile: "rgb_primary", passId }]
      }]
    });
    writeJson(path.join(root, "pass-runner-summary.json"), {
      artifactType: "layer_composition_pass_runner_summary_v1",
      processedPasses: 8,
      renderReviewAcceptedEvidenceCount: 7,
      renderReviewEligibleQualityMean: 0.79
    });
    return root;
  });
  const latestRoot = tempDir();
  writeRunRoot(latestRoot, [
    "display_palette_foundation_focal_pacing_intro",
    "display_palette_foundation_focal_pacing_lift",
    "display_palette_foundation_focal_pacing_release"
  ].map((passId) => ({
    ...record(passId, 0.844),
    experimentId: "display-quality-review-rgb_primary",
    family: "display_quality_review",
    paletteProfiles: ["rgb_primary"],
    reviewScopes: ["whole_sequence_window"]
  })));
  writeFullSequenceReview(latestRoot);
  writeVideoAestheticScore(latestRoot);
  writeVideoAestheticAttemptComparison(latestRoot, {
    comparisonStatus: "neutral",
    summary: {
      overallAestheticScoreDelta: -0.001,
      improvedDimensionCount: 2,
      regressedDimensionCount: 3
    }
  });
  writeJson(path.join(latestRoot, "controller-state.json"), {
    artifactType: "sequencing_quality_training_controller_state_v1",
    nextQueue: [{
      goalId: "display.video_aesthetic.palette_foundation_focal_pacing_v1",
      reason: "coverage_gap",
      missingCoverageUnits: [{ paletteProfile: "rgb_primary", passId: "display_palette_foundation_focal_pacing_release" }]
    }]
  });
  writeJson(path.join(latestRoot, "pass-runner-summary.json"), {
    artifactType: "layer_composition_pass_runner_summary_v1",
    processedPasses: 4,
    renderReviewAcceptedEvidenceCount: 3,
    renderReviewEligibleQualityMean: 0.844
  });
  writeJson(path.join(latestRoot, "cross-run-quality-records.json"), {
    ...JSON.parse(fs.readFileSync(path.join(latestRoot, "cross-run-quality-records.json"), "utf8")),
    sourceRunRoots: [...regressionRoots, latestRoot]
  });

  const state = buildSequencingQualityControllerState({
    curriculum: {
      ...curriculum(),
      goals: [{
        goalId: "display.video_aesthetic.palette_foundation_focal_pacing_v1",
        areaId: "display_level_composition",
        priority: 1,
        status: "not_started",
        coverage: {
          families: ["display_quality_review"],
          paletteProfiles: ["rgb_primary"],
          passIds: [
            "display_palette_foundation_focal_pacing_intro",
            "display_palette_foundation_focal_pacing_lift",
            "display_palette_foundation_focal_pacing_release"
          ],
          reviewScopes: ["whole_sequence_window"]
        },
        completionCriteria: {
          minimumDistinctCoverageUnitCount: 3,
          distinctCoverageFields: ["paletteProfile", "passId"],
          desiredCoverageUnits: [
            { paletteProfile: "rgb_primary", passId: "display_palette_foundation_focal_pacing_intro" },
            { paletteProfile: "rgb_primary", passId: "display_palette_foundation_focal_pacing_lift" },
            { paletteProfile: "rgb_primary", passId: "display_palette_foundation_focal_pacing_release" }
          ]
        }
      }]
    },
    latestRunRoot: latestRoot
  });

  assert.equal(state.controllerDecision.selectionReason, "targeted_display_redesign_not_improved");
  assert.deepEqual(state.nextQueue, []);
});

test("controller pivots to music structure after redesigned display branches are exhausted", () => {
  const regressionRoots = [
    ["display.video_aesthetic.palette_motion_pacing_variation_v1", "display_palette_motion_pacing_variation"],
    ["display.video_aesthetic.palette_spatial_negative_space_v1", "display_palette_spatial_negative_space"],
    ["display.video_aesthetic.palette_motion_pacing_reprise_v1", "display_palette_motion_pacing_reprise"]
  ].map(([goalId, passId]) => {
    const root = tempDir();
    writeRunRoot(root, []);
    writeFullSequenceReview(root);
    writeVideoAestheticScore(root);
    writeVideoAestheticAttemptComparison(root, { comparisonStatus: "regressed" });
    writeJson(path.join(root, "controller-state.json"), {
      artifactType: "sequencing_quality_training_controller_state_v1",
      nextQueue: [{
        goalId,
        reason: "coverage_gap",
        missingCoverageUnits: [{ paletteProfile: "rgb_primary", passId }]
      }]
    });
    writeJson(path.join(root, "pass-runner-summary.json"), {
      artifactType: "layer_composition_pass_runner_summary_v1",
      processedPasses: 8,
      renderReviewAcceptedEvidenceCount: 7,
      renderReviewEligibleQualityMean: 0.79
    });
    return root;
  });
  const latestRoot = tempDir();
  writeRunRoot(latestRoot, [
    "display_palette_foundation_focal_pacing_intro",
    "display_palette_foundation_focal_pacing_lift",
    "display_palette_foundation_focal_pacing_release"
  ].map((passId) => ({
    ...record(passId, 0.844),
    experimentId: "display-quality-review-rgb_primary",
    family: "display_quality_review",
    paletteProfiles: ["rgb_primary"],
    reviewScopes: ["whole_sequence_window"]
  })));
  writeFullSequenceReview(latestRoot);
  writeVideoAestheticScore(latestRoot);
  writeVideoAestheticAttemptComparison(latestRoot, {
    comparisonStatus: "neutral",
    summary: { overallAestheticScoreDelta: -0.001, improvedDimensionCount: 2, regressedDimensionCount: 3 }
  });
  writeJson(path.join(latestRoot, "controller-state.json"), {
    artifactType: "sequencing_quality_training_controller_state_v1",
    nextQueue: [{
      goalId: "display.video_aesthetic.palette_foundation_focal_pacing_v1",
      reason: "coverage_gap",
      missingCoverageUnits: [{ paletteProfile: "rgb_primary", passId: "display_palette_foundation_focal_pacing_release" }]
    }]
  });
  writeJson(path.join(latestRoot, "pass-runner-summary.json"), {
    artifactType: "layer_composition_pass_runner_summary_v1",
    processedPasses: 4,
    renderReviewAcceptedEvidenceCount: 3,
    renderReviewEligibleQualityMean: 0.844
  });
  writeJson(path.join(latestRoot, "cross-run-quality-records.json"), {
    ...JSON.parse(fs.readFileSync(path.join(latestRoot, "cross-run-quality-records.json"), "utf8")),
    sourceRunRoots: [...regressionRoots, latestRoot]
  });

  const state = buildSequencingQualityControllerState({
    curriculum: {
      ...curriculum(),
      goals: [
        {
          goalId: "display.video_aesthetic.palette_foundation_focal_pacing_v1",
          areaId: "display_level_composition",
          priority: 1,
          status: "not_started",
          coverage: {
            families: ["display_quality_review"],
            paletteProfiles: ["rgb_primary"],
            passIds: [
              "display_palette_foundation_focal_pacing_intro",
              "display_palette_foundation_focal_pacing_lift",
              "display_palette_foundation_focal_pacing_release"
            ],
            reviewScopes: ["whole_sequence_window"]
          },
          completionCriteria: {
            minimumDistinctCoverageUnitCount: 3,
            distinctCoverageFields: ["paletteProfile", "passId"],
            desiredCoverageUnits: [
              { paletteProfile: "rgb_primary", passId: "display_palette_foundation_focal_pacing_intro" },
              { paletteProfile: "rgb_primary", passId: "display_palette_foundation_focal_pacing_lift" },
              { paletteProfile: "rgb_primary", passId: "display_palette_foundation_focal_pacing_release" }
            ]
          }
        },
        {
          goalId: "music.multi_section_structure.v1",
          areaId: "music_structure",
          priority: 2,
          status: "not_started",
          coverage: {
            families: ["music_structure_alignment"],
            paletteProfiles: ["rgb_primary"],
            passIds: ["multi_section_energy_arc"],
            timingSources: ["section"]
          },
          completionCriteria: {
            minimumDistinctCoverageUnitCount: 1,
            distinctCoverageFields: ["paletteProfile", "passId"],
            desiredCoverageUnits: [{ paletteProfile: "rgb_primary", passId: "multi_section_energy_arc" }]
          }
        }
      ]
    },
    latestRunRoot: latestRoot
  });

  assert.equal(state.controllerDecision.selectionReason, "targeted_display_redesign_exhausted_music_pivot");
  assert.equal(state.controllerDecision.selectedGoalId, "music.multi_section_structure.v1");
  assert.deepEqual(state.nextQueue[0].missingCoverageUnits, [
    { paletteProfile: "rgb_primary", passId: "multi_section_energy_arc" }
  ]);
});

test("controller advances to next redesigned display branch after prior redesigns lose whole-sequence score", () => {
  const regressionRoots = [
    ["display.video_aesthetic.palette_motion_pacing_variation_v1", "display_palette_motion_pacing_variation"],
    ["display.video_aesthetic.palette_spatial_negative_space_v1", "display_palette_spatial_negative_space"],
    ["display.video_aesthetic.palette_motion_pacing_reprise_v1", "display_palette_motion_pacing_reprise"]
  ].map(([goalId, passId]) => {
    const root = tempDir();
    writeRunRoot(root, []);
    writeFullSequenceReview(root);
    writeVideoAestheticScore(root);
    writeVideoAestheticAttemptComparison(root, { comparisonStatus: "regressed" });
    writeJson(path.join(root, "controller-state.json"), {
      artifactType: "sequencing_quality_training_controller_state_v1",
      nextQueue: [{
        goalId,
        reason: "coverage_gap",
        missingCoverageUnits: [{ paletteProfile: "rgb_primary", passId }]
      }]
    });
    writeJson(path.join(root, "pass-runner-summary.json"), {
      artifactType: "layer_composition_pass_runner_summary_v1",
      processedPasses: 8,
      renderReviewAcceptedEvidenceCount: 7,
      renderReviewEligibleQualityMean: 0.79
    });
    return root;
  });
  const focalPacingRoot = tempDir();
  writeRunRoot(focalPacingRoot, [
    "display_palette_foundation_focal_pacing_intro",
    "display_palette_foundation_focal_pacing_lift",
    "display_palette_foundation_focal_pacing_release"
  ].map((passId) => ({
    ...record(passId, 0.844),
    experimentId: "display-quality-review-rgb_primary",
    family: "display_quality_review",
    paletteProfiles: ["rgb_primary"],
    reviewScopes: ["whole_sequence_window"]
  })));
  writeFullSequenceReview(focalPacingRoot);
  writeVideoAestheticScore(focalPacingRoot);
  writeVideoAestheticAttemptComparison(focalPacingRoot, {
    comparisonStatus: "neutral",
    summary: { overallAestheticScoreDelta: -0.001, improvedDimensionCount: 2, regressedDimensionCount: 3 }
  });
  writeJson(path.join(focalPacingRoot, "controller-state.json"), {
    artifactType: "sequencing_quality_training_controller_state_v1",
    nextQueue: [{
      goalId: "display.video_aesthetic.palette_foundation_focal_pacing_v1",
      reason: "coverage_gap",
      missingCoverageUnits: [{ paletteProfile: "rgb_primary", passId: "display_palette_foundation_focal_pacing_release" }]
    }]
  });
  writeJson(path.join(focalPacingRoot, "pass-runner-summary.json"), {
    artifactType: "layer_composition_pass_runner_summary_v1",
    processedPasses: 4,
    renderReviewAcceptedEvidenceCount: 3,
    renderReviewEligibleQualityMean: 0.844
  });

  const latestRoot = tempDir();
  writeRunRoot(latestRoot, [
    ...[
      "display_palette_foundation_focal_pacing_intro",
      "display_palette_foundation_focal_pacing_lift",
      "display_palette_foundation_focal_pacing_release"
    ].map((passId) => ({
      ...record(passId, 0.844),
      experimentId: "display-quality-review-rgb_primary",
      family: "display_quality_review",
      paletteProfiles: ["rgb_primary"],
      reviewScopes: ["whole_sequence_window"]
    })),
    ...[
      "display_palette_foundation_focal_isolation_intro",
      "display_palette_foundation_focal_isolation_lift",
      "display_palette_foundation_focal_isolation_release"
    ].map((passId) => ({
    ...record(passId, 0.843),
    experimentId: "display-quality-review-rgb_primary",
    family: "display_quality_review",
    paletteProfiles: ["rgb_primary"],
    reviewScopes: ["whole_sequence_window"]
    }))
  ]);
  writeFullSequenceReview(latestRoot);
  writeVideoAestheticScore(latestRoot);
  writeVideoAestheticAttemptComparison(latestRoot, {
    comparisonStatus: "neutral",
    summary: { overallAestheticScoreDelta: -0.0004, improvedDimensionCount: 0, regressedDimensionCount: 1 }
  });
  writeJson(path.join(latestRoot, "controller-state.json"), {
    artifactType: "sequencing_quality_training_controller_state_v1",
    nextQueue: [{
      goalId: "display.video_aesthetic.palette_foundation_focal_isolation_v1",
      reason: "coverage_gap",
      missingCoverageUnits: [{ paletteProfile: "rgb_primary", passId: "display_palette_foundation_focal_isolation_release" }]
    }]
  });
  writeJson(path.join(latestRoot, "pass-runner-summary.json"), {
    artifactType: "layer_composition_pass_runner_summary_v1",
    processedPasses: 4,
    renderReviewAcceptedEvidenceCount: 3,
    renderReviewEligibleQualityMean: 0.843
  });
  writeJson(path.join(latestRoot, "cross-run-quality-records.json"), {
    ...JSON.parse(fs.readFileSync(path.join(latestRoot, "cross-run-quality-records.json"), "utf8")),
    sourceRunRoots: [...regressionRoots, focalPacingRoot, latestRoot]
  });

  const state = buildSequencingQualityControllerState({
    curriculum: {
      ...curriculum(),
      goals: [
        {
          goalId: "display.video_aesthetic.palette_foundation_focal_pacing_v1",
          areaId: "display_level_composition",
          priority: 1,
          status: "not_started",
          coverage: {
            families: ["display_quality_review"],
            paletteProfiles: ["rgb_primary"],
            passIds: [
              "display_palette_foundation_focal_pacing_intro",
              "display_palette_foundation_focal_pacing_lift",
              "display_palette_foundation_focal_pacing_release"
            ],
            reviewScopes: ["whole_sequence_window"]
          },
          completionCriteria: {
            minimumDistinctCoverageUnitCount: 3,
            distinctCoverageFields: ["paletteProfile", "passId"],
            desiredCoverageUnits: [
              { paletteProfile: "rgb_primary", passId: "display_palette_foundation_focal_pacing_intro" },
              { paletteProfile: "rgb_primary", passId: "display_palette_foundation_focal_pacing_lift" },
              { paletteProfile: "rgb_primary", passId: "display_palette_foundation_focal_pacing_release" }
            ]
          }
        },
        {
          goalId: "display.video_aesthetic.palette_foundation_focal_isolation_v1",
          areaId: "display_level_composition",
          priority: 2,
          status: "not_started",
          coverage: {
            families: ["display_quality_review"],
            paletteProfiles: ["rgb_primary"],
            passIds: [
              "display_palette_foundation_focal_isolation_intro",
              "display_palette_foundation_focal_isolation_lift",
              "display_palette_foundation_focal_isolation_release"
            ],
            reviewScopes: ["whole_sequence_window"]
          },
          completionCriteria: {
            minimumDistinctCoverageUnitCount: 3,
            distinctCoverageFields: ["paletteProfile", "passId"],
            desiredCoverageUnits: [
              { paletteProfile: "rgb_primary", passId: "display_palette_foundation_focal_isolation_intro" },
              { paletteProfile: "rgb_primary", passId: "display_palette_foundation_focal_isolation_lift" },
              { paletteProfile: "rgb_primary", passId: "display_palette_foundation_focal_isolation_release" }
            ]
          }
        },
        {
          goalId: "display.video_aesthetic.palette_foundation_controlled_counterpoint_v1",
          areaId: "display_level_composition",
          priority: 3,
          status: "not_started",
          coverage: {
            families: ["display_quality_review"],
            paletteProfiles: ["rgb_primary"],
            passIds: [
              "display_palette_foundation_counterpoint_intro",
              "display_palette_foundation_counterpoint_lift",
              "display_palette_foundation_counterpoint_release"
            ],
            reviewScopes: ["whole_sequence_window"]
          },
          completionCriteria: {
            minimumDistinctCoverageUnitCount: 3,
            distinctCoverageFields: ["paletteProfile", "passId"],
            desiredCoverageUnits: [
              { paletteProfile: "rgb_primary", passId: "display_palette_foundation_counterpoint_intro" },
              { paletteProfile: "rgb_primary", passId: "display_palette_foundation_counterpoint_lift" },
              { paletteProfile: "rgb_primary", passId: "display_palette_foundation_counterpoint_release" }
            ]
          }
        }
      ]
    },
    latestRunRoot: latestRoot
  });

  assert.equal(state.controllerDecision.selectionReason, "targeted_display_regression_cluster_redesign");
  assert.equal(
    state.controllerDecision.selectedGoalId,
    "display.video_aesthetic.palette_foundation_controlled_counterpoint_v1"
  );
  assert.deepEqual(
    state.nextQueue[0].missingCoverageUnits.map((unit) => unit.passId),
    [
      "display_palette_foundation_counterpoint_intro",
      "display_palette_foundation_counterpoint_lift",
      "display_palette_foundation_counterpoint_release"
    ]
  );
});

test("controller targets palette spatial repair after repeated weak pacing and motion attempts in color-rich display context", () => {
  const roots = [tempDir(), tempDir(), tempDir(), tempDir()];
  const strategies = [
    "section_window_pacing_balance",
    "regional_focus_contrast",
    "palette_depth_contrast_motion_repair",
    "palette_section_pacing_consistency_repair"
  ];
  roots.forEach((root, index) => {
    writeRunRoot(root, []);
    writeFullSequenceReview(root);
    writeVideoAestheticScore(root, {
      scores: {
        overallAestheticScore: 0.788,
        displayEvolution: 0.92,
        narrativeShape: 0.84,
        pacingVariety: 0.27,
        transitionFlow: 0.79,
        focalClarity: 0.86,
        focalHandoffStability: 0.7,
        visualBalance: 0.51,
        motionInterest: 0.53,
        colorDiscipline: 0.98,
        palettePurposeCoverage: 1,
        temporalContinuity: 0.92,
        localEvidenceReadability: 0.86,
        clutterControl: 1,
        qualityConsistency: 0.79,
        fullSequenceContext: 0.8
      },
      promotion: {
        evidenceEligible: true,
        blockers: []
      }
    });
    writeVideoAestheticAttemptComparison(root, { comparisonStatus: "regressed" });
    writeHumanCalibratedCandidateEvaluation(root);
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

  assert.equal(state.nextQueue[0].nextStrategy, "palette_spatial_balance_focal_repair");
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
  assert.equal(state.nextQueue[0].nextStrategy, "rgb_primary_color_discipline_repair");
});

test("controller selects focal consistency repair after all current video strategies are ineffective", () => {
  const roots = [tempDir(), tempDir(), tempDir(), tempDir(), tempDir(), tempDir()];
  const strategies = [
    "section_window_pacing_balance",
    "regional_focus_contrast",
    "rgb_primary_regional_focus_contrast",
    "rgb_primary_color_discipline_repair",
    "rgb_primary_structure_balance_pacing_repair",
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

test("controller leaves exhausted video aesthetic strategy set for other promising goals", () => {
  const roots = [tempDir(), tempDir(), tempDir(), tempDir(), tempDir(), tempDir(), tempDir(), tempDir(), tempDir(), tempDir(), tempDir()];
  const strategies = [
    "section_window_pacing_balance",
    "regional_focus_contrast",
    "rgb_primary_color_discipline_repair",
    "rgb_primary_structure_balance_pacing_repair",
    "rgb_primary_regional_focus_contrast",
    "simultaneous_display_balance_revision",
    "focal_consistency_repair",
    "palette_depth_contrast_motion_repair",
    "palette_transition_harmony_repair",
    "palette_spatial_balance_focal_repair",
    "palette_section_pacing_consistency_repair"
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
    sourceRunRoots: roots,
    records: [{
      ...record("similar_cane_transfer_probe", 0.84),
      experimentId: "target-transfer-adaptation-mono_white",
      family: "target_transfer_adaptation",
      effectName: "SingleStrand",
      modelTypes: ["cane"],
      targetScopes: ["group"]
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
      }, {
        goalId: "target_transfer.compatibility_adaptation.v1",
        areaId: "model_geometry_fit",
        priority: 2,
        status: "not_started",
        coverage: {
          families: ["target_transfer_adaptation"],
          paletteProfiles: ["mono_white"],
          passIds: ["similar_cane_transfer_probe"]
        },
        completionCriteria: {
          minimumDistinctCoverageUnitCount: 1,
          distinctCoverageFields: ["paletteProfile", "passId"],
          desiredCoverageUnits: [{
            paletteProfile: "mono_white",
            passId: "similar_cane_transfer_probe"
          }]
        }
      }]
    },
    latestRunRoot: latestRoot
  });

  assert.equal(state.controllerDecision.selectedGoalId, "target_transfer.compatibility_adaptation.v1");
  assert.equal(state.controllerDecision.selectionReason, "blocked_promising_records");
  assert.equal(state.nextQueue[0].passId, "similar_cane_transfer_probe");
});

test("controller selects palette depth contrast after prior video strategies are ineffective", () => {
  const roots = [tempDir(), tempDir(), tempDir(), tempDir(), tempDir(), tempDir(), tempDir()];
  const strategies = [
    "section_window_pacing_balance",
    "regional_focus_contrast",
    "rgb_primary_color_discipline_repair",
    "rgb_primary_structure_balance_pacing_repair",
    "rgb_primary_regional_focus_contrast",
    "simultaneous_display_balance_revision",
    "focal_consistency_repair"
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
  assert.equal(state.nextQueue[0].nextStrategy, "palette_depth_contrast_motion_repair");
});

test("controller selects palette transition harmony after palette depth is ineffective", () => {
  const roots = [tempDir(), tempDir(), tempDir(), tempDir(), tempDir(), tempDir(), tempDir(), tempDir()];
  const strategies = [
    "section_window_pacing_balance",
    "regional_focus_contrast",
    "rgb_primary_color_discipline_repair",
    "rgb_primary_structure_balance_pacing_repair",
    "rgb_primary_regional_focus_contrast",
    "simultaneous_display_balance_revision",
    "focal_consistency_repair",
    "palette_depth_contrast_motion_repair"
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
  assert.equal(state.nextQueue[0].nextStrategy, "palette_transition_harmony_repair");
});

test("controller moves improved rgb color discipline to structure balance pacing when balance remains weak", () => {
  const runRoot = tempDir();
  writeRunRoot(runRoot, []);
  writeFullSequenceReview(runRoot);
  writeVideoAestheticScore(runRoot, {
    scores: {
      overallAestheticScore: 0.751,
      displayEvolution: 0.92,
      pacingVariety: 0.55,
      transitionFlow: 0.66,
      focalClarity: 0.98,
      visualBalance: 0.42,
      motionInterest: 0.74,
      colorDiscipline: 0.91,
      clutterControl: 1,
      qualityConsistency: 0.5
    }
  });
  writeVideoAestheticAttemptComparison(runRoot, {
    comparisonStatus: "improved",
    promotionEligible: true,
    summary: {
      overallAestheticScoreDelta: 0.064,
      improvedDimensionCount: 5,
      regressedDimensionCount: 1
    }
  });
  writeJson(path.join(runRoot, "controller-state.json"), {
    artifactType: "sequencing_quality_training_controller_state_v1",
    nextQueue: [{
      nextStrategy: "rgb_primary_color_discipline_repair"
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
  assert.equal(state.nextQueue[0].nextStrategy, "rgb_primary_structure_balance_pacing_repair");
});

test("controller moves improved palette transition to spatial balance focal repair when hierarchy remains weak", () => {
  const runRoot = tempDir();
  writeRunRoot(runRoot, []);
  writeFullSequenceReview(runRoot);
  writeVideoAestheticScore(runRoot, {
    scores: {
      overallAestheticScore: 0.694,
      displayEvolution: 0.92,
      pacingVariety: 0.56,
      transitionFlow: 0.72,
      focalClarity: 0.57,
      visualBalance: 0.46,
      motionInterest: 0.71,
      colorDiscipline: 1,
      clutterControl: 1,
      qualityConsistency: 0.5
    }
  });
  writeVideoAestheticAttemptComparison(runRoot, {
    comparisonStatus: "improved",
    promotionEligible: true
  });
  writeJson(path.join(runRoot, "controller-state.json"), {
    artifactType: "sequencing_quality_training_controller_state_v1",
    nextQueue: [{ nextStrategy: "palette_transition_harmony_repair" }]
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
  assert.equal(state.nextQueue[0].nextStrategy, "palette_spatial_balance_focal_repair");
});

test("controller moves improved palette spatial balance to section pacing consistency when pacing remains weak", () => {
  const runRoot = tempDir();
  writeRunRoot(runRoot, []);
  writeFullSequenceReview(runRoot);
  writeVideoAestheticScore(runRoot, {
    scores: {
      overallAestheticScore: 0.71,
      displayEvolution: 0.92,
      pacingVariety: 0.56,
      transitionFlow: 0.74,
      focalClarity: 0.63,
      visualBalance: 0.47,
      motionInterest: 0.73,
      colorDiscipline: 1,
      clutterControl: 1,
      qualityConsistency: 0.5
    }
  });
  writeVideoAestheticAttemptComparison(runRoot, {
    comparisonStatus: "improved",
    promotionEligible: true
  });
  writeJson(path.join(runRoot, "controller-state.json"), {
    artifactType: "sequencing_quality_training_controller_state_v1",
    nextQueue: [{ nextStrategy: "palette_spatial_balance_focal_repair" }]
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
  assert.equal(state.nextQueue[0].nextStrategy, "palette_section_pacing_consistency_repair");
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
  assert.equal(state.nextQueue[0].nextStrategy, "rgb_primary_color_discipline_repair");
  assert.equal(state.nextQueue[0].avoidStrategy, "");
});

test("controller resolves creative prerequisite blocker from display and music evidence", () => {
  const runRoot = tempDir();
  writeRunRoot(runRoot, [
    {
      ...record("display_review", 0.86, []),
      experimentId: "display-quality-review-rgb_primary",
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
  }, {
    ...record("intent_focus_simplification_revision", 0.66, ["quality_trend_not_stable_or_improving"]),
    experimentId: "creative-intent-revision-comparison-mono_white",
    family: "creative_intent_revision_comparison",
    intentDimensions: ["mood", "palette", "pace", "emphasis", "style", "negative_space"],
    reviewMethods: ["deterministic_metrics", "before_after_revision_comparison"]
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

test("controller continues creative revision variants when prior variant run produced no comparison pairs", () => {
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
  writeJson(path.join(runRoot, "controller-state.json"), {
    artifactType: "sequencing_quality_training_controller_state_v1",
    nextQueue: [{
      goalId: "creative.intent_revision_variants.v1"
    }]
  });
  writeJson(path.join(runRoot, "creative-intent-revision-comparison.json"), {
    artifactType: "creative_intent_revision_comparison_v1",
    status: "no_revision_pairs",
    comparisonCount: 0,
    promotionEligibleCount: 0
  });

  const creativeGoals = [{
    goalId: "creative.intent_revision_comparison.v1",
    areaId: "creative_intent_matching",
    priority: 1,
    status: "not_started",
    requiredStableSamples: 2,
    coverage: {
      families: ["creative_intent_revision_comparison"],
      reviewMethods: ["before_after_revision_comparison"]
    }
  }, {
    goalId: "creative.intent_revision_variants.v1",
    areaId: "creative_intent_matching",
    priority: 2,
    status: "not_started",
    requiredStableSamples: 2,
    coverage: {
      families: ["creative_intent_revision_comparison"],
      passIds: [
        "intent_first_draft",
        "intent_targeted_revision",
        "intent_focus_simplification_revision"
      ]
    },
    completionCriteria: {
      distinctCoverageFields: ["passId"],
      desiredCoverageUnits: [
        { passId: "intent_first_draft" },
        { passId: "intent_targeted_revision" },
        { passId: "intent_focus_simplification_revision" }
      ]
    }
  }];

  const state = buildSequencingQualityControllerState({
    curriculum: {
      ...curriculum(),
      goals: creativeGoals
    },
    latestRunRoot: runRoot,
    maxQueue: 6
  });

  assert.equal(state.controllerDecision.selectedGoalId, "creative.intent_revision_variants.v1");
  assert.equal(state.controllerDecision.selectionReason, "creative_revision_variants_incomplete_continue");
  assert.equal(state.nextQueue[0].goalId, "creative.intent_revision_variants.v1");
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

test("controller treats durable sample completion criteria as covered evidence", () => {
  const runRoot = tempDir();
  writeRunRoot(runRoot, [
    {
      ...record("guarded_foundation_energy_arc", 0.84, []),
      experimentId: "music-structure-review-rgb_primary",
      family: "music_structure_review",
      sampleCount: 6,
      trendStatus: "stable"
    },
    {
      ...record("guarded_foundation_motif_lift", 0.85, []),
      experimentId: "music-structure-review-rgb_primary",
      family: "music_structure_review",
      sampleCount: 6,
      trendStatus: "stable"
    }
  ]);

  const state = buildSequencingQualityControllerState({
    curriculum: {
      ...curriculum(),
      goals: [{
        goalId: "music.guarded_foundation_sequence.v1",
        areaId: "musical_structure",
        priority: 1,
        status: "not_started",
        coverage: {
          families: ["music_structure_review"],
          paletteProfiles: ["rgb_primary"],
          passIds: [
            "guarded_foundation_energy_arc",
            "guarded_foundation_motif_lift",
            "guarded_foundation_lyric_release"
          ]
        },
        completionCriteria: {
          minimumDurableSampleCount: 12
        }
      }, {
        goalId: "creative.intent_match.v1",
        areaId: "creative_intent_matching",
        priority: 2,
        status: "not_started"
      }]
    },
    latestRunRoot: runRoot
  });

  assert.equal(state.goalStatuses[0].durableCandidateCount, 2);
  assert.equal(state.goalStatuses[0].durableSampleCount, 12);
  assert.equal(state.goalStatuses[0].evidenceStatus, "covered");
  assert.equal(state.controllerDecision.selectedGoalId, "creative.intent_match.v1");
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

test("controller moves past a stalled coverage gap with no accepted evidence", () => {
  const runRoot = tempDir();
  writeRunRoot(runRoot, []);
  writeJson(path.join(runRoot, "controller-state.json"), {
    artifactType: "sequencing_quality_training_controller_state_v1",
    nextQueue: [{
      goalId: "effect_fit.expanded_model_matrix.v1",
      reason: "coverage_gap",
      missingCoverageUnits: [{
        paletteProfile: "rgb_primary",
        effect: "Butterfly",
        modelType: "spinner"
      }]
    }]
  });
  writeJson(path.join(runRoot, "pass-runner-summary.json"), {
    artifactType: "layer_composition_pass_runner_summary_v1",
    processedPasses: 4,
    renderReviewAcceptedEvidenceCount: 0,
    renderReviewEligibleQualityMean: 0
  });
  writeVideoAestheticScore(runRoot, {
    scores: {
      overallAestheticScore: 0.2
    }
  });
  writeVideoAestheticAttemptComparison(runRoot, {
    comparisonStatus: "blocked",
    summary: {
      overallAestheticScoreDelta: 0,
      improvedDimensionCount: 0,
      regressedDimensionCount: 0
    }
  });

  const state = buildSequencingQualityControllerState({
    curriculum: {
      ...curriculum(),
      goals: [{
        goalId: "effect_fit.expanded_model_matrix.v1",
        areaId: "effect_behavior",
        priority: 1,
        status: "not_started",
        coverage: {
          families: ["expanded_effect_fit"],
          paletteProfiles: ["rgb_primary"],
          effects: ["Butterfly"],
          modelTypes: ["spinner"]
        },
        completionCriteria: {
          minimumDistinctCoverageUnitCount: 1,
          distinctCoverageFields: ["paletteProfile", "effect", "modelType"],
          desiredCoverageUnits: [{
            paletteProfile: "rgb_primary",
            effect: "Butterfly",
            modelType: "spinner"
          }]
        }
      }, {
        goalId: "music.structure_alignment.v1",
        areaId: "musical_structure",
        priority: 2,
        status: "not_started",
        coverage: {
          families: ["music_structure_review"],
          timingSources: ["section"]
        }
      }]
    },
    latestRunRoot: runRoot
  });

  assert.equal(
    state.goalStatuses.find((goal) => goal.goalId === "effect_fit.expanded_model_matrix.v1").blockers.includes("coverage gap attempt produced no accepted evidence"),
    true
  );
  assert.equal(state.controllerDecision.selectedGoalId, "music.structure_alignment.v1");
  assert.equal(state.nextQueue[0].goalId, "music.structure_alignment.v1");
  assert.equal(state.nextQueue[0].reason, "coverage_gap");
});

test("controller moves past a coverage gap when the missing pass was rejected", () => {
  const runRoot = tempDir();
  writeRunRoot(runRoot, [{
    ...record("compatible_arch_prior_context", 0.88, []),
    experimentId: "target-transfer-adaptation-mono_white",
    family: "target_transfer_adaptation",
    effectName: "Bars",
    modelTypes: ["arch"],
    targetScopes: ["group"],
    sampleCount: 2,
    trendStatus: "stable"
  }, {
    ...record("weak_matrix_local_validation_probe", 0.92, []),
    experimentId: "target-transfer-adaptation-mono_white",
    family: "target_transfer_adaptation",
    effectName: "Bars",
    modelTypes: ["matrix"],
    targetScopes: ["model"],
    sampleCount: 2,
    trendStatus: "stable"
  }]);
  writeJson(path.join(runRoot, "controller-state.json"), {
    artifactType: "sequencing_quality_training_controller_state_v1",
    nextQueue: [{
      goalId: "target_transfer.compatibility_adaptation.v1",
      reason: "coverage_gap",
      missingCoverageUnits: [{
        paletteProfile: "mono_white",
        passId: "similar_cane_transfer_probe"
      }]
    }]
  });
  writeJson(path.join(runRoot, "pass-runner-summary.json"), {
    artifactType: "layer_composition_pass_runner_summary_v1",
    processedPasses: 3,
    renderReviewAcceptedEvidenceCount: 1,
    results: [{
      experimentId: "target-transfer-adaptation-mono_white",
      passId: "compatible_arch_prior_context",
      renderReviewDecision: "accept",
      renderReviewEvidenceEligible: true
    }, {
      experimentId: "target-transfer-adaptation-mono_white",
      passId: "similar_cane_transfer_probe",
      renderReviewDecision: "revise",
      renderReviewEvidenceEligible: false
    }]
  });

  const state = buildSequencingQualityControllerState({
    curriculum: {
      ...curriculum(),
      goals: [{
        goalId: "target_transfer.compatibility_adaptation.v1",
        areaId: "model_geometry_fit",
        priority: 1,
        status: "not_started",
        coverage: {
          families: ["target_transfer_adaptation"],
          paletteProfiles: ["mono_white"],
          passIds: [
            "compatible_arch_prior_context",
            "similar_cane_transfer_probe",
            "weak_matrix_local_validation_probe"
          ]
        },
        completionCriteria: {
          minimumDistinctCoverageUnitCount: 3,
          distinctCoverageFields: ["paletteProfile", "passId"],
          desiredCoverageUnits: [{
            paletteProfile: "mono_white",
            passId: "compatible_arch_prior_context"
          }, {
            paletteProfile: "mono_white",
            passId: "similar_cane_transfer_probe"
          }, {
            paletteProfile: "mono_white",
            passId: "weak_matrix_local_validation_probe"
          }]
        }
      }, {
        goalId: "music.structure_alignment.v1",
        areaId: "musical_structure",
        priority: 2,
        status: "not_started",
        coverage: {
          families: ["music_structure_review"],
          timingSources: ["section"]
        }
      }]
    },
    latestRunRoot: runRoot
  });

  const transferStatus = state.goalStatuses.find((goal) => goal.goalId === "target_transfer.compatibility_adaptation.v1");
  assert.equal(transferStatus.blockers.includes("coverage gap attempt produced no accepted evidence"), true);
  assert.equal(state.controllerDecision.selectedGoalId, "music.structure_alignment.v1");
});

test("controller keeps recent stalled coverage gaps on cooldown", () => {
  const root = tempDir();
  const stalledRoot = path.join(root, "stalled");
  const latestRoot = path.join(root, "latest");
  fs.mkdirSync(stalledRoot, { recursive: true });
  fs.mkdirSync(latestRoot, { recursive: true });

  writeRunRoot(stalledRoot, []);
  writeJson(path.join(stalledRoot, "controller-state.json"), {
    artifactType: "sequencing_quality_training_controller_state_v1",
    nextQueue: [{
      goalId: "effect_fit.expanded_model_matrix.v1",
      reason: "coverage_gap",
      missingCoverageUnits: [{
        paletteProfile: "rgb_primary",
        effect: "Butterfly",
        modelType: "spinner"
      }]
    }]
  });
  writeJson(path.join(stalledRoot, "pass-runner-summary.json"), {
    artifactType: "layer_composition_pass_runner_summary_v1",
    processedPasses: 4,
    renderReviewAcceptedEvidenceCount: 0,
    renderReviewEligibleQualityMean: 0
  });
  writeVideoAestheticScore(stalledRoot, {
    scores: {
      overallAestheticScore: 0.2
    }
  });
  writeVideoAestheticAttemptComparison(stalledRoot, {
    comparisonStatus: "blocked"
  });

  writeRunRoot(latestRoot, []);
  writeJson(path.join(latestRoot, "cross-run-quality-records.json"), {
    artifactType: "layer_composition_quality_records_v1",
    sourceRunRoots: [stalledRoot],
    durableCandidateCount: 0,
    blockedRecordCount: 0,
    records: []
  });

  const state = buildSequencingQualityControllerState({
    curriculum: {
      ...curriculum(),
      goals: [{
        goalId: "effect_fit.expanded_model_matrix.v1",
        areaId: "effect_behavior",
        priority: 1,
        status: "not_started",
        coverage: {
          families: ["expanded_effect_fit"],
          paletteProfiles: ["rgb_primary"],
          effects: ["Butterfly"],
          modelTypes: ["spinner"]
        },
        completionCriteria: {
          minimumDistinctCoverageUnitCount: 1,
          distinctCoverageFields: ["paletteProfile", "effect", "modelType"],
          desiredCoverageUnits: [{
            paletteProfile: "rgb_primary",
            effect: "Butterfly",
            modelType: "spinner"
          }]
        }
      }, {
        goalId: "music.structure_alignment.v1",
        areaId: "musical_structure",
        priority: 2,
        status: "not_started",
        coverage: {
          families: ["music_structure_review"],
          timingSources: ["section"]
        }
      }]
    },
    latestRunRoot: latestRoot
  });

  assert.equal(
    state.goalStatuses.find((goal) => goal.goalId === "effect_fit.expanded_model_matrix.v1").blockers.includes("coverage gap attempt produced no accepted evidence"),
    true
  );
  assert.equal(state.controllerDecision.selectedGoalId, "music.structure_alignment.v1");
});

test("controller continues bounded coverage when durable evidence count is still short", () => {
  const runRoot = tempDir();
  writeRunRoot(runRoot, [{
    ...record("group_then_model", 0.85, []),
    experimentId: "group-model-interplay-rgb_primary",
    family: "group_model_interplay",
    effectName: "Bars",
    targetScopes: ["group"],
    sampleCount: 2,
    trendStatus: "stable"
  }]);

  const state = buildSequencingQualityControllerState({
    curriculum: {
      ...curriculum(),
      goals: [{
        goalId: "layer.rgb_primary.basic",
        areaId: "layer_composition",
        priority: 1,
        status: "not_started",
        coverage: {
          paletteProfiles: ["rgb_primary"],
          families: ["group_model_interplay", "same_target_layer_stack"],
          effects: ["Bars", "Color Wash", "Marquee"],
          targetScopes: ["group", "model"]
        },
        completionCriteria: {
          minimumDurableCandidateCount: 5
        }
      }]
    },
    latestRunRoot: runRoot
  });

  assert.equal(state.goalStatuses[0].durableCandidateCount, 1);
  assert.equal(state.goalStatuses[0].evidenceStatus, "in_progress");
  assert.equal(state.controllerDecision.selectedGoalId, "layer.rgb_primary.basic");
  assert.equal(state.nextQueue[0].reason, "coverage_gap");
});

test("controller counts pass-scoped video aesthetic coverage even when pass records use section dimensions", () => {
  const runRoot = tempDir();
  writeRunRoot(runRoot, [
    "display_palette_focal_handoff_guarded_context_intro",
    "display_palette_focal_handoff_guarded_context_lift",
    "display_palette_focal_handoff_guarded_context_release"
  ].map((passId) => ({
    ...record(passId, 0.84, []),
    experimentId: "display-quality-review-rgb_primary",
    family: "display_quality_review",
    paletteProfiles: ["rgb_primary"],
    reviewScopes: ["section_video", "whole_sequence_window", "full_display_contact_sheet"],
    qualityDimensions: ["coverage_balance", "motion_coherence", "palette_readability"],
    sampleCount: 2,
    trendStatus: "stable"
  })));
  writeFullSequenceReview(runRoot);
  writeVideoAestheticScore(runRoot, {
    qualityDimensions: ["focal_handoff_stability", "focal_clarity", "full_sequence_context", "intent_match"]
  });
  writeVideoAestheticAttemptComparison(runRoot, {
    comparisonStatus: "neutral",
    summary: { overallAestheticScoreDelta: 0, improvedDimensionCount: 0, regressedDimensionCount: 0 }
  });

  const state = buildSequencingQualityControllerState({
    curriculum: {
      ...curriculum(),
      goals: [{
        goalId: "display.video_aesthetic.palette_focal_handoff_guarded_context_sequence_v1",
        areaId: "display_level_composition",
        priority: 1,
        status: "not_started",
        coverage: {
          families: ["display_quality_review"],
          paletteProfiles: ["rgb_primary"],
          passIds: [
            "display_palette_focal_handoff_guarded_context_intro",
            "display_palette_focal_handoff_guarded_context_lift",
            "display_palette_focal_handoff_guarded_context_release"
          ],
          reviewScopes: ["whole_sequence_window"],
          qualityDimensions: ["focal_handoff_stability", "focal_clarity", "full_sequence_context", "intent_match"]
        },
        completionCriteria: {
          minimumDistinctCoverageUnitCount: 3,
          distinctCoverageFields: ["paletteProfile", "passId"],
          desiredCoverageUnits: [
            { paletteProfile: "rgb_primary", passId: "display_palette_focal_handoff_guarded_context_intro" },
            { paletteProfile: "rgb_primary", passId: "display_palette_focal_handoff_guarded_context_lift" },
            { paletteProfile: "rgb_primary", passId: "display_palette_focal_handoff_guarded_context_release" }
          ]
        }
      }]
    },
    latestRunRoot: runRoot
  });

  assert.equal(state.goalStatuses[0].durableCandidateCount, 3);
  assert.equal(state.goalStatuses[0].distinctCoverageUnitCount, 3);
  assert.equal(state.goalStatuses[0].evidenceStatus, "covered");
  assert.equal(state.controllerDecision.selectionReason, "no_active_goals");
  assert.deepEqual(state.nextQueue, []);
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
