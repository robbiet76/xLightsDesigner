import {
  closeSequence,
  cancelJob,
  executePlan,
  getDefaultEndpoint,
  getJob,
  getModels,
  getOpenSequence,
  getRevision,
  getTimingMarks,
  getTimingTracks,
  openSequence,
  saveSequence,
  validateCommands,
  pingCapabilities
} from "./api.js";

const app = document.getElementById("app");
const STORAGE_KEY = "xlightsdesigner.ui.state.v1";
const PROJECTS_KEY = "xlightsdesigner.ui.projects.v1";
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
    largeChangeThreshold: 60
  },
  activeSequence: "",
  sequencePathInput: "",
  savePathInput: "",
  recentSequences: [],
  revision: "unknown",
  health: {
    lastCheckedAt: "",
    capabilitiesCount: 0,
    hasExecutePlan: false,
    hasValidateCommands: false,
    hasJobsGet: false,
    sequenceOpen: false
  },
  draftBaseRevision: "unknown",
  status: { level: "info", text: "Ready. Start in Design or open a sequence." },
  flags: {
    xlightsConnected: false,
    activeSequenceLoaded: false,
    hasDraftProposal: false,
    proposalStale: false,
    applyInProgress: false,
    planOnlyMode: false
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
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
    savePathInput: state.savePathInput,
    recentSequences: state.recentSequences,
    activeSequence: state.activeSequence,
    revision: state.revision,
    draftBaseRevision: state.draftBaseRevision,
    proposed: state.proposed,
    flags: {
      planOnlyMode: state.flags.planOnlyMode
    },
    safety: state.safety,
    ui: {
      sectionSelections: state.ui.sectionSelections,
      designTab: state.ui.designTab,
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
    metadata: state.metadata,
    health: state.health
  };
}

function applyProjectSnapshot(snapshot) {
  if (!snapshot) return;
  state.sequencePathInput = snapshot.sequencePathInput || state.sequencePathInput;
  state.savePathInput = snapshot.savePathInput || state.savePathInput;
  state.recentSequences = Array.isArray(snapshot.recentSequences) ? snapshot.recentSequences : [];
  state.activeSequence = snapshot.activeSequence || state.activeSequence;
  state.revision = snapshot.revision || "unknown";
  state.draftBaseRevision = snapshot.draftBaseRevision || "unknown";
  state.proposed = Array.isArray(snapshot.proposed) ? snapshot.proposed : state.proposed;
  state.flags.planOnlyMode = Boolean(snapshot?.flags?.planOnlyMode);
  state.safety = { ...state.safety, ...(snapshot.safety || {}) };
  state.ui.sectionSelections = Array.isArray(snapshot?.ui?.sectionSelections)
    ? snapshot.ui.sectionSelections
    : ["all"];
  state.ui.designTab = snapshot?.ui?.designTab || "chat";
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

const routes = ["project", "design", "history", "metadata"];

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

function applyEnabled() {
  const f = state.flags;
  return (
    f.hasDraftProposal &&
    f.xlightsConnected &&
    !f.planOnlyMode &&
    !f.proposalStale &&
    !f.applyInProgress
  );
}

function applyDisabledReason() {
  const f = state.flags;
  if (!f.xlightsConnected) return "Connect to xLights to apply.";
  if (f.planOnlyMode) return "Exit plan-only mode to apply.";
  if (f.proposalStale) return "Refresh proposal before apply.";
  if (!f.hasDraftProposal) return "Generate a proposal first.";
  if (f.applyInProgress) return "Apply in progress.";
  return "";
}

function currentImpactCount() {
  return filteredProposed().length * 11;
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
  state.proposed = inferProposalLinesFromIntent(intentText, selected);
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
    const open = await getOpenSequence(state.endpoint);
    const seq = open?.data?.sequence;
    state.flags.activeSequenceLoaded = Boolean(open?.data?.isOpen && seq);
    state.health.sequenceOpen = Boolean(open?.data?.isOpen);
    if (seq?.name) state.activeSequence = seq.name;

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
  } catch (err) {
    state.flags.xlightsConnected = false;
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
    state.flags.xlightsConnected = true;
    const commands = Array.isArray(caps?.data?.commands) ? caps.data.commands : [];
    const count = commands.length;
    state.health = {
      ...state.health,
      lastCheckedAt: new Date().toISOString(),
      capabilitiesCount: count,
      hasExecutePlan: commands.includes("system.executePlan"),
      hasValidateCommands: commands.includes("system.validateCommands"),
      hasJobsGet: commands.includes("jobs.get")
    };
    setStatus(
      "info",
      endpointChanged
        ? `Connected via fallback endpoint ${endpoint}. ${count} commands reported by xLights.`
        : `Connected. ${count} commands reported by xLights.`
    );
    await onRefresh();
    return;
  } catch (err) {
    state.flags.xlightsConnected = false;
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
    const commands = caps?.data?.commands || [];
    state.health = {
      lastCheckedAt: new Date().toISOString(),
      capabilitiesCount: commands.length,
      hasExecutePlan: commands.includes("system.executePlan"),
      hasValidateCommands: commands.includes("system.validateCommands"),
      hasJobsGet: commands.includes("jobs.get"),
      sequenceOpen: Boolean(open?.data?.isOpen)
    };
    state.models = Array.isArray(modelsResp?.data?.models) ? modelsResp.data.models : [];
    ensureMetadataTargetSelection();
    try {
      await fetchSectionSuggestions();
    } catch (err) {
      setStatusWithDiagnostics("warning", `Section refresh failed: ${err.message}`);
    }
    state.revision = rev?.data?.revision ?? state.revision;
    setStatus("info", "Health check complete.");
  } catch (err) {
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
  addChatMessage("agent", "Captured. I will update the proposal scope and regenerate when requested.");
  saveCurrentProjectSnapshot();
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
  const savePathInput = app.querySelector("#save-path-input");
  const confirmModeInput = app.querySelector("#confirm-mode-input");
  const thresholdInput = app.querySelector("#threshold-input");

  if (projectInput) state.projectName = projectInput.value.trim() || state.projectName;
  if (showFolderInput) state.showFolder = showFolderInput.value.trim() || state.showFolder;
  if (endpointInput) state.endpoint = endpointInput.value.trim() || getDefaultEndpoint();
  if (savePathInput) state.savePathInput = savePathInput.value.trim() || state.savePathInput;
  if (confirmModeInput) state.safety.applyConfirmMode = confirmModeInput.value;
  if (thresholdInput) {
    const parsed = Number.parseInt(thresholdInput.value, 10);
    state.safety.largeChangeThreshold = Number.isFinite(parsed) ? parsed : state.safety.largeChangeThreshold;
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
  const seqPathInput = app.querySelector("#sequence-path-input");
  if (seqPathInput) {
    state.sequencePathInput = seqPathInput.value.trim() || state.sequencePathInput;
  }
}

function syncSavePathInput() {
  const savePathInput = app.querySelector("#save-path-input");
  if (savePathInput) {
    state.savePathInput = savePathInput.value.trim() || state.savePathInput;
  }
}

async function onOpenSequence() {
  syncSequencePathInput();
  if (!state.flags.xlightsConnected) {
    setStatus("warning", "Connect to xLights before opening a sequence.");
    return render();
  }
  if (!state.sequencePathInput) {
    setStatus("warning", "Provide a sequence path.");
    return render();
  }

  setStatus("info", "Opening sequence...");
  render();
  try {
    const body = await openSequence(state.endpoint, state.sequencePathInput, true, false);
    const seq = body?.data || {};
    const name = seq.name || state.sequencePathInput.split("/").pop() || state.activeSequence;
    state.activeSequence = name;
    state.savePathInput = state.sequencePathInput;
    state.flags.activeSequenceLoaded = true;
    addRecentSequence(state.sequencePathInput);
    await onRefresh();
    setStatus("info", `Opened sequence: ${name}`);
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

async function onSaveSequence(asSaveAs = false) {
  if (!state.flags.xlightsConnected) {
    setStatusWithDiagnostics("warning", "Connect to xLights before saving.");
    return render();
  }
  syncSavePathInput();
  const target = asSaveAs ? state.savePathInput : null;
  if (asSaveAs && !target) {
    setStatusWithDiagnostics("warning", "Provide a save path for Save As.");
    return render();
  }

  setStatus("info", asSaveAs ? "Saving sequence (Save As)..." : "Saving sequence...");
  render();
  try {
    const body = await saveSequence(state.endpoint, target);
    const savedFile = body?.data?.file || target || "(current path)";
    if (asSaveAs) {
      state.sequencePathInput = savedFile;
      state.savePathInput = savedFile;
      addRecentSequence(savedFile);
    }
    setStatus("info", `Sequence saved: ${savedFile}`);
  } catch (err) {
    setStatusWithDiagnostics("action-required", `Save failed: ${err.message}`, err.stack || "");
  } finally {
    saveCurrentProjectSnapshot();
    persist();
    render();
  }
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
  state.savePathInput = defaultState.savePathInput;
  state.recentSequences = [];
  state.revision = "unknown";
  state.draftBaseRevision = "unknown";
  state.proposed = [...defaultState.proposed];
  state.flags.planOnlyMode = false;
  state.flags.hasDraftProposal = state.proposed.length > 0;
  state.flags.proposalStale = false;
  state.ui.sectionSelections = ["all"];
  state.ui.designTab = "chat";
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
    setStatus("info", "Sequence closed.");
  } catch (err) {
    setStatusWithDiagnostics("action-required", `Close failed: ${err.message}`, err.stack || "");
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
        <h3>Sequence Workspace</h3>
        <div class="field">
          <label>Sequence Path</label>
          <input id="sequence-path-input" value="${state.sequencePathInput}" />
        </div>
        <div class="field">
          <label>Save Path (for Save As)</label>
          <input id="save-path-input" value="${state.savePathInput}" />
        </div>
        <div class="row">
          <button id="open-sequence">Open Sequence</button>
          <button id="save-sequence">Save</button>
          <button id="save-sequence-as">Save As</button>
          <button id="close-sequence">Close Sequence</button>
          <button id="refresh-recents">Refresh Recents</button>
          <button id="new-session">New Session</button>
        </div>
        <p class="banner">Active: ${state.activeSequence}</p>
        <p class="banner">Sidecar: ${state.activeSequence.replace(/\.xsq$/, ".xdmeta")}</p>
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
          <button>Resume Last</button>
          <button id="plan-toggle">${state.flags.planOnlyMode ? "Exit Plan Only" : "Plan Only"}</button>
          <button>Open in xLights</button>
        </div>
        <p class="banner">One active sequence at a time.</p>
      </section>

      <section class="card">
        <h3>Project Health</h3>
        <div class="kv"><div class="k">Last Check</div><div>${state.health.lastCheckedAt ? new Date(state.health.lastCheckedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "Never"}</div></div>
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

  const planBtn = app.querySelector("#plan-toggle");
  if (planBtn) planBtn.addEventListener("click", onTogglePlanOnly);

  const connectionBtn = app.querySelector("#test-connection");
  if (connectionBtn) connectionBtn.addEventListener("click", onTestConnection);

  const saveProjectBtn = app.querySelector("#save-project");
  if (saveProjectBtn) saveProjectBtn.addEventListener("click", onSaveProjectSettings);

  const loadProjectBtn = app.querySelector("#load-project");
  if (loadProjectBtn) loadProjectBtn.addEventListener("click", onLoadProjectSnapshot);

  const resetProjectBtn = app.querySelector("#reset-project");
  if (resetProjectBtn) resetProjectBtn.addEventListener("click", onResetProjectWorkspace);

  const openSequenceBtn = app.querySelector("#open-sequence");
  if (openSequenceBtn) openSequenceBtn.addEventListener("click", onOpenSequence);

  const saveSequenceBtn = app.querySelector("#save-sequence");
  if (saveSequenceBtn) saveSequenceBtn.addEventListener("click", () => onSaveSequence(false));

  const saveSequenceAsBtn = app.querySelector("#save-sequence-as");
  if (saveSequenceAsBtn) saveSequenceAsBtn.addEventListener("click", () => onSaveSequence(true));

  const closeSequenceBtn = app.querySelector("#close-sequence");
  if (closeSequenceBtn) closeSequenceBtn.addEventListener("click", onCloseSequence);

  const newSessionBtn = app.querySelector("#new-session");
  if (newSessionBtn) newSessionBtn.addEventListener("click", onNewSession);

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

  const savePathInput = app.querySelector("#save-path-input");
  if (savePathInput) {
    savePathInput.addEventListener("change", () => {
      state.savePathInput = savePathInput.value.trim() || state.savePathInput;
      persist();
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
    const commands = Array.isArray(caps?.data?.commands) ? caps.data.commands : [];
    state.flags.xlightsConnected = true;
    state.health = {
      ...state.health,
      lastCheckedAt: new Date().toISOString(),
      capabilitiesCount: commands.length,
      hasExecutePlan: commands.includes("system.executePlan"),
      hasValidateCommands: commands.includes("system.validateCommands"),
      hasJobsGet: commands.includes("jobs.get")
    };
    if (endpointChanged) {
      setStatus("info", `Connected via fallback endpoint ${endpoint}.`);
    }
    await onRefresh();
  } catch {
    state.flags.xlightsConnected = false;
    setStatus("warning", "Unable to reach xLights. Start xLights and check endpoint settings.");
    persist();
    render();
  }
}

render();
bootstrapLiveData();
setInterval(pollRevision, 8000);
setInterval(pollJobs, 3000);
