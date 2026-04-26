import { buildCurrentSequenceContext } from "../agent/sequence-agent/current-sequence-context.js";
import {
  getTimingTracks,
  getTimingMarks,
  listEffects
} from "../api.js";

function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function finiteNumber(value, fallback = null) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function uniqueStrings(values = []) {
  return [...new Set(arr(values).map((row) => str(row)).filter(Boolean))];
}

function normalizeTrackName(track = {}) {
  return str(track?.name || track?.trackName || track?.label);
}

function normalizeMarks(raw = []) {
  return arr(raw)
    .map((mark) => ({
      label: str(mark?.label || mark?.name),
      startMs: finiteNumber(mark?.startMs ?? mark?.start),
      endMs: finiteNumber(mark?.endMs ?? mark?.end)
    }))
    .filter((mark) => mark.label || (Number.isFinite(mark.startMs) && Number.isFinite(mark.endMs)));
}

function normalizeTimingTrack(track = {}, marks = []) {
  const name = normalizeTrackName(track);
  if (!name) return null;
  return {
    name,
    type: str(track?.type || track?.subType || track?.timingType),
    marks: normalizeMarks(marks)
  };
}

function normalizeEffect(effect = {}) {
  const targetId = str(effect?.targetId || effect?.modelName || effect?.model || effect?.element);
  const effectName = str(effect?.effectName || effect?.name);
  if (!targetId && !effectName) return null;
  return {
    effectId: str(effect?.effectId || effect?.id),
    targetId,
    effectName,
    layerIndex: finiteNumber(effect?.layerIndex ?? effect?.layerNumber, 0),
    startMs: finiteNumber(effect?.startMs ?? effect?.start),
    endMs: finiteNumber(effect?.endMs ?? effect?.end),
    timingTrackName: str(effect?.timingTrackName || effect?.anchor?.trackName),
    settings: effect?.settings ?? "",
    palette: effect?.palette ?? ""
  };
}

function sectionLabel(section = {}) {
  return typeof section === "string"
    ? str(section)
    : str(section?.label || section?.name || section?.sectionName);
}

function deriveSectionWindow({ analysisHandoff = null, selectedSections = [] } = {}) {
  const selected = new Set(uniqueStrings(selectedSections).map((row) => row.toLowerCase()));
  const sections = arr(analysisHandoff?.structure?.sections);
  const matched = sections
    .filter((section) => !selected.size || selected.has(sectionLabel(section).toLowerCase()))
    .map((section) => ({
      startMs: finiteNumber(section?.startMs),
      endMs: finiteNumber(section?.endMs)
    }))
    .filter((row) => Number.isFinite(row.startMs) && Number.isFinite(row.endMs) && row.endMs > row.startMs);
  if (!matched.length) return null;
  return {
    startMs: Math.min(...matched.map((row) => row.startMs)),
    endMs: Math.max(...matched.map((row) => row.endMs))
  };
}

function deriveTargetIds({ selectedTargets = [], displayElements = [], maxTargets = 80 } = {}) {
  const explicit = uniqueStrings(selectedTargets);
  if (explicit.length) return explicit.slice(0, maxTargets);
  return uniqueStrings(
    arr(displayElements).map((row) => row?.id || row?.name)
  ).slice(0, maxTargets);
}

async function readTimingTracksWithMarks(endpoint, deps = {}, { maxTracks = 40 } = {}) {
  const readTracks = typeof deps.getTimingTracks === "function" ? deps.getTimingTracks : getTimingTracks;
  const readMarks = typeof deps.getTimingMarks === "function" ? deps.getTimingMarks : getTimingMarks;
  const tracksResp = await readTracks(endpoint);
  const tracks = arr(tracksResp?.data?.tracks).slice(0, maxTracks);
  const withMarks = await Promise.all(
    tracks.map(async (track) => {
      const trackName = normalizeTrackName(track);
      if (!trackName) return null;
      try {
        const marksResp = await readMarks(endpoint, trackName);
        return normalizeTimingTrack(track, marksResp?.data?.marks || []);
      } catch {
        return normalizeTimingTrack(track, []);
      }
    })
  );
  return withMarks.filter(Boolean);
}

async function readScopedEffects(endpoint, deps = {}, {
  targetIds = [],
  timeWindow = null,
  maxTargets = 80,
  maxEffects = 400
} = {}) {
  const readEffects = typeof deps.listEffects === "function" ? deps.listEffects : listEffects;
  const effects = [];
  for (const targetId of uniqueStrings(targetIds).slice(0, maxTargets)) {
    const params = { modelName: targetId };
    if (Number.isFinite(timeWindow?.startMs)) params.startMs = timeWindow.startMs;
    if (Number.isFinite(timeWindow?.endMs)) params.endMs = timeWindow.endMs;
    try {
      const resp = await readEffects(endpoint, params);
      for (const effect of arr(resp?.data?.effects)) {
        const normalized = normalizeEffect({ ...effect, targetId: effect?.targetId || effect?.modelName || targetId });
        if (normalized) effects.push(normalized);
        if (effects.length >= maxEffects) return effects;
      }
    } catch {
      // Continue with the other targets; partial readback is still useful.
    }
  }
  return effects;
}

export async function buildCurrentSequenceContextFromReadback({
  endpoint = "",
  sequencePath = "",
  sequenceRevision = "",
  analysisHandoff = null,
  selectedSections = [],
  selectedTargets = [],
  selectedTags = [],
  displayElements = [],
  maxTracks = 40,
  maxTargets = 80,
  maxEffects = 400
} = {}, deps = {}) {
  const safeEndpoint = str(endpoint);
  if (!safeEndpoint) return null;
  const timeWindow = deriveSectionWindow({ analysisHandoff, selectedSections });
  const targetIds = deriveTargetIds({ selectedTargets, displayElements, maxTargets });
  const [timingTracks, effects] = await Promise.all([
    readTimingTracksWithMarks(safeEndpoint, deps, { maxTracks }),
    readScopedEffects(safeEndpoint, deps, {
      targetIds,
      timeWindow,
      maxTargets,
      maxEffects
    })
  ]);
  return buildCurrentSequenceContext({
    sequencePath,
    sequenceRevision,
    timingTracks,
    effects,
    displayElements,
    selectedSections,
    selectedTargets: targetIds,
    selectedTags,
    source: "xlights_readback"
  });
}
