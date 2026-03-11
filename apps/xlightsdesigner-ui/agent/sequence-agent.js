import { buildDesignerPlanCommands, estimateImpactCount } from "./command-builders.js";
import { SEQUENCE_AGENT_CONTRACT_VERSION, SEQUENCE_AGENT_ROLE } from "./sequence-agent-contracts.js";

function normText(value = "") {
  return String(value || "").trim();
}

function normArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
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

function buildExecutionLines({
  sourceLines = [],
  intentHandoff = {},
  analysisHandoff = {}
} = {}) {
  const proposed = normArray(sourceLines).map((line) => normText(line)).filter(Boolean);
  if (proposed.length) return proposed;

  const goal = normText(intentHandoff?.goal);
  const mode = normText(intentHandoff?.mode) || "create";
  const targetIds = normArray(intentHandoff?.scope?.targetIds).slice(0, 8);
  const sectionNames = deriveSectionNames({ analysisHandoff, intentHandoff }).slice(0, 8);
  const toneHint = normText(analysisHandoff?.briefSeed?.tone);
  const targetText = targetIds.length ? targetIds.join(", ") : "Whole Show";
  const sectionText = sectionNames.length ? sectionNames.join(", ") : "Global";
  const toneText = toneHint ? ` | tone: ${toneHint}` : "";
  return [`${sectionText} / ${targetText} / ${mode} from intent: ${goal || "unspecified"}${toneText}`];
}

export function buildSequenceAgentPlan({
  analysisHandoff = null,
  intentHandoff = null,
  sourceLines = [],
  baseRevision = "unknown"
} = {}) {
  const warnings = [];
  const hasIntent = Boolean(intentHandoff && typeof intentHandoff === "object");
  if (!hasIntent) throw new Error("intent_handoff_v1 is required for sequence_agent planning.");
  const hasAnalysis = Boolean(analysisHandoff && typeof analysisHandoff === "object");
  if (!hasAnalysis) {
    warnings.push("analysis_handoff_v1 missing; running reduced-confidence plan synthesis.");
  }

  const goal = normText(intentHandoff?.goal);
  const mode = normText(intentHandoff?.mode) || "create";
  const sectionNames = deriveSectionNames({
    analysisHandoff: hasAnalysis ? analysisHandoff : {},
    intentHandoff
  });
  const executionLines = buildExecutionLines({
    sourceLines,
    intentHandoff,
    analysisHandoff: hasAnalysis ? analysisHandoff : {}
  });
  const commands = buildDesignerPlanCommands(executionLines, { trackName: "XD: Sequencer Plan" });

  return {
    agentRole: SEQUENCE_AGENT_ROLE,
    contractVersion: SEQUENCE_AGENT_CONTRACT_VERSION,
    planId: `seq-plan-${Date.now()}`,
    summary: buildPlanSummary({ goal, mode, sectionNames }),
    estimatedImpact: estimateImpactCount(executionLines),
    warnings,
    commands,
    baseRevision: normText(baseRevision) || "unknown",
    validationReady: Array.isArray(commands) && commands.length > 0,
    executionLines,
    metadata: {
      mode,
      scope: {
        sections: sectionNames,
        targetIds: normArray(intentHandoff?.scope?.targetIds),
        tagNames: normArray(intentHandoff?.scope?.tagNames)
      },
      degradedMode: !hasAnalysis,
      sectionNames,
      targetIds: normArray(intentHandoff?.scope?.targetIds),
      tagNames: normArray(intentHandoff?.scope?.tagNames)
    }
  };
}
