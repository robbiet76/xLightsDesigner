import test from "node:test";
import assert from "node:assert/strict";

import { createProjectHistoryRuntime } from "../../runtime/project-history-runtime.js";

function buildState() {
  return {
    projectFilePath: "/show/project.xdproj",
    draftBaseRevision: "rev-1",
    revision: "rev-2",
    applyHistory: [],
    audioAnalysis: {
      artifact: { artifactId: "analysis-1" }
    },
    directorProfile: { artifactId: "director-1" },
    creative: {
      brief: { artifactId: "brief-1" },
      proposalBundle: { artifactId: "proposal-1" },
      intentHandoff: { artifactId: "intent-1" },
      sequenceArtisticGoal: { artifactId: "goal-1" },
      sequenceRevisionObjective: { artifactId: "objective-1" }
    },
    ui: {
      selectedHistoryEntry: "",
      selectedHistorySnapshot: null,
      reviewHistorySnapshot: null,
      metadataSelectionIds: ["Tree"]
    }
  };
}

test("project history runtime persists available artifacts for history", async () => {
  const writes = [];
  const state = buildState();
  state.sequenceAgentRuntime = {
    renderObservation: { artifactId: "render-1" },
    renderCritiqueContext: { artifactId: "critique-1" }
  };
  const runtime = createProjectHistoryRuntime({
    state,
    getDesktopProjectArtifactBridge: () => ({
      writeProjectArtifacts: async (payload) => {
        writes.push(payload);
        return { ok: true };
      }
    }),
    currentApplyContext: () => ({ projectKey: "proj-1", sequencePath: "/show/Test.xsq", endpoint: "" }),
    buildEffectFamilyOutcomeRecords: () => [{ artifactId: "outcome-1", artifactType: "effect_family_outcome_record_v1" }],
    buildCurrentDesignSceneContext: () => ({ artifactId: "scene-1" }),
    buildCurrentMusicDesignContext: () => ({ artifactId: "music-1" }),
    getValidHandoff: (contract) => (contract === "plan_handoff_v1" ? { artifactId: "plan-1" } : null)
  });

  const res = await runtime.persistCurrentArtifactsForHistory({
    applyResult: { artifactId: "apply-1" },
    historyEntry: { artifactId: "history-1" }
  });

  assert.equal(res.ok, true);
  assert.deepEqual(res.effectOutcomeRecords.map((row) => row.artifactId), ["outcome-1"]);
  assert.deepEqual(res.historyEntry.effectOutcomeRecordIds, ["outcome-1"]);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].projectFilePath, "/show/project.xdproj");
  assert.deepEqual(
    writes[0].artifacts.map((row) => row.artifactId),
    ["analysis-1", "scene-1", "music-1", "director-1", "brief-1", "proposal-1", "intent-1", "plan-1", "apply-1", "render-1", "critique-1", "goal-1", "objective-1", "history-1", "outcome-1"]
  );
});

test("project history runtime emits diagnostics when project artifact persistence returns not ok", async () => {
  const diagnostics = [];
  const state = buildState();
  state.sequenceAgentRuntime = {
    renderObservation: { artifactId: "render-1" },
    renderCritiqueContext: { artifactId: "critique-1" }
  };
  const runtime = createProjectHistoryRuntime({
    state,
    pushDiagnostic: (level, summary, detail) => diagnostics.push({ level, summary, detail }),
    getDesktopProjectArtifactBridge: () => ({
      writeProjectArtifacts: async () => ({ ok: false, reason: "bridge_rejected" })
    }),
    currentApplyContext: () => ({ projectKey: "proj-1", sequencePath: "/show/Test.xsq", endpoint: "" }),
    buildEffectFamilyOutcomeRecords: () => [{ artifactId: "outcome-1", artifactType: "effect_family_outcome_record_v1" }],
    buildCurrentDesignSceneContext: () => ({ artifactId: "scene-1" }),
    buildCurrentMusicDesignContext: () => ({ artifactId: "music-1" }),
    getValidHandoff: (contract) => (contract === "plan_handoff_v1" ? { artifactId: "plan-1" } : null)
  });

  const res = await runtime.persistCurrentArtifactsForHistory({
    applyResult: { artifactId: "apply-1" },
    historyEntry: { artifactId: "history-1" }
  });

  assert.equal(res.ok, false);
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].summary, "Project artifact persistence failed.");
  assert.match(diagnostics[0].detail, /bridge_rejected/);
  assert.match(diagnostics[0].detail, /outcomes=1/);
});

test("project history runtime loads and selects history snapshots", async () => {
  const state = buildState();
  state.applyHistory = [
    {
      historyEntryId: "h1",
      artifactRefs: {
        analysisArtifactId: "analysis-1",
        sceneContextId: "scene-1",
        musicContextId: "music-1",
        directorProfileId: "director-1",
        briefId: "brief-1",
        proposalId: "proposal-1",
        intentHandoffId: "intent-1",
        planId: "plan-1",
        applyResultId: "apply-1",
        renderObservationId: "render-1",
        renderCritiqueContextId: "critique-1",
        sequenceArtisticGoalId: "goal-1",
        sequenceRevisionObjectiveId: "objective-1"
      }
    }
  ];
  const runtime = createProjectHistoryRuntime({
    state,
    getDesktopProjectArtifactBridge: () => ({
      readProjectArtifact: async ({ artifactId }) => ({ ok: true, artifact: { artifactId } })
    }),
    persist: () => {},
    render: () => {}
  });

  const snapshot = await runtime.selectHistoryEntry("h1", { forReview: true });

  assert.equal(snapshot.historyEntryId, "h1");
  assert.equal(state.ui.selectedHistoryEntry, "h1");
  assert.equal(state.ui.selectedHistorySnapshot.planHandoff.artifactId, "plan-1");
  assert.equal(state.ui.reviewHistorySnapshot.applyResult.artifactId, "apply-1");
  assert.equal(state.ui.reviewHistorySnapshot.renderObservation.artifactId, "render-1");
  assert.equal(state.ui.reviewHistorySnapshot.renderCritiqueContext.artifactId, "critique-1");
  assert.equal(state.ui.reviewHistorySnapshot.sequenceArtisticGoal.artifactId, "goal-1");
  assert.equal(state.ui.reviewHistorySnapshot.sequenceRevisionObjective.artifactId, "objective-1");
});

test("project history runtime keeps immediate outcome records in review snapshots", () => {
  const state = buildState();
  state.sequenceAgentRuntime = {
    renderObservation: { artifactId: "render-1" },
    renderCritiqueContext: { artifactId: "critique-1" }
  };
  const runtime = createProjectHistoryRuntime({
    state,
    buildCurrentDesignSceneContext: () => null,
    buildCurrentMusicDesignContext: () => null,
    getValidHandoff: () => null
  });

  runtime.pushApplyHistory(
    { historyEntryId: "h2" },
    {
      planHandoff: { artifactId: "plan-2" },
      applyResult: { artifactId: "apply-2" },
      effectOutcomeRecords: [{ artifactId: "outcome-2", artifactType: "effect_family_outcome_record_v1" }]
    }
  );

  assert.equal(state.ui.reviewHistorySnapshot.historyEntryId, "h2");
  assert.equal(state.ui.reviewHistorySnapshot.effectOutcomeRecords[0].artifactId, "outcome-2");
});

test("project history runtime carries request scope into compact snapshot summaries", () => {
  const state = buildState();
  const runtime = createProjectHistoryRuntime({
    state,
    currentApplyContext: () => ({ projectKey: "proj-1", sequencePath: "/show/Test.xsq", endpoint: "http://127.0.0.1:49915/xlightsdesigner/api" }),
    buildHistoryEntry: (value) => value,
    currentArtifactRefs: () => ({}),
    buildHistorySnapshotSummary: (payload) => payload && typeof payload === "object" ? payload : {}
  });

  const entry = runtime.buildApplyHistoryEntry({
    status: "success",
    summary: "Applied section refinement",
    stage: "validate_apply",
    planHandoff: {
      metadata: {
        requestScopeMode: "section_target_refinement",
        reviewStartLevel: "section",
        sectionScopeKind: "timing_track_windows"
      }
    },
    applyResult: null
  });

  assert.equal(entry.snapshotSummary.planHandoff.metadata.requestScopeMode, "section_target_refinement");
  assert.equal(entry.snapshotSummary.planHandoff.metadata.reviewStartLevel, "section");
  assert.equal(entry.snapshotSummary.planHandoff.metadata.sectionScopeKind, "timing_track_windows");
});
