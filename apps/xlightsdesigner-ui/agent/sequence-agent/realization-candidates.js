import { finalizeArtifact } from '../shared/artifact-ids.js';
import {
  recommendEffectsForTargets,
  recommendEffectsForVisualFamilies,
  resolveDirectCueEffectCandidates,
  selectPreferredEffect
} from '../shared/effect-semantics-registry.js';
import { resolveTranslationLayer } from './translation-layer.js';

function str(value = '') {
  return String(value || '').trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function unique(values = []) {
  return [...new Set(arr(values).map((row) => str(row)).filter(Boolean))];
}

function overlapRatio(left = [], right = []) {
  const a = new Set(unique(left));
  const b = new Set(unique(right));
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  for (const value of a) {
    if (b.has(value)) overlap += 1;
  }
  return overlap / Math.max(a.size, b.size);
}

function valuesEquivalent(left = [], right = []) {
  const a = unique(left);
  const b = unique(right);
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function computeRevisionFit({ sequencerRevisionBrief = null, targetIds = [], attentionProfile = '' } = {}) {
  const revisionRoles = new Set(arr(sequencerRevisionBrief?.revisionRoles).map((row) => str(row)));
  const revisionTargets = unique(sequencerRevisionBrief?.revisionTargets);
  const focusTargets = unique(sequencerRevisionBrief?.focusTargets);
  const targetOverlap = overlapRatio(targetIds, [...revisionTargets, ...focusTargets]);
  let roleScore = 0.5;
  if (revisionRoles.has('strengthen_lead')) {
    roleScore = attentionProfile === 'concentrated' ? 0.9 : attentionProfile === 'weighted' ? 0.7 : 0.35;
  } else if (revisionRoles.has('reduce_competing_support')) {
    roleScore = attentionProfile === 'concentrated' ? 0.85 : attentionProfile === 'weighted' ? 0.65 : 0.3;
  } else if (revisionRoles.has('increase_section_contrast') || revisionRoles.has('add_section_development')) {
    roleScore = attentionProfile === 'weighted' ? 0.8 : attentionProfile === 'distributed' ? 0.65 : 0.55;
  } else if (revisionRoles.has('widen_support')) {
    roleScore = attentionProfile === 'distributed' ? 0.85 : attentionProfile === 'weighted' ? 0.7 : 0.4;
  }
  const overall = revisionTargets.length || focusTargets.length
    ? ((targetOverlap * 0.6) + (roleScore * 0.4))
    : roleScore;
  return {
    roleAlignment: fitBand(roleScore),
    targetAlignment: fitBand(targetOverlap),
    overallAlignment: fitBand(overall),
    score: Number(overall.toFixed(4))
  };
}

function inferCandidateAttentionProfile(targetIds = []) {
  const count = unique(targetIds).length;
  if (count <= 1) return 'concentrated';
  if (count <= 3) return 'weighted';
  return 'distributed';
}

function inferCandidateFootprint(targetIds = [], scopeTargets = []) {
  const count = unique(targetIds).length;
  const total = Math.max(1, unique(scopeTargets).length);
  const ratio = count / total;
  if (ratio >= 0.85) return 'full_scene';
  if (ratio >= 0.5) return 'broad';
  if (ratio >= 0.25) return 'moderate';
  return 'narrow';
}

function fitBand(score) {
  if (score >= 0.66) return 'high';
  if (score >= 0.33) return 'medium';
  return 'low';
}

function attentionFitScore(intentProfile = '', candidateProfile = '') {
  if (!intentProfile || intentProfile === 'unconstrained') return 0.7;
  if (intentProfile === candidateProfile) return 0.9;
  const pairs = new Set(['concentrated:weighted', 'weighted:concentrated', 'weighted:distributed', 'distributed:weighted']);
  return pairs.has(`${intentProfile}:${candidateProfile}`) ? 0.6 : 0.25;
}

function temporalFitScore(intentProfile = '', candidateProfile = '') {
  if (!intentProfile || intentProfile === 'unconstrained') return 0.7;
  if (intentProfile === candidateProfile) return 0.9;
  const pairs = new Set(['steady:modulated', 'modulated:evolving', 'evolving:modulated', 'pulsing:modulated']);
  return pairs.has(`${intentProfile}:${candidateProfile}`) ? 0.6 : 0.25;
}

function buildCandidate({
  id = '',
  summary = '',
  seeds = [],
  scopeTargets = [],
  intentEnvelope = null,
  noveltyScore = 0.5,
  riskBias = 'medium',
  priorPassMemory = null,
  sequencerRevisionBrief = null
} = {}) {
  const allTargets = unique(seeds.flatMap((row) => arr(row?.targetIds)));
  const allEffects = unique(seeds.map((row) => row?.effectName));
  const attentionProfile = inferCandidateAttentionProfile(allTargets);
  const temporalProfile = str(intentEnvelope?.temporal?.profile) || 'modulated';
  const overallFit = (attentionFitScore(intentEnvelope?.attention?.profile, attentionProfile) + temporalFitScore(intentEnvelope?.temporal?.profile, temporalProfile)) / 2;
  const riskValue = riskBias === 'low' ? 0.25 : riskBias === 'high' ? 0.75 : 0.5;
  const revisionFit = computeRevisionFit({
    sequencerRevisionBrief,
    targetIds: allTargets,
    attentionProfile
  });
  const targetReuseRatio = overlapRatio(allTargets, priorPassMemory?.previousTargetIds);
  const effectReuseRatio = overlapRatio(allEffects, priorPassMemory?.previousEffectNames);
  const memoryPenalty = Math.min(0.35, (targetReuseRatio * 0.2) + (effectReuseRatio * 0.25));
  const adjustedNoveltyScore = Math.max(0.05, Number((noveltyScore - memoryPenalty).toFixed(4)));
  const unresolvedSignals = unique(arr(priorPassMemory?.unresolvedSignals));
  const retryPressureSignals = unique(arr(priorPassMemory?.retryPressureSignals));
  const priorDelta = priorPassMemory?.revisionDeltaSummary && typeof priorPassMemory.revisionDeltaSummary === 'object'
    ? priorPassMemory.revisionDeltaSummary
    : null;
  const priorDeltaCurrentEffects = unique(priorDelta?.currentEffectNames);
  const priorDeltaCurrentTargets = unique(priorDelta?.currentTargetIds);
  const priorDeltaPreviousEffects = unique(priorDelta?.previousEffectNames);
  const priorDeltaPreviousTargets = unique(priorDelta?.previousTargetIds);
  const priorPassMateriallyChanged = valuesEquivalent(priorDeltaCurrentEffects, priorDeltaPreviousEffects) === false
    || valuesEquivalent(priorDeltaCurrentTargets, priorDeltaPreviousTargets) === false;
  const oscillatesBackToPrevious = Boolean(
    unresolvedSignals.length &&
    priorPassMateriallyChanged &&
    valuesEquivalent(allEffects, priorDeltaPreviousEffects) &&
    valuesEquivalent(allTargets, priorDeltaPreviousTargets)
  );
  const oscillationPenalty = oscillatesBackToPrevious ? 0.22 : 0;
  return {
    candidateId: id,
    summary,
    targetStrategy: {
      primaryTargets: allTargets.slice(0, 2),
      secondaryTargets: allTargets.slice(2),
      excludedTargets: unique(scopeTargets).filter((row) => !allTargets.includes(row)),
      exclusivityGroupRefs: []
    },
    attentionProfile: {
      profile: attentionProfile,
      stability: 'flexible',
      competitionLevel: attentionProfile === 'distributed' ? 'medium' : 'low'
    },
    temporalProfile: {
      profile: temporalProfile,
      variationLevel: str(intentEnvelope?.temporal?.variationLevel) || 'medium',
      energyShape: str(intentEnvelope?.temporal?.energyShape) || 'unconstrained'
    },
    compositionProfile: {
      footprint: inferCandidateFootprint(allTargets, scopeTargets),
      contrastStrategy: 'mixed',
      colorStrategy: 'unconstrained'
    },
    layeringProfile: {
      sameStructureDensity: str(intentEnvelope?.layering?.sameStructureDensity) || 'unconstrained',
      separationStrategy: str(intentEnvelope?.layering?.separationNeed) || 'medium',
      cadenceStrategy: str(intentEnvelope?.layering?.cadenceInteractionPreference) || 'unconstrained'
    },
    seedRecommendations: seeds.map((row) => ({
      section: str(row?.section),
      targetIds: unique(row?.targetIds),
      effectName: str(row?.effectName),
      executionLine: str(row?.executionLine),
      parameterPriorGuidance: row?.parameterPriorGuidance && typeof row.parameterPriorGuidance === 'object'
        ? row.parameterPriorGuidance
        : null,
      sharedSettingPriorGuidance: row?.sharedSettingPriorGuidance && typeof row.sharedSettingPriorGuidance === 'object'
        ? row.sharedSettingPriorGuidance
        : null
    })),
    realizationRefs: seeds.map((row, index) => ({
      realizationId: `${id}:realization:${index + 1}`,
      section: str(row?.section),
      targetIds: unique(row?.targetIds),
      effectName: str(row?.effectName),
      timingRole: 'section_window',
      settingsRef: null,
      paletteRef: null,
      layerIntent: null
    })),
    fitSignals: {
      attentionFit: fitBand(attentionFitScore(intentEnvelope?.attention?.profile, attentionProfile)),
      temporalFit: fitBand(temporalFitScore(intentEnvelope?.temporal?.profile, temporalProfile)),
      spatialFit: fitBand(0.7),
      textureFit: fitBand(0.6),
      colorFit: fitBand(0.5),
      revisionFit: revisionFit.overallAlignment,
      overallFit: fitBand(overallFit)
    },
    revisionSignals: {
      roleAlignment: revisionFit.roleAlignment,
      targetAlignment: revisionFit.targetAlignment,
      overallAlignment: revisionFit.overallAlignment,
      revisionScore: revisionFit.score
    },
    noveltySignals: {
      recentTargetReuse: targetReuseRatio >= 0.66 ? 'high' : targetReuseRatio >= 0.33 ? 'medium' : 'low',
      recentMotionReuse: effectReuseRatio >= 0.66 ? 'high' : effectReuseRatio >= 0.33 ? 'medium' : 'low',
      recentPaletteReuse: 'medium',
      recentCompositionReuse: targetReuseRatio >= 0.5 ? 'high' : 'medium',
      noveltyScore: adjustedNoveltyScore,
      memoryPenalty: Number(memoryPenalty.toFixed(4)),
      oscillationRisk: oscillatesBackToPrevious ? 'high' : retryPressureSignals.includes('low_change_retry') ? 'medium' : 'low',
      oscillationPenalty: Number(oscillationPenalty.toFixed(4))
    },
    riskSignals: {
      attentionConflictRisk: fitBand(riskValue),
      layeringConflictRisk: fitBand(riskValue * 0.8),
      complexityRisk: fitBand(Math.min(1, seeds.length / 4)),
      renderUncertainty: fitBand(0.5)
    },
    selectionHints: {
      explorationWeight: noveltyScore,
      safetyWeight: 1 - riskValue,
      revisionFriendliness: 0.65
    }
  };
}

function buildFeedbackShapedSeeds({
  primarySeeds = [],
  availableEffects = null,
  sequencerRevisionBrief = null,
  revisionFeedback = null
} = {}) {
  const feedbackDirection = revisionFeedback && typeof revisionFeedback.nextDirection === 'object'
    ? revisionFeedback.nextDirection
    : null;
  const changeBias = feedbackDirection && typeof feedbackDirection.changeBias === 'object'
    ? feedbackDirection.changeBias
    : null;
  const revisionTargets = unique([
    ...arr(feedbackDirection?.targetIds),
    ...arr(sequencerRevisionBrief?.focusTargets),
    ...arr(sequencerRevisionBrief?.revisionTargets)
  ]);
  const goalText = [
    str(feedbackDirection?.executionObjective),
    str(feedbackDirection?.artisticCorrection),
    str(sequencerRevisionBrief?.executionObjective),
    str(sequencerRevisionBrief?.artisticGoalSummary)
  ].filter(Boolean).join('. ');
  const directCueEffects = resolveDirectCueEffectCandidates({
    goalText,
    smoothBias: /\b(flow|flowing|restrained|smooth|gentle|soft)\b/i.test(goalText)
  });
  const hasTargetShift = revisionTargets.length > 0;
  const hasEffectCue = directCueEffects.length > 0;
  if (!hasTargetShift && !hasEffectCue) return [];

  return primarySeeds.map((seed) => {
    const seedTargets = unique(seed?.targetIds);
    const targetShape = str(changeBias?.composition?.targetShape);
    const nextTargets = targetShape === 'broaden_support'
      ? unique([...seedTargets, ...revisionTargets])
      : revisionTargets.length
        ? revisionTargets
        : seedTargets;
    const preferredEffect = hasEffectCue
      ? selectPreferredEffect(directCueEffects, { availableEffects })
      : '';
    const narrowedTargets = str(changeBias?.layering?.density) === 'reduce' && nextTargets.length > 1
      ? nextTargets.slice(0, 1)
      : nextTargets;
    return {
      ...seed,
      targetIds: narrowedTargets,
      effectName: preferredEffect || str(seed?.effectName)
    };
  });
}

export function buildRealizationCandidatesV1({
  intentEnvelope = null,
  effectStrategy = null,
  scope = {},
  displayElements = [],
  effectCatalog = null,
  translationIntent = null,
  priorPassMemory = null,
  sequencerRevisionBrief = null,
  revisionFeedback = null
} = {}) {
  const seeds = arr(effectStrategy?.seedRecommendations).filter((row) => row && typeof row === 'object');
  const scopeTargets = unique(scope?.targetIds);
  const availableEffects = effectCatalog?.byName && typeof effectCatalog.byName === 'object'
    ? new Set(Object.keys(effectCatalog.byName))
    : null;
  const primarySeeds = seeds.length ? seeds : [{ section: unique(scope?.sectionNames).join(', '), targetIds: scopeTargets, effectName: 'Color Wash' }];

  const translationLayer = resolveTranslationLayer({
    translationIntent,
    section: unique(scope?.sectionNames)[0] || '',
    targetIds: scopeTargets,
    availableEffects
  });

  const alternativeBySection = primarySeeds.map((seed) => {
    const targetAlternatives = recommendEffectsForTargets({
      summary: str(seed?.executionLine || seed?.section || ''),
      targetIds: unique(seed?.targetIds),
      displayElements,
      limit: 3
    }).map((row) => str(row?.effectName)).filter(Boolean);
    const familyAlternatives = recommendEffectsForVisualFamilies({
      preferredVisualFamilies: translationLayer?.preferredVisualFamilies,
      targetIds: unique(seed?.targetIds),
      displayElements,
      limit: 3
    }).map((row) => str(row?.effectName)).filter(Boolean);
    const all = unique([...targetAlternatives, ...familyAlternatives]).filter((row) => row !== str(seed?.effectName));
    return { seed, alternatives: all };
  });

  const baseCandidate = buildCandidate({
    id: 'candidate-base',
    summary: 'Base candidate from current seeded effect strategy.',
    seeds: primarySeeds,
    scopeTargets,
    intentEnvelope,
    noveltyScore: 0.35,
    riskBias: 'medium',
    priorPassMemory,
    sequencerRevisionBrief
  });

  const focusedSeeds = primarySeeds.map((row) => ({
    ...row,
    targetIds: unique(row?.targetIds).slice(0, 1)
  }));
  const focusedCandidate = buildCandidate({
    id: 'candidate-focused',
    summary: 'Focused candidate that narrows attention onto the smallest target set.',
    seeds: focusedSeeds,
    scopeTargets,
    intentEnvelope,
    noveltyScore: 0.55,
    riskBias: 'low',
    priorPassMemory,
    sequencerRevisionBrief
  });

  const alternateSeeds = alternativeBySection.map(({ seed, alternatives }) => ({
    ...seed,
    effectName: alternatives[0] || str(seed?.effectName)
  }));
  const alternateCandidate = buildCandidate({
    id: 'candidate-alternate',
    summary: 'Alternate candidate using different effect families where valid alternatives exist.',
    seeds: alternateSeeds,
    scopeTargets,
    intentEnvelope,
    noveltyScore: 0.75,
    riskBias: 'medium',
    priorPassMemory,
    sequencerRevisionBrief
  });

  const feedbackSeeds = buildFeedbackShapedSeeds({
    primarySeeds,
    availableEffects,
    sequencerRevisionBrief,
    revisionFeedback
  });
  const feedbackCandidate = feedbackSeeds.length
    ? buildCandidate({
        id: 'candidate-feedback',
        summary: 'Feedback-shaped candidate aligned to the current revision direction.',
        seeds: feedbackSeeds,
        scopeTargets,
        intentEnvelope,
        noveltyScore: 0.68,
        riskBias: 'medium',
        priorPassMemory,
        sequencerRevisionBrief
      })
    : null;

  const candidates = [baseCandidate, focusedCandidate, alternateCandidate, feedbackCandidate]
    .filter(Boolean)
    .filter((row, index, list) => list.findIndex((other) => JSON.stringify(other.realizationRefs) === JSON.stringify(row.realizationRefs)) === index);

  return finalizeArtifact({
    artifactType: 'realization_candidates_v1',
    artifactVersion: '1.0',
    source: {
      intentEnvelopeRef: str(intentEnvelope?.artifactId),
      translationIntentRef: str(translationIntent?.artifactId)
    },
    scope: {
      scopeLevel: str(intentEnvelope?.scope?.scopeLevel || 'moment'),
      sectionNames: unique(scope?.sectionNames),
      targetIds: scopeTargets
    },
    candidates,
    notes: [
      'realization_candidates_v1 preserves multiple materially different valid options for sequencer comparison.',
      'selection is deferred to the sequencer agent; this artifact is not a final ranking.'
    ]
  });
}
