import { acceptTimingTrackUserFinalAsReviewed } from "./timing-track-provenance.js";

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
    canReconcile: status === "user_edited" || status === "stale",
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

export function summarizeTimingTrackStatuses(rows = []) {
  const entries = arr(rows);
  const summary = {
    trackCount: entries.length,
    unchangedCount: 0,
    userEditedCount: 0,
    staleCount: 0,
    manualCount: 0,
    reconcilableCount: 0,
    needsReview: false,
    status: entries.length ? "clean" : "empty",
    summaryText: entries.length ? "No timing tracks tracked yet." : "No timing tracks tracked yet."
  };

  for (const row of entries) {
    if (row?.manual) summary.manualCount += 1;
    if (row?.canReconcile || row?.status === "user_edited" || row?.status === "stale") summary.reconcilableCount += 1;
    if (row?.status === "unchanged") summary.unchangedCount += 1;
    else if (row?.status === "user_edited") summary.userEditedCount += 1;
    else if (row?.status === "stale") summary.staleCount += 1;
  }

  summary.needsReview = summary.userEditedCount > 0 || summary.staleCount > 0;
  if (!entries.length) {
    summary.status = "empty";
    summary.summaryText = "No timing tracks tracked yet.";
    return summary;
  }
  if (summary.staleCount > 0) {
    summary.status = "stale";
    summary.summaryText = `${summary.staleCount} timing track${summary.staleCount === 1 ? "" : "s"} stale against the latest generated source.`;
    return summary;
  }
  if (summary.userEditedCount > 0) {
    summary.status = "edited";
    summary.summaryText = `${summary.userEditedCount} timing track${summary.userEditedCount === 1 ? "" : "s"} contain user edits.`;
    return summary;
  }
  summary.status = "clean";
  summary.summaryText = `${summary.unchangedCount} timing track${summary.unchangedCount === 1 ? "" : "s"} unchanged.`;
  return summary;
}

export function reconcileTimingTrackReviewState({
  policyKey = "",
  timingTrackProvenance = {},
  timingGeneratedSignatures = {},
  acceptedAt = "",
  reviewer = "",
  note = ""
} = {}) {
  const key = str(policyKey);
  const provenance = timingTrackProvenance && typeof timingTrackProvenance === "object"
    ? { ...timingTrackProvenance }
    : {};
  const signatures = timingGeneratedSignatures && typeof timingGeneratedSignatures === "object"
    ? { ...timingGeneratedSignatures }
    : {};
  const existingRecord = provenance?.[key] && typeof provenance[key] === "object" ? provenance[key] : null;
  if (!key || !existingRecord) {
    return {
      updated: false,
      timingTrackProvenance: provenance,
      timingGeneratedSignatures: signatures,
      record: null
    };
  }
  const record = acceptTimingTrackUserFinalAsReviewed(existingRecord, {
    acceptedAt,
    reviewer,
    note
  });
  provenance[key] = record;
  signatures[key] = timingMarksSignature(record.source.marks);
  return {
    updated: true,
    timingTrackProvenance: provenance,
    timingGeneratedSignatures: signatures,
    record
  };
}
