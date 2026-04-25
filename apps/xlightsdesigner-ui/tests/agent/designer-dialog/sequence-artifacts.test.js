import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSequenceArtisticGoalFromDesignHandoff,
  buildSequenceRevisionObjectiveFromArtifacts,
  buildSequenceRevisionFeedback,
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

test("refreshSequenceRevisionObjectiveFromPracticalValidation creates preservation-specific next pass guidance", () => {
  const priorGoal = buildSequenceArtisticGoalFromDesignHandoff({
    sequencingDesignHandoff: sampleHandoff(),
    proposalBundle: { summary: "Warm restrained intro with stronger chorus payoff." }
  });
  const priorObjective = buildSequenceRevisionObjectiveFromArtifacts({
    sequenceArtisticGoal: priorGoal,
    sequencingDesignHandoff: sampleHandoff()
  });
  const out = refreshSequenceRevisionObjectiveFromPracticalValidation({
    priorRevisionObjective: priorObjective,
    sequenceArtisticGoal: priorGoal,
    sequencingDesignHandoff: sampleHandoff(),
    practicalValidation: {
      status: "applied",
      overallOk: false,
      failures: {
        readback: [
          {
            kind: "effect-preservation",
            target: "Snowman@0->1",
            detail: "original layer 0 missing preserved effects"
          }
        ]
      }
    }
  });

  assert.match(out.sequencerDirection.executionObjective, /preserve existing effects/i);
  assert.ok(out.sequencerDirection.blockedMoves.includes("overwrite_existing_effects_without_scope"));
  assert.ok(out.sequencerDirection.revisionRoles.includes("preserve_existing_effects"));
  assert.ok(out.successChecks.some((row) => /original layers unless replacement is explicitly authorized/i.test(String(row))));
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
  assert.deepEqual(out.scope.revisionRoles, ["increase_section_contrast"]);
  assert.deepEqual(out.scope.revisionTargets, ["Verse", "Chorus"]);
  assert.deepEqual(out.sequencerDirection.revisionRoles, ["increase_section_contrast"]);
  assert.deepEqual(out.sequencerDirection.focusTargets, ["Verse", "Chorus"]);
  assert.equal(out.sequencerDirection.revisionBatchShape, "section_pass");
  assert.match(out.sequencerDirection.executionObjective, /strengthen contrast and hierarchy between adjacent sampled sections/i);
});

test("refreshSequenceRevisionObjectiveFromRenderCritique escalates to group revision when drilldown evidence identifies implicated models", () => {
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
      source: {
        samplingDetail: "drilldown"
      },
      observed: {
        leadModel: "MegaTree",
        breadthRead: "moderate",
        temporalRead: "flat"
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
        ],
        drilldownTargetIds: ["MegaTree", "Roofline"]
      },
      expected: {
        supportTargetIds: ["Roofline"]
      }
    }
  });

  assert.equal(out.ladderLevel, "group");
  assert.deepEqual(out.scope.revisionTargets, ["MegaTree", "Roofline", "Verse", "Chorus"]);
  assert.match(out.sequencerDirection.executionObjective, /implicated rendered models\/groups: MegaTree, Roofline/i);
});

test("refreshSequenceRevisionObjectiveFromRenderCritique carries render-driven model targets into the next pass", () => {
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
        leadModel: "Roofline",
        breadthRead: "tight",
        temporalRead: "flat"
      },
      comparison: {
        leadMatchesPrimaryFocus: false,
        missingPrimaryFocusTargets: ["MegaTree"],
        broadCoverageExpected: false,
        renderUsesBroadScene: false,
        adjacentWindowComparisons: []
      },
      expected: {
        supportTargetIds: ["Roofline", "Matrix"]
      }
    }
  });

  assert.deepEqual(out.scope.revisionTargets, ["MegaTree", "Roofline", "Matrix"]);
  assert.deepEqual(out.sequencerDirection.focusTargets, ["MegaTree", "Roofline", "Matrix"]);
  assert.deepEqual(out.scope.revisionRoles, ["strengthen_lead", "widen_support", "add_section_development"]);
  assert.deepEqual(out.sequencerDirection.revisionRoles, ["strengthen_lead", "widen_support", "add_section_development"]);
});

test("refreshSequenceArtisticGoalFromRenderCritique does not force broader support when localized focus is intended", () => {
  const prior = buildSequenceArtisticGoalFromDesignHandoff({
    sequencingDesignHandoff: sampleHandoff(),
    proposalBundle: { summary: "Localized right-side phrase." }
  });
  const out = refreshSequenceArtisticGoalFromRenderCritique({
    priorArtisticGoal: prior,
    sequencingDesignHandoff: sampleHandoff(),
    renderCritiqueContext: {
      observed: {
        leadModel: "WindowRight",
        breadthRead: "tight",
        temporalRead: "modulated",
        coverageGapRegions: ["left"]
      },
      comparison: {
        leadMatchesPrimaryFocus: true,
        missingPrimaryFocusTargets: [],
        broadCoverageExpected: false,
        renderUsesBroadScene: false,
        renderIsLeftRightImbalanced: true,
        localizedFocusExpected: true,
        adjacentWindowComparisons: []
      },
      expected: {
        supportTargetIds: ["Roofline"]
      }
    }
  });

  assert.equal(out.evaluationLens.mustImprove.some((row) => /Support targets are not contributing enough/i.test(String(row))), false);
  assert.equal(out.evaluationLens.mustImprove.some((row) => /weighted to one side of the display/i.test(String(row))), false);
  assert.equal(out.evaluationLens.mustImprove.some((row) => /Visible display gaps remain/i.test(String(row))), false);
});

test("buildSequenceRevisionFeedback derives structured change bias from render critique mismatches", () => {
  const goal = buildSequenceArtisticGoalFromDesignHandoff({
    sequencingDesignHandoff: sampleHandoff(),
    proposalBundle: { summary: "Warm restrained intro with stronger chorus payoff." }
  });
  const objective = refreshSequenceRevisionObjectiveFromRenderCritique({
    priorRevisionObjective: buildSequenceRevisionObjectiveFromArtifacts({
      sequenceArtisticGoal: goal,
      sequencingDesignHandoff: sampleHandoff()
    }),
    sequenceArtisticGoal: goal,
    sequencingDesignHandoff: sampleHandoff(),
    renderCritiqueContext: {
      observed: {
        leadModel: "Roofline",
        breadthRead: "tight",
        temporalRead: "flat"
      },
      comparison: {
        leadMatchesPrimaryFocus: false,
        missingPrimaryFocusTargets: ["MegaTree"],
        broadCoverageExpected: false,
        renderUsesBroadScene: false,
        adjacentWindowComparisons: [
          { windowsReadSimilarly: true, sameLeadModel: true }
        ]
      },
      expected: {
        supportTargetIds: ["Roofline", "Matrix"]
      }
    }
  });

  const out = buildSequenceRevisionFeedback({
    sequenceArtisticGoal: goal,
    sequenceRevisionObjective: objective,
    renderCritiqueContext: {
      observed: {
        leadModel: "Roofline",
        breadthRead: "tight",
        temporalRead: "flat"
      },
      comparison: {
        leadMatchesPrimaryFocus: false,
        missingPrimaryFocusTargets: ["MegaTree"],
        broadCoverageExpected: false,
        renderUsesBroadScene: false,
        adjacentWindowComparisons: [
          { windowsReadSimilarly: true, sameLeadModel: true }
        ]
      },
      expected: {
        supportTargetIds: ["Roofline", "Matrix"]
      }
    },
    revisionRetryPressure: {
      artifactType: "revision_retry_pressure_v1",
      signals: ["low_change_retry"]
    }
  });

  assert.equal(out.artifactType, "revision_feedback_v1");
  assert.equal(out.nextDirection.changeBias.composition.mismatch, true);
  assert.equal(out.nextDirection.changeBias.composition.targetShape, "narrow_focus");
  assert.equal(out.nextDirection.changeBias.progression.mismatch, true);
  assert.equal(out.nextDirection.changeBias.progression.temporalVariation, "increase");
  assert.equal(out.nextDirection.changeBias.layering.mismatch, true);
  assert.equal(out.nextDirection.changeBias.layering.separation, "clarify");
  assert.equal(out.nextDirection.changeBias.layering.density, "preserve");
});

test("buildSequenceRevisionFeedback chooses broaden_support when coverage is too tight for intended spread", () => {
  const goal = buildSequenceArtisticGoalFromDesignHandoff({
    sequencingDesignHandoff: sampleHandoff(),
    proposalBundle: { summary: "Broader field with warm distributed support." }
  });
  const objective = refreshSequenceRevisionObjectiveFromRenderCritique({
    priorRevisionObjective: buildSequenceRevisionObjectiveFromArtifacts({
      sequenceArtisticGoal: goal,
      sequencingDesignHandoff: sampleHandoff()
    }),
    sequenceArtisticGoal: goal,
    sequencingDesignHandoff: sampleHandoff(),
    renderCritiqueContext: {
      observed: {
        leadModel: "MegaTree",
        breadthRead: "tight",
        temporalRead: "modulated"
      },
      comparison: {
        leadMatchesPrimaryFocus: true,
        missingPrimaryFocusTargets: [],
        broadCoverageExpected: true,
        renderUsesBroadScene: false,
        renderCoverageTooSparse: true,
        adjacentWindowComparisons: []
      },
      expected: {
        supportTargetIds: ["Roofline", "Matrix"]
      }
    }
  });

  const out = buildSequenceRevisionFeedback({
    sequenceArtisticGoal: goal,
    sequenceRevisionObjective: objective,
    renderCritiqueContext: {
      observed: {
        leadModel: "MegaTree",
        breadthRead: "tight",
        temporalRead: "modulated"
      },
      comparison: {
        leadMatchesPrimaryFocus: true,
        missingPrimaryFocusTargets: [],
        broadCoverageExpected: true,
        renderUsesBroadScene: false,
        renderCoverageTooSparse: true,
        adjacentWindowComparisons: []
      },
      expected: {
        supportTargetIds: ["Roofline", "Matrix"]
      }
    }
  });

  assert.equal(out.nextDirection.changeBias.composition.mismatch, true);
  assert.equal(out.nextDirection.changeBias.composition.targetShape, "broaden_support");
  assert.equal(out.nextDirection.changeBias.progression.temporalVariation, "preserve");
  assert.equal(out.nextDirection.changeBias.layering.separation, "clarify");
});

test("buildSequenceRevisionFeedback chooses redistribute_scene for imbalanced scenes without focus loss", () => {
  const goal = buildSequenceArtisticGoalFromDesignHandoff({
    sequencingDesignHandoff: sampleHandoff(),
    proposalBundle: { summary: "Balanced moderate scene." }
  });
  const objective = buildSequenceRevisionObjectiveFromArtifacts({
    sequenceArtisticGoal: goal,
    sequencingDesignHandoff: sampleHandoff()
  });

  const out = buildSequenceRevisionFeedback({
    sequenceArtisticGoal: goal,
    sequenceRevisionObjective: objective,
    renderCritiqueContext: {
      observed: {
        leadModel: "MegaTree",
        breadthRead: "moderate",
        temporalRead: "evolving"
      },
      comparison: {
        leadMatchesPrimaryFocus: true,
        missingPrimaryFocusTargets: [],
        broadCoverageExpected: false,
        renderUsesBroadScene: false,
        renderIsLeftRightImbalanced: true,
        adjacentWindowComparisons: []
      },
      expected: {
        supportTargetIds: ["Roofline"]
      }
    }
  });

  assert.equal(out.nextDirection.changeBias.composition.mismatch, true);
  assert.equal(out.nextDirection.changeBias.composition.targetShape, "redistribute_scene");
  assert.equal(out.nextDirection.changeBias.progression.temporalVariation, "preserve");
  assert.equal(out.nextDirection.changeBias.layering.density, "preserve");
});

test("buildSequenceRevisionFeedback carries preservation bias from practical validation failures", () => {
  const goal = buildSequenceArtisticGoalFromDesignHandoff({
    sequencingDesignHandoff: sampleHandoff(),
    proposalBundle: { summary: "Warm restrained intro with stronger chorus payoff." }
  });
  const objective = refreshSequenceRevisionObjectiveFromPracticalValidation({
    priorRevisionObjective: buildSequenceRevisionObjectiveFromArtifacts({
      sequenceArtisticGoal: goal,
      sequencingDesignHandoff: sampleHandoff()
    }),
    sequenceArtisticGoal: goal,
    sequencingDesignHandoff: sampleHandoff(),
    practicalValidation: {
      status: "applied",
      overallOk: false,
      failures: {
        readback: [
          {
            kind: "effect-preservation",
            target: "Snowman@0->1",
            detail: "original layer 0 missing preserved effects"
          }
        ]
      }
    }
  });

  const out = buildSequenceRevisionFeedback({
    sequenceArtisticGoal: goal,
    sequenceRevisionObjective: objective,
    practicalValidation: {
      artifactId: "validation-preserve",
      status: "applied",
      overallOk: false,
      failures: {
        readback: [
          {
            kind: "effect-preservation",
            target: "Snowman@0->1",
            detail: "original layer 0 missing preserved effects"
          }
        ]
      }
    }
  });

  assert.equal(out.status, "revise_required");
  assert.equal(out.nextDirection.changeBias.preservation.mismatch, true);
  assert.equal(out.nextDirection.changeBias.preservation.existingEffects, "preserve_unless_explicit_replace");
  assert.ok(out.nextDirection.revisionRoles.includes("preserve_existing_effects"));
});

test("buildSequenceArtisticGoalFromDesignHandoff marks selected sections as timing-track scoped section work", () => {
  const out = buildSequenceArtisticGoalFromDesignHandoff({
    sequencingDesignHandoff: sampleHandoff()
  });

  assert.equal(out.scope.requestedScope.mode, "section_target_refinement");
  assert.equal(out.scope.requestedScope.reviewStartLevel, "section");
  assert.equal(out.scope.requestedScope.sectionScopeKind, "timing_track_windows");
});

test("buildSequenceRevisionObjectiveFromArtifacts marks target-only requests as local refinement", () => {
  const handoff = sampleHandoff();
  handoff.scope = {
    ...handoff.scope,
    sections: [],
    targetIds: ["MegaTree"]
  };
  const goal = buildSequenceArtisticGoalFromDesignHandoff({
    sequencingDesignHandoff: handoff
  });
  const out = buildSequenceRevisionObjectiveFromArtifacts({
    sequenceArtisticGoal: goal,
    sequencingDesignHandoff: handoff
  });

  assert.equal(out.scope.requestedScope.mode, "target_refinement");
  assert.equal(out.scope.reviewStartLevel, "model");
  assert.equal(out.ladderLevel, "model");
});
