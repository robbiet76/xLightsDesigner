export const SEQUENCE_FUNCTION_CATALOG = {
  "timing.createTrack": {
    id: "timing.create_track",
    category: "timing",
    requiredCapabilities: ["timing.createTrack"],
    writeScope: "track"
  },
  "timing.insertMarks": {
    id: "timing.insert_marks",
    category: "timing",
    requiredCapabilities: ["timing.insertMarks"],
    writeScope: "track"
  },
  "timing.replaceMarks": {
    id: "timing.replace_marks",
    category: "timing",
    requiredCapabilities: ["timing.replaceMarks"],
    writeScope: "track"
  },
  "effects.apply": {
    id: "effects.apply",
    category: "effects",
    requiredCapabilities: ["effects.apply"],
    writeScope: "target"
  },
  "effects.bulkApply": {
    id: "effects.bulk_apply",
    category: "effects",
    requiredCapabilities: ["effects.bulkApply"],
    writeScope: "target"
  }
};

function normText(value = "") {
  return String(value || "").trim();
}

export function getFunctionDefinitionForCommand(cmd = "") {
  const key = normText(cmd);
  return SEQUENCE_FUNCTION_CATALOG[key] || null;
}

export function getRequiredCapabilitiesForCommands(commands = []) {
  const rows = Array.isArray(commands) ? commands : [];
  const out = new Set();
  for (const row of rows) {
    const cmd = normText(row?.cmd);
    if (!cmd) continue;
    const def = getFunctionDefinitionForCommand(cmd);
    const required = Array.isArray(def?.requiredCapabilities) ? def.requiredCapabilities : [cmd];
    for (const cap of required) {
      const v = normText(cap);
      if (v) out.add(v);
    }
  }
  return Array.from(out.values()).sort((a, b) => a.localeCompare(b));
}
