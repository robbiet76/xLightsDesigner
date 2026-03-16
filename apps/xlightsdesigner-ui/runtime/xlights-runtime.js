import { readCurrentXLightsSequenceState } from "../agent/xlights-state/live-sequence-state-runtime.js";
import { pingCapabilities, getSystemVersion, getRevision } from "../api.js";

function str(value = "") {
  return String(value || "").trim();
}

export function syncXLightsRevisionState({
  previousRevision = "unknown",
  nextRevision = "unknown",
  hasDraftProposal = false,
  draftBaseRevision = "unknown",
  hasCreativeProposal = false
} = {}) {
  const previous = str(previousRevision || "unknown") || "unknown";
  const next = str(nextRevision || "unknown") || "unknown";
  const revisionChanged = next !== previous;
  const knownToKnownRevisionChange = previous !== "unknown" && next !== "unknown" && next !== previous;
  const staleDetected = Boolean(
    hasDraftProposal && draftBaseRevision !== "unknown" && next !== "unknown" && next !== draftBaseRevision
  );
  return {
    revision: next,
    revisionChanged,
    knownToKnownRevisionChange,
    staleDetected,
    shouldInvalidatePlanHandoff: knownToKnownRevisionChange,
    shouldMarkDesignerDraftStale: staleDetected && hasCreativeProposal
  };
}

export async function fetchXLightsRevisionState(endpoint, deps = {}) {
  const getCurrentRevision = deps.getRevision || getRevision;
  const rev = await getCurrentRevision(endpoint);
  return str(rev?.data?.revision || rev?.data?.revisionToken || "unknown") || "unknown";
}

export async function collectXLightsRuntimeSnapshot(endpoint, deps = {}) {
  const {
    readSequenceState = readCurrentXLightsSequenceState,
    ping = pingCapabilities,
    getVersion = getSystemVersion
  } = deps;

  const [sequenceState, capabilities, version] = await Promise.all([
    readSequenceState(endpoint, { includeTimingMarks: false }),
    ping(endpoint),
    getVersion(endpoint).catch(() => ({ data: { version: "" } }))
  ]);

  return {
    contract: "xlights_runtime_snapshot_v1",
    version: "1.0",
    endpoint: str(endpoint),
    summary: sequenceState?.summary || "No xLights sequence state available.",
    sequenceState,
    capabilities: {
      commandCount: Array.isArray(capabilities?.data?.commands) ? capabilities.data.commands.length : 0,
      commands: Array.isArray(capabilities?.data?.commands) ? capabilities.data.commands : [],
      rawVersion: str(version?.data?.version || capabilities?.data?.version || "")
    }
  };
}


export async function executeXLightsRefreshCycle({
  state = {},
  endpoint = "",
  deps = {},
  callbacks = {}
} = {}) {
  const {
    getOpen = getOpenSequence,
    syncRevision = async () => ({ ok: true, staleDetected: false }),
    refreshMetadata = async () => {},
    refreshEffects = async () => {},
    refreshSections = async () => {},
    refreshHistory = async () => {}
  } = deps;
  const {
    applyRolloutPolicy = () => {},
    releaseConnectivityPlanOnly = () => false,
    enforceConnectivityPlanOnly = () => false,
    isSequenceAllowed = () => true,
    currentSequencePath = () => "",
    clearIgnoredExternalSequenceNote = () => {},
    applyOpenSequenceState = () => {},
    syncAudioPathFromMediaStatus = async () => {},
    hydrateSidecarForCurrentSequence = async () => {},
    updateSequenceFileMtime = async () => {},
    maybeFlushSidecarAfterExternalSave = async () => {},
    noteIgnoredExternalSequence = () => {},
    onWarning = () => {},
    onInfo = () => {}
  } = callbacks;

  applyRolloutPolicy();
  const releasedForce = releaseConnectivityPlanOnly();
  state.flags.xlightsConnected = true;

  const open = await getOpen(endpoint);
  const seq = open?.data?.sequence;
  const seqAllowed = Boolean(open?.data?.isOpen && seq && isSequenceAllowed(seq));
  state.flags.activeSequenceLoaded = seqAllowed;
  state.health.sequenceOpen = Boolean(open?.data?.isOpen);
  const prevPath = currentSequencePath();

  if (seqAllowed) {
    clearIgnoredExternalSequenceNote();
    applyOpenSequenceState(seq);
    if (open?.data?.isOpen) {
      await syncAudioPathFromMediaStatus();
    }
    const nextPath = currentSequencePath();
    if (nextPath && nextPath !== prevPath) {
      await hydrateSidecarForCurrentSequence();
    }
    await updateSequenceFileMtime(currentSequencePath());
    await maybeFlushSidecarAfterExternalSave(currentSequencePath());
  } else if (open?.data?.isOpen && seq) {
    noteIgnoredExternalSequence(seq);
  }

  const revisionState = await syncRevision();

  try {
    await refreshMetadata();
  } catch (err) {
    onWarning(`Model refresh failed: ${err.message}`, err.stack || "");
  }

  await refreshEffects();

  try {
    await refreshSections();
  } catch (err) {
    onWarning(`Section refresh failed: ${err.message}`, err.stack || "");
  }

  await refreshHistory();

  if (!revisionState?.staleDetected) {
    onInfo("Refreshed from xLights.");
  }
  if (releasedForce && !revisionState?.staleDetected) {
    onInfo("xLights reachable again. Plan-only remains enabled until you turn it off.");
  }

  return {
    releasedForce,
    staleDetected: Boolean(revisionState?.staleDetected),
    revisionState,
    openSequenceAllowed: seqAllowed,
    openSequence: seq || null
  };
}
