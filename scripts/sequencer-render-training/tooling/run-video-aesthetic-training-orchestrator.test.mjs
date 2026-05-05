import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { runVideoAestheticTrainingOrchestrator } from "./run-video-aesthetic-training-orchestrator.mjs";

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "xld-video-orchestrator-test-"));
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function writeLoopArtifacts(loopRoot, {
  overall = 0.7,
  comparisonStatus = "neutral",
  promotionEligible = false
} = {}) {
  writeJson(path.join(loopRoot, "video-aesthetic-score.json"), {
    artifactType: "video_aesthetic_score_v1",
    status: "ready",
    scoreBasis: "controller_selected_window_metrics_and_progression_observation",
    scoredWindowCount: 1,
    scores: { overallAestheticScore: overall },
    promotion: { evidenceEligible: promotionEligible, blockers: promotionEligible ? [] : ["overall_aesthetic_score_below_threshold"] },
    windows: [{ passId: "display_focal_consistency_repair" }]
  });
  writeJson(path.join(loopRoot, "video-aesthetic-attempt-comparison.json"), {
    artifactType: "video_aesthetic_attempt_comparison_v1",
    status: "ready",
    comparisonStatus,
    promotionEligible,
    summary: {
      overallAestheticScoreDelta: promotionEligible ? 0.04 : -0.001,
      improvedDimensionCount: promotionEligible ? 3 : 1,
      regressedDimensionCount: promotionEligible ? 0 : 2
    },
    deltas: []
  });
}

test("video aesthetic orchestrator exports improved learning and stops on idle", async () => {
  const root = tempDir();
  const bundleOut = path.join(root, "video-aesthetic-learning-bundle.js");
  let calls = 0;
  const report = await runVideoAestheticTrainingOrchestrator({
    seedRunRoot: path.join(root, "seed"),
    previousStatePath: path.join(root, "seed-controller.json"),
    outRoot: root,
    modelCatalogPath: path.join(root, "model-catalog.json"),
    bundleOutPath: bundleOut,
    maxLoops: 2,
    deps: {
      runLoop: async (args) => {
        calls += 1;
        fs.mkdirSync(args.loopRoot, { recursive: true });
        const controllerStateRef = path.join(args.loopRoot, "controller-state.json");
        if (calls === 1) {
          writeJson(controllerStateRef, {
            nextQueue: [{ nextStrategy: "focal_consistency_repair" }],
            goalStatuses: [{ goalId: "display.full_sequence.quality_v1", evidenceStatus: "in_progress", durableCandidateCount: 1 }]
          });
          writeLoopArtifacts(args.loopRoot, {
            overall: 0.756,
            comparisonStatus: "improved",
            promotionEligible: true
          });
          return {
            status: "executed",
            loopRoot: args.loopRoot,
            controllerStateRef,
            controllerDecision: {
              selectedGoalId: "display.full_sequence.quality_v1",
              nextAction: "plan_goal_coverage",
              selectionReason: "video_aesthetic_score_below_threshold"
            },
            passRunner: { processedPasses: 4, renderReviewAcceptedEvidenceCount: 3 }
          };
        }
        writeJson(controllerStateRef, {
          nextQueue: [],
          goalStatuses: [{ goalId: "display.full_sequence.quality_v1", evidenceStatus: "covered", durableCandidateCount: 2 }]
        });
        writeLoopArtifacts(args.loopRoot, {
          overall: 0.756,
          comparisonStatus: "improved",
          promotionEligible: true
        });
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
      },
      buildLearningBundle: ({ runRoot }) => ({
        artifactType: "sequencer_video_aesthetic_learning_bundle",
        runRoot,
        recordCount: 1,
        selectorReadyCount: 1,
        records: {}
      })
    }
  });

  assert.equal(report.artifactType, "video_aesthetic_training_orchestrator_report_v1");
  assert.equal(report.stopReason, "controller_idle");
  assert.equal(report.iterationCount, 2);
  assert.equal(report.selectorReadyExportCount, 1);
  assert.equal(report.bestIteration.videoScore.overallAestheticScore, 0.756);
  assert.equal(fs.existsSync(bundleOut), true);
  assert.equal(fs.existsSync(path.join(root, "video-aesthetic-training-report.json")), true);
});

test("video aesthetic orchestrator stops at max loops with resumable report", async () => {
  const root = tempDir();
  const report = await runVideoAestheticTrainingOrchestrator({
    seedRunRoot: path.join(root, "seed"),
    outRoot: root,
    maxLoops: 1,
    deps: {
      runLoop: async (args) => {
        fs.mkdirSync(args.loopRoot, { recursive: true });
        const controllerStateRef = path.join(args.loopRoot, "controller-state.json");
        writeJson(controllerStateRef, {
          nextQueue: [{ nextStrategy: "section_window_pacing_balance" }],
          goalStatuses: []
        });
        writeLoopArtifacts(args.loopRoot, { overall: 0.66 });
        return {
          status: "executed",
          loopRoot: args.loopRoot,
          controllerStateRef,
          controllerDecision: {
            selectedGoalId: "display.full_sequence.quality_v1",
            nextAction: "plan_goal_coverage",
            selectionReason: "video_aesthetic_score_below_threshold"
          },
          passRunner: { processedPasses: 1, renderReviewAcceptedEvidenceCount: 1 }
        };
      }
    }
  });

  assert.equal(report.stopReason, "max_loops_reached");
  assert.equal(report.iterationCount, 1);
  assert.equal(report.latestRunRoot, path.join(root, "loop-000001"));
  assert.ok(report.nextSteps.some((row) => row.includes("Resume")));
});
