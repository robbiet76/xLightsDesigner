import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildLayerCompositionPassExecution } from "./build-layer-composition-pass-execution.mjs";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function now() {
  return new Date().toISOString();
}

function passDirName(experimentId, passId) {
  return `${experimentId}__${passId}`.replace(/[^a-zA-Z0-9_.-]+/g, "_");
}

function checkpointKey(row = {}) {
  return `${row.experimentId || ""}::${row.passId || ""}`;
}

function flattenPasses(plan = {}) {
  const rows = [];
  for (const experiment of arr(plan.experiments)) {
    for (const pass of arr(experiment.passes)) {
      rows.push({
        experimentId: experiment.experimentId,
        family: experiment.family,
        paletteProfile: experiment.paletteProfile,
        coverageKey: experiment.coverageKey,
        passId: pass.passId,
        compositionPass: pass.compositionPass,
        changeType: pass.changeType || "",
        comparisonBasePassId: pass.comparisonBasePassId || "",
        learningSeed: pass.learningSeed || null,
        placementCount: arr(pass.placements).length,
        displayElementOrder: arr(pass.displayElementOrder),
        placements: arr(pass.placements)
      });
    }
  }
  return rows;
}

function validatePlan(plan = {}) {
  const errors = [];
  if (plan.artifactType !== "layer_composition_experiment_manifest_v1") {
    errors.push("plan artifactType must be layer_composition_experiment_manifest_v1");
  }
  if (!arr(plan.experiments).length) errors.push("plan has no experiments");
  const passes = flattenPasses(plan);
  if (!passes.length) errors.push("plan has no passes");
  for (const row of passes) {
    if (!row.experimentId) errors.push(`pass ${row.passId || "unknown"} has no experimentId`);
    if (!row.passId) errors.push(`experiment ${row.experimentId || "unknown"} has pass without passId`);
    if (!row.learningSeed?.learningId) errors.push(`${row.experimentId}/${row.passId} has no learningId`);
    if (!row.learningSeed?.coverageKey) errors.push(`${row.experimentId}/${row.passId} has no coverageKey`);
  }
  return errors;
}

function buildArtifactRows({ runRoot, planPath, summaryPath, checkpointPath }) {
  return [
    {
      path: planPath,
      artifactClass: "training_plan",
      summarized: true,
      retain: true
    },
    {
      path: summaryPath,
      artifactClass: "run_summary",
      summarized: true,
      retain: true
    },
    {
      path: checkpointPath,
      artifactClass: "checkpoint",
      summarized: true,
      retain: true
    }
  ].map((row) => ({ ...row, runRoot }));
}

export function buildLayerCompositionExecutionScaffold({
  plan,
  planPath = "",
  runRoot,
  mode = "scaffold",
  append = false
} = {}) {
  const resolvedRunRoot = path.resolve(runRoot || "");
  if (!resolvedRunRoot) throw new Error("runRoot is required");
  const validationErrors = validatePlan(plan);
  if (validationErrors.length) {
    return {
      artifactType: "layer_composition_execution_scaffold_v1",
      artifactVersion: 1,
      generatedAt: now(),
      runRoot: resolvedRunRoot,
      planRef: planPath ? path.resolve(planPath) : "",
      mode,
      ok: false,
      status: "invalid_plan",
      validationErrors
    };
  }

  const passes = flattenPasses(plan);
  const checkpointBundlePath = path.join(resolvedRunRoot, "checkpoints.json");
  const summaryPath = path.join(resolvedRunRoot, "execution-summary.json");
  const retentionLedgerPath = path.join(resolvedRunRoot, "retention-ledger.json");
  const existingBundle = append && fs.existsSync(checkpointBundlePath)
    ? readJson(checkpointBundlePath)
    : null;
  const existingKeys = new Set(arr(existingBundle?.checkpoints).map(checkpointKey));
  const checkpoints = append ? arr(existingBundle?.checkpoints) : [];
  const appendedCheckpoints = [];
  const passRoot = path.join(resolvedRunRoot, "passes");
  for (const row of passes) {
    if (existingKeys.has(checkpointKey(row))) continue;
    const dir = path.join(passRoot, passDirName(row.experimentId, row.passId));
    const passPlanPath = path.join(dir, "pass-plan.json");
    const passExecutionPath = path.join(dir, "pass-execution.json");
    const ownedBatchPayloadPath = path.join(dir, "owned-batch-payload.json");
    const directCommandsPath = path.join(dir, "direct-commands.json");
    const checkpointPath = path.join(dir, "checkpoint.json");
    const passPlan = {
      artifactType: "layer_composition_pass_plan_v1",
      artifactVersion: 1,
      generatedAt: now(),
      runId: plan.runId,
      experimentId: row.experimentId,
      family: row.family,
      paletteProfile: row.paletteProfile,
      coverageKey: row.coverageKey,
      passId: row.passId,
      compositionPass: row.compositionPass,
      changeType: row.changeType,
      comparisonBasePassId: row.comparisonBasePassId,
      learningSeed: row.learningSeed,
      placementCount: row.placementCount,
      displayElementOrder: row.displayElementOrder,
      placements: row.placements,
      executionStatus: "pending_apply_render",
      executionNote: "Pass plan scaffolded only. Owned xLights apply/render is not wired in this tool."
    };
    const passExecution = buildLayerCompositionPassExecution({ plan, passPlan });
    const checkpoint = {
      artifactType: "layer_composition_pass_checkpoint_v1",
      artifactVersion: 1,
      updatedAt: now(),
      runId: plan.runId,
      experimentId: row.experimentId,
      passId: row.passId,
      status: "pending_apply_render",
      passExecutionRef: passExecutionPath,
      ownedBatchPayloadRef: ownedBatchPayloadPath,
      directCommandsRef: directCommandsPath,
      observationRef: "",
      deltaRefs: [],
      rawArtifactsSummarized: false,
      cleanupApplied: false
    };
    writeJson(passPlanPath, passPlan);
    writeJson(passExecutionPath, passExecution);
    writeJson(ownedBatchPayloadPath, passExecution.ownedBatchPayload);
    writeJson(directCommandsPath, {
      artifactType: "layer_composition_direct_commands_v1",
      artifactVersion: 1,
      runId: plan.runId,
      experimentId: row.experimentId,
      passId: row.passId,
      commands: passExecution.directCommands
    });
    writeJson(checkpointPath, checkpoint);
    const checkpointRow = {
      experimentId: row.experimentId,
      passId: row.passId,
      passPlanRef: passPlanPath,
      passExecutionRef: passExecutionPath,
      ownedBatchPayloadRef: ownedBatchPayloadPath,
      directCommandsRef: directCommandsPath,
      checkpointRef: checkpointPath,
      status: checkpoint.status
    };
    checkpoints.push(checkpointRow);
    appendedCheckpoints.push(checkpointRow);
  }

  const checkpointBundle = {
    artifactType: "layer_composition_checkpoint_bundle_v1",
    artifactVersion: 1,
    updatedAt: now(),
    runId: plan.runId,
    runRoot: resolvedRunRoot,
    checkpointCount: checkpoints.length,
    appendedCheckpointCount: appendedCheckpoints.length,
    checkpoints
  };
  writeJson(checkpointBundlePath, checkpointBundle);

  const summary = {
    artifactType: "layer_composition_execution_summary_v1",
    artifactVersion: 1,
    generatedAt: now(),
    runId: plan.runId,
    runType: plan.runType,
    runRoot: resolvedRunRoot,
    planRef: planPath ? path.resolve(planPath) : "",
    mode,
    status: append ? "appended_pending_apply_render" : "scaffolded_pending_apply_render",
    experimentCount: arr(plan.experiments).length,
    passCount: checkpoints.length,
    appendedPassCount: appendedCheckpoints.length,
    pendingApplyRenderCount: checkpoints.length,
    completedPassCount: 0,
    observationCount: 0,
    deltaCount: 0,
    retentionLedgerRef: retentionLedgerPath,
    checkpointBundleRef: checkpointBundlePath,
    nextStep: "Wire owned xLights apply/render for each pass, then write observations and deltas before cleanup."
  };
  writeJson(summaryPath, summary);

  const existingLedger = append && fs.existsSync(retentionLedgerPath)
    ? readJson(retentionLedgerPath)
    : null;
  const ledgerRows = [
    ...(!append ? buildArtifactRows({
      runRoot: resolvedRunRoot,
      planPath: planPath ? path.resolve(planPath) : "",
      summaryPath,
      checkpointPath: checkpointBundlePath
    }) : []),
    ...appendedCheckpoints.flatMap((row) => [
      {
        path: row.passPlanRef,
        artifactClass: "checkpoint",
        summarized: true,
        retain: true
      },
      {
        path: row.passExecutionRef,
        artifactClass: "checkpoint",
        summarized: true,
        retain: true
      },
      {
        path: row.ownedBatchPayloadRef,
        artifactClass: "checkpoint",
        summarized: true,
        retain: true
      },
      {
        path: row.directCommandsRef,
        artifactClass: "checkpoint",
        summarized: true,
        retain: true
      },
      {
        path: row.checkpointRef,
        artifactClass: "checkpoint",
        summarized: true,
        retain: true
      }
    ])
  ].filter((row) => row.path);
  const ledger = {
    artifactType: "layer_composition_retention_ledger_v1",
    artifactVersion: 1,
    generatedAt: existingLedger?.generatedAt || now(),
    updatedAt: now(),
    runId: plan.runId,
    runRoot: resolvedRunRoot,
    retentionPolicy: existingLedger?.retentionPolicy || plan.retentionPolicy || {},
    artifacts: [...arr(existingLedger?.artifacts), ...ledgerRows]
  };
  writeJson(retentionLedgerPath, ledger);

  return {
    ...summary,
    ok: true,
    appendedCheckpointCount: appendedCheckpoints.length
  };
}

function parseArgs(argv) {
  const args = {
    planPath: "",
    runRoot: "",
    mode: "scaffold",
    append: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--plan") {
      args.planPath = argv[++index];
    } else if (arg === "--run-root") {
      args.runRoot = argv[++index];
    } else if (arg === "--mode") {
      args.mode = argv[++index];
    } else if (arg === "--append") {
      args.append = true;
    } else if (arg === "--help") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/sequencer-render-training/tooling/run-layer-composition-execution-scaffold.mjs --plan <path> --run-root <path>

This creates pass plans, checkpoints, an execution summary, and a retention ledger.
It does not mutate xLights or write training observations.
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(usage());
    return;
  }
  if (!args.planPath) throw new Error("--plan is required");
  if (!args.runRoot) throw new Error("--run-root is required");
  const plan = readJson(args.planPath);
  const result = buildLayerCompositionExecutionScaffold({
    plan,
    planPath: args.planPath,
    runRoot: args.runRoot,
    mode: args.mode,
    append: args.append
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exit(1);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
