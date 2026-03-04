import {
  executePlan,
  getDefaultEndpoint,
  getOpenSequence,
  getRevision,
  openSequence,
  validateCommands,
  pingCapabilities
} from "./api.js";

const app = document.getElementById("app");
const STORAGE_KEY = "xlightsdesigner.ui.state.v1";

const defaultState = {
  route: "project",
  endpoint: getDefaultEndpoint(),
  projectName: "Holiday 2026",
  showFolder: "/Users/robterry/Desktop/Show",
  activeSequence: "CarolOfTheBells.xsq",
  sequencePathInput: "/Users/robterry/Desktop/Show/Sequences/CarolOfTheBells.xsq",
  recentSequences: [],
  revision: "unknown",
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
    designTab: "chat"
  },
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

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
    setStatus("warning", applyDisabledReason());
    return render();
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
      throw new Error("Plan validation failed. Review proposal details and retry.");
    }
    const result = await executePlan(state.endpoint, plan, true);
    const executed = result?.data?.executedCount ?? 0;
    try {
      const postRev = await getRevision(state.endpoint);
      state.revision = postRev?.data?.revision ?? state.revision;
    } catch {
      // Keep prior revision if post-apply readback is unavailable.
    }
    state.draftBaseRevision = state.revision;
    state.flags.proposalStale = false;
    bumpVersion("Applied draft proposal", state.proposed.length * 11);
    setStatus("info", `Applied via system.executePlan (${executed} steps).`);
  } catch (err) {
    setStatus("action-required", `Apply blocked: ${err.message}`);
  } finally {
    state.flags.applyInProgress = false;
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
  persist();
  render();
}

async function onRefresh() {
  try {
    let staleDetected = false;
    const open = await getOpenSequence(state.endpoint);
    const seq = open?.data?.sequence;
    state.flags.activeSequenceLoaded = Boolean(open?.data?.isOpen && seq);
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
        setStatus("warning", "Sequence changed since draft creation. Refresh proposal before apply.");
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
    setStatus("warning", `Refresh failed: ${err.message}`);
  }
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
    const count = Array.isArray(caps?.data?.commands) ? caps.data.commands.length : 0;
    setStatus("info", `Connected. ${count} commands reported by xLights.`);
    await onRefresh();
    return;
  } catch (err) {
    state.flags.xlightsConnected = false;
    setStatus("action-required", `Connection failed: ${err.message}`);
  }
  persist();
  render();
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
        setStatus("warning", "Detected external sequence edits. Draft marked stale.");
      }
      persist();
      render();
    }
  } catch {
    // Ignore polling failures and rely on explicit refresh/test actions.
  }
}

function onRegenerate() {
  onGenerate();
}

function onCancelDraft() {
  state.flags.hasDraftProposal = false;
  state.flags.proposalStale = false;
  state.proposed = [];
  state.ui.detailsOpen = false;
  state.ui.sectionFilter = "all";
  setStatus("info", "Draft canceled.");
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
  persist();
  render();
}

function onSaveProjectSettings() {
  const projectInput = app.querySelector("#project-input");
  const showFolderInput = app.querySelector("#showfolder-input");
  const endpointInput = app.querySelector("#endpoint-input");

  if (projectInput) state.projectName = projectInput.value.trim() || state.projectName;
  if (showFolderInput) state.showFolder = showFolderInput.value.trim() || state.showFolder;
  if (endpointInput) state.endpoint = endpointInput.value.trim() || getDefaultEndpoint();

  setStatus("info", "Project settings saved.");
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
    state.flags.activeSequenceLoaded = true;
    addRecentSequence(state.sequencePathInput);
    await onRefresh();
    setStatus("info", `Opened sequence: ${name}`);
  } catch (err) {
    setStatus("action-required", `Open failed: ${err.message}`);
    render();
  } finally {
    persist();
    render();
  }
}

function onUseRecent(path) {
  state.sequencePathInput = path;
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
        <div class="row">
          <button id="open-sequence">Open Sequence</button>
          <button id="refresh-recents">Refresh Recents</button>
          <button>New Session</button>
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
        <div class="kv"><div class="k">Discovery</div><div>Auto + manual fallback</div></div>
        <div class="kv"><div class="k">Multi-instance</div><div>Latest running</div></div>
        <div class="kv"><div class="k">Retry</div><div>1,2,5,10,15 then 30s</div></div>
        <div class="kv"><div class="k">Backups</div><div>Before apply, keep 20</div></div>
        <div class="row">
          <button id="save-project">Save Settings</button>
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
    </div>
  `;
}

function designScreen() {
  const disabledReason = applyDisabledReason();
  const list = filteredProposed();
  return `
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
          <ol class="list">
            ${list.slice(0, 5).map((p) => `<li>${p}</li>`).join("")}
          </ol>
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
  const list = filteredProposed();
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
        ${list.map((p) => `<li>${p}</li>`).join("")}
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

function bindEvents() {
  app.querySelectorAll("[data-route]").forEach((btn) => {
    btn.addEventListener("click", () => setRoute(btn.dataset.route));
  });

  const refreshBtn = app.querySelector("#refresh-btn");
  if (refreshBtn) refreshBtn.addEventListener("click", onRefresh);

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

  const openSequenceBtn = app.querySelector("#open-sequence");
  if (openSequenceBtn) openSequenceBtn.addEventListener("click", onOpenSequence);

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

  const staleRefreshBtn = app.querySelector("#status-refresh");
  if (staleRefreshBtn) staleRefreshBtn.addEventListener("click", onRefresh);

  const staleRegenBtn = app.querySelector("#status-regenerate");
  if (staleRegenBtn) staleRegenBtn.addEventListener("click", onRegenerate);

  const staleCancelBtn = app.querySelector("#status-cancel");
  if (staleCancelBtn) staleCancelBtn.addEventListener("click", onCancelDraft);

  app.querySelectorAll("[data-section]").forEach((btn) => {
    btn.addEventListener("click", () => setSectionFilter(btn.dataset.section));
  });

  app.querySelectorAll("[data-design-tab]").forEach((btn) => {
    btn.addEventListener("click", () => setDesignTab(btn.dataset.designTab));
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
  const staleActions = state.flags.proposalStale
    ? `
      <button id="status-refresh">Rebase/Refresh</button>
      <button id="status-regenerate">Regenerate</button>
      <button id="status-cancel">Cancel Draft</button>
    `
    : `<button>View Details</button>`;

  app.innerHTML = `
    <div class="app-shell">
      <header class="header">
        <div><strong>${state.projectName}</strong> | ${state.activeSequence}</div>
        <div class="header-badge">xLights: ${state.flags.xlightsConnected ? "Connected" : "Disconnected"}</div>
        <div class="header-badge">Revision: ${state.revision}</div>
        <button id="refresh-btn">Refresh</button>
        <button>Review in xLights</button>
        <button>Diagnostics</button>
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

        <main class="content">${screenContent()} ${state.route === "design" ? detailsDrawer() : ""}</main>
      </div>

      <footer class="footer">
        <span>Last sync: ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        <span>Background jobs: 0</span>
        <span>Diagnostics: ${state.flags.xlightsConnected ? "connected" : "not connected"}</span>
      </footer>
    </div>
  `;

  bindEvents();
}

render();
setInterval(pollRevision, 8000);
