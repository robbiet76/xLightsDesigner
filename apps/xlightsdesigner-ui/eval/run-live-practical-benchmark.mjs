import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";

function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function nowIso() {
  return new Date().toISOString();
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveRepoRoot() {
  return path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..", "..");
}

function parseArgs(argv = []) {
  const options = {
    channel: "dev",
    outDir: "/tmp/live-practical-benchmark-phase2",
    pretty: true,
    suitePath: "",
    workingShowRoot: process.env.XLD_EVAL_SHOW_ROOT || "/Users/robterry/Desktop/Show"
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = str(argv[index]);
    if (token === "--channel") {
      options.channel = str(argv[index + 1] || "dev") || "dev";
      index += 1;
    } else if (token === "--out-dir") {
      options.outDir = str(argv[index + 1] || options.outDir) || options.outDir;
      index += 1;
    } else if (token === "--suite") {
      options.suitePath = str(argv[index + 1] || "");
      index += 1;
    } else if (token === "--working-show-root") {
      options.workingShowRoot = str(argv[index + 1] || options.workingShowRoot) || options.workingShowRoot;
      index += 1;
    } else if (token === "--compact") {
      options.pretty = false;
    } else if (token === "--pretty") {
      options.pretty = true;
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }
  if (![
    "dev",
    "packaged"
  ].includes(options.channel)) {
    throw new Error(`Unsupported channel: ${options.channel}`);
  }
  return options;
}

function runCommand(cmd, args, { cwd }) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += String(chunk || ""); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk || ""); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || stdout.trim() || `${cmd} exited with code ${code}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function runAutomation(repoRoot, channel, resultPath, command, args = []) {
  const script = path.join(repoRoot, "scripts", "desktop", "automation.mjs");
  const commandArgs = [script, "--channel", channel, "--result-file", resultPath, command, ...args];
  await runCommand("node", commandArgs, { cwd: repoRoot });
  return readJson(resultPath);
}

async function waitForXLightsReady({ repoRoot, channel, outDir, prefix, timeoutMs = 60000, intervalMs = 1500 } = {}) {
  return waitFor(async () => {
    const snapshot = await runAutomation(
      repoRoot,
      channel,
      path.join(outDir, `${prefix}-health.json`),
      "get-automation-health-snapshot"
    );
    const xlights = snapshot?.result?.xlights || {};
    const runtimeState = str(xlights?.runtimeState).toLowerCase();
    return {
      ok: runtimeState === "ready",
      snapshot
    };
  }, { timeoutMs, intervalMs });
}

async function runDirectProposalGenerator(repoRoot, {
  projectFilePath = "",
  prompt = "",
  selectedSections = [],
  selectedTargetIds = []
} = {}) {
  const script = path.join(repoRoot, "scripts", "sequencing", "native", "generate-native-direct-proposal.mjs");
  const commandArgs = [script, "--project-file", projectFilePath, "--prompt", prompt];
  for (const section of arr(selectedSections).map((row) => str(row)).filter(Boolean)) {
    commandArgs.push("--selected-section", section);
  }
  for (const targetId of arr(selectedTargetIds).map((row) => str(row)).filter(Boolean)) {
    commandArgs.push("--selected-target", targetId);
  }
  const { stdout } = await runCommand("node", commandArgs, { cwd: repoRoot });
  return JSON.parse(stdout);
}

async function waitFor(fn, { timeoutMs = 60000, intervalMs = 1000 } = {}) {
  const startedAt = Date.now();
  let lastValue = null;
  while ((Date.now() - startedAt) < timeoutMs) {
    lastValue = await fn();
    if (lastValue?.ok) return lastValue;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return lastValue;
}

function buildSuiteCatalog(repoRoot, explicitSuitePath = "") {
  if (explicitSuitePath) {
    return [{
      key: path.basename(explicitSuitePath, path.extname(explicitSuitePath)),
      suitePath: path.resolve(repoRoot, explicitSuitePath)
    }];
  }
  const evalDir = path.join(repoRoot, "apps", "xlightsdesigner-ui", "eval");
  return [
    {
      key: "section_canary",
      suitePath: path.join(evalDir, "live-section-practical-sequence-validation-canary-v1.json")
    },
    {
      key: "section",
      suitePath: path.join(evalDir, "live-section-practical-sequence-validation-suite-v2.json")
    }
  ];
}


function resolveScenarioId(scenario = {}, fallback = "scenario") {
  return str(scenario?.scenarioId || scenario?.name || fallback);
}

function resolveScenarioLabel(scenario = {}, fallback = "") {
  return str(scenario?.scenarioLabel || scenario?.name || scenario?.scenarioId || fallback);
}

function buildWorkingSequencePath(workingShowRoot, suiteKey, scenarioName, baselinePath, sourcePath) {
  const ext = path.extname(str(sourcePath) || str(baselinePath) || ".xsq") || ".xsq";
  const baseName = `${suiteKey}-${scenarioName}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "scenario";
  return path.join(path.resolve(workingShowRoot), "__xld_eval", `${baseName}${ext}`);
}

function resolveWorkingSequence({ suite, scenario, workingShowRoot }) {
  const baselinePath = str(scenario?.baselineSequencePath || suite?.baselineSequencePath || scenario?.sequencePath);
  if (!baselinePath) throw new Error(`Scenario ${resolveScenarioId(scenario)} is missing baselineSequencePath/sequencePath.`);
  const workingSequencePath = buildWorkingSequencePath(workingShowRoot, str(suite?.name || suite?.key || "suite"), resolveScenarioId(scenario), baselinePath, str(scenario?.sequencePath));
  return { baselinePath, workingSequencePath };
}

function copyWorkingSequence({ baselinePath, workingSequencePath }) {
  fs.mkdirSync(path.dirname(workingSequencePath), { recursive: true });
  fs.copyFileSync(baselinePath, workingSequencePath);
  return { baselinePath, workingSequencePath };
}

function buildProjectClonePath(baseProjectFilePath, suiteKey, scenarioName) {
  const projectBaseName = path.basename(baseProjectFilePath, path.extname(baseProjectFilePath));
  const projectStem = projectBaseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24) || "project";
  const scenarioStem = `${suiteKey}-${scenarioName}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32) || "scenario";
  const suffix = crypto
    .createHash("sha1")
    .update(`${baseProjectFilePath}::${suiteKey}::${scenarioName}`)
    .digest("hex")
    .slice(0, 10);
  const cloneName = `${projectStem}-${scenarioStem}-${suffix}`;
  const cloneRoot = path.join("/tmp", "xld_eval_projects", cloneName);
  return {
    cloneRoot,
    cloneProjectFilePath: path.join(cloneRoot, `${cloneName}.xdproj`)
  };
}

function cloneProjectForScenario(baseProjectFilePath, suiteKey, scenarioName) {
  const { cloneRoot, cloneProjectFilePath } = buildProjectClonePath(baseProjectFilePath, suiteKey, scenarioName);
  fs.rmSync(cloneRoot, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(cloneRoot), { recursive: true });
  fs.cpSync(path.dirname(baseProjectFilePath), cloneRoot, { recursive: true });
  const originalProjectFilePath = path.join(cloneRoot, path.basename(baseProjectFilePath));
  if (originalProjectFilePath !== cloneProjectFilePath && fs.existsSync(originalProjectFilePath)) {
    fs.renameSync(originalProjectFilePath, cloneProjectFilePath);
  }
  const artifactRoot = path.join(cloneRoot, "artifacts");
  const removableArtifactDirs = [
    "apply-results",
    "plans",
    "proposals",
    "intent-handoffs",
    "analysis",
    "music-context",
    "briefs",
    "design-scene"
  ];
  for (const relative of removableArtifactDirs) {
    fs.rmSync(path.join(artifactRoot, relative), { recursive: true, force: true });
  }
  fs.rmSync(path.join(cloneRoot, "history"), { recursive: true, force: true });
  fs.rmSync(path.join(cloneRoot, "assistant"), { recursive: true, force: true });
  if (fs.existsSync(cloneProjectFilePath)) {
    const project = JSON.parse(fs.readFileSync(cloneProjectFilePath, "utf8"));
    const snapshot = { ...(project.snapshot || {}) };
    snapshot.sequencePathInput = "";
    snapshot.recentSequences = [];
    delete snapshot.sequenceAgentRuntime;
    project.snapshot = snapshot;
    fs.writeFileSync(cloneProjectFilePath, `${JSON.stringify(project, null, 2)}\n`, "utf8");
  }
  return { cloneRoot, cloneProjectFilePath };
}

function writeCloneSequencePathInput(cloneProjectFilePath, workingSequencePath) {
  if (!fs.existsSync(cloneProjectFilePath)) return;
  const project = JSON.parse(fs.readFileSync(cloneProjectFilePath, "utf8"));
  const snapshot = { ...(project.snapshot || {}) };
  snapshot.sequencePathInput = workingSequencePath;
  snapshot.recentSequences = [workingSequencePath];
  project.snapshot = snapshot;
  fs.writeFileSync(cloneProjectFilePath, `${JSON.stringify(project, null, 2)}\n`, "utf8");
}

function summarizePlan(plan = {}) {
  const commands = arr(plan?.commands);
  const effectCreates = commands
    .filter((row) => str(row?.cmd) === "effects.create")
    .map((row) => ({
      effectName: str(row?.params?.effectName),
      modelName: str(row?.params?.modelName),
      startMs: Number(row?.params?.startMs || 0),
      endMs: Number(row?.params?.endMs || 0)
    }));
  return {
    effectCreates,
    effectNames: [...new Set(effectCreates.map((row) => row.effectName).filter(Boolean))],
    modelNames: [...new Set(effectCreates.map((row) => row.modelName).filter(Boolean))]
  };
}

function collectTranslationBehaviorSignals(translationIntent = {}) {
  const behaviorTargets = arr(translationIntent?.behaviorTargets);
  const targetRoles = arr(translationIntent?.targetRoles);
  const sectionRoles = arr(translationIntent?.sectionRoles);
  return {
    primaryMotion: [...new Set(behaviorTargets.map((row) => str(row?.motion?.primaryMotion)).filter(Boolean))],
    primaryTexture: [...new Set(behaviorTargets.map((row) => str(row?.texture?.primaryTexture)).filter(Boolean))],
    energyLevel: [...new Set(behaviorTargets.map((row) => str(row?.energy?.energyLevel)).filter(Boolean))],
    coverageLevel: [...new Set(behaviorTargets.map((row) => str(row?.coverage?.coverageLevel)).filter(Boolean))],
    transitionCharacter: [...new Set(behaviorTargets.flatMap((row) => [str(row?.transitions?.entryCharacter), str(row?.transitions?.exitCharacter)]).filter(Boolean))],
    targetRole: [...new Set(targetRoles.map((row) => str(row?.role)).filter(Boolean))],
    sectionRole: [...new Set(sectionRoles.map((row) => str(row?.role)).filter(Boolean))]
  };
}

function evaluateBehaviorAssertions({ scenario = {}, translationIntent = {} } = {}) {
  const actualSignals = collectTranslationBehaviorSignals(translationIntent);
  const expectedBehaviors = scenario?.expectedBehaviors && typeof scenario.expectedBehaviors === "object" ? scenario.expectedBehaviors : {};
  const contradictoryBehaviors = scenario?.contradictoryBehaviors && typeof scenario.contradictoryBehaviors === "object" ? scenario.contradictoryBehaviors : {};
  const matched = {};
  const missing = {};
  const contradictory = {};
  const issues = [];

  for (const [dimension, expectedValues] of Object.entries(expectedBehaviors)) {
    const expected = arr(expectedValues).map((row) => str(row)).filter(Boolean);
    const actual = arr(actualSignals?.[dimension]).map((row) => str(row)).filter(Boolean);
    const overlap = actual.filter((row) => expected.includes(row));
    matched[dimension] = overlap;
    if (expected.length && !overlap.length) {
      missing[dimension] = { expected, actual };
      issues.push(`expected_behavior_missing:${dimension}`);
    }
  }

  for (const [dimension, forbiddenValues] of Object.entries(contradictoryBehaviors)) {
    const forbidden = arr(forbiddenValues).map((row) => str(row)).filter(Boolean);
    const actual = arr(actualSignals?.[dimension]).map((row) => str(row)).filter(Boolean);
    const overlap = actual.filter((row) => forbidden.includes(row));
    contradictory[dimension] = overlap;
    if (overlap.length) {
      issues.push(`contradictory_behavior_present:${dimension}`);
    }
  }

  return {
    actualSignals,
    expectedBehaviors,
    contradictoryBehaviors,
    matched,
    missing,
    contradictory,
    issues
  };
}

function buildBenchmarkPrompt(scenario = {}) {
  const basePrompt = str(scenario?.prompt || scenario?.strongPrompt || scenario?.revisionPrompt);
  const benchmarkDirective = "Use defaults where needed. Do not ask follow-up questions. Do not answer with a concept summary. Materialize an apply-ready sequencing plan and command handoff now.";
  return [basePrompt, benchmarkDirective].filter(Boolean).join(" ");
}

function buildSelectedSections(scenario = {}) {
  return [
    ...arr(scenario?.sections),
    ...arr(scenario?.selectedSections),
    str(scenario?.sectionName)
  ].map((row) => str(row)).filter(Boolean);
}

function buildSelectedTargetIds(scenario = {}) {
  return [
    ...arr(scenario?.primaryFocusTargetIds),
    ...arr(scenario?.requiredObservedTargets),
    ...arr(scenario?.targets)
  ].map((row) => str(row)).filter(Boolean).filter((row, index, rows) => rows.indexOf(row) === index);
}

function evaluateScenario({ suiteKey, scenario, promptSnapshot, applySnapshot, workingSequencePath }) {
  const latestPlan = promptSnapshot?.result?.latestPlanHandoff || applySnapshot?.result?.latestPlanHandoff || null;
  const latestApplyResult = applySnapshot?.result?.latestApplyResult || null;
  const latestGuidanceCoverage = promptSnapshot?.result?.latestGuidanceCoverage || null;
  const latestIntentHandoff = promptSnapshot?.result?.latestIntentHandoff || applySnapshot?.result?.latestIntentHandoff || null;
  const translationIntent = latestIntentHandoff?.executionStrategy?.translationIntent || null;
  const behaviorEvaluation = evaluateBehaviorAssertions({ scenario, translationIntent });
  const planSummary = summarizePlan(latestPlan);
  const expectedEffects = arr(scenario?.expectedEffects).map((row) => str(row)).filter(Boolean);
  const forbiddenEffects = arr(scenario?.forbiddenEffects).map((row) => str(row)).filter(Boolean);
  const requiredTargets = arr(scenario?.requiredObservedTargets || scenario?.targets).map((row) => str(row)).filter(Boolean);
  const matchedEffects = planSummary.effectNames.filter((name) => expectedEffects.includes(name));
  const presentForbiddenEffects = planSummary.effectNames.filter((name) => forbiddenEffects.includes(name));
  const matchedTargets = planSummary.modelNames.filter((name) => requiredTargets.includes(name));
  const minimumMatchedEffects = Number(scenario?.minimumMatchedEffects || (expectedEffects.length ? 1 : 0));
  const requireEffectCreateCommands = scenario?.requireEffectCreateCommands === true;
  const issues = [];
  if (!latestPlan) issues.push("missing_plan_handoff");
  if (!latestApplyResult) issues.push("missing_apply_result");
  if (expectedEffects.length && matchedEffects.length < minimumMatchedEffects) issues.push("expected_effect_missing");
  if (presentForbiddenEffects.length) issues.push("forbidden_effect_present");
  if (requiredTargets.length && !matchedTargets.length) issues.push("required_target_missing");
  if (requireEffectCreateCommands && Number(latestGuidanceCoverage?.effectCreateCount || 0) <= 0) issues.push("no_effect_create_commands");
  issues.push(...behaviorEvaluation.issues);
  return {
    suiteKey,
    scenarioId: resolveScenarioId(scenario),
    scenarioLabel: resolveScenarioLabel(scenario),
    workingSequencePath,
    expectedEffects,
    forbiddenEffects,
    requiredTargets,
    matchedEffects,
    presentForbiddenEffects,
    matchedTargets,
    guidanceCoverage: latestGuidanceCoverage,
    translationIntentSummary: translationIntent
      ? {
          artifactType: str(translationIntent?.artifactType),
          artifactId: str(translationIntent?.artifactId),
          behaviorTargets: arr(translationIntent?.behaviorTargets),
          targetRoles: arr(translationIntent?.targetRoles),
          sectionRoles: arr(translationIntent?.sectionRoles)
        }
      : null,
    behaviorEvaluation,
    renderFeedbackCapabilities: promptSnapshot?.result?.ownedRenderFeedbackCapabilities || null,
    latestPlanSummary: latestPlan
      ? {
          artifactId: str(latestPlan?.artifactId),
          planId: str(latestPlan?.planId),
          summary: str(latestPlan?.summary),
          executionLines: arr(latestPlan?.executionLines),
          warnings: arr(latestPlan?.warnings),
          stageTelemetry: arr(latestPlan?.stageTelemetry)
        }
      : null,
    latestApplyResult,
    reviewHistorySnapshotAvailable: applySnapshot?.result?.reviewHistorySnapshotAvailable === true,
    ok: issues.length === 0,
    issues
  };
}

async function runScenario({ repoRoot, channel, outDir, suiteKey, suite, scenario, baseProjectFilePath }) {
  const prefix = `${suiteKey}-${resolveScenarioId(scenario) || "scenario"}`.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const { workingSequencePath, baselinePath } = resolveWorkingSequence({
    suite: { ...suite, key: suiteKey },
    scenario,
    workingShowRoot: suite?.workingShowRoot
  });
  const initialHealthSnapshot = await runAutomation(
    repoRoot,
    channel,
    path.join(outDir, `${prefix}-initial-health.json`),
    "get-automation-health-snapshot"
  );
  const initialXLights = initialHealthSnapshot?.result?.xlights || {};
  const reuseOpenSequence =
    str(initialXLights?.runtimeState).toLowerCase() === "ready"
    && initialXLights?.projectShowMatches === true
    && str(initialXLights?.sequencePath) === workingSequencePath;
  if (!reuseOpenSequence) {
    copyWorkingSequence({ baselinePath, workingSequencePath });
  }
  const { cloneProjectFilePath } = cloneProjectForScenario(baseProjectFilePath, suiteKey, resolveScenarioId(scenario, "scenario"));
  writeCloneSequencePathInput(cloneProjectFilePath, workingSequencePath);
  await runAutomation(repoRoot, channel, path.join(outDir, `${prefix}-open-project.json`), "open-project", [cloneProjectFilePath]);
  const beforeSnapshot = await runAutomation(repoRoot, channel, path.join(outDir, `${prefix}-before.json`), "get-sequencer-validation-snapshot");
  const previousPlanArtifactId = str(beforeSnapshot?.result?.latestPlanHandoff?.artifactId);
  const previousApplyArtifactId = str(beforeSnapshot?.result?.latestApplyResult?.artifactId);
  await runAutomation(repoRoot, channel, path.join(outDir, `${prefix}-workflow-sequence.json`), "select-workflow", ["Sequence"]);
  if (!reuseOpenSequence) {
    const xlightsReadyBeforeOpen = await waitForXLightsReady({ repoRoot, channel, outDir, prefix: `${prefix}-pre-open` });
    if (!xlightsReadyBeforeOpen?.ok) {
      return {
        suiteKey,
        scenarioId: resolveScenarioId(scenario),
        scenarioLabel: resolveScenarioLabel(scenario),
        workingSequencePath,
        clonedProjectFilePath: cloneProjectFilePath,
        baselinePath,
        ok: false,
        issues: ["xlights_not_ready_for_open"],
        healthSnapshot: xlightsReadyBeforeOpen?.snapshot?.result || null
      };
    }

    const openPayloadPath = path.join(outDir, `${prefix}-open-payload.json`);
    fs.writeFileSync(
      openPayloadPath,
      `${JSON.stringify({ sequencePath: workingSequencePath, saveBeforeSwitch: false }, null, 2)}\n`,
      "utf8"
    );
    try {
      await runAutomation(repoRoot, channel, path.join(outDir, `${prefix}-open.json`), "open-sequence", ["--payload-file", openPayloadPath]);
    } catch (error) {
      return {
        suiteKey,
        scenarioId: resolveScenarioId(scenario),
        scenarioLabel: resolveScenarioLabel(scenario),
        workingSequencePath,
        clonedProjectFilePath: cloneProjectFilePath,
        baselinePath,
        ok: false,
        issues: ["xlights_open_failed"],
        openError: str(error?.message)
      };
    }
  }
  await runAutomation(repoRoot, channel, path.join(outDir, `${prefix}-reset-assistant-memory.json`), "reset-assistant-memory");
  await runAutomation(repoRoot, channel, path.join(outDir, `${prefix}-workflow-sequence-post-reset.json`), "select-workflow", ["Sequence"]);
  const promptText = buildBenchmarkPrompt(scenario);
  const directProposalResult = await runDirectProposalGenerator(repoRoot, {
    projectFilePath: cloneProjectFilePath,
    prompt: promptText,
    selectedSections: buildSelectedSections(scenario),
    selectedTargetIds: buildSelectedTargetIds(scenario)
  });
  fs.writeFileSync(
    path.join(outDir, `${prefix}-direct-proposal.json`),
    `${JSON.stringify(directProposalResult, null, 2)}\n`,
    "utf8"
  );
  await runAutomation(repoRoot, channel, path.join(outDir, `${prefix}-reload-project.json`), "open-project", [cloneProjectFilePath]);
  await runAutomation(repoRoot, channel, path.join(outDir, `${prefix}-workflow-sequence-post-proposal.json`), "select-workflow", ["Sequence"]);

  const promptReady = await waitFor(async () => {
    const pageStates = await runAutomation(repoRoot, channel, path.join(outDir, `${prefix}-page-states.json`), "get-page-states-snapshot");
    const sequencerSnapshot = await runAutomation(repoRoot, channel, path.join(outDir, `${prefix}-sequencer-after-prompt.json`), "get-sequencer-validation-snapshot");
    const reviewPage = pageStates?.result?.pages?.review || {};
    const latestIntentArtifactId = str(sequencerSnapshot?.result?.latestIntentHandoff?.artifactId);
    const pendingSummary = str(reviewPage?.pendingSummary);
    return {
      ok: reviewPage?.canApply === true
        && !!latestIntentArtifactId
        && pendingSummary !== "No proposal bundle available."
        && latestIntentArtifactId !== str(beforeSnapshot?.result?.latestIntentHandoff?.artifactId),
      pageStates,
      sequencerSnapshot
    };
  }, { timeoutMs: 90000, intervalMs: 1500 });

  if (!promptReady?.ok) {
    return {
      suiteKey,
      scenarioId: resolveScenarioId(scenario),
      scenarioLabel: resolveScenarioLabel(scenario),
      workingSequencePath,
      clonedProjectFilePath: cloneProjectFilePath,
      baselinePath,
      ok: false,
      issues: ["review_never_became_applicable"],
      promptSnapshot: promptReady?.sequencerSnapshot?.result || null
    };
  }

  const promptSnapshot = promptReady.sequencerSnapshot;
  const xlightsReadyBeforeApply = await waitForXLightsReady({ repoRoot, channel, outDir, prefix: `${prefix}-pre-apply` });
  if (!xlightsReadyBeforeApply?.ok) {
    return {
      suiteKey,
      scenarioId: resolveScenarioId(scenario),
      scenarioLabel: resolveScenarioLabel(scenario),
      workingSequencePath,
      clonedProjectFilePath: cloneProjectFilePath,
      baselinePath,
      ok: false,
      issues: ["xlights_not_ready_for_apply"],
      promptSnapshot: promptSnapshot?.result || null,
      healthSnapshot: xlightsReadyBeforeApply?.snapshot?.result || null
    };
  }
  await runAutomation(repoRoot, channel, path.join(outDir, `${prefix}-apply.json`), "apply-current-proposal");

  const applyReady = await waitFor(async () => {
    const pageStates = await runAutomation(repoRoot, channel, path.join(outDir, `${prefix}-page-states-after-apply.json`), "get-page-states-snapshot");
    const sequencerSnapshot = await runAutomation(repoRoot, channel, path.join(outDir, `${prefix}-sequencer-after-apply.json`), "get-sequencer-validation-snapshot");
    const latestApplyArtifactId = str(sequencerSnapshot?.result?.latestApplyResult?.artifactId);
    const latestApplyPlanId = str(sequencerSnapshot?.result?.latestApplyResult?.planId);
    const latestApplyCurrentRevision = str(sequencerSnapshot?.result?.latestApplyResult?.currentRevision);
    const latestApplyNextRevision = str(sequencerSnapshot?.result?.latestApplyResult?.nextRevision);
    const latestPlanArtifactId = str(sequencerSnapshot?.result?.latestPlanHandoff?.artifactId);
    const latestPlanBaseRevision = str(sequencerSnapshot?.result?.latestPlanHandoff?.baseRevision);
    return {
      ok: !!latestApplyArtifactId
        && latestApplyArtifactId !== previousApplyArtifactId
        && !!latestPlanArtifactId
        && latestApplyPlanId === latestPlanArtifactId
        && latestPlanArtifactId !== previousPlanArtifactId
        && latestPlanBaseRevision.startsWith(workingSequencePath)
        && (latestApplyCurrentRevision.startsWith(workingSequencePath) || latestApplyNextRevision.startsWith(workingSequencePath)),
      pageStates,
      sequencerSnapshot
    };
  }, { timeoutMs: 90000, intervalMs: 1500 });

  if (!applyReady?.ok) {
    return {
      suiteKey,
      scenarioId: resolveScenarioId(scenario),
      scenarioLabel: resolveScenarioLabel(scenario),
      workingSequencePath,
      clonedProjectFilePath: cloneProjectFilePath,
      baselinePath,
      ok: false,
      issues: ["apply_never_completed"],
      promptSnapshot: promptSnapshot?.result || null,
      applySnapshot: applyReady?.sequencerSnapshot?.result || null
    };
  }

  return evaluateScenario({
    suiteKey,
    scenario,
    promptSnapshot,
    applySnapshot: applyReady.sequencerSnapshot,
    workingSequencePath
  });
}

export { collectTranslationBehaviorSignals, evaluateBehaviorAssertions, evaluateScenario };

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const repoRoot = resolveRepoRoot();
  const outDir = path.resolve(options.outDir);
  fs.mkdirSync(outDir, { recursive: true });

  const suites = buildSuiteCatalog(repoRoot, options.suitePath).map((entry) => ({
    ...entry,
    suite: readJson(entry.suitePath),
    workingShowRoot: path.resolve(options.workingShowRoot)
  }));
  const startedAt = Date.now();
  const initialSnapshot = await runAutomation(repoRoot, options.channel, path.join(outDir, "00-preflight-sequencer-validation.json"), "get-sequencer-validation-snapshot");
  const originalProjectFilePath = str(initialSnapshot?.result?.status?.projectFilePath || initialSnapshot?.result?.activeProjectFilePath);
  if (!originalProjectFilePath) {
    throw new Error("Native benchmark requires an active project file path.");
  }

  const results = [];
  try {
    for (const entry of suites) {
      for (const scenario of arr(entry.suite?.scenarios)) {
        results.push(await runScenario({
          repoRoot,
          channel: options.channel,
          outDir,
          suiteKey: entry.key,
          suite: { ...entry.suite, workingShowRoot: entry.workingShowRoot },
          scenario,
          baseProjectFilePath: originalProjectFilePath
        }));
      }
    }
  } finally {
    await runAutomation(repoRoot, options.channel, path.join(outDir, "99-restore-project.json"), "open-project", [originalProjectFilePath]);
  }

  const failed = results.filter((row) => row.ok !== true);
  const report = {
    artifactType: "live_practical_benchmark_run_v2",
    artifactVersion: "2.0",
    createdAt: nowIso(),
    channel: options.channel,
    outDir,
    workingShowRoot: path.resolve(options.workingShowRoot),
    totalDurationMs: Date.now() - startedAt,
    ok: failed.length === 0,
    failedScenarioCount: failed.length,
    failedScenarioIds: failed.map((row) => row.scenarioId),
    failedScenarioLabels: failed.map((row) => row.scenarioLabel),
    supportedSurface: {
      transport: "native_http",
      benchmarkMode: "plan_apply_validation_only",
      renderFeedbackCapabilities: initialSnapshot?.result?.ownedRenderFeedbackCapabilities || null
    },
    scenarioCount: results.length,
    results
  };

  const reportPath = path.join(outDir, "live-practical-benchmark-report.json");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(report, null, options.pretty ? 2 : 0)}\n`);
  if (!report.ok) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
