import { STAGE1_TRAINED_EFFECT_BUNDLE } from "./agent/sequence-agent/generated/stage1-trained-effect-bundle.js";

const DEFAULT_ENDPOINT = "http://127.0.0.1:49915/xlightsdesigner/api";
const DEFAULT_OWNED_ENDPOINT_BASE = "http://127.0.0.1:49915/xlightsdesigner/api";
const OWNED_JOB_ATTEMPTS = 180;
const OWNED_JOB_DELAY_MS = 500;

function boolish(value) {
  if (value === true || value === false) return value;
  const text = String(value ?? "").trim().toLowerCase();
  if (text === "true" || text === "1" || text === "yes") return true;
  if (text === "false" || text === "0" || text === "no") return false;
  return false;
}

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

function trainedEffectDefinitions() {
  const effectsByName = STAGE1_TRAINED_EFFECT_BUNDLE?.effectsByName && typeof STAGE1_TRAINED_EFFECT_BUNDLE.effectsByName === "object"
    ? STAGE1_TRAINED_EFFECT_BUNDLE.effectsByName
    : {};
  return Object.values(effectsByName)
    .map((row) => ({ effectName: String(row?.effectName || "").trim(), params: [] }))
    .filter((row) => row.effectName);
}

function sanitizeOwnedBase(endpoint) {
  return String(endpoint || "").trim().replace(/\/+$/, "");
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
  const targetEndpoint = sanitizeEndpoint(endpoint);
  if (!targetEndpoint) {
    throw new Error(`${cmd} failed: endpoint is required`);
  }
  const payload = {
    apiVersion: 2,
    cmd,
    params,
    options
  };

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

export function isOwnedHealthReady(health, { requireSettled = true } = {}) {
  const data = health?.data && typeof health.data === "object" ? health.data : {};
  const state = String(data.state || data.startupState || data.status || "").trim().toLowerCase();
  const listenerReachable = boolish(data.listenerReachable);
  const appReady = data.appReady == null ? true : boolish(data.appReady);
  const startupSettled = boolish(data.startupSettled) || state === "ready";
  if (health?.ok !== true) return false;
  if (!listenerReachable) return false;
  if (!appReady) return false;
  if (requireSettled && !startupSettled) return false;
  return true;
}

async function ensureOwnedReady(endpoint, command, { requireSettled = true } = {}) {
  const health = await getOwnedHealth(endpoint);
  if (isOwnedHealthReady(health, { requireSettled })) {
    return health;
  }
  const data = health?.data && typeof health.data === "object" ? health.data : {};
  const retryAfterMs = Number(data.retryAfterMs ?? data.settleRemainingMs ?? 0);
  const state = String(data.state || data.startupState || "unknown").trim() || "unknown";
  const details = [];
  if (!boolish(data.listenerReachable)) details.push("listener unreachable");
  if (data.appReady === false || String(data.appReady).trim().toLowerCase() === "false") details.push("app not ready");
  if (requireSettled && !boolish(data.startupSettled) && state.toLowerCase() !== "ready") details.push("startup not settled");
  const reason = details.length ? details.join(", ") : `state=${state}`;
  const retryText = Number.isFinite(retryAfterMs) && retryAfterMs > 0 ? ` retryAfterMs=${retryAfterMs}` : "";
  throw new Error(`Owned xLights API not ready for ${command}: ${reason}.${retryText}`.trim());
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
          "layout.getScene",
          "elements.getSummary",
          "effects.getWindow",
          "effects.applyBatch",
          "effects.clone",
          "sequencing.applyBatchPlan",
          "jobs.get"
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
    await ensureOwnedReady(endpoint, "sequence.renderCurrent");
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
    await ensureOwnedReady(endpoint, "sequence.open");
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
    await ensureOwnedReady(endpoint, "sequence.create");
    return readOwnedPost(endpoint, "/sequence/create", params, { command: "sequence.create", queued: true });
  }
  return postCommand(endpoint, "sequence.create", params);
}

export async function setSequenceSettings(endpoint, params = {}) {
  return postCommand(endpoint, "sequence.setSettings", params);
}

export async function saveSequence(endpoint, file = null) {
  if (isOwnedEndpoint(endpoint)) {
    await ensureOwnedReady(endpoint, "sequence.save");
    return readOwnedPost(endpoint, "/sequence/save", file ? { file } : {}, { command: "sequence.save", queued: true });
  }
  const params = {};
  if (file) params.file = file;
  return postCommand(endpoint, "sequence.save", params);
}

export async function getRenderedSequenceSamples(endpoint, params = {}) {
  if (isOwnedEndpoint(endpoint)) {
    await ensureOwnedReady(endpoint, "sequence.getRenderSamples");
    return readOwnedPost(endpoint, "/sequence/render-samples", params, {
      command: "sequence.getRenderSamples",
      queued: false
    });
  }
  return postCommand(endpoint, "sequence.getRenderSamples", params);
}

export async function closeSequence(endpoint, force = true, quiet = false) {
  if (isOwnedEndpoint(endpoint)) {
    await ensureOwnedReady(endpoint, "sequence.close");
    return readOwnedPost(endpoint, "/sequence/close", { force, quiet }, { command: "sequence.close", queued: true });
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
  if (isOwnedEndpoint(endpoint)) {
    return normalizeOwnedCompleted(
      "layout.getScene",
      await readOwnedGet(endpoint, "/layout/scene", params)
    );
  }
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
    const owned = await readOwnedGet(endpoint, "/elements/display-order");
    const elements = Array.isArray(owned?.data?.elements) ? owned.data.elements : [];
    return {
      ok: true,
      res: 200,
      command: "sequencer.getDisplayElementOrder",
      data: {
        elements: elements.map((row) => String(row?.id || row?.name || "").trim()).filter(Boolean),
        rows: elements
      }
    };
  }
  return postCommand(endpoint, "sequencer.getDisplayElementOrder", {});
}

export async function setDisplayElementOrder(endpoint, orderedIds = []) {
  if (isOwnedEndpoint(endpoint)) {
    const base = deriveOwnedEndpointBase(endpoint);
    const normalizedIds = Array.isArray(orderedIds) ? orderedIds : [];
    return readOwnedJson(`${base}/elements/display-order`, {
      method: "POST",
      body: { orderedIds: JSON.stringify(normalizedIds) }
    });
  }
  return postCommand(endpoint, "sequencer.setDisplayElementOrder", { orderedIds });
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
  if (isOwnedEndpoint(endpoint)) {
    const base = deriveOwnedEndpointBase(endpoint);
    return readOwnedJson(`${base}/timing/ensure-track`, {
      method: "POST",
      body: {
        track: String(params?.trackName || params?.track || "").trim(),
        subType: String(params?.subType || "").trim()
      }
    });
  }
  return postCommand(endpoint, "timing.createTrack", params);
}

export async function replaceTimingMarks(endpoint, params = {}) {
  if (isOwnedEndpoint(endpoint)) {
    const track = String(params?.trackName || params?.track || "").trim();
    return readOwnedPost(endpoint, "/timing/add-marks", {
      track,
      subType: String(params?.subType || "").trim(),
      replaceExisting: true,
      marks: JSON.stringify(Array.isArray(params?.marks) ? params.marks : [])
    }, { command: "timing.replaceMarks", queued: true });
  }
  return postCommand(endpoint, "timing.replaceMarks", params);
}

export async function insertTimingMarks(endpoint, params = {}) {
  if (isOwnedEndpoint(endpoint)) {
    const track = String(params?.trackName || params?.track || "").trim();
    return readOwnedPost(endpoint, "/timing/add-marks", {
      track,
      subType: String(params?.subType || "").trim(),
      replaceExisting: false,
      marks: JSON.stringify(Array.isArray(params?.marks) ? params.marks : [])
    }, { command: "timing.insertMarks", queued: true });
  }
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
      data: {
        effects: trainedEffectDefinitions(),
        source: "stage1_trained_effect_bundle"
      }
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
    const query = { element };
    if (Number.isFinite(startMs)) query.startMs = startMs;
    if (Number.isFinite(endMs)) query.endMs = endMs;
    const owned = await readOwnedGet(endpoint, "/effects/window", query);
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

export async function updateEffect(endpoint, params = {}) {
  if (isOwnedEndpoint(endpoint)) {
    const base = deriveOwnedEndpointBase(endpoint);
    return readOwnedJson(`${base}/effects/update`, {
      method: "POST",
      body: params
    });
  }
  return postCommand(endpoint, "effects.update", params);
}

export async function deleteEffects(endpoint, params = {}) {
  if (isOwnedEndpoint(endpoint)) {
    const base = deriveOwnedEndpointBase(endpoint);
    return readOwnedJson(`${base}/effects/delete`, {
      method: "POST",
      body: params
    });
  }
  return postCommand(endpoint, "effects.delete", params);
}

export async function cloneEffects(endpoint, params = {}) {
  if (isOwnedEndpoint(endpoint)) {
    const base = deriveOwnedEndpointBase(endpoint);
    return readOwnedJson(`${base}/effects/clone`, {
      method: "POST",
      body: params
    });
  }
  return postCommand(endpoint, "effects.clone", params);
}

export async function deleteEffectLayer(endpoint, params = {}) {
  if (isOwnedEndpoint(endpoint)) {
    const base = deriveOwnedEndpointBase(endpoint);
    return readOwnedJson(`${base}/effects/delete-layer`, {
      method: "POST",
      body: params
    });
  }
  return postCommand(endpoint, "effects.deleteLayer", params);
}

export async function reorderEffectLayer(endpoint, params = {}) {
  if (isOwnedEndpoint(endpoint)) {
    const base = deriveOwnedEndpointBase(endpoint);
    return readOwnedJson(`${base}/effects/reorder-layer`, {
      method: "POST",
      body: params
    });
  }
  return postCommand(endpoint, "effects.reorderLayer", params);
}

export async function compactEffectLayers(endpoint, params = {}) {
  if (isOwnedEndpoint(endpoint)) {
    const base = deriveOwnedEndpointBase(endpoint);
    return readOwnedJson(`${base}/effects/compact-layers`, {
      method: "POST",
      body: params
    });
  }
  return postCommand(endpoint, "effects.compactLayers", params);
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
