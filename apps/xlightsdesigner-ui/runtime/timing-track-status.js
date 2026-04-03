function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

export function timingMarksSignature(marks = []) {
  return arr(marks)
    .map((mark) => {
      const startMs = Math.max(0, Math.round(Number(mark?.startMs || 0)));
      const endMs = Math.max(startMs + 1, Math.round(Number(mark?.endMs || (startMs + 1))));
      const label = str(mark?.label);
      return `${startMs}:${endMs}:${label}`;
    })
    .filter(Boolean)
    .sort()
    .join("|");
}

export function classifyTimingTrackProvenance(record = {}, { expectedGeneratedSignature = "" } = {}) {
  const sourceMarks = arr(record?.source?.marks);
  const userFinalMarks = arr(record?.userFinal?.marks);
  const sourceSignature = timingMarksSignature(sourceMarks);
  const userFinalSignature = timingMarksSignature(userFinalMarks);
  const expectedSignature = str(expectedGeneratedSignature);
  const diffSummary = record?.diff?.summary && typeof record.diff.summary === "object"
    ? record.diff.summary
    : {
        unchanged: 0,
        moved: 0,
        relabeled: 0,
        addedByUser: 0,
        removedFromSource: 0
      };
  const hasUserEdits = Boolean(
    Number(diffSummary.moved || 0) ||
    Number(diffSummary.relabeled || 0) ||
    Number(diffSummary.addedByUser || 0) ||
    Number(diffSummary.removedFromSource || 0)
  );
  const stale = Boolean(expectedSignature && sourceSignature && expectedSignature !== sourceSignature);
  const status = stale
    ? "stale"
    : (hasUserEdits ? "user_edited" : "unchanged");
  return {
    trackType: str(record?.trackType),
    trackName: str(record?.trackName),
    status,
    stale,
    userEdited: hasUserEdits,
    unchanged: !stale && !hasUserEdits,
    coverageMode: str(record?.coverageMode || ""),
    sourceSignature,
    userFinalSignature,
    expectedGeneratedSignature: expectedSignature,
    capturedAt: str(record?.userFinal?.capturedAt),
    diffSummary
  };
}

export function buildTimingTrackStatusRows({
  timingTrackProvenance = {},
  timingGeneratedSignatures = {},
  timingTrackPolicies = {}
} = {}) {
  const records = timingTrackProvenance && typeof timingTrackProvenance === "object" ? timingTrackProvenance : {};
  const signatures = timingGeneratedSignatures && typeof timingGeneratedSignatures === "object" ? timingGeneratedSignatures : {};
  const policies = timingTrackPolicies && typeof timingTrackPolicies === "object" ? timingTrackPolicies : {};
  return Object.entries(records)
    .map(([policyKey, record]) => {
      const row = classifyTimingTrackProvenance(record, {
        expectedGeneratedSignature: signatures?.[policyKey]
      });
      const policy = policies?.[policyKey] && typeof policies[policyKey] === "object" ? policies[policyKey] : {};
      return {
        policyKey,
        trackName: row.trackName || str(policy?.trackName || policy?.sourceTrack),
        sourceTrack: str(policy?.sourceTrack || row.trackName),
        manual: Boolean(policy?.manual),
        ...row
      };
    })
    .filter((row) => row.trackName)
    .sort((a, b) => a.trackName.localeCompare(b.trackName));
}
