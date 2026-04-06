export function buildSettingsContent({ state, helpers, pageState = null, includeClose = false }) {
  const {
    getAgentApplyRolloutMode,
    getManualLockedXdTracks,
    getTeamChatIdentities
  } = helpers;
  const safety = state?.safety && typeof state.safety === "object" ? state.safety : {};
  const ui = state?.ui && typeof state.ui === "object" ? state.ui : {};
  const health = state?.health && typeof state.health === "object" ? state.health : {};
  const flags = state?.flags && typeof state.flags === "object" ? state.flags : {};
  const data = pageState?.data || {};
  const rolloutMode = data.rolloutMode || getAgentApplyRolloutMode();
  const manualXdLocks = Array.isArray(data.manualXdLocks) ? data.manualXdLocks : getManualLockedXdTracks();
  const teamChatIdentities = data.teamChatIdentities || getTeamChatIdentities();
  const manualXdLockText = data.manualXdLockText || (manualXdLocks.length
    ? manualXdLocks.map((row) => row.sourceTrack).join(", ")
    : "none");
  const planOnlyToggleForced = Boolean(data.planOnlyToggleForced);
  const planOnlyToggleTitle = String(data.planOnlyToggleTitle || "");
  return `
      <section class="card settings-screen-card">
        <div class="row" style="justify-content:space-between; align-items:center;">
          <h3>Settings</h3>
          ${includeClose ? '<button id="close-settings" aria-label="Close settings">Close</button>' : ""}
        </div>
        <section class="field" style="margin-top:8px;">
          <label>Application Project Root</label>
          <div class="row">
            <input id="project-metadata-root-input" value="${state.projectMetadataRoot || ""}" placeholder="Default: app data folder" />
            <button id="browse-project-root">Browse...</button>
          </div>
          <p class="banner">This is the app-owned root where xLightsDesigner stores projects and the shared track library.</p>
        </section>
        <section class="field" style="margin-top:8px;">
          <label>xLights Endpoint</label>
          <input id="endpoint-input" value="${state.endpoint}" />
          <p class="banner">Endpoint is explicit and fail-fast. No automatic fallback endpoints are used.</p>
        </section>
        <section class="field">
          <label>Apply Confirmation Mode</label>
          <select id="confirm-mode-input">
            <option value="large-only" ${safety.applyConfirmMode === "large-only" ? "selected" : ""}>Large changes only</option>
            <option value="always" ${safety.applyConfirmMode === "always" ? "selected" : ""}>Always confirm</option>
            <option value="never" ${safety.applyConfirmMode === "never" ? "selected" : ""}>Never confirm</option>
          </select>
        </section>
        <section class="field">
          <label>Large Change Threshold (approx effects impacted)</label>
          <input id="threshold-input" type="number" min="1" value="${safety.largeChangeThreshold ?? ""}" />
        </section>
        <section class="field">
          <label>Sequence Switch (when unsaved changes exist)</label>
          <select id="sequence-switch-policy-input">
            <option value="save-if-needed" ${safety.sequenceSwitchUnsavedPolicy !== "discard-unsaved" ? "selected" : ""}>Save then switch</option>
            <option value="discard-unsaved" ${safety.sequenceSwitchUnsavedPolicy === "discard-unsaved" ? "selected" : ""}>Discard and switch</option>
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
        <section class="field">
          <label>Cloud Agent Configuration</label>
          <input id="agent-base-url-input" placeholder="Base URL (optional)" value="${String(ui.agentBaseUrlDraft || "").replace(/\"/g, "&quot;")}" />
          <input id="agent-model-input" placeholder="Model (optional)" value="${String(ui.agentModelDraft || "").replace(/\"/g, "&quot;")}" />
          <input id="agent-api-key-input" type="password" placeholder="${health.agentHasStoredApiKey ? "Stored API key is set. Enter to replace." : "Enter API key to enable cloud chat"}" value="" />
          <div class="row" style="margin-top:6px;">
            <button id="save-agent-config">Save Cloud Config</button>
            <button id="clear-agent-key" ${health.agentHasStoredApiKey ? "" : "disabled"}>Clear Stored API Key</button>
            <button id="test-agent-cloud">Test Cloud Agent</button>
            <button id="test-agent-orchestration">Test Orchestration</button>
            <button id="test-agent-orchestration-matrix">Run Orchestration Matrix</button>
          </div>
          <p class="banner">Source: ${health.agentConfigSource || "none"} | Stored key: ${health.agentHasStoredApiKey ? "yes" : "no"}</p>
          <p class="banner">Last cloud test: ${ui.agentLastTestStatus || "not run in this session"}</p>
          <p class="banner">Last orchestration test: ${ui.agentLastOrchestrationTestStatus || "not run in this session"}</p>
          <p class="banner">Last orchestration matrix: ${ui.agentLastOrchestrationMatrixStatus || "not run in this session"}</p>
        </section>
        <section class="field">
          <label>Audio Analysis Service</label>
          <input id="analysis-service-url-input" placeholder="Service base URL (e.g. http://127.0.0.1:5055)" value="${String(ui.analysisServiceUrlDraft || "").replace(/\"/g, "&quot;")}" />
          <p class="banner">Provider: Librosa only.</p>
          <input id="analysis-service-api-key-input" type="password" placeholder="x-api-key (optional)" value="${String(ui.analysisServiceApiKeyDraft || "").replace(/\"/g, "&quot;")}" />
          <input id="analysis-service-bearer-input" type="password" placeholder="Bearer token (optional)" value="${String(ui.analysisServiceAuthBearerDraft || "").replace(/\"/g, "&quot;")}" />
          <p class="banner">Thin client mode: app sends audio to this service and writes returned beats/bars/sections.</p>
        </section>
        <section class="field">
          <label>Team Chat Names</label>
          <div class="kv"><div class="k">App Assistant</div><div><input id="nickname-app-assistant" placeholder="Optional nickname" value="${String(teamChatIdentities.app_assistant || teamChatIdentities.app_assistant?.nickname || "").replace(/\"/g, "&quot;")}" /></div></div>
          <div class="kv"><div class="k">Audio Analyst</div><div><input id="nickname-audio-analyst" placeholder="Optional nickname" value="${String(teamChatIdentities.audio_analyst || teamChatIdentities.audio_analyst?.nickname || "").replace(/\"/g, "&quot;")}" /></div></div>
          <div class="kv"><div class="k">Designer</div><div><input id="nickname-designer-dialog" placeholder="Optional nickname" value="${String(teamChatIdentities.designer_dialog || teamChatIdentities.designer_dialog?.nickname || "").replace(/\"/g, "&quot;")}" /></div></div>
          <div class="kv"><div class="k">Sequencer</div><div><input id="nickname-sequence-agent" placeholder="Optional nickname" value="${String(teamChatIdentities.sequence_agent || teamChatIdentities.sequence_agent?.nickname || "").replace(/\"/g, "&quot;")}" /></div></div>
          <p class="banner">Nicknames are optional. They affect chat presentation and address hints only. Internal role ids stay fixed.</p>
        </section>
        <div class="row">
          <button id="test-connection">Test Connection</button>
          <button id="check-health">Recheck Health</button>
          <button id="clear-xd-track-locks" ${manualXdLocks.length ? "" : "disabled"}>Clear XD Locks</button>
          <button id="plan-toggle" ${planOnlyToggleForced ? `disabled title="${planOnlyToggleTitle}"` : ""}>${flags.planOnlyMode ? "Exit Plan Only" : "Plan Only"}</button>
        </div>
        <div class="row">
          <button id="reset-app-install-state" class="danger-action">Reset App To First Run</button>
        </div>
        <p class="banner">Manual XD track locks: ${manualXdLockText}</p>
        <p class="banner warning">Fresh-install reset clears app state, recent-project index, chat history, and local UI memory. It preserves stored API keys, project files, and shared track analysis records.</p>
        <p class="banner">Operational health, warnings, and apply history now live in Diagnostics so this drawer stays focused on user configuration.</p>
      </section>
  `;
}

export function buildSettingsDrawer({ state, helpers }) {
  if (!state.ui.settingsOpen) return "";
  return `
    <section class="settings-overlay" id="settings-overlay">
      ${buildSettingsContent({ state, helpers, pageState: helpers.pageStates?.settings || null, includeClose: true })}
    </section>
  `;
}

export function buildDiagnosticsDrawer({ state, helpers }) {
  const { getDiagnosticsCounts, escapeHtml, buildLabel } = helpers;
  if (!state.ui.diagnosticsOpen) return "";
  const dashboard = helpers.pageStates?.diagnostics || null;
  const data = dashboard?.data || {};
  const counts = data.counts || getDiagnosticsCounts();
  const filter = data.filter || state.ui.diagnosticsFilter;
  const filteredRows = Array.isArray(data.filteredRows) ? data.filteredRows : [];
  const applyHistory = Array.isArray(data.recentApplies) ? data.recentApplies : [];
  const health = data.health || {};
  return `
    <section class="settings-overlay" id="diagnostics-overlay">
      <section class="card settings-drawer diagnostics-drawer">
        <div class="row" style="justify-content:space-between; align-items:center;">
          <h3>Diagnostics</h3>
          <button id="close-diagnostics" aria-label="Close diagnostics">Close</button>
        </div>
        <p class="banner">Operator surface for runtime health, warnings, exports, and recent apply history.</p>
        <div class="row">
          <button data-diag-filter="all" class="${filter === "all" ? "active-chip" : ""}">All (${counts.total})</button>
          <button data-diag-filter="warning" class="${filter === "warning" ? "active-chip" : ""}">Warnings (${counts.warning})</button>
          <button data-diag-filter="action-required" class="${filter === "action-required" ? "active-chip" : ""}">Action Required (${counts.actionRequired})</button>
          <button id="export-diagnostics">Export</button>
          <button id="clear-diagnostics">Clear</button>
        </div>
        <section class="field">
          <h3>Application Health</h3>
          <div class="kv"><div class="k">Last Check</div><div>${health.lastCheckedAt || "Never"}</div></div>
          <div class="kv"><div class="k">Runtime Ready</div><div>${health.runtimeReady ? "yes" : "no"}</div></div>
          <div class="kv"><div class="k">File Dialog Bridge</div><div>${health.desktopFileDialogReady ? "yes" : "no"}</div></div>
          <div class="kv"><div class="k">Desktop Bridge APIs</div><div>${health.desktopBridgeApiCount || 0}</div></div>
          <div class="kv"><div class="k">xLights Version</div><div>${health.xlightsVersion || "not reported"}</div></div>
          <div class="kv"><div class="k">Compatibility</div><div>${health.compatibilityStatus || ""}</div></div>
          <div class="kv"><div class="k">Agent Provider</div><div>${health.agentProvider || "openai"}</div></div>
          <div class="kv"><div class="k">Agent Model</div><div>${health.agentModel || "(default env model)"}</div></div>
          <div class="kv"><div class="k">Agent Cloud Config</div><div>${health.agentConfigured ? "configured" : "missing OPENAI_API_KEY"}</div></div>
          <div class="kv"><div class="k">Agent Layer</div><div>${health.agentLayerReady ? "loaded" : "unavailable"}</div></div>
          <div class="kv"><div class="k">Agent Role</div><div>${health.agentActiveRole || "idle"}</div></div>
          <div class="kv"><div class="k">Agent Registry</div><div>${health.agentRegistryVersion || "unknown"}</div></div>
          <div class="kv"><div class="k">Registry Valid</div><div>${health.agentRegistryValid ? "yes" : "no"}</div></div>
          ${
            Array.isArray(health.agentRegistryErrors) && health.agentRegistryErrors.length
              ? `<p class="banner warning">Registry errors: ${escapeHtml(health.agentRegistryErrors.join(" | "))}</p>`
              : ""
          }
          <div class="kv"><div class="k">Handoffs Ready</div><div>${health.agentHandoffsReady || "0/3"}</div></div>
          <div class="kv"><div class="k">Orchestration Last Run</div><div>${health.orchestrationLastRunId || "none"}</div></div>
          <div class="kv"><div class="k">Orchestration Status</div><div>${health.orchestrationLastStatus || "none"}</div></div>
          <div class="kv"><div class="k">Orchestration Summary</div><div>${health.orchestrationLastSummary || "none"}</div></div>
          <div class="kv"><div class="k">Capabilities</div><div>${health.capabilitiesCount || 0}</div></div>
          <div class="kv"><div class="k">Effect Catalog</div><div>${health.effectCatalogReady ? "ready" : "unavailable"}</div></div>
          <div class="kv"><div class="k">Effect Definitions</div><div>${health.effectDefinitionCount || 0}</div></div>
          <div class="kv"><div class="k">Scene Graph</div><div>${health.sceneGraphReady ? "ready" : "unavailable"}</div></div>
          <div class="kv"><div class="k">Scene Source</div><div>${health.sceneGraphSource || "unknown"}</div></div>
          <div class="kv"><div class="k">Layout Mode</div><div>${health.sceneGraphLayoutMode || "2D"}</div></div>
          <div class="kv"><div class="k">Spatial Nodes</div><div>${health.sceneGraphSpatialNodeCount || 0}</div></div>
          ${
            Array.isArray(health.sceneGraphWarnings) && health.sceneGraphWarnings.length
              ? `<p class="banner warning">Scene graph warnings: ${escapeHtml(health.sceneGraphWarnings.join(" | "))}</p>`
              : ""
          }
          ${
            health.effectCatalogError
              ? `<p class="banner warning">Effect catalog: ${escapeHtml(health.effectCatalogError)}</p>`
              : ""
          }
          <div class="kv"><div class="k">system.validateCommands</div><div>${health.hasValidateCommands ? "yes" : "no"}</div></div>
          <div class="kv"><div class="k">jobs.get</div><div>${health.hasJobsGet ? "yes" : "no"}</div></div>
          <div class="kv"><div class="k">Sequence Open</div><div>${health.sequenceOpen ? "yes" : "no"}</div></div>
          <div class="kv"><div class="k">Build</div><div>${health.buildLabel || buildLabel}</div></div>
        </section>
        <section class="field">
          <h3>Diagnostics Feed</h3>
          ${
            filteredRows.length
              ? `
              <ul class="list">
                ${filteredRows
                  .map(
                    (d) => `
                    <li>
                      <strong>[${d.level}]</strong> ${d.timeLabel ? `${escapeHtml(d.timeLabel)} - ` : ""}${escapeHtml(d.text)}
                      ${d.details ? `<pre class="diag-details">${escapeHtml(d.details)}</pre>` : ""}
                    </li>
                  `
                  )
                  .join("")}
              </ul>
            `
              : '<p class="banner">No diagnostics for current filter.</p>'
          }
        </section>
        <section class="field">
          <h3>Recent Applies</h3>
          ${
            applyHistory.length
              ? `
              <ul class="list">
                ${applyHistory
                  .map((entry) => {
                    const status = String(entry?.status || "unknown");
                    const count = Number(entry?.commandCount || 0);
                    const ts = String(entry?.timeLabel || "--:--");
                    const summary = String(entry?.summary || "").trim();
                    return `
                      <li>
                        <strong>[${status}]</strong> ${ts} - ${count} cmd${count === 1 ? "" : "s"}
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
        </section>
      </section>
    </section>
  `;
}

export function buildJobsPanel({ state }) {
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

export function buildFooterDiagnostics({ state, helpers }) {
  const { getDiagnosticsCounts, buildLabel } = helpers;
  const diagnosticsState = helpers.pageStates?.diagnostics || null;
  const diagCounts = diagnosticsState?.data?.counts || getDiagnosticsCounts();
  return `
    <footer class="footer">
      <div class="footer-summary">
        <button id="open-diagnostics">Diagnostics</button>
        <span>Diagnostics: ${diagCounts.total} total</span>
        <span>${diagCounts.warning} warning</span>
        <span>${diagCounts.actionRequired} action-required</span>
        <span>${buildLabel}</span>
      </div>
    </footer>
  `;
}
