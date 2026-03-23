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
  executeAudioAnalystFlow
} from "./agent/audio-analyst/audio-analyst-runtime.js";
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
import { executeXLightsRefreshCycle, fetchXLightsRevisionState, syncXLightsRevisionState } from "./runtime/xlights-runtime.js";
import { executeApplyCore } from "./runtime/review-runtime.js";
import { createAutomationRuntime } from "./runtime/automation-runtime.js";
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
    "Open the working sequence and tell me what context is loaded.",
    "Refresh the sequence state and show me the current scope.",
    "What sequence settings matter before I start designing?"
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
    "Help me tag the focal props for the chorus sections.",
    "What metadata tags would help the designer and sequencer most?",
    "Review the current metadata and point out obvious gaps."
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
    timingGeneratedSignatures: {}
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
    metadataFilterSupport: "",
    metadataFilterTags: "",
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
if (typeof state.ui?.metadataFilterSupport !== "string") state.ui.metadataFilterSupport = "";
if (typeof state.ui?.metadataFilterTags !== "string") state.ui.metadataFilterTags = "";
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
let analysisServiceProbeInFlight = false;
let hydratedSidecarSequencePath = "";
let focusSyncInFlight = false;
let lastFocusSyncAt = 0;
let lastIgnoredExternalSequencePath = "";
let trainingPackageAudioBundleCache = null;
let trainingPackageAudioBundleCacheAt = 0;
let trainingPackageAgentBundleCache = null;
let trainingPackageAgentBundleCacheAt = 0;
let currentOrchestrationRun = null;

function emptyAgentRuntimeState() {
  return {
    loaded: false,
    error: "",
    packageId: "",
    packageVersion: "",
    registryVersion: "",
    registryValid: false,
    registryErrors: [],
    lastLoadedAt: "",
    activeRole: "",
    roles: [],
    profilesById: {},
    handoffs: {
      analysis_handoff_v1: null,
      intent_handoff_v1: null,
      plan_handoff_v1: null
    }
  };
}

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

function getDesktopBridge() {
  const w = typeof window !== "undefined" ? window : null;
  if (!w) return null;
  return w.xlightsDesignerDesktop || w.__xlightsDesignerDesktop || w.electronAPI || null;
}

function getDesktopStateBridge() {
  const bridge = getDesktopBridge();
  if (!bridge) return null;
  if (typeof bridge.readAppState !== "function" || typeof bridge.writeAppState !== "function") {
    return null;
  }
  return bridge;
}

function getDesktopAppInfoBridge() {
  const bridge = getDesktopBridge();
  if (!bridge) return null;
  if (typeof bridge.getAppInfo !== "function") return null;
  return bridge;
}

function getDesktopAppAdminBridge() {
  const bridge = getDesktopBridge();
  if (!bridge) return null;
  if (typeof bridge.resetAppInstallState !== "function") return null;
  return bridge;
}

function getDesktopSidecarBridge() {
  const bridge = getDesktopBridge();
  if (!bridge) return null;
  if (
    typeof bridge.readSequenceSidecar !== "function" ||
    typeof bridge.writeSequenceSidecar !== "function"
  ) {
    return null;
  }
  return bridge;
}

function getDesktopFileStatBridge() {
  const bridge = getDesktopBridge();
  if (!bridge) return null;
  if (typeof bridge.getFileStat !== "function") return null;
  return bridge;
}

function getDesktopMediaBridge() {
  const bridge = getDesktopBridge();
  if (!bridge) return null;
  if (typeof bridge.saveReferenceMedia !== "function") return null;
  return bridge;
}

function getDesktopBackupBridge() {
  const bridge = getDesktopBridge();
  if (!bridge) return null;
  if (typeof bridge.createSequenceBackup !== "function") return null;
  return bridge;
}

function getDesktopDiagnosticsBridge() {
  const bridge = getDesktopBridge();
  if (!bridge) return null;
  if (typeof bridge.exportDiagnosticsBundle !== "function") return null;
  return bridge;
}

function getDesktopSequenceBridge() {
  const bridge = getDesktopBridge();
  if (!bridge) return null;
  if (typeof bridge.listSequencesInShowFolder !== "function") return null;
  return bridge;
}

function getDesktopMediaCatalogBridge() {
  const bridge = getDesktopBridge();
  if (!bridge) return null;
  if (typeof bridge.listMediaFilesInFolder !== "function") return null;
  return bridge;
}

function getDesktopAgentLogBridge() {
  const bridge = getDesktopBridge();
  if (!bridge) return null;
  if (
    typeof bridge.appendAgentApplyLog !== "function" ||
    typeof bridge.readAgentApplyLog !== "function"
  ) {
    return null;
  }
  return bridge;
}

function getDesktopAgentConversationBridge() {
  const bridge = getDesktopBridge();
  if (!bridge) return null;
  if (
    typeof bridge.runAgentConversation !== "function" ||
    typeof bridge.getAgentHealth !== "function"
  ) {
    return null;
  }
  return bridge;
}

function getDesktopAgentConfigBridge() {
  const bridge = getDesktopBridge();
  if (!bridge) return null;
  if (
    typeof bridge.getAgentConfig !== "function" ||
    typeof bridge.setAgentConfig !== "function"
  ) {
    return null;
  }
  return bridge;
}

function getDesktopAudioAnalysisBridge() {
  const bridge = getDesktopBridge();
  if (!bridge) return null;
  if (typeof bridge.runAudioAnalysisService !== "function") return null;
  return bridge;
}

function getDesktopAnalysisArtifactBridge() {
  const bridge = getDesktopBridge();
  if (!bridge) return null;
  if (
    typeof bridge.readAnalysisArtifact !== "function" ||
    typeof bridge.writeAnalysisArtifact !== "function"
  ) {
    return null;
  }
  return bridge;
}

function getDesktopProjectArtifactBridge() {
  const bridge = getDesktopBridge();
  if (!bridge) return null;
  if (
    typeof bridge.writeProjectArtifacts !== "function" ||
    typeof bridge.readProjectArtifact !== "function"
  ) {
    return null;
  }
  return bridge;
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
    setHandoff: (handoff) => setAgentHandoff("analysis_handoff_v1", handoff, "audio_analyst")
  });
  if (out.ok === true) syncSectionSuggestionsFromAnalysisArtifact(artifact);
  return out.ok === true;
}

async function hydrateAnalysisArtifactForCurrentMedia(options = {}) {
  const silent = options?.silent !== false;
  const bridge = getDesktopAnalysisArtifactBridge();
  const projectFilePath = String(state.projectFilePath || "").trim();
  const mediaFilePath = String(state.audioPathInput || "").trim();
  if (!bridge || !projectFilePath || !mediaFilePath) return { ok: false, reason: "unavailable" };
  try {
    const res = await bridge.readAnalysisArtifact({
      projectFilePath,
      mediaFilePath
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

async function ensureCurrentAnalysisHandoff(options = {}) {
  if (hasUsableCurrentAudioAnalysis()) {
    return getValidHandoff("analysis_handoff_v1");
  }
  const hydrated = await hydrateAnalysisArtifactForCurrentMedia(options);
  if (hydrated?.ok) {
    return getValidHandoff("analysis_handoff_v1");
  }
  return getValidHandoff("analysis_handoff_v1");
}

function getDesktopTrainingPackageBridge() {
  const bridge = getDesktopBridge();
  if (!bridge) return null;
  if (typeof bridge.readTrainingPackageAsset !== "function") return null;
  return bridge;
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

function getAgentHandoffReadyCount() {
  let count = 0;
  for (const contract of AGENT_HANDOFF_CONTRACTS) {
    const row = agentRuntime.handoffs?.[contract];
    if (row?.valid === true && isPlainObject(row.payload)) count += 1;
  }
  return count;
}

function refreshAgentRuntimeHealth() {
  const readyCount = getAgentHandoffReadyCount();
  state.health.agentLayerReady = Boolean(agentRuntime.loaded && !agentRuntime.error);
  state.health.agentActiveRole = String(agentRuntime.activeRole || "");
  state.health.agentRegistryVersion = String(agentRuntime.registryVersion || "");
  state.health.agentRegistryValid = Boolean(agentRuntime.registryValid);
  state.health.agentRegistryErrors = Array.isArray(agentRuntime.registryErrors) ? agentRuntime.registryErrors.slice(0, 12) : [];
  state.health.agentHandoffsReady = `${readyCount}/${AGENT_HANDOFF_CONTRACTS.length}`;
}

function nowMs() {
  return Date.now();
}

function beginOrchestrationRun({ trigger = "", role = "" } = {}) {
  const run = {
    id: `orch-${nowMs()}`,
    trigger: String(trigger || "").trim() || "unknown",
    role: String(role || "").trim() || "",
    startedAtMs: nowMs(),
    startedAtIso: new Date().toISOString(),
    stages: [],
    status: "running",
    summary: ""
  };
  currentOrchestrationRun = run;
  pushDiagnostic("info", `Orchestration run started (${run.id}) trigger=${run.trigger}${run.role ? ` role=${run.role}` : ""}.`);
  return run;
}

function markOrchestrationStage(run, stage = "", status = "ok", detail = "") {
  if (!run || run !== currentOrchestrationRun) return;
  const row = {
    stage: String(stage || "").trim() || "unknown",
    status: String(status || "").trim() || "ok",
    detail: String(detail || "").trim(),
    atMs: nowMs(),
    elapsedMs: Math.max(0, nowMs() - run.startedAtMs)
  };
  run.stages.push(row);
  const suffix = row.detail ? `: ${row.detail}` : "";
  const level = row.status === "ok" ? "info" : "warning";
  pushDiagnostic(level, `Orchestration ${run.id} stage ${row.stage} [${row.status}]${suffix}`);
}

function endOrchestrationRun(run, { status = "ok", summary = "" } = {}) {
  if (!run || run !== currentOrchestrationRun) return;
  run.status = String(status || "").trim() || "ok";
  run.summary = String(summary || "").trim();
  run.endedAtMs = nowMs();
  run.durationMs = Math.max(0, run.endedAtMs - run.startedAtMs);
  const sum = run.summary || `${run.trigger} completed`;
  const st = run.status;
  state.health.orchestrationLastRunId = run.id;
  state.health.orchestrationLastStatus = st;
  state.health.orchestrationLastSummary = `${sum} (${run.durationMs}ms)`;
  state.health.orchestrationLastAt = new Date().toISOString();
  const level = st === "ok" ? "info" : "warning";
  pushDiagnostic(level, `Orchestration run ended (${run.id}) status=${st} duration=${run.durationMs}ms summary=${sum}`);
  currentOrchestrationRun = null;
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
    markOrchestrationStage(orchestrationRun, stage, status, detail);
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

function buildAgentPersistenceContext() {
  return {
    revision: String(state.revision || "unknown"),
    draftBaseRevision: String(state.draftBaseRevision || "unknown"),
    audioPath: String(state.audioPathInput || "").trim(),
    selectedSections: normalizeStringArray(getSelectedSections()),
    selectedTargets: normalizeStringArray(normalizeMetadataSelectionIds(state.ui.metadataSelectionIds || [])),
    selectedTags: normalizeStringArray(normalizeMetadataSelectedTags(state.ui.metadataSelectedTags || []))
  };
}

function setAgentActiveRole(roleId = "") {
  agentRuntime.activeRole = String(roleId || "").trim();
  refreshAgentRuntimeHealth();
}

function setAgentHandoff(contract = "", payload = {}, producer = "") {
  const key = String(contract || "").trim();
  if (!key) return { ok: false, errors: ["contract is required"] };
  const errors = validateAgentHandoff(key, payload);
  const context = buildAgentPersistenceContext();
  agentRuntime.handoffs[key] = {
    contract: key,
    producer: String(producer || "").trim(),
    payload: isPlainObject(payload) ? payload : {},
    context,
    valid: errors.length === 0,
    errors,
    at: new Date().toISOString()
  };
  refreshAgentRuntimeHealth();
  if (errors.length) {
    pushDiagnostic("warning", `Agent handoff invalid (${key}): ${errors.join("; ")}`);
  } else {
    pushDiagnostic("info", `Agent handoff ready (${key}) from ${producer || "unknown"}.`);
  }
  return { ok: errors.length === 0, errors };
}

function getValidHandoff(contract = "") {
  const row = agentRuntime.handoffs?.[String(contract || "").trim()];
  return row?.valid ? row.payload : null;
}

function getValidHandoffRecord(contract = "") {
  const row = agentRuntime.handoffs?.[String(contract || "").trim()];
  return row?.valid ? row : null;
}

function clearAgentHandoff(contract = "", reason = "", { pushLog = true } = {}) {
  const key = String(contract || "").trim();
  if (!key || !AGENT_HANDOFF_CONTRACTS.includes(key)) return false;
  const existing = agentRuntime.handoffs?.[key];
  if (!existing) return false;
  agentRuntime.handoffs[key] = null;
  refreshAgentRuntimeHealth();
  if (pushLog && reason) {
    pushDiagnostic("info", `Agent handoff cleared (${key}): ${reason}`);
  }
  return true;
}

function invalidatePlanHandoff(reason = "context changed") {
  clearAgentHandoff("plan_handoff_v1", reason);
}

function invalidateAnalysisHandoff(reason = "audio changed", { cascadePlan = true } = {}) {
  const cleared = clearAgentHandoff("analysis_handoff_v1", reason);
  if (cleared && cascadePlan) {
    clearAgentHandoff("plan_handoff_v1", `analysis invalidated (${reason})`);
  }
}

function reconcileHandoffsAgainstCurrentContext({ reasonPrefix = "context drift" } = {}) {
  const current = buildAgentPersistenceContext();
  const plan = agentRuntime.handoffs?.plan_handoff_v1;
  if (plan?.valid && isPlainObject(plan.context)) {
    const contextRevision = String(plan.context.revision || "unknown");
    const revisionChanged =
      contextRevision !== "unknown" &&
      current.revision !== "unknown" &&
      contextRevision !== current.revision;
    const sectionsChanged = !arraysEqualAsSets(plan.context.selectedSections, current.selectedSections);
    const targetsChanged = !arraysEqualAsSets(plan.context.selectedTargets, current.selectedTargets);
    const tagsChanged = !arraysEqualAsSets(plan.context.selectedTags, current.selectedTags);
    if (revisionChanged || sectionsChanged || targetsChanged || tagsChanged) {
      invalidatePlanHandoff(
        `${reasonPrefix}: ${
          revisionChanged
            ? "revision changed"
            : (sectionsChanged ? "section scope changed" : (targetsChanged ? "target scope changed" : "tag scope changed"))
        }`
      );
    }
  }

  const analysis = agentRuntime.handoffs?.analysis_handoff_v1;
  if (analysis?.valid && isPlainObject(analysis.context)) {
    const persistedAudio = String(analysis.context.audioPath || "").trim();
    const currentAudio = String(current.audioPath || "").trim();
    if (persistedAudio && currentAudio && persistedAudio !== currentAudio) {
      invalidateAnalysisHandoff(`${reasonPrefix}: audio/media changed`, { cascadePlan: true });
    }
  }
}

function clearAgentHandoffs() {
  clearAgentHandoff("analysis_handoff_v1", "session reset", { pushLog: false });
  clearAgentHandoff("intent_handoff_v1", "session reset", { pushLog: false });
  clearAgentHandoff("plan_handoff_v1", "session reset", { pushLog: false });
  agentRuntime.handoffs = {
    analysis_handoff_v1: null,
    intent_handoff_v1: null,
    plan_handoff_v1: null
  };
  if (!["audio_analyst", "designer_dialog", "sequence_agent"].includes(agentRuntime.activeRole)) {
    agentRuntime.activeRole = "";
  }
  refreshAgentRuntimeHealth();
}

function clearSequencingHandoffsForSequenceChange(reason = "sequence changed") {
  clearAgentHandoff("intent_handoff_v1", reason, { pushLog: false });
  clearAgentHandoff("plan_handoff_v1", reason, { pushLog: false });
}

async function loadAgentRuntimeBundle({ force = false } = {}) {
  const CACHE_TTL_MS = 60_000;
  if (!force && trainingPackageAgentBundleCache && (Date.now() - trainingPackageAgentBundleCacheAt) < CACHE_TTL_MS) {
    return trainingPackageAgentBundleCache;
  }
  const bridge = getDesktopTrainingPackageBridge();
  if (!bridge) {
    const out = { ok: false, error: "Desktop training package bridge unavailable." };
    trainingPackageAgentBundleCache = out;
    trainingPackageAgentBundleCacheAt = Date.now();
    return out;
  }
  try {
    const manifestRes = await bridge.readTrainingPackageAsset({ relativePath: "manifest.json", asJson: true });
    if (!manifestRes?.ok || !isPlainObject(manifestRes.data)) {
      const out = { ok: false, error: String(manifestRes?.error || "Training package manifest not found.") };
      trainingPackageAgentBundleCache = out;
      trainingPackageAgentBundleCacheAt = Date.now();
      return out;
    }
    const manifest = manifestRes.data;
    const registryRes = await bridge.readTrainingPackageAsset({ relativePath: "agents/registry.json", asJson: true });
    if (!registryRes?.ok || !isPlainObject(registryRes.data)) {
      const out = { ok: false, error: String(registryRes?.error || "Agent registry not found.") };
      trainingPackageAgentBundleCache = out;
      trainingPackageAgentBundleCacheAt = Date.now();
      return out;
    }
    const registry = registryRes.data;
    const refs = Array.isArray(registry?.agents) ? registry.agents : [];
    const profiles = [];
    for (const ref of refs) {
      const id = String(ref?.id || "").trim();
      const path = String(ref?.path || "").trim();
      if (!id || !path) {
        const out = { ok: false, error: "Agent registry contains an entry with missing id/path." };
        trainingPackageAgentBundleCache = out;
        trainingPackageAgentBundleCacheAt = Date.now();
        return out;
      }
      const profileRes = await bridge.readTrainingPackageAsset({ relativePath: path, asJson: true });
      if (!profileRes?.ok || !isPlainObject(profileRes.data)) {
        const out = { ok: false, error: `Agent profile load failed for ${id} (${path}).` };
        trainingPackageAgentBundleCache = out;
        trainingPackageAgentBundleCacheAt = Date.now();
        return out;
      }
      profiles.push({
        id,
        status: String(ref?.status || "").trim() || "unknown",
        path,
        profile: profileRes.data
      });
    }
    const parity = validateTrainingAgentRegistry({ registry, profiles });
    if (!parity.ok) {
      const out = {
        ok: false,
        error: `Agent registry validation failed: ${parity.errors.join("; ")}`,
        registryVersion: String(registry?.version || "").trim(),
        registryErrors: parity.errors
      };
      trainingPackageAgentBundleCache = out;
      trainingPackageAgentBundleCacheAt = Date.now();
      return out;
    }
    const out = {
      ok: true,
      packageId: String(manifest?.packageId || "").trim(),
      packageVersion: String(manifest?.version || "").trim(),
      registryVersion: String(registry?.version || "").trim(),
      registryValid: true,
      registryErrors: [],
      profiles
    };
    trainingPackageAgentBundleCache = out;
    trainingPackageAgentBundleCacheAt = Date.now();
    return out;
  } catch (err) {
    const out = { ok: false, error: String(err?.message || err) };
    trainingPackageAgentBundleCache = out;
    trainingPackageAgentBundleCacheAt = Date.now();
    return out;
  }
}

async function hydrateAgentRuntime({ force = false, quiet = true } = {}) {
  const loaded = await loadAgentRuntimeBundle({ force });
  if (!loaded?.ok) {
    Object.assign(agentRuntime, emptyAgentRuntimeState(), {
      error: String(loaded?.error || "Unknown agent runtime load error"),
      registryVersion: String(loaded?.registryVersion || ""),
      registryValid: false,
      registryErrors: Array.isArray(loaded?.registryErrors) ? loaded.registryErrors : []
    });
    refreshAgentRuntimeHealth();
    if (!quiet) pushDiagnostic("warning", `Agent runtime load failed: ${agentRuntime.error}`);
    return false;
  }
  const profilesById = {};
  for (const row of loaded.profiles || []) {
    profilesById[row.id] = {
      id: row.id,
      status: row.status,
      path: row.path,
      profile: row.profile
    };
  }
  const next = emptyAgentRuntimeState();
  next.loaded = true;
  next.packageId = loaded.packageId;
  next.packageVersion = loaded.packageVersion;
  next.registryVersion = loaded.registryVersion;
  next.registryValid = Boolean(loaded.registryValid);
  next.registryErrors = Array.isArray(loaded.registryErrors) ? loaded.registryErrors : [];
  next.lastLoadedAt = new Date().toISOString();
  next.roles = (loaded.profiles || []).map((r) => r.id);
  next.profilesById = profilesById;
  next.activeRole = next.roles.includes(agentRuntime.activeRole) ? agentRuntime.activeRole : "";
  next.handoffs = agentRuntime.handoffs || next.handoffs;
  Object.assign(agentRuntime, next);
  refreshAgentRuntimeHealth();
  if (!quiet) {
    pushDiagnostic(
      "info",
      `Agent runtime loaded (${next.roles.length} role${next.roles.length === 1 ? "" : "s"}, registry ${next.registryVersion || "unknown"}).`
    );
  }
  return true;
}

async function loadAudioTrainingPackageBundle({ force = false } = {}) {
  const CACHE_TTL_MS = 60_000;
  if (!force && trainingPackageAudioBundleCache && (Date.now() - trainingPackageAudioBundleCacheAt) < CACHE_TTL_MS) {
    return trainingPackageAudioBundleCache;
  }
  const bridge = getDesktopTrainingPackageBridge();
  if (!bridge) {
    const out = { ok: false, error: "Desktop training package bridge unavailable." };
    trainingPackageAudioBundleCache = out;
    trainingPackageAudioBundleCacheAt = Date.now();
    return out;
  }
  try {
    const manifestRes = await bridge.readTrainingPackageAsset({ relativePath: "manifest.json", asJson: true });
    if (!manifestRes?.ok) {
      const out = { ok: false, error: String(manifestRes?.error || "Training package manifest not found.") };
      trainingPackageAudioBundleCache = out;
      trainingPackageAudioBundleCacheAt = Date.now();
      return out;
    }
    const pkg = manifestRes?.data && typeof manifestRes.data === "object" ? manifestRes.data : {};
    const modules = Array.isArray(pkg?.modules) ? pkg.modules : [];
    const audioModuleRef = modules.find((m) => String(m?.id || "").trim() === "audio_track_analysis");
    const modulePath = String(audioModuleRef?.path || "").trim();
    if (!modulePath) {
      const out = { ok: false, error: "audio_track_analysis module path missing in training package." };
      trainingPackageAudioBundleCache = out;
      trainingPackageAudioBundleCacheAt = Date.now();
      return out;
    }
    const moduleRes = await bridge.readTrainingPackageAsset({ relativePath: modulePath, asJson: true });
    if (!moduleRes?.ok) {
      const out = { ok: false, error: String(moduleRes?.error || "Audio module manifest read failed.") };
      trainingPackageAudioBundleCache = out;
      trainingPackageAudioBundleCacheAt = Date.now();
      return out;
    }
    const moduleData = moduleRes?.data && typeof moduleRes.data === "object" ? moduleRes.data : {};
    const moduleVersion = String(moduleData?.version || "").trim();
    const promptFiles = Array.isArray(moduleData?.assets?.prompts)
      ? moduleData.assets.prompts.map((p) => String(p || "").trim()).filter(Boolean)
      : [];
    const moduleDir = dirnameRelPath(modulePath);
    const promptTexts = [];
    for (const rel of promptFiles) {
      const absRel = joinRelPath(moduleDir, rel);
      const textRes = await bridge.readTrainingPackageAsset({ relativePath: absRel, asJson: false });
      if (!textRes?.ok) continue;
      const text = String(textRes?.text || "").trim();
      if (!text) continue;
      promptTexts.push({
        path: absRel,
        text
      });
    }
    if (!promptTexts.length) {
      const out = { ok: false, error: "No prompt assets available for audio_track_analysis module." };
      trainingPackageAudioBundleCache = out;
      trainingPackageAudioBundleCacheAt = Date.now();
      return out;
    }
    const combinedPromptText = promptTexts
      .map((row) => `# Asset: ${row.path}\n${row.text}`)
      .join("\n\n");
    const datasetFiles = Array.isArray(moduleData?.assets?.datasets)
      ? moduleData.assets.datasets.map((p) => String(p || "").trim()).filter(Boolean)
      : [];
    const corpusSongs = [];
    for (const rel of datasetFiles) {
      const datasetIndexPath = joinRelPath(moduleDir, rel);
      const datasetRes = await bridge.readTrainingPackageAsset({ relativePath: datasetIndexPath, asJson: true });
      if (!datasetRes?.ok || !datasetRes?.data || typeof datasetRes.data !== "object") continue;
      const sources = Array.isArray(datasetRes.data.sources) ? datasetRes.data.sources : [];
      for (const src of sources) {
        if (String(src?.type || "").trim() !== "stanza-corpus") continue;
        const srcPath = String(src?.path || "").trim();
        if (!srcPath) continue;
        const corpusPath = joinRelPath(moduleDir, srcPath);
        const corpusRes = await bridge.readTrainingPackageAsset({ relativePath: corpusPath, asJson: true });
        if (!corpusRes?.ok || !corpusRes?.data || typeof corpusRes.data !== "object") continue;
        const songs = Array.isArray(corpusRes.data.songs) ? corpusRes.data.songs : [];
        for (const song of songs) {
          if (!song || typeof song !== "object") continue;
          if (String(song?.status || "").trim() !== "ok") continue;
          corpusSongs.push(song);
        }
      }
    }
    const out = {
      ok: true,
      packageId: String(pkg?.packageId || "").trim() || "unknown-package",
      packageVersion: String(pkg?.version || "").trim() || "unknown-version",
      moduleId: "audio_track_analysis",
      moduleVersion: moduleVersion || "unknown-version",
      promptPaths: promptTexts.map((p) => p.path),
      combinedPromptText,
      corpusSongs
    };
    trainingPackageAudioBundleCache = out;
    trainingPackageAudioBundleCacheAt = Date.now();
    return out;
  } catch (err) {
    const out = { ok: false, error: String(err?.message || err) };
    trainingPackageAudioBundleCache = out;
    trainingPackageAudioBundleCacheAt = Date.now();
    return out;
  }
}

function normalizeAnalysisServiceBaseUrl(raw = "") {
  return String(raw || "").trim().replace(/\/+$/, "");
}

function ensureAnalysisServiceDefaults(targetState) {
  if (!targetState || typeof targetState !== "object") return;
  if (!targetState.ui || typeof targetState.ui !== "object") return;
  if (!normalizeAnalysisServiceBaseUrl(targetState.ui.analysisServiceUrlDraft)) {
    targetState.ui.analysisServiceUrlDraft = DEFAULT_ANALYSIS_SERVICE_URL;
  }
}

function getAnalysisServiceHeaderBadgeText() {
  const baseUrl = normalizeAnalysisServiceBaseUrl(state.ui.analysisServiceUrlDraft);
  if (!baseUrl) return "Analysis: URL missing";
  if (state.ui.analysisServiceChecking) return "Analysis: Checking";
  return state.ui.analysisServiceReady ? "Analysis: Ready" : "Analysis: Unavailable";
}

async function probeAnalysisServiceHealth({ quiet = true, force = false } = {}) {
  const bridge = getDesktopAudioAnalysisBridge();
  const baseUrl = normalizeAnalysisServiceBaseUrl(state.ui.analysisServiceUrlDraft);
  const commitIfChanged = (mutate) => {
    const before = JSON.stringify({
      ready: Boolean(state.ui.analysisServiceReady),
      checking: Boolean(state.ui.analysisServiceChecking),
      error: String(state.ui.analysisServiceLastError || "")
    });
    mutate();
    const after = JSON.stringify({
      ready: Boolean(state.ui.analysisServiceReady),
      checking: Boolean(state.ui.analysisServiceChecking),
      error: String(state.ui.analysisServiceLastError || "")
    });
    if (before !== after) {
      persist();
      render();
    }
  };
  if (!bridge || typeof bridge.checkAudioAnalysisService !== "function") {
    commitIfChanged(() => {
      state.ui.analysisServiceReady = false;
      state.ui.analysisServiceChecking = false;
      state.ui.analysisServiceLastError = "Desktop analysis health bridge unavailable.";
      state.ui.analysisServiceLastCheckedAt = new Date().toISOString();
    });
    if (!quiet) setStatusWithDiagnostics("warning", state.ui.analysisServiceLastError);
    return false;
  }
  if (!baseUrl) {
    commitIfChanged(() => {
      state.ui.analysisServiceReady = false;
      state.ui.analysisServiceChecking = false;
      state.ui.analysisServiceLastError = "Audio analysis service URL is required.";
      state.ui.analysisServiceLastCheckedAt = new Date().toISOString();
    });
    return false;
  }
  if (analysisServiceProbeInFlight && !force) return Boolean(state.ui.analysisServiceReady);
  analysisServiceProbeInFlight = true;
  if (!quiet) {
    commitIfChanged(() => {
      state.ui.analysisServiceChecking = true;
    });
  }
  try {
    const res = await bridge.checkAudioAnalysisService({
      baseUrl,
      apiKey: String(state.ui.analysisServiceApiKeyDraft || "").trim() || undefined,
      authBearer: String(state.ui.analysisServiceAuthBearerDraft || "").trim() || undefined,
      timeoutMs: 5000
    });
    const ok = Boolean(res?.ok && res?.reachable);
    state.ui.analysisServiceReady = ok;
    const detailBits = [];
    if (res && typeof res === "object") {
      if (res.selfHealAttempted === true) detailBits.push("self-heal attempted");
      const dir = String(res.analysisServiceDir || "").trim();
      if (dir) detailBits.push(`dir=${dir}`);
    }
    const detail = detailBits.length ? ` (${detailBits.join(", ")})` : "";
    commitIfChanged(() => {
      state.ui.analysisServiceReady = ok;
      state.ui.analysisServiceLastError = ok
        ? ""
        : `${String(res?.error || "Analysis service unavailable.")}${detail}`;
      state.ui.analysisServiceLastCheckedAt = new Date().toISOString();
    });
    if (!ok && !quiet) {
      setStatusWithDiagnostics("warning", `Audio analysis service unavailable: ${state.ui.analysisServiceLastError}`);
    }
    return ok;
  } catch (err) {
    commitIfChanged(() => {
      state.ui.analysisServiceReady = false;
      state.ui.analysisServiceLastError = String(err?.message || err);
      state.ui.analysisServiceLastCheckedAt = new Date().toISOString();
    });
    if (!quiet) {
      setStatusWithDiagnostics("warning", `Audio analysis service unavailable: ${state.ui.analysisServiceLastError}`);
    }
    return false;
  } finally {
    analysisServiceProbeInFlight = false;
    if (!quiet) {
      commitIfChanged(() => {
        state.ui.analysisServiceChecking = false;
      });
    }
  }
}

function getDesktopSequenceDialogBridge() {
  const bridge = getDesktopBridge();
  if (!bridge) return null;
  if (typeof bridge.saveSequenceDialog !== "function") return null;
  return async (payload) => bridge.saveSequenceDialog(payload);
}

function getDesktopProjectBridge() {
  const bridge = getDesktopBridge();
  if (!bridge) return null;
  if (
    typeof bridge.openProjectDialog !== "function" ||
    typeof bridge.openProjectFile !== "function" ||
    typeof bridge.writeProjectFile !== "function"
  ) {
    return null;
  }
  return bridge;
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
      context: isPlainObject(row.context) ? row.context : buildAgentPersistenceContext(),
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
          timingGeneratedSignatures: getSequenceTimingGeneratedSignaturesState()
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
      setAgentActiveRole(runtimeRole);
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
        context: isPlainObject(row.context) ? row.context : buildAgentPersistenceContext(),
        valid: true,
        errors: [],
        at: String(row.at || new Date().toISOString())
      };
    }
    refreshAgentRuntimeHealth();
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
      context: isPlainObject(row.context) ? row.context : buildAgentPersistenceContext(),
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
      setAgentActiveRole(runtimeRole);
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
        context: isPlainObject(row.context) ? row.context : buildAgentPersistenceContext(),
        valid: true,
        errors: [],
        at: String(row.at || new Date().toISOString())
      };
    }
    refreshAgentRuntimeHealth();
    reconcileHandoffsAgainstCurrentContext({ reasonPrefix: "project snapshot hydrate" });
  }
  if (!getValidHandoff("intent_handoff_v1") && isPlainObject(state.creative?.intentHandoff)) {
    setAgentHandoff("intent_handoff_v1", state.creative.intentHandoff, "designer_dialog");
  }
  if (!getValidHandoff("plan_handoff_v1") && isPlainObject(state.agentPlan?.handoff)) {
    setAgentHandoff("plan_handoff_v1", state.agentPlan.handoff, "sequence_agent");
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

const routes = ["settings", "project", "audio", "sequence", "design", "review", "metadata", "history"];

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
    void onRefreshMediaCatalog({ silent: true });
  }
  if (normalizedRoute === "sequence") {
    void onRefreshSequenceCatalog({ silent: true });
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
  await selectHistoryEntry(entryId, { forReview: true });
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

function getDesktopBridgeHealth() {
  const bridge = getDesktopBridge();
  const apiCount =
    bridge && typeof bridge === "object"
      ? Object.keys(bridge).filter((key) => typeof bridge[key] === "function").length
      : 0;
  return {
    runtimeReady: Boolean(bridge),
    desktopFileDialogReady: Boolean(bridge && typeof bridge.openFileDialog === "function"),
    desktopBridgeApiCount: apiCount
  };
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
  const intent = getValidHandoff("intent_handoff_v1");
  if (!intent) {
    return { ok: false, reason: "missing-intent-handoff", message: "Generate proposal to establish intent handoff." };
  }
  const plan = getValidHandoff("plan_handoff_v1");
  if (!plan) {
    return { ok: false, reason: "missing-plan-handoff", message: "Generate proposal to establish plan handoff." };
  }
  const handoffBaseRevision = String(plan?.baseRevision || "unknown");
  const draftBaseRevision = String(state.draftBaseRevision || "unknown");
  if (
    handoffBaseRevision !== "unknown" &&
    draftBaseRevision !== "unknown" &&
    handoffBaseRevision !== draftBaseRevision
  ) {
    return {
      ok: false,
      reason: "plan-base-revision-mismatch",
      message: `Plan handoff revision mismatch (${handoffBaseRevision} vs ${draftBaseRevision}). Regenerate proposal.`
    };
  }
  return { ok: true, reason: "ok", message: "" };
}

function applyEnabled() {
  return applyReadyForApprovalGate() && Boolean(state.ui.applyApprovalChecked);
}

function applyReadyForApprovalGate() {
  const f = state.flags;
  const handoffGate = evaluateApplyHandoffGate();
  return (
    f.hasDraftProposal &&
    f.xlightsConnected &&
    f.xlightsCompatible &&
    !f.planOnlyMode &&
    !f.proposalStale &&
    !f.applyInProgress &&
    handoffGate.ok
  );
}

function applyDisabledReason() {
  if (applyReadyForApprovalGate() && !state.ui.applyApprovalChecked) {
    return "Review the plan and check approval before apply.";
  }
  return applyPlanReadinessReason();
}

function applyPlanReadinessReason() {
  const f = state.flags;
  const rolloutMode = getAgentApplyRolloutMode();
  if (!f.xlightsConnected) return "Connect to xLights to apply.";
  if (!f.xlightsCompatible) return "xLights version is below minimum supported floor (2026.1).";
  if (rolloutMode === "disabled") return "Agent apply is disabled by rollout policy.";
  if (rolloutMode === "plan-only") return "Agent rollout is in plan-only mode; apply is disabled.";
  if (f.planOnlyMode) return "Exit plan-only mode to apply.";
  if (f.proposalStale) return "Refresh proposal before apply.";
  if (!f.hasDraftProposal) return "Generate a proposal first.";
  const handoffGate = evaluateApplyHandoffGate();
  if (!handoffGate.ok) return handoffGate.message;
  if (f.applyInProgress) return "Apply in progress.";
  return "";
}

function invalidateApplyApproval() {
  state.ui.applyApprovalChecked = false;
}

function currentImpactCount() {
  return estimateImpactCount(filteredProposed());
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

function requiresApplyConfirmation() {
  const mode = state.safety?.applyConfirmMode || "large-only";
  if (mode === "always") return true;
  if (mode === "never") return false;
  return currentImpactCount() >= (state.safety?.largeChangeThreshold || 60);
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
    invalidatePlanHandoff("section selection changed");
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

function filteredProposed() {
  if (hasAllSectionsSelected()) return state.proposed;
  const selected = new Set(getSelectedSections());
  return state.proposed.filter((item) => {
    const section = getSectionName(item);
    return section === "General" || selected.has(section);
  });
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

function buildDesignerPlanCommands(sourceLines = filteredProposed()) {
  return buildDesignerPlanCommandsFromLines(sourceLines, { trackName: "XD:ProposedPlan" });
}

async function verifyAppliedPlanReadback(plan = []) {
  return verifyAppliedPlanReadbackWithDeps(plan, {
    endpoint: state.endpoint,
    getTimingMarks,
    getDisplayElementOrder,
    listEffects
  });
}

async function preflightSequenceFileForApply() {
  const sequencePath = currentSequencePathForSidecar();
  if (!sequencePath) {
    return { ok: false, message: "Open or create a sequence before apply." };
  }
  const bridge = getDesktopFileStatBridge();
  if (!bridge) {
    return { ok: true };
  }
  try {
    const stat = await bridge.getFileStat({ filePath: sequencePath });
    if (!stat?.ok || !stat?.exists) {
      return { ok: false, message: "The open sequence file is missing on disk. Save or reopen the sequence in xLights first." };
    }
    const size = Number(stat.size || 0);
    if (!Number.isFinite(size) || size <= 0) {
      return { ok: false, message: "The open sequence file is empty on disk. Save the sequence in xLights first." };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      message: `Unable to verify the open sequence file before apply: ${String(err?.message || err || "unknown error")}`
    };
  }
}

async function onApply(sourceLines = filteredProposed(), applyLabel = "proposal") {
  if (!applyEnabled()) {
    setStatusWithDiagnostics("warning", applyDisabledReason());
    render();
    return {
      ok: false,
      status: "blocked",
      blocked: true,
      reason: "apply_disabled",
      message: applyDisabledReason()
    };
  }
  const revisionState = await syncLatestSequenceRevision({
    onStaleMessage: "Sequence changed since draft creation. Refresh proposal before apply.",
    onUnknownMessage: "Unable to confirm current xLights revision. Continuing with reduced safety for apply."
  });
  if (!revisionState.ok) {
    pushDiagnostic("warning", "Proceeding with apply despite revision sync failure.", String(revisionState.error || "revision sync failed"));
  } else if (revisionState.revision === "unknown") {
    pushDiagnostic("warning", "Proceeding with apply despite unknown xLights revision.");
  }
  if (state.flags.proposalStale) {
    const message = "Apply blocked: draft is stale against the latest xLights revision.";
    setStatusWithDiagnostics("warning", message);
    render();
    return { ok: false, status: "blocked", blocked: true, reason: "stale_draft", message };
  }
  const handoffGate = evaluateApplyHandoffGate();
  if (!handoffGate.ok) {
    const message = `Apply blocked: ${handoffGate.message}`;
    setStatusWithDiagnostics("warning", message);
    render();
    return { ok: false, status: "blocked", blocked: true, reason: "handoff_gate", message };
  }
  const intentHandoffRecord = getValidHandoffRecord("intent_handoff_v1");
  const intentHandoff = intentHandoffRecord?.payload || null;
  const planHandoff = getValidHandoff("plan_handoff_v1");
  const scopedSource = Array.isArray(sourceLines) ? sourceLines.filter(Boolean) : [];
  if (!scopedSource.length) {
    const message = "No proposed changes available for this apply action.";
    setStatusWithDiagnostics("warning", message);
    render();
    return { ok: false, status: "blocked", blocked: true, reason: "no_proposed_changes", message };
  }
  if (!state.ui.applyApprovalChecked) {
    const message = "Review the plan and check approval before apply.";
    setStatusWithDiagnostics("warning", message);
    render();
    return { ok: false, status: "blocked", blocked: true, reason: "approval_required", message };
  }
  const sequencePreflight = await preflightSequenceFileForApply();
  if (!sequencePreflight.ok) {
    setStatusWithDiagnostics("warning", sequencePreflight.message);
    render();
    return { ok: false, status: "blocked", blocked: true, reason: "sequence_preflight", message: sequencePreflight.message };
  }
  const scopedImpactCount = scopedSource.length * 11;

  if (requiresApplyConfirmation()) {
    const message = `Apply ${scopedImpactCount} estimated impacted effects?`;
    if (!window.confirm(message)) {
      const cancelMessage = "Apply canceled by user.";
      setStatus("info", cancelMessage);
      render();
      return { ok: false, status: "canceled", blocked: true, reason: "user_canceled", message: cancelMessage };
    }
  }

  state.flags.applyInProgress = true;
  setAgentActiveRole("sequence_agent");
  const orchestrationRun = beginOrchestrationRun({ trigger: "apply", role: "sequence_agent" });
  state.ui.agentThinking = true;
  addChatMessage("agent", `Applying approved ${applyLabel} to xLights...`);
  setStatus("info", `Applying ${applyLabel} to xLights...`);
  render();

  let applyAuditEntry = null;
  let applyResult = null;
  let clearApprovalAfterApply = false;

  try {
    const result = await executeApplyCore({
      state,
      sourceLines: scopedSource,
      applyLabel,
      scopedImpactCount,
      orchestrationRun,
      intentHandoffRecord,
      intentHandoff,
      planHandoff,
      deps: {
        currentSequencePathForSidecar,
        getDesktopBackupBridge,
        getValidHandoff,
        buildSequenceAgentInput,
        currentLayoutMode,
        getSelectedSections,
        normalizeMetadataSelectionIds,
        normalizeMetadataSelectedTags,
        getSequenceTimingOwnershipRows,
        getManualLockedXdTracks,
        validateSequenceAgentContractGate,
        filteredProposed,
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
        buildApplyHistoryEntry,
        buildChatArtifactCard,
        getTeamChatSpeakerLabel,
        getRevision,
        validateCommands,
        beginTransaction,
        commitTransaction,
        rollbackTransaction,
        stageTransactionCommand,
        applySequencingBatchPlan: null,
        getOwnedHealth: null,
        getOwnedJob: null,
        getOwnedSequenceRevision: null
      },
      callbacks: {
        pushSequenceAgentContractDiagnostic,
        markOrchestrationStage,
        endOrchestrationRun,
        pushDiagnostic,
        upsertJob,
        bumpVersion,
        setStatusWithDiagnostics,
        addStructuredChatMessage
      }
    });

    applyAuditEntry = result.applyAuditEntry || null;
    applyResult = result.applyResult || null;
    clearApprovalAfterApply = Boolean(result.clearApprovalAfterApply);
    if (result.blocked) {
      setStatusWithDiagnostics("action-required", result.message || "Apply blocked.", result.details || "");
      return {
        ok: false,
        status: "blocked",
        blocked: true,
        reason: result.applyResult?.failureReason || result.status || "blocked",
        message: result.message || "Apply blocked.",
        details: result.details || "",
        applyAuditEntry,
        applyResult
      };
    }
  } finally {
    if (clearApprovalAfterApply) {
      state.ui.applyApprovalChecked = false;
    }
    if (applyAuditEntry) {
      await persistCurrentArtifactsForHistory({ planHandoff, applyResult, historyEntry: applyAuditEntry });
      pushApplyHistory(applyAuditEntry, { planHandoff, applyResult });
      await appendDesktopApplyLog(applyAuditEntry);
      await refreshApplyHistoryFromDesktop(40);
    }
    state.flags.applyInProgress = false;
    state.ui.agentThinking = false;
    saveCurrentProjectSnapshot();
    persist();
    render();
  }
  return {
    ok: Boolean(applyAuditEntry),
    status: applyResult?.status || (applyAuditEntry ? String(applyAuditEntry.status || "unknown") : "unknown"),
    blocked: false,
    reason: applyResult?.failureReason || null,
    message: applyAuditEntry?.summary || null,
    applyAuditEntry,
    applyResult
  };
}


function selectedProposedLinesForApply() {
  const selectedIndexes = Array.isArray(state.ui?.proposedSelection)
    ? state.ui.proposedSelection.filter((idx) => Number.isInteger(idx))
    : [];
  if (!selectedIndexes.length) return [];
  const rows = Array.isArray(state.proposed) ? state.proposed : [];
  return selectedIndexes
    .map((idx) => rows[idx])
    .filter((line) => typeof line === "string" && line.trim());
}

async function onApplySelected() {
  const selectedLines = selectedProposedLinesForApply();
  if (!selectedLines.length) {
    setStatus("warning", "Select one or more proposed changes first.");
    return render();
  }
  await onApply(selectedLines, "selected proposed changes");
}

async function onApplyAll() {
  return await onApply(filteredProposed(), "all proposed changes");
}

async function onGenerate(intentOverride = "", options = {}) {
  const requestedRole = String(options?.requestedRole || "").trim();
  const disableDesignerCloud = options?.disableDesignerCloud === true;
  const proposalRole = ["sequence_agent", "designer_dialog"].includes(requestedRole)
    ? requestedRole
    : "designer_dialog";
  const explicitSelectedSections = Array.isArray(options?.selectedSections)
    ? options.selectedSections.map((row) => String(row || "").trim()).filter(Boolean)
    : [];
  const explicitSelectedTargetIds = Array.isArray(options?.selectedTargetIds)
    ? options.selectedTargetIds.map((row) => String(row || "").trim()).filter(Boolean)
    : [];
  const explicitSelectedTagNames = Array.isArray(options?.selectedTagNames)
    ? options.selectedTagNames.map((row) => String(row || "").trim()).filter(Boolean)
    : [];
  const directSequenceMode = proposalRole === "sequence_agent";
  const revisionTarget = normalizeDesignRevisionTarget(options?.revisionTarget || state.ui.designRevisionTarget);
  const postGenerateFailureMessage = (text = "") => {
    const message = String(text || "").trim();
    if (!message) return;
    addStructuredChatMessage("agent", message, {
      roleId: proposalRole,
      displayName: getTeamChatSpeakerLabel(proposalRole),
      handledBy: proposalRole
    });
  };
  const bridge = getDesktopBridge();
  if (!state.flags.activeSequenceLoaded && !state.flags.planOnlyMode) {
    setStatus("action-required", "Open a sequence or enter plan-only mode.");
    return render();
  }
  if (state.flags.xlightsConnected && !state.flags.planOnlyMode) {
    const revisionState = await syncLatestSequenceRevision({
      onStaleMessage: "Detected newer xLights sequence revision. Regenerating against latest sequence state.",
      onUnknownMessage: "Unable to confirm current xLights revision. Continuing with a draft against the current loaded state."
    });
    if (!revisionState.ok) {
      pushDiagnostic(
        "warning",
        "Proceeding with proposal generation despite revision sync failure.",
        String(revisionState.error || "revision sync failed")
      );
    }
  }
  try {
    setAgentActiveRole(proposalRole);
    const orchestrationRun = beginOrchestrationRun({ trigger: "generate", role: proposalRole });
    state.ui.agentThinking = true;
    addStructuredChatMessage(
    "agent",
    proposalRole === "sequence_agent"
      ? "Working on an updated sequencing draft from your current request..."
      : "Working on updated proposal from current chat intent...",
    {
      roleId: proposalRole,
      displayName: getTeamChatSpeakerLabel(proposalRole),
      handledBy: proposalRole
    }
  );
  state.flags.hasDraftProposal = true;
  state.flags.proposalStale = false;
  state.draftBaseRevision = state.revision;
  invalidateApplyApproval();
  const rawIntentText = String(intentOverride || "").trim() || latestUserIntentText();
  const intentText = buildRevisionPromptText(rawIntentText, revisionTarget);
  const analysisHandoff = directSequenceMode
    ? await ensureCurrentAnalysisHandoff({ silent: true })
    : getValidHandoff("analysis_handoff_v1");
  const designSceneContext = buildCurrentDesignSceneContext();
  const musicDesignContext = buildCurrentMusicDesignContext();
  const inferredPromptSections = inferPromptSectionSelection(intentText, musicDesignContext);
  const usingAll = hasAllSectionsSelected();
  const selected = explicitSelectedSections.length
    ? explicitSelectedSections
    : revisionTarget?.sections?.length
    ? revisionTarget.sections
    : (inferredPromptSections.length
        ? inferredPromptSections
        : (usingAll
            ? getSectionChoiceList()
            : getSelectedSections().filter((s) => s !== "all")));
  const includeDesignerSelection = shouldCarryDesignerSelectionContext(intentText);
  const designerSelectedTags = explicitSelectedTagNames.length
    ? explicitSelectedTagNames
    : (includeDesignerSelection ? (state.ui.metadataSelectedTags || []) : []);
  const designerSelectedTargetIds = explicitSelectedTargetIds.length
    ? explicitSelectedTargetIds
    : revisionTarget?.targetIds?.length
    ? revisionTarget.targetIds
    : (includeDesignerSelection ? (state.ui.metadataSelectionIds || []) : []);
  const directSelectedTargetIds = explicitSelectedTargetIds.length
    ? explicitSelectedTargetIds
    : revisionTarget?.targetIds?.length
    ? revisionTarget.targetIds
    : (state.ui.metadataSelectionIds || []);
  let designerCloudResponse = null;
  if (!directSequenceMode && !disableDesignerCloud && bridge && typeof bridge.runDesignerConversation === "function") {
    const cloud = await bridge.runDesignerConversation({
      userMessage: intentText,
      messages: buildRecentChatHistory(),
      context: buildDesignerCloudConversationContext({
        intentText,
        selectedSections: selected,
        analysisHandoff,
        designSceneContext,
        musicDesignContext
      })
    });
    if (cloud?.ok && isPlainObject(cloud?.designerCloudResponse)) {
      designerCloudResponse = cloud.designerCloudResponse;
    } else if (cloud?.error) {
      pushDiagnostic(
        "warning",
        "Designer cloud response unavailable. Falling back to local designer runtime.",
        String(cloud.error)
      );
    }
  }
  const proposalOrchestration = directSequenceMode
    ? executeDirectSequenceRequestOrchestration({
        requestId: `${orchestrationRun.id}-direct-sequence`,
        sequenceRevision: String(state.draftBaseRevision || state.revision || "unknown"),
        promptText: intentText,
        selectedSections: selected,
        selectedTagNames: state.ui.metadataSelectedTags || [],
        selectedTargetIds: directSelectedTargetIds,
        analysisHandoff,
        models: state.models || [],
        submodels: state.submodels || [],
        displayElements: state.displayElements || [],
        effectCatalog: state.effectCatalog,
        metadataAssignments: buildEffectiveMetadataAssignments(),
        existingDesignIds: collectCurrentDesignIds(),
        elevatedRiskConfirmed: Boolean(state.ui.applyApprovalChecked)
      })
    : executeDesignerProposalOrchestration({
        requestId: `${orchestrationRun.id}-designer`,
        sequenceRevision: String(state.draftBaseRevision || state.revision || "unknown"),
        promptText: intentText,
        selectedSections: selected,
        selectedTagNames: designerSelectedTags,
        selectedTargetIds: designerSelectedTargetIds,
        goals: state.creative?.goals || "",
        inspiration: state.creative?.inspiration || "",
        notes: state.creative?.notes || "",
        references: state.creative?.references || [],
        priorBrief: state.creative?.brief || null,
        analysisHandoff,
        analysisArtifact: state.audioAnalysis?.artifact || null,
        directorProfile: state.directorProfile || null,
        designSceneContext,
        musicDesignContext,
        cloudResponse: designerCloudResponse,
        models: state.models || [],
        submodels: state.submodels || [],
        displayElements: state.displayElements || [],
        metadataAssignments: buildEffectiveMetadataAssignments(),
        elevatedRiskConfirmed: Boolean(state.ui.applyApprovalChecked)
      });
  if (!proposalOrchestration.ok) {
    markOrchestrationStage(
      orchestrationRun,
      directSequenceMode ? "direct_sequence_request" : "designer_dialog",
      "error",
      proposalOrchestration.summary || (directSequenceMode ? "direct sequence flow failed" : "designer flow failed")
    );
    endOrchestrationRun(orchestrationRun, {
      status: "failed",
      summary: directSequenceMode ? "direct sequence flow failed" : "designer flow failed"
    });
    clearDesignerDraft(state);
    state.agentPlan = null;
    state.creative = state.creative || {};
    state.creative.intentHandoff = null;
    clearAgentHandoff("intent_handoff_v1", "proposal generation blocked", { pushLog: false });
    clearAgentHandoff("plan_handoff_v1", "proposal generation blocked", { pushLog: false });
    state.ui.agentThinking = false;
    setStatusWithDiagnostics(
      "warning",
      directSequenceMode ? "Direct sequence proposal generation blocked." : "Designer proposal generation blocked.",
      Array.isArray(proposalOrchestration.warnings) ? proposalOrchestration.warnings.join("\n") : ""
    );
    postGenerateFailureMessage(
      directSequenceMode
        ? "I couldn't turn that request into a sequencing draft yet. Review the warning state and try narrowing the target, section, or effect."
        : "I couldn't turn that request into a design draft yet. Review the warning state and try refining the request."
    );
    persist();
    render();
    return;
  }
  const supersededConceptRecord = revisionTarget
    ? buildSupersededConceptRecordById(revisionTarget.designId, revisionTarget.designRevision)
    : null;
  const resolvedProposalOrchestration = revisionTarget
    ? applyRevisionTargetToOrchestration(proposalOrchestration, revisionTarget)
    : proposalOrchestration;
  if (revisionTarget && resolvedProposalOrchestration === proposalOrchestration) {
    markOrchestrationStage(orchestrationRun, "concept_revision_merge", "error", "unable to merge revised concept into current draft");
    endOrchestrationRun(orchestrationRun, { status: "failed", summary: "concept revision merge failed" });
    state.ui.agentThinking = false;
    setStatusWithDiagnostics(
      "warning",
      `Revision blocked: could not merge ${buildDesignDisplay(revisionTarget.designId, revisionTarget.priorDesignRevision)} into the current draft.`
    );
    persist();
    render();
    return;
  }
  const normalizedProposalOrchestration = revisionTarget
    ? ensureRevisionTargetAppliedToOrchestration(resolvedProposalOrchestration, revisionTarget)
    : resolvedProposalOrchestration;
  if (directSequenceMode) {
    applyDesignerDraftSuccessState(state, {
      proposalBundle: normalizedProposalOrchestration.proposalBundle || null,
      proposalLines: Array.isArray(normalizedProposalOrchestration.proposalLines) ? normalizedProposalOrchestration.proposalLines : [],
      sequencePath: currentSequencePathForSidecar()
    });
  } else {
    applyDesignerProposalSuccessToState(state, normalizedProposalOrchestration);
  }
  if (revisionTarget) {
    applyRevisionTargetToCurrentDesignerState(revisionTarget);
  }
  markOrchestrationStage(
    orchestrationRun,
    "intent_normalization",
    "ok",
    directSequenceMode
      ? "direct technical sequencing request normalized into canonical intent handoff"
      : "designer runtime built brief + proposal"
  );
  let intentHandoff = hydrateIntentHandoffExecutionStrategy(
    normalizedProposalOrchestration.intentHandoff,
    normalizedProposalOrchestration.proposalBundle
  );
  if (revisionTarget && isPlainObject(intentHandoff)) {
    const normalizedTarget = normalizeDesignRevisionTarget(revisionTarget);
    const revisedExecutionStrategy = retagExecutionPlanForRevisionTarget(
      intentHandoff.executionStrategy,
      normalizedTarget
    );
    intentHandoff = {
      ...intentHandoff,
      designId: normalizedTarget.designId,
      designRevision: normalizedTarget.designRevision,
      designAuthor: normalizedTarget.designAuthor,
      executionStrategy: revisedExecutionStrategy
    };
    if (state.creative?.proposalBundle && typeof state.creative.proposalBundle === "object" && revisedExecutionStrategy) {
      const rebuiltBundle = rebuildProposalBundleFromExecutionPlan(
        state.creative.proposalBundle,
        revisedExecutionStrategy
      );
      if (rebuiltBundle) {
        state.creative.proposalBundle = rebuiltBundle;
      }
    }
  }
  state.creative = state.creative || {};
  state.creative.intentHandoff = isPlainObject(intentHandoff) ? structuredClone(intentHandoff) : null;
  const intentSet = setAgentHandoff(
    "intent_handoff_v1",
    intentHandoff,
    directSequenceMode ? "app_assistant" : "designer_dialog"
  );
  if (!intentSet.ok) {
    markOrchestrationStage(orchestrationRun, "intent_handoff", "error", intentSet.errors.join("; "));
    endOrchestrationRun(orchestrationRun, { status: "failed", summary: "intent handoff invalid" });
    state.ui.agentThinking = false;
    setStatusWithDiagnostics("warning", "Intent handoff invalid. Proposal generation blocked.", intentSet.errors.join("\n"));
    postGenerateFailureMessage(
      directSequenceMode
        ? "I hit an intent-handoff problem while building the sequencing draft. Review the warning state and try again."
        : "I hit an intent-handoff problem while building the design draft. Review the warning state and try again."
    );
    persist();
    render();
    return;
  }
  setAgentActiveRole("sequence_agent");
  markOrchestrationStage(orchestrationRun, "intent_handoff", "ok", "intent_handoff_v1 ready");
  const guidedQuestions = normalizedProposalOrchestration.guidedQuestions;
  const designerExecutionSeedLines = buildDesignerExecutionSeedLines(normalizedProposalOrchestration);
  const proposalSeedLines = designerExecutionSeedLines.length
    ? designerExecutionSeedLines
    : (shouldUseExecutionStrategySeedLines({ directSequenceMode, proposalOrchestration: normalizedProposalOrchestration })
        ? []
        : normalizedProposalOrchestration.proposalLines);
  const sequenceAgentInput = buildSequenceAgentInput({
    requestId: `${orchestrationRun.id}-generate`,
    endpoint: state.endpoint,
    sequenceRevision: String(state.draftBaseRevision || state.revision || "unknown"),
    sequenceSettings: state.sequenceSettings,
    layoutMode: currentLayoutMode(),
    displayElements: state.displayElements,
    groupIds: Object.keys(state.sceneGraph?.groupsById || {}),
    groupsById: state.sceneGraph?.groupsById || {},
    submodelsById: state.sceneGraph?.submodelsById || {},
    submodelsById: state.sceneGraph?.submodelsById || {},
    intentHandoff,
    analysisHandoff,
    planningScope: {
      sections: selected,
      targetIds: revisionTarget?.targetIds?.length
        ? revisionTarget.targetIds
        : normalizeMetadataSelectionIds(state.ui.metadataSelectionIds || []),
      tagNames: normalizeMetadataSelectedTags(state.ui.metadataSelectedTags || [])
    },
    timingOwnership: getSequenceTimingOwnershipRows(),
    manualXdLocks: getManualLockedXdTracks(),
    allowTimingWrites: true
  });
  const inputGate = validateSequenceAgentContractGate("input", sequenceAgentInput, orchestrationRun.id);
  pushSequenceAgentContractDiagnostic(inputGate.report);
  if (!inputGate.ok) {
    markOrchestrationStage(orchestrationRun, inputGate.stage, "error", inputGate.report.errors.join("; "));
    endOrchestrationRun(orchestrationRun, { status: "failed", summary: "sequence_agent input contract invalid" });
    state.ui.agentThinking = false;
    setStatusWithDiagnostics(
      "warning",
      "Proposal generation blocked: sequence_agent input contract invalid.",
      inputGate.report.errors.join("\n")
    );
    postGenerateFailureMessage("I couldn't build a valid sequencer input from that request. Review the warning state and try again.");
    persist();
    render();
    return;
  }
  let sequencerPlan = null;
  try {
    sequencerPlan = buildSequenceAgentPlan({
      analysisHandoff,
      intentHandoff,
      sourceLines: proposalSeedLines,
      baseRevision: String(state.draftBaseRevision || state.revision || "unknown"),
      capabilityCommands: state.health.capabilityCommands || [],
      effectCatalog: state.effectCatalog,
      sequenceSettings: state.sequenceSettings,
      layoutMode: currentLayoutMode(),
      displayElements: state.displayElements,
      groupIds: Object.keys(state.sceneGraph?.groupsById || {}),
      groupsById: state.sceneGraph?.groupsById || {},
      submodelsById: state.sceneGraph?.submodelsById || {},
      timingOwnership: getSequenceTimingOwnershipRows(),
      allowTimingWrites: true
    });
    emitSequenceAgentStageTelemetry(orchestrationRun, sequencerPlan);
    markOrchestrationStage(orchestrationRun, "sequencer_plan", "ok", "sequence_agent plan built");
  } catch (err) {
    if (Array.isArray(err?.stageTelemetry)) {
      emitSequenceAgentStageTelemetry(orchestrationRun, { stageTelemetry: err.stageTelemetry });
    }
    markOrchestrationStage(orchestrationRun, "sequencer_plan", "error", String(err?.message || err));
    sequencerPlan = {
      planId: `plan-${Date.now()}`,
      summary: `Designer plan from intent "${intentText.slice(0, 90)}${intentText.length > 90 ? "..." : ""}"`,
      estimatedImpact: estimateImpactCount(state.proposed),
      warnings: [String(err?.message || err)],
      commands: [],
      baseRevision: String(state.draftBaseRevision || state.revision || "unknown"),
      validationReady: false,
        metadata: {
          layoutMode: currentLayoutMode(),
          mode: String(intentHandoff?.mode || "create"),
          scope: {
            sections: selected,
          targetIds: normalizeMetadataSelectionIds(state.ui.metadataSelectionIds || []),
          tagNames: normalizeMetadataSelectedTags(state.ui.metadataSelectedTags || [])
        },
        degradedMode: !analysisHandoff
      }
    };
  }
  const planHandoff = {
    agentRole: String(sequencerPlan.agentRole || "sequence_agent"),
    contractVersion: String(sequencerPlan.contractVersion || "1.0"),
    planId: String(sequencerPlan.planId || `plan-${Date.now()}`),
    summary: String(sequencerPlan.summary || `Designer plan from intent "${intentText.slice(0, 90)}${intentText.length > 90 ? "..." : ""}"`),
    estimatedImpact: Number(sequencerPlan.estimatedImpact || estimateImpactCount(state.proposed)),
    warnings: Array.isArray(sequencerPlan.warnings) ? sequencerPlan.warnings : [],
    commands: Array.isArray(sequencerPlan.commands) ? sequencerPlan.commands : [],
    baseRevision: String(sequencerPlan.baseRevision || state.draftBaseRevision || state.revision || "unknown"),
    validationReady: Boolean(sequencerPlan.validationReady),
    metadata: isPlainObject(sequencerPlan.metadata)
      ? sequencerPlan.metadata
      : {
          layoutMode: currentLayoutMode(),
          mode: String(intentHandoff?.mode || "create"),
          scope: {
            sections: selected,
            targetIds: normalizeMetadataSelectionIds(state.ui.metadataSelectionIds || []),
            tagNames: normalizeMetadataSelectedTags(state.ui.metadataSelectedTags || [])
          },
          degradedMode: !analysisHandoff
        }
  };
  if (revisionTarget) {
    const normalizedTarget = normalizeDesignRevisionTarget(revisionTarget);
    const retagCommand = (command = {}) => {
      if (String(command?.designId || "").trim() !== normalizedTarget.designId) return command;
      return {
        ...command,
        designId: normalizedTarget.designId,
        designRevision: normalizedTarget.designRevision,
        designAuthor: normalizedTarget.designAuthor,
        intent: command?.intent && typeof command.intent === "object"
          ? {
              ...command.intent,
              designId: normalizedTarget.designId,
              designRevision: normalizedTarget.designRevision,
              designAuthor: normalizedTarget.designAuthor
            }
          : command?.intent
      };
    };
    planHandoff.commands = Array.isArray(planHandoff.commands) ? planHandoff.commands.map(retagCommand) : [];
    planHandoff.metadata = {
      ...(planHandoff.metadata && typeof planHandoff.metadata === "object" ? planHandoff.metadata : {}),
      designRevisionTarget: normalizedTarget
    };
  }
  planHandoff.createdAt = new Date().toISOString();
  planHandoff.artifactId = buildArtifactId("plan_handoff_v1", planHandoff);
  const planGraphGate = validateCommandGraph(planHandoff.commands);
  if (!planGraphGate.ok) {
    markOrchestrationStage(orchestrationRun, "graph_validation", "error", planGraphGate.errors.join("; "));
    endOrchestrationRun(orchestrationRun, { status: "failed", summary: "sequence_agent graph validation failed" });
    state.ui.agentThinking = false;
    setStatusWithDiagnostics(
      "warning",
      "Proposal generation blocked: sequence_agent command graph invalid.",
      planGraphGate.errors.join("\n")
    );
    postGenerateFailureMessage("I built an invalid sequencing graph from that request. Review the warning state and try refining the scope.");
    persist();
    render();
    return;
  }
  markOrchestrationStage(orchestrationRun, "graph_validation", "ok", `nodes=${planGraphGate.nodeCount}`);
  const planGate = validateSequenceAgentContractGate("plan", planHandoff, orchestrationRun.id);
  pushSequenceAgentContractDiagnostic(planGate.report);
  if (!planGate.ok) {
    markOrchestrationStage(orchestrationRun, planGate.stage, "error", planGate.report.errors.join("; "));
    endOrchestrationRun(orchestrationRun, { status: "failed", summary: "sequence_agent plan contract invalid" });
    state.ui.agentThinking = false;
    setStatusWithDiagnostics(
      "warning",
      "Proposal generation blocked: sequence_agent plan contract invalid.",
      planGate.report.errors.join("\n")
    );
    postGenerateFailureMessage("I couldn't finalize a valid sequencing draft from that request. Review the warning state and try again.");
    persist();
    render();
    return;
  }
  const executionLines = Array.isArray(sequencerPlan?.executionLines)
    ? sequencerPlan.executionLines
    : proposalSeedLines;
  state.proposed = mergeCreativeBriefIntoProposal(executionLines);
  state.agentPlan = {
    createdAt: new Date().toISOString(),
    source: "sequence_agent",
    handoff: planHandoff,
    executionLines
  };
  const planSet = setAgentHandoff("plan_handoff_v1", planHandoff, "sequence_agent");
  if (revisionTarget && planSet.ok && supersededConceptRecord) {
    upsertSupersededConceptRecord(supersededConceptRecord);
  }
  if (!planSet.ok) {
    markOrchestrationStage(orchestrationRun, "plan_handoff", "error", planSet.errors.join("; "));
    addChatMessage("system", `Plan handoff is incomplete: ${planSet.errors.join("; ")}`);
  } else if (planHandoff.warnings.length) {
    markOrchestrationStage(orchestrationRun, "plan_handoff", "ok", `warnings=${planHandoff.warnings.length}`);
    pushDiagnostic("warning", `Sequencer plan warnings: ${planHandoff.warnings.join(" | ")}`);
  } else {
    markOrchestrationStage(orchestrationRun, "plan_handoff", "ok", "plan_handoff_v1 ready");
  }
  endOrchestrationRun(orchestrationRun, {
    status: planSet.ok ? "ok" : "failed",
    summary: planSet.ok
      ? `proposal generated with ${state.proposed.length} line${state.proposed.length === 1 ? "" : "s"}`
      : "proposal generation incomplete"
  });
  state.ui.agentThinking = false;
  const guidedMessage = proposalRole === "designer_dialog"
    ? buildDesignerGuidedQuestionMessage(guidedQuestions)
    : "";
  if (guidedMessage) addChatMessage("agent", guidedMessage);
  addStructuredChatMessage(
    "agent",
    proposalRole === "sequence_agent"
      ? `Sequencing draft ready: ${state.proposed.length} proposed change${state.proposed.length === 1 ? "" : "s"} ready for review.`
      : buildDesignerCompletionMessage({
          proposalBundle: state.creative?.proposalBundle || null,
          creativeBrief: state.creative?.brief || null
        }),
    {
      roleId: proposalRole,
      displayName: getTeamChatSpeakerLabel(proposalRole),
      handledBy: proposalRole,
      artifact: proposalRole === "sequence_agent"
        ? buildChatArtifactCard("plan_handoff_v1", {
            title: String(state.agentPlan?.handoff?.summary || "Sequence Draft").trim(),
            summary: String(state.agentPlan?.handoff?.summary || "").trim(),
            chips: [
              state.creative?.proposalBundle?.lifecycle?.status || "",
              Array.isArray(state.agentPlan?.handoff?.commands) ? `${state.agentPlan.handoff.commands.length} commands` : "",
              Number.isFinite(Number(state.agentPlan?.handoff?.estimatedImpact)) ? `${Number(state.agentPlan.handoff.estimatedImpact)} impact` : ""
            ]
          })
        : buildChatArtifactCard("proposal_bundle_v1", {
            title: String(state.creative?.proposalBundle?.title || "Design Proposal").trim(),
            summary: String(state.creative?.proposalBundle?.summary || state.creative?.brief?.summary || "").trim(),
            chips: [
              state.creative?.proposalBundle?.lifecycle?.status || "",
              Array.isArray(state.creative?.proposalBundle?.lines) ? `${state.creative.proposalBundle.lines.length} lines` : "",
              Array.isArray(state.creative?.proposalBundle?.scope?.sections) ? `${state.creative.proposalBundle.scope.sections.length} sections` : ""
            ]
          })
    }
  );
  setStatus("info", `Proposal refreshed from current intent (${state.proposed.length} line${state.proposed.length === 1 ? "" : "s"}).`);
  clearDesignRevisionTarget();
  saveCurrentProjectSnapshot();
  persist();
  render();
  } catch (err) {
    state.ui.agentThinking = false;
    const detail = String(err?.message || err);
    postGenerateFailureMessage(
      directSequenceMode
        ? `I hit an unexpected error while building the sequencing draft: ${detail}`
        : `I hit an unexpected error while building the design draft: ${detail}`
    );
    setStatusWithDiagnostics("warning", "Proposal generation failed unexpectedly.", detail);
    persist();
    render();
  }
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
  state.models = Array.isArray(modelBody?.data?.models) ? modelBody.data.models : [];
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
      invalidatePlanHandoff("sequence revision changed");
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
  state.ui.firstRunMode = false;
  const prevDraftSequencePath = String(state.draftSequencePath || "").trim();
  try {
    await hydrateAgentHealth();
    await executeXLightsRefreshCycle({
      state,
      endpoint: state.endpoint,
      deps: {
        getOpen: getOpenSequence,
        syncRevision: () => syncLatestSequenceRevision({
          onStaleMessage: "Sequence changed since draft creation. Refresh proposal before apply.",
          onUnknownMessage: ""
        }),
        refreshMetadata: refreshMetadataTargetsFromXLights,
        refreshEffects: refreshEffectCatalogFromXLights,
        refreshSections: fetchSectionSuggestions,
        refreshHistory: () => refreshApplyHistoryFromDesktop(40)
      },
      callbacks: {
        applyRolloutPolicy,
        releaseConnectivityPlanOnly,
        enforceConnectivityPlanOnly,
        isSequenceAllowed: isSequenceAllowedInActiveShowFolder,
        currentSequencePath: currentSequencePathForSidecar,
        clearIgnoredExternalSequenceNote,
        applyOpenSequenceState,
        onSequenceChanged: ({ previousPath = "", nextPath = "" } = {}) => {
          if (nextPath && nextPath !== previousPath) {
            clearDesignerDraft(state);
            state.agentPlan = null;
            state.creative = state.creative || {};
            state.creative.intentHandoff = null;
            clearSequencingHandoffsForSequenceChange("sequence changed");
            invalidateApplyApproval();
          }
        },
        onSequenceCleared: () => {
          clearDesignerDraft(state);
          state.agentPlan = null;
          state.creative = state.creative || {};
          state.creative.intentHandoff = null;
          clearSequencingHandoffsForSequenceChange("sequence cleared");
          invalidateApplyApproval();
        },
        syncAudioPathFromMediaStatus,
        hydrateSidecarForCurrentSequence,
        updateSequenceFileMtime,
        maybeFlushSidecarAfterExternalSave,
        noteIgnoredExternalSequence,
        onWarning: (text, details = "") => setStatusWithDiagnostics("warning", text, details),
        onInfo: (text) => setStatus("info", text)
      }
    });
    const nextSequencePath = currentSequencePathForSidecar();
    if (prevDraftSequencePath && nextSequencePath && nextSequencePath !== prevDraftSequencePath) {
      clearDesignerDraft(state);
      state.agentPlan = null;
      state.creative = state.creative || {};
      state.creative.intentHandoff = null;
      clearSequencingHandoffsForSequenceChange("sequence changed");
      invalidateApplyApproval();
    }
  } catch (err) {
    state.flags.xlightsConnected = false;
    enforceConnectivityPlanOnly();
    setStatusWithDiagnostics("warning", `Refresh failed: ${err.message}`, err.stack || "");
  }
  persist();
  render();
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
    await hydrateAgentHealth();
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
      await syncAudioPathFromMediaStatus();

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
    previewCommands = buildDesignerPlanCommands(filteredProposed());
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
    intentHandoff: state.creative?.intentHandoff || getValidHandoff("intent_handoff_v1"),
    planHandoff: planHandoff || getValidHandoff("plan_handoff_v1"),
    applyResult
  });
}

async function persistCurrentArtifactsForHistory({ planHandoff = null, applyResult = null, historyEntry = null } = {}) {
  const bridge = getDesktopProjectArtifactBridge();
  const projectFilePath = String(state.projectFilePath || "").trim();
  if (!bridge || !projectFilePath) return { ok: false, reason: "unavailable" };
  const artifacts = [
    state.audioAnalysis?.artifact || null,
    buildCurrentDesignSceneContext(),
    buildCurrentMusicDesignContext(),
    state.directorProfile || null,
    state.creative?.brief || null,
    state.creative?.proposalBundle || null,
    state.creative?.intentHandoff || getValidHandoff("intent_handoff_v1"),
    planHandoff || getValidHandoff("plan_handoff_v1"),
    applyResult,
    historyEntry
  ].filter((artifact) => artifact && typeof artifact === "object" && typeof artifact.artifactId === "string");
  if (!artifacts.length) return { ok: false, reason: "no_artifacts" };
  try {
    return await bridge.writeProjectArtifacts({
      projectFilePath,
      artifacts
    });
  } catch (err) {
    pushDiagnostic("warning", "Project artifact persistence failed.", String(err?.message || err));
    return { ok: false, reason: "write_failed" };
  }
}

async function readProjectArtifactById(artifactType = "", artifactId = "") {
  const bridge = getDesktopProjectArtifactBridge();
  const projectFilePath = String(state.projectFilePath || "").trim();
  if (!bridge || !projectFilePath) return null;
  const normalizedType = String(artifactType || "").trim();
  const normalizedId = String(artifactId || "").trim();
  if (!normalizedType || !normalizedId) return null;
  try {
    const res = await bridge.readProjectArtifact({
      projectFilePath,
      artifactType: normalizedType,
      artifactId: normalizedId
    });
    return res?.ok === true && res.artifact && typeof res.artifact === "object" ? res.artifact : null;
  } catch {
    return null;
  }
}

async function loadHistoryEntrySnapshot(entry = null) {
  if (!entry || typeof entry !== "object") return null;
  const refs = entry.artifactRefs || {};
  const [
    analysisArtifact,
    designSceneContext,
    musicDesignContext,
    directorProfile,
    creativeBrief,
    proposalBundle,
    intentHandoff,
    planHandoff,
    applyResult
  ] = await Promise.all([
    readProjectArtifactById("analysis_artifact_v1", refs.analysisArtifactId),
    readProjectArtifactById("design_scene_context_v1", refs.sceneContextId),
    readProjectArtifactById("music_design_context_v1", refs.musicContextId),
    readProjectArtifactById("director_profile_v1", refs.directorProfileId),
    readProjectArtifactById("creative_brief_v1", refs.briefId),
    readProjectArtifactById("proposal_bundle_v1", refs.proposalId),
    readProjectArtifactById("intent_handoff_v1", refs.intentHandoffId),
    readProjectArtifactById("plan_handoff_v1", refs.planId),
    readProjectArtifactById("apply_result_v1", refs.applyResultId)
  ]);
  return {
    historyEntryId: String(entry.historyEntryId || "").trim(),
    analysisArtifact,
    designSceneContext,
    musicDesignContext,
    directorProfile,
    creativeBrief,
    proposalBundle,
    intentHandoff,
    planHandoff,
    applyResult
  };
}

async function selectHistoryEntry(entryId = "", options = {}) {
  const normalizedId = String(entryId || "").trim();
  state.ui.selectedHistoryEntry = normalizedId;
  const applyHistory = Array.isArray(state.applyHistory) ? state.applyHistory : [];
  const selectedEntry = applyHistory.find((entry) => String(entry?.historyEntryId || "") === normalizedId) || null;
  if (!selectedEntry) {
    state.ui.selectedHistorySnapshot = null;
    if (options.forReview) state.ui.reviewHistorySnapshot = null;
    persist();
    render();
    return null;
  }
  const snapshot = await loadHistoryEntrySnapshot(selectedEntry);
  state.ui.selectedHistorySnapshot = snapshot;
  if (options.forReview) {
    state.ui.reviewHistorySnapshot = snapshot;
  }
  persist();
  render();
  return snapshot;
}

function buildApplyHistoryEntry({
  status = "",
  summary = "",
  stage = "",
  commandCount = 0,
  impactCount = 0,
  currentRevision = "",
  nextRevision = "",
  verification = null,
  planHandoff = null,
  applyResult = null
} = {}) {
  const context = currentApplyContext();
  return {
    ...buildHistoryEntry({
      createdAt: new Date().toISOString(),
      projectId: context.projectKey,
      projectKey: context.projectKey,
      sequencePath: context.sequencePath,
      xlightsRevisionBefore: String(currentRevision || state.draftBaseRevision || state.revision || "unknown"),
      xlightsRevisionAfter: String(nextRevision || currentRevision || state.revision || "unknown"),
      status,
      summary,
      artifactRefs: currentArtifactRefs({ planHandoff, applyResult }),
      snapshotSummary: buildHistorySnapshotSummary({
        creativeBrief: state.creative?.brief || null,
        proposalBundle: state.creative?.proposalBundle || null,
        planHandoff: planHandoff || getValidHandoff("plan_handoff_v1"),
        applyResult,
        selectedSections: getSelectedSections(),
        selectedTargets: normalizeMetadataSelectionIds(state.ui.metadataSelectionIds || [])
      }),
      applyStage: stage,
      commandCount,
      impactCount,
      verification
    }),
    endpoint: context.endpoint
  };
}

function buildCurrentReviewSnapshotSummary() {
  return buildHistorySnapshotSummary({
    creativeBrief: state.creative?.brief || null,
    proposalBundle: state.creative?.proposalBundle || null,
    planHandoff: getValidHandoff("plan_handoff_v1"),
    applyResult: null
  });
}

function pushApplyHistory(entry, options = {}) {
  const applyResult = options?.applyResult && typeof options.applyResult === "object" ? options.applyResult : null;
  const planHandoff = options?.planHandoff && typeof options.planHandoff === "object" ? options.planHandoff : null;
  state.applyHistory = [entry, ...(state.applyHistory || [])].slice(0, 80);
  state.ui.selectedHistoryEntry = String(entry?.historyEntryId || "").trim();
  state.ui.reviewHistorySnapshot = {
    historyEntryId: String(entry?.historyEntryId || "").trim(),
    analysisArtifact: state.audioAnalysis?.artifact || null,
    designSceneContext: buildCurrentDesignSceneContext(),
    musicDesignContext: buildCurrentMusicDesignContext(),
    directorProfile: state.directorProfile || null,
    creativeBrief: state.creative?.brief || null,
    proposalBundle: state.creative?.proposalBundle || null,
    intentHandoff: state.creative?.intentHandoff || getValidHandoff("intent_handoff_v1"),
    planHandoff: planHandoff || getValidHandoff("plan_handoff_v1"),
    applyResult
  };
  state.ui.selectedHistorySnapshot = state.ui.reviewHistorySnapshot;
}

async function appendDesktopApplyLog(entry) {
  const bridge = getDesktopAgentLogBridge();
  if (!bridge) return;
  try {
    await bridge.appendAgentApplyLog({ entry });
  } catch {
    // Non-fatal logging failure.
  }
}

async function refreshApplyHistoryFromDesktop(limit = 40) {
  const bridge = getDesktopAgentLogBridge();
  if (!bridge) return;
  const context = currentApplyContext();
  try {
    const res = await bridge.readAgentApplyLog({
      limit,
      projectKey: context.projectKey,
      sequencePath: context.sequencePath || ""
    });
    if (!res?.ok || !Array.isArray(res?.rows)) return;
    state.applyHistory = res.rows.slice(0, limit);
    const selectedId = String(state.ui.selectedHistoryEntry || "").trim();
    const nextSelectedId =
      selectedId && state.applyHistory.some((entry) => String(entry?.historyEntryId || "") === selectedId)
        ? selectedId
        : String(state.applyHistory[0]?.historyEntryId || "").trim();
    if (nextSelectedId) {
      await selectHistoryEntry(nextSelectedId, { forReview: true });
      return;
    }
    state.ui.selectedHistorySnapshot = null;
    state.ui.reviewHistorySnapshot = null;
  } catch {
    // Non-fatal history read failure.
  }
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
  if (key === "sequence") return "Ask about sequence context, scope, or loaded xLights state...";
  if (key === "design") return "Describe the feeling, references, or design direction you want...";
  if (key === "review") return "Ask what will change, what to review, or request a scoped sequence revision...";
  if (key === "metadata") return "Ask about tags, targeting, and semantic organization...";
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
      title: "Sequence context workspace",
      note: "Use team chat to verify the active sequence, current revision, scope, and sequencing prerequisites."
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
      title: "Metadata workspace",
      note: "Use team chat to organize tags and improve targeting for the designer and sequencer."
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

async function hydrateAgentHealth() {
  const bridge = getDesktopAgentConversationBridge();
  if (!bridge) {
    state.health.agentProvider = "";
    state.health.agentModel = "";
    state.health.agentConfigured = false;
    state.health.agentHasStoredApiKey = false;
    state.health.agentConfigSource = "none";
    return;
  }
  try {
    const res = await bridge.getAgentHealth();
    if (res?.ok) {
      state.health.agentProvider = String(res.provider || "openai");
      state.health.agentModel = String(res.model || "");
      state.health.agentConfigured = Boolean(res.configured);
      state.health.agentHasStoredApiKey = Boolean(res.hasStoredApiKey);
      state.health.agentConfigSource = String(res.source || "none");
    }
  } catch {
    state.health.agentConfigured = false;
  }
}

async function hydrateAgentConfigDraft() {
  const bridge = getDesktopAgentConfigBridge();
  if (!bridge) return;
  try {
    const res = await bridge.getAgentConfig();
    if (!res?.ok) return;
    state.ui.agentModelDraft = String(res.model || state.ui.agentModelDraft || "");
    state.ui.agentBaseUrlDraft = String(res.baseUrl || state.ui.agentBaseUrlDraft || "");
    state.health.agentHasStoredApiKey = Boolean(res.hasStoredApiKey);
    state.health.agentConfigSource = String(res.source || state.health.agentConfigSource || "none");
  } catch {
    // Non-fatal config read failure.
  }
}

async function onSaveAgentConfig() {
  const bridge = getDesktopAgentConfigBridge();
  if (!bridge) {
    setStatusWithDiagnostics("warning", "Cloud agent config requires desktop runtime.");
    return render();
  }
  const apiKeyInput = app.querySelector("#agent-api-key-input");
  const modelInput = app.querySelector("#agent-model-input");
  const baseUrlInput = app.querySelector("#agent-base-url-input");
  const apiKey = String(apiKeyInput?.value || "").trim();
  const model = String(modelInput?.value || "").trim();
  const baseUrl = String(baseUrlInput?.value || "").trim();
  try {
    const res = await bridge.setAgentConfig({
      apiKey: apiKey || undefined,
      model,
      baseUrl
    });
    if (!res?.ok) {
      setStatusWithDiagnostics("action-required", "Saving cloud agent config failed.", String(res?.error || "Unknown error"));
      return render();
    }
    state.ui.agentApiKeyDraft = "";
    if (apiKeyInput) apiKeyInput.value = "";
    await hydrateAgentHealth();
    await hydrateAgentConfigDraft();
    setStatus("info", "Cloud agent config saved.");
    persist();
    render();
  } catch (err) {
    setStatusWithDiagnostics("action-required", "Saving cloud agent config failed.", String(err?.message || err));
    render();
  }
}

async function onClearStoredAgentApiKey() {
  const bridge = getDesktopAgentConfigBridge();
  if (!bridge) {
    setStatusWithDiagnostics("warning", "Cloud agent config requires desktop runtime.");
    return render();
  }
  if (!window.confirm("Clear stored cloud agent API key?")) return;
  try {
    const res = await bridge.setAgentConfig({ clearApiKey: true });
    if (!res?.ok) {
      setStatusWithDiagnostics("action-required", "Clearing API key failed.", String(res?.error || "Unknown error"));
      return render();
    }
    await hydrateAgentHealth();
    await hydrateAgentConfigDraft();
    setStatus("info", "Stored cloud agent API key cleared.");
    persist();
    render();
  } catch (err) {
    setStatusWithDiagnostics("action-required", "Clearing API key failed.", String(err?.message || err));
    render();
  }
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
    await hydrateAgentHealth();
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
  const orchestrationRun = beginOrchestrationRun({ trigger: "orchestration-test", role: "audio_analyst" });
  state.ui.agentThinking = true;
  state.ui.diagnosticsOpen = true;
  state.ui.diagnosticsFilter = "all";
  state.ui.agentLastOrchestrationTestStatus = "Running orchestration test...";
  setStatus("info", "Testing agent orchestration...");
  pushDiagnostic("warning", "Agent orchestration test started.");
  render();
  try {
    const runtimeReady = await hydrateAgentRuntime({ force: true, quiet: true });
    if (!runtimeReady) {
      markOrchestrationStage(orchestrationRun, "runtime_load", "error", String(agentRuntime.error || "runtime unavailable"));
      endOrchestrationRun(orchestrationRun, { status: "failed", summary: "agent runtime unavailable" });
      const msg = `Failed: agent runtime unavailable (${agentRuntime.error || "unknown error"})`;
      state.ui.agentLastOrchestrationTestStatus = msg;
      setStatusWithDiagnostics("warning", "Agent orchestration test failed.", msg);
      return;
    }
    markOrchestrationStage(orchestrationRun, "runtime_load", "ok", "agent runtime loaded");
    clearAgentHandoffs();

    setAgentActiveRole("audio_analyst");
    const analysisSet = setAgentHandoff(
      "analysis_handoff_v1",
      buildOrchestrationTestAnalysisHandoff(),
      "audio_analyst"
    );
    if (!analysisSet.ok) {
      markOrchestrationStage(orchestrationRun, "analysis_handoff", "error", analysisSet.errors.join("; "));
      endOrchestrationRun(orchestrationRun, { status: "failed", summary: "analysis handoff failed" });
      const msg = `Failed at analysis handoff: ${analysisSet.errors.join("; ")}`;
      state.ui.agentLastOrchestrationTestStatus = msg;
      setStatusWithDiagnostics("warning", "Agent orchestration test failed.", msg);
      return;
    }
    markOrchestrationStage(orchestrationRun, "analysis_handoff", "ok", "analysis_handoff_v1 ready");

    setAgentActiveRole("designer_dialog");
    const chatIntent = latestUserIntentText() || "Test intent for orchestration";
    const intentSet = setAgentHandoff(
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
      markOrchestrationStage(orchestrationRun, "intent_handoff", "error", intentSet.errors.join("; "));
      endOrchestrationRun(orchestrationRun, { status: "failed", summary: "intent handoff failed" });
      const msg = `Failed at intent handoff: ${intentSet.errors.join("; ")}`;
      state.ui.agentLastOrchestrationTestStatus = msg;
      setStatusWithDiagnostics("warning", "Agent orchestration test failed.", msg);
      return;
    }
    markOrchestrationStage(orchestrationRun, "intent_handoff", "ok", "intent_handoff_v1 ready");

    setAgentActiveRole("sequence_agent");
    const planSource = (Array.isArray(state.proposed) && state.proposed.length)
      ? state.proposed
      : buildDemoProposedLines().slice(0, 3);
    let commands = [];
    try {
      commands = buildDesignerPlanCommands(planSource);
    } catch (err) {
      const msg = `Failed generating test commands: ${String(err?.message || err)}`;
      state.ui.agentLastOrchestrationTestStatus = msg;
      setStatusWithDiagnostics("warning", "Agent orchestration test failed.", msg);
      return;
    }
    const planSet = setAgentHandoff(
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
      markOrchestrationStage(orchestrationRun, "plan_handoff", "error", planSet.errors.join("; "));
      endOrchestrationRun(orchestrationRun, { status: "failed", summary: "plan handoff failed" });
      const msg = `Failed at plan handoff: ${planSet.errors.join("; ")}`;
      state.ui.agentLastOrchestrationTestStatus = msg;
      setStatusWithDiagnostics("warning", "Agent orchestration test failed.", msg);
      return;
    }
    markOrchestrationStage(orchestrationRun, "plan_handoff", "ok", "plan_handoff_v1 ready");

    const readyCount = state.health.agentHandoffsReady || "0/3";
    state.ui.agentLastOrchestrationTestStatus = `Passed (${readyCount} handoffs ready).`;
    setStatus("info", `Agent orchestration test passed (${readyCount}).`);
    pushDiagnostic("info", `Agent orchestration test passed (${readyCount}).`);
    endOrchestrationRun(orchestrationRun, { status: "ok", summary: `orchestration test passed (${readyCount})` });
  } catch (err) {
    markOrchestrationStage(orchestrationRun, "exception", "error", String(err?.message || err));
    endOrchestrationRun(orchestrationRun, { status: "failed", summary: "orchestration test error" });
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
  const orchestrationRun = beginOrchestrationRun({ trigger: "orchestration-matrix", role: "designer_dialog" });
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
    const runtimeReady = await hydrateAgentRuntime({ force: true, quiet: true });
    if (!runtimeReady) {
      markOrchestrationStage(orchestrationRun, "runtime_load", "error", String(agentRuntime.error || "runtime unavailable"));
      endOrchestrationRun(orchestrationRun, { status: "failed", summary: "runtime unavailable" });
      state.ui.agentLastOrchestrationMatrixStatus = "Failed: runtime unavailable";
      setStatusWithDiagnostics("warning", "Orchestration matrix failed: runtime unavailable.");
      return;
    }
    markOrchestrationStage(orchestrationRun, "runtime_load", "ok", "agent runtime loaded");

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
      markOrchestrationStage(
        orchestrationRun,
        `scenario:${name}`,
        ok ? "ok" : "error",
        `${note}${note ? " | " : ""}${elapsed}ms`
      );
    };

    runScenario("happy-path-gate", () => {
      const analysis = setAgentHandoff("analysis_handoff_v1", buildOrchestrationTestAnalysisHandoff(), "audio_analyst");
      const intent = setAgentHandoff("intent_handoff_v1", {
        goal: "Matrix happy path intent",
        mode: "revise",
        scope: { targetIds: [], tagNames: [], sections: [], timeRangeMs: null },
        constraints: { changeTolerance: "medium", preserveTimingTracks: true, allowGlobalRewrite: false },
        directorPreferences: { styleDirection: "", energyArc: "hold", focusElements: [], colorDirection: "" },
        approvalPolicy: { requiresExplicitApprove: true, elevatedRiskConfirmed: false }
      }, "designer_dialog");
      const plan = setAgentHandoff("plan_handoff_v1", {
        planId: `matrix-plan-${nowMs()}`,
        summary: "matrix happy path",
        estimatedImpact: 11,
        warnings: [],
        commands: buildDesignerPlanCommands(buildDemoProposedLines().slice(0, 2)),
        baseRevision: String(state.draftBaseRevision || "unknown"),
        validationReady: true
      }, "sequence_agent");
      const gate = evaluateApplyHandoffGate();
      return { ok: analysis.ok && intent.ok && plan.ok && gate.ok, note: gate.ok ? "gate open" : gate.message };
    });

    runScenario("missing-intent-blocked", () => {
      setAgentHandoff("analysis_handoff_v1", buildOrchestrationTestAnalysisHandoff(), "audio_analyst");
      setAgentHandoff("plan_handoff_v1", {
        planId: `matrix-plan-${nowMs()}`,
        summary: "missing intent case",
        estimatedImpact: 11,
        warnings: [],
        commands: buildDesignerPlanCommands(buildDemoProposedLines().slice(0, 1)),
        baseRevision: String(state.draftBaseRevision || "unknown"),
        validationReady: true
      }, "sequence_agent");
      const gate = evaluateApplyHandoffGate();
      return { ok: !gate.ok && gate.reason === "missing-intent-handoff", note: gate.message };
    });

    runScenario("revision-mismatch-blocked", () => {
      setAgentHandoff("intent_handoff_v1", {
        goal: "revision mismatch case",
        mode: "revise",
        scope: { targetIds: [], tagNames: [], sections: [], timeRangeMs: null },
        constraints: { changeTolerance: "medium", preserveTimingTracks: true, allowGlobalRewrite: false },
        directorPreferences: { styleDirection: "", energyArc: "hold", focusElements: [], colorDirection: "" },
        approvalPolicy: { requiresExplicitApprove: true, elevatedRiskConfirmed: false }
      }, "designer_dialog");
      setAgentHandoff("plan_handoff_v1", {
        planId: `matrix-plan-${nowMs()}`,
        summary: "revision mismatch",
        estimatedImpact: 11,
        warnings: [],
        commands: buildDesignerPlanCommands(buildDemoProposedLines().slice(0, 1)),
        baseRevision: "__old_revision__",
        validationReady: true
      }, "sequence_agent");
      const gate = evaluateApplyHandoffGate();
      return { ok: !gate.ok && gate.reason === "plan-base-revision-mismatch", note: gate.message };
    });

    runScenario("section-change-invalidates-plan", () => {
      setAgentHandoff("intent_handoff_v1", {
        goal: "section drift case",
        mode: "revise",
        scope: { targetIds: [], tagNames: [], sections: ["Verse 1"], timeRangeMs: null },
        constraints: { changeTolerance: "medium", preserveTimingTracks: true, allowGlobalRewrite: false },
        directorPreferences: { styleDirection: "", energyArc: "hold", focusElements: [], colorDirection: "" },
        approvalPolicy: { requiresExplicitApprove: true, elevatedRiskConfirmed: false }
      }, "designer_dialog");
      setAgentHandoff("plan_handoff_v1", {
        planId: `matrix-plan-${nowMs()}`,
        summary: "section invalidation",
        estimatedImpact: 11,
        warnings: [],
        commands: buildDesignerPlanCommands(buildDemoProposedLines().slice(0, 1)),
        baseRevision: String(state.draftBaseRevision || "unknown"),
        validationReady: true
      }, "sequence_agent");
      state.ui.sectionSelections = ["Verse 2"];
      reconcileHandoffsAgainstCurrentContext({ reasonPrefix: "matrix section-change" });
      return {
        ok: !getValidHandoff("plan_handoff_v1"),
        note: "plan_handoff_v1 cleared after section change"
      };
    });

    runScenario("audio-change-invalidates-analysis", () => {
      const beforeAudio = String(state.audioPathInput || "");
      setAgentHandoff("analysis_handoff_v1", buildOrchestrationTestAnalysisHandoff(), "audio_analyst");
      const changed = beforeAudio ? `${beforeAudio}.matrix` : "/tmp/matrix-audio.mp3";
      setAudioPathWithAgentPolicy(changed, "matrix audio change");
      const analysisCleared = !getValidHandoff("analysis_handoff_v1");
      const planCleared = !getValidHandoff("plan_handoff_v1");
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
    endOrchestrationRun(orchestrationRun, {
      status: finalOk ? "ok" : "failed",
      summary: `matrix ${passed}/${total} passed`
    });
    setStatus(finalOk ? "info" : "warning", `Orchestration matrix complete: ${passed}/${total} passed.`);
  } catch (err) {
    markOrchestrationStage(orchestrationRun, "exception", "error", String(err?.message || err));
    endOrchestrationRun(orchestrationRun, { status: "failed", summary: "matrix run error" });
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
    refreshAgentRuntimeHealth();
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
  setAgentActiveRole("app_assistant");
  state.ui.chatDraft = "";
  state.ui.agentThinking = true;
  render();

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
      setAgentActiveRole(String(res?.routeDecision || "app_assistant"));
      setStatusWithDiagnostics("action-required", "Cloud agent conversation failed.", errText);
      await hydrateAgentHealth();
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
    setAgentActiveRole(nextRole);
    state.ui.agentResponseId = String(res.responseId || state.ui.agentResponseId || "");
    state.health.agentProvider = String(res.provider || "openai");
    state.health.agentModel = String(res.model || state.health.agentModel || "");
    state.health.agentConfigured = true;

    if (shouldAnswerExistingAudio) {
      const analysis = getValidHandoff("analysis_handoff_v1");
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
    if (!state.flags.activeSequenceLoaded && !state.flags.planOnlyMode) {
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

function setAudioPathWithAgentPolicy(nextPath = "", reason = "audio path updated") {
  const prev = String(state.audioPathInput || "").trim();
  const next = String(nextPath || "").trim();
  state.audioPathInput = next;
  if (prev !== next) {
    invalidateAnalysisHandoff(reason, { cascadePlan: true });
    resetDerivedAudioAnalysisState();
    if (next) {
      void hydrateAnalysisArtifactForCurrentMedia({ silent: true }).then((res) => {
        if (res?.ok) {
          saveCurrentProjectSnapshot();
          persist();
          render();
        }
      });
    }
  }
}

function applySequenceMediaToAudioPath(sequenceData) {
  if (!sequenceData || typeof sequenceData !== "object") return;
  const mediaFile = String(sequenceData.mediaFile || "").trim();
  state.sequenceMediaFile = mediaFile || "";
  if (!String(state.audioPathInput || "").trim() && mediaFile) {
    setAudioPathWithAgentPolicy(mediaFile, "sequence media adopted as initial analysis track");
  }
}

async function syncAudioPathFromMediaStatus() {
  try {
    const mediaBody = await getMediaStatus(state.endpoint);
    const mediaFile = String(mediaBody?.data?.mediaFile || "").trim();
    state.sequenceMediaFile = mediaFile || "";
    if (!String(state.audioPathInput || "").trim() && mediaFile) {
      setAudioPathWithAgentPolicy(mediaFile, "media status adopted as initial analysis track");
    }
  } catch {
    // Fallback for builds without media.getStatus.
    try {
      const open = await getOpenSequence(state.endpoint);
      const seq = open?.data?.sequence;
      if (open?.data?.isOpen && seq) {
        applySequenceMediaToAudioPath(seq);
      }
    } catch {
      // Keep existing value if neither endpoint is available.
    }
  }
}

function extractPickedPath(file) {
  if (!file || typeof file !== "object") return "";
  if (typeof file.path === "string" && file.path.trim()) return file.path.trim();
  return "";
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
  if (!state.flags.activeSequenceLoaded) return "Open a sequence first.";
  if (!String(state.sequencePathInput || "").trim()) return "Set a sequence path.";
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
        const analysis = await runAudioAnalysisPipeline({ refreshTracks: true });
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
    analysisHandoff: getValidHandoff("analysis_handoff_v1")
  });
}

function hasUsableCurrentAudioAnalysis() {
  const currentAudioPath = String(state.audioPathInput || "").trim();
  if (!currentAudioPath) return false;
  const handoffRecord = getValidHandoffRecord("analysis_handoff_v1");
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
  const analysis = getValidHandoff("analysis_handoff_v1");
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
  const analysisHandoff = getValidHandoff("analysis_handoff_v1");
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
  return setAgentHandoff("intent_handoff_v1", directIntent.intentHandoff, producer);
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
  const analysisHandoff = getValidHandoff("analysis_handoff_v1");
  let intentHandoff = state.creative?.intentHandoff && typeof state.creative.intentHandoff === "object"
    ? state.creative.intentHandoff
    : getValidHandoff("intent_handoff_v1");
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
  setAgentHandoff("intent_handoff_v1", intentHandoff, "designer_dialog");
  setAgentHandoff("plan_handoff_v1", sequencerPlan, "sequence_agent");
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
  const base = Array.isArray(assignments) ? assignments : [];
  const prefIndex = preferencesByTargetId && typeof preferencesByTargetId === "object" ? preferencesByTargetId : {};
  return base.map((assignment) => {
    const targetId = String(assignment?.targetId || "").trim();
    const pref = targetId && prefIndex[targetId] && typeof prefIndex[targetId] === "object" ? prefIndex[targetId] : null;
    if (!pref) return assignment;
    const mergedTags = Array.from(new Set([
      ...arr(assignment?.tags),
      ...(pref?.rolePreference ? [pref.rolePreference] : []),
      ...arr(pref?.semanticHints)
    ].map((row) => normalizeMetadataTagName(row)).filter(Boolean)));
    return {
      ...assignment,
      tags: mergedTags,
      semanticHints: arr(pref?.semanticHints).map((row) => normalizeMetadataTagName(row)).filter(Boolean),
      effectAvoidances: arr(pref?.effectAvoidances).map((row) => normalizeMetadataTagName(row)).filter(Boolean),
      rolePreference: pref?.rolePreference ? normalizeMetadataTagName(pref.rolePreference) : ""
    };
  });
}

function getMetadataTagRecords() {
  const raw = Array.isArray(state.metadata?.tags) ? state.metadata.tags : [];
  return mergeMetadataTagRecords(raw);
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
    invalidatePlanHandoff("selected tags changed");
  }
  persist();
}

function clearMetadataSelectedTags() {
  const before = normalizeStringArray(normalizeMetadataSelectedTags(state.ui.metadataSelectedTags));
  state.ui.metadataSelectedTags = [];
  if (before.length) {
    invalidatePlanHandoff("selected tags cleared");
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
  return terms.some((term) => text.includes(term));
}

function setMetadataSelectionIds(selectionIds, { save = true } = {}) {
  const before = normalizeStringArray(normalizeMetadataSelectionIds(state.ui.metadataSelectionIds));
  state.ui.metadataSelectionIds = normalizeMetadataSelectionIds(selectionIds);
  const after = normalizeStringArray(normalizeMetadataSelectionIds(state.ui.metadataSelectionIds));
  if (!arraysEqualAsSets(before, after)) {
    invalidatePlanHandoff("target selection changed");
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
  invalidatePlanHandoff("metadata role preference changed");
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
  invalidatePlanHandoff("metadata semantic hints changed");
  saveMetadataAndRender(`Updated semantic hints for ${target.displayName || id}.`);
  return true;
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
  invalidatePlanHandoff("metadata effect avoidances changed");
  saveMetadataAndRender(`Updated effect avoidances for ${target.displayName || id}.`);
  return true;
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
  clearAgentHandoff("intent_handoff_v1", "draft cleared", { pushLog: false });
  clearAgentHandoff("plan_handoff_v1", "draft cleared", { pushLog: false });
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

function syncProjectSummaryInputs() {
  const showFolderInput = app.querySelector("#showfolder-input");
  const mediaPathInput = app.querySelector("#mediapath-input");
  const metadataRootInput = app.querySelector("#project-metadata-root-input");
  if (showFolderInput) state.showFolder = showFolderInput.value.trim() || state.showFolder;
  if (mediaPathInput) state.mediaPath = mediaPathInput.value.trim() || "";
  if (metadataRootInput) state.projectMetadataRoot = metadataRootInput.value.trim();
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

function openProjectNameDialog({ mode, title, initialName = "" }) {
  state.ui.projectNameDialogOpen = true;
  state.ui.projectNameDialogMode = String(mode || "").trim();
  state.ui.projectNameDialogTitle = String(title || "Project name");
  state.ui.projectNameDialogValue = String(initialName || "");
  state.ui.projectNameDialogError = "";
  persist();
  render();
}

function closeProjectNameDialog() {
  state.ui.projectNameDialogOpen = false;
  state.ui.projectNameDialogMode = "";
  state.ui.projectNameDialogTitle = "";
  state.ui.projectNameDialogValue = "";
  state.ui.projectNameDialogError = "";
  persist();
  render();
}

async function confirmProjectNameDialog() {
  const mode = String(state.ui.projectNameDialogMode || "").trim();
  const normalizedName = normalizeProjectDisplayName(state.ui.projectNameDialogValue || "");
  if (!normalizedName) {
    state.ui.projectNameDialogError = "Project name is required.";
    persist();
    render();
    return;
  }

  const previousName = String(state.projectName || "").trim();
  state.projectName = normalizedName;

  if (mode === "create") {
    state.projectFilePath = "";
    resetSessionDraftState();
    resetCreativeState();
    state.flags.activeSequenceLoaded = false;
    state.activeSequence = "";
    state.sequencePathInput = "";
    state.newSequencePathInput = "";
    state.audioPathInput = "";
    state.mediaPath = "";
    state.savePathInput = "";
    state.recentSequences = [];
    state.projectSequences = [];
    state.projectCreatedAt = "";
    state.projectUpdatedAt = "";

    const saved = await saveProjectToCurrentFile({ saveAs: false });
    if (!saved?.ok) {
      state.ui.projectNameDialogError = "";
      closeProjectNameDialog();
      setStatusWithDiagnostics("warning", `Created new project but initial save failed: ${saved?.error || "unknown error"}`);
    } else {
      state.ui.firstRunMode = false;
      state.ui.projectNameDialogError = "";
      closeProjectNameDialog();
      setStatus("info", `Created new project: ${state.projectName}`);
    }
    saveCurrentProjectSnapshot();
    persist();
    render();
    return;
  }

  if (mode === "saveAs") {
    const saved = await saveProjectToCurrentFile({ saveAs: true });
    if (saved?.ok) {
      state.ui.projectNameDialogError = "";
      closeProjectNameDialog();
      setStatus("info", `Saved project as: ${saved.filePath}`);
    } else if (saved?.code === "CANCELED") {
      state.projectName = previousName;
      closeProjectNameDialog();
      setStatus("info", "Save As canceled.");
    } else {
      state.projectName = previousName;
      state.ui.projectNameDialogError = "";
      closeProjectNameDialog();
      setStatusWithDiagnostics("action-required", `Save As failed: ${saved?.error || "unknown error"}`);
    }
    saveCurrentProjectSnapshot();
    persist();
    render();
  }
}

async function onSaveProjectSettings() {
  const previousProjectName = String(state.projectName || "").trim();
  const previousShowFolder = String(state.showFolder || "").trim();
  syncProjectSummaryInputs();
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
    setAudioPathWithAgentPolicy(audioInput.value.trim() || "", "audio path edited");
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

function getDesktopFileDialogBridge() {
  const w = typeof window !== "undefined" ? window : null;
  if (!w) return null;

  const xld = w.xlightsDesignerDesktop || w.__xlightsDesignerDesktop;
  if (xld) {
    if (typeof xld.openFileDialog === "function") {
      return async (opts) => xld.openFileDialog(opts);
    }
    if (typeof xld.pickFile === "function") {
      return async (opts) => xld.pickFile(opts);
    }
    if (typeof xld.selectFile === "function") {
      return async (opts) => xld.selectFile(opts);
    }
  }

  const electron = w.electronAPI;
  if (electron) {
    if (typeof electron.openFileDialog === "function") {
      return async (opts) => electron.openFileDialog(opts);
    }
    if (typeof electron.pickFile === "function") {
      return async (opts) => electron.pickFile(opts);
    }
    if (typeof electron.selectFile === "function") {
      return async (opts) => electron.selectFile(opts);
    }
  }

  // Tauri v2 plugin-style dialog API
  if (w.__TAURI__ && w.__TAURI__.dialog && typeof w.__TAURI__.dialog.open === "function") {
    return async (opts) => {
      const accept = Array.isArray(opts?.filters)
        ? opts.filters.flatMap((f) =>
            Array.isArray(f?.extensions)
              ? f.extensions.map((ext) => `.${String(ext).toLowerCase()}`)
              : []
          )
        : [];
      return w.__TAURI__.dialog.open({
        title: opts?.title || "Select File",
        multiple: false,
        directory: Boolean(opts?.directory),
        filters: Array.isArray(opts?.filters)
          ? opts.filters.map((f) => ({
              name: f?.name || "Files",
              extensions: Array.isArray(f?.extensions) ? f.extensions.filter((e) => e !== "*") : []
            }))
          : undefined,
        // Some hosts normalize via accept strings.
        accept: accept.length ? accept : undefined
      });
    };
  }

  if (
    w.__TAURI__ &&
    w.__TAURI__.core &&
    typeof w.__TAURI__.core.invoke === "function"
  ) {
    return async (opts) =>
      w.__TAURI__.core.invoke("open_file_dialog", { options: opts });
  }

  return null;
}

function normalizeDialogPathSelection(result) {
  if (!result) return "";
  if (typeof result === "string") return result.trim();
  if (Array.isArray(result)) {
    const first = result.find((v) => typeof v === "string" && v.trim());
    return first ? first.trim() : "";
  }
  if (typeof result === "object") {
    if (typeof result.path === "string") return result.path.trim();
    if (typeof result.filePath === "string") return result.filePath.trim();
    if (typeof result.absolutePath === "string") return result.absolutePath.trim();
    if (Array.isArray(result.paths)) {
      const first = result.paths.find((v) => typeof v === "string" && v.trim());
      return first ? first.trim() : "";
    }
  }
  return "";
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
  void onRefreshSequenceCatalog({ silent: true });
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
  void onRefreshMediaCatalog({ silent: true });
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

async function onRefreshSequenceCatalog(options = {}) {
  const silent = options?.silent === true;
  const showFolder = String(state.showFolder || "").trim();
  if (!showFolder) {
    state.sequenceCatalog = [];
    state.showDirectoryStats = { xsqCount: 0, xdmetaCount: 0 };
    if (!silent) setStatus("warning", "Set Show Folder first.");
    persist();
    render();
    return;
  }
  const bridge = getDesktopSequenceBridge();
  if (!bridge) {
    if (!silent) setStatus("warning", "Sequence discovery requires desktop runtime.");
    render();
    return;
  }
  try {
    const res = await bridge.listSequencesInShowFolder({ showFolder });
    if (!res?.ok) {
      throw new Error(res?.error || "Unable to list sequences.");
    }
    const sequences = Array.isArray(res.sequences) ? res.sequences : [];
    state.sequenceCatalog = sequences;
    state.showDirectoryStats = {
      xsqCount: Number.isFinite(Number(res?.stats?.xsqCount)) ? Math.max(0, Number(res.stats.xsqCount)) : sequences.length,
      xdmetaCount: Number.isFinite(Number(res?.stats?.xdmetaCount)) ? Math.max(0, Number(res.stats.xdmetaCount)) : 0
    };
    if (state.ui.sequenceMode === "existing") {
      const exists = sequences.some((s) => String(s?.path || "") === state.sequencePathInput);
      if (!exists && sequences.length) {
        state.sequencePathInput = String(sequences[0].path || "");
      }
    }
    if (!silent) {
      setStatus("info", `Loaded ${sequences.length} sequence${sequences.length === 1 ? "" : "s"} from show folder.`);
    }
    saveCurrentProjectSnapshot();
    persist();
    render();
  } catch (err) {
    if (!silent) {
      setStatusWithDiagnostics(
        "action-required",
        `Sequence discovery failed: ${err.message}`,
        err.stack || ""
      );
    }
    render();
  }
}

async function onRefreshMediaCatalog(options = {}) {
  const silent = options?.silent === true;
  const mediaFolder = String(state.mediaPath || "").trim();
  if (!mediaFolder) {
    state.mediaCatalog = [];
    if (!silent) setStatus("warning", "Set Media Directory first.");
    persist();
    render();
    return;
  }
  const bridge = getDesktopMediaCatalogBridge();
  if (!bridge) {
    if (!silent) setStatus("warning", "Media catalog requires desktop runtime.");
    render();
    return;
  }
  try {
    const res = await bridge.listMediaFilesInFolder({
      mediaFolder,
      extensions: Array.from(SUPPORTED_SEQUENCE_MEDIA_EXTENSIONS)
    });
    if (!res?.ok) throw new Error(res?.error || "Unable to list media files.");
    const mediaFiles = Array.isArray(res.mediaFiles) ? res.mediaFiles : [];
    state.mediaCatalog = mediaFiles;

    const currentAudioPath = String(state.audioPathInput || "").trim();
    const sequenceMediaPath = String(state.sequenceMediaFile || "").trim();
    const preferred =
      mediaFiles.find((row) => String(row?.path || "") === currentAudioPath) ||
      mediaFiles.find((row) => String(row?.path || "") === sequenceMediaPath) ||
      null;

    if (preferred) {
      if (String(preferred.path || "").trim() !== currentAudioPath) {
        setAudioPathWithAgentPolicy(String(preferred.path || "").trim(), "media catalog preferred track");
      }
    } else if (currentAudioPath) {
      // Keep current external selection if it is outside the media library.
    } else if (mediaFiles.length === 1) {
      setAudioPathWithAgentPolicy(String(mediaFiles[0].path || "").trim(), "single media file selected");
    }

    if (!silent) {
      setStatus("info", `Media catalog refreshed: ${mediaFiles.length} file${mediaFiles.length === 1 ? "" : "s"} found.`);
    }
    persist();
    render();
  } catch (err) {
    state.mediaCatalog = [];
    if (!silent) {
      setStatusWithDiagnostics("warning", `Media catalog refresh failed: ${err?.message || err}`);
    }
    persist();
    render();
  }
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
  if (!state.flags.activeSequenceLoaded) return;
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

function isPathWithinShowFolder(candidatePath, showFolderPath) {
  const normalize = (value) =>
    String(value || "")
      .trim()
      .replace(/\\/g, "/")
      .replace(/\/+$/, "");
  const candidate = normalize(candidatePath);
  const root = normalize(showFolderPath);
  if (!candidate || !root) return false;
  if (candidate === root) return true;
  return candidate.startsWith(`${root}/`);
}

function isSequenceAllowedInActiveShowFolder(sequencePayload) {
  const showFolder = String(state.showFolder || "").trim();
  if (!showFolder) return true;
  const sequencePath = readSequencePathFromPayload(sequencePayload);
  if (!sequencePath) return true;
  return isPathWithinShowFolder(sequencePath, showFolder);
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
  await onOpenExistingSequence(selected);
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
  setAudioPathWithAgentPolicy(selected, "audio path selected");
  saveCurrentProjectSnapshot();
  persist();
  render();
}

function readSequencePathFromPayload(sequencePayload, fallbackPath = "") {
  return String(
    sequencePayload?.path ||
      sequencePayload?.file ||
      fallbackPath ||
      ""
  ).trim();
}

function applyOpenSequenceState(sequencePayload, fallbackPath = "") {
  const sequencePath = readSequencePathFromPayload(sequencePayload, fallbackPath);
  const sequenceName = String(
    sequencePayload?.name ||
      (sequencePath ? sequencePath.split("/").pop() : "") ||
      state.activeSequence ||
      ""
  ).trim();
  const mediaFile = sequencePayload?.mediaFile;
  const mediaPath = mediaFile == null ? "" : String(mediaFile).trim();
  state.sequenceSettings = {
    sequenceType: String(sequencePayload?.sequenceType || state.sequenceSettings?.sequenceType || "Media").trim() || "Media",
    supportsModelBlending: Boolean(sequencePayload?.supportsModelBlending)
  };

  if (sequenceName) state.activeSequence = sequenceName;
  if (sequencePath) {
    state.sequencePathInput = sequencePath;
    state.savePathInput = sequencePath;
    state.ui.sequenceMode = "existing";
    addRecentSequence(sequencePath);
  }
  state.sequenceMediaFile = mediaPath;
  if (!String(state.audioPathInput || "").trim() && mediaPath) {
    setAudioPathWithAgentPolicy(mediaPath, "open sequence media adopted as initial analysis track");
  }
}

async function onOpenSequence() {
  const previousPath = selectedSequencePath();
  syncSequencePathInput();
  const targetPath = selectedSequencePath();
  if (!state.flags.xlightsConnected) {
    setStatus("warning", "Connect to xLights before opening a sequence.");
    return render();
  }
  if (!targetPath) {
    setStatus("warning", state.ui.sequenceMode === "new" ? "Provide a new sequence path." : "Provide an existing sequence path.");
    return render();
  }

  if (state.ui.sequenceMode === "new" && state.newSequenceType === "musical" && !state.audioPathInput) {
    setStatus("warning", "Musical sequence requires an audio file path.");
    return render();
  }

  setStatus("info", state.ui.sequenceMode === "new" ? "Creating sequence..." : "Opening sequence...");
  render();
  try {
    await closeActiveSequenceForSwitch({ mode: "discard-unsaved" });

    const isAnimation = state.newSequenceType === "animation";
    const mediaFile = isAnimation ? null : (state.audioPathInput || null);
    const durationMs = isAnimation || !mediaFile ? state.newSequenceDurationMs : undefined;
    const body = state.ui.sequenceMode === "new"
      ? await createSequence(state.endpoint, {
          file: targetPath,
          mediaFile,
          durationMs,
          frameMs: state.newSequenceFrameMs
        })
      : await traceSequenceFileLifecycle("sequence.open", targetPath, () => openSequence(state.endpoint, targetPath, false, false));
    if (state.ui.sequenceMode === "new") {
      await traceSequenceFileLifecycle("sequence.create+save", targetPath, async () => {
        await saveSequence(state.endpoint, targetPath);
        await assertSequenceFileSafeAfterSave(targetPath, "New sequence save");
        return body;
      });
    }
    const seq = body?.data?.sequence || body?.data || {};
    applyOpenSequenceState(seq, targetPath);
    if (targetPath !== previousPath) {
      state.lastApplyBackupPath = "";
    }
    state.flags.activeSequenceLoaded = true;
    if (targetPath !== previousPath) {
      resetCreativeState();
      state.ui.agentResponseId = "";
    }
    setStatus(
      "info",
      `${state.ui.sequenceMode === "new" ? "Sequence ready" : "Opened sequence"}: ${state.activeSequence || targetPath}`
    );
    state.route = "sequence";
    render();

    try {
      await withTimeout(hydrateSidecarForCurrentSequence(), 3000, "Hydrate sidecar");
    } catch (err) {
      pushDiagnostic("warning", `Post-open sidecar hydrate timed out: ${err.message}`);
    }
    try {
      await withTimeout(syncAudioPathFromMediaStatus(), 3000, "Sync media status");
    } catch (err) {
      pushDiagnostic("warning", `Post-open media sync timed out: ${err.message}`);
    }
    try {
      await withTimeout(onRefresh(), 6000, "Post-open refresh");
    } catch (err) {
      pushDiagnostic("warning", `Post-open refresh timed out: ${err.message}`);
      setStatus(
        "warning",
        "Sequence opened, but refresh is taking too long. You can continue and use Refresh if needed."
      );
    }
  } catch (err) {
    setStatusWithDiagnostics("action-required", `Open failed: ${err.message}`, err.stack || "");
    render();
  } finally {
    saveCurrentProjectSnapshot();
    persist();
    render();
  }
}

async function onOpenExistingSequence(targetPathInput = "") {
  const previousPath = String(state.sequencePathInput || "").trim();
  const targetPath = String(targetPathInput || state.sequencePathInput || "").trim();
  if (!state.flags.xlightsConnected) {
    setStatus("warning", "Connect to xLights before opening a sequence.");
    return render();
  }
  if (!targetPath) {
    setStatus("warning", "Choose a sequence first.");
    return render();
  }

  setStatus("info", "Opening sequence...");
  render();
  try {
    await closeActiveSequenceForSwitch({ mode: "discard-unsaved" });
    const body = await traceSequenceFileLifecycle("sequence.open", targetPath, () => openSequence(state.endpoint, targetPath, false, false));
    const seq = body?.data?.sequence || body?.data || {};
    applyOpenSequenceState(seq, targetPath);
    if (targetPath !== previousPath) {
      state.lastApplyBackupPath = "";
      resetCreativeState();
      state.ui.agentResponseId = "";
    }
    state.flags.activeSequenceLoaded = true;
    setStatus("info", `Opened sequence: ${state.activeSequence || targetPath}`);
    state.route = "sequence";
    render();

    try {
      await withTimeout(hydrateSidecarForCurrentSequence(), 3000, "Hydrate sidecar");
    } catch (err) {
      pushDiagnostic("warning", `Post-open sidecar hydrate timed out: ${err.message}`);
    }
    try {
      await withTimeout(syncAudioPathFromMediaStatus(), 3000, "Sync media status");
    } catch (err) {
      pushDiagnostic("warning", `Post-open media sync timed out: ${err.message}`);
    }
    try {
      await withTimeout(onRefresh(), 6000, "Post-open refresh");
    } catch (err) {
      pushDiagnostic("warning", `Post-open refresh timed out: ${err.message}`);
      setStatus(
        "warning",
        "Sequence opened, but refresh is taking too long. You can continue and use Refresh if needed."
      );
    }
  } catch (err) {
    setStatusWithDiagnostics("action-required", `Open failed: ${err.message}`, err.stack || "");
    render();
  } finally {
    saveCurrentProjectSnapshot();
    persist();
    render();
  }
}

async function onOpenSelectedSequence() {
  const targetPath = String(state.sequencePathInput || "").trim();
  if (!targetPath) {
    setStatus("warning", "Select a sequence first.");
    render();
    return;
  }
  await onOpenExistingSequence(targetPath);
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
    applyOpenSequenceState(seq, targetPath);
    state.flags.activeSequenceLoaded = true;
    state.lastApplyBackupPath = "";
    resetCreativeState();
    setStatus("info", `Sequence ready: ${state.activeSequence || targetPath}`);
    saveCurrentProjectSnapshot();
    persist();
    render();
    await onRefreshSequenceCatalog({ silent: true });
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
    await onRefreshSequenceCatalog({ silent: true });
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
  const built = buildSectionSuggestions(marks);
  const labels = built.labels;
  state.sectionSuggestions = labels;
  state.sectionStartByLabel = built.startByLabel;
  reconcileSectionSelectionsToAvailable();
  return { track: preferred, count: state.sectionSuggestions.length, usedDefault: labels.length === 0 };
}

async function onOpenSelectedProject(selectedKeyArg = "") {
  syncProjectSummaryInputs();
  if (selectedKeyArg && typeof selectedKeyArg === "object") {
    selectedKeyArg = "";
  }
  let selectedKey = String(selectedKeyArg || "").trim();
  const bridge = getDesktopProjectBridge();
  if (!bridge) {
    setStatusWithDiagnostics("warning", "Open project requires desktop runtime.");
    return render();
  }

  if (!selectedKey) {
    const dialogRes = await bridge.openProjectDialog({ rootPath: state.projectMetadataRoot });
    if (!dialogRes?.ok || !dialogRes?.filePath) {
      setStatus("info", "Open project canceled.");
      return render();
    }
    const fileRes = await bridge.openProjectFile({ filePath: dialogRes.filePath });
    if (!fileRes?.ok || !fileRes?.snapshot) {
      setStatusWithDiagnostics("warning", `Open failed: ${fileRes?.error || "Invalid project file."}`);
      return render();
    }
    if (fileRes.project?.appRootPath) state.projectMetadataRoot = String(fileRes.project.appRootPath);
    state.projectFilePath = String(dialogRes.filePath);
    state.projectName = String(fileRes.project?.projectName || state.projectName);
    state.showFolder = String(fileRes.project?.showFolder || state.showFolder);
    state.mediaPath = String(fileRes.project?.mediaPath || state.mediaPath);
    state.projectCreatedAt = String(fileRes.project?.createdAt || state.projectCreatedAt || "");
    state.projectUpdatedAt = String(fileRes.project?.updatedAt || state.projectUpdatedAt || "");
    applyProjectSnapshot(fileRes.snapshot);
    setStatus("info", `Opened project: ${state.projectName}`);
    persist();
    render();
    void hydrateAnalysisArtifactForCurrentMedia({ silent: true }).then((res) => {
      if (res?.ok) {
        saveCurrentProjectSnapshot();
        persist();
        render();
      }
    });
    void onRefreshSequenceCatalog({ silent: true });
    void onRefreshMediaCatalog({ silent: true });
    return;
  }

  const { projectName, showFolder } = parseProjectKey(selectedKey);
  if (!projectName) {
    setStatus("warning", "Selected project key is invalid.");
    return render();
  }

  const rootPath = state.projectMetadataRoot || inferProjectRootFromFilePath(state.projectFilePath);
  if (!rootPath) {
    setStatusWithDiagnostics("warning", "Open failed: project metadata folder is not set.");
    return render();
  }
  const guessedFilePath = buildCanonicalProjectFilePath(rootPath, projectName);
  const fileRes = await bridge.openProjectFile({ filePath: guessedFilePath });
  if (!fileRes?.ok || !fileRes?.snapshot) {
    setStatusWithDiagnostics("warning", `Open failed: ${fileRes?.error || "Invalid project file."}`);
    return render();
  }
  state.projectFilePath = guessedFilePath;
  if (fileRes.project?.appRootPath) state.projectMetadataRoot = String(fileRes.project.appRootPath);
  state.projectName = String(fileRes.project?.projectName || projectName);
  state.showFolder = String(fileRes.project?.showFolder || showFolder);
  state.mediaPath = String(fileRes.project?.mediaPath || state.mediaPath);
  state.projectCreatedAt = String(fileRes.project?.createdAt || state.projectCreatedAt || "");
  state.projectUpdatedAt = String(fileRes.project?.updatedAt || state.projectUpdatedAt || "");
  applyProjectSnapshot(fileRes.snapshot);
  setStatus("info", `Opened project: ${state.projectName}`);
  persist();
  render();
  void hydrateAnalysisArtifactForCurrentMedia({ silent: true }).then((res) => {
    if (res?.ok) {
      saveCurrentProjectSnapshot();
      persist();
      render();
    }
  });
  void onRefreshSequenceCatalog({ silent: true });
  void onRefreshMediaCatalog({ silent: true });
}

function onCreateNewProject() {
  syncProjectSummaryInputs();
  const bridge = getDesktopProjectBridge();
  if (!bridge) {
    setStatusWithDiagnostics("warning", "New project requires desktop runtime.");
    return render();
  }
  openProjectNameDialog({
    mode: "create",
    title: "Create New Project",
    initialName: ""
  });
}

async function onSaveProjectAs() {
  syncProjectSummaryInputs();
  const previousName = String(state.projectName || "").trim();
  if (!previousName && !String(state.projectFilePath || "").trim()) {
    // Keep empty when there is no current project, but still let the user continue.
  }
  openProjectNameDialog({
    mode: "saveAs",
    title: "Save Project As",
    initialName: previousName || "Project"
  });
}

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

function onResetProjectWorkspace() {
  const key = getProjectKey();
  if (!key || key === "::") {
    setStatus("warning", "Set project name and show folder before reset.");
    return render();
  }

  if (!window.confirm("Reset current project workspace to defaults?")) {
    setStatus("info", "Workspace reset canceled.");
    return render();
  }

  state.sequencePathInput = defaultState.sequencePathInput;
  state.newSequencePathInput = defaultState.newSequencePathInput;
  state.newSequenceType = defaultState.newSequenceType;
  state.newSequenceDurationMs = defaultState.newSequenceDurationMs;
  state.newSequenceFrameMs = defaultState.newSequenceFrameMs;
  state.audioPathInput = defaultState.audioPathInput;
  state.mediaPath = defaultState.mediaPath;
  state.mediaCatalog = [];
  state.savePathInput = defaultState.savePathInput;
  state.lastApplyBackupPath = defaultState.lastApplyBackupPath;
  state.recentSequences = [];
  state.projectSequences = [];
  state.revision = "unknown";
  state.draftBaseRevision = "unknown";
  state.proposed = [...defaultState.proposed];
  state.flags.planOnlyMode = false;
  state.flags.planOnlyForcedByConnectivity = false;
  state.flags.planOnlyForcedByRollout = false;
  state.flags.hasDraftProposal = state.proposed.length > 0;
  state.flags.proposalStale = false;
  state.ui.sectionSelections = ["all"];
  state.ui.designTab = "chat";
  state.ui.designRevisionTarget = null;
  state.ui.sequenceDesignFilterId = "";
  state.ui.sequenceMode = "existing";
  state.ui.sectionTrackName = "";
  state.ui.metadataTargetId = "";
  state.ui.metadataSelectionIds = [];
  state.ui.metadataSelectedTags = [];
  state.ui.metadataNewTag = "";
  state.ui.metadataNewTagDescription = "";
  state.ui.agentResponseId = "";
  state.ui.metadataFilterName = "";
  state.ui.metadataFilterType = "";
  state.ui.metadataFilterSupport = "";
  state.ui.metadataFilterTags = "";
  state.ui.detailsOpen = false;
  state.chat = [];
  state.ui.chatDraft = "";
  state.diagnostics = [];
  state.jobs = [];
  state.sectionStartByLabel = {};
  state.metadata = structuredClone(defaultState.metadata);
  resetCreativeState();

  const store = loadProjectsStore();
  store[key] = extractProjectSnapshot();
  persistProjectsStore(store);

  setStatus("info", "Project workspace reset.");
  persist();
  render();
}

async function onResetAppInstallState() {
  const bridge = getDesktopAppAdminBridge();
  if (!bridge) {
    setStatusWithDiagnostics("warning", "Fresh-install reset requires desktop runtime.");
    return render();
  }
  if (!window.confirm("Reset app state to first-run defaults? This clears local app state, recent-project index, chat history, and UI memory, but preserves stored API keys, project folders, and analysis artifacts.")) {
    setStatus("info", "Fresh-install reset canceled.");
    return render();
  }
  try {
    const res = await bridge.resetAppInstallState({ resetMode: "app-state-only" });
    if (!res?.ok) {
      setStatusWithDiagnostics("action-required", "Fresh-install reset failed.", String(res?.error || "Unknown error"));
      return render();
    }
    const preservedState = structuredClone(defaultState);
    preservedState.route = "settings";
    preservedState.projectName = "";
    preservedState.projectConcept = "";
    preservedState.showFolder = "";
    preservedState.mediaPath = "";
    preservedState.projectFilePath = "";
    preservedState.activeSequence = "";
    preservedState.sequencePathInput = "";
    preservedState.newSequencePathInput = "";
    preservedState.audioPathInput = "";
    preservedState.savePathInput = "";
    preservedState.lastApplyBackupPath = "";
    preservedState.recentSequences = [];
    preservedState.projectCreatedAt = "";
    preservedState.projectUpdatedAt = "";
    preservedState.revision = "unknown";
    preservedState.status = {
      level: "info",
      text: "Welcome. Start in Settings, then create or open a project when you are ready."
    };
    preservedState.flags.xlightsConnected = false;
    preservedState.flags.activeSequenceLoaded = false;
    preservedState.health.sequenceOpen = false;
    preservedState.ui.firstRunMode = true;
    preservedState.ui.agentModelDraft = String(state.ui.agentModelDraft || "");
    preservedState.ui.agentBaseUrlDraft = String(state.ui.agentBaseUrlDraft || "");
    preservedState.ui.analysisServiceUrlDraft = String(state.ui.analysisServiceUrlDraft || "");
    preservedState.ui.analysisServiceApiKeyDraft = String(state.ui.analysisServiceApiKeyDraft || "");
    preservedState.ui.analysisServiceAuthBearerDraft = String(state.ui.analysisServiceAuthBearerDraft || "");
    preservedState.chat = [];
    preservedState.ui.chatDraft = "";
    preservedState.teamChat = {
      identities: buildTeamChatIdentities(DEFAULT_TEAM_CHAT_IDENTITIES)
    };
    const preservedRaw = JSON.stringify(preservedState);
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(PROJECTS_KEY);
      localStorage.setItem(STORAGE_KEY, preservedRaw);
      localStorage.setItem(PROJECTS_KEY, "");
      sessionStorage.setItem(RESET_PRESERVE_KEY, preservedRaw);
    } catch {
      // ignore local storage cleanup failures
    }
    try {
      const stateBridge = getDesktopStateBridge();
      if (stateBridge && typeof stateBridge.writeAppState === "function") {
        await stateBridge.writeAppState({
          localStateRaw: preservedRaw,
          projectsStoreRaw: ""
        });
      }
    } catch {
      // Best effort. Reload will still use local/session storage fallback.
    }
    state.chat = [];
    state.ui.chatDraft = "";
    persist();
    window.location.reload();
  } catch (err) {
    setStatusWithDiagnostics("action-required", "Fresh-install reset failed.", String(err?.message || err));
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

function buildAudioPipelineSummaryLines(pipeline = {}) {
  const checks = [
    ["Service reached", Boolean(pipeline?.analysisServiceCalled)],
    ["Service succeeded", Boolean(pipeline?.analysisServiceSucceeded)],
    ["Beat markers ready", Boolean(pipeline?.beatTrackWritten)],
    ["Bar markers ready", Boolean(pipeline?.barTrackWritten)],
    ["Chord markers ready", Boolean(pipeline?.chordTrackWritten)],
    ["Structure markers ready", Boolean(pipeline?.structureTrackWritten)],
    ["Lyrics markers ready", Boolean(pipeline?.lyricsTrackWritten)],
    ["Song context derived", Boolean(pipeline?.webContextDerived)]
  ];
  if (pipeline?.structureTrackPreserved) {
    checks.push(["Song structure preserved (manual edits)", true]);
  }
  if (pipeline?.beatTrackPreserved) checks.push(["Beat track preserved (manual edits)", true]);
  if (pipeline?.barTrackPreserved) checks.push(["Bars track preserved (manual edits)", true]);
  if (pipeline?.chordTrackPreserved) checks.push(["Chords track preserved (manual edits)", true]);
  if (pipeline?.lyricsTrackPreserved) checks.push(["Lyrics track preserved (manual edits)", true]);
  return checks.map(([label, ok]) => `${label}: ${ok ? "PASS" : "PENDING"}`);
}

function formatAudioAnalysisSummary({ analysis = null, pipeline = null, webValidation = null } = {}) {
  const a = analysis && typeof analysis === "object" ? analysis : {};
  const trackName = String(a?.trackName || basenameOfPath(state.audioPathInput || "") || "(none)");
  const fpTitle = String(a?.trackIdentity?.title || "").trim();
  const fpArtist = String(a?.trackIdentity?.artist || "").trim();
  const fpIsrc = String(a?.trackIdentity?.isrc || "").trim();
  const fingerprintMatch = fpTitle && fpArtist ? `${fpTitle} - ${fpArtist}` : "unavailable";
  const durationMs = Number(a?.media?.durationMs);
  const channels = Number(a?.media?.channels);
  const sampleRate = Number(a?.media?.sampleRate);
  const structure = Array.isArray(a?.structure) ? a.structure.filter(Boolean) : [];
  const tempoEstimate = a?.timing?.tempoEstimate;
  const timeSignature = String(a?.timing?.timeSignature || "unknown");
  const songContextLine = (Array.isArray(a?.summaryLines) ? a.summaryLines : [])
    .find((line) => String(line || "").toLowerCase().startsWith("song context:"));
  const songContext = songContextLine
    ? String(songContextLine).slice("Song context:".length).trim()
    : "pending";
  const tempoText = Number.isFinite(Number(tempoEstimate))
    ? `${Number(tempoEstimate)} BPM (inferred)`
    : (String(tempoEstimate || "").trim() || "pending");

  const lines = [
    `Audio source: ${trackName}`,
    `Fingerprint match: ${fingerprintMatch}`,
    `Fingerprint ISRC: ${fpIsrc || "unavailable"}`,
    `Media metadata: ${Number.isFinite(durationMs) ? `${Math.round(durationMs)}ms` : "duration pending"}, ${Number.isFinite(channels) ? `${channels}ch` : "ch?"}, ${Number.isFinite(sampleRate) ? `${sampleRate}Hz` : "rate?"}`,
    `Song structure: ${structure.length ? structure.join(", ") : "pending"}`,
    `Tempo/time signature: ${tempoText} / ${timeSignature}`,
    "Pipeline checks:"
  ];
  for (const row of buildAudioPipelineSummaryLines(pipeline || {})) {
    lines.push(`- ${row}`);
  }
  if (webValidation && typeof webValidation === "object") {
    if (webValidation.ignored) {
      if (webValidation.reason === "non-informational-sources") {
        lines.push("Web validation: ignored (non-informational sources)");
      } else if (webValidation.reason === "unverifiable-sources") {
        lines.push("Web validation: ignored (sources not track-specific)");
      } else if (webValidation.reason === "low-confidence") {
        lines.push("Web validation: ignored (low-confidence web evidence)");
      } else {
        lines.push("Web validation: ignored (non-exact track match)");
      }
      lines.push(`Song context: ${songContext || "pending"}`);
      return lines.join("\n");
    }
    const sig = String(webValidation.timeSignature || "unknown");
    const bpm = Number(webValidation.tempoBpm);
    const conf = String(webValidation.confidence || "low");
    const conflict = Boolean(webValidation.conflict);
    if (conflict) {
      lines.push("Web validation: conflict with service result (see diagnostics)");
    } else {
      lines.push(`Web validation: ${sig}${Number.isFinite(bpm) ? `, ${bpm} BPM` : ""} (${conf})`);
    }
  }
  lines.push(`Song context: ${songContext || "pending"}`);
  return lines.join("\n");
}

function buildAudioAnalysisStubSummary() {
  const analysis = analyzeAudioContext({
    audioPath: state.audioPathInput,
    sectionSuggestions: state.sectionSuggestions,
    sectionStartByLabel: state.sectionStartByLabel,
    timingTracks: state.timingTracks
  });
  return formatAudioAnalysisSummary({
    analysis,
    pipeline: state.audioAnalysis?.pipeline || null
  });
}

function audioTrackQueryFromPath(audioPath = "") {
  const raw = basenameOfPath(audioPath);
  const noExt = raw.replace(/\.[a-z0-9]+$/i, "");
  return noExt.replace(/^\s*\d+\s*/, "").replace(/\s+/g, " ").trim();
}

function isLikelyInformationalSourceUrl(url = "") {
  const s = String(url || "").trim().toLowerCase();
  if (!s) return false;
  return !(
    s.includes("open.spotify.com") ||
    s.includes("music.apple.com") ||
    s.includes("youtube.com") ||
    s.includes("youtu.be") ||
    s.includes("deezer.com") ||
    s.includes("tidal.com") ||
    s.includes("soundcloud.com") ||
    s.includes("amazon.com/music") ||
    s.includes("shazam.com") ||
    s.includes("audd.io") ||
    s.includes("musicnotes.com") ||
    s.includes("sheetmusicplus.com") ||
    s.includes("sheetmusicdirect.com") ||
    s.includes("ultimate-guitar.com") ||
    s.includes("chordify.net") ||
    s.includes("tabs.ultimate-guitar.com") ||
    s.includes("tunebat.com")
  );
}

function areMetersCompatible(a = "", b = "") {
  const parse = (sig) => {
    const m = String(sig || "").trim().toLowerCase().match(/^(\d+)\s*\/\s*(\d+)$/);
    if (!m) return null;
    const n = Number(m[1]);
    const d = Number(m[2]);
    if (!Number.isFinite(n) || !Number.isFinite(d) || n <= 0 || d <= 0) return null;
    return { n, d, barLen: n / d };
  };
  const left = parse(a);
  const right = parse(b);
  if (!left || !right) return false;
  if (left.n === right.n && left.d === right.d) return true;
  return Math.abs(left.barLen - right.barLen) <= 1e-6;
}

function normalizeTrackTokens(text = "") {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
}

function sourceLooksTrackSpecific(url = "", title = "", artist = "") {
  const s = String(url || "").toLowerCase();
  if (!s) return false;
  const titleTokens = normalizeTrackTokens(title).slice(0, 6);
  const artistTokens = normalizeTrackTokens(artist).slice(0, 4);
  const hasTitle = titleTokens.some((t) => s.includes(t));
  const hasArtist = artistTokens.some((t) => s.includes(t));
  return hasTitle && hasArtist;
}

function beatsPerBarFromSignature(sig = "") {
  const m = String(sig || "").trim().match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!m) return 4;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 4;
}

function relabelBeats(beats = [], beatsPerBar = 4, startLabel = 1) {
  const bpb = Math.max(1, Math.round(Number(beatsPerBar) || 4));
  let cur = Math.max(1, Math.min(bpb, Math.round(Number(startLabel) || 1)));
  return (Array.isArray(beats) ? beats : []).map((row) => {
    const out = { ...row, label: String(cur) };
    cur = (cur % bpb) + 1;
    return out;
  });
}

function subdivideBeatsByFactor(beats = [], factor = 2) {
  const src = Array.isArray(beats) ? beats : [];
  const f = Math.max(1, Math.round(Number(factor) || 1));
  if (f <= 1 || src.length < 2) return src;
  const starts = [];
  for (let i = 0; i < src.length; i += 1) {
    const s = Math.round(Number(src[i]?.startMs));
    if (!Number.isFinite(s)) continue;
    starts.push(s);
    if (i + 1 < src.length) {
      const n = Math.round(Number(src[i + 1]?.startMs));
      if (Number.isFinite(n) && n > s) {
        const span = n - s;
        for (let k = 1; k < f; k += 1) {
          const p = Math.round(s + (span * k) / f);
          if (p > s && p < n) starts.push(p);
        }
      }
    }
  }
  const uniq = Array.from(new Set(starts)).sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < uniq.length; i += 1) {
    const s = uniq[i];
    const e = i + 1 < uniq.length ? uniq[i + 1] : Math.max(s + 1, Math.round(Number(src[src.length - 1]?.endMs) || (s + 1)));
    if (e > s) out.push({ startMs: s, endMs: e });
  }
  return out;
}

function mergeBeatsByFactor(beats = [], factor = 2) {
  const src = Array.isArray(beats) ? beats : [];
  const f = Math.max(1, Math.round(Number(factor) || 1));
  if (f <= 1 || src.length < (f + 1)) return src;
  const out = [];
  for (let i = 0; i < src.length; i += f) {
    const s = Math.round(Number(src[i]?.startMs));
    if (!Number.isFinite(s)) continue;
    let e = null;
    if (i + f < src.length) {
      const n = Math.round(Number(src[i + f]?.startMs));
      if (Number.isFinite(n) && n > s) e = n;
    }
    if (!Number.isFinite(e)) {
      const endRaw = Math.round(Number(src[Math.min(i + f - 1, src.length - 1)]?.endMs));
      e = Number.isFinite(endRaw) && endRaw > s ? endRaw : s + 1;
    }
    if (e > s) out.push({ startMs: s, endMs: e });
  }
  return out;
}

function barsFromBeats(beats = [], beatsPerBar = 4) {
  const src = Array.isArray(beats) ? beats : [];
  const bpb = Math.max(1, Math.round(Number(beatsPerBar) || 4));
  const out = [];
  for (let i = 0; i < src.length; i += bpb) {
    const s = Math.round(Number(src[i]?.startMs));
    if (!Number.isFinite(s)) continue;
    let e = null;
    if (i + bpb < src.length) {
      const n = Math.round(Number(src[i + bpb]?.startMs));
      if (Number.isFinite(n) && n > s) e = n;
    }
    if (!Number.isFinite(e)) {
      const endRaw = Math.round(Number(src[Math.min(i + bpb - 1, src.length - 1)]?.endMs));
      e = Number.isFinite(endRaw) && endRaw > s ? endRaw : s + 1;
    }
    if (e > s) out.push({ startMs: s, endMs: e, label: String(out.length + 1) });
  }
  return out;
}

function splitBarsByFactor(bars = [], factor = 2) {
  const src = Array.isArray(bars) ? bars : [];
  const f = Math.max(1, Math.round(Number(factor) || 1));
  if (f <= 1 || !src.length) return src;
  const out = [];
  for (const row of src) {
    const s = Math.round(Number(row?.startMs));
    const e = Math.round(Number(row?.endMs));
    if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) continue;
    const span = e - s;
    for (let k = 0; k < f; k += 1) {
      const segStart = Math.round(s + (span * k) / f);
      const segEnd = Math.round(s + (span * (k + 1)) / f);
      if (segEnd <= segStart) continue;
      out.push({ startMs: segStart, endMs: segEnd, label: String(out.length + 1) });
    }
  }
  return out;
}

function extractNumericCandidates(values = []) {
  const out = [];
  for (const item of Array.isArray(values) ? values : []) {
    const text = String(item || "");
    const matches = text.match(/\d+(?:\.\d+)?/g) || [];
    for (const m of matches) {
      const n = Number(m);
      if (Number.isFinite(n) && n > 0) out.push(n);
    }
  }
  return out;
}

function medianNumber(values = []) {
  const nums = (Array.isArray(values) ? values : [])
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  if (!nums.length) return NaN;
  const mid = Math.floor(nums.length / 2);
  if (nums.length % 2) return nums[mid];
  return (nums[mid - 1] + nums[mid]) / 2;
}

function extractFirstJsonObject(text = "") {
  const raw = String(text || "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    // continue
  }
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function runSongContextResearch({ audioPath = "", sections = [], trackIdentity = null } = {}) {
  const bridge = getDesktopAgentConversationBridge();
  if (!bridge) return "";
  const tTitle = String(trackIdentity?.title || "").trim();
  const tArtist = String(trackIdentity?.artist || "").trim();
  const tIsrc = String(trackIdentity?.isrc || "").trim();
  const trackQuery = tTitle && tArtist ? `${tTitle} - ${tArtist}` : audioTrackQueryFromPath(audioPath);
  if (!trackQuery) return "";
  try {
    const userMessage = [
      `Research this exact track and return strict JSON only: ${trackQuery}.`,
      tIsrc ? `ISRC: ${tIsrc}` : "ISRC: unavailable",
      "Use informational sources (articles/reference/music analysis) and avoid streaming/catalog pages.",
      "If uncertain, reduce confidence and explain briefly.",
      "JSON keys only:",
      "- summary (single concise sentence, <=45 words)",
      "- styleEra (short phrase)",
      "- moodTheme (short phrase)",
      "- sequencingImplication (short phrase)",
      "- confidence (high|medium|low)",
      "- rationale (1 sentence)",
      "- sources (array of 1-3 URLs)"
    ].join("\n");
    const res = await bridge.runAgentConversation({
      userMessage,
      messages: [],
      context: {
        purpose: "song-context-research",
        sequenceName: state.activeSequence || "",
        sections: Array.isArray(sections) ? sections.slice(0, 12) : []
      }
    });
    if (!res?.ok) return null;
    const parsed = extractFirstJsonObject(res.assistantMessage || "");
    if (!parsed || typeof parsed !== "object") return null;
    const sources = Array.isArray(parsed.sources)
      ? parsed.sources.map((s) => String(s || "").trim()).filter(Boolean).slice(0, 3)
      : [];
    const informativeSources = sources.filter((url) => isLikelyInformationalSourceUrl(url));
    const confidence = String(parsed.confidence || "").trim().toLowerCase();
    return {
      summary: String(parsed.summary || "").trim(),
      styleEra: String(parsed.styleEra || "").trim(),
      moodTheme: String(parsed.moodTheme || "").trim(),
      sequencingImplication: String(parsed.sequencingImplication || "").trim(),
      confidence: ["high", "medium", "low"].includes(confidence) ? confidence : "low",
      rationale: String(parsed.rationale || "").trim(),
      sources: informativeSources
    };
  } catch {
    return null;
  }
}

function normalizeSectionLabelBase(label = "") {
  const raw = String(label || "").trim();
  if (!raw) return "Section";
  const noSuffix = raw.replace(/\s+\d+$/, "").trim();
  return noSuffix || "Section";
}

function buildNumberedSectionLabels(labels = []) {
  const base = (Array.isArray(labels) ? labels : []).map((l) => normalizeSectionLabelBase(l));
  const totals = new Map();
  for (const b of base) totals.set(b, (totals.get(b) || 0) + 1);
  const counts = new Map();
  return base.map((b) => {
    const next = (counts.get(b) || 0) + 1;
    counts.set(b, next);
    return (totals.get(b) || 0) > 1 ? `${b} ${next}` : b;
  });
}

function inferLyricStanzaPlan(lyrics = [], durationMs = 0, trackTitleHint = "") {
  const rows = (Array.isArray(lyrics) ? lyrics : [])
    .map((r) => ({
      startMs: Math.max(0, Math.round(Number(r?.startMs || 0))),
      endMs: Math.max(0, Math.round(Number(r?.endMs || 0))),
      label: String(r?.label || "").trim()
    }))
    .filter((r) => Number.isFinite(r.startMs) && Number.isFinite(r.endMs) && r.endMs > r.startMs)
    .sort((a, b) => a.startMs - b.startMs);
  const totalMs = Math.max(1, Math.round(Number(durationMs || 0)));
  if (!rows.length) return { sections: [], lyricalIndices: [] };

  const gaps = [];
  for (let i = 1; i < rows.length; i += 1) {
    const gap = rows[i].startMs - rows[i - 1].endMs;
    if (gap > 0) gaps.push(gap);
  }
  let stanzaGapMs = 6000;
  if (gaps.length) {
    const sorted = [...gaps].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const med = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    const p75 = sorted[Math.floor((sorted.length - 1) * 0.75)];
    stanzaGapMs = Math.max(2500, Math.min(12000, Math.round(Math.max(p75 * 1.35, med * 2.1))));
  }

  // Split stanzas using adaptive pauses plus hard caps on stanza size,
  // so continuous lyrics don't collapse into one giant "lyrical" section.
  const MAX_LINES_PER_STANZA = 6;
  const MAX_STANZA_MS = 16000;
  const stanzas = [];
  let a = 0;
  for (let i = 1; i < rows.length; i += 1) {
    const gap = rows[i].startMs - rows[i - 1].endMs;
    const lineCount = i - a;
    const stanzaSpan = rows[i - 1].endMs - rows[a].startMs;
    const shouldBreak =
      gap >= stanzaGapMs ||
      lineCount >= MAX_LINES_PER_STANZA ||
      stanzaSpan >= MAX_STANZA_MS;
    if (shouldBreak) {
      stanzas.push([a, i]);
      a = i;
    }
  }
  stanzas.push([a, rows.length]);

  const normalize = (text = "") =>
    String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const titleNorm = normalize(trackTitleHint);
  const shouldUseTitle = titleNorm.length >= 8;
  const refined = [];
  let titleAwareSplits = 0;
  for (const stanza of stanzas) {
    const [sIdx, eIdx] = stanza;
    const lineCount = Math.max(0, eIdx - sIdx);
    if (lineCount < 5) {
      refined.push(stanza);
      continue;
    }
    let splitAt = -1;
    if (shouldUseTitle) {
      const hitOffsets = [];
      for (let k = sIdx; k < eIdx; k += 1) {
        const lineNorm = normalize(rows[k]?.label || "");
        if (lineNorm && lineNorm.includes(titleNorm)) {
          hitOffsets.push(k - sIdx);
        }
      }
      if (hitOffsets.length >= 2) {
        const firstHit = hitOffsets[0];
        const linesAfter = lineCount - firstHit;
        if (firstHit >= 2 && linesAfter >= 2) {
          splitAt = sIdx + firstHit;
        }
      }
    }
    if (splitAt < 0) {
      const seen = new Map();
      for (let k = sIdx; k < eIdx; k += 1) {
        const lineNorm = normalize(rows[k]?.label || "");
        if (!lineNorm) continue;
        const prev = seen.get(lineNorm);
        if (Number.isInteger(prev)) {
          const offset = k - sIdx;
          const linesAfter = lineCount - offset;
          if (offset >= 2 && linesAfter >= 2) {
            splitAt = k;
            break;
          }
        } else {
          seen.set(lineNorm, k);
        }
      }
    }
    if (splitAt > sIdx && splitAt < eIdx) {
      refined.push([sIdx, splitAt], [splitAt, eIdx]);
      titleAwareSplits += 1;
    } else {
      refined.push(stanza);
    }
  }

  const sections = [];
  const lyricalIndices = [];
  const firstStart = rows[0].startMs;
  if (firstStart > 500) {
    sections.push({ startMs: 0, endMs: firstStart, label: "Intro" });
  }
  let prevEnd = firstStart;
  for (const [sIdx, eIdx] of refined) {
    const startMs = rows[sIdx].startMs;
    const endMs = rows[eIdx - 1].endMs;
    if (startMs - prevEnd >= stanzaGapMs) {
      sections.push({ startMs: prevEnd, endMs: startMs, label: "Instrumental" });
    }
    lyricalIndices.push(sections.length);
    sections.push({ startMs, endMs, label: "Lyrical" });
    prevEnd = endMs;
  }
  if (totalMs - prevEnd >= 500) {
    const tailLabel = (totalMs - prevEnd) <= Math.max(12000, stanzaGapMs * 2) ? "Outro" : "Instrumental";
    sections.push({ startMs: prevEnd, endMs: totalMs, label: tailLabel });
  }
  return { sections, lyricalIndices, titleAwareSplits };
}

function buildSectionLyricContextRows(sections = [], lyrics = [], lyricalIndices = []) {
  const sec = Array.isArray(sections) ? sections : [];
  const lyr = Array.isArray(lyrics) ? lyrics : [];
  const allow = new Set(Array.isArray(lyricalIndices) ? lyricalIndices : []);
  return sec.map((s, idx) => {
    if (!allow.has(idx)) return null;
    const startMs = Math.max(0, Math.round(Number(s?.startMs || 0)));
    const endMs = Math.max(startMs + 1, Math.round(Number(s?.endMs || (startMs + 1))));
    const lines = lyr
      .filter((row) => {
        const t = Number(row?.startMs);
        return Number.isFinite(t) && t >= startMs && t < endMs;
      })
      .slice(0, 14)
      .map((row) => String(row?.label || "").trim())
      .filter(Boolean);
    return {
      index: idx,
      lineCount: lines.length,
      stanzaText: lines.join(" | ")
    };
  }).filter(Boolean);
}

function normalizeLyricLineForPattern(line = "") {
  return String(line || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countSharedNormalizedLines(aLines = [], bLines = []) {
  const a = new Set((Array.isArray(aLines) ? aLines : []).map(normalizeLyricLineForPattern).filter(Boolean));
  const b = new Set((Array.isArray(bLines) ? bLines : []).map(normalizeLyricLineForPattern).filter(Boolean));
  if (!a.size || !b.size) return 0;
  let n = 0;
  for (const line of a) {
    if (b.has(line)) n += 1;
  }
  return n;
}

function parseChordLabelBasic(label = "") {
  const raw = String(label || "").trim();
  if (!raw || raw.toUpperCase() === "N") return null;
  const normalized = raw.replace(":", "");
  const match = normalized.match(/^([A-G](?:#|b)?)(.*)$/i);
  if (!match) return null;
  const root = String(match[1] || "").trim();
  const qualityRaw = String(match[2] || "").trim().toLowerCase();
  const rootPcMap = {
    C: 0,
    "C#": 1,
    Db: 1,
    D: 2,
    "D#": 3,
    Eb: 3,
    E: 4,
    F: 5,
    "F#": 6,
    Gb: 6,
    G: 7,
    "G#": 8,
    Ab: 8,
    A: 9,
    "A#": 10,
    Bb: 10,
    B: 11
  };
  const rootPc = rootPcMap[root];
  if (!Number.isFinite(rootPc)) return null;
  const isMinor =
    qualityRaw.startsWith("m") ||
    qualityRaw.startsWith("min") ||
    qualityRaw.includes("minor");
  const quality = isMinor ? "m" : "M";
  return { root, rootPc, quality, normalized: `${root}${quality === "m" ? "m" : ""}` };
}

function buildRelativeChordToken(chord, tonicPc) {
  if (!chord || !Number.isFinite(tonicPc)) return "";
  const rel = ((Number(chord.rootPc) - Number(tonicPc)) % 12 + 12) % 12;
  return `${rel}${chord.quality || "M"}`;
}

function buildSectionChordContextRows(sections = [], chords = [], lyricalIndices = []) {
  const sec = Array.isArray(sections) ? sections : [];
  const rows = Array.isArray(chords) ? chords : [];
  const allow = new Set(Array.isArray(lyricalIndices) ? lyricalIndices : []);
  return sec.map((s, idx) => {
    if (!allow.has(idx)) return null;
    const startMs = Math.max(0, Math.round(Number(s?.startMs || 0)));
    const endMs = Math.max(startMs + 1, Math.round(Number(s?.endMs || (startMs + 1))));
    const overlapping = rows
      .map((row) => {
        const rs = Number(row?.startMs);
        const reRaw = Number(row?.endMs);
        const re = Number.isFinite(reRaw) ? reRaw : rs + 1;
        if (!Number.isFinite(rs) || !Number.isFinite(re)) return null;
        const os = Math.max(startMs, Math.round(rs));
        const oe = Math.min(endMs, Math.round(re));
        const dur = Math.max(0, oe - os);
        if (dur <= 0) return null;
        const parsed = parseChordLabelBasic(String(row?.label || ""));
        if (!parsed) return null;
        return { ...parsed, startMs: os, endMs: oe, durMs: dur };
      })
      .filter(Boolean)
      .sort((a, b) => Number(a.startMs) - Number(b.startMs));
    const MIN_CHORD_MS = 180;
    const filtered = overlapping.filter((row) => Number(row?.durMs || 0) >= MIN_CHORD_MS);
    const active = filtered.length ? filtered : overlapping;
    const collapsed = [];
    for (const row of active) {
      const prev = collapsed[collapsed.length - 1];
      if (!prev || prev.normalized !== row.normalized) {
        collapsed.push({ ...row });
      } else {
        prev.endMs = row.endMs;
        prev.durMs += row.durMs;
      }
    }
    const byLabel = new Map();
    for (const row of collapsed) {
      byLabel.set(row.normalized, (byLabel.get(row.normalized) || 0) + Number(row.durMs || 0));
    }
    const dominant = [...byLabel.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
    const dominantParsed = parseChordLabelBasic(dominant);
    const tonicPc = Number.isFinite(dominantParsed?.rootPc) ? dominantParsed.rootPc : collapsed[0]?.rootPc;
    const progressionAbs = collapsed.map((row) => row.normalized);
    const progressionRel = collapsed
      .map((row) => buildRelativeChordToken(row, tonicPc))
      .filter(Boolean);
    const changes = Math.max(0, collapsed.length - 1);
    const sectionMs = Math.max(1, endMs - startMs);
    const changesPerMinute = Number((changes / (sectionMs / 60000)).toFixed(2));
    const cadence = progressionRel.slice(-3).join("->");
    const chordSeconds = Number((active.reduce((sum, row) => sum + Number(row?.durMs || 0), 0) / 1000).toFixed(2));
    return {
      index: idx,
      chordCount: active.length,
      chordSetSize: new Set(progressionAbs).size,
      progression: progressionAbs.slice(0, 10).join("->"),
      progressionRelative: progressionRel.slice(0, 10).join("->"),
      cadenceRelative: cadence,
      dominantChord: dominant || "",
      harmonicRhythmCpm: changesPerMinute,
      chordSeconds
    };
  }).filter(Boolean);
}

function progressionSimilarityScore(a = "", b = "") {
  const left = String(a || "").split("->").map((x) => x.trim()).filter(Boolean);
  const right = String(b || "").split("->").map((x) => x.trim()).filter(Boolean);
  if (!left.length || !right.length) return 0;
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const inter = [...leftSet].filter((tok) => rightSet.has(tok)).length;
  const union = new Set([...leftSet, ...rightSet]).size;
  if (!union) return 0;
  return Number((inter / union).toFixed(3));
}

function buildSongStructureEvidence(ctxRows = [], chordRows = [], trackIdentity = null, trackTitleHint = "") {
  const rows = Array.isArray(ctxRows) ? ctxRows : [];
  if (!rows.length) return [];
  const chordByIndex = new Map((Array.isArray(chordRows) ? chordRows : []).map((r) => [Number(r?.index), r]));
  const effectiveTitle = String(trackIdentity?.title || "").trim() || String(trackTitleHint || "").trim();
  const titlePhrase = normalizeLyricLineForPattern(effectiveTitle);
  const titleTokens = new Set(
    effectiveTitle
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 3)
  );
  const globalLineFreq = new Map();
  const rowLinesNormalized = rows.map((row) =>
    String(row?.stanzaText || "")
      .split("|")
      .map((s) => normalizeLyricLineForPattern(s))
      .filter(Boolean)
  );
  for (const line of rowLinesNormalized.flat()) {
    globalLineFreq.set(line, (globalLineFreq.get(line) || 0) + 1);
  }
  const seenLineSet = new Set();
  const seenProgressions = new Set();
  let prevProgression = "";
  const base = rows.map((row, idx) => {
    const text = String(row?.stanzaText || "").toLowerCase();
    const lines = text.split("|").map((s) => s.trim()).filter(Boolean);
    const normLines = rowLinesNormalized[idx] || [];
    const lineSet = new Set(lines);
    let repeatedLines = 0;
    for (const line of lineSet) {
      if (seenLineSet.has(line)) repeatedLines += 1;
    }
    for (const line of lineSet) seenLineSet.add(line);
    const tokens = text.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).map((t) => t.trim()).filter(Boolean);
    let titleHits = 0;
    for (const token of tokens) {
      if (titleTokens.has(token)) titleHits += 1;
    }
    const tokenSet = new Set(tokens);
    const uniqueTokenRatio = tokenSet.size > 0 ? Number((tokenSet.size / Math.max(1, tokens.length)).toFixed(3)) : 0;
    const repeatedLineRatio = lineSet.size > 0 ? Number((repeatedLines / lineSet.size).toFixed(3)) : 0;
    const titleTokenRatio = titleTokens.size > 0 ? Number((titleHits / Math.max(1, tokens.length)).toFixed(3)) : 0;
    const titleLineHits = titlePhrase
      ? normLines.reduce((n, line) => n + (line.includes(titlePhrase) ? 1 : 0), 0)
      : 0;
    const titleLineRatio = normLines.length ? Number((titleLineHits / normLines.length).toFixed(3)) : 0;
    const globallyRepeatedLines = normLines.filter((line) => (globalLineFreq.get(line) || 0) >= 2).length;
    const globallyRepeatedLineRatio = normLines.length
      ? Number((globallyRepeatedLines / normLines.length).toFixed(3))
      : 0;
    let maxLineOverlapWithAny = 0;
    for (let j = 0; j < rowLinesNormalized.length; j += 1) {
      if (j === idx) continue;
      maxLineOverlapWithAny = Math.max(
        maxLineOverlapWithAny,
        countSharedNormalizedLines(normLines, rowLinesNormalized[j] || [])
      );
    }
    const chord = chordByIndex.get(Number(row?.index ?? idx)) || {};
    const progression = String(chord?.progression || "").trim();
    const progressionRelative = String(chord?.progressionRelative || "").trim();
    const progressionKey = progressionRelative || progression;
    const progressionSeenBefore = Boolean(progressionKey) && seenProgressions.has(progressionKey);
    if (progressionKey) seenProgressions.add(progressionKey);
    const progressionSimilarityToPrev = progressionSimilarityScore(progressionKey, prevProgression);
    prevProgression = progressionKey;
    return {
      index: Number(row?.index ?? idx),
      lineCount: Number(row?.lineCount || lines.length || 0),
      repeatedLineRatio,
      uniqueTokenRatio,
      titleTokenRatio,
      titleLineHits,
      titleLineRatio,
      globallyRepeatedLineRatio,
      maxLineOverlapWithAny,
      chordCount: Number(chord?.chordCount || 0),
      chordSetSize: Number(chord?.chordSetSize || 0),
      progression,
      progressionRelative,
      cadenceRelative: String(chord?.cadenceRelative || "").trim(),
      dominantChord: String(chord?.dominantChord || "").trim(),
      harmonicRhythmCpm: Number(chord?.harmonicRhythmCpm || 0),
      chordSeconds: Number(chord?.chordSeconds || 0),
      progressionSeenBefore,
      progressionSimilarityToPrev
    };
  });
  return base.map((row, idx) => {
    const prev = base[idx - 1] || null;
    const next = base[idx + 1] || null;
    const nextChorusLike = Boolean(
      next && (
        Number(next.titleLineRatio || 0) >= 0.2 ||
        Number(next.globallyRepeatedLineRatio || 0) >= 0.4 ||
        Number(next.repeatedLineRatio || 0) >= 0.35
      )
    );
    const prevVerseLike = Boolean(
      prev && (
        Number(prev.uniqueTokenRatio || 0) >= 0.72 &&
        Number(prev.titleLineRatio || 0) <= 0.15
      )
    );
    return {
      ...row,
      nextTitleLineRatio: next ? Number(next.titleLineRatio || 0) : 0,
      nextGloballyRepeatedLineRatio: next ? Number(next.globallyRepeatedLineRatio || 0) : 0,
      nextRepeatedLineRatio: next ? Number(next.repeatedLineRatio || 0) : 0,
      nextLikelyChorus: nextChorusLike,
      prevLikelyVerse: prevVerseLike,
      transitionToHookScore: Number(
        (
          (next ? Number(next.titleLineRatio || 0) * 0.5 : 0) +
          (next ? Number(next.globallyRepeatedLineRatio || 0) * 0.35 : 0) +
          (next ? Number(next.repeatedLineRatio || 0) * 0.15 : 0)
        ).toFixed(3)
      )
    };
  });
}

function meanNumber(rows = [], key = "") {
  const vals = (Array.isArray(rows) ? rows : [])
    .map((r) => Number(r?.[key]))
    .filter((n) => Number.isFinite(n));
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function corpusSongProfile(song = {}) {
  const stanzas = Array.isArray(song?.stanzas) ? song.stanzas : [];
  if (!stanzas.length) return null;
  const labels = stanzas.map((s) => String(s?.draftLabel || "").trim());
  const chorusCount = labels.filter((l) => l.toLowerCase() === "chorus").length;
  const verseCount = labels.filter((l) => l.toLowerCase() === "verse").length;
  const avgRepeat = meanNumber(stanzas, "globallyRepeatedLineRatio");
  const avgTitleRatio = meanNumber(stanzas, "titleLineRatio");
  const avgLineCount = meanNumber(
    stanzas.map((s) => ({ lineCount: Array.isArray(s?.lines) ? s.lines.length : 0 })),
    "lineCount"
  );
  return {
    stanzaCount: stanzas.length,
    chorusCount,
    verseCount,
    chorusRatio: stanzas.length ? chorusCount / stanzas.length : 0,
    avgRepeat,
    avgTitleRatio,
    avgLineCount
  };
}

function selectFewShotFromCorpus({
  corpusSongs = [],
  structureEvidence = [],
  trackTitle = "",
  maxExamples = 3
} = {}) {
  const songs = Array.isArray(corpusSongs) ? corpusSongs : [];
  if (!songs.length) return [];
  const currentProfile = {
    stanzaCount: (Array.isArray(structureEvidence) ? structureEvidence : []).length,
    chorusRatio: meanNumber(
      (Array.isArray(structureEvidence) ? structureEvidence : []).map((r) => ({
        chorusLike: (Number(r?.titleLineRatio || 0) >= 0.2 || Number(r?.globallyRepeatedLineRatio || 0) >= 0.4) ? 1 : 0
      })),
      "chorusLike"
    ),
    avgRepeat: meanNumber(structureEvidence, "repeatedLineRatio"),
    avgTitleRatio: meanNumber(structureEvidence, "titleLineRatio"),
    avgLineCount: meanNumber(structureEvidence, "lineCount")
  };
  const tNorm = String(trackTitle || "").trim().toLowerCase();
  const candidates = [];
  for (const song of songs) {
    const profile = corpusSongProfile(song);
    if (!profile) continue;
    if (profile.stanzaCount < 3) continue;
    if (profile.chorusCount < 1 || profile.verseCount < 1) continue;
    const sTitle = String(song?.title || "").trim();
    if (tNorm && sTitle.toLowerCase() === tNorm) continue;
    const dist =
      Math.abs(profile.chorusRatio - currentProfile.chorusRatio) * 1.8 +
      Math.abs(profile.avgRepeat - currentProfile.avgRepeat) * 2.0 +
      Math.abs(profile.avgTitleRatio - currentProfile.avgTitleRatio) * 1.6 +
      Math.abs(profile.avgLineCount - currentProfile.avgLineCount) * 0.2 +
      Math.abs(profile.stanzaCount - currentProfile.stanzaCount) * 0.15;
    candidates.push({ song, profile, dist });
  }
  candidates.sort((a, b) => a.dist - b.dist);
  return candidates.slice(0, Math.max(0, maxExamples)).map((c) => {
    const stanzas = Array.isArray(c.song?.stanzas) ? c.song.stanzas : [];
    return {
      track: `${String(c.song?.title || "").trim()} - ${String(c.song?.artist || "").trim()}`.trim(),
      lyricsSource: String(c.song?.lyricsSource || "").trim(),
      stanzaCount: stanzas.length,
      labels: stanzas.map((s) => String(s?.draftLabel || "").trim() || "Verse"),
      stanzas: stanzas.slice(0, 8).map((s, idx) => ({
        index: Number(s?.index ?? idx),
        label: String(s?.draftLabel || "").trim() || "Verse",
        text: String(s?.text || "").trim().slice(0, 220)
      })),
      profile: {
        chorusRatio: Number(c.profile.chorusRatio.toFixed(3)),
        avgRepeat: Number(c.profile.avgRepeat.toFixed(3)),
        avgTitleRatio: Number(c.profile.avgTitleRatio.toFixed(3))
      }
    };
  });
}

function parseLlmSectionLabelResult(text = "", expectedCount = 0) {
  const parsed = extractFirstJsonObject(text);
  if (!parsed || typeof parsed !== "object") return null;
  const rows = Array.isArray(parsed.sections) ? parsed.sections : [];
  if (!rows.length) return null;
  const labels = new Array(expectedCount).fill("");
  for (const row of rows) {
    const idx = Number(row?.index);
    const label = normalizeSectionLabelBase(String(row?.label || ""));
    if (!Number.isInteger(idx) || idx < 0 || idx >= expectedCount) continue;
    if (!label || label === "Section") continue;
    labels[idx] = label;
  }
  if (!labels.some(Boolean)) return null;
  return {
    labels,
    confidence: String(parsed.confidence || "").trim().toLowerCase(),
    rationale: String(parsed.rationale || "").trim()
  };
}

function normalizeTrackIdentityToken(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildTrackIdentityKey(trackIdentity = null, trackTitleHint = "") {
  const isrc = String(trackIdentity?.isrc || "").trim().toLowerCase();
  if (isrc) return `isrc:${isrc}`;
  const title = normalizeTrackIdentityToken(
    String(trackIdentity?.title || "").trim() || String(trackTitleHint || "").trim()
  );
  const artist = normalizeTrackIdentityToken(String(trackIdentity?.artist || "").trim());
  if (!title) return "";
  return `title:${title}|artist:${artist || "unknown"}`;
}

function buildGlobalXdTrackPolicyKey(trackName = "") {
  const name = String(trackName || "").trim().toLowerCase();
  if (!name) return "";
  return `__xd_global__::${name}`;
}

function deriveUserOwnedTrackNameFromXd(trackName = "") {
  const raw = String(trackName || "").trim();
  if (!raw) return "";
  return raw.replace(/^xd:\s*/i, "").trim() || raw;
}

function getSequenceTimingTrackPoliciesState() {
  return state.sequenceAgentRuntime?.timingTrackPolicies && typeof state.sequenceAgentRuntime.timingTrackPolicies === "object"
    ? state.sequenceAgentRuntime.timingTrackPolicies
    : {};
}

function setSequenceTimingTrackPoliciesState(policies = {}) {
  state.sequenceAgentRuntime = state.sequenceAgentRuntime && typeof state.sequenceAgentRuntime === "object"
    ? state.sequenceAgentRuntime
    : structuredClone(defaultState.sequenceAgentRuntime);
  state.sequenceAgentRuntime.timingTrackPolicies = policies && typeof policies === "object" ? policies : {};
}

function getSequenceTimingGeneratedSignaturesState() {
  return state.sequenceAgentRuntime?.timingGeneratedSignatures && typeof state.sequenceAgentRuntime.timingGeneratedSignatures === "object"
    ? state.sequenceAgentRuntime.timingGeneratedSignatures
    : {};
}

function setSequenceTimingGeneratedSignaturesState(signatures = {}) {
  state.sequenceAgentRuntime = state.sequenceAgentRuntime && typeof state.sequenceAgentRuntime === "object"
    ? state.sequenceAgentRuntime
    : structuredClone(defaultState.sequenceAgentRuntime);
  state.sequenceAgentRuntime.timingGeneratedSignatures = signatures && typeof signatures === "object" ? signatures : {};
}

function getSequenceTimingOwnershipRows() {
  return getGlobalXdTrackPolicies().map((row) => ({
    sourceTrack: row.sourceTrack,
    trackName: row.userTrack || row.sourceTrack,
    manual: Boolean(row.manual),
    lockedAt: row.lockedAt,
    updatedAt: row.updatedAt
  }));
}

function getGlobalXdTrackPolicies() {
  const policies = getSequenceTimingTrackPoliciesState();
  const rows = [];
  for (const [key, value] of Object.entries(policies)) {
    if (!String(key || "").startsWith("__xd_global__::")) continue;
    if (!value || typeof value !== "object") continue;
    const sourceTrack = String(value.sourceTrack || key.replace(/^__xd_global__::/i, "")).trim();
    const userTrack = String(value.trackName || deriveUserOwnedTrackNameFromXd(sourceTrack)).trim();
    rows.push({
      policyKey: key,
      sourceTrack,
      userTrack,
      manual: Boolean(value.manual),
      lockedAt: String(value.lockedAt || ""),
      updatedAt: String(value.updatedAt || "")
    });
  }
  return rows.sort((a, b) => a.sourceTrack.localeCompare(b.sourceTrack));
}

function getManualLockedXdTracks() {
  return getGlobalXdTrackPolicies().filter((row) => row.manual);
}

function removeGlobalXdManualLocks() {
  const policies = getSequenceTimingTrackPoliciesState();
  let changed = 0;
  for (const key of Object.keys(policies)) {
    if (!String(key || "").startsWith("__xd_global__::")) continue;
    const row = policies[key];
    if (!row || typeof row !== "object" || !row.manual) continue;
    policies[key] = {
      ...row,
      manual: false,
      updatedAt: new Date().toISOString()
    };
    changed += 1;
  }
  setSequenceTimingTrackPoliciesState(policies);
  return changed;
}

async function relabelSectionsWithLlm({
  sections = [],
  lyrics = [],
  chords = [],
  lyricalIndices = [],
  trackIdentity = null,
  trackTitleHint = "",
  userManualStructureHint = null,
  timeSignature = "",
  tempoBpm = null
} = {}) {
  const bridge = getDesktopAgentConversationBridge();
  const sec = Array.isArray(sections) ? sections : [];
  if (!bridge || !sec.length) return null;
  const targetIdx = Array.isArray(lyricalIndices) ? lyricalIndices.filter((i) => Number.isInteger(i) && i >= 0 && i < sec.length) : [];
  if (!targetIdx.length) return null;
  const ctxRows = buildSectionLyricContextRows(sec, lyrics, targetIdx);
  if (!ctxRows.length) return null;
  const chordRows = buildSectionChordContextRows(sec, chords, targetIdx);
  const structureEvidence = buildSongStructureEvidence(ctxRows, chordRows, trackIdentity, trackTitleHint);
  try {
    const pkgBundle = await loadAudioTrainingPackageBundle();
    const tTitle = String(trackIdentity?.title || "").trim() || String(trackTitleHint || "").trim();
    const tArtist = String(trackIdentity?.artist || "").trim();
    const trackName = tTitle && tArtist ? `${tTitle} - ${tArtist}` : (tTitle || "unknown track");
    const fewShotExamples = pkgBundle?.ok
      ? selectFewShotFromCorpus({
          corpusSongs: pkgBundle.corpusSongs,
          structureEvidence,
          trackTitle: tTitle,
          maxExamples: 3
        })
      : [];
    const packagedInstruction = pkgBundle?.ok
      ? String(pkgBundle.combinedPromptText || "").trim()
      : "";
    const fallbackInstruction = [
      "Interpret lyrical structure from stanza text first, then assign labels to stanza indices.",
      "Do not use timing cues for structure inference; use language/content and repetition patterns.",
      "Do not change stanza count. Output strict JSON only.",
      "Use this songwriting-structure rubric (compiled from Open Music Theory + NSAI songwriting guidance):",
      "- Verse: lyric-variant, advances story/details, less exact repetition.",
      "- Chorus/Refrain: lyric-invariant or highly repeated hook/title idea, emotional center, often same core words each return.",
      "- Pre-Chorus: short transitional stanza that increases tension and points into a chorus.",
      "- Pre-Chorus should usually have weaker title/hook repetition than the following Chorus.",
      "- Do not label the opening hook-heavy lyrical stanza as Pre-Chorus when it already carries the main recurring title phrase.",
      "- Post-Chorus/Hook: short tag after chorus reinforcing hook phrase.",
      "- Bridge: contrasting lyrical perspective/material, typically appears once, usually late song.",
      "- Intro/Outro/Instrumental: use only when stanza text indicates no active lyric narrative/hook content.",
      "- Refrain is usually a repeated line within a verse-like block; Chorus is a full recurring section.",
      "- If a stanza pivots from narrative lines into repeated title/hook lines, bias that hook-heavy portion toward Chorus.",
      "- If boundaries are coarse and cannot split internally, label the stanza containing recurring title/hook lines as Chorus when that hook reappears in later stanzas.",
      "- If exact title phrase appears in multiple lines of a stanza and reappears later, strongly prefer Chorus over Verse.",
      "Common cycle expectations in verse-chorus songs:",
      "- Verse -> (Pre-Chorus) -> Chorus -> (Post-Chorus), repeated.",
      "- Bridge usually before a final chorus return.",
      "Prioritize semantic/language evidence over pattern-only guesses when they conflict.",
      "Use stanza evidence metrics:",
      "- Higher repeatedLineRatio + titleTokenRatio suggests Chorus/Refrain.",
      "- High titleLineRatio or titleLineHits is strong Chorus/Refrain evidence.",
      "- High globallyRepeatedLineRatio or maxLineOverlapWithAny indicates repeated hook content (often Chorus/Refrain).",
      "- High nextLikelyChorus or transitionToHookScore suggests current stanza may be Pre-Chorus rather than Verse.",
      "- Higher uniqueTokenRatio with lower repetition suggests Verse.",
      "- A single high-novelty late section can indicate Bridge.",
      "- If title words recur in multiple stanzas, weight those stanzas toward Chorus/Refrain.",
      "- When uncertain between Verse vs Chorus, prefer Chorus if title/hook lines recur across 2+ stanzas.",
      "- Repeated relative chord progression/cadence across non-adjacent stanzas supports Chorus/Refrain.",
      "- High lyric novelty plus harmonic change (new progression, different cadence, different harmonic rhythm) can indicate Verse or Bridge.",
      "- Use progressionRelative and cadenceRelative more than absolute chord names for repetition checks.",
      "- progressionSimilarityToPrev near 1.0 suggests neighboring stanzas may be the same section type.",
      "Avoid one-label collapse unless evidence strongly supports it."
    ].join("\n");
    const instructionBlock = packagedInstruction || fallbackInstruction;
    const prompt = [
      instructionBlock,
      `Track: ${trackName}`,
      `Song title hint: ${tTitle || "unavailable"}`,
      `Tempo/time signature hint: ${Number.isFinite(Number(tempoBpm)) ? `${tempoBpm} BPM` : "unknown BPM"} / ${String(timeSignature || "unknown")}`,
      userManualStructureHint && typeof userManualStructureHint === "object"
        ? `User manual structure reference (authoritative when present): ${JSON.stringify(userManualStructureHint)}`
        : "User manual structure reference: none",
      "Allowed labels: Intro, Verse, Chorus, Pre-Chorus, Post-Chorus, Bridge, Instrumental, Outro, Refrain, Hook, Solo, Interlude, Breakdown, Tag.",
      "Return JSON with keys:",
      "- sections: array of {index:number,label:string} matching provided indices",
      "- confidence: high|medium|low",
      "- rationale: one short sentence",
      fewShotExamples.length
        ? `Few-shot reference examples (weakly supervised corpus, use as soft guidance not strict truth): ${JSON.stringify(fewShotExamples)}`
        : "Few-shot reference examples: none",
      `Stanza sequence data: ${JSON.stringify(ctxRows)}`,
      `Stanza chord data: ${JSON.stringify(chordRows)}`,
      `Stanza evidence data: ${JSON.stringify(structureEvidence)}`
    ].join("\n");
    const res = await bridge.runAgentConversation({
      userMessage: prompt,
      messages: [],
      context: {
        purpose: "lyrics-section-labeling",
        sequenceName: state.activeSequence || ""
      }
    });
    if (!res?.ok) return null;
    const parsed = parseLlmSectionLabelResult(res.assistantMessage || "", sec.length);
    if (!parsed) return null;
    const rawLabels = parsed.labels.slice();
    const mergedBase = sec.map((s, i) => {
      const cur = normalizeSectionLabelBase(String(s?.label || ""));
      if (cur === "Lyrical") return rawLabels[i] || "Verse";
      return cur;
    });
    const numbered = buildNumberedSectionLabels(mergedBase);
    const relabeled = sec.map((s, i) => ({
      ...s,
      label: numbered[i] || String(s?.label || "")
    }));
    return {
      sections: relabeled,
      confidence: parsed.confidence,
      rationale: parsed.rationale,
      trainingPackage: pkgBundle?.ok
        ? {
            packageId: String(pkgBundle.packageId || "").trim(),
            packageVersion: String(pkgBundle.packageVersion || "").trim(),
            moduleId: String(pkgBundle.moduleId || "").trim(),
            moduleVersion: String(pkgBundle.moduleVersion || "").trim(),
            promptPaths: Array.isArray(pkgBundle.promptPaths) ? pkgBundle.promptPaths : [],
            fewShotCount: fewShotExamples.length
          }
        : null,
      trainingPackageError: pkgBundle?.ok ? "" : String(pkgBundle?.error || "").trim()
    };
  } catch {
    return null;
  }
}

function buildWebValidationFromServiceEvidence({ evidence = null, trackIdentity = null } = {}) {
  if (!evidence || typeof evidence !== "object") return null;
  const sourceBpmValues = extractNumericCandidates(evidence.bpmValues).slice(0, 8);
  const sourceBarsValues = extractNumericCandidates(evidence.barsPerMinuteValues).slice(0, 8);
  const signatures = Array.isArray(evidence.timeSignatures)
    ? evidence.timeSignatures.map((s) => String(s || "").trim()).filter(Boolean)
    : [];
  const timeSignature = signatures.find((sig) => /^\d+\s*\/\s*\d+$/.test(sig)) || "unknown";
  const chosenBeatRaw = Number(evidence.chosenBeatBpm);
  const chosenBeatBpm = Number.isFinite(chosenBeatRaw) && chosenBeatRaw > 0 ? chosenBeatRaw : null;
  const tempoBpm =
    chosenBeatBpm != null
      ? chosenBeatBpm
      : medianNumber(sourceBpmValues.filter((n) => Number.isFinite(n) && n > 0));
  const sources = Array.isArray(evidence.sources)
    ? evidence.sources.map((s) => String(s || "").trim()).filter(Boolean).slice(0, 3)
    : [];
  if (!sources.length && !Number.isFinite(tempoBpm)) return null;
  const title = String(trackIdentity?.title || "").trim();
  const artist = String(trackIdentity?.artist || "").trim();
  const confidence =
    (sources.length > 0 && Number.isFinite(Number(tempoBpm))) ? "high" :
    (sources.length > 0 || Number.isFinite(Number(tempoBpm))) ? "medium" :
    "low";
  return {
    timeSignature,
    tempoBpm: Number.isFinite(Number(tempoBpm)) ? Number(tempoBpm) : null,
    confidence,
    rationale: "Deterministic BPM/time-signature evidence parsed from songbpm/getsongbpm.",
    alternates: [],
    sourceBpmValues,
    sourceBarsValues,
    chosenBeatBpm,
    matchedTitle: title,
    matchedArtist: artist,
    exactMatch: Boolean(title && artist),
    sources
  };
}

async function runSongContextWebFallback(audioPath = "") {
  const query = audioTrackQueryFromPath(audioPath);
  if (!query) return "";
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=3`;
    const res = await fetch(url);
    if (!res.ok) return "";
    const body = await res.json();
    const rows = Array.isArray(body?.results) ? body.results : [];
    if (!rows.length) return "";
    const top = rows[0];
    const artist = String(top?.artistName || "").trim();
    const track = String(top?.trackName || "").trim();
    const genre = String(top?.primaryGenreName || "").trim();
    const date = String(top?.releaseDate || "").trim();
    const year = date ? date.slice(0, 4) : "";
    const parts = [];
    if (track || artist) parts.push(`${track || query}${artist ? ` by ${artist}` : ""}`);
    if (genre) parts.push(`genre: ${genre}`);
    if (year) parts.push(`release: ${year}`);
    return parts.join(" | ");
  } catch {
    return "";
  }
}

async function runAudioAnalysisPipeline() {
  const resolvedProvider = "librosa";
  const out = await runAudioAnalysisOrchestration({
    audioPath: String(state.audioPathInput || "").trim(),
    analysisService: {
      baseUrl: String(state.ui.analysisServiceUrlDraft || "").trim().replace(/\/+$/, ""),
      provider: resolvedProvider,
      apiKey: String(state.ui.analysisServiceApiKeyDraft || "").trim(),
      authBearer: String(state.ui.analysisServiceAuthBearerDraft || "").trim()
    },
    analysisBridge: getDesktopAudioAnalysisBridge(),
    inferLyricStanzaPlan,
    relabelSectionsWithLlm,
    audioTrackQueryFromPath,
    buildSectionSuggestions,
    runSongContextResearch,
    runSongContextWebFallback,
    buildWebValidationFromServiceEvidence,
    areMetersCompatible,
    beatsPerBarFromSignature,
    extractNumericCandidates,
    medianNumber,
    analyzeAudioContext,
    formatAudioAnalysisSummary,
    initialSectionSuggestions: state.sectionSuggestions || [],
    initialSectionStartByLabel: state.sectionStartByLabel || {},
    onProgress: ({ stage, message } = {}) => {
      setAudioAnalysisProgress(state.audioAnalysis, { stage, message });
      render();
    }
  });
  if (Array.isArray(out.sectionSuggestions) && out.sectionSuggestions.length) {
    state.ui.sectionTrackName = out.sectionTrackName || "Analysis: Song Structure";
    state.sectionSuggestions = out.sectionSuggestions;
    state.sectionStartByLabel = out.sectionStartByLabel || {};
  }
  return out;
}

function startAudioAnalysisProgressTicker() {
  const timeline = [
    { stage: "service_request", message: "Submitting the selected track to the Librosa analysis backend." },
    { stage: "timing_analysis", message: "Analyzing beat and bar timing with Librosa." },
    { stage: "structure_derivation", message: "Deriving song sections from timing and track duration." },
    { stage: "result_normalize", message: "Normalizing the analysis result for Lyric's dashboard." }
  ];
  let index = 0;
  let stopped = false;

  const applyStep = () => {
    if (stopped) return;
    const current = timeline[Math.min(index, timeline.length - 1)];
    setAudioAnalysisProgress(state.audioAnalysis, current);
    render();
  };

  applyStep();
  const intervalId = window.setInterval(() => {
    if (stopped) return;
    if (index < timeline.length - 1) index += 1;
    applyStep();
  }, 4000);

  return {
    stop() {
      stopped = true;
      window.clearInterval(intervalId);
    }
  };
}

function buildAnalysisHandoffFromPipelineResult(result = {}) {
  const artifact = buildAnalysisArtifactFromPipelineResult({
    audioPath: String(state.audioPathInput || "").trim(),
    result
  });
  return buildAnalysisHandoffFromArtifact(artifact, state.creative?.brief || null);
}

async function onAnalyzeAudio({ userPrompt = "" } = {}) {
  const audioPath = String(state.audioPathInput || "").trim();
  state.ui.lastAnalysisPrompt = String(userPrompt || "").trim();
  if (!audioPath) {
    setStatus("warning", "No audio track available for analysis on this sequence.");
    return render();
  }
  setAgentActiveRole("audio_analyst");
  const orchestrationRun = beginOrchestrationRun({ trigger: "analyze-audio", role: "audio_analyst" });
  agentRuntime.handoffs.analysis_handoff_v1 = null;
  refreshAgentRuntimeHealth();
  markOrchestrationStage(orchestrationRun, "service_health", "ok", "service preflight skipped; analyze call will self-heal backend");
  state.diagnostics = (state.diagnostics || []).filter(
    (entry) => !String(entry?.text || "").startsWith("Audio analysis:")
  );
  state.sectionSuggestions = [];
  state.sectionStartByLabel = {};
  resetAudioAnalysisView(state.audioAnalysis);
  state.audioAnalysis.pipeline = buildPendingAudioAnalysisPipeline();
  setAudioAnalysisProgress(state.audioAnalysis, {
    stage: "pipeline_start",
    message: "Preparing the audio analysis pipeline."
  });
  state.ui.agentThinking = true;
  setStatus("info", "Running audio analysis pipeline...");
  render();
  const progressTicker = startAudioAnalysisProgressTicker();
  try {
    const resolvedProvider = "librosa";
    const analysisRequest = buildAudioAnalystInput({
      requestId: orchestrationRun.id,
      mediaFilePath: audioPath,
      mediaRootPath: String(state.project?.mediaPath || "").trim(),
      projectFilePath: String(state.projectFilePath || "").trim(),
      service: {
        baseUrl: String(state.ui.analysisServiceUrlDraft || "").trim().replace(/\/+$/, ""),
        provider: resolvedProvider,
        apiKey: String(state.ui.analysisServiceApiKeyDraft || "").trim(),
        authBearer: String(state.ui.analysisServiceAuthBearerDraft || "").trim()
      }
    });
    const flow = await executeAudioAnalystFlow({
      input: analysisRequest,
      runPipeline: async () => runAudioAnalysisPipeline({ refreshTracks: true }),
      persistArtifact: async ({ artifact }) => {
        const artifactBridge = getDesktopAnalysisArtifactBridge();
        if (artifactBridge && state.projectFilePath && audioPath) {
          return artifactBridge.writeAnalysisArtifact({
            projectFilePath: state.projectFilePath,
            mediaFilePath: audioPath,
            artifact
          });
        }
        if (!state.projectFilePath) {
          return { ok: false, error: "Audio analysis artifact not persisted: project must be saved first." };
        }
        return { ok: false, error: "Audio analysis artifact bridge unavailable in this runtime." };
      },
      creativeBrief: state.creative?.brief || null
    });
    const result = flow.pipelineResult || null;
    const persistedArtifact = flow.artifact || null;
    if (!flow.ok || !persistedArtifact || !flow.handoff) {
      const failureSummary = String(flow?.result?.summary || "audio analysis failed");
      throw new Error(failureSummary);
    }
    markOrchestrationStage(orchestrationRun, "audio_pipeline", flow.result.status === "partial" ? "warning" : "ok", "analysis pipeline complete");
    if (Array.isArray(flow.result.warnings)) {
      for (const row of flow.result.warnings) {
        pushDiagnostic("warning", `Audio analysis: ${row}`);
      }
    }
    const applied = applyAudioAnalystFlowSuccessToState({
      flow,
      pipelineResult: result,
      fallbackSummary: buildAudioAnalysisStubSummary(),
      audioAnalysisState: state.audioAnalysis,
      setHandoff: (handoff) => setAgentHandoff("analysis_handoff_v1", handoff, "audio_analyst")
    });
    if (!applied.ok) {
      throw new Error("Audio analysis flow did not produce a valid UI projection.");
    }
    syncSectionSuggestionsFromAnalysisArtifact(persistedArtifact);
    setAudioAnalysisProgress(state.audioAnalysis, {
      stage: "handoff_ready",
      message: "Analysis finished and handoff is ready."
    });
    markOrchestrationStage(orchestrationRun, "analysis_handoff", "ok", "analysis_handoff_v1 ready");
    addStructuredChatMessage("agent", buildAudioAnalystChatReply(userPrompt, flow.handoff), {
      roleId: "audio_analyst",
      displayName: getTeamChatSpeakerLabel("audio_analyst"),
      handledBy: "audio_analyst",
      artifact: buildChatArtifactCard("analysis_handoff_v1", {
        title: String(flow.handoff?.trackIdentity?.title || basenameOfPath(audioPath) || "Audio Analysis").trim(),
        summary: String(flow.handoff?.summary || state.audioAnalysis?.summary || "").trim(),
        chips: [
          flow.handoff?.timing?.bpm != null ? `${flow.handoff.timing.bpm} BPM` : "",
          String(flow.handoff?.timing?.timeSignature || "").trim(),
          Array.isArray(flow.handoff?.structure?.sections) ? `${flow.handoff.structure.sections.length} sections` : "",
          flow.handoff?.chords?.hasChords ? "chords ready" : ""
        ]
      })
    });
    setStatus("info", flow.result.status === "partial" ? "Audio analysis complete with warnings." : "Audio analysis complete.");
    endOrchestrationRun(orchestrationRun, {
      status: flow.result.status === "failed" ? "failed" : "ok",
      summary: flow.result.status === "partial" ? "audio analysis complete with warnings" : "audio analysis complete"
    });
  } catch (err) {
    markOrchestrationStage(orchestrationRun, "audio_pipeline", "error", String(err?.message || err));
    endOrchestrationRun(orchestrationRun, { status: "failed", summary: "audio analysis failed" });
    applyAudioAnalystFlowFailureToState({
      audioAnalysisState: state.audioAnalysis,
      fallbackSummary: buildAudioAnalysisStubSummary()
    });
    setAudioAnalysisProgress(state.audioAnalysis, {
      stage: "failed",
      message: `Analysis failed: ${String(err?.message || err)}`
    });
    setStatusWithDiagnostics("warning", `Audio analysis pipeline failed: ${err.message}`);
  } finally {
    progressTicker.stop();
    state.ui.agentThinking = false;
  }
  saveCurrentProjectSnapshot();
  persist();
  render();
}

async function onCloseSequence() {
  if (!state.flags.xlightsConnected) {
    setStatusWithDiagnostics("warning", "Connect to xLights before closing sequence.");
    return render();
  }
  if (!window.confirm("Close active sequence in xLights?")) {
    setStatus("info", "Close sequence canceled.");
    return render();
  }

  setStatus("info", "Closing sequence...");
  render();
  try {
    await closeSequence(state.endpoint, true, false);
    state.flags.activeSequenceLoaded = false;
    state.revision = "unknown";
    state.activeSequence = "(none)";
    resetSessionDraftState();
    resetCreativeState();
    setStatus("info", "Sequence closed.");
  } catch (err) {
    setStatusWithDiagnostics("action-required", `Close failed: ${err.message}`, err.stack || "");
  } finally {
    saveCurrentProjectSnapshot();
    persist();
    render();
  }
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
  return {
    basenameOfPath,
    getSelectedSections,
    hasAllSectionsSelected,
    getSectionName,
    selectedProposedLinesForApply,
    summarizeImpactForLines,
    buildDesignerPlanCommands,
    applyReadyForApprovalGate,
    applyDisabledReason,
    buildCurrentReviewSnapshotSummary,
    getMetadataTagRecords,
    buildMetadataTargets,
    buildNormalizedTargetMetadataRecords: () => buildNormalizedTargetMetadataRecords({
      sceneGraph: state.sceneGraph || {},
      metadataAssignments: buildEffectiveMetadataAssignments(),
      metadataPreferencesByTargetId: state.metadata?.preferencesByTargetId || {}
    }),
    matchesMetadataFilterValue,
    normalizeMetadataSelectionIds,
    normalizeMetadataSelectedTags,
    getAgentApplyRolloutMode,
    getManualLockedXdTracks,
    getTeamChatIdentities,
    getDiagnosticsCounts,
    buildLabel: getBuildLabel()
  };
}

function getBuildLabel() {
  const buildVersion = String(state.health.desktopAppVersion || "").trim();
  const buildTimeIso = String(state.health.desktopBuildTime || "").trim();
  const buildTimeLabel = buildTimeIso
    ? new Date(buildTimeIso).toLocaleString([], { year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "";
  return buildVersion
    ? `Build: v${buildVersion}${buildTimeLabel ? ` @ ${buildTimeLabel}` : ""}`
    : "Build: unknown";
}

async function runCurrentDirectSequenceValidation(expected = {}) {
  return runDirectSequenceValidation({
    endpoint: state.endpoint,
    state,
    handoffs: {
      analysisHandoff: getValidHandoff("analysis_handoff_v1"),
      intentHandoff: getValidHandoff("intent_handoff_v1"),
      planHandoff: getValidHandoff("plan_handoff_v1")
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
    pageStates: getPageStates(),
    activeSequence: state.activeSequence || "",
    handoffs: {
      analysisHandoff: getValidHandoff("analysis_handoff_v1"),
      intentHandoff: getValidHandoff("intent_handoff_v1"),
      planHandoff: getValidHandoff("plan_handoff_v1")
    }
  };
}

const automationRuntime = createAutomationRuntime({
  state,
  agentRuntime,
  onSendChat,
  onGenerate,
  onApplyAll,
  onRefresh,
  onAnalyzeAudio,
  onOpenExistingSequence,
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
  filteredProposed,
  arraysEqualOrdered,
  buildSequenceAgentPlan,
  validateCommandGraph,
  buildOwnedSequencingBatchPlan,
  getOwnedHealth,
  currentLayoutMode,
  getSequenceTimingOwnershipRows,
  applyReadyForApprovalGate,
  persist,
  render,
  setStatus,
  runCurrentDirectSequenceValidation,
  getCurrentDirectSequenceValidationSnapshot,
  getPageStates
});

const {
  dispatchAutomationPrompt,
  generateAutomationProposal,
  applyAutomationCurrentProposal,
  diagnoseAutomationCurrentProposal,
  getAutomationComparativeValidationSnapshot,
  refreshAutomationFromXLights,
  analyzeAutomationAudio,
  openAutomationSequence,
  getAutomationAgentRuntimeSnapshot,
  getAutomationPageStatesSnapshot,
  getAutomationSequencerValidationSnapshot
} = automationRuntime;

async function showAutomationTenEffectGridDemo() {
  const start = 78230;
  const end = 97120;
  const span = end - start;
  const slot = Math.floor(span / 10);
  const effectNames = ["Color Wash", "Shimmer", "Bars", "Butterfly", "Meteors", "Pinwheel", "Spirals", "Wave", "Candle", "Morph"];

  clearDesignerDraft(state);
  state.agentPlan = null;
  clearSequencingHandoffsForSequenceChange("automation demo reset");

  state.draftBaseRevision = String(state.revision || "unknown");
  state.draftSequencePath = String(state.sequencePathInput || "").trim();
  state.proposed = ["Chorus 1 / Snowman / Color Wash, Shimmer +8 more"];
  state.flags.hasDraftProposal = true;
  state.flags.proposalStale = false;

  const intentHandoff = {
    artifactId: `intent_handoff_v1-demo-${Date.now()}`,
    artifactType: "intent_handoff_v1",
    createdAt: new Date().toISOString(),
    goal: "Sequence grid demo with ten effects on one target in one section.",
    mode: "revise",
    scope: {
      targetIds: ["Snowman"],
      tagNames: [],
      sections: ["Chorus 1"],
      timeRangeMs: { startMs: start, endMs: end }
    },
    constraints: {
      changeTolerance: "medium",
      preserveTimingTracks: true,
      allowGlobalRewrite: false
    },
    directorPreferences: {
      styleDirection: "demo",
      energyArc: "hold",
      focusElements: ["Snowman"],
      colorDirection: "mixed"
    },
    approvalPolicy: {
      requiresExplicitApprove: true,
      elevatedRiskConfirmed: false
    }
  };

  const commands = [
    { id: "timing.track.create", cmd: "timing.createTrack", params: { trackName: "XD: Song Structure", replaceIfExists: true } },
    {
      id: "timing.marks.insert",
      dependsOn: ["timing.track.create"],
      cmd: "timing.insertMarks",
      params: {
        trackName: "XD: Song Structure",
        marks: [{ label: "Chorus 1", startMs: start, endMs: end }]
      }
    },
    ...effectNames.map((effectName, i) => ({
      id: `demo-placement-${i + 1}`,
      dependsOn: ["timing.marks.insert"],
      anchor: {
        kind: "timing_track",
        trackName: "XD: Song Structure",
        markLabel: "Chorus 1",
        startMs: start + (i * slot),
        endMs: i === effectNames.length - 1 ? end : start + ((i + 1) * slot),
        basis: "within_section"
      },
      cmd: "effects.create",
      params: {
        modelName: "Snowman",
        layerIndex: 0,
        effectName,
        startMs: start + (i * slot),
        endMs: i === effectNames.length - 1 ? end : start + ((i + 1) * slot),
        settings: {},
        palette: {}
      }
    }))
  ];

  const planHandoff = {
    artifactId: `plan_handoff_v1-demo-${Date.now()}`,
    artifactType: "plan_handoff_v1",
    createdAt: new Date().toISOString(),
    goal: "Show ten-effect Sequence grid aggregation demo.",
    summary: "Ten effects on Snowman in Chorus 1 for Sequence grid validation.",
    estimatedImpact: 10,
    warnings: [],
    commands,
    baseRevision: state.draftBaseRevision,
    validationReady: true
  };

  state.creative = state.creative || {};
  state.creative.intentHandoff = structuredClone(intentHandoff);
  state.agentPlan = {
    source: "automation_demo",
    summary: planHandoff.summary,
    warnings: [],
    estimatedImpact: 10,
    handoff: structuredClone(planHandoff)
  };

  setAgentHandoff("intent_handoff_v1", intentHandoff, "designer_dialog");
  setAgentHandoff("plan_handoff_v1", planHandoff, "sequence_agent");
  setStatus("info", "Loaded ten-effect grid demo (proposal only).");
  persist();
  render();

  return {
    ok: true,
    status: state.status || null,
    activeSequence: state.activeSequence || "",
    proposedCount: Array.isArray(state.proposed) ? state.proposed.length : 0
  };
}

async function showAutomationSplitEffectGridDemo() {
  const start = 78230;
  const end = 97120;
  const span = end - start;
  const slot = Math.floor(span / 10);
  const effectNames = [
    "Color Wash", "Color Wash", "Color Wash", "Color Wash", "Color Wash",
    "Shimmer", "Shimmer", "Shimmer", "Shimmer", "Shimmer"
  ];

  clearDesignerDraft(state);
  state.agentPlan = null;
  clearSequencingHandoffsForSequenceChange("automation demo reset");

  state.draftBaseRevision = String(state.revision || "unknown");
  state.draftSequencePath = String(state.sequencePathInput || "").trim();
  state.proposed = ["Chorus 1 / Snowman / Color Wash, Shimmer"];
  state.flags.hasDraftProposal = true;
  state.flags.proposalStale = false;

  const intentHandoff = {
    artifactId: `intent_handoff_v1-demo-${Date.now()}`,
    artifactType: "intent_handoff_v1",
    createdAt: new Date().toISOString(),
    goal: "Sequence grid demo with five Color Wash and five Shimmer effects on one target in one section.",
    mode: "revise",
    scope: {
      targetIds: ["Snowman"],
      tagNames: [],
      sections: ["Chorus 1"],
      timeRangeMs: { startMs: start, endMs: end }
    },
    constraints: {
      changeTolerance: "medium",
      preserveTimingTracks: true,
      allowGlobalRewrite: false
    },
    directorPreferences: {
      styleDirection: "demo",
      energyArc: "hold",
      focusElements: ["Snowman"],
      colorDirection: "mixed"
    },
    approvalPolicy: {
      requiresExplicitApprove: true,
      elevatedRiskConfirmed: false
    }
  };

  const commands = [
    { id: "timing.track.create", cmd: "timing.createTrack", params: { trackName: "XD: Song Structure", replaceIfExists: true } },
    {
      id: "timing.marks.insert",
      dependsOn: ["timing.track.create"],
      cmd: "timing.insertMarks",
      params: {
        trackName: "XD: Song Structure",
        marks: [{ label: "Chorus 1", startMs: start, endMs: end }]
      }
    },
    ...effectNames.map((effectName, i) => ({
      id: `demo-split-placement-${i + 1}`,
      dependsOn: ["timing.marks.insert"],
      anchor: {
        kind: "timing_track",
        trackName: "XD: Song Structure",
        markLabel: "Chorus 1",
        startMs: start + (i * slot),
        endMs: i === effectNames.length - 1 ? end : start + ((i + 1) * slot),
        basis: "within_section"
      },
      cmd: "effects.create",
      params: {
        modelName: "Snowman",
        layerIndex: 0,
        effectName,
        startMs: start + (i * slot),
        endMs: i === effectNames.length - 1 ? end : start + ((i + 1) * slot),
        settings: {},
        palette: {}
      }
    }))
  ];

  const planHandoff = {
    artifactId: `plan_handoff_v1-demo-${Date.now()}`,
    artifactType: "plan_handoff_v1",
    createdAt: new Date().toISOString(),
    goal: "Show split-effect Sequence grid aggregation demo.",
    summary: "Five Color Wash and five Shimmer effects on Snowman in Chorus 1.",
    estimatedImpact: 10,
    warnings: [],
    commands,
    baseRevision: state.draftBaseRevision,
    validationReady: true
  };

  state.creative = state.creative || {};
  state.creative.intentHandoff = structuredClone(intentHandoff);
  state.agentPlan = {
    source: "automation_demo",
    summary: planHandoff.summary,
    warnings: [],
    estimatedImpact: 10,
    handoff: structuredClone(planHandoff)
  };

  setAgentHandoff("intent_handoff_v1", intentHandoff, "designer_dialog");
  setAgentHandoff("plan_handoff_v1", planHandoff, "sequence_agent");
  setStatus("info", "Loaded split-effect grid demo (proposal only).");
  persist();
  render();

  return {
    ok: true,
    status: state.status || null,
    activeSequence: state.activeSequence || "",
    proposedCount: Array.isArray(state.proposed) ? state.proposed.length : 0
  };
}

function exposeRuntimeValidationHooks() {
  automationRuntime.exposeRuntimeValidationHooks();
  window.xLightsDesignerRuntime.showTenEffectGridDemo = showAutomationTenEffectGridDemo;
  window.xLightsDesignerRuntime.showSplitEffectGridDemo = showAutomationSplitEffectGridDemo;
}

function getPageStates() {
  return buildPageStates({
    state,
    handoffs: {
      analysisHandoff: getValidHandoff("analysis_handoff_v1"),
      intentHandoff: getValidHandoff("intent_handoff_v1"),
      planHandoff: getValidHandoff("plan_handoff_v1")
    },
    helpers: buildPageStateHelpers()
  });
}

function screenContent(pageStates = getPageStates()) {
  return buildScreenContent({
    state,
    pageStates,
    helpers: {
      basenameOfPath,
      getAnalysisServiceHeaderBadgeText,
      getValidHandoff,
      escapeHtml,
      referenceFormatSummaryText,
      sequenceEligibilityFormatSummaryText,
      formatBytes,
      referenceMediaMaxFileBytes: REFERENCE_MEDIA_MAX_FILE_BYTES,
      referenceMediaMaxItems: REFERENCE_MEDIA_MAX_ITEMS,
      getSections,
      getSelectedSections,
      hasAllSectionsSelected,
      buildDesignerPlanCommands,
      sanitizeProposedSelection,
      selectedProposedLinesForApply,
      summarizeImpactForLines,
      getProposedPayloadPreviewText,
      getSectionName,
      renderProposedLineHtml,
      applyDisabledReason,
      applyPlanReadinessReason,
      applyReadyForApprovalGate,
      applyEnabled,
      buildCurrentReviewSnapshotSummary,
      getMetadataOrphans,
      getMetadataTagRecords,
      buildMetadataTargets,
      matchesMetadataFilterValue,
      normalizeMetadataSelectionIds,
      normalizeMetadataSelectedTags,
      ensureVersionSnapshots,
      versionById,
      getAgentApplyRolloutMode,
      getManualLockedXdTracks,
      getTeamChatIdentities
    }
  });
}

function diagnosticsPanel() {
  if (!state.ui.diagnosticsOpen) return "";
  const rows = state.diagnostics || [];
  const filter = state.ui.diagnosticsFilter;
  const filteredRows =
    filter === "all" ? rows : rows.filter((d) => d.level === filter);
  const counts = getDiagnosticsCounts();
  const applyHistory = Array.isArray(state.applyHistory) ? state.applyHistory.slice(0, 12) : [];
  return `
    <section class="card diagnostics-panel">
      <div class="row" style="justify-content:space-between;">
        <h3>Diagnostics</h3>
        <div class="row">
          <button data-diag-filter="all" class="${filter === "all" ? "active-chip" : ""}">All (${counts.total})</button>
          <button data-diag-filter="warning" class="${filter === "warning" ? "active-chip" : ""}">Warnings (${counts.warning})</button>
          <button data-diag-filter="action-required" class="${filter === "action-required" ? "active-chip" : ""}">Action Required (${counts.actionRequired})</button>
          <button id="export-diagnostics">Export</button>
          <button id="clear-diagnostics">Clear</button>
          <button id="close-diagnostics">Close</button>
        </div>
      </div>
      ${
        filteredRows.length
          ? `
        <ul class="list">
          ${filteredRows
            .map(
              (d) => `
            <li>
              <strong>[${d.level}]</strong> ${new Date(d.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })} - ${d.text}
              ${d.details ? `<pre class="diag-details">${d.details}</pre>` : ""}
            </li>
          `
            )
            .join("")}
        </ul>
      `
          : "<p class=\"banner\">No diagnostics for current filter.</p>"
      }
      <div style="margin-top:10px;">
        <h4 style="margin:0 0 6px;">Recent Applies</h4>
        ${
          applyHistory.length
            ? `
          <ul class="list">
            ${applyHistory
              .map((entry) => {
                const ts = entry?.createdAt
                  ? new Date(entry.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                  : "--:--:--";
                const status = String(entry?.status || "unknown");
                const count = Number(entry?.commandCount || 0);
                const summary = String(entry?.summary || "").trim();
                return `
                <li>
                  <strong>[${status}]</strong> ${ts} - ${count} command${count === 1 ? "" : "s"}
                  ${entry?.applyStage ? ` (${escapeHtml(String(entry.applyStage))})` : ""}
                  ${summary ? `<div class="banner">${escapeHtml(summary)}</div>` : ""}
                </li>
              `;
              })
              .join("")}
          </ul>
        `
            : '<p class="banner">No apply history yet.</p>'
        }
      </div>
    </section>
  `;
}

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
      closeProjectNameDialog();
    });
  }

  const projectNameDialogConfirmBtn = app.querySelector("#project-name-dialog-confirm");
  if (projectNameDialogConfirmBtn) {
    projectNameDialogConfirmBtn.addEventListener("click", () => {
      void confirmProjectNameDialog();
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
        void confirmProjectNameDialog();
      } else if (event.key === "Escape") {
        event.preventDefault();
        closeProjectNameDialog();
      }
    });
  }

  const closeJobsBtn = app.querySelector("#close-jobs");
  if (closeJobsBtn) closeJobsBtn.addEventListener("click", () => toggleJobs(false));

  const clearDiagnosticsBtn = app.querySelector("#clear-diagnostics");
  if (clearDiagnosticsBtn) clearDiagnosticsBtn.addEventListener("click", clearDiagnostics);

  const resetAppInstallStateBtn = app.querySelector("#reset-app-install-state");
  if (resetAppInstallStateBtn) resetAppInstallStateBtn.addEventListener("click", onResetAppInstallState);

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
      void probeAnalysisServiceHealth({ quiet: true });
    });
  }

  const analysisServiceApiKeyInput = app.querySelector("#analysis-service-api-key-input");
  if (analysisServiceApiKeyInput) {
    analysisServiceApiKeyInput.addEventListener("input", () => {
      state.ui.analysisServiceApiKeyDraft = String(analysisServiceApiKeyInput.value || "");
      persist();
      void probeAnalysisServiceHealth({ quiet: true });
    });
  }
  const analysisServiceBearerInput = app.querySelector("#analysis-service-bearer-input");
  if (analysisServiceBearerInput) {
    analysisServiceBearerInput.addEventListener("input", () => {
      state.ui.analysisServiceAuthBearerDraft = String(analysisServiceBearerInput.value || "");
      persist();
      void probeAnalysisServiceHealth({ quiet: true });
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
    setAudioPathWithAgentPolicy,
    onSaveProjectSettings,
    onOpenSelectedProject,
    onCreateNewProject,
    onSaveProjectAs,
    onResetProjectWorkspace,
    onBrowseProjectMetadataRoot,
    onOpenSelectedSequence,
    onNewSequence,
    onSaveSequenceCurrent,
    onSaveSequenceAs,
    onSelectCatalogSequence,
    onBrowseShowFolder,
    onBrowseMediaFolder,
    onRefreshMediaCatalog,
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
    updateMetadataTargetEffectAvoidances,
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
    onCloseArtifactDetail
  });
}

function render() {
  normalizeUiRoute();
  const focusSnapshot = captureRenderFocusState();
  const buildLabel = getBuildLabel();
  const analysisHeaderBadge = getAnalysisServiceHeaderBadgeText();
  const pageStates = getPageStates();
  app.innerHTML = buildAppShell({
    state,
    screenContent: screenContent(pageStates),
    helpers: {
      escapeHtml,
      renderInlineChipSentence,
      getTeamChatIdentity,
      getTeamChatSpeakerLabel,
      getSections,
      getSelectedSections,
      hasAllSectionsSelected,
      getSectionName,
      applyReadyForApprovalGate,
      applyEnabled,
      applyDisabledReason,
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
}

exposeRuntimeValidationHooks();

async function bootstrapLiveData() {
  try {
    await hydrateAgentHealth();
    await hydrateAgentRuntime({ quiet: true });
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
    await refreshApplyHistoryFromDesktop(40);
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
  await hydrateAgentHealth();
  await hydrateAgentRuntime({ quiet: true });
  await hydrateAgentConfigDraft();
  await probeAnalysisServiceHealth({ quiet: true, force: true });
  applyRolloutPolicy();
  await refreshApplyHistoryFromDesktop(40);
  if (String(state.mediaPath || "").trim()) {
    await onRefreshMediaCatalog({ silent: true });
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
    void probeAnalysisServiceHealth({ quiet: true });
    if (state.route === "audio" || state.route === "project") {
      void onRefreshMediaCatalog({ silent: true });
    }
  });
}
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void syncOpenSequenceOnFocusReturn();
      if (state.route === "audio" || state.route === "project") {
        void onRefreshMediaCatalog({ silent: true });
      }
    }
  });
}
