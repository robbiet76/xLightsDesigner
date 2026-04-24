import test from "node:test";
import assert from "node:assert/strict";

import { buildSequencerRevisionBrief } from "../../../agent/sequence-agent/revision-planner.js";

test("buildSequencerRevisionBrief returns null when no inputs are provided", () => {
  assert.equal(buildSequencerRevisionBrief(), null);
});

test("buildSequencerRevisionBrief builds a compact sequencer-facing brief", () => {
  const out = buildSequencerRevisionBrief({
    sequenceArtisticGoal: {
      artifactType: "sequence_artistic_goal_v1",
      scope: { goalLevel: "section" },
      artisticIntent: {
        leadTarget: "ArchSingle",
        supportTargets: ["MatrixLowDensity"],
        sectionArc: "opening_hold_to_mid_lift_to_release",
        motionCharacter: "restrained_motion",
        densityCharacter: "moderate"
      },
      evaluationLens: {
        comparisonQuestions: ["Does the section evolve clearly from opening to close?"]
      }
    },
    sequenceRevisionObjective: {
      artifactType: "sequence_revision_objective_v1",
      ladderLevel: "section",
      scope: { nextOwner: "shared", revisionRoles: ["strengthen_lead"], revisionTargets: ["MegaTree", "Roofline"] },
      designerDirection: {
        artisticCorrection: "Clarify the section arc without splitting the focal read."
      },
      sequencerDirection: {
        executionObjective: "Introduce restrained support evolution across the middle third.",
        blockedMoves: ["do_not_add_second_lead"],
        focusTargets: ["MatrixLowDensity"]
      },
      successChecks: ["section arc reads clearly", "lead target remains dominant"]
    },
    sequencingDesignHandoff: {
      artifactType: "sequencing_design_handoff_v2",
      scope: {
        targetIds: ["ArchSingle", "MatrixLowDensity"],
        sections: ["Chorus 1"]
      }
    },
    priorPassMemory: {
      artifactType: "sequencer_prior_pass_memory_v1",
      unresolvedSignals: ["lead_mismatch", "flat_development"],
      retryPressureSignals: ["low_change_retry"]
    }
  });

  assert.equal(out.artifactType, "sequencer_revision_brief_v1");
  assert.equal(out.ladderLevel, "section");
  assert.equal(out.nextOwner, "shared");
  assert.equal(out.requestScopeMode, "section_target_refinement");
  assert.equal(out.reviewStartLevel, "section");
  assert.equal(out.sectionScopeKind, "timing_track_windows");
  assert.equal(out.leadTarget, "ArchSingle");
  assert.deepEqual(out.supportTargets, ["MatrixLowDensity"]);
  assert.deepEqual(out.targetScope, ["MatrixLowDensity", "MegaTree", "Roofline", "ArchSingle"]);
  assert.deepEqual(out.revisionRoles, ["strengthen_lead", "add_section_development"]);
  assert.deepEqual(out.revisionTargets, ["MegaTree", "Roofline"]);
  assert.deepEqual(out.focusTargets, ["MatrixLowDensity"]);
  assert.deepEqual(out.sectionScope, ["Chorus 1"]);
  assert.deepEqual(out.blockedMoves, ["do_not_add_second_lead"]);
  assert.deepEqual(out.successChecks, ["section arc reads clearly", "lead target remains dominant"]);
  assert.deepEqual(out.priorPassMemory.unresolvedSignals, ["lead_mismatch", "flat_development"]);
  assert.deepEqual(out.retryPressureSignals, ["low_change_retry"]);
  assert.match(out.summary, /Clarify the section arc/i);
  assert.match(out.summary, /Introduce restrained support evolution/i);
  assert.match(out.summary, /lead_mismatch/i);
  assert.match(out.summary, /low_change_retry/i);
});

test("buildSequencerRevisionBrief prefers retry pressure artifact signals when present", () => {
  const out = buildSequencerRevisionBrief({
    sequenceRevisionObjective: {
      artifactType: "sequence_revision_objective_v1",
      ladderLevel: "section",
      scope: { nextOwner: "shared" },
      designerDirection: { artisticCorrection: "Keep the pass moving." },
      sequencerDirection: { executionObjective: "Try a more distinct alternate." }
    },
    priorPassMemory: {
      artifactType: "sequencer_prior_pass_memory_v1",
      retryPressureSignals: ["low_change_retry"]
    },
    revisionRetryPressure: {
      artifactType: "revision_retry_pressure_v1",
      signals: ["oscillation_retry"]
    }
  });

  assert.deepEqual(out.retryPressureSignals, ["oscillation_retry"]);
  assert.equal(out.revisionRetryPressure.artifactType, "revision_retry_pressure_v1");
  assert.match(out.summary, /oscillation_retry/i);
});

test("buildSequencerRevisionBrief prefers revision feedback direction when present", () => {
  const out = buildSequencerRevisionBrief({
    sequenceArtisticGoal: {
      artifactType: "sequence_artistic_goal_v1",
      artisticIntent: {
        leadTarget: "MegaTree",
        supportTargets: ["Roofline"]
      }
    },
    sequenceRevisionObjective: {
      artifactType: "sequence_revision_objective_v1",
      ladderLevel: "section",
      scope: { nextOwner: "shared", revisionRoles: ["strengthen_lead"], revisionTargets: ["MegaTree"] },
      designerDirection: { artisticCorrection: "Keep the tree dominant." },
      sequencerDirection: { executionObjective: "Tighten the lead." },
      successChecks: ["tree remains dominant"]
    },
    revisionFeedback: {
      artifactType: "revision_feedback_v1",
      rejectionReasons: ["Rendered lead does not match the intended primary focus."],
      nextDirection: {
        artisticCorrection: "Restore MegaTree as the dominant lead.",
        executionObjective: "Strengthen MegaTree lead and reduce competing support.",
        revisionRoles: ["strengthen_lead", "reduce_competing_support"],
        targetIds: ["MegaTree", "Roofline"],
        successChecks: ["Rendered composition issue addressed: focus restored."],
        changeBias: {
          composition: {
            mismatch: true,
            targetShape: "narrow_focus"
          },
          progression: {
            mismatch: false,
            temporalVariation: "preserve"
          },
          layering: {
            mismatch: true,
            separation: "increase",
            density: "reduce"
          }
        }
      }
    }
  });

  assert.equal(out.artisticGoalSummary, "Restore MegaTree as the dominant lead.");
  assert.equal(out.executionObjective, "Strengthen MegaTree lead and reduce competing support.");
  assert.deepEqual(out.revisionRoles, ["strengthen_lead", "reduce_competing_support"]);
  assert.deepEqual(out.revisionTargets, ["MegaTree", "Roofline"]);
  assert.deepEqual(out.focusTargets, ["MegaTree", "Roofline"]);
  assert.ok(out.successChecks.includes("Rendered composition issue addressed: focus restored."));
  assert.equal(out.changeBias.composition.targetShape, "narrow_focus");
  assert.equal(out.changeBias.layering.separation, "increase");
  assert.match(out.summary, /Rendered lead does not match the intended primary focus/i);
});

test("buildSequencerRevisionBrief maps unresolved prior-pass signals to bounded revision roles", () => {
  const out = buildSequencerRevisionBrief({
    sequenceRevisionObjective: {
      artifactType: "sequence_revision_objective_v1",
      ladderLevel: "section",
      scope: { nextOwner: "shared" },
      designerDirection: { artisticCorrection: "Fix the unresolved proof-loop failures." },
      sequencerDirection: { executionObjective: "Use the prior pass evidence to choose a different revision role." }
    },
    priorPassMemory: {
      artifactType: "sequencer_prior_pass_memory_v1",
      unresolvedSignals: [
        "lead_mismatch",
        "over_coverage",
        "under_coverage",
        "weak_section_contrast",
        "flat_development"
      ]
    }
  });

  assert.deepEqual(out.revisionRoles, [
    "strengthen_lead",
    "reduce_competing_support",
    "widen_support",
    "increase_section_contrast",
    "add_section_development"
  ]);
});

test("buildSequencerRevisionBrief maps prior proof signals to safe revision targets", () => {
  const out = buildSequencerRevisionBrief({
    sequenceArtisticGoal: {
      artifactType: "sequence_artistic_goal_v1",
      artisticIntent: {
        supportTargets: ["Roofline", "WindowFrames"]
      }
    },
    sequenceRevisionObjective: {
      artifactType: "sequence_revision_objective_v1",
      ladderLevel: "section",
      scope: { nextOwner: "shared" },
      designerDirection: { artisticCorrection: "Use prior pass evidence." },
      sequencerDirection: { executionObjective: "Retarget the next revision safely." }
    },
    priorPassMemory: {
      artifactType: "sequencer_prior_pass_memory_v1",
      unresolvedSignals: ["lead_mismatch", "under_coverage", "weak_section_contrast"],
      previousLeadModel: "MegaTree",
      previousRevisionTargets: ["MegaTree"],
      previousTargetIds: ["MegaTree", "Roofline"]
    }
  });

  assert.deepEqual(out.focusTargets, ["MegaTree"]);
  assert.deepEqual(out.revisionTargets, ["MegaTree", "Roofline", "WindowFrames"]);
  assert.deepEqual(out.targetScope, ["MegaTree", "Roofline", "WindowFrames"]);
});

test("buildSequencerRevisionBrief keeps section instability broad until drilldown evidence is eligible", () => {
  const out = buildSequencerRevisionBrief({
    sequenceArtisticGoal: {
      artifactType: "sequence_artistic_goal_v1",
      artisticIntent: {
        supportTargets: ["Roofline"]
      }
    },
    sequenceRevisionObjective: {
      artifactType: "sequence_revision_objective_v1",
      ladderLevel: "section",
      scope: { nextOwner: "shared" },
      designerDirection: { artisticCorrection: "Use prior pass evidence." },
      sequencerDirection: { executionObjective: "Retain section-level correction first." }
    },
    priorPassMemory: {
      artifactType: "sequencer_prior_pass_memory_v1",
      unresolvedSignals: ["weak_section_contrast"],
      previousRevisionTargets: ["Verse", "Chorus"],
      previousTargetIds: ["Verse", "Chorus"],
      drilldownMemory: {
        heldAtSectionLevel: true,
        eligible: false,
        targetIds: [],
        withheldTargetIds: ["MegaTree", "Roofline"]
      }
    }
  });

  assert.deepEqual(out.revisionTargets, ["Verse", "Chorus"]);
  assert.deepEqual(out.targetScope, ["Verse", "Chorus"]);
  assert.equal(out.groupModelRevisionHints.heldAtSectionLevel, true);
  assert.deepEqual(out.groupModelRevisionHints.withheldTargetIds, ["MegaTree", "Roofline"]);
});

test("buildSequencerRevisionBrief emits bounded group model hints from eligible drilldown memory", () => {
  const out = buildSequencerRevisionBrief({
    sequenceRevisionObjective: {
      artifactType: "sequence_revision_objective_v1",
      ladderLevel: "section",
      scope: { nextOwner: "shared" },
      designerDirection: { artisticCorrection: "Use drilldown evidence." },
      sequencerDirection: { executionObjective: "Narrow the implicated correction." }
    },
    priorPassMemory: {
      artifactType: "sequencer_prior_pass_memory_v1",
      unresolvedSignals: ["weak_section_contrast"],
      previousRevisionTargets: ["Verse", "Chorus"],
      previousTargetIds: ["Verse", "Chorus"],
      drilldownMemory: {
        heldAtSectionLevel: false,
        eligible: true,
        targetIds: ["MegaTree", "Roofline"],
        withheldTargetIds: []
      }
    }
  });

  assert.deepEqual(out.revisionTargets, ["MegaTree", "Roofline", "Verse", "Chorus"]);
  assert.deepEqual(out.targetScope, ["MegaTree", "Roofline", "Verse", "Chorus"]);
  assert.equal(out.groupModelRevisionHints.eligible, true);
});
