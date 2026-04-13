import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSequenceArtisticGoalFromDesignHandoff,
  buildSequenceRevisionObjectiveFromArtifacts,
  refreshSequenceArtisticGoalFromPracticalValidation,
  refreshSequenceRevisionObjectiveFromPracticalValidation,
  refreshSequenceArtisticGoalFromRenderCritique,
  refreshSequenceRevisionObjectiveFromRenderCritique
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

test("refreshSequenceArtisticGoalFromPracticalValidation updates the next artistic question from failures", () => {
  const prior = buildSequenceArtisticGoalFromDesignHandoff({
    sequencingDesignHandoff: sampleHandoff(),
    proposalBundle: { summary: "Warm restrained intro with stronger chorus payoff." }
  });
  const out = refreshSequenceArtisticGoalFromPracticalValidation({
    priorArtisticGoal: prior,
    sequencingDesignHandoff: sampleHandoff(),
    practicalValidation: {
      status: "applied",
      overallOk: false,
      failures: {
        quality: [
          {
            kind: "active_target_scale",
            target: "sequence",
            detail: "Whole-song active target breadth too low (3 active targets)."
          }
        ]
      }
    }
  });

  assert.match(out.evaluationLens.comparisonQuestions[0], /Whole-song active target breadth too low/i);
  assert.ok(out.evaluationLens.mustImprove.some((row) => /active target breadth too low/i.test(String(row))));
});

test("refreshSequenceRevisionObjectiveFromPracticalValidation updates sequencer objective from failures", () => {
  const priorGoal = buildSequenceArtisticGoalFromDesignHandoff({
    sequencingDesignHandoff: sampleHandoff(),
    proposalBundle: { summary: "Warm restrained intro with stronger chorus payoff." }
  });
  const priorObjective = buildSequenceRevisionObjectiveFromArtifacts({
    sequenceArtisticGoal: priorGoal,
    sequencingDesignHandoff: sampleHandoff()
  });
  const refreshedGoal = refreshSequenceArtisticGoalFromPracticalValidation({
    priorArtisticGoal: priorGoal,
    sequencingDesignHandoff: sampleHandoff(),
    practicalValidation: {
      status: "applied",
      overallOk: false,
      failures: {
        quality: [
          {
            kind: "section_density_scale",
            target: "sequence",
            detail: "Whole-song section placement density too low (2.0 placements/section)."
          }
        ]
      }
    }
  });
  const out = refreshSequenceRevisionObjectiveFromPracticalValidation({
    priorRevisionObjective: priorObjective,
    sequenceArtisticGoal: refreshedGoal,
    sequencingDesignHandoff: sampleHandoff(),
    practicalValidation: {
      status: "applied",
      overallOk: false,
      failures: {
        quality: [
          {
            kind: "section_density_scale",
            target: "sequence",
            detail: "Whole-song section placement density too low (2.0 placements/section)."
          }
        ]
      }
    }
  });

  assert.equal(out.scope.nextOwner, "shared");
  assert.match(out.sequencerDirection.executionObjective, /section placement density too low/i);
  assert.ok(out.sequencerDirection.blockedMoves.includes("section_density_scale"));
});

test("refreshSequenceArtisticGoalFromRenderCritique updates artistic question from rendered outcome", () => {
  const prior = buildSequenceArtisticGoalFromDesignHandoff({
    sequencingDesignHandoff: sampleHandoff(),
    proposalBundle: { summary: "Warm restrained intro with stronger chorus payoff." }
  });
  const out = refreshSequenceArtisticGoalFromRenderCritique({
    priorArtisticGoal: prior,
    sequencingDesignHandoff: sampleHandoff(),
    renderCritiqueContext: {
      source: {
        renderObservationArtifactId: "obs-1"
      },
      observed: {
        leadModel: "Roofline",
        breadthRead: "tight",
        temporalRead: "flat"
      },
      comparison: {
        leadMatchesPrimaryFocus: false,
        missingPrimaryFocusTargets: ["MegaTree"],
        broadCoverageExpected: true,
        renderUsesBroadScene: false
      },
      expected: {
        supportTargetIds: ["Roofline"]
      }
    }
  });

  assert.match(out.evaluationLens.comparisonQuestions[0], /Rendered lead does not match the intended primary focus/i);
  assert.ok(out.evaluationLens.mustImprove.some((row) => /Bring intended focus targets into the rendered pass/i.test(String(row))));
  assert.ok(out.evaluationLens.mustImprove.some((row) => /too flat across the sampled window/i.test(String(row))));
  assert.equal(out.traceability.renderCritiqueArtifactId, "obs-1");
  assert.equal(out.traceability.renderCritiqueTemporalRead, "flat");
});

test("refreshSequenceRevisionObjectiveFromRenderCritique updates sequencer objective from rendered outcome", () => {
  const priorGoal = buildSequenceArtisticGoalFromDesignHandoff({
    sequencingDesignHandoff: sampleHandoff(),
    proposalBundle: { summary: "Warm restrained intro with stronger chorus payoff." }
  });
  const priorObjective = buildSequenceRevisionObjectiveFromArtifacts({
    sequenceArtisticGoal: priorGoal,
    sequencingDesignHandoff: sampleHandoff()
  });
  const refreshedGoal = refreshSequenceArtisticGoalFromRenderCritique({
    priorArtisticGoal: priorGoal,
    sequencingDesignHandoff: sampleHandoff(),
    renderCritiqueContext: {
      observed: {
        leadModel: "Roofline",
        breadthRead: "tight"
      },
      comparison: {
        leadMatchesPrimaryFocus: false,
        missingPrimaryFocusTargets: ["MegaTree"],
        broadCoverageExpected: false,
        renderUsesBroadScene: true
      },
      expected: {
        supportTargetIds: ["Roofline"]
      }
    }
  });
  const out = refreshSequenceRevisionObjectiveFromRenderCritique({
    priorRevisionObjective: priorObjective,
    sequenceArtisticGoal: refreshedGoal,
    sequencingDesignHandoff: sampleHandoff(),
    renderCritiqueContext: {
      observed: {
        leadModel: "Roofline",
        breadthRead: "broad"
      },
      comparison: {
        leadMatchesPrimaryFocus: false,
        missingPrimaryFocusTargets: ["MegaTree"],
        broadCoverageExpected: false,
        renderUsesBroadScene: true
      },
      expected: {
        supportTargetIds: ["Roofline"]
      }
    }
  });

  assert.equal(out.scope.nextOwner, "shared");
  assert.match(out.sequencerDirection.executionObjective, /rendered composition problem/i);
  assert.ok(out.sequencerDirection.blockedMoves.some((row) => /Rendered lead does not match the intended primary focus/i.test(String(row))));
});

test("refreshSequenceArtisticGoalFromRenderCritique flags adjacent windows that read too similarly", () => {
  const prior = buildSequenceArtisticGoalFromDesignHandoff({
    sequencingDesignHandoff: sampleHandoff(),
    proposalBundle: { summary: "Warm restrained intro with stronger chorus payoff." }
  });
  const out = refreshSequenceArtisticGoalFromRenderCritique({
    priorArtisticGoal: prior,
    sequencingDesignHandoff: sampleHandoff(),
    renderCritiqueContext: {
      observed: {
        leadModel: "MegaTree",
        breadthRead: "moderate",
        temporalRead: "modulated"
      },
      comparison: {
        leadMatchesPrimaryFocus: true,
        missingPrimaryFocusTargets: [],
        broadCoverageExpected: false,
        renderUsesBroadScene: false,
        adjacentWindowComparisons: [
          {
            fromLabel: "Verse",
            toLabel: "Chorus",
            windowsReadSimilarly: true,
            sameLeadModel: true
          }
        ]
      },
      expected: {
        supportTargetIds: ["Roofline"]
      }
    }
  });

  assert.ok(out.evaluationLens.mustImprove.some((row) => /reading too similarly/i.test(String(row))));
  assert.ok(out.evaluationLens.mustImprove.some((row) => /hierarchy is not shifting enough/i.test(String(row))));
});

test("refreshSequenceRevisionObjectiveFromRenderCritique pins section-level revision for adjacent window contrast failures", () => {
  const priorGoal = buildSequenceArtisticGoalFromDesignHandoff({
    sequencingDesignHandoff: sampleHandoff(),
    proposalBundle: { summary: "Warm restrained intro with stronger chorus payoff." }
  });
  const priorObjective = buildSequenceRevisionObjectiveFromArtifacts({
    sequenceArtisticGoal: priorGoal,
    sequencingDesignHandoff: sampleHandoff()
  });
  const out = refreshSequenceRevisionObjectiveFromRenderCritique({
    priorRevisionObjective: priorObjective,
    sequenceArtisticGoal: priorGoal,
    sequencingDesignHandoff: sampleHandoff(),
    renderCritiqueContext: {
      observed: {
        leadModel: "MegaTree",
        breadthRead: "moderate",
        temporalRead: "modulated"
      },
      comparison: {
        leadMatchesPrimaryFocus: true,
        missingPrimaryFocusTargets: [],
        broadCoverageExpected: false,
        renderUsesBroadScene: false,
        adjacentWindowComparisons: [
          {
            fromLabel: "Verse",
            toLabel: "Chorus",
            windowsReadSimilarly: true,
            sameLeadModel: true
          }
        ]
      },
      expected: {
        supportTargetIds: ["Roofline"]
      }
    }
  });

  assert.equal(out.scope.nextOwner, "shared");
  assert.equal(out.ladderLevel, "section");
  assert.equal(out.sequencerDirection.revisionBatchShape, "section_pass");
  assert.match(out.sequencerDirection.executionObjective, /strengthen contrast and hierarchy between adjacent sampled sections/i);
});
