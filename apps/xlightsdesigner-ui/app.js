import {
  executePlan,
  getDefaultEndpoint,
  getOpenSequence,
  getRevision,
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
  revision: "unknown",
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
  versions: [
    { id: "v18", summary: "Reduce chorus 2 twinkle", effects: 34, time: "11:05" },
    { id: "v17", summary: "Boost verse 1 energy", effects: 22, time: "10:53" },
    { id: "v16", summary: "Initial pass", effects: 120, time: "10:22" }
  ],
  selectedVersion: "v18"
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(defaultState),
      ...parsed,
      flags: { ...defaultState.flags, ...(parsed.flags || {}) }
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

function bumpVersion(summary = "Applied draft proposal", effects = 28) {
  const nextId = `v${Number(state.versions[0].id.slice(1)) + 1}`;
  state.versions.unshift({
    id: nextId,
    summary,
    effects,
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  });
  state.selectedVersion = nextId;
}

function buildDesignerPlanCommands() {
  const trackName = "XD:ProposedPlan";
  const marks = state.proposed.slice(0, 24).map((label, idx) => {
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
    const result = await executePlan(state.endpoint, plan, true);
    const executed = result?.data?.executedCount ?? 0;
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
    const open = await getOpenSequence(state.endpoint);
    const seq = open?.data?.sequence;
    state.flags.activeSequenceLoaded = Boolean(open?.data?.isOpen && seq);
    if (seq?.name) state.activeSequence = seq.name;

    try {
      const rev = await getRevision(state.endpoint);
      state.revision = rev?.data?.revision ?? "unknown";
    } catch {
      state.revision = "unknown";
    }

    setStatus("info", "Refreshed from xLights.");
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
        <div class="row">
          <button>Open Sequence</button>
          <button>Recent</button>
          <button>New Session</button>
        </div>
        <p class="banner">Active: ${state.activeSequence}</p>
        <p class="banner">Sidecar: ${state.activeSequence.replace(/\.xsq$/, ".xdmeta")}</p>
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
  return `
    <div class="screen-grid">
      <section class="card">
        <h3>Chat Thread</h3>
        <ul class="list">
          ${state.chat.map((c) => `<li><strong>${c.who}:</strong> ${c.text}</li>`).join("")}
        </ul>
      </section>

      <section class="card">
        <h3>Intent + Proposed Next Write</h3>
        <div class="field"><label>Scope</label><select><option>Selected Range</option><option>Entire Sequence</option><option>Models</option></select></div>
        <div class="field"><label>Range / Label</label><input value="chorus-2" /></div>
        <div class="row">
          <div class="field" style="flex:1"><label>Mood</label><input value="calmer" /></div>
          <div class="field" style="flex:1"><label>Energy</label><input value="medium" /></div>
          <div class="field" style="flex:1"><label>Priority</label><input value="preserve look" /></div>
        </div>
        <div class="field"><label>Proposed Next Write</label>
          <ol class="list">
            ${state.proposed.slice(0, 5).map((p) => `<li>${p}</li>`).join("")}
          </ol>
          <div class="banner impact">Approx effects impacted: ${state.proposed.length * 11}</div>
        </div>
      </section>
    </div>

    <div class="card" style="margin-top:12px;">
      <div class="composer">
        <input id="chat-input" placeholder="Type request..." value="Change chorus 2 candy canes to twinkle less" />
        <button id="generate">Generate/Refresh</button>
        <button id="apply" ${applyEnabled() ? "" : "disabled"}>Apply to xLights</button>
        <button>Open Details</button>
      </div>
      <div class="banner ${applyEnabled() ? "" : "warning"}">${applyEnabled() ? "Ready to apply." : disabledReason}</div>
    </div>
  `;
}

function historyScreen() {
  const selected = state.versions.find((v) => v.id === state.selectedVersion) || state.versions[0];
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
          <button>Compare</button>
          <button>Reapply as Variant</button>
        </div>
      </section>
    </div>
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

  const planBtn = app.querySelector("#plan-toggle");
  if (planBtn) planBtn.addEventListener("click", onTogglePlanOnly);

  const connectionBtn = app.querySelector("#test-connection");
  if (connectionBtn) connectionBtn.addEventListener("click", onTestConnection);

  const saveProjectBtn = app.querySelector("#save-project");
  if (saveProjectBtn) saveProjectBtn.addEventListener("click", onSaveProjectSettings);

  app.querySelectorAll("[data-version]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.selectedVersion = btn.dataset.version;
      persist();
      render();
    });
  });

  const rollbackBtn = app.querySelector("#rollback");
  if (rollbackBtn) {
    rollbackBtn.addEventListener("click", () => {
      setStatus("info", `Rollback queued to ${state.selectedVersion}.`);
      render();
    });
  }
}

function render() {
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
        <button>View Details</button>
      </div>

      <div class="main-grid">
        <nav class="nav">
          ${navButton("project", "Project")}
          ${navButton("design", "Design")}
          ${navButton("history", "History")}
          ${navButton("metadata", "Metadata")}
        </nav>

        <main class="content">${screenContent()}</main>
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
