import {
  SEQUENCE_AGENT_CONTRACT_VERSION,
  SEQUENCE_AGENT_INPUT_CONTRACT,
  SEQUENCE_AGENT_PLAN_OUTPUT_CONTRACT,
  SEQUENCE_AGENT_APPLY_RESULT_CONTRACT,
  validateSequenceAgentInput,
  validateSequenceAgentPlanOutput,
  validateSequenceAgentApplyResult
} from "./sequence-agent-contracts.js";
import { buildArtifactId } from "../shared/artifact-ids.js";

export function buildSequenceAgentInput({
  requestId = "",
  endpoint = "",
  sequenceRevision = "unknown",
  sequenceSettings = {},
  layoutMode = "unknown",
  displayElements = [],
  groupIds = [],
  groupsById = {},
  submodelsById = {},
  xlightsLayout = null,
  intentHandoff = null,
  sequencingDesignHandoff = null,
  sequenceArtisticGoal = null,
  sequenceRevisionObjective = null,
  analysisHandoff = null,
  planningScope = null,
  renderValidationEvidence = null,
  revisionRetryPressure = null,
  candidateSelectionContext = null,
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
      sequenceSettings: sequenceSettings && typeof sequenceSettings === "object" && !Array.isArray(sequenceSettings) ? sequenceSettings : {},
      layoutMode: ["2d", "3d"].includes(String(layoutMode || "").toLowerCase())
        ? String(layoutMode || "").toLowerCase()
        : "2d",
      displayElements: Array.isArray(displayElements) ? displayElements : [],
      groupIds: Array.isArray(groupIds) ? groupIds : [],
      groupsById: groupsById && typeof groupsById === "object" && !Array.isArray(groupsById) ? groupsById : {},
      submodelsById: submodelsById && typeof submodelsById === "object" && !Array.isArray(submodelsById) ? submodelsById : {},
      xlightsLayout: normalizeXLightsLayoutContext({
        displayElements,
        groupsById,
        xlightsLayout
      })
    },
    intentHandoff: intentHandoff && typeof intentHandoff === "object" ? intentHandoff : null,
    sequencingDesignHandoff: sequencingDesignHandoff && typeof sequencingDesignHandoff === "object" ? sequencingDesignHandoff : null,
    sequenceArtisticGoal: sequenceArtisticGoal && typeof sequenceArtisticGoal === "object" ? sequenceArtisticGoal : null,
    sequenceRevisionObjective: sequenceRevisionObjective && typeof sequenceRevisionObjective === "object" ? sequenceRevisionObjective : null,
    analysisHandoff: analysisHandoff && typeof analysisHandoff === "object" ? analysisHandoff : null,
    planningScope: planningScope && typeof planningScope === "object" ? planningScope : null,
    renderValidationEvidence: renderValidationEvidence && typeof renderValidationEvidence === "object" && !Array.isArray(renderValidationEvidence)
      ? renderValidationEvidence
      : null,
    revisionRetryPressure: revisionRetryPressure && typeof revisionRetryPressure === "object" && !Array.isArray(revisionRetryPressure)
      ? revisionRetryPressure
      : null,
    candidateSelectionContext: candidateSelectionContext && typeof candidateSelectionContext === "object" && !Array.isArray(candidateSelectionContext)
      ? candidateSelectionContext
      : null,
    safety: {
      timingOwnership: Array.isArray(timingOwnership) ? timingOwnership : [],
      manualXdLocks: Array.isArray(manualXdLocks) ? manualXdLocks : [],
      allowTimingWrites: Boolean(allowTimingWrites)
    }
  };
}

function normalizeXLightsLayoutContext({ displayElements = [], groupsById = {}, xlightsLayout = null } = {}) {
  if (xlightsLayout && typeof xlightsLayout === "object" && !Array.isArray(xlightsLayout)) {
    return xlightsLayout;
  }

  const elements = Array.isArray(displayElements) ? displayElements : [];
  const groupMap = groupsById && typeof groupsById === "object" && !Array.isArray(groupsById) ? groupsById : {};
  const allTargetNames = Array.from(new Set(
    elements
      .map((row) => String(row?.id || row?.name || "").trim())
      .filter(Boolean)
  )).sort((a, b) => a.localeCompare(b));

  const groups = Object.values(groupMap)
    .map((row) => {
      const groupName = String(row?.id || row?.name || "").trim();
      if (!groupName) return null;
      const members = row?.members && typeof row.members === "object" ? row.members : {};
      const normalizeMembers = (items) => (Array.isArray(items) ? items : [])
        .map((item) => String(item?.id || item?.name || "").trim())
        .filter(Boolean);
      return {
        groupName,
        directMembers: normalizeMembers(members.direct),
        activeMembers: normalizeMembers(members.active),
        flattenedMembers: normalizeMembers(members.flattened),
        flattenedAllMembers: normalizeMembers(members.flattenedAll)
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.groupName.localeCompare(b.groupName));

  return {
    allTargetNames,
    groupMemberships: groups
  };
}

export function classifyOrchestrationFailureReason(stage = "", detail = "", verification = null) {
  const stageValue = String(stage || "").trim().toLowerCase();
  const detailValue = String(detail || "").trim().toLowerCase();

  if (verification && typeof verification === "object") {
    if (verification.revisionAdvanced === false) return "revision";
    if (verification.expectedMutationsPresent === false) return "validate";
  }

  const combined = `${stageValue} ${detailValue}`.trim();
  if (!combined) return "unknown";

  if (
    combined.includes("revision") ||
    combined.includes("stale draft") ||
    combined.includes("did not advance") ||
    combined.includes("revision mismatch") ||
    combined.includes("revision conflict")
  ) {
    return "revision";
  }
  if (
    combined.includes("capability") ||
    combined.includes("unsupported command") ||
    combined.includes("not advertised") ||
    combined.includes("missing capability")
  ) {
    return "capability";
  }
  if (combined.includes("lock")) {
    return "lock";
  }
  if (
    combined.includes("validate") ||
    combined.includes("validation") ||
    combined.includes("invalid") ||
    combined.includes("graph") ||
    combined.includes("safety") ||
    combined.includes("expected mutations missing") ||
    combined.includes("readback")
  ) {
    return "validate";
  }
  if (
    combined.includes("runtime") ||
    combined.includes("exception") ||
    combined.includes("transaction") ||
    combined.includes("rollback") ||
    combined.includes("apply blocked") ||
    combined.includes("apply failed")
  ) {
    return "runtime";
  }
  return "unknown";
}

export function buildSequenceAgentApplyResult({
  planId = "",
  status = "failed",
  failureReason = null,
  currentRevision = "",
  nextRevision = "",
  verification = null,
  practicalValidation = null
} = {}) {
  const result = {
    agentRole: "sequence_agent",
    contractVersion: SEQUENCE_AGENT_CONTRACT_VERSION,
    planId: String(planId || "").trim(),
    status,
    failureReason,
    currentRevision: String(currentRevision || "").trim() || undefined,
    nextRevision: String(nextRevision || "").trim() || undefined,
    verification: verification && typeof verification === "object" ? verification : undefined,
    practicalValidation: practicalValidation && typeof practicalValidation === "object" ? practicalValidation : undefined,
    createdAt: new Date().toISOString()
  };
  result.artifactId = buildArtifactId(SEQUENCE_AGENT_APPLY_RESULT_CONTRACT, result);
  return result;
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
