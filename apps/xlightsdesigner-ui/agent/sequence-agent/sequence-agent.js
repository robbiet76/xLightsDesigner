import { buildDesignerPlanCommands, collectGroupRenderPolicyWarnings, collectSubmodelRenderWarnings, estimateImpactCount } from "./command-builders.js";
import { SEQUENCE_AGENT_CONTRACT_VERSION, SEQUENCE_AGENT_PLAN_OUTPUT_CONTRACT, SEQUENCE_AGENT_ROLE } from "./sequence-agent-contracts.js";
import { evaluateSequencePlanCapabilities } from "./sequence-capability-gate.js";
import { evaluateEffectCommandCompatibility } from "./effect-compatibility.js";
import { buildArtifactId } from "../shared/artifact-ids.js";

const STAGE_ORDER = ["scope_resolution", "timing_asset_decision", "effect_strategy", "command_graph_synthesis"];

function nowMs() {
  return Date.now();
}

function normText(value = "") {
  return String(value || "").trim();
}

function normArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function normLayoutMode(value = "") {
  const key = String(value || "").trim().toLowerCase();
  return key === "3d" ? "3d" : "2d";
}

function classifyStageFailure(stage = "") {
  const key = String(stage || "").trim();
  if (key === "scope_resolution") return "scope";
  if (key === "timing_asset_decision") return "timing";
  if (key === "effect_strategy") return "strategy";
  if (key === "command_graph_synthesis") return "graph";
  return "unknown";
}

function buildPlanSummary({ goal = "", mode = "", sectionNames = [] } = {}) {
  const base = normText(goal) || "director intent";
  const sectionText = sectionNames.length ? ` across ${sectionNames.slice(0, 4).join(", ")}` : "";
  return `${mode || "create"} plan for ${base}${sectionText}`.trim();
}

function deriveSectionNames({ analysisHandoff = {}, intentHandoff = {} } = {}) {
  const fromAnalysis = normArray(analysisHandoff?.structure?.sections).map((s) => normText(s));
  const fromScope = normArray(intentHandoff?.scope?.sections).map((s) => normText(s));
  return fromScope.length ? fromScope : fromAnalysis;
}

function deriveSectionWindowsByName({ analysisHandoff = {}, sectionNames = [], includeAll = false } = {}) {
  const requested = includeAll ? new Set() : new Set(normArray(sectionNames).map((row) => normText(row)).filter(Boolean));
  const windows = new Map();
  const rows = Array.isArray(analysisHandoff?.structure?.sections) ? analysisHandoff.structure.sections : [];
  for (const row of rows) {
    const label = typeof row === "string"
      ? normText(row)
      : normText(row?.label || row?.name || "");
    if (!label) continue;
    if (requested.size && !requested.has(label)) continue;
    const startMs = Number(row?.startMs);
    const endMs = Number(row?.endMs);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) continue;
    windows.set(label, { startMs, endMs });
  }
  return windows;
}

function stageScopeResolution({ analysisHandoff = {}, intentHandoff = {} } = {}) {
  const mode = normText(intentHandoff?.mode) || "create";
  const goal = normText(intentHandoff?.goal);
  const sectionNames = deriveSectionNames({ analysisHandoff, intentHandoff });
  const targetIds = normArray(intentHandoff?.scope?.targetIds);
  const tagNames = normArray(intentHandoff?.scope?.tagNames);
  return {
    mode,
    goal,
    sectionNames,
    targetIds,
    tagNames,
    detail: `sections=${sectionNames.length || 0} targets=${targetIds.length || 0} tags=${tagNames.length || 0}`
  };
}

function stageTimingAssetDecision({ hasAnalysis = false, scope = {} } = {}) {
  const hasScopedSections = Array.isArray(scope.sectionNames) && scope.sectionNames.length > 0;
  const strategy = hasAnalysis ? "analysis_tracks" : (hasScopedSections ? "scope_only" : "minimal_fallback");
  return {
    strategy,
    degradedMode: !hasAnalysis,
    useSections: hasScopedSections,
    trackName: hasScopedSections ? "XD: Song Structure" : "XD: Sequencer Plan",
    detail: `strategy=${strategy}${!hasAnalysis ? " reduced-confidence" : ""}`
  };
}

function stageEffectStrategy({ scope = {}, analysisHandoff = {}, timing = {} } = {}) {
  const toneHint = normText(analysisHandoff?.briefSeed?.tone);
  const sectionText = Array.isArray(scope.sectionNames) && scope.sectionNames.length
    ? scope.sectionNames.slice(0, 8).join(", ")
    : "Global";
  const targetText = Array.isArray(scope.targetIds) && scope.targetIds.length
    ? scope.targetIds.slice(0, 8).join(", ")
    : "Whole Show";
  const toneText = toneHint ? ` | tone: ${toneHint}` : "";
  const line = `${sectionText} / ${targetText} / ${scope.mode || "create"} from intent: ${scope.goal || "unspecified"}${toneText}`;
  return {
    toneHint,
    executionSeedLines: [line],
    strategy: timing.strategy,
    detail: `seedLines=1 strategy=${timing.strategy}`
  };
}

function stageCommandGraphSynthesis({
  sourceLines = [],
  effect = {},
  warnings = [],
  capabilityCommands = [],
  effectCatalog = null,
  sequenceSettings = {},
  targetIds = [],
  displayElements = [],
  groupIds = [],
  groupsById = {},
  submodelsById = {},
  sectionWindowsByName = null,
  trackName = "XD: Sequencer Plan",
  allowTimingWrites = true
} = {}) {
  const proposed = normArray(sourceLines).map((line) => normText(line)).filter(Boolean);
  const executionLines = proposed.length ? proposed : normArray(effect.executionSeedLines).filter(Boolean);
  const advertisedCapabilities = Array.isArray(capabilityCommands) ? capabilityCommands.map((row) => normText(row)).filter(Boolean) : [];
  const enableEffectTimingAlignment = !advertisedCapabilities.length || advertisedCapabilities.includes("effects.alignToTiming");
  const groupRenderWarnings = collectGroupRenderPolicyWarnings(executionLines, { groupIds, groupsById });
  if (groupRenderWarnings.length) warnings.push(...groupRenderWarnings);
  const submodelRenderWarnings = collectSubmodelRenderWarnings(executionLines, { submodelsById, targetIds });
  if (submodelRenderWarnings.length) warnings.push(...submodelRenderWarnings);
  if (!enableEffectTimingAlignment) {
    warnings.push("effects.alignToTiming capability unavailable; effect windows will remain static timing-aligned ranges instead of explicit timing re-alignment commands.");
  }
  const commands = buildDesignerPlanCommands(executionLines, {
    trackName,
    targetIds,
    effectCatalog,
    sequenceSettings,
    displayElements,
    groupIds,
    groupsById,
    submodelsById,
    sectionWindowsByName,
    enableEffectTimingAlignment
  });
  const filteredCommands = [];
  for (const command of commands) {
    const cmd = normText(command?.cmd);
    const trackName = normText(command?.params?.trackName);
    const isTimingWrite = cmd === "timing.createTrack" || cmd === "timing.insertMarks" || cmd === "timing.replaceMarks";
    if (isTimingWrite && trackName.startsWith("XD:")) {
      if (!allowTimingWrites) {
        warnings.push(`Timing write skipped: ${trackName} blocked because timing writes are disabled.`);
        continue;
      }
    }
    filteredCommands.push(command);
  }
  const commandsOut = filteredCommands;
  const capabilityGate = evaluateSequencePlanCapabilities({ commands: commandsOut, capabilityCommands });
  if (!capabilityGate.ok) {
    const err = new Error(capabilityGate.errors.join("; ") || "capability gate failed");
    err.failureCategory = "capability";
    throw err;
  }
  if (Array.isArray(capabilityGate.warnings) && capabilityGate.warnings.length) {
    warnings.push(...capabilityGate.warnings);
  }
  const effectCompat = evaluateEffectCommandCompatibility({ commands: commandsOut, effectCatalog });
  if (!effectCompat.ok) {
    const err = new Error(effectCompat.errors.join("; ") || "effect compatibility gate failed");
    err.failureCategory = "validate";
    throw err;
  }
  if (Array.isArray(effectCompat.warnings) && effectCompat.warnings.length) {
    warnings.push(...effectCompat.warnings);
  }
  return {
    commands: commandsOut,
    executionLines,
    estimatedImpact: estimateImpactCount(executionLines),
    warnings,
    validationReady: Array.isArray(commandsOut) && commandsOut.length > 0,
    detail: `commands=${Array.isArray(commandsOut) ? commandsOut.length : 0} capabilities=${capabilityGate.requiredCapabilities.length}`
  };
}

function runStage({ stage = "", fn, stageTelemetry = [] } = {}) {
  const startedAt = nowMs();
  try {
    const out = fn();
    const finishedAt = nowMs();
    stageTelemetry.push({
      stage,
      status: "ok",
      detail: normText(out?.detail),
      durationMs: Math.max(0, finishedAt - startedAt)
    });
    return out;
  } catch (err) {
    const finishedAt = nowMs();
    const message = String(err?.message || err || "unknown stage error");
    const failureCategory = normText(err?.failureCategory) || classifyStageFailure(stage);
    stageTelemetry.push({
      stage,
      status: "error",
      detail: message,
      durationMs: Math.max(0, finishedAt - startedAt),
      failureCategory
    });
    const wrapped = new Error(`sequence_agent stage ${stage} failed: ${message}`);
    wrapped.stage = stage;
    wrapped.failureCategory = failureCategory;
    wrapped.stageTelemetry = stageTelemetry.slice();
    throw wrapped;
  }
}

export function buildSequenceAgentPlan({
  analysisHandoff = null,
  intentHandoff = null,
  sourceLines = [],
  baseRevision = "unknown",
  capabilityCommands = [],
  effectCatalog = null,
  sequenceSettings = {},
  layoutMode = "2d",
  displayElements = [],
  groupIds = [],
  groupsById = {},
  submodelsById = {},
  timingOwnership = [],
  allowTimingWrites = true,
  stageOverrides = {}
} = {}) {
  const warnings = [];
  const stageTelemetry = [];
  const hasIntent = Boolean(intentHandoff && typeof intentHandoff === "object");
  if (!hasIntent) throw new Error("intent_handoff_v1 is required for sequence_agent planning.");
  const hasAnalysis = Boolean(analysisHandoff && typeof analysisHandoff === "object");
  if (!hasAnalysis) {
    warnings.push("analysis_handoff_v1 missing; running reduced-confidence plan synthesis.");
  }
  const normalizedLayoutMode = normLayoutMode(layoutMode);
  if (normalizedLayoutMode === "2d") {
    warnings.push("Layout mode is 2D: depth semantics allowed, camera/projection-specific 3D operations are disabled.");
  }

  const safeAnalysis = hasAnalysis ? analysisHandoff : {};
  const safeIntent = intentHandoff;

  const scope = runStage({
    stage: STAGE_ORDER[0],
    stageTelemetry,
    fn: () => (typeof stageOverrides.scope_resolution === "function"
      ? stageOverrides.scope_resolution({ analysisHandoff: safeAnalysis, intentHandoff: safeIntent })
      : stageScopeResolution({ analysisHandoff: safeAnalysis, intentHandoff: safeIntent }))
  });

  const timing = runStage({
    stage: STAGE_ORDER[1],
    stageTelemetry,
    fn: () => (typeof stageOverrides.timing_asset_decision === "function"
      ? stageOverrides.timing_asset_decision({ hasAnalysis, scope })
      : stageTimingAssetDecision({ hasAnalysis, scope }))
  });

  const effect = runStage({
    stage: STAGE_ORDER[2],
    stageTelemetry,
    fn: () => (typeof stageOverrides.effect_strategy === "function"
      ? stageOverrides.effect_strategy({ scope, analysisHandoff: safeAnalysis, timing })
      : stageEffectStrategy({ scope, analysisHandoff: safeAnalysis, timing }))
  });

  const graph = runStage({
    stage: STAGE_ORDER[3],
    stageTelemetry,
    fn: () => (typeof stageOverrides.command_graph_synthesis === "function"
      ? stageOverrides.command_graph_synthesis({ sourceLines, effect, warnings })
        : stageCommandGraphSynthesis({
          sourceLines,
          effect,
          warnings,
          capabilityCommands,
          effectCatalog,
          sequenceSettings,
          targetIds: scope.targetIds,
          displayElements,
          groupIds,
          groupsById,
          submodelsById,
          sectionWindowsByName: deriveSectionWindowsByName({
            analysisHandoff: safeAnalysis,
            sectionNames: scope.sectionNames,
            includeAll: timing.trackName === "XD: Song Structure"
          }),
          trackName: timing.trackName,
          allowTimingWrites
        }))
  });

  const plan = {
    agentRole: SEQUENCE_AGENT_ROLE,
    contractVersion: SEQUENCE_AGENT_CONTRACT_VERSION,
    planId: `seq-plan-${Date.now()}`,
    summary: buildPlanSummary({ goal: scope.goal, mode: scope.mode, sectionNames: scope.sectionNames }),
    estimatedImpact: Number(graph.estimatedImpact || 0),
    warnings: Array.isArray(graph.warnings) ? graph.warnings : warnings,
    commands: Array.isArray(graph.commands) ? graph.commands : [],
    baseRevision: normText(baseRevision) || "unknown",
    validationReady: Boolean(graph.validationReady),
    executionLines: Array.isArray(graph.executionLines) ? graph.executionLines : [],
    stageTelemetry,
    metadata: {
      layoutMode: normalizedLayoutMode,
      sequenceSettings,
      displayElementCount: Array.isArray(displayElements) ? displayElements.length : 0,
      groupCount: Array.isArray(groupIds) ? groupIds.length : 0,
      groupGraphCount: groupsById && typeof groupsById === "object" ? Object.keys(groupsById).length : 0,
      submodelGraphCount: submodelsById && typeof submodelsById === "object" ? Object.keys(submodelsById).length : 0,
      mode: scope.mode,
      scope: {
        sections: scope.sectionNames,
        targetIds: scope.targetIds,
        tagNames: scope.tagNames
      },
      degradedMode: !hasAnalysis,
      sectionNames: scope.sectionNames,
      targetIds: scope.targetIds,
      tagNames: scope.tagNames,
      stageOrder: STAGE_ORDER.slice()
    }
  };
  plan.createdAt = new Date().toISOString();
  plan.artifactId = buildArtifactId(SEQUENCE_AGENT_PLAN_OUTPUT_CONTRACT, plan);
  return plan;
}
