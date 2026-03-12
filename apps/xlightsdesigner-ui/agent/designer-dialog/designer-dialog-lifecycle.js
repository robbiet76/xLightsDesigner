function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nowIso() {
  return new Date().toISOString();
}

export function buildProposalLifecycle(baseRevision = "unknown") {
  const revision = str(baseRevision || "unknown");
  return {
    status: "fresh",
    stale: false,
    baseRevision: revision,
    currentRevision: revision,
    rebasedFrom: null,
    staleReason: "",
    updatedAt: nowIso()
  };
}

export function ensureProposalLifecycle(bundle = {}) {
  if (!isPlainObject(bundle)) return bundle;
  if (isPlainObject(bundle.lifecycle)) return bundle;
  return {
    ...bundle,
    lifecycle: buildProposalLifecycle(bundle.baseRevision)
  };
}

export function markProposalBundleStale(bundle = {}, { currentRevision = "unknown", reason = "sequence_revision_changed" } = {}) {
  const next = ensureProposalLifecycle(bundle);
  if (!isPlainObject(next)) return next;
  return {
    ...next,
    lifecycle: {
      ...next.lifecycle,
      status: "stale",
      stale: true,
      currentRevision: str(currentRevision || "unknown"),
      staleReason: str(reason),
      updatedAt: nowIso()
    }
  };
}

export function rebaseProposalBundle(bundle = {}, { newBaseRevision = "unknown" } = {}) {
  const next = ensureProposalLifecycle(bundle);
  if (!isPlainObject(next)) return next;
  const oldBase = str(next.baseRevision || next.lifecycle?.baseRevision || "unknown");
  const newBase = str(newBaseRevision || "unknown");
  return {
    ...next,
    baseRevision: newBase,
    lifecycle: {
      ...next.lifecycle,
      status: "rebased",
      stale: false,
      baseRevision: newBase,
      currentRevision: newBase,
      rebasedFrom: oldBase === newBase ? next.lifecycle?.rebasedFrom || null : oldBase,
      staleReason: "",
      updatedAt: nowIso()
    }
  };
}

export function deriveDesignerDraftState({ proposalBundle = null, proposed = [] } = {}) {
  const bundle = isPlainObject(proposalBundle) ? ensureProposalLifecycle(proposalBundle) : null;
  const lines = arr(proposed);
  return {
    draftBaseRevision: str(bundle?.baseRevision || bundle?.lifecycle?.baseRevision || "unknown"),
    hasDraftProposal: lines.length > 0,
    proposalStale: Boolean(bundle?.lifecycle?.stale)
  };
}
