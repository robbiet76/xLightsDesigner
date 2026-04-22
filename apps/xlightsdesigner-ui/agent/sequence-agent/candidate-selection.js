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

function biasAlignmentScore(candidate = null, selectionContext = null) {
  const changeBias = selectionContext && typeof selectionContext?.changeBias === 'object'
    ? selectionContext.changeBias
    : null;
  if (!changeBias) return 0.5;

  let score = 0.5;
  let signalCount = 0;
  const footprint = str(candidate?.compositionProfile?.footprint);
  const temporalProfile = str(candidate?.temporalProfile?.profile);
  const sameStructureDensity = str(candidate?.layeringProfile?.sameStructureDensity);
  const separationStrategy = str(candidate?.layeringProfile?.separationStrategy);

  const targetShape = str(changeBias?.composition?.targetShape);
  if (changeBias?.composition?.mismatch && targetShape) {
    signalCount += 1;
    if (targetShape === 'narrow_focus') {
      score += ['narrow', 'moderate'].includes(footprint) ? 0.22 : -0.12;
    } else if (targetShape === 'broaden_support') {
      score += ['broad', 'full_scene'].includes(footprint) ? 0.22 : -0.12;
    }
  }

  const temporalVariation = str(changeBias?.progression?.temporalVariation);
  if (changeBias?.progression?.mismatch && temporalVariation) {
    signalCount += 1;
    if (temporalVariation === 'increase') {
      score += temporalProfile === 'evolving' ? 0.22 : temporalProfile === 'modulated' ? 0.08 : -0.12;
    } else if (temporalVariation === 'preserve') {
      score += temporalProfile === 'steady' || temporalProfile === 'modulated' ? 0.18 : -0.08;
    }
  }

  const density = str(changeBias?.layering?.density);
  const separation = str(changeBias?.layering?.separation);
  if (changeBias?.layering?.mismatch && (density || separation)) {
    signalCount += 1;
    if (density === 'reduce') {
      score += sameStructureDensity === 'low' ? 0.18 : sameStructureDensity === 'medium' ? 0.05 : -0.12;
    } else if (density === 'preserve') {
      score += sameStructureDensity === 'unconstrained' ? 0.08 : 0.12;
    }
    if (separation === 'increase') {
      score += separationStrategy === 'high' ? 0.18 : separationStrategy === 'medium' ? 0.05 : -0.1;
    } else if (separation === 'clarify') {
      score += ['medium', 'high'].includes(separationStrategy) ? 0.14 : -0.08;
    }
  }

  if (!signalCount) return 0.5;
  return clamp01(score);
}

function computeCandidateScore(candidate = null, intentEnvelope = null, selectionContext = null) {
  const fitScore = bandToScore(candidate?.fitSignals?.overallFit);
  const revisionScore = clamp01(candidate?.revisionSignals?.revisionScore);
  const noveltyScore = clamp01(candidate?.noveltySignals?.noveltyScore);
  const biasAlignment = biasAlignmentScore(candidate, selectionContext);
  const memoryPenalty = clamp01(candidate?.noveltySignals?.memoryPenalty);
  const oscillationPenalty = clamp01(candidate?.noveltySignals?.oscillationPenalty);
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
  const biasAlignmentComponent = biasAlignment * 0.12;
  const noveltyComponent = noveltyScore * (0.15 + (exploration * 0.2) + (lowChangeRetryPressure * 0.08));
  const safetyComponent = (1 - meanRisk) * (0.15 + ((1 - reuseTolerance) * 0.1));
  const reusePenaltyComponent = memoryPenalty * (0.08 + ((1 - reuseTolerance) * 0.08));
  const lowChangePenaltyComponent = lowChangeRetryPressure * (0.06 * (1 - noveltyScore));
  const oscillationPenaltyComponent = oscillationPenalty * 0.18;
  return Number((fitComponent + revisionComponent + biasAlignmentComponent + noveltyComponent + safetyComponent - reusePenaltyComponent - lowChangePenaltyComponent - oscillationPenaltyComponent).toFixed(4));
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
      biasAlignmentScore: biasAlignmentScore(candidate, selectionContext),
      noveltyScore: clamp01(candidate?.noveltySignals?.noveltyScore),
      oscillationRisk: str(candidate?.noveltySignals?.oscillationRisk),
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
          retryPressureSignals: arr(selectionContext.retryPressureSignals).map((row) => str(row)).filter(Boolean),
          changeBias: selectionContext.changeBias && typeof selectionContext.changeBias === 'object'
            ? {
                composition: selectionContext.changeBias.composition && typeof selectionContext.changeBias.composition === 'object'
                  ? {
                      mismatch: Boolean(selectionContext.changeBias.composition.mismatch),
                      targetShape: str(selectionContext.changeBias.composition.targetShape)
                    }
                  : null,
                progression: selectionContext.changeBias.progression && typeof selectionContext.changeBias.progression === 'object'
                  ? {
                      mismatch: Boolean(selectionContext.changeBias.progression.mismatch),
                      temporalVariation: str(selectionContext.changeBias.progression.temporalVariation)
                    }
                  : null,
                layering: selectionContext.changeBias.layering && typeof selectionContext.changeBias.layering === 'object'
                  ? {
                      mismatch: Boolean(selectionContext.changeBias.layering.mismatch),
                      separation: str(selectionContext.changeBias.layering.separation),
                      density: str(selectionContext.changeBias.layering.density)
                    }
                  : null
              }
            : null
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
