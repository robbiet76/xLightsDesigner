import {
  closeSequence,
  cancelJob,
  createSequence,
  executePlan,
  getDefaultEndpoint,
  getJob,
  getMediaStatus,
  getModels,
  getOpenSequence,
  getRevision,
  saveSequence,
  getTimingMarks,
  getTimingTracks,
  openSequence,
  validateCommands,
  pingCapabilities
} from "./api.js";

const app = document.getElementById("app");
const STORAGE_KEY = "xlightsdesigner.ui.state.v1";
const PROJECTS_KEY = "xlightsdesigner.ui.projects.v1";
const DESKTOP_STATE_SYNC_DEBOUNCE_MS = 250;
const DEFAULT_PROPOSED_ROWS = 5;
const PROPOSED_ROWS_STEP = 5;
const CHAT_QUICK_PROMPTS = [
  "Make chorus 2 higher energy on MegaTree and Roofline.",
  "Keep current look, but reduce twinkle intensity on candy canes.",
  "Rework bridge section with calmer color transitions."
];
const FALLBACK_LOCAL_ENDPOINTS = [
  "http://127.0.0.1:8080/xlDoAutomation",
  "http://localhost:8080/xlDoAutomation",
  "http://127.0.0.1:49914/xlDoAutomation",
  "http://127.0.0.1:49913/xlDoAutomation"
];
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
const LEGACY_SAMPLE_PROPOSED = [
  "Chorus 2 / CandyCanes / reduce twinkle 35%",
  "Chorus 2 / XD:Mood / mark as calmer pulse",
  "Chorus 2 / Roofline / soften sparkle saturation"
];
const LEGACY_SAMPLE_CHAT = [
  "Reduce twinkle intensity on candy canes in chorus 2.",
  "Draft updated. I focused changes to chorus 2 labels only."
];

const defaultState = {
  route: "project",
  endpoint: getDefaultEndpoint(),
  projectName: "Holiday 2026",
  showFolder: "/Users/robterry/Desktop/Show",
  safety: {
    applyConfirmMode: "large-only",
    largeChangeThreshold: 60,
    sequenceSwitchUnsavedPolicy: "save-if-needed"
  },
  activeSequence: "",
  sequencePathInput: "",
  newSequencePathInput: "",
  newSequenceType: "musical",
  newSequenceDurationMs: 180000,
  newSequenceFrameMs: 50,
  audioPathInput: "",
  savePathInput: "",
  lastApplyBackupPath: "",
  recentSequences: [],
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
    compatibilityStatus: "unknown"
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
    planOnlyForcedByConnectivity: false
  },
  chat: [],
  proposed: [],
  ui: {
    detailsOpen: false,
    sectionSelections: ["all"],
    designTab: "chat",
    diagnosticsOpen: false,
    jobsOpen: false,
    diagnosticsFilter: "all",
    modelFilterText: "",
    sequenceMode: "existing",
    sectionTrackName: "",
    proposedRowsVisible: DEFAULT_PROPOSED_ROWS,
    chatDraft: "",
    agentThinking: false,
    metadataTargetId: "",
    metadataRole: "support",
    metadataBehavior: "steady",
    metadataTagDraft: "",
    metadataNewTag: ""
  },
  diagnostics: [],
  jobs: [],
  models: [],
  timingTracks: [],
  sectionSuggestions: [],
  sectionStartByLabel: {},
  creative: {
    goals: "",
    inspiration: "",
    notes: "",
    references: [],
    brief: null,
    briefUpdatedAt: ""
  },
  metadata: {
    tags: ["focal", "rhythm-driver", "ambient-fill"],
    assignments: [],
    ignoredOrphanTargetIds: []
  },
  versions: [{ id: "v1", summary: "Session initialized", effects: 0, time: "--:--" }],
  selectedVersion: "v1",
  compareVersion: null
};

function isLegacySampleState(stateLike) {
  const proposed = Array.isArray(stateLike?.proposed) ? stateLike.proposed : [];
  const chat = Array.isArray(stateLike?.chat) ? stateLike.chat.map((c) => c?.text).filter(Boolean) : [];
  return (
    proposed.length === LEGACY_SAMPLE_PROPOSED.length &&
    proposed.every((line, i) => line === LEGACY_SAMPLE_PROPOSED[i]) &&
    chat.length === LEGACY_SAMPLE_CHAT.length &&
    chat.every((line, i) => line === LEGACY_SAMPLE_CHAT[i])
  );
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
    if (isLegacySampleState(merged)) {
      merged.chat = [];
      merged.proposed = [];
      merged.flags = { ...merged.flags, hasDraftProposal: false, proposalStale: false };
      merged.draftBaseRevision = "unknown";
    }
    return merged;
  } catch {
    return structuredClone(defaultState);
  }
}

const state = loadState();
let desktopStatePersistTimer = null;
let desktopStateHydrated = false;
let sidecarPersistTimer = null;
let hydratedSidecarSequencePath = "";

function getProjectKey(projectName = state.projectName, showFolder = state.showFolder) {
  return `${(projectName || "").trim()}::${(showFolder || "").trim()}`;
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
  const candidates = uniqueEndpoints([
    preferredEndpoint,
    state.endpoint,
    getDefaultEndpoint(),
    ...FALLBACK_LOCAL_ENDPOINTS
  ]);
  let lastError = null;
  for (const endpoint of candidates) {
    try {
      const caps = await pingCapabilities(endpoint);
      return { endpoint, caps };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error("No reachable xLights endpoint found");
}

function extractProjectSnapshot() {
  return {
    sequencePathInput: state.sequencePathInput,
    newSequencePathInput: state.newSequencePathInput,
    newSequenceType: state.newSequenceType,
    newSequenceDurationMs: state.newSequenceDurationMs,
    newSequenceFrameMs: state.newSequenceFrameMs,
    audioPathInput: state.audioPathInput,
    savePathInput: state.savePathInput,
    lastApplyBackupPath: state.lastApplyBackupPath,
    recentSequences: state.recentSequences,
    activeSequence: state.activeSequence,
    revision: state.revision,
    draftBaseRevision: state.draftBaseRevision,
    proposed: state.proposed,
    flags: {
      planOnlyMode: state.flags.planOnlyMode,
      creativeBriefReady: state.flags.creativeBriefReady
    },
    safety: state.safety,
    ui: {
      sectionSelections: state.ui.sectionSelections,
      designTab: state.ui.designTab,
      sequenceMode: state.ui.sequenceMode,
      sectionTrackName: state.ui.sectionTrackName,
      proposedRowsVisible: state.ui.proposedRowsVisible,
      chatDraft: state.ui.chatDraft,
      agentThinking: state.ui.agentThinking,
      metadataTargetId: state.ui.metadataTargetId,
      metadataRole: state.ui.metadataRole,
      metadataBehavior: state.ui.metadataBehavior,
      metadataTagDraft: state.ui.metadataTagDraft,
      metadataNewTag: state.ui.metadataNewTag
    },
    diagnostics: state.diagnostics,
    jobs: state.jobs,
    models: state.models,
    timingTracks: state.timingTracks,
    sectionSuggestions: state.sectionSuggestions,
    sectionStartByLabel: state.sectionStartByLabel,
    creative: state.creative,
    metadata: state.metadata,
    health: state.health
  };
}

function applyProjectSnapshot(snapshot) {
  if (!snapshot) return;
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
  state.savePathInput = snapshot.savePathInput || state.savePathInput;
  state.lastApplyBackupPath = snapshot?.lastApplyBackupPath || "";
  state.recentSequences = Array.isArray(snapshot.recentSequences) ? snapshot.recentSequences : [];
  state.activeSequence = snapshot.activeSequence || state.activeSequence;
  state.revision = snapshot.revision || "unknown";
  state.draftBaseRevision = snapshot.draftBaseRevision || "unknown";
  state.proposed = Array.isArray(snapshot.proposed) ? snapshot.proposed : state.proposed;
  state.flags.planOnlyMode = Boolean(snapshot?.flags?.planOnlyMode);
  state.flags.creativeBriefReady = Boolean(snapshot?.flags?.creativeBriefReady);
  state.safety = { ...state.safety, ...(snapshot.safety || {}) };
  state.ui.sectionSelections = Array.isArray(snapshot?.ui?.sectionSelections)
    ? snapshot.ui.sectionSelections
    : ["all"];
  state.ui.designTab = snapshot?.ui?.designTab || "chat";
  state.ui.sequenceMode = snapshot?.ui?.sequenceMode || "existing";
  state.ui.sectionTrackName = snapshot?.ui?.sectionTrackName || "";
  state.ui.proposedRowsVisible =
    Number.isFinite(Number(snapshot?.ui?.proposedRowsVisible))
      ? Math.max(DEFAULT_PROPOSED_ROWS, Number(snapshot.ui.proposedRowsVisible))
      : DEFAULT_PROPOSED_ROWS;
  state.ui.chatDraft = snapshot?.ui?.chatDraft || "";
  state.ui.agentThinking = Boolean(snapshot?.ui?.agentThinking);
  state.ui.metadataTargetId = snapshot?.ui?.metadataTargetId || "";
  state.ui.metadataRole = snapshot?.ui?.metadataRole || "support";
  state.ui.metadataBehavior = snapshot?.ui?.metadataBehavior || "steady";
  state.ui.metadataTagDraft = snapshot?.ui?.metadataTagDraft || "";
  state.ui.metadataNewTag = snapshot?.ui?.metadataNewTag || "";
  state.diagnostics = Array.isArray(snapshot.diagnostics) ? snapshot.diagnostics : state.diagnostics;
  state.jobs = Array.isArray(snapshot.jobs) ? snapshot.jobs : state.jobs;
  state.models = Array.isArray(snapshot.models) ? snapshot.models : state.models;
  state.timingTracks = Array.isArray(snapshot.timingTracks) ? snapshot.timingTracks : [];
  state.sectionSuggestions = Array.isArray(snapshot.sectionSuggestions)
    ? snapshot.sectionSuggestions
    : [];
  state.sectionStartByLabel =
    snapshot?.sectionStartByLabel && typeof snapshot.sectionStartByLabel === "object"
      ? snapshot.sectionStartByLabel
      : {};
  state.creative =
    snapshot?.creative && typeof snapshot.creative === "object"
      ? {
          goals: String(snapshot.creative.goals || ""),
          inspiration: String(snapshot.creative.inspiration || ""),
          notes: String(snapshot.creative.notes || ""),
          references: Array.isArray(snapshot.creative.references) ? snapshot.creative.references : [],
          brief: snapshot.creative.brief && typeof snapshot.creative.brief === "object" ? snapshot.creative.brief : null,
          briefUpdatedAt: String(snapshot.creative.briefUpdatedAt || "")
        }
      : { ...defaultState.creative };
  state.metadata =
    snapshot?.metadata && typeof snapshot.metadata === "object"
      ? {
          tags: Array.isArray(snapshot.metadata.tags) ? snapshot.metadata.tags : [],
          assignments: Array.isArray(snapshot.metadata.assignments) ? snapshot.metadata.assignments : [],
          ignoredOrphanTargetIds: Array.isArray(snapshot.metadata.ignoredOrphanTargetIds)
            ? snapshot.metadata.ignoredOrphanTargetIds
            : []
        }
      : { tags: [], assignments: [], ignoredOrphanTargetIds: [] };
  state.health = { ...state.health, ...(snapshot.health || {}) };
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

const routes = ["project", "sequence", "design", "history", "metadata"];

function setRoute(route) {
  if (!routes.includes(route)) return;
  state.route = route;
  persist();
  render();
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

function enforceConnectivityPlanOnly() {
  const changed = !state.flags.planOnlyForcedByConnectivity || !state.flags.planOnlyMode;
  state.flags.planOnlyMode = true;
  state.flags.planOnlyForcedByConnectivity = true;
  return changed;
}

function releaseConnectivityPlanOnly() {
  if (!state.flags.planOnlyForcedByConnectivity) return false;
  state.flags.planOnlyForcedByConnectivity = false;
  return true;
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
  if (!f.xlightsConnected) return "Connect to xLights to apply.";
  if (!f.xlightsCompatible) return "xLights version is below minimum supported floor (2026.1).";
  if (f.planOnlyMode) return "Exit plan-only mode to apply.";
  if (f.proposalStale) return "Refresh proposal before apply.";
  if (!f.hasDraftProposal) return "Generate a proposal first.";
  if (f.applyInProgress) return "Apply in progress.";
  return "";
}

function currentImpactCount() {
  return filteredProposed().length * 11;
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

function extractVersionFromCapabilities(caps) {
  const data = caps?.data && typeof caps.data === "object" ? caps.data : {};
  const candidates = [data.xlightsVersion, data.version, data.appVersion, data.buildVersion];
  const found = candidates.find((v) => typeof v === "string" && v.trim());
  return found ? found.trim() : "";
}

function applyCapabilitiesHealth(caps, sequenceOpen = state.health.sequenceOpen) {
  const commands = Array.isArray(caps?.data?.commands) ? caps.data.commands : [];
  const xlightsVersion = extractVersionFromCapabilities(caps);
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

function buildDesignerPlanCommands() {
  const trackName = "XD:ProposedPlan";
  const source = filteredProposed();
  if (source.length === 0) {
    throw new Error("No proposed changes available for current section selection.");
  }
  const marks = source.slice(0, 24).map((label, idx) => {
    const startMs = idx * 1000;
    return {
      startMs,
      endMs: startMs + 1000,
      label
    };
  });

  return [
    {
      cmd: "timing.createTrack",
      params: {
        trackName,
        replaceIfExists: true
      }
    },
    {
      cmd: "timing.insertMarks",
      params: {
        trackName,
        marks
      }
    }
  ];
}

async function onApply() {
  if (!applyEnabled()) {
    setStatusWithDiagnostics("warning", applyDisabledReason());
    return render();
  }

  if (requiresApplyConfirmation()) {
    const message = `Apply ${currentImpactCount()} estimated impacted effects?`;
    if (!window.confirm(message)) {
      setStatus("info", "Apply canceled by user.");
      return render();
    }
  }

  state.flags.applyInProgress = true;
  state.ui.agentThinking = true;
  addChatMessage("agent", "Applying approved proposal to xLights...");
  setStatus("info", "Applying proposal to xLights...");
  render();

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

    // Preflight revision read to keep stale-state behavior explicit.
    const rev = await getRevision(state.endpoint);
    state.revision = rev?.data?.revision ?? state.revision;
    const plan = buildDesignerPlanCommands();
    const validation = await validateCommands(
      state.endpoint,
      plan.map((step) => ({ cmd: step.cmd, params: step.params }))
    );
    if (validation?.data?.valid === false) {
      const invalidResults = (validation?.data?.results || []).filter((r) => r.valid === false);
      const details = invalidResults
        .map((r) => {
          const code = r?.error?.code || "VALIDATION_ERROR";
          const msg = r?.error?.message || "Invalid command";
          return `step ${r.index}: ${code} - ${msg}`;
        })
        .join("\\n");
      setStatusWithDiagnostics(
        "action-required",
        `Plan validation failed (${invalidResults.length || 1} issue${invalidResults.length === 1 ? "" : "s"}).`,
        details || "Validation failed with no detailed payload."
      );
      return;
    }
    const result = await executePlan(state.endpoint, plan, true);
    const executed = result?.data?.executedCount ?? 0;
    const jobId = result?.data?.jobId || null;
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
    try {
      const postRev = await getRevision(state.endpoint);
      state.revision = postRev?.data?.revision ?? state.revision;
    } catch {
      // Keep prior revision if post-apply readback is unavailable.
    }
    state.draftBaseRevision = state.revision;
    state.flags.proposalStale = false;
    bumpVersion("Applied draft proposal", state.proposed.length * 11);
    setStatusWithDiagnostics(
      "info",
      `Applied via system.executePlan (${executed} steps).`
    );
    addChatMessage("agent", `Apply complete. Executed ${executed} step${executed === 1 ? "" : "s"}.`);
  } catch (err) {
    setStatusWithDiagnostics("action-required", `Apply blocked: ${err.message}`, err.stack || "");
    addChatMessage("agent", `Apply blocked: ${err.message}`);
  } finally {
    state.flags.applyInProgress = false;
    state.ui.agentThinking = false;
    saveCurrentProjectSnapshot();
    persist();
    render();
  }
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
  const usingAll = hasAllSectionsSelected();
  const selected = usingAll
    ? getSectionChoiceList()
    : getSelectedSections().filter((s) => s !== "all");
  const intentText = latestUserIntentText();
  const intentLines = inferProposalLinesFromIntent(intentText, selected);
  state.proposed = mergeCreativeBriefIntoProposal(intentLines);
  state.ui.agentThinking = false;
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

async function onRefresh() {
  try {
    let staleDetected = false;
    const releasedForce = releaseConnectivityPlanOnly();
    state.flags.xlightsConnected = true;
    const open = await getOpenSequence(state.endpoint);
    const seq = open?.data?.sequence;
    state.flags.activeSequenceLoaded = Boolean(open?.data?.isOpen && seq);
    state.health.sequenceOpen = Boolean(open?.data?.isOpen);
    const prevPath = currentSequencePathForSidecar();
    if (seq) {
      applyOpenSequenceState(seq);
      if (open?.data?.isOpen) {
        await syncAudioPathFromMediaStatus();
      }
      const nextPath = currentSequencePathForSidecar();
      if (nextPath && nextPath !== prevPath) {
        await hydrateSidecarForCurrentSequence();
      }
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
      const modelBody = await getModels(state.endpoint);
      state.models = Array.isArray(modelBody?.data?.models) ? modelBody.data.models : state.models;
      ensureMetadataTargetSelection();
    } catch (err) {
      setStatusWithDiagnostics("warning", `Model refresh failed: ${err.message}`);
    }

    try {
      await fetchSectionSuggestions();
    } catch (err) {
      setStatusWithDiagnostics("warning", `Section refresh failed: ${err.message}`);
    }

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
  const requestedEndpoint = endpointInput ? endpointInput.value.trim() || getDefaultEndpoint() : state.endpoint;
  state.endpoint = requestedEndpoint;

  setStatus("info", "Testing xLights endpoint...");
  render();

  try {
    const { endpoint, caps } = await resolveReachableEndpoint(requestedEndpoint);
    const endpointChanged = endpoint !== requestedEndpoint;
    state.endpoint = endpoint;
    if (endpointInput) endpointInput.value = endpoint;
    const { commands, xlightsVersion, compat } = applyCapabilitiesHealth(caps, state.health.sequenceOpen);
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
    const [caps, open, rev, modelsResp] = await Promise.all([
      pingCapabilities(state.endpoint),
      getOpenSequence(state.endpoint),
      getRevision(state.endpoint).catch(() => ({ data: { revision: "unknown" } })),
      getModels(state.endpoint).catch(() => ({ data: { models: [] } }))
    ]);
    const { compat, xlightsVersion } = applyCapabilitiesHealth(caps, Boolean(open?.data?.isOpen));
    const releasedForce = releaseConnectivityPlanOnly();
    state.models = Array.isArray(modelsResp?.data?.models) ? modelsResp.data.models : [];
    ensureMetadataTargetSelection();
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
  if (!state.flags.xlightsConnected || state.flags.applyInProgress) return;
  try {
    const caps = await pingCapabilities(state.endpoint);
    releaseConnectivityPlanOnly();
    const previousVersion = state.health.xlightsVersion || "";
    const previousCompat = state.health.compatibilityStatus;
    const { compat, xlightsVersion } = applyCapabilitiesHealth(caps, state.health.sequenceOpen);

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
    diagnostics: Array.isArray(state.diagnostics) ? state.diagnostics : [],
    jobs: Array.isArray(state.jobs) ? state.jobs : []
  };
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

function setModelFilterText(value) {
  state.ui.modelFilterText = value;
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
  const refs = state.creative.references || [];
  const labels = getSectionChoiceList();
  const topLabels = labels.length ? labels.slice(0, 6) : ["Intro", "Verse", "Chorus", "Bridge", "Outro"];
  const goals = String(state.creative.goals || "").trim();
  const inspiration = String(state.creative.inspiration || "").trim();
  const notes = String(state.creative.notes || "").trim();
  const audioPath = String(state.audioPathInput || "").trim();
  const recentIntent = latestUserIntentText();
  const referenceNames = refs.slice(0, 5).map((r) => r.name);

  return {
    summary: goals || inspiration || recentIntent
      ? `Design direction anchored to: ${goals || inspiration || recentIntent}`
      : "Design direction anchored to sequence mood and audio dynamics.",
    goalsSummary: goals || "No explicit goal provided; using artistic license with conservative first pass.",
    inspirationSummary: inspiration || "No explicit inspiration provided.",
    audioContext: audioPath || "Animation-only mode (no audio path provided).",
    sections: topLabels,
    moodEnergyArc: "Builds from calm textures into higher-energy focal moments, then resolves with cleaner transitions.",
    narrativeCues: "Use lyric and phrasing cues to align contrast changes with emotional beats.",
    visualCues: referenceNames.length
      ? `Reference cues from: ${referenceNames.join(", ")}`
      : "No visual references uploaded; infer visual language from user direction + audio profile.",
    hypotheses: [
      "Prioritize background depth before foreground intensity spikes.",
      "Keep successful motifs and avoid broad rewrites outside target moments."
    ],
    notes: notes || ""
  };
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

function modelStableId(model) {
  const raw = model?.id ?? model?.modelId ?? model?.name ?? "";
  return String(raw || "");
}

function modelDisplayName(model) {
  const name = model?.name || "(unnamed)";
  const type = model?.type ? ` (${model.type})` : "";
  return `${name}${type}`;
}

function getModelNameById(id) {
  const found = (state.models || []).find((m) => modelStableId(m) === id);
  return found ? modelDisplayName(found) : id;
}

function ensureMetadataTargetSelection() {
  const options = (state.models || []).map(modelStableId).filter(Boolean);
  if (!options.length) {
    state.ui.metadataTargetId = "";
    return;
  }
  if (!options.includes(state.ui.metadataTargetId)) {
    state.ui.metadataTargetId = options[0];
  }
}

function getLiveModelIdSet() {
  return new Set((state.models || []).map(modelStableId).filter(Boolean));
}

function getMetadataOrphans() {
  const liveIds = getLiveModelIdSet();
  const ignored = new Set((state.metadata?.ignoredOrphanTargetIds || []).map(String));
  return (state.metadata?.assignments || []).filter(
    (a) => a?.targetId && !liveIds.has(String(a.targetId)) && !ignored.has(String(a.targetId))
  );
}

function saveMetadataAndRender(statusText = "") {
  if (statusText) setStatus("info", statusText);
  saveCurrentProjectSnapshot();
  persist();
  render();
}

function addMetadataTag() {
  const value = normalizeSectionLabel(state.ui.metadataNewTag);
  if (!value) return;
  const tags = state.metadata?.tags || [];
  if (!tags.includes(value)) {
    state.metadata.tags = [...tags, value];
    state.ui.metadataNewTag = "";
    saveMetadataAndRender(`Added tag: ${value}`);
  } else {
    setStatus("warning", `Tag already exists: ${value}`);
    render();
  }
}

function removeMetadataTag(tag) {
  state.metadata.tags = (state.metadata?.tags || []).filter((t) => t !== tag);
  // Remove tag from assignments too.
  state.metadata.assignments = (state.metadata?.assignments || []).map((a) => ({
    ...a,
    tags: (a.tags || []).filter((t) => t !== tag)
  }));
  saveMetadataAndRender(`Removed tag: ${tag}`);
}

function applyMetadataAssignment() {
  const targetId = normalizeSectionLabel(state.ui.metadataTargetId);
  if (!targetId) {
    setStatus("warning", "Choose a model/group target first.");
    return render();
  }
  const role = normalizeSectionLabel(state.ui.metadataRole) || "support";
  const behavior = normalizeSectionLabel(state.ui.metadataBehavior) || "steady";
  const tag = normalizeSectionLabel(state.ui.metadataTagDraft);
  const tags = tag ? [tag] : [];

  const assignments = state.metadata?.assignments || [];
  const idx = assignments.findIndex((a) => String(a.targetId) === targetId);
  const next = {
    targetId,
    targetName: getModelNameById(targetId),
    role,
    behavior,
    tags
  };
  if (idx >= 0) {
    assignments[idx] = next;
    state.metadata.assignments = [...assignments];
  } else {
    state.metadata.assignments = [...assignments, next];
  }
  state.metadata.ignoredOrphanTargetIds = (state.metadata?.ignoredOrphanTargetIds || []).filter(
    (id) => String(id) !== targetId
  );
  saveMetadataAndRender(`Updated metadata for ${next.targetName}.`);
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
  const assignments = state.metadata?.assignments || [];
  const idx = assignments.findIndex((a) => String(a.targetId) === String(fromTargetId));
  if (idx < 0) return;
  assignments[idx] = {
    ...assignments[idx],
    targetId: to,
    targetName: getModelNameById(to)
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
  saveCurrentProjectSnapshot();
  persist();
  render();
}

function removeProposedLine(index) {
  if (index < 0 || index >= state.proposed.length) return;
  state.proposed.splice(index, 1);
  state.flags.hasDraftProposal = state.proposed.length > 0;
  saveCurrentProjectSnapshot();
  persist();
  render();
}

function addProposedLine() {
  state.proposed.push("Describe the next design change in plain language");
  state.flags.hasDraftProposal = true;
  saveCurrentProjectSnapshot();
  persist();
  render();
}

function selectedProposedIndexesFromPicker() {
  const picker = app.querySelector("#proposed-picker");
  if (!picker) return [];
  return Array.from(picker.selectedOptions || [])
    .map((opt) => Number.parseInt(opt.value, 10))
    .filter((idx) => Number.isInteger(idx) && idx >= 0 && idx < state.proposed.length);
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
  setStatus("info", `Removed ${uniqueDesc.length} proposed line${uniqueDesc.length === 1 ? "" : "s"}.`);
  saveCurrentProjectSnapshot();
  persist();
  render();
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

function onSaveProjectSettings() {
  const oldProjectName = state.projectName;
  const oldShowFolder = state.showFolder;
  const oldKey = getProjectKey(oldProjectName, oldShowFolder);
  if (oldKey && oldKey !== "::") {
    const store = loadProjectsStore();
    store[oldKey] = extractProjectSnapshot();
    persistProjectsStore(store);
  }

  const projectInput = app.querySelector("#project-input");
  const showFolderInput = app.querySelector("#showfolder-input");
  const endpointInput = app.querySelector("#endpoint-input");
  const confirmModeInput = app.querySelector("#confirm-mode-input");
  const thresholdInput = app.querySelector("#threshold-input");
  const sequenceSwitchPolicyInput = app.querySelector("#sequence-switch-policy-input");

  if (projectInput) state.projectName = projectInput.value.trim() || state.projectName;
  if (showFolderInput) state.showFolder = showFolderInput.value.trim() || state.showFolder;
  if (endpointInput) state.endpoint = endpointInput.value.trim() || getDefaultEndpoint();
  if (confirmModeInput) state.safety.applyConfirmMode = confirmModeInput.value;
  if (thresholdInput) {
    const parsed = Number.parseInt(thresholdInput.value, 10);
    state.safety.largeChangeThreshold = Number.isFinite(parsed) ? parsed : state.safety.largeChangeThreshold;
  }
  if (sequenceSwitchPolicyInput) {
    const value = sequenceSwitchPolicyInput.value === "discard-unsaved" ? "discard-unsaved" : "save-if-needed";
    state.safety.sequenceSwitchUnsavedPolicy = value;
  }

  const loaded = tryLoadProjectSnapshot(state.projectName, state.showFolder);
  if (!loaded) {
    saveCurrentProjectSnapshot();
  }

  setStatus("info", "Project settings saved.");
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
        directory: false,
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

async function closeActiveSequenceForSwitch() {
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

  const policy = state.safety.sequenceSwitchUnsavedPolicy === "discard-unsaved"
    ? "discard-unsaved"
    : "save-if-needed";

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

async function onBrowseNewSequencePath() {
  const selected = await pickFilePathFromDesktop({
    title: "Choose New Sequence Path (.xsq)",
    filters: [{ name: "xLights Sequence", extensions: ["xsq"] }]
  });
  if (!selected) return;
  if (!hasExtension(selected, ["xsq"])) {
    setStatus("warning", "New sequence path must end with .xsq.");
    render();
    return;
  }
  state.newSequencePathInput = selected;
  state.ui.sequenceMode = "new";
  saveCurrentProjectSnapshot();
  persist();
  render();
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
    await closeActiveSequenceForSwitch();

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
    await hydrateSidecarForCurrentSequence();
    await syncAudioPathFromMediaStatus();
    state.flags.activeSequenceLoaded = true;
    if (targetPath !== previousPath) {
      resetCreativeState();
    }
    await onRefresh();
    setStatus(
      "info",
      `${state.ui.sequenceMode === "new" ? "Sequence ready" : "Opened sequence"}: ${state.activeSequence || targetPath}`
    );
    state.route = "sequence";
  } catch (err) {
    setStatusWithDiagnostics("action-required", `Open failed: ${err.message}`, err.stack || "");
    render();
  } finally {
    saveCurrentProjectSnapshot();
    persist();
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

function onLoadProjectSnapshot() {
  const loaded = tryLoadProjectSnapshot(state.projectName, state.showFolder);
  if (loaded) {
    setStatus("info", "Project snapshot loaded.");
  } else {
    setStatus("warning", "No saved snapshot for this project/show.");
  }
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
    const body = await getModels(state.endpoint);
    state.models = Array.isArray(body?.data?.models) ? body.data.models : [];
    ensureMetadataTargetSelection();
    setStatus("info", `Loaded ${state.models.length} models.`);
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
  state.revision = "unknown";
  state.draftBaseRevision = "unknown";
  state.proposed = [...defaultState.proposed];
  state.flags.planOnlyMode = false;
  state.flags.planOnlyForcedByConnectivity = false;
  state.flags.hasDraftProposal = state.proposed.length > 0;
  state.flags.proposalStale = false;
  state.ui.sectionSelections = ["all"];
  state.ui.designTab = "chat";
  state.ui.sequenceMode = "existing";
  state.ui.sectionTrackName = "";
  state.ui.metadataTargetId = "";
  state.ui.metadataRole = "support";
  state.ui.metadataBehavior = "steady";
  state.ui.metadataTagDraft = "";
  state.ui.metadataNewTag = "";
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
  state.proposed = [];
}

function resetCreativeState() {
  revokeReferencePreviewUrls();
  state.creative = structuredClone(defaultState.creative);
  state.flags.creativeBriefReady = false;
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
  return `<button class="${state.route === id ? "active" : ""}" data-route="${id}">${label}</button>`;
}

function projectScreen() {
  return `
    <div class="screen-grid">
      <section class="card">
        <h3>Project Summary</h3>
        <div class="field"><label>Project Name</label><input id="project-input" value="${state.projectName}" /></div>
        <div class="field"><label>Show Folder</label><input id="showfolder-input" value="${state.showFolder}" /></div>
        <div class="kv"><div class="k">xLights Version</div><div>${state.flags.xlightsConnected ? "Connected" : "Not connected"}</div></div>
        <div class="kv"><div class="k">Compatibility</div><div>2026.x floor</div></div>
      </section>

      <section class="card">
        <h3>Project-Level Settings</h3>
        <div class="field"><label>xLights Endpoint</label><input id="endpoint-input" value="${state.endpoint}" /></div>
        <div class="field">
          <label>Apply Confirmation Mode</label>
          <select id="confirm-mode-input">
            <option value="large-only" ${state.safety.applyConfirmMode === "large-only" ? "selected" : ""}>Large changes only</option>
            <option value="always" ${state.safety.applyConfirmMode === "always" ? "selected" : ""}>Always confirm</option>
            <option value="never" ${state.safety.applyConfirmMode === "never" ? "selected" : ""}>Never confirm</option>
          </select>
        </div>
        <div class="field">
          <label>Large Change Threshold (approx effects impacted)</label>
          <input id="threshold-input" type="number" min="1" value="${state.safety.largeChangeThreshold}" />
        </div>
        <div class="field">
          <label>Sequence Switch (when unsaved changes exist)</label>
          <select id="sequence-switch-policy-input">
            <option value="save-if-needed" ${state.safety.sequenceSwitchUnsavedPolicy !== "discard-unsaved" ? "selected" : ""}>Save then switch</option>
            <option value="discard-unsaved" ${state.safety.sequenceSwitchUnsavedPolicy === "discard-unsaved" ? "selected" : ""}>Discard and switch</option>
          </select>
        </div>
        <div class="kv"><div class="k">Discovery</div><div>Auto + manual fallback</div></div>
        <div class="kv"><div class="k">Multi-instance</div><div>Latest running</div></div>
        <div class="kv"><div class="k">Retry</div><div>1,2,5,10,15 then 30s</div></div>
        <div class="kv"><div class="k">Backups</div><div>Before apply, keep 20</div></div>
        <div class="row">
          <button id="save-project">Save Settings</button>
          <button id="load-project">Load Project Snapshot</button>
          <button id="reset-project">Reset Project Workspace</button>
          <button id="test-connection">Test Connection</button>
        </div>
      </section>

      <section class="card">
        <h3>Session Actions</h3>
        <div class="row">
          <button id="open-sequence-route">Open Sequence Workspace</button>
          <button id="plan-toggle" ${state.flags.planOnlyForcedByConnectivity ? 'disabled title="Forced while xLights is unavailable"' : ""}>${state.flags.planOnlyMode ? "Exit Plan Only" : "Plan Only"}</button>
          <button id="new-session">New Session</button>
        </div>
        <p class="banner">Active sequence: ${state.activeSequence || "(none)"}</p>
        <p class="banner">Plan-only mode: ${state.flags.planOnlyMode ? (state.flags.planOnlyForcedByConnectivity ? "enabled (forced by connectivity)" : "enabled") : "disabled"}</p>
        <p class="banner">Last sync: ${state.health.lastCheckedAt ? new Date(state.health.lastCheckedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "never"}</p>
      </section>

      <section class="card">
        <h3>Project Health</h3>
        <div class="kv"><div class="k">Last Check</div><div>${state.health.lastCheckedAt ? new Date(state.health.lastCheckedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "Never"}</div></div>
        <div class="kv"><div class="k">Runtime Ready</div><div>${state.health.runtimeReady ? "yes" : "no"}</div></div>
        <div class="kv"><div class="k">File Dialog Bridge</div><div>${state.health.desktopFileDialogReady ? "yes" : "no"}</div></div>
        <div class="kv"><div class="k">Desktop Bridge APIs</div><div>${state.health.desktopBridgeApiCount}</div></div>
        <div class="kv"><div class="k">xLights Version</div><div>${state.health.xlightsVersion || "unknown"}</div></div>
        <div class="kv"><div class="k">Compatibility</div><div>${state.health.compatibilityStatus}</div></div>
        <div class="kv"><div class="k">Capabilities</div><div>${state.health.capabilitiesCount}</div></div>
        <div class="kv"><div class="k">system.executePlan</div><div>${state.health.hasExecutePlan ? "yes" : "no"}</div></div>
        <div class="kv"><div class="k">system.validateCommands</div><div>${state.health.hasValidateCommands ? "yes" : "no"}</div></div>
        <div class="kv"><div class="k">jobs.get</div><div>${state.health.hasJobsGet ? "yes" : "no"}</div></div>
        <div class="kv"><div class="k">Sequence Open</div><div>${state.health.sequenceOpen ? "yes" : "no"}</div></div>
        <div class="row">
          <button id="check-health">Recheck Health</button>
        </div>
      </section>
    </div>
  `;
}

function sequenceScreen() {
  const refs = Array.isArray(state.creative.references) ? state.creative.references : [];
  const brief = state.creative.brief;
  const creativeDisabledReason = creativeAnalysisDisabledReason();
  const creativeEnabled = isCreativeAnalysisEnabled();
  const mode = state.ui.sequenceMode === "new" ? "new" : "existing";
  const briefAt = state.creative.briefUpdatedAt
    ? new Date(state.creative.briefUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";
  return `
    <div class="screen-grid">
      <section class="card">
        <h3>Sequence Setup</h3>
        <div class="field">
          <label>Sequence Mode</label>
          <select id="sequence-mode-input">
            <option value="existing" ${mode === "existing" ? "selected" : ""}>Open Existing Sequence</option>
            <option value="new" ${mode === "new" ? "selected" : ""}>Create New Sequence</option>
          </select>
        </div>
        ${
          mode === "existing"
            ? `<div class="field">
                 <label>Existing Sequence Path</label>
                 <div class="row">
                   <input id="sequence-path-input" value="${state.sequencePathInput}" />
                   <button id="browse-sequence-path">Browse...</button>
                 </div>
               </div>`
            : `
                <div class="field">
                  <label>New Sequence Path</label>
                  <div class="row">
                    <input id="new-sequence-path-input" value="${state.newSequencePathInput}" placeholder="/path/to/NewSequence.xsq" />
                    <button id="browse-new-sequence-path">Browse...</button>
                  </div>
                </div>
                <div class="field">
                  <label>New Sequence Type</label>
                  <select id="new-sequence-type-input">
                    <option value="musical" ${state.newSequenceType === "musical" ? "selected" : ""}>Musical Sequence</option>
                    <option value="animation" ${state.newSequenceType === "animation" ? "selected" : ""}>Animation</option>
                  </select>
                </div>
                <div class="field">
                  <label>Frame Interval (ms)</label>
                  <input id="new-sequence-frame-input" type="number" min="1" value="${state.newSequenceFrameMs}" />
                </div>
                <div class="field">
                  <label>Duration (ms)</label>
                  <input id="new-sequence-duration-input" type="number" min="1" value="${state.newSequenceDurationMs}" />
                </div>
               `
        }
        <div class="field">
          <label>Audio File Path (optional)</label>
          <div class="row">
            <input id="audio-path-input" value="${state.audioPathInput || ""}" placeholder="/path/to/song.mp3 (optional for animation-only)" />
            <button id="browse-audio-path">Browse...</button>
          </div>
        </div>
        <p class="banner">${state.audioPathInput ? `Audio source: ${state.audioPathInput}` : "No audio path set. Sequence can run as animation-only."}</p>
        ${
          mode === "new" && state.newSequenceType === "musical" && !state.audioPathInput
            ? `<p class="banner warning">Musical Sequence mode requires an audio file path.</p>`
            : ""
        }
        <div class="row">
          <button id="open-sequence">${mode === "new" ? "Create in xLights" : "Open in xLights"}</button>
          <button id="restore-last-backup" ${state.lastApplyBackupPath ? "" : "disabled"}>Restore Last Backup</button>
        </div>
        <p class="banner">Saving is handled by xLights native save workflow.</p>
        <p class="banner">Active: ${state.activeSequence || "(none)"}</p>
        <p class="banner">Last backup: ${state.lastApplyBackupPath || "(none)"}</p>
        <p class="banner">Designer media folder: ${designerMediaFolderPath()}</p>
        <p class="banner">Sidecar metadata: ${(state.activeSequence || "sequence").replace(/\.xsq$/, ".xdmeta")}</p>
        <div class="field">
          <label>Recent Sequences</label>
          <ul class="list">
            ${
              state.recentSequences.length
                ? state.recentSequences
                    .map((p) => `<li><button data-recent="${p}">Use</button> ${p}</li>`)
                    .join("")
                : "<li>No recent entries yet.</li>"
            }
          </ul>
        </div>
      </section>

      <section class="card">
        <h3>Creative Analysis Kickoff</h3>
        <div class="field"><label>Goals</label><input id="creative-goals-input" value="${String(state.creative.goals || "").replace(/\"/g, "&quot;")}" placeholder="cinematic but magical, focus on background depth..." /></div>
        <div class="field"><label>Inspiration</label><input id="creative-inspiration-input" value="${String(state.creative.inspiration || "").replace(/\"/g, "&quot;")}" placeholder="starry night, dreamy snowfall, retro synthwave..." /></div>
        <div class="field"><label>Notes</label><textarea id="creative-notes-input" rows="4" placeholder="Any additional direction for the agent...">${String(state.creative.notes || "")}</textarea></div>
        <div class="row">
          <button id="run-creative-analysis" ${creativeEnabled ? "" : "disabled"}>Run Creative Analysis</button>
          <button id="regenerate-creative-brief" ${creativeEnabled ? "" : "disabled"}>Regenerate Brief</button>
          <button id="accept-creative-brief" ${state.flags.creativeBriefReady ? "" : "disabled"}>Accept Brief and Start Design</button>
        </div>
        <p class="banner ${creativeEnabled ? "" : "warning"}">${creativeEnabled ? "Sequence ready for analysis." : creativeDisabledReason}</p>
      </section>

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
        <h3>Creative Brief ${briefAt ? `<span class="banner">(${briefAt})</span>` : ""}</h3>
        ${
          brief
            ? `
                <p><strong>Summary:</strong> ${brief.summary}</p>
                <p><strong>Goals:</strong> ${brief.goalsSummary}</p>
                <p><strong>Inspiration:</strong> ${brief.inspirationSummary}</p>
                <p><strong>Audio Context:</strong> ${brief.audioContext || "-"}</p>
                <p><strong>Sections:</strong> ${Array.isArray(brief.sections) ? brief.sections.join(", ") : "-"}</p>
                <p><strong>Mood/Energy Arc:</strong> ${brief.moodEnergyArc || "-"}</p>
                <p><strong>Narrative Cues:</strong> ${brief.narrativeCues || "-"}</p>
                <p><strong>Visual Cues:</strong> ${brief.visualCues || "-"}</p>
                <p><strong>Hypotheses:</strong></p>
                <ul class="list">
                  ${(Array.isArray(brief.hypotheses) ? brief.hypotheses : []).map((h) => `<li>${h}</li>`).join("")}
                </ul>
                <div class="row">
                  <button id="edit-brief-direction">Edit Brief Direction</button>
                </div>
              `
            : `<p class="banner">No brief generated yet. Run Creative Analysis to populate this panel.</p>`
        }
      </section>
    </div>
  `;
}

function designScreen() {
  const selectedSections = getSelectedSections();
  const allSelected = hasAllSectionsSelected();
  const disabledReason = applyDisabledReason();
  const filtered = state.proposed
    .map((line, idx) => ({ line, idx }))
    .filter((x) => (allSelected ? true : selectedSections.includes(getSectionName(x.line))));
  const list = filtered.map((x) => x.line);
  const proposedRowsVisible = Number.isFinite(Number(state.ui.proposedRowsVisible))
    ? Math.max(DEFAULT_PROPOSED_ROWS, Number(state.ui.proposedRowsVisible))
    : DEFAULT_PROPOSED_ROWS;
  const hasMoreProposed = list.length > proposedRowsVisible;
  const canShowLessProposed = proposedRowsVisible > DEFAULT_PROPOSED_ROWS && list.length > DEFAULT_PROPOSED_ROWS;
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

    <div class="screen-grid design-workspace">
      <section class="card design-column">
        <h3>Designer Chat</h3>
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
          ${CHAT_QUICK_PROMPTS.map((p, idx) => `<button data-quick-prompt="${idx}">${p}</button>`).join("")}
        </div>
        <div class="composer panel-footer-block">
          <input id="chat-input" placeholder="Tell the agent what to change..." value="${(state.ui.chatDraft || "").replace(/\"/g, "&quot;")}" />
          <button id="send-chat">Send</button>
        </div>
      </section>

      <section class="card design-column">
        <h3>Proposed Changes</h3>
        <div class="field panel-window proposed-window"><label>Proposed Next Write</label>
          <select id="proposed-picker" multiple size="${Math.max(8, Math.min(18, proposedRowsVisible + 3))}" class="proposed-picker">
            ${list
              .slice(0, proposedRowsVisible)
              .map((p, idx) => {
                const actualIdx = filtered[idx].idx;
                return `<option value="${actualIdx}">${p
                  .replace(/&/g, "&amp;")
                  .replace(/</g, "&lt;")
                  .replace(/>/g, "&gt;")}</option>`;
              })
                .join("")}
          </select>
        </div>
        <div class="row panel-footer-block">
            <button id="add-proposed-line">Add Line</button>
            <button id="edit-selected-proposed">Edit Selected</button>
            <button id="remove-selected-proposed">Remove Selected</button>
            ${hasMoreProposed ? `<button id="show-more-proposed">Show More</button>` : ""}
            ${canShowLessProposed ? `<button id="show-less-proposed">Show Less</button>` : ""}
        </div>
        <div class="banner impact panel-footer-block">Approx effects impacted: ${list.length * 11}</div>
        <div class="row panel-footer-block">
          <button id="apply" ${applyEnabled() ? "" : "disabled"}>Apply to xLights</button>
          <button id="discard-draft-inline">Discard Draft</button>
          <button id="open-details">Open Details</button>
        </div>
        <div class="banner ${applyEnabled() ? "" : "warning"} panel-footer-block">${applyEnabled() ? "Ready to apply." : disabledReason}</div>
      </section>
    </div>

    <div class="mobile-apply-bar">
      <button id="mobile-apply" ${applyEnabled() ? "" : "disabled"}>Apply to xLights</button>
      <span class="banner ${applyEnabled() ? "" : "warning"}">${applyEnabled() ? "Ready" : disabledReason}</span>
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
  const models = state.models || [];
  const modelOptions = models
    .map((m) => ({ id: modelStableId(m), name: modelDisplayName(m) }))
    .filter((m) => m.id);
  const assignments = state.metadata?.assignments || [];
  const orphans = getMetadataOrphans();
  const tags = state.metadata?.tags || [];
  const filterText = (state.ui.modelFilterText || "").trim().toLowerCase();
  const filteredModels = filterText
    ? models.filter((m) => {
        const name = (m?.name || "").toLowerCase();
        const type = (m?.type || "").toLowerCase();
        return name.includes(filterText) || type.includes(filterText);
      })
    : models;
  return `
    <div class="screen-grid">
      <section class="card">
        <h3>Tag Library</h3>
        <ul class="list">
          ${
            tags.length
              ? tags.map((tag) => `<li>${tag} <button data-remove-tag="${tag.replace(/\"/g, "&quot;")}">Remove</button></li>`).join("")
              : "<li>No tags yet.</li>"
          }
        </ul>
        <div class="field"><label>Add tag</label><input id="metadata-new-tag" value="${state.ui.metadataNewTag || ""}" placeholder="new tag" /></div>
        <button id="metadata-add-tag">Add Tag</button>
      </section>
      <section class="card">
        <h3>Context Assignment</h3>
        <div class="field">
          <label>Target</label>
          <select id="metadata-target-id">
            <option value="">Select model/group...</option>
            ${modelOptions
              .map(
                (m) =>
                  `<option value="${m.id.replace(/\"/g, "&quot;")}" ${state.ui.metadataTargetId === m.id ? "selected" : ""}>${m.name}</option>`
              )
              .join("")}
          </select>
        </div>
        <div class="field"><label>Role</label><select id="metadata-role"><option value="support" ${state.ui.metadataRole === "support" ? "selected" : ""}>support</option><option value="focal" ${state.ui.metadataRole === "focal" ? "selected" : ""}>focal</option><option value="accent" ${state.ui.metadataRole === "accent" ? "selected" : ""}>accent</option></select></div>
        <div class="field"><label>Behavior</label><select id="metadata-behavior"><option value="steady" ${state.ui.metadataBehavior === "steady" ? "selected" : ""}>steady</option><option value="pulse" ${state.ui.metadataBehavior === "pulse" ? "selected" : ""}>pulse</option><option value="swell" ${state.ui.metadataBehavior === "swell" ? "selected" : ""}>swell</option></select></div>
        <div class="field"><label>Primary Tag (optional)</label><input id="metadata-tag-draft" value="${state.ui.metadataTagDraft || ""}" placeholder="tag" /></div>
        <button id="metadata-apply-assignment">Apply</button>
        <ul class="list" style="margin-top:10px;">
          ${
            assignments.length
              ? assignments
                  .map(
                    (a) =>
                      `<li><strong>${a.targetName || a.targetId}</strong> | role:${a.role || "-"} | behavior:${a.behavior || "-"}${(a.tags || []).length ? ` | tags:${a.tags.join(",")}` : ""} <button data-remove-assignment="${String(a.targetId).replace(/\"/g, "&quot;")}">Remove</button></li>`
                  )
                  .join("")
              : "<li>No assignments yet.</li>"
          }
        </ul>
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

    <section class="card" style="margin-top:12px;">
      <h3>Live Models (${filteredModels.length}/${models.length})</h3>
      <div class="field">
        <label>Model Filter</label>
        <input id="model-filter-input" value="${state.ui.modelFilterText || ""}" placeholder="Search by name or type..." />
      </div>
      <div class="row">
        <button id="refresh-models">Refresh Models</button>
      </div>
      <ul class="list">
        ${
          filteredModels.length
            ? filteredModels
                .slice(0, 40)
                .map(
                  (m) =>
                    `<li><strong>${m.name || "(unnamed)"}</strong> ${m.type ? `(${m.type})` : ""} <button data-insert-model="${(m.name || "").replace(/\"/g, "&quot;")}">Insert Into Draft</button></li>`
                )
                .join("")
            : "<li>No models loaded. Use Refresh/Health check.</li>"
        }
      </ul>
    </section>
  `;
}

function screenContent() {
  if (state.route === "project") return projectScreen();
  if (state.route === "sequence") return sequenceScreen();
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

  const refreshBtn = app.querySelector("#refresh-btn");
  if (refreshBtn) refreshBtn.addEventListener("click", onRefresh);

  const openDiagnosticsBtn = app.querySelector("#open-diagnostics");
  if (openDiagnosticsBtn) openDiagnosticsBtn.addEventListener("click", () => toggleDiagnostics(true));

  const openJobsBtn = app.querySelector("#open-jobs");
  if (openJobsBtn) openJobsBtn.addEventListener("click", () => toggleJobs(true));

  const statusViewDetailsBtn = app.querySelector("#status-view-details");
  if (statusViewDetailsBtn) statusViewDetailsBtn.addEventListener("click", () => toggleDiagnostics(true));

  const closeDiagnosticsBtn = app.querySelector("#close-diagnostics");
  if (closeDiagnosticsBtn) closeDiagnosticsBtn.addEventListener("click", () => toggleDiagnostics(false));

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

  const applyBtn = app.querySelector("#apply");
  if (applyBtn) applyBtn.addEventListener("click", onApply);

  const mobileApplyBtn = app.querySelector("#mobile-apply");
  if (mobileApplyBtn) mobileApplyBtn.addEventListener("click", onApply);

  const openDetailsBtn = app.querySelector("#open-details");
  if (openDetailsBtn) openDetailsBtn.addEventListener("click", openDetails);

  const closeDetailsBtn = app.querySelector("#close-details");
  if (closeDetailsBtn) closeDetailsBtn.addEventListener("click", closeDetails);

  const drawerApplyBtn = app.querySelector("#drawer-apply");
  if (drawerApplyBtn) drawerApplyBtn.addEventListener("click", onApply);

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

  const saveProjectBtn = app.querySelector("#save-project");
  if (saveProjectBtn) saveProjectBtn.addEventListener("click", onSaveProjectSettings);

  const openSequenceRouteBtn = app.querySelector("#open-sequence-route");
  if (openSequenceRouteBtn) openSequenceRouteBtn.addEventListener("click", () => setRoute("sequence"));

  const loadProjectBtn = app.querySelector("#load-project");
  if (loadProjectBtn) loadProjectBtn.addEventListener("click", onLoadProjectSnapshot);

  const resetProjectBtn = app.querySelector("#reset-project");
  if (resetProjectBtn) resetProjectBtn.addEventListener("click", onResetProjectWorkspace);

  const openSequenceBtn = app.querySelector("#open-sequence");
  if (openSequenceBtn) openSequenceBtn.addEventListener("click", onOpenSequence);

  const restoreLastBackupBtn = app.querySelector("#restore-last-backup");
  if (restoreLastBackupBtn) restoreLastBackupBtn.addEventListener("click", onRestoreLastBackup);

  const closeSequenceBtn = app.querySelector("#close-sequence");
  if (closeSequenceBtn) closeSequenceBtn.addEventListener("click", onCloseSequence);

  const browseSequenceBtn = app.querySelector("#browse-sequence-path");
  if (browseSequenceBtn) browseSequenceBtn.addEventListener("click", onBrowseExistingSequencePath);

  const browseNewSequenceBtn = app.querySelector("#browse-new-sequence-path");
  if (browseNewSequenceBtn) browseNewSequenceBtn.addEventListener("click", onBrowseNewSequencePath);

  const browseAudioBtn = app.querySelector("#browse-audio-path");
  if (browseAudioBtn) browseAudioBtn.addEventListener("click", onBrowseAudioPath);

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

  const addReferenceMediaBtn = app.querySelector("#add-reference-media");
  if (addReferenceMediaBtn) addReferenceMediaBtn.addEventListener("click", onReferenceMediaSelected);

  const runCreativeAnalysisBtn = app.querySelector("#run-creative-analysis");
  if (runCreativeAnalysisBtn) runCreativeAnalysisBtn.addEventListener("click", onRunCreativeAnalysis);

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

  const checkHealthBtn = app.querySelector("#check-health");
  if (checkHealthBtn) checkHealthBtn.addEventListener("click", onCheckHealth);

  const refreshModelsBtn = app.querySelector("#refresh-models");
  if (refreshModelsBtn) refreshModelsBtn.addEventListener("click", onRefreshModels);

  const modelFilterInput = app.querySelector("#model-filter-input");
  if (modelFilterInput) {
    modelFilterInput.addEventListener("input", () => setModelFilterText(modelFilterInput.value));
  }

  const metadataNewTagInput = app.querySelector("#metadata-new-tag");
  if (metadataNewTagInput) {
    metadataNewTagInput.addEventListener("input", () => {
      state.ui.metadataNewTag = metadataNewTagInput.value;
      persist();
    });
  }

  const metadataAddTagBtn = app.querySelector("#metadata-add-tag");
  if (metadataAddTagBtn) metadataAddTagBtn.addEventListener("click", addMetadataTag);

  const metadataTargetSelect = app.querySelector("#metadata-target-id");
  if (metadataTargetSelect) {
    metadataTargetSelect.addEventListener("change", () => {
      state.ui.metadataTargetId = metadataTargetSelect.value;
      persist();
    });
  }

  const metadataRoleSelect = app.querySelector("#metadata-role");
  if (metadataRoleSelect) {
    metadataRoleSelect.addEventListener("change", () => {
      state.ui.metadataRole = metadataRoleSelect.value;
      persist();
    });
  }

  const metadataBehaviorSelect = app.querySelector("#metadata-behavior");
  if (metadataBehaviorSelect) {
    metadataBehaviorSelect.addEventListener("change", () => {
      state.ui.metadataBehavior = metadataBehaviorSelect.value;
      persist();
    });
  }

  const metadataTagDraftInput = app.querySelector("#metadata-tag-draft");
  if (metadataTagDraftInput) {
    metadataTagDraftInput.addEventListener("input", () => {
      state.ui.metadataTagDraft = metadataTagDraftInput.value;
      persist();
    });
  }

  const metadataApplyBtn = app.querySelector("#metadata-apply-assignment");
  if (metadataApplyBtn) metadataApplyBtn.addEventListener("click", applyMetadataAssignment);

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

  const seqPathInput = app.querySelector("#sequence-path-input");
  if (seqPathInput) {
    seqPathInput.addEventListener("change", () => {
      state.sequencePathInput = seqPathInput.value.trim() || state.sequencePathInput;
      persist();
    });
  }

  const newSeqPathInput = app.querySelector("#new-sequence-path-input");
  if (newSeqPathInput) {
    newSeqPathInput.addEventListener("change", () => {
      state.newSequencePathInput = newSeqPathInput.value.trim() || state.newSequencePathInput;
      persist();
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

  const sequenceModeInput = app.querySelector("#sequence-mode-input");
  if (sequenceModeInput) {
    sequenceModeInput.addEventListener("change", () => {
      state.ui.sequenceMode = sequenceModeInput.value === "new" ? "new" : "existing";
      persist();
      render();
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

  const addProposedLineBtn = app.querySelector("#add-proposed-line");
  if (addProposedLineBtn) addProposedLineBtn.addEventListener("click", addProposedLine);

  const editSelectedProposedBtn = app.querySelector("#edit-selected-proposed");
  if (editSelectedProposedBtn) editSelectedProposedBtn.addEventListener("click", onEditSelectedProposed);

  const removeSelectedProposedBtn = app.querySelector("#remove-selected-proposed");
  if (removeSelectedProposedBtn) removeSelectedProposedBtn.addEventListener("click", onRemoveSelectedProposed);

  const showMoreProposedBtn = app.querySelector("#show-more-proposed");
  if (showMoreProposedBtn) showMoreProposedBtn.addEventListener("click", onShowMoreProposed);

  const showLessProposedBtn = app.querySelector("#show-less-proposed");
  if (showLessProposedBtn) showLessProposedBtn.addEventListener("click", onShowLessProposed);

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
  const jobCounts = getJobCounts();
  const staleActions = state.flags.proposalStale
    ? `
      <button id="status-refresh">Rebase/Refresh</button>
      <button id="status-regenerate">Regenerate</button>
      <button id="status-cancel">Cancel Draft</button>
    `
    : `<button id="status-view-details">View Details</button>`;

  app.innerHTML = `
    <div class="app-shell">
      <header class="header">
        <div><strong>${state.projectName}</strong> | ${state.activeSequence}</div>
        <div class="header-badge">xLights: ${state.flags.xlightsConnected ? "Connected" : "Disconnected"}</div>
        <div class="header-badge">Revision: ${state.revision}</div>
        <button id="refresh-btn">Refresh</button>
        <button>Review in xLights</button>
        <button id="open-diagnostics">Diagnostics (${diagCounts.total})</button>
        <button id="open-jobs">Jobs (${jobCounts.running}/${jobCounts.total})</button>
      </header>

      <div class="status-bar">
        <div>
          <span class="status-tag ${state.status.level}">${state.status.level}</span>
          <span>${state.status.text}</span>
        </div>
        <div class="row">${staleActions}</div>
      </div>

      <div class="main-grid">
        <nav class="nav">
          ${navButton("project", "Project")}
          ${navButton("sequence", "Sequence")}
          ${navButton("design", "Design")}
          ${navButton("history", "History")}
          ${navButton("metadata", "Metadata")}
        </nav>

        <main class="content">
          ${screenContent()}
          ${state.route === "design" ? detailsDrawer() : ""}
          ${diagnosticsPanel()}
          ${jobsPanel()}
        </main>
      </div>

      <footer class="footer">
        <span>Last sync: ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        <span>Background jobs: ${jobCounts.running} running / ${jobCounts.total} tracked</span>
        <span>Diagnostics: ${diagCounts.warning} warning, ${diagCounts.actionRequired} action-required</span>
      </footer>
    </div>
  `;

  bindEvents();
}

async function bootstrapLiveData() {
  try {
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
  render();
  await bootstrapLiveData();
})();
setInterval(pollRevision, 8000);
setInterval(pollJobs, 3000);
setInterval(pollCompatibilityStatus, 60000);
