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
