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
  assert.deepEqual(out.revisionRoles, ["strengthen_lead"]);
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
