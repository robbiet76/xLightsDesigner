import {
  buildDiagnosticsDrawer,
  buildFooterDiagnostics,
  buildJobsPanel,
  buildSettingsDrawer
} from "./operator-panels.js";

export function buildAppShell({ state, screenContent, helpers }) {
  const {
    escapeHtml,
    renderInlineChipSentence,
    getTeamChatIdentity,
    getTeamChatSpeakerLabel,
    getSections,
    getSelectedSections,
    hasAllSectionsSelected,
    getSectionName,
    applyEnabled,
    applyDisabledReason,
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
    function renderIdentityMeta({ role = "system", handledBy = "", addressedTo = "", header = "" }) {
      if (role !== "agent") return "";
      const handledIdentity = getTeamChatIdentity(handledBy || "app_assistant");
      const addressedIdentity = addressedTo ? getTeamChatIdentity(addressedTo) : null;
      const routeLabel = handledBy === "audio_analyst"
        ? "Audio"
        : handledBy === "designer_dialog"
          ? "Design"
          : handledBy === "sequence_agent"
            ? "Review"
            : "Project";
      const overrideNote = addressedIdentity && addressedTo !== handledBy
        ? `<span class="chat-identity-note">Addressed to ${escapeHtml(addressedIdentity.nickname ? `${addressedIdentity.displayName} (${addressedIdentity.nickname})` : addressedIdentity.displayName)}, handled by ${escapeHtml(header)}</span>`
        : "";
      return `
        <div class="chat-identity-row">
          <span class="chat-identity-pill">${escapeHtml(handledIdentity.displayName)}</span>
          ${handledIdentity.nickname ? `<span class="chat-identity-pill chat-identity-pill-nickname">${escapeHtml(handledIdentity.nickname)}</span>` : ""}
          <span class="chat-identity-pill chat-identity-pill-route">${escapeHtml(routeLabel)}</span>
        </div>
        ${overrideNote}
      `;
    }

    function renderChatArtifactCard(artifact) {
      if (!artifact || typeof artifact !== "object") return "";
      const title = escapeHtml(String(artifact.title || "Artifact"));
      const summary = escapeHtml(String(artifact.summary || ""));
      const chips = Array.isArray(artifact.chips) ? artifact.chips.map((v) => escapeHtml(String(v || "").trim())).filter(Boolean).slice(0, 6) : [];
      const kicker = escapeHtml(String(artifact.artifactType || "artifact"));
      return `
        <section class="chat-artifact-card">
          <div class="artifact-kicker">${kicker}</div>
          <h4>${title}</h4>
          ${summary ? `<p class="artifact-body">${summary}</p>` : ""}
          ${chips.length ? `<div class="artifact-chip-row">${chips.map((chip) => `<span class="artifact-chip">${chip}</span>`).join("")}</div>` : ""}
        </section>
      `;
    }

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
                  ? `<span class="banner">Routed from ${escapeHtml(getTeamChatSpeakerLabel(String(c.addressedTo || "")))} to ${escapeHtml(header)}</span>`
                  : "";
                return `<article class="chat-msg ${role}">
                  <header>${escapeHtml(header)}</header>
                  ${renderIdentityMeta({ role, handledBy, addressedTo: String(c.addressedTo || ""), header })}
                  <div>${String(c.text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
                  ${renderChatArtifactCard(c.artifact)}
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
              ${buildSettingsDrawer({ state, helpers })}
              ${buildDiagnosticsDrawer({ state, helpers: { getDiagnosticsCounts, escapeHtml, buildLabel } })}
              ${buildJobsPanel({ state })}
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

      ${buildFooterDiagnostics({ state, helpers: { getDiagnosticsCounts, buildLabel } })}
    </div>
  `;
}
