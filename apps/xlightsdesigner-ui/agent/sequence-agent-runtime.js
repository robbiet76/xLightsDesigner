import {
  SEQUENCE_AGENT_CONTRACT_VERSION,
  SEQUENCE_AGENT_INPUT_CONTRACT,
  SEQUENCE_AGENT_PLAN_OUTPUT_CONTRACT,
  SEQUENCE_AGENT_APPLY_RESULT_CONTRACT,
  validateSequenceAgentInput,
  validateSequenceAgentPlanOutput,
  validateSequenceAgentApplyResult
} from "./sequence-agent-contracts.js";

export function buildSequenceAgentInput({
  requestId = "",
  endpoint = "",
  sequenceRevision = "unknown",
  layoutMode = "unknown",
  displayElements = [],
  groupIds = [],
  groupsById = {},
  submodelsById = {},
  intentHandoff = null,
  analysisHandoff = null,
  planningScope = null,
  timingOwnership = [],
  manualXdLocks = [],
  allowTimingWrites = true
} = {}) {
  return {
    agentRole: "sequence_agent",
    contractVersion: SEQUENCE_AGENT_CONTRACT_VERSION,
    requestId: String(requestId || "").trim(),
    context: {
      sequenceRevision: String(sequenceRevision || "unknown").trim() || "unknown",
      endpoint: String(endpoint || "").trim(),
      layoutMode: ["2d", "3d"].includes(String(layoutMode || "").toLowerCase())
        ? String(layoutMode || "").toLowerCase()
        : "2d",
      displayElements: Array.isArray(displayElements) ? displayElements : [],
      groupIds: Array.isArray(groupIds) ? groupIds : [],
      groupsById: groupsById && typeof groupsById === "object" && !Array.isArray(groupsById) ? groupsById : {},
      submodelsById: submodelsById && typeof submodelsById === "object" && !Array.isArray(submodelsById) ? submodelsById : {}
    },
    intentHandoff: intentHandoff && typeof intentHandoff === "object" ? intentHandoff : null,
    analysisHandoff: analysisHandoff && typeof analysisHandoff === "object" ? analysisHandoff : null,
    planningScope: planningScope && typeof planningScope === "object" ? planningScope : null,
    safety: {
      timingOwnership: Array.isArray(timingOwnership) ? timingOwnership : [],
      manualXdLocks: Array.isArray(manualXdLocks) ? manualXdLocks : [],
      allowTimingWrites: Boolean(allowTimingWrites)
    }
  };
}

export function classifyOrchestrationFailureReason(stage = "") {
  const value = String(stage || "").trim().toLowerCase();
  if (!value) return "unknown";
  if (value.includes("revision")) return "revision";
  if (value.includes("validate")) return "validate";
  if (value.includes("lock")) return "lock";
  if (value.includes("capability")) return "capability";
  if (value.includes("runtime")) return "runtime";
  return "unknown";
}

export function buildSequenceAgentApplyResult({
  planId = "",
  status = "failed",
  failureReason = null,
  currentRevision = "",
  nextRevision = "",
  verification = null
} = {}) {
  return {
    agentRole: "sequence_agent",
    contractVersion: SEQUENCE_AGENT_CONTRACT_VERSION,
    planId: String(planId || "").trim(),
    status,
    failureReason,
    currentRevision: String(currentRevision || "").trim() || undefined,
    nextRevision: String(nextRevision || "").trim() || undefined,
    verification: verification && typeof verification === "object" ? verification : undefined
  };
}

export function validateSequenceAgentContractGate(kind = "", payload = {}, runId = "") {
  const key = String(kind || "").trim();
  let contractName = "";
  let errors = [];
  let stage = "";

  if (key === "input") {
    contractName = SEQUENCE_AGENT_INPUT_CONTRACT;
    stage = "input_contract";
    errors = validateSequenceAgentInput(payload);
  } else if (key === "plan") {
    contractName = SEQUENCE_AGENT_PLAN_OUTPUT_CONTRACT;
    stage = "plan_contract";
    errors = validateSequenceAgentPlanOutput(payload);
  } else if (key === "apply") {
    contractName = SEQUENCE_AGENT_APPLY_RESULT_CONTRACT;
    stage = "apply_contract";
    errors = validateSequenceAgentApplyResult(payload);
  } else {
    contractName = "unknown";
    stage = "unknown_contract";
    errors = ["unknown contract gate kind"];
  }

  return {
    ok: errors.length === 0,
    stage,
    report: {
      runId: String(runId || "").trim(),
      stage,
      contractName,
      contractVersion: SEQUENCE_AGENT_CONTRACT_VERSION,
      agentRole: "sequence_agent",
      valid: errors.length === 0,
      errors
    }
  };
}
