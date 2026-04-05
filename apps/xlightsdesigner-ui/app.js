import {
  beginTransaction,
  closeSequence,
  commitTransaction,
  cancelJob,
  createSequence,
  applySequencingBatchPlan,
  getOwnedHealth,
  getOwnedSequenceRevision,
  getJob,
  getOwnedJob,
  getMediaStatus,
  getMediaMetadata,
  getDisplayElementOrder,
  getModelGroupMembers,
  getModels,
  getLayoutScene,
  getOpenSequence,
  getRevision,
  getSubmodelDetail,
  getSubmodels,
  getSystemVersion,
  saveSequence,
  getTimingMarks,
  getTimingTracks,
  getEffectDefinitions,
  listEffects,
  rollbackTransaction,
  stageTransactionCommand,
  createTimingTrack,
  replaceTimingMarks,
  insertTimingMarks,
  openSequence,
  validateCommands,
  pingCapabilities
} from "./api.js";
import {
  buildCreativeBriefArtifact
} from "./agent/designer-dialog/designer-dialog-runtime.js";
import { executeDesignerProposalOrchestration } from "./agent/designer-dialog/designer-dialog-orchestrator.js";
import { executeDirectSequenceRequestOrchestration } from "./agent/sequence-agent/direct-sequence-orchestrator.js";
import {
  applyDesignerProposalSuccessToState,
  buildDesignerCompletionMessage,
  buildDesignerGuidedQuestionMessage
} from "./agent/designer-dialog/designer-dialog-ui-state.js";
import {
  applyDesignerDraftSuccessState,
  clearDesignerDraft,
  markDesignerDraftStale,
  rebaseDesignerDraft,
  syncDesignerDraftFlags
} from "./agent/designer-dialog/designer-dialog-draft-state.js";
import {
  mergeRevisedDesignConceptExecutionPlan,
  normalizeDesignRevisionTarget
} from "./agent/designer-dialog/design-concept-revision.js";
import { buildDesignSceneContext } from "./agent/designer-dialog/design-scene-context.js";
import { buildMusicDesignContext } from "./agent/designer-dialog/music-design-context.js";
import {
  buildSequenceSession,
  explainSequenceSessionBlockers,
  isPathWithinShowFolder,
  isSequenceAllowedInShowFolder,
  readSequencePathFromPayload
} from "./runtime/sequence-session.js";
import {
  applyAcceptedProposalToDirectorProfile,
  buildDefaultDirectorProfile,
  normalizeDirectorProfile
} from "./agent/designer-dialog/director-profile.js";
import {
  buildArtifactRefs,
  buildHistoryEntry,
  buildHistorySnapshotSummary
} from "./agent/shared/history-entry.js";
import { buildArtifactId } from "./agent/shared/artifact-ids.js";
import {
  inferBufferStyleFamily,
  inferRenderRiskLevel,
  parseSubmodelParentId
} from "./agent/shared/target-semantics-registry.js";
import {
  isControlledMetadataTag,
  mergeMetadataTagRecords,
  normalizeMetadataTagName,
  toStoredMetadataTagRecords
} from "./runtime/metadata-tag-schema.js";
import { buildEffectiveMetadataAssignments as buildRuntimeEffectiveMetadataAssignments } from "./runtime/effective-metadata-assignments.js";
import {
  buildTimingTrackProvenanceRecord,
  normalizeTimingTrackCoverage,
  refreshTimingTrackProvenanceRecord,
  splitMarksAtBoundaries
} from "./runtime/timing-track-provenance.js";
import {
  buildTimingTrackStatusRows
} from "./runtime/timing-track-status.js";
import {
  buildGlobalXdTrackPolicyKey,
  createTimingTrackRuntime
} from "./runtime/timing-track-runtime.js";
import {
  mergeVisualHintDefinitions,
  ensureVisualHintDefinitions,
  defineVisualHint,
  toStoredVisualHintDefinitions
} from "./runtime/visual-hint-definitions.js";
import { parseExplicitVisualHintDefinitionIntent } from "./runtime/visual-hint-definition-intent.js";
import { validateTrainingAgentRegistry } from "./agent/agent-registry-validator.js";
import {
  buildDesignerPlanCommands as buildDesignerPlanCommandsFromLines,
  estimateImpactCount
} from "./agent/sequence-agent/command-builders.js";
import { buildSequenceAgentPlan } from "./agent/sequence-agent/sequence-agent.js";
import { evaluateSequencePlanCapabilities } from "./agent/sequence-agent/sequence-capability-gate.js";
import { classifyModelDisplayType } from "./agent/sequence-agent/model-type-catalog.js";
import { buildEffectDefinitionCatalog, emptyEffectDefinitionCatalog } from "./agent/sequence-agent/effect-definition-catalog.js";
import {
  buildSequenceAgentApplyResult,
  buildSequenceAgentInput,
  classifyOrchestrationFailureReason,
  validateSequenceAgentContractGate
} from "./agent/sequence-agent/sequence-agent-runtime.js";
import {
  AGENT_HANDOFF_CONTRACTS,
  validateAgentHandoff
} from "./agent/handoff-contracts.js";
import { analyzeAudioContext } from "./agent/audio-analyst/audio-analyzer.js";
import {
  buildAnalysisArtifactFromPipelineResult,
  buildAnalysisHandoffFromArtifact,
  buildAudioAnalystInput,
  executeAudioAnalystFlow,
  inspectAnalysisArtifactFreshness
} from "./agent/audio-analyst/audio-analyst-runtime.js";
import { buildAudioAnalysisQualityReport } from "./agent/audio-analyst/audio-analysis-quality.js";
import {
  resetAudioAnalysisView,
  buildPendingAudioAnalysisPipeline,
  setAudioAnalysisProgress,
  applyPersistedAnalysisArtifactToState,
  applyAudioAnalystFlowSuccessToState,
  applyAudioAnalystFlowFailureToState
} from "./agent/audio-analyst/audio-analyst-ui-state.js";
import {
  normalizeAudioAnalysisProvider
} from "./agent/audio-analyst/audio-provider-adapters.js";
import { runAudioAnalysisOrchestration } from "./agent/audio-analyst/audio-analysis-orchestrator.js";
import { buildOwnedSequencingBatchPlan, validateAndApplyPlan } from "./agent/sequence-agent/orchestrator.js";
import { validateCommandGraph } from "./agent/sequence-agent/command-graph.js";
import { timingMarksSignature, verifyAppliedPlanReadback as verifyAppliedPlanReadbackWithDeps } from "./agent/sequence-agent/apply-readback.js";
import { executeAppAssistantConversation } from "./agent/app-assistant/app-assistant-orchestrator.js";
import {
  DEFAULT_TEAM_CHAT_IDENTITIES,
  buildTeamChatIdentities,
  resolveTeamChatIdentity
} from "./agent/app-assistant/app-assistant-contracts.js";
import { buildPageStates } from "./app-ui/page-state/index.js";
import { buildNormalizedTargetMetadataRecords } from "./runtime/target-metadata-runtime.js";
import { runDirectSequenceValidation } from "./runtime/clean-sequence-runtime.js";
import { fetchXLightsRevisionState, syncXLightsRevisionState } from "./runtime/xlights-runtime.js";
import { executeApplyCore } from "./runtime/review-runtime.js";
import { createAutomationBridgeRuntime } from "./runtime/automation-bridge-runtime.js";
import { createAudioAnalysisSessionRuntime } from "./runtime/audio-analysis-session-runtime.js";
import { createAudioAnalysisPipelineRuntime } from "./runtime/audio-analysis-pipeline-runtime.js";
import { createSequenceMediaSessionRuntime } from "./runtime/sequence-media-session-runtime.js";
import { createProjectLifecycleRuntime } from "./runtime/project-lifecycle-runtime.js";
import { createAgentRuntimeState } from "./runtime/agent-runtime-state.js";
import { createProposalGenerationRuntime } from "./runtime/proposal-generation-runtime.js";
import { createApplyReviewRuntime } from "./runtime/apply-review-runtime.js";
import { createApplyReadinessRuntime } from "./runtime/apply-readiness-runtime.js";
import { createProjectHistoryRuntime } from "./runtime/project-history-runtime.js";
import {
  getDesktopBridge,
  getDesktopStateBridge,
  getDesktopAppInfoBridge,
  getDesktopAppAdminBridge,
  getDesktopSidecarBridge,
  getDesktopFileStatBridge,
  getDesktopMediaBridge,
  getDesktopMediaIdentityBridge,
  getDesktopBackupBridge,
  getDesktopDiagnosticsBridge,
  getDesktopSequenceBridge,
  getDesktopMediaCatalogBridge,
  getDesktopAgentLogBridge,
  getDesktopAgentConversationBridge,
  getDesktopAgentConfigBridge,
  getDesktopAudioAnalysisBridge,
  getDesktopAnalysisArtifactBridge,
  getDesktopProjectArtifactBridge,
  getDesktopTrainingPackageBridge,
  getDesktopSequenceDialogBridge,
  getDesktopProjectBridge,
  getDesktopBridgeHealth,
  getDesktopFileDialogBridge,
  normalizeDialogPathSelection
} from "./runtime/desktop-bridge-runtime.js";
import { createUiCompositionRuntime } from "./runtime/ui-composition-runtime.js";
import { createProjectCatalogRuntime } from "./runtime/project-catalog-runtime.js";
import { createAnalysisServiceRuntime } from "./runtime/analysis-service-runtime.js";
import { createAgentSupportRuntime, emptyAgentRuntimeState } from "./runtime/agent-support-runtime.js";
import { buildScreenContent } from "./app-ui/screens.js";
import { buildAppShell } from "./app-ui/shell.js";
import { bindTeamChatEvents } from "./app-ui/chat-bindings.js";
import { bindScreenEvents } from "./app-ui/screen-bindings.js";
import {
  classifyDepthBands,
  collectSpatialNodes,
  computeSceneBounds,
  inferLayoutMode
} from "./agent/sequence-agent/scene-graph-queries.js";

const app = document.getElementById("app");
const STORAGE_KEY = "xlightsdesigner.ui.state.v1";
const PROJECTS_KEY = "xlightsdesigner.ui.projects.v1";
const RESET_PRESERVE_KEY = "xlightsdesigner.ui.reset-preserve.v1";
function detectDevProxyXLightsEndpoint() {
  try {
    const origin = String(window?.location?.origin || "").trim();
    if (/^https?:\/\/(127\.0\.0\.1|localhost):8080$/i.test(origin)) {
      return `${origin}/xlDoAutomation`;
    }
  } catch {
    // ignore window/location access failures
  }
  return "";
}

const DIRECT_PREFERRED_XLIGHTS_ENDPOINT = "http://127.0.0.1:49914/xlDoAutomation";
const DEV_PROXY_XLIGHTS_ENDPOINT = detectDevProxyXLightsEndpoint();
const PREFERRED_XLIGHTS_ENDPOINT = DEV_PROXY_XLIGHTS_ENDPOINT || DIRECT_PREFERRED_XLIGHTS_ENDPOINT;
const FALLBACK_XLIGHTS_ENDPOINTS = [
  DEV_PROXY_XLIGHTS_ENDPOINT,
  "http://127.0.0.1:49913/xlDoAutomation",
  "http://127.0.0.1:49914/xlDoAutomation"
].filter(Boolean);
const DESKTOP_STATE_SYNC_DEBOUNCE_MS = 250;
const CONNECTIVITY_POLL_MS = 10000;
const FOCUS_SYNC_COOLDOWN_MS = 1200;
const QUICK_RECONNECT_DELAY_MS = 3000;
const ENDPOINT_PROBE_TIMEOUT_MS = 1800;
const DEFAULT_ANALYSIS_SERVICE_URL = "http://127.0.0.1:5055";
const DEFAULT_PROPOSED_ROWS = 5;
const PROPOSED_ROWS_STEP = 5;
const CHAT_QUICK_PROMPTS_BY_ROUTE = {
  project: [
    "Help me set up the show folder and project root for this install.",
    "What should I configure before I start working on a sequence?",
    "Check whether this project is ready for first use."
  ],
  audio: [
    "Analyze this song and tell me what structure you found.",
    "Re-run audio analysis and focus on beats, bars, and section boundaries.",
    "Explain what changed in the current audio artifact."
  ],
  sequence: [
    "Show me how the current design is translating into sequence changes.",
    "Refresh the sequence view and summarize the active technical scope.",
    "What in the current sequence translation needs attention before review?"
  ],
  design: [
    "Build a first design proposal from the current brief and references.",
    "Make chorus 2 higher energy on MegaTree and Roofline.",
    "Rework bridge section with calmer color transitions."
  ],
  review: [
    "Summarize what will change if I apply this plan.",
    "Tell me what warnings I should review before I apply.",
    "Hey Patch, make the trees less blinky in Chorus 3."
  ],
  metadata: [
    "Review the layout details that would improve sequencing quality most.",
    "Which props or submodels need more layout detail before I sequence?",
    "Walk me through the highest-impact layout updates first."
  ],
  settings: [
    "Help me connect xLights and explain what endpoint settings matter.",
    "Check whether cloud chat and audio analysis services are configured correctly.",
    "Explain what Save, Save As, and project root mean in this app."
  ],
  history: [
    "Summarize the latest apply history for this project.",
    "Compare the current draft to the last version snapshot.",
    "Help me understand when I should reapply a prior variant."
  ],
  fallback: [
    "Help me figure out the next step in this project.",
    "Summarize the current state of the project and what is ready.",
    "Tell me which specialist should handle my next request."
  ]
};
const INLINE_CHIP_MODEL_FALLBACKS = ["MegaTree", "Roofline", "Candy Canes", "Matrix", "Arches", "CandyCane"];
const SUPPORTED_SEQUENCE_MEDIA_EXTENSIONS = new Set([
  "mp3", "ogg", "m4p", "mp4", "m4a", "aac",
  "wav", "flac", "wma", "au", "avi",
  "mid", "mkv", "mov", "mpg", "asf",
  "flv", "mpeg", "wmv"
]);
const REFERENCE_MEDIA_ALLOWED_EXTENSIONS = new Set([
  "jpg", "jpeg", "png", "gif", "webp",
  "mp4", "m4v", "mov", "avi", "mpg", "mpeg"
]);
const REFERENCE_MEDIA_MAX_FILE_BYTES = 250 * 1024 * 1024;
const REFERENCE_MEDIA_MAX_ITEMS = 40;

window.addEventListener("error", (event) => {
  const message = String(event?.message || "Unknown renderer error");
  const source = String(event?.filename || "unknown");
  const line = Number(event?.lineno || 0);
  const column = Number(event?.colno || 0);
  console.error(`[renderer:error] ${message} @ ${source}:${line}:${column}`);
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event?.reason;
  const message = typeof reason === "string"
    ? reason
    : String(reason?.stack || reason?.message || reason || "Unknown unhandled rejection");
  console.error(`[renderer:unhandledrejection] ${message}`);
});

function buildDemoProposedLines() {
  return [
    "Verse 1 / MegaTree + Roofline / soften intensity, cool-blue shimmer with slow rise.",
    "Pre-Chorus / Candy Canes / tighten chases and add alternating white accents.",
    "Chorus 1 / Arches / increase energy with layered wipes + sparkle peaks on downbeats.",
    "Chorus 1 / Matrix / add lyric-synced bursts on key words for emphasis.",
    "Post-Chorus / House Outline / hold warm amber glow with gentle breathing pulse.",
    "Verse 2 / Bushes + Mini Trees / introduce twinkle bed with subtle hue rotation.",
    "Build / Whole yard / ramp tempo perception using staggered chases by depth.",
    "Chorus 2 / MegaTree / higher contrast color transitions, reduce muddy mid-tones.",
    "Chorus 2 / Roofline / mirror MegaTree rhythm with delayed echo motion.",
    "Bridge / Background props / create calm starfield, de-emphasize foreground movement.",
    "Bridge / Window Frames / slow color drift to support quieter emotional tone.",
    "Final Chorus / Whole yard / full-spectrum sweep then converge to hero color.",
    "Final Chorus / Candy Canes / reduce twinkle density by 35% for readability.",
    "Outro / Matrix / fade to silhouette with sparse white spark accents.",
    "Outro / Arch line / cascading dim-down from center outward.",
    "Global / Timing refinements / align transitions to phrase boundaries on XD: Mood.",
    "Global / Depth pass / push rear elements cooler and front elements warmer.",
    "Global / Cleanup / remove conflicting overlapping effects in chorus transitions."
  ];
}

const defaultState = {
  route: "settings",
  endpoint: PREFERRED_XLIGHTS_ENDPOINT,
  projectName: "",
  projectConcept: "",
  showFolder: "",
  mediaPath: "",
  projectMetadataRoot: "/Users/robterry/Documents/Lights/xLightsDesigner",
  projectFilePath: "",
  safety: {
    applyConfirmMode: "large-only",
    largeChangeThreshold: 60,
    sequenceSwitchUnsavedPolicy: "save-if-needed",
    agentApplyRollout: "full"
  },
  activeSequence: "",
  sequencePathInput: "",
  newSequencePathInput: "",
  newSequenceType: "musical",
  newSequenceDurationMs: 180000,
  newSequenceFrameMs: 50,
  audioPathInput: "",
  sequenceMediaFile: "",
  audioAnalysis: {
    summary: "",
    lastAnalyzedAt: "",
    pipeline: null,
    structurePolicies: {},
    structureGeneratedSignatures: {},
    structureManualExamples: {}
  },
  sequenceAgentRuntime: {
    timingTrackPolicies: {},
    timingGeneratedSignatures: {},
    timingTrackProvenance: {}
  },
  savePathInput: "",
  lastApplyBackupPath: "",
  recentSequences: [],
  mediaCatalog: [],
  showDirectoryStats: { xsqCount: 0, xdmetaCount: 0 },
  projectCreatedAt: "",
  projectUpdatedAt: "",
  revision: "unknown",
  draftSequencePath: "",
  health: {
    lastCheckedAt: "",
    capabilitiesCount: 0,
    hasValidateCommands: false,
    hasJobsGet: false,
    capabilityCommands: [],
    effectDefinitionCount: 0,
    effectCatalogReady: false,
    effectCatalogError: "",
    sceneGraphReady: false,
    sceneGraphSource: "",
    sceneGraphWarnings: [],
    sceneGraphSpatialNodeCount: 0,
    sceneGraphLayoutMode: "2d",
    excludedUnassignedModelCount: 0,
    excludedUnassignedModelNames: [],
    sequenceOpen: false,
    runtimeReady: false,
    desktopFileDialogReady: false,
    desktopBridgeApiCount: 0,
    xlightsVersion: "",
    compatibilityStatus: "unknown",
    submodelDiscoveryError: "",
    agentProvider: "",
    agentModel: "",
    agentConfigured: false,
    agentHasStoredApiKey: false,
    agentConfigSource: "none",
    agentLayerReady: false,
    agentActiveRole: "",
    agentRegistryVersion: "",
    agentRegistryValid: false,
    agentRegistryErrors: [],
    agentHandoffsReady: "0/3",
    orchestrationLastRunId: "",
    orchestrationLastStatus: "",
    orchestrationLastSummary: "",
    orchestrationLastAt: "",
    desktopAppVersion: "",
    desktopBuildTime: ""
  },
  draftBaseRevision: "unknown",
  status: { level: "info", text: "Welcome. Start in Settings, then create or open a project." },
  flags: {
    xlightsConnected: false,
    xlightsCompatible: true,
    activeSequenceLoaded: false,
    creativeBriefReady: false,
    hasDraftProposal: false,
    proposalStale: false,
    applyInProgress: false,
    planOnlyMode: false,
    planOnlyForcedByConnectivity: false,
    planOnlyForcedByRollout: false
  },
  chat: [],
  teamChat: {
    identities: buildTeamChatIdentities(DEFAULT_TEAM_CHAT_IDENTITIES),
    introducedRoleIds: []
  },
  proposed: [],
  ui: {
    detailsOpen: false,
    sectionSelections: ["all"],
    designTab: "chat",
    diagnosticsOpen: false,
    jobsOpen: false,
    settingsOpen: false,
    diagnosticsFilter: "all",
    modelFilterText: "",
    metadataTypeFilter: "all",
    metadataFilterName: "",
    metadataFilterType: "",
    metadataFilterRole: "",
    metadataFilterVisualHints: "",
    metadataFilterEffectAvoidances: "",
    metadataFilterSupport: "",
    metadataFilterTags: "",
    metadataFilterMetadata: "",
    metadataFilterDimension: "overall",
    metadataView: "guided",
    metadataSelectionIds: [],
    proposedSelection: [],
    sequenceMode: "existing",
    sectionTrackName: "",
    sequenceDesignFilterId: "",
    proposedRowsVisible: DEFAULT_PROPOSED_ROWS,
    designRevisionTarget: null,
    chatDraft: "",
    agentThinking: false,
    agentLastTestStatus: "",
    agentLastOrchestrationTestStatus: "",
    agentLastOrchestrationMatrixStatus: "",
    metadataTargetId: "",
    metadataSelectedTags: [],
    metadataNewTag: "",
    metadataNewTagDescription: "",
    navCollapsed: false,
    proposedPayloadOpen: false,
    applyApprovalChecked: false,
    agentApiKeyDraft: "",
    agentModelDraft: "",
    agentBaseUrlDraft: "",
    analysisServiceUrlDraft: DEFAULT_ANALYSIS_SERVICE_URL,
    analysisServiceProvider: "librosa",
    analysisServiceApiKeyDraft: "",
    analysisServiceAuthBearerDraft: "",
    analysisServiceReady: false,
    analysisServiceChecking: false,
    analysisServiceLastError: "",
    analysisServiceLastCheckedAt: "",
    agentResponseId: "",
    inspectedArtifact: "",
    selectedHistoryEntry: "",
    selectedHistorySnapshot: null,
    reviewHistorySnapshot: null,
    projectNameDialogOpen: false,
    projectNameDialogMode: "",
    projectNameDialogTitle: "",
    projectNameDialogValue: "",
    projectNameDialogError: "",
    firstRunMode: true
  },
  diagnostics: [],
  applyHistory: [],
  orchestrationMatrix: null,
  agentPlan: null,
  jobs: [],
  models: [],
  submodels: [],
  effectCatalog: emptyEffectDefinitionCatalog(),
  sceneGraph: {
    loaded: false,
    source: "",
    loadedAt: "",
    modelsById: {},
    groupsById: {},
    submodelsById: {},
    displayElements: [],
    views: [],
    cameras: [],
    stats: {
      modelCount: 0,
      groupCount: 0,
      submodelCount: 0,
      displayElementCount: 0,
      hasSpatialTransforms: false,
      spatialNodeCount: 0,
      layoutMode: "2d",
      depthPlanningEnabled: false,
      modelTypeCategoryCounts: {},
      bounds: null,
      depthBands: {
        front: 0,
        mid: 0,
        rear: 0
      }
    },
    warnings: []
  },
  sequenceSettings: {
    sequenceType: "Media",
    supportsModelBlending: false
  },
  timingTracks: [],
  sectionSuggestions: [],
  sectionStartByLabel: {},
  creative: {
    goals: "",
    inspiration: "",
    notes: "",
    briefText: "",
    references: [],
    brief: null,
    proposalBundle: null,
    supersededConcepts: [],
    briefUpdatedAt: "",
    runtime: null
  },
  directorProfile: buildDefaultDirectorProfile(),
  inspiration: {
    paletteSwatches: ["#0b3d91", "#2a9d8f", "#f4a261", "#e76f51"]
  },
  metadata: {
    tags: ["focal", "rhythm-driver", "ambient-fill"],
    assignments: [],
    preferencesByTargetId: {},
    visualHintDefinitions: [],
    ignoredOrphanTargetIds: []
  },
  projectSequences: [],
  sequenceCatalog: [],
  versions: [{ id: "v1", summary: "Session initialized", effects: 0, time: "--:--" }],
  selectedVersion: "v1",
  compareVersion: null
};

const CHAT_HISTORY_LIMIT = 100;

function normalizeConfiguredEndpoint(endpoint) {
  const raw = String(endpoint || "").trim();
  if (!raw) return PREFERRED_XLIGHTS_ENDPOINT;
  const lowered = raw.toLowerCase();
  if (lowered.includes("127.0.0.1:8080") || lowered.includes("localhost:8080")) {
    return PREFERRED_XLIGHTS_ENDPOINT;
  }
  if (raw.startsWith("/")) {
    return PREFERRED_XLIGHTS_ENDPOINT;
  }
  return raw;
}

function normalizeProjectIdentityFields(target) {
  if (!target || typeof target !== "object") return;
  const projectFilePath = String(target.projectFilePath || "").trim();
  if (projectFilePath) return;
  target.projectName = "";
  target.projectCreatedAt = "";
  target.projectUpdatedAt = "";
}

function normalizeDirectorProfileState(target) {
  if (!target || typeof target !== "object") return;
  target.directorProfile = normalizeDirectorProfile(target.directorProfile, {
    directorId: "default-director",
    displayName: "Director"
  });
}

function looksLikeDemoProposedLines(lines = []) {
  const current = Array.isArray(lines) ? lines : [];
  const demo = buildDemoProposedLines();
  if (!current.length || current.length !== demo.length) return false;
  for (let i = 0; i < demo.length; i += 1) {
    if (String(current[i] || "") !== String(demo[i] || "")) return false;
  }
  return true;
}

function normalizeDraftState(target) {
  if (!target || typeof target !== "object") return;
  if (!Array.isArray(target.proposed)) {
    target.proposed = [];
  }
  target.creative = target.creative && typeof target.creative === "object"
    ? target.creative
    : structuredClone(defaultState.creative);
  if (!Array.isArray(target.creative.supersededConcepts)) {
    target.creative.supersededConcepts = [];
  }
  const hasBundle = Boolean(target.creative?.proposalBundle);
  if (!hasBundle && looksLikeDemoProposedLines(target.proposed)) {
    target.proposed = [];
  }
  target.flags = {
    ...(target.flags || {}),
    hasDraftProposal: Array.isArray(target.proposed) && target.proposed.length > 0
  };
}

function clearActiveProjectReference(target) {
  if (!target || typeof target !== "object") return;
  target.projectFilePath = "";
  target.projectName = "";
  target.projectCreatedAt = "";
  target.projectUpdatedAt = "";
  target.projectConcept = "";
}

async function pruneInvalidPersistedProjects() {
  const bridge = getDesktopFileStatBridge();
  if (!bridge) return false;
  let changed = false;
  const store = loadProjectsStore();
  for (const [key, snapshot] of Object.entries(store)) {
    const projectFilePath = String(snapshot?.projectFilePath || "").trim();
    if (!projectFilePath) {
      delete store[key];
      changed = true;
      continue;
    }
    try {
      const res = await bridge.getFileStat({ filePath: projectFilePath });
      if (!res?.ok || !res?.exists) {
        delete store[key];
        changed = true;
      }
    } catch {
      // Non-fatal. Keep the entry if the file system probe itself fails.
    }
  }
  if (changed) persistProjectsStore(store);
  return changed;
}

async function validateActiveProjectReference() {
  const bridge = getDesktopFileStatBridge();
  const projectFilePath = String(state.projectFilePath || "").trim();
  if (!bridge || !projectFilePath) {
    normalizeProjectIdentityFields(state);
    return;
  }
  try {
    const res = await bridge.getFileStat({ filePath: projectFilePath });
    if (!res?.ok || !res?.exists) {
      clearActiveProjectReference(state);
      persist();
    }
  } catch {
    // Non-fatal. Keep the current state if the probe itself fails.
  }
  normalizeProjectIdentityFields(state);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    const merged = {
      ...structuredClone(defaultState),
      ...parsed,
      flags: { ...defaultState.flags, ...(parsed.flags || {}) },
      ui: { ...defaultState.ui, ...(parsed.ui || {}) }
    };
    merged.endpoint = normalizeConfiguredEndpoint(merged.endpoint);
    normalizeProjectIdentityFields(merged);
    normalizeDirectorProfileState(merged);
    normalizeDraftState(merged);
    return merged;
  } catch {
    return structuredClone(defaultState);
  }
}

const state = loadState();
let timingTrackRuntime = null;
let uiCompositionRuntime = null;
let projectCatalogRuntime = null;
let analysisServiceRuntime = null;
let agentSupportRuntime = null;
let audioAnalysisPipelineRuntime = null;
let audioAnalysisSessionRuntime = null;
let sequenceMediaSessionRuntime = null;
let projectLifecycleRuntime = null;
let proposalGenerationRuntime = null;
if (state.route === "inspiration") state.route = "design";
ensureAnalysisServiceDefaults(state);
normalizeDirectorProfileState(state);
if (!state.teamChat || typeof state.teamChat !== "object") {
  state.teamChat = { identities: buildTeamChatIdentities(DEFAULT_TEAM_CHAT_IDENTITIES), introducedRoleIds: [] };
}
state.teamChat.identities = buildTeamChatIdentities(state.teamChat.identities || DEFAULT_TEAM_CHAT_IDENTITIES);
if (!Array.isArray(state.teamChat.introducedRoleIds)) {
  state.teamChat.introducedRoleIds = [];
}
if (!Array.isArray(state.ui?.proposedSelection)) {
  state.ui.proposedSelection = [];
}
if (!Array.isArray(state.ui?.metadataSelectionIds)) {
  state.ui.metadataSelectionIds = [];
}
if (typeof state.metadata?.preferencesByTargetId !== "object" || !state.metadata?.preferencesByTargetId || Array.isArray(state.metadata?.preferencesByTargetId)) {
  state.metadata.preferencesByTargetId = {};
}
if (!Array.isArray(state.metadata?.visualHintDefinitions)) {
  state.metadata.visualHintDefinitions = [];
}
if (!Array.isArray(state.ui?.metadataSelectedTags)) {
  state.ui.metadataSelectedTags = [];
}
if (typeof state.ui?.applyApprovalChecked !== "boolean") {
  state.ui.applyApprovalChecked = false;
}
if (typeof state.ui?.selectedHistoryEntry !== "string") {
  state.ui.selectedHistoryEntry = "";
}
if (!state.ui?.selectedHistorySnapshot || typeof state.ui.selectedHistorySnapshot !== "object") {
  state.ui.selectedHistorySnapshot = null;
}
if (!state.ui?.reviewHistorySnapshot || typeof state.ui.reviewHistorySnapshot !== "object") {
  state.ui.reviewHistorySnapshot = null;
}
state.ui.analysisServiceProvider = "librosa";
if (typeof state.ui?.analysisServiceReady !== "boolean") {
  state.ui.analysisServiceReady = false;
}
if (typeof state.ui?.analysisServiceChecking !== "boolean") {
  state.ui.analysisServiceChecking = false;
}
if (typeof state.ui?.analysisServiceLastError !== "string") {
  state.ui.analysisServiceLastError = "";
}
if (typeof state.ui?.analysisServiceLastCheckedAt !== "string") {
  state.ui.analysisServiceLastCheckedAt = "";
}
if (typeof state.ui?.lastAnalysisPrompt !== "string") {
  state.ui.lastAnalysisPrompt = "";
}
if (typeof state.ui?.agentLastOrchestrationMatrixStatus !== "string") {
  state.ui.agentLastOrchestrationMatrixStatus = "";
}
if (typeof state.health?.agentLayerReady !== "boolean") {
  state.health.agentLayerReady = false;
}
if (typeof state.health?.agentActiveRole !== "string") {
  state.health.agentActiveRole = "";
}
if (typeof state.health?.agentRegistryVersion !== "string") {
  state.health.agentRegistryVersion = "";
}
if (!Array.isArray(state.health?.capabilityCommands)) {
  state.health.capabilityCommands = [];
}
if (!Number.isFinite(Number(state.health?.effectDefinitionCount))) {
  state.health.effectDefinitionCount = 0;
}
if (typeof state.health?.effectCatalogReady !== "boolean") {
  state.health.effectCatalogReady = false;
}
if (typeof state.health?.effectCatalogError !== "string") {
  state.health.effectCatalogError = "";
}
if (typeof state.health?.sceneGraphReady !== "boolean") {
  state.health.sceneGraphReady = false;
}
if (typeof state.health?.sceneGraphSource !== "string") {
  state.health.sceneGraphSource = "";
}
if (!Array.isArray(state.health?.sceneGraphWarnings)) {
  state.health.sceneGraphWarnings = [];
}
if (!Number.isFinite(Number(state.health?.sceneGraphSpatialNodeCount))) {
  state.health.sceneGraphSpatialNodeCount = 0;
}
if (!["2d", "3d"].includes(String(state.health?.sceneGraphLayoutMode || "").toLowerCase())) {
  state.health.sceneGraphLayoutMode = "2d";
}
if (typeof state.health?.agentRegistryValid !== "boolean") {
  state.health.agentRegistryValid = false;
}
if (!Array.isArray(state.health?.agentRegistryErrors)) {
  state.health.agentRegistryErrors = [];
}
if (typeof state.health?.agentHandoffsReady !== "string") {
  state.health.agentHandoffsReady = "0/3";
}
if (typeof state.health?.orchestrationLastRunId !== "string") {
  state.health.orchestrationLastRunId = "";
}
if (typeof state.health?.orchestrationLastStatus !== "string") {
  state.health.orchestrationLastStatus = "";
}
if (typeof state.health?.orchestrationLastSummary !== "string") {
  state.health.orchestrationLastSummary = "";
}
if (typeof state.health?.orchestrationLastAt !== "string") {
  state.health.orchestrationLastAt = "";
}
if (!Array.isArray(state.applyHistory)) {
  state.applyHistory = [];
}
if (!state.orchestrationMatrix || typeof state.orchestrationMatrix !== "object") {
  state.orchestrationMatrix = null;
}
if (typeof state.ui?.metadataFilterName !== "string") state.ui.metadataFilterName = "";
if (typeof state.ui?.metadataFilterType !== "string") state.ui.metadataFilterType = "";
if (typeof state.ui?.metadataFilterRole !== "string") state.ui.metadataFilterRole = "";
if (typeof state.ui?.metadataFilterVisualHints !== "string") state.ui.metadataFilterVisualHints = "";
if (typeof state.ui?.metadataFilterEffectAvoidances !== "string") state.ui.metadataFilterEffectAvoidances = "";
if (typeof state.ui?.metadataFilterSupport !== "string") state.ui.metadataFilterSupport = "";
if (typeof state.ui?.metadataFilterTags !== "string") state.ui.metadataFilterTags = "";
if (typeof state.ui?.metadataFilterMetadata !== "string") state.ui.metadataFilterMetadata = "";
if (typeof state.ui?.metadataFilterDimension !== "string") state.ui.metadataFilterDimension = "overall";
if (typeof state.ui?.metadataView !== "string") state.ui.metadataView = "guided";
if (!isPlainObject(state.sceneGraph)) {
  state.sceneGraph = structuredClone(defaultState.sceneGraph);
} else {
  state.sceneGraph = {
    ...structuredClone(defaultState.sceneGraph),
    ...state.sceneGraph,
    stats: {
      ...structuredClone(defaultState.sceneGraph.stats),
      ...(isPlainObject(state.sceneGraph.stats) ? state.sceneGraph.stats : {})
    }
  };
}
if (!isPlainObject(state.effectCatalog)) {
  state.effectCatalog = emptyEffectDefinitionCatalog();
}
if (!["2d", "3d"].includes(String(state.sceneGraph?.stats?.layoutMode || "").toLowerCase())) {
  state.sceneGraph.stats.layoutMode = "2d";
}
state.sceneGraph.stats.depthPlanningEnabled = state.sceneGraph.stats.layoutMode === "3d";
if (!isPlainObject(state.sceneGraph?.stats?.modelTypeCategoryCounts)) {
  state.sceneGraph.stats.modelTypeCategoryCounts = {};
}
let desktopStatePersistTimer = null;
let desktopStateHydrated = false;
let sidecarPersistTimer = null;
let sidecarDirtySequencePath = "";
let sidecarDirtyBaselineMtimeMs = 0;
const sequenceFileMtimeByPath = new Map();
let quickReconnectTimer = null;
let hydratedSidecarSequencePath = "";
let focusSyncInFlight = false;
let lastFocusSyncAt = 0;
let lastIgnoredExternalSequencePath = "";
let agentRuntimeState = null;
let applyReviewRuntime = null;
let applyReadinessRuntime = null;
let projectHistoryRuntime = null;

const agentRuntime = emptyAgentRuntimeState();


function getProjectKey(projectName = state.projectName, showFolder = state.showFolder) {
  return `${(projectName || "").trim()}::${(showFolder || "").trim()}`;
}

function parseProjectKey(key) {
  const raw = String(key || "");
  const idx = raw.indexOf("::");
  if (idx < 0) return { projectName: raw.trim(), showFolder: "" };
  return {
    projectName: raw.slice(0, idx).trim(),
    showFolder: raw.slice(idx + 2).trim()
  };
}

function loadProjectsStore() {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function persistProjectsStore(store) {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(store));
  queueDesktopStatePersist();
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  queueDesktopStatePersist();
  queueSidecarPersist();
}

function resetDerivedAudioAnalysisState() {
  resetAudioAnalysisView(state.audioAnalysis);
}

function syncSectionSuggestionsFromAnalysisArtifact(artifact = null) {
  const sections = Array.isArray(artifact?.structure?.sections) ? artifact.structure.sections : [];
  const built = buildSectionSuggestions(sections);
  state.ui.sectionTrackName = built.labels.length ? "Analysis: Song Structure" : state.ui.sectionTrackName;
  state.sectionSuggestions = built.labels;
  state.sectionStartByLabel = built.startByLabel;
  reconcileSectionSelectionsToAvailable();
}

function applyPersistedAnalysisArtifact(artifact = null) {
  const out = applyPersistedAnalysisArtifactToState({
    artifact,
    creativeBrief: state.creative?.brief || null,
    audioAnalysisState: state.audioAnalysis,
    setHandoff: (handoff) => agentRuntimeState.setAgentHandoff("analysis_handoff_v1", handoff, "audio_analyst")
  });
  if (out.ok === true) syncSectionSuggestionsFromAnalysisArtifact(artifact);
  return out.ok === true;
}

async function hydrateAnalysisArtifactForCurrentMedia(options = {}) {
  const silent = options?.silent !== false;
  const preferredProfileMode = String(options?.preferredProfileMode || "deep").trim().toLowerCase();
  const bridge = getDesktopAnalysisArtifactBridge();
  const projectFilePath = String(state.projectFilePath || "").trim();
  const mediaFilePath = String(state.audioPathInput || "").trim();
  if (!bridge || !projectFilePath || !mediaFilePath) return { ok: false, reason: "unavailable" };
  try {
    const res = await bridge.readAnalysisArtifact({
      projectFilePath,
      mediaFilePath,
      preferredProfileMode
    });
    if (res?.ok !== true || !res.artifact || typeof res.artifact !== "object") {
      return { ok: false, reason: String(res?.code || "not_found") };
    }
    const applied = applyPersistedAnalysisArtifact(res.artifact);
    if (applied && !silent) {
      setStatus("info", "Loaded existing audio analysis artifact for current media.");
    }
    return { ok: applied, artifact: res.artifact };
  } catch (err) {
    if (!silent) {
      setStatusWithDiagnostics("warning", `Audio analysis artifact load failed: ${err?.message || err}`);
    }
    return { ok: false, reason: "read_error" };
  }
}

async function loadReusableAnalysisArtifactForProfile(analysisProfile = null) {
  const requestedMode = String(analysisProfile?.mode || "fast").trim().toLowerCase() || "fast";
  const allowEscalation = analysisProfile?.allowEscalation !== false;
  const readFreshArtifact = async (mode) => {
    const hydrated = await hydrateAnalysisArtifactForCurrentMedia({
      silent: true,
      preferredProfileMode: mode
    });
    if (!hydrated?.ok || !hydrated.artifact) return null;
    const freshness = inspectAnalysisArtifactFreshness(hydrated.artifact, { preferredProfileMode: mode });
    if (!freshness.ok) return null;
    return { artifact: hydrated.artifact, freshness, mode };
  };

  if (requestedMode === "deep") {
    return await readFreshArtifact("deep");
  }

  const fast = await readFreshArtifact("fast");
  if (!fast) return null;
  if (!allowEscalation) return fast;

  const fastReport = buildAudioAnalysisQualityReport(fast.artifact);
  if (!audioAnalysisPipelineRuntime.shouldEscalateAudioAnalysisProfile(fastReport)) return fast;

  const deep = await readFreshArtifact("deep");
  return deep || null;
}

async function ensureCurrentAnalysisHandoff(options = {}) {
  if (hasUsableCurrentAudioAnalysis()) {
    return agentRuntimeState.getValidHandoff("analysis_handoff_v1");
  }
  const hydrated = await hydrateAnalysisArtifactForCurrentMedia(options);
  if (hydrated?.ok) {
    return agentRuntimeState.getValidHandoff("analysis_handoff_v1");
  }
  return agentRuntimeState.getValidHandoff("analysis_handoff_v1");
}

function dirnameRelPath(relPath = "") {
  const raw = String(relPath || "").replace(/\\/g, "/").replace(/^\/+/, "");
  const idx = raw.lastIndexOf("/");
  return idx >= 0 ? raw.slice(0, idx) : "";
}

function joinRelPath(base = "", child = "") {
  const b = String(base || "").replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
  const c = String(child || "").replace(/\\/g, "/").replace(/^\/+/, "");
  if (!b) return c;
  if (!c) return b;
  return `${b}/${c}`;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hydrateIntentHandoffExecutionStrategy(intentHandoff = null, proposalBundle = null) {
  if (!isPlainObject(intentHandoff)) return intentHandoff;
  if (isPlainObject(intentHandoff.executionStrategy)) return intentHandoff;
  const executionPlan = proposalBundle?.executionPlan && typeof proposalBundle.executionPlan === "object"
    ? proposalBundle.executionPlan
    : null;
  if (!executionPlan) return intentHandoff;
  return {
    ...intentHandoff,
    executionStrategy: structuredClone(executionPlan)
  };
}


function agentRuntimeState.refreshAgentRuntimeHealth() {
  return agentRuntimeState.agentRuntimeState.refreshAgentRuntimeHealth();
}

function agentRuntimeState.beginOrchestrationRun({ trigger = "", role = "" } = {}) {
  return agentRuntimeState.agentRuntimeState.beginOrchestrationRun({ trigger, role });
}

function agentRuntimeState.markOrchestrationStage(run, stage = "", status = "ok", detail = "") {
  return agentRuntimeState.agentRuntimeState.markOrchestrationStage(run, stage, status, detail);
}

function agentRuntimeState.endOrchestrationRun(run, { status = "ok", summary = "" } = {}) {
  return agentRuntimeState.agentRuntimeState.endOrchestrationRun(run, { status, summary });
}

function pushSequenceAgentContractDiagnostic(report = {}) {
  if (!isPlainObject(report)) return;
  const stage = String(report.stage || "unknown_contract");
  const contractName = String(report.contractName || "unknown");
  const runId = String(report.runId || "");
  const errors = Array.isArray(report.errors) ? report.errors.filter(Boolean) : [];
  const prefix = `Sequence-agent contract ${contractName} [${stage}]`;
  if (errors.length) {
    pushDiagnostic("warning", `${prefix} invalid${runId ? ` (run=${runId})` : ""}: ${errors.join("; ")}`);
    return;
  }
  pushDiagnostic("info", `${prefix} valid${runId ? ` (run=${runId})` : ""}.`);
}

function emitSequenceAgentStageTelemetry(orchestrationRun, sequencePlan = {}) {
  const rows = Array.isArray(sequencePlan?.stageTelemetry) ? sequencePlan.stageTelemetry : [];
  for (const row of rows) {
    const stage = `sequence_agent.${String(row?.stage || "unknown")}`;
    const status = String(row?.status || "ok") === "error" ? "error" : "ok";
    const detail = [
      String(row?.detail || "").trim(),
      Number.isFinite(Number(row?.durationMs)) ? `duration=${Number(row.durationMs)}ms` : "",
      String(row?.failureCategory || "").trim() ? `class=${String(row.failureCategory).trim()}` : ""
    ]
      .filter(Boolean)
      .join(" | ");
    agentRuntimeState.markOrchestrationStage(orchestrationRun, stage, status, detail);
  }
}

function normalizeStringArray(values = []) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((v) => String(v || "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));
}

function arraysEqualAsSets(a = [], b = []) {
  const left = normalizeStringArray(a);
  const right = normalizeStringArray(b);
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

function arraysEqualOrdered(a = [], b = []) {
  const left = Array.isArray(a) ? a : [];
  const right = Array.isArray(b) ? b : [];
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (String(left[i] || "") !== String(right[i] || "")) return false;
  }
  return true;
}

function agentRuntimeState.buildAgentPersistenceContext() {
  return agentRuntimeState.agentRuntimeState.buildAgentPersistenceContext();
}

function agentRuntimeState.setAgentActiveRole(roleId = "") {
  return agentRuntimeState.agentRuntimeState.setAgentActiveRole(roleId);
}

function agentRuntimeState.setAgentHandoff(contract = "", payload = {}, producer = "") {
  return agentRuntimeState.agentRuntimeState.setAgentHandoff(contract, payload, producer);
}

function agentRuntimeState.getValidHandoff(contract = "") {
  return agentRuntimeState.agentRuntimeState.getValidHandoff(contract);
}

function agentRuntimeState.getValidHandoffRecord(contract = "") {
  return agentRuntimeState.agentRuntimeState.getValidHandoffRecord(contract);
}

function agentRuntimeState.clearAgentHandoff(contract = "", reason = "", { pushLog = true } = {}) {
  return agentRuntimeState.agentRuntimeState.clearAgentHandoff(contract, reason, { pushLog });
}

function agentRuntimeState.invalidatePlanHandoff(reason = "context changed") {
  return agentRuntimeState.agentRuntimeState.invalidatePlanHandoff(reason);
}

function agentRuntimeState.invalidateAnalysisHandoff(reason = "audio changed", { cascadePlan = true } = {}) {
  return agentRuntimeState.agentRuntimeState.invalidateAnalysisHandoff(reason, { cascadePlan });
}



function agentRuntimeState.clearSequencingHandoffsForSequenceChange(reason = "sequence changed") {
  return agentRuntimeState.agentRuntimeState.clearSequencingHandoffsForSequenceChange(reason);
}



function queueDesktopStatePersist() {
  const bridge = getDesktopStateBridge();
  if (!bridge || !desktopStateHydrated) return;
  if (desktopStatePersistTimer) {
    clearTimeout(desktopStatePersistTimer);
  }
  desktopStatePersistTimer = setTimeout(async () => {
    desktopStatePersistTimer = null;
    try {
      await bridge.writeAppState({
        localStateRaw: localStorage.getItem(STORAGE_KEY) || "",
        projectsStoreRaw: localStorage.getItem(PROJECTS_KEY) || ""
      });
    } catch {
      // Non-fatal. Browser-only and desktop bridge failures should not block UI.
    }
  }, DESKTOP_STATE_SYNC_DEBOUNCE_MS);
}

function captureRenderFocusState() {
  if (typeof document === "undefined") return null;
  const active = document.activeElement;
  if (!active || !(active instanceof HTMLElement)) return null;
  if (!app.contains(active)) return null;
  const id = String(active.id || "").trim();
  if (!id) return null;
  const tag = String(active.tagName || "").toLowerCase();
  const isTextInput = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;
  return {
    id,
    tag,
    selectionStart: isTextInput && Number.isInteger(active.selectionStart) ? active.selectionStart : null,
    selectionEnd: isTextInput && Number.isInteger(active.selectionEnd) ? active.selectionEnd : null
  };
}

function restoreRenderFocusState(snapshot) {
  if (!snapshot || typeof document === "undefined") return;
  const next = document.getElementById(snapshot.id);
  if (!next || !(next instanceof HTMLElement)) return;
  if (typeof next.focus === "function") {
    next.focus({ preventScroll: true });
  }
  if ((next instanceof HTMLInputElement || next instanceof HTMLTextAreaElement)
      && Number.isInteger(snapshot.selectionStart)
      && Number.isInteger(snapshot.selectionEnd)) {
    try {
      next.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd);
    } catch {
      // Ignore selection restore failures for non-text input types.
    }
  }
}

function isFirstRunMode() {
  return Boolean(state.ui?.firstRunMode);
}

function normalizeUiRoute() {
  if (state.route === "setup") state.route = "settings";
}

async function hydrateStateFromDesktop() {
  const bridge = getDesktopStateBridge();
  if (!bridge) {
    desktopStateHydrated = true;
    return;
  }
  try {
    const payload = await bridge.readAppState();
    if (payload?.ok !== true) {
      desktopStateHydrated = true;
      return;
    }

    let changed = false;
    if (typeof payload.localStateRaw === "string" && payload.localStateRaw.trim()) {
      const current = localStorage.getItem(STORAGE_KEY) || "";
      if (!current || current !== payload.localStateRaw) {
        localStorage.setItem(STORAGE_KEY, payload.localStateRaw);
        changed = true;
      }
    }
    if (typeof payload.projectsStoreRaw === "string" && payload.projectsStoreRaw.trim()) {
      const current = localStorage.getItem(PROJECTS_KEY) || "";
      if (!current || current !== payload.projectsStoreRaw) {
        localStorage.setItem(PROJECTS_KEY, payload.projectsStoreRaw);
        changed = true;
      }
    }

    if (changed) {
      const hydrated = loadState();
      for (const key of Object.keys(state)) delete state[key];
      Object.assign(state, hydrated);
      ensureAnalysisServiceDefaults(state);
      normalizeProjectIdentityFields(state);
      normalizeDraftState(state);
    }
    await pruneInvalidPersistedProjects();
    await validateActiveProjectReference();
  } catch {
    // Non-fatal. Continue with localStorage state.
  } finally {
    normalizeProjectIdentityFields(state);
    normalizeDraftState(state);
    desktopStateHydrated = true;
    queueDesktopStatePersist();
  }
}

async function hydrateDesktopAppInfo() {
  const bridge = getDesktopAppInfoBridge();
  if (!bridge) return;
  try {
    const res = await bridge.getAppInfo();
    if (!res?.ok) return;
    state.health.desktopAppVersion = String(res.appVersion || "").trim();
    state.health.desktopBuildTime = String(res.buildTime || "").trim();
  } catch {
    // non-fatal
  }
}

function currentSequencePathForSidecar() {
  return String(state.sequencePathInput || "").trim();
}

function buildSequenceSidecarDocument() {
  const handoffs = {};
  for (const contract of AGENT_HANDOFF_CONTRACTS) {
    const row = agentRuntime.handoffs?.[contract];
    if (!row?.valid || !isPlainObject(row.payload)) continue;
    handoffs[contract] = {
      contract,
      producer: String(row.producer || "").trim(),
      payload: row.payload,
      context: isPlainObject(row.context) ? row.context : agentRuntimeState.buildAgentPersistenceContext(),
      at: String(row.at || "")
    };
  }
  return {
    version: 3,
    updatedAt: new Date().toISOString(),
    sequencePath: currentSequencePathForSidecar(),
    project: {
      name: state.projectName || "",
      showFolder: state.showFolder || ""
    },
    draft: {
      proposed: Array.isArray(state.proposed) ? state.proposed : [],
      agentPlan: state.agentPlan && typeof state.agentPlan === "object" ? state.agentPlan : null,
      draftBaseRevision: state.draftBaseRevision || "unknown",
      draftSequencePath: String(state.draftSequencePath || ""),
      flags: {
        hasDraftProposal: Boolean(state.flags?.hasDraftProposal),
        proposalStale: Boolean(state.flags?.proposalStale)
      }
    },
    sequenceAgentRuntime: state.sequenceAgentRuntime && typeof state.sequenceAgentRuntime === "object"
      ? {
          timingTrackPolicies: getSequenceTimingTrackPoliciesState(),
          timingGeneratedSignatures: getSequenceTimingGeneratedSignaturesState(),
          timingTrackProvenance:
            state.sequenceAgentRuntime?.timingTrackProvenance && typeof state.sequenceAgentRuntime.timingTrackProvenance === "object"
              ? state.sequenceAgentRuntime.timingTrackProvenance
              : {}
        }
      : structuredClone(defaultState.sequenceAgentRuntime),
    creative: state.creative || {},
    metadata: state.metadata || {},
    versions: Array.isArray(state.versions) ? state.versions : [],
    selection: {
      selectedVersion: state.selectedVersion || "",
      compareVersion: state.compareVersion || null
    },
    agentRuntime: {
      registryVersion: String(state.health.agentRegistryVersion || ""),
      activeRole: String(state.health.agentActiveRole || ""),
      handoffs
    }
  };
}

function applySequenceSidecarDocument(doc) {
  if (!doc || typeof doc !== "object") return;
  if (Array.isArray(doc?.draft?.proposed)) state.proposed = [...doc.draft.proposed];
  state.agentPlan = doc?.draft?.agentPlan && typeof doc.draft.agentPlan === "object"
    ? { ...doc.draft.agentPlan }
    : null;
  if (typeof doc?.draft?.draftBaseRevision === "string") {
    state.draftBaseRevision = doc.draft.draftBaseRevision;
  }
  if (typeof doc?.draft?.draftSequencePath === "string") {
    state.draftSequencePath = doc.draft.draftSequencePath;
  }
  if (doc?.draft?.flags && typeof doc.draft.flags === "object") {
    if (typeof doc.draft.flags.hasDraftProposal === "boolean") {
      state.flags.hasDraftProposal = doc.draft.flags.hasDraftProposal;
    }
    if (typeof doc.draft.flags.proposalStale === "boolean") {
      state.flags.proposalStale = doc.draft.flags.proposalStale;
    }
  }
  if (doc?.creative && typeof doc.creative === "object") state.creative = { ...state.creative, ...doc.creative };
  if (state.creative?.proposalBundle) syncDesignerDraftFlags(state);
  const runtimeDoc = doc?.sequenceAgentRuntime && typeof doc.sequenceAgentRuntime === "object"
    ? doc.sequenceAgentRuntime
    : {};
  state.sequenceAgentRuntime = {
    timingTrackPolicies: runtimeDoc.timingTrackPolicies && typeof runtimeDoc.timingTrackPolicies === "object"
      ? { ...runtimeDoc.timingTrackPolicies }
      : {},
    timingGeneratedSignatures: runtimeDoc.timingGeneratedSignatures && typeof runtimeDoc.timingGeneratedSignatures === "object"
      ? { ...runtimeDoc.timingGeneratedSignatures }
      : {},
    timingTrackProvenance: runtimeDoc.timingTrackProvenance && typeof runtimeDoc.timingTrackProvenance === "object"
      ? { ...runtimeDoc.timingTrackProvenance }
      : {}
  };
  if (doc?.metadata && typeof doc.metadata === "object") state.metadata = { ...state.metadata, ...doc.metadata };
  if (Array.isArray(doc?.versions) && doc.versions.length) state.versions = doc.versions;
  if (typeof doc?.selection?.selectedVersion === "string" && doc.selection.selectedVersion) {
    state.selectedVersion = doc.selection.selectedVersion;
  }
  state.compareVersion = doc?.selection?.compareVersion ?? state.compareVersion;
  clearAgentHandoffs();
  if (doc?.agentRuntime && isPlainObject(doc.agentRuntime)) {
    const runtimeRole = String(doc.agentRuntime.activeRole || "").trim();
    if (runtimeRole) {
      agentRuntimeState.setAgentActiveRole(runtimeRole);
    }
    const persisted = isPlainObject(doc.agentRuntime.handoffs) ? doc.agentRuntime.handoffs : {};
    for (const contract of AGENT_HANDOFF_CONTRACTS) {
      const row = isPlainObject(persisted[contract]) ? persisted[contract] : null;
      if (!row || !isPlainObject(row.payload)) continue;
      const errors = validateAgentHandoff(contract, row.payload);
      if (errors.length) continue;
      agentRuntime.handoffs[contract] = {
        contract,
        producer: String(row.producer || "").trim(),
        payload: row.payload,
        context: isPlainObject(row.context) ? row.context : agentRuntimeState.buildAgentPersistenceContext(),
        valid: true,
        errors: [],
        at: String(row.at || new Date().toISOString())
      };
    }
    agentRuntimeState.refreshAgentRuntimeHealth();
    reconcileHandoffsAgainstCurrentContext({ reasonPrefix: "sidecar hydrate" });
  }
}

async function hydrateSidecarForCurrentSequence() {
  const bridge = getDesktopSidecarBridge();
  const sequencePath = currentSequencePathForSidecar();
  if (!bridge || !sequencePath) return;
  try {
    const res = await bridge.readSequenceSidecar({ sequencePath });
    if (res?.ok !== true) return;
    hydratedSidecarSequencePath = sequencePath;
    sidecarDirtySequencePath = "";
    sidecarDirtyBaselineMtimeMs = 0;
    if (res.exists && res.data && typeof res.data === "object") {
      applySequenceSidecarDocument(res.data);
    } else {
      state.audioAnalysis = structuredClone(defaultState.audioAnalysis);
    }
  } catch {
    // Non-fatal.
  }
}

function queueSidecarPersist() {
  const sequencePath = currentSequencePathForSidecar();
  if (!sequencePath) return;
  if (hydratedSidecarSequencePath !== sequencePath) return;
  // Save-gated policy: mark sidecar dirty, but do not write until sequence.save succeeds.
  const known = Number(sequenceFileMtimeByPath.get(sequencePath) || 0);
  if (!sidecarDirtySequencePath || sidecarDirtySequencePath !== sequencePath) {
    sidecarDirtyBaselineMtimeMs = Number.isFinite(known) ? known : 0;
  }
  sidecarDirtySequencePath = sequencePath;
}

async function flushSidecarPersistIfDirty(sequencePath = "") {
  const bridge = getDesktopSidecarBridge();
  const targetPath = String(sequencePath || currentSequencePathForSidecar() || "").trim();
  if (!bridge || !targetPath) return;
  if (!sidecarDirtySequencePath || sidecarDirtySequencePath !== targetPath) return;
  if (hydratedSidecarSequencePath !== targetPath) return;
  if (sidecarPersistTimer) {
    clearTimeout(sidecarPersistTimer);
    sidecarPersistTimer = null;
  }
  try {
    await bridge.writeSequenceSidecar({
      sequencePath: targetPath,
      data: buildSequenceSidecarDocument()
    });
    sidecarDirtySequencePath = "";
    sidecarDirtyBaselineMtimeMs = 0;
  } catch {
    // Non-fatal.
  }
}

async function updateSequenceFileMtime(sequencePath = "") {
  const targetPath = String(sequencePath || "").trim();
  if (!targetPath) return 0;
  const bridge = getDesktopFileStatBridge();
  if (!bridge) return Number(sequenceFileMtimeByPath.get(targetPath) || 0);
  try {
    const res = await bridge.getFileStat({ filePath: targetPath });
    if (!res?.ok || !res?.exists) return Number(sequenceFileMtimeByPath.get(targetPath) || 0);
    const mtimeMs = Number(res.mtimeMs || 0);
    if (Number.isFinite(mtimeMs) && mtimeMs > 0) {
      sequenceFileMtimeByPath.set(targetPath, mtimeMs);
      return mtimeMs;
    }
  } catch {
    // Non-fatal.
  }
  return Number(sequenceFileMtimeByPath.get(targetPath) || 0);
}

async function getSequenceFileStat(sequencePath = "") {
  const targetPath = String(sequencePath || "").trim();
  if (!targetPath) return null;
  const bridge = getDesktopFileStatBridge();
  if (!bridge) return null;
  try {
    const res = await bridge.getFileStat({ filePath: targetPath });
    if (!res?.ok || !res?.exists) {
      return {
        filePath: targetPath,
        exists: false,
        size: 0,
        mtimeMs: 0,
        mtimeIso: ""
      };
    }
    return {
      filePath: String(res.filePath || targetPath),
      exists: true,
      size: Number(res.size || 0),
      mtimeMs: Number(res.mtimeMs || 0),
      mtimeIso: String(res.mtimeIso || "")
    };
  } catch (err) {
    pushDiagnostic("warning", `Sequence file stat failed for ${targetPath}: ${String(err?.message || err)}`);
    return null;
  }
}

function describeSequenceFileStat(stat = null) {
  if (!stat) return "stat unavailable";
  if (!stat.exists) return "missing";
  return `size=${Number(stat.size || 0)} mtime=${String(stat.mtimeIso || "unknown")}`;
}

async function traceSequenceFileLifecycle(label = "", sequencePath = "", op) {
  const targetPath = String(sequencePath || "").trim();
  const before = await getSequenceFileStat(targetPath);
  if (targetPath) {
    pushDiagnostic("info", `${label}: before ${targetPath} (${describeSequenceFileStat(before)})`);
  }
  const result = await op();
  const after = await getSequenceFileStat(targetPath);
  if (targetPath) {
    pushDiagnostic("info", `${label}: after ${targetPath} (${describeSequenceFileStat(after)})`);
    if (before?.exists && Number(before.size || 0) > 0 && after?.exists && Number(after.size || 0) <= 0) {
      pushDiagnostic("error", `${label}: sequence file became empty on disk after operation`, targetPath);
      setStatusWithDiagnostics(
        "action-required",
        "Sequence file became empty after a sequence operation. Stop and inspect the file before continuing.",
        targetPath
      );
    }
  }
  return result;
}

async function assertSequenceFileSafeAfterSave(sequencePath = "", label = "sequence save") {
  const stat = await getSequenceFileStat(sequencePath);
  if (!stat?.exists || Number(stat.size || 0) <= 0) {
    throw new Error(`${label} did not leave a valid non-empty .xsq on disk.`);
  }
  return stat;
}

async function maybeFlushSidecarAfterExternalSave(sequencePath = "") {
  const targetPath = String(sequencePath || "").trim();
  if (!targetPath) return;
  if (!sidecarDirtySequencePath || sidecarDirtySequencePath !== targetPath) return;
  const mtimeMs = await updateSequenceFileMtime(targetPath);
  if (!Number.isFinite(mtimeMs) || mtimeMs <= 0) return;
  const baseline = Number(sidecarDirtyBaselineMtimeMs || 0);
  if (baseline > 0 && mtimeMs > baseline + 1) {
    await flushSidecarPersistIfDirty(targetPath);
    pushDiagnostic("info", "Audio analysis: detected xLights-side sequence save; flushed pending .xdmeta metadata.");
  }
}

function withTimeout(promise, timeoutMs, label = "request") {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function queueQuickReconnectPoll() {
  if (quickReconnectTimer) return;
  quickReconnectTimer = setTimeout(async () => {
    quickReconnectTimer = null;
    await pollCompatibilityStatus();
  }, QUICK_RECONNECT_DELAY_MS);
}

function uniqueEndpoints(endpoints) {
  return Array.from(
    new Set(
      (Array.isArray(endpoints) ? endpoints : [])
        .map((e) => String(e || "").trim())
        .filter(Boolean)
    )
  );
}

async function resolveReachableEndpoint(preferredEndpoint) {
  const preferred = normalizeConfiguredEndpoint(
    String(preferredEndpoint || state.endpoint || PREFERRED_XLIGHTS_ENDPOINT).trim()
  );
  const endpoints = uniqueEndpoints([preferred, ...FALLBACK_XLIGHTS_ENDPOINTS]);
  if (!endpoints.length) {
    throw new Error("No xLights endpoint configured.");
  }
  let lastError = null;
  for (const endpoint of endpoints) {
    try {
      const caps = await withTimeout(
        pingCapabilities(endpoint),
        ENDPOINT_PROBE_TIMEOUT_MS,
        `Endpoint probe ${endpoint}`
      );
      return { endpoint, caps };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error("No reachable xLights endpoint found.");
}

function sidecarPathForSequencePath(sequencePath) {
  const path = String(sequencePath || "").trim();
  if (!path) return "";
  if (/\.xsq$/i.test(path)) {
    return path.replace(/\.xsq$/i, ".xdmeta");
  }
  return `${path}.xdmeta`;
}

function basenameOfPath(filePath) {
  const raw = String(filePath || "").trim();
  if (!raw) return "";
  const parts = raw.split(/[\\/]/);
  return String(parts[parts.length - 1] || "").trim();
}

function buildIdentityRecommendationOfferKey(audioPath = "", trackIdentity = {}) {
  const recommendation = trackIdentity?.recommendation && typeof trackIdentity.recommendation === "object"
    ? trackIdentity.recommendation
    : {};
  const metadataRecommendation = trackIdentity?.metadataRecommendation && typeof trackIdentity.metadataRecommendation === "object"
    ? trackIdentity.metadataRecommendation
    : {};
  return JSON.stringify({
    audioPath: String(audioPath || "").trim(),
    recommendedFileName: String(recommendation?.recommendedFileName || "").trim(),
    shouldRename: recommendation?.shouldRename === true,
    shouldRetag: metadataRecommendation?.shouldRetag === true,
    recommendedTitle: String(metadataRecommendation?.recommended?.title || "").trim(),
    recommendedArtist: String(metadataRecommendation?.recommended?.artist || "").trim(),
    recommendedAlbum: String(metadataRecommendation?.recommended?.album || "").trim()
  });
}

function applyIdentityRecommendationResultToState({ oldPath = "", newPath = "", renamed = false, retagged = false } = {}) {
  const nextPath = String(newPath || oldPath || "").trim();
  if (!nextPath) return;
  if (renamed) {
    state.audioPathInput = nextPath;
    if (state.audioAnalysis?.artifact?.media) {
      state.audioAnalysis.artifact.media.path = nextPath;
      state.audioAnalysis.artifact.media.fileName = basenameOfPath(nextPath);
    }
  }
  const identity = state.audioAnalysis?.artifact?.identity;
  if (identity && typeof identity === "object") {
    if (identity.sourceMetadata && typeof identity.sourceMetadata === "object") {
      identity.sourceMetadata.fileName = basenameOfPath(nextPath);
    }
    if (renamed && identity.recommendation && typeof identity.recommendation === "object") {
      identity.recommendation.currentFileName = basenameOfPath(nextPath);
      identity.recommendation.shouldRename = false;
    }
    if (retagged && identity.metadataRecommendation && typeof identity.metadataRecommendation === "object") {
      identity.metadataRecommendation.current = {
        ...(identity.metadataRecommendation.current || {}),
        ...(identity.metadataRecommendation.recommended || {})
      };
      identity.metadataRecommendation.shouldRetag = false;
      identity.metadataRecommendation.diff = { title: false, artist: false, album: false };
    }
  }
  const handoff = agentRuntime?.handoffs?.analysis_handoff_v1;
  if (handoff?.trackIdentity && typeof handoff.trackIdentity === "object") {
    if (handoff.trackIdentity.sourceMetadata && typeof handoff.trackIdentity.sourceMetadata === "object") {
      handoff.trackIdentity.sourceMetadata.fileName = basenameOfPath(nextPath);
    }
    if (renamed && handoff.trackIdentity.recommendation && typeof handoff.trackIdentity.recommendation === "object") {
      handoff.trackIdentity.recommendation.shouldRename = false;
      handoff.trackIdentity.recommendation.recommendedFileName = basenameOfPath(nextPath);
    }
    if (retagged && handoff.trackIdentity.metadataRecommendation && typeof handoff.trackIdentity.metadataRecommendation === "object") {
      handoff.trackIdentity.metadataRecommendation.current = {
        ...(handoff.trackIdentity.metadataRecommendation.current || {}),
        ...(handoff.trackIdentity.metadataRecommendation.recommended || {})
      };
      handoff.trackIdentity.metadataRecommendation.shouldRetag = false;
    }
  }
}

async function maybeOfferIdentityRecommendationAction({ audioPath = "", trackIdentity = null } = {}) {
  const bridge = getDesktopMediaIdentityBridge();
  if (!bridge) return { applied: false };
  const identity = trackIdentity && typeof trackIdentity === "object" ? trackIdentity : {};
  const recommendation = identity?.recommendation && typeof identity.recommendation === "object" ? identity.recommendation : {};
  const metadataRecommendation = identity?.metadataRecommendation && typeof identity.metadataRecommendation === "object" ? identity.metadataRecommendation : {};
  const shouldRename = recommendation?.shouldRename === true;
  const shouldRetag = metadataRecommendation?.shouldRetag === true;
  if (!shouldRename && !shouldRetag) return { applied: false };
  const offerKey = buildIdentityRecommendationOfferKey(audioPath, identity);
  if (!state.ui) state.ui = {};
  if (state.ui.lastIdentityRecommendationOfferKey === offerKey) return { applied: false };
  state.ui.lastIdentityRecommendationOfferKey = offerKey;

  const lines = [
    "A cleaner canonical track identity is available.",
    "",
    `Current file: ${basenameOfPath(audioPath) || audioPath}`,
    `Canonical: ${String(identity?.artist || "").trim() ? `${identity.artist} - ` : ""}${String(identity?.title || "").trim()}`
  ];
  if (shouldRename) lines.push(`Rename file to: ${String(recommendation?.recommendedFileName || "").trim()}`);
  if (shouldRetag) {
    const rec = metadataRecommendation?.recommended || {};
    lines.push("Retag embedded metadata to:");
    lines.push(`Title: ${String(rec?.title || "").trim() || "(unchanged)"}`);
    lines.push(`Artist: ${String(rec?.artist || "").trim() || "(unchanged)"}`);
    lines.push(`Album: ${String(rec?.album || "").trim() || "(unchanged)"}`);
  }
  lines.push("", "Apply these changes now?");
  if (!window.confirm(lines.join("\n"))) return { applied: false };

  const res = await bridge.applyMediaIdentityRecommendation({
    filePath: audioPath,
    rename: shouldRename,
    retag: shouldRetag,
    recommendation,
    metadataRecommendation
  });
  if (!res?.ok) {
    setStatusWithDiagnostics("warning", `Unable to apply media naming/metadata recommendation: ${String(res?.error || "unknown error")}`);
    return { applied: false, error: String(res?.error || "unknown error") };
  }
  applyIdentityRecommendationResultToState({
    oldPath: audioPath,
    newPath: String(res?.filePath || audioPath).trim(),
    renamed: res?.renamed === true,
    retagged: res?.retagged === true
  });
  saveCurrentProjectSnapshot();
  persist();
  render();
  const actions = [
    res?.renamed ? `renamed to ${basenameOfPath(res.filePath)}` : "",
    res?.retagged ? "retagged metadata" : ""
  ].filter(Boolean);
  return {
    applied: true,
    message: actions.length ? `Applied track identity recommendation: ${actions.join(", ")}.` : "Applied track identity recommendation."
  };
}

function buildMissingIdentityMetadataPromptState(artifact = null) {
  const identity = artifact && typeof artifact === "object" && artifact.identity && typeof artifact.identity === "object"
    ? artifact.identity
    : {};
  const lyrics = artifact && typeof artifact === "object" && artifact.lyrics && typeof artifact.lyrics === "object"
    ? artifact.lyrics
    : {};
  const sourceMetadata = identity?.sourceMetadata && typeof identity.sourceMetadata === "object"
    ? identity.sourceMetadata
    : {};
  const metadataRecommendation = identity?.metadataRecommendation && typeof identity.metadataRecommendation === "object"
    ? identity.metadataRecommendation
    : {};
  const providerMetadataSuggestion = identity?.providerMetadataSuggestion && typeof identity.providerMetadataSuggestion === "object"
    ? identity.providerMetadataSuggestion
    : {};
  const plainFallback = lyrics?.plainPhraseFallback && typeof lyrics.plainPhraseFallback === "object"
    ? lyrics.plainPhraseFallback
    : {};
  const current = metadataRecommendation?.current && typeof metadataRecommendation.current === "object"
    ? metadataRecommendation.current
    : {};
  const recommended = metadataRecommendation?.recommended && typeof metadataRecommendation.recommended === "object"
    ? metadataRecommendation.recommended
    : {};
  const currentTitle = String(current?.title || sourceMetadata?.embeddedTitle || identity?.title || "").trim();
  const currentArtist = String(current?.artist || sourceMetadata?.embeddedArtist || identity?.artist || "").trim();
  const currentAlbum = String(current?.album || sourceMetadata?.embeddedAlbum || "").trim();
  const recommendedTitle = String(recommended?.title || identity?.title || "").trim();
  const blockedMatchedArtist = String(plainFallback?.matchedArtist || "").trim();
  const blockedReason = String(plainFallback?.blockedReason || "").trim();
  const providerSuggestedArtist = String(providerMetadataSuggestion?.artist || "").trim();
  const recommendedArtist = String(recommended?.artist || identity?.artist || "").trim() || (
    blockedReason === "artist_confidence_insufficient" ? blockedMatchedArtist : ""
  ) || providerSuggestedArtist;
  return {
    missingTitle: !currentTitle,
    missingArtist: !currentArtist,
    currentTitle,
    currentArtist,
    currentAlbum,
    recommendedTitle,
    recommendedArtist,
    artistSuggestionFromBlockedLyrics: blockedReason === "artist_confidence_insufficient" && Boolean(blockedMatchedArtist),
    artistSuggestionFromProviderConsensus: !blockedReason && Boolean(providerSuggestedArtist)
  };
}

function buildLyricsRecoveryGuidance(artifact = null) {
  const lyrics = artifact && typeof artifact === "object" && artifact.lyrics && typeof artifact.lyrics === "object"
    ? artifact.lyrics
    : {};
  const identity = artifact && typeof artifact === "object" && artifact.identity && typeof artifact.identity === "object"
    ? artifact.identity
    : {};
  const sourceMetadata = identity?.sourceMetadata && typeof identity.sourceMetadata === "object"
    ? identity.sourceMetadata
    : {};
  const plainFallback = lyrics?.plainPhraseFallback && typeof lyrics.plainPhraseFallback === "object"
    ? lyrics.plainPhraseFallback
    : {};
  const blockedReason = String(plainFallback?.blockedReason || "").trim();
  if (!blockedReason) return null;
  const embeddedArtist = String(sourceMetadata?.embeddedArtist || "").trim();
  const resolvedArtist = String(identity?.artist || "").trim();
  const matchedArtist = String(plainFallback?.matchedArtist || "").trim();
  if (blockedReason === "artist_confidence_insufficient" && !embeddedArtist) {
    return {
      level: "warning",
      message: "Lyrics recovery blocked: artist metadata is missing. Add artist metadata and rerun analysis."
    };
  }
  if (blockedReason === "artist_confidence_insufficient") {
    return {
      level: "warning",
      message: `Lyrics recovery blocked: matched artist ${matchedArtist || "candidate"} does not have enough confidence against ${resolvedArtist || embeddedArtist || "current metadata"}.`
    };
  }
  return {
    level: "warning",
    message: `Lyrics recovery blocked: ${blockedReason}.`
  };
}

async function maybePromptForMissingIdentityMetadata({
  audioPath = "",
  artifact = null,
  promptAttempted = false,
  disableInteractivePrompts = false
} = {}) {
  if (promptAttempted) return { prompted: false, retagged: false };
  const bridge = getDesktopMediaIdentityBridge();
  if (!bridge || !artifact || typeof artifact !== "object") return { prompted: false, retagged: false };
  const promptState = buildMissingIdentityMetadataPromptState(artifact);
  if (!promptState.missingTitle && !promptState.missingArtist) return { prompted: false, retagged: false };
  if (disableInteractivePrompts) {
    return { prompted: false, retagged: false, skipped: true, reason: "interactive_prompts_disabled" };
  }

  const titleValue = promptState.missingTitle
    ? window.prompt(
      `Title metadata is missing for ${basenameOfPath(audioPath) || audioPath}.\nEnter the correct track title to improve matching:`,
      promptState.recommendedTitle || ""
    )
    : promptState.currentTitle;
  if (titleValue == null) return { prompted: true, retagged: false, cancelled: true };

  const artistValue = promptState.missingArtist
    ? window.prompt(
      `${promptState.artistSuggestionFromBlockedLyrics || promptState.artistSuggestionFromProviderConsensus ? "Artist metadata is missing and providers suggested a candidate artist.\nConfirm or replace it to improve matching:" : `Artist metadata is missing for ${basenameOfPath(audioPath) || audioPath}.\nEnter the correct artist to improve matching:`}`,
      promptState.recommendedArtist || ""
    )
    : promptState.currentArtist;
  if (artistValue == null) return { prompted: true, retagged: false, cancelled: true };

  const nextTitle = String(titleValue || "").trim();
  const nextArtist = String(artistValue || "").trim();
  if ((promptState.missingTitle && !nextTitle) || (promptState.missingArtist && !nextArtist)) {
    return { prompted: true, retagged: false, cancelled: true };
  }
  const metadataRecommendation = {
    current: {
      title: promptState.currentTitle,
      artist: promptState.currentArtist,
      album: promptState.currentAlbum
    },
    recommended: {
      title: nextTitle || promptState.currentTitle,
      artist: nextArtist || promptState.currentArtist,
      album: promptState.currentAlbum
    }
  };
  const confirmLines = [
    "Metadata needed for confident track matching.",
    "",
    `File: ${basenameOfPath(audioPath) || audioPath}`,
    `Title: ${metadataRecommendation.recommended.title || "(missing)"}`,
    `Artist: ${metadataRecommendation.recommended.artist || "(missing)"}`,
    "",
    "Apply these metadata values and rerun analysis now?"
  ];
  if (!window.confirm(confirmLines.join("\n"))) return { prompted: true, retagged: false, cancelled: true };

  const res = await bridge.applyMediaIdentityRecommendation({
    filePath: audioPath,
    rename: false,
    retag: true,
    recommendation: {},
    metadataRecommendation
  });
  if (!res?.ok) {
    setStatusWithDiagnostics("warning", `Unable to apply metadata required for confident track matching: ${String(res?.error || "unknown error")}`);
    return { prompted: true, retagged: false, error: String(res?.error || "unknown error") };
  }
  applyIdentityRecommendationResultToState({
    oldPath: audioPath,
    newPath: String(res?.filePath || audioPath).trim(),
    renamed: false,
    retagged: res?.retagged === true
  });
  saveCurrentProjectSnapshot();
  persist();
  render();
  return { prompted: true, retagged: res?.retagged === true };
}

function buildProjectSequencesIndex() {
  const paths = [];
  const addPath = (value) => {
    const next = String(value || "").trim();
    if (next) paths.push(next);
  };

  addPath(state.sequencePathInput);
  addPath(state.newSequencePathInput);
  for (const p of Array.isArray(state.recentSequences) ? state.recentSequences : []) addPath(p);
  for (const s of Array.isArray(state.sequenceCatalog) ? state.sequenceCatalog : []) {
    addPath(typeof s === "string" ? s : s?.path || "");
  }

  const uniquePaths = Array.from(new Set(paths));
  return uniquePaths.map((sequencePath) => ({
    sequencePath,
    sidecarPath: sidecarPathForSequencePath(sequencePath),
    sequenceName: basenameOfPath(sequencePath) || sequencePath,
    inShowCatalog: (state.sequenceCatalog || []).some((s) => String((s && s.path) || s || "") === sequencePath),
    isActive: String(state.sequencePathInput || "").trim() === sequencePath
  }));
}

function extractProjectSnapshot() {
  state.projectSequences = buildProjectSequencesIndex();
  const handoffs = {};
  for (const contract of AGENT_HANDOFF_CONTRACTS) {
    const row = agentRuntime.handoffs?.[contract];
    if (!row?.valid || !isPlainObject(row.payload)) continue;
    handoffs[contract] = {
      contract,
      producer: String(row.producer || "").trim(),
      payload: row.payload,
      context: isPlainObject(row.context) ? row.context : agentRuntimeState.buildAgentPersistenceContext(),
      at: String(row.at || "")
    };
  }
  return {
    projectMetadataRoot: state.projectMetadataRoot,
    projectFilePath: state.projectFilePath,
    endpoint: state.endpoint,
    route: state.route,
    projectConcept: state.projectConcept,
    mediaPath: state.mediaPath,
    sequencePathInput: state.sequencePathInput,
    newSequencePathInput: state.newSequencePathInput,
    newSequenceType: state.newSequenceType,
    newSequenceDurationMs: state.newSequenceDurationMs,
    newSequenceFrameMs: state.newSequenceFrameMs,
    audioPathInput: state.audioPathInput,
    savePathInput: state.savePathInput,
    lastApplyBackupPath: state.lastApplyBackupPath,
    recentSequences: state.recentSequences,
    showDirectoryStats: state.showDirectoryStats,
    projectCreatedAt: state.projectCreatedAt,
    projectUpdatedAt: state.projectUpdatedAt,
    inspiration: state.inspiration,
    activeSequence: state.activeSequence,
    projectSequences: state.projectSequences,
    proposed: Array.isArray(state.proposed) ? [...state.proposed] : [],
    agentPlan: state.agentPlan && typeof state.agentPlan === "object" ? structuredClone(state.agentPlan) : null,
    creative: state.creative && typeof state.creative === "object" ? structuredClone(state.creative) : structuredClone(defaultState.creative),
    directorProfile: state.directorProfile && typeof state.directorProfile === "object"
      ? structuredClone(state.directorProfile)
      : structuredClone(defaultState.directorProfile),
    agentRuntime: {
      activeRole: String(agentRuntime.activeRole || "").trim(),
      handoffs
    },
    draft: {
    draftBaseRevision: String(state.draftBaseRevision || "unknown"),
    draftSequencePath: String(state.draftSequencePath || ""),
    hasDraftProposal: Boolean(state.flags?.hasDraftProposal),
    proposalStale: Boolean(state.flags?.proposalStale)
    },
    flags: {
      planOnlyMode: state.flags.planOnlyMode
    },
    safety: state.safety,
    ui: {
      sequenceMode: state.ui.sequenceMode
    }
  };
}

function applyProjectSnapshot(snapshot) {
  if (!snapshot) return;
  state.projectMetadataRoot = String(snapshot?.projectMetadataRoot || state.projectMetadataRoot || "");
  state.projectFilePath = String(snapshot?.projectFilePath || state.projectFilePath || "");
  state.endpoint = normalizeConfiguredEndpoint(snapshot?.endpoint || state.endpoint);
  const route = String(snapshot?.route || "").trim();
  if (route && routes.includes(route)) state.route = route;
  state.projectConcept = String(snapshot?.projectConcept || state.projectConcept || "");
  state.mediaPath = String(snapshot?.mediaPath || state.mediaPath || "");
  state.sequencePathInput = snapshot.sequencePathInput || state.sequencePathInput;
  state.newSequencePathInput = snapshot.newSequencePathInput || state.newSequencePathInput;
  state.newSequenceType = snapshot.newSequenceType || state.newSequenceType;
  state.newSequenceDurationMs = Number.isFinite(Number(snapshot.newSequenceDurationMs))
    ? Math.max(1, Number(snapshot.newSequenceDurationMs))
    : state.newSequenceDurationMs;
  state.newSequenceFrameMs = Number.isFinite(Number(snapshot.newSequenceFrameMs))
    ? Math.max(1, Number(snapshot.newSequenceFrameMs))
    : state.newSequenceFrameMs;
  state.audioPathInput = snapshot.audioPathInput || state.audioPathInput;
  state.audioAnalysis = structuredClone(defaultState.audioAnalysis);
  state.sequenceAgentRuntime = snapshot?.sequenceAgentRuntime && typeof snapshot.sequenceAgentRuntime === "object"
      ? {
        timingTrackPolicies:
          snapshot.sequenceAgentRuntime.timingTrackPolicies && typeof snapshot.sequenceAgentRuntime.timingTrackPolicies === "object"
            ? { ...snapshot.sequenceAgentRuntime.timingTrackPolicies }
            : {},
        timingGeneratedSignatures:
          snapshot.sequenceAgentRuntime.timingGeneratedSignatures && typeof snapshot.sequenceAgentRuntime.timingGeneratedSignatures === "object"
            ? { ...snapshot.sequenceAgentRuntime.timingGeneratedSignatures }
            : {},
        timingTrackProvenance:
          snapshot.sequenceAgentRuntime.timingTrackProvenance && typeof snapshot.sequenceAgentRuntime.timingTrackProvenance === "object"
            ? { ...snapshot.sequenceAgentRuntime.timingTrackProvenance }
            : {}
      }
    : structuredClone(defaultState.sequenceAgentRuntime);
  state.savePathInput = snapshot.savePathInput || state.savePathInput;
  state.lastApplyBackupPath = snapshot?.lastApplyBackupPath || "";
  state.recentSequences = Array.isArray(snapshot.recentSequences) ? snapshot.recentSequences : [];
  state.showDirectoryStats =
    snapshot?.showDirectoryStats && typeof snapshot.showDirectoryStats === "object"
      ? {
          xsqCount: Number.isFinite(Number(snapshot.showDirectoryStats.xsqCount))
            ? Math.max(0, Number(snapshot.showDirectoryStats.xsqCount))
            : 0,
          xdmetaCount: Number.isFinite(Number(snapshot.showDirectoryStats.xdmetaCount))
            ? Math.max(0, Number(snapshot.showDirectoryStats.xdmetaCount))
            : 0
        }
      : { ...state.showDirectoryStats };
  state.projectCreatedAt = String(snapshot?.projectCreatedAt || state.projectCreatedAt || "");
  state.projectUpdatedAt = String(snapshot?.projectUpdatedAt || state.projectUpdatedAt || "");
  if (snapshot?.inspiration && typeof snapshot.inspiration === "object") {
    state.inspiration = {
      ...state.inspiration,
      ...snapshot.inspiration,
      paletteSwatches: Array.isArray(snapshot.inspiration.paletteSwatches)
        ? snapshot.inspiration.paletteSwatches.map((v) => String(v || "").trim()).filter(Boolean)
        : state.inspiration.paletteSwatches
    };
  }
  state.activeSequence = snapshot.activeSequence || state.activeSequence;
  state.proposed = Array.isArray(snapshot?.proposed) ? [...snapshot.proposed] : [];
  state.agentPlan = snapshot?.agentPlan && typeof snapshot.agentPlan === "object"
    ? structuredClone(snapshot.agentPlan)
    : null;
  if (snapshot?.creative && typeof snapshot.creative === "object") {
    state.creative = { ...structuredClone(defaultState.creative), ...snapshot.creative };
  }
  state.directorProfile = normalizeDirectorProfile(snapshot?.directorProfile, {
    directorId: state.projectName ? normalizeProjectDisplayName(state.projectName).toLowerCase().replace(/\s+/g, "-") : "default-director",
    displayName: state.projectName || "Director"
  });
  if (snapshot?.draft && typeof snapshot.draft === "object") {
    state.draftBaseRevision = String(snapshot.draft.draftBaseRevision || state.draftBaseRevision || "unknown");
    state.draftSequencePath = String(snapshot.draft.draftSequencePath || state.draftSequencePath || "");
    state.flags.hasDraftProposal = Boolean(snapshot.draft.hasDraftProposal);
    state.flags.proposalStale = Boolean(snapshot.draft.proposalStale);
  }
  clearAgentHandoffs();
  if (snapshot?.agentRuntime && isPlainObject(snapshot.agentRuntime)) {
    const runtimeRole = String(snapshot.agentRuntime.activeRole || "").trim();
    if (runtimeRole) {
      agentRuntimeState.setAgentActiveRole(runtimeRole);
    }
    const persisted = isPlainObject(snapshot.agentRuntime.handoffs) ? snapshot.agentRuntime.handoffs : {};
    for (const contract of AGENT_HANDOFF_CONTRACTS) {
      const row = isPlainObject(persisted[contract]) ? persisted[contract] : null;
      if (!row || !isPlainObject(row.payload)) continue;
      const errors = validateAgentHandoff(contract, row.payload);
      if (errors.length) continue;
      agentRuntime.handoffs[contract] = {
        contract,
        producer: String(row.producer || "").trim(),
        payload: row.payload,
        context: isPlainObject(row.context) ? row.context : agentRuntimeState.buildAgentPersistenceContext(),
        valid: true,
        errors: [],
        at: String(row.at || new Date().toISOString())
      };
    }
    agentRuntimeState.refreshAgentRuntimeHealth();
    reconcileHandoffsAgainstCurrentContext({ reasonPrefix: "project snapshot hydrate" });
  }
  if (!agentRuntimeState.getValidHandoff("intent_handoff_v1") && isPlainObject(state.creative?.intentHandoff)) {
    agentRuntimeState.setAgentHandoff("intent_handoff_v1", state.creative.intentHandoff, "designer_dialog");
  }
  if (!agentRuntimeState.getValidHandoff("plan_handoff_v1") && isPlainObject(state.agentPlan?.handoff)) {
    agentRuntimeState.setAgentHandoff("plan_handoff_v1", state.agentPlan.handoff, "sequence_agent");
  }
  state.flags.planOnlyMode = Boolean(snapshot?.flags?.planOnlyMode);
  state.safety = { ...state.safety, ...(snapshot.safety || {}) };
  state.ui.sequenceMode = snapshot?.ui?.sequenceMode || "existing";
  if (Array.isArray(snapshot.projectSequences)) {
    state.projectSequences = snapshot.projectSequences.map((entry) => ({
      sequencePath: String(entry?.sequencePath || "").trim(),
      sidecarPath: String(entry?.sidecarPath || "").trim(),
      sequenceName: String(entry?.sequenceName || "").trim(),
      inShowCatalog: Boolean(entry?.inShowCatalog),
      isActive: Boolean(entry?.isActive)
    })).filter((entry) => entry.sequencePath);
  } else {
    state.projectSequences = [];
  }
  ensureMetadataTargetSelection();
  if (!state.flags.hasDraftProposal) {
    state.flags.hasDraftProposal = state.proposed.length > 0;
  }
}

function saveCurrentProjectSnapshot() {
  const key = getProjectKey();
  if (!key || key === "::") return;
  const store = loadProjectsStore();
  store[key] = extractProjectSnapshot();
  persistProjectsStore(store);
}

function deleteProjectSnapshot(projectName, showFolder) {
  const key = getProjectKey(projectName, showFolder);
  if (!key || key === "::") return;
  const store = loadProjectsStore();
  if (!(key in store)) return;
  delete store[key];
  persistProjectsStore(store);
}

function tryLoadProjectSnapshot(projectName, showFolder) {
  const key = getProjectKey(projectName, showFolder);
  const store = loadProjectsStore();
  const snapshot = store[key];
  if (!snapshot) return false;
  applyProjectSnapshot(snapshot);
  return true;
}

const routes = ["settings", "project", "metadata", "audio", "design", "sequence", "review", "history"];

function setRoute(route) {
  const normalizedRoute = route === "inspiration"
    ? "design"
    : route === "setup"
      ? "settings"
      : route;
  if (!routes.includes(normalizedRoute)) return;
  state.route = normalizedRoute;
  state.ui.inspectedArtifact = "";
  persist();
  render();
  if (normalizedRoute === "audio") {
    void projectCatalogRuntime.refreshMediaCatalog({ silent: true });
  }
  if (normalizedRoute === "sequence") {
    void projectCatalogRuntime.refreshSequenceCatalog({ silent: true });
  }
}

function onInspectArtifact(kind) {
  const next = String(kind || "").trim();
  state.ui.inspectedArtifact = next;
  render();
}

function onCloseArtifactDetail() {
  if (!state.ui.inspectedArtifact) return;
  state.ui.inspectedArtifact = "";
  render();
}

async function onSelectHistoryEntry(entryId = "") {
  await projectHistoryRuntime.selectHistoryEntry(entryId, { forReview: true });
}

function setStatus(level, text) {
  state.status = { level, text };
}

function pushDiagnostic(level, text, details = "") {
  const entry = {
    ts: new Date().toISOString(),
    level,
    text,
    details
  };
  state.diagnostics = [entry, ...(state.diagnostics || [])].slice(0, 120);
}

function setStatusWithDiagnostics(level, text, details = "") {
  setStatus(level, text);
  if (level !== "info" || details) {
    pushDiagnostic(level, text, details);
  }
}

function getAgentApplyRolloutMode() {
  const raw = String(state.safety?.agentApplyRollout || "full").trim().toLowerCase();
  if (raw === "full" || raw === "plan-only" || raw === "disabled") return raw;
  return "full";
}

function enforceConnectivityPlanOnly() {
  const changed = !state.flags.planOnlyForcedByConnectivity || !state.flags.planOnlyMode;
  state.flags.planOnlyMode = true;
  state.flags.planOnlyForcedByConnectivity = true;
  return changed;
}

function releaseConnectivityPlanOnly() {
  if (!state.flags.planOnlyForcedByConnectivity) return false;
  state.flags.planOnlyForcedByConnectivity = false;
  if (!state.flags.planOnlyForcedByRollout) {
    state.flags.planOnlyMode = false;
  }
  return true;
}

function enforceRolloutPlanOnly() {
  const changed = !state.flags.planOnlyForcedByRollout || !state.flags.planOnlyMode;
  state.flags.planOnlyMode = true;
  state.flags.planOnlyForcedByRollout = true;
  return changed;
}

function releaseRolloutPlanOnly() {
  if (!state.flags.planOnlyForcedByRollout) return false;
  state.flags.planOnlyForcedByRollout = false;
  if (!state.flags.planOnlyForcedByConnectivity) {
    state.flags.planOnlyMode = false;
  }
  return true;
}

function applyRolloutPolicy() {
  const mode = getAgentApplyRolloutMode();
  if (mode === "full") {
    const released = releaseRolloutPlanOnly();
    return { mode, enforced: false, changed: released };
  }
  const changed = enforceRolloutPlanOnly();
  return { mode, enforced: true, changed };
}

function evaluateApplyHandoffGate() {
  return applyReadinessRuntime.evaluateApplyHandoffGate();
}

function invalidateApplyApproval() {
  state.ui.applyApprovalChecked = false;
}

function parseVersionParts(versionText) {
  const text = String(versionText || "").trim();
  const m = text.match(/^(\d{4})\.(\d{1,2})/);
  if (!m) return null;
  return { major: Number.parseInt(m[1], 10), minor: Number.parseInt(m[2], 10) };
}

function isVersionAtLeastFloor(versionText, floorMajor, floorMinor) {
  const parsed = parseVersionParts(versionText);
  if (!parsed) return null;
  if (parsed.major > floorMajor) return true;
  if (parsed.major < floorMajor) return false;
  return parsed.minor >= floorMinor;
}

function deepFindVersionString(value, depth = 0) {
  if (depth > 6 || value == null) return "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}\.\d+(\.\d+)?/.test(trimmed)) return trimmed;
    return "";
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = deepFindVersionString(item, depth + 1);
      if (found) return found;
    }
    return "";
  }
  if (typeof value === "object") {
    for (const key of Object.keys(value)) {
      const found = deepFindVersionString(value[key], depth + 1);
      if (found) return found;
    }
  }
  return "";
}

function extractVersionFromCapabilities(caps) {
  const data = caps?.data && typeof caps.data === "object" ? caps.data : {};
  const candidates = [data.xlightsVersion, data.version, data.appVersion, data.buildVersion];
  const found = candidates.find((v) => typeof v === "string" && v.trim());
  if (found) return found.trim();
  return deepFindVersionString(data);
}

function extractVersionFromVersionResponse(body) {
  const data = body?.data && typeof body.data === "object" ? body.data : {};
  const candidates = [data.xlightsVersion, data.version, data.appVersion, data.buildVersion, body?.version];
  const found = candidates.find((v) => typeof v === "string" && v.trim());
  if (found) return found.trim();
  return deepFindVersionString(data) || deepFindVersionString(body);
}

async function hydrateVersionIfMissing(endpoint, caps = null) {
  if (String(state.health.xlightsVersion || "").trim()) return;
  const commands = Array.isArray(caps?.data?.commands) ? caps.data.commands : [];
  if (commands.length > 0 && !commands.includes("system.getVersion")) return;
  try {
    const versionBody = await getSystemVersion(endpoint);
    const version = extractVersionFromVersionResponse(versionBody);
    if (!version) return;
    const compat = isVersionAtLeastFloor(version, 2026, 1);
    state.health.xlightsVersion = version;
    if (compat !== null) {
      state.flags.xlightsCompatible = compat;
      state.health.compatibilityStatus = compat ? "compatible" : "incompatible";
    }
  } catch {
    // Non-fatal; xLights may not expose system.getVersion.
  }
}

function applyCapabilitiesHealth(caps, sequenceOpen = state.health.sequenceOpen) {
  const commands = Array.isArray(caps?.data?.commands) ? caps.data.commands : [];
  const extractedVersion = extractVersionFromCapabilities(caps);
  const xlightsVersion = extractedVersion || String(state.health.xlightsVersion || "").trim();
  const compat = xlightsVersion
    ? isVersionAtLeastFloor(xlightsVersion, 2026, 1)
    : null;
  const bridgeHealth = getDesktopBridgeHealth();

  state.flags.xlightsConnected = true;
  state.flags.xlightsCompatible = compat !== false;
  state.health = {
    ...state.health,
    lastCheckedAt: new Date().toISOString(),
    capabilitiesCount: commands.length,
    capabilityCommands: commands,
    hasValidateCommands: commands.includes("system.validateCommands"),
    hasJobsGet: commands.includes("jobs.get"),
    sequenceOpen: Boolean(sequenceOpen),
    runtimeReady: bridgeHealth.runtimeReady,
    desktopFileDialogReady: bridgeHealth.desktopFileDialogReady,
    desktopBridgeApiCount: bridgeHealth.desktopBridgeApiCount,
    xlightsVersion,
    compatibilityStatus: compat === null ? "unknown" : compat ? "compatible" : "incompatible"
  };
  return { commands, xlightsVersion, compat };
}

function getSectionName(line) {
  const [section] = line.split("/");
  return (section || "General").trim();
}

function getModelHintNames(line) {
  const parts = String(line || "")
    .split("/")
    .map((part) => part.trim());
  if (parts.length < 2) return [];
  return splitModelTokenList(parts[1]);
}

function summarizeImpactForLines(lines = []) {
  const source = Array.isArray(lines) ? lines.filter(Boolean) : [];
  const targetSet = new Set();
  const sectionSet = new Set();
  for (const line of source) {
    for (const target of getModelHintNames(line)) targetSet.add(target);
    sectionSet.add(getSectionName(line));
  }

  const sectionRows = getSectionChoiceRows();
  const sectionMap = new Map(sectionRows.map((row) => [row.label, row]));
  const sectionWindows = Array.from(sectionSet)
    .map((label) => {
      const row = sectionMap.get(label);
      if (!row || typeof row.startMs !== "number") return `${label}: start unknown`;
      return `${label}: ${formatMs(row.startMs)}`;
    })
    .slice(0, 5);

  return {
    targetCount: targetSet.size,
    targets: Array.from(targetSet).slice(0, 6),
    sectionCount: sectionSet.size,
    sectionWindows
  };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function splitModelTokenList(raw) {
  return String(raw || "")
    .split(/\+|,|&/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function renderProposedLineHtml(line) {
  const parts = String(line || "")
    .split("/")
    .map((p) => p.trim())
    .filter((p, idx) => idx < 3 || p.length > 0);

  if (!parts.length) return "";

  const section = parts[0] || "General";
  const maybeModels = parts.length > 1 ? parts[1] : "";
  const description = parts.length > 2 ? parts.slice(2).join(" / ") : (parts.length > 1 ? "" : section);
  const modelTokens = splitModelTokenList(maybeModels);

  const sectionChip = `<button class="proposed-tag proposed-tag-section" data-proposed-tag-type="section" data-proposed-tag-value="${escapeHtml(section)}">${escapeHtml(section)}</button>`;
  const modelChips = modelTokens
    .map((m) => `<button class="proposed-tag proposed-tag-model" data-proposed-tag-type="model" data-proposed-tag-value="${escapeHtml(m)}">${escapeHtml(m)}</button>`)
    .join('<span class="proposed-inline-sep"> + </span>');
  const descriptionHtml = escapeHtml(description || "");

  if (!modelTokens.length) {
    return `
      <div class="proposed-line">
        <span class="proposed-inline-text">
          In <span class="proposed-inline-chip">${sectionChip}</span>${descriptionHtml ? `, ${descriptionHtml}` : ""}.
        </span>
      </div>
    `;
  }

  return `
    <div class="proposed-line">
      <span class="proposed-inline-text">
        In <span class="proposed-inline-chip">${sectionChip}</span> on <span class="proposed-inline-chip">${modelChips}</span>${descriptionHtml ? `, ${descriptionHtml}` : ""}.
      </span>
    </div>
  `;
}

function getInlineModelTerms() {
  const fromLiveModels = (state.models || [])
    .map((m) => String(m?.name || "").trim())
    .filter(Boolean);
  return Array.from(new Set([...INLINE_CHIP_MODEL_FALLBACKS, ...fromLiveModels]))
    .filter((t) => t.length >= 3);
}

function inlineChipButtonHtml(type, label) {
  const cls = type === "section" ? "proposed-tag-section" : "proposed-tag-model";
  return `<button class="proposed-tag ${cls}" data-proposed-tag-type="${type}" data-proposed-tag-value="${escapeHtml(label)}">${escapeHtml(label)}</button>`;
}

function renderInlineChipSentence(text) {
  const source = String(text || "");
  if (!source.trim()) return "";

  const replacements = [];
  const place = (type, label) => {
    const token = `@@XLD_TAG_${replacements.length}@@`;
    replacements.push({ token, type, label: String(label || "").trim() });
    return token;
  };

  let working = source;
  const sectionRegex = /\b(pre-chorus|pre chorus|chorus|verse|bridge|intro|outro|drop|build)(\s*\d+)?\b/gi;
  working = working.replace(sectionRegex, (match) => place("section", match));

  const modelTerms = getInlineModelTerms().sort((a, b) => b.length - a.length);
  if (modelTerms.length) {
    const modelRegex = new RegExp(`\\b(?:${modelTerms.map(escapeRegex).join("|")})\\b`, "gi");
    working = working.replace(modelRegex, (match) => place("model", match));
  }

  let html = escapeHtml(working);
  for (const { token, type, label } of replacements) {
    html = html.replace(token, inlineChipButtonHtml(type, label));
  }
  return html;
}

function getSectionChoiceList() {
  return Array.isArray(state.sectionSuggestions)
    ? state.sectionSuggestions.map((s) => normalizeSectionLabel(s)).filter(Boolean)
    : [];
}

function formatMs(ms) {
  if (typeof ms !== "number" || Number.isNaN(ms) || ms < 0) return "--:--.---";
  const totalMs = Math.floor(ms);
  const minutes = Math.floor(totalMs / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const millis = totalMs % 1000;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

function getSectionChoiceRows() {
  const labels = getSectionChoiceList();
  const starts = state.sectionStartByLabel && typeof state.sectionStartByLabel === "object"
    ? state.sectionStartByLabel
    : {};
  return labels.map((label, idx) => ({
    label,
    startMs: typeof starts[label] === "number" ? starts[label] : null,
    hasStart: typeof starts[label] === "number",
    order: idx
  })).sort((a, b) => {
    if (a.hasStart !== b.hasStart) return a.hasStart ? -1 : 1;
    if (a.hasStart && b.hasStart && a.startMs !== b.startMs) return a.startMs - b.startMs;
    if (!a.hasStart && !b.hasStart && a.order !== b.order) return a.order - b.order;
    return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
  });
}

function getSelectedSections() {
  const selected = Array.isArray(state.ui.sectionSelections) ? state.ui.sectionSelections : ["all"];
  const cleaned = selected.map((s) => normalizeSectionLabel(s)).filter(Boolean);
  return Array.from(new Set(cleaned));
}

function hasAllSectionsSelected() {
  return getSelectedSections().includes("all");
}

function setSectionSelections(values) {
  const before = normalizeStringArray(getSelectedSections());
  const next = Array.isArray(values) ? values.map((v) => normalizeSectionLabel(v)).filter(Boolean) : [];
  if (next.length === 0) {
    state.ui.sectionSelections = [];
  } else if (next.includes("all") && next.length > 1) {
    state.ui.sectionSelections = Array.from(new Set(next.filter((v) => v !== "all")));
  } else if (next.includes("all")) {
    state.ui.sectionSelections = ["all"];
  } else {
    state.ui.sectionSelections = Array.from(new Set(next));
  }
  const after = normalizeStringArray(getSelectedSections());
  if (!arraysEqualAsSets(before, after)) {
    agentRuntimeState.invalidatePlanHandoff("section selection changed");
  }
  invalidateApplyApproval();
  saveCurrentProjectSnapshot();
  persist();
  render();
}

function reconcileSectionSelectionsToAvailable() {
  if (hasAllSectionsSelected()) return;
  const available = new Set(getSectionChoiceList());
  const kept = getSelectedSections().filter((section) => available.has(section));
  state.ui.sectionSelections = kept;
}

function getSections() {
  return getSectionChoiceList();
}

function bumpVersion(summary = "Applied draft proposal", effects = 28) {
  const nextId = `v${Number(state.versions[0].id.slice(1)) + 1}`;
  const proposalSnapshot = [...state.proposed];
  state.versions.unshift({
    id: nextId,
    summary,
    effects,
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    proposal: proposalSnapshot
  });
  state.selectedVersion = nextId;
}

function versionById(id) {
  return state.versions.find((v) => v.id === id) || null;
}

function ensureVersionSnapshots() {
  state.versions = state.versions.map((v, idx) => {
    if (Array.isArray(v.proposal)) return v;
    const fallback = idx === 0 ? [...state.proposed] : [`${v.summary} / snapshot placeholder`];
    return { ...v, proposal: fallback };
  });
}

ensureVersionSnapshots();

async function verifyAppliedPlanReadback(plan = []) {
  return verifyAppliedPlanReadbackWithDeps(plan, {
    endpoint: state.endpoint,
    getTimingMarks,
    getDisplayElementOrder,
    listEffects
  });
}

async function onApply(sourceLines = applyReviewRuntime.filteredProposed(), applyLabel = "proposal") {
  return applyReviewRuntime.applyProposal(sourceLines, applyLabel);
}


async function onApplySelected() {
  return applyReviewRuntime.applySelectedProposal();
}

async function onApplyAll() {
  return await applyReviewRuntime.applyAllProposal();
}

async function onGenerate(intentOverride = "", options = {}) {
  return proposalGenerationRuntime.generateProposal(intentOverride, options);
}

function onTogglePlanOnly() {
  if (state.flags.planOnlyForcedByConnectivity) {
    setStatusWithDiagnostics(
      "warning",
      "Plan-only mode is currently forced while xLights is unavailable."
    );
    return render();
  }
  if (state.flags.planOnlyForcedByRollout) {
    setStatusWithDiagnostics(
      "warning",
      "Plan-only mode is currently forced by rollout policy."
    );
    return render();
  }
  state.flags.planOnlyMode = !state.flags.planOnlyMode;
  setStatus(
    "info",
    state.flags.planOnlyMode
      ? "Plan-only mode enabled. Apply is disabled."
      : "Plan-only mode disabled."
  );
  clearDesignRevisionTarget();
  saveCurrentProjectSnapshot();
  persist();
  render();
}

function toFiniteNumberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function currentLayoutMode() {
  const mode = String(state.sceneGraph?.stats?.layoutMode || state.health?.sceneGraphLayoutMode || "").toLowerCase();
  return mode === "3d" ? "3d" : "2d";
}

function normalizeVector3(source) {
  const row = isPlainObject(source) ? source : {};
  return {
    x: toFiniteNumberOrNull(row.x),
    y: toFiniteNumberOrNull(row.y),
    z: toFiniteNumberOrNull(row.z)
  };
}

function normalizeSceneGraphModelNode(model = {}, source = "scene") {
  const id = String(model?.name || model?.id || "").trim();
  const typeInfo = classifyModelDisplayType(model?.type || "");
  const type = normalizeElementType(model?.type || "model") || "model";
  const transform = isPlainObject(model?.transform) ? model.transform : {};
  const dimensions = isPlainObject(model?.dimensions) ? model.dimensions : {};
  const availableBufferStyles = Array.isArray(model?.availableBufferStyles)
    ? model.availableBufferStyles.map((v) => String(v || "").trim()).filter(Boolean)
    : [];
  const defaultBufferStyle = String(model?.defaultBufferStyle || "Default").trim() || "Default";
  const renderPolicyCategory = String(model?.renderPolicy || "default").trim() || "default";
  const currentFamily = inferBufferStyleFamily(renderPolicyCategory !== "default" ? renderPolicyCategory : defaultBufferStyle);
  const availableStyleFamilies = Array.from(new Set(availableBufferStyles.map((row) => inferBufferStyleFamily(row)).filter(Boolean)));
  const riskLevel = inferRenderRiskLevel(currentFamily);
  return {
    id,
    name: String(model?.name || id),
    type,
    rawType: String(typeInfo.rawType || model?.type || ""),
    canonicalType: String(typeInfo.canonicalType || "unknown"),
    typeCategory: String(typeInfo.category || "unknown"),
    typeFlags: {
      isGroup: Boolean(typeInfo.isGroup),
      isSubmodel: Boolean(typeInfo.isSubmodel),
      isDmx: Boolean(typeInfo.isDmx),
      isDeprecated: Boolean(typeInfo.isDeprecated)
    },
    source,
    layoutGroup: String(model?.layoutGroup || "").trim(),
    groupNames: Array.isArray(model?.groupNames) ? model.groupNames.map((v) => String(v || "").trim()).filter(Boolean) : [],
    startChannel: toFiniteNumberOrNull(model?.startChannel),
    endChannel: toFiniteNumberOrNull(model?.endChannel),
    renderPolicy: {
      layout: String(model?.renderLayout || "").trim(),
      defaultBufferStyle,
      category: renderPolicyCategory,
      currentFamily,
      riskLevel,
      availableBufferStyles,
      availableStyleFamilies
    },
    transform: {
      position: normalizeVector3(transform.position),
      rotationDeg: normalizeVector3(transform.rotationDeg),
      scale: normalizeVector3(transform.scale)
    },
    dimensions: {
      width: toFiniteNumberOrNull(dimensions.width),
      height: toFiniteNumberOrNull(dimensions.height),
      depth: toFiniteNumberOrNull(dimensions.depth)
    },
    attributes: isPlainObject(model?.attributes) ? model.attributes : {}
  };
}

function normalizeGroupMemberEntry(member = {}) {
  const id = String(member?.id || member?.name || "").trim();
  return {
    id,
    name: String(member?.name || id).trim(),
    type: normalizeElementType(member?.type || "model") || "model",
    rawType: String(member?.type || "").trim(),
    isGroup: Boolean(member?.isGroup),
    isSubmodel: Boolean(member?.isSubmodel),
    active: Boolean(member?.active)
  };
}

function buildSceneGraphFromData({
  sceneData = {},
  models = [],
  submodels = [],
  groupMembersById = {},
  source = "",
  warnings = []
} = {}) {
  const modelsById = {};
  const groupsById = {};
  const cameras = (Array.isArray(sceneData?.cameras) ? sceneData.cameras : [])
    .map((row) => ({
      name: String(row?.name || "").trim(),
      type: String(row?.type || "").trim(),
      isDefault: Boolean(row?.isDefault),
      position: normalizeVector3(row?.position),
      anglesDeg: normalizeVector3(row?.anglesDeg),
      distance: toFiniteNumberOrNull(row?.distance),
      zoom: toFiniteNumberOrNull(row?.zoom)
    }))
    .filter((row) => row.name);
  const layoutMode = inferLayoutMode({ cameras });
  const sceneModels = Array.isArray(sceneData?.models) ? sceneData.models : [];
  const modelRows = sceneModels.length ? sceneModels : (Array.isArray(models) ? models : []);
  for (const row of modelRows) {
    const node = normalizeSceneGraphModelNode(row, sceneModels.length ? "layout.getScene" : "layout.getModels");
    if (!node.id) continue;
    if (node.type === "group") {
      const membership = isPlainObject(groupMembersById?.[node.id]) ? groupMembersById[node.id] : {};
      groupsById[node.id] = {
        ...node,
        members: {
          direct: Array.isArray(membership.directMembers) ? membership.directMembers.map(normalizeGroupMemberEntry).filter((row) => row.id) : [],
          active: Array.isArray(membership.activeMembers) ? membership.activeMembers.map(normalizeGroupMemberEntry).filter((row) => row.id) : [],
          flattened: Array.isArray(membership.flattenedMembers) ? membership.flattenedMembers.map(normalizeGroupMemberEntry).filter((row) => row.id) : [],
          flattenedAll: Array.isArray(membership.flattenedAllMembers) ? membership.flattenedAllMembers.map(normalizeGroupMemberEntry).filter((row) => row.id) : []
        }
      };
    }
    else modelsById[node.id] = node;
  }

  const submodelsById = {};
  for (const row of (Array.isArray(submodels) ? submodels : [])) {
    const id = String(row?.id || "").trim();
    if (!id) continue;
    submodelsById[id] = {
      id,
      name: String(row?.name || id).trim(),
      type: "submodel",
      source: "layout.getSubmodels",
      parentId: String(row?.parentId || parseSubmodelParentId(id)).trim(),
      layoutGroup: String(row?.layoutGroup || "").trim(),
      groupNames: Array.isArray(row?.groupNames) ? row.groupNames.map((v) => String(v || "").trim()).filter(Boolean) : [],
      startChannel: toFiniteNumberOrNull(row?.startChannel),
      endChannel: toFiniteNumberOrNull(row?.endChannel),
      renderPolicy: {
        renderLayout: String(row?.renderLayout || "").trim(),
        submodelType: String(row?.submodelType || "").trim(),
        bufferStyle: String(row?.bufferStyle || "").trim() || "Default",
        availableBufferStyles: Array.isArray(row?.availableBufferStyles) ? row.availableBufferStyles.map((v) => String(v || "").trim()).filter(Boolean) : []
      },
      membership: {
        nodeCount: Number(row?.membership?.nodeCount || 0),
        nodeChannels: Array.isArray(row?.membership?.nodeChannels) ? row.membership.nodeChannels.map((v) => Number(v)).filter((v) => Number.isFinite(v)) : [],
        nodeRefs: Array.isArray(row?.membership?.nodeRefs) ? row.membership.nodeRefs : []
      }
    };
  }

  const displayElements = (Array.isArray(sceneData?.displayElements) ? sceneData.displayElements : [])
    .map((row) => ({
      id: String(row?.id || "").trim(),
      name: String(row?.name || "").trim(),
      type: normalizeElementType(row?.type || ""),
      parentId: String(row?.parentId || "").trim(),
      orderIndex: Number.isFinite(Number(row?.orderIndex)) ? Number(row.orderIndex) : null
    }))
    .filter((row) => row.id);

  const views = (Array.isArray(sceneData?.views) ? sceneData.views : [])
    .map((row) => ({
      name: String(row?.name || "").trim(),
      models: Array.isArray(row?.models) ? row.models.map((v) => String(v || "").trim()).filter(Boolean) : []
    }))
    .filter((row) => row.name);

  const allModelNodes = Object.values(modelsById).concat(Object.values(groupsById));
  const modelTypeCategoryCounts = {};
  for (const row of allModelNodes) {
    const key = String(row?.typeCategory || "unknown").trim() || "unknown";
    modelTypeCategoryCounts[key] = Number(modelTypeCategoryCounts[key] || 0) + 1;
  }
  const hasSpatialTransforms = allModelNodes.some((row) => {
    const p = row?.transform?.position || {};
    return p.x !== null || p.y !== null || p.z !== null;
  });
  const spatialNodes = collectSpatialNodes({
    modelsById,
    groupsById,
    submodelsById
  });
  const bounds = computeSceneBounds(spatialNodes);
  const depthBands = classifyDepthBands({ modelsById, groupsById, submodelsById });
  const depthPlanningEnabled = layoutMode === "3d";

  return {
    loaded: true,
    source,
    loadedAt: new Date().toISOString(),
    modelsById,
    groupsById,
    submodelsById,
    displayElements,
    views,
    cameras,
    stats: {
      modelCount: Object.keys(modelsById).length,
      groupCount: Object.keys(groupsById).length,
      groupMembershipCount: Object.values(groupsById).reduce((sum, row) => sum + Number(row?.members?.direct?.length || 0), 0),
      submodelCount: Object.keys(submodelsById).length,
      displayElementCount: displayElements.length,
      hasSpatialTransforms,
      spatialNodeCount: spatialNodes.length,
      layoutMode,
      depthPlanningEnabled,
      modelTypeCategoryCounts,
      bounds,
      depthBands: {
        front: Array.isArray(depthBands.front) ? depthBands.front.length : 0,
        mid: Array.isArray(depthBands.mid) ? depthBands.mid.length : 0,
        rear: Array.isArray(depthBands.rear) ? depthBands.rear.length : 0
      }
    },
    warnings: Array.isArray(warnings) ? warnings.filter(Boolean) : []
  };
}

async function refreshSceneGraphFromXLights({ models = [], submodels = [], groupMembersById = {} } = {}) {
  try {
    const body = await getLayoutScene(state.endpoint, { includeNodes: false, includeCameras: true });
    const graph = buildSceneGraphFromData({
      sceneData: body?.data && isPlainObject(body.data) ? body.data : {},
      models,
      submodels,
      groupMembersById,
      source: "layout.getScene",
      warnings: []
    });
    state.sceneGraph = graph;
    state.health.sceneGraphReady = true;
    state.health.sceneGraphSource = "layout.getScene";
    state.health.sceneGraphWarnings = graph.warnings.slice(0, 6);
    state.health.sceneGraphSpatialNodeCount = Number(graph?.stats?.spatialNodeCount || 0);
    state.health.sceneGraphLayoutMode = String(graph?.stats?.layoutMode || "unknown");
    return;
  } catch (err) {
    const warning = `Scene graph fallback active: ${String(err?.message || "layout.getScene unavailable")}`;
    const graph = buildSceneGraphFromData({
      sceneData: {},
      models,
      submodels,
      groupMembersById,
      source: "fallback.models-submodels",
      warnings: [warning]
    });
    state.sceneGraph = graph;
    state.health.sceneGraphReady = true;
    state.health.sceneGraphSource = "fallback.models-submodels";
    state.health.sceneGraphWarnings = graph.warnings.slice(0, 6);
    state.health.sceneGraphSpatialNodeCount = Number(graph?.stats?.spatialNodeCount || 0);
    state.health.sceneGraphLayoutMode = String(graph?.stats?.layoutMode || "unknown");
  }
}

async function refreshEffectCatalogFromXLights() {
  const commands = Array.isArray(state.health?.capabilityCommands) ? state.health.capabilityCommands : [];
  if (!commands.includes("effects.listDefinitions")) {
    state.effectCatalog = emptyEffectDefinitionCatalog("effects.listDefinitions unavailable");
    state.health.effectDefinitionCount = 0;
    state.health.effectCatalogReady = false;
    state.health.effectCatalogError = "effects.listDefinitions unavailable";
    return;
  }

  try {
    const body = await getEffectDefinitions(state.endpoint);
    const rows = Array.isArray(body?.data?.effects) ? body.data.effects : [];
    const catalog = buildEffectDefinitionCatalog(rows, {
      source: "effects.listDefinitions",
      loadedAt: new Date().toISOString()
    });
    state.effectCatalog = catalog;
    state.health.effectDefinitionCount = Number(catalog.definitionCount || 0);
    state.health.effectCatalogReady = true;
    state.health.effectCatalogError = "";
  } catch (err) {
    state.effectCatalog = emptyEffectDefinitionCatalog(String(err?.message || "effect catalog refresh failed"));
    state.health.effectDefinitionCount = 0;
    state.health.effectCatalogReady = false;
    state.health.effectCatalogError = String(err?.message || "effect catalog refresh failed");
  }
}

async function fetchGroupMembershipsFromXLights(models = []) {
  const commands = Array.isArray(state.health?.capabilityCommands) ? state.health.capabilityCommands : [];
  if (!commands.includes("layout.getModelGroupMembers")) {
    return {};
  }
  const groupRows = (Array.isArray(models) ? models : []).filter((row) => String(row?.type || "").trim() === "ModelGroup");
  if (!groupRows.length) return {};

  const results = await Promise.allSettled(
    groupRows.map(async (row) => {
      const name = String(row?.name || "").trim();
      if (!name) return null;
      const body = await getModelGroupMembers(state.endpoint, name);
      const members = isPlainObject(body?.data?.members) ? body.data.members : {};
      return [name, members];
    })
  );

  const out = {};
  for (const row of results) {
    if (row.status !== "fulfilled" || !Array.isArray(row.value) || row.value.length !== 2) continue;
    out[row.value[0]] = row.value[1];
  }
  return out;
}

async function fetchSubmodelDetailsFromXLights(submodels = []) {
  const commands = Array.isArray(state.health?.capabilityCommands) ? state.health.capabilityCommands : [];
  if (!commands.includes("layout.getSubmodelDetail")) {
    return {};
  }
  const rows = Array.isArray(submodels) ? submodels : [];
  if (!rows.length) return {};

  const results = await Promise.allSettled(
    rows.map(async (row) => {
      const id = String(row?.id || "").trim();
      if (!id) return null;
      const body = await getSubmodelDetail(state.endpoint, id, row?.parentId || "");
      const detail = isPlainObject(body?.data) ? body.data : {};
      return [id, detail];
    })
  );

  const out = {};
  for (const row of results) {
    if (row.status !== "fulfilled" || !Array.isArray(row.value) || row.value.length !== 2) continue;
    out[row.value[0]] = row.value[1];
  }
  return out;
}

async function refreshMetadataTargetsFromXLights({ warnOnSubmodelFailure = false } = {}) {
  try {
    const open = await getOpenSequence(state.endpoint);
    state.health.sequenceOpen = Boolean(open?.data?.isOpen);
  } catch {
    // Keep previous sequence-open state when open-sequence probe fails.
  }

  const modelBody = await getModels(state.endpoint);
  const fetchedModels = Array.isArray(modelBody?.data?.models) ? modelBody.data.models : [];
  const excludedUnassignedModels = fetchedModels.filter((row) => isModelInUnassignedPreview(row));
  state.models = fetchedModels.filter((row) => !isModelInUnassignedPreview(row));
  const includedModelIds = new Set(state.models.map((row) => modelStableId(row)).filter(Boolean));
  state.health.excludedUnassignedModelCount = excludedUnassignedModels.length;
  state.health.excludedUnassignedModelNames = excludedUnassignedModels
    .map((row) => String(row?.name || modelStableId(row) || "").trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const groupMembersById = await fetchGroupMembershipsFromXLights(state.models);

  try {
    const submodelBody = await getSubmodels(state.endpoint);
    state.submodels = Array.isArray(submodelBody?.data?.submodels) ? submodelBody.data.submodels : [];
    const submodelDetailsById = await fetchSubmodelDetailsFromXLights(state.submodels);
    state.submodels = state.submodels.map((row) => {
      const id = String(row?.id || "").trim();
      const detail = isPlainObject(submodelDetailsById[id]) ? submodelDetailsById[id] : {};
      const submodelDetail = isPlainObject(detail?.submodel) ? detail.submodel : {};
      const membership = isPlainObject(detail?.membership) ? detail.membership : {};
      return {
        ...row,
        ...submodelDetail,
        renderLayout: String(submodelDetail?.renderLayout || row?.renderLayout || "").trim(),
        submodelType: String(submodelDetail?.submodelType || row?.submodelType || "").trim(),
        bufferStyle: String(submodelDetail?.bufferStyle || row?.bufferStyle || "").trim() || "Default",
        availableBufferStyles: Array.isArray(submodelDetail?.availableBufferStyles)
          ? submodelDetail.availableBufferStyles.map((v) => String(v || "").trim()).filter(Boolean)
          : Array.isArray(row?.availableBufferStyles)
            ? row.availableBufferStyles.map((v) => String(v || "").trim()).filter(Boolean)
            : [],
        membership: {
          nodeCount: Number(membership?.nodeCount || 0),
          nodeChannels: Array.isArray(membership?.nodeChannels) ? membership.nodeChannels.map((v) => Number(v)).filter((v) => Number.isFinite(v)) : [],
          nodeRefs: Array.isArray(membership?.nodeRefs) ? membership.nodeRefs : []
        }
      };
    }).filter((row) => {
      const parentId = String(row?.parentId || parseSubmodelParentId(row?.id)).trim();
      return !parentId || includedModelIds.has(parentId);
    });
    state.health.submodelDiscoveryError = "";
  } catch (err) {
    state.submodels = [];
    state.health.submodelDiscoveryError = String(err?.message || "Unknown error");
    if (warnOnSubmodelFailure) {
      setStatusWithDiagnostics(
        "warning",
        `Submodels unavailable (${err.message}).`
      );
    }
  }

  await refreshSceneGraphFromXLights({
    models: state.models,
    submodels: state.submodels,
    groupMembersById
  });

  ensureMetadataTargetSelection();
}

async function syncLatestSequenceRevision({
  onStaleMessage = "Detected newer xLights sequence revision. Draft marked stale.",
  onUnknownMessage = ""
} = {}) {
  try {
    const previousRevision = String(state.revision || "unknown");
    const newRevision = await fetchXLightsRevisionState(state.endpoint, { getRevision });
    const revisionState = syncXLightsRevisionState({
      previousRevision,
      nextRevision: newRevision,
      hasDraftProposal: Boolean(state.flags.hasDraftProposal),
      draftBaseRevision: String(state.draftBaseRevision || "unknown"),
      hasCreativeProposal: Boolean(state.creative?.proposalBundle)
    });

    state.revision = revisionState.revision;

    if (revisionState.shouldInvalidatePlanHandoff) {
      agentRuntimeState.invalidatePlanHandoff("sequence revision changed");
    }

    if (revisionState.shouldMarkDesignerDraftStale) {
      markDesignerDraftStale(state, {
        currentRevision: newRevision,
        reason: "sequence_revision_changed"
      });
    }
    if (revisionState.staleDetected) {
      state.flags.proposalStale = true;
      if (onStaleMessage) {
        setStatusWithDiagnostics("warning", onStaleMessage);
      }
    }

    if (newRevision === "unknown" && onUnknownMessage) {
      setStatusWithDiagnostics("warning", onUnknownMessage);
    }

    return {
      ok: true,
      revision: revisionState.revision,
      revisionChanged: revisionState.revisionChanged,
      staleDetected: revisionState.staleDetected
    };
  } catch (err) {
    state.revision = "unknown";
    if (onUnknownMessage) {
      setStatusWithDiagnostics("warning", onUnknownMessage, err?.stack || "");
    }
    return {
      ok: false,
      revision: "unknown",
      revisionChanged: false,
      staleDetected: false,
      error: String(err?.message || err || "revision sync failed")
    };
  }
}

async function onRefresh() {
  return sequenceMediaSessionRuntime.refresh();
}

async function onRefreshAndRegenerate() {
  await onRefresh();
  if (state.flags.proposalStale) {
    await onGenerate();
    setStatus("info", "Draft regenerated on latest sequence revision.");
    persist();
    render();
  }
}

async function onRebaseDraft() {
  if (!state.flags.hasDraftProposal) {
    setStatus("warning", "No draft available to rebase.");
    return render();
  }

  const preserved = [...state.proposed];
  const previousBase = state.draftBaseRevision;
  await onRefresh();

  if (state.revision === "unknown") {
    setStatusWithDiagnostics(
      "warning",
      "Rebase could not complete because current revision is unknown."
    );
    return;
  }

  state.proposed = preserved;
  rebaseDesignerDraft(state, {
    newBaseRevision: state.revision,
    preserveLines: preserved
  });
  saveCurrentProjectSnapshot();
  setStatus(
    "info",
    `Draft rebased from ${previousBase} to ${state.draftBaseRevision}.`
  );
  persist();
  render();
}

async function onTestConnection() {
  state.ui.firstRunMode = false;
  const endpointInput = app.querySelector("#endpoint-input");
  const requestedEndpoint = endpointInput
    ? normalizeConfiguredEndpoint(endpointInput.value)
    : normalizeConfiguredEndpoint(state.endpoint);
  state.endpoint = requestedEndpoint;

  setStatus("info", "Testing xLights endpoint...");
  render();

  try {
    const { endpoint, caps } = await resolveReachableEndpoint(requestedEndpoint);
    const endpointChanged = endpoint !== requestedEndpoint;
    state.endpoint = endpoint;
    if (endpointInput) endpointInput.value = endpoint;
    const { commands, xlightsVersion, compat } = applyCapabilitiesHealth(caps, state.health.sequenceOpen);
    if (!xlightsVersion) {
      await hydrateVersionIfMissing(endpoint, caps);
    }
    const count = commands.length;
    setStatus(
      "info",
      endpointChanged
        ? `Connected via fallback endpoint ${endpoint}. ${count} commands reported by xLights.`
        : `Connected. ${count} commands reported by xLights.`
    );
    if (compat === false) {
      setStatusWithDiagnostics(
        "action-required",
        `Connected, but xLights ${xlightsVersion} is below supported floor 2026.1. Mutating actions are disabled.`
      );
    }
    await onRefresh();
    return;
  } catch (err) {
    state.flags.xlightsConnected = false;
    enforceConnectivityPlanOnly();
    setStatusWithDiagnostics("action-required", `Connection failed: ${err.message}`, err.stack || "");
  }
  persist();
  render();
}

async function onCheckHealth() {
  if (!state.flags.xlightsConnected) {
    setStatusWithDiagnostics("warning", "Connect to xLights before health check.");
    return render();
  }

  setStatus("info", "Running health check...");
  render();
  try {
    await agentSupportRuntime.hydrateAgentHealth();
    const [caps, open, rev] = await Promise.all([
      pingCapabilities(state.endpoint),
      getOpenSequence(state.endpoint),
      getRevision(state.endpoint).catch(() => ({ data: { revision: "unknown" } }))
    ]);
    const { compat, xlightsVersion } = applyCapabilitiesHealth(caps, Boolean(open?.data?.isOpen));
    if (!xlightsVersion) {
      await hydrateVersionIfMissing(state.endpoint, caps);
    }
    const releasedForce = releaseConnectivityPlanOnly();
    await refreshMetadataTargetsFromXLights();
    await refreshEffectCatalogFromXLights();
    try {
      await fetchSectionSuggestions();
    } catch (err) {
      setStatusWithDiagnostics("warning", `Section refresh failed: ${err.message}`);
    }
    state.revision = rev?.data?.revision ?? state.revision;
    if (compat === false) {
      setStatusWithDiagnostics(
        "action-required",
        `Health check: xLights ${xlightsVersion} is below supported floor 2026.1. Mutating actions are disabled.`
      );
    } else {
      setStatus("info", "Health check complete.");
      if (releasedForce) {
        setStatus("info", "xLights reachable again. Plan-only remains enabled until you turn it off.");
      }
    }
  } catch (err) {
    state.flags.xlightsConnected = false;
    enforceConnectivityPlanOnly();
    setStatusWithDiagnostics("action-required", `Health check failed: ${err.message}`, err.stack || "");
  } finally {
    saveCurrentProjectSnapshot();
    persist();
    render();
  }
}

async function pollRevision() {
  if (isFirstRunMode()) return;
  if (!state.flags.xlightsConnected || state.flags.applyInProgress) return;
  try {
    const result = await syncLatestSequenceRevision({
      onStaleMessage: "Detected external sequence edits. Draft marked stale.",
      onUnknownMessage: ""
    });
    if (result.revisionChanged || result.staleDetected) {
      persist();
      render();
    }
  } catch {
    // Ignore polling failures and rely on explicit refresh/test actions.
  }
}

async function pollJobs() {
  if (isFirstRunMode()) return;
  if (!state.flags.xlightsConnected) return;
  const active = (state.jobs || []).filter((j) =>
    !["done", "completed", "failed", "canceled", "cancelled"].includes((j.status || "").toLowerCase())
  );
  if (!active.length) return;

  let changed = false;
  for (const job of active) {
    const isOwnedJob =
      String(job?.source || "").trim() === "owned_batch_plan" ||
      String(job?.id || "").trim().startsWith("xld-job-");
    try {
      const body = isOwnedJob
        ? await getOwnedJob(state.endpoint, job.id)
        : await getJob(state.endpoint, job.id);
      const data = body?.data || {};
      const next = isOwnedJob
        ? {
            id: job.id,
            source: job.source || "owned_batch_plan",
            status: String(data.state || job.status || "running"),
            progress: Number.isFinite(data.progress) ? data.progress : job.progress || 0,
            message: String(data?.result?.error?.message || data.message || job.message || ""),
            updatedAt: new Date().toISOString()
          }
        : {
            id: job.id,
            source: job.source || "unknown",
            status: data.status || job.status || "running",
            progress: Number.isFinite(data.progress) ? data.progress : job.progress || 0,
            message: data.message || job.message || "",
            updatedAt: new Date().toISOString()
          };
      upsertJob(next);
      changed = true;
      const status = (next.status || "").toLowerCase();
      if (["failed", "canceled", "cancelled"].includes(status)) {
        setStatusWithDiagnostics("warning", `Job ${job.id} ${next.status}.`, next.message || "");
      } else if (["done", "completed"].includes(status)) {
        setStatus("info", `Job ${job.id} completed.`);
      }
    } catch (err) {
      const message = String(err?.message || err || "");
      if (isOwnedJob && message.includes("(NOT_FOUND)")) {
        upsertJob({
          id: job.id,
          source: job.source || "owned_batch_plan",
          status: "completed",
          progress: 100,
          message: "Owned job record expired after completion.",
          updatedAt: new Date().toISOString()
        });
        changed = true;
        continue;
      }
      setStatusWithDiagnostics("warning", `jobs.get failed for ${job.id}: ${err.message}`);
    }
  }
  if (changed) {
    persist();
    render();
  }
}

async function pollCompatibilityStatus() {
  if (isFirstRunMode()) return;
  if (state.flags.applyInProgress) return;
  if (!state.flags.xlightsConnected) {
    try {
      const requestedEndpoint = state.endpoint;
      const { endpoint, caps } = await resolveReachableEndpoint(requestedEndpoint);
      const endpointChanged = endpoint !== requestedEndpoint;
      state.endpoint = endpoint;
      const releasedForce = releaseConnectivityPlanOnly();
      const { compat, xlightsVersion } = applyCapabilitiesHealth(caps, state.health.sequenceOpen);
      if (!xlightsVersion) {
        await hydrateVersionIfMissing(endpoint, caps);
      }
      await onRefresh();
      if (compat === false) {
        setStatusWithDiagnostics(
          "action-required",
          `Reconnected, but xLights ${xlightsVersion} is below supported floor 2026.1. Mutating actions are disabled.`
        );
      } else if (endpointChanged) {
        setStatus("info", `Reconnected via fallback endpoint ${endpoint}.`);
      } else {
        setStatus("info", "Reconnected to xLights.");
      }
      if (releasedForce && compat !== false) {
        setStatus("info", "xLights reachable again. Plan-only remains enabled until you turn it off.");
      }
      persist();
      render();
      return;
    } catch {
      // Stay disconnected; keep this poll quiet until a state transition occurs.
      return;
    }
  }
  try {
    const caps = await pingCapabilities(state.endpoint);
    releaseConnectivityPlanOnly();
    const previousVersion = state.health.xlightsVersion || "";
    const previousCompat = state.health.compatibilityStatus;
    const { compat, xlightsVersion } = applyCapabilitiesHealth(caps, state.health.sequenceOpen);
    if (!xlightsVersion) {
      await hydrateVersionIfMissing(state.endpoint, caps);
    }

    const nextCompat = compat === null ? "unknown" : compat ? "compatible" : "incompatible";
    const versionChanged = xlightsVersion && xlightsVersion !== previousVersion;
    const compatChanged = nextCompat !== previousCompat;
    if (versionChanged || compatChanged) {
      if (compat === false) {
        setStatusWithDiagnostics(
          "action-required",
          `Detected xLights version ${xlightsVersion}. Below supported floor 2026.1. Mutating actions are disabled.`
        );
      } else if (versionChanged) {
        setStatus("info", `Detected xLights version change: ${xlightsVersion}.`);
      }
      persist();
      render();
    }
  } catch {
    const wasConnected = state.flags.xlightsConnected;
    state.flags.xlightsConnected = false;
    const forced = enforceConnectivityPlanOnly();
    if (wasConnected || forced) {
      setStatusWithDiagnostics(
        "warning",
        "Lost connectivity to xLights. Plan-only mode is now enforced until connection is restored."
      );
      persist();
      render();
    }
    queueQuickReconnectPoll();
  }
}

async function syncOpenSequenceOnFocusReturn() {
  if (isFirstRunMode()) return;
  if (focusSyncInFlight) return;
  if (!state.flags.xlightsConnected) return;
  const now = Date.now();
  if (now - lastFocusSyncAt < FOCUS_SYNC_COOLDOWN_MS) return;
  lastFocusSyncAt = now;
  focusSyncInFlight = true;

  try {
    const open = await getOpenSequence(state.endpoint);
    const isOpen = Boolean(open?.data?.isOpen);
    const seq = open?.data?.sequence;

    const prevPath = currentSequencePathForSidecar();
    const prevAudioPath = String(state.audioPathInput || "");
    const prevLoaded = Boolean(state.flags.activeSequenceLoaded);

    if (isOpen && seq) {
      if (!isSequenceAllowedInActiveShowFolder(seq)) {
        noteIgnoredExternalSequence(seq, "xLights");
        return;
      }
      clearIgnoredExternalSequenceNote();
      applyOpenSequenceState(seq);
      state.flags.activeSequenceLoaded = true;
      state.health.sequenceOpen = true;
      await sequenceMediaSessionRuntime.syncAudioPathFromMediaStatus();

      const nextPath = currentSequencePathForSidecar();
      if (nextPath && nextPath !== prevPath) {
        try {
          await hydrateSidecarForCurrentSequence();
        } catch {
          // Keep focus-return sync best-effort and quiet.
        }
      }

      if (nextPath !== prevPath || String(state.audioPathInput || "") !== prevAudioPath || !prevLoaded) {
        setStatus("info", `Updated from xLights: ${state.activeSequence || "(none)"}.`);
        saveCurrentProjectSnapshot();
        persist();
        render();
      }
      return;
    }

    state.health.sequenceOpen = false;
    clearIgnoredExternalSequenceNote();
    if (prevLoaded || prevPath || prevAudioPath) {
      state.flags.activeSequenceLoaded = false;
      state.activeSequence = "";
      state.sequenceMediaFile = "";
      setStatus("info", "Updated from xLights: no sequence is currently open.");
      saveCurrentProjectSnapshot();
      persist();
      render();
    }
  } catch {
    // Focus-return sync is best effort; normal health polls handle failures.
  } finally {
    focusSyncInFlight = false;
  }
}

async function onCancelJob(jobId) {
  try {
    await cancelJob(state.endpoint, jobId);
    upsertJob({
      id: jobId,
      status: "canceled",
      updatedAt: new Date().toISOString()
    });
    setStatus("info", `Cancel requested for job ${jobId}.`);
  } catch (err) {
    setStatusWithDiagnostics("action-required", `Cancel failed for ${jobId}: ${err.message}`);
  }
  persist();
  render();
}

async function onRegenerate() {
  await onGenerate();
}

function toggleDiagnostics(forceOpen = null) {
  state.ui.diagnosticsOpen =
    forceOpen === null ? !state.ui.diagnosticsOpen : Boolean(forceOpen);
  persist();
  render();
}

function setDiagnosticsFilter(filter) {
  if (!["all", "warning", "action-required"].includes(filter)) return;
  state.ui.diagnosticsFilter = filter;
  persist();
  render();
}

function toggleJobs(forceOpen = null) {
  state.ui.jobsOpen = forceOpen === null ? !state.ui.jobsOpen : Boolean(forceOpen);
  persist();
  render();
}

function clearDiagnostics() {
  state.diagnostics = [];
  setStatus("info", "Diagnostics cleared.");
  persist();
  render();
}

function buildMatrixDiagnosticsArtifact() {
  const matrix = state.orchestrationMatrix && typeof state.orchestrationMatrix === "object"
    ? state.orchestrationMatrix
    : null;
  if (!matrix) return null;
  return {
    artifactType: "orchestration-matrix-v1",
    generatedAt: new Date().toISOString(),
    summary: {
      ranAt: String(matrix.ranAt || ""),
      passed: Number(matrix.passed || 0),
      failed: Number(matrix.failed || 0),
      total: Number(matrix.total || 0)
    },
    scenarios: Array.isArray(matrix.results)
      ? matrix.results.map((row) => ({
          name: String(row?.name || ""),
          ok: Boolean(row?.ok),
          note: String(row?.note || "")
        }))
      : []
  };
}

function buildDiagnosticsBundle() {
  let previewCommands = [];
  let previewError = "";
  try {
    previewCommands = applyReviewRuntime.buildDesignerPlanCommands(applyReviewRuntime.filteredProposed());
  } catch (err) {
    previewError = String(err?.message || "");
  }
  return {
    exportedAt: new Date().toISOString(),
    app: {
      route: state.route,
      projectName: state.projectName || "",
      showFolder: state.showFolder || "",
      activeSequence: state.activeSequence || "",
      sequencePath: state.sequencePathInput || "",
      endpoint: state.endpoint || ""
    },
    health: state.health || {},
    flags: state.flags || {},
    revision: state.revision || "unknown",
    agentRun: {
      provider: state.health.agentProvider || "openai",
      model: state.health.agentModel || "",
      configured: Boolean(state.health.agentConfigured),
      layerReady: Boolean(state.health.agentLayerReady),
      activeRole: String(state.health.agentActiveRole || ""),
      registryVersion: String(state.health.agentRegistryVersion || ""),
      handoffsReady: String(state.health.agentHandoffsReady || "0/3"),
      rolloutMode: getAgentApplyRolloutMode(),
      applyApprovalChecked: Boolean(state.ui.applyApprovalChecked),
      draftBaseRevision: state.draftBaseRevision || "unknown",
      proposedCount: Array.isArray(state.proposed) ? state.proposed.length : 0,
      selectedProposedCount: Array.isArray(state.ui.proposedSelection) ? state.ui.proposedSelection.length : 0,
      previewCommandCount: Array.isArray(previewCommands) ? previewCommands.length : 0,
      previewError,
      lastApplyBackupPath: state.lastApplyBackupPath || "",
      sequencePath: currentSequencePathForSidecar() || selectedSequencePath() || "",
      handoffs: agentRuntime.handoffs
    },
    orchestrationMatrix: buildMatrixDiagnosticsArtifact(),
    diagnostics: Array.isArray(state.diagnostics) ? state.diagnostics : [],
    applyHistory: Array.isArray(state.applyHistory) ? state.applyHistory : [],
    jobs: Array.isArray(state.jobs) ? state.jobs : []
  };
}

function currentApplyContext() {
  return {
    projectKey: getProjectKey(),
    sequencePath: currentSequencePathForSidecar() || selectedSequencePath() || "",
    endpoint: state.endpoint || ""
  };
}

function currentArtifactRefs({ planHandoff = null, applyResult = null } = {}) {
  return buildArtifactRefs({
    analysisArtifact: state.audioAnalysis?.artifact || null,
    designSceneContext: buildCurrentDesignSceneContext(),
    musicDesignContext: buildCurrentMusicDesignContext(),
    directorProfile: state.directorProfile || null,
    creativeBrief: state.creative?.brief || null,
    proposalBundle: state.creative?.proposalBundle || null,
    intentHandoff: state.creative?.intentHandoff || agentRuntimeState.getValidHandoff("intent_handoff_v1"),
    planHandoff: planHandoff || agentRuntimeState.getValidHandoff("plan_handoff_v1"),
    applyResult
  });
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function onExportDiagnostics() {
  const bundle = buildDiagnosticsBundle();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `xlightsdesigner-diagnostics-${stamp}.json`;
  const bridge = getDesktopDiagnosticsBridge();
  if (bridge) {
    try {
      const res = await bridge.exportDiagnosticsBundle(bundle);
      if (res?.ok) {
        setStatus("info", `Diagnostics exported: ${res.outputPath || "saved"}`);
      } else if (res?.canceled) {
        setStatus("info", "Diagnostics export canceled.");
      } else {
        setStatusWithDiagnostics("action-required", "Diagnostics export failed.", res?.error || "");
      }
      persist();
      render();
      return;
    } catch (err) {
      setStatusWithDiagnostics("action-required", "Diagnostics export failed.", err?.message || "");
      persist();
      render();
      return;
    }
  }

  downloadJson(filename, bundle);
  setStatus("info", "Diagnostics downloaded.");
  persist();
  render();
}

function getDiagnosticsCounts() {
  const rows = state.diagnostics || [];
  const warning = rows.filter((d) => d.level === "warning").length;
  const actionRequired = rows.filter((d) => d.level === "action-required").length;
  return { total: rows.length, warning, actionRequired };
}

function getJobCounts() {
  const rows = state.jobs || [];
  const running = rows.filter((j) => !["done", "completed", "failed", "canceled", "cancelled"].includes((j.status || "").toLowerCase())).length;
  return { total: rows.length, running };
}

function upsertJob(job) {
  if (!job?.id) return;
  const rows = state.jobs || [];
  const idx = rows.findIndex((j) => j.id === job.id);
  if (idx === -1) {
    state.jobs = [job, ...rows].slice(0, 50);
  } else {
    rows[idx] = { ...rows[idx], ...job };
    state.jobs = [...rows];
  }
}

function onCancelDraft() {
  clearDesignerDraft(state);
  state.ui.detailsOpen = false;
  state.ui.sectionSelections = ["all"];
  invalidateApplyApproval();
  setStatus("info", "Draft canceled.");
  saveCurrentProjectSnapshot();
  persist();
  render();
}

function onCompareVersion() {
  const currentHead = state.versions[0]?.id || null;
  if (!state.selectedVersion || state.selectedVersion === currentHead) {
    state.compareVersion = null;
    setStatus("info", "Select a non-head version to compare.");
  } else {
    state.compareVersion = state.selectedVersion;
    setStatus("info", `Comparing ${state.compareVersion} to ${currentHead}.`);
  }
  persist();
  render();
}

function onReapplyVariant() {
  const selected = versionById(state.selectedVersion);
  if (!selected) return;
  state.proposed = [...(selected.proposal || [])];
  rebaseDesignerDraft(state, { newBaseRevision: state.revision });
  invalidateApplyApproval();
  state.route = "design";
  state.ui.detailsOpen = true;
  state.ui.sectionSelections = ["all"];
  setStatus("info", `Loaded ${selected.id} as a new draft variant.`);
  saveCurrentProjectSnapshot();
  persist();
  render();
}

function onRollbackToVersion() {
  const selected = versionById(state.selectedVersion);
  if (!selected) return;
  state.proposed = [...(selected.proposal || [])];
  rebaseDesignerDraft(state, { newBaseRevision: state.revision });
  invalidateApplyApproval();
  state.ui.detailsOpen = false;
  bumpVersion(`Rollback to ${selected.id}`, selected.effects || state.proposed.length * 11);
  setStatus("info", `Rollback restored from ${selected.id}. Review and apply when ready.`);
  state.route = "design";
  saveCurrentProjectSnapshot();
  persist();
  render();
}

function openDetails() {
  if (!state.flags.hasDraftProposal) {
    setStatus("warning", "Generate a proposal first.");
    return render();
  }
  state.ui.detailsOpen = true;
  persist();
  render();
}

function closeDetails() {
  state.ui.detailsOpen = false;
  persist();
  render();
}

function setSectionFilter(section) {
  setSectionSelections(section === "all" ? ["all"] : [section]);
}

function setDesignTab(tab) {
  if (!["chat", "intent", "proposed"].includes(tab)) return;
  state.ui.designTab = tab;
  persist();
  render();
}

function addChatMessage(who, text) {
  const message = {
    who,
    text: String(text || "").trim(),
    at: new Date().toISOString()
  };
  if (!message.text) return;
  state.chat = [...(state.chat || []), message].slice(-CHAT_HISTORY_LIMIT);
}

function getTeamChatIdentities() {
  return buildTeamChatIdentities(state.teamChat?.identities || DEFAULT_TEAM_CHAT_IDENTITIES);
}

function getTeamChatIdentity(roleId = "") {
  return resolveTeamChatIdentity(roleId, getTeamChatIdentities());
}

function getTeamChatSpeakerLabel(roleId = "") {
  const identity = getTeamChatIdentity(roleId);
  return identity.nickname
    ? `${identity.displayName} (${identity.nickname})`
    : identity.displayName;
}

function getTeamChatIntroText(roleId = "") {
  const label = getTeamChatSpeakerLabel(roleId);
  if (roleId === "app_assistant") return `${label} here. I coordinate the team and help move the work forward.`;
  if (roleId === "designer_dialog") return `${label} here. I shape the creative direction for the sequence.`;
  if (roleId === "sequence_agent") return `${label} here. I turn design intent into concrete sequence changes.`;
  if (roleId === "audio_analyst") return `${label} here. I read the music and surface structure the team can design against.`;
  return "";
}

function hasTeamChatRoleIntroduction(roleId = "") {
  const key = String(roleId || "").trim();
  return Boolean(key) && Array.isArray(state.teamChat?.introducedRoleIds) && state.teamChat.introducedRoleIds.includes(key);
}

function markTeamChatRoleIntroduction(roleId = "") {
  const key = String(roleId || "").trim();
  if (!key) return;
  const current = Array.isArray(state.teamChat?.introducedRoleIds) ? state.teamChat.introducedRoleIds : [];
  if (current.includes(key)) return;
  state.teamChat.introducedRoleIds = [...current, key];
}

function getRouteChatQuickPrompts(route = "") {
  const key = String(route || "").trim();
  return CHAT_QUICK_PROMPTS_BY_ROUTE[key] || CHAT_QUICK_PROMPTS_BY_ROUTE.fallback;
}

function getRouteChatPlaceholder(route = "") {
  const key = String(route || "").trim();
  if (key === "project") return "Ask for setup help, project guidance, or first-run checks...";
  if (key === "audio") return "Ask about analysis, tempo, sections, lyrics, or rerunning the audio pass...";
  if (key === "sequence") return "Ask about technical translation, scope, sequence context, or what needs attention before review...";
  if (key === "design") return "Describe the feeling, references, or design direction you want...";
  if (key === "review") return "Ask what will change, what to review, or request a scoped sequence revision...";
  if (key === "metadata") return "Ask how layout details affect targeting, submodels, and sequencing quality...";
  if (key === "settings") return "Ask about connection, cloud chat, analysis services, and app configuration...";
  if (key === "history") return "Ask about prior versions, applies, or rollback options...";
  return "Tell the team what to change or ask for guidance...";
}

function getRouteChatContext() {
  const route = String(state?.route || "").trim();
  if (route === "project") {
    return {
      title: "Project setup and environment",
      note: "Use team chat to set up the project root, show folder, and first-run configuration."
    };
  }
  if (route === "audio") {
    return {
      title: "Audio analysis workspace",
      note: "Use team chat to inspect analysis quality, rerun the pipeline, and understand the current audio artifact."
    };
  }
  if (route === "sequence") {
    return {
      title: "Sequence translation workspace",
      note: "Use team chat to inspect how the current design is translating into technical sequence changes before review and apply."
    };
  }
  if (route === "design") {
    return {
      title: "Creative design workspace",
      note: "Use team chat to shape the concept, refine the brief, and iterate on design proposals."
    };
  }
  if (route === "review") {
    return {
      title: "Execution review workspace",
      note: "Use team chat to review warnings, request scoped revisions, and understand the impact before apply."
    };
  }
  if (route === "metadata") {
    return {
      title: "Layout workspace",
      note: "Use team chat to improve how the app understands props, groups, and submodels before sequencing."
    };
  }
  if (route === "settings") {
    return {
      title: "Application settings workspace",
      note: "Use team chat to configure xLights connection, cloud chat, audio services, and app-level behavior."
    };
  }
  if (route === "history") {
    return {
      title: "History and recovery workspace",
      note: "Use team chat to understand prior versions, compare changes, and choose rollback or variant options."
    };
  }
  return {
    title: "Team chat workspace",
    note: "Use team chat for guidance, routing, and specialist collaboration across the whole app."
  };
}

function setTeamChatNickname(roleId = "", nickname = "") {
  const key = String(roleId || "").trim();
  if (!key || !getTeamChatIdentities()[key]) return;
  const next = String(nickname || "").trim().slice(0, 32);
  state.teamChat.identities = buildTeamChatIdentities({
    ...state.teamChat.identities,
    [key]: {
      ...(state.teamChat.identities?.[key] || {}),
      nickname: next
    }
  });
}

function addStructuredChatMessage(who, text, options = {}) {
  const handledBy = String(options.handledBy || options.roleId || "").trim();
  if (who === "agent" && handledBy && !hasTeamChatRoleIntroduction(handledBy)) {
    const introText = getTeamChatIntroText(handledBy);
    if (introText) {
      const introIdentity = getTeamChatIdentity(handledBy);
      state.chat = [...(state.chat || []), {
        who: "agent",
        text: introText,
        at: new Date().toISOString(),
        roleId: handledBy,
        displayName: introIdentity.displayName,
        nickname: introIdentity.nickname,
        handledBy,
        addressedTo: "",
        artifact: null
      }].slice(-CHAT_HISTORY_LIMIT);
      markTeamChatRoleIntroduction(handledBy);
    }
  }
  const message = {
    who,
    text: String(text || "").trim(),
    at: new Date().toISOString(),
    roleId: String(options.roleId || "").trim(),
    displayName: String(options.displayName || "").trim(),
    nickname: String(options.nickname || "").trim(),
    handledBy: String(options.handledBy || "").trim(),
    addressedTo: String(options.addressedTo || "").trim(),
    artifact: isPlainObject(options.artifact) ? options.artifact : null
  };
  if (!message.text) return;
  state.chat = [...(state.chat || []), message].slice(-CHAT_HISTORY_LIMIT);
}

function buildChatArtifactCard(artifactType = "", payload = {}) {
  const type = String(artifactType || "").trim();
  const row = isPlainObject(payload) ? payload : {};
  if (!type) return null;
  return {
    artifactType: type,
    title: String(row.title || "").trim(),
    summary: String(row.summary || "").trim(),
    chips: Array.isArray(row.chips) ? row.chips.map((v) => String(v || "").trim()).filter(Boolean).slice(0, 6) : []
  };
}

function onUseQuickPrompt(promptText) {
  state.ui.chatDraft = promptText || "";
  persist();
  render();
}

function inferIntentModeFromGoal(text = "") {
  const lower = String(text || "").toLowerCase();
  if (/(analyz|review|inspect|diagnos)/.test(lower)) return "analyze";
  if (/(polish|refine|tweak|minor)/.test(lower)) return "polish";
  if (/(revise|rework|change|update|adjust)/.test(lower)) return "revise";
  return "create";
}

function shouldCarryDesignerSelectionContext(promptText = "") {
  const text = String(promptText || "").trim().toLowerCase();
  const selectedTargets = normalizeMetadataSelectionIds(state.ui.metadataSelectionIds || []);
  const selectedTags = normalizeMetadataSelectedTags(state.ui.metadataSelectedTags || []);
  if (!selectedTargets.length && !selectedTags.length) return false;
  if (!text) return false;
  if (/\b(selected|these|those)\b/.test(text)) return true;
  if (selectedTargets.some((id) => text.includes(String(id || "").toLowerCase()))) return true;
  if (selectedTags.some((tag) => text.includes(String(tag || "").toLowerCase()))) return true;
  return false;
}

function inferPromptSectionSelection(promptText = "", musicDesignContext = null) {
  const text = String(promptText || "").trim().toLowerCase();
  if (!text) return [];
  if (/\b(whole show|whole sequence|entire sequence|full show|full song|entire song|across the song|throughout the song)\b/.test(text)) {
    return [];
  }
  const candidateSections = [
    ...getSectionChoiceList(),
    ...(Array.isArray(musicDesignContext?.sectionArc)
      ? musicDesignContext.sectionArc.map((row) => String(row?.label || "").trim())
      : []),
    ...Object.keys(musicDesignContext?.designCues?.cueWindowsBySection || {})
  ]
    .map((label) => String(label || "").trim())
    .filter(Boolean);
  const matched = [];
  for (const label of normalizeStringArray(candidateSections)) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escaped}\\b`, "i").test(text)) matched.push(label);
  }
  return matched;
}

function buildAgentConversationContext(userMessage = "") {
  const selectedSectionNames = hasAllSectionsSelected()
    ? ["all"]
    : getSelectedSections();
  const includeDesignerSelection = shouldCarryDesignerSelectionContext(userMessage);
  const selectedTargets = includeDesignerSelection ? normalizeMetadataSelectionIds(state.ui.metadataSelectionIds || []) : [];
  const selectedTags = includeDesignerSelection ? normalizeMetadataSelectedTags(state.ui.metadataSelectedTags || []) : [];
  return {
    projectName: state.projectName || "",
    sequenceName: state.activeSequence || "",
    sequenceOpen: Boolean(state.flags.activeSequenceLoaded),
    activeSequenceLoaded: Boolean(state.flags.activeSequenceLoaded),
    planOnlyMode: Boolean(state.flags.planOnlyMode),
    rolloutMode: getAgentApplyRolloutMode(),
    route: state.route || "",
    revision: state.revision || "unknown",
    selectedSections: selectedSectionNames,
    selectedTargets,
    selectedTags,
    creativeBriefReady: Boolean(state.flags.creativeBriefReady),
    proposedCount: Array.isArray(state.proposed) ? state.proposed.length : 0,
    teamChat: {
      identities: getTeamChatIdentities()
    },
    agentLayer: {
      loaded: Boolean(state.health.agentLayerReady),
      activeRole: String(state.health.agentActiveRole || ""),
      registryVersion: String(state.health.agentRegistryVersion || ""),
      handoffsReady: String(state.health.agentHandoffsReady || "0/3")
    }
  };
}


async function onSaveAgentConfig() {
  const apiKeyInput = app.querySelector("#agent-api-key-input");
  const modelInput = app.querySelector("#agent-model-input");
  const baseUrlInput = app.querySelector("#agent-base-url-input");
  const ok = await agentSupportRuntime.saveAgentConfig({
    apiKey: String(apiKeyInput?.value || "").trim(),
    model: String(modelInput?.value || "").trim(),
    baseUrl: String(baseUrlInput?.value || "").trim()
  });
  if (ok && apiKeyInput) apiKeyInput.value = "";
}

async function onClearStoredAgentApiKey() {
  await agentSupportRuntime.clearStoredAgentApiKey();
}

function onClearXdTrackLocks() {
  const locked = getManualLockedXdTracks();
  if (!locked.length) {
    setStatus("info", "No manual XD track locks are active.");
    return render();
  }
  if (!window.confirm(`Clear manual lock policy for ${locked.length} XD track${locked.length === 1 ? "" : "s"}?`)) {
    setStatus("info", "Clear XD track locks canceled.");
    return render();
  }
  const changed = removeGlobalXdManualLocks();
  pushDiagnostic("info", `Cleared manual lock policy for ${changed} XD track${changed === 1 ? "" : "s"}.`);
  setStatus("info", `Cleared manual lock policy for ${changed} XD track${changed === 1 ? "" : "s"}.`);
  saveCurrentProjectSnapshot();
  persist();
  render();
}

async function onAcceptTimingTrackReview({
  policyKey = "",
  trackName = "",
  acceptedAt = "",
  reviewer = "",
  note = "",
  refreshSections = true
} = {}) {
  return timingTrackRuntime.acceptTimingTrackReview({
    policyKey,
    trackName,
    acceptedAt,
    reviewer,
    note,
    refreshSections
  });
}

function getCurrentAnalysisTimingSeed() {
  const artifact = state.audioAnalysis?.artifact && typeof state.audioAnalysis.artifact === "object"
    ? state.audioAnalysis.artifact
    : null;
  const handoff = agentRuntimeState.getValidHandoff("analysis_handoff_v1");
  const durationMs = Math.max(
    1,
    Number(
      state.sequenceSettings?.durationMs ||
      artifact?.audio?.durationMs ||
      handoff?.audio?.durationMs ||
      0
    ) || 1
  );
  const structureMarks = Array.isArray(artifact?.structure?.sections)
    ? artifact.structure.sections
    : (Array.isArray(handoff?.structure?.sections) ? handoff.structure.sections : []);
  const phraseMarks = Array.isArray(artifact?.lyrics?.plainPhraseFallback?.phrases)
    ? artifact.lyrics.plainPhraseFallback.phrases
    : (Array.isArray(handoff?.lyrics?.plainPhraseFallback?.phrases) ? handoff.lyrics.plainPhraseFallback.phrases : []);
  return { durationMs, structureMarks, phraseMarks };
}

async function onSeedTimingTracksFromAnalysis() {
  if (!state.flags.xlightsConnected) {
    return { ok: false, error: "xlights_not_connected" };
  }
  const { durationMs, structureMarks, phraseMarks } = getCurrentAnalysisTimingSeed();
  if (!Array.isArray(structureMarks) || !structureMarks.length) {
    return { ok: false, error: "missing_structure_marks" };
  }

  const normalizedStructureMarks = normalizeTimingTrackCoverage(structureMarks, {
    durationMs,
    fillerLabel: "",
    preserveAdjacentBoundaries: true
  });
  const boundaries = [...new Set(normalizedStructureMarks.flatMap((mark) => [Number(mark?.startMs || 0), Number(mark?.endMs || 0)]))]
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  const normalizedPhraseMarks = Array.isArray(phraseMarks) && phraseMarks.length
    ? normalizeTimingTrackCoverage(
        splitMarksAtBoundaries(phraseMarks, boundaries, { fillerLabel: "" }),
        {
          durationMs,
          fillerLabel: "",
          preserveAdjacentBoundaries: true
        }
      )
    : [];

  const writeTrack = async (trackName, marks, trackType) => {
    await createTimingTrack(state.endpoint, { trackName, replaceIfExists: true });
    await replaceTimingMarks(state.endpoint, { trackName, marks });
    const actualMarksResp = await getTimingMarks(state.endpoint, trackName);
    const actualMarks = Array.isArray(actualMarksResp?.data?.marks) ? actualMarksResp.data.marks : marks;
    const policyKey = buildGlobalXdTrackPolicyKey(trackName);
    const timingTrackPolicies = {
      ...getSequenceTimingTrackPoliciesState(),
      [policyKey]: {
        manual: false,
        sourceTrack: trackName,
        trackName,
        updatedAt: new Date().toISOString()
      }
    };
    const timingGeneratedSignatures = {
      ...getSequenceTimingGeneratedSignaturesState(),
      [policyKey]: timingMarksSignature(marks)
    };
    const timingTrackProvenance = {
      ...getSequenceTimingTrackProvenanceState(),
      [policyKey]: buildTimingTrackProvenanceRecord({
        trackType,
        trackName,
        sourceMarks: marks,
        userFinalMarks: actualMarks,
        sourceProvenance: {
          generator: "analysis_timing_seed_v1"
        },
        capturedAt: new Date().toISOString(),
        coverageMode: "complete",
        durationMs,
        fillerLabel: ""
      })
    };
    setSequenceTimingTrackPoliciesState(timingTrackPolicies);
    setSequenceTimingGeneratedSignaturesState(timingGeneratedSignatures);
    setSequenceTimingTrackProvenanceState(timingTrackProvenance);
  };

  await writeTrack("XD: Song Structure", normalizedStructureMarks, "structure");
  if (normalizedPhraseMarks.length) {
    await writeTrack("XD: Phrase Cues", normalizedPhraseMarks, "phrase");
  }

  try {
    const tracksResp = await getTimingTracks(state.endpoint);
    state.timingTracks = Array.isArray(tracksResp?.data?.tracks) ? tracksResp.data.tracks : state.timingTracks;
  } catch {
    // Best-effort refresh only.
  }
  render();
  return {
    ok: true,
    structureMarkCount: normalizedStructureMarks.length,
    phraseMarkCount: normalizedPhraseMarks.length
  };
}

async function onTestCloudAgent() {
  const bridge = getDesktopAgentConversationBridge();
  if (!bridge) {
    state.ui.agentLastTestStatus = "Failed: desktop runtime bridge unavailable.";
    setStatusWithDiagnostics("warning", "Cloud agent test requires desktop runtime.");
    return render();
  }

  state.ui.agentThinking = true;
  state.ui.diagnosticsOpen = true;
  state.ui.diagnosticsFilter = "all";
  state.ui.agentLastTestStatus = "Running cloud agent connectivity test...";
  setStatus("info", "Testing cloud agent...");
  pushDiagnostic("warning", "Cloud agent test started.");
  render();
  try {
    await agentSupportRuntime.hydrateAgentHealth();
    if (!state.health.agentConfigured) {
      state.ui.agentLastTestStatus = "Failed: cloud agent is not configured. Save API key first.";
      setStatusWithDiagnostics("warning", "Cloud agent is not configured. Save API key first.");
      addChatMessage("system", "Cloud agent test failed: agent is not configured.");
      return;
    }
    const res = await bridge.runAgentConversation({
      userMessage: "Reply with CLOUD_AGENT_OK",
      messages: [],
      context: {
        purpose: "connectivity-test",
        projectName: state.projectName || ""
      }
    });
    if (!res?.ok) {
      const errText = String(res?.error || "Unknown cloud agent error.");
      state.ui.agentLastTestStatus = `Failed: ${errText}`;
      setStatusWithDiagnostics("action-required", "Cloud agent test failed.", errText);
      addChatMessage("system", `Cloud agent test failed: ${errText}`);
      return;
    }
    state.health.agentProvider = String(res.provider || state.health.agentProvider || "openai");
    state.health.agentModel = String(res.model || state.health.agentModel || "");
    state.health.agentConfigured = true;
    state.ui.agentLastTestStatus = `Passed (${state.health.agentModel || "model unknown"}).`;
    setStatus("info", `Cloud agent test passed (${state.health.agentModel || "model unknown"}).`);
    pushDiagnostic("info", `Cloud agent test passed (${state.health.agentModel || "model unknown"}).`);
    addChatMessage("system", `Cloud agent test passed (${state.health.agentModel || "model unknown"}).`);
  } catch (err) {
    const errText = String(err?.message || err);
    state.ui.agentLastTestStatus = `Failed: ${errText}`;
    setStatusWithDiagnostics("action-required", "Cloud agent test failed.", errText);
    addChatMessage("system", `Cloud agent test failed: ${errText}`);
  } finally {
    state.ui.agentThinking = false;
    persist();
    render();
  }
}

function buildOrchestrationTestAnalysisHandoff() {
  const fallbackTitle = basenameOfPath(state.audioPathInput || "") || "Unknown Track";
  const timingGuess = (() => {
    const summary = String(state.audioAnalysis?.summary || "");
    const m = summary.match(/Tempo\/time signature:\s*([0-9.]+)\s*BPM.*?\/\s*([0-9]+\/[0-9]+)/i);
    if (!m) return { bpm: 120, timeSignature: "4/4" };
    return {
      bpm: Number(m[1]) || 120,
      timeSignature: String(m[2] || "4/4")
    };
  })();
  return {
    trackIdentity: {
      title: fallbackTitle,
      artist: "unknown",
      isrc: ""
    },
    timing: {
      bpm: timingGuess.bpm,
      timeSignature: timingGuess.timeSignature,
      beatsArtifact: "beats",
      barsArtifact: "bars"
    },
    structure: {
      sections: ["Intro", "Verse 1", "Chorus 1"],
      source: "orchestration-test",
      confidence: "medium"
    },
    lyrics: {
      hasSyncedLyrics: false,
      lyricsArtifact: ""
    },
    chords: {
      hasChords: false,
      chordsArtifact: "",
      confidence: "low"
    },
    briefSeed: {
      tone: "orchestration test",
      mood: "neutral",
      story: "test flow only",
      designHints: ["validate handoff pipeline"]
    },
    evidence: {
      serviceSummary: "orchestration-test",
      webValidationSummary: "orchestration-test",
      sources: []
    }
  };
}

async function onTestAgentOrchestration() {
  const orchestrationRun = agentRuntimeState.beginOrchestrationRun({ trigger: "orchestration-test", role: "audio_analyst" });
  state.ui.agentThinking = true;
  state.ui.diagnosticsOpen = true;
  state.ui.diagnosticsFilter = "all";
  state.ui.agentLastOrchestrationTestStatus = "Running orchestration test...";
  setStatus("info", "Testing agent orchestration...");
  pushDiagnostic("warning", "Agent orchestration test started.");
  render();
  try {
    const runtimeReady = await agentSupportRuntime.hydrateAgentRuntime({ force: true, quiet: true });
    if (!runtimeReady) {
      agentRuntimeState.markOrchestrationStage(orchestrationRun, "runtime_load", "error", String(agentRuntime.error || "runtime unavailable"));
      agentRuntimeState.endOrchestrationRun(orchestrationRun, { status: "failed", summary: "agent runtime unavailable" });
      const msg = `Failed: agent runtime unavailable (${agentRuntime.error || "unknown error"})`;
      state.ui.agentLastOrchestrationTestStatus = msg;
      setStatusWithDiagnostics("warning", "Agent orchestration test failed.", msg);
      return;
    }
    agentRuntimeState.markOrchestrationStage(orchestrationRun, "runtime_load", "ok", "agent runtime loaded");
    clearAgentHandoffs();

    agentRuntimeState.setAgentActiveRole("audio_analyst");
    const analysisSet = agentRuntimeState.setAgentHandoff(
      "analysis_handoff_v1",
      buildOrchestrationTestAnalysisHandoff(),
      "audio_analyst"
    );
    if (!analysisSet.ok) {
      agentRuntimeState.markOrchestrationStage(orchestrationRun, "analysis_handoff", "error", analysisSet.errors.join("; "));
      agentRuntimeState.endOrchestrationRun(orchestrationRun, { status: "failed", summary: "analysis handoff failed" });
      const msg = `Failed at analysis handoff: ${analysisSet.errors.join("; ")}`;
      state.ui.agentLastOrchestrationTestStatus = msg;
      setStatusWithDiagnostics("warning", "Agent orchestration test failed.", msg);
      return;
    }
    agentRuntimeState.markOrchestrationStage(orchestrationRun, "analysis_handoff", "ok", "analysis_handoff_v1 ready");

    agentRuntimeState.setAgentActiveRole("designer_dialog");
    const chatIntent = latestUserIntentText() || "Test intent for orchestration";
    const intentSet = agentRuntimeState.setAgentHandoff(
      "intent_handoff_v1",
      {
        goal: chatIntent,
        mode: inferIntentModeFromGoal(chatIntent),
        scope: {
          targetIds: normalizeMetadataSelectionIds(state.ui.metadataSelectionIds || []),
          tagNames: normalizeMetadataSelectedTags(state.ui.metadataSelectedTags || []),
          sections: hasAllSectionsSelected() ? [] : getSelectedSections(),
          timeRangeMs: null
        },
        constraints: {
          changeTolerance: "medium",
          preserveTimingTracks: true,
          allowGlobalRewrite: false
        },
        directorPreferences: {
          styleDirection: String(state.creative?.brief?.mood || "").trim(),
          energyArc: "hold",
          focusElements: normalizeMetadataSelectionIds(state.ui.metadataSelectionIds || []),
          colorDirection: String(state.creative?.brief?.paletteIntent || "").trim()
        },
        approvalPolicy: {
          requiresExplicitApprove: true,
          elevatedRiskConfirmed: false
        }
      },
      "designer_dialog"
    );
    if (!intentSet.ok) {
      agentRuntimeState.markOrchestrationStage(orchestrationRun, "intent_handoff", "error", intentSet.errors.join("; "));
      agentRuntimeState.endOrchestrationRun(orchestrationRun, { status: "failed", summary: "intent handoff failed" });
      const msg = `Failed at intent handoff: ${intentSet.errors.join("; ")}`;
      state.ui.agentLastOrchestrationTestStatus = msg;
      setStatusWithDiagnostics("warning", "Agent orchestration test failed.", msg);
      return;
    }
    agentRuntimeState.markOrchestrationStage(orchestrationRun, "intent_handoff", "ok", "intent_handoff_v1 ready");

    agentRuntimeState.setAgentActiveRole("sequence_agent");
    const planSource = (Array.isArray(state.proposed) && state.proposed.length)
      ? state.proposed
      : buildDemoProposedLines().slice(0, 3);
    let commands = [];
    try {
      commands = applyReviewRuntime.buildDesignerPlanCommands(planSource);
    } catch (err) {
      const msg = `Failed generating test commands: ${String(err?.message || err)}`;
      state.ui.agentLastOrchestrationTestStatus = msg;
      setStatusWithDiagnostics("warning", "Agent orchestration test failed.", msg);
      return;
    }
    const planSet = agentRuntimeState.setAgentHandoff(
      "plan_handoff_v1",
      {
        planId: `orchestration-test-${Date.now()}`,
        summary: "Orchestration validation plan (non-applied)",
        estimatedImpact: estimateImpactCount(planSource),
        warnings: [],
        commands,
        baseRevision: String(state.revision || "unknown"),
        validationReady: true
      },
      "sequence_agent"
    );
    if (!planSet.ok) {
      agentRuntimeState.markOrchestrationStage(orchestrationRun, "plan_handoff", "error", planSet.errors.join("; "));
      agentRuntimeState.endOrchestrationRun(orchestrationRun, { status: "failed", summary: "plan handoff failed" });
      const msg = `Failed at plan handoff: ${planSet.errors.join("; ")}`;
      state.ui.agentLastOrchestrationTestStatus = msg;
      setStatusWithDiagnostics("warning", "Agent orchestration test failed.", msg);
      return;
    }
    agentRuntimeState.markOrchestrationStage(orchestrationRun, "plan_handoff", "ok", "plan_handoff_v1 ready");

    const readyCount = state.health.agentHandoffsReady || "0/3";
    state.ui.agentLastOrchestrationTestStatus = `Passed (${readyCount} handoffs ready).`;
    setStatus("info", `Agent orchestration test passed (${readyCount}).`);
    pushDiagnostic("info", `Agent orchestration test passed (${readyCount}).`);
    agentRuntimeState.endOrchestrationRun(orchestrationRun, { status: "ok", summary: `orchestration test passed (${readyCount})` });
  } catch (err) {
    agentRuntimeState.markOrchestrationStage(orchestrationRun, "exception", "error", String(err?.message || err));
    agentRuntimeState.endOrchestrationRun(orchestrationRun, { status: "failed", summary: "orchestration test error" });
    const msg = String(err?.message || err);
    state.ui.agentLastOrchestrationTestStatus = `Failed: ${msg}`;
    setStatusWithDiagnostics("warning", "Agent orchestration test failed.", msg);
  } finally {
    state.ui.agentThinking = false;
    persist();
    render();
  }
}

function cloneHandoffsMap(handoffs = {}) {
  const out = {};
  for (const contract of AGENT_HANDOFF_CONTRACTS) {
    const row = handoffs?.[contract];
    out[contract] = row && typeof row === "object" ? JSON.parse(JSON.stringify(row)) : null;
  }
  return out;
}

async function onRunOrchestrationMatrix() {
  const orchestrationRun = agentRuntimeState.beginOrchestrationRun({ trigger: "orchestration-matrix", role: "designer_dialog" });
  state.ui.agentThinking = true;
  state.ui.diagnosticsOpen = true;
  state.ui.diagnosticsFilter = "all";
  state.ui.agentLastOrchestrationMatrixStatus = "Running orchestration matrix...";
  setStatus("info", "Running orchestration acceptance matrix...");
  render();
  const previousHandoffs = cloneHandoffsMap(agentRuntime.handoffs);
  const previousRole = String(agentRuntime.activeRole || "");
  const previousUiSections = [...(state.ui.sectionSelections || [])];
  const previousUiTargets = [...(state.ui.metadataSelectionIds || [])];
  const previousUiTags = [...(state.ui.metadataSelectedTags || [])];
  const previousAudioPath = String(state.audioPathInput || "");
  const previousRevision = String(state.revision || "unknown");
  const previousDraftBase = String(state.draftBaseRevision || "unknown");
  const previousTimingTrackPolicies = JSON.parse(JSON.stringify(getSequenceTimingTrackPoliciesState()));
  const results = [];
  try {
    const runtimeReady = await agentSupportRuntime.hydrateAgentRuntime({ force: true, quiet: true });
    if (!runtimeReady) {
      agentRuntimeState.markOrchestrationStage(orchestrationRun, "runtime_load", "error", String(agentRuntime.error || "runtime unavailable"));
      agentRuntimeState.endOrchestrationRun(orchestrationRun, { status: "failed", summary: "runtime unavailable" });
      state.ui.agentLastOrchestrationMatrixStatus = "Failed: runtime unavailable";
      setStatusWithDiagnostics("warning", "Orchestration matrix failed: runtime unavailable.");
      return;
    }
    agentRuntimeState.markOrchestrationStage(orchestrationRun, "runtime_load", "ok", "agent runtime loaded");

    const runScenario = (name, fn) => {
      clearAgentHandoffs();
      const startedAt = nowMs();
      let ok = false;
      let note = "";
      try {
        const out = fn();
        ok = Boolean(out?.ok);
        note = String(out?.note || "");
      } catch (err) {
        ok = false;
        note = String(err?.message || err);
      }
      const elapsed = Math.max(0, nowMs() - startedAt);
      results.push({ name, ok, note, elapsedMs: elapsed });
      agentRuntimeState.markOrchestrationStage(
        orchestrationRun,
        `scenario:${name}`,
        ok ? "ok" : "error",
        `${note}${note ? " | " : ""}${elapsed}ms`
      );
    };

    runScenario("happy-path-gate", () => {
      const analysis = agentRuntimeState.setAgentHandoff("analysis_handoff_v1", buildOrchestrationTestAnalysisHandoff(), "audio_analyst");
      const intent = agentRuntimeState.setAgentHandoff("intent_handoff_v1", {
        goal: "Matrix happy path intent",
        mode: "revise",
        scope: { targetIds: [], tagNames: [], sections: [], timeRangeMs: null },
        constraints: { changeTolerance: "medium", preserveTimingTracks: true, allowGlobalRewrite: false },
        directorPreferences: { styleDirection: "", energyArc: "hold", focusElements: [], colorDirection: "" },
        approvalPolicy: { requiresExplicitApprove: true, elevatedRiskConfirmed: false }
      }, "designer_dialog");
      const plan = agentRuntimeState.setAgentHandoff("plan_handoff_v1", {
        planId: `matrix-plan-${nowMs()}`,
        summary: "matrix happy path",
        estimatedImpact: 11,
        warnings: [],
        commands: applyReviewRuntime.buildDesignerPlanCommands(buildDemoProposedLines().slice(0, 2)),
        baseRevision: String(state.draftBaseRevision || "unknown"),
        validationReady: true
      }, "sequence_agent");
      const gate = evaluateApplyHandoffGate();
      return { ok: analysis.ok && intent.ok && plan.ok && gate.ok, note: gate.ok ? "gate open" : gate.message };
    });

    runScenario("missing-intent-blocked", () => {
      agentRuntimeState.setAgentHandoff("analysis_handoff_v1", buildOrchestrationTestAnalysisHandoff(), "audio_analyst");
      agentRuntimeState.setAgentHandoff("plan_handoff_v1", {
        planId: `matrix-plan-${nowMs()}`,
        summary: "missing intent case",
        estimatedImpact: 11,
        warnings: [],
        commands: applyReviewRuntime.buildDesignerPlanCommands(buildDemoProposedLines().slice(0, 1)),
        baseRevision: String(state.draftBaseRevision || "unknown"),
        validationReady: true
      }, "sequence_agent");
      const gate = evaluateApplyHandoffGate();
      return { ok: !gate.ok && gate.reason === "missing-intent-handoff", note: gate.message };
    });

    runScenario("revision-mismatch-blocked", () => {
      agentRuntimeState.setAgentHandoff("intent_handoff_v1", {
        goal: "revision mismatch case",
        mode: "revise",
        scope: { targetIds: [], tagNames: [], sections: [], timeRangeMs: null },
        constraints: { changeTolerance: "medium", preserveTimingTracks: true, allowGlobalRewrite: false },
        directorPreferences: { styleDirection: "", energyArc: "hold", focusElements: [], colorDirection: "" },
        approvalPolicy: { requiresExplicitApprove: true, elevatedRiskConfirmed: false }
      }, "designer_dialog");
      agentRuntimeState.setAgentHandoff("plan_handoff_v1", {
        planId: `matrix-plan-${nowMs()}`,
        summary: "revision mismatch",
        estimatedImpact: 11,
        warnings: [],
        commands: applyReviewRuntime.buildDesignerPlanCommands(buildDemoProposedLines().slice(0, 1)),
        baseRevision: "__old_revision__",
        validationReady: true
      }, "sequence_agent");
      const gate = evaluateApplyHandoffGate();
      return { ok: !gate.ok && gate.reason === "plan-base-revision-mismatch", note: gate.message };
    });

    runScenario("section-change-invalidates-plan", () => {
      agentRuntimeState.setAgentHandoff("intent_handoff_v1", {
        goal: "section drift case",
        mode: "revise",
        scope: { targetIds: [], tagNames: [], sections: ["Verse 1"], timeRangeMs: null },
        constraints: { changeTolerance: "medium", preserveTimingTracks: true, allowGlobalRewrite: false },
        directorPreferences: { styleDirection: "", energyArc: "hold", focusElements: [], colorDirection: "" },
        approvalPolicy: { requiresExplicitApprove: true, elevatedRiskConfirmed: false }
      }, "designer_dialog");
      agentRuntimeState.setAgentHandoff("plan_handoff_v1", {
        planId: `matrix-plan-${nowMs()}`,
        summary: "section invalidation",
        estimatedImpact: 11,
        warnings: [],
        commands: applyReviewRuntime.buildDesignerPlanCommands(buildDemoProposedLines().slice(0, 1)),
        baseRevision: String(state.draftBaseRevision || "unknown"),
        validationReady: true
      }, "sequence_agent");
      state.ui.sectionSelections = ["Verse 2"];
      reconcileHandoffsAgainstCurrentContext({ reasonPrefix: "matrix section-change" });
      return {
        ok: !agentRuntimeState.getValidHandoff("plan_handoff_v1"),
        note: "plan_handoff_v1 cleared after section change"
      };
    });

    runScenario("audio-change-invalidates-analysis", () => {
      const beforeAudio = String(state.audioPathInput || "");
      agentRuntimeState.setAgentHandoff("analysis_handoff_v1", buildOrchestrationTestAnalysisHandoff(), "audio_analyst");
      const changed = beforeAudio ? `${beforeAudio}.matrix` : "/tmp/matrix-audio.mp3";
      sequenceMediaSessionRuntime.setAudioPathWithAgentPolicy(changed, "matrix audio change");
      const analysisCleared = !agentRuntimeState.getValidHandoff("analysis_handoff_v1");
      const planCleared = !agentRuntimeState.getValidHandoff("plan_handoff_v1");
      return {
        ok: analysisCleared && planCleared,
        note: "analysis and dependent plan cleared after audio change"
      };
    });

    runScenario("missing-analysis-degraded-mode-warning", () => {
      const raw = buildSequenceAgentPlan({
        analysisHandoff: null,
        intentHandoff: {
          goal: "degraded analysis case",
          mode: "revise",
          scope: { targetIds: ["MegaTree"], tagNames: [], sections: ["Chorus 1"] }
        },
        sourceLines: ["Chorus 1 / MegaTree / shimmer fade"],
        baseRevision: String(state.draftBaseRevision || "unknown"),
        capabilityCommands: state.health.capabilityCommands || [],
        effectCatalog: state.effectCatalog,
        layoutMode: currentLayoutMode(),
        timingOwnership: getSequenceTimingOwnershipRows(),
        metadataAssignments: buildEffectiveMetadataAssignments(),
        allowTimingWrites: true
      });
      return {
        ok: raw.metadata?.degradedMode === true && raw.warnings.some((row) => /reduced-confidence/i.test(String(row))),
        note: "sequence_agent enters degraded mode and warns when analysis handoff is missing"
      };
    });

    runScenario("partial-scope-apply-generates-fresh-plan", () => {
      const partial = buildSequenceAgentPlan({
        analysisHandoff: buildOrchestrationTestAnalysisHandoff(),
        intentHandoff: {
          goal: "partial scope case",
          mode: "revise",
          scope: { targetIds: ["MegaTree"], tagNames: [], sections: ["Chorus 1"] }
        },
        sourceLines: buildDemoProposedLines().slice(0, 1),
        baseRevision: String(state.draftBaseRevision || "unknown"),
        capabilityCommands: state.health.capabilityCommands || [],
        effectCatalog: state.effectCatalog,
        layoutMode: currentLayoutMode(),
        timingOwnership: getSequenceTimingOwnershipRows(),
        metadataAssignments: buildEffectiveMetadataAssignments(),
        allowTimingWrites: true
      });
      return {
        ok: Array.isArray(partial.commands) && partial.commands.length > 0,
        note: "partial-scope apply uses a fresh generated plan"
      };
    });

    runScenario("timing-edits-remain-cumulative", () => {
      const policies = getSequenceTimingTrackPoliciesState();
      const lockKey = buildGlobalXdTrackPolicyKey("XD: Sequencer Plan");
      policies[lockKey] = {
        manual: true,
        trackName: "Sequencer Plan",
        sourceTrack: "XD: Sequencer Plan",
        lockedAt: new Date().toISOString()
      };
      setSequenceTimingTrackPoliciesState(policies);
      const raw = buildSequenceAgentPlan({
        analysisHandoff: buildOrchestrationTestAnalysisHandoff(),
        intentHandoff: {
          goal: "lock case",
          mode: "revise",
          scope: { targetIds: [], tagNames: [], sections: [] }
        },
        sourceLines: buildDemoProposedLines().slice(0, 2),
        baseRevision: String(state.draftBaseRevision || "unknown"),
        capabilityCommands: state.health.capabilityCommands || [],
        effectCatalog: state.effectCatalog,
        layoutMode: currentLayoutMode(),
        timingOwnership: getSequenceTimingOwnershipRows(),
        metadataAssignments: buildEffectiveMetadataAssignments(),
        allowTimingWrites: true
      }).commands;
      return {
        ok: raw.some((step) => String(step?.cmd || "").startsWith("timing.")),
        note: "prior manual timing edits do not suppress future sequence_agent timing updates"
      };
    });

    const passed = results.filter((r) => r.ok).length;
    const total = results.length;
    const failed = total - passed;
    state.orchestrationMatrix = {
      ranAt: new Date().toISOString(),
      passed,
      total,
      failed,
      results
    };
    state.ui.agentLastOrchestrationMatrixStatus = `${passed}/${total} passed`;
    pushDiagnostic("info", `Orchestration matrix: ${passed}/${total} passed.`);
    for (const row of results) {
      const level = row.ok ? "info" : "warning";
      pushDiagnostic(level, `Orchestration matrix [${row.ok ? "PASS" : "FAIL"}] ${row.name}: ${row.note}`);
    }
    const finalOk = failed === 0;
    agentRuntimeState.endOrchestrationRun(orchestrationRun, {
      status: finalOk ? "ok" : "failed",
      summary: `matrix ${passed}/${total} passed`
    });
    setStatus(finalOk ? "info" : "warning", `Orchestration matrix complete: ${passed}/${total} passed.`);
  } catch (err) {
    agentRuntimeState.markOrchestrationStage(orchestrationRun, "exception", "error", String(err?.message || err));
    agentRuntimeState.endOrchestrationRun(orchestrationRun, { status: "failed", summary: "matrix run error" });
    const msg = String(err?.message || err);
    state.ui.agentLastOrchestrationMatrixStatus = `Failed: ${msg}`;
    setStatusWithDiagnostics("warning", `Orchestration matrix failed: ${msg}`);
  } finally {
    agentRuntime.handoffs = cloneHandoffsMap(previousHandoffs);
    agentRuntime.activeRole = previousRole;
    state.ui.sectionSelections = [...previousUiSections];
    state.ui.metadataSelectionIds = [...previousUiTargets];
    state.ui.metadataSelectedTags = [...previousUiTags];
    state.audioPathInput = previousAudioPath;
    state.revision = previousRevision;
    state.draftBaseRevision = previousDraftBase;
    setSequenceTimingTrackPoliciesState(previousTimingTrackPolicies);
    agentRuntimeState.refreshAgentRuntimeHealth();
    reconcileHandoffsAgainstCurrentContext({ reasonPrefix: "matrix restore" });
    state.ui.agentThinking = false;
    persist();
    render();
  }
}

async function onSendChat() {
  const raw = (state.ui.chatDraft || "").trim();
  if (!raw) return;
  addStructuredChatMessage("user", raw, {
    roleId: "user",
    displayName: "You"
  });
  agentRuntimeState.setAgentActiveRole("app_assistant");
  state.ui.chatDraft = "";
  state.ui.agentThinking = true;
  render();

  const explicitVisualHintDefinition = parseExplicitVisualHintDefinitionIntent(raw);
  if (explicitVisualHintDefinition) {
    const normalizedName = normalizeMetadataTagName(explicitVisualHintDefinition.name);
    const existingHint = getVisualHintDefinitionRecords().find((row) => row.name === normalizedName) || null;
    const record = definePersistedVisualHint(explicitVisualHintDefinition.name, {
      description: explicitVisualHintDefinition.description,
      semanticClass: "custom",
      behavioralIntent: explicitVisualHintDefinition.behavioralIntent,
      definedBy: "user",
      source: "managed",
      learnedFrom: "chat_dialog"
    });
    const acknowledgement = existingHint
      ? `Updated visual hint definition for ${record?.name || explicitVisualHintDefinition.name}.`
      : `Saved visual hint definition for ${record?.name || explicitVisualHintDefinition.name}.`;
    state.ui.agentThinking = false;
    addStructuredChatMessage(
      "agent",
      acknowledgement,
      {
        roleId: "app_assistant",
        displayName: getTeamChatSpeakerLabel("app_assistant"),
        handledBy: "app_assistant"
      }
    );
    setStatus("info", acknowledgement);
    saveCurrentProjectSnapshot();
    persist();
    render();
    return;
  }

  const bridge = getDesktopAgentConversationBridge();
  if (!bridge) {
    state.ui.agentThinking = false;
    addStructuredChatMessage("agent", "Cloud agent is available only in desktop runtime.", {
      roleId: "app_assistant",
      displayName: getTeamChatSpeakerLabel("app_assistant"),
      handledBy: "app_assistant"
    });
    setStatusWithDiagnostics("warning", "Desktop runtime required for cloud conversation agent.");
    saveCurrentProjectSnapshot();
    persist();
    render();
    return;
  }

  try {
    const chatRows = Array.isArray(state.chat) ? state.chat : [];
    const contextRows = chatRows.slice(0, Math.max(0, chatRows.length - 1));
    const history = contextRows
      .filter((m) => m && (m.who === "user" || m.who === "agent"))
      .slice(-30)
      .map((m) => ({
        role: m.who === "agent" ? "assistant" : "user",
        content: String(m.text || "")
      }));
    const shell = await executeAppAssistantConversation({
      userMessage: raw,
      messages: history,
      previousResponseId: "",
      context: buildAgentConversationContext(raw),
      bridge
    });
    const res = shell?.result || null;
    if (!shell?.ok || !res) {
      const errText = String(shell?.error || "Cloud agent request failed.");
      addStructuredChatMessage("agent", String(res?.assistantMessage || `Agent unavailable: ${errText}`), {
        roleId: String(res?.handledBy || "app_assistant"),
        displayName: getTeamChatSpeakerLabel(String(res?.handledBy || "app_assistant")),
        nickname: String(res?.identities?.[String(res?.handledBy || "app_assistant")]?.nickname || ""),
        handledBy: String(res?.handledBy || "app_assistant"),
        addressedTo: String(res?.addressedTo || "")
      });
      agentRuntimeState.setAgentActiveRole(String(res?.routeDecision || "app_assistant"));
      setStatusWithDiagnostics("action-required", "Cloud agent conversation failed.", errText);
      await agentSupportRuntime.hydrateAgentHealth();
      saveCurrentProjectSnapshot();
      persist();
      render();
      return;
    }

    const nextRole = ["audio_analyst", "designer_dialog", "sequence_agent"].includes(String(res.routeDecision || ""))
      ? String(res.routeDecision)
      : "app_assistant";
    if (nextRole === "audio_analyst" && !hasUsableCurrentAudioAnalysis()) {
      await hydrateAnalysisArtifactForCurrentMedia({ silent: true });
    }
    const shouldAutoGenerate = shouldAutoGenerateProposalFromChatResult(res, raw);
    const shouldAutoRunAudio = shouldAutoRunAudioAnalysisFromChatResult(res, raw);
    const shouldAnswerExistingAudio = shouldAnswerAudioFromExistingAnalysis(res, raw);
    const continueToProposal = shouldContinueToProposalAfterAudio(res, raw);
    const shouldContinueFromExistingAudio =
      !shouldAutoRunAudio &&
      !shouldAnswerExistingAudio &&
      String(res?.routeDecision || "").trim() === "audio_analyst" &&
      hasUsableCurrentAudioAnalysis() &&
      continueToProposal;
    const suppressShellBubble =
      shouldAutoGenerate ||
      shouldAnswerExistingAudio ||
      shouldAutoRunAudio ||
      shouldContinueFromExistingAudio ||
      (nextRole === "sequence_agent" && Boolean(res?.shouldGenerateProposal));
    if (!suppressShellBubble) {
      addStructuredChatMessage("agent", String(res.assistantMessage || ""), {
        roleId: String(res.handledBy || "app_assistant"),
        displayName: getTeamChatSpeakerLabel(String(res.handledBy || "app_assistant")),
        nickname: String(res.identities?.[String(res.handledBy || "app_assistant")]?.nickname || ""),
        handledBy: String(res.handledBy || "app_assistant"),
        addressedTo: String(res.addressedTo || "")
      });
    }
    agentRuntimeState.setAgentActiveRole(nextRole);
    state.ui.agentResponseId = String(res.responseId || state.ui.agentResponseId || "");
    state.health.agentProvider = String(res.provider || "openai");
    state.health.agentModel = String(res.model || state.health.agentModel || "");
    state.health.agentConfigured = true;

    if (shouldAnswerExistingAudio) {
      const analysis = agentRuntimeState.getValidHandoff("analysis_handoff_v1");
      addStructuredChatMessage("agent", buildAudioAnalystChatReply(raw, analysis), {
        roleId: "audio_analyst",
        displayName: getTeamChatSpeakerLabel("audio_analyst"),
        handledBy: "audio_analyst"
      });
      setStatus("info", "Conversation updated. Audio analysis guidance is ready.");
      return;
    }
    if (shouldContinueFromExistingAudio) {
      pushDiagnostic("info", "audio-first route: using existing analysis to enter proposal generation");
      const seeded = seedTechnicalIntentHandoffFromChatPrompt(String(res.proposalIntent || raw), "app_assistant");
      if (seeded?.ok) {
        pushDiagnostic("info", "audio-first route: intent_handoff_v1 seeded from existing analysis");
      } else {
        pushDiagnostic("warning", "audio-first route: existing-analysis intent seeding failed");
      }
      pushDiagnostic("info", "audio-first route: entering onGenerate(sequence_agent) from existing analysis");
      await onGenerate(String(res.proposalIntent || raw), {
        requestedRole: "sequence_agent"
      });
      return;
    }
    if (shouldAutoRunAudio) {
      const continuationRole = inferAudioContinuationProposalRole(res);
      pushDiagnostic(
        "info",
        `audio-first route: continueToProposal=${continueToProposal ? "true" : "false"} route=${String(res.routeDecision || "")} addressedTo=${String(res.addressedTo || "")} continueRole=${continuationRole}`
      );
      await onAnalyzeAudio({ userPrompt: raw });
      if (continueToProposal) {
        if (continuationRole === "sequence_agent") {
          pushDiagnostic("info", "audio-first route: seeding technical intent handoff before generate");
          const seeded = seedTechnicalIntentHandoffFromChatPrompt(String(res.proposalIntent || raw), "app_assistant");
          if (seeded?.ok) {
            pushDiagnostic("info", "audio-first route: intent_handoff_v1 seeded");
          } else {
            pushDiagnostic("warning", "audio-first route: direct intent orchestration did not produce a valid intent handoff");
          }
        }
        pushDiagnostic("info", `audio-first route: entering onGenerate(${continuationRole})`);
        await onGenerate(String(res.proposalIntent || raw), {
          requestedRole: continuationRole
        });
      }
      return;
    }
    if (shouldAutoGenerate) {
      await onGenerate(String(res.proposalIntent || raw), {
        requestedRole: String(res.routeDecision || "")
      });
      return;
    }
    const session = applyReadinessRuntime.buildCurrentSequenceSession();
    if (!session.effectiveSequenceLoaded && !session.planOnlyMode) {
      setStatus("warning", "Open a sequence (or use plan-only mode) for proposal generation.");
    } else if (res.routeDecision === "audio_analyst") {
      setStatus("info", "Conversation updated. Audio analysis guidance is ready.");
    } else if (res.routeDecision === "sequence_agent") {
      setStatus("info", "Conversation updated. Sequencing guidance is ready.");
    } else if (res.routeDecision === "setup_help") {
      setStatus("info", "Conversation updated. Setup guidance is ready.");
    } else {
      setStatus("info", "Conversation updated.");
    }
  } catch (err) {
    const errText = String(err?.message || err);
    addStructuredChatMessage("agent", `Agent runtime error: ${errText}`, {
      roleId: "app_assistant",
      displayName: getTeamChatSpeakerLabel("app_assistant"),
      handledBy: "app_assistant"
    });
    setStatusWithDiagnostics("action-required", "Cloud agent runtime error.", errText);
  } finally {
    state.ui.agentThinking = false;
    saveCurrentProjectSnapshot();
    persist();
    render();
  }
}

function sequenceFolderPath() {
  const path = String(state.ui.sequenceMode === "new" ? state.newSequencePathInput : state.sequencePathInput || "").trim();
  if (!path.includes("/")) return String(state.showFolder || "").trim();
  return path.slice(0, path.lastIndexOf("/"));
}

function designerMediaFolderPath() {
  const base = sequenceFolderPath();
  return base ? `${base}/xlightsdesigner-media` : "xlightsdesigner-media";
}

function hasXsqExtension(name) {
  return /\.xsq$/i.test(String(name || "").trim());
}

function getFileExtension(filename) {
  const name = String(filename || "").toLowerCase().trim();
  if (!name.includes(".")) return "";
  return name.split(".").pop() || "";
}

function isSupportedSequenceMediaFile(filename) {
  return SUPPORTED_SEQUENCE_MEDIA_EXTENSIONS.has(getFileExtension(filename));
}

function isAllowedReferenceMediaFile(filename) {
  return REFERENCE_MEDIA_ALLOWED_EXTENSIONS.has(getFileExtension(filename));
}

function formatBytes(bytes) {
  const val = Number(bytes || 0);
  if (val < 1024) return `${val} B`;
  if (val < 1024 * 1024) return `${Math.round(val / 102.4) / 10} KB`;
  return `${Math.round(val / (1024 * 102.4)) / 10} MB`;
}

async function onReferenceMediaSelected() {
  const input = app.querySelector("#reference-upload-input");
  if (!input?.files?.length) return;
  const existingCount = Array.isArray(state.creative.references) ? state.creative.references.length : 0;
  if (existingCount >= REFERENCE_MEDIA_MAX_ITEMS) {
    setStatus("warning", `Reference media limit reached (${REFERENCE_MEDIA_MAX_ITEMS}). Remove items before adding more.`);
    return render();
  }

  const remainingSlots = REFERENCE_MEDIA_MAX_ITEMS - existingCount;
  const selectedFiles = Array.from(input.files).slice(0, remainingSlots);
  const now = Date.now();
  const additions = [];
  const rejected = [];
  const sequencePath = currentSequencePathForSidecar();
  const mediaBridge = getDesktopMediaBridge();
  const canPersistToSequenceMedia = Boolean(mediaBridge && sequencePath);

  for (let idx = 0; idx < selectedFiles.length; idx += 1) {
    const file = selectedFiles[idx];
    const safeName = String(file?.name || `reference-${idx + 1}`).replace(/[^\w.\- ]+/g, "_");
    if (!isAllowedReferenceMediaFile(safeName)) {
      rejected.push(`${safeName}: unsupported reference format`);
      continue;
    }
    if (Number(file?.size || 0) > REFERENCE_MEDIA_MAX_FILE_BYTES) {
      rejected.push(`${safeName}: exceeds ${formatBytes(REFERENCE_MEDIA_MAX_FILE_BYTES)} limit`);
      continue;
    }
    const duplicate = (state.creative.references || []).some((ref) => ref.name === safeName);
    if (duplicate) {
      rejected.push(`${safeName}: already added`);
      continue;
    }

    let storedPath = `${designerMediaFolderPath()}/${safeName}`;
    let persistedToSequenceMedia = false;
    if (canPersistToSequenceMedia) {
      try {
        const bytes = await file.arrayBuffer();
        const res = await mediaBridge.saveReferenceMedia({
          sequencePath,
          fileName: safeName,
          bytes
        });
        if (res?.ok === true && typeof res.absolutePath === "string" && res.absolutePath.trim()) {
          storedPath = res.absolutePath.trim();
          persistedToSequenceMedia = true;
        } else {
          rejected.push(`${safeName}: failed to persist to sequence media folder (${res?.error || "unknown error"})`);
        }
      } catch (err) {
        rejected.push(`${safeName}: failed to persist to sequence media folder (${err?.message || "unknown error"})`);
      }
    }

    additions.push({
      id: `ref-${now}-${idx}`,
      name: safeName,
      mimeType: String(file?.type || ""),
      sizeBytes: Number(file?.size || 0),
      storedPath,
      persistedToSequenceMedia,
      previewUrl: URL.createObjectURL(file),
      sequenceEligible: false,
      supportedForSequence: isSupportedSequenceMediaFile(safeName),
      addedAt: new Date().toISOString()
    });
  }

  if (!additions.length && rejected.length) {
    setStatusWithDiagnostics(
      "warning",
      "No reference media added. Review format/size constraints.",
      rejected.join("\n")
    );
    return render();
  }

  if (additions.length) {
    state.creative.references = [...(state.creative.references || []), ...additions];
    state.flags.creativeBriefReady = false;
  }

  input.value = "";
  if (rejected.length) {
    setStatusWithDiagnostics(
      "warning",
      `Added ${additions.length} reference file${additions.length === 1 ? "" : "s"} with ${rejected.length} rejection${rejected.length === 1 ? "" : "s"}.`,
      rejected.join("\n")
    );
  } else {
    setStatus("info", `Added ${additions.length} reference file${additions.length === 1 ? "" : "s"}.`);
  }
  saveCurrentProjectSnapshot();
  persist();
  render();
}

function creativeAnalysisDisabledReason() {
  const session = applyReadinessRuntime.buildCurrentSequenceSession();
  if (!session.effectiveSequenceLoaded) return "Open a sequence first.";
  if (!session.effectiveSequenceAllowed) return "Open a sequence inside the active Show Directory.";
  if (!String(session.effectiveSequencePath || "").trim()) return "Set a sequence path.";
  return "";
}

function isCreativeAnalysisEnabled() {
  return creativeAnalysisDisabledReason() === "";
}

function referenceFormatSummaryText() {
  return Array.from(REFERENCE_MEDIA_ALLOWED_EXTENSIONS)
    .map((ext) => `.${ext}`)
    .join(", ");
}

function sequenceEligibilityFormatSummaryText() {
  return Array.from(SUPPORTED_SEQUENCE_MEDIA_EXTENSIONS)
    .map((ext) => `.${ext}`)
    .join(", ");
}

function onRemoveReferenceMedia(id) {
  const refs = state.creative.references || [];
  const hit = refs.find((ref) => ref.id === id);
  if (hit?.previewUrl) {
    try {
      URL.revokeObjectURL(hit.previewUrl);
    } catch {
      // no-op: best effort cleanup
    }
  }
  state.creative.references = refs.filter((ref) => ref.id !== id);
  state.flags.creativeBriefReady = false;
  setStatus("info", "Removed reference media.");
  saveCurrentProjectSnapshot();
  persist();
  render();
}

function onPreviewReferenceMedia(id) {
  const ref = (state.creative.references || []).find((item) => item.id === id);
  if (!ref?.previewUrl) {
    setStatus("warning", "Preview is only available for references added in this session.");
    return render();
  }
  window.open(ref.previewUrl, "_blank", "noopener,noreferrer");
}

function onToggleReferenceEligible(id) {
  const refs = (state.creative.references || []).map((ref) => {
    if (ref.id !== id) return ref;
    if (!ref.supportedForSequence) {
      setStatus("warning", `${ref.name} is not in the current xLights-supported media format list. Keeping as inspiration-only.`);
      return { ...ref, sequenceEligible: false };
    }
    return { ...ref, sequenceEligible: !ref.sequenceEligible };
  });
  state.creative.references = refs;
  state.flags.creativeBriefReady = false;
  saveCurrentProjectSnapshot();
  persist();
  render();
}

function addPaletteSwatch() {
  const input = app.querySelector("#palette-color-input");
  const value = String(input?.value || "").trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(value)) {
    setStatus("warning", "Choose a valid hex color.");
    render();
    return;
  }
  const existing = Array.isArray(state.inspiration?.paletteSwatches) ? state.inspiration.paletteSwatches : [];
  if (existing.includes(value)) {
    setStatus("info", "Color already in palette.");
    return;
  }
  state.inspiration.paletteSwatches = [...existing, value];
  saveCurrentProjectSnapshot();
  persist();
  render();
}

function removePaletteSwatch(indexText) {
  const index = Number.parseInt(String(indexText || ""), 10);
  const swatches = Array.isArray(state.inspiration?.paletteSwatches) ? [...state.inspiration.paletteSwatches] : [];
  if (!Number.isFinite(index) || index < 0 || index >= swatches.length) return;
  swatches.splice(index, 1);
  state.inspiration.paletteSwatches = swatches;
  saveCurrentProjectSnapshot();
  persist();
  render();
}

function revokeReferencePreviewUrls() {
  (state.creative.references || []).forEach((ref) => {
    if (!ref?.previewUrl) return;
    try {
      URL.revokeObjectURL(ref.previewUrl);
    } catch {
      // no-op: best effort cleanup
    }
  });
}

function buildCreativeBrief() {
  const audioAnalysis = analyzeAudioContext({
    audioPath: state.audioPathInput,
    sectionSuggestions: state.sectionSuggestions,
    timingTracks: state.timingTracks
  });
  state.audioAnalysis.summary = (audioAnalysis.summaryLines || []).join("\n");
  state.audioAnalysis.lastAnalyzedAt = new Date().toISOString();
  const songContextLine = (audioAnalysis.summaryLines || [])
    .find((line) => String(line || "").toLowerCase().startsWith("song context:"));
  const songContextSummary = songContextLine
    ? String(songContextLine).slice("Song context:".length).trim()
    : "";

  return buildCreativeBriefArtifact({
    requestId: `brief-${Date.now()}`,
    goals: state.creative.goals,
    inspiration: state.creative.inspiration,
    notes: state.creative.notes,
    references: state.creative.references || [],
    audioAnalysis,
    songContextSummary,
    latestIntent: latestUserIntentText(),
    priorBrief: state.creative?.brief || null
  }).brief;
}

function onRunCreativeAnalysis() {
  if (!state.flags.activeSequenceLoaded) {
    setStatus("warning", "Open a sequence before running Creative Analysis.");
    return render();
  }
  state.ui.agentThinking = true;
  addChatMessage("agent", "Running Creative Analysis from kickoff goals, audio context, lyrics context, and references...");
  render();
  Promise.resolve()
    .then(async () => {
      if (String(state.audioPathInput || "").trim()) {
        const analysis = await audioAnalysisPipelineRuntime.runAudioAnalysisPipeline({ refreshTracks: true });
        state.audioAnalysis.summary = String(analysis.summary || state.audioAnalysis.summary || "");
        state.audioAnalysis.lastAnalyzedAt = new Date().toISOString();
        state.audioAnalysis.pipeline = analysis.pipeline || null;
      }
      state.creative.brief = buildCreativeBrief();
      state.creative.briefUpdatedAt = new Date().toISOString();
      state.flags.creativeBriefReady = true;
      setStatus("info", "Creative brief generated. Review and accept to continue.");
    })
    .catch((err) => {
      setStatusWithDiagnostics("warning", `Creative Analysis encountered issues: ${err.message}`);
    })
    .finally(() => {
      state.ui.agentThinking = false;
      saveCurrentProjectSnapshot();
      persist();
      render();
    });
}

function onRegenerateCreativeBrief() {
  onRunCreativeAnalysis();
}

function onAcceptCreativeBrief() {
  if (!state.flags.creativeBriefReady) {
    setStatus("warning", "Generate a creative brief first.");
    return render();
  }
  state.route = "design";
  addChatMessage("agent", "Creative brief accepted. Ready for iterative design changes.");
  setStatus("info", "Creative brief accepted. Continue in Design.");
  saveCurrentProjectSnapshot();
  persist();
  render();
}

function onEditBriefDirection() {
  state.route = "sequence";
  setStatus("info", "Update kickoff goals/inspiration and regenerate Creative Analysis.");
  persist();
  render();
}

function latestUserIntentText() {
  const messages = Array.isArray(state.chat) ? [...state.chat] : [];
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.who === "user" && messages[i]?.text) return String(messages[i].text);
  }
  return "";
}

function buildCurrentDesignSceneContext() {
  return buildDesignSceneContext({
    sceneGraph: state.sceneGraph || {},
    revision: String(state.revision || "unknown")
  });
}

function buildCurrentMusicDesignContext() {
  return buildMusicDesignContext({
    analysisArtifact: state.audioAnalysis?.artifact || null,
    analysisHandoff: agentRuntimeState.getValidHandoff("analysis_handoff_v1")
  });
}

function hasUsableCurrentAudioAnalysis() {
  const currentAudioPath = String(state.audioPathInput || "").trim();
  if (!currentAudioPath) return false;
  const handoffRecord = agentRuntimeState.getValidHandoffRecord("analysis_handoff_v1");
  const handoff = handoffRecord?.payload || null;
  const handoffAudioPath = String(handoffRecord?.context?.audioPath || "").trim();
  const sameTrack = handoffAudioPath && handoffAudioPath === currentAudioPath;
  if (!sameTrack) return false;
  const sections = Array.isArray(handoff?.structure?.sections) ? handoff.structure.sections : [];
  const bpm = Number(handoff?.timing?.bpm);
  return sections.length > 0 || Number.isFinite(bpm);
}

function buildRecentChatHistory(limit = 30) {
  return (Array.isArray(state.chat) ? state.chat : [])
    .filter((m) => m && (m.who === "user" || m.who === "agent"))
    .slice(-limit)
    .map((m) => ({
      role: m.who === "agent" ? "assistant" : "user",
      content: String(m.text || "")
    }));
}

function buildDesignerCloudConversationContext({
  intentText = "",
  selectedSections = [],
  analysisHandoff = null,
  designSceneContext = null,
  musicDesignContext = null
} = {}) {
  const includeDesignerSelection = shouldCarryDesignerSelectionContext(intentText);
  return {
    route: "design",
    projectName: String(state.projectName || "").trim(),
    sequenceName: String(state.sequenceName || "").trim(),
    activeSequenceLoaded: Boolean(state.flags.activeSequenceLoaded),
    selection: {
      sectionNames: selectedSections,
      targetIds: includeDesignerSelection ? normalizeMetadataSelectionIds(state.ui.metadataSelectionIds || []) : [],
      tagNames: includeDesignerSelection ? normalizeMetadataSelectedTags(state.ui.metadataSelectedTags || []) : []
    },
    promptText: String(intentText || "").trim(),
    analysisAvailable: Boolean(analysisHandoff),
    directorProfile: state.directorProfile || null,
    designSceneContext: designSceneContext || null,
    musicDesignContext: musicDesignContext || null,
    targetInventory: {
      groups: Object.keys(state.sceneGraph?.groupsById || {}).slice(0, 200),
      models: (state.models || []).map((row) => String(row?.id || row?.name || "").trim()).filter(Boolean).slice(0, 400),
      submodels: Object.keys(state.sceneGraph?.submodelsById || {}).slice(0, 400)
    }
  };
}

function shouldAutoGenerateProposalFromChatResult(res = {}, raw = "") {
  const routeDecision = String(res?.routeDecision || "").trim();
  if (!(state.flags.activeSequenceLoaded || state.flags.planOnlyMode)) return false;
  const text = String(raw || "").trim().toLowerCase();
  if (!text) return false;

  const explicitGenerateIntent =
    /(generate|draft|proposal|plan|go ahead|proceed|show me a draft|build a draft|put together a pass|make a pass)/.test(text);
  const explicitTechnicalIntent =
    /(apply|change|add|remove|reduce|increase|adjust|revise|rework|update|set|turn|put)\b/.test(text);
  const isBroadCreativeKickoff =
    routeDecision === "designer_dialog" &&
    /(i want|i'd like|it should feel|this should feel|feel|mood|nostalg|cinematic|warm|cool|magical|welcoming|story|inspiration)/.test(text) &&
    !explicitGenerateIntent &&
    !explicitTechnicalIntent;
  const hasExistingDesignContext =
    Boolean(state.creative?.brief?.summary) ||
    Boolean(state.creative?.proposalBundle?.summary) ||
    Array.isArray(state.proposed) && state.proposed.length > 0;

  if (Boolean(res?.shouldGenerateProposal)) {
    if (routeDecision === "sequence_agent") return true;
    if (routeDecision === "designer_dialog") {
      if (explicitGenerateIntent) return true;
      if (hasExistingDesignContext && !isBroadCreativeKickoff) return true;
      return false;
    }
    return false;
  }
  if (!["designer_dialog", "sequence_agent"].includes(routeDecision)) return false;
  const isQuestionOnly = /^(can you|could you|would you|will you|do you|does this|is this|what|why|how)\b/.test(text)
    && !/(apply|change|make|add|remove|reduce|increase|adjust|revise|rework|update|set|turn|put)\b/.test(text);
  if (isQuestionOnly) return false;
  if (routeDecision === "designer_dialog") {
    if (explicitGenerateIntent) return true;
    return hasExistingDesignContext && explicitTechnicalIntent && !isBroadCreativeKickoff;
  }
  return explicitTechnicalIntent;
}

function shouldAutoRunAudioAnalysisFromChatResult(res = {}, raw = "") {
  const routeDecision = String(res?.routeDecision || "").trim();
  const hasAudioPath = Boolean(String(state.audioPathInput || "").trim());
  if (!hasAudioPath) return false;
  const text = String(raw || "").trim().toLowerCase();
  if (!text) return false;
  if (routeDecision === "designer_dialog") {
    const hasSequenceContext =
      Boolean(String(state.sequencePathInput || "").trim()) ||
      Boolean(state.flags.activeSequenceLoaded) ||
      Boolean(state.flags.planOnlyMode);
    if (!hasSequenceContext || hasUsableCurrentAudioAnalysis()) return false;
    return shouldAutoGenerateProposalFromChatResult(res, raw);
  }
  if (routeDecision !== "audio_analyst") return false;
  const explicitRerun = /(re-?analy|analyze again|run analysis|refresh the beat map|refresh analysis|rerun)/.test(text);
  if (explicitRerun) return true;
  return !hasUsableCurrentAudioAnalysis() &&
    /(analyz|analysis|main sections|section|beat map|beats|bars|lift|hold back|open up|chorus|verse|bridge)/.test(text);
}

function formatAudioSectionStart(section = {}) {
  const startMs = Number(section?.startMs);
  if (!Number.isFinite(startMs) || startMs < 0) return "";
  const totalSeconds = Math.floor(startMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function buildAudioAnalystChatReply(userPrompt = "", handoff = {}) {
  const text = String(userPrompt || "").trim().toLowerCase();
  const structureRows = Array.isArray(handoff?.structure?.sections) ? handoff.structure.sections : [];
  const sectionLabels = structureRows
    .map((row) => String(row?.label || row?.name || "").trim())
    .filter(Boolean);
  const timing = handoff?.timing || {};
  const bpm = Number(timing?.bpm);
  const signature = String(timing?.timeSignature || "").trim();

  if (/main sections|where.*sections|tell me where the main sections are|what.*sections/.test(text)) {
    if (!structureRows.length) {
      return "I finished the analysis, but I still do not have usable section markers for this track.";
    }
    const parts = structureRows.slice(0, 8).map((row) => {
      const label = String(row?.label || row?.name || "").trim() || "Section";
      const start = formatAudioSectionStart(row);
      return start ? `${label} at ${start}` : label;
    });
    return `The main sections I found are ${parts.join(", ")}.`;
  }

  if (/first real lift|where does the first lift happen|first lift/.test(text)) {
    const lift = structureRows.find((row) => /chorus|bridge|hook/i.test(String(row?.label || row?.name || "").trim()));
    if (lift) {
      const label = String(lift?.label || lift?.name || "").trim() || "the first lift";
      const start = formatAudioSectionStart(lift);
      return start
        ? `The first real lift looks like ${label}, starting around ${start}.`
        : `The first real lift looks like ${label}.`;
    }
    return "I finished the analysis, but I do not have a clear lift marker yet.";
  }

  if (/hold back|open up|hold vs open|where.*hold|where.*open/.test(text)) {
    const hold = structureRows.find((row) => /intro|verse/i.test(String(row?.label || row?.name || "").trim()));
    const open = structureRows.find((row) => /chorus|bridge|hook/i.test(String(row?.label || row?.name || "").trim()));
    const clauses = [];
    if (hold) {
      const holdLabel = String(hold?.label || hold?.name || "").trim();
      const holdStart = formatAudioSectionStart(hold);
      clauses.push(holdStart ? `hold back through ${holdLabel} starting around ${holdStart}` : `hold back through ${holdLabel}`);
    }
    if (open) {
      const openLabel = String(open?.label || open?.name || "").trim();
      const openStart = formatAudioSectionStart(open);
      clauses.push(openStart ? `open up at ${openLabel} around ${openStart}` : `open up at ${openLabel}`);
    }
    if (clauses.length) {
      return `From the structure I found, I would ${clauses.join(", and ")}.`;
    }
  }

  const summaryBits = [];
  if (sectionLabels.length) summaryBits.push(`${sectionLabels.length} main sections`);
  if (Number.isFinite(bpm)) summaryBits.push(`${bpm} BPM`);
  if (signature) summaryBits.push(signature);
  if (summaryBits.length) {
    return `I finished the analysis and found ${summaryBits.join(", ")}.`;
  }
  return "I finished the analysis and updated the song structure for the team.";
}

function shouldAnswerAudioFromExistingAnalysis(res = {}, raw = "") {
  const routeDecision = String(res?.routeDecision || "").trim();
  if (routeDecision !== "audio_analyst") return false;
  const analysis = agentRuntimeState.getValidHandoff("analysis_handoff_v1");
  if (!hasUsableCurrentAudioAnalysis() || !analysis) {
    return false;
  }
  const text = String(raw || "").trim().toLowerCase();
  if (!text) return false;
  const explicitGenerateIntent =
    /(generate|draft|proposal|plan|go ahead|proceed|show me a draft|build a draft|put together a pass|make a pass)/.test(text);
  const explicitTechnicalIntent =
    /(apply|change|add|remove|reduce|increase|adjust|revise|rework|update|set|turn|put)\b/.test(text);
  if (explicitGenerateIntent || explicitTechnicalIntent) {
    return false;
  }
  if (/(re-?analy|analyze again|run analysis|refresh the beat map|refresh analysis|rerun)/.test(text)) {
    return false;
  }
  return /(main sections|section|first real lift|first lift|hold back|open up|chorus|verse|bridge|where does|tell me where)/.test(text);
}

function collectCurrentDesignIds() {
  const ids = new Set();
  const candidatePlans = [
    state.creative?.proposalBundle?.executionPlan,
    state.creative?.intentHandoff?.executionStrategy
  ];
  for (const plan of candidatePlans) {
    if (!plan || typeof plan !== "object") continue;
    for (const row of Array.isArray(plan.sectionPlans) ? plan.sectionPlans : []) {
      const designId = String(row?.designId || "").trim();
      if (designId) ids.add(designId);
    }
    for (const row of Array.isArray(plan.effectPlacements) ? plan.effectPlacements : []) {
      const designId = String(row?.designId || "").trim();
      if (designId) ids.add(designId);
    }
  }
  return [...ids];
}

function seedTechnicalIntentHandoffFromChatPrompt(promptText = "", producer = "app_assistant") {
  const analysisHandoff = agentRuntimeState.getValidHandoff("analysis_handoff_v1");
  const explicitSections = hasAllSectionsSelected()
    ? getSectionChoiceList()
    : getSelectedSections().filter((s) => s !== "all");
  const directIntent = executeDirectSequenceRequestOrchestration({
    requestId: `chat-intent-${Date.now()}`,
    sequenceRevision: String(state.draftBaseRevision || state.revision || "unknown"),
    promptText: String(promptText || ""),
    selectedSections: explicitSections,
    selectedTagNames: state.ui.metadataSelectedTags || [],
    selectedTargetIds: state.ui.metadataSelectionIds || [],
    analysisHandoff,
    models: state.models || [],
    submodels: state.submodels || [],
    displayElements: state.displayElements || [],
    effectCatalog: state.effectCatalog,
    metadataAssignments: buildEffectiveMetadataAssignments(),
    existingDesignIds: collectCurrentDesignIds(),
    elevatedRiskConfirmed: Boolean(state.ui.applyApprovalChecked)
  });
  if (!directIntent?.ok || !isPlainObject(directIntent.intentHandoff)) {
    return { ok: false, directIntent };
  }
  state.creative = state.creative || {};
  state.creative.intentHandoff = structuredClone(directIntent.intentHandoff);
  return agentRuntimeState.setAgentHandoff("intent_handoff_v1", directIntent.intentHandoff, producer);
}

function shouldContinueToProposalAfterAudio(res = {}, raw = "") {
  const hasSequenceContext =
    Boolean(String(state.sequencePathInput || "").trim()) ||
    Boolean(state.flags.activeSequenceLoaded) ||
    Boolean(state.flags.planOnlyMode);
  if (!hasSequenceContext) return false;
  const text = String(raw || "").trim().toLowerCase();
  if (!text) return false;

  const explicitGenerateIntent =
    /(generate|draft|proposal|plan|go ahead|proceed|show me a draft|build a draft|put together a pass|make a pass)/.test(text);
  const explicitTechnicalIntent =
    /(apply|change|add|remove|reduce|increase|adjust|revise|rework|update|set|turn|put)\b/.test(text);
  const isQuestionOnly =
    /^(can you|could you|would you|will you|do you|does this|is this|what|why|how|where does|tell me where)\b/.test(text) &&
    !explicitTechnicalIntent &&
    !explicitGenerateIntent;
  if (isQuestionOnly) return false;

  if (explicitTechnicalIntent) return true;

  const addressedTo = String(res?.addressedTo || "").trim();
  const routeDecision = String(res?.routeDecision || "").trim();
  const proposalRole = ["designer_dialog", "sequence_agent"].includes(addressedTo)
    ? addressedTo
    : (["designer_dialog", "sequence_agent"].includes(routeDecision) ? routeDecision : "");

  if (proposalRole === "sequence_agent") return explicitGenerateIntent;
  if (proposalRole === "designer_dialog") return explicitGenerateIntent;
  return explicitGenerateIntent && Boolean(res?.shouldGenerateProposal);
}

function inferAudioContinuationProposalRole(res = {}) {
  const addressedTo = String(res?.addressedTo || "").trim();
  if (["designer_dialog", "sequence_agent"].includes(addressedTo)) return addressedTo;
  const routeDecision = String(res?.routeDecision || "").trim();
  if (["designer_dialog", "sequence_agent"].includes(routeDecision)) return routeDecision;
  return "sequence_agent";
}

function inferProposalLinesFromIntent(intentText, sections = []) {
  const text = String(intentText || "").trim();
  const normalized = text.toLowerCase();
  const scoped = Array.isArray(sections) && sections.length > 0 ? sections.slice(0, 3) : [];
  const lines = [];

  if (normalized.includes("background")) {
    if (normalized.includes("star") || normalized.includes("magic")) {
      lines.push("Add gentle twinkle texture to background props for a starry-night feel");
    } else {
      lines.push("Increase ambient motion and color texture on background props");
    }
  }

  if (normalized.includes("magic") && !lines.length) {
    lines.push("Introduce soft shimmer accents and subtle sparkle layers for a magical atmosphere");
  }

  if (normalized.includes("twinkle")) {
    lines.push(normalized.includes("reduce")
      ? "Reduce twinkle density and brightness to keep detail without visual noise"
      : "Add controlled twinkle accents to emphasize depth and movement");
  }

  if (normalized.includes("energy")) {
    lines.push(normalized.includes("high") || normalized.includes("increase")
      ? "Raise contrast and motion pacing in target moments to increase perceived energy"
      : "Balance motion pacing to keep energy controlled and musical");
  }

  if (!lines.length && text) {
    lines.push(`Translate intent into focused design updates: ${text}`);
    lines.push("Keep existing successful moments and adjust only inferred target regions");
  }

  if (!lines.length) {
    lines.push("Refine sequence with balanced motion, palette cohesion, and cleaner transitions");
  }

  if (scoped.length) {
    lines.push(`Prioritize updates in loaded XD labels: ${scoped.join(", ")}`);
  }

  return lines.slice(0, 5);
}

function isStructuredSequencingProposalLine(line = "") {
  const text = String(line || "").trim();
  if (!text) return false;
  return /^[^/]+\s*\/\s*[^/]+\s*\/.+/.test(text);
}

function shouldUseExecutionStrategySeedLines({ directSequenceMode = false, proposalOrchestration = null } = {}) {
  if (directSequenceMode) return false;
  const bundle = proposalOrchestration?.proposalBundle && typeof proposalOrchestration.proposalBundle === "object"
    ? proposalOrchestration.proposalBundle
    : null;
  const executionPlan = bundle?.executionPlan && typeof bundle.executionPlan === "object"
    ? bundle.executionPlan
    : null;
  const passScope = String(executionPlan?.passScope || "").trim();
  const sectionPlans = Array.isArray(executionPlan?.sectionPlans) ? executionPlan.sectionPlans.filter(Boolean) : [];
  const proposalLines = Array.isArray(proposalOrchestration?.proposalLines) ? proposalOrchestration.proposalLines.filter(Boolean) : [];
  if (!sectionPlans.length) return false;
  if (!(passScope === "whole_sequence" || passScope === "multi_section")) return false;
  return !proposalLines.length || proposalLines.some((line) => !isStructuredSequencingProposalLine(line));
}

function buildDesignerExecutionSeedLines(proposalOrchestration = null) {
  const bundle = proposalOrchestration?.proposalBundle && typeof proposalOrchestration.proposalBundle === "object"
    ? proposalOrchestration.proposalBundle
    : null;
  const executionPlan = bundle?.executionPlan && typeof bundle.executionPlan === "object"
    ? bundle.executionPlan
    : null;
  const passScope = String(executionPlan?.passScope || "").trim();
  const sectionPlans = Array.isArray(executionPlan?.sectionPlans) ? executionPlan.sectionPlans.filter(Boolean) : [];
  const fallbackTargets = Array.isArray(bundle?.scope?.targetIds) ? bundle.scope.targetIds.filter(Boolean) : [];
  if (!(passScope === "whole_sequence" || passScope === "multi_section")) return [];
  return sectionPlans
    .map((row) => {
      const section = String(row?.section || "").trim();
      const targetIds = Array.isArray(row?.targetIds) ? row.targetIds.filter(Boolean) : [];
      const targetText = (targetIds.length ? targetIds : fallbackTargets).slice(0, 8).join(' + ').trim() || 'General';
      const summary = String(row?.intentSummary || '').trim();
      if (!section || !summary) return '';
      return `${section} / ${targetText} / ${summary}`;
    })
    .filter(Boolean);
}

function buildDesignDisplay(designId = "", designRevision = 0) {
  const raw = String(designId || "").trim();
  const revision = Number.isInteger(Number(designRevision)) ? Number(designRevision) : 0;
  const desMatch = raw.match(/^DES-(\d+)$/i);
  if (desMatch) return `D${Number(desMatch[1])}.${revision}`;
  const dMatch = raw.match(/^D(\d+)$/i);
  if (dMatch) return `D${Number(dMatch[1])}.${revision}`;
  return raw || "";
}

function getExecutionPlanFromArtifacts({
  proposalBundle = null,
  intentHandoff = null
} = {}) {
  if (proposalBundle?.executionPlan && typeof proposalBundle.executionPlan === "object") {
    return proposalBundle.executionPlan;
  }
  if (intentHandoff?.executionStrategy && typeof intentHandoff.executionStrategy === "object") {
    return intentHandoff.executionStrategy;
  }
  return null;
}

function upsertSupersededConceptRecord(record = null) {
  if (!record || typeof record !== "object") return;
  state.creative = state.creative || {};
  const current = Array.isArray(state.creative.supersededConcepts) ? state.creative.supersededConcepts : [];
  const next = current.filter((entry) => !(
    String(entry?.designId || "").trim() === String(record.designId || "").trim() &&
    Number(entry?.designRevision || 0) === Number(record.designRevision || 0)
  ));
  next.push(record);
  state.creative.supersededConcepts = next;
}

function buildSupersededConceptRecordById(designId = "", supersededByRevision = 0) {
  const normalizedDesignId = String(designId || "").trim();
  if (!normalizedDesignId) return null;
  const proposalBundle = state.creative?.proposalBundle && typeof state.creative.proposalBundle === "object"
    ? state.creative.proposalBundle
    : null;
  const intentHandoff = state.creative?.intentHandoff && typeof state.creative.intentHandoff === "object"
    ? state.creative.intentHandoff
    : null;
  const executionPlan = getExecutionPlanFromArtifacts({ proposalBundle, intentHandoff });
  if (!executionPlan) return null;
  const sectionPlans = (Array.isArray(executionPlan.sectionPlans) ? executionPlan.sectionPlans : [])
    .filter((row) => String(row?.designId || "").trim() === normalizedDesignId);
  const effectPlacements = (Array.isArray(executionPlan.effectPlacements) ? executionPlan.effectPlacements : [])
    .filter((row) => String(row?.designId || "").trim() === normalizedDesignId);
  if (!sectionPlans.length && !effectPlacements.length) return null;
  const currentRevision = Math.max(
    0,
    ...sectionPlans.map((row) => Number.isInteger(Number(row?.designRevision)) ? Number(row.designRevision) : 0),
    ...effectPlacements.map((row) => Number.isInteger(Number(row?.designRevision)) ? Number(row.designRevision) : 0)
  );
  const sections = Array.from(new Set(sectionPlans.map((row) => String(row?.section || "").trim()).filter(Boolean)));
  const targetIds = Array.from(new Set([
    ...sectionPlans.flatMap((row) => Array.isArray(row?.targetIds) ? row.targetIds : []),
    ...effectPlacements.map((row) => String(row?.targetId || "").trim()).filter(Boolean)
  ]));
  const effectNames = Array.from(new Set(effectPlacements.map((row) => String(row?.effectName || "").trim()).filter(Boolean)));
  return {
    designId: normalizedDesignId,
    designRevision: currentRevision,
    designAuthor: String(sectionPlans[0]?.designAuthor || effectPlacements[0]?.designAuthor || "designer").trim() || "designer",
    designLabel: buildDesignDisplay(normalizedDesignId, currentRevision),
    revisionState: "superseded",
    supersededByRevision: Number.isInteger(Number(supersededByRevision)) ? Number(supersededByRevision) : currentRevision + 1,
    sections,
    targetIds,
    effectNames,
    summary: String(
      sectionPlans.map((row) => String(row?.intentSummary || "").trim()).find(Boolean)
      || effectPlacements.map((row) => String(row?.creativeRole || "").trim()).find(Boolean)
      || "Superseded design concept"
    ).trim(),
    placementCount: effectPlacements.length,
    supersededAt: new Date().toISOString()
  };
}

function clearDesignRevisionTarget() {
  state.ui.designRevisionTarget = null;
}

function clearSequenceDesignFilter() {
  state.ui.sequenceDesignFilterId = "";
}

function buildDesignRevisionTargetById(designId = "") {
  const normalizedDesignId = String(designId || "").trim();
  if (!normalizedDesignId) return null;
  const proposalBundle = state.creative?.proposalBundle && typeof state.creative.proposalBundle === "object"
    ? state.creative.proposalBundle
    : null;
  const intentHandoff = state.creative?.intentHandoff && typeof state.creative.intentHandoff === "object"
    ? state.creative.intentHandoff
    : null;
  const executionPlan = getExecutionPlanFromArtifacts({ proposalBundle, intentHandoff });
  if (!executionPlan) return null;

  const sectionPlans = (Array.isArray(executionPlan.sectionPlans) ? executionPlan.sectionPlans : [])
    .filter((row) => String(row?.designId || "").trim() === normalizedDesignId);
  const effectPlacements = (Array.isArray(executionPlan.effectPlacements) ? executionPlan.effectPlacements : [])
    .filter((row) => String(row?.designId || "").trim() === normalizedDesignId);
  if (!sectionPlans.length && !effectPlacements.length) return null;

  const currentRevision = Math.max(
    0,
    ...sectionPlans.map((row) => Number.isInteger(Number(row?.designRevision)) ? Number(row.designRevision) : 0),
    ...effectPlacements.map((row) => Number.isInteger(Number(row?.designRevision)) ? Number(row.designRevision) : 0)
  );
  const designAuthor = String(sectionPlans[0]?.designAuthor || effectPlacements[0]?.designAuthor || "designer").trim() || "designer";
  const sections = Array.from(new Set([
    ...sectionPlans.map((row) => String(row?.section || "").trim()).filter(Boolean),
    ...effectPlacements
      .map((row) => String(row?.timingContext?.anchorLabel || row?.timingContext?.section || "").trim())
      .filter(Boolean)
  ]));
  const targetIds = Array.from(new Set([
    ...sectionPlans.flatMap((row) => Array.isArray(row?.targetIds) ? row.targetIds : []),
    ...effectPlacements.map((row) => String(row?.targetId || "").trim()).filter(Boolean)
  ]));
  const summary = String(
    sectionPlans.map((row) => String(row?.intentSummary || "").trim()).find(Boolean)
      || effectPlacements.map((row) => String(row?.creativeRole || "").trim()).find(Boolean)
      || "Revise current design concept"
  ).trim();
  return normalizeDesignRevisionTarget({
    designId: normalizedDesignId,
    designRevision: currentRevision + 1,
    priorDesignRevision: currentRevision,
    designAuthor,
    sections,
    targetIds,
    summary,
    designLabel: buildDesignDisplay(normalizedDesignId, currentRevision + 1),
    requestedAt: new Date().toISOString()
  });
}

function buildRevisionPromptText(promptText = "", revisionTarget = null) {
  const normalizedTarget = normalizeDesignRevisionTarget(revisionTarget);
  const rawPrompt = String(promptText || "").trim();
  if (!normalizedTarget) return rawPrompt;
  const sectionText = normalizedTarget.sections.length ? normalizedTarget.sections.join(", ") : "current concept scope";
  const targetText = normalizedTarget.targetIds.length ? normalizedTarget.targetIds.slice(0, 6).join(", ") : "current concept targets";
  const prefix = `Revise existing design concept ${buildDesignDisplay(normalizedTarget.designId, normalizedTarget.priorDesignRevision)} in place. Keep the same concept identity and limit changes to sections ${sectionText} and targets ${targetText}.`;
  return rawPrompt ? `${prefix} ${rawPrompt}` : prefix;
}

function applyRevisionTargetToOrchestration(proposalOrchestration = null, revisionTarget = null) {
  const normalizedTarget = normalizeDesignRevisionTarget(revisionTarget);
  if (!proposalOrchestration || typeof proposalOrchestration !== "object" || !normalizedTarget) return proposalOrchestration;

  const currentBundle = state.creative?.proposalBundle && typeof state.creative.proposalBundle === "object"
    ? state.creative.proposalBundle
    : null;
  const currentIntentHandoff = state.creative?.intentHandoff && typeof state.creative.intentHandoff === "object"
    ? state.creative.intentHandoff
    : null;
  const currentExecutionPlan = getExecutionPlanFromArtifacts({ proposalBundle: currentBundle, intentHandoff: currentIntentHandoff });
  const revisedExecutionPlan = getExecutionPlanFromArtifacts({
    proposalBundle: proposalOrchestration.proposalBundle,
    intentHandoff: proposalOrchestration.intentHandoff
  });
  const mergedExecutionPlan = mergeRevisedDesignConceptExecutionPlan({
    currentExecutionPlan,
    revisedExecutionPlan,
    revisionTarget: normalizedTarget
  });
  if (!mergedExecutionPlan) return proposalOrchestration;

  const baseBundle = currentBundle || proposalOrchestration.proposalBundle || null;
  const rebuiltBundle = rebuildProposalBundleFromExecutionPlan(
    {
      ...(baseBundle && typeof baseBundle === "object" ? baseBundle : {}),
      ...(proposalOrchestration.proposalBundle && typeof proposalOrchestration.proposalBundle === "object"
        ? proposalOrchestration.proposalBundle
        : {}),
      executionPlan: mergedExecutionPlan
    },
    mergedExecutionPlan
  );
  if (!rebuiltBundle) return proposalOrchestration;

  return {
    ...proposalOrchestration,
    proposalBundle: rebuiltBundle,
    proposalLines: Array.isArray(rebuiltBundle.proposalLines) ? rebuiltBundle.proposalLines : [],
    intentHandoff: {
      ...(proposalOrchestration.intentHandoff && typeof proposalOrchestration.intentHandoff === "object"
        ? proposalOrchestration.intentHandoff
        : {}),
      designId: normalizedTarget.designId,
      designRevision: normalizedTarget.designRevision,
      designAuthor: normalizedTarget.designAuthor,
      executionStrategy: mergedExecutionPlan
    },
    summary: String(proposalOrchestration.summary || `Revised ${buildDesignDisplay(normalizedTarget.designId, normalizedTarget.designRevision)}.`).trim()
  };
}

function ensureRevisionTargetAppliedToOrchestration(proposalOrchestration = null, revisionTarget = null) {
  const normalizedTarget = normalizeDesignRevisionTarget(revisionTarget);
  if (!proposalOrchestration || typeof proposalOrchestration !== "object" || !normalizedTarget) return proposalOrchestration;
  const executionPlan = getExecutionPlanFromArtifacts({
    proposalBundle: proposalOrchestration.proposalBundle,
    intentHandoff: proposalOrchestration.intentHandoff
  });
  if (!executionPlan) return proposalOrchestration;

  const retagRow = (row = {}) => {
    if (String(row?.designId || "").trim() !== normalizedTarget.designId) return row;
    return {
      ...row,
      designId: normalizedTarget.designId,
      designRevision: normalizedTarget.designRevision,
      designAuthor: normalizedTarget.designAuthor
    };
  };

  const normalizedExecutionPlan = {
    ...executionPlan,
    designId: normalizedTarget.designId,
    designRevision: normalizedTarget.designRevision,
    designAuthor: normalizedTarget.designAuthor,
    sectionPlans: (Array.isArray(executionPlan.sectionPlans) ? executionPlan.sectionPlans : []).map(retagRow),
    effectPlacements: (Array.isArray(executionPlan.effectPlacements) ? executionPlan.effectPlacements : []).map(retagRow)
  };
  const rebuiltBundle = proposalOrchestration.proposalBundle
    ? rebuildProposalBundleFromExecutionPlan(proposalOrchestration.proposalBundle, normalizedExecutionPlan)
    : null;

  return {
    ...proposalOrchestration,
    proposalBundle: rebuiltBundle || proposalOrchestration.proposalBundle || null,
    proposalLines: Array.isArray(rebuiltBundle?.proposalLines)
      ? rebuiltBundle.proposalLines
      : (Array.isArray(proposalOrchestration.proposalLines) ? proposalOrchestration.proposalLines : []),
    intentHandoff: {
      ...(proposalOrchestration.intentHandoff && typeof proposalOrchestration.intentHandoff === "object"
        ? proposalOrchestration.intentHandoff
        : {}),
      designId: normalizedTarget.designId,
      designRevision: normalizedTarget.designRevision,
      designAuthor: normalizedTarget.designAuthor,
      executionStrategy: normalizedExecutionPlan
    }
  };
}

function retagExecutionPlanForRevisionTarget(executionPlan = null, revisionTarget = null) {
  const normalizedTarget = normalizeDesignRevisionTarget(revisionTarget);
  const plan = executionPlan && typeof executionPlan === "object" ? executionPlan : null;
  if (!normalizedTarget || !plan) return plan;
  const retagRow = (row = {}) => {
    if (String(row?.designId || "").trim() !== normalizedTarget.designId) return row;
    return {
      ...row,
      designId: normalizedTarget.designId,
      designRevision: normalizedTarget.designRevision,
      designAuthor: normalizedTarget.designAuthor
    };
  };
  return {
    ...plan,
    designId: normalizedTarget.designId,
    designRevision: normalizedTarget.designRevision,
    designAuthor: normalizedTarget.designAuthor,
    sectionPlans: (Array.isArray(plan.sectionPlans) ? plan.sectionPlans : []).map(retagRow),
    effectPlacements: (Array.isArray(plan.effectPlacements) ? plan.effectPlacements : []).map(retagRow)
  };
}

function applyRevisionTargetToCurrentDesignerState(revisionTarget = null) {
  const normalizedTarget = normalizeDesignRevisionTarget(revisionTarget);
  if (!normalizedTarget) return;
  const currentBundle = state.creative?.proposalBundle && typeof state.creative.proposalBundle === "object"
    ? state.creative.proposalBundle
    : null;
  const currentIntentHandoff = state.creative?.intentHandoff && typeof state.creative.intentHandoff === "object"
    ? state.creative.intentHandoff
    : null;
  const executionPlan = retagExecutionPlanForRevisionTarget(
    getExecutionPlanFromArtifacts({ proposalBundle: currentBundle, intentHandoff: currentIntentHandoff }),
    normalizedTarget
  );
  if (!executionPlan) return;
  if (currentBundle) {
    const rebuiltBundle = rebuildProposalBundleFromExecutionPlan(currentBundle, executionPlan);
    if (rebuiltBundle) {
      state.creative.proposalBundle = rebuiltBundle;
      if (Array.isArray(rebuiltBundle.proposalLines)) {
        state.proposed = [...rebuiltBundle.proposalLines];
      }
    }
  }
  if (currentIntentHandoff) {
    state.creative.intentHandoff = {
      ...currentIntentHandoff,
      designId: normalizedTarget.designId,
      designRevision: normalizedTarget.designRevision,
      designAuthor: normalizedTarget.designAuthor,
      executionStrategy: executionPlan
    };
  }
}

function filterDesignerExecutionPlanByDesignId(executionPlan = null, designId = "") {
  const normalizedDesignId = String(designId || "").trim();
  if (!normalizedDesignId || !executionPlan || typeof executionPlan !== "object") return null;
  const sectionPlans = Array.isArray(executionPlan.sectionPlans)
    ? executionPlan.sectionPlans.filter((row) => String(row?.designId || "").trim() !== normalizedDesignId)
    : [];
  const effectPlacements = Array.isArray(executionPlan.effectPlacements)
    ? executionPlan.effectPlacements.filter((row) => String(row?.designId || "").trim() !== normalizedDesignId)
    : [];
  const primarySections = sectionPlans
    .map((row) => String(row?.section || "").trim())
    .filter(Boolean);
  const targetIds = Array.from(new Set(
    sectionPlans.flatMap((row) => Array.isArray(row?.targetIds) ? row.targetIds : [])
      .map((row) => String(row || "").trim())
      .filter(Boolean)
  ));
  return {
    ...executionPlan,
    sectionPlans,
    effectPlacements,
    primarySections,
    sectionCount: primarySections.length,
    targetCount: targetIds.length
  };
}

function rebuildProposalBundleFromExecutionPlan(proposalBundle = null, executionPlan = null) {
  const bundle = proposalBundle && typeof proposalBundle === "object" ? proposalBundle : null;
  const plan = executionPlan && typeof executionPlan === "object" ? executionPlan : null;
  if (!bundle || !plan) return null;
  const proposalLines = mergeCreativeBriefIntoProposal(
    buildDesignerExecutionSeedLines({
      proposalBundle: {
        ...bundle,
        executionPlan: plan
      }
    })
  );
  return {
    ...bundle,
    executionPlan: plan,
    proposalLines,
    impact: {
      ...(bundle.impact && typeof bundle.impact === "object" ? bundle.impact : {}),
      estimatedImpact: Math.max(proposalLines.length * 8, Array.isArray(plan.effectPlacements) ? plan.effectPlacements.length : 0)
    }
  };
}

function rebuildSequenceAgentStateFromCurrentIntent() {
  const analysisHandoff = agentRuntimeState.getValidHandoff("analysis_handoff_v1");
  let intentHandoff = state.creative?.intentHandoff && typeof state.creative.intentHandoff === "object"
    ? state.creative.intentHandoff
    : agentRuntimeState.getValidHandoff("intent_handoff_v1");
  intentHandoff = hydrateIntentHandoffExecutionStrategy(intentHandoff, state.creative?.proposalBundle || null);
  if (!intentHandoff) return { ok: false, reason: "missing_intent_handoff" };

  const sequencerPlan = buildSequenceAgentPlan({
    analysisHandoff,
    intentHandoff,
    sourceLines: Array.isArray(state.proposed) ? state.proposed : [],
    baseRevision: state.draftBaseRevision,
    capabilityCommands: state.health.capabilityCommands || [],
    effectCatalog: state.effectCatalog,
    sequenceSettings: state.sequenceSettings,
    layoutMode: currentLayoutMode(),
    displayElements: state.displayElements,
    groupIds: Object.keys(state.sceneGraph?.groupsById || {}),
    groupsById: state.sceneGraph?.groupsById || {},
    submodelsById: state.sceneGraph?.submodelsById || {},
    timingOwnership: getSequenceTimingOwnershipRows(),
    metadataAssignments: buildEffectiveMetadataAssignments(),
    allowTimingWrites: true
  });
  const planGate = validateSequenceAgentContractGate("plan", sequencerPlan, "design-id-rebuild");
  if (!planGate.ok) return { ok: false, reason: planGate.report.errors.join("; ") };

  state.creative.intentHandoff = intentHandoff;
  state.agentPlan = {
    createdAt: new Date().toISOString(),
    source: "sequence_agent",
    handoff: sequencerPlan,
    executionLines: Array.isArray(sequencerPlan?.executionLines) ? sequencerPlan.executionLines : []
  };
  agentRuntimeState.setAgentHandoff("intent_handoff_v1", intentHandoff, "designer_dialog");
  agentRuntimeState.setAgentHandoff("plan_handoff_v1", sequencerPlan, "sequence_agent");
  return { ok: true };
}

function mergeCreativeBriefIntoProposal(lines) {
  const base = Array.isArray(lines) ? [...lines] : [];
  if (base.some((row) => /\/\s+apply\s+.+\s+effect\b/i.test(String(row || "")))) {
    return base.slice(0, 6);
  }
  if (!state.flags.creativeBriefReady || !state.creative?.brief) return base;
  const brief = state.creative.brief;
  const additions = [];
  const goalsSummary = String(brief.goalsSummary || "").trim();
  const visualCues = String(brief.visualCues || "").trim();
  const sections = Array.isArray(brief.sections) ? brief.sections.map((row) => String(row || "").trim()).filter(Boolean) : [];

  if (goalsSummary && !/^no explicit goals captured\.?$/i.test(goalsSummary)) {
    additions.push(`Anchor design changes to brief goal: ${goalsSummary}`);
  }
  if (visualCues && !/^no uploaded references\.?$/i.test(visualCues)) {
    additions.push(`Use visual direction cues: ${visualCues}`);
  }
  if (sections.length && sections.join(", ").toLowerCase() !== "intro, verse, chorus") {
    additions.push(`Focus first pass on brief sections: ${sections.slice(0, 3).join(", ")}`);
  }

  return [...additions, ...base].filter(Boolean).slice(0, 6);
}

function onShowMoreProposed() {
  const current = Number.isFinite(Number(state.ui.proposedRowsVisible))
    ? Number(state.ui.proposedRowsVisible)
    : DEFAULT_PROPOSED_ROWS;
  state.ui.proposedRowsVisible = Math.max(DEFAULT_PROPOSED_ROWS, current + PROPOSED_ROWS_STEP);
  persist();
  render();
}

function onShowLessProposed() {
  state.ui.proposedRowsVisible = DEFAULT_PROPOSED_ROWS;
  persist();
  render();
}

function sanitizeProposedSelection() {
  const valid = new Set(
    (state.proposed || [])
      .map((_, idx) => idx)
  );
  state.ui.proposedSelection = (state.ui.proposedSelection || [])
    .map((idx) => Number.parseInt(idx, 10))
    .filter((idx) => Number.isInteger(idx) && valid.has(idx));
}

function toggleProposedSelection(index) {
  const idx = Number.parseInt(index, 10);
  if (!Number.isInteger(idx) || idx < 0 || idx >= state.proposed.length) return;
  const selected = new Set(state.ui.proposedSelection || []);
  if (selected.has(idx)) selected.delete(idx);
  else selected.add(idx);
  state.ui.proposedSelection = Array.from(selected).sort((a, b) => a - b);
  invalidateApplyApproval();
  persist();
  render();
}

function toggleProposedSelectionGroup(serializedIndexes = "") {
  const indexes = String(serializedIndexes || "")
    .split(",")
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isInteger(value) && value >= 0 && value < state.proposed.length);
  if (!indexes.length) return;
  const selected = new Set(state.ui.proposedSelection || []);
  const allSelected = indexes.every((idx) => selected.has(idx));
  if (allSelected) {
    for (const idx of indexes) selected.delete(idx);
  } else {
    for (const idx of indexes) selected.add(idx);
  }
  state.ui.proposedSelection = Array.from(selected).sort((a, b) => a - b);
  invalidateApplyApproval();
  persist();
  render();
}

function modelStableId(model) {
  const raw = model?.id ?? model?.modelId ?? model?.name ?? "";
  return String(raw || "");
}

function modelDisplayName(model) {
  const name = model?.name || "(unnamed)";
  const type = model?.type ? ` (${model.type})` : "";
  return `${name}${type}`;
}

function normalizeElementType(type) {
  const raw = String(type || "").trim();
  if (!raw) return "";
  if (raw === "ModelGroup") return "group";
  return raw.toLowerCase();
}

function isModelInUnassignedPreview(model) {
  const attrs = isPlainObject(model?.attributes) ? model.attributes : {};
  const layoutGroup = String(model?.layoutGroup || attrs?.LayoutGroup || "").trim().toLowerCase();
  const preview = String(model?.preview || attrs?.Preview || "").trim().toLowerCase();
  return layoutGroup === "unassigned" || preview === "unassigned";
}

function buildMetadataTargets({ includeSubmodels = true } = {}) {
  const byId = new Map();

  (state.models || []).forEach((model) => {
    const id = modelStableId(model);
    if (!id) return;
    byId.set(id, {
      id,
      name: String(model?.name || id),
      displayName: modelDisplayName(model),
      type: normalizeElementType(model?.type) || "model",
      parentId: "",
      source: "models"
    });
  });

  (state.submodels || []).forEach((submodel) => {
    if (!includeSubmodels) return;
    const id = String(submodel?.id || "").trim();
    if (!id) return;
    const type = "submodel";
    const parentId = String(submodel?.parentId || parseSubmodelParentId(id)).trim();
    const rawName = String(submodel?.name || id);
    const displayName = parentId ? `${parentId} / ${rawName}` : rawName;
    byId.set(id, {
      id,
      name: rawName,
      displayName,
      type,
      parentId,
      source: "submodels"
    });
  });

  return Array.from(byId.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));
}

function getMetadataTargetById(id) {
  const key = String(id || "");
  if (!key) return null;
  return buildMetadataTargets().find((target) => target.id === key) || null;
}

function getMetadataTargetNameById(id) {
  const found = getMetadataTargetById(id);
  return found ? found.displayName : String(id || "");
}

function setMetadataFocusedTarget(targetId) {
  const id = String(targetId || "").trim();
  if (!id) return;
  if (state.ui.metadataTargetId === id) return;
  state.ui.metadataTargetId = id;
  persist();
}

function ensureMetadataTargetSelection() {
  const options = buildMetadataTargets({ includeSubmodels: true })
    .map((target) => target.id)
    .filter(Boolean);
  if (!options.length) {
    state.ui.metadataTargetId = "";
    state.ui.metadataSelectionIds = [];
    return;
  }
  if (!options.includes(state.ui.metadataTargetId)) {
    state.ui.metadataTargetId = options[0];
  }
  const optionSet = new Set(options.map(String));
  state.ui.metadataSelectionIds = normalizeMetadataSelectionIds(state.ui.metadataSelectionIds, optionSet);
}

function resolveAssignmentParentId(assignment) {
  const explicit = String(assignment?.targetParentId || "").trim();
  if (explicit) return explicit;
  const type = normalizeElementType(assignment?.targetType || "");
  if (type === "submodel") return parseSubmodelParentId(assignment?.targetId);
  const id = String(assignment?.targetId || "");
  if (id.includes("/")) return parseSubmodelParentId(id);
  return "";
}

function getLiveModelOrGroupIdSet() {
  return new Set((state.models || []).map(modelStableId).filter(Boolean));
}

function getMetadataOrphans() {
  const liveTargetIds = new Set(
    buildMetadataTargets({ includeSubmodels: true })
      .map((target) => target.id)
      .filter(Boolean)
  );
  const liveModelOrGroupIds = getLiveModelOrGroupIdSet();
  const ignored = new Set((state.metadata?.ignoredOrphanTargetIds || []).map(String));
  return (state.metadata?.assignments || []).filter((assignment) => {
    const targetId = String(assignment?.targetId || "");
    if (!targetId || ignored.has(targetId)) return false;

    const targetType = normalizeElementType(assignment?.targetType || "");
    const isSubmodel = targetType === "submodel" || targetId.includes("/");
    if (isSubmodel) {
      const parentId = resolveAssignmentParentId(assignment);
      return !parentId || !liveModelOrGroupIds.has(parentId);
    }

    return !liveTargetIds.has(targetId);
  });
}

function saveMetadataAndRender(statusText = "") {
  if (statusText) setStatus("info", statusText);
  saveCurrentProjectSnapshot();
  persist();
  render();
}

function getVisualHintDefinitionRecords() {
  return mergeVisualHintDefinitions(state.metadata?.visualHintDefinitions || []);
}

function setVisualHintDefinitionRecords(records) {
  state.metadata.visualHintDefinitions = toStoredVisualHintDefinitions(records);
}

function ensurePersistedVisualHintDefinitions(hintNames = []) {
  const next = ensureVisualHintDefinitions(
    getVisualHintDefinitionRecords(),
    hintNames,
    { timestamp: new Date().toISOString() }
  );
  setVisualHintDefinitionRecords(next);
}

function definePersistedVisualHint(rawName, definition = {}) {
  const next = defineVisualHint(getVisualHintDefinitionRecords(), rawName, {
    ...definition,
    timestamp: definition?.timestamp || new Date().toISOString()
  });
  setVisualHintDefinitionRecords(next);
  agentRuntimeState.invalidatePlanHandoff(`visual hint definition updated: ${String(rawName || "").trim()}`);
  return next.find((row) => row.name === normalizeMetadataTagName(rawName)) || null;
}

function normalizeMetadataTagDescription(description) {
  return String(description || "").trim();
}

function parseMetadataPreferenceList(raw) {
  return Array.from(new Set(
    String(raw || "")
      .split(/[,;|]/)
      .map((row) => normalizeMetadataTagName(row))
      .filter(Boolean)
  ));
}

function buildEffectiveMetadataAssignments(assignments = state.metadata?.assignments || [], preferencesByTargetId = state.metadata?.preferencesByTargetId || {}) {
  return buildRuntimeEffectiveMetadataAssignments(assignments, preferencesByTargetId, {
    resolveTarget: (targetId) => getMetadataTargetById(targetId)
  });
}

function getMetadataTagRecords() {
  return mergeMetadataTagRecords([]);
}

function setMetadataTagRecords(records) {
  state.metadata.tags = toStoredMetadataTagRecords(records);
}

function updateMetadataTagDescription(tagName, description) {
  const name = normalizeMetadataTagName(tagName);
  if (!name) return;
  if (isControlledMetadataTag(name)) return;
  const nextDescription = normalizeMetadataTagDescription(description);
  const records = getMetadataTagRecords();
  const idx = records.findIndex((record) => record.name === name);
  if (idx < 0) return;
  if (String(records[idx].description || "") === nextDescription) return;
  records[idx] = { ...records[idx], description: nextDescription };
  setMetadataTagRecords(records);
  persist();
}

function addMetadataTag() {
  const name = normalizeMetadataTagName(state.ui.metadataNewTag);
  const description = normalizeMetadataTagDescription(state.ui.metadataNewTagDescription);
  if (!name) return;
  const records = getMetadataTagRecords();
  if (records.some((record) => record.name === name)) {
    setStatus("warning", `Tag already exists: ${name}`);
    return render();
  }
  records.push({ name, description });
  records.sort((a, b) => a.name.localeCompare(b.name));
  setMetadataTagRecords(records);
  state.ui.metadataSelectedTags = Array.from(new Set([...(state.ui.metadataSelectedTags || []), name]));
  state.ui.metadataNewTag = "";
  state.ui.metadataNewTagDescription = "";
  saveMetadataAndRender(`Added tag: ${name}`);
}

function removeMetadataTag(tagName) {
  const name = normalizeMetadataTagName(tagName);
  if (!name) return;
  if (isControlledMetadataTag(name)) {
    setStatus("warning", `Controlled tag cannot be removed: ${name}`);
    return render();
  }
  const records = getMetadataTagRecords().filter((record) => record.name !== name);
  setMetadataTagRecords(records);
  // Remove tag from assignments too.
  state.metadata.assignments = (state.metadata?.assignments || []).map((a) => ({
    ...a,
    tags: (a.tags || []).filter((t) => t !== name)
  }));
  state.ui.metadataSelectedTags = (state.ui.metadataSelectedTags || []).filter((t) => t !== name);
  saveMetadataAndRender(`Removed tag: ${name}`);
}

function normalizeMetadataSelectedTags(tags) {
  const known = new Set(getMetadataTagRecords().map((record) => record.name));
  const selected = Array.isArray(tags) ? tags : [];
  const out = [];
  for (const raw of selected) {
    const value = normalizeMetadataTagName(raw);
    if (!value || !known.has(value) || out.includes(value)) continue;
    out.push(value);
  }
  return out;
}

function toggleMetadataSelectedTag(tagName) {
  const name = normalizeMetadataTagName(tagName);
  if (!name) return;
  const before = normalizeStringArray(normalizeMetadataSelectedTags(state.ui.metadataSelectedTags));
  const selected = new Set(normalizeMetadataSelectedTags(state.ui.metadataSelectedTags));
  if (selected.has(name)) selected.delete(name);
  else selected.add(name);
  state.ui.metadataSelectedTags = normalizeMetadataSelectedTags(Array.from(selected));
  const after = normalizeStringArray(normalizeMetadataSelectedTags(state.ui.metadataSelectedTags));
  if (!arraysEqualAsSets(before, after)) {
    agentRuntimeState.invalidatePlanHandoff("selected tags changed");
  }
  persist();
}

function clearMetadataSelectedTags() {
  const before = normalizeStringArray(normalizeMetadataSelectedTags(state.ui.metadataSelectedTags));
  state.ui.metadataSelectedTags = [];
  if (before.length) {
    agentRuntimeState.invalidatePlanHandoff("selected tags cleared");
  }
  persist();
  render();
}

function normalizeMetadataSelectionIds(selectionIds, availableIds = null) {
  const available = availableIds || new Set(buildMetadataTargets().map((target) => String(target.id)));
  const selected = Array.isArray(selectionIds) ? selectionIds : [];
  const out = [];
  for (const raw of selected) {
    const value = String(raw || "").trim();
    if (!value || !available.has(value) || out.includes(value)) continue;
    out.push(value);
  }
  return out;
}

function parseMetadataFilterTerms(raw) {
  return String(raw || "")
    .toLowerCase()
    .split(/[,;|]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function matchesMetadataFilterValue(haystack, rawFilter) {
  const terms = parseMetadataFilterTerms(rawFilter);
  if (!terms.length) return true;
  const text = String(haystack || "").toLowerCase();
  const includeTerms = terms.filter((term) => !term.startsWith("!"));
  const excludeTerms = terms
    .filter((term) => term.startsWith("!"))
    .map((term) => term.slice(1))
    .filter(Boolean);
  if (excludeTerms.some((term) => text.includes(term))) return false;
  if (!includeTerms.length) return true;
  return includeTerms.some((term) => text.includes(term));
}

function setMetadataSelectionIds(selectionIds, { save = true } = {}) {
  const before = normalizeStringArray(normalizeMetadataSelectionIds(state.ui.metadataSelectionIds));
  state.ui.metadataSelectionIds = normalizeMetadataSelectionIds(selectionIds);
  const after = normalizeStringArray(normalizeMetadataSelectionIds(state.ui.metadataSelectionIds));
  if (!arraysEqualAsSets(before, after)) {
    agentRuntimeState.invalidatePlanHandoff("target selection changed");
  }
  if (save) persist();
}

function toggleMetadataSelectionId(targetId) {
  const id = String(targetId || "").trim();
  if (!id) return;
  const selected = new Set(normalizeMetadataSelectionIds(state.ui.metadataSelectionIds));
  if (selected.has(id)) selected.delete(id);
  else selected.add(id);
  setMetadataSelectionIds(Array.from(selected));
}

function clearMetadataSelection() {
  setMetadataSelectionIds([]);
  render();
}

function selectAllMetadataTargets(targetIds) {
  const ids = Array.isArray(targetIds) ? targetIds.map((id) => String(id || "").trim()).filter(Boolean) : [];
  setMetadataSelectionIds(ids);
  render();
}

function upsertMetadataAssignmentTags(targetId, tagsToAdd = [], tagsToRemove = []) {
  const id = String(targetId || "").trim();
  if (!id) return false;
  const target = getMetadataTargetById(id);
  if (!target) return false;

  const addSet = new Set(normalizeMetadataSelectedTags(tagsToAdd));
  const removeSet = new Set(normalizeMetadataSelectedTags(tagsToRemove));
  const assignments = state.metadata?.assignments || [];
  const idx = assignments.findIndex((a) => String(a.targetId) === id);
  const existing = idx >= 0 ? assignments[idx] : null;
  const currentTags = new Set(Array.isArray(existing?.tags) ? existing.tags : []);
  for (const t of addSet) currentTags.add(t);
  for (const t of removeSet) currentTags.delete(t);
  const nextTags = Array.from(currentTags);

  if (!nextTags.length) {
    if (idx >= 0) assignments.splice(idx, 1);
    state.metadata.assignments = [...assignments];
    return true;
  }

  const targetType = target?.type || (id.includes("/") ? "submodel" : "model");
  const targetParentId = targetType === "submodel"
    ? (target?.parentId || parseSubmodelParentId(id))
    : "";
  const targetParentName = targetParentId ? getMetadataTargetNameById(targetParentId) : "";
  const next = {
    targetId: id,
    targetName: target?.displayName || getMetadataTargetNameById(id),
    targetType,
    targetParentId,
    targetParentName,
    tags: nextTags
  };
  if (idx >= 0) assignments[idx] = next;
  else assignments.push(next);
  state.metadata.assignments = [...assignments];
  state.metadata.ignoredOrphanTargetIds = (state.metadata?.ignoredOrphanTargetIds || []).filter(
    (orphanId) => String(orphanId) !== id
  );
  return true;
}

function updateMetadataTargetRolePreference(targetId, rolePreference = "") {
  const id = String(targetId || "").trim();
  if (!id) return false;
  const target = getMetadataTargetById(id);
  if (!target) return false;
  const value = String(rolePreference || "").trim().toLowerCase();
  const allowed = new Set(["", "focal", "support", "background", "frame", "accent"]);
  if (!allowed.has(value)) return false;
  const current = state.metadata?.preferencesByTargetId && typeof state.metadata.preferencesByTargetId === "object"
    ? state.metadata.preferencesByTargetId
    : {};
  const previous = current[id] && typeof current[id] === "object" ? current[id] : {};
  if (String(previous.rolePreference || "") === value) return true;
  const next = { ...current };
  if (!value) {
    const reduced = { ...previous };
    delete reduced.rolePreference;
    if (Object.keys(reduced).length) next[id] = reduced;
    else delete next[id];
  } else {
    next[id] = {
      ...previous,
      rolePreference: value
    };
  }
  state.metadata.preferencesByTargetId = next;
  agentRuntimeState.invalidatePlanHandoff("metadata role preference changed");
  saveMetadataAndRender(`Updated role preference for ${target.displayName || id}.`);
  return true;
}

function updateMetadataTargetSemanticHints(targetId, rawValue = "") {
  const id = String(targetId || "").trim();
  if (!id) return false;
  const target = getMetadataTargetById(id);
  if (!target) return false;
  const nextValues = parseMetadataPreferenceList(rawValue);
  const current = state.metadata?.preferencesByTargetId && typeof state.metadata.preferencesByTargetId === "object"
    ? state.metadata.preferencesByTargetId
    : {};
  const previous = current[id] && typeof current[id] === "object" ? current[id] : {};
  const previousValues = Array.isArray(previous.semanticHints) ? previous.semanticHints : [];
  if (JSON.stringify(previousValues) === JSON.stringify(nextValues)) return true;
  const next = { ...current };
  const reduced = { ...previous };
  if (nextValues.length) reduced.semanticHints = nextValues;
  else delete reduced.semanticHints;
  if (Object.keys(reduced).length) next[id] = reduced;
  else delete next[id];
  state.metadata.preferencesByTargetId = next;
  ensurePersistedVisualHintDefinitions(nextValues);
  agentRuntimeState.invalidatePlanHandoff("metadata semantic hints changed");
  saveMetadataAndRender(`Updated semantic hints for ${target.displayName || id}.`);
  return true;
}

function addMetadataTargetSemanticHint(targetId, value = "") {
  const id = String(targetId || "").trim();
  if (!id) return false;
  const current = state.metadata?.preferencesByTargetId?.[id]?.semanticHints || [];
  const next = Array.from(new Set([...current, ...parseMetadataPreferenceList(value)]));
  return updateMetadataTargetSemanticHints(id, next.join(", "));
}

function removeMetadataTargetSemanticHint(targetId, value = "") {
  const id = String(targetId || "").trim();
  if (!id) return false;
  const current = state.metadata?.preferencesByTargetId?.[id]?.semanticHints || [];
  const next = current.filter((row) => String(row || "").trim().toLowerCase() !== String(value || "").trim().toLowerCase());
  return updateMetadataTargetSemanticHints(id, next.join(", "));
}

function updateMetadataTargetSubmodelHints(targetId, rawValue = "") {
  const id = String(targetId || "").trim();
  if (!id) return false;
  const target = getMetadataTargetById(id);
  if (!target) return false;
  const nextValues = parseMetadataPreferenceList(rawValue);
  const current = state.metadata?.preferencesByTargetId && typeof state.metadata.preferencesByTargetId === "object"
    ? state.metadata.preferencesByTargetId
    : {};
  const previous = current[id] && typeof current[id] === "object" ? current[id] : {};
  const previousValues = Array.isArray(previous.submodelHints) ? previous.submodelHints : [];
  if (JSON.stringify(previousValues) === JSON.stringify(nextValues)) return true;
  const next = { ...current };
  const reduced = { ...previous };
  if (nextValues.length) reduced.submodelHints = nextValues;
  else delete reduced.submodelHints;
  if (Object.keys(reduced).length) next[id] = reduced;
  else delete next[id];
  state.metadata.preferencesByTargetId = next;
  agentRuntimeState.invalidatePlanHandoff("metadata submodel hints changed");
  saveMetadataAndRender(`Updated submodel hints for ${target.displayName || id}.`);
  return true;
}

function addMetadataTargetSubmodelHint(targetId, value = "") {
  const id = String(targetId || "").trim();
  if (!id) return false;
  const current = state.metadata?.preferencesByTargetId?.[id]?.submodelHints || [];
  const next = Array.from(new Set([...current, ...parseMetadataPreferenceList(value)]));
  return updateMetadataTargetSubmodelHints(id, next.join(", "));
}

function removeMetadataTargetSubmodelHint(targetId, value = "") {
  const id = String(targetId || "").trim();
  if (!id) return false;
  const current = state.metadata?.preferencesByTargetId?.[id]?.submodelHints || [];
  const next = current.filter((row) => String(row || "").trim().toLowerCase() !== String(value || "").trim().toLowerCase());
  return updateMetadataTargetSubmodelHints(id, next.join(", "));
}

function updateMetadataTargetEffectAvoidances(targetId, rawValue = "") {
  const id = String(targetId || "").trim();
  if (!id) return false;
  const target = getMetadataTargetById(id);
  if (!target) return false;
  const nextValues = parseMetadataPreferenceList(rawValue);
  const current = state.metadata?.preferencesByTargetId && typeof state.metadata.preferencesByTargetId === "object"
    ? state.metadata.preferencesByTargetId
    : {};
  const previous = current[id] && typeof current[id] === "object" ? current[id] : {};
  const previousValues = Array.isArray(previous.effectAvoidances) ? previous.effectAvoidances : [];
  if (JSON.stringify(previousValues) === JSON.stringify(nextValues)) return true;
  const next = { ...current };
  const reduced = { ...previous };
  if (nextValues.length) reduced.effectAvoidances = nextValues;
  else delete reduced.effectAvoidances;
  if (Object.keys(reduced).length) next[id] = reduced;
  else delete next[id];
  state.metadata.preferencesByTargetId = next;
  agentRuntimeState.invalidatePlanHandoff("metadata effect avoidances changed");
  saveMetadataAndRender(`Updated effect avoidances for ${target.displayName || id}.`);
  return true;
}

function addMetadataTargetEffectAvoidance(targetId, value = "") {
  const id = String(targetId || "").trim();
  if (!id) return false;
  const current = state.metadata?.preferencesByTargetId?.[id]?.effectAvoidances || [];
  const next = Array.from(new Set([...current, ...parseMetadataPreferenceList(value)]));
  return updateMetadataTargetEffectAvoidances(id, next.join(", "));
}

function removeMetadataTargetEffectAvoidance(targetId, value = "") {
  const id = String(targetId || "").trim();
  if (!id) return false;
  const current = state.metadata?.preferencesByTargetId?.[id]?.effectAvoidances || [];
  const next = current.filter((row) => String(row || "").trim().toLowerCase() !== String(value || "").trim().toLowerCase());
  return updateMetadataTargetEffectAvoidances(id, next.join(", "));
}

function bulkSetMetadataRolePreference(rolePreference = "") {
  const selectedIds = normalizeMetadataSelectionIds(state.ui.metadataSelectionIds);
  if (!selectedIds.length) {
    setStatus("warning", "Select one or more layout targets first.");
    return render();
  }
  let touched = 0;
  for (const id of selectedIds) {
    if (updateMetadataTargetRolePreference(id, rolePreference)) touched += 1;
  }
  saveMetadataAndRender(`Updated role preference for ${touched} target${touched === 1 ? "" : "s"}.`);
}

function bulkAddMetadataSemanticHint(value = "") {
  const selectedIds = normalizeMetadataSelectionIds(state.ui.metadataSelectionIds);
  const nextValue = String(value || "").trim();
  if (!selectedIds.length) {
    setStatus("warning", "Select one or more layout targets first.");
    return render();
  }
  if (!nextValue) {
    setStatus("warning", "Choose or enter a visual hint first.");
    return render();
  }
  let touched = 0;
  for (const id of selectedIds) {
    if (addMetadataTargetSemanticHint(id, nextValue)) touched += 1;
  }
  saveMetadataAndRender(`Added visual hint to ${touched} target${touched === 1 ? "" : "s"}.`);
}

function bulkAddMetadataEffectAvoidance(value = "") {
  const selectedIds = normalizeMetadataSelectionIds(state.ui.metadataSelectionIds);
  const nextValue = String(value || "").trim();
  if (!selectedIds.length) {
    setStatus("warning", "Select one or more layout targets first.");
    return render();
  }
  if (!nextValue) {
    setStatus("warning", "Choose or enter an effect avoidance first.");
    return render();
  }
  let touched = 0;
  for (const id of selectedIds) {
    if (addMetadataTargetEffectAvoidance(id, nextValue)) touched += 1;
  }
  saveMetadataAndRender(`Added effect avoidance to ${touched} target${touched === 1 ? "" : "s"}.`);
}

function applyTagsToSelectedMetadataTargets() {
  const selectedIds = normalizeMetadataSelectionIds(state.ui.metadataSelectionIds);
  if (!selectedIds.length) {
    setStatus("warning", "Select one or more metadata targets first.");
    return render();
  }
  const opTags = normalizeMetadataSelectedTags(state.ui.metadataSelectedTags);
  if (!opTags.length) {
    setStatus("warning", "Select one or more tags to apply.");
    return render();
  }
  let touched = 0;
  for (const id of selectedIds) {
    if (upsertMetadataAssignmentTags(id, opTags, [])) touched++;
  }
  saveMetadataAndRender(`Applied ${opTags.length} tag${opTags.length === 1 ? "" : "s"} to ${touched} target${touched === 1 ? "" : "s"}.`);
}

function removeTagsFromSelectedMetadataTargets() {
  const selectedIds = normalizeMetadataSelectionIds(state.ui.metadataSelectionIds);
  if (!selectedIds.length) {
    setStatus("warning", "Select one or more metadata targets first.");
    return render();
  }
  const opTags = normalizeMetadataSelectedTags(state.ui.metadataSelectedTags);
  if (!opTags.length) {
    setStatus("warning", "Select one or more tags to remove.");
    return render();
  }
  let touched = 0;
  for (const id of selectedIds) {
    if (upsertMetadataAssignmentTags(id, [], opTags)) touched++;
  }
  saveMetadataAndRender(`Removed ${opTags.length} tag${opTags.length === 1 ? "" : "s"} from ${touched} target${touched === 1 ? "" : "s"}.`);
}

function removeMetadataAssignment(targetId) {
  state.metadata.assignments = (state.metadata?.assignments || []).filter(
    (a) => String(a.targetId) !== String(targetId)
  );
  state.metadata.ignoredOrphanTargetIds = (state.metadata?.ignoredOrphanTargetIds || []).filter(
    (id) => String(id) !== String(targetId)
  );
  saveMetadataAndRender("Removed metadata assignment.");
}

function ignoreMetadataOrphan(targetId) {
  const current = new Set((state.metadata?.ignoredOrphanTargetIds || []).map(String));
  current.add(String(targetId));
  state.metadata.ignoredOrphanTargetIds = [...current];
  saveMetadataAndRender("Ignored orphan metadata target.");
}

function remapMetadataOrphan(fromTargetId, toTargetId) {
  const to = normalizeSectionLabel(toTargetId);
  if (!to) {
    setStatus("warning", "Select a replacement target for remap.");
    return render();
  }
  const target = getMetadataTargetById(to);
  const assignments = state.metadata?.assignments || [];
  const idx = assignments.findIndex((a) => String(a.targetId) === String(fromTargetId));
  if (idx < 0) return;
  const targetType = target?.type || (to.includes("/") ? "submodel" : "model");
  const targetParentId = targetType === "submodel"
    ? (target?.parentId || parseSubmodelParentId(to))
    : "";
  const targetParentName = targetParentId ? getMetadataTargetNameById(targetParentId) : "";
  assignments[idx] = {
    ...assignments[idx],
    targetId: to,
    targetName: target?.displayName || getMetadataTargetNameById(to),
    targetType,
    targetParentId,
    targetParentName
  };
  state.metadata.assignments = [...assignments];
  state.metadata.ignoredOrphanTargetIds = (state.metadata?.ignoredOrphanTargetIds || []).filter(
    (id) => String(id) !== String(fromTargetId)
  );
  saveMetadataAndRender("Remapped orphan metadata target.");
}

function insertModelIntoDraft(modelName) {
  if (!modelName) return;
  state.proposed.push(`Targeted Edit / ${modelName} / describe change`);
  state.flags.hasDraftProposal = true;
  state.route = "design";
  state.ui.designTab = "proposed";
  setStatus("info", `Inserted ${modelName} into draft list.`);
  saveCurrentProjectSnapshot();
  persist();
  render();
}

function splitBySection() {
  const selected = new Set(getSelectedSections());
  if (hasAllSectionsSelected() || selected.size === 0) {
    setStatus("warning", "Choose a section first.");
    return render();
  }
  state.proposed = state.proposed.filter((item) => selected.has(getSectionName(item)));
  invalidateApplyApproval();
  setStatus("info", `Draft narrowed to ${selected.size} section${selected.size === 1 ? "" : "s"}.`);
  saveCurrentProjectSnapshot();
  persist();
  render();
}

function updateProposedLine(index, value) {
  if (index < 0 || index >= state.proposed.length) return;
  state.proposed[index] = value.trim();
  state.proposed = state.proposed.filter((line) => line.length > 0);
  state.flags.hasDraftProposal = state.proposed.length > 0;
  invalidateApplyApproval();
  saveCurrentProjectSnapshot();
  persist();
  render();
}

function removeProposedLine(index) {
  if (index < 0 || index >= state.proposed.length) return;
  state.proposed.splice(index, 1);
  sanitizeProposedSelection();
  state.flags.hasDraftProposal = state.proposed.length > 0;
  invalidateApplyApproval();
  saveCurrentProjectSnapshot();
  persist();
  render();
}

function addProposedLine() {
  state.proposed.push("Describe the next design change in plain language");
  state.flags.hasDraftProposal = true;
  invalidateApplyApproval();
  saveCurrentProjectSnapshot();
  persist();
  render();
}

function selectedProposedIndexesFromPicker() {
  sanitizeProposedSelection();
  return [...(state.ui.proposedSelection || [])];
}

function onRemoveAllProposed() {
  if (!state.proposed.length) {
    setStatus("warning", "No proposed changes to delete.");
    return render();
  }
  state.creative.proposalBundle = null;
  state.creative.intentHandoff = null;
  state.creative.supersededConcepts = [];
  state.agentPlan = null;
  clearDesignRevisionTarget();
  state.proposed = [];
  state.ui.proposedSelection = [];
  state.flags.hasDraftProposal = false;
  agentRuntimeState.clearAgentHandoff("intent_handoff_v1", "draft cleared", { pushLog: false });
  agentRuntimeState.clearAgentHandoff("plan_handoff_v1", "draft cleared", { pushLog: false });
  invalidateApplyApproval();
  setStatus("info", "Deleted all proposed changes.");
  saveCurrentProjectSnapshot();
  persist();
  render();
}

function onRemoveSelectedProposed() {
  const selected = selectedProposedIndexesFromPicker();
  if (!selected.length) {
    setStatus("warning", "Select one or more proposed lines first.");
    return render();
  }
  const executionPlan = state.creative?.proposalBundle?.executionPlan && typeof state.creative.proposalBundle.executionPlan === "object"
    ? state.creative.proposalBundle.executionPlan
    : null;
  const selectedSections = Array.from(new Set(selected.map((idx) => getSectionName(state.proposed[idx] || "")).filter(Boolean)));
  const selectedDesignIds = executionPlan
    ? Array.from(new Set(
        (Array.isArray(executionPlan.sectionPlans) ? executionPlan.sectionPlans : [])
          .filter((row) => selectedSections.includes(String(row?.section || "").trim()))
          .map((row) => String(row?.designId || "").trim())
          .filter(Boolean)
      ))
    : [];
  if (selectedDesignIds.length) {
    let removedCount = 0;
    for (const designId of selectedDesignIds) {
      const before = Array.isArray(state.creative?.proposalBundle?.executionPlan?.sectionPlans)
        ? state.creative.proposalBundle.executionPlan.sectionPlans.length
        : 0;
      onRemoveDesignConcept(designId);
      const after = Array.isArray(state.creative?.proposalBundle?.executionPlan?.sectionPlans)
        ? state.creative.proposalBundle.executionPlan.sectionPlans.length
        : 0;
      if (after < before) removedCount += 1;
    }
    if (removedCount > 0) return;
  }
  const uniqueDesc = Array.from(new Set(selected)).sort((a, b) => b - a);
  for (const idx of uniqueDesc) state.proposed.splice(idx, 1);
  state.flags.hasDraftProposal = state.proposed.length > 0;
  invalidateApplyApproval();
  setStatus("info", `Removed ${uniqueDesc.length} proposed line${uniqueDesc.length === 1 ? "" : "s"}.`);
  saveCurrentProjectSnapshot();
  persist();
  render();
}

function onRemoveDesignConcept(designId) {
  const normalizedDesignId = String(designId || "").trim();
  if (!normalizedDesignId) {
    setStatus("warning", "No design concept selected.");
    return render();
  }
  if (String(state.ui.designRevisionTarget?.designId || "").trim() === normalizedDesignId) {
    clearDesignRevisionTarget();
  }
  const proposalBundle = state.creative?.proposalBundle && typeof state.creative.proposalBundle === "object"
    ? state.creative.proposalBundle
    : null;
  const executionPlan = proposalBundle?.executionPlan && typeof proposalBundle.executionPlan === "object"
    ? proposalBundle.executionPlan
    : null;
  if (!executionPlan) {
    setStatus("warning", "No design execution plan is available to edit.");
    return render();
  }
  const filteredExecutionPlan = filterDesignerExecutionPlanByDesignId(executionPlan, normalizedDesignId);
  if (!filteredExecutionPlan) {
    setStatus("warning", "Unable to filter the selected design concept.");
    return render();
  }
  if (Array.isArray(filteredExecutionPlan.sectionPlans) && filteredExecutionPlan.sectionPlans.length === Array.isArray(executionPlan.sectionPlans).length) {
    setStatus("warning", `Design concept ${normalizedDesignId} was not found in the current draft.`);
    return render();
  }
  const rebuiltBundle = rebuildProposalBundleFromExecutionPlan(proposalBundle, filteredExecutionPlan);
  if (!rebuiltBundle) {
    setStatus("warning", "Unable to rebuild the draft after removing that concept.");
    return render();
  }

  state.creative.proposalBundle = rebuiltBundle;
  state.proposed = Array.isArray(rebuiltBundle.proposalLines) ? [...rebuiltBundle.proposalLines] : [];
  state.flags.hasDraftProposal = state.proposed.length > 0;
  state.ui.proposedSelection = [];

  const rebuild = rebuildSequenceAgentStateFromCurrentIntent();
  if (!rebuild.ok) {
    setStatus("warning", `Removed ${normalizedDesignId}, but could not rebuild the sequence draft: ${rebuild.reason}`);
  } else {
    setStatus("info", `Removed design concept ${normalizedDesignId}.`);
  }
  invalidateApplyApproval();
  saveCurrentProjectSnapshot();
  persist();
  render();
}

function onReviseDesignConcept(designId) {
  const revisionTarget = buildDesignRevisionTargetById(designId);
  if (!revisionTarget) {
    setStatus("warning", "Selected design concept could not be prepared for revision.");
    return render();
  }
  state.ui.designRevisionTarget = revisionTarget;
  state.route = "design";
  state.ui.designTab = "chat";
  state.ui.chatDraft = `Revise ${buildDesignDisplay(revisionTarget.designId, revisionTarget.priorDesignRevision)}. `;
  setStatus(
    "info",
    `Revising ${buildDesignDisplay(revisionTarget.designId, revisionTarget.priorDesignRevision)} in place. The next generated draft will replace it as ${buildDesignDisplay(revisionTarget.designId, revisionTarget.designRevision)}.`
  );
  persist();
  render();
}

function onInspectDesignConcept(designId) {
  const normalizedDesignId = String(designId || "").trim();
  if (!normalizedDesignId) {
    setStatus("warning", "No design concept selected for inspection.");
    return render();
  }
  state.ui.sequenceDesignFilterId = normalizedDesignId;
  state.route = "sequence";
  setStatus("info", `Inspecting sequence rows for ${buildDesignDisplay(normalizedDesignId, 0).replace(/\.0$/, "") || normalizedDesignId}.`);
  persist();
  render();
}

function getProposedPayloadPreviewText() {
  const selected = selectedProposedIndexesFromPicker();
  const sourceIndexes = selected.length ? selected : state.proposed.map((_, idx) => idx).slice(0, 1);
  const lines = sourceIndexes
    .map((idx) => ({
      index: idx,
      summary: String(state.proposed[idx] || "").trim(),
      sectionHint: getSectionName(state.proposed[idx] || ""),
      approxEffectsImpacted: 11
    }))
    .filter((row) => row.summary);

  const operations = lines.flatMap((row) => ([
    {
      type: "effect.update",
      target: row.sectionHint || "auto-section",
      scope: "selected-models",
      action: "adjust-intensity",
      params: { deltaPercent: -12, clamp: [5, 95] }
    },
    {
      type: "effect.update",
      target: row.sectionHint || "auto-section",
      scope: "selected-models",
      action: "apply-palette",
      params: { primary: "#0b3d91", secondary: "#2a9d8f", accent: "#f4a261" }
    },
    {
      type: "timing.align",
      target: row.sectionHint || "auto-section",
      action: "snap-transition-edges",
      params: { track: "XD: Mood", toleranceMs: 45 }
    }
  ]));

  const payload = {
    action: "sequence.apply",
    source: "designer.proposed",
    selectedCount: lines.length,
    changes: lines,
    operations,
    note: "Scaffold preview. Final write payload will include resolved models/sections/effects.",
    generatedAt: new Date().toISOString()
  };
  return JSON.stringify(payload, null, 2);
}

function onEditSelectedProposed() {
  const selected = selectedProposedIndexesFromPicker();
  if (selected.length !== 1) {
    setStatus("warning", "Select exactly one proposed line to edit.");
    return render();
  }
  const idx = selected[0];
  const current = state.proposed[idx] || "";
  const next = window.prompt("Edit proposed line", current);
  if (next == null) return;
  const value = String(next).trim();
  if (!value) {
    setStatus("warning", "Edited line cannot be empty.");
    return render();
  }
  state.proposed[idx] = value;
  state.flags.hasDraftProposal = state.proposed.length > 0;
  saveCurrentProjectSnapshot();
  persist();
  render();
}


function dirnameOfPath(filePath) {
  const p = String(filePath || "");
  const slash = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return slash > 0 ? p.slice(0, slash) : "";
}

function projectNameFromPath(filePath) {
  const p = String(filePath || "");
  const slash = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  const file = slash >= 0 ? p.slice(slash + 1) : p;
  return file.replace(/\.xdproj$/i, "").trim();
}

function normalizeProjectDisplayName(value) {
  return String(value || "")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
}

function buildCanonicalProjectFilePath(rootPath, projectName) {
  const root = String(rootPath || "").trim().replace(/[\\/]+$/, "");
  const normalizedName = normalizeProjectDisplayName(projectName);
  if (!root || !normalizedName) return "";
  return `${root}/projects/${normalizedName}/${normalizedName}.xdproj`;
}

function inferProjectRootFromFilePath(filePath) {
  const raw = String(filePath || "").trim().replace(/\\/g, "/");
  if (!raw) return "";
  const marker = "/projects/";
  const idx = raw.lastIndexOf(marker);
  if (idx < 0) return "";
  return raw.slice(0, idx);
}

async function saveProjectToCurrentFile(options = {}) {
  const saveAs = options?.saveAs === true;
  const rename = options?.rename === true;
  const bridge = getDesktopProjectBridge();
  if (!bridge) return { ok: false, code: "NO_BRIDGE", error: "Desktop project bridge unavailable." };
  const normalizedProjectName = normalizeProjectDisplayName(state.projectName);
  if (!normalizedProjectName) {
    return { ok: false, code: "INVALID_PROJECT_NAME", error: "Project name is required." };
  }
  state.projectName = normalizedProjectName;

  const res = await bridge.writeProjectFile({
    rootPath: state.projectMetadataRoot,
    currentFilePath: saveAs ? "" : state.projectFilePath,
    mode: rename ? "rename" : (saveAs ? "save-as" : "save"),
    projectName: state.projectName,
    showFolder: state.showFolder,
    mediaPath: state.mediaPath,
    snapshot: extractProjectSnapshot()
  });
  if (!res?.ok) return res || { ok: false, code: "WRITE_FAILED", error: "Project file write failed." };
  state.projectFilePath = String(res.filePath || state.projectFilePath || "");
  state.projectMetadataRoot = String(res?.project?.appRootPath || state.projectMetadataRoot || "");
  state.projectCreatedAt = String(res?.project?.createdAt || state.projectCreatedAt || "");
  state.projectUpdatedAt = String(res?.project?.updatedAt || state.projectUpdatedAt || "");
  return { ok: true, filePath: state.projectFilePath };
}


async function onSaveProjectSettings() {
  const previousProjectName = String(state.projectName || "").trim();
  const previousShowFolder = String(state.showFolder || "").trim();
  projectLifecycleRuntime.syncProjectSummaryInputs();
  const endpointInput = app.querySelector("#endpoint-input");
  const confirmModeInput = app.querySelector("#confirm-mode-input");
  const thresholdInput = app.querySelector("#threshold-input");
  const sequenceSwitchPolicyInput = app.querySelector("#sequence-switch-policy-input");

  if (endpointInput) state.endpoint = normalizeConfiguredEndpoint(endpointInput.value);
  if (confirmModeInput) state.safety.applyConfirmMode = confirmModeInput.value;
  if (thresholdInput) {
    const parsed = Number.parseInt(thresholdInput.value, 10);
    state.safety.largeChangeThreshold = Number.isFinite(parsed) ? parsed : state.safety.largeChangeThreshold;
  }
  if (sequenceSwitchPolicyInput) {
    const value = sequenceSwitchPolicyInput.value === "discard-unsaved" ? "discard-unsaved" : "save-if-needed";
    state.safety.sequenceSwitchUnsavedPolicy = value;
  }

  const saved = await saveProjectToCurrentFile({ saveAs: false });
  if (saved?.ok) {
    setStatus("info", `Project saved: ${saved.filePath}`);
    if (previousProjectName && previousProjectName !== state.projectName) {
      deleteProjectSnapshot(previousProjectName, previousShowFolder || state.showFolder);
    }
  } else if (saved?.code === "CANCELED") {
    setStatus("info", "Save canceled.");
  } else if (saved?.code === "PROJECT_RENAME_REQUIRED") {
    setStatus("warning", saved.error || "Project name changed. Use Rename Project.");
  } else if (saved?.code !== "NO_BRIDGE") {
    setStatusWithDiagnostics("warning", `Project save failed: ${saved?.error || "unknown error"}`);
  } else {
    setStatus("info", "Project settings saved.");
  }
  saveCurrentProjectSnapshot();
  persist();
  render();
}

function addRecentSequence(path) {
  const next = [path, ...state.recentSequences.filter((p) => p !== path)];
  state.recentSequences = next.slice(0, 8);
}

function syncSequencePathInput() {
  const existingInput = app.querySelector("#sequence-path-input");
  if (existingInput) {
    state.sequencePathInput = existingInput.value.trim() || state.sequencePathInput;
  }
  const newInput = app.querySelector("#new-sequence-path-input");
  if (newInput) {
    state.newSequencePathInput = newInput.value.trim() || state.newSequencePathInput;
  }
  const audioInput = app.querySelector("#audio-path-input");
  if (audioInput) {
    sequenceMediaSessionRuntime.setAudioPathWithAgentPolicy(audioInput.value.trim() || "", "audio path edited");
  }
  const typeInput = app.querySelector("#new-sequence-type-input");
  if (typeInput) {
    state.newSequenceType = typeInput.value === "animation" ? "animation" : "musical";
  }
  const durationInput = app.querySelector("#new-sequence-duration-input");
  if (durationInput) {
    const parsed = Number.parseInt(durationInput.value, 10);
    state.newSequenceDurationMs = Number.isFinite(parsed) ? Math.max(1, parsed) : state.newSequenceDurationMs;
  }
  const frameInput = app.querySelector("#new-sequence-frame-input");
  if (frameInput) {
    const parsed = Number.parseInt(frameInput.value, 10);
    state.newSequenceFrameMs = Number.isFinite(parsed) ? Math.max(1, parsed) : state.newSequenceFrameMs;
  }
}

function selectedSequencePath() {
  const mode = state.ui.sequenceMode === "new" ? "new" : "existing";
  return mode === "new"
    ? String(state.newSequencePathInput || "").trim()
    : String(state.sequencePathInput || "").trim();
}

function hasExtension(path, extensions) {
  const lower = String(path || "").toLowerCase();
  return extensions.some((ext) => lower.endsWith(`.${String(ext).toLowerCase()}`));
}

async function pickFilePathFromDesktop(options = {}) {
  const dialog = getDesktopFileDialogBridge();
  if (!dialog) {
    setStatus(
      "warning",
      "File dialog is only available in desktop runtime. Paste full path manually."
    );
    render();
    return "";
  }
  try {
    const result = await dialog(options);
    return normalizeDialogPathSelection(result);
  } catch (err) {
    setStatusWithDiagnostics(
      "warning",
      `File dialog failed: ${err?.message || "unknown error"}`,
      err?.stack || ""
    );
    render();
    return "";
  }
}

async function pickSequenceSavePathFromDesktop(options = {}) {
  const bridge = getDesktopSequenceDialogBridge();
  if (!bridge) {
    setStatus("warning", "Sequence save dialog requires desktop runtime.");
    render();
    return "";
  }
  try {
    const res = await bridge(options);
    if (!res?.ok) {
      if (res?.canceled) return "";
      throw new Error(res?.error || "Unable to choose sequence path.");
    }
    return String(res.filePath || "").trim();
  } catch (err) {
    setStatusWithDiagnostics(
      "warning",
      `Sequence dialog failed: ${err?.message || "unknown error"}`,
      err?.stack || ""
    );
    render();
    return "";
  }
}

async function onBrowseExistingSequencePath() {
  const selected = await pickFilePathFromDesktop({
    title: "Choose xLights Sequence",
    filters: [{ name: "xLights Sequence", extensions: ["xsq"] }]
  });
  if (!selected) return;
  if (!hasExtension(selected, ["xsq"])) {
    setStatus("warning", "Please choose a .xsq sequence file.");
    render();
    return;
  }
  state.sequencePathInput = selected;
  state.ui.sequenceMode = "existing";
  saveCurrentProjectSnapshot();
  persist();
  render();
}

async function onBrowseShowFolder() {
  const selected = await pickFilePathFromDesktop({
    title: "Select Show Directory",
    directory: true
  });
  if (!selected) return;
  state.showFolder = selected;
  saveCurrentProjectSnapshot();
  persist();
  render();
  void projectCatalogRuntime.refreshSequenceCatalog({ silent: true });
}

async function onBrowseMediaFolder() {
  const selected = await pickFilePathFromDesktop({
    title: "Select Media Directory",
    directory: true,
    defaultPath: String(state.mediaPath || state.showFolder || "").trim() || undefined
  });
  if (!selected) return;
  state.mediaPath = selected;
  saveCurrentProjectSnapshot();
  persist();
  render();
  void projectCatalogRuntime.refreshMediaCatalog({ silent: true });
}

async function onBrowseProjectMetadataRoot() {
  const selected = await pickFilePathFromDesktop({
    title: "Choose Project Root Folder",
    directory: true
  });
  if (!selected) return;
  state.projectMetadataRoot = selected;
  persist();
  render();
}


function onSelectCatalogSequence() {
  const input = app.querySelector("#sequence-catalog-select");
  if (!input) return;
  const value = String(input.value || "").trim();
  if (!value) return;
  state.sequencePathInput = value;
  saveCurrentProjectSnapshot();
  persist();
  render();
}

async function closeActiveSequenceForSwitch(options = {}) {
  const mode = options?.mode === "discard-unsaved" ? "discard-unsaved" : "policy";
  let hasLiveOpenSequence = Boolean(state.flags.activeSequenceLoaded);
  if (!hasLiveOpenSequence) {
    try {
      const open = await getOpenSequence(state.endpoint);
      hasLiveOpenSequence = open?.data?.isOpen === true;
    } catch {
      hasLiveOpenSequence = false;
    }
  }
  if (!hasLiveOpenSequence) return;
  try {
    await closeSequence(state.endpoint, false, true);
    state.flags.activeSequenceLoaded = false;
    state.health.sequenceOpen = false;
    return;
  } catch (err) {
    const message = String(err?.message || "");
    if (!message.includes("UNSAVED_CHANGES")) {
      throw err;
    }
  }

  const policy = mode === "discard-unsaved"
    ? "discard-unsaved"
    : (state.safety.sequenceSwitchUnsavedPolicy === "discard-unsaved" ? "discard-unsaved" : "save-if-needed");

  if (policy === "discard-unsaved") {
    await closeSequence(state.endpoint, true, true);
    state.flags.activeSequenceLoaded = false;
    state.health.sequenceOpen = false;
    return;
  }

  await saveSequence(state.endpoint);
  await flushSidecarPersistIfDirty(currentSequencePathForSidecar());
  await closeSequence(state.endpoint, false, true);
  state.flags.activeSequenceLoaded = false;
  state.health.sequenceOpen = false;
}

function isSequenceAllowedInActiveShowFolder(sequencePayload) {
  return isSequenceAllowedInShowFolder(sequencePayload, String(state.showFolder || "").trim());
}

function noteIgnoredExternalSequence(sequencePayload, sourceLabel = "xLights") {
  const sequencePath = readSequencePathFromPayload(sequencePayload);
  if (!sequencePath) return;
  if (sequencePath === lastIgnoredExternalSequencePath) return;
  lastIgnoredExternalSequencePath = sequencePath;
  setStatus("warning", `${sourceLabel} has a sequence outside active Show Directory. Ignoring in app: ${basenameOfPath(sequencePath) || sequencePath}`);
}

function clearIgnoredExternalSequenceNote() {
  lastIgnoredExternalSequencePath = "";
}

async function onOpenSequenceFromDialog() {
  const showFolder = String(state.showFolder || "").trim();
  if (!showFolder) {
    setStatus("warning", "Set Show Directory first.");
    render();
    return;
  }
  const selected = await pickFilePathFromDesktop({
    title: "Open Sequence",
    defaultPath: showFolder,
    filters: [{ name: "xLights Sequence", extensions: ["xsq"] }]
  });
  if (!selected) return;
  if (!hasExtension(selected, ["xsq"])) {
    setStatus("warning", "Please choose a .xsq sequence file.");
    render();
    return;
  }
  if (!isPathWithinShowFolder(selected, showFolder)) {
    setStatus("warning", "Selected sequence must be inside Show Directory.");
    render();
    return;
  }

  state.sequencePathInput = selected;
  saveCurrentProjectSnapshot();
  persist();
  render();
  await sequenceMediaSessionRuntime.openExistingSequence(selected);
}

async function onBrowseAudioPath() {
  const selected = await pickFilePathFromDesktop({
    title: "Choose Sequence Media (optional)",
    filters: [
      { name: "Sequence Media", extensions: Array.from(SUPPORTED_SEQUENCE_MEDIA_EXTENSIONS) },
      { name: "All Files", extensions: ["*"] }
    ]
  });
  if (!selected) return;
  sequenceMediaSessionRuntime.setAudioPathWithAgentPolicy(selected, "audio path selected");
  saveCurrentProjectSnapshot();
  persist();
  render();
}


async function onOpenSelectedSequence() {
  const targetPath = String(state.sequencePathInput || "").trim();
  if (!targetPath) {
    setStatus("warning", "Select a sequence first.");
    render();
    return;
  }
  await sequenceMediaSessionRuntime.openExistingSequence(targetPath);
}

function defaultNewSequenceName() {
  const base = String(state.projectName || "").trim() || "NewSequence";
  const cleaned = base.replace(/[^\w.\- ]+/g, "_").trim() || "NewSequence";
  return `${cleaned}.xsq`;
}

async function onNewSequence() {
  const showFolder = String(state.showFolder || "").trim();
  if (!showFolder) {
    setStatus("warning", "Set Show Directory first.");
    render();
    return;
  }
  if (!state.flags.xlightsConnected) {
    setStatus("warning", "Connect to xLights before creating a sequence.");
    render();
    return;
  }

  const targetPath = await pickSequenceSavePathFromDesktop({
    title: "Create New Sequence",
    showFolder,
    defaultName: defaultNewSequenceName()
  });
  if (!targetPath) return;

  if (state.newSequenceType === "musical" && !state.audioPathInput) {
    setStatus("warning", "Musical sequence requires an audio file path.");
    render();
    return;
  }

  setStatus("info", "Creating sequence...");
  render();
  try {
    await closeActiveSequenceForSwitch({ mode: "discard-unsaved" });
    const isAnimation = state.newSequenceType === "animation";
    const mediaFile = isAnimation ? null : (state.audioPathInput || null);
    const durationMs = isAnimation || !mediaFile ? state.newSequenceDurationMs : undefined;
    const body = await createSequence(state.endpoint, {
      file: targetPath,
      mediaFile,
      durationMs,
      frameMs: state.newSequenceFrameMs
    });
    await traceSequenceFileLifecycle("sequence.create+save", targetPath, async () => {
      await saveSequence(state.endpoint, targetPath);
      await assertSequenceFileSafeAfterSave(targetPath, "New sequence save");
      return true;
    });
    const seq = body?.data?.sequence || body?.data || {};
    state.sequencePathInput = targetPath;
    sequenceMediaSessionRuntime.applyOpenSequenceState(seq, targetPath);
    state.flags.activeSequenceLoaded = true;
    state.lastApplyBackupPath = "";
    resetCreativeState();
    setStatus("info", `Sequence ready: ${state.activeSequence || targetPath}`);
    saveCurrentProjectSnapshot();
    persist();
    render();
    await projectCatalogRuntime.refreshSequenceCatalog({ silent: true });
    await onRefresh();
  } catch (err) {
    setStatusWithDiagnostics("action-required", `Create failed: ${err.message}`, err.stack || "");
    render();
  }
}

async function onSaveSequenceCurrent() {
  if (!state.flags.xlightsConnected) {
    setStatus("warning", "Connect to xLights before saving.");
    render();
    return;
  }
  if (!state.flags.activeSequenceLoaded) {
    setStatus("warning", "No active sequence loaded.");
    render();
    return;
  }
  try {
    const targetPath = String(state.sequencePathInput || "").trim();
    await traceSequenceFileLifecycle("sequence.save", targetPath || currentSequencePathForSidecar(), () => saveSequence(state.endpoint, targetPath || null));
    if (targetPath) {
      await assertSequenceFileSafeAfterSave(targetPath, "Sequence save");
    }
    await flushSidecarPersistIfDirty(targetPath || currentSequencePathForSidecar());
    setStatus("info", "Sequence saved.");
    saveCurrentProjectSnapshot();
    persist();
    render();
  } catch (err) {
    setStatusWithDiagnostics("action-required", `Save failed: ${err.message}`, err.stack || "");
    render();
  }
}

async function onSaveSequenceAs() {
  const showFolder = String(state.showFolder || "").trim();
  if (!showFolder) {
    setStatus("warning", "Set Show Directory first.");
    render();
    return;
  }
  if (!state.flags.xlightsConnected) {
    setStatus("warning", "Connect to xLights before saving.");
    render();
    return;
  }
  if (!state.flags.activeSequenceLoaded) {
    setStatus("warning", "No active sequence loaded.");
    render();
    return;
  }

  const currentBase = String(state.sequencePathInput || "").trim().split("/").pop() || defaultNewSequenceName();
  const targetPath = await pickSequenceSavePathFromDesktop({
    title: "Save Sequence As",
    showFolder,
    defaultName: currentBase
  });
  if (!targetPath) return;

  try {
    await traceSequenceFileLifecycle("sequence.saveAs", targetPath, () => saveSequence(state.endpoint, targetPath));
    await assertSequenceFileSafeAfterSave(targetPath, "Sequence Save As");
    state.sequencePathInput = targetPath;
    state.savePathInput = targetPath;
    await flushSidecarPersistIfDirty(targetPath);
    addRecentSequence(targetPath);
    setStatus("info", `Sequence saved as: ${targetPath}`);
    saveCurrentProjectSnapshot();
    persist();
    render();
    await projectCatalogRuntime.refreshSequenceCatalog({ silent: true });
  } catch (err) {
    setStatusWithDiagnostics("action-required", `Save As failed: ${err.message}`, err.stack || "");
    render();
  }
}

function onUseRecent(path) {
  state.sequencePathInput = path;
  state.savePathInput = path;
  state.ui.sequenceMode = "existing";
  state.route = "sequence";
  saveCurrentProjectSnapshot();
  persist();
  render();
}

function normalizeSectionLabel(label) {
  return (label || "").trim();
}

function buildSectionSuggestions(marks) {
  const labels = [];
  const startByLabel = {};
  for (const mark of marks) {
    const label = normalizeSectionLabel(mark?.label);
    if (!label) continue;
    if (!labels.includes(label)) labels.push(label);
    if (
      typeof mark?.startMs === "number" &&
      !Number.isNaN(mark.startMs) &&
      !(label in startByLabel)
    ) {
      startByLabel[label] = mark.startMs;
    }
  }
  return { labels, startByLabel };
}

function getTimingTrackNames(tracks = state.timingTracks) {
  return (Array.isArray(tracks) ? tracks : [])
    .map((t) => (typeof t === "string" ? t : t?.name || ""))
    .filter((name) => name.length > 0);
}

function isXdTimingTrack(name) {
  return /^xd:/i.test((name || "").trim());
}

function getXdTimingTrackNames(tracks = state.timingTracks) {
  return getTimingTrackNames(tracks).filter((name) => isXdTimingTrack(name));
}

async function fetchSectionSuggestions(options = {}) {
  const selectedTrack = options?.selectedTrack || "";
  const refreshTracks = options?.refreshTracks !== false;
  let tracks = Array.isArray(state.timingTracks) ? state.timingTracks : [];
  if (refreshTracks || tracks.length === 0) {
    const tracksResp = await getTimingTracks(state.endpoint);
    tracks = tracksResp?.data?.tracks || [];
    state.timingTracks = tracks;
  }
  const trackNames = getTimingTrackNames(tracks);
  const xdTrackNames = getXdTimingTrackNames(tracks);

  const isSectionCandidate = (name) => /section|song|structure|phrase|form|mood|energy/i.test(name);
  const isNonSectionOperational = (name) => /proposedplan|apply|transaction|diagnostic|test/i.test(name);

  const selectedTrackValid = isXdTimingTrack(selectedTrack) ? selectedTrack : "";
  const storedTrackValid = isXdTimingTrack(state.ui.sectionTrackName) ? state.ui.sectionTrackName : "";

  const preferred =
    selectedTrackValid ||
    storedTrackValid ||
    xdTrackNames.find((name) => /^xd:\s*mock song sections$/i.test(name)) ||
    xdTrackNames.find((name) => isSectionCandidate(name) && !isNonSectionOperational(name)) ||
    xdTrackNames[0] ||
    "";

  if (!preferred) {
    state.ui.sectionTrackName = "";
    state.sectionSuggestions = [];
    state.sectionStartByLabel = {};
    return {
      track: "",
      count: 0,
      usedDefault: true,
      noXdTracks: trackNames.length > 0 && xdTrackNames.length === 0
    };
  }

  state.ui.sectionTrackName = preferred;
  const marksResp = await getTimingMarks(state.endpoint, preferred);
  const marks = marksResp?.data?.marks || [];
  if (isXdTimingTrack(preferred)) {
    const policyKey = buildGlobalXdTrackPolicyKey(preferred);
    const provenanceByTrack = getSequenceTimingTrackProvenanceState();
    const existingRecord = provenanceByTrack?.[policyKey];
    if (existingRecord && typeof existingRecord === "object" && Array.isArray(existingRecord?.source?.marks)) {
      provenanceByTrack[policyKey] = refreshTimingTrackProvenanceRecord(existingRecord, {
        userFinalMarks: marks,
        capturedAt: new Date().toISOString(),
        durationMs: Number(state.sequenceSettings?.durationMs || 0),
        fillerLabel: ""
      });
      setSequenceTimingTrackProvenanceState(provenanceByTrack);
    }
  }
  const built = buildSectionSuggestions(marks);
  const labels = built.labels;
  state.sectionSuggestions = labels;
  state.sectionStartByLabel = built.startByLabel;
  reconcileSectionSelectionsToAvailable();
  return { track: preferred, count: state.sectionSuggestions.length, usedDefault: labels.length === 0 };
}

timingTrackRuntime = createTimingTrackRuntime({
  state,
  fallbackSequenceAgentRuntime: defaultState.sequenceAgentRuntime,
  isXdTimingTrack,
  refreshSectionsForTrack: async (trackName) => fetchSectionSuggestions({ selectedTrack: trackName, refreshTracks: false }),
  setStatus,
  setStatusWithDiagnostics,
  saveCurrentProjectSnapshot,
  persist,
  render
});

agentRuntimeState = createAgentRuntimeState({
  state,
  agentRuntime,
  handoffContracts: AGENT_HANDOFF_CONTRACTS,
  isPlainObject,
  validateAgentHandoff,
  pushDiagnostic,
  getSelectedSections,
  normalizeMetadataSelectionIds,
  normalizeMetadataSelectedTags
});

projectCatalogRuntime = createProjectCatalogRuntime({
  state,
  supportedSequenceMediaExtensions: SUPPORTED_SEQUENCE_MEDIA_EXTENSIONS,
  getDesktopSequenceBridge,
  getDesktopMediaCatalogBridge,
  setStatus,
  setStatusWithDiagnostics,
  persist,
  render,
  saveCurrentProjectSnapshot,
  buildResolvedTrackIdentityForMediaMatching,
  loadPersistedTrackIdentityForMediaPath,
  resolvePreferredMediaCatalogEntry,
  setAudioPathWithAgentPolicy
});

agentSupportRuntime = createAgentSupportRuntime({
  state,
  agentRuntime,
  getDesktopTrainingPackageBridge,
  getDesktopAgentConversationBridge,
  getDesktopAgentConfigBridge,
  validateTrainingAgentRegistry,
  isPlainObject,
  refreshAgentRuntimeHealth,
  pushDiagnostic,
  setStatus,
  setStatusWithDiagnostics,
  render,
  persist,
  confirm: (message) => window.confirm(message)
});

analysisServiceRuntime = createAnalysisServiceRuntime({
  state,
  defaultAnalysisServiceUrl: DEFAULT_ANALYSIS_SERVICE_URL,
  getDesktopAudioAnalysisBridge,
  getDesktopTrainingPackageBridge,
  dirnameRelPath,
  joinRelPath,
  isPlainObject,
  persist,
  render,
  setStatusWithDiagnostics
});

audioAnalysisPipelineRuntime = createAudioAnalysisPipelineRuntime({
  state,
  basenameOfPath,
  analyzeAudioContext,
  getDesktopAudioAnalysisBridge,
  getDesktopAgentConversationBridge,
  setAudioAnalysisProgress,
  render,
  buildAnalysisArtifactFromPipelineResult,
  buildAnalysisHandoffFromArtifact,
  buildAudioAnalysisQualityReport,
  runAudioAnalysisOrchestration,
  maybePromptForMissingIdentityMetadata,
  isPlainObject,
  buildSectionSuggestions,
  areMetersCompatible,
  extractNumericCandidates,
  medianNumber,
  loadAudioTrainingPackageBundle: (...args) => analysisServiceRuntime.loadAudioTrainingPackageBundle(...args)
});

audioAnalysisSessionRuntime = createAudioAnalysisSessionRuntime({
  state,
  agentRuntime,
  setStatus,
  setStatusWithDiagnostics,
  render,
  persist,
  saveCurrentProjectSnapshot,
  setAgentActiveRole,
  beginOrchestrationRun,
  refreshAgentRuntimeHealth,
  markOrchestrationStage,
  endOrchestrationRun,
  resetAudioAnalysisView,
  buildPendingAudioAnalysisPipeline,
  setAudioAnalysisProgress,
  startAudioAnalysisProgressTicker: (...args) => audioAnalysisPipelineRuntime.startAudioAnalysisProgressTicker(...args),
  loadReusableAnalysisArtifactForProfile,
  buildAnalysisHandoffFromArtifact,
  setAgentHandoff,
  applyPersistedAnalysisArtifact,
  addStructuredChatMessage,
  buildAudioAnalystChatReply,
  getTeamChatSpeakerLabel,
  buildChatArtifactCard,
  basenameOfPath,
  maybeOfferIdentityRecommendationAction,
  buildLyricsRecoveryGuidance,
  buildAudioAnalystInput,
  executeAudioAnalystFlow,
  getDesktopAnalysisArtifactBridge,
  buildAudioAnalysisStubSummary: (...args) => audioAnalysisPipelineRuntime.buildAudioAnalysisStubSummary(...args),
  applyAudioAnalystFlowSuccessToState,
  syncSectionSuggestionsFromAnalysisArtifact,
  pushDiagnostic,
  applyAudioAnalystFlowFailureToState,
  runAudioAnalysisPipeline: (...args) => audioAnalysisPipelineRuntime.runAudioAnalysisPipeline(...args)
});

sequenceMediaSessionRuntime = createSequenceMediaSessionRuntime({
  state,
  setStatus,
  setStatusWithDiagnostics,
  render,
  persist,
  saveCurrentProjectSnapshot,
  invalidateAnalysisHandoff,
  resetDerivedAudioAnalysisState,
  hydrateAnalysisArtifactForCurrentMedia,
  hydrateAgentHealth,
  syncLatestSequenceRevision,
  refreshMetadataTargetsFromXLights,
  refreshEffectCatalogFromXLights,
  fetchSectionSuggestions,
  refreshApplyHistoryFromDesktop: (...args) => projectHistoryRuntime.refreshApplyHistoryFromDesktop(...args),
  applyRolloutPolicy,
  releaseConnectivityPlanOnly,
  enforceConnectivityPlanOnly,
  isSequenceAllowedInActiveShowFolder,
  currentSequencePathForSidecar,
  clearIgnoredExternalSequenceNote,
  clearDesignerDraft,
  clearSequencingHandoffsForSequenceChange,
  invalidateApplyApproval,
  hydrateSidecarForCurrentSequence,
  updateSequenceFileMtime,
  maybeFlushSidecarAfterExternalSave,
  noteIgnoredExternalSequence,
  pushDiagnostic,
  withTimeout,
  closeActiveSequenceForSwitch,
  traceSequenceFileLifecycle,
  openSequenceApi: openSequence,
  createSequenceApi: createSequence,
  saveSequenceApi: saveSequence,
  closeSequenceApi: closeSequence,
  getOpenSequence,
  getMediaStatus,
  selectedSequencePath,
  syncSequencePathInput,
  resetCreativeState,
  readSequencePathFromPayload,
  basenameOfPath,
  onRefreshMediaCatalog: (...args) => projectCatalogRuntime.refreshMediaCatalog(...args),
  onRefresh: () => onRefresh(),
  addRecentSequence,
  assertSequenceFileSafeAfterSave,
  resetSessionDraftState
});

projectLifecycleRuntime = createProjectLifecycleRuntime({
  state,
  app,
  defaultState,
  storageKey: STORAGE_KEY,
  projectsKey: PROJECTS_KEY,
  resetPreserveKey: RESET_PRESERVE_KEY,
  defaultTeamChatIdentities: DEFAULT_TEAM_CHAT_IDENTITIES,
  setStatus,
  setStatusWithDiagnostics,
  render,
  persist,
  saveCurrentProjectSnapshot,
  getDesktopProjectBridge,
  getDesktopAppAdminBridge,
  getDesktopStateBridge,
  hydrateAnalysisArtifactForCurrentMedia,
  onRefreshSequenceCatalog: (...args) => projectCatalogRuntime.refreshSequenceCatalog(...args),
  onRefreshMediaCatalog: (...args) => projectCatalogRuntime.refreshMediaCatalog(...args),
  applyProjectSnapshot,
  parseProjectKey,
  loadProjectsStore,
  persistProjectsStore,
  extractProjectSnapshot,
  saveProjectToCurrentFile,
  resetSessionDraftState,
  resetCreativeState,
  buildTeamChatIdentities,
  getProjectKey,
  confirm: (message) => window.confirm(message),
  reload: () => window.location.reload()
});

projectHistoryRuntime = createProjectHistoryRuntime({
  state,
  getDesktopProjectArtifactBridge,
  getDesktopAgentLogBridge,
  pushDiagnostic,
  buildCurrentDesignSceneContext,
  buildCurrentMusicDesignContext,
  getValidHandoff,
  currentApplyContext,
  buildHistoryEntry,
  currentArtifactRefs,
  buildHistorySnapshotSummary,
  getSelectedSections,
  normalizeMetadataSelectionIds,
  persist,
  render
});

applyReadinessRuntime = createApplyReadinessRuntime({
  state,
  getValidHandoff,
  buildTimingTrackStatusRows,
  getSequenceTimingTrackProvenanceState,
  getSequenceTimingGeneratedSignaturesState,
  getSequenceTimingTrackPoliciesState,
  isXdTimingTrack,
  buildSequenceSession,
  getAgentApplyRolloutMode,
  estimateImpactCount,
  filteredProposed: () => applyReviewRuntime?.filteredProposed?.() || []
});

applyReviewRuntime = createApplyReviewRuntime({
  state,
  hasAllSectionsSelected,
  getSelectedSections,
  getSectionChoiceList,
  getSectionName,
  buildDesignerPlanCommandsFromLines,
  estimateImpactCount,
  currentSequencePathForSidecar,
  getDesktopFileStatBridge,
  applyEnabled: () => applyReadinessRuntime.applyEnabled(),
  applyDisabledReason: () => applyReadinessRuntime.applyDisabledReason(),
  syncLatestSequenceRevision,
  pushDiagnostic,
  evaluateApplyHandoffGate: () => applyReadinessRuntime.evaluateApplyHandoffGate(),
  getValidHandoffRecord,
  getValidHandoff,
  setStatus,
  setStatusWithDiagnostics,
  render,
  requiresApplyConfirmation: () => applyReadinessRuntime.requiresApplyConfirmation(),
  confirm: (message) => window.confirm(message),
  setAgentActiveRole,
  beginOrchestrationRun,
  addChatMessage,
  executeApplyCore,
  saveCurrentProjectSnapshot,
  persist,
  persistCurrentArtifactsForHistory: (...args) => projectHistoryRuntime.persistCurrentArtifactsForHistory(...args),
  pushApplyHistory: (...args) => projectHistoryRuntime.pushApplyHistory(...args),
  appendDesktopApplyLog: (...args) => projectHistoryRuntime.appendDesktopApplyLog(...args),
  refreshApplyHistoryFromDesktop: (...args) => projectHistoryRuntime.refreshApplyHistoryFromDesktop(...args),
  currentSequencePathForSidecar,
  getDesktopBackupBridge,
  buildSequenceAgentInput,
  currentLayoutMode,
  normalizeMetadataSelectionIds,
  normalizeMetadataSelectedTags,
  getSequenceTimingOwnershipRows,
  getManualLockedXdTracks,
  validateSequenceAgentContractGate,
  arraysEqualOrdered,
  validateCommandGraph,
  buildSequenceAgentPlan,
  emitSequenceAgentStageTelemetry,
  evaluateSequencePlanCapabilities,
  isXdTimingTrack,
  timingMarksSignature,
  buildGlobalXdTrackPolicyKey,
  validateAndApplyPlan,
  verifyAppliedPlanReadback,
  buildSequenceAgentApplyResult,
  classifyOrchestrationFailureReason,
  getSequenceTimingTrackPoliciesState,
  getSequenceTimingGeneratedSignaturesState,
  setSequenceTimingTrackPoliciesState,
  setSequenceTimingGeneratedSignaturesState,
  applyAcceptedProposalToDirectorProfile,
  buildApplyHistoryEntry: (...args) => projectHistoryRuntime.buildApplyHistoryEntry(...args),
  buildChatArtifactCard,
  getTeamChatSpeakerLabel,
  buildEffectiveMetadataAssignments,
  getRevision,
  validateCommands,
  beginTransaction,
  commitTransaction,
  rollbackTransaction,
  stageTransactionCommand,
  pushSequenceAgentContractDiagnostic,
  markOrchestrationStage,
  endOrchestrationRun,
  upsertJob,
  bumpVersion,
  addStructuredChatMessage
});

proposalGenerationRuntime = createProposalGenerationRuntime({
  state,
  setStatus,
  setStatusWithDiagnostics,
  render,
  persist,
  saveCurrentProjectSnapshot,
  pushDiagnostic,
  addStructuredChatMessage,
  addChatMessage,
  getTeamChatSpeakerLabel,
  getDesktopBridge,
  getOpenSequence,
  isSequenceAllowedInActiveShowFolder,
  clearIgnoredExternalSequenceNote,
  noteIgnoredExternalSequence,
  applyOpenSequenceState: (...args) => sequenceMediaSessionRuntime.applyOpenSequenceState(...args),
  buildSequenceSession,
  explainSequenceSessionBlockers,
  getBlockingTimingReviewRows: (...args) => applyReadinessRuntime.getBlockingTimingReviewRows(...args),
  syncLatestSequenceRevision,
  setAgentActiveRole,
  beginOrchestrationRun,
  markOrchestrationStage,
  endOrchestrationRun,
  invalidateApplyApproval,
  latestUserIntentText,
  normalizeDesignRevisionTarget,
  buildRevisionPromptText,
  ensureCurrentAnalysisHandoff,
  getValidHandoff,
  buildCurrentDesignSceneContext,
  buildCurrentMusicDesignContext,
  inferPromptSectionSelection,
  hasAllSectionsSelected,
  getSectionChoiceList,
  getSelectedSections,
  shouldCarryDesignerSelectionContext,
  buildRecentChatHistory,
  buildDesignerCloudConversationContext,
  isPlainObject,
  executeDirectSequenceRequestOrchestration,
  executeDesignerProposalOrchestration,
  buildEffectiveMetadataAssignments,
  collectCurrentDesignIds,
  buildSupersededConceptRecordById,
  applyRevisionTargetToOrchestration,
  buildDesignDisplay,
  ensureRevisionTargetAppliedToOrchestration,
  applyDesignerDraftSuccessState,
  applyDesignerProposalSuccessToState,
  currentSequencePathForSidecar,
  applyRevisionTargetToCurrentDesignerState,
  hydrateIntentHandoffExecutionStrategy,
  retagExecutionPlanForRevisionTarget,
  rebuildProposalBundleFromExecutionPlan,
  setAgentHandoff,
  clearAgentHandoff,
  buildDesignerExecutionSeedLines,
  shouldUseExecutionStrategySeedLines,
  buildSequenceAgentInput,
  currentLayoutMode,
  getSequenceTimingOwnershipRows,
  getManualLockedXdTracks,
  validateSequenceAgentContractGate,
  pushSequenceAgentContractDiagnostic,
  buildSequenceAgentPlan,
  emitSequenceAgentStageTelemetry,
  estimateImpactCount,
  buildArtifactId,
  validateCommandGraph,
  mergeCreativeBriefIntoProposal,
  upsertSupersededConceptRecord,
  buildDesignerGuidedQuestionMessage,
  buildDesignerCompletionMessage,
  buildChatArtifactCard,
  clearDesignRevisionTarget,
  normalizeMetadataSelectionIds,
  normalizeMetadataSelectedTags,
  clearDesignerDraft
});

async function onRefreshModels() {
  if (!state.flags.xlightsConnected) {
    setStatusWithDiagnostics("warning", "Connect to xLights before refreshing models.");
    return render();
  }
  setStatus("info", "Refreshing models...");
  render();
  try {
    await refreshMetadataTargetsFromXLights({ warnOnSubmodelFailure: true });
    const targetCount = buildMetadataTargets().length;
    const submodelCount = buildMetadataTargets().filter((target) => target.type === "submodel").length;
    if (state.health?.submodelDiscoveryError) {
      setStatusWithDiagnostics(
        "warning",
        `Loaded ${state.models.length} models/groups; submodels unavailable (${state.health.submodelDiscoveryError}).`
      );
    } else {
      setStatus(
        "info",
        `Loaded ${state.models.length} models/groups and ${submodelCount} submodels (${targetCount} metadata targets total).`
      );
    }
  } catch (err) {
    setStatusWithDiagnostics("action-required", `Refresh models failed: ${err.message}`);
  } finally {
    saveCurrentProjectSnapshot();
    persist();
    render();
  }
}

function resetSessionDraftState() {
  clearDesignerDraft(state);
  clearDesignRevisionTarget();
  clearSequenceDesignFilter();
  state.ui.detailsOpen = false;
  state.ui.sectionSelections = ["all"];
  state.ui.designTab = "chat";
  state.ui.sectionTrackName = "";
  state.ui.applyApprovalChecked = false;
  state.ui.agentResponseId = "";
  state.proposed = [];
  state.agentPlan = null;
  clearAgentHandoffs();
}

function resetCreativeState() {
  revokeReferencePreviewUrls();
  state.creative = structuredClone(defaultState.creative);
  state.audioAnalysis = structuredClone(defaultState.audioAnalysis);
  state.sequenceAgentRuntime = structuredClone(defaultState.sequenceAgentRuntime);
  state.flags.creativeBriefReady = false;
}

async function onAnalyzeAudio({
  userPrompt = "",
  analysisProfile = null,
  forceFresh = false,
  disableInteractivePrompts = false
} = {}) {
  return audioAnalysisSessionRuntime.analyzeAudio({
    userPrompt,
    analysisProfile,
    forceFresh,
    disableInteractivePrompts
  });
}

async function onCloseSequence() {
  return sequenceMediaSessionRuntime.closeSequenceWithPrompt({
    confirm: (message) => window.confirm(message)
  });
}

async function onRestoreLastBackup() {
  const backupBridge = getDesktopBackupBridge();
  if (!backupBridge || typeof backupBridge.restoreSequenceBackup !== "function") {
    setStatusWithDiagnostics("warning", "Backup restore is available in desktop runtime only.");
    return render();
  }
  if (!state.flags.xlightsConnected) {
    setStatusWithDiagnostics("warning", "Connect to xLights before restoring a backup.");
    return render();
  }
  const sequencePath = selectedSequencePath() || currentSequencePathForSidecar();
  const backupPath = String(state.lastApplyBackupPath || "").trim();
  if (!sequencePath) {
    setStatusWithDiagnostics("warning", "Select/open a sequence before restoring backup.");
    return render();
  }
  if (!backupPath) {
    setStatusWithDiagnostics("warning", "No backup is available for restore yet.");
    return render();
  }
  if (!window.confirm(`Restore last backup for this sequence?\n\nBackup: ${backupPath}`)) {
    setStatus("info", "Restore canceled.");
    return render();
  }

  setStatus("info", "Restoring sequence backup...");
  render();
  try {
    await closeActiveSequenceForSwitch();
    const restore = await backupBridge.restoreSequenceBackup({ sequencePath, backupPath });
    if (restore?.ok !== true) {
      throw new Error(restore?.error || "Unknown restore error");
    }
    await openSequence(state.endpoint, sequencePath, false, false);
    await onRefresh();
    resetSessionDraftState();
    setStatusWithDiagnostics("info", `Backup restored from ${backupPath}.`);
  } catch (err) {
    setStatusWithDiagnostics("action-required", `Backup restore failed: ${err.message}`, err.stack || "");
  } finally {
    saveCurrentProjectSnapshot();
    persist();
    render();
  }
}

function onNewSession() {
  if (!window.confirm("Start a new session and clear current draft state?")) {
    setStatus("info", "New session canceled.");
    return render();
  }
  resetSessionDraftState();
  resetCreativeState();
  setStatus("info", "New session started. Draft cleared.");
  saveCurrentProjectSnapshot();
  persist();
  render();
}

function buildPageStateHelpers() {
  return uiCompositionRuntime.buildPageStateHelpers();
}

async function runCurrentDirectSequenceValidation(expected = {}) {
  return runDirectSequenceValidation({
    endpoint: state.endpoint,
    state,
    handoffs: {
      analysisHandoff: agentRuntimeState.getValidHandoff("analysis_handoff_v1"),
      intentHandoff: agentRuntimeState.getValidHandoff("intent_handoff_v1"),
      planHandoff: agentRuntimeState.getValidHandoff("plan_handoff_v1")
    },
    helpers: buildPageStateHelpers(),
    expected,
    deps: {
      listEffects
    }
  });
}

function getCurrentDirectSequenceValidationSnapshot() {
  return {
    endpoint: state.endpoint,
    pageStates: uiCompositionRuntime.getPageStates(),
    activeSequence: state.activeSequence || "",
    handoffs: {
      analysisHandoff: agentRuntimeState.getValidHandoff("analysis_handoff_v1"),
      intentHandoff: agentRuntimeState.getValidHandoff("intent_handoff_v1"),
      planHandoff: agentRuntimeState.getValidHandoff("plan_handoff_v1")
    }
  };
}

const automationRuntime = createAutomationBridgeRuntime({
  state,
  agentRuntime,
  onSendChat,
  onGenerate,
  onApplyAll,
  onRefresh,
  onAnalyzeAudio,
  onSeedTimingTracksFromAnalysis,
  onOpenExistingSequence: (...args) => sequenceMediaSessionRuntime.openExistingSequence(...args),
  setAudioPath: (...args) => sequenceMediaSessionRuntime.setAudioPathWithAgentPolicy(...args),
  onRefreshSequenceCatalog: (...args) => projectCatalogRuntime.refreshSequenceCatalog(...args),
  adoptMediaDirectoryFromPath: (...args) => sequenceMediaSessionRuntime.adoptMediaDirectoryFromPath(...args),
  onRefreshMediaCatalog: (...args) => projectCatalogRuntime.refreshMediaCatalog(...args),
  clearDesignRevisionTarget,
  normalizeDesignRevisionTarget,
  clearDesignerDraft,
  clearSequencingHandoffsForSequenceChange,
  buildSupersededConceptRecordById,
  retagExecutionPlanForRevisionTarget,
  getExecutionPlanFromArtifacts,
  rebuildProposalBundleFromExecutionPlan,
  setAgentHandoff,
  upsertSupersededConceptRecord,
  isPlainObject,
  buildCurrentDesignSceneContext,
  buildCurrentMusicDesignContext,
  executeDesignerProposalOrchestration,
  getValidHandoff,
  filteredProposed: () => applyReviewRuntime.filteredProposed(),
  arraysEqualOrdered,
  buildSequenceAgentPlan,
  validateCommandGraph,
  buildOwnedSequencingBatchPlan,
  getOwnedHealth,
  currentLayoutMode,
  getSequenceTimingOwnershipRows,
  applyReadyForApprovalGate: () => applyReadinessRuntime.applyReadyForApprovalGate(),
  definePersistedVisualHint,
  persist,
  render,
  setStatus,
  runCurrentDirectSequenceValidation,
  getCurrentDirectSequenceValidationSnapshot,
  getPageStates: () => uiCompositionRuntime.getPageStates()
});

const {
  dispatchAutomationPrompt,
  generateAutomationProposal,
  applyAutomationCurrentProposal,
  diagnoseAutomationCurrentProposal,
  getAutomationComparativeValidationSnapshot,
  refreshAutomationFromXLights,
  analyzeAutomationAudio,
  seedAutomationTimingTracksFromAnalysis,
  defineAutomationVisualHint,
  openAutomationSequence,
  setAutomationAudioPath,
  getAutomationAgentRuntimeSnapshot,
  getAutomationPageStatesSnapshot,
  getAutomationSequencerValidationSnapshot
} = automationRuntime;

uiCompositionRuntime = createUiCompositionRuntime({
  state,
  getValidHandoff,
  buildNormalizedTargetMetadataRecords,
  buildEffectiveMetadataAssignments,
  helpers: {
    basenameOfPath,
    getSelectedSections,
    hasAllSectionsSelected,
    getSectionName,
    selectedProposedLinesForApply: () => applyReviewRuntime.selectedProposedLinesForApply(),
    summarizeImpactForLines,
    buildDesignerPlanCommands: (...args) => applyReviewRuntime.buildDesignerPlanCommands(...args),
    applyReadyForApprovalGate: () => applyReadinessRuntime.applyReadyForApprovalGate(),
    applyDisabledReason: () => applyReadinessRuntime.applyDisabledReason(),
    buildCurrentReviewSnapshotSummary: () => projectHistoryRuntime.buildCurrentReviewSnapshotSummary(),
    getMetadataTagRecords,
    buildMetadataTargets,
    matchesMetadataFilterValue,
    normalizeMetadataSelectionIds,
    normalizeMetadataSelectedTags,
    getAgentApplyRolloutMode,
    getManualLockedXdTracks,
    getTeamChatIdentities,
    getDiagnosticsCounts,
    getAnalysisServiceHeaderBadgeText,
    escapeHtml,
    referenceFormatSummaryText,
    sequenceEligibilityFormatSummaryText,
    formatBytes,
    referenceMediaMaxFileBytes: REFERENCE_MEDIA_MAX_FILE_BYTES,
    referenceMediaMaxItems: REFERENCE_MEDIA_MAX_ITEMS,
    getSections,
    sanitizeProposedSelection,
    getProposedPayloadPreviewText,
    renderProposedLineHtml,
    applyPlanReadinessReason: () => applyReadinessRuntime.applyPlanReadinessReason(),
    applyEnabled: () => applyReadinessRuntime.applyEnabled(),
    getMetadataOrphans,
    ensureVersionSnapshots,
    versionById
  }
});

function bindEvents() {
  app.querySelectorAll("[data-route]").forEach((btn) => {
    btn.addEventListener("click", () => setRoute(btn.dataset.route));
  });

  const toggleNavBtn = app.querySelector("#toggle-nav");
  if (toggleNavBtn) {
    toggleNavBtn.addEventListener("click", () => {
      state.ui.navCollapsed = !Boolean(state.ui.navCollapsed);
      persist();
      render();
    });
  }

  const openDiagnosticsBtn = app.querySelector("#open-diagnostics");
  if (openDiagnosticsBtn) {
    openDiagnosticsBtn.addEventListener("click", () => toggleDiagnostics(true));
  }

  const closeDiagnosticsBtn = app.querySelector("#close-diagnostics");
  if (closeDiagnosticsBtn) {
    closeDiagnosticsBtn.addEventListener("click", () => toggleDiagnostics(false));
  }

  const projectNameDialogCancelBtn = app.querySelector("#project-name-dialog-cancel");
  if (projectNameDialogCancelBtn) {
    projectNameDialogCancelBtn.addEventListener("click", () => {
      if (state.ui.projectNameDialogMode === "create") {
        setStatus("info", "Create project canceled.");
      } else if (state.ui.projectNameDialogMode === "saveAs") {
        setStatus("info", "Save As canceled.");
      }
      projectLifecycleRuntime.closeProjectNameDialog();
    });
  }

  const projectNameDialogConfirmBtn = app.querySelector("#project-name-dialog-confirm");
  if (projectNameDialogConfirmBtn) {
    projectNameDialogConfirmBtn.addEventListener("click", () => {
      void projectLifecycleRuntime.confirmProjectNameDialog();
    });
  }

  const projectNameDialogInput = app.querySelector("#project-name-dialog-input");
  if (projectNameDialogInput) {
    projectNameDialogInput.addEventListener("input", () => {
      state.ui.projectNameDialogValue = projectNameDialogInput.value;
      state.ui.projectNameDialogError = "";
      persist();
    });
    projectNameDialogInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void projectLifecycleRuntime.confirmProjectNameDialog();
      } else if (event.key === "Escape") {
        event.preventDefault();
        projectLifecycleRuntime.closeProjectNameDialog();
      }
    });
  }

  const closeJobsBtn = app.querySelector("#close-jobs");
  if (closeJobsBtn) closeJobsBtn.addEventListener("click", () => toggleJobs(false));

  const clearDiagnosticsBtn = app.querySelector("#clear-diagnostics");
  if (clearDiagnosticsBtn) clearDiagnosticsBtn.addEventListener("click", clearDiagnostics);

  const resetAppInstallStateBtn = app.querySelector("#reset-app-install-state");
  if (resetAppInstallStateBtn) {
    resetAppInstallStateBtn.addEventListener("click", () => {
      void projectLifecycleRuntime.resetAppInstallState();
    });
  }

  const exportDiagnosticsBtn = app.querySelector("#export-diagnostics");
  if (exportDiagnosticsBtn) exportDiagnosticsBtn.addEventListener("click", onExportDiagnostics);

  app.querySelectorAll("[data-diag-filter]").forEach((btn) => {
    btn.addEventListener("click", () => setDiagnosticsFilter(btn.dataset.diagFilter));
  });

  bindTeamChatEvents({
    app,
    state,
    quickPrompts: getRouteChatQuickPrompts(state.route),
    persist,
    render,
    onSendChat,
    onUseQuickPrompt
  });

  const applySelectedBtn = app.querySelector("#apply-selected");
  if (applySelectedBtn) applySelectedBtn.addEventListener("click", onApplySelected);

  const applyAllBtn = app.querySelector("#apply-all");
  if (applyAllBtn) applyAllBtn.addEventListener("click", onApplyAll);

  const mobileApplyAllBtn = app.querySelector("#mobile-apply-all");
  if (mobileApplyAllBtn) mobileApplyAllBtn.addEventListener("click", onApplyAll);

  const applyApprovalCheckbox = app.querySelector("#apply-approval-checkbox");
  if (applyApprovalCheckbox) {
    applyApprovalCheckbox.addEventListener("change", () => {
      state.ui.applyApprovalChecked = Boolean(applyApprovalCheckbox.checked);
      persist();
      render();
    });
  }

  const restoreLastBackupBtn = app.querySelector("#restore-last-backup");
  if (restoreLastBackupBtn) restoreLastBackupBtn.addEventListener("click", onRestoreLastBackup);

  const openDetailsBtn = app.querySelector("#open-details");
  if (openDetailsBtn) openDetailsBtn.addEventListener("click", openDetails);

  const closeDetailsBtn = app.querySelector("#close-details");
  if (closeDetailsBtn) closeDetailsBtn.addEventListener("click", closeDetails);

  const drawerApplyBtn = app.querySelector("#drawer-apply");
  if (drawerApplyBtn) drawerApplyBtn.addEventListener("click", onApplyAll);

  const splitSectionBtn = app.querySelector("#split-section");
  if (splitSectionBtn) splitSectionBtn.addEventListener("click", splitBySection);

  const discardDraftBtn = app.querySelector("#discard-draft");
  if (discardDraftBtn) discardDraftBtn.addEventListener("click", onCancelDraft);

  const discardDraftInlineBtn = app.querySelector("#discard-draft-inline");
  if (discardDraftInlineBtn) discardDraftInlineBtn.addEventListener("click", onCancelDraft);

  const planBtn = app.querySelector("#plan-toggle");
  if (planBtn) planBtn.addEventListener("click", onTogglePlanOnly);

  const connectionBtn = app.querySelector("#test-connection");
  if (connectionBtn) connectionBtn.addEventListener("click", onTestConnection);

  const endpointInput = app.querySelector("#endpoint-input");
  if (endpointInput) {
    endpointInput.addEventListener("change", () => {
      state.endpoint = normalizeConfiguredEndpoint(endpointInput.value);
      persist();
    });
  }

  const confirmModeInput = app.querySelector("#confirm-mode-input");
  if (confirmModeInput) {
    confirmModeInput.addEventListener("change", () => {
      state.safety.applyConfirmMode = confirmModeInput.value;
      persist();
    });
  }

  const thresholdInput = app.querySelector("#threshold-input");
  if (thresholdInput) {
    thresholdInput.addEventListener("change", () => {
      const parsed = Number.parseInt(thresholdInput.value, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        state.safety.largeChangeThreshold = parsed;
        persist();
      }
    });
  }

  const sequenceSwitchPolicyInput = app.querySelector("#sequence-switch-policy-input");
  if (sequenceSwitchPolicyInput) {
    sequenceSwitchPolicyInput.addEventListener("change", () => {
      state.safety.sequenceSwitchUnsavedPolicy =
        sequenceSwitchPolicyInput.value === "discard-unsaved" ? "discard-unsaved" : "save-if-needed";
      persist();
    });
  }

  const agentApplyRolloutInput = app.querySelector("#agent-apply-rollout-input");
  if (agentApplyRolloutInput) {
    agentApplyRolloutInput.addEventListener("change", () => {
      const next = String(agentApplyRolloutInput.value || "").trim();
      state.safety.agentApplyRollout =
        next === "plan-only" || next === "disabled" ? next : "full";
      const rollout = applyRolloutPolicy();
      if (rollout.mode === "full") {
        setStatus("info", "Agent apply rollout set to full mode.");
      } else if (rollout.mode === "plan-only") {
        setStatus("info", "Agent apply rollout set to plan-only mode.");
      } else {
        setStatus("info", "Agent apply rollout set to disabled.");
      }
      persist();
      render();
    });
  }

  const agentBaseUrlInput = app.querySelector("#agent-base-url-input");
  if (agentBaseUrlInput) {
    agentBaseUrlInput.addEventListener("input", () => {
      state.ui.agentBaseUrlDraft = String(agentBaseUrlInput.value || "");
      persist();
    });
  }

  const agentModelInput = app.querySelector("#agent-model-input");
  if (agentModelInput) {
    agentModelInput.addEventListener("input", () => {
      state.ui.agentModelDraft = String(agentModelInput.value || "");
      persist();
    });
  }

  const agentApiKeyInput = app.querySelector("#agent-api-key-input");
  if (agentApiKeyInput) {
    agentApiKeyInput.addEventListener("input", () => {
      state.ui.agentApiKeyDraft = String(agentApiKeyInput.value || "");
      persist();
    });
  }

  const nicknameBindings = [
    ["#nickname-app-assistant", "app_assistant"],
    ["#nickname-audio-analyst", "audio_analyst"],
    ["#nickname-designer-dialog", "designer_dialog"],
    ["#nickname-sequence-agent", "sequence_agent"]
  ];
  for (const [selector, roleId] of nicknameBindings) {
    const input = app.querySelector(selector);
    if (!input) continue;
    input.addEventListener("input", () => {
      setTeamChatNickname(roleId, input.value);
      persist();
      render();
    });
  }

  const analysisServiceUrlInput = app.querySelector("#analysis-service-url-input");
  if (analysisServiceUrlInput) {
    analysisServiceUrlInput.addEventListener("input", () => {
      state.ui.analysisServiceUrlDraft = String(analysisServiceUrlInput.value || "");
      persist();
      void analysisServiceRuntime.probeAnalysisServiceHealth({ quiet: true });
    });
  }

  const analysisServiceApiKeyInput = app.querySelector("#analysis-service-api-key-input");
  if (analysisServiceApiKeyInput) {
    analysisServiceApiKeyInput.addEventListener("input", () => {
      state.ui.analysisServiceApiKeyDraft = String(analysisServiceApiKeyInput.value || "");
      persist();
      void analysisServiceRuntime.probeAnalysisServiceHealth({ quiet: true });
    });
  }
  const analysisServiceBearerInput = app.querySelector("#analysis-service-bearer-input");
  if (analysisServiceBearerInput) {
    analysisServiceBearerInput.addEventListener("input", () => {
      state.ui.analysisServiceAuthBearerDraft = String(analysisServiceBearerInput.value || "");
      persist();
      void analysisServiceRuntime.probeAnalysisServiceHealth({ quiet: true });
    });
  }

  const saveAgentConfigBtn = app.querySelector("#save-agent-config");
  if (saveAgentConfigBtn) saveAgentConfigBtn.addEventListener("click", onSaveAgentConfig);

  const clearAgentKeyBtn = app.querySelector("#clear-agent-key");
  if (clearAgentKeyBtn) clearAgentKeyBtn.addEventListener("click", onClearStoredAgentApiKey);

  const testAgentCloudBtn = app.querySelector("#test-agent-cloud");
  if (testAgentCloudBtn) testAgentCloudBtn.addEventListener("click", onTestCloudAgent);
  const testAgentOrchestrationBtn = app.querySelector("#test-agent-orchestration");
  if (testAgentOrchestrationBtn) testAgentOrchestrationBtn.addEventListener("click", onTestAgentOrchestration);
  const testAgentOrchestrationMatrixBtn = app.querySelector("#test-agent-orchestration-matrix");
  if (testAgentOrchestrationMatrixBtn) testAgentOrchestrationMatrixBtn.addEventListener("click", onRunOrchestrationMatrix);
  const clearXdTrackLocksBtn = app.querySelector("#clear-xd-track-locks");
  if (clearXdTrackLocksBtn) clearXdTrackLocksBtn.addEventListener("click", onClearXdTrackLocks);

  bindScreenEvents({
    app,
    state,
    persist,
    render,
    setStatus,
    saveCurrentProjectSnapshot,
    setAudioPathWithAgentPolicy: (...args) => sequenceMediaSessionRuntime.setAudioPathWithAgentPolicy(...args),
    onSaveProjectSettings,
    onOpenSelectedProject: (...args) => projectLifecycleRuntime.openSelectedProject(...args),
    onCreateNewProject: (...args) => projectLifecycleRuntime.createNewProject(...args),
    onSaveProjectAs: (...args) => projectLifecycleRuntime.saveProjectAs(...args),
    onResetProjectWorkspace: (...args) => projectLifecycleRuntime.resetProjectWorkspace(...args),
    onBrowseProjectMetadataRoot,
    onOpenSelectedSequence,
    onNewSequence,
    onSaveSequenceCurrent,
    onSaveSequenceAs,
    onSelectCatalogSequence,
    onBrowseShowFolder,
    onBrowseMediaFolder,
    onRefreshMediaCatalog: (...args) => projectCatalogRuntime.refreshMediaCatalog(...args),
    onNewSession,
    onReferenceMediaSelected,
    addPaletteSwatch,
    onRunCreativeAnalysis,
    onAnalyzeAudio,
    onRegenerateCreativeBrief,
    onAcceptCreativeBrief,
    onEditBriefDirection,
    onRemoveReferenceMedia,
    onPreviewReferenceMedia,
    onToggleReferenceEligible,
    removePaletteSwatch,
    onRefreshModels,
    addMetadataTag,
    applyTagsToSelectedMetadataTargets,
    removeTagsFromSelectedMetadataTargets,
    clearMetadataSelectedTags,
    selectAllMetadataTargets,
    clearMetadataSelection,
    toggleMetadataSelectedTag,
    updateMetadataTagDescription,
    toggleMetadataSelectionId,
    removeMetadataTag,
    removeMetadataAssignment,
    setMetadataFocusedTarget,
    updateMetadataTargetRolePreference,
    updateMetadataTargetSemanticHints,
    updateMetadataTargetSubmodelHints,
    updateMetadataTargetEffectAvoidances,
    addMetadataTargetSemanticHint,
    removeMetadataTargetSemanticHint,
    addMetadataTargetSubmodelHint,
    removeMetadataTargetSubmodelHint,
    addMetadataTargetEffectAvoidance,
    removeMetadataTargetEffectAvoidance,
    bulkSetMetadataRolePreference,
    bulkAddMetadataSemanticHint,
    bulkAddMetadataEffectAvoidance,
    ignoreMetadataOrphan,
    remapMetadataOrphan,
    onUseRecent,
    onRefresh,
    onRegenerate,
    onCancelDraft,
    onRefreshAndRegenerate,
    onRebaseDraft,
    setSectionFilter,
    setDesignTab,
    onInspectDesignConcept,
    onReviseDesignConcept,
    onRemoveDesignConcept,
    onRemoveSelectedProposed,
    onRemoveAllProposed,
    toggleProposedSelection,
    toggleProposedSelectionGroup,
    removeProposedLine,
    updateProposedLine,
    onCancelJob,
    insertModelIntoDraft,
    onRollbackToVersion,
    onCompareVersion,
    onReapplyVariant,
    onSelectHistoryEntry,
    onInspectArtifact,
    onCloseArtifactDetail,
    onAcceptTimingTrackReview
  });
}

function render() {
  normalizeUiRoute();
  const focusSnapshot = captureRenderFocusState();
  const buildLabel = getBuildLabel();
  const analysisHeaderBadge = getAnalysisServiceHeaderBadgeText();
  const pageStates = uiCompositionRuntime.getPageStates();
  try {
    app.innerHTML = buildAppShell({
      state,
      screenContent: uiCompositionRuntime.screenContent(pageStates),
      helpers: {
        escapeHtml,
        renderInlineChipSentence,
        getTeamChatIdentity,
        getTeamChatSpeakerLabel,
        getSections,
        getSelectedSections,
        hasAllSectionsSelected,
        getSectionName,
        applyReadyForApprovalGate: () => applyReadinessRuntime.applyReadyForApprovalGate(),
        applyEnabled: () => applyReadinessRuntime.applyEnabled(),
        applyDisabledReason: () => applyReadinessRuntime.applyDisabledReason(),
        getDiagnosticsCounts,
        getAgentApplyRolloutMode,
        getManualLockedXdTracks,
        getTeamChatIdentities,
        chatQuickPrompts: getRouteChatQuickPrompts(state.route),
        chatPlaceholder: getRouteChatPlaceholder(state.route),
        chatContext: getRouteChatContext(),
        analysisHeaderBadge,
        buildLabel,
        pageStates
      }
    });

    bindEvents();
    restoreRenderFocusState(focusSnapshot);
    const chatThread = app.querySelector(".chat-thread");
    if (chatThread) {
      chatThread.scrollTop = chatThread.scrollHeight;
    }
  } catch (error) {
    const message = String(error?.stack || error?.message || error || "Unknown render error");
    console.error(`[renderer:render] ${message}`);
    app.innerHTML = `
      <div class="app-shell">
        <div class="main-grid">
          <div class="main-shell">
            <main class="content">
              <section class="card full-span">
                <div class="artifact-kicker">Renderer Error</div>
                <h3>The app could not render this screen.</h3>
                <pre class="artifact-body" style="white-space: pre-wrap;">${escapeHtml(message)}</pre>
              </section>
            </main>
          </div>
        </div>
      </div>
    `;
  }
}

automationRuntime.exposeRuntimeValidationHooks();

async function bootstrapLiveData() {
  try {
    await agentSupportRuntime.hydrateAgentHealth();
    await agentSupportRuntime.hydrateAgentRuntime({ quiet: true });
    applyRolloutPolicy();
    const requestedEndpoint = state.endpoint;
    const { endpoint, caps } = await resolveReachableEndpoint(requestedEndpoint);
    const endpointChanged = endpoint !== requestedEndpoint;
    state.endpoint = endpoint;
    const releasedForce = releaseConnectivityPlanOnly();
    const { compat, xlightsVersion } = applyCapabilitiesHealth(caps, state.health.sequenceOpen);
    if (endpointChanged) {
      setStatus("info", `Connected via fallback endpoint ${endpoint}.`);
    }
    if (compat === false) {
      setStatusWithDiagnostics(
        "action-required",
        `xLights ${xlightsVersion} is below minimum supported floor 2026.1. Mutating actions are disabled.`
      );
    }
    await onRefresh();
    await projectHistoryRuntime.refreshApplyHistoryFromDesktop(40);
    if (releasedForce) {
      setStatus("info", "xLights reachable again. Plan-only remains enabled until you turn it off.");
    }
  } catch {
    const bridgeHealth = getDesktopBridgeHealth();
    state.flags.xlightsConnected = false;
    state.flags.xlightsCompatible = true;
    enforceConnectivityPlanOnly();
    state.health.runtimeReady = bridgeHealth.runtimeReady;
    state.health.desktopFileDialogReady = bridgeHealth.desktopFileDialogReady;
    state.health.desktopBridgeApiCount = bridgeHealth.desktopBridgeApiCount;
    state.health.xlightsVersion = "";
    state.health.compatibilityStatus = "unknown";
    setStatus("warning", "Unable to reach xLights. Start xLights and check endpoint settings.");
    persist();
    render();
  }
}

render();
(async () => {
  try {
    const preservedRaw = sessionStorage.getItem(RESET_PRESERVE_KEY);
    if (preservedRaw) {
      localStorage.setItem(STORAGE_KEY, preservedRaw);
      sessionStorage.removeItem(RESET_PRESERVE_KEY);
    }
  } catch {
    // Ignore temporary reset-preserve storage failures.
  }
  await hydrateStateFromDesktop();
  await hydrateDesktopAppInfo();
  await agentSupportRuntime.hydrateAgentHealth();
  await agentSupportRuntime.hydrateAgentRuntime({ quiet: true });
  await agentSupportRuntime.hydrateAgentConfigDraft();
  await analysisServiceRuntime.probeAnalysisServiceHealth({ quiet: true, force: true });
  applyRolloutPolicy();
  await projectHistoryRuntime.refreshApplyHistoryFromDesktop(40);
  if (String(state.mediaPath || "").trim()) {
    await projectCatalogRuntime.refreshMediaCatalog({ silent: true });
  }
  render();
  if (!state.ui.firstRunMode) {
    await bootstrapLiveData();
  } else {
    state.route = "settings";
    state.flags.xlightsConnected = false;
    state.flags.activeSequenceLoaded = false;
    state.activeSequence = "";
    state.health.sequenceOpen = false;
    setStatus("info", "Welcome. Start in Settings, then create or open a project when you are ready.");
    persist();
    render();
  }
})();
setInterval(pollRevision, 8000);
setInterval(pollJobs, 3000);
setInterval(pollCompatibilityStatus, CONNECTIVITY_POLL_MS);
setInterval(() => {
  void probeAnalysisServiceHealth({ quiet: true });
}, CONNECTIVITY_POLL_MS);
if (typeof window !== "undefined") {
  window.addEventListener("focus", () => {
    void syncOpenSequenceOnFocusReturn();
    void analysisServiceRuntime.probeAnalysisServiceHealth({ quiet: true });
    if (state.route === "audio" || state.route === "project") {
      void projectCatalogRuntime.refreshMediaCatalog({ silent: true });
    }
  });
}
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void syncOpenSequenceOnFocusReturn();
      if (state.route === "audio" || state.route === "project") {
        void projectCatalogRuntime.refreshMediaCatalog({ silent: true });
      }
    }
  });
}
