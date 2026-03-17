function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(values = []) {
  return [...new Set(arr(values).map((value) => str(value)).filter(Boolean))];
}

function normalizeRevisionNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isInteger(num) && num >= 0 ? num : fallback;
}

export function normalizeDesignRevisionTarget(target = null) {
  if (!target || typeof target !== "object") return null;
  const designId = str(target.designId);
  if (!designId) return null;
  return {
    designId,
    designRevision: normalizeRevisionNumber(target.designRevision, 0),
    priorDesignRevision: normalizeRevisionNumber(target.priorDesignRevision, Math.max(0, normalizeRevisionNumber(target.designRevision, 0) - 1)),
    designAuthor: str(target.designAuthor || "designer") || "designer",
    sections: uniqueStrings(target.sections),
    targetIds: uniqueStrings(target.targetIds),
    summary: str(target.summary),
    designLabel: str(target.designLabel),
    requestedAt: str(target.requestedAt)
  };
}

function rebuildExecutionPlanStats(executionPlan = {}) {
  const sectionPlans = arr(executionPlan.sectionPlans);
  const primarySections = uniqueStrings(sectionPlans.map((row) => row?.section));
  const targetIds = uniqueStrings([
    ...sectionPlans.flatMap((row) => arr(row?.targetIds)),
    ...arr(executionPlan.effectPlacements).map((row) => row?.targetId)
  ]);
  return {
    ...executionPlan,
    primarySections,
    sectionCount: primarySections.length,
    targetCount: targetIds.length
  };
}

function retagRows(rows = [], target = null) {
  const normalized = normalizeDesignRevisionTarget(target);
  if (!normalized) return arr(rows);
  return arr(rows).map((row) => ({
    ...row,
    designId: normalized.designId,
    designRevision: normalized.designRevision,
    designAuthor: normalized.designAuthor
  }));
}

function spliceConceptRows(currentRows = [], revisedRows = [], designId = "") {
  const normalizedDesignId = str(designId);
  const source = arr(currentRows);
  const replacement = arr(revisedRows);
  let inserted = false;
  const out = [];
  for (const row of source) {
    if (str(row?.designId) === normalizedDesignId) {
      if (!inserted) {
        out.push(...replacement);
        inserted = true;
      }
      continue;
    }
    out.push(row);
  }
  if (!inserted) out.push(...replacement);
  return out;
}

export function mergeRevisedDesignConceptExecutionPlan({
  currentExecutionPlan = null,
  revisedExecutionPlan = null,
  revisionTarget = null
} = {}) {
  const target = normalizeDesignRevisionTarget(revisionTarget);
  const currentPlan = currentExecutionPlan && typeof currentExecutionPlan === "object" ? currentExecutionPlan : null;
  const revisedPlan = revisedExecutionPlan && typeof revisedExecutionPlan === "object" ? revisedExecutionPlan : null;
  if (!target || !currentPlan || !revisedPlan) return null;

  const revisedSectionPlans = retagRows(revisedPlan.sectionPlans, target);
  const revisedEffectPlacements = retagRows(revisedPlan.effectPlacements, target);

  const merged = {
    ...currentPlan,
    ...revisedPlan,
    designId: target.designId,
    designRevision: target.designRevision,
    designAuthor: target.designAuthor,
    sectionPlans: spliceConceptRows(currentPlan.sectionPlans, revisedSectionPlans, target.designId),
    effectPlacements: spliceConceptRows(currentPlan.effectPlacements, revisedEffectPlacements, target.designId)
  };

  return rebuildExecutionPlanStats(merged);
}
