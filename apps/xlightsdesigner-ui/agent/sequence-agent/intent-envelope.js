import { finalizeArtifact } from '../shared/artifact-ids.js';

function str(value = '') {
  return String(value || '').trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function unique(values = []) {
  return [...new Set(arr(values).map((row) => str(row)).filter(Boolean))];
}

function firstBehaviorTarget(translationIntent = null) {
  const rows = arr(translationIntent?.behaviorTargets).filter((row) => row && typeof row === 'object');
  return rows[0] || null;
}

function inferAttentionProfile({ sequencerRevisionBrief = null, scope = {} } = {}) {
  const leadTarget = str(sequencerRevisionBrief?.leadTarget);
  const supportTargets = unique(sequencerRevisionBrief?.supportTargets);
  const targetCount = unique(scope?.targetIds).length;
  if (leadTarget && supportTargets.length) return 'weighted';
  if (leadTarget) return 'concentrated';
  if (targetCount >= 4) return 'distributed';
  if (targetCount >= 2) return 'weighted';
  return 'unconstrained';
}

function inferTemporalProfile({ behaviorTarget = null, sequencerRevisionBrief = null } = {}) {
  const motion = str(behaviorTarget?.motion?.primaryMotion).toLowerCase();
  const motionCharacter = str(sequencerRevisionBrief?.motionCharacter).toLowerCase();
  const sectionArc = str(sequencerRevisionBrief?.sectionArc).toLowerCase();
  if (motion === 'hold') return 'steady';
  if (motion === 'shimmer' || motion === 'pulse') return 'pulsing';
  if (motion === 'drift' || motion === 'chase' || motion === 'spin' || motion === 'burst') return 'evolving';
  if (/pulse|hit|strobe/.test(motionCharacter)) return 'pulsing';
  if (/build|lift|expand|evolv/.test(motionCharacter) || /build|lift/.test(sectionArc)) return 'evolving';
  return 'modulated';
}

function inferEnergyShape(sequencerRevisionBrief = null) {
  const sectionArc = str(sequencerRevisionBrief?.sectionArc).toLowerCase();
  if (/build|lift|rise/.test(sectionArc)) return 'build';
  if (/release|drop|fall/.test(sectionArc)) return 'release';
  if (/hold|steady/.test(sectionArc)) return 'hold';
  return 'unconstrained';
}

function inferSpatialFootprint({ behaviorTarget = null, scope = {} } = {}) {
  const coverage = str(behaviorTarget?.coverage?.coverageLevel).toLowerCase();
  const targetCount = unique(scope?.targetIds).length;
  if (coverage === 'broad') return targetCount >= 4 ? 'full_scene' : 'broad';
  if (coverage === 'focused') return targetCount <= 1 ? 'narrow' : 'moderate';
  if (targetCount >= 5) return 'broad';
  if (targetCount >= 2) return 'moderate';
  return 'narrow';
}

function inferTextureCharacter(behaviorTarget = null) {
  const texture = str(behaviorTarget?.texture?.primaryTexture).toLowerCase();
  if (['solid', 'smooth', 'sparkling', 'segmented', 'banded'].includes(texture)) return texture;
  return 'unconstrained';
}

function inferDensityCharacter(sequencerRevisionBrief = null) {
  const density = str(sequencerRevisionBrief?.densityCharacter).toLowerCase();
  if (/dense/.test(density)) return 'dense';
  if (/moderate|medium/.test(density)) return 'moderate';
  if (/sparse|light|restrained/.test(density)) return 'sparse';
  return 'unconstrained';
}

export function buildIntentEnvelopeV1({
  translationIntent = null,
  sequenceArtisticGoal = null,
  sequenceRevisionObjective = null,
  sequencerRevisionBrief = null,
  scope = {},
  sequencingDesignHandoff = null
} = {}) {
  const behaviorTarget = firstBehaviorTarget(translationIntent);
  const scopeSections = unique(scope?.sectionNames);
  const scopeTargets = unique(scope?.targetIds);
  const promptSummary = str(translationIntent?.traceability?.promptSummary);
  const source = {
    translationIntentRef: str(translationIntent?.artifactId),
    artisticGoalRef: str(sequenceArtisticGoal?.artifactId),
    revisionObjectiveRef: str(sequenceRevisionObjective?.artifactId),
    sequencingDesignHandoffRef: str(sequencingDesignHandoff?.artifactId)
  };
  return finalizeArtifact({
    artifactType: 'intent_envelope_v1',
    artifactVersion: '1.0',
    source,
    scope: {
      scopeLevel: scopeSections.length > 1 ? 'section' : 'moment',
      sectionNames: scopeSections,
      targetIds: scopeTargets,
      targetScopeCount: scopeTargets.length
    },
    attention: {
      profile: inferAttentionProfile({ sequencerRevisionBrief, scope }),
      stability: inferEnergyShape(sequencerRevisionBrief) === 'hold' ? 'steady' : 'flexible',
      competitionTolerance: 'medium',
      dominanceTolerance: str(sequencerRevisionBrief?.leadTarget) ? 'medium' : 'high'
    },
    temporal: {
      profile: inferTemporalProfile({ behaviorTarget, sequencerRevisionBrief }),
      variationLevel: inferEnergyShape(sequencerRevisionBrief) === 'hold' ? 'low' : 'medium',
      handoffCharacter: 'unconstrained',
      energyShape: inferEnergyShape(sequencerRevisionBrief)
    },
    spatial: {
      footprint: inferSpatialFootprint({ behaviorTarget, scope }),
      coverageBias: str(behaviorTarget?.coverage?.coverageLevel) || 'unconstrained',
      regionBias: 'unconstrained',
      symmetryPreference: 'unconstrained'
    },
    texture: {
      primaryCharacter: inferTextureCharacter(behaviorTarget),
      density: inferDensityCharacter(sequencerRevisionBrief),
      edgeSharpness: 'unconstrained',
      contrastPreference: 'medium'
    },
    color: {
      role: 'unconstrained',
      spread: 'unconstrained',
      transitionRate: 'unconstrained',
      conflictTolerance: 'medium'
    },
    layering: {
      sameStructureDensity: 'unconstrained',
      separationNeed: 'medium',
      colorInteractionPreference: 'unconstrained',
      cadenceInteractionPreference: 'unconstrained'
    },
    novelty: {
      reuseTolerance: 'medium',
      explorationPressure: 'medium',
      variationPriority: 'medium'
    },
    constraints: {
      targetRequirements: scopeTargets,
      mustPreserve: unique([
        str(sequencerRevisionBrief?.leadTarget),
        ...arr(sequenceRevisionObjective?.successChecks)
      ])
    },
    notes: [
      promptSummary ? `Prompt summary: ${promptSummary}` : '',
      'intent_envelope_v1 defines the intended success space without selecting one realization.'
    ].filter(Boolean)
  });
}
