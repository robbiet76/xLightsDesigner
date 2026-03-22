const DEFAULT_ENDPOINT = "http://127.0.0.1:49914/xlDoAutomation";
const DEFAULT_OWNED_ENDPOINT_BASE = "http://127.0.0.1:49915/xlightsdesigner/api";

function normalizeBody(raw) {
  const idx = raw.indexOf("{");
  return idx >= 0 ? raw.slice(idx) : raw;
}

function sanitizeEndpoint(endpoint) {
  return String(endpoint || "").trim();
}

function buildCommandEndpointCandidates(endpoint) {
  const raw = sanitizeEndpoint(endpoint);
  const candidates = [];
  if (raw) candidates.push(raw);
  try {
    const url = new URL(raw);
    const isDevProxy =
      (url.hostname === "127.0.0.1" || url.hostname === "localhost") &&
      url.port === "8080" &&
      url.pathname === "/xlDoAutomation";
    if (isDevProxy) {
      candidates.push("http://127.0.0.1:49914/xlDoAutomation");
      candidates.push("http://127.0.0.1:49913/xlDoAutomation");
    }
  } catch {
    // ignore malformed endpoint; caller will fail on the original target
  }
  return [...new Set(candidates.filter(Boolean))];
}

function sanitizeOwnedBase(endpoint) {
  return String(endpoint || "").trim().replace(/\/+$/, "");
}

function deriveLegacyEndpointBase(endpoint) {
  const raw = sanitizeEndpoint(endpoint);
  if (!raw) return "http://127.0.0.1:49914";
  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.hostname}:${url.port || "49914"}`;
  } catch {
    return "http://127.0.0.1:49914";
  }
}

function readTextWithXHR(targetEndpoint, bodyText) {
  return new Promise((resolve, reject) => {
    if (typeof XMLHttpRequest !== "function") {
      reject(new Error("XMLHttpRequest unavailable"));
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open("POST", targetEndpoint, true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onload = () => resolve(String(xhr.responseText || ""));
    xhr.onerror = () => reject(new Error(`XHR request failed for ${targetEndpoint}`));
    xhr.ontimeout = () => reject(new Error(`XHR request timed out for ${targetEndpoint}`));
    xhr.send(bodyText);
  });
}

async function readResponseText(targetEndpoint, bodyText) {
  try {
    const response = await fetch(targetEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bodyText
    });
    return await response.text();
  } catch (err) {
    if (typeof XMLHttpRequest === "function") {
      return readTextWithXHR(targetEndpoint, bodyText);
    }
    throw err;
  }
}

async function readOwnedJson(targetEndpoint, { method = "GET", body = null } = {}) {
  const response = await fetch(targetEndpoint, {
    method,
    headers: body == null ? undefined : { "Content-Type": "application/json" },
    body: body == null ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (err) {
    throw new Error(`Invalid JSON from xLights owned endpoint ${targetEndpoint} (${err.message})`);
  }
  if (json?.ok !== true) {
    const code = json?.error?.code || "UNKNOWN";
    const message = json?.error?.message || "Request failed";
    throw new Error(`${method} ${targetEndpoint} failed (${code}): ${message}`);
  }
  return json;
}

async function legacyGet(endpoint, command, params = {}) {
  const base = deriveLegacyEndpointBase(endpoint);
  const url = new URL(`${base}/${command}`);
  for (const [key, value] of Object.entries(params || {})) {
    if (value == null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  const response = await fetch(url.toString(), { method: "GET" });
  const text = String(await response.text());
  if (!response.ok) {
    throw new Error(`${command} failed (${response.status}): ${text || "Command failed"}`);
  }
  return text;
}

export function getDefaultEndpoint() {
  return DEFAULT_ENDPOINT;
}

export function deriveOwnedEndpointBase(endpoint) {
  const raw = sanitizeEndpoint(endpoint);
  if (!raw) return DEFAULT_OWNED_ENDPOINT_BASE;
  if (raw.includes("/xlightsdesigner/api")) {
    return sanitizeOwnedBase(raw);
  }
  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.hostname}:49915/xlightsdesigner/api`;
  } catch {
    return DEFAULT_OWNED_ENDPOINT_BASE;
  }
}

export async function postCommand(endpoint, cmd, params = {}, options = {}) {
  const payload = {
    apiVersion: 2,
    cmd,
    params,
    options
  };
  const endpointCandidates = buildCommandEndpointCandidates(endpoint);
  const errors = [];

  for (const targetEndpoint of endpointCandidates) {
    try {
      const text = await readResponseText(targetEndpoint, JSON.stringify(payload));
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
    } catch (err) {
      errors.push(String(err?.message || err || "unknown command error"));
    }
  }
  throw new Error(errors[errors.length - 1] || `${cmd} failed`);
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

export async function getSequenceSettings(endpoint) {
  return postCommand(endpoint, "sequence.getSettings", {});
}

export async function getMediaStatus(endpoint) {
  return postCommand(endpoint, "media.getStatus", {});
}

export async function getMediaMetadata(endpoint) {
  return postCommand(endpoint, "media.getMetadata", {});
}

export async function getRevision(endpoint) {
  const res = await postCommand(endpoint, "sequence.getRevision", {});
  if (res?.ok !== true || !res?.data || typeof res.data !== "object") return res;
  const revision = String(res.data.revision ?? res.data.revisionToken ?? "").trim();
  return {
    ...res,
    data: {
      ...res.data,
      revision: revision || "unknown"
    }
  };
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

export async function setSequenceSettings(endpoint, params = {}) {
  return postCommand(endpoint, "sequence.setSettings", params);
}

export async function saveSequence(endpoint, file = null) {
  const params = {};
  if (file) params.file = file;
  try {
    return await postCommand(endpoint, "sequence.save", params);
  } catch (err) {
    const message = String(err?.message || "");
    const shouldFallback =
      message.includes("sequence.save failed") ||
      message.includes("Invalid JSON from xLights endpoint") ||
      message.includes("Could not process xLights Automation");
    if (!shouldFallback) {
      throw err;
    }
    const legacyText = await legacyGet(endpoint, "saveSequence", file ? { seq: file } : {});
    return {
      res: 200,
      msg: legacyText,
      data: {
        saved: true,
        file: file || null,
        fallback: "legacySaveSequence"
      }
    };
  }
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

export async function getOwnedJob(endpoint, jobId) {
  const base = deriveOwnedEndpointBase(endpoint);
  const target = `${base}/jobs/get?jobId=${encodeURIComponent(String(jobId || "").trim())}`;
  return readOwnedJson(target, { method: "GET" });
}

export async function getOwnedHealth(endpoint) {
  const base = deriveOwnedEndpointBase(endpoint);
  return readOwnedJson(`${base}/health`, { method: "GET" });
}

export async function getOwnedSequenceRevision(endpoint) {
  const base = deriveOwnedEndpointBase(endpoint);
  return readOwnedJson(`${base}/sequence/revision`, { method: "GET" });
}

export async function applySequencingBatchPlan(endpoint, payload = {}) {
  const base = deriveOwnedEndpointBase(endpoint);
  return readOwnedJson(`${base}/sequencing/apply-batch-plan`, {
    method: "POST",
    body: payload
  });
}
