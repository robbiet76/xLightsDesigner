import { buildSettingsContent } from "./operator-panels.js";

export function buildScreenContent({ state, helpers }) {
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
    getMetadataOrphans,
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

  function renderArtifactDetailPanel() {
    const inspected = String(state.ui?.inspectedArtifact || "").trim();
    if (!inspected) return "";

    function list(items = [], emptyText = "Nothing available yet.") {
      const rows = Array.isArray(items) ? items.map((row) => String(row || "").trim()).filter(Boolean) : [];
      return rows.length
        ? `<ul class="artifact-detail-list">${rows.map((row) => `<li>${escapeHtml(row)}</li>`).join("")}</ul>`
        : `<p class="banner">${escapeHtml(emptyText)}</p>`;
    }

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
        ${list((structure?.sections || []).map((row) => `${row?.label || row?.name || "Section"}${row?.startMs != null && row?.endMs != null ? ` (${row.startMs}-${row.endMs} ms)` : ""}`), "No detected sections yet.")}
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
        ${list(selectedSections, "All sections are currently in scope.")}
        <h4>Available Sections</h4>
        ${list(sections, "No sections are available yet.")}
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
          ${list(brief.sections, "No brief sections yet.")}
          <h4>Design Hypotheses</h4>
          ${list(brief.hypotheses, "No design hypotheses captured yet.")}
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
          ${list(bundle.proposalLines, "No proposal lines available.")}
          <h4>Assumptions</h4>
          ${list(bundle.assumptions, "No assumptions captured.")}
          <h4>Open Questions</h4>
          ${list(bundle.guidedQuestions, "No guided questions remain.")}
          <h4>Risk Notes</h4>
          ${list(bundle.riskNotes, "No risk notes captured.")}
        `
        : `<p class="banner">No proposal bundle is available yet.</p>`;
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
      const lastApply = applyHistory.length ? applyHistory[applyHistory.length - 1] : null;
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
        ${list([
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

  function renderJourneyCard(kind = "") {
    const selectedSequence = String(state.activeSequence || state.sequencePathInput || "").trim();
    const hasAudioArtifact = Boolean(getValidHandoff("analysis_handoff_v1"));
    const hasBrief = Boolean(state.creative?.brief);
    const hasProposal = Boolean(state.creative?.proposalBundle);
    const hasDraft = Boolean(state.flags?.hasDraftProposal);
    const reviewReady = Boolean(hasDraft && !state.flags?.proposalStale);

    const definitions = {
      project: {
        title: "Primary Journey",
        summary: "Start by defining the project root, show folder, and media location so the rest of the workflow has a stable home.",
        next: selectedSequence ? "Project is configured. Move to Audio or Sequence to continue." : "After project setup, continue into Audio to inspect or generate analysis."
      },
      audio: {
        title: "Primary Journey",
        summary: "Audio is now the first specialist phase. Inspect or generate the analysis artifact before sequencing so timing and structure are grounded in the media.",
        next: hasAudioArtifact ? "Audio artifact is ready. Continue to Sequence to confirm working context." : "Run or reuse audio analysis, then continue to Sequence."
      },
      sequence: {
        title: "Primary Journey",
        summary: "Sequence is the context lock-in phase. Open the working sequence, confirm revision and scope, and make sure the right media is attached.",
        next: selectedSequence ? "Sequence context is loaded. Continue to Design for concept and proposal work." : "Open the working sequence, then continue to Design."
      },
      design: {
        title: "Primary Journey",
        summary: "Design is where the creative brief and proposal bundle are shaped. Use team chat, references, and the brief to decide what should be built.",
        next: hasProposal ? "Proposal bundle is ready. Continue to Review for approval and apply." : hasBrief ? "Creative brief is ready. Generate or refine the proposal bundle next." : "Build the creative brief first, then generate a proposal bundle."
      },
      review: {
        title: "Primary Journey",
        summary: "Review is the execution gate. Confirm impact, warnings, approval, and backup posture before writing changes to xLights.",
        next: reviewReady ? "Draft is ready for review and apply. Approve only after checking warnings and scope." : "If the draft is stale or incomplete, return to Design or refresh before apply."
      },
      settings: {
        title: "Application Settings",
        summary: "Settings controls the environment around the workflow: xLights connection, cloud chat, audio services, team identities, and safety policy.",
        next: "Use Settings first on a new install. Project-specific work belongs on the Project screen."
      }
    };

    const row = definitions[kind];
    if (!row) return "";
    return `
      <section class="card journey-card full-span">
        <div class="artifact-kicker">${escapeHtml(row.title)}</div>
        <h3>${escapeHtml(row.summary)}</h3>
        <p class="artifact-body">${escapeHtml(row.next)}</p>
      </section>
    `;
  }

  function projectScreen() {
    const createdAt = state.projectCreatedAt
      ? new Date(state.projectCreatedAt).toLocaleString([], { hour12: false })
      : "(not set)";
    const updatedAt = state.projectUpdatedAt
      ? new Date(state.projectUpdatedAt).toLocaleString([], { hour12: false })
      : "(not set)";
    const hasSavedProject = Boolean(String(state.projectFilePath || "").trim());
    return `
      <div class="screen-grid">
        ${renderJourneyCard("project")}
        <section class="card">
          <h3>Project Lifecycle</h3>
          <div class="banner">${hasSavedProject ? `Current Project: ${escapeHtml(String(state.projectName || "(unnamed)"))}` : "No project file is open yet."}</div>
          <p class="artifact-body">Use this screen to create a new project, open an existing project, and explicitly save the project workspace. Background app persistence protects session continuity, but Save writes the durable project file.</p>
          <div class="row">
            <button id="new-project">Create New Project</button>
            <button id="open-selected-project">Open Project</button>
            <button id="save-project" ${hasSavedProject ? "" : "disabled"}>Save</button>
            <button id="save-project-as">Save As</button>
          </div>
          <p class="banner">Save writes the current project definition and workspace snapshot to the project file. Save As creates a new project copy under the app project root.</p>
        </section>
        <section class="card">
          <h3>Project Summary</h3>
          <div class="banner">${hasSavedProject ? `Current Project: ${escapeHtml(String(state.projectName || "(unnamed)"))}` : "Create a project to assign a project name."}</div>
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
              <input id="showfolder-input" value="${state.showFolder}" />
              <button id="browse-showfolder">Browse...</button>
            </div>
          </div>
          <div class="field">
            <label>Media Path</label>
            <div class="row">
              <input id="mediapath-input" value="${state.mediaPath || ""}" placeholder="Optional default media root or reference path" />
            </div>
          </div>
          <p class="banner">Show Directory inventory: ${state.showDirectoryStats?.xsqCount || 0} .xsq | ${state.showDirectoryStats?.xdmetaCount || 0} .xdmeta</p>
          <p class="banner">Project created: ${createdAt}</p>
          <p class="banner">Project updated: ${updatedAt}</p>
          <div class="row">
            <button id="reset-project">Reset Project Workspace</button>
          </div>
        </section>
      </div>
    `;
  }

  function settingsScreen() {
    return `
      <div class="screen-grid settings-screen">
        ${renderJourneyCard("settings")}
        ${buildSettingsContent({ state, helpers, includeClose: false })}
      </div>
    `;
  }

  function renderAudioAnalysisArtifactCard() {
    const analysis = getValidHandoff("analysis_handoff_v1");
    const timing = analysis?.timing || {};
    const structure = analysis?.structure || {};
    const chords = analysis?.chords || {};
    const identity = analysis?.trackIdentity || {};
    const bpm = timing?.bpm != null ? String(timing.bpm) : "unknown";
    const meter = String(timing?.timeSignature || "unknown");
    const sections = Array.isArray(structure?.sections) ? structure.sections.slice(0, 5) : [];
    return `
      <section class="card artifact-card artifact-card-audio">
        <div class="artifact-kicker">Analysis Artifact</div>
        <h3>${escapeHtml(String(identity?.title || basenameOfPath(state.audioPathInput || "") || "No analyzed media"))}</h3>
        <div class="artifact-chip-row">
          <span class="artifact-chip artifact-chip-accent">${escapeHtml(`${bpm} BPM`)}</span>
          <span class="artifact-chip">${escapeHtml(meter)}</span>
          <span class="artifact-chip">${Array.isArray(structure?.sections) ? structure.sections.length : 0} sections</span>
          <span class="artifact-chip">${chords?.hasChords ? "chords ready" : "no chords"}</span>
        </div>
        <p class="artifact-body">${escapeHtml(String(state.audioAnalysis?.summary || "Audio analysis has not produced a summary yet."))}</p>
        <p class="banner">Identity: ${escapeHtml([identity?.title, identity?.artist].filter(Boolean).join(" - ") || "pending")}</p>
        <p class="banner">Structure source: ${escapeHtml(String(structure?.source || "pending"))} | confidence: ${escapeHtml(String(structure?.confidence || "low"))}</p>
        <div class="artifact-chip-row">
          ${
            sections.length
              ? sections.map((row) => `<span class="artifact-chip">${escapeHtml(String(row?.label || row?.name || "Section"))}</span>`).join("")
              : `<span class="artifact-chip artifact-chip-muted">No sections labeled yet</span>`
          }
        </div>
        ${buildArtifactInspectActions("audio-analysis")}
      </section>
    `;
  }

  function renderAudioPipelineArtifactCard() {
    const pipeline = state.audioAnalysis?.pipeline && typeof state.audioAnalysis.pipeline === "object"
      ? state.audioAnalysis.pipeline
      : null;
    const rows = [
      ["Media attached", Boolean(pipeline?.mediaAttached)],
      ["Service reached", Boolean(pipeline?.analysisServiceCalled)],
      ["Service succeeded", Boolean(pipeline?.analysisServiceSucceeded)],
      ["Timing derived", Boolean(pipeline?.timingDerived)],
      ["Structure derived", Boolean(pipeline?.structureDerived)],
      ["Web context derived", Boolean(pipeline?.webContextDerived)]
    ];
    return `
      <section class="card artifact-card artifact-card-audio-status">
        <div class="artifact-kicker">Analysis Status</div>
        <h3>${escapeHtml(getAnalysisServiceHeaderBadgeText())}</h3>
        <ul class="artifact-list">
          ${rows.map(([label, ok]) => `<li>${ok ? "PASS" : "PENDING"} - ${escapeHtml(label)}</li>`).join("")}
        </ul>
        <p class="banner">Last analyzed: ${state.audioAnalysis?.lastAnalyzedAt ? escapeHtml(new Date(state.audioAnalysis.lastAnalyzedAt).toLocaleString([], { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })) : "never"}</p>
        ${buildArtifactInspectActions("audio-pipeline")}
      </section>
    `;
  }

  function audioScreen() {
    const audioTrackPath = String(state.audioPathInput || "").trim();
    const audioTrackName = basenameOfPath(audioTrackPath) || audioTrackPath;
    const hasAudioTrack = Boolean(audioTrackPath);
    const audioSummary = String(state.audioAnalysis?.summary || "");
    const audioPipeline = state.audioAnalysis?.pipeline && typeof state.audioAnalysis.pipeline === "object"
      ? state.audioAnalysis.pipeline
      : null;
    const pipelineRows = [
      ["Media attached", Boolean(audioPipeline?.mediaAttached)],
      ["Metadata read", Boolean(audioPipeline?.mediaMetadataRead)],
      ["Analysis service reached", Boolean(audioPipeline?.analysisServiceCalled)],
      ["Analysis service succeeded", Boolean(audioPipeline?.analysisServiceSucceeded)],
      ["Beat markers ready", Boolean(audioPipeline?.beatTrackWritten)],
      ["Bar markers ready", Boolean(audioPipeline?.barTrackWritten)],
      ["Chord markers ready", Boolean(audioPipeline?.chordTrackWritten)],
      ["Structure markers ready", Boolean(audioPipeline?.structureTrackWritten)],
      ["Lyrics markers ready", Boolean(audioPipeline?.lyricsTrackWritten)],
      ["Song context derived", Boolean(audioPipeline?.webContextDerived)]
    ];
    const audioAnalyzedAt = state.audioAnalysis?.lastAnalyzedAt
      ? new Date(state.audioAnalysis.lastAnalyzedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "";
    const analysisServiceBadge = getAnalysisServiceHeaderBadgeText();
    const analysisServiceReady = Boolean(state.ui.analysisServiceReady);
    const analysisServiceChecking = Boolean(state.ui.analysisServiceChecking);
    return `
      <div class="screen-grid audio-screen">
        ${renderJourneyCard("audio")}
        <section class="artifact-grid">
          ${renderAudioAnalysisArtifactCard()}
          ${renderAudioPipelineArtifactCard()}
        </section>
        ${renderArtifactDetailPanel()}
        ${
          hasAudioTrack
            ? `
        <section class="card">
          <h3>Audio Analysis ${audioAnalyzedAt ? `<span class="banner">(${audioAnalyzedAt})</span>` : ""}</h3>
          <div class="field">
            <label>Audio Track (from open sequence)</label>
            <input value="${audioTrackName.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}" readonly />
            <p class="banner">${audioTrackPath.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
          </div>
          <div class="row">
            <button id="analyze-audio" ${analysisServiceReady && !analysisServiceChecking ? "" : "disabled"}>
              ${analysisServiceChecking ? "Checking Service..." : "Analyze Audio"}
            </button>
          </div>
          <p class="banner">${analysisServiceBadge}</p>
          <div class="field">
            <label>Pipeline Stages</label>
            <ul class="list pipeline-list">
              ${pipelineRows.map(([label, done]) => `<li><strong>${done ? "PASS" : "PENDING"}</strong> - ${label}</li>`).join("")}
            </ul>
          </div>
          <div class="field">
            <label>Analysis Summary</label>
            <textarea id="audio-analysis-summary" rows="5" placeholder="Agent audio analysis summary will appear here...">${audioSummary.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</textarea>
          </div>
        </section>
        `
            : ""
        }
      </div>
    `;
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
        <p class="banner">Use this screen to choose and confirm the active sequence context before design and review.</p>
        ${buildArtifactInspectActions("sequence-scope")}
      </section>
    `;
  }

  function sequenceScreen() {
    const catalog = Array.isArray(state.sequenceCatalog) ? state.sequenceCatalog : [];
    const catalogHasCurrent = catalog.some((s) => String(s?.path || "") === state.sequencePathInput);
    const catalogOptions = [
      ...catalog,
      ...(!catalogHasCurrent && state.sequencePathInput
        ? [{ path: state.sequencePathInput, relativePath: state.sequencePathInput, name: state.sequencePathInput.split("/").pop() || "Current" }]
        : [])
    ];
    const mediaFile = String(state.sequenceMediaFile || state.audioPathInput || "").trim();
    const revision = String(state.currentSequenceRevision || "").trim();
    return `
      <div class="screen-grid sequence-screen">
        ${renderJourneyCard("sequence")}
        <section class="artifact-grid">
          ${renderSequenceContextArtifactCard()}
          ${renderSequenceScopeArtifactCard()}
        </section>
        ${renderArtifactDetailPanel()}
        <section class="card">
          <h3>Sequence Setup</h3>
          <div class="field">
            <label>Sequence (from Show Directory)</label>
            <select id="sequence-catalog-select">
              ${
                catalogOptions.length
                  ? catalogOptions
                      .map((s) => {
                        const path = String(s?.path || "");
                        const rel = String(s?.relativePath || path);
                        const name = String(s?.name || path.split("/").pop() || rel);
                        return `<option value="${path.replace(/\"/g, "&quot;")}" ${path === state.sequencePathInput ? "selected" : ""}>${name} - ${rel}</option>`;
                      })
                      .join("")
                  : `<option value="">No sequences found under Show Directory</option>`
              }
            </select>
            <p class="banner">Show Directory: ${state.showFolder || "(not set)"}</p>
          </div>
          <div class="row project-actions">
            <button id="open-sequence">Open</button>
          </div>
          <p class="banner">Active: ${state.activeSequence || "(none)"}</p>
          <p class="banner">Media: ${mediaFile || "(none attached)"}</p>
          <p class="banner">Revision: ${revision || "(not loaded)"}</p>
        </section>
      </div>
    `;
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

  function renderBriefArtifactCard() {
    const brief = state.creative?.brief || null;
    return `
      <section class="card artifact-card artifact-card-design">
        <div class="artifact-kicker">Creative Brief</div>
        <h3>${escapeHtml(String(brief?.summary || "No brief yet"))}</h3>
        <div class="artifact-chip-row">
          <span class="artifact-chip artifact-chip-accent">${escapeHtml(String((brief?.sections || []).length || 0))} sections</span>
          <span class="artifact-chip">${escapeHtml(String((brief?.hypotheses || []).length || 0))} hypotheses</span>
        </div>
        <p class="artifact-body">${escapeHtml(String(brief?.goalsSummary || "Generate a creative brief to define direction, mood, and section priorities."))}</p>
        ${buildArtifactInspectActions("creative-brief")}
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

  function designScreen() {
    const creativeBriefText = String(state.creative?.briefText || "");
    const creativeBriefTextEscaped = creativeBriefText
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const briefAt = state.creative.briefUpdatedAt
      ? new Date(state.creative.briefUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "";
    return `
      <div class="screen-grid design-screen">
        ${renderJourneyCard("design")}
        <section class="card workspace-intro-card workspace-intro-card-design full-span">
          <div class="artifact-kicker">Design Workspace</div>
          <h3>Develop the creative direction before moving into execution.</h3>
          <p class="artifact-body">Use this screen for concept shaping, references, and proposal refinement. Approval and apply are handled separately in Review.</p>
        </section>
        <section class="artifact-grid">
          ${renderBriefArtifactCard()}
          ${renderProposalArtifactCard()}
        </section>
        ${renderArtifactDetailPanel()}
        <section class="card">
          <h3>Creative Brief ${briefAt ? `<span class="banner">(${briefAt})</span>` : ""}</h3>
          <div class="field">
            <label>Direction, goals, theme, mood, and other brief notes</label>
            <textarea id="creative-brief-text" rows="10" placeholder="Write or let the designer build the creative brief for this sequence...">${creativeBriefTextEscaped}</textarea>
          </div>
        </section>
        ${referenceMediaPanel()}
        ${colorPalettePanel()}
      </div>
    `;
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
    const lastApply = applyHistory.length ? applyHistory[applyHistory.length - 1] : null;
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
    const selectedSections = getSelectedSections();
    const allSelected = hasAllSectionsSelected();
    const disabledReason = applyDisabledReason();
    const applyReady = applyReadyForApprovalGate();
    sanitizeProposedSelection();
    const filtered = state.proposed
      .map((line, idx) => ({ line, idx }))
      .filter((x) => {
        if (allSelected) return true;
        const section = getSectionName(x.line);
        return section === "General" || selectedSections.includes(section);
      });
    const list = filtered;
    const allVisibleLines = list.map((item) => item.line);
    const selectedLines = selectedProposedLinesForApply();
    const previewLines = selectedLines.length ? selectedLines : allVisibleLines;
    let previewCommands = [];
    let previewError = "";
    if (previewLines.length) {
      try {
        previewCommands = buildDesignerPlanCommands(previewLines);
      } catch (err) {
        previewError = String(err?.message || "Unable to build command preview.");
      }
    }
    const selectedCount = (state.ui.proposedSelection || []).filter((idx) => list.some((item) => item.idx === idx)).length;
    const approvalChecked = Boolean(state.ui.applyApprovalChecked);
    const canApplySelected = selectedCount > 0 && !state.flags.applyInProgress && applyReady && approvalChecked;
    const canApplyAll = list.length > 0 && !state.flags.applyInProgress && applyReady && approvalChecked;
    const impact = summarizeImpactForLines(previewLines);
    const verification = state.lastApplyVerification && typeof state.lastApplyVerification === "object"
      ? state.lastApplyVerification
      : null;
    const applyHistory = Array.isArray(state.applyHistory) ? state.applyHistory : [];
    const lastApply = applyHistory.length ? applyHistory[applyHistory.length - 1] : null;
    const backupReady = Boolean(String(state.lastApplyBackupPath || "").trim());
    const reviewStateLabel = state.flags.applyInProgress
      ? "Applying"
      : state.flags.proposalStale
        ? "Stale"
        : approvalChecked
          ? "Approved"
          : "Needs Approval";
    const planSummary = previewCommands.length
      ? `${previewCommands.length} command${previewCommands.length === 1 ? "" : "s"} ready for execution`
      : previewError || "No command preview available.";
    const payloadPreview = escapeHtml(getProposedPayloadPreviewText());
    return `
      ${
        state.flags.proposalStale
          ? `
        <section class="card stale-card">
          <h3>Draft Is Stale</h3>
          <p class="banner warning">Sequence changed since this draft was created. Refresh/rebase before apply.</p>
          <div class="artifact-chip-row">
            <span class="artifact-chip artifact-chip-muted">base ${escapeHtml(String(state.draftBaseRevision || "unknown"))}</span>
            <span class="artifact-chip artifact-chip-accent">current ${escapeHtml(String(state.revision || "unknown"))}</span>
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
        ${renderJourneyCard("review")}
        <section class="card workspace-intro-card workspace-intro-card-review full-span">
          <div class="artifact-kicker">Review Workspace</div>
          <h3>Confirm the proposed impact, cross-check safeguards, then apply deliberately.</h3>
          <p class="artifact-body">This screen is the execution gate. Review warnings, confirm approval, and use backup/verification signals before writing to xLights.</p>
        </section>
        <section class="artifact-grid">
          ${renderProposalArtifactCard()}
          <section class="card artifact-card artifact-card-review">
            <div class="artifact-kicker">Execution Review</div>
            <h3>${escapeHtml(planSummary)}</h3>
            <div class="artifact-chip-row">
              <span class="artifact-chip artifact-chip-accent">${escapeHtml(reviewStateLabel)}</span>
              <span class="artifact-chip">${selectedLines.length ? `${selectedLines.length} selected` : `${allVisibleLines.length} visible`}</span>
              <span class="artifact-chip">${impact.targetCount} targets</span>
              <span class="artifact-chip">${impact.sectionWindows.length || 0} windows</span>
            </div>
            <p class="banner">Affected targets: ${impact.targets.length ? escapeHtml(impact.targets.join(", ")) : "none"}</p>
            <p class="banner">Affected windows: ${impact.sectionWindows.length ? escapeHtml(impact.sectionWindows.join(" | ")) : "No section timing context yet."}</p>
            <p class="banner ${approvalChecked ? "impact" : "warning"}">${approvalChecked ? "Approval confirmed and ready for apply." : "Approval checkbox must be confirmed before apply."}</p>
            <div class="review-status-grid">
              <div class="review-status-item">
                <span class="review-status-label">Backup</span>
                <strong>${backupReady ? "Available" : "None yet"}</strong>
              </div>
              <div class="review-status-item">
                <span class="review-status-label">Last Apply</span>
                <strong>${escapeHtml(String(lastApply?.status || "none"))}</strong>
              </div>
              <div class="review-status-item">
                <span class="review-status-label">Verification</span>
                <strong>${verification ? (verification.expectedMutationsPresent ? "Verified" : "Needs review") : "Not run"}</strong>
              </div>
            </div>
          </section>
        </section>
        ${renderArtifactDetailPanel()}
      </div>

      <div class="screen-grid review-screen">
        <section class="artifact-grid">
          ${renderReviewPlanArtifactCard()}
          ${renderReviewExecutionArtifactCard()}
        </section>
        <section class="card approval-gate-card full-span">
          <div class="approval-gate-header">
            <div>
              <div class="artifact-kicker">Approval Gate</div>
              <strong>${approvalChecked ? "Ready for Apply" : "Approval Required"}</strong>
            </div>
            <span class="artifact-chip ${approvalChecked ? "artifact-chip-accent" : "artifact-chip-muted"}">${approvalChecked ? "Confirmed" : "Pending"}</span>
          </div>
          <p class="banner ${approvalChecked ? "impact" : "warning"}">${approvalChecked ? "Approval confirmed and apply is enabled when the plan is otherwise valid." : "Confirm approval here before applying any sequence changes."}</p>
          <label class="approval-gate-toggle">
            <input id="apply-approval-checkbox" type="checkbox" ${approvalChecked ? "checked" : ""} />
            <span>I reviewed the plan and approve apply.</span>
          </label>
        </section>
      </div>

      <div class="screen-grid design-workspace design-workspace-fill">
        <section class="card design-column full-span">
          <h3>Proposed Changes</h3>
          <div class="field panel-window proposed-window"><label>Proposed Next Write</label>
            <div class="metadata-grid-wrap proposed-grid-wrap">
              <table class="metadata-grid proposed-grid">
                <thead>
                  <tr>
                    <th style="width:48px;">Pick</th>
                    <th>Change</th>
                    <th style="width:84px;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    list.length
                      ? list
                          .map(({ line, idx }) => {
                            const selected = (state.ui.proposedSelection || []).includes(idx);
                            return `
                      <tr class="${selected ? "proposed-row-selected" : ""}">
                        <td>
                          <input type="checkbox" data-proposed-select="${idx}" ${selected ? "checked" : ""} />
                        </td>
                        <td data-proposed-focus="${idx}">${renderProposedLineHtml(line)}</td>
                        <td><button data-proposed-delete="${idx}">Delete</button></td>
                      </tr>
                    `;
                          })
                          .join("")
                      : `<tr><td colspan="3" class="banner">No proposed changes yet. Ask the designer in chat.</td></tr>`
                  }
                </tbody>
              </table>
            </div>
          </div>
          <details class="panel-footer-block proposed-payload-footer" ${state.ui.proposedPayloadOpen ? "open" : ""}>
            <summary id="toggle-proposed-payload">Selected Change Payload Preview</summary>
            <p class="banner">${escapeHtml(planSummary)}</p>
            <p class="banner">Scope: ${selectedLines.length ? `${selectedLines.length} selected` : `${allVisibleLines.length} visible`} change${(selectedLines.length || allVisibleLines.length) === 1 ? "" : "s"}</p>
            <p class="banner">Affected targets: ${impact.targetCount}${impact.targets.length ? ` (${escapeHtml(impact.targets.join(", "))})` : ""}</p>
            <p class="banner">Affected windows: ${impact.sectionWindows.length ? escapeHtml(impact.sectionWindows.join(" | ")) : "No section timing context yet."}</p>
            <div class="row">
              <button id="restore-last-backup" ${state.lastApplyBackupPath ? "" : "disabled"}>Restore Last Backup</button>
            </div>
            ${
              backupReady
                ? `<p class="banner">Backup ready: ${escapeHtml(String(state.lastApplyBackupPath || "").trim())}</p>`
                : `<p class="banner warning">No restore point has been captured in this session yet.</p>`
            }
            <pre class="proposed-payload">${payloadPreview}</pre>
          </details>
          <div class="row panel-footer-block proposed-actions">
              <button id="remove-selected-proposed" ${selectedCount ? "" : "disabled"}>Delete Selected</button>
              <button id="remove-all-proposed" ${list.length ? "" : "disabled"}>Delete All</button>
              <button id="apply-selected" class="proposed-apply-btn proposed-apply-start" ${canApplySelected ? "" : "disabled"}>Apply Selected</button>
              <button id="apply-all" class="proposed-apply-btn" ${canApplyAll ? "" : "disabled"}>Apply All</button>
          </div>
        </section>
      </div>

      <div class="mobile-apply-bar">
        <button id="mobile-apply-all" ${canApplyAll ? "" : "disabled"}>Apply All</button>
        <span class="banner ${applyReady ? "" : "warning"}">${applyReady ? (approvalChecked ? "Ready" : "Awaiting approval") : disabledReason}</span>
      </div>
    `;
  }

  function historyScreen() {
    ensureVersionSnapshots();
    const selected = state.versions.find((v) => v.id === state.selectedVersion) || state.versions[0];
    const currentHead = state.versions[0] || null;
    const compare = state.compareVersion ? versionById(state.compareVersion) : null;
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
    const hasLoadedSubmodels = (state.submodels || []).length > 0;
    const submodelsAvailable = hasLoadedSubmodels;
    const metadataTargets = buildMetadataTargets({ includeSubmodels: submodelsAvailable });
    const modelOptions = metadataTargets
      .map((target) => ({ id: target.id, name: target.displayName, raw: target }))
      .filter((target) => target.id);
    const assignments = state.metadata?.assignments || [];
    const orphans = getMetadataOrphans();
    const tags = getMetadataTagRecords();
    const assignmentByTargetId = new Map(assignments.map((a) => [String(a.targetId), a]));
    const nameFilter = String(state.ui.metadataFilterName || "");
    const typeFilter = String(state.ui.metadataFilterType || "");
    const tagsFilter = String(state.ui.metadataFilterTags || "");
    const submodelBanner = state.health?.submodelDiscoveryError
      ? `Submodels unavailable: ${state.health.submodelDiscoveryError}`
      : "No submodels found in current show data.";
    const filteredModels = modelOptions.filter((m) => {
      const rowName = (m?.raw?.displayName || "").toLowerCase();
      const rowType = (m?.raw?.type || "").toLowerCase();
      const assignment = assignmentByTargetId.get(String(m.id));
      const rowTags = Array.isArray(assignment?.tags) ? assignment.tags.join(", ").toLowerCase() : "";
      if (!matchesMetadataFilterValue(rowName, nameFilter)) return false;
      if (!matchesMetadataFilterValue(rowType, typeFilter)) return false;
      if (!matchesMetadataFilterValue(rowTags, tagsFilter)) return false;
      return true;
    });
    const submodelCount = modelOptions.filter((target) => target.raw.type === "submodel").length;
    const selectedIds = new Set(normalizeMetadataSelectionIds(state.ui.metadataSelectionIds));
    const selectedCount = selectedIds.size;
    const selectedEditorTags = normalizeMetadataSelectedTags(state.ui.metadataSelectedTags);
    return `
      <div class="screen-grid metadata-workspace">
        <section class="card metadata-panel">
          <h3>Tag Manager</h3>
          <div class="field" style="margin-top:10px;">
            <label>Operation Tags</label>
            <div class="metadata-grid-wrap metadata-tag-grid-wrap">
              <table class="metadata-grid metadata-tag-grid">
                <thead>
                  <tr>
                    <th style="width:42px;">Use</th>
                    <th style="width:220px;">Tag</th>
                    <th>Description</th>
                    <th style="width:70px;"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr class="new-tag-row">
                    <td></td>
                    <td><input id="metadata-new-tag" value="${(state.ui.metadataNewTag || "").replace(/"/g, "&quot;")}" placeholder="new tag" /></td>
                    <td><input id="metadata-new-tag-description" value="${(state.ui.metadataNewTagDescription || "").replace(/"/g, "&quot;")}" placeholder="description (optional)" /></td>
                    <td><button id="metadata-add-tag">Add</button></td>
                  </tr>
                  ${
                    tags.length
                      ? tags
                          .map((tag) => {
                            const safeTag = String(tag.name).replace(/\"/g, "&quot;");
                            const checked = selectedEditorTags.includes(String(tag.name)) ? "checked" : "";
                            return `<tr>
                              <td><input type="checkbox" data-metadata-tag-toggle="${safeTag}" ${checked} /></td>
                              <td>${String(tag.name).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>
                              <td><input data-metadata-tag-description="${safeTag}" value="${String(tag.description || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")}" placeholder="description" /></td>
                              <td><button data-remove-tag="${safeTag}">Delete</button></td>
                            </tr>`;
                          })
                          .join("")
                      : `<tr><td colspan="4">No tags yet.</td></tr>`
                  }
                </tbody>
              </table>
            </div>
          </div>
          <div class="row">
            <button id="metadata-apply-selected-tags">Apply Tags To Selected</button>
            <button id="metadata-remove-selected-tags">Remove Tags From Selected</button>
            <button id="metadata-clear-tags">Clear Tag Picks</button>
            <span class="banner">Selected: ${selectedCount}</span>
          </div>
          <hr />
          <h3>Element Metadata Grid</h3>
          <div class="row">
            <button id="refresh-models">Refresh Models</button>
            <button id="metadata-select-visible">Select Visible</button>
            <button id="metadata-clear-selection">Clear Selection</button>
            <span class="banner">Targets: ${modelOptions.length} total (${submodelCount} submodels)</span>
          </div>
          ${submodelsAvailable ? "" : `<p class="banner">${submodelBanner.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`}
          <div class="metadata-grid-wrap metadata-targets-wrap">
            <table class="metadata-grid metadata-target-grid">
              <thead>
                <tr>
                  <th style="width:36px;">Sel</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Tags</th>
                </tr>
                <tr class="metadata-filter-row">
                  <th></th>
                  <th><input id="metadata-filter-name" value="${(state.ui.metadataFilterName || "").replace(/"/g, "&quot;")}" placeholder="name (comma-separated)..." /></th>
                  <th><input id="metadata-filter-type" value="${(state.ui.metadataFilterType || "").replace(/"/g, "&quot;")}" placeholder="type (comma-separated)..." /></th>
                  <th><input id="metadata-filter-tags" value="${(state.ui.metadataFilterTags || "").replace(/"/g, "&quot;")}" placeholder="tags (comma-separated)..." /></th>
                </tr>
              </thead>
              <tbody>
                ${
                  filteredModels.length
                    ? filteredModels
                        .slice(0, 200)
                        .map((m) => {
                          const type = String(m?.raw?.type || "");
                          const a = assignmentByTargetId.get(String(m.id));
                          const tagList = Array.isArray(a?.tags) && a.tags.length ? a.tags.join(", ") : "-";
                          const selected = selectedIds.has(String(m.id)) ? "checked" : "";
                          return `<tr>
                            <td><input type="checkbox" data-metadata-select="${String(m.id).replace(/\"/g, "&quot;")}" ${selected} /></td>
                            <td>${(m.raw?.displayName || "(unnamed)").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>
                            <td>${type.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") || "-"}</td>
                            <td>${tagList.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>
                          </tr>`;
                        })
                        .join("")
                    : `<tr><td colspan="4">No targets found.</td></tr>`
                }
              </tbody>
            </table>
          </div>
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
    `;
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
