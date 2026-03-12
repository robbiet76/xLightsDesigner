const UNSAFE_PREFIXES = ["controllers.", "layout."];
const WRITE_CMDS = new Set([
  "timing.createTrack",
  "timing.insertMarks",
  "timing.replaceMarks",
  "sequencer.setDisplayElementOrder",
  "sequencer.setActiveDisplayElements",
  "effects.create",
  "effects.update",
  "effects.delete",
  "effects.deleteLayer",
  "effects.compactLayers",
  "effects.setRenderStyle",
  "effects.setPalette",
  "effects.shift",
  "effects.alignToTiming",
  "effects.clone"
]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normText(value = "") {
  return String(value || "").trim();
}

function stableJson(value) {
  try {
    if (!isPlainObject(value) && !Array.isArray(value)) return JSON.stringify(value);
    return JSON.stringify(value, Object.keys(value).sort());
  } catch {
    return "";
  }
}

function deriveWriteKey(cmd = "", params = {}) {
  const c = normText(cmd);
  const track = normText(params?.trackName);
  if (track && c.startsWith("timing.")) {
    return `timing:${track}`;
  }
  if (c === "sequencer.setDisplayElementOrder") {
    return "sequencer:display-order";
  }
  if (c === "sequencer.setActiveDisplayElements") {
    return "sequencer:active-display-elements";
  }
  if (c.startsWith("effects.")) {
    const effectId = normText(params?.effectId);
    if (effectId) return `effects:id:${effectId}`;

    const modelName = normText(params?.modelName);
    const layerIndex = Number.isInteger(params?.layerIndex) ? params.layerIndex : null;
    if (modelName) {
      return layerIndex == null ? `effects:model:${modelName}` : `effects:model:${modelName}:layer:${layerIndex}`;
    }

    const sourceModelName = normText(params?.sourceModelName);
    const sourceLayerIndex = Number.isInteger(params?.sourceLayerIndex) ? params.sourceLayerIndex : null;
    if (sourceModelName) {
      return sourceLayerIndex == null
        ? `effects:source:${sourceModelName}`
        : `effects:source:${sourceModelName}:layer:${sourceLayerIndex}`;
    }
  }
  return c ? `cmd:${c}` : "";
}

export function buildCommandGraph(commands = []) {
  const rows = Array.isArray(commands) ? commands : [];
  const nodes = rows.map((step, idx) => {
    const cmd = normText(step?.cmd);
    const params = isPlainObject(step?.params) ? step.params : {};
    const dependsOn = Array.isArray(step?.dependsOn)
      ? step.dependsOn.map((v) => normText(v)).filter(Boolean)
      : [];
    return {
      id: normText(step?.id) || `n${idx + 1}`,
      index: idx,
      cmd,
      params,
      dependsOn,
      writeKey: deriveWriteKey(cmd, params)
    };
  });

  return {
    schema: "command_graph_v1",
    nodes
  };
}

export function validateCommandGraph(commands = [], options = {}) {
  const graph = buildCommandGraph(commands);
  const errors = [];
  const warnings = [];
  const nodes = graph.nodes;

  const allowUnsafePrefixes = Array.isArray(options?.allowUnsafePrefixes)
    ? options.allowUnsafePrefixes.map((p) => normText(p)).filter(Boolean)
    : [];
  const seenIds = new Set();
  const seenExactWrites = new Set();
  const byId = new Map(nodes.map((n) => [n.id, n]));

  if (!nodes.length) {
    errors.push("Command graph is empty.");
  }

  for (const node of nodes) {
    if (!node.id) {
      errors.push(`Node ${node.index} missing id.`);
      continue;
    }
    if (seenIds.has(node.id)) {
      errors.push(`Duplicate node id: ${node.id}`);
    }
    seenIds.add(node.id);

    if (!node.cmd) {
      errors.push(`Node ${node.id} has empty cmd.`);
      continue;
    }
    if (!isPlainObject(node.params)) {
      errors.push(`Node ${node.id} params must be object.`);
    }

    const unsafe = UNSAFE_PREFIXES.some((prefix) => node.cmd.startsWith(prefix))
      && !allowUnsafePrefixes.some((prefix) => node.cmd.startsWith(prefix));
    if (unsafe) {
      errors.push(`Unsafe command in graph: ${node.cmd}`);
    }

    const exactKey = `${node.cmd}|${stableJson(node.params)}`;
    if (seenExactWrites.has(exactKey)) {
      errors.push(`Duplicate write command detected: ${node.cmd}`);
    }
    seenExactWrites.add(exactKey);

    for (const depId of node.dependsOn) {
      if (!byId.has(depId)) {
        errors.push(`Node ${node.id} depends on unknown node ${depId}`);
        continue;
      }
      const depNode = byId.get(depId);
      if (depNode.index >= node.index) {
        errors.push(`Node ${node.id} depends on out-of-order node ${depId}`);
      }
    }
  }

  const replaceByTrack = new Map();
  const insertByTrack = new Map();
  for (const node of nodes) {
    if (node.cmd === "timing.replaceMarks") {
      const track = normText(node.params?.trackName);
      if (track) replaceByTrack.set(track, node);
    }
    if (node.cmd === "timing.insertMarks") {
      const track = normText(node.params?.trackName);
      if (track) insertByTrack.set(track, node);
    }
  }
  for (const track of replaceByTrack.keys()) {
    if (insertByTrack.has(track)) {
      warnings.push(`Track ${track} has both replaceMarks and insertMarks in same graph.`);
    }
  }

  const writeNodes = nodes.filter((n) => WRITE_CMDS.has(n.cmd));
  if (!writeNodes.length) {
    warnings.push("Command graph has no recognized write nodes.");
  }

  return {
    ok: errors.length === 0,
    schema: graph.schema,
    nodes,
    errors,
    warnings,
    nodeCount: nodes.length,
    writeCount: writeNodes.length
  };
}
