import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildLayerCompositionTrainingPlan } from "./build-layer-composition-training-plan.mjs";
import { buildLayerCompositionExecutionScaffold } from "./run-layer-composition-execution-scaffold.mjs";

const modelCatalog = {
  layoutName: "RenderTraining",
  showDir: "/tmp/render-training",
  fixtureSequencePath: "/tmp/render-training/RenderTraining-AnimationFixture.xsq",
  canonicalModels: {
    single_line_horizontal: { modelName: "SingleLineHorizontal", modelType: "single_line", geometryProfile: "single_line_horizontal", analyzerFamily: "linear" },
    arch_group: { modelName: "ArchGroup", modelType: "arch", geometryProfile: "arch_grouped", analyzerFamily: "linear" },
    arch_single: { modelName: "ArchSingle", modelType: "arch", geometryProfile: "arch_single", analyzerFamily: "linear" },
    spinner: { modelName: "Spinner", modelType: "spinner", geometryProfile: "spinner_standard", analyzerFamily: "radial" },
    star_triple_layer: { modelName: "StarTripleLayer", modelType: "star", geometryProfile: "star_multi_layer", analyzerFamily: "star" },
    tree_flat: { modelName: "TreeFlat", modelType: "tree_flat", geometryProfile: "tree_flat_single_layer", analyzerFamily: "tree" }
  }
};

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "xld-layer-exec-"));
}

test("execution scaffold writes checkpoints and retention ledger without observations", () => {
  const runRoot = tempDir();
  const plan = buildLayerCompositionTrainingPlan({ modelCatalog, runId: "scaffold-run", runType: "smoke" });
  const planPath = path.join(runRoot, "training-plan.json");
  fs.writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`);

  const summary = buildLayerCompositionExecutionScaffold({ plan, planPath, runRoot });
  const expectedPassCount = plan.experiments.reduce((total, experiment) => total + experiment.passes.length, 0);

  assert.equal(summary.ok, true);
  assert.equal(summary.status, "scaffolded_pending_apply_render");
  assert.equal(summary.passCount, expectedPassCount);
  assert.equal(summary.observationCount, 0);
  assert.equal(summary.deltaCount, 0);
  assert.equal(fs.existsSync(path.join(runRoot, "execution-summary.json")), true);
  assert.equal(fs.existsSync(path.join(runRoot, "retention-ledger.json")), true);

  const ledger = JSON.parse(fs.readFileSync(path.join(runRoot, "retention-ledger.json"), "utf8"));
  assert.equal(ledger.artifactType, "layer_composition_retention_ledger_v1");
  assert.equal(
    ledger.artifacts.every((row) => row.artifactClass === "checkpoint" || row.artifactClass === "training_plan" || row.artifactClass === "run_summary"),
    true
  );

  const checkpoints = JSON.parse(fs.readFileSync(path.join(runRoot, "checkpoints.json"), "utf8"));
  assert.equal(checkpoints.checkpointCount, expectedPassCount);
  assert.equal(checkpoints.checkpoints.every((row) => row.status === "pending_apply_render"), true);
  assert.equal(checkpoints.checkpoints.every((row) => fs.existsSync(row.passExecutionRef)), true);
  assert.equal(checkpoints.checkpoints.every((row) => fs.existsSync(row.ownedBatchPayloadRef)), true);
  assert.equal(checkpoints.checkpoints.every((row) => fs.existsSync(row.directCommandsRef)), true);

  const firstExecution = JSON.parse(fs.readFileSync(checkpoints.checkpoints[0].passExecutionRef, "utf8"));
  assert.equal(firstExecution.artifactType, "layer_composition_pass_execution_v1");
  assert.equal(firstExecution.ownedBatchPayload.track, "XD: Layer Composition Training");
});

test("execution scaffold rejects invalid plans", () => {
  const runRoot = tempDir();
  const summary = buildLayerCompositionExecutionScaffold({
    plan: { artifactType: "wrong" },
    runRoot
  });

  assert.equal(summary.ok, false);
  assert.equal(summary.status, "invalid_plan");
  assert.equal(summary.validationErrors.length > 0, true);
});

test("execution scaffold append mode preserves existing checkpoints and adds only new pass keys", () => {
  const runRoot = tempDir();
  const plan = buildLayerCompositionTrainingPlan({ modelCatalog, runId: "scaffold-run", runType: "smoke" });
  const planPath = path.join(runRoot, "training-plan.json");
  fs.writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`);

  const initial = buildLayerCompositionExecutionScaffold({ plan, planPath, runRoot });
  const expectedPassCount = plan.experiments.reduce((total, experiment) => total + experiment.passes.length, 0);
  const duplicateAppend = buildLayerCompositionExecutionScaffold({ plan, planPath, runRoot, append: true, mode: "adaptive_refill" });

  assert.equal(initial.passCount, expectedPassCount);
  assert.equal(duplicateAppend.appendedCheckpointCount, 0);
  assert.equal(duplicateAppend.passCount, expectedPassCount);

  const refillPlan = JSON.parse(JSON.stringify(plan));
  refillPlan.experiments = [refillPlan.experiments[0]];
  refillPlan.experiments[0].experimentId = `${refillPlan.experiments[0].experimentId}-refill-001`;
  refillPlan.experiments[0].passes = [refillPlan.experiments[0].passes[0]];
  refillPlan.experiments[0].passes[0].passId = `${refillPlan.experiments[0].passes[0].passId}_refill_001`;
  refillPlan.experiments[0].passes[0].learningSeed.learningId = `${refillPlan.experiments[0].passes[0].learningSeed.learningId}:refill:001`;
  const appended = buildLayerCompositionExecutionScaffold({ plan: refillPlan, planPath, runRoot, append: true, mode: "adaptive_refill" });

  assert.equal(appended.status, "appended_pending_apply_render");
  assert.equal(appended.appendedCheckpointCount, 1);
  assert.equal(appended.passCount, expectedPassCount + 1);
  const checkpoints = JSON.parse(fs.readFileSync(path.join(runRoot, "checkpoints.json"), "utf8"));
  assert.equal(checkpoints.checkpointCount, expectedPassCount + 1);
  assert.equal(
    checkpoints.checkpoints.some((row) => row.experimentId.endsWith("-refill-001") && row.passId.endsWith("_refill_001")),
    true
  );
});
