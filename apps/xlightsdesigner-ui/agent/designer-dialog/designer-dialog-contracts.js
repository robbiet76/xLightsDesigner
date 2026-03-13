import { validateAgentHandoff } from "../handoff-contracts.js";
import { buildCanonicalSequenceIntentHandoff } from "../sequence-agent/sequence-intent-handoff.js";

export const DESIGNER_DIALOG_ROLE = "designer_dialog";
export const DESIGNER_DIALOG_CONTRACT_VERSION = "1.0";

export const DESIGNER_DIALOG_INPUT_CONTRACT = "designer_dialog_input_v1";
export const DESIGNER_DIALOG_BRIEF_CONTRACT = "creative_brief_v1";
export const DESIGNER_DIALOG_PROPOSAL_CONTRACT = "proposal_bundle_v1";
export const DESIGNER_DIALOG_RESULT_CONTRACT = "designer_dialog_result_v1";

const RESULT_STATUS = new Set(["ok", "partial", "failed"]);
const FAILURE_REASONS = new Set([
  "clarification",
  "proposal_generation",
  "stale_rebase",
  "handoff_validation",
  "runtime",
  "unknown",
  null
]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function getByPath(obj, path) {
  const keys = Array.isArray(path) ? path : String(path || "").split(".");
  let cur = obj;
  for (const key of keys) {
    if (!isPlainObject(cur) || !(key in cur)) return undefined;
    cur = cur[key];
  }
  return cur;
}

function pushRequiredString(errors, obj, path, label = "") {
  if (!str(getByPath(obj, path))) errors.push(`${label || path} is required`);
}

function pushRequiredObject(errors, obj, path, label = "") {
  if (!isPlainObject(getByPath(obj, path))) errors.push(`${label || path} is required`);
}

function strOrDefault(value = "", fallback = "") {
  const out = str(value);
  return out || fallback;
}

export function validateDesignerDialogInput(payload = {}) {
  const errors = [];
  const obj = isPlainObject(payload) ? payload : {};

  if (str(obj.agentRole) !== DESIGNER_DIALOG_ROLE) {
    errors.push(`agentRole must be ${DESIGNER_DIALOG_ROLE}`);
  }
  if (str(obj.contractVersion) !== DESIGNER_DIALOG_CONTRACT_VERSION) {
    errors.push(`contractVersion must be ${DESIGNER_DIALOG_CONTRACT_VERSION}`);
  }

  pushRequiredString(errors, obj, "requestId");
  pushRequiredObject(errors, obj, "context");
  pushRequiredString(errors, obj, "context.sequenceRevision");
  pushRequiredObject(errors, obj, "context.selection");
  pushRequiredString(errors, obj, "promptText");

  if (obj.analysisHandoff != null && !isPlainObject(obj.analysisHandoff)) {
    errors.push("analysisHandoff must be an object when provided");
  }
  if (obj.creativeBrief != null && !isPlainObject(obj.creativeBrief)) {
    errors.push("creativeBrief must be an object when provided");
  }
  if (obj.context.route != null && typeof obj.context.route !== "string") {
    errors.push("context.route must be a string when provided");
  }
  if (!Array.isArray(getByPath(obj, "context.selection.sectionNames"))) {
    errors.push("context.selection.sectionNames is required");
  }
  if (!Array.isArray(getByPath(obj, "context.selection.targetIds"))) {
    errors.push("context.selection.targetIds is required");
  }
  if (!Array.isArray(getByPath(obj, "context.selection.tagNames"))) {
    errors.push("context.selection.tagNames is required");
  }

  return errors;
}

export function validateCreativeBrief(payload = {}) {
  const errors = [];
  const obj = isPlainObject(payload) ? payload : {};

  if (str(obj.briefType) !== DESIGNER_DIALOG_BRIEF_CONTRACT) {
    errors.push(`briefType must be ${DESIGNER_DIALOG_BRIEF_CONTRACT}`);
  }
  if (str(obj.briefVersion) !== DESIGNER_DIALOG_CONTRACT_VERSION) {
    errors.push(`briefVersion must be ${DESIGNER_DIALOG_CONTRACT_VERSION}`);
  }

  pushRequiredString(errors, obj, "summary");
  pushRequiredString(errors, obj, "goalsSummary");
  pushRequiredString(errors, obj, "inspirationSummary");
  pushRequiredArray(errors, obj, "sections");
  pushRequiredString(errors, obj, "moodEnergyArc");
  pushRequiredString(errors, obj, "narrativeCues");
  pushRequiredString(errors, obj, "visualCues");
  pushRequiredArray(errors, obj, "hypotheses");

  if (obj.traceability != null && !isPlainObject(obj.traceability)) {
    errors.push("traceability must be an object when provided");
  }

  return errors;
}

function pushRequiredArray(errors, obj, path, label = "") {
  const value = getByPath(obj, path);
  if (!Array.isArray(value) || !value.length) errors.push(`${label || path} is required`);
}

export function validateProposalBundle(payload = {}) {
  const errors = [];
  const obj = isPlainObject(payload) ? payload : {};

  if (str(obj.bundleType) !== DESIGNER_DIALOG_PROPOSAL_CONTRACT) {
    errors.push(`bundleType must be ${DESIGNER_DIALOG_PROPOSAL_CONTRACT}`);
  }
  if (str(obj.bundleVersion) !== DESIGNER_DIALOG_CONTRACT_VERSION) {
    errors.push(`bundleVersion must be ${DESIGNER_DIALOG_CONTRACT_VERSION}`);
  }

  pushRequiredString(errors, obj, "proposalId");
  pushRequiredString(errors, obj, "summary");
  pushRequiredString(errors, obj, "baseRevision");
  pushRequiredObject(errors, obj, "scope");
  pushRequiredObject(errors, obj, "constraints");
  pushRequiredArray(errors, obj, "proposalLines");
  pushRequiredObject(errors, obj, "lifecycle");
  if (!Array.isArray(obj.guidedQuestions)) errors.push("guidedQuestions is required");
  if (!Array.isArray(obj.assumptions)) errors.push("assumptions is required");

  return errors;
}

export function validateDesignerDialogResult(payload = {}) {
  const errors = [];
  const obj = isPlainObject(payload) ? payload : {};

  if (str(obj.agentRole) !== DESIGNER_DIALOG_ROLE) {
    errors.push(`agentRole must be ${DESIGNER_DIALOG_ROLE}`);
  }
  if (str(obj.contractVersion) !== DESIGNER_DIALOG_CONTRACT_VERSION) {
    errors.push(`contractVersion must be ${DESIGNER_DIALOG_CONTRACT_VERSION}`);
  }

  pushRequiredString(errors, obj, "requestId");
  const status = str(obj.status);
  if (!RESULT_STATUS.has(status)) errors.push("status must be ok|partial|failed");

  const failureReason = obj.failureReason == null ? null : str(obj.failureReason);
  if (!FAILURE_REASONS.has(failureReason)) {
    errors.push("failureReason must be clarification|proposal_generation|stale_rebase|handoff_validation|runtime|unknown|null");
  }

  if (obj.creativeBrief != null) {
    const briefErrors = validateCreativeBrief(obj.creativeBrief);
    for (const error of briefErrors) errors.push(`creativeBrief.${error}`);
  }
  if (obj.proposalBundle != null) {
    const proposalErrors = validateProposalBundle(obj.proposalBundle);
    for (const error of proposalErrors) errors.push(`proposalBundle.${error}`);
  }
  if (obj.handoff != null) {
    const handoffErrors = validateAgentHandoff("intent_handoff_v1", obj.handoff);
    for (const error of handoffErrors) errors.push(`handoff.${error}`);
  }
  if (obj.warnings != null && !Array.isArray(obj.warnings)) {
    errors.push("warnings must be an array when provided");
  }

  return errors;
}

export function buildDesignerDialogInput({
  requestId = "",
  sequenceRevision = "unknown",
  route = "",
  selection = {},
  promptText = "",
  creativeBrief = null,
  analysisHandoff = null
} = {}) {
  return {
    agentRole: DESIGNER_DIALOG_ROLE,
    contractVersion: DESIGNER_DIALOG_CONTRACT_VERSION,
    requestId: str(requestId),
    context: {
      sequenceRevision: str(sequenceRevision || "unknown"),
      route: str(route),
      selection: {
        sectionNames: arr(selection.sectionNames).map((row) => str(row)).filter(Boolean),
        targetIds: arr(selection.targetIds).map((row) => str(row)).filter(Boolean),
        tagNames: arr(selection.tagNames).map((row) => str(row)).filter(Boolean)
      }
    },
    promptText: str(promptText),
    creativeBrief: isPlainObject(creativeBrief) ? creativeBrief : undefined,
    analysisHandoff: isPlainObject(analysisHandoff) ? analysisHandoff : undefined
  };
}

export function buildCreativeBriefContract(brief = {}, traceability = null) {
  const obj = isPlainObject(brief) ? brief : {};
  return {
    briefType: DESIGNER_DIALOG_BRIEF_CONTRACT,
    briefVersion: DESIGNER_DIALOG_CONTRACT_VERSION,
    summary: str(obj.summary || "Design direction inferred from audio + user intent."),
    goalsSummary: str(obj.goalsSummary || "No explicit goals captured."),
    inspirationSummary: str(obj.inspirationSummary || "No explicit inspiration captured."),
    sections: arr(obj.sections).map((row) => str(row)).filter(Boolean),
    moodEnergyArc: str(obj.moodEnergyArc || "Start readable, escalate contrast at impact sections, resolve cleanly."),
    narrativeCues: str(obj.narrativeCues || "Tie transitions to phrasing and lyrical emphasis where available."),
    visualCues: str(obj.visualCues || "No uploaded references."),
    hypotheses: arr(obj.hypotheses).map((row) => str(row)).filter(Boolean),
    notes: str(obj.notes || ""),
    traceability: isPlainObject(traceability) ? traceability : undefined
  };
}

export function buildProposalBundle({
  proposalId = "",
  summary = "",
  baseRevision = "unknown",
  scope = {},
  constraints = {},
  lifecycle = {},
  proposalLines = [],
  guidedQuestions = [],
  assumptions = [],
  riskNotes = [],
  impact = {}
} = {}) {
  return {
    bundleType: DESIGNER_DIALOG_PROPOSAL_CONTRACT,
    bundleVersion: DESIGNER_DIALOG_CONTRACT_VERSION,
    proposalId: str(proposalId),
    summary: str(summary),
    baseRevision: str(baseRevision || "unknown"),
    scope: isPlainObject(scope) ? scope : {},
    constraints: isPlainObject(constraints) ? constraints : {},
    lifecycle: isPlainObject(lifecycle) ? lifecycle : {},
    proposalLines: arr(proposalLines).map((row) => str(row)).filter(Boolean),
    guidedQuestions: arr(guidedQuestions).map((row) => str(row)).filter(Boolean),
    assumptions: arr(assumptions).map((row) => str(row)).filter(Boolean),
    riskNotes: arr(riskNotes).map((row) => str(row)).filter(Boolean),
    impact: isPlainObject(impact) ? impact : {}
  };
}

export function buildIntentHandoffFromDesignerState({
  normalizedIntent = {},
  intentText = "",
  creativeBrief = null,
  elevatedRiskConfirmed = false
} = {}) {
  return buildCanonicalSequenceIntentHandoff({
    normalizedIntent: {
      ...normalizedIntent,
      changeTolerance: strOrDefault(normalizedIntent?.changeTolerance, inferIntentModeFromGoal(str(normalizedIntent?.goal || intentText)) === "polish" ? "low" : "medium")
    },
    intentText,
    creativeBrief,
    elevatedRiskConfirmed
  });
}

export function buildDesignerDialogResult({
  requestId = "",
  status = "failed",
  failureReason = null,
  creativeBrief = null,
  proposalBundle = null,
  handoff = null,
  warnings = [],
  summary = ""
} = {}) {
  return {
    agentRole: DESIGNER_DIALOG_ROLE,
    contractVersion: DESIGNER_DIALOG_CONTRACT_VERSION,
    requestId: str(requestId),
    status: str(status),
    failureReason: failureReason == null ? null : str(failureReason),
    creativeBrief: isPlainObject(creativeBrief) ? creativeBrief : undefined,
    proposalBundle: isPlainObject(proposalBundle) ? proposalBundle : undefined,
    handoff: isPlainObject(handoff) ? handoff : undefined,
    warnings: arr(warnings).map((row) => str(row)).filter(Boolean),
    summary: str(summary)
  };
}

export function classifyDesignerDialogFailureReason(stage = "", detail = "") {
  const combined = `${str(stage).toLowerCase()} ${str(detail).toLowerCase()}`.trim();
  if (!combined) return "unknown";
  if (combined.includes("clarif")) return "clarification";
  if (combined.includes("handoff")) return "handoff_validation";
  if (combined.includes("stale") || combined.includes("revision")) return "stale_rebase";
  if (combined.includes("proposal") || combined.includes("plan")) return "proposal_generation";
  if (combined.includes("runtime") || combined.includes("exception") || combined.includes("failed")) return "runtime";
  return "unknown";
}

export function validateDesignerDialogContractGate(kind = "", payload = {}, runId = "") {
  const key = str(kind);
  let contractName = "";
  let errors = [];
  let stage = "";

  if (key === "input") {
    contractName = DESIGNER_DIALOG_INPUT_CONTRACT;
    stage = "input_contract";
    errors = validateDesignerDialogInput(payload);
  } else if (key === "brief") {
    contractName = DESIGNER_DIALOG_BRIEF_CONTRACT;
    stage = "brief_contract";
    errors = validateCreativeBrief(payload);
  } else if (key === "proposal") {
    contractName = DESIGNER_DIALOG_PROPOSAL_CONTRACT;
    stage = "proposal_contract";
    errors = validateProposalBundle(payload);
  } else if (key === "result") {
    contractName = DESIGNER_DIALOG_RESULT_CONTRACT;
    stage = "result_contract";
    errors = validateDesignerDialogResult(payload);
  } else {
    contractName = key || "unknown";
    stage = "contract_gate";
    errors = [`Unknown designer_dialog contract kind: ${key}`];
  }

  return {
    ok: errors.length === 0,
    stage,
    report: {
      runId: str(runId),
      agentRole: DESIGNER_DIALOG_ROLE,
      contract: contractName,
      status: errors.length ? "failed" : "ok",
      errors
    }
  };
}

function inferIntentModeFromGoal(goal = "") {
  const lower = str(goal).toLowerCase();
  if (!lower) return "revise";
  if (/(analyz|audit|diagnos|review)/.test(lower)) return "analyze";
  if (/(polish|tighten|clean up|clean-up|refine)/.test(lower)) return "polish";
  if (/(create|start|build from scratch|new sequence)/.test(lower)) return "create";
  return "revise";
}
