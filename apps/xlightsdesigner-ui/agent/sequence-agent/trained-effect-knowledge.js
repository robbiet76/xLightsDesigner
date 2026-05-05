import { STAGE1_TRAINED_EFFECT_BUNDLE } from './generated/stage1-trained-effect-bundle.js';
import { DERIVED_PARAMETER_PRIORS_BUNDLE } from './generated/derived-parameter-priors-bundle.js';
import { CROSS_EFFECT_SHARED_SETTINGS_BUNDLE } from './generated/cross-effect-shared-settings-bundle.js';
import { BEHAVIOR_CAPABILITY_RECORDS_BUNDLE } from './generated/behavior-capability-records-bundle.js';
import { LAYER_COMPOSITION_PRIORS_BUNDLE } from './generated/layer-composition-priors-bundle.js';
import { VIDEO_AESTHETIC_LEARNING_BUNDLE } from './generated/video-aesthetic-learning-bundle.js';
import { classifyModelDisplayType } from './model-type-catalog.js';
import { analyzeCustomModelStructure, mapClassificationToTrainedModelProfiles } from '../../runtime/custom-model-structure.js';

function normText(value = '') {
  return String(value || '').trim();
}

function low(value = '') {
  return normText(value).toLowerCase();
}

function words(value = '') {
  return low(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .map((row) => row.trim())
    .filter(Boolean);
}

function escapeRegex(value = '') {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsPhrase(haystack = '', phrase = '') {
  const normalizedHaystack = low(haystack);
  const normalizedPhrase = low(phrase);
  if (!normalizedHaystack || !normalizedPhrase) return false;
  const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegex(normalizedPhrase)}([^a-z0-9]|$)`, 'i');
  return pattern.test(normalizedHaystack);
}

function unique(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((row) => normText(row)).filter(Boolean))];
}

const GENERIC_INTENT_TAGS = new Set([
  'animated',
  'bold',
  'busy',
  'clean',
  'directional',
  'fill',
  'full',
  'partial',
  'patterned',
  'restrained',
  'segmented',
  'sparse',
  'steady',
  'varied'
]);

function buildBehaviorTokenSet(values = []) {
  const tokens = new Set();
  for (const value of unique(values)) {
    const normalized = normText(value);
    if (!normalized) continue;
    for (const token of tokenizeTrainingPhrase(normalized.replace(/_/g, ' '))) {
      tokens.add(low(token));
    }
  }
  return tokens;
}

function buildDisplayElementIndex(displayElements = []) {
  const index = new Map();
  for (const row of Array.isArray(displayElements) ? displayElements : []) {
    const keys = unique([row?.id, row?.name]);
    for (const key of keys) index.set(key, row);
  }
  return index;
}

function inferTrainedModelProfilesForTargets({ targetIds = [], displayElements = [] } = {}) {
  const displayIndex = buildDisplayElementIndex(displayElements);
  const profiles = new Set();
  for (const targetId of unique(targetIds)) {
    const row = displayIndex.get(targetId);
    if (!row) continue;
    const classification = classifyModelDisplayType(row?.displayAs || row?.type || row?.displayType || '');
    const customStructure = classification?.canonicalType === 'custom'
      ? analyzeCustomModelStructure(row?.attributes || row)
      : null;
    for (const profile of mapClassificationToTrainedModelProfiles(classification, customStructure)) {
      profiles.add(profile);
    }
  }
  return [...profiles];
}

function inferExactGeometryProfilesForTargets({ targetIds = [], displayElements = [] } = {}) {
  const displayIndex = buildDisplayElementIndex(displayElements);
  const profiles = new Set();
  for (const targetId of unique(targetIds)) {
    const row = displayIndex.get(targetId);
    const geometryProfile = normText(
      row?.geometryProfile
      || row?.trainingGeometryProfile
      || row?.modelGeometryProfile
      || row?.metadata?.geometryProfile
    );
    if (geometryProfile) profiles.add(geometryProfile);
  }
  return [...profiles];
}

function tokenizeTrainingPhrase(value = '') {
  return unique(words(value));
}

function effectSupportsAnyBucket(effectProfile = null, targetModelTypes = []) {
  const supported = new Set(Array.isArray(effectProfile?.supportedModelTypes) ? effectProfile.supportedModelTypes.map((row) => normText(row)) : []);
  if (!supported.size) return false;
  return unique(targetModelTypes).some((row) => supported.has(row));
}

export function getStage1TrainedEffectBundle() {
  return STAGE1_TRAINED_EFFECT_BUNDLE;
}

export function getStage1TrainedEffectProfile(effectName = '') {
  return STAGE1_TRAINED_EFFECT_BUNDLE.effectsByName?.[normText(effectName)] || null;
}

function summarizeParameterBehavior(effectName = '') {
  const profile = getDerivedParameterPriorsForEffect(effectName);
  const priors = Array.isArray(profile?.priors) ? profile.priors : [];
  const behaviorHints = new Map();
  const temporalSignatureHints = new Map();
  const tunableParameters = new Map();
  const parameterBehaviorRules = new Map();
  let sampleCount = 0;
  let motionSum = 0;
  let colorDeltaSum = 0;
  let brightnessDeltaSum = 0;
  let renderedColorDiversitySum = 0;
  let renderedColorBandDensitySum = 0;
  let renderedGradientSmoothnessSum = 0;
  let renderedTemporalColorTravelSum = 0;
  let renderedDominantColorStabilitySum = 0;
  for (const prior of priors) {
    const parameterName = normText(prior?.parameterName);
    if (parameterName) {
      tunableParameters.set(parameterName, (tunableParameters.get(parameterName) || 0) + Number(prior?.sampleCount || 0));
    }
    for (const rule of Array.isArray(prior?.behaviorDimensions?.behaviorRules) ? prior.behaviorDimensions.behaviorRules : []) {
      const dimension = normText(rule?.dimension);
      const direction = normText(rule?.direction);
      if (!parameterName || !dimension || !direction) continue;
      const key = `${parameterName}:${dimension}:${direction}`;
      if (!parameterBehaviorRules.has(key)) {
        parameterBehaviorRules.set(key, {
          parameterName,
          dimension,
          direction,
          summary: normText(rule?.summary) || `${parameterName} ${direction} ${dimension}`,
          evidenceCount: 0,
          magnitude: 0
        });
      }
      const target = parameterBehaviorRules.get(key);
      target.evidenceCount += Number(prior?.sampleCount || 0);
      target.magnitude = Math.max(target.magnitude, Number(rule?.magnitude || 0));
    }
    for (const anchor of Array.isArray(prior?.anchorProfiles) ? prior.anchorProfiles : []) {
      const anchorSamples = Math.max(1, Number(anchor?.sampleCount || 0));
      sampleCount += anchorSamples;
      motionSum += Number(anchor?.meanTemporalMotion || 0) * anchorSamples;
      colorDeltaSum += Number(anchor?.meanTemporalColorDelta || 0) * anchorSamples;
      brightnessDeltaSum += Number(anchor?.meanTemporalBrightnessDelta || 0) * anchorSamples;
      renderedColorDiversitySum += Number(anchor?.meanRenderedColorDiversity || 0) * anchorSamples;
      renderedColorBandDensitySum += Number(anchor?.meanRenderedColorBandDensity || 0) * anchorSamples;
      renderedGradientSmoothnessSum += Number(anchor?.meanRenderedGradientSmoothness || 0) * anchorSamples;
      renderedTemporalColorTravelSum += Number(anchor?.meanRenderedTemporalColorTravel || 0) * anchorSamples;
      renderedDominantColorStabilitySum += Number(anchor?.meanRenderedDominantColorStability || 0) * anchorSamples;
      for (const hint of unique(anchor?.behaviorHints)) {
        behaviorHints.set(hint, (behaviorHints.get(hint) || 0) + anchorSamples);
      }
      for (const hint of unique(anchor?.temporalSignatureHints)) {
        temporalSignatureHints.set(hint, (temporalSignatureHints.get(hint) || 0) + anchorSamples);
      }
    }
  }
  const ranked = (map) => [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return {
    priorCount: Number(profile?.priorCount || priors.length || 0),
    sampleCount,
    tunableParameters: ranked(tunableParameters).map((row) => row.name),
    parameterBehaviorRules: [...parameterBehaviorRules.values()]
      .sort((a, b) => b.evidenceCount - a.evidenceCount || b.magnitude - a.magnitude || a.summary.localeCompare(b.summary))
      .slice(0, 24),
    behaviorHints: ranked(behaviorHints).slice(0, 24).map((row) => row.name),
    temporalSignatureHints: ranked(temporalSignatureHints).slice(0, 12).map((row) => row.name),
    meanTemporalMotion: sampleCount > 0 ? Number((motionSum / sampleCount).toFixed(6)) : 0,
    meanTemporalColorDelta: sampleCount > 0 ? Number((colorDeltaSum / sampleCount).toFixed(6)) : 0,
    meanTemporalBrightnessDelta: sampleCount > 0 ? Number((brightnessDeltaSum / sampleCount).toFixed(6)) : 0,
    meanRenderedColorDiversity: sampleCount > 0 ? Number((renderedColorDiversitySum / sampleCount).toFixed(6)) : 0,
    meanRenderedColorBandDensity: sampleCount > 0 ? Number((renderedColorBandDensitySum / sampleCount).toFixed(6)) : 0,
    meanRenderedGradientSmoothness: sampleCount > 0 ? Number((renderedGradientSmoothnessSum / sampleCount).toFixed(6)) : 0,
    meanRenderedTemporalColorTravel: sampleCount > 0 ? Number((renderedTemporalColorTravelSum / sampleCount).toFixed(6)) : 0,
    meanRenderedDominantColorStability: sampleCount > 0 ? Number((renderedDominantColorStabilitySum / sampleCount).toFixed(6)) : 0
  };
}

function inferBehaviorCapabilityTags(profile = null, parameterSummary = {}) {
  const tags = new Set([
    ...unique(profile?.intentTags),
    ...unique(profile?.patternFamilies),
    ...unique(profile?.structuralLabels),
    ...unique(parameterSummary?.behaviorHints),
    ...unique(parameterSummary?.temporalSignatureHints),
    ...unique(parameterSummary?.parameterBehaviorRules?.map((row) => row?.summary))
  ]);
  return [...tags];
}

export function buildBehaviorCapabilityRecord(effectName = '') {
  const name = normText(effectName);
  const profile = getStage1TrainedEffectProfile(name);
  if (!profile) return null;
  const parameterSummary = summarizeParameterBehavior(name);
  const capabilityTags = inferBehaviorCapabilityTags(profile, parameterSummary);
  return {
    artifactType: 'behavior_capability_record_v1',
    artifactVersion: '1.0',
    effectName: name,
    geometryProfile: 'cross_geometry',
    modelType: 'mixed',
    parameterRegion: {
      parameterName: 'aggregate_runtime_selector',
      regionKind: parameterSummary.priorCount > 0 ? 'aggregate' : 'baseline',
      valueSummary: parameterSummary.tunableParameters.slice(0, 8).join(', '),
      interactionAssumptions: []
    },
    sharedSettingsContext: {
      recommendationSource: 'cross_effect_shared_settings_bundle',
      settingCount: Number(CROSS_EFFECT_SHARED_SETTINGS_BUNDLE.settingCount || 0)
    },
    paletteContext: {
      paletteMode: 'mixed_training_palette_modes'
    },
    behaviorSignals: {
      primaryMotion: parameterSummary.temporalSignatureHints[0] || unique(profile.structuralLabels)[0] || 'unknown',
      primaryTexture: parameterSummary.behaviorHints[0] || unique(profile.patternFamilies)[0] || 'unknown',
      motionPacing: parameterSummary.temporalSignatureHints.join(','),
      textureDensity: parameterSummary.behaviorHints.join(','),
      energyLevel: parameterSummary.meanTemporalMotion >= 0.08 ? 'elevated' : (parameterSummary.meanTemporalMotion > 0.02 ? 'moderate' : 'restrained'),
      coverageLevel: unique(profile.intentTags).some((tag) => low(tag) === 'full') ? 'broad' : 'mixed',
      hierarchySuitability: 'selector_ranked',
      geometryCoupling: unique(profile.supportedGeometryProfiles).length > 1 ? 'multi_geometry' : 'single_geometry',
      stability: Number(profile?.selectorEvidence?.passedCaseCount || 0) >= Number(profile?.selectorEvidence?.selectedCaseCount || 0) ? 'observed' : 'mixed'
    },
    renderOutcomeSignals: {
      temporalRead: parameterSummary.temporalSignatureHints[0] || 'unknown',
      densityRead: unique(profile.intentTags).some((tag) => ['dense', 'busy', 'full'].includes(low(tag))) ? 'dense' : 'mixed',
      nonBlankRatio: 0,
      temporalMotion: parameterSummary.meanTemporalMotion,
      temporalColorDelta: parameterSummary.meanTemporalColorDelta,
      temporalBrightnessDelta: parameterSummary.meanTemporalBrightnessDelta,
      renderedColorDiversity: parameterSummary.meanRenderedColorDiversity,
      renderedColorBandDensity: parameterSummary.meanRenderedColorBandDensity,
      renderedGradientSmoothness: parameterSummary.meanRenderedGradientSmoothness,
      renderedTemporalColorTravel: parameterSummary.meanRenderedTemporalColorTravel,
      renderedDominantColorStability: parameterSummary.meanRenderedDominantColorStability,
      clarityRead: unique(profile.intentTags).some((tag) => low(tag) === 'clean') ? 'clean' : 'unknown',
      contrastRead: 'unknown'
    },
    confidence: {
      level: Number(profile?.selectorEvidence?.passedCaseCount || 0) > 0 ? 'medium' : 'low',
      evidenceClass: 'aggregated_runtime_bundle',
      coverageStatus: normText(profile.status || profile.coveragePolicy || 'unknown')
    },
    evidenceCount: Number(profile?.selectorEvidence?.passedCaseCount || 0) + Number(parameterSummary.sampleCount || 0),
    traceability: {
      sourceArtifactIds: [
        normText(STAGE1_TRAINED_EFFECT_BUNDLE.artifactType),
        normText(DERIVED_PARAMETER_PRIORS_BUNDLE.artifactType),
        normText(CROSS_EFFECT_SHARED_SETTINGS_BUNDLE.artifactType)
      ].filter(Boolean),
      sourceGeometryProfiles: unique(profile.supportedGeometryProfiles),
      generatedBy: 'trained-effect-knowledge.runtime_behavior_capability_view'
    },
    trainingStage: normText(profile.currentStage),
    selectorReady: normText(profile.currentStage) === 'selector_ready' || Boolean(profile?.stages?.selector_ready),
    equalized: Boolean(profile.equalized),
    evidence: {
      selectedCaseCount: Number(profile?.selectorEvidence?.selectedCaseCount || 0),
      passedCaseCount: Number(profile?.selectorEvidence?.passedCaseCount || 0),
      parameterPriorCount: parameterSummary.priorCount,
      parameterSampleCount: parameterSummary.sampleCount
    },
    geometry: {
      supportedModelTypes: unique(profile.supportedModelTypes),
      supportedGeometryProfiles: unique(profile.supportedGeometryProfiles),
      supportedAnalyzerFamilies: unique(profile.supportedAnalyzerFamilies)
    },
    behavior: {
      intentTags: unique(profile.intentTags),
      patternFamilies: unique(profile.patternFamilies),
	      structuralLabels: unique(profile.structuralLabels),
	      parameterBehaviorHints: parameterSummary.behaviorHints,
	      temporalSignatureHints: parameterSummary.temporalSignatureHints,
	      parameterBehaviorRules: parameterSummary.parameterBehaviorRules,
	      capabilityTags
	    },
	    parameterBehavior: {
	      tunableParameters: parameterSummary.tunableParameters,
	      behaviorRules: parameterSummary.parameterBehaviorRules,
	      meanTemporalMotion: parameterSummary.meanTemporalMotion,
      meanTemporalColorDelta: parameterSummary.meanTemporalColorDelta,
      meanTemporalBrightnessDelta: parameterSummary.meanTemporalBrightnessDelta,
      meanRenderedColorDiversity: parameterSummary.meanRenderedColorDiversity,
      meanRenderedColorBandDensity: parameterSummary.meanRenderedColorBandDensity,
      meanRenderedGradientSmoothness: parameterSummary.meanRenderedGradientSmoothness,
      meanRenderedTemporalColorTravel: parameterSummary.meanRenderedTemporalColorTravel,
      meanRenderedDominantColorStability: parameterSummary.meanRenderedDominantColorStability
    },
    selection: {
      policy: 'behavior_capability_ranked_no_random',
      genericIntentTagsIgnored: [...GENERIC_INTENT_TAGS].sort()
    }
  };
}

let cachedBehaviorCapabilityBundle = null;

export function getBehaviorCapabilityBundle() {
  if (cachedBehaviorCapabilityBundle) return cachedBehaviorCapabilityBundle;
  const records = unique(STAGE1_TRAINED_EFFECT_BUNDLE.selectorReadyEffects || [])
    .map((effectName) => buildBehaviorCapabilityRecord(effectName))
    .filter(Boolean);
  cachedBehaviorCapabilityBundle = {
    artifactType: 'sequencer_behavior_capabilities_bundle',
    artifactVersion: '1.0',
    sourceArtifactType: normText(STAGE1_TRAINED_EFFECT_BUNDLE.artifactType),
    sourceArtifactVersion: normText(STAGE1_TRAINED_EFFECT_BUNDLE.artifactVersion),
    generatedAt: normText(STAGE1_TRAINED_EFFECT_BUNDLE.generatedAt),
    recordType: 'behavior_capability_record_v1',
    effectCount: records.length,
    selectorReadyEffects: records.map((row) => row.effectName),
    effectsByName: Object.fromEntries(records.map((row) => [row.effectName, row]))
  };
  return cachedBehaviorCapabilityBundle;
}

export function getBehaviorCapabilityRecord(effectName = '') {
  return getBehaviorCapabilityBundle().effectsByName?.[normText(effectName)] || null;
}

export function listSelectorReadyTrainedEffects({ targetModelTypes = [] } = {}) {
  const all = unique(STAGE1_TRAINED_EFFECT_BUNDLE.selectorReadyEffects || []);
  if (!targetModelTypes.length) return all;
  return all.filter((effectName) => effectSupportsAnyBucket(getStage1TrainedEffectProfile(effectName), targetModelTypes));
}

export function recommendTrainedEffects({
  summary = '',
  energy = '',
  density = '',
  targetModelTypes = [],
  limit = 5
} = {}) {
  const haystack = `${normText(summary)} ${normText(energy)} ${normText(density)}`.trim();
  const lowerHaystack = low(haystack);
  const haystackWords = new Set(words(haystack));
  const scored = [];

  for (const effectName of unique(getBehaviorCapabilityBundle().selectorReadyEffects || [])) {
    const profile = getStage1TrainedEffectProfile(effectName);
    const capability = getBehaviorCapabilityRecord(effectName);
    if (!profile || !capability) continue;
    let score = 0;
    let semanticEvidenceScore = 0;
    const reasons = [];

    if (containsPhrase(lowerHaystack, effectName)) {
      score += 100;
      semanticEvidenceScore += 100;
      reasons.push(`explicit:${effectName}`);
    }

    for (const intentTag of Array.isArray(capability.behavior?.intentTags) ? capability.behavior.intentTags : []) {
      if (GENERIC_INTENT_TAGS.has(low(intentTag))) continue;
      if (haystackWords.has(low(intentTag))) {
        score += 3;
        semanticEvidenceScore += 3;
        reasons.push(`intent:${intentTag}`);
      }
    }

    for (const family of Array.isArray(capability.behavior?.patternFamilies) ? capability.behavior.patternFamilies : []) {
      const familyTokens = tokenizeTrainingPhrase(family.replace(/_/g, ' '));
      const matched = familyTokens.filter((token) => haystackWords.has(low(token)));
      if (matched.length >= Math.max(1, Math.min(2, familyTokens.length))) {
        score += 6;
        semanticEvidenceScore += 6;
        reasons.push(`family:${family}`);
      }
    }

    if (targetModelTypes.length) {
      if (effectSupportsAnyBucket(profile, targetModelTypes)) {
        score += 10;
        reasons.push(`model:${targetModelTypes.join('|')}`);
      } else {
        score -= 8;
      }
    }

    if (semanticEvidenceScore > 0 && score > 0) {
      scored.push({ effectName, score, reasons, profile, behaviorCapability: capability });
    }
  }

  scored.sort((a, b) => b.score - a.score || a.effectName.localeCompare(b.effectName));
  return scored.slice(0, Math.max(1, Number(limit) || 5));
}

export function recommendTrainedEffectsForTargets({
  summary = '',
  energy = '',
  density = '',
  targetIds = [],
  displayElements = [],
  limit = 5
} = {}) {
  const targetModelTypes = inferTrainedModelProfilesForTargets({ targetIds, displayElements });
  return recommendTrainedEffects({ summary, energy, density, targetModelTypes, limit });
}

export function recommendTrainedEffectsForVisualFamilies({
  preferredVisualFamilies = [],
  targetIds = [],
  displayElements = [],
  limit = 5
} = {}) {
  const targetModelTypes = inferTrainedModelProfilesForTargets({ targetIds, displayElements });
  const desiredTokens = buildBehaviorTokenSet(preferredVisualFamilies);
  const scored = [];

  for (const effectName of unique(getBehaviorCapabilityBundle().selectorReadyEffects || [])) {
    const profile = getStage1TrainedEffectProfile(effectName);
    const capability = getBehaviorCapabilityRecord(effectName);
    if (!profile || !capability) continue;
    if (targetModelTypes.length && !effectSupportsAnyBucket(profile, targetModelTypes)) continue;

    let score = 0;
    const reasons = [];
    const patternFamilies = unique(capability.behavior?.patternFamilies);
    const intentTags = unique(capability.behavior?.intentTags);
    const behaviorHints = unique([
      ...unique(capability.behavior?.parameterBehaviorHints),
      ...unique(capability.behavior?.temporalSignatureHints),
      ...unique(capability.behavior?.parameterBehaviorRules?.map((row) => row?.summary))
    ]);

    for (const family of patternFamilies) {
      const familyTokens = tokenizeTrainingPhrase(String(family).replace(/_/g, ' '));
      const matched = familyTokens.filter((token) => desiredTokens.has(low(token)));
      if (matched.length) {
        score += 18 + (matched.length * 6);
        reasons.push(`pattern:${family}`);
      }
    }

    for (const tag of intentTags) {
      if (GENERIC_INTENT_TAGS.has(low(tag))) continue;
      const tagTokens = tokenizeTrainingPhrase(String(tag).replace(/_/g, ' '));
      const matched = tagTokens.filter((token) => desiredTokens.has(low(token)));
      if (matched.length) {
        score += 10 + (matched.length * 4);
        reasons.push(`intent:${tag}`);
      }
    }

    for (const hint of behaviorHints) {
      const hintTokens = tokenizeTrainingPhrase(String(hint).replace(/_/g, ' '));
      const matched = hintTokens.filter((token) => desiredTokens.has(low(token)));
      if (matched.length) {
        score += 4 + (matched.length * 2);
        reasons.push(`behavior:${hint}`);
      }
    }

    if (score > 0) {
      scored.push({ effectName, score, reasons, profile, behaviorCapability: capability });
    }
  }

  scored.sort((a, b) => b.score - a.score || a.effectName.localeCompare(b.effectName));
  if (scored.length) {
    return scored.slice(0, Math.max(1, Number(limit) || 5));
  }
  return [];
}

export function buildStage1TrainingKnowledgeMetadata() {
  const behaviorCapabilities = getBehaviorCapabilityBundle();
  const configuredCapabilities = getConfiguredBehaviorCapabilitiesBundle();
  const layerComposition = getLayerCompositionPriorsBundle();
  return {
    artifactType: normText(STAGE1_TRAINED_EFFECT_BUNDLE.artifactType),
    artifactVersion: normText(STAGE1_TRAINED_EFFECT_BUNDLE.artifactVersion),
    generatedAt: normText(STAGE1_TRAINED_EFFECT_BUNDLE.generatedAt),
    selectorReadyEffects: unique(STAGE1_TRAINED_EFFECT_BUNDLE.selectorReadyEffects || []),
    behaviorCapabilityRecordType: normText(behaviorCapabilities.recordType),
    behaviorCapabilityCount: Number(behaviorCapabilities.effectCount || 0),
    configuredBehaviorCapabilityRecordType: normText(configuredCapabilities.recordType),
    configuredBehaviorCapabilityCount: Number(configuredCapabilities.recordCount || 0),
    layerCompositionPriorRecordType: normText(layerComposition.recordType),
    layerCompositionPriorCount: Number(layerComposition.recordCount || 0),
    layerCompositionSelectorReadyCount: Number(layerComposition.selectorReadyCount || 0),
    equalizedEffectCount: Number(STAGE1_TRAINED_EFFECT_BUNDLE.stage1?.equalizedCount || 0),
    effectCount: Number(STAGE1_TRAINED_EFFECT_BUNDLE.stage1?.effectCount || 0),
    targetState: normText(STAGE1_TRAINED_EFFECT_BUNDLE.stage1?.targetState)
  };
}

export function getDerivedParameterPriorsBundle() {
  return DERIVED_PARAMETER_PRIORS_BUNDLE;
}

export function getDerivedParameterPriorsForEffect(effectName = '') {
  return DERIVED_PARAMETER_PRIORS_BUNDLE.effectsByName?.[normText(effectName)] || null;
}

function scoreConfidence(value = '') {
  const key = low(value);
  if (key === 'high') return 30;
  if (key === 'medium') return 18;
  if (key === 'low') return 8;
  return 0;
}

function scoreCoverageStatus(value = '') {
  const key = low(value);
  if (key === 'multi_configuration_sampled') return 24;
  if (key === 'single_reference_per_geometry') return 12;
  if (key === 'screened_parameter_subset') return 8;
  return 0;
}

function signalTokensForConfiguredRecord(record = {}) {
  return buildBehaviorTokenSet([
    record?.effectName,
    record?.geometryProfile,
    record?.modelType,
    record?.parameterRegion?.parameterName,
    record?.parameterRegion?.valueSummary,
    record?.paletteMode,
    record?.behaviorSignals?.primaryMotion,
    record?.behaviorSignals?.primaryTexture,
    record?.behaviorSignals?.motionPacing,
    record?.behaviorSignals?.textureDensity,
    record?.behaviorSignals?.energyLevel,
    record?.behaviorSignals?.coverageLevel,
    record?.renderOutcomeSignals?.temporalRead,
    record?.renderOutcomeSignals?.densityRead
  ]);
}

export function getConfiguredBehaviorCapabilitiesBundle() {
  return BEHAVIOR_CAPABILITY_RECORDS_BUNDLE;
}

export function recommendConfiguredBehaviorCapabilities({
  summary = '',
  preferredVisualFamilies = [],
  desiredBehaviorHints = [],
  effectNames = [],
  targetIds = [],
  displayElements = [],
  paletteMode = '',
  limit = 12
} = {}) {
  const records = Array.isArray(BEHAVIOR_CAPABILITY_RECORDS_BUNDLE.records)
    ? BEHAVIOR_CAPABILITY_RECORDS_BUNDLE.records
    : [];
  const allowedEffects = new Set(unique(effectNames));
  const matchedGeometryProfiles = inferExactGeometryProfilesForTargets({ targetIds, displayElements });
  const matchedModelTypes = inferTrainedModelProfilesForTargets({ targetIds, displayElements });
  const desiredTokens = buildBehaviorTokenSet([
    summary,
    ...unique(preferredVisualFamilies),
    ...unique(desiredBehaviorHints)
  ]);
  const normalizedPaletteMode = normText(paletteMode);

  const scored = records
    .map((record) => {
      const effectName = normText(record?.effectName);
      if (!effectName) return null;
      if (allowedEffects.size && !allowedEffects.has(effectName)) return null;

      const recordGeometry = normText(record?.geometryProfile);
      const recordModelType = normText(record?.modelType);
      const exactGeometryMatch = matchedGeometryProfiles.includes(recordGeometry);
      const modelTypeMatch = matchedModelTypes.includes(recordModelType);
      if (matchedGeometryProfiles.length && recordGeometry !== 'cross_geometry' && !exactGeometryMatch) return null;
      if (!matchedGeometryProfiles.length && matchedModelTypes.length && recordModelType !== 'mixed' && !modelTypeMatch) return null;

      let score = Number(record?.evidenceCount || 0);
      score += scoreConfidence(record?.confidence?.level);
      score += scoreCoverageStatus(record?.confidence?.coverageStatus);
      score += Number(record?.renderOutcomeSignals?.nonBlankRatio || 0) * 12;
      score += Number(record?.renderOutcomeSignals?.temporalMotion || 0) * 60;
      if (exactGeometryMatch) score += 90;
      if (modelTypeMatch) score += 35;
      if (normalizedPaletteMode && normText(record?.paletteMode) === normalizedPaletteMode) score += 15;

      const recordTokens = signalTokensForConfiguredRecord(record);
      const reasons = [];
      for (const token of recordTokens) {
        if (!desiredTokens.has(low(token))) continue;
        score += 14;
        reasons.push(`behavior:${token}`);
      }
      if (containsPhrase(summary, effectName)) {
        score += 100;
        reasons.push(`explicit:${effectName}`);
      }

      return {
        ...record,
        score,
        reasons,
        exactGeometryMatch,
        modelTypeMatch,
        parameterPriorHint: {
          parameterName: normText(record?.parameterRegion?.parameterName),
          parameterValue: record?.parameterRegion?.valueSummary,
          recordId: normText(record?.recordId),
          behaviorSignals: record?.behaviorSignals || {},
          renderOutcomeSignals: record?.renderOutcomeSignals || {}
        }
      };
    })
    .filter((row) => row && Number(row.score || 0) > 0)
    .sort((a, b) => b.score - a.score || a.effectName.localeCompare(b.effectName) || a.recordId.localeCompare(b.recordId));

  return {
    artifactType: 'configured_behavior_capability_recommendation_v1',
    sourceArtifactType: normText(BEHAVIOR_CAPABILITY_RECORDS_BUNDLE?.artifactType),
    recordType: normText(BEHAVIOR_CAPABILITY_RECORDS_BUNDLE?.recordType),
    recordCount: scored.length,
    matchedGeometryProfiles,
    matchedModelTypes,
    recommendations: scored.slice(0, Math.max(1, Number(limit) || 12))
  };
}

function chooseRecommendedAnchors(prior = null, desiredBehaviorHints = [], anchorsPerPrior = 2) {
  const desired = new Set(unique(desiredBehaviorHints).map((row) => low(row)));
  const anchors = Array.isArray(prior?.anchorProfiles) ? prior.anchorProfiles : [];
  return anchors
    .map((anchor) => {
      const behaviorHints = unique(anchor?.behaviorHints);
      const temporalSignatureHints = unique(anchor?.temporalSignatureHints);
      let score = Number(anchor?.sampleCount || 0) * 10;
      score += Number(anchor?.meanTemporalMotion || 0) * 100;
      score += Number(anchor?.meanNonBlankRatio || 0) * 5;
      for (const token of [...behaviorHints, ...temporalSignatureHints].map((row) => low(row))) {
        if (desired.has(token)) score += 20;
      }
      return {
        parameterValue: anchor?.parameterValue,
        sampleCount: Number(anchor?.sampleCount || 0),
        meanTemporalMotion: Number(anchor?.meanTemporalMotion || 0),
        meanTemporalColorDelta: Number(anchor?.meanTemporalColorDelta || 0),
        meanTemporalBrightnessDelta: Number(anchor?.meanTemporalBrightnessDelta || 0),
        meanNonBlankRatio: Number(anchor?.meanNonBlankRatio || 0),
        meanRenderedColorDiversity: Number(anchor?.meanRenderedColorDiversity || 0),
        meanRenderedColorBandDensity: Number(anchor?.meanRenderedColorBandDensity || 0),
        meanRenderedGradientSmoothness: Number(anchor?.meanRenderedGradientSmoothness || 0),
        meanRenderedTemporalColorTravel: Number(anchor?.meanRenderedTemporalColorTravel || 0),
        meanRenderedDominantColorStability: Number(anchor?.meanRenderedDominantColorStability || 0),
        temporalSignatureHints,
        behaviorHints,
        score
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Number(anchorsPerPrior) || 2));
}

export function recommendDerivedParameterPriors({
  effectName = '',
  targetIds = [],
  displayElements = [],
  paletteMode = '',
  desiredBehaviorHints = [],
  limit = 3,
  anchorsPerPrior = 2
} = {}) {
  const profile = getDerivedParameterPriorsForEffect(effectName);
  if (!profile || !Array.isArray(profile?.priors) || !profile.priors.length) {
    return {
      effectName: normText(effectName),
      recommendationMode: 'none',
      matchedGeometryProfiles: [],
      matchedModelTypes: [],
      priors: []
    };
  }
  const matchedGeometryProfiles = inferExactGeometryProfilesForTargets({ targetIds, displayElements });
  const matchedModelTypes = inferTrainedModelProfilesForTargets({ targetIds, displayElements });
  const normalizedPaletteMode = normText(paletteMode);
  const desired = unique(desiredBehaviorHints);
  const scored = profile.priors
    .map((prior) => {
      const exactGeometryMatch = matchedGeometryProfiles.includes(normText(prior?.geometryProfile));
      const modelTypeMatch = matchedModelTypes.includes(normText(prior?.modelType));
      if (matchedGeometryProfiles.length && !exactGeometryMatch) return null;
      if (!matchedGeometryProfiles.length && matchedModelTypes.length && !modelTypeMatch) return null;
      let score = Number(prior?.distinctAnchorCount || 0) * 10 + Number(prior?.sampleCount || 0);
      score += scoreConfidence(prior?.confidence);
      if (exactGeometryMatch) score += 100;
      if (modelTypeMatch) score += 35;
      if (normalizedPaletteMode && normText(prior?.paletteMode) === normalizedPaletteMode) score += 15;
      const recommendedAnchors = chooseRecommendedAnchors(prior, desired, anchorsPerPrior);
      score += recommendedAnchors.reduce((sum, anchor) => sum + Number(anchor?.score || 0), 0) / 100;
      return {
        parameterName: normText(prior?.parameterName),
        geometryProfile: normText(prior?.geometryProfile),
        modelType: normText(prior?.modelType),
        analyzerFamily: normText(prior?.analyzerFamily),
        paletteMode: normText(prior?.paletteMode),
        confidence: normText(prior?.confidence),
        configurationCoverageStatus: normText(prior?.configurationCoverageStatus),
        configurationProfileCount: Number(prior?.configurationProfileCount || 0),
        distinctAnchorCount: Number(prior?.distinctAnchorCount || 0),
        sampleCount: Number(prior?.sampleCount || 0),
        recommendedAnchors,
        score
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.parameterName.localeCompare(b.parameterName));
  const recommendationMode = matchedGeometryProfiles.length
    ? 'exact_geometry'
    : (matchedModelTypes.length ? 'model_type_profile' : 'effect_only');
  return {
    effectName: normText(effectName),
    recommendationMode,
    matchedGeometryProfiles,
    matchedModelTypes,
    priors: scored.slice(0, Math.max(1, Number(limit) || 3))
  };
}

export function buildDerivedParameterKnowledgeMetadata() {
  return {
    artifactType: normText(DERIVED_PARAMETER_PRIORS_BUNDLE.artifactType),
    artifactVersion: normText(DERIVED_PARAMETER_PRIORS_BUNDLE.artifactVersion),
    generatedAt: normText(DERIVED_PARAMETER_PRIORS_BUNDLE.generatedAt),
    effectCount: Number(DERIVED_PARAMETER_PRIORS_BUNDLE.effectCount || 0),
    selectorReadyEffects: unique(DERIVED_PARAMETER_PRIORS_BUNDLE.selectorReadyEffects || [])
  };
}

export function getCrossEffectSharedSettingsBundle() {
  return CROSS_EFFECT_SHARED_SETTINGS_BUNDLE;
}

export function recommendCrossEffectSharedSettings({
  requestScopeMode = '',
  preferredSettingNames = [],
  limitPerSetting = 2
} = {}) {
  const settingsByName = CROSS_EFFECT_SHARED_SETTINGS_BUNDLE?.settingsByName && typeof CROSS_EFFECT_SHARED_SETTINGS_BUNDLE.settingsByName === 'object'
    ? CROSS_EFFECT_SHARED_SETTINGS_BUNDLE.settingsByName
    : {};
  const preferred = new Set(unique(preferredSettingNames));
  const scopeMode = normText(requestScopeMode);
  const settingNames = Object.keys(settingsByName)
    .filter((name) => !preferred.size || preferred.has(name))
    .sort((a, b) => a.localeCompare(b));
  const settings = settingNames.map((settingName) => {
    return {
      settingName,
      recommendedValues: (Array.isArray(settingsByName[settingName]) ? settingsByName[settingName] : [])
        .map((row) => {
          const successfulUses = Number(row?.successfulUses || 0);
          const failedUses = Number(row?.failedUses || 0);
          const sampleCount = Number(row?.sampleCount || 0);
          let score = successfulUses * 10 + sampleCount - failedUses * 6;
          if (scopeMode && unique(row?.favoredScopes).includes(scopeMode)) score += 8;
          return {
            appliedValue: row?.appliedValue,
            sampleCount,
            successfulUses,
            failedUses,
            effectNames: unique(row?.effectNames),
            favoredScopes: unique(row?.favoredScopes),
            favoredSignals: unique(row?.favoredSignals),
            cautionSignals: unique(row?.cautionSignals),
            score
          };
        })
        .sort((a, b) => b.score - a.score || String(a.appliedValue).localeCompare(String(b.appliedValue)))
        .slice(0, Math.max(1, Number(limitPerSetting) || 2))
    };
  }).filter((row) => row.recommendedValues.length);
  return {
    recommendationMode: settings.length ? 'cross_effect_generic' : 'none',
    requestScopeMode: scopeMode,
    settings
  };
}

export function buildCrossEffectSharedSettingsKnowledgeMetadata() {
  return {
    artifactType: normText(CROSS_EFFECT_SHARED_SETTINGS_BUNDLE.artifactType),
    artifactVersion: normText(CROSS_EFFECT_SHARED_SETTINGS_BUNDLE.artifactVersion),
    generatedAt: normText(CROSS_EFFECT_SHARED_SETTINGS_BUNDLE.generatedAt),
    settingCount: Number(CROSS_EFFECT_SHARED_SETTINGS_BUNDLE.settingCount || 0)
  };
}

function intersectionCount(left = [], right = []) {
  const lhs = new Set(unique(left).map((row) => low(row)));
  return unique(right).filter((row) => lhs.has(low(row))).length;
}

function scoreLayerCompositionConfidence(value = '') {
  const text = low(value);
  if (text.includes('promoted') || text.includes('observed_repeated')) return 80;
  if (text.includes('overnight')) return 55;
  if (text.includes('smoke_observed')) return 20;
  return 0;
}

function indexedRecordsForLayerCompositionFacet(index = {}, keys = []) {
  const ids = new Set();
  for (const key of unique(keys)) {
    for (const id of Array.isArray(index?.[key]) ? index[key] : []) ids.add(normText(id));
  }
  return ids;
}

export function getLayerCompositionPriorsBundle() {
  return LAYER_COMPOSITION_PRIORS_BUNDLE;
}

export function getVideoAestheticLearningBundle() {
  return VIDEO_AESTHETIC_LEARNING_BUNDLE;
}

function indexedRecordsForVideoAestheticFacet(index = {}, keys = []) {
  const ids = new Set();
  for (const key of unique(keys)) {
    for (const id of Array.isArray(index?.[normText(key)]) ? index[normText(key)] : []) ids.add(normText(id));
    for (const id of Array.isArray(index?.[low(key).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')]) ? index[low(key).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')] : []) ids.add(normText(id));
  }
  return ids;
}

export function recommendVideoAestheticStrategies({
  weakDimensions = [],
  paletteProfile = '',
  strategy = '',
  includeStaged = false,
  bundleOverride = null,
  limit = 5
} = {}) {
  const bundle = bundleOverride || getVideoAestheticLearningBundle();
  const records = bundle?.records && typeof bundle.records === 'object' ? bundle.records : {};
  const indexes = bundle?.indexes && typeof bundle.indexes === 'object' ? bundle.indexes : {};
  const gate = bundle?.promotionGate && typeof bundle.promotionGate === 'object' ? bundle.promotionGate : {};
  const runtimeUseBlocked = gate.selectorRuntimeReady !== true && includeStaged !== true;
  const candidateIds = new Set();
  if (!runtimeUseBlocked) {
    for (const ids of [
      indexedRecordsForVideoAestheticFacet(indexes.byStrategy, [strategy]),
      indexedRecordsForVideoAestheticFacet(indexes.byPaletteProfile, [paletteProfile]),
      indexedRecordsForVideoAestheticFacet(indexes.byImprovedDimension, weakDimensions)
    ]) {
      for (const id of ids) candidateIds.add(id);
    }
    if (!candidateIds.size) {
      for (const id of Object.keys(records)) candidateIds.add(id);
    }
  }

  const scored = [...candidateIds]
    .map((recordId) => records[recordId])
    .filter((record) => record && (includeStaged || record.selectorReady === true))
    .map((record) => {
      const improvedMatches = intersectionCount((record.comparison?.improvedDimensions || []).map((row) => row.dimension), weakDimensions);
      const regressedMatches = intersectionCount((record.comparison?.regressedDimensions || []).map((row) => row.dimension), weakDimensions);
      let score = record.selectorReady === true ? 100 : 20;
      score += Number(record.comparison?.overallAestheticScoreDelta || 0) * 100;
      score += improvedMatches * 30;
      score -= regressedMatches * 35;
      if (paletteProfile && normText(record.paletteProfile) === normText(paletteProfile)) score += 20;
      if (strategy && normText(record.strategy) === normText(strategy)) score += 25;
      return {
        recordId: normText(record.recordId),
        strategy: normText(record.strategy),
        confidence: normText(record.confidence),
        selectorReady: record.selectorReady === true,
        promotionState: normText(record.promotionState),
        paletteProfile: normText(record.paletteProfile),
        scores: record.scores || {},
        comparison: record.comparison || {},
        scope: record.scope || {},
        guidance: unique(record.guidance).slice(0, 5),
        safeguards: unique(record.safeguards).slice(0, 4),
        score
      };
    })
    .filter((row) => Number(row.score || 0) > 0)
    .sort((a, b) => b.score - a.score || a.recordId.localeCompare(b.recordId))
    .slice(0, Math.max(1, Number(limit) || 5));

  return {
    artifactType: 'sequencer_video_aesthetic_strategy_guidance_v1',
    sourceArtifactType: normText(bundle?.artifactType),
    recordType: normText(bundle?.recordType),
    retrievalPolicy: normText(bundle?.retrievalContract?.consumptionPolicy) || 'display_level_advisory_evidence_not_recipe',
    runtimeUseBlocked,
    promotionGate: {
      selectorRuntimeReady: gate.selectorRuntimeReady === true,
      selectorReadyRecordCount: Number(gate.selectorReadyRecordCount || 0),
      blockers: unique(gate.blockers || [])
    },
    context: {
      weakDimensions: unique(weakDimensions),
      paletteProfile: normText(paletteProfile),
      strategy: normText(strategy)
    },
    recommendationCount: scored.length,
    recommendations: scored
  };
}

function layerCompositionPromotionGate(bundle = {}) {
  const gate = bundle?.promotionGate && typeof bundle.promotionGate === 'object' ? bundle.promotionGate : {};
  return {
    selectorRuntimeReady: gate.selectorRuntimeReady === true,
    qualityBackedPriorCount: Number(gate.qualityBackedPriorCount || 0),
    selectorReadyPriorCount: Number(gate.selectorReadyPriorCount || 0),
    blockers: unique(gate.blockers || [])
  };
}

function layerCompositionCompatibility({ scope = {}, targetScopes = [], modelTypes = [], geometryProfiles = [], effectNames = [] } = {}) {
  const geometryMatches = intersectionCount(scope.geometryProfiles, geometryProfiles);
  const modelTypeMatches = intersectionCount(scope.modelTypes, modelTypes);
  const targetScopeMatches = intersectionCount(scope.targetScopes, targetScopes);
  const effectMatches = intersectionCount(scope.effectNames, effectNames);
  const requestedStructuralSignals = unique([
    ...targetScopes,
    ...modelTypes,
    ...geometryProfiles,
    ...effectNames
  ]).length;
  const structuralMatchCount = geometryMatches + modelTypeMatches + targetScopeMatches + effectMatches;
  const strong = (geometryMatches > 0 || modelTypeMatches > 0) && effectMatches > 0;
  const similar = structuralMatchCount >= 2 && effectMatches > 0;
  const weak = structuralMatchCount > 0;
  const status = strong
    ? 'compatible'
    : similar
      ? 'similar'
      : weak
        ? 'weak_match'
        : requestedStructuralSignals
          ? 'not_compatible'
          : 'insufficient_target_context';
  return {
    status,
    projectLocalValidationRequired: !['compatible', 'similar'].includes(status),
    structuralMatchCount,
    requestedStructuralSignals,
    matches: {
      geometryProfile: geometryMatches,
      modelType: modelTypeMatches,
      targetScope: targetScopeMatches,
      effectName: effectMatches
    }
  };
}

export function recommendLayerCompositionPriors({
  compositionIntent = '',
  family = '',
  paletteProfile = '',
  targetScopes = [],
  modelTypes = [],
  geometryProfiles = [],
  effectNames = [],
  layerIndexes = [],
  desiredOutcomeTags = [],
  includeStaged = false,
  bundleOverride = null,
  limit = 5
} = {}) {
  const bundle = bundleOverride || getLayerCompositionPriorsBundle();
  const promotionGate = layerCompositionPromotionGate(bundle);
  const records = bundle?.records && typeof bundle.records === 'object' ? bundle.records : {};
  const indexes = bundle?.indexes && typeof bundle.indexes === 'object' ? bundle.indexes : {};
  const runtimeUseBlocked = promotionGate.selectorRuntimeReady !== true && includeStaged !== true;
  const candidateIds = new Set();
  if (!runtimeUseBlocked) {
    for (const ids of [
      indexedRecordsForLayerCompositionFacet(indexes.byCompositionIntent, [compositionIntent]),
      indexedRecordsForLayerCompositionFacet(indexes.byFamily, [family]),
      indexedRecordsForLayerCompositionFacet(indexes.byPaletteProfile, [paletteProfile]),
      indexedRecordsForLayerCompositionFacet(indexes.byOutcomeTag, desiredOutcomeTags)
    ]) {
      for (const id of ids) candidateIds.add(id);
    }
    if (!candidateIds.size) {
      for (const id of Object.keys(records)) candidateIds.add(id);
    }
  }

  const normalizedLayerIndexes = unique(layerIndexes.map((row) => String(row)));
  const scored = [...candidateIds]
    .map((priorId) => records[priorId])
    .filter((prior) => prior && (includeStaged || prior.selectorReady === true))
    .map((prior) => {
      const scope = prior.scope || {};
      const outcomeTags = unique(prior.outcomeTags);
      let score = scoreLayerCompositionConfidence(prior.confidence);
      const reasons = [];
      if (compositionIntent && normText(scope.compositionIntent) === normText(compositionIntent)) {
        score += 80;
        reasons.push('compositionIntent');
      }
      if (family && normText(scope.family) === normText(family)) {
        score += 55;
        reasons.push('family');
      }
      if (paletteProfile && normText(scope.paletteProfile) === normText(paletteProfile)) {
        score += 35;
        reasons.push('paletteProfile');
      }
      const geometryMatches = intersectionCount(scope.geometryProfiles, geometryProfiles);
      if (geometryMatches) {
        score += geometryMatches * 35;
        reasons.push('geometryProfile');
      }
      const modelTypeMatches = intersectionCount(scope.modelTypes, modelTypes);
      if (modelTypeMatches) {
        score += modelTypeMatches * 20;
        reasons.push('modelType');
      }
      const targetScopeMatches = intersectionCount(scope.targetScopes, targetScopes);
      if (targetScopeMatches) {
        score += targetScopeMatches * 18;
        reasons.push('targetScope');
      }
      const effectMatches = intersectionCount(scope.effectNames, effectNames);
      if (effectMatches) {
        score += effectMatches * 16;
        reasons.push('effectName');
      }
      const priorLayerIndexes = unique((scope.layerIndexes || []).map((row) => String(row)));
      const layerMatches = intersectionCount(priorLayerIndexes, normalizedLayerIndexes);
      if (layerMatches) {
        score += layerMatches * 10;
        reasons.push('layerIndex');
      }
      const outcomeMatches = intersectionCount(outcomeTags, desiredOutcomeTags);
      if (outcomeMatches) {
        score += outcomeMatches * 14;
        reasons.push('observedOutcome');
      }
      const compatibility = layerCompositionCompatibility({
        scope,
        targetScopes,
        modelTypes,
        geometryProfiles,
        effectNames
      });
      if (compatibility.status === 'compatible') {
        score += 40;
        reasons.push('compatibleStructure');
      } else if (compatibility.status === 'similar') {
        score += 18;
        reasons.push('similarStructure');
      } else if (compatibility.status === 'weak_match') {
        score -= 35;
        reasons.push('projectLocalValidationRequired');
      } else if (compatibility.status === 'not_compatible') {
        score -= 120;
        reasons.push('notStructurallyCompatible');
      } else {
        score -= 20;
        reasons.push('insufficientTargetContext');
      }
      return {
        priorId: normText(prior.priorId),
        learningLayer: prior.learningLayer || {
          scope: normText(scope.learningScope) || 'shared_baseline',
          targetApplicability: normText(scope.reusePolicy) || 'compatible_structure_and_metadata_only',
          projectLocalOverrideArtifact: 'display/target-behavior.json',
          projectLocalBehaviorRequiredForUnknownTargets: true
        },
        confidence: normText(prior.confidence),
        selectorReady: prior.selectorReady === true,
        promotionState: normText(prior.promotionState),
        compatibility,
        scope,
        conditions: prior.conditions || {},
        observedEffects: prior.observedEffects || {},
        outcomeTags,
        guidance: unique(prior.guidance).slice(0, 6),
        safeguards: unique(prior.safeguards).slice(0, 4),
        sourceRefs: {
          observationRef: normText(prior.sourceObservationRef),
          passPlanRef: normText(prior.sourcePassPlanRef),
          experimentId: normText(prior.sourceExperimentId)
        },
        score,
        reasons
      };
    })
    .filter((row) => Number(row.score || 0) > 0)
    .sort((a, b) => b.score - a.score || a.priorId.localeCompare(b.priorId))
    .slice(0, Math.max(1, Number(limit) || 5));

  return {
    artifactType: 'sequencer_layer_composition_guidance_v1',
    sourceArtifactType: normText(bundle?.artifactType),
    recordType: normText(bundle?.recordType),
    retrievalPolicy: normText(bundle?.retrievalContract?.consumptionPolicy) || 'advisory_evidence_not_recipe',
    applicabilityPolicy: normText(bundle?.retrievalContract?.applicabilityPolicy) || 'shared_baseline_priors_require_structural_and_metadata_compatibility',
    projectLocalOverrideArtifact: normText(bundle?.retrievalContract?.projectLocalOverrideArtifact) || 'display/target-behavior.json',
    runtimeUseBlocked,
    promotionGate,
    context: {
      compositionIntent: normText(compositionIntent),
      family: normText(family),
      paletteProfile: normText(paletteProfile),
      targetScopes: unique(targetScopes),
      modelTypes: unique(modelTypes),
      geometryProfiles: unique(geometryProfiles),
      effectNames: unique(effectNames),
      layerIndexes: normalizedLayerIndexes.map(Number).filter(Number.isFinite),
      desiredOutcomeTags: unique(desiredOutcomeTags)
    },
    recommendationCount: scored.length,
    recommendations: scored
  };
}

export function buildLayerCompositionKnowledgeMetadata() {
  return {
    artifactType: normText(LAYER_COMPOSITION_PRIORS_BUNDLE.artifactType),
    artifactVersion: normText(LAYER_COMPOSITION_PRIORS_BUNDLE.artifactVersion),
    generatedAt: normText(LAYER_COMPOSITION_PRIORS_BUNDLE.generatedAt),
    recordCount: Number(LAYER_COMPOSITION_PRIORS_BUNDLE.recordCount || 0),
    selectorReadyCount: Number(LAYER_COMPOSITION_PRIORS_BUNDLE.selectorReadyCount || 0),
    promotionGate: layerCompositionPromotionGate(LAYER_COMPOSITION_PRIORS_BUNDLE),
    retrievalContract: LAYER_COMPOSITION_PRIORS_BUNDLE.retrievalContract || {}
  };
}
