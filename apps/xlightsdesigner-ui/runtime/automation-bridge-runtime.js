import { createAutomationRuntime } from "./automation-runtime.js";

function str(value = "") {
  return String(value || "").trim();
}

function buildAutomationDemoPlan({
  start = 0,
  end = 0,
  effectNames = [],
  summary = "",
  goal = "",
  state,
  clearDesignerDraft,
  clearSequencingHandoffsForSequenceChange,
  setAgentHandoff,
  setStatus,
  persist,
  render
} = {}) {
  const span = end - start;
  const slot = Math.floor(span / Math.max(1, effectNames.length));

  clearDesignerDraft(state);
  state.agentPlan = null;
  clearSequencingHandoffsForSequenceChange("automation demo reset");

  state.draftBaseRevision = str(state.revision || "unknown");
  state.draftSequencePath = str(state.sequencePathInput);
  state.proposed = [`Chorus 1 / Snowman / ${effectNames[0] || "Effect"}${effectNames.length > 1 ? `, ${effectNames[1]}${effectNames.length > 2 ? ` +${effectNames.length - 2} more` : ""}` : ""}`];
  state.flags.hasDraftProposal = true;
  state.flags.proposalStale = false;

  const intentHandoff = {
    artifactId: `intent_handoff_v1-demo-${Date.now()}`,
    artifactType: "intent_handoff_v1",
    createdAt: new Date().toISOString(),
    goal,
    mode: "revise",
    scope: {
      targetIds: ["Snowman"],
      tagNames: [],
      sections: ["Chorus 1"],
      timeRangeMs: { startMs: start, endMs: end }
    },
    constraints: {
      changeTolerance: "medium",
      preserveTimingTracks: true,
      allowGlobalRewrite: false
    },
    directorPreferences: {
      styleDirection: "demo",
      energyArc: "hold",
      focusElements: ["Snowman"],
      colorDirection: "mixed"
    },
    approvalPolicy: {
      requiresExplicitApprove: true,
      elevatedRiskConfirmed: false
    }
  };

  const commands = [
    { id: "timing.track.create", cmd: "timing.createTrack", params: { trackName: "XD: Song Structure", replaceIfExists: true } },
    {
      id: "timing.marks.insert",
      dependsOn: ["timing.track.create"],
      cmd: "timing.insertMarks",
      params: {
        trackName: "XD: Song Structure",
        marks: [{ label: "Chorus 1", startMs: start, endMs: end }]
      }
    },
    ...effectNames.map((effectName, i) => ({
      id: `demo-placement-${i + 1}`,
      dependsOn: ["timing.marks.insert"],
      anchor: {
        kind: "timing_track",
        trackName: "XD: Song Structure",
        markLabel: "Chorus 1",
        startMs: start + (i * slot),
        endMs: i === effectNames.length - 1 ? end : start + ((i + 1) * slot),
        basis: "within_section"
      },
      cmd: "effects.create",
      params: {
        modelName: "Snowman",
        layerIndex: 0,
        effectName,
        startMs: start + (i * slot),
        endMs: i === effectNames.length - 1 ? end : start + ((i + 1) * slot),
        settings: {},
        palette: {}
      }
    }))
  ];

  const planHandoff = {
    artifactId: `plan_handoff_v1-demo-${Date.now()}`,
    artifactType: "plan_handoff_v1",
    createdAt: new Date().toISOString(),
    goal,
    summary,
    estimatedImpact: effectNames.length,
    warnings: [],
    commands,
    baseRevision: state.draftBaseRevision,
    validationReady: true
  };

  state.creative = state.creative || {};
  state.creative.intentHandoff = structuredClone(intentHandoff);
  state.agentPlan = {
    source: "automation_demo",
    summary: planHandoff.summary,
    warnings: [],
    estimatedImpact: effectNames.length,
    handoff: structuredClone(planHandoff)
  };

  setAgentHandoff("intent_handoff_v1", intentHandoff, "designer_dialog");
  setAgentHandoff("plan_handoff_v1", planHandoff, "sequence_agent");
  setStatus("info", `${summary} (proposal only).`);
  persist();
  render();

  return {
    ok: true,
    status: state.status || null,
    activeSequence: state.activeSequence || "",
    proposedCount: Array.isArray(state.proposed) ? state.proposed.length : 0
  };
}

export function createAutomationBridgeRuntime(deps = {}) {
  const {
    state,
    clearDesignerDraft,
    clearSequencingHandoffsForSequenceChange,
    setAgentHandoff,
    setStatus,
    persist,
    render,
    onAcceptTimingTrackReview
  } = deps;

  const automationRuntime = createAutomationRuntime(deps);

  async function showAutomationTenEffectGridDemo() {
    return buildAutomationDemoPlan({
      start: 78230,
      end: 97120,
      effectNames: ["Color Wash", "Shimmer", "Bars", "Butterfly", "Meteors", "Pinwheel", "Spirals", "Wave", "Candle", "Morph"],
      summary: "Loaded ten-effect grid demo",
      goal: "Show ten-effect Sequence grid aggregation demo.",
      state,
      clearDesignerDraft,
      clearSequencingHandoffsForSequenceChange,
      setAgentHandoff,
      setStatus,
      persist,
      render
    });
  }

  async function showAutomationSplitEffectGridDemo() {
    return buildAutomationDemoPlan({
      start: 78230,
      end: 97120,
      effectNames: ["Color Wash", "Color Wash", "Color Wash", "Color Wash", "Color Wash", "Shimmer", "Shimmer", "Shimmer", "Shimmer", "Shimmer"],
      summary: "Loaded split-effect grid demo",
      goal: "Show split-effect Sequence grid aggregation demo.",
      state,
      clearDesignerDraft,
      clearSequencingHandoffsForSequenceChange,
      setAgentHandoff,
      setStatus,
      persist,
      render
    });
  }

  function exposeRuntimeValidationHooks() {
    automationRuntime.exposeRuntimeValidationHooks();
    window.xLightsDesignerRuntime.showTenEffectGridDemo = showAutomationTenEffectGridDemo;
    window.xLightsDesignerRuntime.showSplitEffectGridDemo = showAutomationSplitEffectGridDemo;
    window.xLightsDesignerRuntime.acceptTimingTrackReview = onAcceptTimingTrackReview;
  }

  return {
    ...automationRuntime,
    showAutomationTenEffectGridDemo,
    showAutomationSplitEffectGridDemo,
    exposeRuntimeValidationHooks
  };
}
