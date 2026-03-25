function str(value = "") {
  return String(value || "").trim();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeMark(mark = {}) {
  const startMs = num(mark?.startMs, 0);
  const endMs = Math.max(startMs + 1, num(mark?.endMs, startMs + 1));
  return {
    startMs,
    endMs,
    label: str(mark?.label)
  };
}

function markKey(mark = {}) {
  return `${num(mark?.startMs)}:${num(mark?.endMs)}:${str(mark?.label)}`;
}

function rangesEqual(a = {}, b = {}) {
  return num(a?.startMs) === num(b?.startMs) && num(a?.endMs) === num(b?.endMs);
}

function labelsEqual(a = {}, b = {}) {
  return str(a?.label) === str(b?.label);
}

function buildDiffSummary(entries = []) {
  const summary = {
    unchanged: 0,
    moved: 0,
    relabeled: 0,
    addedByUser: 0,
    removedFromSource: 0
  };
  for (const row of asArray(entries)) {
    const status = str(row?.status);
    if (status === "unchanged") summary.unchanged += 1;
    else if (status === "moved") summary.moved += 1;
    else if (status === "relabeled") summary.relabeled += 1;
    else if (status === "added_by_user") summary.addedByUser += 1;
    else if (status === "removed_from_source") summary.removedFromSource += 1;
  }
  return summary;
}

export function diffTimingTrackMarks(sourceMarks = [], userFinalMarks = []) {
  const source = asArray(sourceMarks).map(normalizeMark);
  const userFinal = asArray(userFinalMarks).map(normalizeMark);
  const usedUser = new Set();
  const entries = [];

  for (const sourceMark of source) {
    const exactIndex = userFinal.findIndex((mark, idx) => !usedUser.has(idx) && markKey(mark) === markKey(sourceMark));
    if (exactIndex >= 0) {
      usedUser.add(exactIndex);
      entries.push({
        status: "unchanged",
        source: sourceMark,
        userFinal: userFinal[exactIndex]
      });
      continue;
    }

    const movedIndex = userFinal.findIndex(
      (mark, idx) => !usedUser.has(idx) && labelsEqual(mark, sourceMark) && !rangesEqual(mark, sourceMark)
    );
    if (movedIndex >= 0) {
      usedUser.add(movedIndex);
      entries.push({
        status: "moved",
        source: sourceMark,
        userFinal: userFinal[movedIndex]
      });
      continue;
    }

    const relabeledIndex = userFinal.findIndex(
      (mark, idx) => !usedUser.has(idx) && rangesEqual(mark, sourceMark) && !labelsEqual(mark, sourceMark)
    );
    if (relabeledIndex >= 0) {
      usedUser.add(relabeledIndex);
      entries.push({
        status: "relabeled",
        source: sourceMark,
        userFinal: userFinal[relabeledIndex]
      });
      continue;
    }

    entries.push({
      status: "removed_from_source",
      source: sourceMark,
      userFinal: null
    });
  }

  for (let idx = 0; idx < userFinal.length; idx += 1) {
    if (usedUser.has(idx)) continue;
    entries.push({
      status: "added_by_user",
      source: null,
      userFinal: userFinal[idx]
    });
  }

  return {
    entries,
    summary: buildDiffSummary(entries)
  };
}

export function buildTimingTrackProvenanceRecord({
  trackType = "",
  trackName = "",
  sourceMarks = [],
  userFinalMarks = [],
  sourceProvenance = {},
  capturedAt = ""
} = {}) {
  const normalizedSource = asArray(sourceMarks).map(normalizeMark);
  const normalizedUserFinal = asArray(userFinalMarks).map(normalizeMark);
  const diff = diffTimingTrackMarks(normalizedSource, normalizedUserFinal);
  return {
    trackType: str(trackType),
    trackName: str(trackName),
    source: {
      marks: normalizedSource,
      provenance: sourceProvenance && typeof sourceProvenance === "object" ? { ...sourceProvenance } : {}
    },
    userFinal: {
      marks: normalizedUserFinal,
      capturedAt: str(capturedAt)
    },
    diff
  };
}
