import { finalizeArtifact } from "../agent/shared/artifact-ids.js";

function str(value = "") {
  return String(value || "").trim();
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function uniqueStrings(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((row) => str(row)).filter(Boolean))];
}

function normalizeLookupKeys(value = "") {
  const text = str(value);
  if (!text) return [];
  const lower = text.toLowerCase();
  const compact = lower.replace(/\s+/g, "");
  return compact === lower ? [lower] : [lower, compact];
}

function decodeBase64Bytes(value = "") {
  const text = str(value);
  if (!text) return new Uint8Array();
  if (typeof Buffer !== "undefined") {
    return Uint8Array.from(Buffer.from(text, "base64"));
  }
  if (typeof atob === "function") {
    const binary = atob(text);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
    return out;
  }
  throw new Error("No base64 decoder available");
}

function toFinite(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function buildSceneAreaBounds(models = []) {
  const xs = models.map((row) => toFinite(row?.x)).filter((row) => row != null);
  const ys = models.map((row) => toFinite(row?.y)).filter((row) => row != null);
  if (!xs.length || !ys.length) return null;
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(1e-6, maxX - minX);
  const height = Math.max(1e-6, maxY - minY);
  return { minX, maxX, minY, maxY, width, height, area: width * height };
}

function computeSpreadRatio(activeModels = [], sceneBounds = null) {
  if (!sceneBounds || activeModels.length <= 1) return 0;
  const xs = activeModels.map((row) => toFinite(row?.x)).filter((row) => row != null);
  const ys = activeModels.map((row) => toFinite(row?.y)).filter((row) => row != null);
  if (!xs.length || !ys.length) return 0;
  const width = Math.max(0, Math.max(...xs) - Math.min(...xs));
  const height = Math.max(0, Math.max(...ys) - Math.min(...ys));
  const area = width * height;
  return sceneBounds.area > 0 ? Math.max(0, Math.min(1, area / sceneBounds.area)) : 0;
}

function summarizeRangeActivity(bytes, offset, count) {
  let sum = 0;
  let peak = 0;
  for (let idx = 0; idx < count; idx += 1) {
    const value = Number(bytes[offset + idx] || 0);
    sum += value;
    if (value > peak) peak = value;
  }
  const normalized = count > 0 ? sum / (count * 255) : 0;
  return {
    normalized,
    active: peak > 0
  };
}

export function buildRenderSamplingPlan(sceneGraph = {}, { targetIds = [] } = {}) {
  const modelsById = isPlainObject(sceneGraph?.modelsById) ? sceneGraph.modelsById : {};
  const targetKeySet = new Set(uniqueStrings(targetIds).flatMap((row) => normalizeLookupKeys(row)));
  const models = Object.values(modelsById)
    .map((row) => {
      const startChannel = toFinite(row?.startChannel);
      const endChannel = toFinite(row?.endChannel);
      if (startChannel == null || endChannel == null || endChannel < startChannel) return null;
      const x = toFinite(row?.transform?.position?.x);
      const y = toFinite(row?.transform?.position?.y);
      return {
        id: str(row?.id),
        name: str(row?.name || row?.id),
        typeCategory: str(row?.typeCategory || "unknown") || "unknown",
        startChannel,
        endChannel,
        channelCount: (endChannel - startChannel) + 1,
        x,
        y,
        targetMatched: false
      };
    })
    .filter((row) => row && row.id && row.channelCount > 0)
    .map((row) => {
      const matched = targetKeySet.size
        ? [...new Set([...normalizeLookupKeys(row.id), ...normalizeLookupKeys(row.name)])].some((key) => targetKeySet.has(key))
        : false;
      return { ...row, targetMatched: matched };
    })
    .sort((a, b) => a.startChannel - b.startChannel);

  const prioritizedModels = targetKeySet.size
    ? models.filter((row) => row.targetMatched)
    : models;
  const sampledModels = prioritizedModels.length ? prioritizedModels : models;

  return {
    modelCount: sampledModels.length,
    availableModelCount: models.length,
    targetMatchedModelCount: models.filter((row) => row.targetMatched).length,
    models: sampledModels,
    channelRanges: sampledModels.map((row) => ({
      startChannel: row.startChannel,
      channelCount: row.channelCount
    })),
    sceneBounds: buildSceneAreaBounds(sampledModels),
    samplingMode: targetKeySet.size && prioritizedModels.length ? "targeted" : "full"
  };
}

export function buildRenderObservationFromSamples({
  sampleResponse = null,
  samplingPlan = null,
  sequencePath = "",
  revisionToken = ""
} = {}) {
  const data = isPlainObject(sampleResponse?.data) ? sampleResponse.data : {};
  const plan = isPlainObject(samplingPlan) ? samplingPlan : null;
  const models = Array.isArray(plan?.models) ? plan.models : [];
  const samples = Array.isArray(data?.samples) ? data.samples : [];
  if (!plan || !models.length || !samples.length) return null;

  const modelEnergyTotals = new Map();
  const familyTotals = new Map();
  const activeModelNames = new Set();
  const spreadRatios = [];
  let maxActiveModelCount = 0;

  for (const sample of samples) {
    const bytes = decodeBase64Bytes(sample?.dataBase64);
    let offset = 0;
    const activeModels = [];
    for (const model of models) {
      const count = Number(model.channelCount || 0);
      if (offset + count > bytes.length) break;
      const activity = summarizeRangeActivity(bytes, offset, count);
      offset += count;
      if (!activity.active) continue;
      activeModels.push(model);
      activeModelNames.add(model.id);
      modelEnergyTotals.set(model.id, Number(modelEnergyTotals.get(model.id) || 0) + activity.normalized);
      familyTotals.set(model.typeCategory, Number(familyTotals.get(model.typeCategory) || 0) + 1);
    }
    maxActiveModelCount = Math.max(maxActiveModelCount, activeModels.length);
    spreadRatios.push(computeSpreadRatio(activeModels, plan.sceneBounds));
  }

  const rankedModels = [...modelEnergyTotals.entries()]
    .map(([id, energy]) => ({ id, energy }))
    .sort((a, b) => b.energy - a.energy);
  const totalEnergy = rankedModels.reduce((sum, row) => sum + Number(row.energy || 0), 0);
  const leadModel = rankedModels[0]?.id || "";
  const leadModelShare = totalEnergy > 0 ? Number((rankedModels[0].energy / totalEnergy).toFixed(4)) : 0;
  const meanSceneSpreadRatio = spreadRatios.length
    ? Number((spreadRatios.reduce((sum, row) => sum + row, 0) / spreadRatios.length).toFixed(6))
    : 0;

  return finalizeArtifact({
    artifactType: "render_observation_v1",
    artifactVersion: "1.0",
    source: {
      sequencePath: str(data?.sequencePath || sequencePath),
      revisionToken: str(data?.revisionToken || revisionToken),
      fseqPath: str(data?.fseqPath),
      sampleEncoding: str(data?.sampleEncoding),
      startMs: toFinite(data?.startMs),
      endMs: toFinite(data?.endMs),
      samplingMode: str(plan?.samplingMode || "full") || "full",
      sampledModelCount: models.length,
      availableModelCount: toFinite(plan?.availableModelCount),
      targetMatchedModelCount: toFinite(plan?.targetMatchedModelCount)
    },
    macro: {
      frameCount: samples.length,
      activeModelNames: [...activeModelNames],
      activeFamilyTotals: Object.fromEntries([...familyTotals.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
      leadModel,
      leadModelShare,
      meanSceneSpreadRatio,
      maxSceneSpreadRatio: spreadRatios.length ? Number(Math.max(...spreadRatios).toFixed(6)) : 0,
      maxActiveModelCount,
      maxActiveModelRatio: models.length ? Number((maxActiveModelCount / models.length).toFixed(4)) : 0
    }
  });
}
