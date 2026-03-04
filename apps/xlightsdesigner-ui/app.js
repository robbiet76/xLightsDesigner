import {
  closeSequence,
  cancelJob,
  executePlan,
  getDefaultEndpoint,
  getJob,
  getOpenSequence,
  getRevision,
  openSequence,
  saveSequence,
  validateCommands,
  pingCapabilities
} from "./api.js";

const app = document.getElementById("app");
const STORAGE_KEY = "xlightsdesigner.ui.state.v1";
const PROJECTS_KEY = "xlightsdesigner.ui.projects.v1";

const defaultState = {
  route: "project",
  endpoint: getDefaultEndpoint(),
  projectName: "Holiday 2026",
  showFolder: "/Users/robterry/Desktop/Show",
  safety: {
    applyConfirmMode: "large-only",
    largeChangeThreshold: 60
  },
  activeSequence: "CarolOfTheBells.xsq",
  sequencePathInput: "/Users/robterry/Desktop/Show/Sequences/CarolOfTheBells.xsq",
  savePathInput: "/Users/robterry/Desktop/Show/Sequences/CarolOfTheBells.xsq",
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
    activeSequenceLoaded: true,
    hasDraftProposal: true,
    proposalStale: false,
    applyInProgress: false,
    planOnlyMode: false
  },
  chat: [
    { who: "user", text: "Reduce twinkle intensity on candy canes in chorus 2." },
    { who: "agent", text: "Draft updated. I focused changes to chorus 2 labels only." }
  ],
  proposed: [
    "Chorus 2 / CandyCanes / reduce twinkle 35%",
    "Chorus 2 / XD:Mood / mark as calmer pulse",
    "Chorus 2 / Roofline / soften sparkle saturation"
  ],
  ui: {
    detailsOpen: false,
    sectionFilter: "all",
    designTab: "chat",
    diagnosticsOpen: false,
    jobsOpen: false,
    diagnosticsFilter: "all"
  },
  diagnostics: [],
  jobs: [],
  versions: [
    { id: "v18", summary: "Reduce chorus 2 twinkle", effects: 34, time: "11:05" },
    { id: "v17", summary: "Boost verse 1 energy", effects: 22, time: "10:53" },
    { id: "v16", summary: "Initial pass", effects: 120, time: "10:22" }
  ],
  selectedVersion: "v18",
  compareVersion: null
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(defaultState),
      ...parsed,
      flags: { ...defaultState.flags, ...(parsed.flags || {}) },
      ui: { ...defaultState.ui, ...(parsed.ui || {}) }
    };
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
      sectionFilter: state.ui.sectionFilter,
      designTab: state.ui.designTab
    },
    diagnostics: state.diagnostics,
    jobs: state.jobs
    ,
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
  state.ui.sectionFilter = snapshot?.ui?.sectionFilter || "all";
  state.ui.designTab = snapshot?.ui?.designTab || "chat";
  state.diagnostics = Array.isArray(snapshot.diagnostics) ? snapshot.diagnostics : state.diagnostics;
  state.jobs = Array.isArray(snapshot.jobs) ? snapshot.jobs : state.jobs;
  state.health = { ...state.health, ...(snapshot.health || {}) };
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

function getSections() {
  const sections = Array.from(new Set(state.proposed.map(getSectionName)));
  return sections.length > 0 ? sections : ["General"];
}

function filteredProposed() {
  if (state.ui.sectionFilter === "all") return state.proposed;
  return state.proposed.filter((item) => getSectionName(item) === state.ui.sectionFilter);
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
    throw new Error("No proposed changes available for current section filter.");
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
  } catch (err) {
    setStatusWithDiagnostics("action-required", `Apply blocked: ${err.message}`, err.stack || "");
  } finally {
    state.flags.applyInProgress = false;
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

  state.flags.hasDraftProposal = true;
  state.flags.proposalStale = false;
  state.draftBaseRevision = state.revision;
  state.ui.sectionFilter = "all";
  setStatus("info", "Proposal refreshed from current intent.");
  state.proposed = [
    "Chorus 2 / CandyCanes / reduce twinkle 35%",
    "Chorus 2 / XD:Energy / taper transition",
    "Verse 1 / MegaTree / preserve current look"
  ];
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
  if (endpointInput) state.endpoint = endpointInput.value.trim() || getDefaultEndpoint();

  setStatus("info", "Testing xLights endpoint...");
  render();

  try {
    const caps = await pingCapabilities(state.endpoint);
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
    setStatus("info", `Connected. ${count} commands reported by xLights.`);
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
    const [caps, open, rev] = await Promise.all([
      pingCapabilities(state.endpoint),
      getOpenSequence(state.endpoint),
      getRevision(state.endpoint).catch(() => ({ data: { revision: "unknown" } }))
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
  state.ui.sectionFilter = "all";
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
  state.ui.sectionFilter = "all";
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
  state.ui.sectionFilter = section;
  persist();
  render();
}

function setDesignTab(tab) {
  if (!["chat", "intent", "proposed"].includes(tab)) return;
  state.ui.designTab = tab;
  persist();
  render();
}

function splitBySection() {
  const section = state.ui.sectionFilter;
  if (section === "all") {
    setStatus("warning", "Choose a section first.");
    return render();
  }
  state.proposed = state.proposed.filter((item) => getSectionName(item) === section);
  setStatus("info", `Draft narrowed to section: ${section}`);
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
  state.proposed.push("New Section / ModelGroup / describe change");
  state.flags.hasDraftProposal = true;
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
  state.ui.sectionFilter = "all";
  state.ui.designTab = "chat";
  state.ui.detailsOpen = false;
  state.diagnostics = [];
  state.jobs = [];

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
  state.ui.sectionFilter = "all";
  state.ui.designTab = "chat";
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
  const disabledReason = applyDisabledReason();
  const filtered = state.proposed
    .map((line, idx) => ({ line, idx }))
    .filter((x) => state.ui.sectionFilter === "all" || getSectionName(x.line) === state.ui.sectionFilter);
  const list = filtered.map((x) => x.line);
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

    <div class="design-tabs">
      <button data-design-tab="chat" class="${state.ui.designTab === "chat" ? "active-chip" : ""}">Chat</button>
      <button data-design-tab="intent" class="${state.ui.designTab === "intent" ? "active-chip" : ""}">Intent</button>
      <button data-design-tab="proposed" class="${state.ui.designTab === "proposed" ? "active-chip" : ""}">Proposed</button>
    </div>

    <div class="design-panels">
      <section class="card design-panel ${state.ui.designTab === "chat" ? "active" : ""}" data-panel="chat">
        <h3>Chat Thread</h3>
        <ul class="list">
          ${state.chat.map((c) => `<li><strong>${c.who}:</strong> ${c.text}</li>`).join("")}
        </ul>
      </section>

      <section class="card design-panel ${state.ui.designTab === "intent" ? "active" : ""}" data-panel="intent">
        <h3>Intent</h3>
        <div class="field"><label>Scope</label><select><option>Selected Range</option><option>Entire Sequence</option><option>Models</option></select></div>
        <div class="field"><label>Range / Label</label><input value="chorus-2" /></div>
        <div class="row">
          <div class="field" style="flex:1"><label>Mood</label><input value="calmer" /></div>
          <div class="field" style="flex:1"><label>Energy</label><input value="medium" /></div>
          <div class="field" style="flex:1"><label>Priority</label><input value="preserve look" /></div>
        </div>
      </section>

      <section class="card design-panel proposed ${state.ui.designTab === "proposed" ? "active" : ""}" data-panel="proposed">
        <h3>Proposed Next Write</h3>
        <div class="field"><label>Proposed Next Write</label>
          <ul class="list editable-list">
            ${list
              .slice(0, 5)
              .map((p, idx) => {
                const actualIdx = filtered[idx].idx;
                return `<li>
                  <input data-proposed-input="${actualIdx}" value="${p.replace(/\"/g, "&quot;")}" />
                  <button data-proposed-remove="${actualIdx}">Remove</button>
                </li>`;
              })
              .join("")}
          </ul>
          <div class="row">
            <button id="add-proposed-line">Add Line</button>
          </div>
          <div class="banner impact">Approx effects impacted: ${list.length * 11}</div>
        </div>
        <div class="composer">
          <input id="chat-input" placeholder="Type request..." value="Change chorus 2 candy canes to twinkle less" />
          <button id="generate">Generate/Refresh</button>
          <button id="apply" ${applyEnabled() ? "" : "disabled"}>Apply to xLights</button>
          <button id="open-details">Open Details</button>
        </div>
        <div class="banner ${applyEnabled() ? "" : "warning"}">${applyEnabled() ? "Ready to apply." : disabledReason}</div>
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
  const filtered = state.proposed
    .map((line, idx) => ({ line, idx }))
    .filter((x) => state.ui.sectionFilter === "all" || getSectionName(x.line) === state.ui.sectionFilter);
  const list = filtered.map((x) => x.line);
  return `
    <section class="card details-drawer">
      <h3>Proposal Detail</h3>
      <div class="banner impact">Approx effects impacted: ${list.length * 11}</div>
      <div class="banner">Revision base: ${state.draftBaseRevision}</div>
      <div class="row" style="margin-top:8px;">
        <button data-section="all" class="${state.ui.sectionFilter === "all" ? "active-chip" : ""}">All Sections</button>
        ${sections
          .map(
            (s) =>
              `<button data-section="${s}" class="${state.ui.sectionFilter === s ? "active-chip" : ""}">${s}</button>`
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
  return `
    <div class="screen-grid">
      <section class="card">
        <h3>Tag Library</h3>
        <ul class="list">
          <li>focal</li>
          <li>rhythm-driver</li>
          <li>ambient-fill</li>
        </ul>
        <div class="field"><label>Add tag</label><input placeholder="new tag" /></div>
      </section>
      <section class="card">
        <h3>Context Assignment</h3>
        <div class="field"><label>Target</label><input value="CandyCanes Group" /></div>
        <div class="field"><label>Role</label><select><option>support</option><option>focal</option><option>accent</option></select></div>
        <div class="field"><label>Behavior</label><select><option>steady</option><option>pulse</option><option>swell</option></select></div>
        <button>Apply</button>
      </section>
    </div>
    <section class="card" style="margin-top:12px;">
      <h3>Orphaned Metadata</h3>
      <p class="warning">3 entries need mapping to current model identities.</p>
      <button>View Details</button>
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

  const generateBtn = app.querySelector("#generate");
  if (generateBtn) generateBtn.addEventListener("click", onGenerate);

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

render();
setInterval(pollRevision, 8000);
setInterval(pollJobs, 3000);
