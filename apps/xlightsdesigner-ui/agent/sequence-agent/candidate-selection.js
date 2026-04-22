import { finalizeArtifact } from '../shared/artifact-ids.js';

function str(value = '') {
  return String(value || '').trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function clamp01(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  if (number <= 0) return 0;
  if (number >= 1) return 1;
  return number;
}

function bandToScore(value = '') {
  const band = str(value).toLowerCase();
  if (band === 'high') return 0.85;
  if (band === 'medium') return 0.55;
  if (band === 'low') return 0.25;
  return 0.5;
}

function weightFromBand(value = '') {
  const band = str(value).toLowerCase();
  if (band === 'high') return 0.75;
  if (band === 'low') return 0.35;
  return 0.55;
}

function explorationWeight(intentEnvelope = null) {
  return weightFromBand(intentEnvelope?.novelty?.explorationPressure);
}

function reuseToleranceWeight(intentEnvelope = null) {
  return weightFromBand(intentEnvelope?.novelty?.reuseTolerance);
}

function computeCandidateScore(candidate = null, intentEnvelope = null, selectionContext = null) {
  const fitScore = bandToScore(candidate?.fitSignals?.overallFit);
  const revisionScore = clamp01(candidate?.revisionSignals?.revisionScore);
  const noveltyScore = clamp01(candidate?.noveltySignals?.noveltyScore);
  const memoryPenalty = clamp01(candidate?.noveltySignals?.memoryPenalty);
  const riskBands = [
    candidate?.riskSignals?.attentionConflictRisk,
    candidate?.riskSignals?.layeringConflictRisk,
    candidate?.riskSignals?.complexityRisk,
    candidate?.riskSignals?.renderUncertainty
  ].map((row) => bandToScore(row));
  const meanRisk = riskBands.length
    ? riskBands.reduce((sum, row) => sum + row, 0) / riskBands.length
    : 0.5;
  const exploration = explorationWeight(intentEnvelope);
  const reuseTolerance = reuseToleranceWeight(intentEnvelope);
  const retryPressureSignals = arr(selectionContext?.retryPressureSignals).map((row) => str(row)).filter(Boolean);
  const lowChangeRetryPressure = retryPressureSignals.includes('low_change_retry') ? 1 : 0;
  const fitComponent = fitScore * 0.42;
  const revisionComponent = revisionScore * 0.18;
  const noveltyComponent = noveltyScore * (0.15 + (exploration * 0.2) + (lowChangeRetryPressure * 0.08));
  const safetyComponent = (1 - meanRisk) * (0.15 + ((1 - reuseTolerance) * 0.1));
  const reusePenaltyComponent = memoryPenalty * (0.08 + ((1 - reuseTolerance) * 0.08));
  const lowChangePenaltyComponent = lowChangeRetryPressure * (0.06 * (1 - noveltyScore));
  return Number((fitComponent + revisionComponent + noveltyComponent + safetyComponent - reusePenaltyComponent - lowChangePenaltyComponent).toFixed(4));
}

function selectionMode(selectionSeed = '') {
  return str(selectionSeed) ? 'bounded_exploration' : 'deterministic_preview';
}

function scoreBand(score = 0) {
  if (score >= 0.75) return 'high';
  if (score >= 0.5) return 'medium';
  return 'low';
}

export function buildCandidateSelectionV1({
  intentEnvelope = null,
  realizationCandidates = null,
  renderValidationEvidence = null,
  selectionSeed = '',
  selectionContext = null
} = {}) {
  const candidates = arr(realizationCandidates?.candidates);
  const scoredCandidates = candidates
    .map((candidate) => ({
      candidateId: str(candidate?.candidateId),
      selectionScore: computeCandidateScore(candidate, intentEnvelope, selectionContext),
      fitScore: bandToScore(candidate?.fitSignals?.overallFit),
      revisionScore: clamp01(candidate?.revisionSignals?.revisionScore),
      noveltyScore: clamp01(candidate?.noveltySignals?.noveltyScore),
      riskScore: Number((1 - (
        [
          candidate?.riskSignals?.attentionConflictRisk,
          candidate?.riskSignals?.layeringConflictRisk,
          candidate?.riskSignals?.complexityRisk,
          candidate?.riskSignals?.renderUncertainty
        ].map((row) => bandToScore(row)).reduce((sum, row) => sum + row, 0) / 4
      )).toFixed(4))
    }))
    .sort((left, right) => right.selectionScore - left.selectionScore || left.candidateId.localeCompare(right.candidateId));

  const topScore = scoredCandidates[0]?.selectionScore ?? 0;
  const eligibleBand = scoredCandidates.filter((candidate) => candidate.selectionScore >= (topScore - 0.12));
  const primaryCandidateId = eligibleBand[0]?.candidateId || scoredCandidates[0]?.candidateId || null;

  return finalizeArtifact({
    artifactType: 'candidate_selection_v1',
    artifactVersion: '1.0',
    source: {
      intentEnvelopeRef: str(intentEnvelope?.artifactId),
      realizationCandidatesRef: str(realizationCandidates?.artifactId),
      renderValidationEvidenceRef: str(renderValidationEvidence?.renderObservationRef)
    },
    policy: {
      mode: selectionMode(selectionSeed),
      explorationReady: true,
      deterministicPreview: !str(selectionSeed),
      boundedBandWidth: 0.12,
      phase: str(selectionContext?.phase || 'plan'),
      explorationEnabled: Boolean(selectionContext?.explorationEnabled)
    },
    scoredCandidates: scoredCandidates.map((candidate) => ({
      ...candidate,
      scoreBand: scoreBand(candidate.selectionScore)
    })),
    selectedBand: {
      candidateIds: eligibleBand.map((candidate) => candidate.candidateId),
      size: eligibleBand.length,
      topScore: Number(topScore.toFixed(4))
    },
    primaryCandidateId,
    selectionContext: selectionContext && typeof selectionContext === 'object'
        ? {
          phase: str(selectionContext.phase || 'plan'),
          seed: str(selectionContext.seed),
          explorationEnabled: Boolean(selectionContext.explorationEnabled),
          unresolvedSignals: arr(selectionContext.unresolvedSignals).map((row) => str(row)).filter(Boolean),
          retryPressureSignals: arr(selectionContext.retryPressureSignals).map((row) => str(row)).filter(Boolean)
        }
      : null,
    notes: [
      'candidate_selection_v1 narrows the valid comparison band without collapsing the system into one mandatory deterministic answer.',
      str(selectionSeed)
        ? 'A selection seed was provided; runtime may sample inside the eligible band.'
        : 'No selection seed was provided; this artifact is a deterministic preview of the current best band.'
    ]
  });
}
