import { finalizeArtifact } from "../shared/artifact-ids.js";

function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function nowIso() {
  return new Date().toISOString();
}

function normalizePreferenceSignal(signal = {}) {
  const weight = Number(signal?.weight);
  const confidence = Number(signal?.confidence);
  const evidenceCount = Number(signal?.evidenceCount);
  return {
    weight: Number.isFinite(weight) ? clamp(weight, -1, 1) : 0,
    confidence: Number.isFinite(confidence) ? clamp(confidence, 0, 1) : 0,
    evidenceCount: Number.isFinite(evidenceCount) ? Math.max(0, Math.trunc(evidenceCount)) : 0,
    lastUpdatedAt: str(signal?.lastUpdatedAt || nowIso()),
    notes: str(signal?.notes || "")
  };
}

function summarizeDirectorProfile(profile = {}) {
  const preferences = isPlainObject(profile?.preferences) ? profile.preferences : {};
  const ranked = Object.entries(preferences)
    .map(([key, signal]) => [key, normalizePreferenceSignal(signal)])
    .filter(([, signal]) => signal.evidenceCount > 0 && signal.confidence >= 0.2 && Math.abs(signal.weight) >= 0.2)
    .sort((a, b) => {
      const scoreA = Math.abs(a[1].weight) * a[1].confidence;
      const scoreB = Math.abs(b[1].weight) * b[1].confidence;
      return scoreB - scoreA;
    })
    .slice(0, 3)
    .map(([key, signal]) => {
      const direction = signal.weight >= 0 ? "prefers" : "tends to avoid";
      return `${direction} ${key}`;
    });
  return ranked.join("; ");
}

export function buildDefaultDirectorProfile({
  directorId = "default-director",
  displayName = "Director"
} = {}) {
  const profile = {
    directorId: str(directorId || "default-director"),
    displayName: str(displayName || "Director"),
    preferences: {},
    evidence: {
      acceptedProposalIds: [],
      rejectedProposalIds: [],
      explicitPreferenceNotes: []
    }
  };
  profile.summary = summarizeDirectorProfile(profile);
  return finalizeArtifact({
    artifactType: "director_profile_v1",
    artifactVersion: "1.0",
    ...profile
  });
}

export function normalizeDirectorProfile(profile = null, fallback = {}) {
  const base = buildDefaultDirectorProfile(fallback);
  if (!isPlainObject(profile)) return base;
  const normalized = {
    ...base,
    artifactType: "director_profile_v1",
    artifactVersion: "1.0",
    directorId: str(profile?.directorId || base.directorId),
    displayName: str(profile?.displayName || base.displayName),
    preferences: {},
    evidence: {
      acceptedProposalIds: arr(profile?.evidence?.acceptedProposalIds).map((row) => str(row)).filter(Boolean),
      rejectedProposalIds: arr(profile?.evidence?.rejectedProposalIds).map((row) => str(row)).filter(Boolean),
      explicitPreferenceNotes: arr(profile?.evidence?.explicitPreferenceNotes).map((row) => str(row)).filter(Boolean)
    }
  };
  const incomingPrefs = isPlainObject(profile?.preferences) ? profile.preferences : {};
  for (const [key, value] of Object.entries(incomingPrefs)) {
    normalized.preferences[key] = normalizePreferenceSignal(value);
  }
  normalized.summary = str(profile?.summary || summarizeDirectorProfile(normalized));
  return finalizeArtifact({
    artifactType: "director_profile_v1",
    artifactVersion: "1.0",
    createdAt: str(profile?.createdAt || base.createdAt),
    ...normalized
  });
}

function updateSignal(signal = {}, observedWeight = 0, note = "") {
  const current = normalizePreferenceSignal(signal);
  const nextEvidence = current.evidenceCount + 1;
  const alpha = current.evidenceCount === 0 ? 1 : Math.min(0.35, 1 / nextEvidence + 0.12);
  const nextWeight = clamp(current.weight + ((observedWeight - current.weight) * alpha), -1, 1);
  const nextConfidence = clamp(current.confidence + (0.12 * (1 - current.confidence)), 0, 1);
  return {
    weight: nextWeight,
    confidence: nextConfidence,
    evidenceCount: nextEvidence,
    lastUpdatedAt: nowIso(),
    notes: str(note || current.notes || "")
  };
}

function inferAcceptedProposalSignals(proposalBundle = {}) {
  const scopeTargets = arr(proposalBundle?.scope?.targetIds).filter(Boolean);
  const focalCandidates = arr(proposalBundle?.traceability?.designSceneSignals?.focalCandidates).filter(Boolean);
  const changeTolerance = str(proposalBundle?.constraints?.changeTolerance).toLowerCase();
  const impact = Number(proposalBundle?.impact?.estimatedImpact || 0);
  const proposalLineCount = arr(proposalBundle?.proposalLines).length;
  const signals = [];

  if (changeTolerance === "low") {
    signals.push(["changeTolerance", -0.45, "Accepted lower-impact revisions."]);
  } else if (changeTolerance === "high" || changeTolerance === "aggressive") {
    signals.push(["changeTolerance", 0.45, "Accepted broad or aggressive revisions."]);
  }

  if (scopeTargets.length > 0) {
    const focalOverlap = scopeTargets.some((target) => focalCandidates.includes(target));
    if (scopeTargets.length <= 2 || focalOverlap) {
      signals.push(["focusBias", focalOverlap ? 0.6 : 0.35, "Accepted focal or tightly scoped target selections."]);
    } else if (scopeTargets.length >= 6) {
      signals.push(["focusBias", -0.2, "Accepted broader coverage across many targets."]);
    }
  }

  if (impact >= 60 || proposalLineCount >= 6) {
    signals.push(["complexityTolerance", 0.4, "Accepted a higher-complexity proposal bundle."]);
  } else if (impact > 0 && impact <= 20 && proposalLineCount <= 2) {
    signals.push(["complexityTolerance", -0.2, "Accepted a restrained low-complexity proposal bundle."]);
  }

  return signals;
}

export function applyAcceptedProposalToDirectorProfile(profile = null, { proposalBundle = null } = {}) {
  const normalized = normalizeDirectorProfile(profile);
  if (!isPlainObject(proposalBundle)) return normalized;
  const next = normalizeDirectorProfile(normalized);
  const proposalId = str(proposalBundle?.proposalId);
  if (proposalId && !next.evidence.acceptedProposalIds.includes(proposalId)) {
    next.evidence.acceptedProposalIds = [proposalId, ...next.evidence.acceptedProposalIds].slice(0, 100);
  }

  for (const [key, observedWeight, note] of inferAcceptedProposalSignals(proposalBundle)) {
    next.preferences[key] = updateSignal(next.preferences[key], observedWeight, note);
  }

  next.summary = summarizeDirectorProfile(next);
  return next;
}
