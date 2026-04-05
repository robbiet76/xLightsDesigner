function str(value = "") {
  return String(value || "").trim();
}

function nowMs() {
  return Date.now();
}

function normalizeStringArray(values = []) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((v) => str(v))
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));
}

function arraysEqualAsSets(a = [], b = []) {
  const left = normalizeStringArray(a);
  const right = normalizeStringArray(b);
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

export function createAgentRuntimeState(deps = {}) {
  const {
    state,
    agentRuntime,
    handoffContracts = [],
    supportedActiveRoles = ["audio_analyst", "designer_dialog", "sequence_agent"],
    isPlainObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value),
    validateAgentHandoff = () => [],
    pushDiagnostic = () => {},
    getSelectedSections = () => [],
    normalizeMetadataSelectionIds = (values = []) => values,
    normalizeMetadataSelectedTags = (values = []) => values
  } = deps;

  let currentOrchestrationRun = null;

  function getAgentHandoffReadyCount() {
    let count = 0;
    for (const contract of handoffContracts) {
      const row = agentRuntime.handoffs?.[contract];
      if (row?.valid === true && isPlainObject(row.payload)) count += 1;
    }
    return count;
  }

  function refreshAgentRuntimeHealth() {
    const readyCount = getAgentHandoffReadyCount();
    state.health.agentLayerReady = Boolean(agentRuntime.loaded && !agentRuntime.error);
    state.health.agentActiveRole = str(agentRuntime.activeRole);
    state.health.agentRegistryVersion = str(agentRuntime.registryVersion);
    state.health.agentRegistryValid = Boolean(agentRuntime.registryValid);
    state.health.agentRegistryErrors = Array.isArray(agentRuntime.registryErrors)
      ? agentRuntime.registryErrors.slice(0, 12)
      : [];
    state.health.agentHandoffsReady = `${readyCount}/${handoffContracts.length}`;
  }

  function beginOrchestrationRun({ trigger = "", role = "" } = {}) {
    const run = {
      id: `orch-${nowMs()}`,
      trigger: str(trigger) || "unknown",
      role: str(role),
      startedAtMs: nowMs(),
      startedAtIso: new Date().toISOString(),
      stages: [],
      status: "running",
      summary: ""
    };
    currentOrchestrationRun = run;
    pushDiagnostic("info", `Orchestration run started (${run.id}) trigger=${run.trigger}${run.role ? ` role=${run.role}` : ""}.`);
    return run;
  }

  function markOrchestrationStage(run, stage = "", status = "ok", detail = "") {
    if (!run || run !== currentOrchestrationRun) return;
    const row = {
      stage: str(stage) || "unknown",
      status: str(status) || "ok",
      detail: str(detail),
      atMs: nowMs(),
      elapsedMs: Math.max(0, nowMs() - run.startedAtMs)
    };
    run.stages.push(row);
    const suffix = row.detail ? `: ${row.detail}` : "";
    const level = row.status === "ok" ? "info" : "warning";
    pushDiagnostic(level, `Orchestration ${run.id} stage ${row.stage} [${row.status}]${suffix}`);
  }

  function endOrchestrationRun(run, { status = "ok", summary = "" } = {}) {
    if (!run || run !== currentOrchestrationRun) return;
    run.status = str(status) || "ok";
    run.summary = str(summary);
    run.endedAtMs = nowMs();
    run.durationMs = Math.max(0, run.endedAtMs - run.startedAtMs);
    const sum = run.summary || `${run.trigger} completed`;
    const st = run.status;
    state.health.orchestrationLastRunId = run.id;
    state.health.orchestrationLastStatus = st;
    state.health.orchestrationLastSummary = `${sum} (${run.durationMs}ms)`;
    state.health.orchestrationLastAt = new Date().toISOString();
    const level = st === "ok" ? "info" : "warning";
    pushDiagnostic(level, `Orchestration run ended (${run.id}) status=${st} duration=${run.durationMs}ms summary=${sum}`);
    currentOrchestrationRun = null;
  }

  function buildAgentPersistenceContext() {
    return {
      revision: str(state.revision || "unknown"),
      draftBaseRevision: str(state.draftBaseRevision || "unknown"),
      audioPath: str(state.audioPathInput),
      selectedSections: normalizeStringArray(getSelectedSections()),
      selectedTargets: normalizeStringArray(normalizeMetadataSelectionIds(state.ui.metadataSelectionIds || [])),
      selectedTags: normalizeStringArray(normalizeMetadataSelectedTags(state.ui.metadataSelectedTags || []))
    };
  }

  function setAgentActiveRole(roleId = "") {
    agentRuntime.activeRole = str(roleId);
    refreshAgentRuntimeHealth();
  }

  function setAgentHandoff(contract = "", payload = {}, producer = "") {
    const key = str(contract);
    if (!key) return { ok: false, errors: ["contract is required"] };
    const errors = validateAgentHandoff(key, payload);
    const context = buildAgentPersistenceContext();
    agentRuntime.handoffs[key] = {
      contract: key,
      producer: str(producer),
      payload: isPlainObject(payload) ? payload : {},
      context,
      valid: errors.length === 0,
      errors,
      at: new Date().toISOString()
    };
    refreshAgentRuntimeHealth();
    if (errors.length) {
      pushDiagnostic("warning", `Agent handoff invalid (${key}): ${errors.join("; ")}`);
    } else {
      pushDiagnostic("info", `Agent handoff ready (${key}) from ${producer || "unknown"}.`);
    }
    return { ok: errors.length === 0, errors };
  }

  function getValidHandoff(contract = "") {
    const row = agentRuntime.handoffs?.[str(contract)];
    return row?.valid ? row.payload : null;
  }

  function getValidHandoffRecord(contract = "") {
    const row = agentRuntime.handoffs?.[str(contract)];
    return row?.valid ? row : null;
  }

  function clearAgentHandoff(contract = "", reason = "", { pushLog = true } = {}) {
    const key = str(contract);
    if (!key || !handoffContracts.includes(key)) return false;
    const existing = agentRuntime.handoffs?.[key];
    if (!existing) return false;
    agentRuntime.handoffs[key] = null;
    refreshAgentRuntimeHealth();
    if (pushLog && reason) {
      pushDiagnostic("info", `Agent handoff cleared (${key}): ${reason}`);
    }
    return true;
  }

  function invalidatePlanHandoff(reason = "context changed") {
    clearAgentHandoff("plan_handoff_v1", reason);
  }

  function invalidateAnalysisHandoff(reason = "audio changed", { cascadePlan = true } = {}) {
    const cleared = clearAgentHandoff("analysis_handoff_v1", reason);
    if (cleared && cascadePlan) {
      clearAgentHandoff("plan_handoff_v1", `analysis invalidated (${reason})`);
    }
  }

  function reconcileHandoffsAgainstCurrentContext({ reasonPrefix = "context drift" } = {}) {
    const current = buildAgentPersistenceContext();
    const plan = agentRuntime.handoffs?.plan_handoff_v1;
    if (plan?.valid && isPlainObject(plan.context)) {
      const contextRevision = str(plan.context.revision || "unknown");
      const revisionChanged =
        contextRevision !== "unknown" &&
        current.revision !== "unknown" &&
        contextRevision !== current.revision;
      const sectionsChanged = !arraysEqualAsSets(plan.context.selectedSections, current.selectedSections);
      const targetsChanged = !arraysEqualAsSets(plan.context.selectedTargets, current.selectedTargets);
      const tagsChanged = !arraysEqualAsSets(plan.context.selectedTags, current.selectedTags);
      if (revisionChanged || sectionsChanged || targetsChanged || tagsChanged) {
        invalidatePlanHandoff(
          `${reasonPrefix}: ${
            revisionChanged
              ? "revision changed"
              : (sectionsChanged ? "section scope changed" : (targetsChanged ? "target scope changed" : "tag scope changed"))
          }`
        );
      }
    }

    const analysis = agentRuntime.handoffs?.analysis_handoff_v1;
    if (analysis?.valid && isPlainObject(analysis.context)) {
      const persistedAudio = str(analysis.context.audioPath);
      const currentAudio = str(current.audioPath);
      if (persistedAudio && currentAudio && persistedAudio !== currentAudio) {
        invalidateAnalysisHandoff(`${reasonPrefix}: audio/media changed`, { cascadePlan: true });
      }
    }
  }

  function clearAgentHandoffs() {
    clearAgentHandoff("analysis_handoff_v1", "session reset", { pushLog: false });
    clearAgentHandoff("intent_handoff_v1", "session reset", { pushLog: false });
    clearAgentHandoff("plan_handoff_v1", "session reset", { pushLog: false });
    agentRuntime.handoffs = {
      analysis_handoff_v1: null,
      intent_handoff_v1: null,
      plan_handoff_v1: null
    };
    if (!supportedActiveRoles.includes(agentRuntime.activeRole)) {
      agentRuntime.activeRole = "";
    }
    refreshAgentRuntimeHealth();
  }

  function clearSequencingHandoffsForSequenceChange(reason = "sequence changed") {
    clearAgentHandoff("intent_handoff_v1", reason, { pushLog: false });
    clearAgentHandoff("plan_handoff_v1", reason, { pushLog: false });
  }

  return {
    getAgentHandoffReadyCount,
    refreshAgentRuntimeHealth,
    beginOrchestrationRun,
    markOrchestrationStage,
    endOrchestrationRun,
    buildAgentPersistenceContext,
    setAgentActiveRole,
    setAgentHandoff,
    getValidHandoff,
    getValidHandoffRecord,
    clearAgentHandoff,
    invalidatePlanHandoff,
    invalidateAnalysisHandoff,
    reconcileHandoffsAgainstCurrentContext,
    clearAgentHandoffs,
    clearSequencingHandoffsForSequenceChange
  };
}
