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

function classifyTemporalRead({ frameEnergyTotals = [], activeModelCounts = [], leadModels = [] } = {}) {
  const energies = (Array.isArray(frameEnergyTotals) ? frameEnergyTotals : [])
    .map((row) => Number(row))
    .filter((row) => Number.isFinite(row) && row >= 0);
  const counts = (Array.isArray(activeModelCounts) ? activeModelCounts : [])
    .map((row) => Number(row))
    .filter((row) => Number.isFinite(row) && row >= 0);
  const leads = uniqueStrings(leadModels);
  const maxEnergy = energies.length ? Math.max(...energies) : 0;
  const minEnergy = energies.length ? Math.min(...energies) : 0;
  const energyVariation = maxEnergy > 0 ? (maxEnergy - minEnergy) / maxEnergy : 0;
  const maxCount = counts.length ? Math.max(...counts) : 0;
  const minCount = counts.length ? Math.min(...counts) : 0;
  const activeModelVariation = Math.max(0, maxCount - minCount);
  const distinctLeadModelCount = leads.length;

  let temporalRead = "flat";
  if (energyVariation >= 0.2 || activeModelVariation >= 2 || distinctLeadModelCount >= 2) {
    temporalRead = "evolving";
  } else if (energyVariation >= 0.08 || activeModelVariation >= 1) {
    temporalRead = "modulated";
  }

  return {
    temporalRead,
    energyVariation: Number(energyVariation.toFixed(4)),
    activeModelVariation,
    distinctLeadModelCount
  };
}

function summarizeWindow({
  data = {},
  models = [],
  sceneBounds = null,
  label = ""
} = {}) {
  const samples = Array.isArray(data?.samples) ? data.samples : [];
  if (!models.length || !samples.length) return null;

  const modelEnergyTotals = new Map();
  const familyTotals = new Map();
  const activeModelNames = new Set();
  const spreadRatios = [];
  const frameEnergyTotals = [];
  const frameLeadModels = [];
  const activeModelCounts = [];
  let maxActiveModelCount = 0;

  for (const sample of samples) {
    const bytes = decodeBase64Bytes(sample?.dataBase64);
    let offset = 0;
    const activeModels = [];
    const frameModelEnergies = [];
    let frameEnergyTotal = 0;
    for (const model of models) {
      const count = Number(model.channelCount || 0);
      if (offset + count > bytes.length) break;
      const activity = summarizeRangeActivity(bytes, offset, count);
      offset += count;
      if (!activity.active) continue;
      activeModels.push(model);
      activeModelNames.add(model.id);
      frameModelEnergies.push({ id: model.id, energy: activity.normalized });
      frameEnergyTotal += activity.normalized;
      modelEnergyTotals.set(model.id, Number(modelEnergyTotals.get(model.id) || 0) + activity.normalized);
      familyTotals.set(model.typeCategory, Number(familyTotals.get(model.typeCategory) || 0) + 1);
    }
    frameModelEnergies.sort((a, b) => b.energy - a.energy);
    maxActiveModelCount = Math.max(maxActiveModelCount, activeModels.length);
    activeModelCounts.push(activeModels.length);
    frameEnergyTotals.push(Number(frameEnergyTotal.toFixed(6)));
    frameLeadModels.push(str(frameModelEnergies[0]?.id));
    spreadRatios.push(computeSpreadRatio(activeModels, sceneBounds));
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
  const temporal = classifyTemporalRead({
    frameEnergyTotals,
    activeModelCounts,
    leadModels: frameLeadModels
  });

  return {
    label: str(label),
    startMs: toFinite(data?.startMs),
    endMs: toFinite(data?.endMs),
    frameCount: samples.length,
    activeModelNames: [...activeModelNames],
    activeFamilyTotals: Object.fromEntries([...familyTotals.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
    leadModel,
    leadModelShare,
    meanSceneSpreadRatio,
    maxSceneSpreadRatio: spreadRatios.length ? Number(Math.max(...spreadRatios).toFixed(6)) : 0,
    maxActiveModelCount,
    maxActiveModelRatio: models.length ? Number((maxActiveModelCount / models.length).toFixed(4)) : 0,
    temporalRead: temporal.temporalRead,
    energyVariation: temporal.energyVariation,
    activeModelVariation: temporal.activeModelVariation,
    distinctLeadModelCount: temporal.distinctLeadModelCount,
    totalEnergy: Number(totalEnergy.toFixed(6))
  };
}

function combineWindowSummaries(windowSummaries = [], models = []) {
  const rows = (Array.isArray(windowSummaries) ? windowSummaries : []).filter(Boolean);
  if (!rows.length) return null;
  if (rows.length === 1) {
    const row = rows[0];
    return {
      frameCount: Number(row?.frameCount || 0),
      activeModelNames: Array.isArray(row?.activeModelNames) ? row.activeModelNames : [],
      activeFamilyTotals: row?.activeFamilyTotals && typeof row.activeFamilyTotals === "object" ? row.activeFamilyTotals : {},
      leadModel: str(row?.leadModel),
      leadModelShare: Number(row?.leadModelShare || 0),
      meanSceneSpreadRatio: Number(row?.meanSceneSpreadRatio || 0),
      maxSceneSpreadRatio: Number(row?.maxSceneSpreadRatio || 0),
      maxActiveModelCount: Number(row?.maxActiveModelCount || 0),
      maxActiveModelRatio: Number(row?.maxActiveModelRatio || 0),
      temporalRead: str(row?.temporalRead || "unknown") || "unknown",
      energyVariation: Number(row?.energyVariation || 0),
      activeModelVariation: Number(row?.activeModelVariation || 0),
      distinctLeadModelCount: Number(row?.distinctLeadModelCount || 0)
    };
  }
  const familyTotals = new Map();
  const activeModelNames = new Set();
  let leadModel = "";
  let leadEnergy = -1;
  let maxActiveModelCount = 0;

  for (const row of rows) {
    for (const id of Array.isArray(row?.activeModelNames) ? row.activeModelNames : []) {
      if (str(id)) activeModelNames.add(str(id));
    }
    const familyMap = row?.activeFamilyTotals && typeof row.activeFamilyTotals === "object" ? row.activeFamilyTotals : {};
    for (const [family, count] of Object.entries(familyMap)) {
      familyTotals.set(family, Number(familyTotals.get(family) || 0) + Number(count || 0));
    }
    if (Number(row?.totalEnergy || 0) > leadEnergy && str(row?.leadModel)) {
      leadEnergy = Number(row.totalEnergy || 0);
      leadModel = str(row.leadModel);
    }
    maxActiveModelCount = Math.max(maxActiveModelCount, Number(row?.maxActiveModelCount || 0));
  }

  const spreadValues = rows.map((row) => Number(row?.meanSceneSpreadRatio || 0)).filter((row) => Number.isFinite(row));
  const leadShares = rows.map((row) => Number(row?.leadModelShare || 0)).filter((row) => Number.isFinite(row));
  const frameCounts = rows.map((row) => Number(row?.frameCount || 0)).filter((row) => Number.isFinite(row));
  const energyTotals = rows.map((row) => Number(row?.totalEnergy || 0)).filter((row) => Number.isFinite(row));
  const activeCountSeries = rows.map((row) => Number(row?.maxActiveModelCount || 0)).filter((row) => Number.isFinite(row));
  const leadModelSeries = rows.map((row) => str(row?.leadModel)).filter(Boolean);
  const temporal = classifyTemporalRead({
    frameEnergyTotals: energyTotals,
    activeModelCounts: activeCountSeries,
    leadModels: leadModelSeries
  });

  return {
    frameCount: frameCounts.reduce((sum, row) => sum + row, 0),
    activeModelNames: [...activeModelNames],
    activeFamilyTotals: Object.fromEntries([...familyTotals.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
    leadModel,
    leadModelShare: leadShares.length ? Number((leadShares.reduce((sum, row) => sum + row, 0) / leadShares.length).toFixed(4)) : 0,
    meanSceneSpreadRatio: spreadValues.length ? Number((spreadValues.reduce((sum, row) => sum + row, 0) / spreadValues.length).toFixed(6)) : 0,
    maxSceneSpreadRatio: spreadValues.length ? Number(Math.max(...spreadValues).toFixed(6)) : 0,
    maxActiveModelCount,
    maxActiveModelRatio: models.length ? Number((maxActiveModelCount / models.length).toFixed(4)) : 0,
    temporalRead: temporal.temporalRead,
    energyVariation: temporal.energyVariation,
    activeModelVariation: temporal.activeModelVariation,
    distinctLeadModelCount: temporal.distinctLeadModelCount
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
  sampleResponses = [],
  samplingPlan = null,
  sequencePath = "",
  revisionToken = ""
} = {}) {
  const plan = isPlainObject(samplingPlan) ? samplingPlan : null;
  const models = Array.isArray(plan?.models) ? plan.models : [];
  const responseRows = Array.isArray(sampleResponses) && sampleResponses.length
    ? sampleResponses
    : [sampleResponse];
  const windowSummaries = responseRows
    .map((row, idx) => {
      const wrapper = isPlainObject(row) ? row : {};
      const data = isPlainObject(wrapper?.data) ? wrapper.data : {};
      const label = str(wrapper?.label || data?.label || `window_${idx + 1}`);
      return summarizeWindow({
        data,
        models,
        sceneBounds: plan?.sceneBounds || null,
        label
      });
    })
    .filter(Boolean);
  if (!plan || !models.length || !windowSummaries.length) return null;
  const aggregate = combineWindowSummaries(windowSummaries, models);
  const primaryData = isPlainObject(responseRows[0]?.data) ? responseRows[0].data : {};
  const sourceStartMs = windowSummaries.map((row) => toFinite(row?.startMs)).filter((row) => row != null);
  const sourceEndMs = windowSummaries.map((row) => toFinite(row?.endMs)).filter((row) => row != null);

  return finalizeArtifact({
    artifactType: "render_observation_v1",
    artifactVersion: "1.0",
    source: {
      sequencePath: str(primaryData?.sequencePath || sequencePath),
      revisionToken: str(primaryData?.revisionToken || revisionToken),
      fseqPath: str(primaryData?.fseqPath),
      sampleEncoding: str(primaryData?.sampleEncoding),
      startMs: sourceStartMs.length ? Math.min(...sourceStartMs) : toFinite(primaryData?.startMs),
      endMs: sourceEndMs.length ? Math.max(...sourceEndMs) : toFinite(primaryData?.endMs),
      samplingMode: str(plan?.samplingMode || "full") || "full",
      sampledModelCount: models.length,
      availableModelCount: toFinite(plan?.availableModelCount),
      targetMatchedModelCount: toFinite(plan?.targetMatchedModelCount),
      windowCount: windowSummaries.length,
      windows: windowSummaries.map((row) => ({
        label: str(row?.label),
        startMs: toFinite(row?.startMs),
        endMs: toFinite(row?.endMs),
        reviewLevel: str(responseRows.find((wrapper) => str(wrapper?.label) === str(row?.label))?.reviewLevel || ""),
        sourceStartMs: toFinite(responseRows.find((wrapper) => str(wrapper?.label) === str(row?.label))?.sourceWindow?.startMs),
        sourceEndMs: toFinite(responseRows.find((wrapper) => str(wrapper?.label) === str(row?.label))?.sourceWindow?.endMs)
      }))
    },
    macro: aggregate,
    windows: windowSummaries.map((row) => ({
      label: str(row?.label),
      startMs: toFinite(row?.startMs),
      endMs: toFinite(row?.endMs),
      frameCount: Number(row?.frameCount || 0),
      activeModelNames: Array.isArray(row?.activeModelNames) ? row.activeModelNames : [],
      activeFamilyTotals: row?.activeFamilyTotals && typeof row.activeFamilyTotals === "object" ? row.activeFamilyTotals : {},
      leadModel: str(row?.leadModel),
      leadModelShare: Number(row?.leadModelShare || 0),
      meanSceneSpreadRatio: Number(row?.meanSceneSpreadRatio || 0),
      maxSceneSpreadRatio: Number(row?.maxSceneSpreadRatio || 0),
      maxActiveModelCount: Number(row?.maxActiveModelCount || 0),
      maxActiveModelRatio: Number(row?.maxActiveModelRatio || 0),
      temporalRead: str(row?.temporalRead || "unknown") || "unknown",
      energyVariation: Number(row?.energyVariation || 0),
      activeModelVariation: Number(row?.activeModelVariation || 0),
      distinctLeadModelCount: Number(row?.distinctLeadModelCount || 0)
    }))
  });
}
