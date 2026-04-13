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
      scope: { nextOwner: "shared", revisionTargets: ["MegaTree", "Roofline"] },
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
    }
  });

  assert.equal(out.artifactType, "sequencer_revision_brief_v1");
  assert.equal(out.ladderLevel, "section");
  assert.equal(out.nextOwner, "shared");
  assert.equal(out.leadTarget, "ArchSingle");
  assert.deepEqual(out.supportTargets, ["MatrixLowDensity"]);
  assert.deepEqual(out.targetScope, ["MatrixLowDensity", "MegaTree", "Roofline", "ArchSingle"]);
  assert.deepEqual(out.revisionTargets, ["MegaTree", "Roofline"]);
  assert.deepEqual(out.focusTargets, ["MatrixLowDensity"]);
  assert.deepEqual(out.sectionScope, ["Chorus 1"]);
  assert.deepEqual(out.blockedMoves, ["do_not_add_second_lead"]);
  assert.deepEqual(out.successChecks, ["section arc reads clearly", "lead target remains dominant"]);
  assert.match(out.summary, /Clarify the section arc/i);
  assert.match(out.summary, /Introduce restrained support evolution/i);
});
