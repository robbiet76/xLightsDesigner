import { finalizeArtifact } from '../shared/artifact-ids.js';

function str(value = '') {
  return String(value || '').trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function uniqueStrings(values = []) {
  return [...new Set(arr(values).map((row) => str(row)).filter(Boolean))];
}

function normalizePaletteRoles(rows = []) {
  return arr(rows)
    .map((row) => ({
      name: str(row?.name),
      hex: str(row?.hex),
      role: str(row?.role)
    }))
    .filter((row) => row.name || row.hex || row.role);
}

function normalizeMediaAssetDirectives(rows = []) {
  return arr(rows)
    .map((row) => ({
      assetId: str(row?.assetId),
      kind: str(row?.kind),
      intendedUse: str(row?.intendedUse),
      recommendedSections: uniqueStrings(row?.recommendedSections),
      paletteRoles: uniqueStrings(row?.paletteRoles),
      motionUse: str(row?.motionUse)
    }))
    .filter((row) => row.assetId);
}

function normalizeMediaAssetPlanDirectives(rows = []) {
  return arr(rows)
    .map((row) => ({
      assetId: str(row?.assetId),
      kind: str(row?.kind),
      status: str(row?.status),
      intendedUse: str(row?.intendedUse),
      recommendedSections: uniqueStrings(row?.recommendedSections),
      paletteRoles: uniqueStrings(row?.paletteRoles),
      motifs: uniqueStrings(row?.motifs),
      motionUse: str(row?.motionUse),
      promptRef: str(row?.promptRef)
    }))
    .filter((row) => row.assetId);
}

function stripNegativeCueClauses(value = '') {
  const text = str(value);
  if (!text) return '';
  return text
    .replace(/\bdo not turn it into\b[\s\S]*$/i, '')
    .replace(/\brather than\b[\s\S]*$/i, '')
    .replace(/\binstead of\b[\s\S]*$/i, '')
    .replace(/,\s*not\b[\s\S]*$/i, '')
    .replace(/\bavoid\b[\s\S]*$/i, '')
    .trim();
}

function inferSectionPurpose(section = '', energy = '', density = '', goal = '') {
  const sectionName = str(section).toLowerCase();
  const lowerGoal = str(goal).toLowerCase();
  const normalizedEnergy = str(energy).toLowerCase();
  const normalizedDensity = str(density).toLowerCase();
  if (sectionName.includes('intro')) return 'intro_establish';
  if (sectionName.includes('bridge')) return 'bridge_reset';
  if (sectionName.includes('outro')) return 'outro_resolve';
  if (sectionName.includes('chorus') || normalizedEnergy === 'high' || normalizedEnergy === 'peak') return 'chorus_reveal';
  if (normalizedDensity === 'dense' && /reveal|payoff|bigger|lift/.test(lowerGoal)) return 'chorus_reveal';
  return 'verse_support';
}

function mapEnergyTarget(value = '') {
  const key = str(value).toLowerCase();
  if (['low', 'medium', 'high', 'peak'].includes(key)) return key;
  return 'medium';
}

function mapDensityTarget(value = '') {
  const key = str(value).toLowerCase();
  if (['sparse', 'moderate', 'dense', 'very_dense'].includes(key)) return key;
  if (key === 'low') return 'sparse';
  if (key === 'medium') return 'moderate';
  if (key === 'high') return 'dense';
  return 'moderate';
}

function inferMotionTarget({ section = '', goal = '' } = {}) {
  const text = `${str(section)} ${str(goal)}`.toLowerCase();
  if (/still|hold|steady|solid/.test(text)) return 'still';
  if (/expand|release|lift|grow/.test(text)) return 'expanding_motion';
  if (/aggressive|punchy|attack|snap/.test(text)) return 'aggressive_motion';
  if (/restrained|gentle|calm|soft/.test(text)) return 'restrained_motion';
  return 'steady_motion';
}

function inferTransitionIntent({ section = '', goal = '', energy = '' } = {}) {
  const text = `${str(section)} ${str(goal)} ${str(energy)}`.toLowerCase();
  if (/resolve|outro/.test(text)) return 'resolve';
  if (/snap|hit|attack/.test(text)) return 'snap';
  if (/release|open/.test(text)) return 'release';
  if (/build|rise|lift|chorus/.test(text)) return 'build';
  return 'hold';
}

function inferSectionPreferredVisualFamilies({ section = '', goal = '' } = {}) {
  const text = `${str(section)} ${stripNegativeCueClauses(goal)}`.toLowerCase();
  const preferred = [];
  if (/\b(on effect|solid steady hold|solid hold|steady hold|static hold|minimal movement)\b/.test(text)) preferred.push('static_fill');
  if (/spiral|helical|helix/.test(text)) preferred.push('spiral_flow');
  if (/radial|spin|pinwheel|rotation/.test(text)) preferred.push('radial_rotation');
  if (/segment|chase|directional|travel/.test(text)) preferred.push('segmented_motion');
  if (/texture|sparkle|twinkle|shimmer|glitter|soft/.test(text)) preferred.push('soft_texture');
  if (/crisp|strobe/.test(text)) preferred.push('crisp_texture');
  if (/shockwave|burst|ring|expand/.test(text)) preferred.push('diffuse_expand');
  if (/fill|wash|broad coverage|base coverage/.test(text)) preferred.push('fill');
  return uniqueStrings(preferred);
}

function inferVisualPreferences({ goal = '', creativeBrief = null, proposalBundle = null } = {}) {
  const text = `${stripNegativeCueClauses(goal)} ${str(creativeBrief?.visualCues)} ${str(creativeBrief?.summary)} ${arr(proposalBundle?.proposalLines).join(' ')}`.toLowerCase();
  const preferred = [];
  const avoid = [];
  if (/large|bigger|broad|wide/.test(text)) preferred.push('large_form_motion');
  if (/segment|chase|directional/.test(text)) preferred.push('segmented_directional');
  if (/spiral|helical/.test(text)) preferred.push('spiral_flow');
  if (/radial|spin|pinwheel/.test(text)) preferred.push('radial_rotation');
  if (/texture|sparkle|twinkle|shimmer/.test(text)) preferred.push('soft_texture');
  if (/shockwave|burst|ring/.test(text)) preferred.push('diffuse_shockwave');
  if (/avoid.*busy|clean|readable|clarity/.test(text)) avoid.push('busy_texture');
  if (/avoid.*full yard|no full yard|noise wall/.test(text)) avoid.push('full_yard_fill');
  return {
    preferred: uniqueStrings(preferred),
    allowed: uniqueStrings(preferred),
    avoid: uniqueStrings(avoid)
  };
}

function inferAvoidances({ goal = '', proposalBundle = null, normalizedIntent = {} } = {}) {
  const values = [];
  const text = `${str(goal)} ${arr(proposalBundle?.proposalLines).join(' ')}`.toLowerCase();
  const safety = new Set(arr(normalizedIntent?.safetyConstraints).map((row) => str(row)));
  if (safety.has('preserve_readability') || /readable|clarity|clean/.test(text)) {
    values.push('no_busy_background_texture');
    values.push('no_multiple_competing_leads');
  }
  if (/flash|strobe/.test(text)) values.push('avoid_high_flash_behavior');
  if (/full yard|noise wall/.test(text)) values.push('no_full_yard_noise_wall');
  return uniqueStrings(values);
}

function deriveRole(priorityIndex = 0, targetId = '', focusTargets = new Set()) {
  if (focusTargets.has(targetId)) return 'lead';
  if (priorityIndex === 0) return 'lead';
  if (priorityIndex === 1) return 'support';
  if (priorityIndex <= 3) return 'accent';
  return 'background';
}

function deriveBehaviorIntent(role = '', sectionPurposes = []) {
  if (role === 'lead') return 'carry main motion';
  if (role === 'support') return 'support with restrained motion';
  if (role === 'accent') return 'accent phrase endings';
  if (sectionPurposes.includes('bridge_reset')) return 'hold background structure';
  return 'provide background texture';
}

function buildPropRoleAssignments({ sectionPlans = [], focusTargets = [] } = {}) {
  const counts = new Map();
  const sectionPurposeByTarget = new Map();
  const focusSet = new Set(uniqueStrings(focusTargets));
  for (const row of arr(sectionPlans)) {
    const purpose = inferSectionPurpose(row?.section, row?.energy, row?.density, row?.intentSummary);
    for (const targetId of uniqueStrings(row?.targetIds)) {
      counts.set(targetId, Number(counts.get(targetId) || 0) + 1);
      const purposes = sectionPurposeByTarget.get(targetId) || [];
      purposes.push(purpose);
      sectionPurposeByTarget.set(targetId, purposes);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([targetId, count], idx) => {
      const role = deriveRole(idx, targetId, focusSet);
      return {
        targetId,
        role,
        priority: idx + 1,
        behaviorIntent: deriveBehaviorIntent(role, sectionPurposeByTarget.get(targetId) || []),
        sectionCount: count
      };
    });
}

export function buildSequencingDesignHandoffV2({
  requestId = '',
  baseRevision = 'unknown',
  normalizedIntent = {},
  creativeBrief = null,
  proposalBundle = null,
  resolvedTargetIds = [],
  executionStrategy = null,
  visualDesignAssetPack = null
} = {}) {
  const strategy = isPlainObject(executionStrategy) ? executionStrategy : {};
  const sectionPlans = arr(strategy.sectionPlans);
  const targetIds = uniqueStrings(arr(resolvedTargetIds).length ? resolvedTargetIds : proposalBundle?.scope?.targetIds);
  const tagNames = uniqueStrings(proposalBundle?.scope?.tagNames);
  const goal = str(normalizedIntent?.goal || proposalBundle?.summary || creativeBrief?.summary);
  const designSummary = str(proposalBundle?.summary || creativeBrief?.summary || goal || 'Structured sequencing brief.');
  const visualFamilyPreferences = inferVisualPreferences({ goal, creativeBrief, proposalBundle });
  const primaryTargets = uniqueStrings(
    arr(creativeBrief?.focusElements).length
      ? creativeBrief?.focusElements
      : sectionPlans.flatMap((row) => arr(row?.targetIds)).slice(0, 2)
  );
  const secondaryTargets = uniqueStrings(sectionPlans.flatMap((row) => arr(row?.targetIds)).filter((row) => !primaryTargets.includes(str(row))).slice(0, 4));
  const accentTargets = uniqueStrings(arr(strategy.effectPlacements).map((row) => row?.targetId).filter((row) => !primaryTargets.includes(str(row)) && !secondaryTargets.includes(str(row))).slice(0, 4));
  const sectionDirectives = sectionPlans.map((row) => ({
    sectionName: str(row?.section),
    sectionPurpose: inferSectionPurpose(row?.section, row?.energy, row?.density, row?.intentSummary || goal),
    energyTarget: mapEnergyTarget(row?.energy),
    motionTarget: inferMotionTarget({ section: row?.section, goal: row?.intentSummary || goal }),
    densityTarget: mapDensityTarget(row?.density),
    transitionIntent: inferTransitionIntent({ section: row?.section, goal: row?.intentSummary || goal, energy: row?.energy }),
    preferredVisualFamilies: uniqueStrings([
      ...inferSectionPreferredVisualFamilies({ section: row?.section, goal: row?.intentSummary || goal })
    ]),
    avoidVisualFamilies: uniqueStrings(visualFamilyPreferences.avoid),
    notes: str(row?.intentSummary)
  })).filter((row) => row.sectionName);
  const propRoleAssignments = buildPropRoleAssignments({ sectionPlans, focusTargets: primaryTargets });
  const allowGlobalRewrite = Boolean(
    normalizedIntent?.preservationConstraints?.allowGlobalRewrite ??
    normalizedIntent?.allowGlobalRewrite
  );
  const visualPack = isPlainObject(visualDesignAssetPack) ? visualDesignAssetPack : null;
  const visualIntent = isPlainObject(visualPack?.creativeIntent) ? visualPack.creativeIntent : {};
  const visualInspiration = isPlainObject(creativeBrief?.visualInspiration) ? creativeBrief.visualInspiration : {};
  const visualAssets = isPlainObject(proposalBundle?.visualAssets) ? proposalBundle.visualAssets : {};
  const paletteRoles = normalizePaletteRoles(
    arr(visualPack?.palette?.colors).length
      ? visualPack.palette.colors
      : (arr(visualIntent.palette).length ? visualIntent.palette : visualInspiration.palette)
  );
  const motifDirectives = uniqueStrings(
    arr(visualIntent.motifs).length ? visualIntent.motifs : visualInspiration.motifs
  );
  const mediaAssetDirectives = normalizeMediaAssetDirectives(visualPack?.sequenceAssets);
  const mediaAssetPlanDirectives = normalizeMediaAssetPlanDirectives(visualPack?.mediaAssetPlans);
  const visualAssetPackRef = str(visualPack?.artifactId || visualAssets.assetPackId || visualInspiration.artifactId);

  return finalizeArtifact({
    artifactType: 'sequencing_design_handoff_v2',
    artifactVersion: '1.0',
    contractVersion: '1.0',
    agentRole: 'designer_dialog',
    requestId: str(requestId),
    baseRevision: str(baseRevision || 'unknown'),
    goal,
    designSummary,
    scope: {
      sections: uniqueStrings(sectionPlans.map((row) => row?.section)),
      targetIds,
      tagNames,
      timeRangeMs: null
    },
    sectionDirectives,
    propRoleAssignments,
    focusPlan: {
      primaryTargets,
      secondaryTargets,
      accentTargets,
      balanceRule: 'Preserve a readable lead/support/accent hierarchy across the scoped sections.'
    },
    visualFamilyPreferences,
    visualAssetPackRef: visualAssetPackRef || undefined,
    paletteRoles: paletteRoles.length ? paletteRoles : undefined,
    motifDirectives: motifDirectives.length ? motifDirectives : undefined,
    mediaAssetDirectives: mediaAssetDirectives.length ? mediaAssetDirectives : undefined,
    mediaAssetPlanDirectives: mediaAssetPlanDirectives.length ? mediaAssetPlanDirectives : undefined,
    constraints: {
      preserveTimingTracks: normalizedIntent?.preserveTimingTracks !== false,
      allowGlobalRewrite,
      changeTolerance: str(normalizedIntent?.changeTolerance || 'medium'),
      readabilityPriority: arr(normalizedIntent?.safetyConstraints).map((row) => str(row)).includes('preserve_readability') ? 'high' : 'medium',
      flashTolerance: /flash|strobe/.test(str(goal).toLowerCase()) ? 'medium' : 'low'
    },
    avoidances: inferAvoidances({ goal, proposalBundle, normalizedIntent }),
    executionLatitude: allowGlobalRewrite ? 'broad' : (str(normalizedIntent?.changeTolerance || '').toLowerCase() === 'low' ? 'tight' : 'moderate'),
    traceability: {
      briefId: str(creativeBrief?.artifactId),
      proposalId: str(proposalBundle?.artifactId || proposalBundle?.proposalId),
      directorProfileSignals: proposalBundle?.traceability?.directorProfileSignals || null,
      designSceneSignals: proposalBundle?.traceability?.designSceneSignals || null,
      musicDesignSignals: proposalBundle?.traceability?.musicDesignSignals || null
    }
  });
}
