import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { runSequencingQualityUnattended } from "./run-sequencing-quality-unattended.mjs";

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "xld-quality-unattended-test-"));
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

test("unattended quality runner advances checkpoints and stops on idle", async () => {
  const root = tempDir();
  const calls = [];
  const summary = await runSequencingQualityUnattended({
    latestRunRoot: path.join(root, "seed"),
    previousStatePath: path.join(root, "seed-controller.json"),
    outRoot: root,
    modelCatalogPath: path.join(root, "model-catalog.json"),
    maxLoops: 3,
    maxPasses: 2,
    autoRefill: false,
    deps: {
      runLoop: async (args) => {
        calls.push(args);
        const controllerStateRef = path.join(args.loopRoot, "controller-state.json");
        if (calls.length === 1) {
          writeJson(controllerStateRef, {
            goalStatuses: [{
              goalId: "display.full_sequence.quality_v1",
              evidenceStatus: "covered",
              durableCandidateCount: 2,
              blockedPromisingCount: 0,
              blockers: []
            }]
          });
          return {
            status: "executed",
            loopRoot: args.loopRoot,
            controllerStateRef,
            controllerDecision: {
              selectedGoalId: "display.full_sequence.quality_v1",
              nextAction: "plan_quality_repeats",
              selectionReason: "blocked_promising_records"
            },
            passRunner: {
              processedPasses: 2,
              renderReviewAcceptedEvidenceCount: 2
            },
            crossRunQuality: {
              durableCandidateCount: 2,
              blockedRecordCount: 0
            }
          };
        }
        writeJson(controllerStateRef, {
          goalStatuses: [{
            goalId: "creative.intent_match.v1",
            evidenceStatus: "covered",
            durableCandidateCount: 2,
            blockedPromisingCount: 0,
            blockers: []
          }]
        });
        return {
          status: "blocked_no_controller_queue",
          loopRoot: args.loopRoot,
          controllerStateRef,
          controllerDecision: {
            selectedGoalId: "",
            nextAction: "idle",
            selectionReason: "no_active_goals"
          },
          passRunner: null,
          crossRunQuality: null
        };
      }
    }
  });

  assert.equal(summary.artifactType, "sequencing_quality_unattended_run_summary_v1");
  assert.equal(summary.stopReason, "controller_idle");
  assert.equal(summary.iterationCount, 2);
  assert.equal(summary.iterations[0].status, "executed");
  assert.equal(summary.iterations[1].nextAction, "idle");
  assert.equal(calls[1].latestRunRoot, calls[0].loopRoot);
  assert.equal(calls[1].previousStatePath, path.join(calls[0].loopRoot, "controller-state.json"));
  assert.equal(fs.existsSync(path.join(root, "unattended-run-summary.json")), true);
  assert.ok(summary.recommendedNextCurriculumExpansion.includes("stronger video-level aesthetic scoring"));
});

test("unattended quality runner refills runtime curriculum on idle", async () => {
  const root = tempDir();
  const calls = [];
  const summary = await runSequencingQualityUnattended({
    latestRunRoot: path.join(root, "seed"),
    previousStatePath: path.join(root, "seed-controller.json"),
    outRoot: root,
    maxLoops: 2,
    maxAutoRefills: 1,
    deps: {
      runLoop: async (args) => {
        calls.push(args);
        const controllerStateRef = path.join(args.loopRoot, "controller-state.json");
        if (calls.length === 1) {
          writeJson(controllerStateRef, { goalStatuses: [] });
          return {
            status: "blocked_no_controller_queue",
            loopRoot: args.loopRoot,
            controllerStateRef,
            controllerDecision: {
              selectedGoalId: "",
              nextAction: "idle",
              selectionReason: "no_active_goals"
            }
          };
        }
        writeJson(controllerStateRef, { goalStatuses: [] });
        return {
          status: "executed",
          loopRoot: args.loopRoot,
          controllerStateRef,
          controllerDecision: {
            selectedGoalId: "display.video_aesthetic.auto_refill.motion_pacing_cycle_01_v1",
            nextAction: "plan_goal_coverage",
            selectionReason: "coverage_gap"
          },
          passRunner: { processedPasses: 1, renderReviewAcceptedEvidenceCount: 1 },
          crossRunQuality: { durableCandidateCount: 1, blockedRecordCount: 0 }
        };
      }
    }
  });

  assert.equal(summary.stopReason, "max_loops_reached");
  assert.equal(summary.refillEvents.length, 1);
  assert.equal(summary.refillEvents[0].addedGoalCount, 4);
  assert.equal(summary.iterations[0].refillAddedGoalCount, 4);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].curriculumPath, calls[1].curriculumPath);
  const runtimeCurriculum = JSON.parse(fs.readFileSync(summary.runtimeCurriculumRef, "utf8"));
  assert.ok(runtimeCurriculum.goals.some((goal) => goal.goalId === "display.video_aesthetic.auto_refill.motion_pacing_cycle_01_v1"));
});

test("unattended quality runner stops at max loop count", async () => {
  const root = tempDir();
  const summary = await runSequencingQualityUnattended({
    latestRunRoot: path.join(root, "seed"),
    previousStatePath: path.join(root, "seed-controller.json"),
    outRoot: root,
    maxLoops: 1,
    deps: {
      runLoop: async (args) => {
        const controllerStateRef = path.join(args.loopRoot, "controller-state.json");
        writeJson(controllerStateRef, { goalStatuses: [] });
        return {
          status: "executed",
          loopRoot: args.loopRoot,
          controllerStateRef,
          controllerDecision: {
            selectedGoalId: "effect_fit.core_effects.v1",
            nextAction: "plan_goal_coverage",
            selectionReason: "coverage_gap"
          },
          passRunner: { processedPasses: 1, renderReviewAcceptedEvidenceCount: 1 },
          crossRunQuality: { durableCandidateCount: 1, blockedRecordCount: 1 }
        };
      }
    }
  });

  assert.equal(summary.stopReason, "max_loops_reached");
  assert.equal(summary.iterationCount, 1);
});

test("unattended quality runner consolidates executed loop evidence", async () => {
  const root = tempDir();
  let consolidatedLoopRoot = "";
  const summary = await runSequencingQualityUnattended({
    latestRunRoot: path.join(root, "seed"),
    previousStatePath: path.join(root, "seed-controller.json"),
    outRoot: root,
    maxLoops: 1,
    deps: {
      runLoop: async (args) => {
        const controllerStateRef = path.join(args.loopRoot, "controller-state.json");
        writeJson(controllerStateRef, { goalStatuses: [] });
        return {
          status: "executed",
          loopRoot: args.loopRoot,
          controllerStateRef,
          controllerDecision: {
            selectedGoalId: "display.full_sequence.quality_v1",
            nextAction: "plan_goal_coverage",
            selectionReason: "coverage_gap"
          },
          videoAestheticScore: {
            overallAestheticScore: 0.75,
            promotionEligible: true
          },
          videoAestheticAttemptComparison: {
            comparisonStatus: "improved",
            overallAestheticScoreDelta: 0.04
          },
          passRunner: { processedPasses: 2, renderReviewAcceptedEvidenceCount: 2 },
          crossRunQuality: {
            recordsRef: path.join(args.loopRoot, "cross-run-quality-records.json"),
            durableCandidateCount: 2,
            blockedRecordCount: 0
          }
        };
      },
      consolidateLoopEvidence: ({ loopRoot }) => {
        consolidatedLoopRoot = loopRoot;
        return {
          deltaSummaryRef: path.join(loopRoot, "layer-composition-delta-summary.json"),
          promotedPriorsRef: path.join(loopRoot, "cross-run-quality-priors-promoted.json"),
          selectorReadyPriorCount: 1,
          blockedPromotionCount: 0,
          deletedPreviewFrameCount: 12,
          deletedPreviewFrameBytes: 2048
        };
      }
    }
  });

  assert.equal(summary.stopReason, "max_loops_reached");
  assert.equal(summary.iterations[0].comparisonStatus, "improved");
  assert.equal(summary.iterations[0].overallAestheticScore, 0.75);
  assert.equal(summary.iterations[0].consolidation.selectorReadyPriorCount, 1);
  assert.equal(summary.iterations[0].consolidation.deletedPreviewFrameCount, 12);
  assert.equal(consolidatedLoopRoot, summary.iterations[0].loopRoot);
});

test("unattended quality runner stops on repeated regressions for intervention", async () => {
  const root = tempDir();
  const summary = await runSequencingQualityUnattended({
    latestRunRoot: path.join(root, "seed"),
    previousStatePath: path.join(root, "seed-controller.json"),
    outRoot: root,
    maxLoops: 5,
    maxConsecutiveRegressions: 2,
    deps: {
      runLoop: async (args) => {
        const controllerStateRef = path.join(args.loopRoot, "controller-state.json");
        writeJson(controllerStateRef, { goalStatuses: [] });
        return {
          status: "executed",
          loopRoot: args.loopRoot,
          controllerStateRef,
          controllerDecision: {
            selectedGoalId: "effect_fit.expanded_model_matrix.v1",
            nextAction: "plan_quality_repeats",
            selectionReason: "blocked_promising_records"
          },
          videoAestheticScore: {
            overallAestheticScore: 0.62,
            promotionEligible: false
          },
          videoAestheticAttemptComparison: {
            comparisonStatus: "regressed",
            overallAestheticScoreDelta: -0.08
          },
          passRunner: { processedPasses: 2, renderReviewAcceptedEvidenceCount: 1 },
          crossRunQuality: { durableCandidateCount: 1, blockedRecordCount: 4 }
        };
      },
      consolidateLoopEvidence: ({ loopRoot }) => ({
        deltaSummaryRef: path.join(loopRoot, "layer-composition-delta-summary.json")
      })
    }
  });

  assert.equal(summary.stopReason, "max_consecutive_regressions");
  assert.equal(summary.iterationCount, 2);
  assert.equal(summary.interventionRecommended, true);
  assert.equal(summary.iterations[1].consecutiveRegressionCount, 2);
});

test("unattended quality runner uses creative revision comparison as primary gate", async () => {
  const root = tempDir();
  const summary = await runSequencingQualityUnattended({
    latestRunRoot: path.join(root, "seed"),
    previousStatePath: path.join(root, "seed-controller.json"),
    outRoot: root,
    maxLoops: 1,
    deps: {
      runLoop: async (args) => {
        const controllerStateRef = path.join(args.loopRoot, "controller-state.json");
        writeJson(controllerStateRef, { goalStatuses: [] });
        return {
          status: "executed",
          loopRoot: args.loopRoot,
          controllerStateRef,
          controllerDecision: {
            selectedGoalId: "creative.intent_revision_variants.v1",
            nextAction: "plan_goal_coverage",
            selectionReason: "coverage_gap"
          },
          videoAestheticAttemptComparison: {
            comparisonStatus: "regressed",
            overallAestheticScoreDelta: -0.06
          },
          creativeIntentRevisionComparison: {
            status: "ready",
            comparisonCount: 1,
            improvedComparisonCount: 1,
            promotionEligibleCount: 1
          },
          passRunner: { processedPasses: 2, renderReviewAcceptedEvidenceCount: 2 },
          crossRunQuality: { durableCandidateCount: 1, blockedRecordCount: 0 }
        };
      },
      consolidateLoopEvidence: ({ loopRoot }) => ({
        deltaSummaryRef: path.join(loopRoot, "layer-composition-delta-summary.json")
      })
    }
  });

  assert.equal(summary.stopReason, "max_loops_reached");
  assert.equal(summary.iterations[0].comparisonStatus, "regressed");
  assert.equal(summary.iterations[0].qualityGateSource, "creative_intent_revision_comparison");
  assert.equal(summary.iterations[0].qualityGateStatus, "improved");
  assert.equal(summary.iterations[0].outcome, "improved");
  assert.equal(summary.iterations[0].consecutiveRegressionCount, 0);
  assert.equal(summary.latestRunRoot, path.join(root, "seed"));
  assert.equal(summary.previousStateRef, path.join(summary.iterations[0].loopRoot, "controller-state.json"));
});

test("unattended quality runner treats blocked creative revision comparisons as regressions", async () => {
  const root = tempDir();
  const summary = await runSequencingQualityUnattended({
    latestRunRoot: path.join(root, "seed"),
    previousStatePath: path.join(root, "seed-controller.json"),
    outRoot: root,
    maxLoops: 2,
    maxConsecutiveRegressions: 1,
    deps: {
      runLoop: async (args) => {
        const controllerStateRef = path.join(args.loopRoot, "controller-state.json");
        writeJson(controllerStateRef, { goalStatuses: [] });
        return {
          status: "executed",
          loopRoot: args.loopRoot,
          controllerStateRef,
          controllerDecision: {
            selectedGoalId: "creative.intent_revision_variants.v1",
            nextAction: "plan_goal_coverage",
            selectionReason: "coverage_gap"
          },
          videoAestheticAttemptComparison: {
            comparisonStatus: "neutral",
            overallAestheticScoreDelta: 0
          },
          creativeIntentRevisionComparison: {
            status: "ready",
            comparisonCount: 1,
            improvedComparisonCount: 0,
            promotionEligibleCount: 0
          },
          passRunner: { processedPasses: 2, renderReviewAcceptedEvidenceCount: 1 },
          crossRunQuality: { durableCandidateCount: 0, blockedRecordCount: 1 }
        };
      },
      consolidateLoopEvidence: ({ loopRoot }) => ({
        deltaSummaryRef: path.join(loopRoot, "layer-composition-delta-summary.json")
      })
    }
  });

  assert.equal(summary.stopReason, "max_consecutive_regressions");
  assert.equal(summary.iterationCount, 1);
  assert.equal(summary.iterations[0].qualityGateSource, "creative_intent_revision_comparison");
  assert.equal(summary.iterations[0].outcome, "regressed");
  assert.equal(summary.iterations[0].consecutiveRegressionCount, 1);
});

test("unattended quality runner does not advance latest run root after video regressions", async () => {
  const root = tempDir();
  const summary = await runSequencingQualityUnattended({
    latestRunRoot: path.join(root, "seed"),
    previousStatePath: path.join(root, "seed-controller.json"),
    outRoot: root,
    maxLoops: 1,
    deps: {
      runLoop: async (args) => {
        const controllerStateRef = path.join(args.loopRoot, "controller-state.json");
        writeJson(controllerStateRef, { goalStatuses: [] });
        return {
          status: "executed",
          loopRoot: args.loopRoot,
          controllerStateRef,
          controllerDecision: {
            selectedGoalId: "display.full_sequence.quality_v1",
            nextAction: "plan_goal_coverage",
            selectionReason: "video_aesthetic_score_below_threshold"
          },
          videoAestheticAttemptComparison: {
            comparisonStatus: "regressed",
            overallAestheticScoreDelta: -0.04
          },
          passRunner: { processedPasses: 2, renderReviewAcceptedEvidenceCount: 1 },
          crossRunQuality: { durableCandidateCount: 0, blockedRecordCount: 1 }
        };
      },
      consolidateLoopEvidence: ({ loopRoot }) => ({
        deltaSummaryRef: path.join(loopRoot, "layer-composition-delta-summary.json")
      })
    }
  });

  assert.equal(summary.stopReason, "max_consecutive_regressions");
  assert.equal(summary.latestRunRoot, path.join(root, "seed"));
  assert.equal(summary.previousStateRef, path.join(summary.iterations[0].loopRoot, "controller-state.json"));
});
