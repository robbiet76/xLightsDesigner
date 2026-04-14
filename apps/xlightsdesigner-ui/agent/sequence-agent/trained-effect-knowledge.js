import { STAGE1_TRAINED_EFFECT_BUNDLE } from './generated/stage1-trained-effect-bundle.js';
import { DERIVED_PARAMETER_PRIORS_BUNDLE } from './generated/derived-parameter-priors-bundle.js';
import { classifyModelDisplayType } from './model-type-catalog.js';

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

export const EFFECT_KEYWORDS = Object.freeze({
  'Bars': ['bars', 'bar', 'striped', 'pulse', 'compress', 'expand', 'segmented'],
  'Color Wash': ['wash', 'sweep', 'fill', 'fade', 'gradient'],
  'Marquee': ['marquee', 'band', 'segmented', 'chaser', 'skip'],
  'On': ['hold', 'solid', 'steady', 'glow', 'ramp', 'static'],
  'Pinwheel': ['pinwheel', 'radial', 'spin', 'rotating', 'arms'],
  'Shimmer': ['shimmer', 'sparkle', 'glitter'],
  'Shockwave': ['shockwave', 'ring', 'burst', 'centered', 'offcenter', 'crisp', 'diffuse'],
  'SingleStrand': ['strand', 'chase', 'bounce', 'directional', 'travel'],
  'Spirals': ['spiral', 'spirals', 'helical', 'helix', 'rotation'],
  'Twinkle': ['twinkle', 'strobe', 'random', 'texture']
});

export const VISUAL_FAMILY_EFFECT_MAP = Object.freeze({
  spiral_flow: ['Spirals'],
  helical_spiral_flow: ['Spirals'],
  segmented_motion: ['Bars', 'Marquee'],
  directional_motion: ['Bars', 'Marquee', 'SingleStrand', 'Spirals'],
  bounce_motion: ['SingleStrand'],
  radial_rotation: ['Pinwheel', 'Shockwave'],
  diffuse_expand: ['Shockwave'],
  soft_texture: ['Twinkle', 'Shimmer'],
  crisp_texture: ['Twinkle', 'Shockwave'],
  static_fill: ['Color Wash', 'On'],
  fill: ['Color Wash', 'On', 'Bars', 'Marquee', 'Shockwave']
});

function buildDisplayElementIndex(displayElements = []) {
  const index = new Map();
  for (const row of Array.isArray(displayElements) ? displayElements : []) {
    const keys = unique([row?.id, row?.name]);
    for (const key of keys) index.set(key, row);
  }
  return index;
}

function mapClassificationToTrainingBuckets(classification = {}) {
  const rawType = low(classification?.rawType);
  const canonicalType = low(classification?.canonicalType);
  const buckets = new Set();
  if (canonicalType === 'single_line' || canonicalType === 'poly_line') buckets.add('single_line');
  if (canonicalType === 'arches') buckets.add('arch');
  if (canonicalType === 'candy_canes') buckets.add('cane');
  if (canonicalType === 'spinner') buckets.add('spinner');
  if (canonicalType === 'star') buckets.add('star');
  if (canonicalType === 'matrix_horizontal' || canonicalType === 'matrix_vertical') buckets.add('matrix');
  if (canonicalType === 'icicles') buckets.add('icicles');
  if (canonicalType === 'tree') {
    buckets.add('tree_360');
    buckets.add('tree_flat');
  }
  if (rawType.includes('tree flat')) buckets.add('tree_flat');
  if (rawType.includes('tree') && rawType.includes('360')) buckets.add('tree_360');
  return [...buckets];
}

function inferModelBucketsForTargets({ targetIds = [], displayElements = [] } = {}) {
  const displayIndex = buildDisplayElementIndex(displayElements);
  const buckets = new Set();
  for (const targetId of unique(targetIds)) {
    const row = displayIndex.get(targetId);
    if (!row) continue;
    const classification = classifyModelDisplayType(row?.displayAs || row?.type || row?.displayType || '');
    for (const bucket of mapClassificationToTrainingBuckets(classification)) {
      buckets.add(bucket);
    }
  }
  return [...buckets];
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

  for (const effectName of unique(STAGE1_TRAINED_EFFECT_BUNDLE.selectorReadyEffects || [])) {
    const profile = getStage1TrainedEffectProfile(effectName);
    if (!profile) continue;
    let score = 0;
    const reasons = [];

    if (containsPhrase(lowerHaystack, effectName)) {
      score += 100;
      reasons.push(`explicit:${effectName}`);
    }

    for (const keyword of EFFECT_KEYWORDS[effectName] || []) {
      if (containsPhrase(lowerHaystack, keyword)) {
        score += 12;
        reasons.push(`keyword:${keyword}`);
      }
    }

    for (const intentTag of Array.isArray(profile.intentTags) ? profile.intentTags : []) {
      if (haystackWords.has(low(intentTag))) {
        score += 3;
        reasons.push(`intent:${intentTag}`);
      }
    }

    for (const family of Array.isArray(profile.patternFamilies) ? profile.patternFamilies : []) {
      const familyTokens = tokenizeTrainingPhrase(family.replace(/_/g, ' '));
      const matched = familyTokens.filter((token) => haystackWords.has(low(token)));
      if (matched.length >= Math.max(1, Math.min(2, familyTokens.length))) {
        score += 6;
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

    if (score > 0) {
      scored.push({ effectName, score, reasons, profile });
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
  const targetModelTypes = inferModelBucketsForTargets({ targetIds, displayElements });
  return recommendTrainedEffects({ summary, energy, density, targetModelTypes, limit });
}

export function recommendTrainedEffectsForVisualFamilies({
  preferredVisualFamilies = [],
  targetIds = [],
  displayElements = [],
  limit = 5
} = {}) {
  const targetModelTypes = inferModelBucketsForTargets({ targetIds, displayElements });
  const preferred = unique(preferredVisualFamilies).flatMap((row) => VISUAL_FAMILY_EFFECT_MAP[row] || []);
  const supported = unique(preferred).filter((effectName) => {
    const profile = getStage1TrainedEffectProfile(effectName);
    if (!profile) return false;
    return !targetModelTypes.length || effectSupportsAnyBucket(profile, targetModelTypes);
  });
  return supported.slice(0, Math.max(1, Number(limit) || 5)).map((effectName, index) => ({
    effectName,
    score: 100 - index,
    reasons: ['preferred_visual_family'],
    profile: getStage1TrainedEffectProfile(effectName)
  }));
}

export function buildStage1TrainingKnowledgeMetadata() {
  return {
    artifactType: normText(STAGE1_TRAINED_EFFECT_BUNDLE.artifactType),
    artifactVersion: normText(STAGE1_TRAINED_EFFECT_BUNDLE.artifactVersion),
    generatedAt: normText(STAGE1_TRAINED_EFFECT_BUNDLE.generatedAt),
    selectorReadyEffects: unique(STAGE1_TRAINED_EFFECT_BUNDLE.selectorReadyEffects || []),
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
  const matchedModelTypes = inferModelBucketsForTargets({ targetIds, displayElements });
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
    : (matchedModelTypes.length ? 'model_type_bucket' : 'effect_only');
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
