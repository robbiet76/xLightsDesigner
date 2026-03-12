export function buildAppShell({ state, screenContent, helpers }) {
  const {
    escapeHtml,
    renderInlineChipSentence,
    getTeamChatSpeakerLabel,
    getSections,
    getSelectedSections,
    hasAllSectionsSelected,
    getSectionName,
    applyEnabled,
    applyDisabledReason,
    getDiagnosticsCounts,
    getAgentApplyRolloutMode,
    getManualLockedXdTracks,
    getTeamChatIdentities,
    chatQuickPrompts,
    analysisHeaderBadge,
    buildLabel
  } = helpers;

  function navButton(id, label) {
    const icons = {
      project: "P",
      audio: "A",
      sequence: "S",
      design: "D",
      review: "R",
      metadata: "M",
      history: "H"
    };
    const icon = icons[id] || "•";
    return `<button class="${state.route === id ? "active" : ""}" data-route="${id}" title="${label}"><span class="nav-icon">${icon}</span><span class="nav-label">${label}</span></button>`;
  }

  function persistentCoachPanel() {
    return `
      <aside class="coach-panel card">
        <h3>Team Chat</h3>
        <div class="panel-window chat-window">
          <div class="chat-thread">
            ${(state.chat || [])
              .map((c) => {
                const role = c.who === "user" ? "user" : c.who === "agent" ? "agent" : "system";
                const handledBy = String(c.handledBy || c.roleId || "").trim();
                const header = role === "user"
                  ? "You"
                  : role === "agent"
                    ? (String(c.displayName || "").trim() || getTeamChatSpeakerLabel(handledBy || "app_assistant"))
                    : "System";
                const routedByNote = role === "agent" && c.addressedTo && c.addressedTo !== handledBy
                  ? `<span class="banner">Handled by ${escapeHtml(header)} after routing from ${escapeHtml(getTeamChatSpeakerLabel(String(c.addressedTo || "")))}</span>`
                  : "";
                return `<article class="chat-msg ${role}">
                  <header>${escapeHtml(header)}</header>
                  <div>${String(c.text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
                  ${routedByNote}
                </article>`;
              })
              .join("")}
            ${state.ui.agentThinking ? `<div class="chat-typing">${escapeHtml(getTeamChatSpeakerLabel(state.health.agentActiveRole || "app_assistant"))} is working...</div>` : ""}
          </div>
        </div>
        <div class="quick-prompts panel-footer-block">
          ${(chatQuickPrompts || [])
            .map((p, idx) => `
              <article class="quick-suggestion">
                <div class="quick-suggestion-text">${renderInlineChipSentence(p)}</div>
                <button data-quick-prompt="${idx}">Use</button>
              </article>
            `)
            .join("")}
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
          <button id="close-details">Back to Review</button>
        </div>
        <div class="banner ${applyEnabled() ? "" : "warning"}">${applyEnabled() ? "" : applyDisabledReason()}</div>
      </section>
    `;
  }

  function settingsDrawer() {
    if (!state.ui.settingsOpen) return "";
    const rolloutMode = getAgentApplyRolloutMode();
    const manualXdLocks = getManualLockedXdTracks();
    const teamChatIdentities = getTeamChatIdentities();
    const manualXdLockText = manualXdLocks.length
      ? manualXdLocks.map((row) => row.sourceTrack).join(", ")
      : "none";
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
          <section class="field">
            <label>Cloud Agent Configuration</label>
            <input id="agent-base-url-input" placeholder="Base URL (optional)" value="${String(state.ui.agentBaseUrlDraft || "").replace(/\"/g, "&quot;")}" />
            <input id="agent-model-input" placeholder="Model (optional)" value="${String(state.ui.agentModelDraft || "").replace(/\"/g, "&quot;")}" />
            <input id="agent-api-key-input" type="password" placeholder="${state.health.agentHasStoredApiKey ? "Stored API key is set. Enter to replace." : "Enter API key to enable cloud chat"}" value="" />
            <div class="row" style="margin-top:6px;">
              <button id="save-agent-config">Save Cloud Config</button>
              <button id="clear-agent-key" ${state.health.agentHasStoredApiKey ? "" : "disabled"}>Clear Stored API Key</button>
              <button id="test-agent-cloud">Test Cloud Agent</button>
              <button id="test-agent-orchestration">Test Orchestration</button>
              <button id="test-agent-orchestration-matrix">Run Orchestration Matrix</button>
            </div>
            <p class="banner">Source: ${state.health.agentConfigSource || "none"} | Stored key: ${state.health.agentHasStoredApiKey ? "yes" : "no"}</p>
            <p class="banner">Last cloud test: ${state.ui.agentLastTestStatus || "not run in this session"}</p>
            <p class="banner">Last orchestration test: ${state.ui.agentLastOrchestrationTestStatus || "not run in this session"}</p>
            <p class="banner">Last orchestration matrix: ${state.ui.agentLastOrchestrationMatrixStatus || "not run in this session"}</p>
          </section>
          <section class="field">
            <label>Audio Analysis Service</label>
            <input id="analysis-service-url-input" placeholder="Service base URL (e.g. http://127.0.0.1:5055)" value="${String(state.ui.analysisServiceUrlDraft || "").replace(/\"/g, "&quot;")}" />
            <select id="analysis-service-provider-input">
              <option value="auto" ${state.ui.analysisServiceProvider === "auto" ? "selected" : ""}>Auto (Best)</option>
              <option value="beatnet" ${state.ui.analysisServiceProvider === "beatnet" ? "selected" : ""}>BeatNet</option>
              <option value="librosa" ${state.ui.analysisServiceProvider === "librosa" ? "selected" : ""}>Librosa</option>
            </select>
            <input id="analysis-service-api-key-input" type="password" placeholder="x-api-key (optional)" value="${String(state.ui.analysisServiceApiKeyDraft || "").replace(/\"/g, "&quot;")}" />
            <input id="analysis-service-bearer-input" type="password" placeholder="Bearer token (optional)" value="${String(state.ui.analysisServiceAuthBearerDraft || "").replace(/\"/g, "&quot;")}" />
            <p class="banner">Thin client mode: app sends audio to this service and writes returned beats/bars/sections.</p>
          </section>
          <section class="field">
            <label>Team Chat Names</label>
            <div class="kv"><div class="k">App Assistant</div><div><input id="nickname-app-assistant" placeholder="Optional nickname" value="${String(teamChatIdentities.app_assistant?.nickname || "").replace(/\"/g, "&quot;")}" /></div></div>
            <div class="kv"><div class="k">Audio Analyst</div><div><input id="nickname-audio-analyst" placeholder="Optional nickname" value="${String(teamChatIdentities.audio_analyst?.nickname || "").replace(/\"/g, "&quot;")}" /></div></div>
            <div class="kv"><div class="k">Designer</div><div><input id="nickname-designer-dialog" placeholder="Optional nickname" value="${String(teamChatIdentities.designer_dialog?.nickname || "").replace(/\"/g, "&quot;")}" /></div></div>
            <div class="kv"><div class="k">Sequencer</div><div><input id="nickname-sequence-agent" placeholder="Optional nickname" value="${String(teamChatIdentities.sequence_agent?.nickname || "").replace(/\"/g, "&quot;")}" /></div></div>
            <p class="banner">Nicknames are optional. They affect chat presentation and address hints only. Internal role ids stay fixed.</p>
          </section>
          <div class="row">
            <button id="test-connection">Test Connection</button>
            <button id="check-health">Recheck Health</button>
            <button id="clear-xd-track-locks" ${manualXdLocks.length ? "" : "disabled"}>Clear XD Locks</button>
            <button id="plan-toggle" ${planOnlyToggleForced ? `disabled title="${planOnlyToggleTitle}"` : ""}>${state.flags.planOnlyMode ? "Exit Plan Only" : "Plan Only"}</button>
          </div>
          <p class="banner">Manual XD track locks: ${manualXdLockText}</p>
          <hr />
          <h3>Application Health</h3>
          <div class="kv"><div class="k">Last Check</div><div>${state.health.lastCheckedAt ? new Date(state.health.lastCheckedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "Never"}</div></div>
          <div class="kv"><div class="k">Runtime Ready</div><div>${state.health.runtimeReady ? "yes" : "no"}</div></div>
          <div class="kv"><div class="k">File Dialog Bridge</div><div>${state.health.desktopFileDialogReady ? "yes" : "no"}</div></div>
          <div class="kv"><div class="k">Desktop Bridge APIs</div><div>${state.health.desktopBridgeApiCount}</div></div>
          <div class="kv"><div class="k">xLights Version</div><div>${state.health.xlightsVersion || "not reported"}</div></div>
          <div class="kv"><div class="k">Compatibility</div><div>${state.health.compatibilityStatus}</div></div>
          <div class="kv"><div class="k">Agent Provider</div><div>${state.health.agentProvider || "openai"}</div></div>
          <div class="kv"><div class="k">Agent Model</div><div>${state.health.agentModel || "(default env model)"}</div></div>
          <div class="kv"><div class="k">Agent Cloud Config</div><div>${state.health.agentConfigured ? "configured" : "missing OPENAI_API_KEY"}</div></div>
          <div class="kv"><div class="k">Agent Layer</div><div>${state.health.agentLayerReady ? "loaded" : "unavailable"}</div></div>
          <div class="kv"><div class="k">Agent Role</div><div>${state.health.agentActiveRole || "idle"}</div></div>
          <div class="kv"><div class="k">Agent Registry</div><div>${state.health.agentRegistryVersion || "unknown"}</div></div>
          <div class="kv"><div class="k">Registry Valid</div><div>${state.health.agentRegistryValid ? "yes" : "no"}</div></div>
          ${
            Array.isArray(state.health.agentRegistryErrors) && state.health.agentRegistryErrors.length
              ? `<p class="banner warning">Registry errors: ${escapeHtml(state.health.agentRegistryErrors.join(" | "))}</p>`
              : ""
          }
          <div class="kv"><div class="k">Handoffs Ready</div><div>${state.health.agentHandoffsReady || "0/3"}</div></div>
          <div class="kv"><div class="k">Orchestration Last Run</div><div>${state.health.orchestrationLastRunId || "none"}</div></div>
          <div class="kv"><div class="k">Orchestration Status</div><div>${state.health.orchestrationLastStatus || "none"}</div></div>
          <div class="kv"><div class="k">Orchestration Summary</div><div>${state.health.orchestrationLastSummary || "none"}</div></div>
          <div class="kv"><div class="k">Capabilities</div><div>${state.health.capabilitiesCount}</div></div>
          <div class="kv"><div class="k">Effect Catalog</div><div>${state.health.effectCatalogReady ? "ready" : "unavailable"}</div></div>
          <div class="kv"><div class="k">Effect Definitions</div><div>${Number(state.health.effectDefinitionCount || 0)}</div></div>
          <div class="kv"><div class="k">Scene Graph</div><div>${state.health.sceneGraphReady ? "ready" : "unavailable"}</div></div>
          <div class="kv"><div class="k">Scene Source</div><div>${state.health.sceneGraphSource || "unknown"}</div></div>
          <div class="kv"><div class="k">Layout Mode</div><div>${String(state.health.sceneGraphLayoutMode || "2d").toUpperCase()}</div></div>
          <div class="kv"><div class="k">Spatial Nodes</div><div>${Number(state.health.sceneGraphSpatialNodeCount || 0)}</div></div>
          ${
            Array.isArray(state.health.sceneGraphWarnings) && state.health.sceneGraphWarnings.length
              ? `<p class="banner warning">Scene graph warnings: ${escapeHtml(state.health.sceneGraphWarnings.join(" | "))}</p>`
              : ""
          }
          ${
            state.health.effectCatalogError
              ? `<p class="banner warning">Effect catalog: ${escapeHtml(state.health.effectCatalogError)}</p>`
              : ""
          }
          <div class="kv"><div class="k">system.validateCommands</div><div>${state.health.hasValidateCommands ? "yes" : "no"}</div></div>
          <div class="kv"><div class="k">jobs.get</div><div>${state.health.hasJobsGet ? "yes" : "no"}</div></div>
          <div class="kv"><div class="k">Sequence Open</div><div>${state.health.sequenceOpen ? "yes" : "no"}</div></div>
        </section>
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

  const diagCounts = getDiagnosticsCounts();
  const filter = state.ui.diagnosticsFilter;
  const rows = state.diagnostics || [];
  const filteredRows = filter === "all" ? rows : rows.filter((d) => d.level === filter);
  const footerApplyHistory = Array.isArray(state.applyHistory) ? state.applyHistory.slice(0, 8) : [];

  return `
    <div class="app-shell ${state.ui.navCollapsed ? "nav-collapsed" : ""}">
      <div class="main-grid ${state.ui.navCollapsed ? "nav-collapsed" : ""}">
        <nav class="nav ${state.ui.navCollapsed ? "collapsed" : ""}">
          <div class="nav-header">
            <button id="toggle-nav" class="nav-toggle-btn" title="${state.ui.navCollapsed ? "Expand navigation" : "Collapse navigation"}"><span class="nav-icon">${state.ui.navCollapsed ? "›" : "‹"}</span></button>
            <div class="nav-project-name">${state.projectName || "Project"}</div>
          </div>
          <div class="nav-links">
            ${navButton("project", "Project")}
            ${navButton("audio", "Audio")}
            ${navButton("sequence", "Sequence")}
            ${navButton("design", "Design")}
            ${navButton("review", "Review")}
            ${navButton("metadata", "Metadata")}
            ${navButton("history", "History")}
          </div>
        </nav>

        <div class="main-shell">
          <header class="header">
            <div class="header-sequence"><strong>${state.activeSequence || "No Sequence Open"}</strong></div>
            <div class="header-badges">
              <div class="header-badge">xLights: ${state.flags.xlightsConnected ? "Connected" : "Disconnected"}</div>
              <div class="header-badge">${analysisHeaderBadge}</div>
            </div>
          </header>

          <div class="main-body">
            <main class="content">
              ${screenContent}
              ${state.route === "review" ? detailsDrawer() : ""}
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
          <span>${buildLabel}</span>
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
}
