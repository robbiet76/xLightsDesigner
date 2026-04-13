const DEFAULT_ENDPOINT = "http://127.0.0.1:49915/xlightsdesigner/api";
const DEFAULT_OWNED_ENDPOINT_BASE = "http://127.0.0.1:49915/xlightsdesigner/api";
const DEFAULT_LEGACY_ENDPOINT = "http://127.0.0.1:49914/xlDoAutomation";
const DEFAULT_LEGACY_PORT = "49914";
const OWNED_JOB_ATTEMPTS = 180;
const OWNED_JOB_DELAY_MS = 500;

function normalizeBody(raw) {
  const idx = raw.indexOf("{");
  return idx >= 0 ? raw.slice(idx) : raw;
}

function sanitizeEndpoint(endpoint) {
  return String(endpoint || "").trim();
}

function detectDevOwnedProxyBase() {
  try {
    const origin = String(window?.location?.origin || "").trim();
    if (/^https?:\/\/(127\.0\.0\.1|localhost):8080$/i.test(origin)) {
      return `${origin}/xlightsdesigner/api`;
    }
  } catch {
    // ignore browser/global access failures
  }
  return "";
}

function isOwnedEndpoint(endpoint) {
  const raw = sanitizeEndpoint(endpoint);
  return raw.includes("/xlightsdesigner/api") || /:49915(?:\/|$)/.test(raw);
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
  if (!raw) return `http://127.0.0.1:${DEFAULT_LEGACY_PORT}`;
  if (isOwnedEndpoint(raw)) {
    try {
      const url = new URL(raw);
      return `${url.protocol}//${url.hostname}:${DEFAULT_LEGACY_PORT}`;
    } catch {
      return `http://127.0.0.1:${DEFAULT_LEGACY_PORT}`;
    }
  }
  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.hostname}:${url.port || DEFAULT_LEGACY_PORT}`;
  } catch {
    return `http://127.0.0.1:${DEFAULT_LEGACY_PORT}`;
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
  return detectDevOwnedProxyBase() || DEFAULT_ENDPOINT;
}

export function deriveOwnedEndpointBase(endpoint) {
  const raw = sanitizeEndpoint(endpoint);
  const devProxyBase = detectDevOwnedProxyBase();
  if (!raw) return devProxyBase || DEFAULT_OWNED_ENDPOINT_BASE;
  if (raw.includes("/xlightsdesigner/api")) {
    if (
      devProxyBase &&
      (/^https?:\/\/127\.0\.0\.1:49915\/xlightsdesigner\/api/i.test(raw) ||
        /^https?:\/\/localhost:49915\/xlightsdesigner\/api/i.test(raw))
    ) {
      return devProxyBase;
    }
    return sanitizeOwnedBase(raw);
  }
  try {
    const url = new URL(raw);
    if (
      devProxyBase &&
      (url.hostname === "127.0.0.1" || url.hostname === "localhost") &&
      url.port === "49915"
    ) {
      return devProxyBase;
    }
    return `${url.protocol}//${url.hostname}:49915/xlightsdesigner/api`;
  } catch {
    return devProxyBase || DEFAULT_OWNED_ENDPOINT_BASE;
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeOwnedAccepted(command, json = {}) {
  return {
    ok: true,
    res: json?.statusCode || 202,
    command,
    data: {
      ...(json?.data && typeof json.data === "object" ? json.data : {}),
      queued: true
    }
  };
}

function normalizeOwnedCompleted(command, json = {}) {
  return {
    ok: true,
    res: json?.statusCode || 200,
    command,
    data: json?.data && typeof json.data === "object" ? json.data : {}
  };
}

function normalizeOwnedJobResult(command, settled = {}) {
  const state = String(settled?.data?.state || "").trim().toLowerCase();
  const result = settled?.data?.result && typeof settled.data.result === "object" ? settled.data.result : null;
  if (!result) {
    throw new Error(`Owned xLights job for ${command} returned no result payload`);
  }
  if (state === "failed" || result?.ok !== true) {
    const code = result?.error?.code || "OWNED_JOB_FAILED";
    const message = result?.error?.message || `${command} failed`;
    throw new Error(`${command} failed (${code}): ${message}`);
  }
  return {
    ok: true,
    res: result?.statusCode || 200,
    command,
    data: result?.data && typeof result.data === "object" ? result.data : {}
  };
}

async function waitForOwnedJobResult(endpoint, command, jobId, attempts = OWNED_JOB_ATTEMPTS, delayMs = OWNED_JOB_DELAY_MS) {
  const normalizedJobId = String(jobId || "").trim();
  if (!normalizedJobId) {
    throw new Error(`Owned xLights ${command} returned no jobId`);
  }
  for (let index = 0; index < attempts; index += 1) {
    const settled = await getOwnedJob(endpoint, normalizedJobId);
    const state = String(settled?.data?.state || "").trim().toLowerCase();
    if (state === "queued" || state === "running") {
      await sleep(delayMs);
      continue;
    }
    return normalizeOwnedJobResult(command, settled);
  }
  throw new Error(`Timed out waiting for owned xLights job ${normalizedJobId} (${command})`);
}

async function readOwnedGet(endpoint, path, params = {}) {
  const base = deriveOwnedEndpointBase(endpoint);
  const url = new URL(`${base}${path}`);
  for (const [key, value] of Object.entries(params || {})) {
    if (value == null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return readOwnedJson(url.toString(), { method: "GET" });
}

async function readOwnedPost(endpoint, path, body = {}, { command = path, queued = false } = {}) {
  const base = deriveOwnedEndpointBase(endpoint);
  const json = await readOwnedJson(`${base}${path}`, { method: "POST", body });
  if (!queued) {
    return normalizeOwnedCompleted(command, json);
  }
  return waitForOwnedJobResult(endpoint, command, json?.data?.jobId);
}

export async function pingCapabilities(endpoint) {
  if (isOwnedEndpoint(endpoint)) {
    const health = await getOwnedHealth(endpoint);
    return {
      ok: true,
      res: 200,
      data: {
        version: "xlightsdesigner-owned-api",
        commands: [
          "sequence.getOpen",
          "sequence.getRevision",
          "sequence.getSettings",
          "sequence.renderCurrent",
          "sequence.getRenderSamples",
          "sequence.open",
          "sequence.create",
          "sequence.save",
          "timing.getTracks",
          "timing.getMarks",
          "timing.ensureTrack",
          "timing.addMarks",
          "media.getCurrent",
          "layout.getModels",
          "elements.getSummary",
          "effects.getWindow",
          "effects.applyBatch",
          "sequencing.applyBatchPlan"
        ],
        runtimeState: health?.data?.state || ""
      }
    };
  }
  return postCommand(endpoint, "system.getCapabilities", {});
}

export async function getSystemVersion(endpoint) {
  if (isOwnedEndpoint(endpoint)) {
    const health = await getOwnedHealth(endpoint);
    return {
      ok: true,
      res: 200,
      data: {
        version: health?.data?.state ? `owned-api:${health.data.state}` : "owned-api"
      }
    };
  }
  return postCommand(endpoint, "system.getVersion", {});
}

export async function getOpenSequence(endpoint) {
  if (isOwnedEndpoint(endpoint)) {
    return normalizeOwnedCompleted("sequence.getOpen", await readOwnedGet(endpoint, "/sequence/open"));
  }
  return postCommand(endpoint, "sequence.getOpen", {});
}

export async function getSequenceSettings(endpoint) {
  if (isOwnedEndpoint(endpoint)) {
    return normalizeOwnedCompleted("sequence.getSettings", await readOwnedGet(endpoint, "/sequence/settings"));
  }
  return postCommand(endpoint, "sequence.getSettings", {});
}

export async function renderCurrentSequence(endpoint) {
  if (isOwnedEndpoint(endpoint)) {
    return readOwnedPost(endpoint, "/sequence/render-current", {}, { command: "sequence.renderCurrent", queued: true });
  }
  return postCommand(endpoint, "sequence.renderCurrent", {});
}

export async function getMediaStatus(endpoint) {
  if (isOwnedEndpoint(endpoint)) {
    const owned = await readOwnedGet(endpoint, "/media/current");
    return {
      ok: true,
      res: 200,
      command: "media.getStatus",
      data: {
        sequenceOpen: Boolean(owned?.data?.sequenceOpen),
        sequencePath: owned?.data?.sequencePath || "",
        mediaFile: owned?.data?.mediaFile || "",
        showDirectory: owned?.data?.showDirectory || ""
      }
    };
  }
  return postCommand(endpoint, "media.getStatus", {});
}

export async function getMediaMetadata(endpoint) {
  return postCommand(endpoint, "media.getMetadata", {});
}

export async function getRevision(endpoint) {
  const res = isOwnedEndpoint(endpoint)
    ? normalizeOwnedCompleted("sequence.getRevision", await readOwnedGet(endpoint, "/sequence/revision"))
    : await postCommand(endpoint, "sequence.getRevision", {});
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
  if (isOwnedEndpoint(endpoint)) {
    return readOwnedPost(endpoint, "/sequence/open", {
      file,
      force,
      promptIssues
    }, { command: "sequence.open", queued: true });
  }
  return postCommand(endpoint, "sequence.open", {
    file,
    force,
    promptIssues
  });
}

export async function createSequence(endpoint, params = {}) {
  if (isOwnedEndpoint(endpoint)) {
    return readOwnedPost(endpoint, "/sequence/create", params, { command: "sequence.create", queued: true });
  }
  return postCommand(endpoint, "sequence.create", params);
}

export async function setSequenceSettings(endpoint, params = {}) {
  return postCommand(endpoint, "sequence.setSettings", params);
}

export async function saveSequence(endpoint, file = null) {
  if (isOwnedEndpoint(endpoint)) {
    return readOwnedPost(endpoint, "/sequence/save", file ? { file } : {}, { command: "sequence.save", queued: true });
  }
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

export async function getRenderedSequenceSamples(endpoint, params = {}) {
  if (isOwnedEndpoint(endpoint)) {
    return readOwnedPost(endpoint, "/sequence/render-samples", params, {
      command: "sequence.getRenderSamples",
      queued: false
    });
  }
  return postCommand(endpoint, "sequence.getRenderSamples", params);
}

export async function closeSequence(endpoint, force = true, quiet = false) {
  if (isOwnedEndpoint(endpoint)) {
    return {
      ok: true,
      res: 200,
      command: "sequence.close",
      data: {
        closed: false,
        unsupported: true,
        force,
        quiet
      }
    };
  }
  return postCommand(endpoint, "sequence.close", {
    force,
    quiet
  });
}

export async function getModels(endpoint) {
  if (isOwnedEndpoint(endpoint)) {
    return normalizeOwnedCompleted("layout.getModels", await readOwnedGet(endpoint, "/layout/models"));
  }
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
  if (isOwnedEndpoint(endpoint)) {
    const owned = await readOwnedGet(endpoint, "/elements/summary");
    return normalizeOwnedCompleted("elements.getSummary", owned);
  }
  return postCommand(endpoint, "layout.getDisplayElements", {});
}

export async function getDisplayElementOrder(endpoint) {
  if (isOwnedEndpoint(endpoint)) {
    const owned = await readOwnedGet(endpoint, "/elements/summary");
    const elements = Array.isArray(owned?.data?.elements) ? owned.data.elements : [];
    return {
      ok: true,
      res: 200,
      command: "sequencer.getDisplayElementOrder",
      data: {
        elements: elements.map((row) => String(row?.name || "").trim()).filter(Boolean)
      }
    };
  }
  return postCommand(endpoint, "sequencer.getDisplayElementOrder", {});
}

export async function getSubmodels(endpoint) {
  if (isOwnedEndpoint(endpoint)) {
    return {
      ok: true,
      res: 200,
      command: "layout.getSubmodels",
      data: { submodels: [] }
    };
  }
  return postCommand(endpoint, "layout.getSubmodels", {});
}

export async function getSubmodelDetail(endpoint, name, parentId = "") {
  const params = { name };
  if (String(parentId || "").trim()) params.parentId = String(parentId).trim();
  return postCommand(endpoint, "layout.getSubmodelDetail", params);
}

export async function getTimingTracks(endpoint) {
  if (isOwnedEndpoint(endpoint)) {
    return normalizeOwnedCompleted("timing.getTracks", await readOwnedGet(endpoint, "/timing/tracks"));
  }
  return postCommand(endpoint, "timing.getTracks", {});
}

export async function getTimingMarks(endpoint, trackName) {
  if (isOwnedEndpoint(endpoint)) {
    return normalizeOwnedCompleted(
      "timing.getMarks",
      await readOwnedGet(endpoint, "/timing/marks", { track: trackName })
    );
  }
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
  if (isOwnedEndpoint(endpoint)) {
    return {
      ok: true,
      res: 200,
      command: "effects.listDefinitions",
      data: { effects: [] }
    };
  }
  return postCommand(endpoint, "effects.listDefinitions", {});
}

export async function getEffectDefinition(endpoint, effectName) {
  return postCommand(endpoint, "effects.getDefinition", { effectName });
}

export async function listEffects(endpoint, params = {}) {
  if (isOwnedEndpoint(endpoint)) {
    const element = String(params?.element || params?.modelName || "").trim();
    const startMs = Number(params?.startMs);
    const endMs = Number(params?.endMs);
    const owned = await readOwnedGet(endpoint, "/effects/window", {
      element,
      startMs,
      endMs
    });
    const effects = Array.isArray(owned?.data?.effects) ? owned.data.effects : [];
    const layerIndex = Number(params?.layerIndex);
    return {
      ok: true,
      res: 200,
      command: "effects.list",
      data: {
        effects: effects
          .map((row) => ({
            ...row,
            layerIndex: Number(row?.layerIndex ?? row?.layerNumber ?? 0)
          }))
          .filter((row) => !Number.isFinite(layerIndex) || row.layerIndex === layerIndex)
      }
    };
  }
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
  return readOwnedGet(endpoint, "/jobs/get", { jobId: String(jobId || "").trim() });
}

export async function getOwnedHealth(endpoint) {
  return readOwnedGet(endpoint, "/health");
}

export async function getOwnedSequenceRevision(endpoint) {
  return readOwnedGet(endpoint, "/sequence/revision");
}

export async function applySequencingBatchPlan(endpoint, payload = {}) {
  const base = deriveOwnedEndpointBase(endpoint);
  return readOwnedJson(`${base}/sequencing/apply-batch-plan`, {
    method: "POST",
    body: payload
  });
}
