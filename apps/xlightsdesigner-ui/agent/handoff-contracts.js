export const AGENT_HANDOFF_CONTRACTS = ["analysis_handoff_v1", "intent_handoff_v1", "plan_handoff_v1"];

export const HANDOFF_SCHEMAS = {
  analysis_handoff_v1: {
    requiredObjectFields: ["trackIdentity", "timing", "structure", "lyrics", "chords", "briefSeed", "evidence"],
    requiredArrayFields: [["structure", "sections"]]
  },
  intent_handoff_v1: {
    requiredStringFields: ["artifactId", "createdAt", "goal"],
    enumFields: [["mode", ["create", "revise", "polish", "analyze"]]],
    requiredObjectFields: ["scope", "constraints", "directorPreferences", "approvalPolicy"]
  },
  plan_handoff_v1: {
    requiredStringFields: ["planId", "summary", "baseRevision"],
    requiredNumberFields: ["estimatedImpact"],
    requiredArrayFields: ["warnings", "commands"],
    requiredBooleanTrueFields: ["validationReady"]
  }
};

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getByPath(obj, path) {
  if (!path) return obj;
  const keys = Array.isArray(path) ? path : String(path).split(".");
  let cur = obj;
  for (const key of keys) {
    if (!isPlainObject(cur) || !(key in cur)) return undefined;
    cur = cur[key];
  }
  return cur;
}

export function validateAgentHandoff(contract = "", payload = {}) {
  const key = String(contract || "").trim();
  const schema = HANDOFF_SCHEMAS[key];
  if (!schema) return [`Unknown handoff contract: ${key}`];
  const errors = [];
  const obj = isPlainObject(payload) ? payload : {};

  for (const field of schema.requiredObjectFields || []) {
    const value = getByPath(obj, field);
    if (!isPlainObject(value)) errors.push(`${Array.isArray(field) ? field.join(".") : field} is required`);
  }

  for (const field of schema.requiredStringFields || []) {
    const value = String(getByPath(obj, field) || "").trim();
    if (!value) errors.push(`${Array.isArray(field) ? field.join(".") : field} is required`);
  }

  for (const field of schema.requiredNumberFields || []) {
    const value = Number(getByPath(obj, field));
    if (!Number.isFinite(value)) errors.push(`${Array.isArray(field) ? field.join(".") : field} is required`);
  }

  for (const field of schema.requiredArrayFields || []) {
    const value = getByPath(obj, field);
    if (!Array.isArray(value) || !value.length) {
      errors.push(`${Array.isArray(field) ? field.join(".") : field} is required`);
    }
  }

  for (const [field, allowed] of schema.enumFields || []) {
    const value = String(getByPath(obj, field) || "").trim();
    if (!allowed.includes(value)) {
      errors.push(`${Array.isArray(field) ? field.join(".") : field} must be ${allowed.join("|")}`);
    }
  }

  for (const field of schema.requiredBooleanTrueFields || []) {
    if (getByPath(obj, field) !== true) {
      errors.push(`${Array.isArray(field) ? field.join(".") : field} must be true`);
    }
  }

  return errors;
}
