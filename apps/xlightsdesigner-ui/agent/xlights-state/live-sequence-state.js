function str(value = "") {
  return String(value || "").trim();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function countByType(elements = []) {
  const counts = { model: 0, group: 0, submodel: 0, timing: 0, other: 0 };
  for (const row of asArray(elements)) {
    const type = str(row?.type || "").toLowerCase();
    if (type === "model") counts.model += 1;
    else if (type === "group") counts.group += 1;
    else if (type === "submodel") counts.submodel += 1;
    else if (type === "timing") counts.timing += 1;
    else counts.other += 1;
  }
  return counts;
}

function normalizeTrack(track = {}, marks = null) {
  const name = str(typeof track === "string" ? track : track?.name);
  const source = str(track?.source || track?.provider || track?.type || "manual");
  const normalizedMarks = marks == null
    ? null
    : asArray(marks).map((mark) => ({
        startMs: Number(mark?.startMs || 0),
        endMs: Number(mark?.endMs || 0),
        label: str(mark?.label || "")
      }));
  return {
    name,
    source,
    isXdTrack: /^xd:/i.test(name),
    markCount: normalizedMarks == null ? Number(track?.markCount || 0) : normalizedMarks.length,
    marks: normalizedMarks
  };
}

export function buildXLightsTimingState({ tracks = [], marksByTrack = {}, includeMarks = false } = {}) {
  const normalizedTracks = asArray(tracks)
    .map((track) => normalizeTrack(track, includeMarks ? marksByTrack[str(track?.name || track)] || [] : null))
    .filter((track) => track.name);
  const names = normalizedTracks.map((track) => track.name);
  const xdTrackNames = normalizedTracks.filter((track) => track.isXdTrack).map((track) => track.name);
  return {
    contract: "xlights_timing_state_v1",
    version: "1.0",
    summary: normalizedTracks.length
      ? `${normalizedTracks.length} timing track${normalizedTracks.length === 1 ? "" : "s"} available.`
      : "No timing tracks are available.",
    trackCount: normalizedTracks.length,
    xdTrackCount: xdTrackNames.length,
    trackNames: names,
    xdTrackNames,
    tracks: normalizedTracks
  };
}

export function buildXLightsSequenceState({
  endpoint = "",
  openSequence = null,
  revision = "unknown",
  sequenceSettings = null,
  mediaStatus = null,
  models = [],
  submodels = [],
  displayElements = [],
  timingState = null
} = {}) {
  const sequence = openSequence && typeof openSequence === "object" ? openSequence : null;
  const settings = sequenceSettings && typeof sequenceSettings === "object" ? sequenceSettings : {};
  const media = mediaStatus && typeof mediaStatus === "object" ? mediaStatus : {};
  const openPath = str(sequence?.file || sequence?.path || sequence?.sequenceFile || "");
  const displayCounts = countByType(displayElements);
  const resolvedTimingState = timingState && typeof timingState === "object"
    ? timingState
    : buildXLightsTimingState({ tracks: [] });

  return {
    contract: "xlights_sequence_state_v1",
    version: "1.0",
    endpoint: str(endpoint),
    sequence: {
      isOpen: Boolean(sequence),
      file: openPath,
      name: openPath ? openPath.split(/[\\/]/).pop() : "",
      revision: str(revision || "unknown"),
      mediaFile: str(media?.mediaFile || settings?.mediaFile || ""),
      frameRate: Number(settings?.frameRate || 0) || null,
      lengthMs: Number(settings?.lengthMs || 0) || null
    },
    layout: {
      modelCount: asArray(models).length,
      submodelCount: asArray(submodels).length,
      displayElementCount: asArray(displayElements).length,
      displayElementTypeCounts: displayCounts
    },
    timing: resolvedTimingState,
    readiness: {
      ok: Boolean(sequence),
      level: sequence ? "ready" : "blocked",
      reasons: sequence ? [] : ["no_open_sequence"]
    },
    summary: sequence
      ? `Open sequence ${openPath.split(/[\\/]/).pop() || openPath} at revision ${str(revision || "unknown")}.`
      : "No open xLights sequence."
  };
}

export async function readXLightsSequenceState(endpoint, deps = {}, options = {}) {
  const {
    getOpenSequence,
    getRevision,
    getSequenceSettings,
    getMediaStatus,
    getModels,
    getSubmodels,
    getDisplayElements,
    getTimingTracks,
    getTimingMarks
  } = deps;
  if (typeof getOpenSequence !== "function") throw new Error("getOpenSequence is required");
  if (typeof getRevision !== "function") throw new Error("getRevision is required");
  if (typeof getSequenceSettings !== "function") throw new Error("getSequenceSettings is required");
  if (typeof getMediaStatus !== "function") throw new Error("getMediaStatus is required");
  if (typeof getModels !== "function") throw new Error("getModels is required");
  if (typeof getSubmodels !== "function") throw new Error("getSubmodels is required");
  if (typeof getDisplayElements !== "function") throw new Error("getDisplayElements is required");
  if (typeof getTimingTracks !== "function") throw new Error("getTimingTracks is required");

  const includeTimingMarks = Boolean(options?.includeTimingMarks);
  const [openResp, revisionResp, settingsResp, mediaResp, modelsResp, submodelsResp, displayResp, tracksResp] = await Promise.all([
    getOpenSequence(endpoint),
    getRevision(endpoint),
    getSequenceSettings(endpoint),
    getMediaStatus(endpoint),
    getModels(endpoint),
    getSubmodels(endpoint),
    getDisplayElements(endpoint),
    getTimingTracks(endpoint)
  ]);

  const trackRows = asArray(tracksResp?.data?.tracks);
  const marksByTrack = {};
  if (includeTimingMarks) {
    if (typeof getTimingMarks !== "function") throw new Error("getTimingMarks is required when includeTimingMarks=true");
    const markResults = await Promise.all(
      trackRows.map(async (track) => {
        const name = str(track?.name || track);
        if (!name) return;
        const resp = await getTimingMarks(endpoint, name);
        marksByTrack[name] = asArray(resp?.data?.marks);
      })
    );
    void markResults;
  }

  return buildXLightsSequenceState({
    endpoint,
    openSequence: openResp?.data?.isOpen ? openResp?.data?.sequence || null : null,
    revision: str(revisionResp?.data?.revision || revisionResp?.data?.revisionToken || "unknown"),
    sequenceSettings: settingsResp?.data || null,
    mediaStatus: mediaResp?.data || null,
    models: asArray(modelsResp?.data?.models),
    submodels: asArray(submodelsResp?.data?.submodels),
    displayElements: asArray(displayResp?.data?.elements),
    timingState: buildXLightsTimingState({
      tracks: trackRows,
      marksByTrack,
      includeMarks: includeTimingMarks
    })
  });
}
