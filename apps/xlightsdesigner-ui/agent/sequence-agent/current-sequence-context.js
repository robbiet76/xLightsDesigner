import { finalizeArtifact } from "../shared/artifact-ids.js";

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

function compactTimingTrack(track = {}) {
  const marks = arr(track?.marks || track?.timingMarks);
  const name = str(track?.name || track?.trackName);
  if (!name) return null;
  return {
    trackName: name,
    type: str(track?.type || track?.subType),
    markCount: marks.length,
    firstMark: marks.length
      ? {
          label: str(marks[0]?.label),
          startMs: finiteNumber(marks[0]?.startMs),
          endMs: finiteNumber(marks[0]?.endMs)
        }
      : null,
    lastMark: marks.length
      ? {
          label: str(marks[marks.length - 1]?.label),
          startMs: finiteNumber(marks[marks.length - 1]?.startMs),
          endMs: finiteNumber(marks[marks.length - 1]?.endMs)
        }
      : null
  };
}

function compactEffect(effect = {}) {
  const targetId = str(effect?.targetId || effect?.modelName || effect?.model);
  const effectName = str(effect?.effectName || effect?.name);
  if (!targetId && !effectName) return null;
  return {
    targetId,
    effectName,
    layerIndex: finiteNumber(effect?.layerIndex, 0),
    startMs: finiteNumber(effect?.startMs),
    endMs: finiteNumber(effect?.endMs),
    timingTrackName: str(effect?.timingTrackName || effect?.anchor?.trackName)
  };
}

export function buildCurrentSequenceContext({
  sequencePath = "",
  sequenceRevision = "",
  timingTracks = [],
  effects = [],
  selectedSections = [],
  selectedTargets = [],
  selectedTags = [],
  source = "xlights_readback"
} = {}) {
  const compactTracks = arr(timingTracks)
    .map((track) => compactTimingTrack(track))
    .filter(Boolean);
  const compactEffects = arr(effects)
    .map((effect) => compactEffect(effect))
    .filter(Boolean);
  const targetIds = uniqueStrings([
    ...selectedTargets,
    ...compactEffects.map((effect) => effect.targetId)
  ]);
  const effectNames = uniqueStrings(compactEffects.map((effect) => effect.effectName));
  const timingTrackNames = uniqueStrings(compactTracks.map((track) => track.trackName));
  const starts = compactEffects.map((effect) => effect.startMs).filter((value) => Number.isFinite(value));
  const ends = compactEffects.map((effect) => effect.endMs).filter((value) => Number.isFinite(value));

  return finalizeArtifact({
    artifactType: "current_sequence_context_v1",
    artifactVersion: "1.0",
    source: str(source) || "xlights_readback",
    sequence: {
      path: str(sequencePath),
      revision: str(sequenceRevision) || "unknown"
    },
    scope: {
      sections: uniqueStrings(selectedSections),
      targetIds,
      tagNames: uniqueStrings(selectedTags)
    },
    summary: {
      timingTrackCount: compactTracks.length,
      timingMarkCount: compactTracks.reduce((sum, track) => sum + Number(track.markCount || 0), 0),
      effectCount: compactEffects.length,
      targetCount: targetIds.length,
      effectNameCount: effectNames.length,
      timeWindow: starts.length || ends.length
        ? {
            startMs: starts.length ? Math.min(...starts) : null,
            endMs: ends.length ? Math.max(...ends) : null
          }
        : null
    },
    timing: {
      trackNames: timingTrackNames.slice(0, 40),
      tracks: compactTracks.slice(0, 40)
    },
    effects: {
      effectNames: effectNames.slice(0, 40),
      targetIds: targetIds.slice(0, 80),
      sample: compactEffects.slice(0, 80)
    }
  });
}

export function sanitizeCurrentSequenceContextForPlan(context = null) {
  if (!context || typeof context !== "object" || Array.isArray(context)) return null;
  const summary = context.summary && typeof context.summary === "object" ? context.summary : {};
  const sequence = context.sequence && typeof context.sequence === "object" ? context.sequence : {};
  const scope = context.scope && typeof context.scope === "object" ? context.scope : {};
  const timing = context.timing && typeof context.timing === "object" ? context.timing : {};
  const effects = context.effects && typeof context.effects === "object" ? context.effects : {};
  return {
    artifactType: str(context.artifactType || "current_sequence_context_v1"),
    artifactId: str(context.artifactId),
    source: str(context.source),
    sequence: {
      path: str(sequence.path),
      revision: str(sequence.revision || "unknown") || "unknown"
    },
    scope: {
      sections: uniqueStrings(scope.sections),
      targetIds: uniqueStrings(scope.targetIds),
      tagNames: uniqueStrings(scope.tagNames)
    },
    summary: {
      timingTrackCount: finiteNumber(summary.timingTrackCount, 0),
      timingMarkCount: finiteNumber(summary.timingMarkCount, 0),
      effectCount: finiteNumber(summary.effectCount, 0),
      targetCount: finiteNumber(summary.targetCount, 0),
      effectNameCount: finiteNumber(summary.effectNameCount, 0),
      timeWindow: summary.timeWindow && typeof summary.timeWindow === "object"
        ? {
            startMs: finiteNumber(summary.timeWindow.startMs),
            endMs: finiteNumber(summary.timeWindow.endMs)
          }
        : null
    },
    timing: {
      trackNames: uniqueStrings(timing.trackNames).slice(0, 40)
    },
    effects: {
      effectNames: uniqueStrings(effects.effectNames).slice(0, 40),
      targetIds: uniqueStrings(effects.targetIds).slice(0, 80)
    }
  };
}
