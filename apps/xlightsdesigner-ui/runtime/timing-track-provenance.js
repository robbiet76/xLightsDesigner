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

function normalizeCoverageMark(mark = {}, fallbackStartMs = 0, fallbackEndMs = null) {
  const startMs = Math.max(0, num(mark?.startMs, fallbackStartMs));
  const requestedEnd = fallbackEndMs == null ? startMs + 1 : fallbackEndMs;
  const endMs = Math.max(startMs + 1, num(mark?.endMs, requestedEnd));
  return {
    startMs,
    endMs,
    label: str(mark?.label)
  };
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

export function normalizeTimingTrackCoverage(
  marks = [],
  {
    durationMs = 0,
    fillerLabel = "",
    preserveAdjacentBoundaries = false
  } = {}
) {
  const totalDurationMs = Math.max(1, num(durationMs, 0));
  const normalized = asArray(marks)
    .map((mark) => normalizeCoverageMark(mark))
    .filter((mark) => mark.startMs < totalDurationMs)
    .sort((a, b) => {
      if (a.startMs !== b.startMs) return a.startMs - b.startMs;
      if (a.endMs !== b.endMs) return a.endMs - b.endMs;
      return a.label.localeCompare(b.label);
    });

  const out = [];
  let cursor = 0;
  for (const rawMark of normalized) {
    const startMs = Math.max(cursor, rawMark.startMs);
    const endMs = Math.min(totalDurationMs, Math.max(startMs + 1, rawMark.endMs));
    if (startMs > cursor) {
      out.push({
        startMs: cursor,
        endMs: startMs,
        label: str(fillerLabel)
      });
    }
    if (startMs < totalDurationMs && endMs > startMs) {
      out.push({
        startMs,
        endMs,
        label: rawMark.label
      });
      cursor = endMs;
    }
    if (cursor >= totalDurationMs) break;
  }

  if (!out.length) {
    return [
      {
        startMs: 0,
        endMs: totalDurationMs,
        label: str(fillerLabel)
      }
    ];
  }

  if (cursor < totalDurationMs) {
    out.push({
      startMs: cursor,
      endMs: totalDurationMs,
      label: str(fillerLabel)
    });
  }

  const collapsed = [];
  for (const mark of out) {
    const normalizedMark = normalizeCoverageMark(mark);
    const prev = collapsed[collapsed.length - 1];
    if (
      !preserveAdjacentBoundaries &&
      prev &&
      prev.endMs === normalizedMark.startMs &&
      prev.label === normalizedMark.label
    ) {
      prev.endMs = normalizedMark.endMs;
      continue;
    }
    collapsed.push(normalizedMark);
  }

  if (collapsed.length) {
    collapsed[0].startMs = 0;
    collapsed[collapsed.length - 1].endMs = totalDurationMs;
    for (let idx = 1; idx < collapsed.length; idx += 1) {
      collapsed[idx].startMs = collapsed[idx - 1].endMs;
      if (collapsed[idx].endMs <= collapsed[idx].startMs) {
        collapsed[idx].endMs = Math.min(totalDurationMs, collapsed[idx].startMs + 1);
      }
    }
    collapsed[collapsed.length - 1].endMs = totalDurationMs;
  }

  return collapsed;
}

export function splitMarksAtBoundaries(marks = [], boundariesMs = [], { fillerLabel = "" } = {}) {
  const normalizedMarks = asArray(marks)
    .map((mark) => normalizeCoverageMark(mark))
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
  const normalizedBoundaries = [...new Set(asArray(boundariesMs).map((value) => Math.max(0, num(value, 0))))]
    .sort((a, b) => a - b);
  const out = [];

  for (const mark of normalizedMarks) {
    let cursor = mark.startMs;
    const internalBoundaries = normalizedBoundaries.filter((value) => value > mark.startMs && value < mark.endMs);
    for (const boundary of internalBoundaries) {
      if (boundary <= cursor) continue;
      out.push({
        startMs: cursor,
        endMs: boundary,
        label: mark.label
      });
      cursor = boundary;
    }
    if (cursor < mark.endMs) {
      out.push({
        startMs: cursor,
        endMs: mark.endMs,
        label: mark.label
      });
    }
  }

  return normalizeTimingTrackCoverage(out, {
    durationMs: normalizedMarks.length ? Math.max(...normalizedMarks.map((mark) => mark.endMs)) : 0,
    fillerLabel,
    preserveAdjacentBoundaries: true
  });
}

export function buildTimingTrackProvenanceRecord({
  trackType = "",
  trackName = "",
  sourceMarks = [],
  userFinalMarks = [],
  sourceProvenance = {},
  capturedAt = "",
  coverageMode = "sparse",
  durationMs = 0,
  fillerLabel = ""
} = {}) {
  const normalizedSource = coverageMode === "complete"
    ? normalizeTimingTrackCoverage(sourceMarks, { durationMs, fillerLabel })
    : asArray(sourceMarks).map(normalizeMark);
  const normalizedUserFinal = coverageMode === "complete"
    ? normalizeTimingTrackCoverage(userFinalMarks, { durationMs, fillerLabel })
    : asArray(userFinalMarks).map(normalizeMark);
  const diff = diffTimingTrackMarks(normalizedSource, normalizedUserFinal);
  return {
    trackType: str(trackType),
    trackName: str(trackName),
    coverageMode: str(coverageMode || "complete"),
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

export function refreshTimingTrackProvenanceRecord(
  existingRecord = {},
  {
    userFinalMarks = [],
    capturedAt = "",
    durationMs = 0,
    fillerLabel = ""
  } = {}
) {
  const prior = existingRecord && typeof existingRecord === "object" ? existingRecord : {};
  return buildTimingTrackProvenanceRecord({
    trackType: str(prior?.trackType),
    trackName: str(prior?.trackName),
    sourceMarks: asArray(prior?.source?.marks),
    userFinalMarks,
    sourceProvenance: prior?.source?.provenance && typeof prior.source.provenance === "object"
      ? { ...prior.source.provenance }
      : {},
    capturedAt,
    coverageMode: str(prior?.coverageMode || "sparse"),
    durationMs: num(durationMs, 0) || Math.max(
      0,
      ...asArray(prior?.source?.marks).map((mark) => num(mark?.endMs, 0)),
      ...asArray(userFinalMarks).map((mark) => num(mark?.endMs, 0))
    ),
    fillerLabel: str(fillerLabel)
  });
}
