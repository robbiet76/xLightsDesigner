import { evaluatePlanSafety } from '../safety-policy.js';
import { validateCommandGraph } from "./command-graph.js";
import {
  describeOwnedModalBlock,
  isOwnedHealthReady,
  ownedModalStateBlocked
} from "../../runtime/owned-xlights-health.js";

function str(value = "") {
  return String(value || "").trim();
}

function rawText(value = "") {
  return String(value ?? "").trim();
}

function norm(value = "") {
  return str(value).toLowerCase();
}

function toInt(value, fallback = -1) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function normalizeXlightsColor(value = "") {
  const text = rawText(value);
  if (/^#[0-9a-f]{6}$/i.test(text)) return text.toUpperCase();
  return "";
}

function serializeXlightsKeyValueMap(value = null) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  return Object.entries(value)
    .map(([key, rawValue]) => {
      const safeKey = str(key);
      if (!safeKey) return "";
      const safeValue = normalizeXlightsColor(rawValue) || rawText(rawValue);
      if (!safeValue) return "";
      return `${safeKey}=${safeValue}`;
    })
    .filter(Boolean)
    .join(",");
}

function serializeXlightsPalette(value = null) {
  const serialized = serializeXlightsKeyValueMap(value);
  if (!serialized) return "";
  const keys = new Set(serialized.split(",").map((row) => row.split("=")[0]).filter(Boolean));
  const defaults = [];
  const defaultColors = ["#FFFFFF", "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#000000", "#00FFFF", "#FF00FF"];
  for (let index = 1; index <= 8; index += 1) {
    const key = `C_BUTTON_Palette${index}`;
    if (!keys.has(key)) defaults.push(`${key}=${defaultColors[index - 1]}`);
  }
  return [...serialized.split(",").filter(Boolean), ...defaults].join(",");
}

export function buildOwnedSequencingBatchPlan(commands = []) {
  const rows = Array.isArray(commands) ? commands : [];
  let trackName = "";
  let markCommand = null;
  const effects = [];

  for (const step of rows) {
    const cmd = str(step?.cmd);
    const params = step?.params && typeof step.params === "object" ? step.params : {};
    if (cmd === "timing.createTrack") {
      trackName = str(params.trackName || trackName);
      continue;
    }
    if (cmd === "timing.insertMarks" || cmd === "timing.replaceMarks") {
      if (markCommand) return null;
      markCommand = { cmd, params };
      trackName = str(params.trackName || trackName);
      continue;
    }
    if (cmd === "effects.create") {
      const modelName = str(params.modelName);
      const effectName = str(params.effectName);
      const layer = toInt(params.layerIndex, -1);
      const startMs = toInt(params.startMs, -1);
      const endMs = toInt(params.endMs, -1);
      if (!modelName || !effectName || layer < 0 || startMs < 0 || endMs < startMs) {
        return null;
      }
      effects.push({
        element: modelName,
        layer,
        effectName,
        startMs,
        endMs,
        settings: serializeXlightsKeyValueMap(params.settings),
        palette: serializeXlightsPalette(params.palette),
        clearExisting: false
      });
      continue;
    }
    if (cmd === "effects.alignToTiming") {
      const timingTrackName = str(params.timingTrackName);
      if (timingTrackName && trackName && timingTrackName !== trackName) return null;
      continue;
    }
    return null;
  }

  if (!trackName || !markCommand || !effects.length) return null;
  const marks = Array.isArray(markCommand.params?.marks) ? markCommand.params.marks : [];
  if (marks.length < 2) return null;
  const normalizedMarks = marks.map((row) => ({
    label: str(row?.label),
    startMs: toInt(row?.startMs, -1),
    endMs: toInt(row?.endMs, -1)
  }));
  if (normalizedMarks.some((row) => row.startMs < 0 || row.endMs < row.startMs)) return null;

  return {
    track: trackName,
    replaceExistingMarks: markCommand.cmd === "timing.replaceMarks" || norm(trackName) === "xd: song structure",
    marks: normalizedMarks,
    effects
  };
}

function commandTimingTrackName(command = {}) {
  const params = command?.params && typeof command.params === "object" ? command.params : {};
  return str(params.trackName || params.timingTrackName || command?.anchor?.trackName || command?.anchor?.timingTrackName);
}

function inferPrimaryBatchTimingTrack(commands = []) {
  const effectAnchorTrack = (Array.isArray(commands) ? commands : [])
    .map((command) => str(command?.cmd) === "effects.create" ? commandTimingTrackName(command) : "")
    .find(Boolean);
  if (effectAnchorTrack) return effectAnchorTrack;
  const alignTrack = (Array.isArray(commands) ? commands : [])
    .map((command) => str(command?.cmd) === "effects.alignToTiming" ? commandTimingTrackName(command) : "")
    .find(Boolean);
  if (alignTrack) return alignTrack;
  return (Array.isArray(commands) ? commands : [])
    .map((command) => {
      const cmd = str(command?.cmd);
      return (cmd === "timing.insertMarks" || cmd === "timing.replaceMarks") ? commandTimingTrackName(command) : "";
    })
    .find(Boolean) || "";
}

function buildOwnedBatchSelection(commands = []) {
  const rows = Array.isArray(commands) ? commands : [];
  const fullPlan = buildOwnedSequencingBatchPlan(rows);
  if (fullPlan) {
    return {
      plan: fullPlan,
      commands: rows.filter((command) => isOwnedBatchCommand(command)),
      commandSet: new Set(rows.filter((command) => isOwnedBatchCommand(command)))
    };
  }

  const primaryTrack = inferPrimaryBatchTimingTrack(rows);
  if (!primaryTrack) return { plan: null, commands: [], commandSet: new Set() };
  const subset = rows.filter((command) => {
    const cmd = str(command?.cmd);
    if (cmd === "effects.create") return true;
    if (cmd === "effects.alignToTiming") {
      const track = commandTimingTrackName(command);
      return !track || track === primaryTrack;
    }
    if (cmd === "timing.createTrack" || cmd === "timing.insertMarks" || cmd === "timing.replaceMarks") {
      return commandTimingTrackName(command) === primaryTrack;
    }
    return false;
  });
  const plan = buildOwnedSequencingBatchPlan(subset);
  if (!plan) return { plan: null, commands: [], commandSet: new Set() };
  return {
    plan,
    commands: subset,
    commandSet: new Set(subset)
  };
}

function isOwnedBatchCommand(command = {}) {
  const cmd = str(command?.cmd);
  return cmd === "timing.createTrack"
    || cmd === "timing.insertMarks"
    || cmd === "timing.replaceMarks"
    || cmd === "effects.create"
    || cmd === "effects.alignToTiming";
}

function directOwnedCommandKind(command = {}) {
  const cmd = str(command?.cmd);
  if (
    cmd === "timing.createTrack"
    || cmd === "timing.insertMarks"
    || cmd === "timing.replaceMarks"
    || cmd === "sequencer.setDisplayElementOrder"
    || cmd === "effects.alignToTiming"
    || cmd === "effects.update"
    || cmd === "effects.delete"
    || cmd === "effects.clone"
    || cmd === "effects.deleteLayer"
    || cmd === "effects.reorderLayer"
    || cmd === "effects.compactLayers"
  ) {
    return cmd;
  }
  return "";
}

function normalizeElementParam(params = {}) {
  return str(params.element || params.modelName || params.targetId);
}

function optionalIntParam(params = {}, keys = []) {
  for (const key of keys) {
    if (params[key] == null || params[key] === "") continue;
    const value = toInt(params[key], Number.NaN);
    if (Number.isFinite(value)) return value;
  }
  return undefined;
}

function normalizeEffectSelectorParams(params = {}) {
  const out = {
    element: normalizeElementParam(params)
  };
  const effectId = optionalIntParam(params, ["effectId", "id"]);
  const layer = optionalIntParam(params, ["layer", "layerIndex"]);
  const startMs = optionalIntParam(params, ["startMs"]);
  const endMs = optionalIntParam(params, ["endMs"]);
  if (effectId !== undefined) out.effectId = effectId;
  if (layer !== undefined) out.layer = layer;
  if (startMs !== undefined) out.startMs = startMs;
  if (endMs !== undefined) out.endMs = endMs;
  if (str(params.effectName)) out.effectName = str(params.effectName);
  return out;
}

function normalizeEffectUpdateParams(params = {}) {
  const out = normalizeEffectSelectorParams(params);
  const newLayer = optionalIntParam(params, ["newLayer", "newLayerIndex", "targetLayer", "targetLayerIndex"]);
  const newStartMs = optionalIntParam(params, ["newStartMs", "targetStartMs"]);
  const newEndMs = optionalIntParam(params, ["newEndMs", "targetEndMs"]);
  if (newLayer !== undefined) out.newLayer = newLayer;
  if (newStartMs !== undefined) out.newStartMs = newStartMs;
  if (newEndMs !== undefined) out.newEndMs = newEndMs;
  if (str(params.newEffectName)) out.newEffectName = str(params.newEffectName);
  if (params.settings != null) out.settings = serializeXlightsKeyValueMap(params.settings);
  if (params.palette != null) out.palette = serializeXlightsPalette(params.palette);
  return out;
}

function normalizeCloneEffectParams(params = {}) {
  const out = {};
  const sourceElement = str(params.sourceElement || params.sourceModel || params.sourceModelName || params.modelName);
  const targetElement = str(params.targetElement || params.targetModel || params.targetModelName);
  const targetModels = Array.isArray(params.targetModels)
    ? params.targetModels.map((value) => str(value)).filter(Boolean)
    : [];
  if (sourceElement) out.sourceElement = sourceElement;
  if (targetElement) out.targetElement = targetElement;
  if (targetModels.length) out.targetModels = targetModels;
  const sourceLayer = optionalIntParam(params, ["sourceLayer", "sourceLayerIndex"]);
  const targetLayer = optionalIntParam(params, ["targetLayer", "targetLayerIndex"]);
  const sourceStartMs = optionalIntParam(params, ["sourceStartMs", "startMs"]);
  const sourceEndMs = optionalIntParam(params, ["sourceEndMs", "endMs"]);
  const targetStartMs = optionalIntParam(params, ["targetStartMs"]);
  if (sourceLayer !== undefined) out.sourceLayer = sourceLayer;
  if (targetLayer !== undefined) out.targetLayer = targetLayer;
  if (sourceStartMs !== undefined) out.sourceStartMs = sourceStartMs;
  if (sourceEndMs !== undefined) out.sourceEndMs = sourceEndMs;
  if (targetStartMs !== undefined) out.targetStartMs = targetStartMs;
  if (str(params.mode)) out.mode = str(params.mode);
  if (params.dryRun != null) out.dryRun = params.dryRun === true || norm(params.dryRun) === "true";
  return out;
}

function normalizeLayerCommandParams(params = {}) {
  const out = {
    element: normalizeElementParam(params)
  };
  const layer = optionalIntParam(params, ["layer", "layerIndex"]);
  if (layer !== undefined) out.layer = layer;
  if (params.force != null) out.force = params.force === true || norm(params.force) === "true";
  return out;
}

function normalizeReorderLayerParams(params = {}) {
  const out = {
    element: normalizeElementParam(params)
  };
  const fromLayer = optionalIntParam(params, ["fromLayer", "fromLayerIndex"]);
  const toLayer = optionalIntParam(params, ["toLayer", "toLayerIndex"]);
  if (fromLayer !== undefined) out.fromLayer = fromLayer;
  if (toLayer !== undefined) out.toLayer = toLayer;
  return out;
}

function requiredOwnedDirectFns(deps = {}, directCommands = []) {
  const missing = [];
  const needed = new Set(directCommands.map((command) => directOwnedCommandKind(command)).filter(Boolean));
  const requirements = {
    "timing.createTrack": "createTimingTrack",
    "timing.insertMarks": "insertTimingMarks",
    "timing.replaceMarks": "replaceTimingMarks",
    "sequencer.setDisplayElementOrder": "setDisplayElementOrder",
    "effects.update": "updateEffect",
    "effects.delete": "deleteEffects",
    "effects.clone": "cloneEffects",
    "effects.deleteLayer": "deleteEffectLayer",
    "effects.reorderLayer": "reorderEffectLayer",
    "effects.compactLayers": "compactEffectLayers"
  };
  for (const kind of needed) {
    const fnName = requirements[kind];
    if (fnName && typeof deps[fnName] !== "function") missing.push(fnName);
  }
  return missing;
}

async function waitForAcceptedOwnedMutation(endpoint, accepted, getOwnedJob, getOwnedHealth = null) {
  const jobId = str(accepted?.data?.jobId);
  if (!jobId) return accepted;
  const settled = await waitForOwnedJob(endpoint, jobId, getOwnedJob, getOwnedHealth);
  const state = str(settled?.data?.state).toLowerCase();
  if (state === "failed" || settled?.data?.result?.ok === false) {
    const error = settled?.data?.result?.error && typeof settled.data.result.error === "object"
      ? settled.data.result.error
      : {};
    const code = str(error.code);
    const details = error.details && typeof error.details === "object" ? error.details : {};
    const conflictCount = Number(details.conflictCount);
    const conflictSuffix = Number.isFinite(conflictCount) && conflictCount > 0
      ? ` (${conflictCount} target conflict${conflictCount === 1 ? "" : "s"})`
      : "";
    const codePrefix = code ? `${code}: ` : "";
    throw new Error(`${codePrefix}${str(error.message || "owned direct command failed")}${conflictSuffix}`);
  }
  return settled;
}

async function executeOwnedDirectCommand({ endpoint, command, deps }) {
  const params = command?.params && typeof command.params === "object" ? command.params : {};
  const kind = directOwnedCommandKind(command);
  if (kind === "timing.createTrack") {
    return waitForAcceptedOwnedMutation(endpoint, await deps.createTimingTrack(endpoint, params), deps.getOwnedJob, deps.getOwnedHealth);
  }
  if (kind === "timing.insertMarks") {
    return waitForAcceptedOwnedMutation(endpoint, await deps.insertTimingMarks(endpoint, params), deps.getOwnedJob, deps.getOwnedHealth);
  }
  if (kind === "timing.replaceMarks") {
    return waitForAcceptedOwnedMutation(endpoint, await deps.replaceTimingMarks(endpoint, params), deps.getOwnedJob, deps.getOwnedHealth);
  }
  if (kind === "sequencer.setDisplayElementOrder") {
    const orderedIds = Array.isArray(params.orderedIds) ? params.orderedIds.map((value) => str(value)).filter(Boolean) : [];
    return waitForAcceptedOwnedMutation(endpoint, await deps.setDisplayElementOrder(endpoint, orderedIds), deps.getOwnedJob, deps.getOwnedHealth);
  }
  if (kind === "effects.alignToTiming") {
    return {
      ok: true,
      skipped: true,
      reason: "effect window already carries explicit timing; owned apply has no separate align command"
    };
  }
  if (kind === "effects.update") {
    return waitForAcceptedOwnedMutation(endpoint, await deps.updateEffect(endpoint, normalizeEffectUpdateParams(params)), deps.getOwnedJob, deps.getOwnedHealth);
  }
  if (kind === "effects.delete") {
    return waitForAcceptedOwnedMutation(endpoint, await deps.deleteEffects(endpoint, normalizeEffectSelectorParams(params)), deps.getOwnedJob, deps.getOwnedHealth);
  }
  if (kind === "effects.clone") {
    return waitForAcceptedOwnedMutation(endpoint, await deps.cloneEffects(endpoint, normalizeCloneEffectParams(params)), deps.getOwnedJob, deps.getOwnedHealth);
  }
  if (kind === "effects.deleteLayer") {
    return waitForAcceptedOwnedMutation(endpoint, await deps.deleteEffectLayer(endpoint, normalizeLayerCommandParams(params)), deps.getOwnedJob, deps.getOwnedHealth);
  }
  if (kind === "effects.reorderLayer") {
    return waitForAcceptedOwnedMutation(endpoint, await deps.reorderEffectLayer(endpoint, normalizeReorderLayerParams(params)), deps.getOwnedJob, deps.getOwnedHealth);
  }
  if (kind === "effects.compactLayers") {
    return waitForAcceptedOwnedMutation(endpoint, await deps.compactEffectLayers(endpoint, { element: normalizeElementParam(params) }), deps.getOwnedJob, deps.getOwnedHealth);
  }
  throw new Error(`Unsupported owned direct command: ${str(command?.cmd)}`);
}

async function executeOwnedCommandPlan({
  endpoint,
  commands,
  ownedBatchPlan,
  applySequencingBatchPlan,
  getOwnedJob,
  getOwnedHealth,
  directDeps = {},
  batchCommandSet = new Set()
}) {
  let batchExecuted = false;
  let jobId = "";
  let directExecuted = 0;
  const executeBatch = async () => {
    if (batchExecuted || !ownedBatchPlan) return;
    const accepted = await applySequencingBatchPlan(endpoint, ownedBatchPlan);
    jobId = str(accepted?.data?.jobId);
    if (!jobId) {
      throw new Error("owned sequencing.applyBatchPlan returned no jobId");
    }
    const settled = await waitForOwnedJob(endpoint, jobId, getOwnedJob, getOwnedHealth);
    const state = str(settled?.data?.state).toLowerCase();
    if (state === "failed" || settled?.data?.result?.ok === false) {
      throw new Error(str(settled?.data?.result?.error?.message || "owned sequencing.applyBatchPlan failed"));
    }
    batchExecuted = true;
  };

  for (const command of commands) {
    if (ownedBatchPlan && batchCommandSet.has(command)) {
      await executeBatch();
      continue;
    }
    if (directOwnedCommandKind(command)) {
      await executeOwnedDirectCommand({ endpoint, command, deps: { ...directDeps, getOwnedJob, getOwnedHealth } });
      directExecuted += 1;
      continue;
    }
  }
  await executeBatch();
  return {
    jobId,
    batchExecuted,
    directExecuted,
    applyPath: batchExecuted && directExecuted
      ? "owned_batch_plan_plus_direct"
      : batchExecuted
        ? "owned_batch_plan"
        : "owned_direct_commands"
  };
}

async function waitForOwnedJob(endpoint, jobId, getOwnedJob, getOwnedHealth = null, attempts = 40, delayMs = 500) {
  for (let idx = 0; idx < attempts; idx += 1) {
    if (typeof getOwnedHealth === "function") {
      const health = await getOwnedHealth(endpoint);
      const data = health?.data && typeof health.data === "object" ? health.data : {};
      if (ownedModalStateBlocked(data)) {
        throw new Error(`Owned xLights job ${jobId} is blocked by ${describeOwnedModalBlock(data)}`);
      }
    }
    const body = await getOwnedJob(endpoint, jobId);
    const state = str(body?.data?.state).toLowerCase();
    if (state === "succeeded" || state === "completed") return body;
    if (state === "failed") return body;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error(`Timed out waiting for owned xLights job ${jobId}.`);
}

export async function validateAndApplyPlan({
  endpoint,
  commands,
  expectedRevision = 'unknown',
  applySequencingBatchPlan = null,
  getOwnedJob = null,
  getOwnedHealth = null,
  getOwnedRevision = null,
  createTimingTrack = null,
  insertTimingMarks = null,
  replaceTimingMarks = null,
  setDisplayElementOrder = null,
  updateEffect = null,
  deleteEffects = null,
  cloneEffects = null,
  deleteEffectLayer = null,
  reorderEffectLayer = null,
  compactEffectLayers = null,
  safetyOptions = {}
} = {}) {
  if (!endpoint) throw new Error('endpoint is required');

  const safety = evaluatePlanSafety(commands, safetyOptions);
  if (!safety.ok) {
    return {
      ok: false,
      stage: 'safety',
      error: safety.errors.join('\n'),
      details: safety
    };
  }

  const graph = validateCommandGraph(commands);
  if (!graph.ok) {
    return {
      ok: false,
      stage: "graph",
      error: graph.errors.join("\n"),
      details: graph
    };
  }

  const batchSelection = buildOwnedBatchSelection(commands);
  const batchCommands = batchSelection.commands;
  const ownedBatchPlan = batchSelection.plan;
  const batchRequiresPlan = batchCommands.some((command) => str(command?.cmd) === "effects.create");
  const directCommands = (Array.isArray(commands) ? commands : []).filter((command) => {
    if (!directOwnedCommandKind(command)) return false;
    return !(ownedBatchPlan && batchSelection.commandSet.has(command));
  });
  const unsupportedCommands = (Array.isArray(commands) ? commands : []).filter((command) => {
    if (ownedBatchPlan && batchSelection.commandSet.has(command)) return false;
    if (directOwnedCommandKind(command)) return false;
    return true;
  });
  if (unsupportedCommands.length || (batchRequiresPlan && !ownedBatchPlan) || (!ownedBatchPlan && !directCommands.length)) {
    return {
      ok: false,
      stage: "unsupported",
      error: "Command graph cannot be expressed as an owned xLights batch plan.",
      details: {
        commandCount: Array.isArray(commands) ? commands.length : 0,
        batchCommandCount: batchCommands.length,
        unsupportedCommands: unsupportedCommands.map((command) => str(command?.cmd)).filter(Boolean)
      }
    };
  }
  if (ownedBatchPlan && typeof applySequencingBatchPlan !== "function") {
    return {
      ok: false,
      stage: "runtime",
      error: "owned sequencing.applyBatchPlan function is required"
    };
  }
  if (typeof getOwnedJob !== "function") {
    return {
      ok: false,
      stage: "runtime",
      error: "owned job polling function is required"
    };
  }
  const directDeps = {
    createTimingTrack,
    insertTimingMarks,
    replaceTimingMarks,
    setDisplayElementOrder,
    updateEffect,
    deleteEffects,
    cloneEffects,
    deleteEffectLayer,
    reorderEffectLayer,
    compactEffectLayers
  };
  const missingDirectFns = requiredOwnedDirectFns(directDeps, directCommands);
  if (missingDirectFns.length) {
    return {
      ok: false,
      stage: "runtime",
      error: `owned direct command functions are required: ${missingDirectFns.join(", ")}`
    };
  }
  let currentRevision = 'unknown';
  let ownedApiReady = false;
  let ownedHealthError = "";
  let ownedHealth = null;

  if (typeof getOwnedHealth !== "function") {
    return {
      ok: false,
      stage: "runtime",
      error: "owned xLights API health probe is required"
    };
  }
  try {
    ownedHealth = await getOwnedHealth(endpoint);
    ownedApiReady = isOwnedHealthReady(ownedHealth);
    if (typeof getOwnedRevision === 'function') {
      const rev = await getOwnedRevision(endpoint).catch(() => ({ data: { revision: 'unknown' } }));
      currentRevision = str(rev?.data?.revision || rev?.data?.revisionToken || 'unknown') || 'unknown';
    }
  } catch (err) {
    ownedApiReady = false;
    ownedHealthError = str(err?.message || err);
  }

  if (!ownedApiReady) {
    const state = str(ownedHealth?.data?.state || ownedHealth?.data?.startupState || "unknown") || "unknown";
    const modalBlocked = ownedModalStateBlocked(ownedHealth?.data || {});
    const reason = ownedHealthError || (modalBlocked ? `owned xLights API blocked by xLights modal (state=${state})` : `owned xLights API not ready (state=${state})`);
    return {
      ok: false,
      stage: "runtime",
      error: `owned xLights API unavailable: ${reason}`
    };
  }

  // currentRevision is populated from the owned revision path above when available.

  if (
    expectedRevision &&
    expectedRevision !== 'unknown' &&
    currentRevision !== 'unknown' &&
    currentRevision !== expectedRevision
  ) {
    return {
      ok: false,
      stage: 'revision',
      error: `Revision mismatch. expected=${expectedRevision} current=${currentRevision}`,
      details: { expectedRevision, currentRevision }
    };
  }

  try {
    const execution = await executeOwnedCommandPlan({
      endpoint,
      commands: Array.isArray(commands) ? commands : [],
      ownedBatchPlan,
      applySequencingBatchPlan,
      getOwnedJob,
      getOwnedHealth,
      directDeps,
      batchCommandSet: batchSelection.commandSet
    });
    const postRev = typeof getOwnedRevision === 'function'
      ? await getOwnedRevision(endpoint).catch(() => ({ data: { revision: currentRevision } }))
      : { data: { revision: currentRevision } };
    const nextRevision = str(postRev?.data?.revision || postRev?.data?.revisionToken || currentRevision) || currentRevision;
    return {
      ok: true,
      stage: "done",
      executedCount: Array.isArray(commands) ? commands.length : 0,
      jobId: execution.jobId,
      currentRevision,
      nextRevision,
      warnings: safety.warnings,
      directExecuted: execution.directExecuted,
      applyPath: execution.applyPath
    };
  } catch (err) {
    const message = str(err?.message || err);
    return {
      ok: false,
      stage: "runtime",
      error: `owned sequencing.applyBatchPlan failed: ${message}`
    };
  }
}
