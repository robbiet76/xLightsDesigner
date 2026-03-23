import {
  buildDiagnosticsDrawer,
  buildFooterDiagnostics,
  buildJobsPanel
} from "./operator-panels.js";

export function buildAppShell({ state, screenContent, helpers }) {
  const {
    escapeHtml,
    getTeamChatIdentity,
    getTeamChatSpeakerLabel,
    getSections,
    getSelectedSections,
    hasAllSectionsSelected,
    getSectionName,
    applyEnabled,
    applyDisabledReason,
    getDiagnosticsCounts,
    chatPlaceholder,
    chatContext,
    analysisHeaderBadge,
    buildLabel
  } = helpers;

  function navButton(id, label) {
    const icons = {
      project: "P",
      metadata: "L",
      audio: "A",
      sequence: "S",
      design: "D",
      review: "R",
      history: "H",
      settings: "⚙"
    };
    const icon = icons[id] || "•";
    return `<button class="${state.route === id ? "active" : ""}" data-route="${id}" title="${label}"><span class="nav-icon">${icon}</span><span class="nav-label">${label}</span></button>`;
  }

  function persistentCoachPanel() {
    return `
      <aside class="coach-panel card">
        <h3>Design Team Chat</h3>
        <p class="team-chat-context">${escapeHtml(String(chatContext?.note || "Use chat to direct the design team and review the active conversation."))}</p>
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
                const agentClassKey = String(handledBy || "").trim().replace(/[^a-z0-9_-]+/gi, "-").toLowerCase();
                const agentClass = role === "agent" && agentClassKey ? ` chat-msg-agent-${agentClassKey}` : "";
                return `<article class="chat-msg ${role}${agentClass}">
                  <header>${escapeHtml(header)}</header>
                  <div class="chat-msg-body">${String(c.text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
                </article>`;
              })
              .join("")}
            ${state.ui.agentThinking ? `<div class="chat-typing">${escapeHtml(getTeamChatSpeakerLabel(state.health.agentActiveRole || "app_assistant"))} is working...</div>` : ""}
          </div>
        </div>
      </aside>
    `;
  }

  function globalChatBar() {
    return `
      <div class="global-chat-bar">
        <div class="composer">
          <input id="chat-input" placeholder="${escapeHtml(String(chatPlaceholder || "Tell the agent what to change or ask for guidance..."))}" value="${(state.ui.chatDraft || "").replace(/\"/g, "&quot;")}" />
          <button id="send-chat">Send</button>
        </div>
      </div>
    `;
  }

  function projectNameDialog() {
    if (!state.ui?.projectNameDialogOpen) return "";
    const title = escapeHtml(String(state.ui.projectNameDialogTitle || "Project Name"));
    const value = escapeHtml(String(state.ui.projectNameDialogValue || ""));
    const error = String(state.ui.projectNameDialogError || "").trim();
    return `
      <section class="modal-overlay">
        <div class="modal-card">
          <div class="artifact-kicker">Project</div>
          <h3>${title}</h3>
          <p class="banner">Projects are always created under the configured Application Project Root.</p>
          <label class="field">
            <span>Project Name</span>
            <input id="project-name-dialog-input" value="${value}" placeholder="Project name" autofocus />
          </label>
          ${error ? `<p class="banner warning">${escapeHtml(error)}</p>` : ""}
          <div class="modal-actions">
            <button id="project-name-dialog-cancel">Cancel</button>
            <button id="project-name-dialog-confirm">Continue</button>
          </div>
        </div>
      </section>
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
            ${navButton("metadata", "Layout")}
            ${navButton("audio", "Audio")}
            ${navButton("design", "Design")}
            ${navButton("sequence", "Sequence")}
            ${navButton("review", "Review")}
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
              ${buildDiagnosticsDrawer({ state, helpers: { getDiagnosticsCounts, escapeHtml, buildLabel } })}
              ${buildJobsPanel({ state })}
            </main>
            ${persistentCoachPanel()}
          </div>
        </div>
      </div>

      <div class="bottom-input-row ${state.ui.navCollapsed ? "nav-collapsed" : ""}">
        <div class="bottom-nav-settings">
          ${navButton("settings", "Settings")}
        </div>
        ${globalChatBar()}
      </div>

      ${buildFooterDiagnostics({ state, helpers: { getDiagnosticsCounts, buildLabel } })}
      ${projectNameDialog()}
    </div>
  `;
}
