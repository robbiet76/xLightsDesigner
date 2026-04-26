import {
  buildDesignerPlanCommands,
  buildDisplayElementOrderCommand,
  buildSequenceSettingsCommand,
  collectGroupRenderPolicyWarnings,
  collectSubmodelRenderWarnings,
  estimateImpactCount
} from "./command-builders.js";
import { normalizeTimingTrackCoverage } from "../../runtime/timing-track-provenance.js";
import { SEQUENCE_AGENT_CONTRACT_VERSION, SEQUENCE_AGENT_PLAN_OUTPUT_CONTRACT, SEQUENCE_AGENT_ROLE } from "./sequence-agent-contracts.js";
import { evaluateSequencePlanCapabilities } from "./sequence-capability-gate.js";
import { evaluateEffectCommandCompatibility } from "./effect-compatibility.js";
import { translatePlacementIntentToXlights } from "./effect-intent-translation.js";
import { resolveTranslationLayer } from "./translation-layer.js";
import {
  buildCrossEffectSharedSettingsKnowledgeMetadata,
  buildDerivedParameterKnowledgeMetadata,
  buildStage1TrainingKnowledgeMetadata,
  recommendCrossEffectSharedSettings,
  recommendDerivedParameterPriors
} from "./trained-effect-knowledge.js";
import { buildSequencerRevisionBrief } from "./revision-planner.js";
import { buildPriorPassMemory } from "./revision-memory.js";
import {
  filterAvoidedEffects,
  selectPreferredEffect,
  chooseSafeFallbackChain,
  resolveSummaryFallbackEffect,
  resolveDirectCueEffectCandidates,
  firstAvailableEffect,
  recommendEffectsForTargets,
  recommendEffectsForVisualFamilies
} from "../shared/effect-semantics-registry.js";
import { buildArtifactId } from "../shared/artifact-ids.js";
import { buildMusicDesignContext } from "../designer-dialog/music-design-context.js";
import { buildCandidateSelectionV1 } from "./candidate-selection.js";
import { chooseCandidateFromSelection, projectChosenCandidateToEffectStrategy } from "./candidate-band-chooser.js";
import { buildCandidateSelectionContext } from "./candidate-selection-context.js";
import { buildIntentEnvelopeV1 } from "./intent-envelope.js";
import { buildRealizationCandidatesV1 } from "./realization-candidates.js";
import { buildRevisionDeltaV1 } from "./revision-delta.js";
import { buildRevisionRetryPressureV1 } from "./revision-retry-pressure.js";
import { sanitizeCurrentSequenceContextForPlan } from "./current-sequence-context.js";

const STAGE_ORDER = ["scope_resolution", "timing_asset_decision", "effect_strategy", "command_graph_synthesis"];

function nowMs() {
  return Date.now();
}

function normText(value = "") {
  return String(value || "").trim();
}

function normArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function normLayoutMode(value = "") {
  const key = String(value || "").trim().toLowerCase();
  return key === "3d" ? "3d" : "2d";
}

function classifyStageFailure(stage = "") {
  const key = String(stage || "").trim();
  if (key === "scope_resolution") return "scope";
  if (key === "timing_asset_decision") return "timing";
  if (key === "effect_strategy") return "strategy";
  if (key === "command_graph_synthesis") return "graph";
  return "unknown";
}

function buildPlanSummary({ goal = "", mode = "", sectionNames = [] } = {}) {
  const base = normText(goal) || "director intent";
  const sectionText = sectionNames.length ? ` across ${sectionNames.slice(0, 4).join(", ")}` : "";
  return `${mode || "create"} plan for ${base}${sectionText}`.trim();
}

function isCompoundScopedDirectRequest({ goal = "", sectionNames = [], sourceLines = [] } = {}) {
  const lowerGoal = normText(goal).toLowerCase();
  if (!lowerGoal) return false;
  const normalizedSource = normArray(sourceLines).map((row) => normText(row)).filter(Boolean);
  if (normalizedSource.length > 1) return false;
  const isDirectRequest = /\b(add|apply|put|make|set)\b/.test(lowerGoal);
  const hasJoiner = /\b(and|then|also)\b|,/.test(lowerGoal);
  const hasSecondActionVerb = /\b(and|then|also)\b[^.]*\b(add|apply|put|make|set)\b/.test(lowerGoal);
  return isDirectRequest && hasJoiner && (normArray(sectionNames).length > 1 || hasSecondActionVerb);
}

function deriveExecutionStrategy(intentHandoff = {}) {
  const strategy = intentHandoff && typeof intentHandoff?.executionStrategy === "object" && !Array.isArray(intentHandoff.executionStrategy)
    ? intentHandoff.executionStrategy
    : {};
  return {
    passScope: normText(strategy.passScope),
    implementationMode: normText(strategy.implementationMode),
    routePreference: normText(strategy.routePreference),
    designId: normText(strategy.designId),
    designRevision: Number.isInteger(Number(strategy.designRevision)) ? Number(strategy.designRevision) : 0,
    designAuthor: normText(strategy.designAuthor),
    shouldUseFullSongStructureTrack: Boolean(strategy.shouldUseFullSongStructureTrack),
    timingTrackName: normText(strategy.timingTrackName),
    sectionTimingTrackName: normText(strategy.sectionTimingTrackName),
    sectionCount: Number(strategy.sectionCount || 0),
    targetCount: Number(strategy.targetCount || 0),
    primarySections: normArray(strategy.primarySections).map((s) => normText(s)).filter(Boolean),
    effectPlacements: normArray(strategy.effectPlacements)
      .map((row, index) => {
        const targetId = normText(row?.targetId);
        const effectName = normText(row?.effectName);
        const startMs = Number(row?.startMs);
        const endMs = Number(row?.endMs);
        const layerIndex = Number(row?.layerIndex);
        if (!targetId || !effectName) return null;
        if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;
        if (!Number.isFinite(layerIndex) || layerIndex < 0) return null;
        return {
          placementId: normText(row?.placementId) || `placement-${index + 1}`,
          designId: normText(row?.designId),
          designRevision: Number.isInteger(Number(row?.designRevision)) ? Number(row.designRevision) : 0,
          designAuthor: normText(row?.designAuthor),
          targetId,
          layerIndex,
          effectName,
          startMs,
          endMs,
          timingContext: row?.timingContext && typeof row.timingContext === "object" && !Array.isArray(row.timingContext)
            ? {
                trackName: normText(row?.timingContext?.trackName),
                anchorLabel: normText(row?.timingContext?.anchorLabel),
                anchorStartMs: Number(row?.timingContext?.anchorStartMs),
                anchorEndMs: Number(row?.timingContext?.anchorEndMs),
                alignmentMode: normText(row?.timingContext?.alignmentMode)
              }
            : null,
          settings: row?.settings && typeof row.settings === "object" ? row.settings : (typeof row?.settings === "string" ? row.settings : {}),
          palette: row?.palette && typeof row.palette === "object" ? row.palette : (typeof row?.palette === "string" ? row.palette : {}),
          settingsIntent: row?.settingsIntent && typeof row.settingsIntent === "object" ? row.settingsIntent : null,
          paletteIntent: row?.paletteIntent && typeof row.paletteIntent === "object" ? row.paletteIntent : null,
          layerIntent: row?.layerIntent && typeof row.layerIntent === "object" ? row.layerIntent : null,
          renderIntent: row?.renderIntent && typeof row.renderIntent === "object" ? row.renderIntent : null,
          constraints: row?.constraints && typeof row.constraints === "object" ? row.constraints : null
        };
      })
      .filter(Boolean),
    sectionPlans: normArray(strategy.sectionPlans)
      .map((row) => ({
        designId: normText(row?.designId),
        designRevision: Number.isInteger(Number(row?.designRevision)) ? Number(row.designRevision) : 0,
        designAuthor: normText(row?.designAuthor),
        section: normText(row?.section),
        energy: normText(row?.energy),
        density: normText(row?.density),
        intentSummary: normText(row?.intentSummary),
        timingTrackName: normText(row?.timingTrackName),
        sectionTimingTrackName: normText(row?.sectionTimingTrackName),
        targetIds: normArray(row?.targetIds).map((s) => normText(s)).filter(Boolean),
        effectHints: normArray(row?.effectHints).map((s) => normText(s)).filter(Boolean)
      }))
      .filter((row) => row.section),
    translationIntent: strategy?.translationIntent && typeof strategy.translationIntent === "object" && !Array.isArray(strategy.translationIntent)
      ? strategy.translationIntent
      : null
  };
}

function deriveSequencingDesignHandoff(intentHandoff = {}, sequencingDesignHandoff = null) {
  if (sequencingDesignHandoff && typeof sequencingDesignHandoff === "object" && !Array.isArray(sequencingDesignHandoff)) {
    return sequencingDesignHandoff;
  }
  if (intentHandoff?.sequencingDesignHandoff && typeof intentHandoff.sequencingDesignHandoff === "object" && !Array.isArray(intentHandoff.sequencingDesignHandoff)) {
    return intentHandoff.sequencingDesignHandoff;
  }
  return null;
}

function buildSectionDirectiveIndex(designHandoff = null) {
  const index = new Map();
  const rows = Array.isArray(designHandoff?.sectionDirectives) ? designHandoff.sectionDirectives : [];
  for (const row of rows) {
    const key = normText(row?.sectionName);
    if (!key) continue;
    index.set(key, row);
  }
  return index;
}

function decorateCommandsWithDesignMetadata(commands = [], executionStrategy = {}) {
  const normalized = normArray(commands);
  const defaultDesignIds = Array.from(new Set([
    normText(executionStrategy?.designId),
    ...normArray(executionStrategy?.sectionPlans).map((row) => normText(row?.designId)),
    ...normArray(executionStrategy?.effectPlacements).map((row) => normText(row?.designId))
  ].filter(Boolean)));
  const defaultDesignAuthors = Array.from(new Set([
    normText(executionStrategy?.designAuthor),
    ...normArray(executionStrategy?.sectionPlans).map((row) => normText(row?.designAuthor)),
    ...normArray(executionStrategy?.effectPlacements).map((row) => normText(row?.designAuthor))
  ].filter(Boolean)));
  const designId = defaultDesignIds.length === 1 ? defaultDesignIds[0] : "";
  const designRevision = Number.isInteger(Number(executionStrategy?.designRevision)) ? Number(executionStrategy.designRevision) : 0;
  const designAuthor = defaultDesignAuthors.length === 1 ? defaultDesignAuthors[0] : "";
  if (!designId && !designAuthor && designRevision === 0) return normalized;
  return normalized.map((command) => {
    const currentDesignId = normText(command?.designId);
    const currentDesignRevision = Number.isInteger(Number(command?.designRevision)) ? Number(command.designRevision) : 0;
    const currentIntent = command?.intent && typeof command.intent === "object" ? command.intent : {};
    const currentDesignAuthor = normText(command?.designAuthor || currentIntent?.designAuthor);
    return {
      ...command,
      designId: currentDesignId || designId,
      designRevision: currentDesignRevision || designRevision,
      designAuthor: currentDesignAuthor || designAuthor,
      intent: {
        ...currentIntent,
        designId: normText(currentIntent?.designId) || currentDesignId || designId,
        designRevision: Number.isInteger(Number(currentIntent?.designRevision)) ? Number(currentIntent.designRevision) : (currentDesignRevision || designRevision),
        designAuthor: normText(currentIntent?.designAuthor) || currentDesignAuthor || designAuthor
      }
    };
  });
}

function deriveSectionNames({ analysisHandoff = {}, intentHandoff = {}, executionStrategy = {} } = {}) {
  const fromAnalysis = normArray(analysisHandoff?.structure?.sections).map((s) => normText(typeof s === "string" ? s : s?.label || s?.name));
  const fromScope = normArray(intentHandoff?.scope?.sections).map((s) => normText(s));
  const fromStrategy = normArray(executionStrategy?.primarySections).map((s) => normText(s));
  return fromStrategy.length ? fromStrategy : (fromScope.length ? fromScope : fromAnalysis);
}

function deriveSectionWindowsByName({ analysisHandoff = {}, sectionNames = [], includeAll = false } = {}) {
  const requested = includeAll ? new Set() : new Set(normArray(sectionNames).map((row) => normText(row)).filter(Boolean));
  const windowsByName = new Map();
  const rows = Array.isArray(analysisHandoff?.structure?.sections) ? analysisHandoff.structure.sections : [];
  for (const row of rows) {
    const label = typeof row === "string"
      ? normText(row)
      : normText(row?.label || row?.name || "");
    if (!label) continue;
    const startMs = Number(row?.startMs);
    const endMs = Number(row?.endMs);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) continue;
    windowsByName.set(label, { startMs, endMs });
  }
  const windows = new Map();
  const orderedRequested = includeAll
    ? Array.from(windowsByName.keys())
    : normArray(sectionNames).map((row) => normText(row)).filter(Boolean);
  for (const label of orderedRequested) {
    if (requested.size && !requested.has(label)) continue;
    const match = windowsByName.get(label);
    if (match) windows.set(label, match);
  }
  if (includeAll) {
    for (const [label, match] of windowsByName.entries()) {
      if (!windows.has(label)) windows.set(label, match);
    }
  }
  return windows;
}

function deriveEffectiveSequenceSettings({ sequenceSettings = {}, analysisHandoff = {} } = {}) {
  const base = sequenceSettings && typeof sequenceSettings === "object" && !Array.isArray(sequenceSettings)
    ? { ...sequenceSettings }
    : {};
  if (Number.isFinite(Number(base.durationMs)) && Number(base.durationMs) > 0) {
    return base;
  }
  const rows = Array.isArray(analysisHandoff?.structure?.sections) ? analysisHandoff.structure.sections : [];
  let maxEndMs = null;
  for (const row of rows) {
    const endMs = Number(row?.endMs);
    if (!Number.isFinite(endMs) || endMs <= 0) continue;
    maxEndMs = maxEndMs == null ? endMs : Math.max(maxEndMs, endMs);
  }
  if (maxEndMs != null) {
    base.durationMs = maxEndMs;
  }
  return base;
}

function normalizeXdSongStructureMarks(marks = [], sequenceSettings = {}) {
  const durationMs = Number(sequenceSettings?.durationMs);
  const effectiveDurationMs = Number.isFinite(durationMs) && durationMs > 0
    ? durationMs
    : Math.max(0, ...normArray(marks).map((row) => Number(row?.endMs) || 0));
  const normalized = normalizeTimingTrackCoverage(marks, {
    durationMs: effectiveDurationMs,
    fillerLabel: ""
  });
  if (!(Number.isFinite(durationMs) && durationMs > 1)) return normalized;
  return normalized.map((mark, index, rows) => {
    if (index !== rows.length - 1 || mark.endMs !== durationMs) return mark;
    return {
      ...mark,
      endMs: Math.max(mark.startMs + 1, durationMs - 1)
    };
  });
}

function normalizeXdPhraseCueMarks(marks = [], sequenceSettings = {}) {
  const durationMs = Number(sequenceSettings?.durationMs);
  const effectiveDurationMs = Number.isFinite(durationMs) && durationMs > 0
    ? durationMs
    : Math.max(0, ...normArray(marks).map((row) => Number(row?.endMs) || 0));
  const normalized = normalizeTimingTrackCoverage(marks, {
    durationMs: effectiveDurationMs,
    fillerLabel: ""
  });
  if (!(Number.isFinite(durationMs) && durationMs > 1)) return normalized;
  return normalized.map((mark, index, rows) => {
    if (index !== rows.length - 1 || mark.endMs !== durationMs) return mark;
    return {
      ...mark,
      endMs: Math.max(mark.startMs + 1, durationMs - 1)
    };
  });
}

function buildCueTrackMarksByTrack({ analysisHandoff = {}, sectionNames = [], includeAll = false } = {}) {
  const musicDesignContext = buildMusicDesignContext({ analysisHandoff });
  const cueWindowsBySection = musicDesignContext?.designCues?.cueWindowsBySection;
  if (!cueWindowsBySection || typeof cueWindowsBySection !== "object") return new Map();
  const sectionWindowsByName = deriveSectionWindowsByName({ analysisHandoff, sectionNames, includeAll });
  const requestedSections = includeAll
    ? Array.from(sectionWindowsByName.keys())
    : normArray(sectionNames).map((row) => normText(row)).filter(Boolean);
  const out = new Map();
  const seen = new Set();
  for (const sectionName of requestedSections) {
    const sectionCues = cueWindowsBySection && typeof cueWindowsBySection === "object" ? cueWindowsBySection?.[sectionName] : null;
    if (!sectionCues || typeof sectionCues !== "object") continue;
    for (const cueRows of Object.values(sectionCues)) {
      for (const row of normArray(cueRows)) {
        const trackName = normText(row?.trackName);
        const label = normText(row?.label);
        const startMs = Number(row?.startMs);
        const endMs = Number(row?.endMs);
        if (!trackName || !label || !Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) continue;
        const key = `${trackName}::${label}::${startMs}::${endMs}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (!out.has(trackName)) out.set(trackName, []);
        out.get(trackName).push({ label, startMs, endMs });
      }
    }
  }
  return out;
}

const TIMING_NEED_RULES = [
  {
    trackName: "XD: Beat Grid",
    pattern: /\b(beat|beats|beat[-\s]?sync|beat[-\s]?synced|pulse|pulses|rhythm|rhythmic|downbeat|on[-\s]?beat)\b/i
  },
  {
    trackName: "XD: Bars",
    pattern: /\b(measure|measures)\b|\bbar(?:s)?[-\s]?(grid|track|timing|line|lines|cue|cues)\b|\b(on|to|with)\s+bars?\b/i
  },
  {
    trackName: "XD: Lyrics",
    pattern: /\b(lyric|lyrics|word|words|vocal|vocals|singer|singing|mouth|mouths|phoneme|phonemes)\b/i
  },
  {
    trackName: "XD: Phrase Cues",
    pattern: /\b(phrase|phrases|line|lines|melody|melodic|hook|hooks)\b/i
  },
  {
    trackName: "XD: Chord Changes",
    pattern: /\b(chord|chords|harmony|harmonic|key change|key changes)\b/i
  }
];

function collectCueTimingSignalText(value, out = []) {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    const text = normText(value);
    if (text) out.push(text);
    return out;
  }
  if (Array.isArray(value)) {
    for (const row of value) collectCueTimingSignalText(row, out);
    return out;
  }
  if (!value || typeof value !== "object") return out;
  for (const row of Object.values(value)) collectCueTimingSignalText(row, out);
  return out;
}

function inferRequestedCueTimingTracks({
  goal = "",
  sourceLines = [],
  executionStrategy = {},
  sequencingDesignHandoff = null
} = {}) {
  const text = [
    goal,
    ...normArray(sourceLines),
    normText(executionStrategy?.implementationMode),
    normText(executionStrategy?.routePreference),
    ...normArray(executionStrategy?.sectionPlans).flatMap((row) => [
      normText(row?.intentSummary),
      ...normArray(row?.effectHints)
    ]),
    ...collectCueTimingSignalText(executionStrategy?.translationIntent),
    ...collectCueTimingSignalText(sequencingDesignHandoff)
  ].join(" ");
  const requested = [];
  for (const rule of TIMING_NEED_RULES) {
    if (rule.pattern.test(text)) requested.push(rule.trackName);
  }
  return requested;
}

function buildRequestedCueTimingCommands({
  analysisHandoff = {},
  sectionNames = [],
  requestedTrackNames = [],
  sequenceSettings = {},
  allowTimingWrites = true,
  warnings = []
} = {}) {
  if (!allowTimingWrites) return [];
  const requested = new Set(normArray(requestedTrackNames).map((row) => normText(row)).filter(Boolean));
  if (!requested.size) return [];
  const cueTrackMarksByTrack = buildCueTrackMarksByTrack({
    analysisHandoff,
    sectionNames,
    includeAll: true
  });
  if (!(cueTrackMarksByTrack instanceof Map) || !cueTrackMarksByTrack.size) return [];
  const marksByTrack = buildPlacementMarksByTrack({
    effectPlacements: [],
    cueTrackMarksByTrack,
    sequenceSettings
  });
  const commands = [];
  for (const trackName of requested) {
    const marks = marksByTrack.get(trackName) || [];
    if (!marks.length) {
      warnings.push(`Timing track need detected for ${trackName}, but no analysis marks are available for that track.`);
      continue;
    }
    const safeTrackSlug = trackName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "track";
    const createId = `timing.track.create:${safeTrackSlug}`;
    commands.push({
      id: createId,
      cmd: "timing.createTrack",
      params: {
        trackName,
        replaceIfExists: true
      }
    });
    commands.push({
      id: `timing.marks.insert:${safeTrackSlug}`,
      dependsOn: [createId],
      cmd: "timing.insertMarks",
      params: {
        trackName,
        marks
      }
    });
  }
  return commands;
}

function stageScopeResolution({ analysisHandoff = {}, intentHandoff = {}, sequencingDesignHandoff = null, sourceLines = [] } = {}) {
  const mode = normText(intentHandoff?.mode) || "create";
  const resolvedSequencingDesignHandoff = deriveSequencingDesignHandoff(intentHandoff, sequencingDesignHandoff);
  const goal = normText(resolvedSequencingDesignHandoff?.goal || intentHandoff?.goal);
  const executionStrategy = deriveExecutionStrategy(intentHandoff);
  const sectionNames = normArray(resolvedSequencingDesignHandoff?.scope?.sections).length
    ? normArray(resolvedSequencingDesignHandoff.scope.sections).map((row) => normText(row)).filter(Boolean)
    : deriveSectionNames({ analysisHandoff, intentHandoff, executionStrategy });
  const targetIds = normArray(resolvedSequencingDesignHandoff?.scope?.targetIds).length
    ? normArray(resolvedSequencingDesignHandoff.scope.targetIds).map((row) => normText(row)).filter(Boolean)
    : normArray(intentHandoff?.scope?.targetIds);
  const tagNames = normArray(resolvedSequencingDesignHandoff?.scope?.tagNames).length
    ? normArray(resolvedSequencingDesignHandoff.scope.tagNames).map((row) => normText(row)).filter(Boolean)
    : normArray(intentHandoff?.scope?.tagNames);
  if (isCompoundScopedDirectRequest({ goal, sectionNames, sourceLines })) {
    const err = new Error("Compound direct sequencing requests must be split into one effect/section instruction per request.");
    err.failureCategory = "scope";
    throw err;
  }
  return {
    mode,
    goal,
    sectionNames,
    targetIds,
    tagNames,
    sequencingDesignHandoff: resolvedSequencingDesignHandoff,
    executionStrategy,
    detail: `sections=${sectionNames.length || 0} targets=${targetIds.length || 0} tags=${tagNames.length || 0} passScope=${executionStrategy.passScope || "default"} designHandoff=${resolvedSequencingDesignHandoff ? "v2" : "none"}`
  };
}

function stageTimingAssetDecision({ hasAnalysis = false, scope = {} } = {}) {
  const hasScopedSections = Array.isArray(scope.sectionNames) && scope.sectionNames.length > 0;
  const passScope = normText(scope?.executionStrategy?.passScope);
  const useFullSongStructureTrack = Boolean(scope?.executionStrategy?.shouldUseFullSongStructureTrack) || passScope === "whole_sequence" || passScope === "multi_section";
  const sectionPlans = normArray(scope?.executionStrategy?.sectionPlans);
  const requestedSectionTrackName = normText(
    scope?.executionStrategy?.sectionTimingTrackName
    || scope?.executionStrategy?.timingTrackName
    || sectionPlans.find((row) => normText(row?.sectionTimingTrackName || row?.timingTrackName))?.sectionTimingTrackName
    || sectionPlans.find((row) => normText(row?.sectionTimingTrackName || row?.timingTrackName))?.timingTrackName
    || ""
  );
  const sectionTrackName = requestedSectionTrackName || "XD: Song Structure";
  const strategy = hasAnalysis ? "analysis_tracks" : (hasScopedSections ? "scope_only" : "minimal_fallback");
  return {
    strategy,
    degradedMode: !hasAnalysis,
    useSections: hasScopedSections,
    trackName: (hasScopedSections || useFullSongStructureTrack) ? sectionTrackName : "XD: Sequencer Plan",
    includeAllKnownSections: useFullSongStructureTrack || hasScopedSections,
    detail: `strategy=${strategy}${!hasAnalysis ? " reduced-confidence" : ""} passScope=${passScope || "default"}`
  };
}

function isGenericExecutionLine(line = "") {
  const text = normText(line);
  if (!text) return false;
  return /^general\s*\//i.test(text);
}

function isExecutableSequencingLine(line = "") {
  const text = normText(line);
  if (!text) return false;
  if (!/^[^/]+\s*\/\s*[^/]+\s*\/.+/.test(text)) return false;
  const lower = text.toLowerCase();
  if (/\bapply\b.+\beffect\b/.test(lower)) return true;
  if (/\b(color wash|shimmer|bars|butterfly|on effect|apply on)\b/.test(lower)) return true;
  return false;
}

function buildAvailableEffectSet(effectCatalog = null) {
  if (!effectCatalog || typeof effectCatalog !== "object") return null;
  const byName = effectCatalog.byName && typeof effectCatalog.byName === "object" ? effectCatalog.byName : {};
  const names = Object.keys(byName).map((row) => normText(row)).filter(Boolean);
  return names.length ? new Set(names) : null;
}

function buildMetadataAssignmentIndex(metadataAssignments = []) {
  const out = new Map();
  for (const row of normArray(metadataAssignments)) {
    const targetId = normText(row?.targetId);
    if (!targetId) continue;
    out.set(targetId, row);
  }
  return out;
}

function sanitizeMetadataAssignmentsForPlanMetadata(metadataAssignments = []) {
  return normArray(metadataAssignments)
    .map((assignment) => {
      const targetId = normText(assignment?.targetId);
      if (!targetId) return null;
      return {
        targetId,
        tags: normArray(assignment?.tags).map((row) => normText(row)).filter(Boolean),
        semanticHints: normArray(assignment?.semanticHints).map((row) => normText(row)).filter(Boolean),
        effectAvoidances: normArray(assignment?.effectAvoidances).map((row) => normText(row)).filter(Boolean),
        rolePreference: normText(assignment?.rolePreference),
        visualHintDefinitions: normArray(assignment?.visualHintDefinitions)
          .map((definition) => {
            const name = normText(definition?.name);
            if (!name) return null;
            return {
              name,
              status: normText(definition?.status),
              semanticClass: normText(definition?.semanticClass),
              behavioralIntent: normText(definition?.behavioralIntent),
              behavioralTags: normArray(definition?.behavioralTags).map((row) => normText(row)).filter(Boolean)
            };
          })
          .filter(Boolean)
      };
    })
    .filter(Boolean);
}

function sanitizeRenderValidationEvidence(evidence = null) {
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) return null;
  return {
    renderObservationRef: normText(evidence?.renderObservationRef) || null,
    compositionObservationRef: normText(evidence?.compositionObservationRef) || null,
    layeringObservationRef: normText(evidence?.layeringObservationRef) || null,
    progressionObservationRef: normText(evidence?.progressionObservationRef) || null,
    sequenceCritiqueRef: normText(evidence?.sequenceCritiqueRef) || null,
    scopeLevel: normText(evidence?.scopeLevel) || null,
    sectionNames: normArray(evidence?.sectionNames).map((row) => normText(row)).filter(Boolean),
    targetIds: normArray(evidence?.targetIds).map((row) => normText(row)).filter(Boolean)
  };
}

function estimateJsonByteSize(value) {
  try {
    const json = JSON.stringify(value ?? null);
    if (typeof TextEncoder === "function") return new TextEncoder().encode(json).length;
    return json.length;
  } catch {
    return null;
  }
}

function buildPlanHandoffScaleTelemetry({ commands = [], metadata = {} } = {}) {
  const safeCommands = normArray(commands);
  const timingCommands = safeCommands.filter((command) => {
    const cmd = normText(command?.cmd);
    return cmd === "timing.insertMarks" || cmd === "timing.replaceMarks";
  });
  const timingMarkCount = timingCommands.reduce((sum, command) => (
    sum + normArray(command?.params?.marks).length
  ), 0);
  const effectCommandCount = safeCommands.filter((command) => normText(command?.cmd) === "effects.create").length;
  const metadataAssignments = normArray(metadata?.metadataAssignments);
  return {
    artifactType: "plan_handoff_scale_telemetry_v1",
    artifactVersion: "1.0",
    commandCount: safeCommands.length,
    commandBytes: estimateJsonByteSize(safeCommands),
    effectCommandCount,
    timingCommandCount: timingCommands.length,
    timingMarkCount,
    metadataBytes: estimateJsonByteSize(metadata),
    executionStrategyBytes: estimateJsonByteSize(metadata?.executionStrategy || null),
    sequencingDesignHandoffBytes: estimateJsonByteSize(metadata?.sequencingDesignHandoff || null),
    realizationCandidatesBytes: estimateJsonByteSize(metadata?.realizationCandidates || null),
    candidateSelectionBytes: estimateJsonByteSize(metadata?.candidateSelection || null),
    metadataAssignmentCount: metadataAssignments.length,
    metadataAssignmentsBytes: estimateJsonByteSize(metadataAssignments)
  };
}

function uniqueNormTexts(values = []) {
  return Array.from(new Set(normArray(values).map((row) => normText(row)).filter(Boolean)));
}

function buildPlanArtifactRefs(metadata = {}) {
  return {
    sequencingDesignHandoffRef: normText(metadata?.sequencingDesignHandoff?.artifactId),
    sequenceArtisticGoalRef: normText(metadata?.sequenceArtisticGoal?.artifactId),
    sequenceRevisionObjectiveRef: normText(metadata?.sequenceRevisionObjective?.artifactId),
    priorPassMemoryRef: normText(metadata?.priorPassMemory?.artifactId),
    sequencerRevisionBriefRef: normText(metadata?.sequencerRevisionBrief?.artifactId),
    revisionFeedbackRef: normText(metadata?.revisionFeedback?.artifactId),
    revisionDeltaRef: normText(metadata?.revisionDelta?.artifactId),
    revisionRetryPressureRef: normText(metadata?.revisionRetryPressure?.artifactId),
    intentEnvelopeRef: normText(metadata?.intentEnvelope?.artifactId),
    realizationCandidatesRef: normText(metadata?.realizationCandidates?.artifactId),
    candidateSelectionRef: normText(metadata?.candidateSelection?.artifactId),
    currentSequenceContextRef: normText(metadata?.currentSequenceContext?.artifactId)
  };
}

function buildCompactGenerativeSummary(metadata = {}) {
  const intentEnvelope = metadata?.intentEnvelope && typeof metadata.intentEnvelope === "object" ? metadata.intentEnvelope : {};
  const realizationCandidates = metadata?.realizationCandidates && typeof metadata.realizationCandidates === "object" ? metadata.realizationCandidates : {};
  const candidateSelection = metadata?.candidateSelection && typeof metadata.candidateSelection === "object" ? metadata.candidateSelection : {};
  const candidateChoice = metadata?.candidateChoice && typeof metadata.candidateChoice === "object" ? metadata.candidateChoice : {};
  const effectStrategy = metadata?.effectStrategy && typeof metadata.effectStrategy === "object" ? metadata.effectStrategy : {};
  const revisionDelta = metadata?.revisionDelta && typeof metadata.revisionDelta === "object" ? metadata.revisionDelta : {};
  const revisionRetryPressure = metadata?.revisionRetryPressure && typeof metadata.revisionRetryPressure === "object" ? metadata.revisionRetryPressure : {};
  const revisionFeedback = metadata?.revisionFeedback && typeof metadata.revisionFeedback === "object" ? metadata.revisionFeedback : {};
  const priorPassMemory = metadata?.priorPassMemory && typeof metadata.priorPassMemory === "object" ? metadata.priorPassMemory : {};
  const candidates = normArray(realizationCandidates?.candidates).filter((row) => row && typeof row === "object");
  const scoredCandidates = normArray(candidateSelection?.scoredCandidates).filter((row) => row && typeof row === "object");
  const selectedBandIds = uniqueNormTexts(candidateSelection?.selectedBand?.candidateIds).slice(0, 4);
  const chosenCandidateId = normText(candidateChoice?.chosenCandidateId || effectStrategy?.selectedCandidateId);
  const chosenCandidate = chosenCandidateId
    ? candidates.find((row) => normText(row?.candidateId) === chosenCandidateId)
    : null;
  const chosenSeedRecommendations = normArray(chosenCandidate?.seedRecommendations).filter((row) => row && typeof row === "object");
  const currentEffectNames = uniqueNormTexts(
    chosenSeedRecommendations.length
      ? chosenSeedRecommendations.map((row) => row?.effectName)
      : normArray(effectStrategy?.seedRecommendations).map((row) => row?.effectName)
  );
  const currentTargetIds = uniqueNormTexts(
    chosenSeedRecommendations.length
      ? chosenSeedRecommendations.flatMap((row) => normArray(row?.targetIds))
      : normArray(effectStrategy?.seedRecommendations).flatMap((row) => normArray(row?.targetIds))
  );
  const retryPressureSignals = uniqueNormTexts(
    revisionRetryPressure?.signals || metadata?.candidateSelectionContext?.retryPressureSignals || priorPassMemory?.retryPressureSignals
  ).slice(0, 5);
  return {
    artifactType: "plan_generative_summary_v1",
    artifactVersion: "1.0",
    refs: buildPlanArtifactRefs(metadata),
    intent: {
      attentionProfile: normText(intentEnvelope?.attention?.profile || "unconstrained"),
      temporalProfile: normText(intentEnvelope?.temporal?.profile || "unconstrained"),
      footprint: normText(intentEnvelope?.spatial?.footprint || "unconstrained"),
      texture: normText(intentEnvelope?.texture?.profile || "unconstrained")
    },
    candidates: {
      count: candidates.length,
      candidateIds: candidates.map((row) => normText(row?.candidateId)).filter(Boolean).slice(0, 4)
    },
    selection: {
      mode: normText(candidateChoice?.selectionMode || candidateSelection?.policy?.mode),
      phase: normText(candidateSelection?.policy?.phase || metadata?.candidateSelectionContext?.phase),
      primaryCandidateId: normText(candidateSelection?.primaryCandidateId),
      selectedBandIds,
      selectedBandSize: Number(candidateSelection?.selectedBand?.size || selectedBandIds.length || 0)
    },
    choice: {
      chosenCandidateId,
      chosenSummary: normText(effectStrategy?.selectedCandidateSummary || chosenCandidate?.summary),
      selectedFromBand: Boolean(candidateChoice?.selectedFromBand),
      unresolvedSignals: uniqueNormTexts(metadata?.candidateSelectionContext?.unresolvedSignals).slice(0, 5),
      retryPressureSignals
    },
    delta: {
      artifactType: normText(revisionDelta?.artifactType || "revision_delta_v1"),
      artifactId: normText(revisionDelta?.artifactId),
      currentEffectNames: uniqueNormTexts(revisionDelta?.current?.effectNames || currentEffectNames).slice(0, 5),
      currentTargetIds: uniqueNormTexts(revisionDelta?.current?.targetIds || currentTargetIds).slice(0, 5),
      previousEffectNames: uniqueNormTexts(revisionDelta?.previous?.effectNames || priorPassMemory?.previousEffectNames).slice(0, 5),
      previousTargetIds: uniqueNormTexts(revisionDelta?.previous?.targetIds || priorPassMemory?.previousTargetIds).slice(0, 5),
      introducedEffectNames: uniqueNormTexts(revisionDelta?.introduced?.effectNames).slice(0, 5),
      introducedTargetIds: uniqueNormTexts(revisionDelta?.introduced?.targetIds).slice(0, 5)
    },
    retry: {
      artifactType: normText(revisionRetryPressure?.artifactType || "revision_retry_pressure_v1"),
      artifactId: normText(revisionRetryPressure?.artifactId),
      signals: retryPressureSignals,
      oscillatingCandidateIds: uniqueNormTexts(
        revisionRetryPressure?.oscillation?.candidateIds || scoredCandidates
          .filter((row) => normText(row?.oscillationRisk) === "high")
          .map((row) => normText(row?.candidateId))
      ).slice(0, 4)
    },
    feedback: {
      artifactType: normText(revisionFeedback?.artifactType || "revision_feedback_v1"),
      artifactId: normText(revisionFeedback?.artifactId),
      status: normText(revisionFeedback?.status || "unknown"),
      rejectionReasons: uniqueNormTexts(revisionFeedback?.rejectionReasons).slice(0, 5),
      executionObjective: normText(revisionFeedback?.nextDirection?.executionObjective),
      artisticCorrection: normText(revisionFeedback?.nextDirection?.artisticCorrection)
    }
  };
}

function derivePassExecutionScope({ scope = {}, executionStrategy = {}, sectionCount = 0 } = {}) {
  const passScope = normText(executionStrategy?.passScope);
  if (passScope) return passScope;
  const mode = normText(scope?.mode);
  if (mode === "revise") return "revision_pass";
  if (sectionCount > 1) return "multi_section";
  if (sectionCount === 1) return "section_pass";
  return "whole_sequence";
}

function buildPassExecutionPolicy({
  scope = {},
  executionStrategy = {},
  commands = [],
  baseRevision = "",
  renderValidationEvidence = null,
  currentSequenceContext = null
} = {}) {
  const hasCurrentSequenceContext = Boolean(currentSequenceContext && typeof currentSequenceContext === "object");
  const effectCommandCount = normArray(commands).filter((command) => normText(command?.cmd) === "effects.create").length;
  const timingCommandCount = normArray(commands).filter((command) => {
    const cmd = normText(command?.cmd);
    return cmd === "timing.createTrack" || cmd === "timing.insertMarks" || cmd === "timing.replaceMarks";
  }).length;
  const sectionCount = normArray(scope?.sectionNames).length;
  const targetCount = normArray(scope?.targetIds).length;
  return {
    artifactType: "sequencing_pass_execution_policy_v1",
    artifactVersion: "1.0",
    iterationMode: "pass_based",
    passScope: derivePassExecutionScope({ scope, executionStrategy, sectionCount }),
    batchApply: {
      expected: true,
      commandCount: normArray(commands).length,
      effectCommandCount,
      timingCommandCount
    },
    renderPolicy: {
      preferred: "single_render_after_batch_apply",
      allowAdditionalRenderOnFailure: true
    },
    existingSequencePolicy: {
      baseRevision: normText(baseRevision) || "unknown",
      revisionGateRequired: true,
      inspectBeforePlanning: true,
      inspectionAvailable: hasCurrentSequenceContext,
      inspectedEffectCount: Number(currentSequenceContext?.summary?.effectCount || 0),
      inspectedTimingTrackCount: Number(currentSequenceContext?.summary?.timingTrackCount || 0),
      preserveExistingUnlessScoped: true
    },
    completionPolicy: {
      userAcceptanceRequired: true,
      stableWhen: [
        "apply_result_applied",
        "readback_validation_passes",
        "practical_validation_passes",
        "render_feedback_stable_or_user_accepts"
      ],
      autoIterateOnlyForClearFailures: true
    },
    requestedScope: {
      sectionCount,
      targetCount,
      tagCount: normArray(scope?.tagNames).length
    },
    priorEvidenceAvailable: Boolean(renderValidationEvidence && typeof renderValidationEvidence === "object")
  };
}

function currentSequenceEffectRows(currentSequenceContext = null) {
  const sample = currentSequenceContext?.effects?.sample;
  return normArray(sample)
    .map((row) => {
      const targetId = normText(row?.targetId || row?.modelName || row?.model);
      const layerIndex = Number(row?.layerIndex);
      const startMs = Number(row?.startMs);
      const endMs = Number(row?.endMs);
      if (!targetId || !Number.isFinite(layerIndex) || layerIndex < 0) return null;
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;
      return {
        targetId,
        layerIndex,
        effectName: normText(row?.effectName || row?.name),
        startMs,
        endMs,
        settings: row?.settings ?? "",
        palette: row?.palette ?? ""
      };
    })
    .filter(Boolean);
}

function submodelSuffixForParent(targetId = "", parentId = "") {
  const target = normText(targetId);
  const parent = normText(parentId);
  if (!target || !parent || !target.startsWith(`${parent}/`)) return "";
  return target.slice(parent.length);
}

function overlapsWindow(a = {}, b = {}) {
  const aStart = Number(a?.startMs);
  const aEnd = Number(a?.endMs);
  const bStart = Number(b?.startMs);
  const bEnd = Number(b?.endMs);
  if (!Number.isFinite(aStart) || !Number.isFinite(aEnd) || !Number.isFinite(bStart) || !Number.isFinite(bEnd)) return false;
  return Math.max(aStart, bStart) < Math.min(aEnd, bEnd);
}

function hasReplacementIntent({ sourceLines = [], executionStrategy = {}, scope = {} } = {}) {
  const passScope = normText(executionStrategy?.passScope).toLowerCase();
  const mode = normText(scope?.mode).toLowerCase();
  const joined = [
    ...normArray(sourceLines),
    normText(scope?.goal),
    normText(executionStrategy?.implementationMode)
  ].join(" ").toLowerCase();
  if (/\b(replace|overwrite|clear|remove|delete|wipe|redo|rebuild)\b/.test(joined)) return true;
  if (mode === "replace" || mode === "overwrite") return true;
  return passScope === "replacement_pass";
}

function hasExistingEffectEditIntent({ sourceLines = [], executionStrategy = {}, scope = {} } = {}) {
  const joined = [
    ...normArray(sourceLines),
    normText(scope?.goal),
    normText(executionStrategy?.implementationMode),
    normText(executionStrategy?.passScope)
  ].join(" ").toLowerCase();
  return /\b(change|update|modify|adjust|revise|tweak|replace|rework|edit)\b/.test(joined);
}

function hasExistingEffectDeleteIntent({ sourceLines = [], executionStrategy = {}, scope = {} } = {}) {
  const joined = [
    ...normArray(sourceLines),
    normText(scope?.goal),
    normText(executionStrategy?.implementationMode),
    normText(executionStrategy?.passScope)
  ].join(" ").toLowerCase();
  return /\b(delete|remove|clear|erase|drop|cut)\b/.test(joined);
}

function inferExistingLayerReorderIntent({ sourceLines = [], executionStrategy = {}, scope = {} } = {}) {
  const joined = [
    ...normArray(sourceLines),
    normText(scope?.goal),
    normText(executionStrategy?.implementationMode),
    normText(executionStrategy?.passScope)
  ].join(" ").toLowerCase();
  if (!/\b(layer|layers)\b/.test(joined)) return null;
  if (!/\b(move|reorder|place|put|send|shift)\b/.test(joined)) return null;
  const exact = joined.match(/\blayer\s*(\d+)\b[^.;&\n]{0,60}?\b(?:to|into|onto|at|as)\s*\blayer\s*(\d+)\b/);
  if (exact) {
    const fromLayer = Number(exact[1]);
    const toLayer = Number(exact[2]);
    if (Number.isInteger(fromLayer) && Number.isInteger(toLayer) && fromLayer >= 0 && toLayer >= 0 && fromLayer !== toLayer) {
      return { fromLayer, toLayer, relation: "to" };
    }
  }
  const relative = joined.match(/\blayer\s*(\d+)\b[^.;&\n]{0,60}?\b(above|before|below|after)\b[^.;&\n]{0,30}?\blayer\s*(\d+)\b/);
  if (relative) {
    const fromLayer = Number(relative[1]);
    const referenceLayer = Number(relative[3]);
    if (!Number.isInteger(fromLayer) || !Number.isInteger(referenceLayer) || fromLayer < 0 || referenceLayer < 0) return null;
    const relation = relative[2];
    const toLayer = relation === "above" || relation === "before" ? referenceLayer : referenceLayer + 1;
    if (fromLayer !== toLayer) return { fromLayer, toLayer, relation };
  }
  return null;
}

function inferExistingLayerDeleteIntent({ sourceLines = [], executionStrategy = {}, scope = {} } = {}) {
  const joined = [
    ...normArray(sourceLines),
    normText(scope?.goal),
    normText(executionStrategy?.implementationMode),
    normText(executionStrategy?.passScope)
  ].join(" ").toLowerCase();
  if (!/\b(layer|layers)\b/.test(joined)) return null;
  if (!/\b(delete|remove|clear|erase|drop|cut)\b/.test(joined)) return null;
  const match = joined.match(/\blayer\s*(\d+)\b/);
  if (!match) return null;
  const layerIndex = Number(match[1]);
  if (!Number.isInteger(layerIndex) || layerIndex < 0) return null;
  return { layerIndex, force: true };
}

function inferExistingLayerCompactIntent({ sourceLines = [], executionStrategy = {}, scope = {} } = {}) {
  const joined = [
    ...normArray(sourceLines),
    normText(scope?.goal),
    normText(executionStrategy?.implementationMode),
    normText(executionStrategy?.passScope)
  ].join(" ").toLowerCase();
  if (!/\b(layer|layers)\b/.test(joined)) return null;
  if (!/\b(compact|compress|collapse|close\s+gaps|remove\s+empty|delete\s+empty|clear\s+empty)\b/.test(joined)) return null;
  return { compact: true };
}

function inferExistingEffectTimeShiftIntent({ sourceLines = [], executionStrategy = {}, scope = {} } = {}) {
  const joined = [
    ...normArray(sourceLines),
    normText(scope?.goal),
    normText(executionStrategy?.implementationMode),
    normText(executionStrategy?.passScope)
  ].join(" ").toLowerCase();
  if (!/\b(effect|effects|look|layer|layers)\b/.test(joined)) return null;
  if (!/\b(shift|nudge|move|slide)\b/.test(joined)) return null;
  if (/\b(to|into|onto|above|below|before|after)\s+layer\s*\d+\b/.test(joined)) return null;
  const amount = joined.match(/\b(\d+(?:\.\d+)?)\s*(ms|millisecond|milliseconds|s|sec|secs|second|seconds)\b/);
  if (!amount) return null;
  const scalar = Number(amount[1]);
  if (!Number.isFinite(scalar) || scalar <= 0) return null;
  const unit = amount[2];
  const deltaBase = /^s|^sec|^second/.test(unit) ? Math.round(scalar * 1000) : Math.round(scalar);
  const direction =
    /\b(earlier|back|backward|backwards|left|sooner)\b/.test(joined) ? -1 :
    /\b(later|forward|forwards|right|after)\b/.test(joined) ? 1 :
    1;
  const layerMatch = joined.match(/\blayer\s*(\d+)\b/);
  const layerIndex = layerMatch ? Number(layerMatch[1]) : null;
  if (layerIndex !== null && (!Number.isInteger(layerIndex) || layerIndex < 0)) return null;
  return {
    deltaMs: direction * deltaBase,
    layerIndex
  };
}

function supportsCommand(capabilityCommands = [], commandName = "") {
  const advertised = normArray(capabilityCommands).map((row) => normText(row)).filter(Boolean);
  return !advertised.length || advertised.includes(commandName);
}

function normalizeDisplayElementRows(displayElements = []) {
  return normArray(displayElements)
    .map((row) => ({
      id: normText(row?.id || row?.name),
      type: normText(row?.type).toLowerCase()
    }))
    .filter((row) => row.id);
}

function escapeRegExpText(value = "") {
  return normText(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function inferExplicitDisplayOrderIntent({ sourceLines = [], scope = {}, executionStrategy = {}, displayElements = [] } = {}) {
  const rows = normalizeDisplayElementRows(displayElements);
  if (!rows.length) return null;
  const modelIds = rows.filter((row) => row.type !== "timing").map((row) => row.id);
  if (modelIds.length < 2) return null;
  const joined = [
    ...normArray(sourceLines),
    normText(scope?.goal),
    normText(executionStrategy?.implementationMode),
    normText(executionStrategy?.passScope)
  ].join(" ").toLowerCase();
  if (!/\b(display\s*order|model\s*order|render\s*order|vertical|above|below|before|after|move|reorder|place|put)\b/.test(joined)) {
    return null;
  }
  const lowerIds = modelIds.map((id) => ({ id, lower: id.toLowerCase() }));
  for (const target of lowerIds) {
    for (const reference of lowerIds) {
      if (target.id === reference.id) continue;
      const targetPattern = escapeRegExpText(target.lower);
      const referencePattern = escapeRegExpText(reference.lower);
      const targetFirst = new RegExp(`\\b(?:move|reorder|place|put|send)?\\s*${targetPattern}\\b[^.;&\\n]{0,80}?\\b(above|before|below|after)\\b[^.;&\\n]{0,40}?\\b${referencePattern}\\b`, "i");
      const direct = joined.match(targetFirst);
      if (direct) {
        const relation = normText(direct[1]).toLowerCase();
        return {
          targetId: target.id,
          referenceId: reference.id,
          placement: relation === "above" || relation === "before" ? "before" : "after",
          relation
        };
      }
    }
  }
  for (const target of lowerIds) {
    for (const reference of lowerIds) {
      if (target.id === reference.id) continue;
      const targetPattern = escapeRegExpText(target.lower);
      const referencePattern = escapeRegExpText(reference.lower);
      const referenceFirst = new RegExp(`\\b${referencePattern}\\b[^.;&\\n]{0,80}?\\b(?:should\\s+be\\s+)?(below|after|above|before)\\b[^.;&\\n]{0,40}?\\b${targetPattern}\\b`, "i");
      const reverse = joined.match(referenceFirst);
      if (reverse) {
        const relation = normText(reverse[1]).toLowerCase();
        return {
          targetId: target.id,
          referenceId: reference.id,
          placement: relation === "below" || relation === "after" ? "before" : "after",
          relation
        };
      }
    }
  }
  return null;
}

function buildExplicitDisplayOrderCommand({ displayElements = [], orderIntent = null } = {}) {
  const rows = normalizeDisplayElementRows(displayElements);
  if (!rows.length || !orderIntent) return null;
  const timingIds = rows.filter((row) => row.type === "timing").map((row) => row.id);
  const modelIds = rows.filter((row) => row.type !== "timing").map((row) => row.id);
  const targetId = normText(orderIntent.targetId);
  const referenceId = normText(orderIntent.referenceId);
  if (!targetId || !referenceId || targetId === referenceId) return null;
  if (!modelIds.includes(targetId) || !modelIds.includes(referenceId)) return null;
  const withoutTarget = modelIds.filter((id) => id !== targetId);
  const referenceIndex = withoutTarget.indexOf(referenceId);
  if (referenceIndex < 0) return null;
  const insertIndex = orderIntent.placement === "after" ? referenceIndex + 1 : referenceIndex;
  const reorderedModels = withoutTarget.slice(0, insertIndex)
    .concat(targetId, withoutTarget.slice(insertIndex));
  const orderedIds = timingIds.concat(reorderedModels);
  const currentIds = rows.map((row) => row.id);
  if (orderedIds.length === currentIds.length && orderedIds.every((id, idx) => id === currentIds[idx])) {
    return null;
  }
  return {
    id: "display.order.explicit",
    cmd: "sequencer.setDisplayElementOrder",
    params: {
      orderedIds
    },
    intent: {
      displayOrderPolicy: {
        explicitOrderRequest: true,
        targetId,
        referenceId,
        placement: orderIntent.placement,
        relation: normText(orderIntent.relation)
      }
    }
  };
}

function applyExplicitDisplayOrderPlanning({
  commands = [],
  sourceLines = [],
  executionStrategy = {},
  scope = {},
  displayElements = [],
  capabilityCommands = [],
  warnings = []
} = {}) {
  if (!supportsCommand(capabilityCommands, "sequencer.setDisplayElementOrder")) return commands;
  const orderIntent = inferExplicitDisplayOrderIntent({ sourceLines, executionStrategy, scope, displayElements });
  const command = buildExplicitDisplayOrderCommand({ displayElements, orderIntent });
  if (!command) return commands;
  warnings.push(`Applying explicit display order request: ${orderIntent.targetId} ${orderIntent.placement} ${orderIntent.referenceId}.`);
  return [command];
}

function chooseExistingEffectForEdit(overlaps = [], plannedLayerIndex = 0) {
  const sorted = normArray(overlaps)
    .slice()
    .sort((a, b) => {
      const aLayerDistance = Math.abs(Number(a?.layerIndex) - Number(plannedLayerIndex));
      const bLayerDistance = Math.abs(Number(b?.layerIndex) - Number(plannedLayerIndex));
      return aLayerDistance - bLayerDistance ||
        Number(a?.layerIndex) - Number(b?.layerIndex) ||
        Number(a?.startMs) - Number(b?.startMs) ||
        Number(a?.endMs) - Number(b?.endMs);
    });
  return sorted[0] || null;
}

function buildEffectUpdateCommandFromCreate({
  command = {},
  existingEffect = null,
  replacementAuthorized = false,
  overlaps = []
} = {}) {
  const params = command?.params && typeof command.params === "object" ? command.params : {};
  if (!existingEffect) return command;
  const nextLayerIndex = Number(params.layerIndex);
  const nextStartMs = Number(params.startMs);
  const nextEndMs = Number(params.endMs);
  const nextEffectName = normText(params.effectName);
  if (!Number.isFinite(nextLayerIndex) || !Number.isFinite(nextStartMs) || !Number.isFinite(nextEndMs) || !nextEffectName) {
    return command;
  }
  const selectorEffectName = normText(existingEffect.effectName);
  return {
    ...command,
    id: normText(command?.id) || "effect.update.existing",
    cmd: "effects.update",
    params: {
      modelName: normText(existingEffect.targetId || params.modelName),
      layerIndex: Number(existingEffect.layerIndex),
      startMs: Number(existingEffect.startMs),
      endMs: Number(existingEffect.endMs),
      ...(selectorEffectName ? { effectName: selectorEffectName } : {}),
      newLayerIndex: nextLayerIndex,
      newStartMs: nextStartMs,
      newEndMs: nextEndMs,
      newEffectName: nextEffectName,
      settings: params.settings ?? "",
      palette: params.palette ?? ""
    },
    intent: {
      ...(command.intent && typeof command.intent === "object" ? command.intent : {}),
      existingSequencePolicy: {
        replacementAuthorized,
        preserveExistingUnlessScoped: true,
        emittedEditCommand: true,
        overlapCount: overlaps.length,
        originalLayerIndex: Number(existingEffect.layerIndex),
        plannedLayerIndex: nextLayerIndex,
        overlappingEffectNames: Array.from(new Set(overlaps.map((effect) => effect.effectName).filter(Boolean))).slice(0, 5)
      }
    }
  };
}

function buildEffectDeleteCommandFromCreate({
  command = {},
  existingEffect = null,
  overlaps = []
} = {}) {
  if (!existingEffect) return command;
  const selectorEffectName = normText(existingEffect.effectName);
  return {
    ...command,
    id: normText(command?.id) || "effect.delete.existing",
    cmd: "effects.delete",
    params: {
      modelName: normText(existingEffect.targetId),
      layerIndex: Number(existingEffect.layerIndex),
      startMs: Number(existingEffect.startMs),
      endMs: Number(existingEffect.endMs),
      ...(selectorEffectName ? { effectName: selectorEffectName } : {})
    },
    intent: {
      ...(command.intent && typeof command.intent === "object" ? command.intent : {}),
      existingSequencePolicy: {
        replacementAuthorized: true,
        preserveExistingUnlessScoped: false,
        emittedDeleteCommand: true,
        overlapCount: overlaps.length,
        originalLayerIndex: Number(existingEffect.layerIndex),
        plannedLayerIndex: Number(existingEffect.layerIndex),
        overlappingEffectNames: Array.from(new Set(overlaps.map((effect) => effect.effectName).filter(Boolean))).slice(0, 5)
      }
    }
  };
}

function buildEffectReorderLayerCommandFromCreate({
  command = {},
  modelName = "",
  layerReorder = null,
  overlaps = []
} = {}) {
  const fromLayer = Number(layerReorder?.fromLayer);
  const toLayer = Number(layerReorder?.toLayer);
  if (!normText(modelName) || !Number.isInteger(fromLayer) || !Number.isInteger(toLayer) || fromLayer < 0 || toLayer < 0 || fromLayer === toLayer) {
    return command;
  }
  return {
    ...command,
    id: normText(command?.id) || `effects.reorderLayer:${normText(modelName)}:${fromLayer}:${toLayer}`,
    cmd: "effects.reorderLayer",
    params: {
      modelName: normText(modelName),
      fromLayerIndex: fromLayer,
      toLayerIndex: toLayer
    },
    intent: {
      ...(command.intent && typeof command.intent === "object" ? command.intent : {}),
      existingSequencePolicy: {
        replacementAuthorized: true,
        preserveExistingUnlessScoped: false,
        emittedLayerReorderCommand: true,
        relation: normText(layerReorder?.relation),
        overlapCount: overlaps.length,
        originalLayerIndex: fromLayer,
        plannedLayerIndex: toLayer,
        movedEffects: overlaps
          .filter((effect) => Number(effect.layerIndex) === fromLayer)
          .map((effect) => ({
            effectName: normText(effect.effectName),
            startMs: Number(effect.startMs),
            endMs: Number(effect.endMs)
          }))
          .filter((effect) => effect.effectName && Number.isFinite(effect.startMs) && Number.isFinite(effect.endMs) && effect.endMs > effect.startMs)
          .slice(0, 5),
        movedEffectNames: Array.from(new Set(overlaps
          .filter((effect) => Number(effect.layerIndex) === fromLayer)
          .map((effect) => effect.effectName)
          .filter(Boolean))).slice(0, 5),
        overlappingEffectNames: Array.from(new Set(overlaps.map((effect) => effect.effectName).filter(Boolean))).slice(0, 5)
      }
    }
  };
}

function buildEffectDeleteLayerCommandFromCreate({
  command = {},
  modelName = "",
  layerDelete = null,
  layerEffects = []
} = {}) {
  const layerIndex = Number(layerDelete?.layerIndex);
  if (!normText(modelName) || !Number.isInteger(layerIndex) || layerIndex < 0) return command;
  const deletedEffects = normArray(layerEffects)
    .filter((effect) => Number(effect.layerIndex) === layerIndex)
    .map((effect) => ({
      effectName: normText(effect.effectName),
      startMs: Number(effect.startMs),
      endMs: Number(effect.endMs)
    }))
    .filter((effect) => effect.effectName && Number.isFinite(effect.startMs) && Number.isFinite(effect.endMs) && effect.endMs > effect.startMs)
    .slice(0, 25);
  return {
    ...command,
    id: normText(command?.id) || `effects.deleteLayer:${normText(modelName)}:${layerIndex}`,
    cmd: "effects.deleteLayer",
    params: {
      modelName: normText(modelName),
      layerIndex,
      force: layerDelete?.force !== false
    },
    intent: {
      ...(command.intent && typeof command.intent === "object" ? command.intent : {}),
      existingSequencePolicy: {
        replacementAuthorized: true,
        preserveExistingUnlessScoped: false,
        emittedLayerDeleteCommand: true,
        originalLayerIndex: layerIndex,
        plannedLayerIndex: layerIndex,
        overlapCount: deletedEffects.length,
        deletedEffects,
        deletedEffectNames: Array.from(new Set(deletedEffects.map((effect) => effect.effectName).filter(Boolean))).slice(0, 10)
      }
    }
  };
}

function buildEffectCompactLayersCommandFromCreate({
  command = {},
  modelName = "",
  layerEffects = []
} = {}) {
  if (!normText(modelName)) return command;
  const rows = normArray(layerEffects).filter((effect) => effect.targetId === modelName);
  const occupied = Array.from(new Set(rows
    .map((effect) => Number(effect.layerIndex))
    .filter((layerIndex) => Number.isInteger(layerIndex) && layerIndex >= 0)))
    .sort((a, b) => a - b);
  const layerMap = new Map(occupied.map((layerIndex, index) => [layerIndex, index]));
  const compactedEffects = rows
    .map((effect) => {
      const fromLayer = Number(effect.layerIndex);
      const toLayer = layerMap.has(fromLayer) ? layerMap.get(fromLayer) : fromLayer;
      return {
        effectName: normText(effect.effectName),
        startMs: Number(effect.startMs),
        endMs: Number(effect.endMs),
        fromLayerIndex: fromLayer,
        toLayerIndex: toLayer
      };
    })
    .filter((effect) =>
      effect.effectName &&
      Number.isFinite(effect.startMs) &&
      Number.isFinite(effect.endMs) &&
      effect.endMs > effect.startMs &&
      Number.isInteger(effect.fromLayerIndex) &&
      Number.isInteger(effect.toLayerIndex) &&
      effect.fromLayerIndex !== effect.toLayerIndex)
    .slice(0, 25);
  return {
    ...command,
    id: normText(command?.id) || `effects.compactLayers:${normText(modelName)}`,
    cmd: "effects.compactLayers",
    params: {
      modelName: normText(modelName)
    },
    intent: {
      ...(command.intent && typeof command.intent === "object" ? command.intent : {}),
      existingSequencePolicy: {
        replacementAuthorized: true,
        preserveExistingUnlessScoped: false,
        emittedLayerCompactCommand: true,
        overlapCount: compactedEffects.length,
        occupiedLayerIndexes: occupied,
        compactedEffects,
        compactedEffectNames: Array.from(new Set(compactedEffects.map((effect) => effect.effectName).filter(Boolean))).slice(0, 10)
      }
    }
  };
}

function buildEffectTimeShiftUpdateCommandFromCreate({
  command = {},
  existingEffect = null,
  timeShift = null,
  overlaps = []
} = {}) {
  if (!existingEffect) return command;
  const deltaMs = Number(timeShift?.deltaMs);
  if (!Number.isFinite(deltaMs) || deltaMs === 0) return command;
  const originalStartMs = Number(existingEffect.startMs);
  const originalEndMs = Number(existingEffect.endMs);
  if (!Number.isFinite(originalStartMs) || !Number.isFinite(originalEndMs) || originalEndMs <= originalStartMs) {
    return command;
  }
  const durationMs = originalEndMs - originalStartMs;
  const nextStartMs = Math.max(0, Math.round(originalStartMs + deltaMs));
  const nextEndMs = Math.max(nextStartMs + 1, Math.round(nextStartMs + durationMs));
  const selectorEffectName = normText(existingEffect.effectName);
  return {
    ...command,
    id: normText(command?.id) || "effect.shift-time.existing",
    cmd: "effects.update",
    params: {
      modelName: normText(existingEffect.targetId),
      layerIndex: Number(existingEffect.layerIndex),
      startMs: originalStartMs,
      endMs: originalEndMs,
      ...(selectorEffectName ? { effectName: selectorEffectName } : {}),
      newLayerIndex: Number(existingEffect.layerIndex),
      newStartMs: nextStartMs,
      newEndMs: nextEndMs,
      newEffectName: selectorEffectName
    },
    intent: {
      ...(command.intent && typeof command.intent === "object" ? command.intent : {}),
      existingSequencePolicy: {
        replacementAuthorized: true,
        preserveExistingUnlessScoped: false,
        emittedTimeShiftCommand: true,
        deltaMs,
        overlapCount: overlaps.length,
        originalLayerIndex: Number(existingEffect.layerIndex),
        plannedLayerIndex: Number(existingEffect.layerIndex),
        originalStartMs,
        originalEndMs,
        plannedStartMs: nextStartMs,
        plannedEndMs: nextEndMs,
        overlappingEffectNames: Array.from(new Set(overlaps.map((effect) => effect.effectName).filter(Boolean))).slice(0, 5)
      }
    }
  };
}

function inferExplicitCloneIntent({
  sourceLines = [],
  executionStrategy = {},
  scope = {},
  currentSequenceContext = null,
  targetIds = [],
  displayElements = []
} = {}) {
  const joined = [
    ...normArray(sourceLines),
    normText(scope?.goal),
    normText(executionStrategy?.implementationMode),
    normText(executionStrategy?.passScope)
  ].join(" ").toLowerCase();
  const isMoveRequest = /\b(cut|move\s+effects?|move\s+existing\s+effects?)\b/.test(joined);
  const isCopyRequest = /\b(copy|paste|clone|duplicate)\b/.test(joined);
  if (!isCopyRequest && !isMoveRequest) return null;
  const includeSubmodels = /\b(?:incl(?:ude|udes|uding)?|with)\s+sub\s*models?\b/.test(joined);
  const existingEffects = currentSequenceEffectRows(currentSequenceContext);
  const knownIds = Array.from(new Set([
    ...existingEffects.map((row) => row.targetId),
    ...normArray(targetIds).map((row) => normText(row)),
    ...normalizeDisplayElementRows(displayElements).map((row) => row.id)
  ].filter(Boolean))).sort((a, b) => b.length - a.length || a.localeCompare(b));
  if (!knownIds.length) return null;
  const lowerIds = knownIds.map((id) => ({ id, lower: id.toLowerCase() }));
  let sourceModelName = "";
  let targetModelName = "";
  if (knownIds.length >= 2) {
    for (const source of lowerIds) {
      for (const target of lowerIds) {
        if (source.id === target.id) continue;
        const sourcePattern = escapeRegExpText(source.lower);
        const targetPattern = escapeRegExpText(target.lower);
        const sourceToTarget = new RegExp(`\\b(?:copy|clone|duplicate|cut|move(?:\\s+effects?)?)\\b[^.;&\\n]{0,40}?\\b${sourcePattern}\\b[^.;&\\n]{0,120}?\\b(?:to|onto|into|on)\\b[^.;&\\n]{0,40}?\\b${targetPattern}\\b`, "i");
        const pasteToTarget = new RegExp(`\\b(?:paste)\\b[^.;&\\n]{0,40}?\\b${sourcePattern}\\b[^.;&\\n]{0,120}?\\b(?:to|onto|into|on)\\b[^.;&\\n]{0,40}?\\b${targetPattern}\\b`, "i");
        if (sourceToTarget.test(joined) || pasteToTarget.test(joined)) {
          sourceModelName = source.id;
          targetModelName = target.id;
          break;
        }
      }
      if (sourceModelName && targetModelName) break;
    }
  }
  if (!sourceModelName || !targetModelName) {
    for (const source of lowerIds) {
      const sourceIndex = joined.indexOf(source.lower);
      if (sourceIndex < 0) continue;
      const beforeSource = joined.slice(Math.max(0, sourceIndex - 80), sourceIndex);
      if (!/\b(copy|paste|clone|duplicate|cut|move(?:\s+effects?)?)\b/.test(beforeSource)) continue;
      for (const target of lowerIds) {
        if (source.id === target.id) continue;
        const targetIndex = joined.indexOf(target.lower, sourceIndex + source.lower.length);
        if (targetIndex < 0) continue;
        const between = joined.slice(sourceIndex + source.lower.length, targetIndex);
        if (!/\b(to|onto|into|on)\b/.test(between)) continue;
        sourceModelName = source.id;
        targetModelName = target.id;
        break;
      }
      if (sourceModelName && targetModelName) break;
    }
  }
  const sameModelLayerCopy = joined.match(/\blayer\s*(\d+)\b[^.;&\n]{0,80}?\b(?:to|onto|into|on)\s*\blayer\s*(\d+)\b/);
  if ((!sourceModelName || !targetModelName) && sameModelLayerCopy) {
    const mentionedModel = lowerIds.find((row) => new RegExp(`\\b${escapeRegExpText(row.lower)}\\b`, "i").test(joined));
    if (mentionedModel) {
      sourceModelName = mentionedModel.id;
      targetModelName = mentionedModel.id;
    }
  }
  if (sourceModelName && !existingEffects.some((effect) => effect.targetId === sourceModelName)) {
    sourceModelName = "";
    targetModelName = "";
    const sourceCandidates = lowerIds.filter((candidate) => existingEffects.some((effect) => effect.targetId === candidate.id));
    for (const source of sourceCandidates) {
      const sourceIndex = joined.indexOf(source.lower);
      if (sourceIndex < 0) continue;
      const beforeSource = joined.slice(Math.max(0, sourceIndex - 80), sourceIndex);
      if (!/\b(copy|paste|clone|duplicate|cut|move(?:\s+effects?)?)\b/.test(beforeSource)) continue;
      for (const target of lowerIds) {
        if (source.id === target.id) continue;
        const targetIndex = joined.indexOf(target.lower, sourceIndex + source.lower.length);
        if (targetIndex < 0) continue;
        const between = joined.slice(sourceIndex + source.lower.length, targetIndex);
        if (!/\b(to|onto|into|on)\b/.test(between)) continue;
        sourceModelName = source.id;
        targetModelName = target.id;
        break;
      }
      if (sourceModelName && targetModelName) break;
    }
  }
  if (!sourceModelName || !targetModelName) return null;
  const sourceLayerMatch = sameModelLayerCopy || joined.match(/\b(?:source\s+)?layer\s*(\d+)\b/);
  const targetLayerMatch =
    sameModelLayerCopy ||
    joined.match(/\b(?:to|onto|into|on)\b[^.;&\n]{0,80}?\blayer\s*(\d+)\b/) ||
    joined.match(/\btarget\s+layer\s*(\d+)\b/);
  const sourceLayerIndex = sourceLayerMatch ? Number(sourceLayerMatch[1]) : null;
  const targetLayerIndex = targetLayerMatch ? Number(sameModelLayerCopy ? targetLayerMatch[2] : targetLayerMatch[1]) : null;
  if (sourceLayerIndex !== null && (!Number.isInteger(sourceLayerIndex) || sourceLayerIndex < 0)) return null;
  if (targetLayerIndex !== null && (!Number.isInteger(targetLayerIndex) || targetLayerIndex < 0)) return null;
  const targetStartMatch = joined.match(/\b(?:at|starting\s+at|start\s+at)\s*(\d+(?:\.\d+)?)\s*(ms|millisecond|milliseconds|s|sec|secs|second|seconds)\b/);
  const targetStartMs = targetStartMatch
    ? (/^s|^sec|^second/.test(targetStartMatch[2]) ? Math.round(Number(targetStartMatch[1]) * 1000) : Math.round(Number(targetStartMatch[1])))
    : null;
  return {
    mode: isMoveRequest ? "move" : "copy",
    sourceModelName,
    targetModelName,
    includeSubmodels,
    knownIds,
    sourceLayerIndex,
    targetLayerIndex,
    targetStartMs: Number.isFinite(targetStartMs) ? targetStartMs : null
  };
}

function cloneTargetIdForEffect(effectTargetId = "", cloneIntent = null) {
  const sourceModelName = normText(cloneIntent?.sourceModelName);
  const targetModelName = normText(cloneIntent?.targetModelName);
  const effectTarget = normText(effectTargetId);
  if (!sourceModelName || !targetModelName || !effectTarget) return "";
  if (effectTarget === sourceModelName) return targetModelName;
  if (cloneIntent?.includeSubmodels !== true) return "";
  const suffix = submodelSuffixForParent(effectTarget, sourceModelName);
  if (!suffix) return "";
  const mappedTarget = `${targetModelName}${suffix}`;
  const knownIds = Array.isArray(cloneIntent?.knownIds) ? cloneIntent.knownIds : [];
  return knownIds.includes(mappedTarget) ? mappedTarget : "";
}

function buildExplicitCloneCommands({
  commands = [],
  currentSequenceContext = null,
  cloneIntent = null,
  warnings = []
} = {}) {
  if (!cloneIntent) return commands;
  const existingEffects = currentSequenceEffectRows(currentSequenceContext);
  const sourceEffects = existingEffects
    .map((effect) => ({
      ...effect,
      cloneTargetId: cloneTargetIdForEffect(effect.targetId, cloneIntent)
    }))
    .filter((effect) => effect.cloneTargetId)
    .filter((effect) => cloneIntent.sourceLayerIndex === null || Number(effect.layerIndex) === cloneIntent.sourceLayerIndex)
    .filter((effect) => normText(effect.effectName))
    .sort((a, b) => Number(a.layerIndex) - Number(b.layerIndex) || Number(a.startMs) - Number(b.startMs) || Number(a.endMs) - Number(b.endMs));
  if (!sourceEffects.length) return commands;
  const firstEffectCreate = normArray(commands).find((command) => normText(command?.cmd) === "effects.create");
  const dependsOn = Array.isArray(firstEffectCreate?.dependsOn) ? firstEffectCreate.dependsOn.slice() : [];
  const minSourceStartMs = Math.min(...sourceEffects.map((effect) => Number(effect.startMs)));
  const targetStartMs = cloneIntent.targetStartMs !== null && Number.isFinite(Number(cloneIntent.targetStartMs))
    ? Number(cloneIntent.targetStartMs)
    : minSourceStartMs;
  const deltaMs = targetStartMs - minSourceStartMs;
  const clonedEffectCommands = sourceEffects.map((effect, index) => {
    const targetLayerIndex = Number.isInteger(cloneIntent.targetLayerIndex)
      ? cloneIntent.targetLayerIndex + (Number(effect.layerIndex) - (Number.isInteger(cloneIntent.sourceLayerIndex) ? cloneIntent.sourceLayerIndex : Number(effect.layerIndex)))
      : Number(effect.layerIndex);
    const startMs = Math.max(0, Math.round(Number(effect.startMs) + deltaMs));
    const endMs = Math.max(startMs + 1, Math.round(Number(effect.endMs) + deltaMs));
    return {
      id: `effect.clone.${index + 1}`,
      dependsOn,
      anchor: {
        kind: "source_effect",
        sourceModelName: effect.targetId,
        sourceLayerIndex: Number(effect.layerIndex),
        sourceStartMs: Number(effect.startMs),
        sourceEndMs: Number(effect.endMs),
        boundarySide: "start",
        basis: "explicit_clone"
      },
      cmd: "effects.create",
      params: {
        modelName: effect.cloneTargetId,
        layerIndex: targetLayerIndex,
        effectName: normText(effect.effectName),
        startMs,
        endMs,
        settings: effect.settings ?? "",
        palette: effect.palette ?? ""
      },
      intent: {
        clonePolicy: {
          explicitCloneRequest: true,
          mode: cloneIntent.mode === "move" ? "move" : "copy",
          sourceModelName: effect.targetId,
          sourceLayerIndex: Number(effect.layerIndex),
          sourceStartMs: Number(effect.startMs),
          sourceEndMs: Number(effect.endMs),
          targetModelName: effect.cloneTargetId,
          targetLayerIndex,
          targetStartMs: startMs,
          targetEndMs: endMs,
          deltaMs
        },
        existingSequencePolicy: {
          replacementAuthorized: true,
          preserveExistingUnlessScoped: false,
          emittedCloneCreateCommand: true,
          originalLayerIndex: Number(effect.layerIndex),
          plannedLayerIndex: targetLayerIndex,
          overlapCount: 0
        }
      }
    };
  });
  const deleteSourceCommands = cloneIntent.mode === "move"
    ? sourceEffects.map((effect, index) => ({
        id: `effect.move.delete-source.${index + 1}`,
        dependsOn: [`effect.clone.${index + 1}`],
        cmd: "effects.delete",
        params: {
          modelName: effect.targetId,
          layerIndex: Number(effect.layerIndex),
          startMs: Number(effect.startMs),
          endMs: Number(effect.endMs),
          ...(normText(effect.effectName) ? { effectName: normText(effect.effectName) } : {})
        },
        intent: {
          movePolicy: {
            explicitMoveRequest: true,
            sourceModelName: effect.targetId,
            sourceLayerIndex: Number(effect.layerIndex),
            sourceStartMs: Number(effect.startMs),
            sourceEndMs: Number(effect.endMs),
            targetModelName: effect.cloneTargetId,
            targetLayerIndex: Number.isInteger(cloneIntent.targetLayerIndex)
              ? cloneIntent.targetLayerIndex + (Number(effect.layerIndex) - (Number.isInteger(cloneIntent.sourceLayerIndex) ? cloneIntent.sourceLayerIndex : Number(effect.layerIndex)))
              : Number(effect.layerIndex)
          },
          existingSequencePolicy: {
            replacementAuthorized: true,
            preserveExistingUnlessScoped: false,
            emittedMoveDeleteCommand: true,
            originalLayerIndex: Number(effect.layerIndex),
            plannedLayerIndex: Number(effect.layerIndex),
            overlapCount: 1,
            overlappingEffectNames: [normText(effect.effectName)].filter(Boolean)
          }
        }
      }))
    : [];
  const nonEffectCommands = normArray(commands).filter((command) => normText(command?.cmd) !== "effects.create" && normText(command?.cmd) !== "effects.alignToTiming");
  warnings.push(`${cloneIntent.mode === "move" ? "Moving" : "Cloning"} ${sourceEffects.length} effect${sourceEffects.length === 1 ? "" : "s"} from ${cloneIntent.sourceModelName}${cloneIntent.includeSubmodels ? " including submodels" : ""}${Number.isInteger(cloneIntent.sourceLayerIndex) ? ` layer ${cloneIntent.sourceLayerIndex}` : ""} to ${cloneIntent.targetModelName}${Number.isInteger(cloneIntent.targetLayerIndex) ? ` layer ${cloneIntent.targetLayerIndex}` : ""}.`);
  return nonEffectCommands.concat(clonedEffectCommands, deleteSourceCommands);
}

function applyExplicitClonePlanning({
  commands = [],
  currentSequenceContext = null,
  sourceLines = [],
  executionStrategy = {},
  scope = {},
  targetIds = [],
  displayElements = [],
  capabilityCommands = [],
  warnings = []
} = {}) {
  if (!supportsCommand(capabilityCommands, "effects.create")) return { commands, cloned: false };
  const cloneIntent = inferExplicitCloneIntent({
    sourceLines,
    executionStrategy,
    scope,
    currentSequenceContext,
    targetIds,
    displayElements
  });
  if (!cloneIntent) return { commands, cloned: false };
  if (cloneIntent.mode === "move" && !supportsCommand(capabilityCommands, "effects.delete")) return { commands, cloned: false };
  const clonedCommands = buildExplicitCloneCommands({
    commands,
    currentSequenceContext,
    cloneIntent,
    warnings
  });
  return {
    commands: clonedCommands,
    cloned: clonedCommands !== commands
  };
}

function applyExistingSequencePreservation({
  commands = [],
  currentSequenceContext = null,
  sourceLines = [],
  executionStrategy = {},
  scope = {},
  capabilityCommands = [],
  warnings = []
} = {}) {
  const existingEffects = currentSequenceEffectRows(currentSequenceContext);
  const replacementAuthorized = hasReplacementIntent({ sourceLines, executionStrategy, scope });
  const existingEditRequested = hasExistingEffectEditIntent({ sourceLines, executionStrategy, scope });
  const existingDeleteRequested = hasExistingEffectDeleteIntent({ sourceLines, executionStrategy, scope });
  const layerDeleteRequested = inferExistingLayerDeleteIntent({ sourceLines, executionStrategy, scope });
  const layerReorderRequested = inferExistingLayerReorderIntent({ sourceLines, executionStrategy, scope });
  const layerCompactRequested = inferExistingLayerCompactIntent({ sourceLines, executionStrategy, scope });
  const timeShiftRequested = inferExistingEffectTimeShiftIntent({ sourceLines, executionStrategy, scope });
  const editExistingAuthorized = existingEditRequested &&
    supportsCommand(capabilityCommands, "effects.update");
  const deleteExistingAuthorized = existingDeleteRequested &&
    supportsCommand(capabilityCommands, "effects.delete");
  const layerDeleteAuthorized = layerDeleteRequested &&
    supportsCommand(capabilityCommands, "effects.deleteLayer");
  const layerReorderAuthorized = layerReorderRequested &&
    supportsCommand(capabilityCommands, "effects.reorderLayer");
  const layerCompactAuthorized = layerCompactRequested &&
    supportsCommand(capabilityCommands, "effects.compactLayers");
  const timeShiftAuthorized = timeShiftRequested &&
    supportsCommand(capabilityCommands, "effects.update");
  if (!existingEffects.length) return commands;
  const emittedLayerOperations = new Set();
  const preservedCommands = normArray(commands).map((command) => {
    if (normText(command?.cmd) !== "effects.create") return command;
    const params = command?.params && typeof command.params === "object" ? command.params : {};
    const modelName = normText(params.modelName);
    const startMs = Number(params.startMs);
    const endMs = Number(params.endMs);
    const layerIndex = Number(params.layerIndex);
    if (!modelName || !Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs || !Number.isFinite(layerIndex)) {
      return command;
    }
    const overlaps = existingEffects.filter((effect) => effect.targetId === modelName && overlapsWindow(effect, { startMs, endMs }));
    if (layerDeleteAuthorized) {
      const layerIndexToDelete = Number(layerDeleteRequested.layerIndex);
      const modelLayerEffects = existingEffects.filter((effect) => effect.targetId === modelName && Number(effect.layerIndex) === layerIndexToDelete);
      const key = `deleteLayer:${modelName}:${layerIndexToDelete}`;
      if (modelLayerEffects.length && emittedLayerOperations.has(key)) return null;
      if (modelLayerEffects.length) {
        emittedLayerOperations.add(key);
        warnings.push(`Deleting existing layer on ${modelName}; converted ${normText(params.effectName) || "planned effect"} create into effects.deleteLayer for layer ${layerIndexToDelete}.`);
        return buildEffectDeleteLayerCommandFromCreate({
          command,
          modelName,
          layerDelete: layerDeleteRequested,
          layerEffects: modelLayerEffects
        });
      }
    }
    if (layerReorderAuthorized) {
      const fromLayer = Number(layerReorderRequested.fromLayer);
      const modelLayerEffects = existingEffects.filter((effect) => effect.targetId === modelName);
      const modelHasSourceLayer = modelLayerEffects.some((effect) => Number(effect.layerIndex) === fromLayer);
      const key = `reorderLayer:${modelName}:${fromLayer}:${layerReorderRequested.toLayer}`;
      if (modelHasSourceLayer && emittedLayerOperations.has(key)) return null;
      if (modelHasSourceLayer) {
        emittedLayerOperations.add(key);
        warnings.push(`Reordering existing layers on ${modelName}; converted ${normText(params.effectName) || "planned effect"} create into effects.reorderLayer from layer ${fromLayer} to layer ${layerReorderRequested.toLayer}.`);
        return buildEffectReorderLayerCommandFromCreate({
          command,
          modelName,
          layerReorder: layerReorderRequested,
          overlaps: modelLayerEffects
        });
      }
    }
    if (layerCompactAuthorized) {
      const modelLayerEffects = existingEffects.filter((effect) => effect.targetId === modelName);
      const key = `compactLayers:${modelName}`;
      if (modelLayerEffects.length && emittedLayerOperations.has(key)) return null;
      if (modelLayerEffects.length) {
        emittedLayerOperations.add(key);
        warnings.push(`Compacting existing layers on ${modelName}; converted ${normText(params.effectName) || "planned effect"} create into effects.compactLayers.`);
        return buildEffectCompactLayersCommandFromCreate({
          command,
          modelName,
          layerEffects: modelLayerEffects
        });
      }
    }
    if (timeShiftAuthorized) {
      const modelEffects = existingEffects.filter((effect) => effect.targetId === modelName);
      const scopedEffects = Number.isInteger(timeShiftRequested.layerIndex)
        ? modelEffects.filter((effect) => Number(effect.layerIndex) === timeShiftRequested.layerIndex)
        : modelEffects;
      const sourceEffects = scopedEffects.length ? scopedEffects : overlaps;
      const existingEffect = chooseExistingEffectForEdit(sourceEffects, layerIndex);
      if (existingEffect) {
        warnings.push(`Shifting existing effect on ${modelName}; converted ${normText(params.effectName) || "planned effect"} create into effects.update with ${timeShiftRequested.deltaMs}ms offset.`);
        return buildEffectTimeShiftUpdateCommandFromCreate({
          command,
          existingEffect,
          timeShift: timeShiftRequested,
          overlaps: sourceEffects
        });
      }
    }
    if (!overlaps.length) {
      return {
        ...command,
        intent: {
          ...(command.intent && typeof command.intent === "object" ? command.intent : {}),
          existingSequencePolicy: {
            replacementAuthorized,
            editExistingRequested: existingEditRequested,
            layerDeleteRequested: Boolean(layerDeleteRequested),
            layerReorderRequested: Boolean(layerReorderRequested),
            layerCompactRequested: Boolean(layerCompactRequested),
            timeShiftRequested: Boolean(timeShiftRequested),
            preserveExistingUnlessScoped: true,
            overlapCount: 0
          }
        }
      };
    }
    if (layerDeleteAuthorized) {
      const layerIndexToDelete = Number(layerDeleteRequested.layerIndex);
      const modelLayerEffects = existingEffects.filter((effect) => effect.targetId === modelName && Number(effect.layerIndex) === layerIndexToDelete);
      const key = `deleteLayer:${modelName}:${layerIndexToDelete}`;
      if (modelLayerEffects.length && emittedLayerOperations.has(key)) return null;
      if (modelLayerEffects.length) {
        emittedLayerOperations.add(key);
        warnings.push(`Deleting existing layer on ${modelName}; converted ${normText(params.effectName) || "planned effect"} create into effects.deleteLayer for layer ${layerIndexToDelete}.`);
        return buildEffectDeleteLayerCommandFromCreate({
          command,
          modelName,
          layerDelete: layerDeleteRequested,
          layerEffects: modelLayerEffects
        });
      }
    }
    if (layerReorderAuthorized) {
      const fromLayer = Number(layerReorderRequested.fromLayer);
      const modelHasSourceLayer = existingEffects.some((effect) => effect.targetId === modelName && Number(effect.layerIndex) === fromLayer);
      const key = `reorderLayer:${modelName}:${fromLayer}:${layerReorderRequested.toLayer}`;
      if (modelHasSourceLayer && emittedLayerOperations.has(key)) return null;
      if (modelHasSourceLayer) {
        emittedLayerOperations.add(key);
        warnings.push(`Reordering existing layers on ${modelName}; converted ${normText(params.effectName) || "planned effect"} create into effects.reorderLayer from layer ${fromLayer} to layer ${layerReorderRequested.toLayer}.`);
        return buildEffectReorderLayerCommandFromCreate({
          command,
          modelName,
          layerReorder: layerReorderRequested,
          overlaps
        });
      }
    }
    if (layerCompactAuthorized) {
      const modelLayerEffects = existingEffects.filter((effect) => effect.targetId === modelName);
      const key = `compactLayers:${modelName}`;
      if (modelLayerEffects.length && emittedLayerOperations.has(key)) return null;
      if (modelLayerEffects.length) {
        emittedLayerOperations.add(key);
        warnings.push(`Compacting existing layers on ${modelName}; converted ${normText(params.effectName) || "planned effect"} create into effects.compactLayers.`);
        return buildEffectCompactLayersCommandFromCreate({
          command,
          modelName,
          layerEffects: modelLayerEffects
        });
      }
    }
    if (timeShiftAuthorized) {
      const scopedOverlaps = Number.isInteger(timeShiftRequested.layerIndex)
        ? overlaps.filter((effect) => Number(effect.layerIndex) === timeShiftRequested.layerIndex)
        : overlaps;
      const existingEffect = chooseExistingEffectForEdit(scopedOverlaps.length ? scopedOverlaps : overlaps, layerIndex);
      if (existingEffect) {
        warnings.push(`Shifting existing effect on ${modelName}; converted ${normText(params.effectName) || "planned effect"} create into effects.update with ${timeShiftRequested.deltaMs}ms offset.`);
        return buildEffectTimeShiftUpdateCommandFromCreate({
          command,
          existingEffect,
          timeShift: timeShiftRequested,
          overlaps
        });
      }
    }
    if (deleteExistingAuthorized) {
      const existingEffect = chooseExistingEffectForEdit(overlaps, layerIndex);
      warnings.push(`Deleting existing effect on ${modelName}; converted ${normText(params.effectName) || "planned effect"} create into effects.delete on layer ${existingEffect.layerIndex}.`);
      return buildEffectDeleteCommandFromCreate({
        command,
        existingEffect,
        overlaps
      });
    }
    if (editExistingAuthorized) {
      const existingEffect = chooseExistingEffectForEdit(overlaps, layerIndex);
      warnings.push(`Editing existing effect on ${modelName}; converted ${normText(params.effectName) || "planned effect"} create into effects.update on layer ${existingEffect.layerIndex}.`);
      return buildEffectUpdateCommandFromCreate({
        command,
        existingEffect,
        replacementAuthorized: replacementAuthorized || existingEditRequested,
        overlaps
      });
    }
    const maxExistingLayer = Math.max(...overlaps.map((effect) => effect.layerIndex));
    const nextLayerIndex = replacementAuthorized ? layerIndex : Math.max(layerIndex, maxExistingLayer + 1);
    if (!replacementAuthorized && nextLayerIndex !== layerIndex) {
      warnings.push(`Preserving existing effects on ${modelName}; moved ${normText(params.effectName) || "planned effect"} from layer ${layerIndex} to layer ${nextLayerIndex}.`);
    }
    return {
      ...command,
      params: {
        ...params,
        layerIndex: nextLayerIndex
      },
      intent: {
        ...(command.intent && typeof command.intent === "object" ? command.intent : {}),
        existingSequencePolicy: {
          replacementAuthorized,
          editExistingRequested: existingEditRequested,
          layerDeleteRequested: Boolean(layerDeleteRequested),
          layerReorderRequested: Boolean(layerReorderRequested),
          layerCompactRequested: Boolean(layerCompactRequested),
          timeShiftRequested: Boolean(timeShiftRequested),
          preserveExistingUnlessScoped: true,
          overlapCount: overlaps.length,
          originalLayerIndex: layerIndex,
          plannedLayerIndex: nextLayerIndex,
          overlappingEffectNames: Array.from(new Set(overlaps.map((effect) => effect.effectName).filter(Boolean))).slice(0, 5)
        }
      }
    };
  });
  return preservedCommands.filter(Boolean);
}

function collectEffectAvoidancesForTargets(targetIds = [], metadataAssignmentIndex = new Map()) {
  const out = [];
  const seen = new Set();
  for (const targetId of normArray(targetIds).map((row) => normText(row)).filter(Boolean)) {
    const assignment = metadataAssignmentIndex.get(targetId);
    const values = normArray(assignment?.effectAvoidances).map((row) => normText(row)).filter(Boolean);
    for (const value of values) {
      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(value);
    }
  }
  return out;
}

function collectDefinedVisualHintBehaviorTextForTargets(targetIds = [], metadataAssignmentIndex = new Map()) {
  const out = [];
  const seen = new Set();
  for (const targetId of normArray(targetIds).map((row) => normText(row)).filter(Boolean)) {
    const assignment = metadataAssignmentIndex.get(targetId);
    const definitions = normArray(assignment?.visualHintDefinitions);
    for (const definition of definitions) {
      const value = normText(definition?.behavioralIntent);
      const status = normText(definition?.status).toLowerCase();
      if (!value || (status && status !== "defined")) continue;
      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(value);
    }
  }
  return out;
}

function inferRevisionBriefPreferredEffects(brief = {}) {
  const tendencyEffects = inferRevisionBriefTendencyEffects(brief);
  if (tendencyEffects.length) return tendencyEffects;
  const successfulEffects = normArray(brief?.effectOutcomeMemory?.successfulEffects);
  if (successfulEffects.length) return successfulEffects;
  const summary = `${normText(brief?.artisticGoalSummary)} ${normText(brief?.executionObjective)}`.toLowerCase();
  const motionCharacter = normText(brief?.motionCharacter).toLowerCase();
  const densityCharacter = normText(brief?.densityCharacter).toLowerCase();

  if (/contrast|hierarchy|differentiat|lift|shift/.test(summary)) {
    return ["Bars", "Shimmer", "Color Wash"];
  }
  if (/flat|evolv|develop/.test(summary)) {
    return motionCharacter.includes("restrained")
      ? ["Shimmer", "Bars", "Color Wash"]
      : ["Bars", "Wave", "Shimmer"];
  }
  if (motionCharacter.includes("restrained")) return ["Shimmer", "Color Wash", "On"];
  if (motionCharacter.includes("expand")) return ["Bars", "Shimmer", "Color Wash"];
  if (densityCharacter === "sparse") return ["On", "Color Wash", "Shimmer"];
  return [];
}

function inferRevisionBriefTendencyEffects(brief = {}) {
  const tendencies = brief?.effectOutcomeMemory?.tendencies;
  if (!tendencies || typeof tendencies !== "object" || Array.isArray(tendencies)) return [];
  const roleBuckets = {
    strengthen_lead: "focus",
    reduce_competing_support: "support_balance",
    widen_support: "support_balance",
    increase_section_contrast: "section_contrast",
    add_section_development: "section_development"
  };
  const out = [];
  for (const role of normArray(brief?.revisionRoles).map((row) => normText(row))) {
    const bucket = roleBuckets[role];
    if (!bucket) continue;
    out.push(...normArray(tendencies?.[bucket]?.successfulEffects));
  }
  return [...new Set(out.map((row) => normText(row)).filter(Boolean))];
}

function inferDesiredParameterBehaviorHints({ effectName = "", summary = "", sequencerRevisionBrief = null } = {}) {
  const hints = new Set();
  const normalizedEffectName = normText(effectName);
  const normalizedSummary = normText(summary).toLowerCase();
  const motionCharacter = normText(sequencerRevisionBrief?.motionCharacter).toLowerCase();

  if (normalizedSummary.includes("forward")) hints.add("forward_motion");
  if (normalizedSummary.includes("linear")) hints.add("linear_pattern_fit");
  if (normalizedSummary.includes("radial") || normalizedEffectName === "Pinwheel" || normalizedEffectName === "Shockwave") hints.add("radial_pattern_fit");
  if (normalizedSummary.includes("spiral") || normalizedEffectName === "Spirals") hints.add("spiral_pattern_fit");
  if (normalizedSummary.includes("grouped arch") || normalizedSummary.includes("arch")) hints.add("grouped_arch_read");

  if (motionCharacter.includes("restrained") || motionCharacter.includes("still")) hints.add("static_or_near_static");
  if (motionCharacter.includes("expand")) hints.add("moderate_motion");

  return [...hints];
}

function inferPreferredPaletteMode({ effectName = "" } = {}) {
  const normalizedEffectName = normText(effectName);
  if (["Color Wash", "Twinkle", "Pinwheel", "Shockwave"].includes(normalizedEffectName)) return "rgb_primary";
  return "mono_white";
}

function buildParameterPriorGuidance({
  effectName = "",
  targetIds = [],
  displayElements = [],
  intentSummary = "",
  sequencerRevisionBrief = null
} = {}) {
  const preferredPaletteMode = inferPreferredPaletteMode({ effectName });
  const desiredBehaviorHints = inferDesiredParameterBehaviorHints({
    effectName,
    summary: intentSummary,
    sequencerRevisionBrief
  });
  const recommendation = recommendDerivedParameterPriors({
    effectName,
    targetIds,
    displayElements,
    paletteMode: preferredPaletteMode,
    desiredBehaviorHints,
    limit: 3,
    anchorsPerPrior: 2
  });
  return {
    effectName: normText(effectName),
    preferredPaletteMode,
    desiredBehaviorHints,
    recommendationMode: normText(recommendation?.recommendationMode),
    matchedGeometryProfiles: normArray(recommendation?.matchedGeometryProfiles),
    matchedModelTypes: normArray(recommendation?.matchedModelTypes),
    priors: normArray(recommendation?.priors)
  };
}

function inferPreferredSharedSettingNames({ sequencerRevisionBrief = null, intentSummary = "" } = {}) {
  const roles = new Set(normArray(sequencerRevisionBrief?.revisionRoles).map((row) => normText(row)));
  const summary = normText(intentSummary).toLowerCase();
  const names = new Set(["inTransitionType", "outTransitionType"]);
  if (roles.has("reduce_competing_support") || roles.has("strengthen_lead") || /layer|blend|overlay/.test(summary)) {
    names.add("layerMethod");
    names.add("effectLayerMix");
  }
  if (roles.has("widen_support") || /overlay|support|buffer/.test(summary)) {
    names.add("bufferStyle");
  }
  if (/morph|blend/.test(summary)) {
    names.add("layerMorph");
  }
  return [...names];
}

function buildSharedSettingPriorGuidance({
  sequencerRevisionBrief = null,
  intentSummary = ""
} = {}) {
  const requestScopeMode = normText(sequencerRevisionBrief?.requestScopeMode);
  const preferredSettingNames = inferPreferredSharedSettingNames({
    sequencerRevisionBrief,
    intentSummary
  });
  const recommendation = recommendCrossEffectSharedSettings({
    requestScopeMode,
    preferredSettingNames,
    limitPerSetting: 2
  });
  return {
    recommendationMode: normText(recommendation?.recommendationMode),
    requestScopeMode,
    preferredSettingNames,
    settings: normArray(recommendation?.settings)
  };
}

function inferEffectNameFromSectionPlan({
  section = "",
  energy = "",
  density = "",
  intentSummary = "",
  effectHints = [],
  targetIds = [],
  displayElements = [],
  sectionDirective = null,
  availableEffects = null,
  effectAvoidances = [],
  visualHintBehaviorText = [],
  translationVisualFamilies = [],
  sequencerRevisionBrief = null
} = {}) {
  const briefPreferred = selectPreferredEffect(
    inferRevisionBriefPreferredEffects(sequencerRevisionBrief),
    { availableEffects, effectAvoidances }
  );
  if (briefPreferred) return briefPreferred;
  const directiveText = [
    normText(sectionDirective?.sectionPurpose),
    normText(sectionDirective?.motionTarget),
    normText(sectionDirective?.densityTarget),
    normText(sectionDirective?.transitionIntent),
    ...normArray(sectionDirective?.preferredVisualFamilies)
  ].join(" ");
  const hintBehavior = normArray(visualHintBehaviorText).map((row) => normText(row)).filter(Boolean).join(" ");
  const summary = `${normText(intentSummary)} ${normText(section)} ${directiveText} ${hintBehavior}`.toLowerCase();
  const directCueChosen = selectPreferredEffect(
    resolveDirectCueEffectCandidates({
      goalText: summary,
      smoothBias: /flow|smooth|glow|cinematic/.test(summary)
    }),
    { availableEffects, effectAvoidances }
  );
  if (directCueChosen) return directCueChosen;
  const familyDriven = recommendEffectsForVisualFamilies({
    preferredVisualFamilies: [
      ...normArray(sectionDirective?.preferredVisualFamilies),
      ...normArray(translationVisualFamilies)
    ],
    targetIds,
    displayElements,
    limit: 3
  });
  const normalizedEnergy = normText(energy).toLowerCase();
  const normalizedDensity = normText(density).toLowerCase();
  const trained = recommendEffectsForTargets({
    summary,
    energy: normalizedEnergy,
    density: normalizedDensity,
    targetIds,
    displayElements,
    limit: 3
  });
  const trainedEffectNames = filterAvoidedEffects(trained.map((row) => row?.effectName), effectAvoidances);
  const combinedCandidates = [
    ...familyDriven.map((row) => row?.effectName),
    ...trainedEffectNames,
    ...normArray(effectHints)
  ];
  const combinedChosen = selectPreferredEffect(combinedCandidates, { availableEffects, effectAvoidances });
  if (combinedChosen) return combinedChosen;

  return selectPreferredEffect(
    [resolveSummaryFallbackEffect(summary, availableEffects)].filter(Boolean),
    { availableEffects, effectAvoidances }
  )
    || selectPreferredEffect(chooseSafeFallbackChain("default"), { availableEffects, effectAvoidances })
    || "Color Wash";
}

function buildStructuredExecutionLine({
  section = "",
  targetIds = [],
  fallbackTargetIds = [],
  intentSummary = "",
  effectName = ""
} = {}) {
  const sectionText = normText(section) || "General";
  const targets = normArray(targetIds).length ? normArray(targetIds) : normArray(fallbackTargetIds);
  const targetText = targets.length ? targets.slice(0, 8).join(" + ") : "AllModels";
  const effectText = normText(effectName) || "Color Wash";
  const summary = normText(intentSummary).toLowerCase();
  const paletteClause = /warm|amber|gold|red/.test(summary)
    ? " in warm amber and gold tones"
    : (/cool|blue|icy/.test(summary) ? " in cool blue and white tones" : "");
  return `${sectionText} / ${targetText} / apply ${effectText} effect${paletteClause} for the requested duration using the current target timing`;
}

function buildRevisionBriefBehaviorSummary(brief = {}) {
  const revisionRoles = new Set(normArray(brief?.revisionRoles).map((row) => normText(row)));
  const summaryBits = [
    normText(brief?.artisticGoalSummary),
    normText(brief?.executionObjective),
    normText(brief?.motionCharacter).replaceAll("_", " "),
    normText(brief?.densityCharacter).replaceAll("_", " ")
  ];
  if (revisionRoles.has("increase_section_contrast")) {
    summaryBits.push("clear differentiated contrast segmented visual separation");
  }
  if (revisionRoles.has("add_section_development")) {
    summaryBits.push("evolving development with visible motion change over time");
  }
  if (revisionRoles.has("reduce_competing_support")) {
    summaryBits.push("restrained support hold with minimal competing motion");
  }
  if (revisionRoles.has("widen_support")) {
    summaryBits.push("broader support coverage with restrained background behavior");
  }
  if (revisionRoles.has("strengthen_lead")) {
    summaryBits.push("clear lead emphasis with reduced competing support");
  }
  return summaryBits.filter(Boolean).join(" ").toLowerCase();
}

function inferRevisionBriefEffectName(brief = {}) {
  const successfulTendencyEffect = firstAvailableEffect(inferRevisionBriefTendencyEffects(brief));
  if (successfulTendencyEffect) return successfulTendencyEffect;
  const successfulEffect = firstAvailableEffect(normArray(brief?.effectOutcomeMemory?.successfulEffects));
  if (successfulEffect) return successfulEffect;
  const summary = buildRevisionBriefBehaviorSummary(brief);
  const motionCharacter = normText(brief?.motionCharacter).toLowerCase();
  const densityCharacter = normText(brief?.densityCharacter).toLowerCase();
  const directCueChosen = firstAvailableEffect(
    resolveDirectCueEffectCandidates({
      goalText: summary,
      smoothBias: /flow|smooth|glow|cinematic/.test(summary)
    })
  );
  if (directCueChosen) return directCueChosen;
  const trainedChosen = firstAvailableEffect(
    filterAvoidedEffects(
      recommendEffectsForTargets({
        summary,
        energy: "",
        density: densityCharacter,
        targetIds: [],
        displayElements: [],
        limit: 1
      }).map((row) => row?.effectName),
      []
    )
  );
  if (trainedChosen) return trainedChosen;
  if (motionCharacter.includes("still")) {
    return resolveSummaryFallbackEffect(`${summary} steady hold`) || "On";
  }
  return resolveSummaryFallbackEffect(summary) || "Color Wash";
}

function buildRevisionBriefExecutionLine({ brief = {}, scope = {}, toneText = "" } = {}) {
  if (!brief || typeof brief !== "object") return "";
  const targetIds = normArray(brief?.targetScope).length
    ? normArray(brief.targetScope)
    : [
        normText(brief?.leadTarget),
        ...normArray(brief?.supportTargets)
      ].filter(Boolean);
  const sectionScope = normArray(brief?.sectionScope);
  const intentBits = [
    normText(brief?.artisticGoalSummary),
    normText(brief?.executionObjective),
    normArray(brief?.revisionRoles).map((row) => normText(row).replaceAll("_", " ")).join(", ")
  ].filter(Boolean);
  return buildStructuredExecutionLine({
    section: sectionScope.length ? sectionScope.join(", ") : (scope?.sectionNames || []).join(", "),
    targetIds,
    fallbackTargetIds: scope?.targetIds,
    intentSummary: `${intentBits.join(" ")}${toneText}`,
    effectName: inferRevisionBriefEffectName(brief)
  });
}

function mergePriorityTargets({ primary = [], secondary = [], fallback = [] } = {}) {
  return [...new Set([
    ...normArray(primary).map((row) => normText(row)),
    ...normArray(secondary).map((row) => normText(row)),
    ...normArray(fallback).map((row) => normText(row))
  ].filter(Boolean))];
}

function stageEffectStrategy({ scope = {}, analysisHandoff = {}, timing = {}, displayElements = [], effectCatalog = null, metadataAssignments = [], sequencerRevisionBrief = null } = {}) {
  const toneHint = normText(analysisHandoff?.briefSeed?.tone);
  const toneText = toneHint ? ` | tone: ${toneHint}` : "";
  const strategySectionPlans = normArray(scope?.executionStrategy?.sectionPlans);
  const effectPlacements = normArray(scope?.executionStrategy?.effectPlacements);
  const sectionDirectiveIndex = buildSectionDirectiveIndex(scope?.sequencingDesignHandoff);
  const availableEffects = buildAvailableEffectSet(effectCatalog);
  const metadataAssignmentIndex = buildMetadataAssignmentIndex(metadataAssignments);
  const revisionBriefExecutionLine = buildRevisionBriefExecutionLine({
    brief: sequencerRevisionBrief,
    scope,
    toneText
  });
  const briefPriorityTargets = mergePriorityTargets({
    primary: normArray(sequencerRevisionBrief?.focusTargets),
    secondary: normArray(sequencerRevisionBrief?.revisionTargets),
    fallback: normArray(sequencerRevisionBrief?.targetScope)
  });
  const seedRecommendations = strategySectionPlans.length
    ? strategySectionPlans.map((row) => {
        const prioritizedTargetIds = mergePriorityTargets({
          primary: briefPriorityTargets,
          secondary: normArray(row?.targetIds),
          fallback: normArray(scope?.targetIds)
        });
        const sectionDirective = sectionDirectiveIndex.get(normText(row?.section)) || null;
        const effectAvoidances = collectEffectAvoidancesForTargets(prioritizedTargetIds, metadataAssignmentIndex);
        const visualHintBehaviorText = collectDefinedVisualHintBehaviorTextForTargets(prioritizedTargetIds, metadataAssignmentIndex);
        const translationLayer = resolveTranslationLayer({
          translationIntent: scope?.executionStrategy?.translationIntent,
          section: row?.section,
          targetIds: prioritizedTargetIds,
          availableEffects
        });
        const effectName = inferEffectNameFromSectionPlan({
          section: row?.section,
          energy: sectionDirective?.energyTarget || row?.energy,
          density: sectionDirective?.densityTarget || row?.density,
          intentSummary: row?.intentSummary || scope.goal,
          effectHints: [
            ...normArray(row?.effectHints),
            ...normArray(translationLayer?.preferredEffectHints)
          ],
          targetIds: prioritizedTargetIds,
          displayElements,
          sectionDirective,
          availableEffects,
          effectAvoidances,
          visualHintBehaviorText: [
            ...visualHintBehaviorText,
            ...normArray(translationLayer?.behaviorTexts)
          ],
          translationVisualFamilies: normArray(translationLayer?.preferredVisualFamilies),
          sequencerRevisionBrief
        });
        const intentSummary = `${normText(row?.intentSummary || scope.goal)}${toneText}`;
        return {
          section: normText(row?.section),
          targetIds: prioritizedTargetIds,
          effectName,
          executionLine: buildStructuredExecutionLine({
          section: row?.section,
          targetIds: prioritizedTargetIds,
          fallbackTargetIds: scope.targetIds,
          intentSummary,
          effectName
          }),
          parameterPriorGuidance: buildParameterPriorGuidance({
            effectName,
            targetIds: prioritizedTargetIds,
            displayElements,
            intentSummary,
            sequencerRevisionBrief
          }),
          sharedSettingPriorGuidance: buildSharedSettingPriorGuidance({
            sequencerRevisionBrief,
            intentSummary
          })
        };
      })
    : [(() => {
        const sectionText = Array.isArray(scope.sectionNames) && scope.sectionNames.length
          ? scope.sectionNames.slice(0, 8).join(", ")
          : "Global";
        const targetText = Array.isArray(scope.targetIds) && scope.targetIds.length
          ? scope.targetIds.slice(0, 8).join(", ")
          : "Whole Show";
        const fallbackEffectName = inferRevisionBriefEffectName(sequencerRevisionBrief || {});
        return {
          section: sectionText,
          targetIds: normArray(scope.targetIds),
          effectName: fallbackEffectName,
          executionLine: revisionBriefExecutionLine || `${sectionText} / ${targetText} / ${scope.mode || "create"} from intent: ${scope.goal || "unspecified"}${toneText}`,
          parameterPriorGuidance: buildParameterPriorGuidance({
            effectName: fallbackEffectName,
            targetIds: normArray(scope.targetIds),
            displayElements,
            intentSummary: `${normText(scope.goal)}${toneText}`,
            sequencerRevisionBrief
          }),
          sharedSettingPriorGuidance: buildSharedSettingPriorGuidance({
            sequencerRevisionBrief,
            intentSummary: `${normText(scope.goal)}${toneText}`
          })
        };
      })()];
  const executionSeedLines = seedRecommendations.map((row) => row.executionLine);
  return {
    toneHint,
    effectPlacements,
    seedRecommendations,
    executionSeedLines,
    preferSynthesized: strategySectionPlans.length > 0 || Boolean(revisionBriefExecutionLine),
    strategy: timing.strategy,
    detail: `seedLines=${executionSeedLines.length} strategy=${timing.strategy} parameterPriorGuidance=${seedRecommendations.filter((row) => normArray(row?.parameterPriorGuidance?.priors).length).length} sharedSettingPriorGuidance=${seedRecommendations.filter((row) => normArray(row?.sharedSettingPriorGuidance?.settings).length).length}`
  };
}

function buildPlacementMarksByTrack({
  effectPlacements = [],
  sectionWindowsByName = null,
  cueTrackMarksByTrack = null,
  defaultTrackName = "",
  sequenceSettings = {}
} = {}) {
  const marksByTrack = new Map();

  function ensureTrackEntry(trackName = "") {
    const normalizedTrackName = normText(trackName);
    if (!normalizedTrackName) return null;
    if (!marksByTrack.has(normalizedTrackName)) {
      marksByTrack.set(normalizedTrackName, { marks: [], seen: new Set() });
    }
    return marksByTrack.get(normalizedTrackName);
  }

  function addMark(trackName = "", { label = "", startMs, endMs } = {}) {
    const entry = ensureTrackEntry(trackName);
    const markLabel = normText(label);
    const start = Number(startMs);
    const end = Number(endMs);
    if (!entry || !markLabel || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) return;
    const key = `${markLabel}::${start}::${end}`;
    if (entry.seen.has(key)) return;
    entry.seen.add(key);
    entry.marks.push({ label: markLabel, startMs: start, endMs: end });
  }

  if (sectionWindowsByName instanceof Map) {
    for (const [label, window] of sectionWindowsByName.entries()) {
      addMark(defaultTrackName || "XD: Song Structure", {
        label,
        startMs: window?.startMs,
        endMs: window?.endMs
      });
    }
  }

  if (cueTrackMarksByTrack instanceof Map) {
    for (const [trackName, marks] of cueTrackMarksByTrack.entries()) {
      for (const mark of normArray(marks)) {
        addMark(trackName, mark);
      }
    }
  }

  for (const placement of normArray(effectPlacements)) {
    addMark(normText(placement?.timingContext?.trackName || defaultTrackName), {
      label: placement?.timingContext?.anchorLabel,
      startMs: placement?.timingContext?.anchorStartMs,
      endMs: placement?.timingContext?.anchorEndMs
    });
  }

  function normalizeTrackMarks(trackName = "", marks = []) {
    const sortedMarks = normArray(marks)
      .filter((row) => Number.isFinite(Number(row?.startMs)) && Number.isFinite(Number(row?.endMs)) && Number(row.endMs) > Number(row.startMs))
      .map((row) => ({
        label: normText(row?.label),
        startMs: Number(row.startMs),
        endMs: Number(row.endMs)
      }))
      .filter((row) => row.label)
      .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs || a.label.localeCompare(b.label));
    let normalizedMarks;
    if (trackName === "XD: Song Structure") {
      normalizedMarks = normalizeXdSongStructureMarks(sortedMarks, sequenceSettings);
    } else if (trackName === "XD: Phrase Cues") {
      const specificFirst = sortedMarks
        .slice()
        .sort((a, b) => {
          const aDuration = a.endMs - a.startMs;
          const bDuration = b.endMs - b.startMs;
          return aDuration - bDuration || a.startMs - b.startMs || a.endMs - b.endMs || a.label.localeCompare(b.label);
        });
      const kept = [];
      for (const mark of specificFirst) {
        const overlapsExisting = kept.some((row) => Math.max(row.startMs, mark.startMs) < Math.min(row.endMs, mark.endMs));
        if (overlapsExisting) continue;
        kept.push(mark);
      }
      normalizedMarks = normalizeXdPhraseCueMarks(
        kept.sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs || a.label.localeCompare(b.label)),
        sequenceSettings
      );
    } else {
      // xLights timing rows reject overlapping marks. Prefer the most specific windows
      // and drop broader containers such as Phrase Hold-Phrase Release.
      const specificFirst = sortedMarks
        .slice()
        .sort((a, b) => {
          const aDuration = a.endMs - a.startMs;
          const bDuration = b.endMs - b.startMs;
          return aDuration - bDuration || a.startMs - b.startMs || a.endMs - b.endMs || a.label.localeCompare(b.label);
        });
      const kept = [];
      for (const mark of specificFirst) {
        const overlapsExisting = kept.some((row) => Math.max(row.startMs, mark.startMs) < Math.min(row.endMs, mark.endMs));
        if (overlapsExisting) continue;
        kept.push(mark);
      }
      normalizedMarks = kept
        .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs || a.label.localeCompare(b.label))
        .slice(0, 64);
    }
    const durationMs = Number(sequenceSettings?.durationMs);
    const maxCueEndMs = Number.isFinite(durationMs) && durationMs > 1 ? durationMs - 1 : null;
    if (maxCueEndMs == null) return normalizedMarks;
    return normalizedMarks.map((mark) => {
      if (!Number.isFinite(mark?.endMs) || mark.endMs !== durationMs) return mark;
      const endMs = Math.max(mark.startMs + 1, maxCueEndMs);
      return endMs === mark.endMs ? mark : { ...mark, endMs };
    });
  }

  const normalizedByTrack = new Map();
  for (const [trackName, entry] of marksByTrack.entries()) {
    normalizedByTrack.set(trackName, normalizeTrackMarks(trackName, entry.marks));
  }
  return normalizedByTrack;
}

function clampPlacementWindow({ startMs, endMs, sequenceSettings = {} } = {}) {
  const maxEnd = Number.isFinite(Number(sequenceSettings?.durationMs)) ? Number(sequenceSettings.durationMs) : null;
  const lastValidEnd = maxEnd != null && maxEnd > 1 ? maxEnd - 1 : maxEnd;
  let start = Number(startMs);
  let end = Number(endMs);
  if (!Number.isFinite(start)) start = 0;
  if (!Number.isFinite(end)) end = start + 1;
  start = Math.max(0, start);
  if (lastValidEnd != null && lastValidEnd > 0) {
    end = Math.min(end, lastValidEnd);
    if (start >= end) {
      start = Math.max(0, Math.min(start, lastValidEnd - 1));
      end = Math.max(start + 1, Math.min(lastValidEnd, start + 1));
    }
  } else if (end <= start) {
    end = start + 1;
  }
  return { startMs: start, endMs: end };
}

function nearlyEqualMs(a, b, toleranceMs = 2) {
  const left = Number(a);
  const right = Number(b);
  return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= toleranceMs;
}

function markBoundarySide(window = {}, mark = {}) {
  if (nearlyEqualMs(window.startMs, mark?.startMs)) return "start";
  if (nearlyEqualMs(window.startMs, mark?.endMs)) return "start";
  if (nearlyEqualMs(window.endMs, mark?.startMs)) return "end";
  if (nearlyEqualMs(window.endMs, mark?.endMs)) return "end";
  return "";
}

function findTimingBoundaryAnchor({ window = {}, trackName = "", marksByTrack = new Map() } = {}) {
  const requestedMarks = normArray(marksByTrack?.get(trackName));
  const allMarks = requestedMarks.length
    ? requestedMarks
    : Array.from(marksByTrack?.values?.() || []).flatMap((marks) => normArray(marks));
  return allMarks
    .map((mark) => {
      const side = markBoundarySide(window, mark);
      if (!side) return null;
      const labeled = normText(mark?.label) ? 1 : 0;
      const containsStart = Number(mark?.startMs) <= Number(window?.startMs) && Number(mark?.endMs) > Number(window?.startMs) ? 1 : 0;
      const containsEnd = Number(mark?.startMs) < Number(window?.endMs) && Number(mark?.endMs) >= Number(window?.endMs) ? 1 : 0;
      return { mark, side, score: (labeled * 10) + containsStart + containsEnd };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || Number(a.mark?.startMs) - Number(b.mark?.startMs))[0] || null;
}

function findContainingTimingMark({ window = {}, trackName = "", marksByTrack = new Map() } = {}) {
  const requestedMarks = normArray(marksByTrack?.get(trackName));
  const allMarks = requestedMarks.length
    ? requestedMarks
    : Array.from(marksByTrack?.values?.() || []).flatMap((marks) => normArray(marks));
  return allMarks.find((mark) => {
    const startMs = Number(mark?.startMs);
    const endMs = Number(mark?.endMs);
    return Number.isFinite(startMs) && Number.isFinite(endMs) && startMs <= window.startMs && endMs >= window.endMs;
  }) || null;
}

function findNearestTimingMark({ window = {}, marks = [] } = {}) {
  const start = Number(window?.startMs);
  if (!Number.isFinite(start)) return null;
  return normArray(marks)
    .filter((mark) => Number.isFinite(Number(mark?.startMs)) && Number.isFinite(Number(mark?.endMs)) && Number(mark.endMs) > Number(mark.startMs))
    .map((mark) => {
      const markStart = Number(mark.startMs);
      const markEnd = Number(mark.endMs);
      const contains = markStart <= start && markEnd >= start;
      const startsAtOrAfter = markStart >= start;
      const distance = contains ? 0 : Math.min(Math.abs(markStart - start), Math.abs(markEnd - start));
      return { mark, distance, contains, startsAtOrAfter };
    })
    .sort((a, b) => {
      if (a.contains !== b.contains) return a.contains ? -1 : 1;
      if (a.startsAtOrAfter !== b.startsAtOrAfter) return a.startsAtOrAfter ? -1 : 1;
      return a.distance - b.distance || Number(a.mark.startMs) - Number(b.mark.startMs);
    })[0]?.mark || null;
}

function retargetFallbackEffectsToCueTiming({
  commands = [],
  requestedTrackNames = [],
  cueTrackMarksByTrack = null,
  sequenceSettings = {}
} = {}) {
  if (!(cueTrackMarksByTrack instanceof Map)) return commands;
  const marksByTrack = buildPlacementMarksByTrack({
    effectPlacements: [],
    cueTrackMarksByTrack,
    sequenceSettings
  });
  const cueTracks = normArray(requestedTrackNames)
    .map((row) => normText(row))
    .filter(Boolean)
    .map((trackName) => ({ trackName, marks: normArray(marksByTrack.get(trackName)) }))
    .filter((row) => row.marks.length);
  if (!cueTracks.length) return commands;
  let effectIndex = -1;
  const cueByEffectOrdinal = new Map();
  return normArray(commands).map((command) => {
    const cmd = normText(command?.cmd);
    if (cmd === "effects.create") {
      effectIndex += 1;
      const params = command?.params && typeof command.params === "object" ? command.params : {};
      const window = clampPlacementWindow({
        startMs: params.startMs,
        endMs: params.endMs,
        sequenceSettings
      });
      const cueTrack = cueTracks[effectIndex % cueTracks.length];
      const mark = findNearestTimingMark({ window, marks: cueTrack.marks }) || cueTrack.marks[effectIndex % cueTrack.marks.length];
      if (!mark) return command;
      cueByEffectOrdinal.set(effectIndex, { trackName: cueTrack.trackName, mark });
      return {
        ...command,
        anchor: {
          kind: "timing_track",
          trackName: cueTrack.trackName,
          markLabel: normText(mark?.label),
          startMs: Number(mark.startMs),
          endMs: Number(mark.endMs),
          basis: "requested_cue_timing",
          boundarySide: "start"
        },
        params: {
          ...params,
          startMs: Number(mark.startMs),
          endMs: Number(mark.endMs)
        }
      };
    }
    if (cmd === "effects.alignToTiming") {
      const params = command?.params && typeof command.params === "object" ? command.params : {};
      const ordinalText = normText(command?.id).match(/effect\.align\.(\d+)/)?.[1];
      const ordinal = ordinalText ? Math.max(0, Number(ordinalText) - 1) : effectIndex;
      const cue = cueByEffectOrdinal.get(ordinal) || cueByEffectOrdinal.get(effectIndex) || { trackName: cueTracks[0].trackName, mark: cueTracks[0].marks[0] };
      const mark = cue.mark;
      if (!cue.trackName || !mark) return command;
      return {
        ...command,
        params: {
          ...params,
          startMs: Number(mark.startMs),
          endMs: Number(mark.endMs),
          timingTrackName: cue.trackName
        }
      };
    }
    return command;
  });
}

function findAdjacentPlacementBoundary({ placement = {}, window = {}, placements = [] } = {}) {
  const targetId = normText(placement?.targetId);
  const layerIndex = Number(placement?.layerIndex);
  if (!targetId || !Number.isFinite(layerIndex)) return null;
  for (const other of normArray(placements)) {
    if (other === placement) continue;
    if (normText(other?.targetId) !== targetId) continue;
    if (Number(other?.layerIndex) !== layerIndex) continue;
    const otherStart = Number(other?.startMs);
    const otherEnd = Number(other?.endMs);
    if (!Number.isFinite(otherStart) || !Number.isFinite(otherEnd) || otherEnd <= otherStart) continue;
    if (nearlyEqualMs(window.startMs, otherEnd)) return { side: "start", other };
    if (nearlyEqualMs(window.endMs, otherStart)) return { side: "end", other };
  }
  return null;
}

function resolvePlacementAnchoredWindow({
  placement = {},
  placements = [],
  defaultTrackName = "",
  marksByTrack = new Map(),
  sequenceSettings = {}
} = {}) {
  const placementTrackName = normText(placement?.timingContext?.trackName || defaultTrackName) || "XD: Sequencer Plan";
  let window = clampPlacementWindow({
    startMs: placement.startMs,
    endMs: placement.endMs,
    sequenceSettings
  });
  const explicitAnchor = placement?.timingContext && typeof placement.timingContext === "object" && !Array.isArray(placement.timingContext)
    ? {
        label: normText(placement?.timingContext?.anchorLabel),
        startMs: Number(placement?.timingContext?.anchorStartMs),
        endMs: Number(placement?.timingContext?.anchorEndMs)
      }
    : null;
  if (explicitAnchor && Number.isFinite(explicitAnchor.startMs) && Number.isFinite(explicitAnchor.endMs) && explicitAnchor.endMs > explicitAnchor.startMs) {
    const anchorSide = markBoundarySide(window, explicitAnchor);
    if (!anchorSide) {
      const duration = Math.max(1, window.endMs - window.startMs);
      window = clampPlacementWindow({
        startMs: explicitAnchor.startMs,
        endMs: explicitAnchor.startMs + duration,
        sequenceSettings
      });
    }
    return {
      window,
      placementTrackName,
      anchor: {
        kind: "timing_track",
        trackName: placementTrackName,
        markLabel: explicitAnchor.label,
        startMs: explicitAnchor.startMs,
        endMs: explicitAnchor.endMs,
        basis: normText(placement?.timingContext?.alignmentMode || "timing_mark") || "timing_mark",
        boundarySide: markBoundarySide(window, explicitAnchor) || "start"
      }
    };
  }
  const timingBoundary = findTimingBoundaryAnchor({ window, trackName: placementTrackName, marksByTrack });
  if (timingBoundary) {
    return {
      window,
      placementTrackName,
      anchor: {
        kind: "timing_track",
        trackName: placementTrackName,
        markLabel: normText(timingBoundary.mark?.label),
        startMs: Number(timingBoundary.mark?.startMs),
        endMs: Number(timingBoundary.mark?.endMs),
        basis: "timing_boundary",
        boundarySide: timingBoundary.side
      }
    };
  }
  const adjacent = findAdjacentPlacementBoundary({ placement, window, placements });
  if (adjacent) {
    return {
      window,
      placementTrackName,
      anchor: {
        kind: "adjacent_effect",
        trackName: placementTrackName,
        markLabel: "",
        startMs: window.startMs,
        endMs: window.endMs,
        basis: "adjacent_effect",
        boundarySide: adjacent.side,
        adjacentPlacementId: normText(adjacent.other?.placementId)
      }
    };
  }
  const containingMark = findContainingTimingMark({ window, trackName: placementTrackName, marksByTrack });
  if (containingMark) {
    const duration = Math.max(1, window.endMs - window.startMs);
    window = clampPlacementWindow({
      startMs: containingMark.startMs,
      endMs: Number(containingMark.startMs) + duration,
      sequenceSettings
    });
    return {
      window,
      placementTrackName,
      anchor: {
        kind: "timing_track",
        trackName: placementTrackName,
        markLabel: normText(containingMark?.label),
        startMs: Number(containingMark?.startMs),
        endMs: Number(containingMark?.endMs),
        basis: "snapped_to_timing_boundary",
        boundarySide: "start"
      }
    };
  }
  return {
    window,
    placementTrackName,
    anchor: {
      kind: "unresolved",
      trackName: placementTrackName,
      markLabel: "",
      startMs: window.startMs,
      endMs: window.endMs,
      basis: "unanchored_window",
      boundarySide: ""
    }
  };
}

function buildCommandsFromEffectPlacements({
  effectPlacements = [],
  targetIds = [],
  trackName = "XD: Sequencer Plan",
  sectionWindowsByName = null,
  cueTrackMarksByTrack = null,
  sequenceSettings = {},
  groupIds = [],
  displayElements = [],
  groupsById = {},
  effectCatalog = null
} = {}) {
  const placements = normArray(effectPlacements);
  if (!placements.length) {
    return {
      commands: [],
      estimatedImpact: 0,
      validationReady: false
    };
  }
  const marksByTrack = buildPlacementMarksByTrack({
    effectPlacements: placements,
    sectionWindowsByName,
    cueTrackMarksByTrack,
    defaultTrackName: trackName,
    sequenceSettings
  });
  const commands = [];
  const timingInsertCommandIdsByTrack = new Map();
  for (const [markTrackName, marks] of marksByTrack.entries()) {
    if (!marks.length) continue;
    const safeTrackSlug = markTrackName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "track";
    const createId = `timing.track.create:${safeTrackSlug}`;
    const insertId = `timing.marks.insert:${safeTrackSlug}`;
    commands.push({
      id: createId,
      cmd: "timing.createTrack",
      params: {
        trackName: markTrackName,
        replaceIfExists: true
      }
    });
    commands.push({
      id: insertId,
      dependsOn: [createId],
      cmd: "timing.insertMarks",
      params: {
        trackName: markTrackName,
        marks
      }
    });
    timingInsertCommandIdsByTrack.set(markTrackName, insertId);
  }
  const displayTargetIds = Array.from(new Set([
    ...normArray(targetIds).map((row) => normText(row)).filter(Boolean),
    ...placements.map((row) => normText(row.targetId)).filter(Boolean)
  ]));
  const displayOrderCommand = buildDisplayElementOrderCommand({
    targetIds: displayTargetIds,
    displayElements,
    groupIds,
    groupsById,
    trackName
  });
  const effectCommands = placements.map((placement, index) => {
    const placementParameterPriorGuidance = placement?.parameterPriorGuidance && typeof placement.parameterPriorGuidance === "object"
      ? placement.parameterPriorGuidance
      : buildParameterPriorGuidance({
          effectName: placement?.effectName,
          targetIds: [normText(placement?.targetId)].filter(Boolean),
          displayElements,
          intentSummary: [
            normText(placement?.timingContext?.anchorLabel),
            normText(placement?.effectName)
          ].filter(Boolean).join(" "),
          sequencerRevisionBrief: null
        });
    const placementSharedSettingPriorGuidance = placement?.sharedSettingPriorGuidance && typeof placement.sharedSettingPriorGuidance === "object"
      ? placement.sharedSettingPriorGuidance
      : buildSharedSettingPriorGuidance({
          sequencerRevisionBrief: null,
          intentSummary: [
            normText(placement?.timingContext?.anchorLabel),
            normText(placement?.effectName)
          ].filter(Boolean).join(" ")
        });
    const translated = translatePlacementIntentToXlights({
      placement: {
        ...placement,
        sharedSettingPriorGuidance: placementSharedSettingPriorGuidance,
        parameterPriorGuidance: placementParameterPriorGuidance
      },
      effectCatalog
    });
    const anchoredPlacement = resolvePlacementAnchoredWindow({
      placement,
      placements,
      defaultTrackName: trackName,
      marksByTrack,
      sequenceSettings
    });
    const placementTrackName = anchoredPlacement.placementTrackName;
    const window = anchoredPlacement.window;
    return {
      id: placement.placementId || `effect.${index + 1}`,
      designId: normText(placement?.designId),
      designRevision: Number.isInteger(Number(placement?.designRevision)) ? Number(placement.designRevision) : 0,
      designAuthor: normText(placement?.designAuthor),
      dependsOn: [
        ...(timingInsertCommandIdsByTrack.has(placementTrackName) ? [timingInsertCommandIdsByTrack.get(placementTrackName)] : []),
        ...(displayOrderCommand ? [displayOrderCommand.id] : [])
      ],
      anchor: anchoredPlacement.anchor,
      cmd: "effects.create",
      params: {
        modelName: normText(placement.targetId),
        layerIndex: Number(placement.layerIndex),
        effectName: normText(placement.effectName),
        startMs: window.startMs,
        endMs: window.endMs,
        settings: translated.settings,
        palette: translated.palette
      },
      intent: {
        designId: normText(placement?.designId),
        designRevision: Number.isInteger(Number(placement?.designRevision)) ? Number(placement.designRevision) : 0,
        designAuthor: normText(placement?.designAuthor),
        settingsIntent: placement.settingsIntent,
        sharedSettingPriorGuidance: placementSharedSettingPriorGuidance,
        parameterPriorGuidance: placementParameterPriorGuidance,
        paletteIntent: placement.paletteIntent,
        layerIntent: placement.layerIntent,
        renderIntent: placement.renderIntent,
        constraints: placement.constraints
      }
    };
  });
  const sequenceSettingsCommand = buildSequenceSettingsCommand({
    effectCommands,
    groupIds,
    sequenceSettings
  });
  const normalizedEffectCommands = effectCommands.map((row) => {
    if (!sequenceSettingsCommand) return row;
    const dependsOn = Array.isArray(row.dependsOn) ? row.dependsOn.slice() : [];
    if (!dependsOn.includes(sequenceSettingsCommand.id)) dependsOn.push(sequenceSettingsCommand.id);
    return { ...row, dependsOn };
  });
  const commandsOut = commands
    .concat(sequenceSettingsCommand ? [sequenceSettingsCommand] : [])
    .concat(displayOrderCommand ? [displayOrderCommand] : [])
    .concat(normalizedEffectCommands);
  return {
    commands: commandsOut,
    estimatedImpact: normalizedEffectCommands.length,
    validationReady: commandsOut.length > 0
  };
}

function stageCommandGraphSynthesis({
  sourceLines = [],
  effect = {},
  executionStrategy = {},
  sequencingDesignHandoff = null,
  analysisHandoff = {},
  goalText = "",
  warnings = [],
  capabilityCommands = [],
  effectCatalog = null,
  sequenceSettings = {},
  targetIds = [],
  displayElements = [],
  groupIds = [],
  groupsById = {},
  submodelsById = {},
  sectionWindowsByName = null,
  trackName = "XD: Sequencer Plan",
  useAllKnownSections = false,
  allowTimingWrites = true,
  currentSequenceContext = null,
  scope = {}
} = {}) {
  const proposed = normArray(sourceLines).map((line) => normText(line)).filter(Boolean);
  const synthesized = normArray(effect.executionSeedLines).filter(Boolean);
  const passScope = normText(executionStrategy?.passScope);
  const forceSynthesizedForStructuredPass = passScope === "whole_sequence" || passScope === "multi_section";
  const shouldPreferSynthesized = (forceSynthesizedForStructuredPass || Boolean(effect?.preferSynthesized)) && synthesized.length && (
    !proposed.length
    || forceSynthesizedForStructuredPass
    || proposed.every((line) => isGenericExecutionLine(line))
    || proposed.some((line) => !isExecutableSequencingLine(line))
  );
  const executionLines = shouldPreferSynthesized
    ? synthesized
    : (proposed.length ? proposed : synthesized);
  const advertisedCapabilities = Array.isArray(capabilityCommands) ? capabilityCommands.map((row) => normText(row)).filter(Boolean) : [];
  const enableEffectTimingAlignment = !advertisedCapabilities.length || advertisedCapabilities.includes("effects.alignToTiming");
  if (Array.isArray(effect?.effectPlacements) && effect.effectPlacements.length) {
    const cueTrackMarksByTrack = buildCueTrackMarksByTrack({
      analysisHandoff,
      sectionNames: sectionWindowsByName instanceof Map ? Array.from(sectionWindowsByName.keys()) : [],
      includeAll: true
    });
    const placementGraph = buildCommandsFromEffectPlacements({
      effectPlacements: effect.effectPlacements,
      targetIds,
      trackName,
      sectionWindowsByName,
      cueTrackMarksByTrack,
      sequenceSettings,
      groupIds,
      displayElements,
      groupsById,
      effectCatalog
    });
    const capabilityGate = evaluateSequencePlanCapabilities({ commands: placementGraph.commands, capabilityCommands });
    if (!capabilityGate.ok) {
      const err = new Error(capabilityGate.errors.join("; ") || "capability gate failed");
      err.failureCategory = "capability";
      throw err;
    }
    if (Array.isArray(capabilityGate.warnings) && capabilityGate.warnings.length) {
      warnings.push(...capabilityGate.warnings);
    }
    const effectCompat = evaluateEffectCommandCompatibility({ commands: placementGraph.commands, effectCatalog });
    if (!effectCompat.ok) {
      const err = new Error(effectCompat.errors.join("; ") || "effect compatibility gate failed");
      err.failureCategory = "validate";
      throw err;
    }
    if (Array.isArray(effectCompat.warnings) && effectCompat.warnings.length) {
      warnings.push(...effectCompat.warnings);
    }
    const clonePlanning = applyExplicitClonePlanning({
      commands: placementGraph.commands,
      currentSequenceContext,
      sourceLines,
      executionStrategy,
      scope,
      targetIds,
      displayElements,
      capabilityCommands,
      warnings
    });
    const preservedCommands = clonePlanning.cloned
      ? clonePlanning.commands
      : applyExistingSequencePreservation({
          commands: placementGraph.commands,
          currentSequenceContext,
          sourceLines,
          executionStrategy,
          scope,
          capabilityCommands,
          warnings
        });
    const orderedCommands = applyExplicitDisplayOrderPlanning({
      commands: preservedCommands,
      sourceLines,
      executionStrategy,
      scope,
      displayElements,
      capabilityCommands,
      warnings
    });
    return {
      commands: decorateCommandsWithDesignMetadata(orderedCommands, executionStrategy),
      executionLines: [],
      estimatedImpact: orderedCommands.length,
      warnings,
      validationReady: Boolean(orderedCommands.length),
      detail: `placementCommands=${Array.isArray(placementGraph.commands) ? placementGraph.commands.length : 0} capabilities=${capabilityGate.requiredCapabilities.length}`
    };
  }
  const groupRenderWarnings = collectGroupRenderPolicyWarnings(executionLines, { groupIds, groupsById });
  if (groupRenderWarnings.length) warnings.push(...groupRenderWarnings);
  const submodelRenderWarnings = collectSubmodelRenderWarnings(executionLines, { submodelsById, targetIds });
  if (submodelRenderWarnings.length) warnings.push(...submodelRenderWarnings);
  if (!enableEffectTimingAlignment) {
    warnings.push("effects.alignToTiming capability unavailable; effect windows will remain static timing-aligned ranges instead of explicit timing re-alignment commands.");
  }
  let commands = buildDesignerPlanCommands(executionLines, {
    trackName,
    targetIds,
    effectCatalog,
    sequenceSettings,
    displayElements,
    groupIds,
    groupsById,
    submodelsById,
    sectionWindowsByName,
    useAllKnownSections,
    enableEffectTimingAlignment
  });
  const requestedCueTrackNames = inferRequestedCueTimingTracks({
    goal: goalText,
    sourceLines: executionLines,
    executionStrategy,
    sequencingDesignHandoff
  });
  const cueTrackMarksByTrack = requestedCueTrackNames.length
    ? buildCueTrackMarksByTrack({
        analysisHandoff,
        sectionNames: sectionWindowsByName instanceof Map ? Array.from(sectionWindowsByName.keys()) : [],
        includeAll: true
      })
    : new Map();
  commands = retargetFallbackEffectsToCueTiming({
    commands,
    requestedTrackNames: requestedCueTrackNames,
    cueTrackMarksByTrack,
    sequenceSettings
  });
  const existingTimingWriteTracks = new Set(
    normArray(commands)
      .filter((command) => {
        const cmd = normText(command?.cmd);
        return cmd === "timing.createTrack" || cmd === "timing.insertMarks" || cmd === "timing.replaceMarks";
      })
      .map((command) => normText(command?.params?.trackName))
      .filter(Boolean)
  );
  const requestedCueTimingCommands = buildRequestedCueTimingCommands({
    analysisHandoff,
    sectionNames: sectionWindowsByName instanceof Map ? Array.from(sectionWindowsByName.keys()) : [],
    requestedTrackNames: requestedCueTrackNames.filter((track) => !existingTimingWriteTracks.has(track)),
    sequenceSettings,
    allowTimingWrites,
    warnings
  });
  const filteredCommands = [];
  for (const command of [...requestedCueTimingCommands, ...commands]) {
    const cmd = normText(command?.cmd);
    const trackName = normText(command?.params?.trackName);
    const isTimingWrite = cmd === "timing.createTrack" || cmd === "timing.insertMarks" || cmd === "timing.replaceMarks";
    if (isTimingWrite && trackName.startsWith("XD:")) {
      if (!allowTimingWrites) {
        warnings.push(`Timing write skipped: ${trackName} blocked because timing writes are disabled.`);
        continue;
      }
    }
    filteredCommands.push(command);
  }
  const commandsOut = decorateCommandsWithDesignMetadata(filteredCommands, executionStrategy);
  const explicitPlanningSourceLines = uniqueNormTexts([...sourceLines, ...executionLines]);
  const clonePlanningOut = applyExplicitClonePlanning({
    commands: commandsOut,
    currentSequenceContext,
    sourceLines: explicitPlanningSourceLines,
    executionStrategy,
    scope,
    targetIds,
    displayElements,
    capabilityCommands,
    warnings
  });
  const preservedCommandsOut = clonePlanningOut.cloned
    ? clonePlanningOut.commands
    : applyExistingSequencePreservation({
        commands: commandsOut,
        currentSequenceContext,
        sourceLines: explicitPlanningSourceLines,
        executionStrategy,
        scope,
        capabilityCommands,
        warnings
      });
  const displayOrderedCommandsOut = applyExplicitDisplayOrderPlanning({
    commands: preservedCommandsOut,
    sourceLines: explicitPlanningSourceLines,
    executionStrategy,
    scope,
    displayElements,
    capabilityCommands,
    warnings
  });
  const capabilityGate = evaluateSequencePlanCapabilities({ commands: displayOrderedCommandsOut, capabilityCommands });
  if (!capabilityGate.ok) {
    const err = new Error(capabilityGate.errors.join("; ") || "capability gate failed");
    err.failureCategory = "capability";
    throw err;
  }
  if (Array.isArray(capabilityGate.warnings) && capabilityGate.warnings.length) {
    warnings.push(...capabilityGate.warnings);
  }
  const effectCompat = evaluateEffectCommandCompatibility({ commands: displayOrderedCommandsOut, effectCatalog });
  if (!effectCompat.ok) {
    const err = new Error(effectCompat.errors.join("; ") || "effect compatibility gate failed");
    err.failureCategory = "validate";
    throw err;
  }
  if (Array.isArray(effectCompat.warnings) && effectCompat.warnings.length) {
    warnings.push(...effectCompat.warnings);
  }
  return {
    commands: displayOrderedCommandsOut,
    executionLines,
    estimatedImpact: displayOrderedCommandsOut.length === 1 && normText(displayOrderedCommandsOut[0]?.cmd) === "sequencer.setDisplayElementOrder"
      ? 1
      : estimateImpactCount(executionLines),
    warnings,
    validationReady: Array.isArray(displayOrderedCommandsOut) && displayOrderedCommandsOut.length > 0,
    detail: `commands=${Array.isArray(displayOrderedCommandsOut) ? displayOrderedCommandsOut.length : 0} capabilities=${capabilityGate.requiredCapabilities.length}`
  };
}

function runStage({ stage = "", fn, stageTelemetry = [] } = {}) {
  const startedAt = nowMs();
  try {
    const out = fn();
    const finishedAt = nowMs();
    stageTelemetry.push({
      stage,
      status: "ok",
      detail: normText(out?.detail),
      durationMs: Math.max(0, finishedAt - startedAt)
    });
    return out;
  } catch (err) {
    const finishedAt = nowMs();
    const message = String(err?.message || err || "unknown stage error");
    const failureCategory = normText(err?.failureCategory) || classifyStageFailure(stage);
    stageTelemetry.push({
      stage,
      status: "error",
      detail: message,
      durationMs: Math.max(0, finishedAt - startedAt),
      failureCategory
    });
    const wrapped = new Error(`sequence_agent stage ${stage} failed: ${message}`);
    wrapped.stage = stage;
    wrapped.failureCategory = failureCategory;
    wrapped.stageTelemetry = stageTelemetry.slice();
    throw wrapped;
  }
}

export function buildSequenceAgentPlan({
  analysisHandoff = null,
  intentHandoff = null,
  sequencingDesignHandoff = null,
  sequenceArtisticGoal = null,
  sequenceRevisionObjective = null,
  priorPassMemory = null,
  revisionRetryPressure = null,
  revisionFeedback = null,
  sourceLines = [],
  baseRevision = "unknown",
  capabilityCommands = [],
  effectCatalog = null,
  sequenceSettings = {},
  layoutMode = "2d",
  displayElements = [],
  groupIds = [],
  groupsById = {},
  submodelsById = {},
  timingOwnership = [],
  allowTimingWrites = true,
  metadataAssignments = [],
  renderValidationEvidence = null,
  candidateSelectionContext = null,
  currentSequenceContext = null,
  stageOverrides = {}
} = {}) {
  const warnings = [];
  const stageTelemetry = [];
  const hasIntent = Boolean(intentHandoff && typeof intentHandoff === "object");
  if (!hasIntent) throw new Error("intent_handoff_v1 is required for sequence_agent planning.");
  const hasAnalysis = Boolean(analysisHandoff && typeof analysisHandoff === "object");
  if (!hasAnalysis) {
    warnings.push("analysis_handoff_v1 missing; running reduced-confidence plan synthesis.");
  }
  const normalizedLayoutMode = normLayoutMode(layoutMode);
  if (normalizedLayoutMode === "2d") {
    warnings.push("Layout mode is 2D: depth semantics allowed, camera/projection-specific 3D operations are disabled.");
  }

  const safeAnalysis = hasAnalysis ? analysisHandoff : {};
  const safeIntent = intentHandoff;
  const effectiveSequenceSettings = deriveEffectiveSequenceSettings({
    sequenceSettings,
    analysisHandoff: safeAnalysis
  });

  const scope = runStage({
    stage: STAGE_ORDER[0],
    stageTelemetry,
    fn: () => (typeof stageOverrides.scope_resolution === "function"
      ? stageOverrides.scope_resolution({ analysisHandoff: safeAnalysis, intentHandoff: safeIntent, sequencingDesignHandoff, sourceLines })
      : stageScopeResolution({ analysisHandoff: safeAnalysis, intentHandoff: safeIntent, sequencingDesignHandoff, sourceLines }))
  });

  const sequencerRevisionBrief = buildSequencerRevisionBrief({
    sequenceArtisticGoal,
    sequenceRevisionObjective,
    sequencingDesignHandoff: scope.sequencingDesignHandoff,
    priorPassMemory: priorPassMemory && typeof priorPassMemory === "object" ? priorPassMemory : null,
    revisionRetryPressure: revisionRetryPressure && typeof revisionRetryPressure === "object" ? revisionRetryPressure : null,
    revisionFeedback: revisionFeedback && typeof revisionFeedback === "object" ? revisionFeedback : null
  });

  const timing = runStage({
    stage: STAGE_ORDER[1],
    stageTelemetry,
    fn: () => (typeof stageOverrides.timing_asset_decision === "function"
      ? stageOverrides.timing_asset_decision({ hasAnalysis, scope })
      : stageTimingAssetDecision({ hasAnalysis, scope }))
  });

  const effect = runStage({
    stage: STAGE_ORDER[2],
    stageTelemetry,
    fn: () => (typeof stageOverrides.effect_strategy === "function"
      ? stageOverrides.effect_strategy({ scope, analysisHandoff: safeAnalysis, timing })
      : stageEffectStrategy({ scope, analysisHandoff: safeAnalysis, timing, displayElements, effectCatalog, metadataAssignments, sequencerRevisionBrief }))
  });

  const resolvedCandidateSelectionContext = candidateSelectionContext && typeof candidateSelectionContext === "object"
      ? candidateSelectionContext
      : buildCandidateSelectionContext({
        requestId: baseRevision,
        phase: "plan",
        sequenceRevision: baseRevision,
        priorPassMemory,
        revisionRetryPressure,
        renderValidationEvidence,
        revisionFeedback
      });

  const intentEnvelope = buildIntentEnvelopeV1({
    translationIntent: scope?.executionStrategy?.translationIntent,
    sequenceArtisticGoal,
    sequenceRevisionObjective,
    sequencerRevisionBrief,
    scope,
    sequencingDesignHandoff: scope.sequencingDesignHandoff
  });
  const realizationCandidates = buildRealizationCandidatesV1({
    intentEnvelope,
    effectStrategy: effect,
    scope,
    displayElements,
    effectCatalog,
    translationIntent: scope?.executionStrategy?.translationIntent,
    priorPassMemory,
    sequencerRevisionBrief,
    revisionFeedback
  });
  const candidateSelection = buildCandidateSelectionV1({
    intentEnvelope,
    realizationCandidates,
    renderValidationEvidence,
    selectionSeed: resolvedCandidateSelectionContext?.explorationEnabled ? resolvedCandidateSelectionContext?.seed : "",
    selectionContext: resolvedCandidateSelectionContext
  });
  const candidateChoice = chooseCandidateFromSelection({
    realizationCandidates,
    candidateSelection
  });
  const effectiveEffectStrategy = projectChosenCandidateToEffectStrategy({
    baseEffectStrategy: effect,
    chosenCandidate: candidateChoice?.chosenCandidate
  });
  const revisionDelta = buildRevisionDeltaV1({
    priorPassMemory,
    effectStrategy: effectiveEffectStrategy,
    chosenCandidate: candidateChoice?.chosenCandidate
  });
  const computedRevisionRetryPressure = buildRevisionRetryPressureV1({
    priorPassMemory,
    candidateSelection,
    revisionDelta
  });

  const graph = runStage({
    stage: STAGE_ORDER[3],
    stageTelemetry,
    fn: () => (typeof stageOverrides.command_graph_synthesis === "function"
      ? stageOverrides.command_graph_synthesis({ sourceLines, effect: effectiveEffectStrategy, warnings })
        : stageCommandGraphSynthesis({
          sourceLines,
          effect: effectiveEffectStrategy,
          executionStrategy: scope.executionStrategy,
          scope,
          analysisHandoff: safeAnalysis,
          warnings,
          capabilityCommands,
          effectCatalog,
          sequenceSettings: effectiveSequenceSettings,
          sequencingDesignHandoff: scope.sequencingDesignHandoff,
          targetIds: scope.targetIds,
          goalText: scope.goal,
          displayElements,
          groupIds,
          groupsById,
          submodelsById,
          sectionWindowsByName: deriveSectionWindowsByName({
            analysisHandoff: safeAnalysis,
            sectionNames: scope.sectionNames,
            includeAll: timing.includeAllKnownSections === true
          }),
          trackName: timing.trackName,
          useAllKnownSections: timing.includeAllKnownSections === true,
          allowTimingWrites,
          currentSequenceContext
        }))
  });

  const commandsOut = Array.isArray(graph.commands) ? graph.commands : [];
  const metadata = {
    layoutMode: normalizedLayoutMode,
    sequenceSettings: effectiveSequenceSettings,
    displayElementCount: Array.isArray(displayElements) ? displayElements.length : 0,
    groupCount: Array.isArray(groupIds) ? groupIds.length : 0,
    groupGraphCount: groupsById && typeof groupsById === "object" ? Object.keys(groupsById).length : 0,
    submodelGraphCount: submodelsById && typeof submodelsById === "object" ? Object.keys(submodelsById).length : 0,
    mode: scope.mode,
    scope: {
      sections: scope.sectionNames,
      targetIds: scope.targetIds,
      tagNames: scope.tagNames
    },
    degradedMode: !hasAnalysis,
    sectionNames: scope.sectionNames,
    targetIds: scope.targetIds,
    tagNames: scope.tagNames,
    stageOrder: STAGE_ORDER.slice(),
    executionStrategy: scope.executionStrategy,
    sequencingDesignHandoff: scope.sequencingDesignHandoff,
    sequenceArtisticGoal: sequenceArtisticGoal && typeof sequenceArtisticGoal === "object" ? sequenceArtisticGoal : null,
    sequenceRevisionObjective: sequenceRevisionObjective && typeof sequenceRevisionObjective === "object" ? sequenceRevisionObjective : null,
    priorPassMemory: priorPassMemory && typeof priorPassMemory === "object" ? priorPassMemory : null,
    sequencerRevisionBrief,
    revisionFeedback: revisionFeedback && typeof revisionFeedback === "object" ? revisionFeedback : null,
    requestScopeMode: normText(sequencerRevisionBrief?.requestScopeMode),
    reviewStartLevel: normText(sequencerRevisionBrief?.reviewStartLevel),
    sectionScopeKind: normText(sequencerRevisionBrief?.sectionScopeKind),
    designIds: Array.from(new Set(normArray(scope?.executionStrategy?.effectPlacements).map((row) => normText(row?.designId)).filter(Boolean))),
    designAuthors: Array.from(new Set([
      normText(scope?.executionStrategy?.designAuthor),
      ...normArray(scope?.executionStrategy?.sectionPlans).map((row) => normText(row?.designAuthor)),
      ...normArray(scope?.executionStrategy?.effectPlacements).map((row) => normText(row?.designAuthor))
    ].filter(Boolean))),
    effectPlacementCount: Array.isArray(scope?.executionStrategy?.effectPlacements)
      ? scope.executionStrategy.effectPlacements.length
      : 0,
    sequencingDesignHandoffSummary: normText(scope?.sequencingDesignHandoff?.designSummary),
    sequencingSectionDirectiveCount: Array.isArray(scope?.sequencingDesignHandoff?.sectionDirectives)
      ? scope.sequencingDesignHandoff.sectionDirectives.length
      : 0,
    trainingKnowledge: buildStage1TrainingKnowledgeMetadata(),
    parameterTrainingKnowledge: buildDerivedParameterKnowledgeMetadata(),
    sharedSettingTrainingKnowledge: buildCrossEffectSharedSettingsKnowledgeMetadata(),
    effectStrategy: {
      toneHint: normText(effectiveEffectStrategy?.toneHint),
      preferSynthesized: Boolean(effectiveEffectStrategy?.preferSynthesized),
      strategy: normText(effectiveEffectStrategy?.strategy),
      seedRecommendations: normArray(effectiveEffectStrategy?.seedRecommendations),
      selectedCandidateId: normText(effectiveEffectStrategy?.selectedCandidateId),
      selectedCandidateSummary: normText(effectiveEffectStrategy?.selectedCandidateSummary)
    },
    revisionDelta,
    revisionRetryPressure: computedRevisionRetryPressure,
    intentEnvelope,
    realizationCandidates,
    candidateSelection,
    candidateChoice: {
      chosenCandidateId: normText(candidateChoice?.chosenCandidateId),
      selectionMode: normText(candidateChoice?.selectionMode),
      selectedFromBand: Boolean(candidateChoice?.selectedFromBand)
    },
    candidateSelectionContext: resolvedCandidateSelectionContext,
    currentSequenceContext: sanitizeCurrentSequenceContextForPlan(currentSequenceContext),
    metadataAssignments: sanitizeMetadataAssignmentsForPlanMetadata(metadataAssignments),
    renderValidationEvidence: sanitizeRenderValidationEvidence(renderValidationEvidence)
  };
  metadata.passExecution = buildPassExecutionPolicy({
    scope,
    executionStrategy: scope.executionStrategy,
    commands: commandsOut,
    baseRevision,
    renderValidationEvidence: metadata.renderValidationEvidence,
    currentSequenceContext: metadata.currentSequenceContext
  });
  metadata.artifactRefs = buildPlanArtifactRefs(metadata);
  metadata.generativeSummary = buildCompactGenerativeSummary(metadata);
  metadata.handoffScale = buildPlanHandoffScaleTelemetry({ commands: commandsOut, metadata });

  const plan = {
    agentRole: SEQUENCE_AGENT_ROLE,
    contractVersion: SEQUENCE_AGENT_CONTRACT_VERSION,
    planId: `seq-plan-${Date.now()}`,
    summary: buildPlanSummary({ goal: scope.goal, mode: scope.mode, sectionNames: scope.sectionNames }),
    estimatedImpact: Number(graph.estimatedImpact || 0),
    warnings: Array.isArray(graph.warnings) ? graph.warnings : warnings,
    commands: commandsOut,
    baseRevision: normText(baseRevision) || "unknown",
    validationReady: Boolean(graph.validationReady),
    executionLines: Array.isArray(graph.executionLines) ? graph.executionLines : [],
    stageTelemetry,
    metadata
  };
  plan.createdAt = new Date().toISOString();
  plan.artifactId = buildArtifactId(SEQUENCE_AGENT_PLAN_OUTPUT_CONTRACT, plan);
  return plan;
}

export { buildPriorPassMemory };
