import {
  closeSequence,
  cancelJob,
  createSequence,
  executePlan,
  getJob,
  getMediaStatus,
  getModels,
  getOpenSequence,
  getRevision,
  getSubmodels,
  getSystemVersion,
  saveSequence,
  getTimingMarks,
  getTimingTracks,
  openSequence,
  validateCommands,
  pingCapabilities
} from "./api.js";
import { buildProposalFromIntent } from "./agent/planner.js";
import { buildGuidedQuestions } from "./agent/guided-dialog.js";
import {
  buildDesignerPlanCommands as buildDesignerPlanCommandsFromLines,
  estimateImpactCount
} from "./agent/command-builders.js";
import { analyzeAudioContext } from "./agent/audio-analyzer.js";
import { synthesizeCreativeBrief } from "./agent/brief-synthesizer.js";
import { validateAndApplyPlan } from "./agent/orchestrator.js";

const app = document.getElementById("app");
const STORAGE_KEY = "xlightsdesigner.ui.state.v1";
const PROJECTS_KEY = "xlightsdesigner.ui.projects.v1";
const PREFERRED_XLIGHTS_ENDPOINT = "http://127.0.0.1:49914/xlDoAutomation";
const DESKTOP_STATE_SYNC_DEBOUNCE_MS = 250;
const CONNECTIVITY_POLL_MS = 10000;
const FOCUS_SYNC_COOLDOWN_MS = 1200;
const QUICK_RECONNECT_DELAY_MS = 3000;
const ENDPOINT_PROBE_TIMEOUT_MS = 1800;
const DEFAULT_PROPOSED_ROWS = 5;
const PROPOSED_ROWS_STEP = 5;
const CHAT_QUICK_PROMPTS = [
  "Make chorus 2 higher energy on MegaTree and Roofline.",
  "Keep current look, but reduce twinkle intensity on candy canes.",
  "Rework bridge section with calmer color transitions."
];
const INLINE_CHIP_MODEL_FALLBACKS = ["MegaTree", "Roofline", "Candy Canes", "Matrix", "Arches", "CandyCane"];
const SUPPORTED_SEQUENCE_MEDIA_EXTENSIONS = new Set([
  "mp3", "wav", "ogg", "m4a", "flac",
  "mp4", "m4v", "mov", "avi", "mpg", "mpeg",
  "jpg", "jpeg", "png", "gif", "webp"
]);
const REFERENCE_MEDIA_ALLOWED_EXTENSIONS = new Set([
  "jpg", "jpeg", "png", "gif", "webp",
  "mp4", "m4v", "mov", "avi", "mpg", "mpeg"
]);
const REFERENCE_MEDIA_MAX_FILE_BYTES = 250 * 1024 * 1024;
const REFERENCE_MEDIA_MAX_ITEMS = 40;

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
  route: "project",
  endpoint: PREFERRED_XLIGHTS_ENDPOINT,
  projectName: "Holiday 2026",
  projectConcept: "",
  showFolder: "/Users/robterry/Desktop/Show",
  projectMetadataRoot: "",
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
  audioAnalysis: {
    summary: "",
    lastAnalyzedAt: ""
  },
  savePathInput: "",
  lastApplyBackupPath: "",
  recentSequences: [],
  showDirectoryStats: { xsqCount: 0, xdmetaCount: 0 },
  projectCreatedAt: "",
  projectUpdatedAt: "",
  revision: "unknown",
  health: {
    lastCheckedAt: "",
    capabilitiesCount: 0,
    hasExecutePlan: false,
    hasValidateCommands: false,
    hasJobsGet: false,
    sequenceOpen: false,
    runtimeReady: false,
    desktopFileDialogReady: false,
    desktopBridgeApiCount: 0,
    xlightsVersion: "",
    compatibilityStatus: "unknown",
    submodelDiscoveryError: ""
  },
  draftBaseRevision: "unknown",
  status: { level: "info", text: "Ready. Start in Design or open a sequence." },
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
    metadataFilterTags: "",
    metadataSelectionIds: [],
    proposedSelection: [],
    sequenceMode: "existing",
    sectionTrackName: "",
    proposedRowsVisible: DEFAULT_PROPOSED_ROWS,
    chatDraft: "",
    agentThinking: false,
    metadataTargetId: "",
    metadataSelectedTags: [],
    metadataNewTag: "",
    metadataNewTagDescription: "",
    navCollapsed: false,
    proposedPayloadOpen: false,
    applyApprovalChecked: false
  },
  diagnostics: [],
  applyHistory: [],
  jobs: [],
  models: [],
  submodels: [],
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
    briefUpdatedAt: ""
  },
  inspiration: {
    paletteSwatches: ["#0b3d91", "#2a9d8f", "#f4a261", "#e76f51"]
  },
  metadata: {
    tags: ["focal", "rhythm-driver", "ambient-fill"],
    assignments: [],
    ignoredOrphanTargetIds: []
  },
  projectSequences: [],
  sequenceCatalog: [],
  versions: [{ id: "v1", summary: "Session initialized", effects: 0, time: "--:--" }],
  selectedVersion: "v1",
  compareVersion: null
};

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
    return merged;
  } catch {
    return structuredClone(defaultState);
  }
}

const state = loadState();
if (!Array.isArray(state.ui?.proposedSelection)) {
  state.ui.proposedSelection = [];
}
if (!Array.isArray(state.ui?.metadataSelectionIds)) {
  state.ui.metadataSelectionIds = [];
}
if (!Array.isArray(state.ui?.metadataSelectedTags)) {
  state.ui.metadataSelectedTags = [];
}
if (typeof state.ui?.applyApprovalChecked !== "boolean") {
  state.ui.applyApprovalChecked = false;
}
if (!Array.isArray(state.applyHistory)) {
  state.applyHistory = [];
}
if (typeof state.ui?.metadataFilterName !== "string") state.ui.metadataFilterName = "";
if (typeof state.ui?.metadataFilterType !== "string") state.ui.metadataFilterType = "";
if (typeof state.ui?.metadataFilterTags !== "string") state.ui.metadataFilterTags = "";
if (!Array.isArray(state.proposed) || state.proposed.length === 0) {
  state.proposed = buildDemoProposedLines();
  state.flags.hasDraftProposal = true;
}
let desktopStatePersistTimer = null;
let desktopStateHydrated = false;
let sidecarPersistTimer = null;
let quickReconnectTimer = null;
let hydratedSidecarSequencePath = "";
let focusSyncInFlight = false;
let lastFocusSyncAt = 0;
let lastIgnoredExternalSequencePath = "";

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
    typeof bridge.saveProjectDialog !== "function" ||
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
    }
  } catch {
    // Non-fatal. Continue with localStorage state.
  } finally {
    desktopStateHydrated = true;
    queueDesktopStatePersist();
  }
}

function currentSequencePathForSidecar() {
  return String(state.sequencePathInput || "").trim();
}

function buildSequenceSidecarDocument() {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    sequencePath: currentSequencePathForSidecar(),
    project: {
      name: state.projectName || "",
      showFolder: state.showFolder || ""
    },
    draft: {
      proposed: Array.isArray(state.proposed) ? state.proposed : [],
      draftBaseRevision: state.draftBaseRevision || "unknown",
      flags: {
        hasDraftProposal: Boolean(state.flags?.hasDraftProposal),
        proposalStale: Boolean(state.flags?.proposalStale)
      }
    },
    creative: state.creative || {},
    metadata: state.metadata || {},
    versions: Array.isArray(state.versions) ? state.versions : [],
    selection: {
      selectedVersion: state.selectedVersion || "",
      compareVersion: state.compareVersion || null
    }
  };
}

function applySequenceSidecarDocument(doc) {
  if (!doc || typeof doc !== "object") return;
  if (Array.isArray(doc?.draft?.proposed)) state.proposed = [...doc.draft.proposed];
  if (typeof doc?.draft?.draftBaseRevision === "string") {
    state.draftBaseRevision = doc.draft.draftBaseRevision;
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
  if (doc?.metadata && typeof doc.metadata === "object") state.metadata = { ...state.metadata, ...doc.metadata };
  if (Array.isArray(doc?.versions) && doc.versions.length) state.versions = doc.versions;
  if (typeof doc?.selection?.selectedVersion === "string" && doc.selection.selectedVersion) {
    state.selectedVersion = doc.selection.selectedVersion;
  }
  state.compareVersion = doc?.selection?.compareVersion ?? state.compareVersion;
}

async function hydrateSidecarForCurrentSequence() {
  const bridge = getDesktopSidecarBridge();
  const sequencePath = currentSequencePathForSidecar();
  if (!bridge || !sequencePath) return;
  try {
    const res = await bridge.readSequenceSidecar({ sequencePath });
    if (res?.ok !== true) return;
    hydratedSidecarSequencePath = sequencePath;
    if (res.exists && res.data && typeof res.data === "object") {
      applySequenceSidecarDocument(res.data);
    }
  } catch {
    // Non-fatal.
  }
}

function queueSidecarPersist() {
  const bridge = getDesktopSidecarBridge();
  const sequencePath = currentSequencePathForSidecar();
  if (!bridge || !sequencePath) return;
  if (hydratedSidecarSequencePath !== sequencePath) return;
  if (sidecarPersistTimer) {
    clearTimeout(sidecarPersistTimer);
  }
  sidecarPersistTimer = setTimeout(async () => {
    sidecarPersistTimer = null;
    try {
      await bridge.writeSequenceSidecar({
        sequencePath,
        data: buildSequenceSidecarDocument()
      });
    } catch {
      // Non-fatal.
    }
  }, DESKTOP_STATE_SYNC_DEBOUNCE_MS);
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
  const endpoint = normalizeConfiguredEndpoint(
    String(preferredEndpoint || state.endpoint || PREFERRED_XLIGHTS_ENDPOINT).trim()
  );
  if (!endpoint) {
    throw new Error("No xLights endpoint configured.");
  }
  const caps = await withTimeout(
    pingCapabilities(endpoint),
    ENDPOINT_PROBE_TIMEOUT_MS,
    `Endpoint probe ${endpoint}`
  );
  return { endpoint, caps };
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
  return {
    projectMetadataRoot: state.projectMetadataRoot,
    projectFilePath: state.projectFilePath,
    endpoint: state.endpoint,
    route: state.route,
    projectConcept: state.projectConcept,
    sequencePathInput: state.sequencePathInput,
    newSequencePathInput: state.newSequencePathInput,
    newSequenceType: state.newSequenceType,
    newSequenceDurationMs: state.newSequenceDurationMs,
    newSequenceFrameMs: state.newSequenceFrameMs,
    audioPathInput: state.audioPathInput,
    audioAnalysis: state.audioAnalysis,
    savePathInput: state.savePathInput,
    lastApplyBackupPath: state.lastApplyBackupPath,
    recentSequences: state.recentSequences,
    showDirectoryStats: state.showDirectoryStats,
    projectCreatedAt: state.projectCreatedAt,
    projectUpdatedAt: state.projectUpdatedAt,
    inspiration: state.inspiration,
    activeSequence: state.activeSequence,
    projectSequences: state.projectSequences,
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
  if (snapshot?.audioAnalysis && typeof snapshot.audioAnalysis === "object") {
    state.audioAnalysis = {
      summary: String(snapshot.audioAnalysis.summary || ""),
      lastAnalyzedAt: String(snapshot.audioAnalysis.lastAnalyzedAt || "")
    };
  } else {
    state.audioAnalysis = structuredClone(defaultState.audioAnalysis);
  }
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
  state.flags.hasDraftProposal = state.proposed.length > 0;
}

function saveCurrentProjectSnapshot() {
  const key = getProjectKey();
  if (!key || key === "::") return;
  const store = loadProjectsStore();
  store[key] = extractProjectSnapshot();
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

const routes = ["project", "sequence", "inspiration", "design", "history", "metadata"];

function setRoute(route) {
  if (!routes.includes(route)) return;
  state.route = route;
  persist();
  render();
  if (route === "sequence") {
    void onRefreshSequenceCatalog({ silent: true });
  }
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

function applyEnabled() {
  const f = state.flags;
  return (
    f.hasDraftProposal &&
    f.xlightsConnected &&
    f.xlightsCompatible &&
    !f.planOnlyMode &&
    !f.proposalStale &&
    !f.applyInProgress
  );
}

function applyDisabledReason() {
  const f = state.flags;
  const rolloutMode = getAgentApplyRolloutMode();
  if (!f.xlightsConnected) return "Connect to xLights to apply.";
  if (!f.xlightsCompatible) return "xLights version is below minimum supported floor (2026.1).";
  if (rolloutMode === "disabled") return "Agent apply is disabled by rollout policy.";
  if (rolloutMode === "plan-only") return "Agent rollout is in plan-only mode; apply is disabled.";
  if (f.planOnlyMode) return "Exit plan-only mode to apply.";
  if (f.proposalStale) return "Refresh proposal before apply.";
  if (!f.hasDraftProposal) return "Generate a proposal first.";
  if (!state.ui.applyApprovalChecked) return "Review the plan and check approval before apply.";
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
    hasExecutePlan: commands.includes("system.executePlan"),
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
  return state.proposed.filter((item) => selected.has(getSectionName(item)));
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

async function onApply(sourceLines = filteredProposed(), applyLabel = "proposal") {
  if (!applyEnabled()) {
    setStatusWithDiagnostics("warning", applyDisabledReason());
    return render();
  }
  const scopedSource = Array.isArray(sourceLines) ? sourceLines.filter(Boolean) : [];
  if (!scopedSource.length) {
    setStatusWithDiagnostics("warning", "No proposed changes available for this apply action.");
    return render();
  }
  if (!state.ui.applyApprovalChecked) {
    setStatusWithDiagnostics("warning", "Review the plan and check approval before apply.");
    return render();
  }
  const scopedImpactCount = scopedSource.length * 11;

  if (requiresApplyConfirmation()) {
    const message = `Apply ${scopedImpactCount} estimated impacted effects?`;
    if (!window.confirm(message)) {
      setStatus("info", "Apply canceled by user.");
      return render();
    }
  }

  state.flags.applyInProgress = true;
  state.ui.agentThinking = true;
  addChatMessage("agent", `Applying approved ${applyLabel} to xLights...`);
  setStatus("info", `Applying ${applyLabel} to xLights...`);
  render();
  let applyAuditEntry = null;

  try {
    const sequencePath = currentSequencePathForSidecar();
    const backupBridge = getDesktopBackupBridge();
    if (backupBridge && sequencePath) {
      const backup = await backupBridge.createSequenceBackup({ sequencePath });
      if (backup?.ok !== true) {
        setStatusWithDiagnostics(
          "action-required",
          `Apply blocked: failed to create pre-apply backup.`,
          backup?.error || "Unknown backup error"
        );
        return;
      }
      state.lastApplyBackupPath = String(backup.backupPath || "");
      setStatusWithDiagnostics("info", `Pre-apply backup created: ${backup.backupPath || "ok"}`);
    }

    const plan = buildDesignerPlanCommands(scopedSource);
    const orchestrated = await validateAndApplyPlan({
      endpoint: state.endpoint,
      commands: plan,
      expectedRevision: state.draftBaseRevision,
      getRevision,
      validateCommands,
      executePlan,
      safetyOptions: { maxCommands: 200 }
    });

    if (!orchestrated?.ok) {
      applyAuditEntry = {
        ts: new Date().toISOString(),
        type: "apply",
        status: "blocked",
        stage: orchestrated?.stage || "unknown",
        commandCount: plan.length,
        impactCount: scopedImpactCount,
        reason: orchestrated?.error || "Unknown orchestration error.",
        ...currentApplyContext()
      };
      setStatusWithDiagnostics(
        "action-required",
        `Apply blocked at ${orchestrated?.stage || "unknown"} stage.`,
        orchestrated?.error || "Unknown orchestration error."
      );
      return;
    }

    const executed = Number(orchestrated?.executedCount || 0);
    const jobId = orchestrated?.jobId || null;
    state.revision = orchestrated?.nextRevision || orchestrated?.currentRevision || state.revision;
    if (jobId) {
      upsertJob({
        id: jobId,
        source: "system.executePlan",
        status: "running",
        progress: 0,
        updatedAt: new Date().toISOString()
      });
      setStatusWithDiagnostics("info", `Plan accepted as async job ${jobId}.`);
    }
    state.draftBaseRevision = state.revision;
    state.flags.proposalStale = false;
    bumpVersion("Applied draft proposal", state.proposed.length * 11);
    setStatusWithDiagnostics(
      "info",
      `Applied via system.executePlan (${executed} steps).`
    );
    addChatMessage("agent", `Apply complete. Executed ${executed} step${executed === 1 ? "" : "s"}.`);
    applyAuditEntry = {
      ts: new Date().toISOString(),
      type: "apply",
      status: "success",
      commandCount: plan.length,
      impactCount: scopedImpactCount,
      executedCount: executed,
      jobId: jobId || "",
      revision: state.revision || "unknown",
      ...currentApplyContext()
    };
  } catch (err) {
    setStatusWithDiagnostics("action-required", `Apply blocked: ${err.message}`, err.stack || "");
    addChatMessage("agent", `Apply blocked: ${err.message}`);
    applyAuditEntry = {
      ts: new Date().toISOString(),
      type: "apply",
      status: "failed",
      stage: "exception",
      commandCount: Array.isArray(scopedSource) ? scopedSource.length : 0,
      impactCount: scopedImpactCount,
      reason: String(err?.message || "Unknown apply error"),
      ...currentApplyContext()
    };
  } finally {
    state.ui.applyApprovalChecked = false;
    if (applyAuditEntry) {
      pushApplyHistory(applyAuditEntry);
      await appendDesktopApplyLog(applyAuditEntry);
      await refreshApplyHistoryFromDesktop(40);
    }
    state.flags.applyInProgress = false;
    state.ui.agentThinking = false;
    saveCurrentProjectSnapshot();
    persist();
    render();
  }
}

function selectedProposedLinesForApply() {
  const selected = new Set(selectedProposedIndexesFromPicker());
  if (!selected.size) return [];
  const all = (state.proposed || [])
    .map((line, idx) => ({ line, idx }))
    .filter((row) => selected.has(row.idx));
  if (hasAllSectionsSelected()) return all.map((row) => row.line);
  const sectionSet = new Set(getSelectedSections());
  return all.filter((row) => sectionSet.has(getSectionName(row.line))).map((row) => row.line);
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
  await onApply(filteredProposed(), "all proposed changes");
}

function onGenerate() {
  if (!state.flags.activeSequenceLoaded && !state.flags.planOnlyMode) {
    setStatus("action-required", "Open a sequence or enter plan-only mode.");
    return render();
  }

  state.ui.agentThinking = true;
  addChatMessage("agent", "Working on updated proposal from current chat intent...");
  state.flags.hasDraftProposal = true;
  state.flags.proposalStale = false;
  state.draftBaseRevision = state.revision;
  invalidateApplyApproval();
  const usingAll = hasAllSectionsSelected();
  const selected = usingAll
    ? getSectionChoiceList()
    : getSelectedSections().filter((s) => s !== "all");
  const intentText = latestUserIntentText();
  const plan = buildProposalFromIntent({
    promptText: intentText,
    selectedSections: selected,
    creativeBrief: state.creative?.brief || null,
    selectedTagNames: state.ui.metadataSelectedTags || [],
    selectedTargetIds: state.ui.metadataSelectionIds || [],
    models: state.models || [],
    submodels: state.submodels || [],
    metadataAssignments: state.metadata?.assignments || []
  });
  const guidedQuestions = buildGuidedQuestions({
    normalizedIntent: plan.normalizedIntent,
    targets: plan.targets
  });
  state.proposed = mergeCreativeBriefIntoProposal(plan.proposalLines);
  state.ui.agentThinking = false;
  if (guidedQuestions.length) {
    addChatMessage("agent", `Before next pass, consider: ${guidedQuestions.join(" | ")}`);
  }
  addChatMessage(
    "agent",
    `Draft ready: ${state.proposed.length} proposed change${state.proposed.length === 1 ? "" : "s"} summarized from your intent.`
  );
  setStatus("info", `Proposal refreshed from current intent (${state.proposed.length} line${state.proposed.length === 1 ? "" : "s"}).`);
  saveCurrentProjectSnapshot();
  persist();
  render();
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
  saveCurrentProjectSnapshot();
  persist();
  render();
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

  try {
    const submodelBody = await getSubmodels(state.endpoint);
    state.submodels = Array.isArray(submodelBody?.data?.submodels) ? submodelBody.data.submodels : [];
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

  ensureMetadataTargetSelection();
}

async function onRefresh() {
  try {
    applyRolloutPolicy();
    let staleDetected = false;
    const releasedForce = releaseConnectivityPlanOnly();
    state.flags.xlightsConnected = true;
    const open = await getOpenSequence(state.endpoint);
    const seq = open?.data?.sequence;
    const seqAllowed = Boolean(open?.data?.isOpen && seq && isSequenceAllowedInActiveShowFolder(seq));
    state.flags.activeSequenceLoaded = seqAllowed;
    state.health.sequenceOpen = Boolean(open?.data?.isOpen);
    const prevPath = currentSequencePathForSidecar();
    if (seqAllowed) {
      clearIgnoredExternalSequenceNote();
      applyOpenSequenceState(seq);
      if (open?.data?.isOpen) {
        await syncAudioPathFromMediaStatus();
      }
      const nextPath = currentSequencePathForSidecar();
      if (nextPath && nextPath !== prevPath) {
        await hydrateSidecarForCurrentSequence();
      }
    } else if (open?.data?.isOpen && seq) {
      noteIgnoredExternalSequence(seq);
    }

    try {
      const rev = await getRevision(state.endpoint);
      const newRevision = rev?.data?.revision ?? "unknown";
      if (
        state.flags.hasDraftProposal &&
        state.draftBaseRevision !== "unknown" &&
        newRevision !== state.draftBaseRevision
      ) {
        state.flags.proposalStale = true;
        staleDetected = true;
        setStatusWithDiagnostics(
          "warning",
          "Sequence changed since draft creation. Refresh proposal before apply."
        );
      }
      state.revision = newRevision;
    } catch {
      state.revision = "unknown";
    }

    try {
      await refreshMetadataTargetsFromXLights();
    } catch (err) {
      setStatusWithDiagnostics("warning", `Model refresh failed: ${err.message}`);
    }

    try {
      await fetchSectionSuggestions();
    } catch (err) {
      setStatusWithDiagnostics("warning", `Section refresh failed: ${err.message}`);
    }
    await refreshApplyHistoryFromDesktop(40);

    if (!staleDetected) {
      setStatus("info", "Refreshed from xLights.");
    }
    if (releasedForce && !staleDetected) {
      setStatus("info", "xLights reachable again. Plan-only remains enabled until you turn it off.");
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
    onGenerate();
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
  state.draftBaseRevision = state.revision;
  state.flags.proposalStale = false;
  saveCurrentProjectSnapshot();
  setStatus(
    "info",
    `Draft rebased from ${previousBase} to ${state.draftBaseRevision}.`
  );
  persist();
  render();
}

async function onTestConnection() {
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
  if (!state.flags.xlightsConnected || state.flags.applyInProgress) return;
  try {
    const rev = await getRevision(state.endpoint);
    const newRevision = rev?.data?.revision ?? state.revision;
    if (newRevision !== state.revision) {
      state.revision = newRevision;
      if (
        state.flags.hasDraftProposal &&
        state.draftBaseRevision !== "unknown" &&
        newRevision !== state.draftBaseRevision &&
        !state.flags.proposalStale
      ) {
        state.flags.proposalStale = true;
        setStatusWithDiagnostics("warning", "Detected external sequence edits. Draft marked stale.");
      }
      persist();
      render();
    }
  } catch {
    // Ignore polling failures and rely on explicit refresh/test actions.
  }
}

async function pollJobs() {
  if (!state.flags.xlightsConnected) return;
  const active = (state.jobs || []).filter((j) =>
    !["done", "completed", "failed", "canceled", "cancelled"].includes((j.status || "").toLowerCase())
  );
  if (!active.length) return;

  let changed = false;
  for (const job of active) {
    try {
      const body = await getJob(state.endpoint, job.id);
      const data = body?.data || {};
      const next = {
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
      setStatusWithDiagnostics("warning", `jobs.get failed for ${job.id}: ${err.message}`);
    }
  }
  if (changed) {
    persist();
    render();
  }
}

async function pollCompatibilityStatus() {
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
      state.audioPathInput = "";
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

function onRegenerate() {
  onGenerate();
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
      rolloutMode: getAgentApplyRolloutMode(),
      applyApprovalChecked: Boolean(state.ui.applyApprovalChecked),
      draftBaseRevision: state.draftBaseRevision || "unknown",
      proposedCount: Array.isArray(state.proposed) ? state.proposed.length : 0,
      selectedProposedCount: Array.isArray(state.ui.proposedSelection) ? state.ui.proposedSelection.length : 0,
      previewCommandCount: Array.isArray(previewCommands) ? previewCommands.length : 0,
      previewError,
      lastApplyBackupPath: state.lastApplyBackupPath || "",
      sequencePath: currentSequencePathForSidecar() || selectedSequencePath() || ""
    },
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

function pushApplyHistory(entry) {
  state.applyHistory = [entry, ...(state.applyHistory || [])].slice(0, 80);
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
  state.flags.hasDraftProposal = false;
  state.flags.proposalStale = false;
  state.proposed = [];
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
  state.flags.hasDraftProposal = state.proposed.length > 0;
  state.flags.proposalStale = false;
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
  state.flags.hasDraftProposal = state.proposed.length > 0;
  state.flags.proposalStale = false;
  invalidateApplyApproval();
  state.draftBaseRevision = state.revision;
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
  state.chat = [...(state.chat || []), message].slice(-200);
}

function onUseQuickPrompt(promptText) {
  state.ui.chatDraft = promptText || "";
  persist();
  render();
}

function onSendChat() {
  const raw = (state.ui.chatDraft || "").trim();
  if (!raw) return;
  addChatMessage("user", raw);
  state.ui.chatDraft = "";
  if (state.flags.activeSequenceLoaded || state.flags.planOnlyMode) {
    onGenerate();
    return;
  }
  addChatMessage("agent", "Captured. Open a sequence to generate a proposal.");
  setStatus("warning", "Open a sequence first, then chat will auto-generate proposal updates.");
  saveCurrentProjectSnapshot();
  persist();
  render();
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

function applySequenceMediaToAudioPath(sequenceData) {
  if (!sequenceData || typeof sequenceData !== "object") return;
  const mediaFile = String(sequenceData.mediaFile || "").trim();
  state.audioPathInput = mediaFile || "";
}

async function syncAudioPathFromMediaStatus() {
  try {
    const mediaBody = await getMediaStatus(state.endpoint);
    const mediaFile = String(mediaBody?.data?.mediaFile || "").trim();
    state.audioPathInput = mediaFile || "";
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

  return synthesizeCreativeBrief({
    goals: state.creative.goals,
    inspiration: state.creative.inspiration,
    notes: state.creative.notes,
    references: state.creative.references || [],
    audioAnalysis,
    latestIntent: latestUserIntentText()
  });
}

function onRunCreativeAnalysis() {
  if (!state.flags.activeSequenceLoaded) {
    setStatus("warning", "Open a sequence before running Creative Analysis.");
    return render();
  }
  state.ui.agentThinking = true;
  addChatMessage("agent", "Running Creative Analysis from kickoff goals, audio context, lyrics context, and references...");
  state.creative.brief = buildCreativeBrief();
  state.creative.briefUpdatedAt = new Date().toISOString();
  state.flags.creativeBriefReady = true;
  state.ui.agentThinking = false;
  setStatus("info", "Creative brief generated. Review and accept to continue.");
  saveCurrentProjectSnapshot();
  persist();
  render();
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

function mergeCreativeBriefIntoProposal(lines) {
  const base = Array.isArray(lines) ? [...lines] : [];
  if (!state.flags.creativeBriefReady || !state.creative?.brief) return base;
  const brief = state.creative.brief;
  const additions = [];

  if (brief.goalsSummary) additions.push(`Anchor design changes to brief goal: ${brief.goalsSummary}`);
  if (brief.visualCues) additions.push(`Use visual direction cues: ${brief.visualCues}`);
  if (Array.isArray(brief.sections) && brief.sections.length) {
    additions.push(`Focus first pass on brief sections: ${brief.sections.slice(0, 3).join(", ")}`);
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

function parseSubmodelParentId(targetId) {
  const id = String(targetId || "");
  const slash = id.indexOf("/");
  if (slash <= 0) return "";
  return id.slice(0, slash);
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

function normalizeMetadataTagName(name) {
  return normalizeSectionLabel(name);
}

function normalizeMetadataTagDescription(description) {
  return String(description || "").trim();
}

function getMetadataTagRecords() {
  const raw = Array.isArray(state.metadata?.tags) ? state.metadata.tags : [];
  const byName = new Map();
  raw.forEach((entry) => {
    if (typeof entry === "string") {
      const name = normalizeMetadataTagName(entry);
      if (!name || byName.has(name)) return;
      byName.set(name, { name, description: "" });
      return;
    }
    if (!entry || typeof entry !== "object") return;
    const name = normalizeMetadataTagName(entry.name);
    if (!name || byName.has(name)) return;
    byName.set(name, { name, description: normalizeMetadataTagDescription(entry.description) });
  });
  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function setMetadataTagRecords(records) {
  state.metadata.tags = records.map((record) => ({
    name: String(record.name),
    description: String(record.description || "")
  }));
}

function updateMetadataTagDescription(tagName, description) {
  const name = normalizeMetadataTagName(tagName);
  if (!name) return;
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
  const selected = new Set(normalizeMetadataSelectedTags(state.ui.metadataSelectedTags));
  if (selected.has(name)) selected.delete(name);
  else selected.add(name);
  state.ui.metadataSelectedTags = normalizeMetadataSelectedTags(Array.from(selected));
  persist();
}

function clearMetadataSelectedTags() {
  state.ui.metadataSelectedTags = [];
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
  state.ui.metadataSelectionIds = normalizeMetadataSelectionIds(selectionIds);
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
  state.proposed = [];
  state.ui.proposedSelection = [];
  state.flags.hasDraftProposal = false;
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
  const uniqueDesc = Array.from(new Set(selected)).sort((a, b) => b - a);
  for (const idx of uniqueDesc) state.proposed.splice(idx, 1);
  state.flags.hasDraftProposal = state.proposed.length > 0;
  invalidateApplyApproval();
  setStatus("info", `Removed ${uniqueDesc.length} proposed line${uniqueDesc.length === 1 ? "" : "s"}.`);
  saveCurrentProjectSnapshot();
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
  const metadataRootInput = app.querySelector("#project-metadata-root-input");
  if (showFolderInput) state.showFolder = showFolderInput.value.trim() || state.showFolder;
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

async function saveProjectToCurrentFile(options = {}) {
  const saveAs = options?.saveAs === true;
  const bridge = getDesktopProjectBridge();
  if (!bridge) return { ok: false, code: "NO_BRIDGE", error: "Desktop project bridge unavailable." };

  let filePath = String(state.projectFilePath || "").trim();
  if (saveAs || !filePath) {
    const defaultName = `${(state.projectName || "project").trim() || "project"}.xdproj`;
    const dialogRes = await bridge.saveProjectDialog({
      rootPath: state.projectMetadataRoot,
      defaultName
    });
    if (!dialogRes?.ok || !dialogRes?.filePath) {
      return { ok: false, code: "CANCELED", error: "User canceled save dialog." };
    }
    filePath = String(dialogRes.filePath);
    state.projectFilePath = filePath;
    const dir = dirnameOfPath(filePath);
    if (dir) state.projectMetadataRoot = dir;
    const inferredName = projectNameFromPath(filePath);
    if (inferredName) state.projectName = inferredName;
  }

  const res = await bridge.writeProjectFile({
    filePath,
    projectName: state.projectName,
    showFolder: state.showFolder,
    snapshot: extractProjectSnapshot()
  });
  if (!res?.ok) return res || { ok: false, code: "WRITE_FAILED", error: "Project file write failed." };
  state.projectFilePath = filePath;
  state.projectCreatedAt = String(res?.project?.createdAt || state.projectCreatedAt || "");
  state.projectUpdatedAt = String(res?.project?.updatedAt || state.projectUpdatedAt || "");
  return { ok: true, filePath };
}

async function onSaveProjectSettings() {
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
  } else if (saved?.code === "CANCELED") {
    setStatus("info", "Save canceled.");
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
    state.audioPathInput = audioInput.value.trim() || "";
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

async function onBrowseProjectMetadataRoot() {
  const selected = await pickFilePathFromDesktop({
    title: "Choose Project Metadata Folder",
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
    title: "Choose Sequence Audio (optional)",
    filters: [
      { name: "Audio", extensions: ["mp3", "wav", "m4a", "ogg", "flac", "aac"] },
      { name: "All Files", extensions: ["*"] }
    ]
  });
  if (!selected) return;
  state.audioPathInput = selected;
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

  if (sequenceName) state.activeSequence = sequenceName;
  if (sequencePath) {
    state.sequencePathInput = sequencePath;
    state.savePathInput = sequencePath;
    state.ui.sequenceMode = "existing";
    addRecentSequence(sequencePath);
  }
  // Keep UI synced to the currently-open sequence in xLights.
  state.audioPathInput = mediaPath;
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
      : await openSequence(state.endpoint, targetPath, false, false);
    const seq = body?.data?.sequence || body?.data || {};
    applyOpenSequenceState(seq, targetPath);
    if (targetPath !== previousPath) {
      state.lastApplyBackupPath = "";
    }
    state.flags.activeSequenceLoaded = true;
    if (targetPath !== previousPath) {
      resetCreativeState();
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
    const body = await openSequence(state.endpoint, targetPath, false, false);
    const seq = body?.data?.sequence || body?.data || {};
    applyOpenSequenceState(seq, targetPath);
    if (targetPath !== previousPath) {
      state.lastApplyBackupPath = "";
      resetCreativeState();
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
    await closeActiveSequenceForSwitch();
    const isAnimation = state.newSequenceType === "animation";
    const mediaFile = isAnimation ? null : (state.audioPathInput || null);
    const durationMs = isAnimation || !mediaFile ? state.newSequenceDurationMs : undefined;
    const body = await createSequence(state.endpoint, {
      file: targetPath,
      mediaFile,
      durationMs,
      frameMs: state.newSequenceFrameMs
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
    await saveSequence(state.endpoint, targetPath || null);
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
    await saveSequence(state.endpoint, targetPath);
    state.sequencePathInput = targetPath;
    state.savePathInput = targetPath;
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
    const dir = dirnameOfPath(dialogRes.filePath);
    if (dir) {
      state.projectMetadataRoot = dir;
    }
    state.projectFilePath = String(dialogRes.filePath);
    state.projectName = String(fileRes.project?.projectName || state.projectName);
    state.showFolder = String(fileRes.project?.showFolder || state.showFolder);
    state.projectCreatedAt = String(fileRes.project?.createdAt || state.projectCreatedAt || "");
    state.projectUpdatedAt = String(fileRes.project?.updatedAt || state.projectUpdatedAt || "");
    applyProjectSnapshot(fileRes.snapshot);
    setStatus("info", `Opened project: ${state.projectName}`);
    persist();
    render();
    void onRefreshSequenceCatalog({ silent: true });
    return;
  }

  const { projectName, showFolder } = parseProjectKey(selectedKey);
  if (!projectName || !showFolder) {
    setStatus("warning", "Selected project key is invalid.");
    return render();
  }

  const rootPath = state.projectMetadataRoot || dirnameOfPath(state.projectFilePath);
  if (!rootPath) {
    setStatusWithDiagnostics("warning", "Open failed: project metadata folder is not set.");
    return render();
  }
  const guessedFilePath = `${rootPath}/${projectName}.xdproj`;
  const fileRes = await bridge.openProjectFile({ filePath: guessedFilePath });
  if (!fileRes?.ok || !fileRes?.snapshot) {
    setStatusWithDiagnostics("warning", `Open failed: ${fileRes?.error || "Invalid project file."}`);
    return render();
  }
  state.projectFilePath = guessedFilePath;
  state.projectName = String(fileRes.project?.projectName || projectName);
  state.showFolder = String(fileRes.project?.showFolder || showFolder);
  state.projectCreatedAt = String(fileRes.project?.createdAt || state.projectCreatedAt || "");
  state.projectUpdatedAt = String(fileRes.project?.updatedAt || state.projectUpdatedAt || "");
  applyProjectSnapshot(fileRes.snapshot);
  setStatus("info", `Opened project: ${state.projectName}`);
  persist();
  render();
  void onRefreshSequenceCatalog({ silent: true });
}

function onCreateNewProject() {
  syncProjectSummaryInputs();
  const bridge = getDesktopProjectBridge();
  const suggested = `${state.projectName || "Project"}-new.xdproj`;
  const openNew = async () => {
    if (!bridge) {
      setStatusWithDiagnostics("warning", "New project requires desktop runtime.");
      return render();
    }

    const dialogRes = await bridge.saveProjectDialog({
      rootPath: state.projectMetadataRoot,
      defaultName: suggested
    });
    if (!dialogRes?.ok || !dialogRes?.filePath) {
      setStatus("info", "New project canceled.");
      return render();
    }

    state.projectFilePath = String(dialogRes.filePath);
    const dir = dirnameOfPath(state.projectFilePath);
    if (dir) state.projectMetadataRoot = dir;
    const inferredName = projectNameFromPath(state.projectFilePath);
    if (inferredName) state.projectName = inferredName;

    resetSessionDraftState();
    resetCreativeState();
    state.flags.activeSequenceLoaded = false;
    state.activeSequence = "";
    state.sequencePathInput = "";
    state.newSequencePathInput = "";
    state.audioPathInput = "";
    state.savePathInput = "";
    state.recentSequences = [];
    state.projectSequences = [];
    state.projectCreatedAt = "";
    state.projectUpdatedAt = "";

    const saved = await saveProjectToCurrentFile({ saveAs: false });
    if (!saved?.ok) {
      setStatusWithDiagnostics("warning", `Created new project but initial save failed: ${saved?.error || "unknown error"}`);
    } else {
      setStatus("info", `Created new project: ${state.projectName}`);
    }
    saveCurrentProjectSnapshot();
    persist();
    render();
  };
  void openNew();
}

async function onSaveProjectAs() {
  syncProjectSummaryInputs();
  const saved = await saveProjectToCurrentFile({ saveAs: true });
  if (saved?.ok) {
    setStatus("info", `Saved project as: ${saved.filePath}`);
  } else if (saved?.code === "CANCELED") {
    setStatus("info", "Save As canceled.");
  } else {
    setStatusWithDiagnostics("action-required", `Save As failed: ${saved?.error || "unknown error"}`);
  }
  saveCurrentProjectSnapshot();
  persist();
  render();
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
  state.ui.sequenceMode = "existing";
  state.ui.sectionTrackName = "";
  state.ui.metadataTargetId = "";
  state.ui.metadataSelectionIds = [];
  state.ui.metadataSelectedTags = [];
  state.ui.metadataNewTag = "";
  state.ui.metadataNewTagDescription = "";
  state.ui.metadataFilterName = "";
  state.ui.metadataFilterType = "";
  state.ui.metadataFilterTags = "";
  state.ui.detailsOpen = false;
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

function resetSessionDraftState() {
  state.draftBaseRevision = state.revision;
  state.flags.hasDraftProposal = false;
  state.flags.proposalStale = false;
  state.ui.detailsOpen = false;
  state.ui.sectionSelections = ["all"];
  state.ui.designTab = "chat";
  state.ui.sectionTrackName = "";
  state.ui.applyApprovalChecked = false;
  state.proposed = [];
}

function resetCreativeState() {
  revokeReferencePreviewUrls();
  state.creative = structuredClone(defaultState.creative);
  state.audioAnalysis = structuredClone(defaultState.audioAnalysis);
  state.flags.creativeBriefReady = false;
}

function buildAudioAnalysisStubSummary() {
  const analysis = analyzeAudioContext({
    audioPath: state.audioPathInput,
    sectionSuggestions: state.sectionSuggestions,
    timingTracks: state.timingTracks
  });
  return (analysis.summaryLines || []).join("\n");
}

function onAnalyzeAudio() {
  const audioPath = String(state.audioPathInput || "").trim();
  if (!audioPath) {
    setStatus("warning", "No audio track available for analysis on this sequence.");
    return render();
  }
  state.audioAnalysis.summary = buildAudioAnalysisStubSummary();
  state.audioAnalysis.lastAnalyzedAt = new Date().toISOString();
  setStatus("info", "Audio analysis summary generated.");
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

function navButton(id, label) {
  const icons = {
    project: "P",
    sequence: "S",
    inspiration: "I",
    design: "D",
    history: "H",
    metadata: "M"
  };
  const icon = icons[id] || "•";
  return `<button class="${state.route === id ? "active" : ""}" data-route="${id}" title="${label}"><span class="nav-icon">${icon}</span><span class="nav-label">${label}</span></button>`;
}

function projectScreen() {
  const createdAt = state.projectCreatedAt
    ? new Date(state.projectCreatedAt).toLocaleString([], { hour12: false })
    : "(not set)";
  const updatedAt = state.projectUpdatedAt
    ? new Date(state.projectUpdatedAt).toLocaleString([], { hour12: false })
    : "(not set)";
  return `
    <div class="screen-grid">
      <section class="card">
        <h3>Project Summary</h3>
        <div class="banner">Current Project: <strong>${state.projectName}</strong></div>
        <div class="field">
          <label>Creative Direction (Project Level)</label>
          <textarea id="project-concept-input" rows="3" placeholder="High-level show concept and tone...">${String(state.projectConcept || "")}</textarea>
          <p class="banner">Project-level concept only. Sequence-specific inspiration lives in the Inspiration tab.</p>
        </div>
        <div class="field">
          <label>Project Metadata Folder</label>
          <div class="row">
            <input id="project-metadata-root-input" value="${state.projectMetadataRoot || ""}" placeholder="Default: app data folder" />
          </div>
        </div>
        <div class="row">
          <button id="new-project">New</button>
          <button id="open-selected-project">Open</button>
          <button id="save-project">Save</button>
          <button id="save-project-as">Save As</button>
        </div>
        <div style="height: 10px;"></div>
        <div class="field">
          <label>Show Directory</label>
          <div class="row">
            <input id="showfolder-input" value="${state.showFolder}" />
            <button id="browse-showfolder">Browse...</button>
          </div>
        </div>
        <p class="banner">Show Directory inventory: ${state.showDirectoryStats?.xsqCount || 0} .xsq | ${state.showDirectoryStats?.xdmetaCount || 0} .xdmeta</p>
        <p class="banner">Project created: ${createdAt}</p>
        <p class="banner">Project updated: ${updatedAt}</p>
        <div class="row">
          <button id="reset-project">Reset Project Workspace</button>
        </div>
      </section>
    </div>
  `;
}

function sequenceScreen() {
  const audioTrackPath = String(state.audioPathInput || "").trim();
  const audioTrackName = basenameOfPath(audioTrackPath) || audioTrackPath;
  const hasAudioTrack = Boolean(audioTrackPath);
  const audioSummary = String(state.audioAnalysis?.summary || "");
  const audioAnalyzedAt = state.audioAnalysis?.lastAnalyzedAt
    ? new Date(state.audioAnalysis.lastAnalyzedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";
  const creativeBriefText = String(state.creative?.briefText || "");
  const creativeBriefTextEscaped = creativeBriefText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const catalog = Array.isArray(state.sequenceCatalog) ? state.sequenceCatalog : [];
  const catalogHasCurrent = catalog.some((s) => String(s?.path || "") === state.sequencePathInput);
  const catalogOptions = [
    ...catalog,
    ...(!catalogHasCurrent && state.sequencePathInput
      ? [{ path: state.sequencePathInput, relativePath: state.sequencePathInput, name: state.sequencePathInput.split("/").pop() || "Current" }]
      : [])
  ];
  const briefAt = state.creative.briefUpdatedAt
    ? new Date(state.creative.briefUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";
  return `
    <div class="screen-grid">
      <section class="card">
        <h3>Sequence Setup</h3>
        <div class="field">
          <label>Sequence (from Show Directory)</label>
          <select id="sequence-catalog-select">
            ${
              catalogOptions.length
                ? catalogOptions
                    .map((s) => {
                      const path = String(s?.path || "");
                      const rel = String(s?.relativePath || path);
                      const name = String(s?.name || path.split("/").pop() || rel);
                      return `<option value="${path.replace(/\"/g, "&quot;")}" ${path === state.sequencePathInput ? "selected" : ""}>${name} - ${rel}</option>`;
                    })
                    .join("")
                : `<option value="">No sequences found under Show Directory</option>`
            }
          </select>
          <p class="banner">Show Directory: ${state.showFolder || "(not set)"}</p>
        </div>
        <div class="row project-actions">
          <button id="open-sequence">Open</button>
        </div>
        <p class="banner">Active: ${state.activeSequence || "(none)"}</p>
      </section>

      ${
        hasAudioTrack
          ? `
      <section class="card">
        <h3>Audio Analysis ${audioAnalyzedAt ? `<span class="banner">(${audioAnalyzedAt})</span>` : ""}</h3>
        <div class="field">
          <label>Audio Track (from open sequence)</label>
          <input value="${audioTrackName.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}" readonly />
          <p class="banner">${audioTrackPath.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
        </div>
        <div class="row">
          <button id="analyze-audio">Analyze Audio</button>
        </div>
        <div class="field">
          <label>Analysis Summary</label>
          <textarea id="audio-analysis-summary" rows="5" placeholder="Agent audio analysis summary will appear here...">${audioSummary.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</textarea>
        </div>
      </section>
      `
          : ""
      }

      <section class="card">
        <h3>Creative Brief ${briefAt ? `<span class="banner">(${briefAt})</span>` : ""}</h3>
        <div class="field">
          <label>Direction, goals, theme, mood, and other brief notes</label>
          <textarea id="creative-brief-text" rows="10" placeholder="Write or let the agent build the creative brief for this sequence...">${creativeBriefTextEscaped}</textarea>
        </div>
      </section>
    </div>
  `;
}

function inspirationScreen() {
  const refs = Array.isArray(state.creative.references) ? state.creative.references : [];
  const swatches = Array.isArray(state.inspiration?.paletteSwatches) ? state.inspiration.paletteSwatches : [];
  return `
    <div class="screen-grid">
      <section class="card">
        <h3>Reference Media</h3>
        <div class="field">
          <label>Upload images/video for inspiration</label>
          <input id="reference-upload-input" type="file" multiple accept="image/*,video/*" />
        </div>
        <p class="banner">Allowed reference formats: ${referenceFormatSummaryText()}</p>
        <p class="banner">Sequence-eligible formats: ${sequenceEligibilityFormatSummaryText()}</p>
        <p class="banner">Max file size: ${formatBytes(REFERENCE_MEDIA_MAX_FILE_BYTES)} | Max references: ${REFERENCE_MEDIA_MAX_ITEMS}</p>
        <div class="row">
          <button id="add-reference-media" ${refs.length >= REFERENCE_MEDIA_MAX_ITEMS ? "disabled" : ""}>Add Selected References</button>
          <button id="refresh-recents">Refresh Recents</button>
        </div>
        <div class="media-grid">
          ${
            refs.length
              ? refs.map((ref) => {
                  const preview = String(ref.previewUrl || "").replace(/\"/g, "&quot;");
                  const name = String(ref.name || "reference");
                  const safeName = name.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                  const mime = String(ref.mimeType || "").toLowerCase();
                  const ext = (name.split(".").pop() || "file").slice(0, 8).toUpperCase();
                  const media =
                    preview && mime.startsWith("image/")
                      ? `<img src="${preview}" alt="${safeName}" loading="lazy" />`
                      : preview && mime.startsWith("video/")
                        ? `<video src="${preview}" muted loop playsinline preload="metadata"></video>`
                        : `<div class="media-fallback">${ext}</div>`;
                  return `
                    <article class="media-tile">
                      <div class="media-thumb">${media}</div>
                      <div class="media-meta">${safeName}</div>
                    </article>
                  `;
                }).join("")
              : `<article class="media-tile media-empty"><div class="media-meta">No media uploaded yet.</div></article>`
          }
        </div>
        <ul class="list">
          ${
            refs.length
              ? refs.map((ref) => `
                    <li>
                      <strong>${ref.name}</strong> (${ref.mimeType || "unknown"}) - ${ref.storedPath}
                      <div class="row">
                        <button data-ref-preview="${ref.id}">Preview</button>
                        <button data-ref-toggle-eligible="${ref.id}">${ref.sequenceEligible ? "Mark Inspiration-Only" : "Mark Sequence-Eligible"}</button>
                        <button data-ref-remove="${ref.id}">Remove</button>
                      </div>
                      <div class="banner ${ref.supportedForSequence ? "impact" : "warning"}">
                        ${ref.sequenceEligible ? "Sequence-eligible" : "Inspiration-only"} |
                        ${ref.supportedForSequence ? "Format passes current xLights media checks" : "Format not in current xLights media support set"}
                      </div>
                    </li>
                  `).join("")
              : "<li>No reference media yet.</li>"
          }
        </ul>
      </section>

      <section class="card">
        <h3>Color Palette</h3>
        <div class="row">
          <input id="palette-color-input" type="color" value="${swatches[0] || "#0b3d91"}" />
          <button id="add-palette-swatch">Add Color</button>
        </div>
        <ul class="list">
          ${
            swatches.length
              ? swatches.map((hex, idx) => `
                  <li>
                    <span style="display:inline-block;width:14px;height:14px;border-radius:2px;background:${hex};border:1px solid #444;vertical-align:middle;margin-right:8px;"></span>
                    <code>${hex}</code>
                    <button data-palette-remove="${idx}">Remove</button>
                  </li>
                `).join("")
              : "<li>No palette colors yet.</li>"
          }
        </ul>
        <p class="banner">Initial placeholder. We will expand this tab later.</p>
      </section>
    </div>
  `;
}

function persistentCoachPanel() {
  return `
    <aside class="coach-panel card">
      <h3>Designer</h3>
      <div class="panel-window chat-window">
        <div class="chat-thread">
          ${(state.chat || [])
            .map((c) => {
              const role = c.who === "user" ? "user" : c.who === "agent" ? "agent" : "system";
              return `<article class="chat-msg ${role}">
                <header>${role === "user" ? "You" : role === "agent" ? "Designer Agent" : "System"}</header>
                <div>${String(c.text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
              </article>`;
            })
            .join("")}
          ${state.ui.agentThinking ? `<div class="chat-typing">Designer Agent is working...</div>` : ""}
        </div>
      </div>
      <div class="quick-prompts panel-footer-block">
        ${CHAT_QUICK_PROMPTS.map((p, idx) => `
          <article class="quick-suggestion">
            <div class="quick-suggestion-text">${renderInlineChipSentence(p)}</div>
            <button data-quick-prompt="${idx}">Use</button>
          </article>
        `).join("")}
      </div>
    </aside>
  `;
}

function globalChatBar() {
  return `
    <div class="global-chat-bar">
      <div class="composer">
        <input id="chat-input" placeholder="Tell the agent what to change or ask for guidance..." value="${(state.ui.chatDraft || "").replace(/\"/g, "&quot;")}" />
        <button id="send-chat">Send</button>
      </div>
    </div>
  `;
}

function designScreen() {
  const selectedSections = getSelectedSections();
  const allSelected = hasAllSectionsSelected();
  const disabledReason = applyDisabledReason();
  const applyReady = applyEnabled();
  sanitizeProposedSelection();
  const filtered = state.proposed
    .map((line, idx) => ({ line, idx }))
    .filter((x) => (allSelected ? true : selectedSections.includes(getSectionName(x.line))));
  const list = filtered;
  const allVisibleLines = list.map((item) => item.line);
  const selectedLines = selectedProposedLinesForApply();
  const previewLines = selectedLines.length ? selectedLines : allVisibleLines;
  let previewCommands = [];
  let previewError = "";
  if (previewLines.length) {
    try {
      previewCommands = buildDesignerPlanCommands(previewLines);
    } catch (err) {
      previewError = String(err?.message || "Unable to build command preview.");
    }
  }
  const selectedCount = (state.ui.proposedSelection || []).filter((idx) => list.some((item) => item.idx === idx)).length;
  const approvalChecked = Boolean(state.ui.applyApprovalChecked);
  const canApplySelected = selectedCount > 0 && !state.flags.applyInProgress && applyReady && approvalChecked;
  const canApplyAll = list.length > 0 && !state.flags.applyInProgress && applyReady && approvalChecked;
  const impact = summarizeImpactForLines(previewLines);
  const planSummary = previewCommands.length
    ? `${previewCommands.length} command${previewCommands.length === 1 ? "" : "s"} ready for execution`
    : previewError || "No command preview available.";
  const payloadPreview = escapeHtml(getProposedPayloadPreviewText());
  return `
    ${
      state.flags.proposalStale
        ? `
      <section class="card stale-card">
        <h3>Draft Is Stale</h3>
        <p class="banner warning">Sequence changed since this draft was created. Refresh/rebase before apply.</p>
        <div class="row">
          <button id="stale-rebase">Rebase Draft</button>
          <button id="stale-refresh-regenerate">Refresh + Regenerate</button>
          <button id="stale-refresh-only">Refresh Only</button>
          <button id="stale-cancel-draft">Cancel Draft</button>
        </div>
      </section>
    `
        : ""
    }

    <div class="screen-grid design-workspace design-workspace-fill">
      <section class="card design-column full-span">
        <h3>Proposed Changes</h3>
        <div class="field panel-window proposed-window"><label>Proposed Next Write</label>
          <div class="metadata-grid-wrap proposed-grid-wrap">
            <table class="metadata-grid proposed-grid">
              <thead>
                <tr>
                  <th style="width:48px;">Pick</th>
                  <th>Change</th>
                  <th style="width:84px;">Action</th>
                </tr>
              </thead>
              <tbody>
                ${
                  list.length
                    ? list
                        .map(({ line, idx }) => {
                          const selected = (state.ui.proposedSelection || []).includes(idx);
                          return `
                    <tr class="${selected ? "proposed-row-selected" : ""}">
                      <td>
                        <input type="checkbox" data-proposed-select="${idx}" ${selected ? "checked" : ""} />
                      </td>
                      <td data-proposed-focus="${idx}">${renderProposedLineHtml(line)}</td>
                      <td><button data-proposed-delete="${idx}">Delete</button></td>
                    </tr>
                  `;
                        })
                        .join("")
                    : `<tr><td colspan="3" class="banner">No proposed changes yet. Ask the designer in chat.</td></tr>`
                }
              </tbody>
            </table>
          </div>
        </div>
        <details class="panel-footer-block proposed-payload-footer" ${state.ui.proposedPayloadOpen ? "open" : ""}>
          <summary id="toggle-proposed-payload">Selected Change Payload Preview</summary>
          <p class="banner">${escapeHtml(planSummary)}</p>
          <p class="banner">Scope: ${selectedLines.length ? `${selectedLines.length} selected` : `${allVisibleLines.length} visible`} change${(selectedLines.length || allVisibleLines.length) === 1 ? "" : "s"}</p>
          <p class="banner">Affected targets: ${impact.targetCount}${impact.targets.length ? ` (${escapeHtml(impact.targets.join(", "))})` : ""}</p>
          <p class="banner">Affected windows: ${impact.sectionWindows.length ? escapeHtml(impact.sectionWindows.join(" | ")) : "No section timing context yet."}</p>
          <div class="row">
            <label style="display:flex;align-items:center;gap:8px;">
              <input id="apply-approval-checkbox" type="checkbox" ${approvalChecked ? "checked" : ""} />
              I reviewed the plan and approve apply.
            </label>
            <button id="restore-last-backup" ${state.lastApplyBackupPath ? "" : "disabled"}>Restore Last Backup</button>
          </div>
          <pre class="proposed-payload">${payloadPreview}</pre>
        </details>
        <div class="row panel-footer-block proposed-actions">
            <button id="remove-selected-proposed" ${selectedCount ? "" : "disabled"}>Delete Selected</button>
            <button id="remove-all-proposed" ${list.length ? "" : "disabled"}>Delete All</button>
            <button id="apply-selected" class="proposed-apply-btn proposed-apply-start" ${canApplySelected ? "" : "disabled"}>Apply Selected</button>
            <button id="apply-all" class="proposed-apply-btn" ${canApplyAll ? "" : "disabled"}>Apply All</button>
        </div>
      </section>
    </div>

    <div class="mobile-apply-bar">
      <button id="mobile-apply-all" ${canApplyAll ? "" : "disabled"}>Apply All</button>
      <span class="banner ${applyReady ? "" : "warning"}">${applyReady ? (approvalChecked ? "Ready" : "Awaiting approval") : disabledReason}</span>
    </div>
  `;
}

function detailsDrawer() {
  if (!state.ui.detailsOpen) return "";
  const sections = getSections();
  const selectedSections = getSelectedSections();
  const allSelected = hasAllSectionsSelected();
  const filtered = state.proposed
    .map((line, idx) => ({ line, idx }))
    .filter((x) => (allSelected ? true : selectedSections.includes(getSectionName(x.line))));
  const list = filtered.map((x) => x.line);
  return `
    <section class="card details-drawer">
      <h3>Proposal Detail</h3>
      <div class="banner impact">Approx effects impacted: ${list.length * 11}</div>
      <div class="banner">Revision base: ${state.draftBaseRevision}</div>
      <div class="row" style="margin-top:8px;">
        <button data-section="all" class="${allSelected ? "active-chip" : ""}">All Sections</button>
        ${sections
          .map(
            (s) =>
              `<button data-section="${s}" class="${selectedSections.includes(s) ? "active-chip" : ""}">${s}</button>`
          )
          .join("")}
      </div>
      <ol class="list" style="margin-top:10px;">
        ${list
          .map((p, idx) => {
            const actualIdx = filtered[idx].idx;
            return `<li>
              <input data-proposed-input="${actualIdx}" value="${p.replace(/\"/g, "&quot;")}" />
              <button data-proposed-remove="${actualIdx}">Remove</button>
            </li>`;
          })
          .join("")}
      </ol>
      <div class="row" style="margin-top:10px;">
        <button id="drawer-apply" ${applyEnabled() ? "" : "disabled"}>Apply</button>
        <button id="split-section">Split by Section</button>
        <button id="discard-draft">Discard Draft</button>
        <button id="close-details">Back to Design</button>
      </div>
      <div class="banner ${applyEnabled() ? "" : "warning"}">${applyEnabled() ? "" : applyDisabledReason()}</div>
    </section>
  `;
}

function settingsDrawer() {
  if (!state.ui.settingsOpen) return "";
  const rolloutMode = getAgentApplyRolloutMode();
  const planOnlyToggleForced = state.flags.planOnlyForcedByConnectivity || state.flags.planOnlyForcedByRollout;
  const planOnlyToggleTitle = state.flags.planOnlyForcedByConnectivity
    ? "Forced while xLights is unavailable"
    : state.flags.planOnlyForcedByRollout
      ? "Forced by rollout policy"
      : "";
  return `
    <section class="settings-overlay" id="settings-overlay">
      <section class="card settings-drawer">
        <div class="row" style="justify-content:space-between; align-items:center;">
          <h3>Settings</h3>
          <button id="close-settings" aria-label="Close settings">Close</button>
        </div>
        <section class="field" style="margin-top:8px;">
          <label>xLights Endpoint</label>
          <input id="endpoint-input" value="${state.endpoint}" />
          <p class="banner">Endpoint is explicit and fail-fast. No automatic fallback endpoints are used.</p>
        </section>
        <section class="field">
          <label>Apply Confirmation Mode</label>
          <select id="confirm-mode-input">
            <option value="large-only" ${state.safety.applyConfirmMode === "large-only" ? "selected" : ""}>Large changes only</option>
            <option value="always" ${state.safety.applyConfirmMode === "always" ? "selected" : ""}>Always confirm</option>
            <option value="never" ${state.safety.applyConfirmMode === "never" ? "selected" : ""}>Never confirm</option>
          </select>
        </section>
        <section class="field">
          <label>Large Change Threshold (approx effects impacted)</label>
          <input id="threshold-input" type="number" min="1" value="${state.safety.largeChangeThreshold}" />
        </section>
        <section class="field">
          <label>Sequence Switch (when unsaved changes exist)</label>
          <select id="sequence-switch-policy-input">
            <option value="save-if-needed" ${state.safety.sequenceSwitchUnsavedPolicy !== "discard-unsaved" ? "selected" : ""}>Save then switch</option>
            <option value="discard-unsaved" ${state.safety.sequenceSwitchUnsavedPolicy === "discard-unsaved" ? "selected" : ""}>Discard and switch</option>
          </select>
        </section>
        <section class="field">
          <label>Agent Apply Rollout Mode</label>
          <select id="agent-apply-rollout-input">
            <option value="full" ${rolloutMode === "full" ? "selected" : ""}>Full (plan + apply)</option>
            <option value="plan-only" ${rolloutMode === "plan-only" ? "selected" : ""}>Plan Only</option>
            <option value="disabled" ${rolloutMode === "disabled" ? "selected" : ""}>Disabled</option>
          </select>
        </section>
        <div class="row">
          <button id="test-connection">Test Connection</button>
          <button id="check-health">Recheck Health</button>
          <button id="plan-toggle" ${planOnlyToggleForced ? `disabled title="${planOnlyToggleTitle}"` : ""}>${state.flags.planOnlyMode ? "Exit Plan Only" : "Plan Only"}</button>
        </div>
        <hr />
        <h3>Application Health</h3>
        <div class="kv"><div class="k">Last Check</div><div>${state.health.lastCheckedAt ? new Date(state.health.lastCheckedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "Never"}</div></div>
        <div class="kv"><div class="k">Runtime Ready</div><div>${state.health.runtimeReady ? "yes" : "no"}</div></div>
        <div class="kv"><div class="k">File Dialog Bridge</div><div>${state.health.desktopFileDialogReady ? "yes" : "no"}</div></div>
        <div class="kv"><div class="k">Desktop Bridge APIs</div><div>${state.health.desktopBridgeApiCount}</div></div>
        <div class="kv"><div class="k">xLights Version</div><div>${state.health.xlightsVersion || "not reported"}</div></div>
        <div class="kv"><div class="k">Compatibility</div><div>${state.health.compatibilityStatus}</div></div>
        <div class="kv"><div class="k">Capabilities</div><div>${state.health.capabilitiesCount}</div></div>
        <div class="kv"><div class="k">system.executePlan</div><div>${state.health.hasExecutePlan ? "yes" : "no"}</div></div>
        <div class="kv"><div class="k">system.validateCommands</div><div>${state.health.hasValidateCommands ? "yes" : "no"}</div></div>
        <div class="kv"><div class="k">jobs.get</div><div>${state.health.hasJobsGet ? "yes" : "no"}</div></div>
        <div class="kv"><div class="k">Sequence Open</div><div>${state.health.sequenceOpen ? "yes" : "no"}</div></div>
      </section>
    </section>
  `;
}

function historyScreen() {
  ensureVersionSnapshots();
  const selected = state.versions.find((v) => v.id === state.selectedVersion) || state.versions[0];
  const currentHead = state.versions[0] || null;
  const compare = state.compareVersion ? versionById(state.compareVersion) : null;
  const selectedProposal = selected?.proposal || [];
  const compareProposal = compare?.proposal || [];
  const added = compare ? compareProposal.filter((p) => !currentHead.proposal.includes(p)) : [];
  const removed = compare ? currentHead.proposal.filter((p) => !compareProposal.includes(p)) : [];
  return `
    <div class="screen-grid">
      <section class="card">
        <h3>Version Timeline</h3>
        <ul class="list">
          ${state.versions
            .map(
              (v) => `<li><button data-version="${v.id}">${v.id}</button> ${v.summary} | approx ${v.effects} effects | ${v.time}</li>`
            )
            .join("")}
        </ul>
      </section>
      <section class="card">
        <h3>Selected Version</h3>
        <p><strong>${selected.id}</strong> ${selected.summary}</p>
        <p class="banner">Scope: chorus-focused | Models: CandyCanes, Roofline | Labels: XD:Mood</p>
        <div class="row">
          <button id="rollback">Rollback to This Version</button>
          <button id="compare">Compare</button>
          <button id="variant">Reapply as Variant</button>
        </div>
      </section>
    </div>
    ${
      compare
        ? `
      <section class="card" style="margin-top:12px;">
        <h3>Compare ${compare.id} vs ${currentHead.id}</h3>
        <div class="screen-grid">
          <div>
            <h4>Added In ${compare.id}</h4>
            <ul class="list">${added.length ? added.map((p) => `<li>${p}</li>`).join("") : "<li>None</li>"}</ul>
          </div>
          <div>
            <h4>Missing From ${compare.id}</h4>
            <ul class="list">${removed.length ? removed.map((p) => `<li>${p}</li>`).join("") : "<li>None</li>"}</ul>
          </div>
        </div>
      </section>
    `
        : ""
    }
  `;
}

function metadataScreen() {
  const hasLoadedSubmodels = (state.submodels || []).length > 0;
  const submodelsAvailable = hasLoadedSubmodels;
  const metadataTargets = buildMetadataTargets({ includeSubmodels: submodelsAvailable });
  const modelOptions = metadataTargets
    .map((target) => ({ id: target.id, name: target.displayName, raw: target }))
    .filter((target) => target.id);
  const assignments = state.metadata?.assignments || [];
  const orphans = getMetadataOrphans();
  const tags = getMetadataTagRecords();
  const assignmentByTargetId = new Map(assignments.map((a) => [String(a.targetId), a]));
  const nameFilter = String(state.ui.metadataFilterName || "");
  const typeFilter = String(state.ui.metadataFilterType || "");
  const tagsFilter = String(state.ui.metadataFilterTags || "");
  const submodelBanner = state.health?.submodelDiscoveryError
    ? `Submodels unavailable: ${state.health.submodelDiscoveryError}`
    : "No submodels found in current show data.";
  const filteredModels = modelOptions.filter((m) => {
    const rowName = (m?.raw?.displayName || "").toLowerCase();
    const rowType = (m?.raw?.type || "").toLowerCase();
    const assignment = assignmentByTargetId.get(String(m.id));
    const rowTags = Array.isArray(assignment?.tags) ? assignment.tags.join(", ").toLowerCase() : "";
    if (!matchesMetadataFilterValue(rowName, nameFilter)) return false;
    if (!matchesMetadataFilterValue(rowType, typeFilter)) return false;
    if (!matchesMetadataFilterValue(rowTags, tagsFilter)) return false;
    return true;
  });
  const submodelCount = modelOptions.filter((target) => target.raw.type === "submodel").length;
  const selectedIds = new Set(normalizeMetadataSelectionIds(state.ui.metadataSelectionIds));
  const selectedCount = selectedIds.size;
  const selectedEditorTags = normalizeMetadataSelectedTags(state.ui.metadataSelectedTags);
  return `
    <div class="screen-grid metadata-workspace">
      <section class="card metadata-panel">
        <h3>Tag Manager</h3>
        <div class="field" style="margin-top:10px;">
          <label>Operation Tags</label>
          <div class="metadata-grid-wrap metadata-tag-grid-wrap">
            <table class="metadata-grid metadata-tag-grid">
              <thead>
                <tr>
                  <th style="width:42px;">Use</th>
                  <th style="width:220px;">Tag</th>
                  <th>Description</th>
                  <th style="width:70px;"></th>
                </tr>
              </thead>
              <tbody>
                <tr class="new-tag-row">
                  <td></td>
                  <td><input id="metadata-new-tag" value="${(state.ui.metadataNewTag || "").replace(/"/g, "&quot;")}" placeholder="new tag" /></td>
                  <td><input id="metadata-new-tag-description" value="${(state.ui.metadataNewTagDescription || "").replace(/"/g, "&quot;")}" placeholder="description (optional)" /></td>
                  <td><button id="metadata-add-tag">Add</button></td>
                </tr>
                ${
                  tags.length
                    ? tags
                        .map((tag) => {
                          const safeTag = String(tag.name).replace(/\"/g, "&quot;");
                          const checked = selectedEditorTags.includes(String(tag.name)) ? "checked" : "";
                          return `<tr>
                            <td><input type="checkbox" data-metadata-tag-toggle="${safeTag}" ${checked} /></td>
                            <td>${String(tag.name).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>
                            <td><input data-metadata-tag-description="${safeTag}" value="${String(tag.description || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")}" placeholder="description" /></td>
                            <td><button data-remove-tag="${safeTag}">Delete</button></td>
                          </tr>`;
                        })
                        .join("")
                    : `<tr><td colspan="4">No tags yet.</td></tr>`
                }
              </tbody>
            </table>
          </div>
        </div>
        <div class="row">
          <button id="metadata-apply-selected-tags">Apply Tags To Selected</button>
          <button id="metadata-remove-selected-tags">Remove Tags From Selected</button>
          <button id="metadata-clear-tags">Clear Tag Picks</button>
          <span class="banner">Selected: ${selectedCount}</span>
        </div>
        <hr />
        <h3>Element Metadata Grid</h3>
        <div class="row">
          <button id="refresh-models">Refresh Models</button>
          <button id="metadata-select-visible">Select Visible</button>
          <button id="metadata-clear-selection">Clear Selection</button>
          <span class="banner">Targets: ${modelOptions.length} total (${submodelCount} submodels)</span>
        </div>
        ${submodelsAvailable ? "" : `<p class="banner">${submodelBanner.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`}
        <div class="metadata-grid-wrap metadata-targets-wrap">
          <table class="metadata-grid metadata-target-grid">
            <thead>
              <tr>
                <th style="width:36px;">Sel</th>
                <th>Name</th>
                <th>Type</th>
                <th>Tags</th>
              </tr>
              <tr class="metadata-filter-row">
                <th></th>
                <th><input id="metadata-filter-name" value="${(state.ui.metadataFilterName || "").replace(/"/g, "&quot;")}" placeholder="name (comma-separated)..." /></th>
                <th><input id="metadata-filter-type" value="${(state.ui.metadataFilterType || "").replace(/"/g, "&quot;")}" placeholder="type (comma-separated)..." /></th>
                <th><input id="metadata-filter-tags" value="${(state.ui.metadataFilterTags || "").replace(/"/g, "&quot;")}" placeholder="tags (comma-separated)..." /></th>
              </tr>
            </thead>
            <tbody>
              ${
                filteredModels.length
                  ? filteredModels
                      .slice(0, 200)
                      .map((m) => {
                        const type = String(m?.raw?.type || "");
                        const a = assignmentByTargetId.get(String(m.id));
                        const tagList = Array.isArray(a?.tags) && a.tags.length ? a.tags.join(", ") : "-";
                        const selected = selectedIds.has(String(m.id)) ? "checked" : "";
                        return `<tr>
                          <td><input type="checkbox" data-metadata-select="${String(m.id).replace(/\"/g, "&quot;")}" ${selected} /></td>
                          <td>${(m.raw?.displayName || "(unnamed)").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>
                          <td>${type.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") || "-"}</td>
                          <td>${tagList.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>
                        </tr>`;
                      })
                      .join("")
                  : `<tr><td colspan="4">No targets found.</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </section>
    </div>
    <section class="card" style="margin-top:12px;">
      <h3>Orphaned Metadata</h3>
      ${
        orphans.length
          ? `<p class="warning">${orphans.length} entr${orphans.length === 1 ? "y" : "ies"} need mapping to current model identities.</p>`
          : `<p class="banner">No active orphans.</p>`
      }
      <ul class="list">
        ${
          orphans.length
            ? orphans
                .map(
                  (o) => `
              <li>
                <strong>${o.targetName || o.targetId}</strong>
                <select data-orphan-remap="${String(o.targetId).replace(/\"/g, "&quot;")}">
                  <option value="">Re-map to model...</option>
                  ${modelOptions.map((m) => `<option value="${m.id.replace(/\"/g, "&quot;")}">${m.name}</option>`).join("")}
                </select>
                <button data-orphan-ignore="${String(o.targetId).replace(/\"/g, "&quot;")}">Ignore</button>
                <button data-remove-assignment="${String(o.targetId).replace(/\"/g, "&quot;")}">Delete</button>
              </li>`
                )
                .join("")
            : "<li>No orphaned assignments.</li>"
        }
      </ul>
    </section>
  `;
}

function screenContent() {
  if (state.route === "project") return projectScreen();
  if (state.route === "sequence") return sequenceScreen();
  if (state.route === "inspiration") return inspirationScreen();
  if (state.route === "design") return designScreen();
  if (state.route === "history") return historyScreen();
  return metadataScreen();
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
                const ts = entry?.ts ? new Date(entry.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "--:--:--";
                const status = String(entry?.status || "unknown");
                const count = Number(entry?.commandCount || 0);
                const reason = String(entry?.reason || "").trim();
                return `
                <li>
                  <strong>[${status}]</strong> ${ts} - ${count} command${count === 1 ? "" : "s"}
                  ${entry?.stage ? ` (${entry.stage})` : ""}
                  ${reason ? `<div class="banner">${escapeHtml(reason)}</div>` : ""}
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

function jobsPanel() {
  if (!state.ui.jobsOpen) return "";
  const rows = state.jobs || [];
  return `
    <section class="card diagnostics-panel">
      <div class="row" style="justify-content:space-between;">
        <h3>Jobs</h3>
        <div class="row">
          <button id="close-jobs">Close</button>
        </div>
      </div>
      ${
        rows.length
          ? `
        <ul class="list">
          ${rows
            .map(
              (j) => `
            <li>
              <strong>${j.id}</strong> [${j.status || "unknown"}] ${j.source || ""}
              ${j.progress !== undefined ? ` - ${j.progress}%` : ""}
              ${j.message ? `<div class="banner">${j.message}</div>` : ""}
              <div class="row" style="margin-top:4px;">
                <button data-cancel-job="${j.id}">Cancel</button>
              </div>
            </li>
          `
            )
            .join("")}
        </ul>
      `
          : "<p class=\"banner\">No jobs tracked yet.</p>"
      }
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

  const toggleFooterDiagnosticsBtn = app.querySelector("#toggle-footer-diagnostics");
  if (toggleFooterDiagnosticsBtn) {
    toggleFooterDiagnosticsBtn.addEventListener("click", () => toggleDiagnostics());
  }

  const closeJobsBtn = app.querySelector("#close-jobs");
  if (closeJobsBtn) closeJobsBtn.addEventListener("click", () => toggleJobs(false));

  const clearDiagnosticsBtn = app.querySelector("#clear-diagnostics");
  if (clearDiagnosticsBtn) clearDiagnosticsBtn.addEventListener("click", clearDiagnostics);

  const exportDiagnosticsBtn = app.querySelector("#export-diagnostics");
  if (exportDiagnosticsBtn) exportDiagnosticsBtn.addEventListener("click", onExportDiagnostics);

  app.querySelectorAll("[data-diag-filter]").forEach((btn) => {
    btn.addEventListener("click", () => setDiagnosticsFilter(btn.dataset.diagFilter));
  });

  const sendChatBtn = app.querySelector("#send-chat");
  if (sendChatBtn) sendChatBtn.addEventListener("click", onSendChat);

  const chatInput = app.querySelector("#chat-input");
  if (chatInput) {
    chatInput.addEventListener("input", () => {
      state.ui.chatDraft = chatInput.value;
      persist();
    });
    chatInput.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();
        onSendChat();
      }
    });
  }

  app.querySelectorAll("[data-quick-prompt]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number.parseInt(btn.dataset.quickPrompt, 10);
      if (!Number.isInteger(idx) || idx < 0 || idx >= CHAT_QUICK_PROMPTS.length) return;
      onUseQuickPrompt(CHAT_QUICK_PROMPTS[idx]);
    });
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

  const openSettingsBtn = app.querySelector("#open-settings");
  if (openSettingsBtn) {
    openSettingsBtn.addEventListener("click", async () => {
      state.ui.settingsOpen = true;
      persist();
      render();
      if (state.flags.xlightsConnected && !String(state.health.xlightsVersion || "").trim()) {
        await onCheckHealth();
      }
    });
  }

  const closeSettingsBtn = app.querySelector("#close-settings");
  if (closeSettingsBtn) {
    closeSettingsBtn.addEventListener("click", () => {
      state.ui.settingsOpen = false;
      persist();
      render();
    });
  }

  const settingsOverlay = app.querySelector("#settings-overlay");
  if (settingsOverlay) {
    settingsOverlay.addEventListener("click", (event) => {
      if (event.target === settingsOverlay) {
        state.ui.settingsOpen = false;
        persist();
        render();
      }
    });
  }

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

  const saveProjectBtn = app.querySelector("#save-project");
  if (saveProjectBtn) saveProjectBtn.addEventListener("click", onSaveProjectSettings);

  const openSelectedProjectBtn = app.querySelector("#open-selected-project");
  if (openSelectedProjectBtn) openSelectedProjectBtn.addEventListener("click", onOpenSelectedProject);

  const newProjectBtn = app.querySelector("#new-project");
  if (newProjectBtn) newProjectBtn.addEventListener("click", onCreateNewProject);

  const saveProjectAsBtn = app.querySelector("#save-project-as");
  if (saveProjectAsBtn) saveProjectAsBtn.addEventListener("click", onSaveProjectAs);

  const resetProjectBtn = app.querySelector("#reset-project");
  if (resetProjectBtn) resetProjectBtn.addEventListener("click", onResetProjectWorkspace);

  const projectConceptInput = app.querySelector("#project-concept-input");
  if (projectConceptInput) {
    projectConceptInput.addEventListener("input", () => {
      state.projectConcept = projectConceptInput.value;
      saveCurrentProjectSnapshot();
      persist();
    });
  }

  const openSequenceBtn = app.querySelector("#open-sequence");
  if (openSequenceBtn) openSequenceBtn.addEventListener("click", onOpenSelectedSequence);

  const sequenceCatalogSelect = app.querySelector("#sequence-catalog-select");
  if (sequenceCatalogSelect) sequenceCatalogSelect.addEventListener("change", onSelectCatalogSequence);

  const browseShowFolderBtn = app.querySelector("#browse-showfolder");
  if (browseShowFolderBtn) browseShowFolderBtn.addEventListener("click", onBrowseShowFolder);

  const newSessionBtn = app.querySelector("#new-session");
  if (newSessionBtn) newSessionBtn.addEventListener("click", onNewSession);

  const creativeGoalsInput = app.querySelector("#creative-goals-input");
  if (creativeGoalsInput) {
    creativeGoalsInput.addEventListener("input", () => {
      state.creative.goals = creativeGoalsInput.value;
      state.flags.creativeBriefReady = false;
      persist();
    });
  }

  const creativeInspirationInput = app.querySelector("#creative-inspiration-input");
  if (creativeInspirationInput) {
    creativeInspirationInput.addEventListener("input", () => {
      state.creative.inspiration = creativeInspirationInput.value;
      state.flags.creativeBriefReady = false;
      persist();
    });
  }

  const creativeNotesInput = app.querySelector("#creative-notes-input");
  if (creativeNotesInput) {
    creativeNotesInput.addEventListener("input", () => {
      state.creative.notes = creativeNotesInput.value;
      state.flags.creativeBriefReady = false;
      persist();
    });
  }

  const creativeBriefTextInput = app.querySelector("#creative-brief-text");
  if (creativeBriefTextInput) {
    creativeBriefTextInput.addEventListener("input", () => {
      state.creative.briefText = creativeBriefTextInput.value;
      persist();
    });
  }

  const addReferenceMediaBtn = app.querySelector("#add-reference-media");
  if (addReferenceMediaBtn) addReferenceMediaBtn.addEventListener("click", onReferenceMediaSelected);

  const addPaletteSwatchBtn = app.querySelector("#add-palette-swatch");
  if (addPaletteSwatchBtn) addPaletteSwatchBtn.addEventListener("click", addPaletteSwatch);

  const runCreativeAnalysisBtn = app.querySelector("#run-creative-analysis");
  if (runCreativeAnalysisBtn) runCreativeAnalysisBtn.addEventListener("click", onRunCreativeAnalysis);

  const analyzeAudioBtn = app.querySelector("#analyze-audio");
  if (analyzeAudioBtn) analyzeAudioBtn.addEventListener("click", onAnalyzeAudio);

  const audioAnalysisSummaryInput = app.querySelector("#audio-analysis-summary");
  if (audioAnalysisSummaryInput) {
    audioAnalysisSummaryInput.addEventListener("input", () => {
      state.audioAnalysis.summary = audioAnalysisSummaryInput.value;
      persist();
    });
  }

  const regenerateCreativeBriefBtn = app.querySelector("#regenerate-creative-brief");
  if (regenerateCreativeBriefBtn) regenerateCreativeBriefBtn.addEventListener("click", onRegenerateCreativeBrief);

  const acceptCreativeBriefBtn = app.querySelector("#accept-creative-brief");
  if (acceptCreativeBriefBtn) acceptCreativeBriefBtn.addEventListener("click", onAcceptCreativeBrief);

  const editBriefDirectionBtn = app.querySelector("#edit-brief-direction");
  if (editBriefDirectionBtn) editBriefDirectionBtn.addEventListener("click", onEditBriefDirection);

  app.querySelectorAll("[data-ref-remove]").forEach((btn) => {
    btn.addEventListener("click", () => onRemoveReferenceMedia(btn.dataset.refRemove));
  });

  app.querySelectorAll("[data-ref-preview]").forEach((btn) => {
    btn.addEventListener("click", () => onPreviewReferenceMedia(btn.dataset.refPreview));
  });

  app.querySelectorAll("[data-ref-toggle-eligible]").forEach((btn) => {
    btn.addEventListener("click", () => onToggleReferenceEligible(btn.dataset.refToggleEligible));
  });

  app.querySelectorAll("[data-palette-remove]").forEach((btn) => {
    btn.addEventListener("click", () => removePaletteSwatch(btn.dataset.paletteRemove));
  });

  const checkHealthBtn = app.querySelector("#check-health");
  if (checkHealthBtn) checkHealthBtn.addEventListener("click", onCheckHealth);

  const refreshModelsBtn = app.querySelector("#refresh-models");
  if (refreshModelsBtn) refreshModelsBtn.addEventListener("click", onRefreshModels);

  const metadataFilterNameInput = app.querySelector("#metadata-filter-name");
  if (metadataFilterNameInput) {
    const commitNameFilter = () => {
      const next = metadataFilterNameInput.value;
      if (next === state.ui.metadataFilterName) return;
      state.ui.metadataFilterName = next;
      persist();
      render();
    };
    metadataFilterNameInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      commitNameFilter();
    });
    metadataFilterNameInput.addEventListener("change", commitNameFilter);
    metadataFilterNameInput.addEventListener("blur", commitNameFilter);
  }

  const metadataFilterTypeInput = app.querySelector("#metadata-filter-type");
  if (metadataFilterTypeInput) {
    const commitTypeFilter = () => {
      const next = metadataFilterTypeInput.value;
      if (next === state.ui.metadataFilterType) return;
      state.ui.metadataFilterType = next;
      persist();
      render();
    };
    metadataFilterTypeInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      commitTypeFilter();
    });
    metadataFilterTypeInput.addEventListener("change", commitTypeFilter);
    metadataFilterTypeInput.addEventListener("blur", commitTypeFilter);
  }

  const metadataFilterTagsInput = app.querySelector("#metadata-filter-tags");
  if (metadataFilterTagsInput) {
    const commitTagsFilter = () => {
      const next = metadataFilterTagsInput.value;
      if (next === state.ui.metadataFilterTags) return;
      state.ui.metadataFilterTags = next;
      persist();
      render();
    };
    metadataFilterTagsInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      commitTagsFilter();
    });
    metadataFilterTagsInput.addEventListener("change", commitTagsFilter);
    metadataFilterTagsInput.addEventListener("blur", commitTagsFilter);
  }

  const metadataNewTagInput = app.querySelector("#metadata-new-tag");
  if (metadataNewTagInput) {
    metadataNewTagInput.addEventListener("input", () => {
      state.ui.metadataNewTag = metadataNewTagInput.value;
      persist();
    });
  }

  const metadataNewTagDescriptionInput = app.querySelector("#metadata-new-tag-description");
  if (metadataNewTagDescriptionInput) {
    metadataNewTagDescriptionInput.addEventListener("input", () => {
      state.ui.metadataNewTagDescription = metadataNewTagDescriptionInput.value;
      persist();
    });
  }

  const metadataAddTagBtn = app.querySelector("#metadata-add-tag");
  if (metadataAddTagBtn) metadataAddTagBtn.addEventListener("click", addMetadataTag);

  const metadataApplySelectedBtn = app.querySelector("#metadata-apply-selected-tags");
  if (metadataApplySelectedBtn) metadataApplySelectedBtn.addEventListener("click", applyTagsToSelectedMetadataTargets);

  const metadataRemoveSelectedBtn = app.querySelector("#metadata-remove-selected-tags");
  if (metadataRemoveSelectedBtn) metadataRemoveSelectedBtn.addEventListener("click", removeTagsFromSelectedMetadataTargets);

  const metadataClearTagsBtn = app.querySelector("#metadata-clear-tags");
  if (metadataClearTagsBtn) metadataClearTagsBtn.addEventListener("click", clearMetadataSelectedTags);

  const metadataSelectVisibleBtn = app.querySelector("#metadata-select-visible");
  if (metadataSelectVisibleBtn) {
    metadataSelectVisibleBtn.addEventListener("click", () => {
      const visibleIds = Array.from(app.querySelectorAll("[data-metadata-select]"))
        .map((node) => String(node.dataset.metadataSelect || "").trim())
        .filter(Boolean);
      selectAllMetadataTargets(visibleIds);
    });
  }

  const metadataClearSelectionBtn = app.querySelector("#metadata-clear-selection");
  if (metadataClearSelectionBtn) metadataClearSelectionBtn.addEventListener("click", clearMetadataSelection);

  app.querySelectorAll("[data-metadata-tag-toggle]").forEach((input) => {
    input.addEventListener("change", () => {
      toggleMetadataSelectedTag(input.dataset.metadataTagToggle);
      render();
    });
  });

  app.querySelectorAll("[data-metadata-tag-description]").forEach((input) => {
    const commit = () => {
      updateMetadataTagDescription(input.dataset.metadataTagDescription, input.value);
    };
    input.addEventListener("change", commit);
    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      commit();
    });
  });

  app.querySelectorAll("[data-metadata-select]").forEach((input) => {
    input.addEventListener("change", () => {
      toggleMetadataSelectionId(input.dataset.metadataSelect);
      render();
    });
  });

  app.querySelectorAll("[data-remove-tag]").forEach((btn) => {
    btn.addEventListener("click", () => removeMetadataTag(btn.dataset.removeTag));
  });

  app.querySelectorAll("[data-remove-assignment]").forEach((btn) => {
    btn.addEventListener("click", () => removeMetadataAssignment(btn.dataset.removeAssignment));
  });

  app.querySelectorAll("[data-orphan-ignore]").forEach((btn) => {
    btn.addEventListener("click", () => ignoreMetadataOrphan(btn.dataset.orphanIgnore));
  });

  app.querySelectorAll("[data-orphan-remap]").forEach((select) => {
    select.addEventListener("change", () => {
      const fromTargetId = select.dataset.orphanRemap;
      remapMetadataOrphan(fromTargetId, select.value);
    });
  });

  const refreshRecentsBtn = app.querySelector("#refresh-recents");
  if (refreshRecentsBtn) {
    refreshRecentsBtn.addEventListener("click", () => {
      setStatus("info", "Recent sequence list refreshed.");
      render();
    });
  }

  const newSequenceTypeInput = app.querySelector("#new-sequence-type-input");
  if (newSequenceTypeInput) {
    newSequenceTypeInput.addEventListener("change", () => {
      state.newSequenceType = newSequenceTypeInput.value === "animation" ? "animation" : "musical";
      persist();
      render();
    });
  }

  const newSequenceFrameInput = app.querySelector("#new-sequence-frame-input");
  if (newSequenceFrameInput) {
    newSequenceFrameInput.addEventListener("change", () => {
      const parsed = Number.parseInt(newSequenceFrameInput.value, 10);
      state.newSequenceFrameMs = Number.isFinite(parsed) ? Math.max(1, parsed) : state.newSequenceFrameMs;
      persist();
    });
  }

  const newSequenceDurationInput = app.querySelector("#new-sequence-duration-input");
  if (newSequenceDurationInput) {
    newSequenceDurationInput.addEventListener("change", () => {
      const parsed = Number.parseInt(newSequenceDurationInput.value, 10);
      state.newSequenceDurationMs = Number.isFinite(parsed) ? Math.max(1, parsed) : state.newSequenceDurationMs;
      persist();
    });
  }

  const audioPathInput = app.querySelector("#audio-path-input");
  if (audioPathInput) {
    audioPathInput.addEventListener("change", () => {
      state.audioPathInput = audioPathInput.value.trim() || "";
      persist();
    });
  }

  const pickSequencePathBtn = app.querySelector("#pick-sequence-path");
  if (pickSequencePathBtn) {
    pickSequencePathBtn.addEventListener("click", () => openFilePicker("sequence-path-picker"));
  }

  const sequencePathPicker = app.querySelector("#sequence-path-picker");
  if (sequencePathPicker) {
    sequencePathPicker.addEventListener("change", () => {
      const [file] = sequencePathPicker.files || [];
      if (file) onSequenceFilePicked(file, "existing");
      sequencePathPicker.value = "";
    });
  }

  const pickNewSequencePathBtn = app.querySelector("#pick-new-sequence-path");
  if (pickNewSequencePathBtn) {
    pickNewSequencePathBtn.addEventListener("click", () => openFilePicker("new-sequence-path-picker"));
  }

  const newSequencePathPicker = app.querySelector("#new-sequence-path-picker");
  if (newSequencePathPicker) {
    newSequencePathPicker.addEventListener("change", () => {
      const [file] = newSequencePathPicker.files || [];
      if (file) onSequenceFilePicked(file, "new");
      newSequencePathPicker.value = "";
    });
  }

  const pickAudioPathBtn = app.querySelector("#pick-audio-path");
  if (pickAudioPathBtn) {
    pickAudioPathBtn.addEventListener("click", () => openFilePicker("audio-path-picker"));
  }

  const audioPathPicker = app.querySelector("#audio-path-picker");
  if (audioPathPicker) {
    audioPathPicker.addEventListener("change", () => {
      const [file] = audioPathPicker.files || [];
      if (file) onAudioFilePicked(file);
      audioPathPicker.value = "";
    });
  }

  const staleRefreshBtn = app.querySelector("#status-refresh");
  if (staleRefreshBtn) staleRefreshBtn.addEventListener("click", onRefresh);

  const staleRegenBtn = app.querySelector("#status-regenerate");
  if (staleRegenBtn) staleRegenBtn.addEventListener("click", onRegenerate);

  const staleCancelBtn = app.querySelector("#status-cancel");
  if (staleCancelBtn) staleCancelBtn.addEventListener("click", onCancelDraft);

  const staleRefreshRegenerateBtn = app.querySelector("#stale-refresh-regenerate");
  if (staleRefreshRegenerateBtn) staleRefreshRegenerateBtn.addEventListener("click", onRefreshAndRegenerate);

  const staleRebaseBtn = app.querySelector("#stale-rebase");
  if (staleRebaseBtn) staleRebaseBtn.addEventListener("click", onRebaseDraft);

  const staleRefreshOnlyBtn = app.querySelector("#stale-refresh-only");
  if (staleRefreshOnlyBtn) staleRefreshOnlyBtn.addEventListener("click", onRefresh);

  const staleCancelDraftBtn = app.querySelector("#stale-cancel-draft");
  if (staleCancelDraftBtn) staleCancelDraftBtn.addEventListener("click", onCancelDraft);

  app.querySelectorAll("[data-section]").forEach((btn) => {
    btn.addEventListener("click", () => setSectionFilter(btn.dataset.section));
  });

  app.querySelectorAll("[data-design-tab]").forEach((btn) => {
    btn.addEventListener("click", () => setDesignTab(btn.dataset.designTab));
  });

  const removeSelectedProposedBtn = app.querySelector("#remove-selected-proposed");
  if (removeSelectedProposedBtn) removeSelectedProposedBtn.addEventListener("click", onRemoveSelectedProposed);

  const removeAllProposedBtn = app.querySelector("#remove-all-proposed");
  if (removeAllProposedBtn) removeAllProposedBtn.addEventListener("click", onRemoveAllProposed);

  const proposedPayloadDetails = app.querySelector(".proposed-payload-footer");
  if (proposedPayloadDetails) {
    proposedPayloadDetails.addEventListener("toggle", () => {
      state.ui.proposedPayloadOpen = proposedPayloadDetails.open;
      persist();
    });
  }

  app.querySelectorAll("[data-proposed-select]").forEach((input) => {
    input.addEventListener("change", () => toggleProposedSelection(input.dataset.proposedSelect));
  });

  app.querySelectorAll("[data-proposed-delete]").forEach((btn) => {
    btn.addEventListener("click", () => removeProposedLine(Number.parseInt(btn.dataset.proposedDelete, 10)));
  });

  app.querySelectorAll("[data-proposed-focus]").forEach((cell) => {
    cell.addEventListener("click", () => toggleProposedSelection(cell.dataset.proposedFocus));
  });

  app.querySelectorAll("[data-proposed-tag-type]").forEach((tag) => {
    tag.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const type = String(tag.dataset.proposedTagType || "").trim();
      const value = String(tag.dataset.proposedTagValue || "").trim();
      if (!type || !value) return;
      if (type === "section") {
        state.ui.chatDraft = `Focus updates on section "${value}". `;
        setStatus("info", `Section tag selected: ${value}`);
      } else if (type === "model") {
        state.ui.chatDraft = `Focus updates on model "${value}". `;
        setStatus("info", `Model tag selected: ${value}`);
      } else {
        state.ui.chatDraft = `${value} `;
      }
      persist();
      render();
    });
  });

  app.querySelectorAll("[data-proposed-input]").forEach((input) => {
    input.addEventListener("change", () =>
      updateProposedLine(Number.parseInt(input.dataset.proposedInput, 10), input.value)
    );
  });

  app.querySelectorAll("[data-proposed-remove]").forEach((btn) => {
    btn.addEventListener("click", () =>
      removeProposedLine(Number.parseInt(btn.dataset.proposedRemove, 10))
    );
  });

  app.querySelectorAll("[data-version]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.selectedVersion = btn.dataset.version;
      persist();
      render();
    });
  });

  app.querySelectorAll("[data-recent]").forEach((btn) => {
    btn.addEventListener("click", () => onUseRecent(btn.dataset.recent));
  });

  app.querySelectorAll("[data-cancel-job]").forEach((btn) => {
    btn.addEventListener("click", () => onCancelJob(btn.dataset.cancelJob));
  });

  app.querySelectorAll("[data-insert-model]").forEach((btn) => {
    btn.addEventListener("click", () => insertModelIntoDraft(btn.dataset.insertModel));
  });

  const rollbackBtn = app.querySelector("#rollback");
  if (rollbackBtn) {
    rollbackBtn.addEventListener("click", onRollbackToVersion);
  }

  const compareBtn = app.querySelector("#compare");
  if (compareBtn) compareBtn.addEventListener("click", onCompareVersion);

  const variantBtn = app.querySelector("#variant");
  if (variantBtn) variantBtn.addEventListener("click", onReapplyVariant);
}

function render() {
  const diagCounts = getDiagnosticsCounts();
  const filter = state.ui.diagnosticsFilter;
  const rows = state.diagnostics || [];
  const filteredRows = filter === "all" ? rows : rows.filter((d) => d.level === filter);
  const footerApplyHistory = Array.isArray(state.applyHistory) ? state.applyHistory.slice(0, 8) : [];

  app.innerHTML = `
    <div class="app-shell ${state.ui.navCollapsed ? "nav-collapsed" : ""}">
      <div class="main-grid ${state.ui.navCollapsed ? "nav-collapsed" : ""}">
        <nav class="nav ${state.ui.navCollapsed ? "collapsed" : ""}">
          <div class="nav-header">
            <button id="toggle-nav" class="nav-toggle-btn" title="${state.ui.navCollapsed ? "Expand navigation" : "Collapse navigation"}"><span class="nav-icon">${state.ui.navCollapsed ? "›" : "‹"}</span></button>
            <div class="nav-project-name">${state.projectName || "Project"}</div>
          </div>
          <div class="nav-links">
            ${navButton("project", "Project")}
            ${navButton("sequence", "Sequence")}
            ${navButton("inspiration", "Inspiration")}
            ${navButton("design", "Design")}
            ${navButton("history", "History")}
            ${navButton("metadata", "Metadata")}
          </div>
        </nav>

        <div class="main-shell">
          <header class="header">
            <div class="header-sequence"><strong>${state.activeSequence || "No Sequence Open"}</strong></div>
            <div class="header-badge">xLights: ${state.flags.xlightsConnected ? "Connected" : "Disconnected"}</div>
          </header>

          <div class="main-body">
            <main class="content">
              ${screenContent()}
              ${state.route === "design" ? detailsDrawer() : ""}
              ${settingsDrawer()}
              ${jobsPanel()}
            </main>
            ${persistentCoachPanel()}
          </div>

        </div>
      </div>

      <div class="bottom-input-row ${state.ui.navCollapsed ? "nav-collapsed" : ""}">
        <div class="bottom-nav-settings">
          <button id="open-settings" title="Application Settings"><span class="nav-icon">⚙</span><span class="nav-label">Settings</span></button>
        </div>
        ${globalChatBar()}
      </div>

      <footer class="footer">
        <div class="footer-summary">
          <button id="toggle-footer-diagnostics">${state.ui.diagnosticsOpen ? "Hide" : "Show"} Diagnostics</button>
          <span>Diagnostics: ${diagCounts.total} total</span>
          <span>${diagCounts.warning} warning</span>
          <span>${diagCounts.actionRequired} action-required</span>
        </div>
        ${
          state.ui.diagnosticsOpen
            ? `
          <div class="footer-diagnostics">
            <div class="row" style="justify-content:space-between;">
              <div class="row">
                <button data-diag-filter="all" class="${filter === "all" ? "active-chip" : ""}">All (${diagCounts.total})</button>
                <button data-diag-filter="warning" class="${filter === "warning" ? "active-chip" : ""}">Warnings (${diagCounts.warning})</button>
                <button data-diag-filter="action-required" class="${filter === "action-required" ? "active-chip" : ""}">Action Required (${diagCounts.actionRequired})</button>
              </div>
              <div class="row">
                <button id="export-diagnostics">Export</button>
                <button id="clear-diagnostics">Clear</button>
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
                      <strong>[${d.level}]</strong> ${d.text}
                      ${d.details ? `<pre class="diag-details">${d.details}</pre>` : ""}
                    </li>
                  `
                    )
                    .join("")}
                </ul>
              `
                : '<p class="banner">No diagnostics for current filter.</p>'
            }
            <div style="margin-top:8px;">
              <h4 style="margin:0 0 6px;">Recent Applies</h4>
              ${
                footerApplyHistory.length
                  ? `
                  <ul class="list">
                    ${footerApplyHistory
                      .map((entry) => {
                        const status = String(entry?.status || "unknown");
                        const count = Number(entry?.commandCount || 0);
                        const ts = entry?.ts
                          ? new Date(entry.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                          : "--:--";
                        return `
                      <li>
                        <strong>[${status}]</strong> ${ts} - ${count} cmd${count === 1 ? "" : "s"}
                        ${entry?.stage ? ` (${entry.stage})` : ""}
                      </li>
                    `;
                      })
                      .join("")}
                  </ul>
                `
                  : '<p class="banner">No apply history yet.</p>'
              }
            </div>
          </div>
        `
            : ""
        }
      </footer>
    </div>
  `;

  bindEvents();
}

async function bootstrapLiveData() {
  try {
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
  await hydrateStateFromDesktop();
  applyRolloutPolicy();
  await refreshApplyHistoryFromDesktop(40);
  render();
  await bootstrapLiveData();
})();
setInterval(pollRevision, 8000);
setInterval(pollJobs, 3000);
setInterval(pollCompatibilityStatus, CONNECTIVITY_POLL_MS);
if (typeof window !== "undefined") {
  window.addEventListener("focus", () => {
    void syncOpenSequenceOnFocusReturn();
  });
}
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void syncOpenSequenceOnFocusReturn();
    }
  });
}
