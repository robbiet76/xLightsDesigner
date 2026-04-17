export const SEQUENCE_AGENT_ROLE = "sequence_agent";
export const SEQUENCE_AGENT_CONTRACT_VERSION = "1.0";

export const SEQUENCE_AGENT_INPUT_CONTRACT = "sequence_agent_input_v1";
export const SEQUENCE_AGENT_PLAN_OUTPUT_CONTRACT = "plan_handoff_v1";
export const SEQUENCE_AGENT_APPLY_RESULT_CONTRACT = "apply_result_v1";

const APPLY_STATUS = new Set(["applied", "blocked", "failed"]);
const FAILURE_REASONS = new Set(["validate", "revision", "capability", "lock", "runtime", "unknown", null]);

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

export function validateSequenceAgentInput(payload = {}) {
  const errors = [];
  const obj = isPlainObject(payload) ? payload : {};

  if (str(obj.agentRole) !== SEQUENCE_AGENT_ROLE) {
    errors.push(`agentRole must be ${SEQUENCE_AGENT_ROLE}`);
  }
  if (str(obj.contractVersion) !== SEQUENCE_AGENT_CONTRACT_VERSION) {
    errors.push(`contractVersion must be ${SEQUENCE_AGENT_CONTRACT_VERSION}`);
  }

  pushRequiredString(errors, obj, "requestId");
  pushRequiredObject(errors, obj, "context");
  pushRequiredString(errors, obj, "context.sequenceRevision");
  pushRequiredString(errors, obj, "context.endpoint");
  if (!isPlainObject(getByPath(obj, "context.sequenceSettings"))) {
    errors.push("context.sequenceSettings is required");
  }
  const layoutMode = str(getByPath(obj, "context.layoutMode")).toLowerCase();
  if (layoutMode && !["2d", "3d"].includes(layoutMode)) {
    errors.push("context.layoutMode must be 2d|3d when provided");
  }
  const displayElements = getByPath(obj, "context.displayElements");
  if (!Array.isArray(displayElements)) {
    errors.push("context.displayElements is required");
  }
  const groupIds = getByPath(obj, "context.groupIds");
  if (!Array.isArray(groupIds)) {
    errors.push("context.groupIds is required");
  }
  const groupsById = getByPath(obj, "context.groupsById");
  if (!isPlainObject(groupsById)) {
    errors.push("context.groupsById is required");
  }
  const submodelsById = getByPath(obj, "context.submodelsById");
  if (!isPlainObject(submodelsById)) {
    errors.push("context.submodelsById is required");
  }
  const xlightsLayout = getByPath(obj, "context.xlightsLayout");
  if (xlightsLayout != null && !isPlainObject(xlightsLayout)) {
    errors.push("context.xlightsLayout must be an object when provided");
  }
  pushRequiredObject(errors, obj, "intentHandoff");
  pushRequiredObject(errors, obj, "safety");

  const manualXdLocks = getByPath(obj, "safety.manualXdLocks");
  if (!Array.isArray(manualXdLocks)) {
    errors.push("safety.manualXdLocks is required");
  }
  const timingOwnership = getByPath(obj, "safety.timingOwnership");
  if (!Array.isArray(timingOwnership)) {
    errors.push("safety.timingOwnership is required");
  }
  const allowTimingWrites = getByPath(obj, "safety.allowTimingWrites");
  if (typeof allowTimingWrites !== "boolean") {
    errors.push("safety.allowTimingWrites is required");
  }

  if (obj.analysisHandoff != null && !isPlainObject(obj.analysisHandoff)) {
    errors.push("analysisHandoff must be an object when provided");
  }
  if (obj.sequenceArtisticGoal != null && !isPlainObject(obj.sequenceArtisticGoal)) {
    errors.push("sequenceArtisticGoal must be an object when provided");
  }
  if (obj.sequenceRevisionObjective != null && !isPlainObject(obj.sequenceRevisionObjective)) {
    errors.push("sequenceRevisionObjective must be an object when provided");
  }
  if (obj.sequencingDesignHandoff != null) {
    if (!isPlainObject(obj.sequencingDesignHandoff)) {
      errors.push("sequencingDesignHandoff must be an object when provided");
    } else {
      const handoffErrors = validateAgentHandoff("sequencing_design_handoff_v2", obj.sequencingDesignHandoff);
      for (const error of handoffErrors) errors.push(`sequencingDesignHandoff.${error}`);
    }
  }
  if (obj.planningScope != null && !isPlainObject(obj.planningScope)) {
    errors.push("planningScope must be an object when provided");
  }
  if (obj.renderValidationEvidence != null && !isPlainObject(obj.renderValidationEvidence)) {
    errors.push("renderValidationEvidence must be an object when provided");
  }

  return errors;
}

export function validateSequenceAgentPlanOutput(payload = {}) {
  const errors = [];
  const obj = isPlainObject(payload) ? payload : {};

  if (str(obj.agentRole) !== SEQUENCE_AGENT_ROLE) {
    errors.push(`agentRole must be ${SEQUENCE_AGENT_ROLE}`);
  }
  if (str(obj.contractVersion) !== SEQUENCE_AGENT_CONTRACT_VERSION) {
    errors.push(`contractVersion must be ${SEQUENCE_AGENT_CONTRACT_VERSION}`);
  }

  pushRequiredString(errors, obj, "artifactId");
  pushRequiredString(errors, obj, "createdAt");
  pushRequiredString(errors, obj, "planId");
  pushRequiredString(errors, obj, "summary");
  pushRequiredString(errors, obj, "baseRevision");

  if (obj.validationReady !== true) {
    errors.push("validationReady must be true");
  }

  const warnings = arr(obj.warnings);
  const commands = arr(obj.commands);
  if (!Array.isArray(obj.warnings)) errors.push("warnings is required");
  if (!Array.isArray(obj.commands) || !commands.length) {
    errors.push("commands is required");
  }

  if (!isPlainObject(obj.metadata)) {
    errors.push("metadata is required");
  } else if (typeof obj.metadata.degradedMode !== "boolean") {
    errors.push("metadata.degradedMode is required");
  }

  if (Array.isArray(warnings) && warnings.some((w) => typeof w !== "string")) {
    errors.push("warnings must be string[]");
  }

  return errors;
}

export function validateSequenceAgentApplyResult(payload = {}) {
  const errors = [];
  const obj = isPlainObject(payload) ? payload : {};

  if (str(obj.agentRole) !== SEQUENCE_AGENT_ROLE) {
    errors.push(`agentRole must be ${SEQUENCE_AGENT_ROLE}`);
  }
  if (str(obj.contractVersion) !== SEQUENCE_AGENT_CONTRACT_VERSION) {
    errors.push(`contractVersion must be ${SEQUENCE_AGENT_CONTRACT_VERSION}`);
  }

  pushRequiredString(errors, obj, "artifactId");
  pushRequiredString(errors, obj, "createdAt");
  pushRequiredString(errors, obj, "planId");

  const status = str(obj.status);
  if (!APPLY_STATUS.has(status)) {
    errors.push("status must be applied|blocked|failed");
  }

  const failureReason = obj.failureReason == null ? null : str(obj.failureReason);
  if (!FAILURE_REASONS.has(failureReason)) {
    errors.push("failureReason must be validate|revision|capability|lock|runtime|unknown|null");
  }

  if (obj.currentRevision != null && !str(obj.currentRevision)) {
    errors.push("currentRevision must be non-empty when provided");
  }
  if (obj.nextRevision != null && !str(obj.nextRevision)) {
    errors.push("nextRevision must be non-empty when provided");
  }
  if (obj.verification != null && !isPlainObject(obj.verification)) {
    errors.push("verification must be an object when provided");
  }

  return errors;
}
import { validateAgentHandoff } from "../handoff-contracts.js";
