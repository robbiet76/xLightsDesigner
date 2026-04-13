import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSequenceArtisticGoalFromDesignHandoff,
  buildSequenceRevisionObjectiveFromArtifacts
} from "../../../agent/designer-dialog/sequence-artifacts.js";

function sampleHandoff() {
  return {
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
  };
}

test("buildSequenceArtisticGoalFromDesignHandoff derives initial artistic goal from design handoff", () => {
  const out = buildSequenceArtisticGoalFromDesignHandoff({
    sequencingDesignHandoff: sampleHandoff(),
    proposalBundle: {
      summary: "Warm restrained intro with stronger chorus payoff."
    }
  });

  assert.equal(out.artifactType, "sequence_artistic_goal_v1");
  assert.equal(out.scope.goalLevel, "section");
  assert.equal(out.artisticIntent.leadTarget, "MegaTree");
  assert.deepEqual(out.artisticIntent.supportTargets, ["Roofline"]);
  assert.equal(out.artisticIntent.motionCharacter, "expanding_motion");
  assert.equal(out.artisticIntent.densityCharacter, "moderate");
  assert.ok(out.evaluationLens.comparisonQuestions.length > 0);
});

test("buildSequenceRevisionObjectiveFromArtifacts derives initial sequencer objective", () => {
  const artisticGoal = buildSequenceArtisticGoalFromDesignHandoff({
    sequencingDesignHandoff: sampleHandoff(),
    proposalBundle: {
      summary: "Warm restrained intro with stronger chorus payoff."
    }
  });
  const out = buildSequenceRevisionObjectiveFromArtifacts({
    sequenceArtisticGoal: artisticGoal,
    sequencingDesignHandoff: sampleHandoff()
  });

  assert.equal(out.artifactType, "sequence_revision_objective_v1");
  assert.equal(out.scope.nextOwner, "sequencer");
  assert.equal(out.ladderLevel, "section");
  assert.match(out.sequencerDirection.executionObjective, /MegaTree/i);
  assert.deepEqual(out.sequencerDirection.blockedMoves, ["no_full_yard_noise_wall"]);
  assert.ok(out.successChecks.some((row) => /dominant visual lead/i.test(String(row))));
});
