const DEFAULT_ENDPOINT = "http://127.0.0.1:49914/xlDoAutomation";

function normalizeBody(raw) {
  const idx = raw.indexOf("{");
  return idx >= 0 ? raw.slice(idx) : raw;
}

function sanitizeEndpoint(endpoint) {
  return String(endpoint || "").trim();
}

export function getDefaultEndpoint() {
  return DEFAULT_ENDPOINT;
}

export async function postCommand(endpoint, cmd, params = {}, options = {}) {
  const payload = {
    apiVersion: 2,
    cmd,
    params,
    options
  };
  const targetEndpoint = sanitizeEndpoint(endpoint);

  const response = await fetch(targetEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  const normalized = normalizeBody(text);
  let json;
  try {
    json = JSON.parse(normalized);
  } catch (err) {
    throw new Error(`Invalid JSON from xLights endpoint ${targetEndpoint} (${err.message})`);
  }

  if (json.res !== 200) {
    const code = json?.error?.code || "UNKNOWN";
    const message = json?.error?.message || "Command failed";
    throw new Error(`${cmd} failed (${code}): ${message}`);
  }

  return json;
}

export async function pingCapabilities(endpoint) {
  return postCommand(endpoint, "system.getCapabilities", {});
}

export async function getSystemVersion(endpoint) {
  return postCommand(endpoint, "system.getVersion", {});
}

export async function getOpenSequence(endpoint) {
  return postCommand(endpoint, "sequence.getOpen", {});
}

export async function getMediaStatus(endpoint) {
  return postCommand(endpoint, "media.getStatus", {});
}

export async function getMediaMetadata(endpoint) {
  return postCommand(endpoint, "media.getMetadata", {});
}

export async function getRevision(endpoint) {
  return postCommand(endpoint, "sequence.getRevision", {});
}

export async function openSequence(endpoint, file, force = true, promptIssues = false) {
  return postCommand(endpoint, "sequence.open", {
    file,
    force,
    promptIssues
  });
}

export async function createSequence(endpoint, params = {}) {
  return postCommand(endpoint, "sequence.create", params);
}

export async function saveSequence(endpoint, file = null) {
  const params = {};
  if (file) params.file = file;
  return postCommand(endpoint, "sequence.save", params);
}

export async function closeSequence(endpoint, force = true, quiet = false) {
  return postCommand(endpoint, "sequence.close", {
    force,
    quiet
  });
}

export async function getModels(endpoint) {
  return postCommand(endpoint, "layout.getModels", {});
}

export async function getModel(endpoint, name) {
  return postCommand(endpoint, "layout.getModel", { name });
}

export async function getModelGroupMembers(endpoint, name) {
  return postCommand(endpoint, "layout.getModelGroupMembers", { name });
}

export async function getModelGeometry(endpoint, name) {
  return postCommand(endpoint, "layout.getModelGeometry", { name });
}

export async function getModelNodes(endpoint, params = {}) {
  return postCommand(endpoint, "layout.getModelNodes", params);
}

export async function getCameras(endpoint) {
  return postCommand(endpoint, "layout.getCameras", {});
}

export async function getLayoutScene(endpoint, params = {}) {
  return postCommand(endpoint, "layout.getScene", params);
}

export async function getLayoutViews(endpoint) {
  return postCommand(endpoint, "layout.getViews", {});
}

export async function getDisplayElements(endpoint) {
  return postCommand(endpoint, "layout.getDisplayElements", {});
}

export async function getDisplayElementOrder(endpoint) {
  return postCommand(endpoint, "sequencer.getDisplayElementOrder", {});
}

export async function getSubmodels(endpoint) {
  return postCommand(endpoint, "layout.getSubmodels", {});
}

export async function getSubmodelDetail(endpoint, name, parentId = "") {
  const params = { name };
  if (String(parentId || "").trim()) params.parentId = String(parentId).trim();
  return postCommand(endpoint, "layout.getSubmodelDetail", params);
}

export async function getTimingTracks(endpoint) {
  return postCommand(endpoint, "timing.getTracks", {});
}

export async function getTimingMarks(endpoint, trackName) {
  return postCommand(endpoint, "timing.getMarks", {
    trackName
  });
}

export async function listTimingAnalysisPlugins(endpoint) {
  return postCommand(endpoint, "timing.listAnalysisPlugins", {});
}

export async function createTimingTrack(endpoint, params = {}) {
  return postCommand(endpoint, "timing.createTrack", params);
}

export async function replaceTimingMarks(endpoint, params = {}) {
  return postCommand(endpoint, "timing.replaceMarks", params);
}

export async function insertTimingMarks(endpoint, params = {}) {
  return postCommand(endpoint, "timing.insertMarks", params);
}

export async function createTimingFromAudio(endpoint, params = {}) {
  return postCommand(endpoint, "timing.createFromAudio", params);
}

export async function createBarsFromBeats(endpoint, params = {}) {
  return postCommand(endpoint, "timing.createBarsFromBeats", params);
}

export async function detectSongStructure(endpoint, params = {}) {
  return postCommand(endpoint, "timing.detectSongStructure", params);
}

export async function getEffectDefinitions(endpoint) {
  return postCommand(endpoint, "effects.listDefinitions", {});
}

export async function getEffectDefinition(endpoint, effectName) {
  return postCommand(endpoint, "effects.getDefinition", { effectName });
}

export async function listEffects(endpoint, params = {}) {
  return postCommand(endpoint, "effects.list", params);
}

export async function validateCommands(endpoint, commands) {
  return postCommand(endpoint, "system.validateCommands", {
    commands
  });
}

export async function beginTransaction(endpoint) {
  return postCommand(endpoint, "transactions.begin", {});
}

export async function commitTransaction(endpoint, transactionId, expectedRevision = null) {
  const params = { transactionId };
  if (expectedRevision != null && String(expectedRevision).trim()) {
    params.expectedRevision = String(expectedRevision).trim();
  }
  return postCommand(endpoint, "transactions.commit", params);
}

export async function rollbackTransaction(endpoint, transactionId) {
  return postCommand(endpoint, "transactions.rollback", {
    transactionId
  });
}

export async function stageTransactionCommand(endpoint, transactionId, command = {}) {
  const cmd = String(command?.cmd || "").trim();
  if (!cmd) {
    throw new Error("stageTransactionCommand requires command.cmd");
  }
  const params = command?.params && typeof command.params === "object" ? { ...command.params } : {};
  params.transactionId = transactionId;
  const options = command?.options && typeof command.options === "object" ? command.options : {};
  return postCommand(endpoint, cmd, params, options);
}

export async function getJob(endpoint, jobId) {
  return postCommand(endpoint, "jobs.get", {
    jobId
  });
}

export async function cancelJob(endpoint, jobId) {
  return postCommand(endpoint, "jobs.cancel", {
    jobId
  });
}
