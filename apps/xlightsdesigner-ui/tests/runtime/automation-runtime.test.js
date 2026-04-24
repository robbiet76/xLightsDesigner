import test from "node:test";
import assert from "node:assert/strict";

import { createAutomationRuntime } from "../../runtime/automation-runtime.js";

function buildDeps(overrides = {}) {
  const state = {
    status: null,
    activeSequence: "",
    sequencePathInput: "",
    proposed: [],
    chat: [],
    flags: {},
    ui: {},
    creative: {},
    sequenceAgentRuntime: {}
  };

  return {
    state,
    agentRuntime: { activeRole: "designer_dialog", handoffs: {} },
    onSendChat: async () => {},
    onGenerate: async () => {},
    onApplyAll: async () => ({}),
    onRefresh: async () => {},
    onAnalyzeAudio: async () => {},
    onOpenExistingSequence: async () => {},
    clearDesignRevisionTarget: () => {},
    normalizeDesignRevisionTarget: (value) => value,
    clearDesignerDraft: () => {},
    clearSequencingHandoffsForSequenceChange: () => {},
    buildSupersededConceptRecordById: () => null,
    retagExecutionPlanForRevisionTarget: () => null,
    getExecutionPlanFromArtifacts: () => null,
    rebuildProposalBundleFromExecutionPlan: () => null,
    setAgentHandoff: () => {},
    upsertSupersededConceptRecord: () => {},
    isPlainObject: (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value),
    buildCurrentDesignSceneContext: () => ({}),
    buildCurrentMusicDesignContext: () => ({}),
    executeDesignerProposalOrchestration: () => ({}),
    getValidHandoff: () => null,
    filteredProposed: () => [],
    arraysEqualOrdered: () => true,
    buildSequenceAgentPlan: () => ({}),
    validateCommandGraph: () => ({ ok: true }),
    buildOwnedSequencingBatchPlan: () => ({}),
    getOwnedHealth: () => null,
    currentLayoutMode: () => "2d",
    getSequenceTimingOwnershipRows: () => [],
    applyReadyForApprovalGate: () => false,
    definePersistedVisualHint: () => null,
    persist: () => {},
    render: () => {},
    setStatus: () => {},
    runCurrentDirectSequenceValidation: () => ({}),
    getCurrentDirectSequenceValidationSnapshot: () => ({}),
    getPageStates: () => ({}),
    ...overrides
  };
}

test("automation runtime defines managed visual hints through backend hook", () => {
  let persisted = false;
  let rendered = false;
  const runtime = createAutomationRuntime(buildDeps({
    definePersistedVisualHint: (name, definition) => ({
      name,
      status: "defined",
      semanticClass: definition.semanticClass,
      behavioralIntent: definition.behavioralIntent,
      behavioralTags: definition.behavioralTags
    }),
    persist: () => { persisted = true; },
    render: () => { rendered = true; }
  }));

  const out = runtime.defineAutomationVisualHint({
    name: "cool",
    semanticClass: "color_direction",
    behavioralIntent: "Prefer cooler color direction.",
    behavioralTags: ["cool-tone"]
  });

  assert.equal(out.ok, true);
  assert.equal(out.hint.name, "cool");
  assert.equal(out.hint.status, "defined");
  assert.equal(out.hint.semanticClass, "color_direction");
  assert.deepEqual(out.hint.behavioralTags, ["cool-tone"]);
  assert.equal(persisted, true);
  assert.equal(rendered, true);
});

test("automation runtime rejects empty visual hint definition requests", () => {
  const runtime = createAutomationRuntime(buildDeps());
  const out = runtime.defineAutomationVisualHint({ name: "" });
  assert.equal(out.ok, false);
  assert.match(out.error, /name is required/i);
});

test("automation runtime exposes visual hint definition snapshot", () => {
  const runtime = createAutomationRuntime(buildDeps({
    state: {
      status: { level: "info", text: "ready" },
      activeSequence: "",
      sequencePathInput: "",
      proposed: [],
      chat: [],
      flags: {},
      ui: {},
      creative: {},
      metadata: {
        visualHintDefinitions: [
          {
            name: "Cool",
            status: "pending_definition",
            source: "custom",
            definedBy: "user"
          },
          {
            name: "Warm Accent",
            status: "defined",
            source: "managed",
            definedBy: "agent"
          }
        ]
      }
    }
  }));

  const out = runtime.getAutomationVisualHintDefinitionsSnapshot();
  assert.equal(out.ok, true);
  assert.equal(out.counts.systemDefined > 0, true);
  assert.equal(out.counts.userPending, 1);
  assert.equal(out.counts.managedDefined, 1);
  assert.equal(Array.isArray(out.records), true);
});

test("automation reset clears stale audio path and sequence media state", async () => {
  const state = {
    status: { level: "info", text: "ready" },
    activeSequence: "CandyCaneLane",
    sequencePathInput: "/show/CandyCaneLane/CandyCaneLane.xsq",
    audioPathInput: "/other-show/Audio/stale.mp3",
    sequenceMediaFile: "/other-show/Audio/stale.mp3",
    proposed: [],
    chat: [],
    flags: {},
    ui: {},
    creative: {},
    sequenceAgentRuntime: {}
  };
  const runtime = createAutomationRuntime(buildDeps({ state }));

  const out = await runtime.resetAutomationState();

  assert.equal(out.ok, true);
  assert.equal(state.audioPathInput, "");
  assert.equal(state.sequenceMediaFile, "");
});

test("automation runtime stores render observation artifacts for feedback loop testing", () => {
  let persisted = false;
  let rendered = false;
  const state = {
    status: null,
    activeSequence: "",
    sequencePathInput: "",
    proposed: [],
    chat: [],
    flags: {},
    ui: {},
    creative: {},
    sequenceAgentRuntime: {}
  };
  const runtime = createAutomationRuntime(buildDeps({
    state,
    persist: () => { persisted = true; },
    render: () => { rendered = true; }
  }));

  const out = runtime.setAutomationRenderObservation({
    renderObservation: {
      artifactType: "render_observation_v1",
      artifactId: "render-1"
    },
    renderCritiqueContext: {
      artifactType: "sequence_render_critique_context_v1",
      artifactId: "critique-1"
    }
  });

  assert.equal(out.ok, true);
  assert.equal(state.sequenceAgentRuntime.renderObservation.artifactId, "render-1");
  assert.equal(state.sequenceAgentRuntime.renderCritiqueContext.artifactId, "critique-1");
  assert.equal(persisted, true);
  assert.equal(rendered, true);
  assert.equal(runtime.getAutomationRenderFeedbackSnapshot().renderObservation.artifactId, "render-1");
  assert.equal(runtime.getAutomationAgentRuntimeSnapshot().renderFeedback.renderObservation.artifactId, "render-1");
});

test("automation runtime rejects invalid render observation artifacts", () => {
  const runtime = createAutomationRuntime(buildDeps());
  const out = runtime.setAutomationRenderObservation({
    renderObservation: {
      artifactType: "wrong_type"
    }
  });
  assert.equal(out.ok, false);
  assert.match(out.error, /renderObservation must be render_observation_v1/i);
});

test("automation sequencer validation snapshot exposes review chain guidance and persistence diagnostics", () => {
  const runtime = createAutomationRuntime(buildDeps({
    state: {
      status: { level: "info", text: "ready" },
      activeSequence: "Christmas 2026",
      sequencePathInput: "/show/Christmas 2026.xsq",
      proposed: [],
      chat: [],
      flags: {},
      creative: {},
      sequenceAgentRuntime: {},
      applyHistory: [
        { historyEntryId: "history-1", summary: "Applied revision." }
      ],
      diagnostics: [
        { ts: "2026-04-14T10:00:00.000Z", level: "warning", text: "Project artifact persistence failed.", details: "reason=bridge_rejected outcomes=1" },
        { ts: "2026-04-14T09:59:59.000Z", level: "info", text: "Other diagnostic", details: "" }
      ],
      ui: {
        reviewHistorySnapshot: {
          applyResult: {
            artifactId: "apply-1",
            artifactType: "sequence_apply_result_v1",
            status: "applied",
            sequenceBackupPath: "/tmp/project/artifacts/backups/HolidayRoad.xsq",
            renderCurrentSummary: "Rendered xLights sequence: /tmp/HolidayRoad.xsq",
            practicalValidation: {
              artifactType: "practical_sequence_validation_v1",
              overallOk: true,
              designSummary: "MegaTree chorus",
              summary: {
                readbackChecks: { passed: 3, failed: 0 },
                designChecks: { passed: 2, failed: 0 }
              }
            }
          },
          intentHandoff: {
            artifactId: "intent-1"
          },
          planHandoff: {
            artifactId: "plan-1",
            commands: [
              {
                cmd: "effects.create",
                params: { effectName: "Pinwheel" },
                intent: {
                  parameterPriorGuidance: { recommendationMode: "exact_geometry", priors: [] },
                  sharedSettingPriorGuidance: { recommendationMode: "cross_effect_generic", settings: [] }
                }
              },
              {
                cmd: "effects.create",
                params: { effectName: "Color Wash" },
                intent: {}
              }
            ]
          },
          renderObservation: {
            artifactId: "render-1",
            artifactType: "render_observation_v1",
            macro: { leadModel: "SpinnerStandard" },
            source: { samplingMode: "drilldown" }
          },
          renderCritiqueContext: {
            artifactId: "critique-1",
            artifactType: "sequence_render_critique_context_v1",
            comparison: { leadMatchesPrimaryFocus: true },
            observed: { breadthRead: "focused" }
          },
          sequenceArtisticGoal: {
            artifactId: "goal-1",
            artifactType: "sequence_artistic_goal_v1",
            scope: { goalLevel: "section" }
          },
          sequenceRevisionObjective: {
            artifactId: "objective-1",
            artifactType: "sequence_revision_objective_v1",
            ladderLevel: "group",
            scope: { nextOwner: "shared" }
          }
        }
      }
    },
    getPageStates: () => ({ review: { page: "review" } })
  }));

  const out = runtime.getAutomationSequencerValidationSnapshot();

  assert.equal(out.ok, true);
  assert.equal(out.reviewHistorySnapshotAvailable, true);
  assert.equal(out.latestReviewArtifacts.applyResult.artifactId, "apply-1");
  assert.equal(out.latestReviewArtifacts.applyResult.practicalValidation.readbackPassed, 3);
  assert.equal(out.latestReviewArtifacts.applyResult.practicalValidation.designPassed, 2);
  assert.equal(out.latestReviewArtifacts.renderObservation.artifactId, "render-1");
  assert.equal(out.latestReviewArtifacts.renderObservation.samplingMode, "drilldown");
  assert.equal(out.latestReviewArtifacts.renderCritiqueContext.leadMatchesPrimaryFocus, true);
  assert.equal(out.latestReviewArtifacts.sequenceArtisticGoal.goalLevel, "section");
  assert.equal(out.latestReviewArtifacts.sequenceRevisionObjective.ladderLevel, "group");
  assert.equal(out.latestGuidanceCoverage.effectCreateCount, 2);
  assert.equal(out.latestGuidanceCoverage.parameterPriorCommandCount, 1);
  assert.equal(out.latestGuidanceCoverage.sharedSettingPriorCommandCount, 1);
  assert.deepEqual(out.latestGuidanceCoverage.guidedEffects, ["Pinwheel"]);
  assert.equal(out.recentPersistenceDiagnostics.length, 1);
  assert.match(out.recentPersistenceDiagnostics[0].details, /bridge_rejected/);
  assert.equal(out.pageStates.review.page, "review");
});
