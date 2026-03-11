import { getRequiredCapabilitiesForCommands } from "./sequence-function-catalog.js";

function normText(value = "") {
  return String(value || "").trim();
}

export function evaluateSequencePlanCapabilities({ commands = [], capabilityCommands = [] } = {}) {
  const supported = new Set((Array.isArray(capabilityCommands) ? capabilityCommands : []).map((c) => normText(c)).filter(Boolean));
  const required = getRequiredCapabilitiesForCommands(commands);

  if (!supported.size) {
    return {
      ok: true,
      skipped: true,
      errors: [],
      warnings: ["Capability gate skipped: capability list unavailable."],
      requiredCapabilities: required,
      missingCapabilities: []
    };
  }

  const missing = required.filter((cap) => !supported.has(cap));
  return {
    ok: missing.length === 0,
    skipped: false,
    errors: missing.length ? [`Unsupported command capabilities: ${missing.join(", ")}`] : [],
    warnings: [],
    requiredCapabilities: required,
    missingCapabilities: missing
  };
}
