import test from "node:test";
import assert from "node:assert/strict";

import { runDirectSequenceValidation } from "../../runtime/clean-sequence-runtime.js";

test("runDirectSequenceValidation combines page-states and xlights states", async () => {
  const result = await runDirectSequenceValidation({
    endpoint: "http://127.0.0.1:49915/xlightsdesigner/api",
    state: {
      activeSequence: "Validation-Clean-Phase1.xsq",
      sequencePathInput: "/show/Validation-Clean-Phase1.xsq",
      proposed: ["Chorus 1 / Snowman / add Color Wash with warm amber glow"],
      agentPlan: { summary: "Direct draft.", warnings: [] },
      timingTracks: [{ name: "XD: Song Structure" }],
      sequenceCatalog: [{ path: "/show/Validation-Clean-Phase1.xsq", name: "Validation-Clean-Phase1" }],
      flags: { activeSequenceLoaded: true },
      currentSequenceRevision: "rev-1",
      ui: { proposedSelection: [], applyApprovalChecked: false },
      applyHistory: []
    },
    handoffs: {
      intentHandoff: { scope: { sections: ["Chorus 1"], targetIds: ["Snowman"] } },
      planHandoff: {
        commands: [{ cmd: "effects.create" }],
        metadata: {
          trainingKnowledge: {
            artifactType: "sequencer_stage1_training_bundle",
            artifactVersion: "1.0"
          },
          sequencingDesignHandoff: {
            designSummary: "Snowman chorus focus",
            scope: { sections: ["Chorus 1"] },
            focusPlan: { primaryTargetIds: ["Snowman"] },
            sectionDirectives: [
              { sectionName: "Chorus 1", preferredVisualFamilies: ["static_fill"] }
            ]
          }
        }
      },
      analysisHandoff: null
    },
    helpers: {
      getSelectedSections: () => ["Chorus 1"],
      hasAllSectionsSelected: () => false,
      getSectionName: (line = "") => String(line).split('/')[0].trim(),
      selectedProposedLinesForApply: () => ["Chorus 1 / Snowman / add Color Wash with warm amber glow"],
      summarizeImpactForLines: () => ({ targetCount: 1, sectionWindows: [{ sectionName: "Chorus 1" }] }),
      buildDesignerPlanCommands: () => [{ cmd: "effects.create" }],
      applyReadyForApprovalGate: () => true,
      applyDisabledReason: () => "",
      buildCurrentReviewSnapshotSummary: () => ({ designSummary: { title: "Direct sequence test" } }),
      basenameOfPath: (value = "") => String(value).split(/[\/]/).pop(),
      getMetadataTagRecords: () => [],
      buildMetadataTargets: () => [],
      matchesMetadataFilterValue: () => true,
      normalizeMetadataSelectionIds: (value = []) => value,
      normalizeMetadataSelectedTags: (value = []) => value,
      getAgentApplyRolloutMode: () => "enabled",
      getManualLockedXdTracks: () => [],
      getTeamChatIdentities: () => [],
      getDiagnosticsCounts: () => ({ warningCount: 0, errorCount: 0 }),
      buildLabel: "test"
    },
    expected: {
      sequenceName: "Validation-Clean-Phase1.xsq",
      target: "Snowman",
      section: "Chorus 1",
      effectName: "Color Wash"
    },
    deps: {
      readSequenceState: async () => ({
        contract: "xlights_sequence_state_v1",
        sequence: { isOpen: true, name: "Validation-Clean-Phase1.xsq", revision: "rev-1" },
        timing: { trackNames: ["XD: Song Structure"] }
      }),
      readEffectOccupancy: async () => ({
        contract: "xlights_effect_occupancy_state_v1",
        matchedCount: 1,
        rows: [{ ok: true }]
      })
    }
  });

  assert.equal(result.validation.contract, "clean_sequence_validation_state_v1");
  assert.equal(result.pageStates.sequence.page, "sequence");
  assert.equal(result.xlightsSequenceState.sequence.name, "Validation-Clean-Phase1.xsq");
  assert.equal(result.validation.designContext.designSummary, "Snowman chorus focus");
  assert.equal(result.validation.designContext.trainingKnowledge.artifactType, "sequencer_stage1_training_bundle");
});
