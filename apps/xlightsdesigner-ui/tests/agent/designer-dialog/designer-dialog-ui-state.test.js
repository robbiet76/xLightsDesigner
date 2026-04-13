import test from "node:test";
import assert from "node:assert/strict";

import {
  applyDesignerProposalSuccessToState,
  buildDesignerCompletionMessage,
  buildDesignerGuidedQuestionMessage
} from "../../../agent/designer-dialog/designer-dialog-ui-state.js";

test("designer ui-state applies canonical proposal artifacts to app state", () => {
  const state = {
    creative: {},
    flags: { creativeBriefReady: false },
    proposed: []
  };

  applyDesignerProposalSuccessToState(state, {
    ok: true,
    source: "cloud_normalized",
    summary: "Warm restrained intro with stronger chorus payoff.",
    assistantMessage: "I’m starting broad, keeping the intro calm, and saving the focal push for the chorus.",
    warnings: ["Proceeding without full lyric alignment."],
    diagnostics: { artifactType: "designer_dialog_diagnostics_v1" },
    creativeBrief: { briefType: "creative_brief_v1" },
    proposalBundle: {
      bundleType: "proposal_bundle_v1",
      baseRevision: "rev-5",
      lifecycle: {
        status: "fresh",
        stale: false,
        baseRevision: "rev-5",
        currentRevision: "rev-5",
        rebasedFrom: null,
        staleReason: "",
        updatedAt: new Date().toISOString()
      }
    },
    proposalLines: ["Chorus / MegaTree / warm up palette and reduce clutter."]
  });

  assert.equal(state.creative.brief.briefType, "creative_brief_v1");
  assert.equal(state.creative.proposalBundle.bundleType, "proposal_bundle_v1");
  assert.equal(state.flags.creativeBriefReady, true);
  assert.equal(state.flags.hasDraftProposal, true);
  assert.equal(state.flags.proposalStale, false);
  assert.equal(state.draftBaseRevision, "rev-5");
  assert.deepEqual(state.proposed, ["Chorus / MegaTree / warm up palette and reduce clutter."]);
  assert.equal(state.creative.runtime.source, "cloud_normalized");
  assert.equal(state.creative.runtime.status, "ok");
  assert.match(state.creative.runtime.assistantMessage, /saving the focal push/i);
  assert.deepEqual(state.creative.runtime.warnings, ["Proceeding without full lyric alignment."]);
  assert.equal(state.creative.sequencingDesignHandoff, null);
  assert.equal(state.creative.sequenceArtisticGoal, null);
  assert.equal(state.creative.sequenceRevisionObjective, null);
});

test("designer ui-state derives artistic goal and revision objective from sequencing design handoff", () => {
  const state = {
    creative: {},
    flags: { creativeBriefReady: false },
    proposed: []
  };

  applyDesignerProposalSuccessToState(state, {
    ok: true,
    source: "local_runtime",
    summary: "MegaTree-led chorus with readable roofline support.",
    proposalBundle: {
      bundleType: "proposal_bundle_v1",
      summary: "MegaTree-led chorus with readable roofline support.",
      lifecycle: {
        status: "fresh",
        stale: false,
        baseRevision: "rev-5",
        currentRevision: "rev-5",
        rebasedFrom: null,
        staleReason: "",
        updatedAt: new Date().toISOString()
      }
    },
    sequencingDesignHandoff: {
      artifactType: "sequencing_design_handoff_v2",
      designSummary: "MegaTree leads while roofline supports the chorus lift.",
      scope: {
        sections: ["Chorus 1"],
        targetIds: ["MegaTree", "Roofline"]
      },
      sectionDirectives: [
        {
          sectionName: "Chorus 1",
          motionTarget: "expanding_motion",
          densityTarget: "moderate",
          notes: "a clear chorus lift with readable focal hierarchy"
        }
      ],
      focusPlan: {
        primaryTargets: ["MegaTree"],
        secondaryTargets: ["Roofline"],
        balanceRule: "Preserve a readable lead/support/accent hierarchy across the scoped sections."
      },
      avoidances: ["no_full_yard_noise_wall"]
    },
    proposalLines: ["Chorus / MegaTree / build the chorus lift with restrained roofline support."]
  });

  assert.equal(state.creative.sequenceArtisticGoal.artifactType, "sequence_artistic_goal_v1");
  assert.equal(state.creative.sequenceArtisticGoal.artisticIntent.leadTarget, "MegaTree");
  assert.equal(state.creative.sequenceRevisionObjective.artifactType, "sequence_revision_objective_v1");
  assert.equal(state.creative.sequenceRevisionObjective.scope.nextOwner, "sequencer");
});

test("designer ui-state builds concise guided-question chat message", () => {
  const message = buildDesignerGuidedQuestionMessage([
    "Should the chorus stay focused on the megatree?",
    "Do you want warmer whites or amber?"
  ]);
  assert.match(message, /Before I refine the next pass, I need these decisions from you:/);
  assert.match(message, /megatree/i);
  assert.match(message, /amber/i);
});

test("designer ui-state builds contextual completion message from proposal traceability", () => {
  const message = buildDesignerCompletionMessage({
    creativeBrief: {
      summary: "Nostalgic first pass with a cleaner chorus payoff."
    },
    proposalBundle: {
      summary: "Nostalgic first pass with a cleaner chorus payoff.",
      assumptions: [
        "Start with a balanced full-yard pass before introducing focal overrides."
      ],
      traceability: {
        designSceneSignals: {
          broadCoverageDomains: ["AllModels"],
          focalCandidates: ["MegaTree"]
        },
        musicDesignSignals: {
          revealMoments: ["Verse->Chorus"],
          holdMoments: ["Intro"]
        }
      }
    }
  });

  assert.match(message, /Nostalgic first pass/);
  assert.match(message, /broad coverage on AllModels/i);
  assert.match(message, /keeping MegaTree as a focal anchor/i);
  assert.match(message, /contrast into Verse->Chorus/i);
  assert.match(message, /preserving restraint through Intro/i);
  assert.match(message, /Assumptions:/i);
});
