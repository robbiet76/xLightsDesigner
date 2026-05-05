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
  assert.ok(summary.recommendedNextCurriculumExpansion.includes("larger effect/model coverage matrix"));
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
