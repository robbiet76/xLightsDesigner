import { reconcileTimingTrackReviewState } from "./timing-track-status.js";

function str(value = "") {
  return String(value || "").trim();
}

export function buildGlobalXdTrackPolicyKey(trackName = "") {
  const name = str(trackName).toLowerCase();
  if (!name) return "";
  return `__xd_global__::${name}`;
}

export function deriveUserOwnedTrackNameFromXd(trackName = "") {
  const raw = str(trackName);
  if (!raw) return "";
  return raw.replace(/^xd:\s*/i, "").trim() || raw;
}

export function createTimingTrackRuntime({
  state,
  fallbackSequenceAgentRuntime = {},
  isXdTimingTrack = () => false,
  refreshSectionsForTrack = null,
  setStatus = () => {},
  setStatusWithDiagnostics = () => {},
  saveCurrentProjectSnapshot = () => {},
  persist = () => {},
  render = () => {}
} = {}) {
  function ensureSequenceAgentRuntimeState() {
    state.sequenceAgentRuntime = state.sequenceAgentRuntime && typeof state.sequenceAgentRuntime === "object"
      ? state.sequenceAgentRuntime
      : structuredClone(fallbackSequenceAgentRuntime);
    return state.sequenceAgentRuntime;
  }

  function getPoliciesState() {
    return state.sequenceAgentRuntime?.timingTrackPolicies && typeof state.sequenceAgentRuntime.timingTrackPolicies === "object"
      ? state.sequenceAgentRuntime.timingTrackPolicies
      : {};
  }

  function setPoliciesState(policies = {}) {
    ensureSequenceAgentRuntimeState().timingTrackPolicies = policies && typeof policies === "object" ? policies : {};
  }

  function getGeneratedSignaturesState() {
    return state.sequenceAgentRuntime?.timingGeneratedSignatures && typeof state.sequenceAgentRuntime.timingGeneratedSignatures === "object"
      ? state.sequenceAgentRuntime.timingGeneratedSignatures
      : {};
  }

  function setGeneratedSignaturesState(signatures = {}) {
    ensureSequenceAgentRuntimeState().timingGeneratedSignatures = signatures && typeof signatures === "object" ? signatures : {};
  }

  function getProvenanceState() {
    return state.sequenceAgentRuntime?.timingTrackProvenance && typeof state.sequenceAgentRuntime.timingTrackProvenance === "object"
      ? state.sequenceAgentRuntime.timingTrackProvenance
      : {};
  }

  function setProvenanceState(records = {}) {
    ensureSequenceAgentRuntimeState().timingTrackProvenance = records && typeof records === "object" ? records : {};
  }

  function getGlobalXdTrackPolicies() {
    const policies = getPoliciesState();
    const rows = [];
    for (const [key, value] of Object.entries(policies)) {
      if (!str(key).startsWith("__xd_global__::")) continue;
      if (!value || typeof value !== "object") continue;
      const sourceTrack = str(value.sourceTrack || key.replace(/^__xd_global__::/i, ""));
      const userTrack = str(value.trackName || deriveUserOwnedTrackNameFromXd(sourceTrack));
      rows.push({
        policyKey: key,
        sourceTrack,
        userTrack,
        manual: Boolean(value.manual),
        lockedAt: str(value.lockedAt),
        updatedAt: str(value.updatedAt)
      });
    }
    return rows.sort((a, b) => a.sourceTrack.localeCompare(b.sourceTrack));
  }

  function getManualLockedXdTracks() {
    return getGlobalXdTrackPolicies().filter((row) => row.manual);
  }

  function getOwnershipRows() {
    return getGlobalXdTrackPolicies().map((row) => ({
      sourceTrack: row.sourceTrack,
      trackName: row.userTrack || row.sourceTrack,
      manual: Boolean(row.manual),
      lockedAt: row.lockedAt,
      updatedAt: row.updatedAt
    }));
  }

  function removeGlobalXdManualLocks() {
    const policies = getPoliciesState();
    let changed = 0;
    for (const key of Object.keys(policies)) {
      if (!str(key).startsWith("__xd_global__::")) continue;
      const row = policies[key];
      if (!row || typeof row !== "object" || !row.manual) continue;
      policies[key] = {
        ...row,
        manual: false,
        updatedAt: new Date().toISOString()
      };
      changed += 1;
    }
    setPoliciesState(policies);
    return changed;
  }

  async function acceptTimingTrackReview({
    policyKey = "",
    trackName = "",
    acceptedAt = "",
    reviewer = "",
    note = "",
    refreshSections = true
  } = {}) {
    const currentSectionTrackName = str(state.ui?.sectionTrackName);
    const resolvedTrackName = str(trackName) || (isXdTimingTrack(currentSectionTrackName) ? currentSectionTrackName : "");
    const resolvedPolicyKey = str(policyKey) || (resolvedTrackName ? buildGlobalXdTrackPolicyKey(resolvedTrackName) : "");
    if (!resolvedPolicyKey) {
      setStatusWithDiagnostics("warning", "Timing review accept failed: no XD timing track was specified.");
      render();
      return { ok: false, error: "missing_timing_track" };
    }

    const result = reconcileTimingTrackReviewState({
      policyKey: resolvedPolicyKey,
      timingTrackProvenance: getProvenanceState(),
      timingGeneratedSignatures: getGeneratedSignaturesState(),
      acceptedAt,
      reviewer,
      note
    });
    if (!result.updated || !result.record) {
      setStatusWithDiagnostics("warning", `Timing review accept failed: no tracked provenance record for ${resolvedTrackName || resolvedPolicyKey}.`);
      render();
      return { ok: false, error: "timing_track_not_tracked", policyKey: resolvedPolicyKey };
    }

    setProvenanceState(result.timingTrackProvenance);
    setGeneratedSignaturesState(result.timingGeneratedSignatures);

    const acceptedTrackName = str(result.record?.trackName || resolvedTrackName);
    const shouldRefreshSections = Boolean(refreshSections && acceptedTrackName && acceptedTrackName === currentSectionTrackName);
    if (shouldRefreshSections && typeof refreshSectionsForTrack === "function") {
      try {
        await refreshSectionsForTrack(acceptedTrackName);
      } catch (err) {
        setStatusWithDiagnostics("warning", `Timing review accepted, but section refresh failed: ${String(err?.message || err)}`);
        saveCurrentProjectSnapshot();
        persist();
        render();
        return {
          ok: true,
          policyKey: resolvedPolicyKey,
          trackName: acceptedTrackName,
          refreshed: false,
          warning: String(err?.message || err)
        };
      }
    }

    setStatus("info", `Accepted current timing review for ${acceptedTrackName || resolvedPolicyKey}.`);
    saveCurrentProjectSnapshot();
    persist();
    render();
    return {
      ok: true,
      policyKey: resolvedPolicyKey,
      trackName: acceptedTrackName,
      refreshed: shouldRefreshSections
    };
  }

  return {
    buildGlobalXdTrackPolicyKey,
    deriveUserOwnedTrackNameFromXd,
    getPoliciesState,
    setPoliciesState,
    getGeneratedSignaturesState,
    setGeneratedSignaturesState,
    getProvenanceState,
    setProvenanceState,
    getGlobalXdTrackPolicies,
    getManualLockedXdTracks,
    getOwnershipRows,
    removeGlobalXdManualLocks,
    acceptTimingTrackReview
  };
}
