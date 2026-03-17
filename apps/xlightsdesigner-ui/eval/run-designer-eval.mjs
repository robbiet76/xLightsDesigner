import fs from "node:fs";
import path from "node:path";

import { executeDesignerProposalOrchestration } from "../agent/designer-dialog/designer-dialog-orchestrator.js";
import { buildDesignSceneContext } from "../agent/designer-dialog/design-scene-context.js";
import {
  mergeRevisedDesignConceptExecutionPlan,
  normalizeDesignRevisionTarget
} from "../agent/designer-dialog/design-concept-revision.js";

const cwd = process.cwd();
const evalDir = path.join(cwd, "apps/xlightsdesigner-ui/eval");
const casesPath = path.join(evalDir, "designer-eval-cases-v1.json");
const metadataFixturePath = path.join(evalDir, "synthetic-metadata-fixture-v1.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function uniq(values = []) {
  return [...new Set(arr(values).map((row) => str(row)).filter(Boolean))];
}

function buildFixture({ variant = "default", metadataFixture = null } = {}) {
  const baseAssignments = arr(metadataFixture?.assignments);
  const overrideAssignments = variant === "metadata_change_sensitivity"
    ? arr(metadataFixture?.evalOverrides?.metadata_change_sensitivity)
    : [];
  const metadataAssignments = overrideAssignments.length
    ? [
        ...baseAssignments.filter((row) => !overrideAssignments.some((override) => str(override.targetId) === str(row?.targetId))),
        ...overrideAssignments
      ]
    : baseAssignments;

  const swapDepth = variant === "layout_swap_depth";
  const foregroundZ = swapDepth ? 9 : 0;
  const backgroundZ = swapDepth ? 0 : 9;
  const sectionDefinitions = [
    { label: "Intro", startMs: 0, endMs: 18000, energy: "low", density: "sparse" },
    { label: "Verse 1", startMs: 18000, endMs: 54000, energy: "medium", density: "moderate" },
    { label: "Chorus 1", startMs: 54000, endMs: 90000, energy: "high", density: "dense" },
    { label: "Bridge", startMs: 90000, endMs: 120000, energy: "medium", density: "moderate" },
    { label: "Final Chorus", startMs: 120000, endMs: 156000, energy: "high", density: "dense" },
    { label: "Outro", startMs: 156000, endMs: 176000, energy: "low", density: "sparse" }
  ];
  const cueWindowsBySection = {
    "Verse 1": {
      chord: [
        { label: "Chord A", trackName: "XD: Chord Changes", startMs: 22000, endMs: 30000 },
        { label: "Chord B", trackName: "XD: Chord Changes", startMs: 30000, endMs: 38000 },
        { label: "Chord C", trackName: "XD: Chord Changes", startMs: 38000, endMs: 46000 }
      ]
    },
    "Chorus 1": {
      beat: [
        { label: "Beat Pulse 1", trackName: "XD: Beat Grid", startMs: 56000, endMs: 61000 },
        { label: "Beat Pulse 2", trackName: "XD: Beat Grid", startMs: 66000, endMs: 71000 },
        { label: "Beat Pulse 3", trackName: "XD: Beat Grid", startMs: 76000, endMs: 81000 }
      ]
    },
    "Bridge": {
      phrase: [
        { label: "Phrase Hold", trackName: "XD: Phrase Cues", startMs: 96000, endMs: 104000 },
        { label: "Phrase Release", trackName: "XD: Phrase Cues", startMs: 104000, endMs: 112000 }
      ]
    }
  };
  const sceneGraph = {
    modelsById: {
      "Border-01": { id: "Border-01", name: "Border-01", type: "Line", nodes: [{ coords: { world: { x: 1, y: 1, z: foregroundZ } } }] },
      "Border-02": { id: "Border-02", name: "Border-02", type: "Line", nodes: [{ coords: { world: { x: 2, y: 1, z: foregroundZ } } }] },
      "Border-03": { id: "Border-03", name: "Border-03", type: "Line", nodes: [{ coords: { world: { x: 10, y: 1, z: foregroundZ } } }] },
      Snowman: { id: "Snowman", name: "Snowman", type: "Prop", nodes: [{ coords: { world: { x: 6, y: 3, z: 2 } } }] },
      Star: { id: "Star", name: "Star", type: "Prop", nodes: [{ coords: { world: { x: 6, y: 8, z: 8 } } }] },
      NorthPoleSign: { id: "NorthPoleSign", name: "NorthPoleSign", type: "Matrix", nodes: [{ coords: { world: { x: 11, y: 4, z: backgroundZ } } }] },
      PorchTree: { id: "PorchTree", name: "PorchTree", type: "Tree", nodes: [{ coords: { world: { x: 2, y: 6, z: backgroundZ } } }] },
      SpiralTrees: { id: "SpiralTrees", name: "SpiralTrees", type: "Tree", nodes: [{ coords: { world: { x: 9, y: 5, z: 5 } } }] },
      Wreathes: { id: "Wreathes", name: "Wreathes", type: "Prop", nodes: [{ coords: { world: { x: 5, y: 7, z: backgroundZ } } }] },
      Train_Outlines: { id: "Train_Outlines", name: "Train_Outlines", type: "Line", nodes: [{ coords: { world: { x: 3, y: 2, z: 3 } } }] },
      Train_Rings: { id: "Train_Rings", name: "Train_Rings", type: "Prop", nodes: [{ coords: { world: { x: 4, y: 2, z: 3 } } }] },
      Train_Wheels: { id: "Train_Wheels", name: "Train_Wheels", type: "Prop", nodes: [{ coords: { world: { x: 5, y: 2, z: 3 } } }] },
      AllModels_NoFloods: { id: "AllModels_NoFloods", name: "AllModels_NoFloods", type: "Group", nodes: [{ coords: { world: { x: 6, y: 5, z: 4 } } }] }
    },
    groupsById: {
      AllModels: {
        id: "AllModels",
        members: {
          flattened: [
            "Border-01", "Border-02", "Border-03", "Snowman", "Star", "NorthPoleSign",
            "PorchTree", "SpiralTrees", "Wreathes", "Train_Outlines", "Train_Rings", "Train_Wheels"
          ]
        }
      },
      AllModels_NoFloods: {
        id: "AllModels_NoFloods",
        members: {
          flattened: [
            "Border-01", "Border-02", "Border-03", "Snowman", "Star", "NorthPoleSign",
            "PorchTree", "SpiralTrees", "Wreathes", "Train_Outlines", "Train_Rings", "Train_Wheels"
          ]
        }
      }
    },
    submodelsById: {
      "Snowman/Face1-Eyes": { id: "Snowman/Face1-Eyes", parentId: "Snowman" },
      "Snowman/Snowman Hat Beads": { id: "Snowman/Snowman Hat Beads", parentId: "Snowman" },
      "Border-01/Left": { id: "Border-01/Left", parentId: "Border-01" },
      "Border-01/Right": { id: "Border-01/Right", parentId: "Border-01" }
    },
    stats: { layoutMode: "2d", modelCount: 13, groupCount: 2, submodelCount: 4 }
  };

  return {
    models: Object.values(sceneGraph.modelsById).map((row) => ({ id: row.id, name: row.name, type: row.type })),
    submodels: Object.values(sceneGraph.submodelsById).map((row) => ({ id: row.id, name: row.id.split("/").pop(), parentId: row.parentId })),
    metadataAssignments,
    designSceneContext: buildDesignSceneContext({ sceneGraph, revision: `eval-${variant}` }),
    analysisArtifact: {
      artifactType: "audio_analysis_artifact_v1",
      mediaId: `media-${variant}`,
      capabilities: {
        structure: {
          sections: sectionDefinitions
        }
      }
    },
    analysisHandoff: {
      artifactType: "analysis_handoff_v1",
      mediaId: `media-${variant}`,
      trackIdentity: {
        title: "Synthetic Eval Song",
        artist: "xLightsDesigner"
      },
      structure: {
        sections: sectionDefinitions
      },
      lyrics: {
        sections: [
          { label: "Verse 1" },
          { label: "Chorus 1" },
          { label: "Final Chorus" }
        ]
      }
    },
    musicDesignContext: {
      artifactType: "music_design_context_v1",
      sectionArc: sectionDefinitions.map((row) => ({
        label: row.label,
        energy: row.energy,
        density: row.density
      })),
      designCues: {
        revealMoments: ["Verse 1->Chorus 1", "Bridge->Final Chorus"],
        holdMoments: ["Intro", "Outro"],
        lyricFocusMoments: ["Verse 1"],
        cueWindowsBySection
      }
    }
  };
}

function buildDirectorProfile(variant = "") {
  if (variant === "warm_cinematic") {
    return {
      summary: "Prefers warm cinematic color, emotional payoff, and smoother motion.",
      preferences: {
        palettePreference: "warm_cinematic",
        motionPreference: "smooth",
        focusPreference: "hero-prop-first"
      }
    };
  }
  if (variant === "crisp_focal") {
    return {
      summary: "Prefers crisp focal contrast, clean reads, and controlled clutter.",
      preferences: {
        palettePreference: "clean_contrast",
        motionPreference: "controlled",
        focusPreference: "crisp-focal"
      }
    };
  }
  return null;
}

function regexAny(lines = [], patterns = []) {
  const text = arr(lines).join("\n");
  return arr(patterns).some((pattern) => new RegExp(pattern, "i").test(text));
}

function includesAll(source = [], required = []) {
  const haystack = new Set(arr(source).map((row) => str(row)));
  return arr(required).every((row) => haystack.has(str(row)));
}

function extractMetrics(result = {}) {
  const proposalBundle = result?.proposalBundle || {};
  const executionPlan = proposalBundle?.executionPlan || {};
  const placements = arr(executionPlan.effectPlacements);
  const sectionPlans = arr(executionPlan.sectionPlans);
  const conceptIds = uniq(sectionPlans.map((row) => row?.designId));
  const placementConceptIds = uniq(placements.map((row) => row?.designId));
  const effectFamilies = uniq(placements.map((row) => row?.effectName));
  const placementsByTarget = new Map();
  for (const placement of placements) {
    const targetId = str(placement?.targetId);
    if (!targetId) continue;
    if (!placementsByTarget.has(targetId)) placementsByTarget.set(targetId, []);
    placementsByTarget.get(targetId).push(placement);
  }
  const layeredTargetIds = [];
  for (const [targetId, rows] of placementsByTarget.entries()) {
    const layerKeys = uniq(rows.map((row) => `${Number(row?.layerIndex)}`));
    if (layerKeys.length >= 2) layeredTargetIds.push(targetId);
  }
  const overlayPlacements = placements.filter((row) => Number(row?.layerIndex) >= 1);
  const focusedOverlayPlacements = overlayPlacements.filter((row) => /focused|partial/i.test(str(row?.settingsIntent?.coverage)));
  const perSectionPlacementCounts = {};
  const perSectionEffectFamilies = {};
  const perSectionSpeedValues = {};
  const perSectionPaletteTemperatures = {};
  for (const placement of placements) {
    const section = str(placement?.sourceSectionLabel || placement?.timingContext?.anchorLabel);
    if (!section) continue;
    perSectionPlacementCounts[section] = (perSectionPlacementCounts[section] || 0) + 1;
    if (!perSectionEffectFamilies[section]) perSectionEffectFamilies[section] = [];
    perSectionEffectFamilies[section].push(str(placement?.effectName));
    if (!perSectionSpeedValues[section]) perSectionSpeedValues[section] = [];
    perSectionSpeedValues[section].push(normalizeSpeedValue(placement?.settingsIntent?.speed));
    if (!perSectionPaletteTemperatures[section]) perSectionPaletteTemperatures[section] = [];
    perSectionPaletteTemperatures[section].push(str(placement?.paletteIntent?.temperature));
  }
  const perSectionEffectFamilyCounts = Object.fromEntries(
    Object.entries(perSectionEffectFamilies).map(([section, values]) => [section, uniq(values).length])
  );
  const perSectionPaletteTemperatureCounts = Object.fromEntries(
    Object.entries(perSectionPaletteTemperatures).map(([section, values]) => [section, uniq(values).filter(Boolean).length])
  );
  const perSectionAverageSpeeds = Object.fromEntries(
    Object.entries(perSectionSpeedValues).map(([section, values]) => [section, Number(average(values).toFixed(2))])
  );
  const distinctSectionFamilySignatures = uniq(
    Object.values(
      Object.fromEntries(
        Object.entries(perSectionEffectFamilies).map(([section, values]) => [section, uniq(values).sort().join("|")])
      )
    )
  ).length;
  const familyUsageCounts = {};
  for (const values of Object.values(perSectionEffectFamilies)) {
    for (const family of uniq(values)) {
      familyUsageCounts[family] = (familyUsageCounts[family] || 0) + 1;
    }
  }
  const recurringEffectFamilies = Object.entries(familyUsageCounts)
    .filter(([, count]) => Number(count) >= 2)
    .map(([family]) => family)
    .sort();
  let wellShapedOverlayCount = 0;
  const baseByGroup = new Map();
  for (const placement of placements) {
    const groupKey = [
      str(placement?.designId),
      str(placement?.targetId),
      str(placement?.sourceSectionLabel || placement?.timingContext?.anchorLabel)
    ].join("::");
    if (Number(placement?.layerIndex) === 0) {
      baseByGroup.set(groupKey, placement);
    }
  }
  for (const placement of placements) {
    if (Number(placement?.layerIndex) < 1) continue;
    const groupKey = [
      str(placement?.designId),
      str(placement?.targetId),
      str(placement?.sourceSectionLabel || placement?.timingContext?.anchorLabel)
    ].join("::");
    const base = baseByGroup.get(groupKey);
    if (!base) continue;
    const baseDuration = Number(base?.endMs) - Number(base?.startMs);
    const overlayDuration = Number(placement?.endMs) - Number(placement?.startMs);
    if (
      Number.isFinite(baseDuration)
      && Number.isFinite(overlayDuration)
      && overlayDuration > 0
      && baseDuration > 0
      && Number(placement?.startMs) >= Number(base?.startMs)
      && Number(placement?.endMs) <= Number(base?.endMs)
      && overlayDuration < baseDuration
    ) {
      wellShapedOverlayCount += 1;
    }
  }
  return {
    proposalLineCount: arr(proposalBundle.proposalLines).length,
    designConceptCount: sectionPlans.length ? uniq(sectionPlans.map((row) => row?.designId)).length : 0,
    designConceptIds: conceptIds,
    placementConceptIds,
    conceptsWithoutPlacements: conceptIds.filter((designId) => !placementConceptIds.includes(designId)),
    effectPlacementCount: placements.length,
    distinctEffectFamilies: effectFamilies,
    trackNames: uniq(placements.map((row) => row?.timingContext?.trackName)),
    alignmentModes: uniq(placements.map((row) => row?.timingContext?.alignmentMode)),
    targetIds: uniq([
      ...arr(result?.intentHandoff?.scope?.targetIds),
      ...placements.map((row) => row?.targetId)
    ]),
    layeredTargetIds,
    overlayPlacementCount: overlayPlacements.length,
    focusedOverlayPlacementCount: focusedOverlayPlacements.length,
    perSectionPlacementCounts,
    perSectionEffectFamilyCounts,
    perSectionPaletteTemperatureCounts,
    perSectionAverageSpeeds,
    distinctSectionFamilySignatures,
    recurringEffectFamilies,
    wellShapedOverlayCount,
    tagNames: uniq(result?.intentHandoff?.scope?.tagNames),
    sections: uniq(result?.intentHandoff?.scope?.sections)
  };
}

function getExecutionPlanFromResult(result = {}) {
  const executionPlan = result?.proposalBundle?.executionPlan;
  return executionPlan && typeof executionPlan === "object" ? executionPlan : null;
}

function collectConceptRows(executionPlan = null, designId = "") {
  const normalizedDesignId = str(designId);
  const plan = executionPlan && typeof executionPlan === "object" ? executionPlan : null;
  if (!plan || !normalizedDesignId) return { sectionPlans: [], effectPlacements: [] };
  return {
    sectionPlans: arr(plan.sectionPlans).filter((row) => str(row?.designId) === normalizedDesignId),
    effectPlacements: arr(plan.effectPlacements).filter((row) => str(row?.designId) === normalizedDesignId)
  };
}

function buildRevisionTargetFromExecutionPlan(executionPlan = null, testCase = {}) {
  const plan = executionPlan && typeof executionPlan === "object" ? executionPlan : null;
  if (!plan) return null;
  const desiredSections = uniq(testCase.selectedSections);
  const sectionPlans = arr(plan.sectionPlans);
  const targetPlan = sectionPlans.find((row) => desiredSections.includes(str(row?.section))) || sectionPlans[0];
  const designId = str(targetPlan?.designId);
  if (!designId) return null;
  const rows = collectConceptRows(plan, designId);
  const currentRevision = Math.max(
    0,
    ...rows.sectionPlans.map((row) => Number.isInteger(Number(row?.designRevision)) ? Number(row.designRevision) : 0),
    ...rows.effectPlacements.map((row) => Number.isInteger(Number(row?.designRevision)) ? Number(row.designRevision) : 0)
  );
  const sectionNames = desiredSections.length
    ? desiredSections
    : uniq(rows.sectionPlans.map((row) => row?.section));
  const targetIds = uniq([
    ...rows.sectionPlans.flatMap((row) => arr(row?.targetIds)),
    ...rows.effectPlacements.map((row) => row?.targetId)
  ]);
  const summary = str(
    rows.sectionPlans.map((row) => row?.intentSummary).find(Boolean)
    || rows.effectPlacements.map((row) => row?.creative?.purpose).find(Boolean)
    || "Revise existing design concept"
  );
  return normalizeDesignRevisionTarget({
    designId,
    designRevision: currentRevision + 1,
    priorDesignRevision: currentRevision,
    designAuthor: str(targetPlan?.designAuthor || "designer") || "designer",
    sections: sectionNames,
    targetIds,
    summary,
    designLabel: `D${Number.parseInt(designId.replace(/\D+/g, ""), 10) || 1}.${currentRevision + 1}`
  });
}

function buildRevisionPromptText(promptText = "", revisionTarget = null) {
  const normalizedTarget = normalizeDesignRevisionTarget(revisionTarget);
  const rawPrompt = str(promptText);
  if (!normalizedTarget) return rawPrompt;
  const sectionText = normalizedTarget.sections.length ? normalizedTarget.sections.join(", ") : "current concept scope";
  const targetText = normalizedTarget.targetIds.length ? normalizedTarget.targetIds.slice(0, 6).join(", ") : "current concept targets";
  const prefix = `Revise existing design concept ${normalizedTarget.designLabel || normalizedTarget.designId} in place. Keep the same concept identity and limit changes to sections ${sectionText} and targets ${targetText}.`;
  return rawPrompt ? `${prefix} ${rawPrompt}` : prefix;
}

function comparableNonTargetRows(executionPlan = null, designId = "") {
  const normalizedDesignId = str(designId);
  const plan = executionPlan && typeof executionPlan === "object" ? executionPlan : null;
  if (!plan) return { sectionPlans: [], effectPlacements: [] };
  const clean = (row = {}) => {
    const next = { ...row };
    delete next.designId;
    delete next.designRevision;
    delete next.designAuthor;
    return next;
  };
  return {
    sectionPlans: arr(plan.sectionPlans).filter((row) => str(row?.designId) !== normalizedDesignId).map(clean),
    effectPlacements: arr(plan.effectPlacements).filter((row) => str(row?.designId) !== normalizedDesignId).map(clean)
  };
}

function evaluateRevisionCase(baseResult, revisedResult, mergedExecutionPlan, revisionTarget) {
  const failures = [];
  const baseExecutionPlan = getExecutionPlanFromResult(baseResult);
  const rawRevisedExecution = getExecutionPlanFromResult(revisedResult);
  const revisedExecution = mergedExecutionPlan && typeof mergedExecutionPlan === "object" ? mergedExecutionPlan : null;
  const target = normalizeDesignRevisionTarget(revisionTarget);
  if (!baseResult?.ok || !revisedResult?.ok || !baseExecutionPlan || !rawRevisedExecution || !revisedExecution || !target) {
    failures.push("revision_runtime_failure");
    return { score: 0, failures, checksPassed: 0, checksTotal: 1, metrics: {} };
  }

  const baseIds = uniq(arr(baseExecutionPlan.sectionPlans).map((row) => row?.designId));
  const mergedIds = uniq(arr(revisedExecution.sectionPlans).map((row) => row?.designId));
  const rawRevisedIds = uniq(arr(rawRevisedExecution.sectionPlans).map((row) => row?.designId));
  const revisedRows = collectConceptRows(revisedExecution, target.designId);
  const baseNonTarget = comparableNonTargetRows(baseExecutionPlan, target.designId);
  const mergedNonTarget = comparableNonTargetRows(revisedExecution, target.designId);
  const rawRevisedSections = uniq([
    ...arr(rawRevisedExecution.sectionPlans).map((row) => row?.section),
    ...arr(rawRevisedExecution.effectPlacements).map((row) => row?.sourceSectionLabel || row?.timingContext?.anchorLabel)
  ]);
  const rawRevisedTargets = uniq([
    ...arr(rawRevisedExecution.sectionPlans).flatMap((row) => arr(row?.targetIds)),
    ...arr(rawRevisedExecution.effectPlacements).map((row) => row?.targetId)
  ]);
  const revisedSections = uniq([
    ...revisedRows.sectionPlans.map((row) => row?.section),
    ...revisedRows.effectPlacements.map((row) => row?.sourceSectionLabel || row?.timingContext?.anchorLabel)
  ]);

  let checksTotal = 0;
  let checksPassed = 0;
  const check = (name, ok) => {
    checksTotal += 1;
    if (ok) checksPassed += 1;
    else failures.push(name);
  };

  check("revision_identity_drift", revisedRows.sectionPlans.every((row) => str(row?.designId) === target.designId) && revisedRows.effectPlacements.every((row) => str(row?.designId) === target.designId));
  check("revision_number_not_incremented", revisedRows.sectionPlans.every((row) => Number(row?.designRevision) === Number(target.designRevision)) && revisedRows.effectPlacements.every((row) => Number(row?.designRevision) === Number(target.designRevision)));
  check("unrelated_concepts_changed", JSON.stringify(baseNonTarget) === JSON.stringify(mergedNonTarget));
  check("concept_set_drift", JSON.stringify(baseIds) === JSON.stringify(mergedIds));
  check("revision_scope_drift", revisedSections.every((section) => !target.sections.length || target.sections.includes(section)));
  check("raw_revision_multi_concept_drift", rawRevisedIds.length <= 1);
  check("raw_revision_section_drift", rawRevisedSections.every((section) => !target.sections.length || target.sections.includes(section)));
  check("raw_revision_target_drift", rawRevisedTargets.every((targetId) => !target.targetIds.length || target.targetIds.includes(targetId)));
  check("raw_revision_whole_pass_expansion", arr(rawRevisedExecution.sectionPlans).length <= Math.max(1, target.sections.length));

  return {
    score: structuralScore({ ok: !failures.length, failures, checksPassed, checksTotal }),
    failures: uniq(failures),
    checksPassed,
    checksTotal,
    metrics: {
      baseDesignIds: baseIds,
      mergedDesignIds: mergedIds,
      rawRevisedDesignIds: rawRevisedIds,
      revisedSectionCount: revisedRows.sectionPlans.length,
      revisedPlacementCount: revisedRows.effectPlacements.length,
      revisedSections,
      rawRevisedSections,
      rawRevisedTargets
    }
  };
}

function structuralScore({ ok, failures = [], checksPassed = 0, checksTotal = 0 }) {
  if (!ok || failures.length) return 0;
  if (!checksTotal) return 1;
  const ratio = checksPassed / checksTotal;
  if (ratio >= 0.95) return 3;
  if (ratio >= 0.75) return 2;
  return 1;
}

function normalizeSpeedValue(speed = "") {
  const lookup = {
    slow: 1,
    medium: 2,
    medium_high: 2,
    medium_fast: 3,
    fast: 4
  };
  return lookup[str(speed)] || 0;
}

function average(values = []) {
  const nums = arr(values).map((value) => Number(value)).filter((value) => Number.isFinite(value));
  if (!nums.length) return 0;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

function sectionOrderIndex(label = "") {
  const normalized = str(label).toLowerCase();
  if (!normalized) return 999;
  if (normalized.includes("intro")) return 0;
  if (normalized.includes("verse")) return 1;
  if (normalized.includes("chorus 1")) return 2;
  if (normalized.includes("bridge")) return 3;
  if (normalized.includes("final chorus")) return 4;
  if (normalized.includes("outro")) return 5;
  return 999;
}

function buildArtisticContext({ summary = "", proposalLines = [], executionPlan = null, lenses = [], promptText = "" }) {
  const plan = executionPlan && typeof executionPlan === "object" ? executionPlan : {};
  const placements = arr(plan.effectPlacements);
  const sectionPlans = arr(plan.sectionPlans);
  const text = `${str(promptText)}\n${str(summary)}\n${arr(proposalLines).join("\n")}`.toLowerCase();
  const motionValues = uniq(placements.map((row) => row?.settingsIntent?.motion));
  const effectFamilies = uniq(placements.map((row) => row?.effectName));
  const layerCount = uniq(placements.map((row) => `${str(row?.targetId)}:${Number(row?.layerIndex)}`)).length;
  const designIds = uniq(sectionPlans.map((row) => row?.designId));
  const sectionLabels = uniq(sectionPlans.map((row) => row?.section));
  const renderPolicies = uniq(placements.map((row) => row?.renderIntent?.expansionPolicy || row?.renderIntent?.groupPolicy));
  const bufferStyles = uniq(placements.map((row) => row?.renderIntent?.bufferStyle));
  const layerBlendRoles = uniq(placements.map((row) => row?.layerIntent?.blendRole));
  const mixAmounts = uniq(placements.map((row) => row?.layerIntent?.mixAmount));
  const coverageValues = uniq(placements.map((row) => row?.settingsIntent?.coverage));
  const paletteTemperatures = uniq(placements.map((row) => row?.paletteIntent?.temperature));
  const speedBySection = {};
  const familiesBySection = {};
  const paletteBySection = {};
  for (const placement of placements) {
    const label = str(placement?.timingContext?.anchorLabel);
    if (!label) continue;
    if (!speedBySection[label]) speedBySection[label] = [];
    speedBySection[label].push(normalizeSpeedValue(placement?.settingsIntent?.speed));
    if (!familiesBySection[label]) familiesBySection[label] = [];
    familiesBySection[label].push(str(placement?.effectName));
    if (!paletteBySection[label]) paletteBySection[label] = [];
    paletteBySection[label].push(str(placement?.paletteIntent?.temperature));
  }
  const sortedSections = Object.keys(speedBySection)
    .sort((a, b) => sectionOrderIndex(a) - sectionOrderIndex(b));
  const sectionSpeedAverages = sortedSections.map((label) => ({
    section: label,
    averageSpeed: Number(average(speedBySection[label]).toFixed(2))
  }));
  return {
    text,
    summary: str(summary),
    proposalLines: arr(proposalLines).map((row) => str(row)).filter(Boolean),
    placements,
    sectionPlans,
    motionValues,
    effectFamilies,
    layerCount,
    designIds,
    sectionLabels,
    renderPolicies,
    bufferStyles,
    layerBlendRoles,
    mixAmounts,
    coverageValues,
    paletteTemperatures,
    familiesBySection,
    paletteBySection,
    sectionSpeedAverages,
    lenses: new Set(arr(lenses).map((value) => str(value)))
  };
}

function scoreThresholds({ value, weak = 1, acceptable = 2, strong = 3 }) {
  if (value >= strong) return 3;
  if (value >= acceptable) return 2;
  if (value >= weak) return 1;
  return 0;
}

function scoreMotionLanguage(context) {
  const applicable = context.lenses.has("Musical Understanding") || /rhythm|pulse|motion|rise|build|escalat/.test(context.text);
  if (!applicable) return null;
  const singleAnchor = context.sectionLabels.length <= 1;
  const compactMultiSection = context.sectionLabels.length === 2;
  const rhythmicDemand = context.lenses.has("Musical Understanding") || /rhythm|pulse|rise|build|escalat|drive/.test(context.text);
  let signal = 0;
  if (context.motionValues.length >= 2) signal += 1;
  if (context.motionValues.some((value) => /rhythmic|sweep|wash/.test(value))) signal += 1;
  const introSpeed = context.sectionSpeedAverages.find((row) => /intro/i.test(row.section))?.averageSpeed || 0;
  const finalSpeed = context.sectionSpeedAverages.find((row) => /final chorus|chorus/i.test(row.section))?.averageSpeed || 0;
  if (rhythmicDemand) {
    if (finalSpeed > introSpeed || context.motionValues.some((value) => /rhythmic/.test(value))) signal += 1;
    if (compactMultiSection && context.effectFamilies.length >= 3) signal += 1;
  } else if (singleAnchor) {
    if (context.effectFamilies.length >= 2) signal += 1;
  } else if (context.sectionSpeedAverages.length > 1) {
    const averages = context.sectionSpeedAverages.map((row) => row.averageSpeed);
    if (Math.max(...averages) > Math.min(...averages)) signal += 1;
  }
  if (context.effectFamilies.length >= (singleAnchor ? 2 : compactMultiSection ? 3 : 4)) signal += 1;
  return {
    applicable: true,
    score: scoreThresholds({ value: signal, weak: 1, acceptable: 2, strong: singleAnchor || compactMultiSection ? 3 : 4 }),
    signals: {
      singleAnchor,
      compactMultiSection,
      rhythmicDemand,
      motionModes: context.motionValues,
      sectionSpeedAverages: context.sectionSpeedAverages,
      effectFamilyCount: context.effectFamilies.length
    }
  };
}

function scoreStageLighting(context) {
  const applicable = context.lenses.has("Stage Lighting Reasoning") || /key|fill|wash|punch|silhouette|lighting/.test(context.text);
  if (!applicable) return null;
  let signal = 0;
  if (/key|fill|support|focus|wash|punch/.test(context.text)) signal += 1;
  if (context.layerCount >= Math.max(2, context.designIds.length)) signal += 1;
  if (context.effectFamilies.some((value) => /Color Wash|Candle|Shimmer|Wave/.test(value))) signal += 1;
  if (context.coverageValues.some((value) => /focused|partial/.test(value))) signal += 1;
  return {
    applicable: true,
    score: scoreThresholds({ value: signal, weak: 1, acceptable: 2, strong: 4 }),
    signals: {
      layerCount: context.layerCount,
      effectFamilies: context.effectFamilies,
      coverageValues: context.coverageValues
    }
  };
}

function scoreComposition(context) {
  const applicable = context.lenses.has("Composition Reasoning") || /negative space|frame|framing|perimeter|centerpiece|balance|contrast|left side|right side|foreground|background|depth/.test(context.text);
  if (!applicable) return null;
  let signal = 0;
  if (/negative space|frame|framing|perimeter|centerpiece|balance|contrast|left side|right side|foreground|background|depth/.test(context.text)) signal += 1;
  if (context.coverageValues.some((value) => /focused|partial/.test(value))) signal += 1;
  if (context.renderPolicies.some((value) => /no_expand|preserve/.test(value))) signal += 1;
  if (context.layerBlendRoles.some((value) => /support_fill|foundation|rhythmic_overlay|accent_overlay/.test(value))) signal += 1;
  if (context.mixAmounts.some((value) => /low|medium|medium_high|high/.test(value))) signal += 1;
  const selectiveTargets = context.placements.filter((row) => !/AllModels/.test(str(row?.targetId))).length;
  if (selectiveTargets >= Math.max(2, context.placements.length * 0.25)) signal += 1;
  return {
    applicable: true,
    score: scoreThresholds({ value: signal, weak: 1, acceptable: 3, strong: 5 }),
    signals: {
      renderPolicies: context.renderPolicies,
      layerBlendRoles: context.layerBlendRoles,
      mixAmounts: context.mixAmounts,
      coverageValues: context.coverageValues,
      selectiveTargetPlacements: selectiveTargets
    }
  };
}

function scoreSettingsRenderPlausibility(context) {
  const applicable = true;
  const placements = context.placements;
  const completePlacements = placements.filter((row) => row?.settingsIntent && row?.paletteIntent && row?.renderIntent);
  let signal = 0;
  if (placements.length && completePlacements.length === placements.length) signal += 1;
  if (context.renderPolicies.length >= 1) signal += 1;
  if (context.bufferStyles.length >= 1) signal += 1;
  if (context.coverageValues.length >= 1) signal += 1;
  if (placements.some((row) => str(row?.paletteIntent?.accentUsage))) signal += 1;
  if (context.mixAmounts.length >= 2 || context.layerBlendRoles.length >= 2) signal += 1;
  return {
    applicable,
    score: scoreThresholds({ value: signal, weak: 1, acceptable: 3, strong: 5 }),
    signals: {
      placementCount: placements.length,
      completePlacementCount: completePlacements.length,
      renderPolicies: context.renderPolicies,
      bufferStyles: context.bufferStyles,
      layerBlendRoles: context.layerBlendRoles,
      mixAmounts: context.mixAmounts,
      coverageValues: context.coverageValues
    }
  };
}

function scoreThematicContinuity(context) {
  const applicable = context.sectionLabels.length >= 3;
  if (!applicable) return null;
  let signal = 0;
  const recurringFamilies = new Set();
  for (const families of Object.values(context.familiesBySection)) {
    for (const family of uniq(families)) {
      recurringFamilies.add(family);
    }
  }
  const familyUsageCounts = {};
  for (const families of Object.values(context.familiesBySection)) {
    for (const family of uniq(families)) {
      familyUsageCounts[family] = (familyUsageCounts[family] || 0) + 1;
    }
  }
  const repeatedFamilies = Object.entries(familyUsageCounts).filter(([, count]) => count >= 2).map(([family]) => family);
  const sectionTemperatureCounts = Object.values(context.paletteBySection).map((values) => uniq(values).filter(Boolean).length);
  if (repeatedFamilies.length >= 2) signal += 1;
  if (context.paletteTemperatures.length <= 2) signal += 1;
  if (sectionTemperatureCounts.every((count) => count <= 2)) signal += 1;
  if (context.effectFamilies.length >= 4 && repeatedFamilies.length < context.effectFamilies.length) signal += 1;
  return {
    applicable: true,
    score: scoreThresholds({ value: signal, weak: 1, acceptable: 2, strong: 4 }),
    signals: {
      repeatedFamilies,
      paletteTemperatures: context.paletteTemperatures,
      perSectionPaletteTemperatureCounts: Object.fromEntries(
        Object.entries(context.paletteBySection).map(([section, values]) => [section, uniq(values).filter(Boolean).length])
      )
    }
  };
}

function scoreConceptSummaryQuality(context) {
  const summaryWords = context.summary.split(/\s+/).filter(Boolean).length;
  const genericProposalLines = context.proposalLines.filter((line) => (
    /^general\s*\/\s*general\s*\//i.test(line)
    && !/lighting stack|focal-versus-support|key-vs-fill/i.test(line)
  ));
  const targetedProposalLines = context.proposalLines.filter((line) => !/^general\s*\/\s*general\s*\//i.test(line));
  const uniqueIntentSummaries = uniq(context.sectionPlans.map((row) => row?.intentSummary));
  let signal = 0;
  if (summaryWords >= 6 && summaryWords <= 28) signal += 1;
  if (targetedProposalLines.length >= Math.max(1, Math.ceil(context.proposalLines.length / 2))) signal += 1;
  if (genericProposalLines.length <= Math.max(1, Math.floor(context.proposalLines.length / 3))) signal += 1;
  if (uniqueIntentSummaries.length >= Math.min(2, Math.max(1, context.sectionPlans.length))) signal += 1;
  return {
    applicable: true,
    score: scoreThresholds({ value: signal, weak: 1, acceptable: 2, strong: 4 }),
    signals: {
      summaryWordCount: summaryWords,
      proposalLineCount: context.proposalLines.length,
      genericProposalLineCount: genericProposalLines.length,
      targetedProposalLineCount: targetedProposalLines.length,
      uniqueIntentSummaryCount: uniqueIntentSummaries.length
    }
  };
}

function scoreTargetSelectionQuality(context) {
  const aggregatePlacements = context.placements.filter((row) => /allmodels|group|nofloods|nomatrix/i.test(str(row?.targetId)));
  const selectivePlacements = context.placements.filter((row) => !/allmodels|group|nofloods|nomatrix/i.test(str(row?.targetId)));
  const selectiveRatio = context.placements.length ? selectivePlacements.length / context.placements.length : 0;
  const targetedDemand = ["Prop Understanding", "Setting and Layout Awareness", "Composition Reasoning", "Stage Lighting Reasoning"]
    .some((lens) => context.lenses.has(lens));
  let signal = 0;
  if (selectivePlacements.length >= 1) signal += 1;
  if (selectiveRatio >= 0.35) signal += 1;
  if (!targetedDemand || selectivePlacements.length >= Math.max(2, Math.ceil(context.placements.length * 0.25))) signal += 1;
  if (uniq(selectivePlacements.map((row) => row?.targetId)).length >= Math.min(3, Math.max(1, context.sectionPlans.length))) signal += 1;
  return {
    applicable: true,
    score: scoreThresholds({ value: signal, weak: 1, acceptable: 2, strong: 4 }),
    signals: {
      placementCount: context.placements.length,
      aggregatePlacementCount: aggregatePlacements.length,
      selectivePlacementCount: selectivePlacements.length,
      selectiveRatio: Number(selectiveRatio.toFixed(2)),
      selectiveTargetCount: uniq(selectivePlacements.map((row) => row?.targetId)).length
    }
  };
}

function evaluateArtisticScores({ summary = "", proposalLines = [], executionPlan = null, lenses = [], promptText = "" }) {
  const context = buildArtisticContext({ summary, proposalLines, executionPlan, lenses, promptText });
  const categories = {
    conceptSummaryQuality: scoreConceptSummaryQuality(context),
    targetSelectionQuality: scoreTargetSelectionQuality(context),
    motionLanguage: scoreMotionLanguage(context),
    stageLighting: scoreStageLighting(context),
    composition: scoreComposition(context),
    settingsRenderPlausibility: scoreSettingsRenderPlausibility(context),
    thematicContinuity: scoreThematicContinuity(context)
  };
  const applicableScores = Object.values(categories)
    .filter((entry) => entry?.applicable)
    .map((entry) => Number(entry.score || 0));
  return {
    categories,
    average: applicableScores.length
      ? Number((applicableScores.reduce((sum, value) => sum + value, 0) / applicableScores.length).toFixed(2))
      : null
  };
}

function evaluateCase(result, testCase) {
  const failures = [];
  const proposalLines = arr(result?.proposalLines);
  const summary = str(result?.summary);
  const metrics = extractMetrics(result);
  const expect = testCase.expect || {};
  let checksTotal = 0;
  let checksPassed = 0;

  if (!result?.ok) {
    failures.push("designer_failure");
  }
  if (/effects\.create|layerindex|startms|endms/i.test(`${summary}\n${proposalLines.join("\n")}`)) {
    failures.push("sequencing_leakage");
  }
  if (metrics.designConceptCount > 0 && metrics.effectPlacementCount === 0) {
    failures.push("missing_primary_effect_placements");
  }
  if (arr(metrics.conceptsWithoutPlacements).length) {
    failures.push("concept_without_effect_placements");
  }

  const check = (name, ok) => {
    checksTotal += 1;
    if (ok) {
      checksPassed += 1;
    } else {
      failures.push(name);
    }
  };

  if (expect.mustIncludeTagNames) {
    check("missing_required_tags", includesAll(metrics.tagNames, expect.mustIncludeTagNames));
  }
  if (expect.mustIncludeTargetIds) {
    check("missing_required_targets", includesAll(metrics.targetIds, expect.mustIncludeTargetIds));
  }
  if (expect.mustOnlyIncludeTargetIds) {
    const actual = uniq(metrics.targetIds).sort();
    const expected = uniq(expect.mustOnlyIncludeTargetIds).sort();
    check("unexpected_targets_present", JSON.stringify(actual) === JSON.stringify(expected));
  }
  if (expect.mustExcludeTargetIds) {
    const actualSet = new Set(arr(metrics.targetIds).map((row) => str(row)));
    check("forbidden_targets_present", !arr(expect.mustExcludeTargetIds).some((row) => actualSet.has(str(row))));
  }
  if (expect.maxTargetCount != null) {
    check("too_many_targets", metrics.targetIds.length <= Number(expect.maxTargetCount));
  }
  if (expect.mustIncludeSections) {
    check("missing_required_sections", includesAll(metrics.sections, expect.mustIncludeSections));
  }
  if (expect.proposalLinePatternsAny) {
    check("missing_expected_language", regexAny(proposalLines, expect.proposalLinePatternsAny));
  }
  if (expect.minEffectPlacementCount != null) {
    check("insufficient_effect_placements", metrics.effectPlacementCount >= Number(expect.minEffectPlacementCount));
  }
  if (expect.minDistinctEffectFamilies != null) {
    check("insufficient_family_diversity", metrics.distinctEffectFamilies.length >= Number(expect.minDistinctEffectFamilies));
  }
  if (expect.minDesignConceptCount != null) {
    check("insufficient_design_concepts", metrics.designConceptCount >= Number(expect.minDesignConceptCount));
  }
  if (expect.mustIncludeTrackNames) {
    check("missing_required_track_names", includesAll(metrics.trackNames, expect.mustIncludeTrackNames));
  }
  if (expect.mustIncludeAlignmentModes) {
    check("missing_required_alignment_modes", includesAll(metrics.alignmentModes, expect.mustIncludeAlignmentModes));
  }
  if (expect.minLayeredTargetCount != null) {
    check("insufficient_layered_targets", metrics.layeredTargetIds.length >= Number(expect.minLayeredTargetCount));
  }
  if (expect.mustLayerTargetIds) {
    check("missing_required_layered_targets", includesAll(metrics.layeredTargetIds, expect.mustLayerTargetIds));
  }
  if (expect.minOverlayPlacementCount != null) {
    check("insufficient_overlay_placements", metrics.overlayPlacementCount >= Number(expect.minOverlayPlacementCount));
  }
  if (expect.minFocusedOverlayPlacementCount != null) {
    check("insufficient_focused_overlay_placements", metrics.focusedOverlayPlacementCount >= Number(expect.minFocusedOverlayPlacementCount));
  }
  if (expect.minWellShapedOverlayCount != null) {
    check("insufficient_well_shaped_overlays", Number(metrics.wellShapedOverlayCount || 0) >= Number(expect.minWellShapedOverlayCount));
  }
  if (expect.mustIncludeBlendRoles) {
    const actual = new Set(arr(result?.proposalBundle?.executionPlan?.effectPlacements).map((row) => str(row?.layerIntent?.blendRole)));
    check("missing_required_blend_roles", arr(expect.mustIncludeBlendRoles).every((row) => actual.has(str(row))));
  }
  if (expect.mustIncludeBufferStyles) {
    const actual = new Set(arr(result?.proposalBundle?.executionPlan?.effectPlacements).map((row) => str(row?.renderIntent?.bufferStyle)));
    check("missing_required_buffer_styles", arr(expect.mustIncludeBufferStyles).every((row) => actual.has(str(row))));
  }
  if (expect.minDistinctSectionFamilySignatures != null) {
    check("insufficient_section_family_contrast", Number(metrics.distinctSectionFamilySignatures || 0) >= Number(expect.minDistinctSectionFamilySignatures));
  }
  if (expect.minRecurringEffectFamilies != null) {
    check("insufficient_thematic_family_recurrence", arr(metrics.recurringEffectFamilies).length >= Number(expect.minRecurringEffectFamilies));
  }
  if (expect.maxPaletteTemperatureCount != null) {
    const sectionCounts = Object.values(metrics.perSectionPaletteTemperatureCounts || {}).map((value) => Number(value || 0));
    const maxCount = sectionCounts.length ? Math.max(...sectionCounts) : 0;
    check("excessive_palette_temperature_scatter", maxCount <= Number(expect.maxPaletteTemperatureCount));
  }
  for (const comparison of arr(expect.placementCountComparisons)) {
    const higher = str(comparison?.higherSection);
    const lower = str(comparison?.lowerSection);
    const higherCount = Number(metrics.perSectionPlacementCounts?.[higher] || 0);
    const lowerCount = Number(metrics.perSectionPlacementCounts?.[lower] || 0);
    check(`placement_count_comparison_${higher}_vs_${lower}`, higherCount > lowerCount);
  }
  for (const comparison of arr(expect.averageSpeedComparisons)) {
    const faster = str(comparison?.fasterSection);
    const slower = str(comparison?.slowerSection);
    const fasterSpeed = Number(metrics.perSectionAverageSpeeds?.[faster] || 0);
    const slowerSpeed = Number(metrics.perSectionAverageSpeeds?.[slower] || 0);
    check(`average_speed_comparison_${faster}_vs_${slower}`, fasterSpeed > slowerSpeed);
  }

  const score = structuralScore({
    ok: result?.ok,
    failures,
    checksPassed,
    checksTotal
  });

  return {
    score,
    failures: uniq(failures),
    checksPassed,
    checksTotal,
    metrics
  };
}

function runCase(testCase, metadataFixture) {
  const fixture = buildFixture({
    variant: str(testCase.fixtureVariant || "default"),
    metadataFixture
  });
  if (str(testCase.runnerMode) === "framework_assisted") {
    const seedPrompt = str(testCase.seedPromptText || "Rework the whole show into a warmer, more cinematic pass with clear section contrast, stronger focal moments, and more varied effects across the song.");
    const baseResult = executeDesignerProposalOrchestration({
      requestId: `eval-seed-${testCase.id}`,
      sequenceRevision: "eval-rev-1",
      promptText: seedPrompt,
      goals: seedPrompt,
      analysisArtifact: fixture.analysisArtifact,
      analysisHandoff: fixture.analysisHandoff,
      models: fixture.models,
      submodels: fixture.submodels,
      metadataAssignments: fixture.metadataAssignments,
      designSceneContext: fixture.designSceneContext,
      musicDesignContext: fixture.musicDesignContext
    });
    const baseExecutionPlan = getExecutionPlanFromResult(baseResult);
    const revisionTarget = buildRevisionTargetFromExecutionPlan(baseExecutionPlan, testCase);
    const revisedPromptText = buildRevisionPromptText(testCase.promptText, revisionTarget);
    const revisedResult = executeDesignerProposalOrchestration({
      requestId: `eval-revise-${testCase.id}`,
      sequenceRevision: "eval-rev-1",
      promptText: revisedPromptText,
      goals: revisedPromptText,
      selectedSections: arr(revisionTarget?.sections),
      selectedTargetIds: arr(revisionTarget?.targetIds),
      analysisArtifact: fixture.analysisArtifact,
      analysisHandoff: fixture.analysisHandoff,
      models: fixture.models,
      submodels: fixture.submodels,
      metadataAssignments: fixture.metadataAssignments,
      designSceneContext: fixture.designSceneContext,
      musicDesignContext: fixture.musicDesignContext
    });
    const mergedExecutionPlan = mergeRevisedDesignConceptExecutionPlan({
      currentExecutionPlan: baseExecutionPlan,
      revisedExecutionPlan: getExecutionPlanFromResult(revisedResult),
      revisionTarget
    });
    const evaluation = evaluateRevisionCase(baseResult, revisedResult, mergedExecutionPlan, revisionTarget);
    return {
      id: testCase.id,
      kind: testCase.kind,
      runnerMode: "framework_assisted",
      lenses: arr(testCase.lenses),
      status: evaluation.failures.length ? "failed" : "passed",
      summary: str(revisedResult?.summary || testCase.promptText),
      structuralScore: evaluation.score,
      artisticScores: evaluateArtisticScores({
        summary: revisedResult?.summary,
        proposalLines: revisedResult?.proposalLines,
        executionPlan: mergedExecutionPlan,
        lenses: testCase.lenses,
        promptText: testCase.promptText
      }),
      failures: evaluation.failures,
      checksPassed: evaluation.checksPassed,
      checksTotal: evaluation.checksTotal,
      metrics: evaluation.metrics
    };
  }

  const result = executeDesignerProposalOrchestration({
    requestId: `eval-${testCase.id}`,
    sequenceRevision: "eval-rev-1",
    promptText: testCase.promptText,
    goals: testCase.promptText,
    selectedSections: arr(testCase.selectedSections),
    selectedTargetIds: arr(testCase.selectedTargetIds),
    selectedTagNames: arr(testCase.selectedTagNames),
    analysisArtifact: fixture.analysisArtifact,
    analysisHandoff: fixture.analysisHandoff,
    models: fixture.models,
    submodels: fixture.submodels,
    metadataAssignments: fixture.metadataAssignments,
    designSceneContext: fixture.designSceneContext,
    musicDesignContext: fixture.musicDesignContext,
    directorProfile: buildDirectorProfile(testCase.directorProfileVariant)
  });

  const evaluation = evaluateCase(result, testCase);
  return {
    id: testCase.id,
    kind: testCase.kind,
    lenses: arr(testCase.lenses),
    status: evaluation.failures.length ? "failed" : "passed",
    summary: str(result?.summary),
    structuralScore: evaluation.score,
    artisticScores: evaluateArtisticScores({
      summary: result?.summary,
      proposalLines: result?.proposalLines,
      executionPlan: getExecutionPlanFromResult(result),
      lenses: testCase.lenses,
      promptText: testCase.promptText
    }),
    failures: evaluation.failures,
    checksPassed: evaluation.checksPassed,
    checksTotal: evaluation.checksTotal,
    metrics: evaluation.metrics
  };
}

function runPairedPreferenceCase(testCase, metadataFixture) {
  const fixture = buildFixture({
    variant: str(testCase.fixtureVariant || "default"),
    metadataFixture
  });
  const promptText = str(testCase.promptText);
  const baseArgs = {
    sequenceRevision: "eval-rev-1",
    promptText,
    goals: promptText,
    selectedSections: arr(testCase.selectedSections),
    analysisArtifact: fixture.analysisArtifact,
    analysisHandoff: fixture.analysisHandoff,
    models: fixture.models,
    submodels: fixture.submodels,
    metadataAssignments: fixture.metadataAssignments,
    designSceneContext: fixture.designSceneContext,
    musicDesignContext: fixture.musicDesignContext
  };
  const warmResult = executeDesignerProposalOrchestration({
    requestId: `eval-${testCase.id}-warm`,
    ...baseArgs,
    directorProfile: buildDirectorProfile("warm_cinematic")
  });
  const crispResult = executeDesignerProposalOrchestration({
    requestId: `eval-${testCase.id}-crisp`,
    ...baseArgs,
    directorProfile: buildDirectorProfile("crisp_focal")
  });
  const warmMetrics = extractMetrics(warmResult);
  const crispMetrics = extractMetrics(crispResult);
  const warmFamilies = uniq(warmMetrics.distinctEffectFamilies).sort();
  const crispFamilies = uniq(crispMetrics.distinctEffectFamilies).sort();
  const warmChorusSpeed = Number(warmMetrics.perSectionAverageSpeeds?.["Chorus 1"] || 0);
  const crispChorusSpeed = Number(crispMetrics.perSectionAverageSpeeds?.["Chorus 1"] || 0);
  const failures = [];
  let checksTotal = 0;
  let checksPassed = 0;
  const check = (name, ok) => {
    checksTotal += 1;
    if (ok) checksPassed += 1;
    else failures.push(name);
  };
  check("preference_family_sets_identical", JSON.stringify(warmFamilies) !== JSON.stringify(crispFamilies));
  check("preference_speed_not_shifted", crispChorusSpeed > warmChorusSpeed);
  check("warm_missing_soft_families", warmFamilies.some((name) => /Color Wash|Wave|Spirals|Candle/i.test(name)));
  check("crisp_missing_crisp_families", crispFamilies.some((name) => /Bars|Shimmer|Meteors|Pinwheel/i.test(name)));
  return {
    id: testCase.id,
    kind: testCase.kind,
    runnerMode: "paired_preference",
    lenses: arr(testCase.lenses),
    status: failures.length ? "failed" : "passed",
    summary: promptText,
    structuralScore: structuralScore({ ok: !failures.length, failures, checksPassed, checksTotal }),
    artisticScores: null,
    failures: uniq(failures),
    checksPassed,
    checksTotal,
    metrics: {
      warmFamilies,
      crispFamilies,
      warmChorusSpeed,
      crispChorusSpeed
    }
  };
}

function runRepeatedPreferenceCase(testCase, metadataFixture) {
  const fixture = buildFixture({
    variant: str(testCase.fixtureVariant || "default"),
    metadataFixture
  });
  const promptText = str(testCase.promptText);
  const profileName = str(testCase.directorProfileVariant || "warm_cinematic");
  const baseArgs = {
    sequenceRevision: "eval-rev-1",
    promptText,
    goals: promptText,
    selectedSections: arr(testCase.selectedSections),
    analysisArtifact: fixture.analysisArtifact,
    analysisHandoff: fixture.analysisHandoff,
    models: fixture.models,
    submodels: fixture.submodels,
    metadataAssignments: fixture.metadataAssignments,
    designSceneContext: fixture.designSceneContext,
    musicDesignContext: fixture.musicDesignContext,
    directorProfile: buildDirectorProfile(profileName)
  };
  const firstResult = executeDesignerProposalOrchestration({
    requestId: `eval-${testCase.id}-1`,
    ...baseArgs
  });
  const secondResult = executeDesignerProposalOrchestration({
    requestId: `eval-${testCase.id}-2`,
    ...baseArgs
  });
  const firstMetrics = extractMetrics(firstResult);
  const secondMetrics = extractMetrics(secondResult);
  const failures = [];
  let checksTotal = 0;
  let checksPassed = 0;
  const check = (name, ok) => {
    checksTotal += 1;
    if (ok) checksPassed += 1;
    else failures.push(name);
  };
  check(
    "preference_family_drift",
    JSON.stringify(uniq(firstMetrics.distinctEffectFamilies).sort()) === JSON.stringify(uniq(secondMetrics.distinctEffectFamilies).sort())
  );
  check(
    "preference_target_drift",
    JSON.stringify(uniq(firstMetrics.targetIds).sort()) === JSON.stringify(uniq(secondMetrics.targetIds).sort())
  );
  check(
    "preference_speed_drift",
    JSON.stringify(firstMetrics.perSectionAverageSpeeds) === JSON.stringify(secondMetrics.perSectionAverageSpeeds)
  );
  return {
    id: testCase.id,
    kind: testCase.kind,
    runnerMode: "repeated_preference",
    lenses: arr(testCase.lenses),
    status: failures.length ? "failed" : "passed",
    summary: promptText,
    structuralScore: structuralScore({ ok: !failures.length, failures, checksPassed, checksTotal }),
    artisticScores: null,
    failures: uniq(failures),
    checksPassed,
    checksTotal,
    metrics: {
      firstFamilies: uniq(firstMetrics.distinctEffectFamilies).sort(),
      secondFamilies: uniq(secondMetrics.distinctEffectFamilies).sort(),
      firstTargets: uniq(firstMetrics.targetIds).sort(),
      secondTargets: uniq(secondMetrics.targetIds).sort(),
      firstSpeeds: firstMetrics.perSectionAverageSpeeds,
      secondSpeeds: secondMetrics.perSectionAverageSpeeds
    }
  };
}

function runPairedMetadataCase(testCase, metadataFixture) {
  const promptText = str(testCase.promptText);
  const defaultFixture = buildFixture({
    variant: str(testCase.fixtureVariant || "default"),
    metadataFixture
  });
  const overrideFixture = buildFixture({
    variant: str(testCase.overrideFixtureVariant || "metadata_change_sensitivity"),
    metadataFixture
  });
  const buildArgs = (fixture, requestId) => ({
    requestId,
    sequenceRevision: "eval-rev-1",
    promptText,
    goals: promptText,
    selectedSections: arr(testCase.selectedSections),
    selectedTagNames: arr(testCase.selectedTagNames),
    analysisArtifact: fixture.analysisArtifact,
    analysisHandoff: fixture.analysisHandoff,
    models: fixture.models,
    submodels: fixture.submodels,
    metadataAssignments: fixture.metadataAssignments,
    designSceneContext: fixture.designSceneContext,
    musicDesignContext: fixture.musicDesignContext
  });
  const defaultResult = executeDesignerProposalOrchestration(buildArgs(defaultFixture, `eval-${testCase.id}-default`));
  const overrideResult = executeDesignerProposalOrchestration(buildArgs(overrideFixture, `eval-${testCase.id}-override`));
  const defaultMetrics = extractMetrics(defaultResult);
  const overrideMetrics = extractMetrics(overrideResult);
  const defaultTargets = uniq(defaultMetrics.targetIds).sort();
  const overrideTargets = uniq(overrideMetrics.targetIds).sort();
  const failures = [];
  let checksTotal = 0;
  let checksPassed = 0;
  const check = (name, ok) => {
    checksTotal += 1;
    if (ok) checksPassed += 1;
    else failures.push(name);
  };
  check("metadata_refinement_no_effect", JSON.stringify(defaultTargets) !== JSON.stringify(overrideTargets));
  if (testCase.expect?.defaultMustIncludeTargetIds) {
    check("default_metadata_targets_missing", includesAll(defaultTargets, testCase.expect.defaultMustIncludeTargetIds));
  }
  if (testCase.expect?.overrideMustOnlyIncludeTargetIds) {
    const expected = uniq(testCase.expect.overrideMustOnlyIncludeTargetIds).sort();
    check("override_metadata_targets_wrong", JSON.stringify(overrideTargets) === JSON.stringify(expected));
  }
  return {
    id: testCase.id,
    kind: testCase.kind,
    runnerMode: "paired_metadata",
    lenses: arr(testCase.lenses),
    status: failures.length ? "failed" : "passed",
    summary: promptText,
    structuralScore: structuralScore({ ok: !failures.length, failures, checksPassed, checksTotal }),
    artisticScores: null,
    failures: uniq(failures),
    checksPassed,
    checksTotal,
    metrics: {
      defaultTargets,
      overrideTargets
    }
  };
}

function summarizeResults(results = []) {
  const supported = arr(results).filter((row) => row.status !== "deferred");
  const passed = supported.filter((row) => row.status === "passed");
  const failed = supported.filter((row) => row.status === "failed");
  const deferred = arr(results).filter((row) => row.status === "deferred");
  const avgScore = supported.length
    ? supported.reduce((sum, row) => sum + Number(row.structuralScore || 0), 0) / supported.length
    : 0;
  const collectArtisticAverages = (key) => {
    const scores = supported
      .map((row) => row?.artisticScores?.categories?.[key])
      .filter((entry) => entry?.applicable)
      .map((entry) => Number(entry.score || 0));
    return scores.length
      ? Number((scores.reduce((sum, value) => sum + value, 0) / scores.length).toFixed(2))
      : null;
  };
  return {
    total: arr(results).length,
    supported: supported.length,
    passed: passed.length,
    failed: failed.length,
    deferred: deferred.length,
    averageStructuralScore: Number(avgScore.toFixed(2)),
    artisticAverages: {
      conceptSummaryQuality: collectArtisticAverages("conceptSummaryQuality"),
      targetSelectionQuality: collectArtisticAverages("targetSelectionQuality"),
      motionLanguage: collectArtisticAverages("motionLanguage"),
      stageLighting: collectArtisticAverages("stageLighting"),
      composition: collectArtisticAverages("composition"),
      settingsRenderPlausibility: collectArtisticAverages("settingsRenderPlausibility"),
      thematicContinuity: collectArtisticAverages("thematicContinuity")
    }
  };
}

function main() {
  const corpus = readJson(casesPath);
  const metadataFixture = readJson(metadataFixturePath);
  const results = arr(corpus.cases).map((testCase) => (
    str(testCase.runnerMode) === "paired_preference"
      ? runPairedPreferenceCase(testCase, metadataFixture)
      : str(testCase.runnerMode) === "repeated_preference"
        ? runRepeatedPreferenceCase(testCase, metadataFixture)
      : str(testCase.runnerMode) === "paired_metadata"
        ? runPairedMetadataCase(testCase, metadataFixture)
        : runCase(testCase, metadataFixture)
  ));
  const report = {
    corpusType: corpus.corpusType,
    version: corpus.version,
    generatedAt: new Date().toISOString(),
    summary: summarizeResults(results),
    results
  };
  console.log(JSON.stringify(report, null, 2));
}

main();
