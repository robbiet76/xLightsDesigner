import { buildSettingsContent } from "./operator-panels.js";

export function buildScreenContent({ state, pageStates = {}, helpers }) {
  const {
    basenameOfPath,
    getAnalysisServiceHeaderBadgeText,
    getValidHandoff,
    escapeHtml,
    referenceFormatSummaryText,
    sequenceEligibilityFormatSummaryText,
    formatBytes,
    referenceMediaMaxFileBytes,
    referenceMediaMaxItems,
    getSections,
    getSelectedSections,
    hasAllSectionsSelected,
    buildDesignerPlanCommands,
    sanitizeProposedSelection,
    selectedProposedLinesForApply,
    summarizeImpactForLines,
    getProposedPayloadPreviewText,
    getSectionName,
    renderProposedLineHtml,
    applyReadyForApprovalGate,
    applyDisabledReason,
    applyEnabled,
    buildCurrentReviewSnapshotSummary,
    getMetadataTagRecords,
    buildMetadataTargets,
    matchesMetadataFilterValue,
    normalizeMetadataSelectionIds,
    normalizeMetadataSelectedTags,
    ensureVersionSnapshots,
    versionById
  } = helpers;

  function buildArtifactInspectActions(kind, label = "Inspect") {
    const active = state.ui?.inspectedArtifact === kind;
    return `
      <div class="artifact-actions">
        <button data-inspect-artifact="${escapeHtml(String(kind))}" class="${active ? "active-chip" : ""}">${escapeHtml(label)}</button>
      </div>
    `;
  }

  function renderDetailList(items = [], emptyText = "Nothing available yet.") {
    const rows = Array.isArray(items) ? items.map((row) => String(row || "").trim()).filter(Boolean) : [];
    return rows.length
      ? `<ul class="artifact-detail-list">${rows.map((row) => `<li>${escapeHtml(row)}</li>`).join("")}</ul>`
      : `<p class="banner">${escapeHtml(emptyText)}</p>`;
  }

  function renderArtifactDetailPanel() {
    const inspected = String(state.ui?.inspectedArtifact || "").trim();
    if (!inspected) return "";

    let title = "Artifact Detail";
    let kicker = "Artifact";
    let body = "";

    if (inspected === "audio-analysis") {
      const analysis = getValidHandoff("analysis_handoff_v1");
      const identity = analysis?.trackIdentity || {};
      const timing = analysis?.timing || {};
      const structure = analysis?.structure || {};
      title = "Audio Analysis Detail";
      kicker = "Audio Artifact";
      body = `
        <p class="artifact-body">${escapeHtml(String(state.audioAnalysis?.summary || "No summary available yet."))}</p>
        <div class="artifact-detail-grid">
          <div><strong>Title</strong><p>${escapeHtml(String(identity?.title || basenameOfPath(state.audioPathInput || "") || "Unknown"))}</p></div>
          <div><strong>Artist</strong><p>${escapeHtml(String(identity?.artist || "Unknown"))}</p></div>
          <div><strong>BPM</strong><p>${escapeHtml(String(timing?.bpm ?? "unknown"))}</p></div>
          <div><strong>Meter</strong><p>${escapeHtml(String(timing?.timeSignature || "unknown"))}</p></div>
        </div>
        <h4>Sections</h4>
        ${renderDetailList((structure?.sections || []).map((row) => `${row?.label || row?.name || "Section"}${row?.startMs != null && row?.endMs != null ? ` (${row.startMs}-${row.endMs} ms)` : ""}`), "No detected sections yet.")}
      `;
    } else if (inspected === "audio-pipeline") {
      const pipeline = state.audioAnalysis?.pipeline || {};
      title = "Audio Pipeline Detail";
      kicker = "Pipeline";
      body = `
        <div class="artifact-detail-grid">
          ${[
            ["Media attached", pipeline.mediaAttached],
            ["Metadata read", pipeline.mediaMetadataRead],
            ["Service called", pipeline.analysisServiceCalled],
            ["Service succeeded", pipeline.analysisServiceSucceeded],
            ["Timing derived", pipeline.timingDerived],
            ["Structure derived", pipeline.structureDerived],
            ["Web context derived", pipeline.webContextDerived]
          ].map(([label, ok]) => `<div><strong>${escapeHtml(label)}</strong><p>${ok ? "Yes" : "No"}</p></div>`).join("")}
        </div>
      `;
    } else if (inspected === "sequence-context") {
      const seqSettings = state.sequenceSettings || {};
      const stats = state.sceneGraph?.stats || {};
      title = "Sequence Context Detail";
      kicker = "Sequence";
      body = `
        <div class="artifact-detail-grid">
          <div><strong>Sequence</strong><p>${escapeHtml(String(state.activeSequence || "No sequence open"))}</p></div>
          <div><strong>Revision</strong><p>${escapeHtml(String(state.currentSequenceRevision || "unknown"))}</p></div>
          <div><strong>Type</strong><p>${escapeHtml(String(seqSettings.sequenceType || "Media"))}</p></div>
          <div><strong>Model Blending</strong><p>${seqSettings.supportsModelBlending ? "Enabled" : "Disabled"}</p></div>
          <div><strong>Layout Mode</strong><p>${escapeHtml(String(stats.layoutMode || "2d").toUpperCase())}</p></div>
          <div><strong>Display Elements</strong><p>${escapeHtml(String(state.sceneGraph?.displayElements?.length || 0))}</p></div>
          <div><strong>Groups</strong><p>${escapeHtml(String(stats.groupCount || 0))}</p></div>
          <div><strong>Submodels</strong><p>${escapeHtml(String(stats.submodelCount || 0))}</p></div>
        </div>
      `;
    } else if (inspected === "sequence-scope") {
      const sections = getSections();
      const selectedSections = getSelectedSections();
      title = "Scope Detail";
      kicker = "Selection";
      body = `
        <p class="artifact-body">The current working scope is what the downstream designer and sequencer will use as the active target boundary.</p>
        <h4>Selected Sections</h4>
        ${renderDetailList(selectedSections, "All sections are currently in scope.")}
        <h4>Available Sections</h4>
        ${renderDetailList(sections, "No sections are available yet.")}
      `;
    } else if (inspected === "sequence-intent") {
      const intent = state.creative?.intentHandoff || getValidHandoff("intent_handoff_v1");
      title = "Intent Handoff Detail";
      kicker = "Sequence Intent";
      body = intent
        ? `
          <p class="artifact-body">${escapeHtml(String(intent.goal || "No sequencing goal captured."))}</p>
          <div class="artifact-detail-grid">
            <div><strong>Mode</strong><p>${escapeHtml(String(intent.mode || "unknown"))}</p></div>
            <div><strong>Change Tolerance</strong><p>${escapeHtml(String(intent.constraints?.changeTolerance || "unknown"))}</p></div>
            <div><strong>Preserve Timing</strong><p>${intent.constraints?.preserveTimingTracks !== false ? "Yes" : "No"}</p></div>
            <div><strong>Allow Global Rewrite</strong><p>${intent.constraints?.allowGlobalRewrite ? "Yes" : "No"}</p></div>
          </div>
          <h4>Target Scope</h4>
          ${renderDetailList(intent.scope?.targetIds || [], "No target scope captured.")}
          <h4>Section Scope</h4>
          ${renderDetailList(intent.scope?.sections || [], "No section scope captured.")}
          <h4>Director Preferences</h4>
          ${renderDetailList([
            intent.directorPreferences?.styleDirection ? `Style: ${intent.directorPreferences.styleDirection}` : "",
            intent.directorPreferences?.energyArc ? `Energy: ${intent.directorPreferences.energyArc}` : "",
            intent.directorPreferences?.colorDirection ? `Color: ${intent.directorPreferences.colorDirection}` : ""
          ], "No sequencing preference cues captured.")}
        `
        : `<p class="banner">No canonical intent handoff is available yet.</p>`;
    } else if (inspected === "sequence-translation") {
      const plan = state.agentPlan || {};
      const proposalLines = Array.isArray(state.proposed) ? state.proposed : [];
      title = "Sequence Translation Detail";
      kicker = "Translation";
      body = `
        <p class="artifact-body">${escapeHtml(String(plan.summary || "No sequence translation summary yet."))}</p>
        <div class="artifact-detail-grid">
          <div><strong>Plan Status</strong><p>${escapeHtml(String(plan.status || state.health?.orchestrationLastStatus || "unknown"))}</p></div>
          <div><strong>Warnings</strong><p>${escapeHtml(String((plan.warnings || []).length || 0))}</p></div>
          <div><strong>Proposal Lines</strong><p>${escapeHtml(String(proposalLines.length || 0))}</p></div>
          <div><strong>Apply Ready</strong><p>${applyReadyForApprovalGate() ? "Yes" : "No"}</p></div>
        </div>
        <h4>Current Proposal Lines</h4>
        ${renderDetailList(proposalLines, "No translated proposal lines yet.")}
        <h4>Plan Warnings</h4>
        ${renderDetailList(plan.warnings || [], "No plan warnings.")}
      `;
    } else if (inspected === "creative-brief") {
      const brief = state.creative?.brief || null;
      title = "Creative Brief Detail";
      kicker = "Creative Brief";
      body = brief
        ? `
          <p class="artifact-body">${escapeHtml(String(brief.summary || ""))}</p>
          <div class="artifact-detail-grid">
            <div><strong>Goals</strong><p>${escapeHtml(String(brief.goalsSummary || "Not set"))}</p></div>
            <div><strong>Inspiration</strong><p>${escapeHtml(String(brief.inspirationSummary || "Not set"))}</p></div>
            <div><strong>Mood Arc</strong><p>${escapeHtml(String(brief.moodEnergyArc || "Not set"))}</p></div>
            <div><strong>Visual Cues</strong><p>${escapeHtml(String(brief.visualCues || "Not set"))}</p></div>
          </div>
          <h4>Brief Sections</h4>
          ${renderDetailList(brief.sections, "No brief sections yet.")}
          <h4>Design Hypotheses</h4>
          ${renderDetailList(brief.hypotheses, "No design hypotheses captured yet.")}
        `
        : `<p class="banner">No creative brief has been generated yet.</p>`;
    } else if (inspected === "proposal-bundle") {
      const bundle = state.creative?.proposalBundle || null;
      title = "Proposal Bundle Detail";
      kicker = "Proposal";
      body = bundle
        ? `
          <p class="artifact-body">${escapeHtml(String(bundle.summary || ""))}</p>
          <div class="artifact-detail-grid">
            <div><strong>Lifecycle</strong><p>${escapeHtml(String(bundle.lifecycle?.status || "fresh"))}</p></div>
            <div><strong>Base Revision</strong><p>${escapeHtml(String(bundle.baseRevision || "unknown"))}</p></div>
            <div><strong>Change Tolerance</strong><p>${escapeHtml(String(bundle.constraints?.changeTolerance || "moderate"))}</p></div>
            <div><strong>Allow Global Rewrite</strong><p>${bundle.constraints?.allowGlobalRewrite ? "Yes" : "No"}</p></div>
          </div>
          <h4>Proposal Lines</h4>
          ${renderDetailList(bundle.proposalLines, "No proposal lines available.")}
          <h4>Assumptions</h4>
          ${renderDetailList(bundle.assumptions, "No assumptions captured.")}
          <h4>Open Questions</h4>
          ${renderDetailList(bundle.guidedQuestions, "No guided questions remain.")}
          <h4>Risk Notes</h4>
          ${renderDetailList(bundle.riskNotes, "No risk notes captured.")}
        `
        : `<p class="banner">No proposal bundle is available yet.</p>`;
    } else if (inspected === "director-profile") {
      const profile = state.directorProfile || null;
      const preferences = profile?.preferences && typeof profile.preferences === "object"
        ? Object.entries(profile.preferences)
        : [];
      title = "Director Profile Detail";
      kicker = "Preference Memory";
      body = profile
        ? `
          <p class="artifact-body">${escapeHtml(String(profile.summary || "No learned preference summary yet."))}</p>
          <div class="artifact-detail-grid">
            <div><strong>Director</strong><p>${escapeHtml(String(profile.displayName || profile.directorId || "Director"))}</p></div>
            <div><strong>Accepted Evidence</strong><p>${escapeHtml(String((profile?.evidence?.acceptedProposalIds || []).length || 0))}</p></div>
            <div><strong>Rejected Evidence</strong><p>${escapeHtml(String((profile?.evidence?.rejectedProposalIds || []).length || 0))}</p></div>
            <div><strong>Explicit Notes</strong><p>${escapeHtml(String((profile?.evidence?.explicitPreferenceNotes || []).length || 0))}</p></div>
          </div>
          <h4>Preference Signals</h4>
          ${
            preferences.length
              ? `<ul class="artifact-detail-list">${preferences.map(([key, signal]) => `
                  <li>
                    <strong>${escapeHtml(String(key))}</strong> -
                    weight ${escapeHtml(String(Number(signal?.weight ?? 0).toFixed(2)))},
                    confidence ${escapeHtml(String(Number(signal?.confidence ?? 0).toFixed(2)))},
                    evidence ${escapeHtml(String(signal?.evidenceCount ?? 0))}
                    ${String(signal?.notes || "").trim() ? `<div class="banner">${escapeHtml(String(signal.notes))}</div>` : ""}
                  </li>
                `).join("")}</ul>`
              : `<p class="banner">No learned preference signals yet.</p>`
          }
        `
        : `<p class="banner">No director profile is available yet.</p>`;
    } else if (inspected === "review-plan") {
      const plan = state.agentPlan || {};
      title = "Execution Plan Detail";
      kicker = "Plan Handoff";
      body = `
        <div class="artifact-detail-grid">
          <div><strong>Summary</strong><p>${escapeHtml(String(plan.summary || state.health?.orchestrationLastSummary || "No plan summary yet."))}</p></div>
          <div><strong>Status</strong><p>${escapeHtml(String(plan.status || state.health?.orchestrationLastStatus || "unknown"))}</p></div>
          <div><strong>Run ID</strong><p>${escapeHtml(String(plan.runId || state.health?.orchestrationLastRunId || "n/a"))}</p></div>
          <div><strong>Warnings</strong><p>${escapeHtml(String(Array.isArray(plan.warnings) ? plan.warnings.length : 0))}</p></div>
        </div>
        <h4>Warnings</h4>
        ${list(plan.warnings, "No plan warnings.")}
      `;
    } else if (inspected === "review-execution") {
      const verification = state.lastApplyVerification || {};
      const applyHistory = Array.isArray(state.applyHistory) ? state.applyHistory : [];
      const lastApply = applyHistory.length ? applyHistory[0] : null;
      title = "Execution Result Detail";
      kicker = "Apply Result";
      body = `
        <div class="artifact-detail-grid">
          <div><strong>Last Apply Status</strong><p>${escapeHtml(String(lastApply?.status || "none"))}</p></div>
          <div><strong>Verification</strong><p>${verification?.expectedMutationsPresent ? "Verified" : "Pending / review"}</p></div>
          <div><strong>Backup Path</strong><p>${escapeHtml(String(state.lastApplyBackupPath || "Not captured"))}</p></div>
          <div><strong>Failure Reason</strong><p>${escapeHtml(String(lastApply?.failureReason || "none"))}</p></div>
        </div>
        <h4>Verification Notes</h4>
        ${renderDetailList([
          verification?.revisionAdvanced ? "Revision advanced after apply." : "",
          verification?.expectedMutationsPresent ? "Expected mutations confirmed." : "",
          verification?.displayOrderVerified ? "Display element ordering confirmed." : ""
        ], "No verification details yet.")}
      `;
    } else {
      return "";
    }

    return `
      <section class="card artifact-detail-card full-span">
        <div class="artifact-detail-header">
          <div>
            <div class="artifact-kicker">${escapeHtml(kicker)}</div>
            <h3>${escapeHtml(title)}</h3>
          </div>
          <button data-close-artifact-detail>Close</button>
        </div>
        ${body}
      </section>
    `;
  }

  function getWorkspaceFrameDefinition(kind = "") {
    const definitions = {
      project: {
        summary: "Set the project context: project file, show folder, media path, and active sequence."
      },
      metadata: {
        summary: "Confirm the layout details that help the app understand props, groups, and submodels before sequencing."
      },
      audio: {
        summary: "Analyze the song and capture the timing and structure the rest of the workflow will use."
      },
      design: {
        summary: "Shape the creative direction and let the designer capture the sequence brief live from conversation."
      },
      sequence: {
        summary: "Inspect how the current design is being translated into actual sequencing changes."
      },
      review: {
        summary: "Review the current design and sequence snapshot, then approve and apply it deliberately."
      },
      history: {
        summary: "Audit what design and sequence state was actually implemented at each applied revision."
      },
      settings: {
        summary: "Manage app-level connections, services, identities, and safety controls."
      }
    };

    return definitions[kind] || null;
  }

  function renderJourneyCard(kind = "") {
    const row = getWorkspaceFrameDefinition(kind);
    if (!row) return "";
    return `
      <section class="card journey-card full-span">
        <h3>${escapeHtml(row.summary)}</h3>
      </section>
    `;
  }

  function renderWorkspaceFrame(kind = "", body = "", pageClass = "") {
    const className = pageClass ? ` ${pageClass}` : "";
    return `
      <div class="workspace-page${className}">
        ${renderJourneyCard(kind)}
        <section class="card workspace-content-window">
          <div class="workspace-content-body">
            ${body}
          </div>
        </section>
      </div>
    `;
  }

  function parseTranslatedTarget(line = "") {
    const text = String(line || "").trim();
    if (!text) return "";
    const parts = text.split("/").map((part) => String(part || "").trim()).filter(Boolean);
    return parts.length >= 2 ? parts[1] : "";
  }

  function parseProposalLineParts(line = "") {
    const text = String(line || "").trim();
    const parts = text.split(/\s+\/\s+/).map((part) => String(part || "").trim()).filter(Boolean);
    return {
      section: parts[0] || "General",
      target: parts[1] || "General",
      summary: parts.length > 2 ? parts.slice(2).join(" / ") : ""
    };
  }

  function inferTargetLevel(target = "") {
    const id = String(target || "").trim();
    if (!id || id === "General" || id === "AllModels") return "Group";
    if (state.sceneGraph?.submodelsById && state.sceneGraph.submodelsById[id]) return "Submodel";
    if (state.sceneGraph?.groupsById && state.sceneGraph.groupsById[id]) return "Group";
    if (state.sceneGraph?.modelsById && state.sceneGraph.modelsById[id]) return "Model";
    if (id.includes("/")) return "Submodel";
    return "Model";
  }

  function inferTimingTrackName(commands = []) {
    const rows = Array.isArray(commands) ? commands : [];
    const timingWrite = rows.find((row) => String(row?.cmd || "").trim() === "timing.createTrack");
    if (timingWrite?.params?.name) return String(timingWrite.params.name);
    const align = rows.find((row) => String(row?.cmd || "").trim() === "effects.alignToTiming");
    if (align?.params?.timingTrackName) return String(align.params.timingTrackName);
    return "XD: Sequencer Plan";
  }

  function summarizeSequenceGridRow(line = "") {
    const parsed = parseProposalLineParts(line);
    let commands = [];
    try {
      commands = buildDesignerPlanCommands([line], {
        displayElements: state.displayElements || [],
        targetIds: Array.isArray(state.creative?.intentHandoff?.scope?.targetIds) ? state.creative.intentHandoff.scope.targetIds : [],
        groupIds: Object.keys(state.sceneGraph?.groupsById || {}),
        groupsById: state.sceneGraph?.groupsById || {},
        submodelsById: state.sceneGraph?.submodelsById || {}
      });
    } catch {
      commands = [];
    }
    const effectCount = commands.filter((row) => String(row?.cmd || "").trim() === "effects.create").length;
    const alignCount = commands.filter((row) => String(row?.cmd || "").trim() === "effects.alignToTiming").length;
    return {
      timing: inferTimingTrackName(commands),
      section: parsed.section || "General",
      target: parsed.target || "General",
      level: inferTargetLevel(parsed.target),
      summary: parsed.summary || "Pending translation detail",
      effects: effectCount + alignCount
    };
  }

  function renderSnapshotDashboard({
    kicker = "Snapshot",
    title = "Snapshot Detail",
    brief = null,
    proposalLines = [],
    applyResult = null,
    analysisArtifact = null,
    sceneContext = null,
    musicContext = null,
    renderObservation = null,
    renderCritiqueContext = null,
    artifactRefs = null,
    emptyText = "No snapshot loaded."
  } = {}) {
    const safeProposalLines = Array.isArray(proposalLines)
      ? proposalLines.map((row) => String(row || "").trim()).filter(Boolean)
      : [];
    const safeArtifactRefs = artifactRefs && typeof artifactRefs === "object"
      ? Object.entries(artifactRefs).filter(([, value]) => String(value || "").trim())
      : [];
    const focalCandidates = Array.isArray(sceneContext?.focalCandidates)
      ? sceneContext.focalCandidates.filter(Boolean).slice(0, 4)
      : [];
    const sectionArc = Array.isArray(musicContext?.sectionArc)
      ? musicContext.sectionArc.filter(Boolean).slice(0, 6)
      : [];
    const activeModels = Array.isArray(renderObservation?.macro?.activeModelNames)
      ? renderObservation.macro.activeModelNames.filter(Boolean).slice(0, 4)
      : [];
    const activeFamilies = renderObservation?.macro?.activeFamilyTotals && typeof renderObservation.macro.activeFamilyTotals === "object"
      ? Object.keys(renderObservation.macro.activeFamilyTotals).filter(Boolean).slice(0, 4)
      : [];
    const renderFocusTargets = Array.isArray(renderCritiqueContext?.expected?.primaryFocusTargetIds)
      ? renderCritiqueContext.expected.primaryFocusTargetIds.filter(Boolean).slice(0, 3)
      : [];
    const missingFocusTargets = Array.isArray(renderCritiqueContext?.comparison?.missingPrimaryFocusTargets)
      ? renderCritiqueContext.comparison.missingPrimaryFocusTargets.filter(Boolean).slice(0, 3)
      : [];
    const hasContent =
      brief ||
      safeProposalLines.length ||
      applyResult ||
      analysisArtifact ||
      sceneContext ||
      musicContext ||
      renderObservation ||
      renderCritiqueContext ||
      safeArtifactRefs.length;
    if (!hasContent) {
      return `
        <section class="card full-span designer-dashboard-card">
          <div class="artifact-kicker">${escapeHtml(kicker)}</div>
          <h3>${escapeHtml(title)}</h3>
          <p class="artifact-body">${escapeHtml(emptyText)}</p>
        </section>
      `;
    }
    return `
      <section class="card full-span designer-dashboard-card">
        <div class="artifact-kicker">${escapeHtml(kicker)}</div>
        <h3>${escapeHtml(title)}</h3>
        <div class="dashboard-grid">
          <div class="dashboard-panel">
            <div class="artifact-kicker">Design</div>
            <p>${escapeHtml(String(brief?.summary || "No design summary loaded."))}</p>
            ${
              Array.isArray(brief?.goals) && brief.goals.length
                ? `<ul>${brief.goals.slice(0, 4).map((row) => `<li>${escapeHtml(String(row))}</li>`).join("")}</ul>`
                : "<p>No design goals captured.</p>"
            }
          </div>
          <div class="dashboard-panel">
            <div class="artifact-kicker">Sequence</div>
            ${
              safeProposalLines.length
                ? `<ul>${safeProposalLines.slice(0, 4).map((row) => `<li>${escapeHtml(String(row))}</li>`).join("")}</ul>`
                : "<p>No translated proposal lines loaded.</p>"
            }
          </div>
          <div class="dashboard-panel">
            <div class="artifact-kicker">Execution</div>
            <p>Status: ${escapeHtml(String(applyResult?.status || "pending"))}</p>
            <p>Commands: ${escapeHtml(String(applyResult?.commandCount || 0))}</p>
            <p>Impacts: ${escapeHtml(String(applyResult?.impactCount || 0))}</p>
            ${String(applyResult?.failureReason || "").trim() ? `<p>Failure: ${escapeHtml(String(applyResult.failureReason))}</p>` : ""}
          </div>
          <div class="dashboard-panel">
            <div class="artifact-kicker">Audio + Scene</div>
            <p>${escapeHtml(String(analysisArtifact?.trackIdentity?.title || "Unknown audio"))}</p>
            <p>${escapeHtml(String(sceneContext?.layoutMode || "unknown"))} layout context</p>
            <p>${focalCandidates.length ? `Focal: ${escapeHtml(focalCandidates.join(", "))}` : "No focal candidates loaded."}</p>
            <p>${sectionArc.length ? `Arc: ${escapeHtml(sectionArc.join(" -> "))}` : "No section arc loaded."}</p>
          </div>
          <div class="dashboard-panel">
            <div class="artifact-kicker">Render Feedback</div>
            <p>${escapeHtml(String(renderObservation?.macro?.leadModel || "No rendered lead model."))}</p>
            <p>${activeModels.length ? `Active: ${escapeHtml(activeModels.join(", "))}` : "No active rendered models captured."}</p>
            <p>${activeFamilies.length ? `Families: ${escapeHtml(activeFamilies.join(", "))}` : "No active family summary captured."}</p>
            <p>${renderObservation ? `Sampling: ${escapeHtml(String(renderObservation?.source?.samplingMode || "unknown"))} / ${escapeHtml(String(renderObservation?.source?.sampledModelCount || 0))} models` : "No render observation snapshot loaded."}</p>
            <p>${renderCritiqueContext ? `Breadth: ${escapeHtml(String(renderCritiqueContext?.observed?.breadthRead || "unknown"))} / temporal: ${escapeHtml(String(renderCritiqueContext?.observed?.temporalRead || "unknown"))} / lead focus match: ${renderCritiqueContext?.comparison?.leadMatchesPrimaryFocus ? "yes" : "no"}` : "No render critique context loaded."}</p>
            <p>${renderFocusTargets.length ? `Expected focus: ${escapeHtml(renderFocusTargets.join(", "))}` : "No expected render focus targets."}</p>
            ${missingFocusTargets.length ? `<p>Missing focus: ${escapeHtml(missingFocusTargets.join(", "))}</p>` : ""}
          </div>
        </div>
        ${
          safeArtifactRefs.length
            ? `<div class="artifact-chip-row">${safeArtifactRefs.slice(0, 6).map(([key, value]) => `<span class="artifact-chip">${escapeHtml(String(key))}: ${escapeHtml(String(value))}</span>`).join("")}</div>`
            : ""
        }
      </section>
    `;
  }

  function projectScreen() {
    const dashboard = pageStates?.project || {};
    const data = dashboard?.data || {};
    const lifecycle = data.lifecycle || {};
    const summary = data.summary || {};
    const sequenceContext = data.sequenceContext || {};
    return renderWorkspaceFrame("project", `
      <div class="screen-grid">
        <section class="card">
          <h3>Project Lifecycle</h3>
          <div class="banner">${lifecycle.hasSavedProject ? `Current Project: ${escapeHtml(String(lifecycle.projectName || "(unnamed)"))}` : "No project file is open yet."}</div>
          <p class="artifact-body">Use this screen to create a new project, open an existing project, and explicitly save the project workspace. Background app persistence protects session continuity, but Save writes the durable project file.</p>
          <div class="row">
            <button id="new-project">Create New Project</button>
            <button id="open-selected-project">Open Project</button>
            <button id="save-project" ${lifecycle.hasSavedProject ? "" : "disabled"}>Save</button>
            <button id="save-project-as">Save As</button>
          </div>
          <p class="banner">Save writes the current project definition and workspace snapshot to the project file. Save As creates a new project copy under the app project root.</p>
        </section>
        <section class="card">
          <h3>Project Summary</h3>
          <div class="banner">${lifecycle.hasSavedProject ? `Current Project: ${escapeHtml(String(lifecycle.projectName || "(unnamed)"))}` : "Create a project to assign a project name."}</div>
          <div class="field">
            <label>Creative Direction (Project Level)</label>
            <textarea id="project-concept-input" rows="3" placeholder="High-level show concept and tone...">${String(state.projectConcept || "")}</textarea>
            <p class="banner">Project-level concept only. Sequence-specific inspiration lives in the Design workspace.</p>
          </div>
          <div class="field">
            <label>Project Root Folder</label>
            <p class="banner">Configured in Settings. This is the app-owned root where xLightsDesigner stores projects.</p>
          </div>
          <div style="height: 10px;"></div>
          <div class="field">
            <label>Show Directory</label>
            <div class="row">
              <input id="showfolder-input" value="${summary.showFolder || ""}" />
              <button id="browse-showfolder">Browse...</button>
            </div>
          </div>
          <div class="field">
            <label>Media Directory</label>
            <div class="row">
              <input id="mediapath-input" value="${summary.mediaPath || ""}" placeholder="Folder containing media files for this project" />
              <button id="browse-mediapath">Browse...</button>
            </div>
          </div>
          <p class="banner">Show Directory inventory: ${summary.xsqCount || 0} .xsq | ${summary.xdmetaCount || 0} .xdmeta</p>
          <p class="banner">Project created: ${escapeHtml(String(summary.createdAt || "(not set)"))}</p>
          <p class="banner">Project updated: ${escapeHtml(String(summary.updatedAt || "(not set)"))}</p>
          <div class="row">
            <button id="reset-project">Reset Project Workspace</button>
          </div>
        </section>
        <section class="card">
          <h3>Active Sequence Context</h3>
          <p class="artifact-body">Choose or create the working sequence here. Once the context is set, use the Sequence page to inspect the live translation of the design into technical sequencing changes.</p>
          <div class="field">
            <label>Sequence (from Show Directory)</label>
            <select id="sequence-catalog-select">
              ${
                sequenceContext.options?.length
                  ? sequenceContext.options
                      .map((s) => {
                        const path = String(s?.path || "");
                        const rel = String(s?.relativePath || path);
                        const name = String(s?.name || path.split("/").pop() || rel);
                        return `<option value="${path.replace(/\"/g, "&quot;")}" ${s?.selected ? "selected" : ""}>${name} - ${rel}</option>`;
                      })
                      .join("")
                  : `<option value="">No sequences found under Show Directory</option>`
              }
            </select>
          </div>
          <div class="row project-actions">
            <button id="open-sequence">Open</button>
            <button id="new-sequence">Create New Sequence</button>
            <button id="save-sequence" ${sequenceContext.sequenceLoaded ? "" : "disabled"}>Save Sequence</button>
            <button id="save-sequence-as" ${sequenceContext.sequenceLoaded ? "" : "disabled"}>Save Sequence As</button>
          </div>
          <p class="banner">Active: ${escapeHtml(String(sequenceContext.activeSequence || "(none)"))}</p>
          <p class="banner">Media: ${escapeHtml(String(sequenceContext.mediaFile || "(none attached)"))}</p>
          <p class="banner">Revision: ${escapeHtml(String(sequenceContext.revision || "(not loaded)"))}</p>
        </section>
      </div>
    `, "project-screen");
  }

  function settingsScreen() {
    return renderWorkspaceFrame("settings", `
      <div class="screen-grid settings-screen">
        ${buildSettingsContent({ state, helpers, pageState: pageStates?.settings || null, includeClose: false })}
      </div>
    `, "settings-screen");
  }

  function renderAudioLiveDashboardCard() {
    const dashboard = pageStates?.audio || {};
    const header = dashboard?.header || {};
    const actions = dashboard?.actions || {};
    const singleTrack = actions?.singleTrack || {};
    const batch = actions?.batch || {};
    const options = Array.isArray(singleTrack.options) ? singleTrack.options : [];
    const currentResult = dashboard?.currentResult || {};
    const library = dashboard?.library || {};
    const overview = library?.overview || {};
    const rows = Array.isArray(library?.rows) ? library.rows : [];
    const detail = dashboard?.detail || null;
    const latestBatchReview = dashboard?.latestBatchReview || {};
    const statusClass = String(currentResult?.isRunning ? "pending" : currentResult?.hasTrack ? "ready" : "idle").trim();

    function renderStatusBadge(status) {
      const label = String(status || "Unknown").trim() || "Unknown";
      const tone = label === "Complete" || label === "Ready"
        ? "ready"
        : label === "Needs Review"
          ? "warning"
        : label === "Failed"
            ? "danger"
            : label === "Selected"
              ? "neutral"
              : "pending";
      return `<span class="status-chip status-chip-${tone}">${escapeHtml(label)}</span>`;
    }

    return `
      <section class="card full-span audio-page-shell">
        <div class="audio-page-header">
          <div>
            <div class="artifact-kicker">Standalone Workflow</div>
            <h3>${escapeHtml(String(header.title || "Audio Analysis"))}</h3>
            <p class="artifact-body">${escapeHtml(String(header.summary || ""))}</p>
          </div>
        </div>

        <div class="audio-page-stack">
          <section class="audio-primary-actions">
            <div class="dashboard-panel">
              <div class="artifact-kicker">Single Track</div>
              <h4>Analyze one song</h4>
              <p class="banner">Choose a single audio file directly or reuse a file from the current media directory.</p>
              <div class="field">
                <label>Selected Audio File</label>
                <div class="row">
                  <input id="audio-path-input" value="${escapeHtml(String(singleTrack.selectedAudioPath || ""))}" placeholder="Choose a single audio file for analysis" />
                  <button id="browse-audio-file">Browse File</button>
                  <button id="analyze-audio" ${singleTrack.canAnalyze ? "" : "disabled"}>Analyze Track</button>
                </div>
              </div>
              <div class="field">
                <label>Or Pick From Current Media Directory</label>
                <div class="row">
                  <select id="audio-track-select">
                    ${
                      options.length
                        ? options.map((row) => {
                            const path = String(row?.path || "").trim();
                            const detailText = String(row?.detail || "").trim();
                            const label = String(row?.label || detailText || path).trim();
                            return `<option value="${escapeHtml(path)}" ${row?.selected ? "selected" : ""}>${escapeHtml(label)}${detailText ? ` - ${escapeHtml(detailText)}` : ""}</option>`;
                          }).join("")
                        : `<option value="">No media files found in Media Directory</option>`
                    }
                  </select>
                </div>
              </div>
            </div>
            <div class="dashboard-panel">
              <div class="artifact-kicker">Batch Library</div>
              <h4>Analyze a folder</h4>
              <p class="banner">Build or refresh shared metadata records for a folder of audio files.</p>
              <div class="field">
                <label>Audio Folder</label>
                <div class="row">
                  <input id="audio-batch-folder-input" value="${escapeHtml(String(batch.batchFolder || ""))}" placeholder="Choose a folder to batch analyze into the shared track library" />
                  <button id="browse-audio-batch-folder">Browse Folder</button>
                  <button id="analyze-audio-folder" ${batch.isRunning ? "disabled" : ""}>Analyze Folder</button>
                </div>
              </div>
              <label class="audio-inline-check">
                <input id="audio-batch-recursive" type="checkbox" ${batch.recursive ? "checked" : ""} />
                <span>Include subfolders recursively</span>
              </label>
              <p class="banner">
                ${
                  latestBatchReview.status === "running"
                    ? "Batch analysis is running."
                    : latestBatchReview.totalTracks
                      ? `${escapeHtml(String(latestBatchReview.successfulTracks || 0))}/${escapeHtml(String(latestBatchReview.totalTracks || 0))} tracks processed in the latest batch run.`
                      : "No batch run recorded yet."
                }
              </p>
            </div>
          </section>

          <section class="audio-result-summary">
            <div class="dashboard-panel">
              <div class="artifact-kicker">Current Result</div>
              <div class="audio-result-head">
                <div>
                  <h4>${escapeHtml(String(currentResult.title || "No track selected"))}</h4>
                  <p>${escapeHtml(String(currentResult.subtitle || "Choose a track or folder to begin."))}</p>
                </div>
                ${currentResult.hasTrack ? `<div>${renderStatusBadge(statusClass === "ready" ? "Ready" : currentResult.isRunning ? "Running" : "Selected")}</div>` : ""}
              </div>
              <p class="artifact-body">${escapeHtml(String(currentResult.summary || "No analysis has been run for the current track yet."))}</p>
              <div class="artifact-chip-row">
                ${currentResult.bpmText ? `<span class="artifact-chip">${escapeHtml(String(currentResult.bpmText))}</span>` : ""}
                ${currentResult.meterText ? `<span class="artifact-chip">${escapeHtml(String(currentResult.meterText))}</span>` : ""}
                <span class="artifact-chip">${escapeHtml(String(currentResult.timingSummary?.summaryText || "No timings yet"))}</span>
              </div>
              ${
                currentResult.hasTrack
                  ? `
                  <div class="artifact-meta-block">
                    <p>Recommended action: ${escapeHtml(String(currentResult.actionText || "None"))}</p>
                    <p>Missing timings: ${escapeHtml(String(currentResult.missingTimingsText || "None"))}</p>
                    ${currentResult.availableProfilesText ? `<p>Available profiles: ${escapeHtml(String(currentResult.availableProfilesText))}</p>` : ""}
                    ${currentResult.verificationText ? `<p>Verification: ${escapeHtml(String(currentResult.verificationText))}</p>` : ""}
                  </div>
                  `
                  : ""
              }
              ${
                currentResult.actionKind === "verify_identity"
                  ? `
                  <div class="field">
                    <label>Track Title</label>
                    <input id="confirm-audio-track-title" value="${escapeHtml(String(currentResult.suggestedTitle || ""))}" placeholder="Confirmed track title" />
                  </div>
                  <div class="field">
                    <label>Track Artist</label>
                    <input id="confirm-audio-track-artist" value="${escapeHtml(String(currentResult.suggestedArtist || ""))}" placeholder="Confirmed track artist" />
                  </div>
                  <div class="artifact-actions"><button id="confirm-audio-library-track-info">Confirm Track Info</button></div>
                  `
                  : ""
              }
              ${currentResult.progressMessage ? `<p class="banner">${escapeHtml(String(currentResult.progressMessage))}</p>` : ""}
              <p class="banner">Last analyzed: ${escapeHtml(String(currentResult.lastAnalyzedLabel || "never"))}</p>
            </div>
          </section>

          <section class="audio-library-grid-panel">
            <div class="metadata-panel-header">
              <div>
                <div class="artifact-kicker">Shared Track Library</div>
                <h4>Track metadata status</h4>
                <p class="artifact-body">Browse what is already analyzed, which timing layers are available, and whether anything still needs attention.</p>
              </div>
              <div class="artifact-chip-row">
                <span class="artifact-chip">${escapeHtml(String(overview.total || 0))} tracks</span>
                <span class="artifact-chip">${escapeHtml(String(overview.complete || 0))} complete</span>
                <span class="artifact-chip">${escapeHtml(String(overview.partial || 0))} partial</span>
                <span class="artifact-chip">${escapeHtml(String(overview.needsReview || 0))} need review</span>
              </div>
            </div>
            ${library.loadError ? `<p class="banner warning">${escapeHtml(String(library.loadError))}</p>` : ""}
            <div class="metadata-grid-wrap proposed-grid-wrap">
              <table class="metadata-grid proposed-grid">
                <thead>
                  <tr>
                    <th>Track</th>
                    <th>Status</th>
                    <th>Available Timings</th>
                    <th>Missing / Issues</th>
                    <th>Identity</th>
                    <th>Last Analyzed</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    rows.length
                      ? rows.map((row) => `
                        <tr class="${row.selected ? "is-selected" : ""}" data-audio-library-row="${escapeHtml(String(row.key || ""))}">
                          <td>
                            <strong>${escapeHtml(String(row.displayName || ""))}</strong>
                            ${row.artist ? `<div class="media-meta">${escapeHtml(String(row.artist))}</div>` : ""}
                          </td>
                          <td>${renderStatusBadge(row.status)}</td>
                          <td>${escapeHtml(String(row.availableTimingsText || "None yet"))}</td>
                          <td>${escapeHtml(String(row.missingIssuesText || ""))}</td>
                          <td>${escapeHtml(String(row.identityText || ""))}</td>
                          <td>${escapeHtml(String(row.lastAnalyzedLabel || "never"))}</td>
                          <td>${escapeHtml(String(row.actionText || "None"))}</td>
                        </tr>
                      `).join("")
                      : `<tr><td colspan="7">No shared track metadata has been created yet.</td></tr>`
                  }
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>
    `;
  }

  function audioScreen() {
    const dashboard = pageStates?.audio || {};
    const emptyState = dashboard?.emptyState || null;
    return renderWorkspaceFrame("audio", `
      <div class="screen-grid audio-screen">
        ${renderAudioLiveDashboardCard()}
        ${
          emptyState
            ? `
        <section class="card">
          <h3>${escapeHtml(String(emptyState.title || "No Media Loaded"))}</h3>
          <p class="artifact-body">${escapeHtml(String(emptyState.summary || ""))}</p>
        </section>
        `
            : ""
        }
      </div>
    `, "audio-screen");
  }

  function renderSequenceContextArtifactCard() {
    const seqSettings = state.sequenceSettings && typeof state.sequenceSettings === "object" ? state.sequenceSettings : {};
    const displayElements = Array.isArray(state.sceneGraph?.displayElements) ? state.sceneGraph.displayElements : [];
    const groupCount = Number(state.sceneGraph?.stats?.groupCount || 0);
    const submodelCount = Number(state.sceneGraph?.stats?.submodelCount || 0);
    return `
      <section class="card artifact-card artifact-card-sequence">
        <div class="artifact-kicker">Sequence Context</div>
        <h3>${escapeHtml(String(state.activeSequence || "No sequence open"))}</h3>
        <div class="artifact-chip-row">
          <span class="artifact-chip artifact-chip-accent">${escapeHtml(String(state.currentSequenceRevision || "unknown"))}</span>
          <span class="artifact-chip">${escapeHtml(String(seqSettings.sequenceType || "Media"))}</span>
          <span class="artifact-chip">${seqSettings.supportsModelBlending ? "blending on" : "blending off"}</span>
        </div>
        <p class="artifact-body">${escapeHtml(String(state.sequenceMediaFile || state.audioPathInput || "No media attached"))}</p>
        <p class="banner">Display elements: ${displayElements.length} | groups: ${groupCount} | submodels: ${submodelCount}</p>
        <p class="banner">Layout mode: ${escapeHtml(String(state.sceneGraph?.stats?.layoutMode || "2d").toUpperCase())}</p>
        ${buildArtifactInspectActions("sequence-context")}
      </section>
    `;
  }

  function renderSequenceScopeArtifactCard() {
    const sections = getSections();
    const selectedSections = getSelectedSections();
    const allSelected = hasAllSectionsSelected();
    const selectionText = allSelected ? "All sections" : (selectedSections.length ? selectedSections.join(", ") : "No sections selected");
    const metadataSelectionCount = Array.isArray(state.ui.metadataSelectionIds) ? state.ui.metadataSelectionIds.length : 0;
    return `
      <section class="card artifact-card artifact-card-sequence-status">
        <div class="artifact-kicker">Working Scope</div>
        <h3>${escapeHtml(selectionText)}</h3>
        <div class="artifact-chip-row">
          <span class="artifact-chip">${sections.length} sections</span>
          <span class="artifact-chip">${metadataSelectionCount} tagged targets selected</span>
          <span class="artifact-chip">${Array.isArray(state.models) ? state.models.length : 0} models loaded</span>
        </div>
        <p class="banner">This scope is the technical boundary the current design will translate into before review and apply.</p>
        ${buildArtifactInspectActions("sequence-scope")}
      </section>
    `;
  }

  function renderSequenceIntentArtifactCard() {
    const intent = state.creative?.intentHandoff || getValidHandoff("intent_handoff_v1");
    return `
      <section class="card artifact-card artifact-card-sequence-status">
        <div class="artifact-kicker">Intent Handoff</div>
        <h3>${escapeHtml(String(intent?.goal || "No sequencing goal captured"))}</h3>
        <div class="artifact-chip-row">
          <span class="artifact-chip artifact-chip-accent">${escapeHtml(String(intent?.mode || "unknown"))}</span>
          <span class="artifact-chip">${escapeHtml(String((intent?.scope?.targetIds || []).length || 0))} targets</span>
          <span class="artifact-chip">${escapeHtml(String((intent?.scope?.sections || []).length || 0))} sections</span>
        </div>
        <p class="artifact-body">${escapeHtml(String(intent?.directorPreferences?.styleDirection || "The normalized sequencing intent from the current conversation will appear here."))}</p>
        ${buildArtifactInspectActions("sequence-intent")}
      </section>
    `;
  }

  function renderSequenceTranslationGrid() {
    const dashboard = pageStates?.sequence || {};
    const data = dashboard?.data || {};
    const rows = Array.isArray(data.rows) ? data.rows : [];
    const timingDependency = data.timingDependency || {};
    const activeDesignFilter = data.activeDesignFilter || null;
    const timingStatusRows = Array.isArray(data.timingTrackStatus) ? data.timingTrackStatus : [];
    const timingReview = data.timingReview || {};
    return `
      <section class="card full-span sequence-translation-card">
        <div class="artifact-kicker">Sequence Translation</div>
        <h3>${escapeHtml(String(dashboard.summary || "Live technical translation of the current design conversation."))}</h3>
        <p class="artifact-body">The grid below shows how the current design conversation is turning into technical sequence changes for inspection before review and apply.</p>
        <div class="artifact-chip-row">
          <span class="artifact-chip artifact-chip-accent">${escapeHtml(String(data.translationSource || "Pending"))}</span>
          <span class="artifact-chip artifact-chip-accent">${escapeHtml(String(data.changeLineCount || 0))} change lines</span>
          <span class="artifact-chip">${escapeHtml(String(data.commandCount || 0))} commands</span>
          <span class="artifact-chip">${escapeHtml(String(data.warningCount || 0))} warnings</span>
          <span class="artifact-chip">${escapeHtml(String(data.targetCount || 0))} targets in scope</span>
          <span class="artifact-chip">${escapeHtml(String(data.sectionCount || 0))} sections in scope</span>
        </div>
        ${
          timingReview.trackCount
            ? `
              <div class="artifact-chip-row">
                <span class="artifact-chip artifact-chip-accent">Timing Review: ${escapeHtml(String(timingReview.status || "unknown"))}</span>
                <span class="artifact-chip">${escapeHtml(String(timingReview.trackCount || 0))} tracked</span>
                <span class="artifact-chip">${escapeHtml(String(timingReview.userEditedCount || 0))} edited</span>
                <span class="artifact-chip">${escapeHtml(String(timingReview.staleCount || 0))} stale</span>
                <span class="artifact-chip">${escapeHtml(String(timingReview.reconcilableCount || 0))} reconcilable</span>
              </div>
              <div class="banner ${timingReview.needsReview ? "banner-warning" : ""}">${escapeHtml(String(timingReview.summaryText || ""))}</div>
            `
            : ""
        }
        ${
          timingDependency.summary
            ? `<div class="banner ${timingDependency.ready ? "" : "banner-warning"}">${escapeHtml(String(timingDependency.summary))}</div>`
            : ""
        }
        ${
          activeDesignFilter
            ? `<div class="banner">Inspecting ${escapeHtml(String(activeDesignFilter.designLabel || activeDesignFilter.designId || "design concept"))}. <button id="clear-sequence-design-filter">Show all sequence rows</button></div>`
            : ""
        }
        <div class="metadata-grid-wrap proposed-grid-wrap sequence-grid-wrap">
          <table class="metadata-grid proposed-grid">
                <thead>
                  <tr>
                <th style="width:52px;">#</th>
                <th style="width:92px;">Design ID</th>
                <th style="width:124px;">Timing</th>
                <th style="width:124px;">Section</th>
                <th style="width:148px;">Target</th>
                <th style="width:92px;">Level</th>
                <th>Summary</th>
                <th style="width:72px;">Effects</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                rows.length
                  ? rows.map((row, idx) => {
                      return `
                    <tr>
                      <td>${idx + 1}</td>
                      <td>${escapeHtml(String(row.designLabel || row.designId || "—"))}</td>
                      <td>${escapeHtml(String(row.timing || "XD: Sequencer Plan"))}</td>
                      <td>${escapeHtml(String(row.section || "General"))}</td>
                      <td>${escapeHtml(String(row.target || "Unresolved"))}</td>
                      <td>${escapeHtml(String(row.level || "Model"))}</td>
                      <td data-proposed-focus="${idx}" class="sequence-summary-cell" title="${escapeHtml(String(row.summary || "Pending translation detail"))}">${escapeHtml(String(row.summary || "Pending translation detail"))}</td>
                      <td>${escapeHtml(String(row.effects || 0))}</td>
                    </tr>
                  `;
                    }).join("")
                  : `<tr><td colspan="8" class="banner">${
                    activeDesignFilter
                      ? `No translated sequence changes are linked to ${escapeHtml(String(activeDesignFilter.designLabel || activeDesignFilter.designId || "this design concept"))} in the current draft.`
                      : "No active translated sequence changes yet. Generate or revise a design concept to populate this view."
                  }</td></tr>`
              }
                </tbody>
              </table>
        </div>
        ${
          timingStatusRows.length
            ? `
              <div class="metadata-grid-wrap proposed-grid-wrap sequence-grid-wrap" style="margin-top:12px;">
                <table class="metadata-grid proposed-grid">
                  <thead>
                    <tr>
                      <th style="width:180px;">Timing Track</th>
                      <th style="width:120px;">Status</th>
                      <th style="width:90px;">Coverage</th>
                      <th style="width:140px;">Captured</th>
                      <th>Diff</th>
                      <th style="width:140px;">Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${timingStatusRows.map((row) => `
                      <tr>
                        <td>${escapeHtml(String(row.trackName || "XD: Track"))}</td>
                        <td>${escapeHtml(String(row.status || "unknown"))}</td>
                        <td>${escapeHtml(String(row.coverageMode || "unknown"))}</td>
                        <td>${escapeHtml(String(row.capturedAt || "—"))}</td>
                        <td>${escapeHtml(`moved ${Number(row?.diffSummary?.moved || 0)}, relabeled ${Number(row?.diffSummary?.relabeled || 0)}, added ${Number(row?.diffSummary?.addedByUser || 0)}, removed ${Number(row?.diffSummary?.removedFromSource || 0)}`)}</td>
                        <td>
                          ${row.canReconcile
                            ? `<button data-accept-timing-review="${escapeHtml(String(row.policyKey || ""))}" data-track-name="${escapeHtml(String(row.trackName || ""))}">Accept Review</button>`
                            : `<span class="banner">No action</span>`
                          }
                        </td>
                      </tr>
                    `).join("")}
                  </tbody>
                </table>
              </div>
            `
            : ""
        }
      </section>
    `;
  }

  function sequenceScreen() {
    return renderWorkspaceFrame("sequence", `
      <div class="screen-grid sequence-screen">
        ${renderSequenceTranslationGrid()}
      </div>
    `, "sequence-screen");
  }

  function referenceMediaPanel() {
    const refs = Array.isArray(state.creative.references) ? state.creative.references : [];
    return `
      <section class="card">
        <h3>Reference Media</h3>
        <div class="field">
          <label>Upload images/video for inspiration</label>
          <input id="reference-upload-input" type="file" multiple accept="image/*,video/*" />
        </div>
        <p class="banner">Allowed reference formats: ${referenceFormatSummaryText()}</p>
        <p class="banner">Sequence-eligible formats: ${sequenceEligibilityFormatSummaryText()}</p>
        <p class="banner">Max file size: ${formatBytes(referenceMediaMaxFileBytes)} | Max references: ${referenceMediaMaxItems}</p>
        <div class="row">
          <button id="add-reference-media" ${refs.length >= referenceMediaMaxItems ? "disabled" : ""}>Add Selected References</button>
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
    `;
  }

  function colorPalettePanel() {
    const swatches = Array.isArray(state.inspiration?.paletteSwatches) ? state.inspiration.paletteSwatches : [];
    return `
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
        <p class="banner">Initial placeholder. We will expand this panel later.</p>
      </section>
    `;
  }

  function renderProposalArtifactCard() {
    const bundle = state.creative?.proposalBundle || null;
    return `
      <section class="card artifact-card artifact-card-design">
        <div class="artifact-kicker">Proposal Bundle</div>
        <h3>${escapeHtml(String(bundle?.summary || "No proposal yet"))}</h3>
        <div class="artifact-chip-row">
          <span class="artifact-chip artifact-chip-accent">${escapeHtml(String(bundle?.lifecycle?.status || "fresh"))}</span>
          <span class="artifact-chip">${escapeHtml(String((bundle?.proposalLines || []).length || 0))} lines</span>
          <span class="artifact-chip">${escapeHtml(String((bundle?.guidedQuestions || []).length || 0))} questions</span>
        </div>
        <p class="artifact-body">${escapeHtml(String(bundle?.scope?.summary || "Designer proposals will appear here once a direction is generated."))}</p>
        ${buildArtifactInspectActions("proposal-bundle")}
      </section>
    `;
  }

  function renderDirectorProfileArtifactCard() {
    const profile = state.directorProfile || null;
    const signalEntries = profile?.preferences && typeof profile.preferences === "object"
      ? Object.entries(profile.preferences)
      : [];
    const topSignals = signalEntries
      .slice()
      .sort((a, b) => {
        const aScore = Math.abs(Number(a?.[1]?.weight || 0)) * Number(a?.[1]?.confidence || 0);
        const bScore = Math.abs(Number(b?.[1]?.weight || 0)) * Number(b?.[1]?.confidence || 0);
        return bScore - aScore;
      })
      .slice(0, 3);
    return `
      <section class="card artifact-card artifact-card-design">
        <div class="artifact-kicker">Director Profile</div>
        <h3>${escapeHtml(String(profile?.summary || "No learned preference profile yet"))}</h3>
        <div class="artifact-chip-row">
          <span class="artifact-chip artifact-chip-accent">${escapeHtml(String(signalEntries.length || 0))} signals</span>
          <span class="artifact-chip">${escapeHtml(String((profile?.evidence?.acceptedProposalIds || []).length || 0))} accepted</span>
        </div>
        <p class="artifact-body">Project-scoped preference memory used as soft guidance for designer passes. It should bias proposals without locking the show into a repeated style.</p>
        <div class="artifact-chip-row">
          ${
            topSignals.length
              ? topSignals.map(([key]) => `<span class="artifact-chip">${escapeHtml(String(key))}</span>`).join("")
              : `<span class="artifact-chip artifact-chip-muted">No strong learned signals yet</span>`
          }
        </div>
        ${buildArtifactInspectActions("director-profile")}
      </section>
    `;
  }

  function renderDesignerLiveDashboardCard() {
    const dashboard = pageStates?.design || {};
    const data = dashboard?.data || {};
    const brief = data.brief || {};
    const focus = data.focus || {};
    const musicCues = data.musicCues || {};
    const references = data.references || {};
    const palette = data.palette || {};
    const executionPlan = data.executionPlan || {};
    const conceptRows = Array.isArray(executionPlan.conceptRows) ? executionPlan.conceptRows : [];
    const renderPaletteSwatches = (swatches = []) => {
      const rows = Array.isArray(swatches) ? swatches.filter(Boolean) : [];
      if (!rows.length) return "<span class=\"banner\">No palette captured yet.</span>";
      return `<div class="artifact-chip-row">${rows.map((color) => `<span class="artifact-chip" title="${escapeHtml(String(color))}"><span style="display:inline-block;width:10px;height:10px;border-radius:999px;background:${escapeHtml(String(color))};margin-right:6px;vertical-align:middle;border:1px solid rgba(255,255,255,0.18);"></span>${escapeHtml(String(color))}</span>`).join("")}</div>`;
    };
    return `
      <section class="card full-span designer-dashboard-card">
        <div class="artifact-kicker">Designer Live Dashboard</div>
        <h3>${escapeHtml(String(dashboard.summary || "Conversation-driven design state will appear here as the designer works."))}</h3>
        <div class="artifact-chip-row">
          <span class="artifact-chip artifact-chip-accent">${escapeHtml(String(data.sourceLabel || "Idle"))}</span>
          <span class="artifact-chip">${escapeHtml(String(data.runtime?.status || "idle"))}</span>
          <span class="artifact-chip">${escapeHtml(String(data.counts?.designConcepts || 0))} design concepts</span>
          <span class="artifact-chip">${escapeHtml(String(data.counts?.effectPlacements || 0))} placements</span>
          <span class="artifact-chip">${escapeHtml(String(data.counts?.openQuestions || 0))} open questions</span>
        </div>
        <p class="artifact-body">${escapeHtml(String(data.runtime?.assistantMessage || "The designer’s current reasoning, assumptions, and active focus will be summarized here."))}</p>
        <div class="dashboard-brief-block">
          <div class="artifact-kicker">Creative Brief</div>
          <h3>${escapeHtml(String(brief.summary || "No creative brief captured yet."))}</h3>
          <p class="artifact-body">${escapeHtml(String(brief.goalsSummary || "The designer will capture the overall sequence goal, mood, and section priorities here as the conversation develops."))}</p>
          <div class="artifact-chip-row">
            <span class="artifact-chip artifact-chip-accent">${escapeHtml(String(brief.sectionsCount || 0))} sections</span>
            <span class="artifact-chip">${escapeHtml(String(brief.hypothesesCount || 0))} hypotheses</span>
          </div>
          ${buildArtifactInspectActions("creative-brief")}
        </div>
        <div class="dashboard-grid">
          <div class="dashboard-panel">
            <div class="artifact-kicker">Captured Focus</div>
            <p>${focus.focal?.length ? escapeHtml(focus.focal.join(", ")) : "No focal hierarchy captured yet."}</p>
            <p>${focus.broad?.length ? `Broad coverage: ${escapeHtml(focus.broad.join(", "))}` : "No broad coverage domains captured yet."}</p>
          </div>
          <div class="dashboard-panel">
            <div class="artifact-kicker">Music Cues</div>
            <p>${musicCues.reveals?.length ? `Reveals: ${escapeHtml(musicCues.reveals.join(", "))}` : "No reveal moments captured yet."}</p>
            <p>${musicCues.holds?.length ? `Holds: ${escapeHtml(musicCues.holds.join(", "))}` : "No hold moments captured yet."}</p>
          </div>
          <div class="dashboard-panel">
            <div class="artifact-kicker">Active Assumptions</div>
            ${data.assumptions?.length ? `<ul>${data.assumptions.map((row) => `<li>${escapeHtml(String(row))}</li>`).join("")}</ul>` : "<p>No explicit assumptions captured yet.</p>"}
          </div>
          <div class="dashboard-panel">
            <div class="artifact-kicker">Needs From Director</div>
            ${data.guidedQuestions?.length ? `<ul>${data.guidedQuestions.map((row) => `<li>${escapeHtml(String(row))}</li>`).join("")}</ul>` : "<p>No blocking questions right now.</p>"}
          </div>
          ${
            references.count
              ? `
          <div class="dashboard-panel">
            <div class="artifact-kicker">Reference Media</div>
            <p>${escapeHtml(String(references.count))} reference item(s) attached.</p>
            <p>${escapeHtml(String((references.names || []).join(", ")))}</p>
          </div>
          `
              : ""
          }
          ${
            palette.count
              ? `
          <div class="dashboard-panel">
            <div class="artifact-kicker">Color Palette</div>
            <p>${escapeHtml(String(palette.count))} swatch(es) captured.</p>
            ${renderPaletteSwatches(palette.swatches || [])}
          </div>
          `
              : ""
          }
        </div>
        <div class="dashboard-brief-block">
          <div class="artifact-kicker">Design Concepts</div>
          <div class="artifact-chip-row">
            <span class="artifact-chip artifact-chip-accent">${escapeHtml(String(executionPlan.passScope || "unknown"))}</span>
            <span class="artifact-chip">${escapeHtml(String(executionPlan.designConceptCount || 0))} concepts</span>
            <span class="artifact-chip">${escapeHtml(String(executionPlan.effectFamilyCount || 0))} effect families</span>
            <span class="artifact-chip">${escapeHtml(String(executionPlan.layerCount || 0))} layers</span>
          </div>
          <div class="metadata-grid-wrap proposed-grid-wrap sequence-grid-wrap">
            <table class="metadata-grid proposed-grid">
              <thead>
                <tr>
                  <th style="width:92px;">Design ID</th>
                  <th style="width:148px;">Anchor</th>
                  <th>Intent</th>
                  <th style="width:168px;">Focus</th>
                  <th style="width:168px;">Palette</th>
                  <th style="width:80px;">Linked</th>
                  <th style="width:216px;">Action</th>
                </tr>
              </thead>
              <tbody>
                ${
                  conceptRows.length
                    ? conceptRows.map((row) => `
                      <tr>
                        <td>${escapeHtml(String(row.designLabel || row.designId || "—"))}</td>
                        <td>${escapeHtml(String(row.anchor || "General"))}</td>
                        <td title="${escapeHtml(String(row.intent || ""))}">${escapeHtml(String(row.intent || "No design intent summary yet."))}</td>
                        <td>${escapeHtml(String((row.focus || []).join(", ") || "No focus targets"))}</td>
                        <td>${renderPaletteSwatches(row.palette?.colors || [])}</td>
                        <td>${escapeHtml(String(row.placementCount || 0))}</td>
                        <td>
                          <div class="row">
                            <button data-design-inspect="${escapeHtml(String(row.designId || ""))}">Inspect</button>
                            <button data-design-revise="${escapeHtml(String(row.designId || ""))}">Revise</button>
                            <button data-design-remove="${escapeHtml(String(row.designId || ""))}">Delete</button>
                          </div>
                        </td>
                      </tr>
                    `).join("")
                    : `<tr><td colspan="7" class="banner">No active design concepts yet. Generate a proposal in Design chat to populate this view.</td></tr>`
                }
              </tbody>
            </table>
          </div>
        </div>
        ${dashboard.warnings?.length ? `<div class="banner banner-warning">${escapeHtml(dashboard.warnings.join(" | "))}</div>` : ""}
      </section>
    `;
  }

  function designScreen() {
    const dashboard = pageStates?.design || {};
    const lastAppliedSnapshot = dashboard?.data?.lastAppliedSnapshot || null;
    return renderWorkspaceFrame("design", `
      <div class="screen-grid design-screen">
        ${renderDesignerLiveDashboardCard()}
        ${
          lastAppliedSnapshot
            ? `
        <section class="card full-span designer-dashboard-card">
          <div class="artifact-kicker">Last Applied Snapshot</div>
          <h3>The most recently implemented design state for this sequence.</h3>
          <div class="dashboard-grid">
            <div class="dashboard-panel">
              <div class="artifact-kicker">Applied Brief</div>
              <p>${escapeHtml(String(lastAppliedSnapshot.briefSummary || "No applied brief summary."))}</p>
            </div>
            <div class="dashboard-panel">
              <div class="artifact-kicker">Applied Proposal</div>
              ${
                Array.isArray(lastAppliedSnapshot.proposalLines) && lastAppliedSnapshot.proposalLines.length
                  ? `<ul>${lastAppliedSnapshot.proposalLines.map((row) => `<li>${escapeHtml(String(row))}</li>`).join("")}</ul>`
                  : "<p>No applied proposal lines loaded.</p>"
              }
            </div>
            <div class="dashboard-panel">
              <div class="artifact-kicker">Applied Context</div>
              <p>${escapeHtml(String(lastAppliedSnapshot.audioTitle || "Unknown audio"))}</p>
              <p>${escapeHtml(String(lastAppliedSnapshot.layoutMode || "unknown"))} layout context</p>
            </div>
          </div>
        </section>
          `
            : ""
        }
        ${renderArtifactDetailPanel()}
      </div>
    `, "design-screen");
  }

  function renderReviewPlanArtifactCard() {
    const plan = state.agentPlan || {};
    return `
      <section class="card artifact-card artifact-card-review-plan">
        <div class="artifact-kicker">Plan Handoff</div>
        <h3>${escapeHtml(String(plan.summary || state.health?.orchestrationLastSummary || "No execution plan yet"))}</h3>
        <div class="artifact-chip-row">
          <span class="artifact-chip artifact-chip-accent">${escapeHtml(String(plan.status || state.health?.orchestrationLastStatus || "unknown"))}</span>
          <span class="artifact-chip">${escapeHtml(String(Array.isArray(plan.warnings) ? plan.warnings.length : 0))} warnings</span>
        </div>
        <p class="artifact-body">${escapeHtml(String(state.health?.orchestrationLastAt || "No recent orchestration timestamp"))}</p>
        ${buildArtifactInspectActions("review-plan")}
      </section>
    `;
  }

  function renderReviewExecutionArtifactCard() {
    const applyHistory = Array.isArray(state.applyHistory) ? state.applyHistory : [];
    const lastApply = applyHistory.length ? applyHistory[0] : null;
    const verification = state.lastApplyVerification || {};
    return `
      <section class="card artifact-card artifact-card-review-execution">
        <div class="artifact-kicker">Execution Result</div>
        <h3>${escapeHtml(String(lastApply?.status || "No apply run yet"))}</h3>
        <div class="artifact-chip-row">
          <span class="artifact-chip artifact-chip-accent">${verification?.expectedMutationsPresent ? "verified" : "pending"}</span>
          <span class="artifact-chip">${state.lastApplyBackupPath ? "backup ready" : "no backup"}</span>
        </div>
        <p class="artifact-body">${escapeHtml(String(lastApply?.summary || "Apply status and verification results will appear here after execution."))}</p>
        ${buildArtifactInspectActions("review-execution")}
      </section>
    `;
  }

  function reviewScreen() {
    const dashboard = pageStates?.review || {};
    const data = dashboard?.data || {};
    const stale = data.stale || {};
    const approvalChecked = Boolean(data.approvalChecked);
    const applyHistory = Array.isArray(state.applyHistory) ? state.applyHistory : [];
    const lastApply = applyHistory.length ? applyHistory[0] : null;
    const currentSnapshot = data.currentSnapshot || {};
    const lastAppliedSnapshot = data.lastAppliedSnapshot || null;
    const counts = data.counts || {};
    const verification = data.verification || null;
    const rows = Array.isArray(data.rows) ? data.rows : [];
    return renderWorkspaceFrame("review", `
      ${
        stale.active
          ? `
        <section class="card stale-card">
          <h3>Draft Is Stale</h3>
          <p class="banner warning">Sequence changed since this draft was created. Refresh/rebase before apply.</p>
          <div class="artifact-chip-row">
            <span class="artifact-chip artifact-chip-muted">base ${escapeHtml(String(stale.draftBaseRevision || "unknown"))}</span>
            <span class="artifact-chip artifact-chip-accent">current ${escapeHtml(String(stale.revision || "unknown"))}</span>
          </div>
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

      <div class="screen-grid review-screen">
        ${renderArtifactDetailPanel()}
      </div>

      <div class="screen-grid review-screen">
        <section class="card full-span artifact-card artifact-card-review">
          <div class="artifact-kicker">Review</div>
          <h3>${escapeHtml(String(dashboard.summary || "Ready to apply current design changes"))}</h3>
          <p class="artifact-body">${escapeHtml(String(data.planSummary || "No command preview available."))}</p>
          <div class="artifact-chip-row">
            <span class="artifact-chip artifact-chip-accent">${escapeHtml(String(data.reviewStateLabel || "Needs Approval"))}</span>
            <span class="artifact-chip">${escapeHtml(String(counts.pendingChanges || 0))} pending changes</span>
            <span class="artifact-chip">${escapeHtml(String(counts.targets || 0))} targets</span>
            <span class="artifact-chip">${escapeHtml(String(counts.windows || 0))} windows</span>
            <span class="artifact-chip">${escapeHtml(String(counts.commands || 0))} commands</span>
            ${data.preferenceCue ? `<span class="artifact-chip">${escapeHtml(String(data.preferenceCue))}</span>` : ""}
            <span class="artifact-chip">${verification ? (verification.expectedMutationsPresent ? "last apply verified" : "last apply needs review") : "not yet applied"}</span>
          </div>
          <div class="dashboard-grid">
            <div class="dashboard-panel">
              <div class="artifact-kicker">Design</div>
              <p>${escapeHtml(String(currentSnapshot?.designSummary?.title || "No current design summary."))}</p>
              ${
                Array.isArray(currentSnapshot?.designSummary?.goals) && currentSnapshot.designSummary.goals.length
                  ? `<ul>${currentSnapshot.designSummary.goals.slice(0, 4).map((row) => `<li>${escapeHtml(String(row))}</li>`).join("")}</ul>`
                  : "<p>No design goals captured.</p>"
              }
            </div>
            <div class="dashboard-panel">
              <div class="artifact-kicker">Sequence</div>
              ${
                Array.isArray(currentSnapshot?.sequenceSummary?.proposalLines) && currentSnapshot.sequenceSummary.proposalLines.length
                  ? `<ul>${currentSnapshot.sequenceSummary.proposalLines.slice(0, 4).map((row) => `<li>${escapeHtml(String(row))}</li>`).join("")}</ul>`
                  : "<p>No pending sequence translation lines.</p>"
              }
            </div>
            <div class="dashboard-panel">
              <div class="artifact-kicker">Apply State</div>
              <p>Status: ${escapeHtml(String(currentSnapshot?.applySummary?.status || "pending"))}</p>
              <p>${data.backupReady ? `Backup ready: ${escapeHtml(String(dashboard.refs?.backupPath || "").trim())}` : "No restore point captured yet."}</p>
              <label class="approval-gate-toggle">
                <input id="apply-approval-checkbox" type="checkbox" ${approvalChecked ? "checked" : ""} />
                <span>I reviewed the pending changes and approve apply.</span>
              </label>
              <p class="banner ${approvalChecked ? "impact" : "warning"}">${approvalChecked ? "Approval confirmed. Apply is enabled when the plan is otherwise valid." : "Confirm approval before applying changes to xLights."}</p>
            </div>
          </div>
          ${data.previewError ? `<p class="banner warning">${escapeHtml(String(data.previewError))}</p>` : ""}
          <div class="field panel-window proposed-window">
            <div class="metadata-grid-wrap proposed-grid-wrap">
              <table class="metadata-grid proposed-grid">
                <thead>
                  <tr>
                    <th style="width:48px;">Pick</th>
                    <th style="width:92px;">Design ID</th>
                    <th style="width:84px;">Author</th>
                    <th style="width:168px;">Preference</th>
                    <th>Change</th>
                    <th style="width:140px;">Anchor</th>
                    <th style="width:148px;">Focus</th>
                    <th style="width:72px;">Effects</th>
                    <th style="width:216px;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    rows.length
                      ? rows
                          .map(({ designId, designLabel, designAuthor, preferenceCue, summary, anchor, targetSummary, effectCount, previousRevision, indexes, selected }) => {
                            const indexCsv = Array.isArray(indexes) ? indexes.join(",") : "";
                            return `
                      <tr class="${selected ? "proposed-row-selected" : ""}">
                        <td>
                          <input type="checkbox" data-proposed-group-select="${escapeHtml(indexCsv)}" ${selected ? "checked" : ""} />
                        </td>
                        <td>${escapeHtml(String(designLabel || designId || "—"))}</td>
                        <td>${escapeHtml(String(designAuthor || "designer"))}</td>
                        <td>${escapeHtml(String(preferenceCue || "—"))}</td>
                        <td>
                          <div>${escapeHtml(String(summary || "Pending design change"))}</div>
                          ${
                            previousRevision
                              ? `<div class="banner">Prev ${escapeHtml(String(previousRevision.designLabel || "revision"))}: ${escapeHtml(String(previousRevision.summary || "Previous revision"))}</div>`
                              : ""
                          }
                        </td>
                        <td>${escapeHtml(String(anchor || "General"))}</td>
                        <td>${escapeHtml(String(targetSummary || "Current scope"))}</td>
                        <td>${escapeHtml(String(effectCount || 0))}</td>
                        <td>${
                          designId
                            ? `<div class="row"><button data-design-inspect="${escapeHtml(String(designId))}">Inspect</button><button data-design-revise="${escapeHtml(String(designId))}">Revise</button><button data-design-remove="${escapeHtml(String(designId))}">Delete</button></div>`
                            : `<button data-proposed-delete="${escapeHtml(indexCsv.split(",")[0] || "")}">Delete</button>`
                        }</td>
                      </tr>
                    `;
                          })
                          .join("")
                      : `<tr><td colspan="8" class="banner">No active proposed concepts yet. Generate or revise a concept in Design before reviewing apply scope.</td></tr>`
                  }
                </tbody>
              </table>
            </div>
          </div>
          <div class="row panel-footer-block proposed-actions">
              <button id="remove-selected-proposed" ${counts.selectedCount ? "" : "disabled"}>Delete Selected</button>
              <button id="remove-all-proposed" ${rows.length ? "" : "disabled"}>Delete All</button>
              <button id="restore-last-backup" ${data.backupReady ? "" : "disabled"}>Restore Last Backup</button>
              <button id="apply-selected" class="proposed-apply-btn proposed-apply-start" ${data.apply?.canApplySelected ? "" : "disabled"}>Apply Selected</button>
              <button id="apply-all" class="proposed-apply-btn" ${data.apply?.canApplyAll ? "" : "disabled"}>Apply All</button>
          </div>
          ${
            data.backupReady
              ? `<p class="banner">Backup ready: ${escapeHtml(String(dashboard.refs?.backupPath || "").trim())}</p>`
              : `<p class="banner warning">No restore point has been captured in this session yet.</p>`
          }
        </section>
        ${
          lastAppliedSnapshot
            ? renderSnapshotDashboard({
                kicker: "Last Applied Snapshot",
                title: "Most recent implemented design and sequence state.",
                brief: lastAppliedSnapshot.creativeBrief || null,
                proposalLines: lastAppliedSnapshot.proposalBundle?.proposalLines || [],
                applyResult: lastAppliedSnapshot.applyResult || lastApply || null,
                analysisArtifact: lastAppliedSnapshot.analysisArtifact || null,
                sceneContext: lastAppliedSnapshot.designSceneContext || null,
                musicContext: lastAppliedSnapshot.musicDesignContext || null,
                renderObservation: lastAppliedSnapshot.renderObservation || null,
                renderCritiqueContext: lastAppliedSnapshot.renderCritiqueContext || null,
                artifactRefs: lastApply?.artifactRefs || null,
                emptyText: "No applied snapshot is available yet."
              })
            : ""
        }
      </div>

      <div class="mobile-apply-bar">
        <button id="mobile-apply-all" ${data.apply?.canApplyAll ? "" : "disabled"}>Apply All</button>
        <span class="banner ${data.applyReady ? "" : "warning"}">${escapeHtml(String(data.mobileStatusText || ""))}</span>
      </div>
    `, "review-screen");
  }

  function historyScreen() {
    try {
      const dashboard = pageStates?.history || {};
      const data = dashboard?.data || {};
      const rows = Array.isArray(data.rows) ? data.rows : [];
      const selected = data.selected || null;
      return renderWorkspaceFrame("history", `
      <div class="screen-grid">
        ${
          !rows.length
            ? `
        <section class="card full-span">
          <div class="artifact-kicker">History</div>
          <h3>No applied snapshots yet</h3>
          <p class="artifact-body">History is populated only after an approved apply writes design changes into the sequence. Use Review to apply a change set, then return here to audit the captured snapshot.</p>
        </section>
        `
            : ""
        }
        <section class="card">
          <div class="artifact-kicker">History</div>
          <h3>Applied Revisions</h3>
          ${
            rows.length
              ? `
              <ul class="list">
                ${rows
                  .map((entry) => {
                    const active = entry.active ? "active-chip" : "";
                    return `
                      <li>
                        <button data-history-entry="${escapeHtml(String(entry.historyEntryId || ""))}" class="${active}">
                          ${escapeHtml(String(entry.summary || "Unnamed apply snapshot"))}
                        </button>
                        <div class="banner">${escapeHtml(String(entry.createdLabel || "Unknown time"))} | ${escapeHtml(String(entry.status || "unknown"))}${entry.applyStage ? ` | ${escapeHtml(String(entry.applyStage))}` : ""}</div>
                      </li>
                    `;
                  })
                  .join("")}
              </ul>
            `
              : `<p class="banner">No applied history yet.</p>`
          }
        </section>
        <section class="card full-span designer-dashboard-card">
          <div class="artifact-kicker">Applied Revision</div>
          <h3>${escapeHtml(String(selected?.summary || "Select an applied revision"))}</h3>
          ${
            selected
              ? `
              <p class="artifact-body">This is the applied design and sequence state captured when the revision was written to xLights.</p>
              <div class="artifact-chip-row">
                <span class="artifact-chip artifact-chip-accent">${escapeHtml(String(selected.status || "unknown"))}</span>
                <span class="artifact-chip">${escapeHtml(String(selected.commandCount || 0))} commands</span>
                <span class="artifact-chip">${escapeHtml(String(selected.impactCount || 0))} impacts</span>
                <span class="artifact-chip">${escapeHtml(String(selected.createdLabel || "unknown time"))}</span>
              </div>
              <div class="artifact-detail-grid">
                <div><strong>Revision Before</strong><p>${escapeHtml(String(selected.revisionBefore || "unknown"))}</p></div>
                <div><strong>Revision After</strong><p>${escapeHtml(String(selected.revisionAfter || "unknown"))}</p></div>
                <div><strong>Sequence</strong><p>${escapeHtml(String(selected.sequencePath || "unknown"))}</p></div>
                <div><strong>Created</strong><p>${escapeHtml(String(selected.createdAtLabel || "unknown"))}</p></div>
              </div>
              <div class="dashboard-grid">
                <div class="dashboard-panel">
                  <div class="artifact-kicker">Design</div>
                  <p>${escapeHtml(String(selected.designSummary || "No applied design summary."))}</p>
                  ${
                    Array.isArray(selected.designGoals) && selected.designGoals.length
                      ? `<ul>${selected.designGoals.map((row) => `<li>${escapeHtml(String(row))}</li>`).join("")}</ul>`
                        : "<p>No applied design goals captured.</p>"
                  }
                </div>
                <div class="dashboard-panel">
                  <div class="artifact-kicker">Sequence</div>
                  ${
                    Array.isArray(selected.proposalLines) && selected.proposalLines.length
                      ? `<ul>${selected.proposalLines.map((row) => `<li>${escapeHtml(String(row))}</li>`).join("")}</ul>`
                        : "<p>No applied sequence lines captured.</p>"
                  }
                </div>
                <div class="dashboard-panel">
                  <div class="artifact-kicker">Execution</div>
                  <p>Status: ${escapeHtml(String(selected.applyStatus || selected.status || "unknown"))}</p>
                  <p>Commands: ${escapeHtml(String(selected.applyCommandCount || selected.commandCount || 0))}</p>
                  <p>Impacts: ${escapeHtml(String(selected.applyImpactCount || selected.impactCount || 0))}</p>
                </div>
                <div class="dashboard-panel">
                  <div class="artifact-kicker">Audio + Scene</div>
                  <p>${escapeHtml(String(selected.audioTitle || "Unknown audio"))}</p>
                  <p>${escapeHtml(String(selected.layoutMode || "unknown"))} layout context</p>
                  <p>${escapeHtml(String(selected.musicSummary || "No applied music context summary."))}</p>
                </div>
              </div>
            `
              : `<p class="banner">No history snapshot selected.</p>`
          }
        </section>
      </div>
    `, "history-screen");
    } catch (err) {
      return renderWorkspaceFrame("history", `
        <div class="screen-grid">
          <section class="card full-span">
            <div class="artifact-kicker">History</div>
            <h3>History is temporarily unavailable</h3>
            <p class="artifact-body">Stored history data could not be rendered safely in the current session.</p>
            <p class="banner warning">${escapeHtml(String(err?.message || err || "Unknown history render error."))}</p>
          </section>
        </div>
      `, "history-screen");
    }
  }

  function metadataScreen() {
    const dashboard = pageStates?.metadata || {};
    const data = dashboard?.data || {};
    const view = String(data.metadataView || "guided") === "grid" ? "grid" : "guided";
    const activeTargetName = String(data.activeTarget?.displayName || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return renderWorkspaceFrame("metadata", `
      <div class="screen-grid metadata-workspace">
        <div class="metadata-panel">
          <div class="metadata-panel-header">
            <div>
              <div class="artifact-kicker">Layout</div>
              <h3>${view === "guided" ? "Guided Update" : "Grid View"}</h3>
            </div>
            <div class="row">
              <button data-metadata-view="guided" class="${view === "guided" ? "active-chip" : ""}">Guided</button>
              <button data-metadata-view="grid" class="${view === "grid" ? "active-chip" : ""}">Grid</button>
            </div>
          </div>
          ${
            view === "guided"
              ? `
          <section class="card metadata-progress-card">
            <h4>${String(data.progressSummary || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</h4>
          </section>
          `
              : `
          <section class="card metadata-progress-card">
            <h4>${String(data.progressSummary || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</h4>
            <p class="metadata-helper-copy">Use the grid to choose any target manually.</p>
          </section>
          <section class="card metadata-bulk-card">
            <div class="metadata-bulk-header">
              <strong>${Number(data.selectedCount || 0)} selected</strong>
              <div class="row">
                <button id="metadata-select-visible">Select Visible</button>
                <button id="metadata-clear-selection" ${data.selectedCount ? "" : "disabled"}>Clear</button>
              </div>
            </div>
            <div class="field metadata-tag-manager-body">
              <div class="artifact-detail-grid metadata-bulk-grid">
                <div>
                  <div class="metadata-field-label-row">
                    <strong>Role Preference</strong>
                    <details class="metadata-help-toggle">
                      <summary aria-label="Role preference help">?</summary>
                      <div class="metadata-help-popover">
                        <p><strong>Auto</strong>: Let the app decide.</p>
                        <p><strong>Focal</strong>: Main visual lead; draws the eye first.</p>
                        <p><strong>Support</strong>: Reinforces the lead without dominating.</p>
                        <p><strong>Background</strong>: Low-priority texture or fill.</p>
                        <p><strong>Frame</strong>: Edge or perimeter structure that shapes the scene.</p>
                        <p><strong>Accent</strong>: Short hits or punctuation, not broad base coverage.</p>
                      </div>
                    </details>
                  </div>
                  <div class="metadata-add-row">
                    <select id="metadata-bulk-role">
                      <option value="">Choose role...</option>
                      <option value="__auto__">Auto</option>
                      ${["focal", "support", "background", "frame", "accent"].map((value) => `<option value="${value}">${value}</option>`).join("")}
                    </select>
                    <span></span>
                    <button id="metadata-bulk-apply-role" ${data.selectedCount ? "" : "disabled"}>Set</button>
                  </div>
                </div>
                <div>
                  <div class="metadata-field-label-row">
                    <strong>Visual Hints</strong>
                  </div>
                  <div class="metadata-add-row">
                    <select id="metadata-bulk-visual-hint">
                      <option value="">Choose one...</option>
                      ${((data.bulkOptions?.semanticHints || []).map((value) => `<option value="${String(value).replace(/"/g, "&quot;")}">${String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</option>`).join(""))}
                      <option value="__other__">Other...</option>
                    </select>
                    <input id="metadata-bulk-visual-hint-other" placeholder="Add custom visual hint" disabled />
                    <button id="metadata-bulk-apply-visual-hint" ${data.selectedCount ? "" : "disabled"}>Add</button>
                  </div>
                </div>
                <div>
                  <div class="metadata-field-label-row">
                    <strong>Effect Avoidances</strong>
                  </div>
                  <div class="metadata-add-row">
                    <select id="metadata-bulk-effect-avoidance">
                      <option value="">Choose one...</option>
                      ${((data.bulkOptions?.effectAvoidances || []).map((value) => `<option value="${String(value).replace(/"/g, "&quot;")}">${String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</option>`).join(""))}
                      <option value="__other__">Other...</option>
                    </select>
                    <input id="metadata-bulk-effect-avoidance-other" placeholder="Add custom avoidance" disabled />
                    <button id="metadata-bulk-apply-effect-avoidance" ${data.selectedCount ? "" : "disabled"}>Add</button>
                  </div>
                </div>
              </div>
            </div>
          </section>
          <section class="metadata-advanced metadata-grid-view" open>
            <div class="metadata-grid-wrap metadata-targets-wrap">
              <table class="metadata-grid metadata-target-grid">
                <thead>
                  <tr>
                    <th style="width: 44px;">Sel</th>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Role</th>
                    <th>Visual Hints</th>
                    <th>Effect Avoidances</th>
                  </tr>
                  <tr class="metadata-filter-row">
                    <th></th>
                    <th><input id="metadata-filter-name" value="${(state.ui.metadataFilterName || "").replace(/"/g, "&quot;")}" placeholder="name (comma-separated)..." /></th>
                    <th><input id="metadata-filter-type" value="${(state.ui.metadataFilterType || "").replace(/"/g, "&quot;")}" placeholder="type..." /></th>
                    <th><input id="metadata-filter-role" value="${(state.ui.metadataFilterRole || "").replace(/"/g, "&quot;")}" placeholder="role..." /></th>
                    <th><input id="metadata-filter-visual-hints" value="${(state.ui.metadataFilterVisualHints || "").replace(/"/g, "&quot;")}" placeholder="visual hints..." /></th>
                    <th><input id="metadata-filter-effect-avoidances" value="${(state.ui.metadataFilterEffectAvoidances || "").replace(/"/g, "&quot;")}" placeholder="effect avoidances..." /></th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    data.rows?.length
                      ? data.rows
                          .map((m) => {
                            const canonical = String(m?.canonicalType || "");
                            const role = String(m?.rolePreference || "Auto");
                            const visualHints = Array.isArray(m?.visualHints) && m.visualHints.length
                              ? m.visualHints.join(", ")
                              : "-";
                            const effectAvoidances = Array.isArray(m?.effectAvoidances) && m.effectAvoidances.length
                              ? m.effectAvoidances.join(", ")
                              : "-";
                            const focused = m.focused ? ' class="active-chip"' : "";
                            return `<tr>
                              <td><input type="checkbox" data-metadata-select="${String(m.id).replace(/\"/g, "&quot;")}" ${m.selected ? "checked" : ""} /></td>
                              <td><button data-metadata-focus="${String(m.id).replace(/\"/g, "&quot;")}"${focused}>${String(m.displayName || "(unnamed)").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</button></td>
                              <td>${canonical.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") || "-"}</td>
                              <td>${role.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>
                              <td>${visualHints.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>
                              <td>${effectAvoidances.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>
                            </tr>`;
                          })
                          .join("")
                      : `<tr><td colspan="6">No targets found.</td></tr>`
                  }
                </tbody>
              </table>
            </div>
          </section>
          `
          }
          ${
            view === "guided" && data.activeTarget
              ? `<section class="metadata-editor-card">
                  <div class="metadata-panel-header">
                    <div>
                      <div class="artifact-kicker">Recommended</div>
                      <h4>Recommended Next Model</h4>
                    </div>
                    <div class="row metadata-guided-nav">
                      <button ${data.previousGuidedTargetId ? `data-metadata-focus="${String(data.previousGuidedTargetId).replace(/"/g, "&quot;")}"` : "disabled"} aria-label="Previous model">‹</button>
                      <span class="banner">${Number(data.guidedIndex || 0)}/${Number(data.guidedTotal || 0)}</span>
                      <button ${data.nextGuidedTargetId ? `data-metadata-focus="${String(data.nextGuidedTargetId).replace(/"/g, "&quot;")}"` : "disabled"} aria-label="Next model">›</button>
                    </div>
                  </div>
                  <div class="metadata-editor-active">
                    <div>
                      <strong>${activeTargetName || "Selected target"}</strong>
                      <span class="banner">${String(data.activeTarget.metadataCompleteness || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</span>
                    </div>
                  </div>
                  <div class="field metadata-tag-manager-body">
                    <div class="artifact-detail-grid">
                      <div>
                        <div class="metadata-field-label-row">
                          <strong>Role Preference</strong>
                          <details class="metadata-help-toggle">
                            <summary aria-label="Role preference help">?</summary>
                            <div class="metadata-help-popover">
                              <p><strong>Auto</strong>: Let the app decide.</p>
                              <p><strong>Focal</strong>: Main visual lead; draws the eye first.</p>
                              <p><strong>Support</strong>: Reinforces the lead without dominating.</p>
                              <p><strong>Background</strong>: Low-priority texture or fill.</p>
                              <p><strong>Frame</strong>: Edge or perimeter structure that shapes the scene.</p>
                              <p><strong>Accent</strong>: Short hits or punctuation, not broad base coverage.</p>
                            </div>
                          </details>
                        </div>
                        <p>
                          <select data-metadata-role-preference="${String(data.activeTarget.id).replace(/"/g, "&quot;")}">
                            ${["", "focal", "support", "background", "frame", "accent"].map((value) => {
                              const selected = String(data.activeTarget.rolePreference || "") === value ? "selected" : "";
                              const label = value || "Auto";
                              return `<option value="${String(value).replace(/"/g, "&quot;")}" ${selected}>${label}</option>`;
                            }).join("")}
                          </select>
                        </p>
                      </div>
                      <div>
                        <strong>Visual Hints</strong>
                        <div class="metadata-value-list">
                          ${(Array.isArray(data.activeTarget.semanticHints) ? data.activeTarget.semanticHints : []).map((value) => `<button class="artifact-chip" data-metadata-remove-item="semanticHints" data-metadata-target-id="${String(data.activeTarget.id).replace(/"/g, "&quot;")}" data-metadata-value="${String(value).replace(/"/g, "&quot;")}">${String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")} ×</button>`).join("") || `<span class="banner">None selected</span>`}
                        </div>
                        <div class="metadata-add-row">
                          <select data-metadata-suggestion-select="semanticHints" data-metadata-target-id="${String(data.activeTarget.id).replace(/"/g, "&quot;")}">
                            <option value="">Choose one...</option>
                            ${((data.activeTarget.smartOptions?.semanticHints || []).map((value) => `<option value="${String(value).replace(/"/g, "&quot;")}">${String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</option>`).join(""))}
                            <option value="__other__">Other...</option>
                          </select>
                          <input data-metadata-other-input="semanticHints" data-metadata-target-id="${String(data.activeTarget.id).replace(/"/g, "&quot;")}" placeholder="Add custom visual hint" disabled />
                          <button data-metadata-add-item="semanticHints" data-metadata-target-id="${String(data.activeTarget.id).replace(/"/g, "&quot;")}">Add</button>
                        </div>
                      </div>
                      <div>
                        <strong>Effect Avoidances</strong>
                        <div class="metadata-value-list">
                          ${(Array.isArray(data.activeTarget.effectAvoidances) ? data.activeTarget.effectAvoidances : []).map((value) => `<button class="artifact-chip" data-metadata-remove-item="effectAvoidances" data-metadata-target-id="${String(data.activeTarget.id).replace(/"/g, "&quot;")}" data-metadata-value="${String(value).replace(/"/g, "&quot;")}">${String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")} ×</button>`).join("") || `<span class="banner">None selected</span>`}
                        </div>
                        <div class="metadata-add-row">
                          <select data-metadata-suggestion-select="effectAvoidances" data-metadata-target-id="${String(data.activeTarget.id).replace(/"/g, "&quot;")}">
                            <option value="">Choose one...</option>
                            ${((data.activeTarget.smartOptions?.effectAvoidances || []).map((value) => `<option value="${String(value).replace(/"/g, "&quot;")}">${String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</option>`).join(""))}
                            <option value="__other__">Other...</option>
                          </select>
                          <input data-metadata-other-input="effectAvoidances" data-metadata-target-id="${String(data.activeTarget.id).replace(/"/g, "&quot;")}" placeholder="Add custom avoidance" disabled />
                          <button data-metadata-add-item="effectAvoidances" data-metadata-target-id="${String(data.activeTarget.id).replace(/"/g, "&quot;")}">Add</button>
                        </div>
                      </div>
                    </div>
                    <div>
                      <strong>Summary</strong>
                      <pre class="metadata-summary-block">${String(data.activeTarget.summaryText || "No summary available yet.").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
                    </div>
                  </div>
                </section>`
              : ""
          }
          ${data.submodelsAvailable ? "" : `<p class="banner">${String(data.submodelBanner || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`}
        </div>
      </div>
    `, "metadata-screen");
  }

  if (state.route === "project") return projectScreen();
  if (state.route === "audio") return audioScreen();
  if (state.route === "sequence") return sequenceScreen();
  if (state.route === "design") return designScreen();
  if (state.route === "review") return reviewScreen();
  if (state.route === "settings") return settingsScreen();
  if (state.route === "metadata") return metadataScreen();
  if (state.route === "history") return historyScreen();
  return metadataScreen();
}
