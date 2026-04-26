export const SEQUENCE_FUNCTION_CATALOG = {
  "sequence.setSettings": {
    id: "sequence.set_settings",
    category: "sequence",
    requiredCapabilities: ["sequence.setSettings"],
    writeScope: "sequence"
  },
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
  "sequencer.setDisplayElementOrder": {
    id: "sequencer.set_display_element_order",
    category: "sequencer",
    requiredCapabilities: ["sequencer.setDisplayElementOrder"],
    writeScope: "sequence"
  },
  "sequencer.setActiveDisplayElements": {
    id: "sequencer.set_active_display_elements",
    category: "sequencer",
    requiredCapabilities: ["sequencer.setActiveDisplayElements"],
    writeScope: "sequence"
  },
  "effects.create": {
    id: "effects.create",
    category: "effects",
    requiredCapabilities: ["effects.create"],
    writeScope: "target"
  },
  "effects.update": {
    id: "effects.update",
    category: "effects",
    requiredCapabilities: ["effects.update"],
    writeScope: "target"
  },
  "effects.delete": {
    id: "effects.delete",
    category: "effects",
    requiredCapabilities: ["effects.delete"],
    writeScope: "target"
  },
  "effects.deleteLayer": {
    id: "effects.delete_layer",
    category: "effects",
    requiredCapabilities: ["effects.deleteLayer"],
    writeScope: "target"
  },
  "effects.reorderLayer": {
    id: "effects.reorder_layer",
    category: "effects",
    requiredCapabilities: ["effects.reorderLayer"],
    writeScope: "target"
  },
  "effects.compactLayers": {
    id: "effects.compact_layers",
    category: "effects",
    requiredCapabilities: ["effects.compactLayers"],
    writeScope: "target"
  },
  "effects.setRenderStyle": {
    id: "effects.set_render_style",
    category: "effects",
    requiredCapabilities: ["effects.setRenderStyle"],
    writeScope: "target"
  },
  "effects.setPalette": {
    id: "effects.set_palette",
    category: "effects",
    requiredCapabilities: ["effects.setPalette"],
    writeScope: "target"
  },
  "effects.shift": {
    id: "effects.shift",
    category: "effects",
    requiredCapabilities: ["effects.shift"],
    writeScope: "target"
  },
  "effects.alignToTiming": {
    id: "effects.align_to_timing",
    category: "effects",
    requiredCapabilities: ["effects.alignToTiming"],
    writeScope: "target"
  },
  "effects.clone": {
    id: "effects.clone",
    category: "effects",
    requiredCapabilities: ["effects.clone"],
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
