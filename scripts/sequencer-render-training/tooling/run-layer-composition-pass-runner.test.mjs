import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildLayerCompositionTrainingPlan } from "./build-layer-composition-training-plan.mjs";
import { buildLayerCompositionExecutionScaffold } from "./run-layer-composition-execution-scaffold.mjs";
import { runLayerCompositionPasses } from "./run-layer-composition-pass-runner.mjs";

const modelCatalog = {
  layoutName: "RenderTraining",
  showDir: "/tmp/render-training",
  fixtureSequencePath: "",
  canonicalModels: {
    single_line_horizontal: { modelName: "SingleLineHorizontal", modelType: "single_line", geometryProfile: "single_line_horizontal", analyzerFamily: "linear" },
    arch_group: { modelName: "ArchGroup", modelType: "arch", geometryProfile: "arch_grouped", analyzerFamily: "linear" },
    arch_single: { modelName: "ArchSingle", modelType: "arch", geometryProfile: "arch_single", analyzerFamily: "linear" },
    spinner: { modelName: "Spinner", modelType: "spinner", geometryProfile: "spinner_standard", analyzerFamily: "radial" },
    star_triple_layer: { modelName: "StarTripleLayer", modelType: "star", geometryProfile: "star_multi_layer", analyzerFamily: "star" },
    tree_flat: { modelName: "TreeFlat", modelType: "tree_flat", geometryProfile: "tree_flat_single_layer", analyzerFamily: "tree" }
  }
};

function setupRun() {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "xld-layer-pass-runner-"));
  const fixtureDir = path.join(runRoot, "fixture");
  const showDir = path.join(runRoot, "show");
  fs.mkdirSync(fixtureDir, { recursive: true });
  fs.mkdirSync(showDir, { recursive: true });
  const fixture = path.join(fixtureDir, "fixture.xsq");
  fs.writeFileSync(fixture, "<xsequence />");
  fs.writeFileSync(path.join(fixtureDir, "fixture.fseq"), "base-fseq");
  const plan = buildLayerCompositionTrainingPlan({
    modelCatalog: {
      ...modelCatalog,
      showDir,
      canonicalModels: modelCatalog.canonicalModels,
      fixtureSequencePath: fixture
    },
    runId: "pass-runner-test",
    runType: "smoke"
  });
  const planPath = path.join(runRoot, "training-plan.json");
  fs.writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`);
  buildLayerCompositionExecutionScaffold({ plan, planPath, runRoot });
  return { runRoot };
}

function withTrainingShowReady(deps = {}) {
  return {
    assertTrainingShowDir: async () => ({
      expectedShowDir: "/tmp/render-training",
      actualShowDir: "/tmp/render-training"
    }),
    ...deps
  };
}

test("pass runner completes one pass and updates checkpoint and ledger", async () => {
  const { runRoot } = setupRun();
  const fseqPath = path.join(runRoot, "rendered.fseq");
  fs.writeFileSync(fseqPath, "rendered");
  let observedSequencePath = "";
  const summary = await runLayerCompositionPasses({
    runRoot,
    maxPasses: 1,
    deps: withTrainingShowReady({
      runOwnedPass: async ({ sequencePath, passExecution }) => {
        observedSequencePath = sequencePath;
        return {
          artifactType: "layer_composition_owned_pass_result_v1",
          ok: true,
          sequencePath,
          runId: passExecution.runId,
          experimentId: passExecution.experimentId,
          passId: passExecution.passId,
          learningId: passExecution.learningId,
          fseqPath,
          steps: []
        };
      },
      extractObservation: ({ passExecution, passDir }) => {
        const renderObservationPath = path.join(passDir, "render-observation.json");
        const previewWindowPath = path.join(passDir, "preview-window.json");
        const compositionObservationPath = path.join(passDir, "composition-stack-observation.json");
        fs.writeFileSync(renderObservationPath, JSON.stringify({ artifactType: "render_observation_v1" }));
        fs.writeFileSync(previewWindowPath, JSON.stringify({ artifactType: "preview_scene_window_v1" }));
        fs.writeFileSync(compositionObservationPath, JSON.stringify({
          artifactType: "composition_stack_observation_v1",
          passId: passExecution.passId
        }));
        return { renderObservationPath, previewWindowPath, compositionObservationPath };
      }
    })
  });

  assert.equal(summary.processedPasses, 1);
  assert.equal(summary.results[0].status, "completed");
  assert.equal(observedSequencePath.startsWith(path.join(runRoot, "show")), true);
  assert.equal(observedSequencePath.includes(`${path.sep}passes${path.sep}`), false);
  const checkpoints = JSON.parse(fs.readFileSync(path.join(runRoot, "checkpoints.json"), "utf8"));
  assert.equal(checkpoints.checkpoints[0].status, "completed");
  assert.equal(Boolean(checkpoints.checkpoints[0].observationRef), true);
  const checkpoint = JSON.parse(fs.readFileSync(checkpoints.checkpoints[0].checkpointRef, "utf8"));
  assert.equal(checkpoint.status, "completed");
  assert.equal(checkpoint.rawArtifactsSummarized, true);
  assert.equal(fs.existsSync(checkpoint.observationRef), true);
  const executionSummary = JSON.parse(fs.readFileSync(path.join(runRoot, "execution-summary.json"), "utf8"));
  assert.equal(executionSummary.completedPassCount, 1);
  assert.equal(executionSummary.pendingApplyRenderCount > 0, true);

  const ledger = JSON.parse(fs.readFileSync(path.join(runRoot, "retention-ledger.json"), "utf8"));
  assert.equal(ledger.artifacts.some((row) => row.artifactClass === "raw_fseq" && row.purgeEligible), true);
  assert.equal(ledger.artifacts.some((row) => row.artifactClass === "temporary_sequence_copy" && row.allowExternalDelete), true);
  assert.equal(ledger.artifacts.some((row) => row.artifactClass === "composition_stack_observation"), true);
});

test("pass runner records failure and stops after first failed pass", async () => {
  const { runRoot } = setupRun();
  const summary = await runLayerCompositionPasses({
    runRoot,
    maxPasses: 2,
    deps: withTrainingShowReady({
      runOwnedPass: async () => {
        throw new Error("owned unavailable");
      }
    })
  });

  assert.equal(summary.processedPasses, 1);
  assert.equal(summary.results[0].status, "failed");
  const checkpoints = JSON.parse(fs.readFileSync(path.join(runRoot, "checkpoints.json"), "utf8"));
  assert.equal(checkpoints.checkpoints[0].status, "failed");
  const checkpoint = JSON.parse(fs.readFileSync(checkpoints.checkpoints[0].checkpointRef, "utf8"));
  assert.equal(checkpoint.status, "failed");
  assert.equal(fs.existsSync(checkpoint.failureSummaryRef), true);
});

test("pass runner resumes from per-pass checkpoint status instead of stale bundle status", async () => {
  const { runRoot } = setupRun();
  const completed = [];
  const deps = withTrainingShowReady({
    runOwnedPass: async ({ sequencePath, passExecution }) => {
      completed.push(passExecution.passId);
      return {
        artifactType: "layer_composition_owned_pass_result_v1",
        ok: true,
        sequencePath,
        runId: passExecution.runId,
        experimentId: passExecution.experimentId,
        passId: passExecution.passId,
        learningId: passExecution.learningId,
        fseqPath: sequencePath.replace(/\.xsq$/i, ".fseq"),
        steps: []
      };
    },
    extractObservation: ({ passExecution, passDir }) => {
      const renderObservationPath = path.join(passDir, "render-observation.json");
      const previewWindowPath = path.join(passDir, "preview-window.json");
      const compositionObservationPath = path.join(passDir, "composition-stack-observation.json");
      fs.writeFileSync(renderObservationPath, JSON.stringify({ artifactType: "render_observation_v1" }));
      fs.writeFileSync(previewWindowPath, JSON.stringify({ artifactType: "preview_scene_window_v1" }));
      fs.writeFileSync(compositionObservationPath, JSON.stringify({
        artifactType: "composition_stack_observation_v1",
        passId: passExecution.passId
      }));
      return { renderObservationPath, previewWindowPath, compositionObservationPath };
    }
  });

  await runLayerCompositionPasses({ runRoot, maxPasses: 1, deps });
  await runLayerCompositionPasses({ runRoot, maxPasses: 1, deps });

  assert.deepEqual(completed, ["empty_baseline", "foundation_group_only"]);
});

test("pass runner can filter pending passes by experiment id", async () => {
  const { runRoot } = setupRun();
  const completed = [];
  const summary = await runLayerCompositionPasses({
    runRoot,
    maxPasses: 2,
    experimentIds: ["same-target-layer-stack-mono_white"],
    deps: withTrainingShowReady({
      runOwnedPass: async ({ sequencePath, passExecution }) => {
        completed.push(`${passExecution.experimentId}:${passExecution.passId}`);
        return {
          artifactType: "layer_composition_owned_pass_result_v1",
          ok: true,
          sequencePath,
          runId: passExecution.runId,
          experimentId: passExecution.experimentId,
          passId: passExecution.passId,
          learningId: passExecution.learningId,
          fseqPath: sequencePath.replace(/\.xsq$/i, ".fseq"),
          steps: []
        };
      },
      extractObservation: ({ passExecution, passDir }) => {
        const renderObservationPath = path.join(passDir, "render-observation.json");
        const previewWindowPath = path.join(passDir, "preview-window.json");
        const compositionObservationPath = path.join(passDir, "composition-stack-observation.json");
        fs.writeFileSync(renderObservationPath, JSON.stringify({ artifactType: "render_observation_v1" }));
        fs.writeFileSync(previewWindowPath, JSON.stringify({ artifactType: "preview_scene_window_v1" }));
        fs.writeFileSync(compositionObservationPath, JSON.stringify({
          artifactType: "composition_stack_observation_v1",
          passId: passExecution.passId
        }));
        return { renderObservationPath, previewWindowPath, compositionObservationPath };
      }
    })
  });

  assert.equal(summary.processedPasses, 2);
  assert.deepEqual(summary.experimentIds, ["same-target-layer-stack-mono_white"]);
  assert.deepEqual(completed, [
    "same-target-layer-stack-mono_white:empty_baseline",
    "same-target-layer-stack-mono_white:one_layer_foundation"
  ]);
});

test("pass runner can use runtime-budget mode instead of fixed pass count", async () => {
  const { runRoot } = setupRun();
  const completed = [];
  let nowMs = 0;
  const summary = await runLayerCompositionPasses({
    runRoot,
    maxPasses: 1,
    untilRuntimeBudget: true,
    maxRuntimeMinutes: 10,
    experimentIds: ["same-target-layer-stack-mono_white"],
    deps: withTrainingShowReady({
      now: () => nowMs,
      runOwnedPass: async ({ sequencePath, passExecution }) => {
        completed.push(passExecution.passId);
        nowMs += 1000;
        return {
          artifactType: "layer_composition_owned_pass_result_v1",
          ok: true,
          sequencePath,
          runId: passExecution.runId,
          experimentId: passExecution.experimentId,
          passId: passExecution.passId,
          learningId: passExecution.learningId,
          fseqPath: sequencePath.replace(/\.xsq$/i, ".fseq"),
          steps: []
        };
      },
      extractObservation: ({ passExecution, passDir }) => {
        const renderObservationPath = path.join(passDir, "render-observation.json");
        const previewWindowPath = path.join(passDir, "preview-window.json");
        const compositionObservationPath = path.join(passDir, "composition-stack-observation.json");
        fs.writeFileSync(renderObservationPath, JSON.stringify({ artifactType: "render_observation_v1" }));
        fs.writeFileSync(previewWindowPath, JSON.stringify({ artifactType: "preview_scene_window_v1" }));
        fs.writeFileSync(compositionObservationPath, JSON.stringify({ artifactType: "composition_stack_observation_v1", passId: passExecution.passId }));
        return { renderObservationPath, previewWindowPath, compositionObservationPath };
      }
    })
  });

  assert.equal(summary.untilRuntimeBudget, true);
  assert.equal(summary.requestedPasses, null);
  assert.equal(summary.maxRuntimeMinutes, 10);
  assert.equal(summary.stopStatus, "queue_exhausted");
  assert.equal(summary.processedPasses > 1, true);
  assert.equal(completed.length, summary.pendingPassesSelected);
});

test("pass runner reports runtime budget reached before applying more work", async () => {
  const { runRoot } = setupRun();
  let nowCalls = 0;
  const summary = await runLayerCompositionPasses({
    runRoot,
    untilRuntimeBudget: true,
    maxRuntimeMinutes: 1,
    deps: withTrainingShowReady({
      now: () => {
        nowCalls += 1;
        return nowCalls === 1 ? 0 : 60000;
      },
      runOwnedPass: async () => {
        throw new Error("should not apply after budget");
      }
    })
  });

  assert.equal(summary.untilRuntimeBudget, true);
  assert.equal(summary.processedPasses, 0);
  assert.equal(summary.stopStatus, "runtime_budget_reached");
  assert.equal(summary.stopReason, "max_runtime_minutes_elapsed");
});

test("pass runner stops before applying work when disk guardrail is below hard stop", async () => {
  const { runRoot } = setupRun();
  const summary = await runLayerCompositionPasses({
    runRoot,
    untilRuntimeBudget: true,
    maxRuntimeMinutes: 10,
    deps: withTrainingShowReady({
      freeDiskGb: () => 5,
      runOwnedPass: async () => {
        throw new Error("should not apply below disk stop guardrail");
      }
    })
  });

  assert.equal(summary.processedPasses, 0);
  assert.equal(summary.stopStatus, "disk_guardrail_stop");
  assert.equal(summary.stopReason, "free_disk_below_stop_guardrail");
  assert.equal(summary.diskGuardrailEventCount, 1);
  assert.equal(summary.diskGuardrailEvents[0].phase, "before_pass");
});

test("pass runner stops cleanly when xLights is attached to the wrong show folder", async () => {
  const { runRoot } = setupRun();
  const summary = await runLayerCompositionPasses({
    runRoot,
    maxPasses: 1,
    deps: withTrainingShowReady({
      assertTrainingShowDir: async () => {
        throw new Error("xLights is open to /wrong/show; expected training show /tmp/render-training.");
      },
      runOwnedPass: async () => {
        throw new Error("should not apply when training show is mismatched");
      }
    })
  });

  assert.equal(summary.processedPasses, 0);
  assert.equal(summary.stopStatus, "training_show_mismatch");
  assert.match(summary.stopReason, /expected training show/);
  const checkpoints = JSON.parse(fs.readFileSync(path.join(runRoot, "checkpoints.json"), "utf8"));
  assert.equal(checkpoints.checkpoints[0].status, "pending_apply_render");
});

test("pass runner requests append-only refill when budget mode exhausts pending work", async () => {
  const { runRoot } = setupRun();
  const completed = [];
  let refillCalls = 0;
  const summary = await runLayerCompositionPasses({
    runRoot,
    untilRuntimeBudget: true,
    maxRuntimeMinutes: 10,
    deps: withTrainingShowReady({
      now: () => 0,
      runOwnedPass: async ({ sequencePath, passExecution }) => {
        completed.push(`${passExecution.experimentId}:${passExecution.passId}`);
        return {
          artifactType: "layer_composition_owned_pass_result_v1",
          ok: true,
          sequencePath,
          runId: passExecution.runId,
          experimentId: passExecution.experimentId,
          passId: passExecution.passId,
          learningId: passExecution.learningId,
          fseqPath: sequencePath.replace(/\.xsq$/i, ".fseq"),
          steps: []
        };
      },
      extractObservation: ({ passExecution, passDir }) => {
        const renderObservationPath = path.join(passDir, "render-observation.json");
        const previewWindowPath = path.join(passDir, "preview-window.json");
        const compositionObservationPath = path.join(passDir, "composition-stack-observation.json");
        fs.writeFileSync(renderObservationPath, JSON.stringify({ artifactType: "render_observation_v1" }));
        fs.writeFileSync(previewWindowPath, JSON.stringify({ artifactType: "preview_scene_window_v1" }));
        fs.writeFileSync(compositionObservationPath, JSON.stringify({ artifactType: "composition_stack_observation_v1", passId: passExecution.passId }));
        return { renderObservationPath, previewWindowPath, compositionObservationPath };
      },
      refillPendingPasses: async ({ runRoot: root, plan, refillAttempt }) => {
        refillCalls += 1;
        if (refillAttempt > 1) return { status: "no_valid_non_repeated_experiment", appendedCheckpointCount: 0 };
        const refillPlan = JSON.parse(JSON.stringify(plan));
        refillPlan.experiments = [refillPlan.experiments[0]];
        refillPlan.experiments[0].experimentId = `${refillPlan.experiments[0].experimentId}-refill-001`;
        refillPlan.experiments[0].passes = [refillPlan.experiments[0].passes[0]];
        refillPlan.experiments[0].passes[0].passId = `${refillPlan.experiments[0].passes[0].passId}_refill_001`;
        refillPlan.experiments[0].passes[0].learningSeed.learningId = `${refillPlan.experiments[0].passes[0].learningSeed.learningId}:refill:001`;
        return buildLayerCompositionExecutionScaffold({
          plan: refillPlan,
          planPath: path.join(root, "training-plan.json"),
          runRoot: root,
          append: true,
          mode: "adaptive_refill"
        });
      }
    })
  });

  assert.equal(refillCalls, 2);
  assert.equal(summary.refillAttempts, 2);
  assert.equal(summary.learningCheckpointCount, 2);
  assert.equal(summary.refillResults[0].appendedCheckpointCount, 1);
  assert.equal(summary.stopStatus, "queue_exhausted");
  assert.equal(summary.stopReason, "no_valid_non_repeated_experiment");
  assert.equal(completed.some((row) => row.includes("-refill-001:empty_baseline_refill_001")), true);
  assert.equal(fs.existsSync(summary.learningCheckpoints[1].deltaSummaryRef), true);
  const secondDeltaSummary = JSON.parse(fs.readFileSync(summary.learningCheckpoints[1].deltaSummaryRef, "utf8"));
  assert.equal(
    secondDeltaSummary.experiments.some((experiment) => experiment.experimentId.endsWith("-refill-001")),
    true
  );
});

test("pass runner stages through TRAINING_API_STAGING_ROOT when provided", async () => {
  const { runRoot } = setupRun();
  const stagingRoot = path.join(runRoot, "api-staging");
  fs.writeFileSync(path.join(runRoot, "show", "xlights_rgbeffects.xml"), "<rgb />");
  fs.writeFileSync(path.join(runRoot, "show", "xlights_networks.xml"), "<net />");
  const previous = process.env.TRAINING_API_STAGING_ROOT;
  process.env.TRAINING_API_STAGING_ROOT = stagingRoot;
  let observedSequencePath = "";
  try {
    await runLayerCompositionPasses({
      runRoot,
      maxPasses: 1,
      deps: withTrainingShowReady({
        runOwnedPass: async ({ sequencePath, passExecution }) => {
          observedSequencePath = sequencePath;
          return {
            artifactType: "layer_composition_owned_pass_result_v1",
            ok: true,
            sequencePath,
            runId: passExecution.runId,
            experimentId: passExecution.experimentId,
            passId: passExecution.passId,
            learningId: passExecution.learningId,
            fseqPath: path.join(stagingRoot, `${path.basename(sequencePath, ".xsq")}.fseq`),
            steps: []
          };
        },
        extractObservation: ({ passExecution, passDir }) => {
          const renderObservationPath = path.join(passDir, "render-observation.json");
          const previewWindowPath = path.join(passDir, "preview-window.json");
          const compositionObservationPath = path.join(passDir, "composition-stack-observation.json");
          fs.writeFileSync(renderObservationPath, JSON.stringify({ artifactType: "render_observation_v1" }));
          fs.writeFileSync(previewWindowPath, JSON.stringify({ artifactType: "preview_scene_window_v1" }));
          fs.writeFileSync(compositionObservationPath, JSON.stringify({ artifactType: "composition_stack_observation_v1", passId: passExecution.passId }));
          return { renderObservationPath, previewWindowPath, compositionObservationPath };
        }
      })
    });
  } finally {
    if (previous == null) delete process.env.TRAINING_API_STAGING_ROOT;
    else process.env.TRAINING_API_STAGING_ROOT = previous;
  }

  assert.equal(observedSequencePath.startsWith(stagingRoot), true);
  assert.equal(fs.existsSync(path.join(stagingRoot, "xlights_rgbeffects.xml")), true);
  const ledger = JSON.parse(fs.readFileSync(path.join(runRoot, "retention-ledger.json"), "utf8"));
  assert.equal(ledger.externalDeleteRoots.includes(stagingRoot), true);
});
